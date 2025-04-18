// ✅ Cloud Functions v2 - Firebase + AWS Rekognition Face Match

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const axios = require('axios');
const AWS = require('aws-sdk');
const cors = require('cors')({ origin: true });
const functions = require('firebase-functions');

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

// 🔐 Required secrets must be linked in function definition
const requiredSecrets = ["AWS_KEY", "AWS_SECRET", "AWS_REGION", "STORAGE_BUCKET"];

// --- Main Cloud Function ---
exports.matchFaces = onRequest({ secrets: requiredSecrets, timeoutSeconds: 300, memory: '1GiB' }, async (req, res) => {
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
            const { selfie_url, folder_paths, eventsregistryId } = req.body;
            console.log("Received request:", { selfie_url, folder_paths, eventsregistryId });

            if (!selfie_url || !folder_paths || !Array.isArray(folder_paths) || !eventsregistryId) {
                return res.status(400).json({ error: 'Missing required fields: selfie_url, folder_paths, or eventsregistryId' });
            }

            const eventRef = admin.firestore().collection('eventsregistry').doc(eventsregistryId);
            await eventRef.set({
                aimatch: [],
                progress: {
                    totalFiles: 0,
                    scannedFiles: 0,
                    status: 'processing'
                }
            }, { merge: true });

            res.status(200).json({
                message: "Face matching process started",
                eventsregistryId: eventsregistryId,
                status: "processing"
            });

            (async () => {
                try {
                    const selfieBuffer = await downloadFileAsBuffer(selfie_url);
                    let matchedImages = [];
                    const similarityThreshold = 80;
                    const batchSize = 3;
                    let totalFiles = 0;
                    let scannedFiles = 0;

                    for (const folder_path of folder_paths) {
                        const [files] = await bucket.getFiles({ prefix: folder_path });
                        const imageFiles = files.filter(file =>
                            !file.name.endsWith('/') &&
                            file.name.match(/\.(jpg|jpeg|png)$/i)
                        );
                        totalFiles += imageFiles.length;
                        console.log(`Found ${imageFiles.length} images in folder ${folder_path}`);
                    }

                    await eventRef.update({
                        'progress.totalFiles': totalFiles
                    });// ... inside the image processing loop ...
let retries = 3;
let success = false;
while (retries > 0 && !success) {
        try {
            await delay(100); // Add a 100ms delay before calling compareFaces
            // ... your rekognition.compareFaces call ...
            success = true;
        } catch (error) {
            console.error(`Error processing ${file.name} (retry ${3 - retries + 1}):`, error);
            if (retries > 0) {
                await delay(1000 * (4 - retries));  // Exponential backoff: 1s, 2s, 3s
            }
            retries--;
        }
    }
    if (!success) {
        // Handle the case where all retries failed
    }

// ... right before the final eventRef.update() ...
    console.log("About to update Firestore with matches:", matchedImages);
    if (matchedImages.length > 0) {
        await eventRef.update({
            'aimatch': matchedImages
        });
    }

                    for (const folder_path of folder_paths) {
                        const [files] = await bucket.getFiles({ prefix: folder_path });

                        const imageFiles = files.filter(file =>
                            !file.name.endsWith('/') &&
                            file.name.match(/\.(jpg|jpeg|png)$/i)
                        );

                        for (let i = 0; i < imageFiles.length; i += batchSize) {
                            const batch = imageFiles.slice(i, i + batchSize);

                            const batchResults = await Promise.all(batch.map(async (file) => {
                                try {
                                    const targetBuffer = await downloadStorageFileAsBuffer(file.name);
                                    if (!targetBuffer) return null;

                                    const result = await rekognition.compareFaces({
                                        SourceImage: { Bytes: selfieBuffer },
                                        TargetImage: { Bytes: targetBuffer },
                                        SimilarityThreshold: similarityThreshold,
                                    }).promise();

                                    if (result.FaceMatches?.length > 0) {
                                        const match = result.FaceMatches[0];
                                        return {
                                            imageUrl: `https://storage.googleapis.com/${storageBucketName}/${file.name}`,
                                            similarity: match.Similarity,
                                            confidence: match.Face?.Confidence
                                        };
                                    }
                                } catch (error) {
                                    console.error(`Error processing ${file.name}:`, error);
                                }
                                return null;
                            }));

                            scannedFiles += batch.length;
                            const validMatches = batchResults.filter(result => result !== null);
                            matchedImages = matchedImages.concat(validMatches);

                            const progress = (scannedFiles / totalFiles) * 100;

                            await eventRef.update({
                                'progress.status': 'processing',
                                'progress.progress': progress,
                                'progress.scannedFiles': scannedFiles,
                                'progress.matchesFound': validMatches.length,
                                'progress.lastUpdated': admin.firestore.FieldValue.serverTimestamp()
                            });

                            if (validMatches.length > 0) {
                                await eventRef.update({
                                    'aimatch': admin.firestore.FieldValue.arrayUnion(...validMatches)
                                });
                            }
                        }
                    }

                    await eventRef.update({
                        'progress.status': 'completed',
                        'progress.scannedFiles': totalFiles
                    });

                    console.log("Face matching complete. Results:", {
                        matched_images: matchedImages,
                        count: matchedImages.length
                    });

                } catch (error) {
                    console.error('Error in async processing:', error);
                    await eventRef.update({
                        'progress.status': 'error',
                        'progress.error': error.message
                    });
                }
            })();

        } catch (error) {
            console.error('Critical error:', error);
            return res.status(500).json({ error: `Internal Server Error: ${error.message}` });
        }
    });
});

