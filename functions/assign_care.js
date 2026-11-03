const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp({ projectId: 'clinica-alfra' });

const db = admin.firestore();

async function run() {
    try {
        console.log("Iniciando asignación de cuidados...");
        const snap = await db.collection('pacientes').where('nombre', '==', 'Antonio Rangel').get();
        if (snap.empty) {
            console.error('Error: No se encontró al paciente "Antonio Rangel"');
            process.exit(1);
        }

        const pId = snap.docs[0].id;
        console.log(`Paciente encontrado: ${snap.docs[0].data().nombre} (ID: ${pId})`);

        const cuidados = [
            { id: 'f1', label: 'Aplicar protector solar FPS 50+ cada 4 horas', categoria: 'Facial', frecuencia: 'Cada 4 horas', activo: true },
            { id: 'c1', label: 'Tomar mínimo 2 litros de agua al día', categoria: 'Corporal', frecuencia: 'Diario', activo: true },
            { id: 'custom_1', label: 'RECUERDA TU CITA DE MAÑANA', categoria: 'Personalizado', frecuencia: 'Recordatorio', activo: true }
        ];

        await db.collection('apoyoEnCasa').doc(pId).set({
            pacienteId: pId,
            cuidados,
            updatedAt: new Date().toISOString(),
            updatedBy: 'especialista'
        }, { merge: true });

        console.log('✅ ÉXITO: Cuidados asignados correctamente.');
    } catch (e) {
        console.error('❌ ERROR:', e);
        process.exit(1);
    }
}

run();
