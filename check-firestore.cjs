
const admin = require('firebase-admin');

// Initialize with the service account or default credentials
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'clinica-alfra'
    });
}

const db = admin.firestore();

async function checkAlerts() {
    console.log('--- BUSCANDO ÚLTIMAS ALERTAS ---');
    try {
        const snap = await db.collection('alertas_pacientes')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        if (snap.empty) {
            console.log('No se encontraron alertas.');
            return;
        }

        snap.forEach(doc => {
            const data = doc.data();
            console.log(`ID: ${doc.id}`);
            console.log(`  Estado: ${data.estado}`);
            console.log(`  Especialista: ${data.especialistaId}`);
            console.log(`  Mensaje: ${data.mensaje}`);
            console.log(`  Creado: ${data.createdAt ? data.createdAt.toDate().toISOString() : 'N/A'}`);
            if (data.errorDetalle) console.log(`  Error: ${data.errorDetalle}`);
            console.log('---------------------------');
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkAlerts();
