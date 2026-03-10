import { collection, addDoc, updateDoc, doc, getDocs, getDoc, query, orderBy, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const FINANZAS_COL = collection(db, 'finanzas');
const AHORROS_COL = collection(db, 'ahorros');

// Registrar un movimiento financiero (Ingreso o Egreso)
export const registrarMovimiento = async (data) => {
    try {
        const docRef = await addDoc(FINANZAS_COL, {
            ...data, // { tipo: 'Ingreso'|'Egreso', monto, motivo, fecha, usuarioId }
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error registering movimiento:", error);
        throw error;
    }
};

// Obtener flujo de caja para Dashboard Admin (KPIs)
export const getFlujoCaja = async () => {
    try {
        const q = query(FINANZAS_COL, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const movimientos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const ingresos = movimientos.filter(m => m.tipo === 'Ingreso').reduce((acc, sum) => acc + Number(sum.monto), 0);
        const egresos = movimientos.filter(m => m.tipo === 'Egreso').reduce((acc, sum) => acc + Number(sum.monto), 0);

        return {
            ingresos,
            egresos,
            gananciaNeta: ingresos - egresos,
            historial: movimientos
        };
    } catch (error) {
        console.error("Error calculating cash flow:", error);
        return { ingresos: 0, egresos: 0, gananciaNeta: 0, historial: [] }; // No crashear
    }
}

// Lógica de Abonos de Cirugía (Ahorros) / Flujo de Pagos Automático
export const registrarAbonoAhorro = async (pacienteId, monto, motivo) => {
    try {
        // 1. Aquí buscaríamos el doc de "Ahorro" del paciente y actualizaríamos el "currentBalance" y array de "history"
        // ... Lógica abstracta ...

        // 2. Automación: Impactar inmediatamente en Finanzas
        await registrarMovimiento({
            tipo: 'Ingreso',
            monto: monto,
            motivo: `Abono Cirugía: ${motivo}`,
            fecha: new Date().toISOString(),
            pacienteAsociado: pacienteId
        });

        return true;
    } catch (error) {
        console.error("Error en flujo de pagos de ahorro:", error);
        throw error;
    }
}

// Escuchar movimientos financieros en tiempo real (para Contabilidad / Dashboard Admin)
export const onMovimientosChange = (callback) => {
    const q = query(FINANZAS_COL, orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const movimientos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(movimientos);
    }, (error) => {
        console.error('Error in movimientos listener:', error);
        callback([]); // fallback — no crashea la UI
    });
};

// Obtener movimientos de la semana actual (para gráfica del Dashboard)
export const getMovimientosSemana = async () => {
    try {
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const q = query(FINANZAS_COL, where('createdAt', '>=', startOfWeek.toISOString()), orderBy('createdAt', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error("Error getting semana movimientos:", error);
        return [];
    }
};

// Obtener corte de caja por fecha (suma de ingresos/egresos del día)
export const getCortesPorDia = async () => {
    try {
        const q = query(FINANZAS_COL, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const movimientos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Agrupar por día
        const cortesMap = {};
        movimientos.forEach(m => {
            const fecha = m.createdAt ? m.createdAt.substring(0, 10) : 'Sin fecha';
            if (!cortesMap[fecha]) {
                cortesMap[fecha] = { fecha, ingresosTotales: 0, efectivo: 0, tarjeta: 0, transferencia: 0, estado: 'Pendiente Revisión', movimientos: [] };
            }
            if (m.tipo === 'Ingreso') {
                cortesMap[fecha].ingresosTotales += Number(m.monto) || 0;
                const metodo = (m.metodoPago || '').toLowerCase();
                if (metodo.includes('efectivo')) cortesMap[fecha].efectivo += Number(m.monto) || 0;
                else if (metodo.includes('tarjeta')) cortesMap[fecha].tarjeta += Number(m.monto) || 0;
                else if (metodo.includes('transfer')) cortesMap[fecha].transferencia += Number(m.monto) || 0;
                else cortesMap[fecha].efectivo += Number(m.monto) || 0;
            }
            cortesMap[fecha].movimientos.push(m);
        });

        return Object.values(cortesMap).slice(0, 30); // últimos 30 días
    } catch (error) {
        console.error("Error getting cortes:", error);
        return [];
    }
};

