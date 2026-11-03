
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ projectId: 'clinica-alfra' });
const db = admin.firestore();

async function testTrigger() {
    console.log('--- CREANDO ALERTA DE PRUEBA ---');
    const docRef = await db.collection('alertas_pacientes').add({
        especialistaId: 'LubcxBQnEdSmLUK5ZA2OTFYRmPJ2', // Alejandra
        mensaje: 'Prueba de Activación de Trigger ' + new Date().toISOString(),
        estado: 'pendiente',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Alerta creada con ID:', docRef.id);
    console.log('Esperando 10 segundos para ver si el trigger responde...');

    await new Promise(resolve => setTimeout(resolve, 10000));

    const snap = await docRef.get();
    console.log('Estado final en DB:', snap.data().estado);
    if (snap.data().estado === 'completado') {
        console.log('SUCCESS: El trigger se activó y completó la tarea.');
    } else {
        console.log('FAILURE: El trigger sigue sin responder.');
    }
}

testTrigger();
