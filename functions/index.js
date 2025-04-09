// ✅ Cloud Functions v2 - Firebase + AWS Rekognition Face Match

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const axios = require('axios');
const AWS = require('aws-sdk');
const cors = require('cors')({ origin: true });

// 🔐 Required secrets must be linked in function definition
const requiredSecrets = ["AWS_KEY", "AWS_SECRET", "AWS_REGION", "STORAGE_BUCKET"];

// ✅ Initialize Firebase Admin SDK
admin.initializeApp();

// --- Main Cloud Function ---
exports.matchFaces = onRequest({ secrets: requiredSecrets, timeoutSeconds: 300, memory: "1GiB" }, async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        const storageBucketName = process.env.STORAGE_BUCKET;
        const bucket = admin.storage().bucket(storageBucketName);

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

        const { selfie_url, folder_paths } = req.body;
        if (!selfie_url || !folder_paths || !Array.isArray(folder_paths)) {
            return res.status(400).json({ error: 'Missing selfie_url or folder_paths array' });
        }

        try {
            const downloadFileAsBuffer = async (url) => {
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                return Buffer.from(response.data, 'binary');
            };

            const downloadStorageFileAsBuffer = async (filePath) => {
                const file = bucket.file(filePath);
                const [exists] = await file.exists();
                if (!exists) return null;
                const [buffer] = await file.download();
                return buffer;
            };

            const selfieBuffer = await downloadFileAsBuffer(selfie_url);
            let matchedImages = [];
            const similarityThreshold = 90;
            const batchSize = 5;

            for (const folder_path of folder_paths) {
                console.log(`Processing folder: ${folder_path}`);
                const [files] = await bucket.getFiles({ prefix: folder_path });

                // Early filtering
                const imageFiles = files.filter(file =>
                    !file.name.endsWith('/') &&
                    file.name.match(/\.(jpg|jpeg|png)$/i)
                );

                console.log(`Found ${imageFiles.length} image files in folder ${folder_path}`);

                // Process in batches
                for (let i = 0; i < imageFiles.length; i += batchSize) {
                    const batch = imageFiles.slice(i, i + batchSize);
                    console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(imageFiles.length / batchSize)}`);

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
                                return {
                                    image: file.name,
                                    similarity: result.FaceMatches[0].Similarity,
                                    folder: folder_path
                                };
                            }
                        } catch (error) {
                            console.error(`Error processing ${file.name}:`, error);
                        }
                        return null;
                    }));

                    // Filter out null results and add to matchedImages
                    matchedImages = matchedImages.concat(batchResults.filter(result => result !== null));
                }
            }

            console.log("Face matching complete. Results:", { matched_images: matchedImages, count: matchedImages.length });
            return res.status(200).json({ matched_images: matchedImages, count: matchedImages.length });
        } catch (error) {
            console.error('Critical Face matching error:', error);
            return res.status(500).json({ error: `Internal Server Error: ${error.message}` });
        }
    });
});
