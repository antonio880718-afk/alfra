import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const STAFF_COL = collection(db, 'staff');

// Obtener todo el staff (empleados)
export const getStaff = async () => {
    try {
        const q = query(STAFF_COL, orderBy('nombre', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error("Error fetching staff:", error);
        return [];
    }
};

// Escuchar cambios en tiempo real al staff
export const onStaffChange = (callback) => {
    const q = query(STAFF_COL, orderBy('nombre', 'asc'));
    return onSnapshot(q, (snapshot) => {
        const staff = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(staff);
    }, (error) => {
        console.error('Error in staff listener:', error);
        callback([]); // fallback — no crashea la UI
    });
};

// Crear nuevo empleado
export const createEmpleado = async (data) => {
    try {
        const docRef = await addDoc(STAFF_COL, {
            ...data,
            saldoComisiones: 0,
            estatus: 'Activo',
            createdAt: new Date().toISOString(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Error creating empleado:", error);
        throw error;
    }
};

// Actualizar empleado
export const updateEmpleado = async (id, data) => {
    try {
        const docRef = doc(db, 'staff', id);
        await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
    } catch (error) {
        console.error("Error updating empleado:", error);
        throw error;
    }
};
// Borrar empleado
export const deleteEmpleado = async (id) => {
    try {
        const docRef = doc(db, 'staff', id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting empleado:", error);
        throw error;
    }
};

// Buscar el documento de staff que corresponde al Auth UID del usuario logueado
// Retorna { id: firestoreDocId, ...data } o null si no lo encuentra
export const getStaffDocByUid = async (uid) => {
    try {
        const q = query(STAFF_COL, where('uid', '==', uid));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        const d = snapshot.docs[0];
        return { id: d.id, ...d.data() };
    } catch (error) {
        console.error("Error fetching staff by uid:", error);
        return null;
    }
};

