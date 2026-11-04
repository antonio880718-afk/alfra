
import { db } from './src/firebase/firebaseConfig.js';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';

async function injectData() {
    const email = 'finalv29@test.com';
    const q = query(collection(db, 'pacientes'), where('email', '==', email));
    const snap = await getDocs(q);

    if (snap.empty) {
        console.log('Patient not found');
        return;
    }

    const patientId = snap.docs[0].id;
    console.log('Found patient:', patientId);

    const trackersRef = collection(db, 'pacientes', patientId, 'dailyTrackers');

    const today = new Date().toISOString().split('T')[0];

    // Inject food diary
    await addDoc(trackersRef, {
        type: 'alimentacion',
        date: today,
        timestamp: new Date().toISOString(),
        data: {
            totalCalorias: 1650,
            metaCalorias: 2000,
            detalles: ['Cena Saludable Inyectada']
        }
    });

    // Inject facial routine
    await addDoc(trackersRef, {
        type: 'facial',
        date: today,
        timestamp: new Date().toISOString(),
        data: {
            'Limpiador': true,
            'Tónico': true,
            'Serum': true,
            'Protector Solar': true,
            'Retoque Solar': false,
            'Crema Noche': true
        }
    });

    console.log('Data injected successfully for', today);
}

injectData().catch(console.error);
