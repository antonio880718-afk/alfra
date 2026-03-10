import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
    apiKey: "AIzaSyBbWdhkDBvClLLgv7O3aOHjcMze0E_H2oA",
    authDomain: "clinica-alfra.firebaseapp.com",
    projectId: "clinica-alfra",
    storageBucket: "clinica-alfra.firebasestorage.app",
    messagingSenderId: "572433894677",
    appId: "1:572433894677:web:b366f7b13bbf6a30a16d1c",
    measurementId: "G-T2K7X2TNJD"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
