import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    // Replace with your Firebase config
    apiKey: "AIzaSyAcOv9f-14NF_b15KExdQC1h8LUZa0tSpo",
    authDomain: "chaaya.ai",
    projectId: "photoshoto-a7226",
    storageBucket: "gs://photoshoto-a7226.appspot.com",
    messagingSenderId: "662675060225",
    appId: "1:662675060225:web:71903d0e60c17cebc9f200"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); 