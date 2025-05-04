// ✅ Cloud Functions v2 - Firebase + AWS Rekognition Face Match

const { onRequest, onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const axios = require('axios');
const AWS = require('aws-sdk');
const cors = require('cors')({ origin: true });
const functions = require('firebase-functions');
const { httpsCallable } = require('firebase-functions/v2');
const { matchFacesWithCollection } = require('./matchFacesWithCollection');
const { matchFacesSequential } = require('./matchFacesSequential');

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

// Index faces in a collection
async function indexFaces(rekognition, collectionId, imageBuffer, externalImageId) {
    try {
        const result = await rekognition.indexFaces({
            CollectionId: collectionId,
            Image: { Bytes: imageBuffer },
            ExternalImageId: externalImageId,
            MaxFaces: 1,
            QualityFilter: 'AUTO',
            DetectionAttributes: ['ALL']
        }).promise();

        if (result.FaceRecords.length === 0) {
            console.log(`No face detected in image ${externalImageId}`);
            return null;
        }

        console.log(`Successfully indexed face for ${externalImageId}`);
        return result.FaceRecords[0].Face;
    } catch (error) {
        console.error(`Error indexing face for ${externalImageId}:`, error);
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
exports.matchFacesWithCollection = matchFacesWithCollection;

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
