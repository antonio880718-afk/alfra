
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'clinica-alfra'
    });
}

const db = admin.firestore();

async function debugFirestore() {
    console.log('--- DEBUGGING FIRESTORE ---');
    try {
        // 1. Check a few users
        console.log('\nUsers Check:');
        const userSnap = await db.collection('usuarios').limit(5).get();
        if (userSnap.empty) {
            console.log('No documents found in /usuarios');
        } else {
            userSnap.forEach(doc => {
                console.log(`UID: ${doc.id}, Role: ${doc.data().role}, Email: ${doc.data().email}`);
            });
        }

        // 2. Check patients
        console.log('\nPatients Check:');
        const pacSnap = await db.collection('pacientes').limit(5).get();
        if (pacSnap.empty) {
            console.log('No documents found in /pacientes');
        } else {
            pacSnap.forEach(doc => {
                console.log(`ID: ${doc.id}, Name: ${doc.data().nombre}, Specialist: ${doc.data().especialistaAsignado}`);
            });
        }

    } catch (e) {
        console.error('Error debugging Firestore:', e.message);
    }
}

debugFirestore();
