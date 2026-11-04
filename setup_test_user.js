
import { db } from './src/lib/firebase.js';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

async function setupTestUser() {
    const email = 'finalv29@test.com';
    const q = query(collection(db, 'pacientes'), where('email', '==', email));
    const snap = await getDocs(q);

    if (snap.empty) {
        console.log('Patient not found');
        return;
    }

    const d = snap.docs[0];
    await updateDoc(doc(db, 'pacientes', d.id), {
        tipoTratamiento: 'Mixto'
    });

    console.log('Patient set to Mixto');
}

setupTestUser().catch(console.error);
