const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const AWS = require('aws-sdk');
const axios = require('axios');

const requiredSecrets = ["AWS_KEY", "AWS_SECRET", "AWS_REGION", "STORAGE_BUCKET"];

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

const matchFacesSequential = onCall({
    secrets: requiredSecrets,
    timeoutSeconds: 540,  // 9 minutes
    memory: '2GiB'  // Increased memory
}, async (request) => {
    // ... (function logic from your current implementation)
    // Copy the logic from your current matchFacesSequential implementation here
});

module.exports = { matchFacesSequential }; 