import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

// ─── SERVICIOS (Catálogo) ────────────────────────────────────────────────────
const serviciosCol = collection(db, 'servicios');

export const createServicio = async (data) => {
    const docRef = await addDoc(serviciosCol, { ...data, createdAt: new Date().toISOString() });
    return docRef.id;
};

export const updateServicio = async (id, data) => {
    await updateDoc(doc(db, 'servicios', id), { ...data, updatedAt: new Date().toISOString() });
};

export const deleteServicio = async (id) => {
    await deleteDoc(doc(db, 'servicios', id));
};

export const onServiciosChange = (callback) => {
    return onSnapshot(serviciosCol, (snapshot) => {
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(items);
    }, (error) => {
        console.error('Error in servicios listener:', error);
        callback([]);
    });
};

// ─── CUPONES ─────────────────────────────────────────────────────────────────
const cuponesCol = collection(db, 'cupones');

export const createCupon = async (data) => {
    const docRef = await addDoc(cuponesCol, { ...data, activo: true, createdAt: new Date().toISOString() });
    return docRef.id;
};

export const updateCupon = async (id, data) => {
    await updateDoc(doc(db, 'cupones', id), { ...data, updatedAt: new Date().toISOString() });
};

export const deleteCupon = async (id) => {
    await deleteDoc(doc(db, 'cupones', id));
};

export const onCuponesChange = (callback) => {
    return onSnapshot(cuponesCol, (snapshot) => {
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(items);
    }, (error) => {
        console.error('Error in cupones listener:', error);
        callback([]);
    });
};