// Sequential face matching function
exports.matchFacesSequential = onRequest({ secrets: requiredSecrets, timeoutSeconds: 300, memory: '1GiB' }, async (req, res) => {
    console.log("Hello World");

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
            const { selfie_url, folder_paths, eventsregistryId } = req.body;
            console.log("Received request:", { selfie_url, folder_paths, eventsregistryId });

            if (!selfie_url || !folder_paths || !Array.isArray(folder_paths) || !eventsregistryId) {
                return res.status(400).json({ error: 'Missing required fields: selfie_url, folder_paths, or eventsregistryId' });
            }

            const eventRef = admin.firestore().collection('eventsregistry').doc(eventsregistryId);
            await eventRef.set({
                aimatch: [],
                progress: {
                    totalFiles: 0,
                    scannedFiles: 0,
                    status: 'processing'
                }
            }, { merge: true });

            res.status(200).json({
                message: "Sequential face matching process started",
                eventsregistryId: eventsregistryId,
                status: "processing"
            });

            (async () => {
                try {
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

                    await eventRef.update({
                        'progress.totalFiles': totalFiles
                    });

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

                                const result = await rekognition.compareFaces({
                                    SourceImage: { Bytes: selfieBuffer },
                                    TargetImage: { Bytes: targetBuffer },
                                    SimilarityThreshold: similarityThreshold,
                                }).promise();

                                if (result.FaceMatches?.length > 0) {
                                    const match = result.FaceMatches[0];
                                    const matchData = {
                                        imageUrl: `https://storage.googleapis.com/${storageBucketName}/${file.name}`,
                                        similarity: match.Similarity,
                                        confidence: match.Face?.Confidence
                                    };
                                    matchedImages.push(matchData);
                                    console.log(`Match found in ${file.name}:`, matchData);

                                }

                                scannedFiles++;
                                const progress = (scannedFiles / totalFiles) * 100;

                                console.log(`Progress: ${progress.toFixed(2)}% (${scannedFiles}/${totalFiles})`);

                            } catch (error) {
                                console.error(`Error processing ${file.name}:`, error);
                                console.error("Full Rekognition error:", JSON.stringify(error));
                                continue;
                            }
                        }
                    }
                    
                     const finalProgress = (scannedFiles / totalFiles) * 100;
                    await eventRef.update({
                        'progress.status': 'completed',
                        'progress.progress': finalProgress,
                        'progress.scannedFiles': scannedFiles,
                        'progress.matchesFound': matchedImages.length,
                        'progress.lastUpdated': admin.firestore.FieldValue.serverTimestamp(),
                        ...(matchedImages.length > 0 ? { 'aimatch': matchedImages } : {}),

                    });

                    

                    console.log("Face matching complete. Results:", {
                        matched_images: matchedImages,
                        count: matchedImages.length
                    });

                } catch (error) {
                    console.error('Error in async processing:', error);
                    await eventRef.update({
                        'progress.status': 'error',
                        'progress.error': error.message,
                        'progress.lastUpdated': admin.firestore.FieldValue.serverTimestamp()
                    });

            })();

        } catch (error) {
            console.error('Critical error:', error);
            return res.status(500).json({ error: `Internal Server Error: ${error.message}` });
        }
    });
});

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

                        const result = await rekognition.compareFaces({
                            SourceImage: { Bytes: selfieBuffer },
                            TargetImage: { Bytes: targetBuffer },
                            SimilarityThreshold: similarityThreshold,
                        }).promise();

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
