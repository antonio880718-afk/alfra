import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// ===================== ESPACIOS DE LA CLINICA =====================
export const ESPACIOS_CLINICA = [
    {
        id: 'cabina_facial', nombre: 'Cabina Facial',
        tareas: ['Barrer', 'Trapear', 'Sacudir', 'Lavar bano', 'Limpiar espejo', 'Retirar basura']
    },
    {
        id: 'cabina_corporal', nombre: 'Cabina Corporal',
        tareas: ['Barrer', 'Trapear', 'Sacudir', 'Lavar bano', 'Limpiar espejo', 'Limpiar sauna', 'Retirar basura']
    },
    {
        id: 'cabina_capilar', nombre: 'Cabina Capilar',
        tareas: ['Barrer', 'Trapear', 'Sacudir', 'Limpiar espejo', 'Retirar basura']
    },
    {
        id: 'sala_espera', nombre: 'Sala de Espera',
        tareas: ['Barrer', 'Trapear', 'Sacudir', 'Lavar bano', 'Limpiar espejo', 'Retirar basura']
    },
    {
        id: 'recepcion', nombre: 'Recepcion y Escritorio',
        tareas: ['Barrer', 'Trapear', 'Sacudir', 'Limpiar espejo', 'Retirar basura']
    },
];

// ===================== BITACORA DE LIMPIEZA =====================
const BITACORA_COL = 'bitacora_limpieza';

export const registrarTareaCompletada = async (data) => {
    // data = { espacioId, nombreEspacio, tareaNombre, usuarioNombre, usuarioUid, fecha }
    const q = query(
        collection(db, BITACORA_COL),
        where('espacioId', '==', data.espacioId),
        where('fecha', '==', data.fecha)
    );
    const snap = await getDocs(q);
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
    const timestampCheck = `${dateStr} ${timeStr}`;
    const horaShort = timeStr; // For document main hour field (just hh:mm)
    
    const espacioDef = ESPACIOS_CLINICA.find(e => e.id === data.espacioId);
    const totalTareas = espacioDef ? espacioDef.tareas.length : 0;

    if (snap.empty) {
        // Crear documento nuevo para hoy
        const newDocRef = doc(collection(db, BITACORA_COL));
        const currentDetalle = { [data.tareaNombre]: timestampCheck };
        const completado = Object.keys(currentDetalle).length === totalTareas;

        await setDoc(newDocRef, {
            espacioId: data.espacioId,
            nombreEspacio: data.nombreEspacio,
            fecha: data.fecha,
            limpiadoPor: data.usuarioNombre || 'Limpieza',
            limpiadoPorUid: data.usuarioUid || '',
            tareasDetalle: currentDetalle,
            hora: horaShort,
            completado,
            createdAt: serverTimestamp()
        });
        return { docId: newDocRef.id, hora: timestampCheck, completado };
    } else {
        // Actualizar documento existente
        const docRef = snap.docs[0].ref;
        const currentData = snap.docs[0].data();
        const currentDetalle = currentData.tareasDetalle || {};
        
        if (!currentDetalle[data.tareaNombre]) {
            currentDetalle[data.tareaNombre] = timestampCheck;
        }
        
        const completado = Object.keys(currentDetalle).length === totalTareas;
        
        const updateData = {
            tareasDetalle: currentDetalle,
            completado,
            updatedAt: serverTimestamp()
        };
        if (completado) {
            updateData.hora = horaShort;
        }
        
        await updateDoc(docRef, updateData);
        return { docId: docRef.id, hora: timestampCheck, completado };
    }
};

export const marcarEspacioLimpio = async (data) => {
    const docRef = await addDoc(collection(db, BITACORA_COL), {
        espacioId: data.espacioId,
        nombreEspacio: data.nombreEspacio,
        tareasCompletadas: data.tareasCompletadas || [],
        limpiadoPor: data.limpiadoPor || '',
        limpiadoPorUid: data.limpiadoPorUid || '',
        notas: data.notas || '',
        fecha: data.fecha || new Date().toISOString().split('T')[0],
        hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

export const getBitacoraDelDia = async (fecha) => {
    const q = query(collection(db, BITACORA_COL), where('fecha', '==', fecha));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const onBitacoraChange = (fecha, callback) => {
    const q = query(collection(db, BITACORA_COL), where('fecha', '==', fecha));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
};

// ===================== BITACORA DE MANTENIMIENTO =====================
const MANTENIMIENTO_COL = 'bitacora_mantenimiento';

export const crearReporteMantenimiento = async (data) => {
    const docRef = await addDoc(collection(db, MANTENIMIENTO_COL), {
        descripcion: data.descripcion || '',
        tipo: data.tipo || 'correctivo',
        ubicacion: data.ubicacion || '',
        reportadoPor: data.reportadoPor || '',
        reportadoPorUid: data.reportadoPorUid || '',
        estado: 'pendiente',
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

export const getReportesMantenimiento = async () => {
    const snap = await getDocs(collection(db, MANTENIMIENTO_COL));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const updateReporteEstado = async (id, estado) => {
    await updateDoc(doc(db, MANTENIMIENTO_COL, id), { estado });
};

// ===================== SOLICITUDES DE INSUMOS =====================
const SOLICITUDES_COL = 'solicitudes_insumos_limpieza';

export const crearSolicitudInsumos = async (data) => {
    const docRef = await addDoc(collection(db, SOLICITUDES_COL), {
        items: data.items || [],
        solicitadoPor: data.solicitadoPor || '',
        solicitadoPorUid: data.solicitadoPorUid || '',
        notas: data.notas || '',
        estado: 'pendiente',
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

export const getSolicitudesInsumos = async () => {
    const snap = await getDocs(collection(db, SOLICITUDES_COL));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const updateSolicitudEstado = async (id, estado, notasAdmin) => {
    await updateDoc(doc(db, SOLICITUDES_COL, id), { estado, notasAdmin: notasAdmin || '' });
};

export const onSolicitudesChange = (callback) => {
    return onSnapshot(collection(db, SOLICITUDES_COL), (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
};

// ===================== TAREAS ASIGNADAS =====================
const TAREAS_COL = 'tareas_limpieza';

export const crearTarea = async (data) => {
    const docRef = await addDoc(collection(db, TAREAS_COL), {
        titulo: data.titulo || '',
        descripcion: data.descripcion || '',
        asignadoPor: data.asignadoPor || '',
        asignadoA: data.asignadoA || '',
        fechaLimite: data.fechaLimite || '',
        estado: 'pendiente',
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

export const completarTarea = async (id) => {
    await updateDoc(doc(db, TAREAS_COL, id), {
        estado: 'completada',
        completadaEn: new Date().toISOString(),
    });
};

export const getTareasPorUsuario = async (uid) => {
    const q = query(collection(db, TAREAS_COL), where('asignadoA', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const onTareasChange = (uid, callback) => {
    const q = query(collection(db, TAREAS_COL), where('asignadoA', '==', uid));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
};

export const getAllTareas = async () => {
    const snap = await getDocs(collection(db, TAREAS_COL));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
// ===================== HISTORIAL COMPLETO DE BITACORAS =====================
export const onHistorialBitacoraChange = (callback) => {
    const q = query(collection(db, BITACORA_COL), orderBy('fecha', 'desc'));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
};
