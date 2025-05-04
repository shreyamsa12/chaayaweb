const admin = require('firebase-admin');
const axios = require('axios');
const AWS = require('aws-sdk');
const { onCall } = require('firebase-functions/v2/https');

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
        const bucket = admin.storage().bucket();
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

const requiredSecrets = ["AWS_KEY", "AWS_SECRET", "AWS_REGION", "STORAGE_BUCKET"];

const matchFacesWithCollection = onCall({
    secrets: requiredSecrets,
    timeoutSeconds: 540,  // 9 minutes
    memory: '2GiB'
}, async (request) => {
    // ... (function logic from your current implementation)
    // Copy the logic from your current matchFacesWithCollection implementation here
});

module.exports = { matchFacesWithCollection }; 