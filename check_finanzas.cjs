const admin = require('./functions/node_modules/firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'clinica-alfra'
    });
}

const db = admin.firestore();

async function check() {
    const finSnap = await db.collection('finanzas').get();
    console.log('Total docs in finanzas:', finSnap.size);
    
    const byDate = {};
    finSnap.forEach(d => {
        const data = d.data();
        const f = String(data.fecha || data.createdAt || '').substring(0, 10);
        if (!byDate[f]) byDate[f] = { ingresos: 0, egresos: 0, count: 0 };
        byDate[f].count++;
        if (data.estado !== 'Cancelado') {
            const m = Number(data.monto) || 0;
            if (data.tipo === 'Ingreso') byDate[f].ingresos += m;
            if (data.tipo === 'Egreso') byDate[f].egresos += m;
        }
    });
    
    console.log('Movimientos por fecha en finanzas:');
    const sortedDates = Object.keys(byDate).sort().reverse();
    for (const k of sortedDates.slice(0, 10)) {
        console.log(`  ${k}: ${byDate[k].count} movs | Ingresos: $${byDate[k].ingresos.toFixed(2)} | Egresos: $${byDate[k].egresos.toFixed(2)}`);
    }

    // Also check recibos
    const recSnap = await db.collection('recibos').get();
    console.log('\nTotal docs in recibos:', recSnap.size);
    const byDateRec = {};
    recSnap.forEach(d => {
        const data = d.data();
        const f = String(data.fecha || data.createdAt || '').substring(0, 10);
        if (!byDateRec[f]) byDateRec[f] = { total: 0, count: 0 };
        byDateRec[f].count++;
        byDateRec[f].total += Number(data.monto) || 0;
    });
    for (const k of Object.keys(byDateRec).sort().reverse().slice(0, 10)) {
        console.log(`  Recibos ${k}: ${byDateRec[k].count} recibos | Total: $${byDateRec[k].total.toFixed(2)}`);
    }
}

check().catch(console.error);
