const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyBbWdhkDBvClLLgv7O3aOHjcMze0E_H2oA",
    authDomain: "clinica-alfra.firebaseapp.com",
    projectId: "clinica-alfra",
    storageBucket: "clinica-alfra.firebasestorage.app",
    messagingSenderId: "572433894677",
    appId: "1:572433894677:web:b366f7b13bbf6a30a16d1c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const HOY = new Date().toISOString().split('T')[0]; // 2026-04-29

async function main() {
    const snap = await getDocs(query(collection(db, 'citas'), orderBy('fechaHora', 'asc')));
    const todasCitas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const citasHoy = todasCitas.filter(c => {
        const f = c.fechaHora || c.fecha || '';
        return f.startsWith(HOY);
    });

    console.log(`\n📅 Fecha consultada: ${HOY}`);
    console.log(`📋 Total citas hoy: ${citasHoy.length}\n`);

    if (citasHoy.length === 0) {
        console.log('❌ No hay citas registradas para hoy.');
        return;
    }

    citasHoy.forEach((c, i) => {
        console.log(`--- Cita #${i + 1} ---`);
        console.log(`  ID:          ${c.id}`);
        console.log(`  Paciente:    ${c.pacienteNombre || c.paciente || '—'}`);
        console.log(`  Servicio:    ${c.servicio || '—'}`);
        console.log(`  Hora:        ${c.fechaHora || c.fecha || '—'}`);
        console.log(`  Status:      ${c.status}`);
        console.log(`  precio:      ${c.precio ?? '(sin campo)'}`);
        console.log(`  monto:       ${c.monto ?? '(sin campo)'}`);
        console.log(`  costo:       ${c.costo ?? '(sin campo)'}`);
        console.log(`  precioServicio: ${c.precioServicio ?? '(sin campo)'}`);
        console.log('');
    });

    // Resumen de si tienen precio
    const conPrecio = citasHoy.filter(c => 
        Number(c.precio || c.monto || c.costo || c.precioServicio || 0) > 0
    );
    console.log(`\n💰 Citas CON precio registrado: ${conPrecio.length} / ${citasHoy.length}`);
    console.log(`⚠️  Citas SIN precio: ${citasHoy.length - conPrecio.length} / ${citasHoy.length}`);
    console.log('\n→ Si "Citas SIN precio" > 0, el KPI "Ingreso Estimado Hoy" usará el corte real de movimientos de Firestore en lugar de precios de citas.');
}

main().catch(console.error).finally(() => process.exit(0));
