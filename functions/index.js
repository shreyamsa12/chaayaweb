const functions = require('firebase-functions');
const admin = require('firebase-admin');
const twilio = require('twilio');

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Twilio client
const twilioClient = twilio(
    functions.config().twilio.accountsid,
    functions.config().twilio.authtoken
);

exports.sendConfirmationSMS = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    try {
        const { phone, eventId, name } = req.body;

        // Get event name from Firestore
        const eventDoc = await admin.firestore()
            .collection('events')
            .doc(eventId)
            .get();

        const eventName = eventDoc.exists ? eventDoc.data().name : 'the event';

        // Compose message
        const message = `Thank you for registering to ${eventName}! Please proceed to install the Chaaya.ai app from the App Store or visit chaaya.ai`;

        // Send SMS via Twilio
        await twilioClient.messages.create({
            body: message,
            to: phone,
            from: functions.config().twilio.phonenumber
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error sending SMS:', error);
        res.status(500).json({ error: error.message });
    }
}); 