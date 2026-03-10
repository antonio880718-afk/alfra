import { collection, addDoc, updateDoc, doc, getDocs, getDoc, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const PLANES_COL = collection(db, 'planes');

// Escuchar cambios en tiempo real en planes de tratamiento/financiamiento
export const onPlanesChange = (callback) => {
    const q = query(PLANES_COL, orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const planes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(planes);
    });
};

// Obtener todos los planes
export const getPlanes = async () => {
    try {
        const q = query(PLANES_COL, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error("Error fetching planes:", error);
        return [];
    }
};

// Crear nuevo plan de tratamiento
export const createPlan = async (data) => {
    try {
        const docRef = await addDoc(PLANES_COL, {
            ...data,
            acumulado: 0,
            morosidad: false,
            createdAt: new Date().toISOString(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Error creating plan:", error);
        throw error;
    }
};

// Actualizar plan (abonar, ajustar, etc.)
export const updatePlan = async (id, data) => {
    try {
        const docRef = doc(db, 'planes', id);
        await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
    } catch (error) {
        console.error("Error updating plan:", error);
        throw error;
    }
};
