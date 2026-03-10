import {
    collection, addDoc, updateDoc, deleteDoc, doc,
    getDocs, query, onSnapshot, orderBy, where
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const inventarioCol = collection(db, 'inventario');
const solicitudesCol = collection(db, 'solicitudesInsumos');

// ═══════════════════════════════════════════════════════════════
//  INVENTARIO (Productos de Venta e Insumos)
// ═══════════════════════════════════════════════════════════════

/** Escuchar todos los items en tiempo real. tipo = 'producto' | 'insumo' */
export const onInventarioChange = (callback) => {
    return onSnapshot(inventarioCol, (snap) => {
        const items = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        callback(items);
    }, (err) => {
        console.error('Error inventario listener:', err);
        callback([]);
    });
};

/** Crear un item nuevo */
export const createInventarioItem = async (data) => {
    const docRef = await addDoc(inventarioCol, {
        nombre: '',
        tipo: 'insumo',         // 'producto' | 'insumo'
        descripcion: '',
        categoria: '',
        stock: 0,
        stockMinimo: 5,
        precio: 0,              // precio de venta (solo productos)
        costo: 0,               // costo de adquisición
        fechaAdquisicion: new Date().toISOString().split('T')[0],
        unidad: 'pz',           // pz, ml, g, caja, etc.
        proveedor: '',
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
    return docRef.id;
};

/** Actualizar un item */
export const updateInventarioItem = async (id, data) => {
    const ref = doc(db, 'inventario', id);
    await updateDoc(ref, { ...data, updatedAt: new Date().toISOString() });
};

/** Eliminar un item */
export const deleteInventarioItem = async (id) => {
    await deleteDoc(doc(db, 'inventario', id));
};

// ═══════════════════════════════════════════════════════════════
//  SOLICITUDES DE INSUMOS
// ═══════════════════════════════════════════════════════════════

/** Escuchar todas las solicitudes en tiempo real */
export const onSolicitudesChange = (callback) => {
    return onSnapshot(solicitudesCol, (snap) => {
        const items = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        callback(items);
    }, (err) => {
        console.error('Error solicitudes listener:', err);
        callback([]);
    });
};

/** Crear una solicitud de insumo */
export const createSolicitud = async ({ insumoId, insumoNombre, cantidad, motivo, solicitanteNombre, solicitanteRole }) => {
    const docRef = await addDoc(solicitudesCol, {
        insumoId,
        insumoNombre,
        cantidad: Number(cantidad),
        motivo: motivo || '',
        solicitanteNombre,
        solicitanteRole,
        status: 'Pendiente',    // 'Pendiente' | 'Aprobada' | 'Rechazada'
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
    return docRef.id;
};

/** Admin aprueba o rechaza una solicitud */
export const responderSolicitud = async (solicitudId, status, insumoId, cantidadAprobada) => {
    // Actualizar el status de la solicitud
    const ref = doc(db, 'solicitudesInsumos', solicitudId);
    await updateDoc(ref, {
        status,
        respondidoEn: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });

    // Si se aprueba, descontar el stock del insumo
    if (status === 'Aprobada' && insumoId) {
        const snap = await getDocs(query(inventarioCol, where('__name__', '==', insumoId)));
        if (!snap.empty) {
            const item = snap.docs[0];
            const nuevoStock = Math.max(0, (Number(item.data().stock) || 0) - Number(cantidadAprobada));
            await updateDoc(doc(db, 'inventario', insumoId), {
                stock: nuevoStock,
                updatedAt: new Date().toISOString(),
            });
        }
    }
};
