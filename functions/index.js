// ✅ Cloud Functions v2 - Firebase + AWS Rekognition Face Match

const { onRequest, onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const axios = require('axios');
const AWS = require('aws-sdk');
const cors = require('cors')({
    origin: ['https://chaaya.ai', 'http://localhost:3000', 'http://localhost:5173'],
    methods: ['POST', 'OPTIONS'],
    credentials: true
});
const functions = require('firebase-functions');
const { httpsCallable } = require('firebase-functions/v2');
const { matchFacesSequential } = require('./matchFacesSequential');
const sharp = require('sharp');
const { collection, query, where, getDocs } = require('firebase-admin/firestore');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Initialize Firebase Storage bucket
const bucket = admin.storage().bucket();

// Helper function to download file from URL
async function downloadFileAsBuffer(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    } catch (error) {
        console.error('Error downloading file:', error);
        throw error;
    }
}

// Helper function to download file from Firebase Storage
async function downloadStorageFileAsBuffer(filePath) {
    try {
        const [buffer] = await bucket.file(filePath).download();
        return buffer;
    } catch (error) {
        console.error('Error downloading from storage:', error);
        return null;
    }
}

// Create or get face collection
async function ensureCollection(rekognition, collectionId) {
    try {
        await rekognition.describeCollection({ CollectionId: collectionId }).promise();
        console.log(`Collection ${collectionId} already exists`);
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            await rekognition.createCollection({ CollectionId: collectionId }).promise();
            console.log(`Created new collection ${collectionId}`);
        } else {
            throw error;
        }
    }
}

// Add this helper function at the top level
function createValidExternalId(path) {
    // Remove the path and keep only the filename
    const filename = path.split('/').pop();
    // Replace invalid characters with underscores
    return filename.replace(/[^a-zA-Z0-9_.\-:]/g, '_')
        // Replace multiple underscores with a single one
        .replace(/_+/g, '_')
        // Ensure it's not longer than 128 characters (AWS limit)
        .substring(0, 128);
}

// Update the indexFaces function
async function indexFaces(rekognition, collectionId, imageBuffer, externalImageId) {
    try {
        // Create a valid external ID
        const validExternalId = createValidExternalId(externalImageId);
        console.log(`Original externalImageId: ${externalImageId}`);
        console.log(`Valid externalImageId: ${validExternalId}`);

        console.log(`Attempting to index faces for ${validExternalId}`);
        console.log(`Image buffer size: ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB`);

        const MAX_FACES = 30; // Increased to 30 faces
        const result = await rekognition.indexFaces({
            CollectionId: collectionId,
            Image: { Bytes: imageBuffer },
            ExternalImageId: validExternalId,
            MaxFaces: MAX_FACES,
            QualityFilter: 'LOW',
            DetectionAttributes: ['ALL']
        }).promise();

        console.log(`Rekognition response for ${validExternalId}:`, {
            faceRecords: result.FaceRecords?.length || 0,
            unindexedFaces: result.UnindexedFaces?.length || 0,
            orientationCorrection: result.OrientationCorrection,
            faceModelVersion: result.FaceModelVersion
        });

        if (result.FaceRecords.length === 0) {
            if (result.UnindexedFaces?.length > 0) {
                console.log(`No faces indexed for ${validExternalId}. Unindexed faces details:`,
                    result.UnindexedFaces.map(face => ({
                        reasons: face.Reasons,
                        faceDetail: {
                            confidence: face.FaceDetail?.Confidence,
                            boundingBox: face.FaceDetail?.BoundingBox,
                            pose: face.FaceDetail?.Pose,
                            quality: face.FaceDetail?.Quality
                        }
                    }))
                );
            } else {
                console.log(`No faces detected in image ${validExternalId}`);
            }
            return null;
        }

        // Check if we hit the face limit
        const hitFaceLimit = result.FaceRecords.length >= MAX_FACES;
        if (hitFaceLimit) {
            console.log(`Warning: Hit maximum face limit (${MAX_FACES}) for ${validExternalId}. Some faces may not have been detected.`);
        }

        // Return all detected faces with proper null handling
        const faces = result.FaceRecords.map(record => {
            const face = {
                faceId: record.Face.FaceId,
                confidence: record.Face.Confidence || null,
                boundingBox: record.Face.BoundingBox || null
            };

            // Only add pose if it exists and has valid values
            if (record.Face.Pose) {
                face.pose = {
                    Pitch: record.Face.Pose.Pitch || null,
                    Roll: record.Face.Pose.Roll || null,
                    Yaw: record.Face.Pose.Yaw || null
                };
            }

            // Only add quality if it exists and has valid values
            if (record.Face.Quality) {
                face.quality = {
                    Brightness: record.Face.Quality.Brightness || null,
                    Sharpness: record.Face.Quality.Sharpness || null
                };
            }

            return face;
        });

        // Add metadata about face limit
        const faceDetectionResult = {
            faces,
            metadata: {
                totalFacesDetected: faces.length,
                hitFaceLimit,
                maxFacesAllowed: MAX_FACES,
                hasMoreFaces: hitFaceLimit
            }
        };

        console.log(`Successfully indexed ${faces.length} faces for ${validExternalId}:`, faceDetectionResult);
        return faceDetectionResult;
    } catch (error) {
        console.error(`Error indexing face for ${externalImageId}:`, {
            error: error.message,
            code: error.code,
            requestId: error.requestId,
            statusCode: error.statusCode
        });
        return null;
    }
}

