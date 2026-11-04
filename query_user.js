import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { firebaseConfig } from './src/lib/firebase.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const uid = 'jUGAL95pQrgFFaaaEJq0wyU7wqp1';
const userRef = doc(db, 'users', uid);

try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
        console.log('User data:', snap.data());
    } else {
        console.log('User document does not exist in Firestore for UID:', uid);
    }
} catch (err) {
    console.error('Error fetching user:', err);
}
process.exit(0);
