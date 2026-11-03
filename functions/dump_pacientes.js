const admin = require('firebase-admin');
const fs = require('fs');

if (!admin.apps.length) admin.initializeApp({ projectId: 'clinica-alfra' });
const db = admin.firestore();

async function run() {
    try {
        const snap = await db.collection('pacientes').get();
        const data = [];
        snap.forEach(doc => {
            data.push({ id: doc.id, ...doc.data() });
        });
        fs.writeFileSync('pacientes_test.json', JSON.stringify(data, null, 2));
        console.log('DONE');
    } catch (e) {
        fs.writeFileSync('error_test.txt', e.toString());
        process.exit(1);
    }
}
run();
