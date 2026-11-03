
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ projectId: 'clinica-alfra' });
const db = admin.firestore();

async function run() {
    const snap = await db.collection('alertas_pacientes').orderBy('createdAt', 'desc').limit(5).get();
    const results = [];
    snap.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
    console.log('--- LATEST ALERTS ---');
    results.forEach(r => {
        console.log(`Alert: ${r.id}`);
        console.log(`  Estado: ${r.estado}`);
        console.log(`  EspId: ${r.especialistaId}`);
        console.log(`  MSG: ${r.mensaje}`);
        console.log(`  Created: ${r.createdAt ? r.createdAt.toDate().toISOString() : 'N/A'}`);
        console.log('---');
    });
}
run();
