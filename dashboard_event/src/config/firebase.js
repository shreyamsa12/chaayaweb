import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
    // Replace with your Firebase config
    apiKey: "AIzaSyAcOv9f-14NF_b15KExdQC1h8LUZa0tSpo",
    authDomain: "chaaya.ai",
    projectId: "photoshoto-a7226",
    storageBucket: "photoshoto-a7226.appspot.com",
    messagingSenderId: "662675060225",
    appId: "1:662675060225:web:71903d0e60c17cebc9f200"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'us-central1');

// Export services
export { auth, db, storage, functions }; 