// Search for matching faces
async function searchFaces(rekognition, collectionId, imageBuffer, similarityThreshold = 80) {
    try {
        const result = await rekognition.searchFacesByImage({
            CollectionId: collectionId,
            Image: { Bytes: imageBuffer },
            MaxFaces: 1,
            FaceMatchThreshold: similarityThreshold
        }).promise();

        return result.FaceMatches;
    } catch (error) {
        console.error('Error searching faces:', error);
        return [];
    }
}

// 🔐 Required secrets must be linked in function definition
const requiredSecrets = ["AWS_KEY", "AWS_SECRET", "AWS_REGION", "STORAGE_BUCKET"];

// Main face matching function using collections
exports.matchFacesWithCollection = onRequest({
    secrets: requiredSecrets,
    timeoutSeconds: 300,
    memory: '1GiB',
    cors: ['https://chaaya.ai', 'http://localhost:3000', 'http://localhost:5173'],
    invoker: 'public'
}, async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const storageBucketName = process.env.STORAGE_BUCKET;
    const awsConfig = {
        accessKeyId: process.env.AWS_KEY,
        secretAccessKey: process.env.AWS_SECRET,
        region: process.env.AWS_REGION,
    };

    const rekognition = new AWS.Rekognition(awsConfig);
    const db = admin.firestore();

    try {
        const { selfie_url, collectionId, similarityThreshold = 80 } = req.body;
        console.log("Received selfie matching request:", { selfie_url, collectionId, similarityThreshold });

        if (!selfie_url || !collectionId) {
            return res.status(400).json({
                status: 'error',
                error: 'Missing required fields: selfie_url or collectionId'
            });
        }

        // Download selfie image
        const selfieBuffer = await downloadFileAsBuffer(selfie_url);
        console.log(`Downloaded selfie image, size: ${(selfieBuffer.length / 1024 / 1024).toFixed(2)}MB`);

        // Search for matching faces in the collection
        const result = await rekognition.searchFacesByImage({
            CollectionId: collectionId,
            Image: { Bytes: selfieBuffer },
            MaxFaces: 10, // Get top 10 matches
            FaceMatchThreshold: similarityThreshold
        }).promise();

        console.log(`Found ${result.FaceMatches?.length || 0} matching faces`);
        console.log('Face matches:', JSON.stringify(result.FaceMatches, null, 2));

        // Process matches and get additional details from Firestore
        const matches = await Promise.all((result.FaceMatches || []).map(async (match) => {
            try {
                // Get the file document that contains this face
                const filesRef = db.collection('files');
                const q = filesRef.where('faceIds', 'array-contains', match.Face.FaceId);
                const querySnapshot = await q.get();

                console.log(`Searching for face ${match.Face.FaceId} in files collection`);
                console.log(`Found ${querySnapshot.size} matching documents`);

                if (!querySnapshot.empty) {
                    const fileDoc = querySnapshot.docs[0];
                    const fileData = fileDoc.data();

                    console.log('Found matching file:', {
                        path: fileData.path,
                        name: fileData.name,
                        similarity: match.Similarity
                    });

                    // Get the original photo path from the thumbnail path if needed
                    const originalPhotoPath = fileData.path.includes('/thumbnails/')
                        ? fileData.path.replace('/thumbnails/', '/photos/')
                        : fileData.path;

                    return {
                        similarity: match.Similarity,
                        faceId: match.Face.FaceId,
                        confidence: match.Face.Confidence,
                        filePath: originalPhotoPath,
                        fileName: fileData.name,
                        eventId: fileData.eventId,
                        folderName: fileData.folderName,
                        uploadedAt: fileData.uploadedAt
                    };
                }

                // If no match found in faceIds, try searching in faceIndexing array
                const faceIndexingQ = filesRef.where('faceIndexing', 'array-contains', match.Face.FaceId);
                const faceIndexingSnapshot = await faceIndexingQ.get();

                console.log(`Searching for face ${match.Face.FaceId} in faceIndexing array`);
                console.log(`Found ${faceIndexingSnapshot.size} matching documents`);

                if (!faceIndexingSnapshot.empty) {
                    const fileDoc = faceIndexingSnapshot.docs[0];
                    const fileData = fileDoc.data();

                    console.log('Found matching file in faceIndexing:', {
                        path: fileData.path,
                        name: fileData.name,
                        similarity: match.Similarity
                    });

                    // Get the original photo path from the thumbnail path if needed
                    const originalPhotoPath = fileData.path.includes('/thumbnails/')
                        ? fileData.path.replace('/thumbnails/', '/photos/')
                        : fileData.path;

                    return {
                        similarity: match.Similarity,
                        faceId: match.Face.FaceId,
                        confidence: match.Face.Confidence,
                        filePath: originalPhotoPath,
                        fileName: fileData.name,
                        eventId: fileData.eventId,
                        folderName: fileData.folderName,
                        uploadedAt: fileData.uploadedAt
                    };
                }

                console.log(`No file found for face ${match.Face.FaceId}`);
                return null;
            } catch (error) {
                console.error('Error processing match:', error);
                return null;
            }
        }));

        // Filter out null results and sort by similarity
        const validMatches = matches
            .filter(match => match !== null)
            .sort((a, b) => b.similarity - a.similarity);

        console.log(`Processed ${validMatches.length} valid matches out of ${matches.length} total matches`);

        // Return results
        return res.status(200).json({
            status: 'completed',
            totalMatches: validMatches.length,
            matches: validMatches,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in selfie matching:', error);
        return res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Sequential face matching function
exports.matchFacesSequential = matchFacesSequential;

// Sequential face matching function without database updates
exports.matchFacesSequentialNoDB = onRequest({ secrets: requiredSecrets, timeoutSeconds: 300, memory: '1GiB' }, async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        const storageBucketName = process.env.STORAGE_BUCKET;
        const awsConfig = {
            accessKeyId: process.env.AWS_KEY,
            secretAccessKey: process.env.AWS_SECRET,
            region: process.env.AWS_REGION,
        };

        console.log("ENV loaded:", {
            storageBucket: storageBucketName,
            awsKey: awsConfig.accessKeyId ? "✅ present" : "❌ missing",
            awsSecret: awsConfig.secretAccessKey ? "✅ present" : "❌ missing",
            awsRegion: awsConfig.region || "❌ missing"
        });

        const rekognition = new AWS.Rekognition(awsConfig);

        try {
            const { selfie_url, folder_paths } = req.body;
            console.log("Received request:", { selfie_url, folder_paths });

            if (!selfie_url || !folder_paths || !Array.isArray(folder_paths)) {
                return res.status(400).json({ error: 'Missing required fields: selfie_url or folder_paths' });
            }

            const selfieBuffer = await downloadFileAsBuffer(selfie_url);
            let matchedImages = [];
            const similarityThreshold = 80;
            let totalFiles = 0;
            let scannedFiles = 0;

            // Count total files first
            for (const folder_path of folder_paths) {
                const [files] = await bucket.getFiles({ prefix: folder_path });
                const imageFiles = files.filter(file =>
                    !file.name.endsWith('/') &&
                    file.name.match(/\.(jpg|jpeg|png)$/i)
                );
                totalFiles += imageFiles.length;
                console.log(`Found ${imageFiles.length} images in folder ${folder_path}`);
            }

            // Process files sequentially
            for (const folder_path of folder_paths) {
                const [files] = await bucket.getFiles({ prefix: folder_path });
                const imageFiles = files.filter(file =>
                    !file.name.endsWith('/') &&
                    file.name.match(/\.(jpg|jpeg|png)$/i)
                );

                for (const file of imageFiles) {
                    try {
                        console.log(`Processing file: ${file.name}`);
                        const targetBuffer = await downloadStorageFileAsBuffer(file.name);
                        if (!targetBuffer) {
                            console.log(`Skipping file ${file.name} - could not download`);
                            continue;
                        }

                        console.log(`Buffer sizes - Selfie: ${selfieBuffer.length}, Target: ${targetBuffer.length}`);

                        // Validate buffer sizes
                        if (selfieBuffer.length > 5 * 1024 * 1024 || targetBuffer.length > 5 * 1024 * 1024) {
                            console.log(`Warning: Large buffer detected - Selfie: ${(selfieBuffer.length / 1024 / 1024).toFixed(2)}MB, Target: ${(targetBuffer.length / 1024 / 1024).toFixed(2)}MB`);
                        }

                        console.log(`Comparing faces for file: ${file.name}`);
                        let retryCount = 0;
                        const maxRetries = 3;

                        while (retryCount < maxRetries) {
                            try {
                                console.log(`Attempt ${retryCount + 1} for file: ${file.name}`);
                                console.log(`Preparing AWS Rekognition request for ${file.name}`);

                                // Add a small delay between retries
                                if (retryCount > 0) {
                                    console.log(`Waiting 2 seconds before retry ${retryCount + 1}`);
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                }

                                console.log(`Sending request to AWS Rekognition for ${file.name}`);
                                const result = await rekognition.compareFaces({
                                    SourceImage: { Bytes: selfieBuffer },
                                    TargetImage: { Bytes: targetBuffer },
                                    SimilarityThreshold: similarityThreshold,
                                }).promise();
                                console.log(`Received response from AWS Rekognition for ${file.name}`);

                                console.log(`Rekognition result for ${file.name}:`, {
                                    hasMatches: result.FaceMatches?.length > 0,
                                    matchCount: result.FaceMatches?.length || 0,
                                    sourceFaceConfidence: result.SourceImageFace?.Confidence,
                                    unmatchedFaces: result.UnmatchedFaces?.length || 0,
                                    attempt: retryCount + 1,
                                    responseTime: new Date().toISOString()
                                });

                                if (result.FaceMatches?.length > 0) {
                                    const match = result.FaceMatches[0];
                                    const matchData = {
                                        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${storageBucketName}/o/${encodeURIComponent(file.name)}?alt=media`,
                                        similarity: match.Similarity,
                                        confidence: match.Face?.Confidence
                                    };
                                    matchedImages.push(matchData);
                                    console.log(`Match found in ${file.name}:`, matchData);
                                }

                                // If we get here, the call was successful
                                break;

                            } catch (rekognitionError) {
                                console.error(`Rekognition error for ${file.name} (Attempt ${retryCount + 1}):`, {
                                    error: rekognitionError.message,
                                    code: rekognitionError.code,
                                    requestId: rekognitionError.requestId,
                                    statusCode: rekognitionError.statusCode,
                                    time: rekognitionError.time
                                });

                                // Log the error to Firestore
                                try {
                                    await eventRef.update({
                                        'progress.errors': admin.firestore.FieldValue.arrayUnion({
                                            file: file.name,
                                            error: `Rekognition Error (Attempt ${retryCount + 1}): ${rekognitionError.message}`,
                                            code: rekognitionError.code,
                                            timestamp: admin.firestore.FieldValue.serverTimestamp()
                                        })
                                    });
                                } catch (updateError) {
                                    console.error('Error updating error log:', updateError);
                                }

                                retryCount++;

                                // If we've exhausted all retries, skip this file
                                if (retryCount === maxRetries) {
                                    console.log(`Max retries reached for ${file.name}, skipping...`);
                                    break;
                                }

                                // If it's a timeout or throttling error, wait longer
                                if (rekognitionError.code === 'ThrottlingException' ||
                                    rekognitionError.code === 'RequestTimeout' ||
                                    rekognitionError.message.includes('timeout')) {
                                    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
                                }
                            }
                        }

                        scannedFiles++;
                        const progress = (scannedFiles / totalFiles) * 100;
                        console.log(`Progress: ${progress.toFixed(2)}% (${scannedFiles}/${totalFiles})`);

                    } catch (error) {
                        console.error(`Error processing ${file.name}:`, error);
                        continue;
                    }
                }
            }

            // Return final results
            return res.status(200).json({
                status: 'completed',
                totalFiles: totalFiles,
                scannedFiles: scannedFiles,
                matchesFound: matchedImages.length,
                matches: matchedImages,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Critical error:', error);
            return res.status(500).json({
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
});

// Batch process images with face indexing
exports.batchProcessImages = onRequest({
    secrets: requiredSecrets,
    timeoutSeconds: 540, // Increased to 9 minutes
    memory: '1GiB',
    cors: true // Enable CORS for all origins
}, async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        // Set CORS headers explicitly
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');

        const storageBucketName = process.env.STORAGE_BUCKET;
        const awsConfig = {
            accessKeyId: process.env.AWS_KEY,
            secretAccessKey: process.env.AWS_SECRET,
            region: process.env.AWS_REGION,
        };

        const rekognition = new AWS.Rekognition(awsConfig);
        const db = admin.firestore();

        try {
            const { folder_path, eventId, folderName, collectionId, processOptions } = req.body;
            console.log("Received batch processing request:", { folder_path, eventId, folderName, collectionId, processOptions });

            if (!folder_path || !eventId || !folderName || !collectionId) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Ensure collection exists
            await ensureCollection(rekognition, collectionId);

            // Get all image files from the folder
            const [files] = await bucket.getFiles({ prefix: folder_path });

            // Filter files based on processOptions
            const imageFiles = files.filter(file => {
                // Skip directories
                if (file.name.endsWith('/')) return false;

                // Check file extension
                if (!file.name.match(/\.(jpg|jpeg|png)$/i)) return false;

                // Check includePaths
                if (processOptions.includePaths && processOptions.includePaths.length > 0) {
                    const shouldInclude = processOptions.includePaths.some(path => file.name.includes(path));
                    if (!shouldInclude) return false;
                }

                // Check excludePaths
                if (processOptions.excludePaths && processOptions.excludePaths.length > 0) {
                    const shouldExclude = processOptions.excludePaths.some(path => file.name.includes(path));
                    if (shouldExclude) return false;
                }

                return true;
            });

            console.log(`Found ${imageFiles.length} images to process after filtering`);
            console.log('Files to process:', imageFiles.map(f => f.name));

            // Process files in smaller batches to avoid timeouts
            const batchSize = 5; // Reduced batch size
            const results = [];
            const errors = [];

            for (let i = 0; i < imageFiles.length; i += batchSize) {
                const batch = imageFiles.slice(i, i + batchSize);
                console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(imageFiles.length / batchSize)}`);

                const batchPromises = batch.map(async (file) => {
                    try {
                        const fileBuffer = await downloadStorageFileAsBuffer(file.name);
                        if (!fileBuffer) {
                            throw new Error('Failed to download file');
                        }

                        // Get the original photo path from the thumbnail path
                        const originalPhotoPath = file.name.replace('/thumbnails/', '/photos/');
                        console.log(`Processing file: ${file.name}`);
                        console.log(`Original photo path: ${originalPhotoPath}`);

                        // Use existing indexFaces function
                        const faceResults = await indexFaces(rekognition, collectionId, fileBuffer, originalPhotoPath);

                        // Prepare result object
                        const result = {
                            filePath: originalPhotoPath,
                            faceIndexed: faceResults !== null,
                            faceDetails: faceResults,
                            processedAt: new Date().toISOString()
                        };

                        // Update Firestore using subcollections
                        const filesRef = db.collection('files');
                        const q = filesRef.where('path', '==', originalPhotoPath);
                        const querySnapshot = await q.get();

                        if (!querySnapshot.empty) {
                            const docRef = querySnapshot.docs[0].ref;

                            // Update the main document to indicate it has been processed
                            await docRef.update({
                                lastProcessed: new Date().toISOString(),
                                hasFaceIndexing: true,
                                faceDetectionStatus: faceResults !== null ? 'face_detected' : 'no_face_detected',
                                faceCount: faceResults ? faceResults.faces.length : 0,
                                faceIds: faceResults ? faceResults.faces.map(face => face.faceId) : [],
                                faceIndexing: faceResults ? faceResults.faces.map(face => face.faceId) : []
                            });

                            // Create a subcollection for face indexing results
                            const faceIndexingRef = docRef.collection('faceIndexing');

                            // Add the result to the subcollection
                            await faceIndexingRef.add({
                                collectionId: collectionId,
                                faceIndexed: faceResults !== null,
                                faceDetails: faceResults,
                                processedAt: new Date().toISOString(),
                                faceCount: faceResults ? faceResults.faces.length : 0,
                                faceIds: faceResults ? faceResults.faces.map(face => face.faceId) : []
                            });

                            console.log(`Updated Firestore for ${originalPhotoPath} with face detection results:`, {
                                faceIndexed: faceResults !== null,
                                hasFaceIndexing: true,
                                faceDetectionStatus: faceResults !== null ? 'face_detected' : 'no_face_detected',
                                faceCount: faceResults ? faceResults.faces.length : 0
                            });
                        } else {
                            console.log(`No Firestore document found for ${originalPhotoPath}`);
                        }

                        return { success: true, file: originalPhotoPath, result };
                    } catch (error) {
                        console.error(`Error processing ${file.name}:`, error);
                        return {
                            success: false,
                            file: file.name,
                            error: error.message
                        };
                    }
                });

                const batchResults = await Promise.all(batchPromises);

                // Separate successful and failed results
                batchResults.forEach(result => {
                    if (result.success) {
                        results.push(result);
                    } else {
                        errors.push(result);
                    }
                });

                // Add a longer delay between batches to avoid throttling
                if (i + batchSize < imageFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
                }
            }

            // Return final results
            return res.status(200).json({
                status: 'completed',
                totalFiles: imageFiles.length,
                processedFiles: results.length,
                failedFiles: errors.length,
                results: results,
                errors: errors,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Critical error in batch processing:', error);
            return res.status(500).json({
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
});

// Add new function for thumbnail recreation
exports.recreateThumbnails = onRequest({
    secrets: requiredSecrets,
    timeoutSeconds: 540,
    memory: '1GiB',
    cors: true
}, async (req, res) => {
    console.log('=== RECREATE THUMBNAILS FUNCTION STARTED ===');
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);

    cors(req, res, async () => {
        console.log('CORS middleware executed');

        if (req.method !== 'POST') {
            console.log('Invalid method:', req.method);
            return res.status(405).send('Method Not Allowed');
        }

        // Set CORS headers explicitly
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');

        const storageBucketName = process.env.STORAGE_BUCKET;
        const bucket = admin.storage().bucket(storageBucketName);

        try {
            const { folder_path, eventId, folderName, quality = 85, maxSize = 5 * 1024 * 1024, dimensions } = req.body;
            console.log('Received thumbnail recreation request:', { folder_path, eventId, folderName, quality, maxSize, dimensions });

            if (!folder_path || !eventId || !folderName) {
                console.log('Missing required fields:', { folder_path, eventId, folderName });
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Get all original photos from the folder
            const [files] = await bucket.getFiles({ prefix: `${folder_path}/photos/` });
            const imageFiles = files.filter(file =>
                !file.name.endsWith('/') &&
                file.name.match(/\.(jpg|jpeg|png)$/i)
            );

            console.log(`Found ${imageFiles.length} images to process`);

            const results = [];
            const errors = [];

            // Process files in batches
            const batchSize = 5;
            for (let i = 0; i < imageFiles.length; i += batchSize) {
                const batch = imageFiles.slice(i, i + batchSize);
                console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(imageFiles.length / batchSize)}`);

                const batchPromises = batch.map(async (file) => {
                    try {
                        // Download original image
                        const [originalBuffer] = await file.download();

                        // Process image with sharp
                        let processedImage = sharp(originalBuffer)
                            .resize(dimensions.width, dimensions.height, {
                                fit: 'inside',
                                withoutEnlargement: true
                            });

                        // Convert to JPEG with specified quality
                        processedImage = processedImage.jpeg({ quality });

                        // Get the processed buffer
                        let processedBuffer = await processedImage.toBuffer();

                        // If still too large, reduce quality until it fits
                        let currentQuality = quality;
                        while (processedBuffer.length > maxSize && currentQuality > 60) {
                            currentQuality -= 5;
                            processedBuffer = await sharp(processedBuffer)
                                .jpeg({ quality: currentQuality })
                                .toBuffer();
                        }

                        // Generate thumbnail path
                        const thumbnailPath = file.name
                            .replace('/photos/', '/thumbnails/')
                            .replace(/\.[^/.]+$/, '.JPG');

                        // Upload thumbnail
                        const thumbnailFile = bucket.file(thumbnailPath);
                        await thumbnailFile.save(processedBuffer, {
                            metadata: {
                                contentType: 'image/jpeg',
                                metadata: {
                                    originalFile: file.name,
                                    processedAt: new Date().toISOString(),
                                    quality: currentQuality,
                                    size: processedBuffer.length
                                }
                            }
                        });

                        console.log(`Created thumbnail for ${file.name} with quality ${currentQuality}`);
                        return {
                            success: true,
                            originalFile: file.name,
                            thumbnailFile: thumbnailPath,
                            quality: currentQuality,
                            size: processedBuffer.length
                        };
                    } catch (error) {
                        console.error(`Error processing ${file.name}:`, error);
                        return {
                            success: false,
                            file: file.name,
                            error: error.message
                        };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                batchResults.forEach(result => {
                    if (result.success) {
                        results.push(result);
                    } else {
                        errors.push(result);
                    }
                });

                // Add delay between batches
                if (i + batchSize < imageFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            return res.status(200).json({
                status: 'completed',
                totalFiles: imageFiles.length,
                processedFiles: results.length,
                failedFiles: errors.length,
                results: results,
                errors: errors,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error in thumbnail recreation:', error);
            return res.status(500).json({
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
});

// Add new function to reprocess images for an event
exports.reprocessEventImages = onRequest({
    secrets: requiredSecrets,
    timeoutSeconds: 540,
    memory: '1GiB',
    cors: true
}, async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        const storageBucketName = process.env.STORAGE_BUCKET;
        const awsConfig = {
            accessKeyId: process.env.AWS_KEY,
            secretAccessKey: process.env.AWS_SECRET,
            region: process.env.AWS_REGION,
        };

        const rekognition = new AWS.Rekognition(awsConfig);
        const db = admin.firestore();
        const bucket = admin.storage().bucket(storageBucketName);

        try {
            const { eventId, collectionId } = req.body;
            console.log("Received reprocess request:", { eventId, collectionId });

            if (!eventId || !collectionId) {
                return res.status(400).json({
                    status: 'error',
                    error: 'Missing required fields: eventId or collectionId'
                });
            }

            // Get all files for the event
            const filesRef = db.collection('files');
            const q = filesRef.where('eventId', '==', eventId);
            const querySnapshot = await q.get();

            console.log(`Found ${querySnapshot.size} files to reprocess`);

            const results = [];
            const errors = [];

            // Process files in batches
            const batchSize = 5;
            const files = querySnapshot.docs;

            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(files.length / batchSize)}`);

                const batchPromises = batch.map(async (doc) => {
                    try {
                        const fileData = doc.data();
                        const filePath = fileData.path;

                        // Convert photo path to thumbnail path
                        const thumbnailPath = filePath.replace('/photos/', '/thumbnails/');
                        console.log(`Processing thumbnail: ${thumbnailPath}`);

                        // Download thumbnail from storage
                        const [exists] = await bucket.file(thumbnailPath).exists();
                        if (!exists) {
                            console.log(`Thumbnail not found: ${thumbnailPath}`);
                            return {
                                success: false,
                                file: thumbnailPath,
                                error: 'Thumbnail not found'
                            };
                        }

                        const fileBuffer = await downloadStorageFileAsBuffer(thumbnailPath);
                        if (!fileBuffer) {
                            throw new Error('Failed to download thumbnail');
                        }

                        console.log(`Downloaded thumbnail, size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`);

                        // Index faces
                        const faceResults = await indexFaces(rekognition, collectionId, fileBuffer, thumbnailPath);
                        console.log(`Face detection results for ${thumbnailPath}:`, {
                            hasFaces: faceResults !== null,
                            faceCount: faceResults ? faceResults.faces.length : 0,
                            faceIds: faceResults ? faceResults.faces.map(f => f.faceId) : []
                        });

                        // Update document with face IDs
                        await doc.ref.update({
                            lastProcessed: new Date().toISOString(),
                            hasFaceIndexing: true,
                            faceDetectionStatus: faceResults !== null ? 'face_detected' : 'no_face_detected',
                            faceCount: faceResults ? faceResults.faces.length : 0,
                            faceIds: faceResults ? faceResults.faces.map(face => face.faceId) : [],
                            faceIndexing: faceResults ? faceResults.faces.map(face => face.faceId) : []
                        });

                        return {
                            success: true,
                            file: thumbnailPath,
                            faceCount: faceResults ? faceResults.faces.length : 0,
                            faceIds: faceResults ? faceResults.faces.map(f => f.faceId) : []
                        };
                    } catch (error) {
                        console.error(`Error processing ${doc.id}:`, error);
                        return {
                            success: false,
                            file: doc.id,
                            error: error.message
                        };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                batchResults.forEach(result => {
                    if (result.success) {
                        results.push(result);
                    } else {
                        errors.push(result);
                    }
                });

                // Add delay between batches
                if (i + batchSize < files.length) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            return res.status(200).json({
                status: 'completed',
                totalFiles: files.length,
                processedFiles: results.length,
                failedFiles: errors.length,
                results: results,
                errors: errors,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error in reprocessing:', error);
            return res.status(500).json({
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
});
