import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const COLLECTION_NAME = 'pacientes';
const pacientesCol = collection(db, COLLECTION_NAME);

// Crear nuevo paciente (used during self-registration)
export const createPaciente = async (data) => {
    try {
        const docRef = await addDoc(pacientesCol, {
            ...data,
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error creating paciente:", error);
        throw error;
    }
};

// Obtener todos los pacientes (sin orderBy para evitar índice y ser más rápido)
export const getPacientes = async () => {
    try {
        const querySnapshot = await getDocs(pacientesCol);
        const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Ordenar en JS (más rápido que índice de Firestore en listas pequeñas)
        return list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    } catch (error) {
        console.error("Error fetching pacientes:", error);
        return [];
    }
};

// Obtener un paciente específico por su ID de documento Firestore
export const getPacienteById = async (id) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error("Error getting paciente:", error);
        return null;
    }
};

// Obtener paciente por su UID de Firebase Auth
export const getPacienteByUid = async (uid) => {
    try {
        const q = query(pacientesCol, where('uid', '==', uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const d = snapshot.docs[0];
            return { id: d.id, ...d.data() };
        }
        return null;
    } catch (error) {
        console.error("Error getting paciente by uid:", error);
        return null;
    }
};

// Actualizar paciente (incluyendo asignación de especialista)
export const updatePaciente = async (id, data) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error updating paciente:", error);
        throw error;
    }
};

// Escuchar cambios en tiempo real en todos los pacientes (sin orderBy = más rápido)
export const onPacientesChange = (callback) => {
    return onSnapshot(pacientesCol, (snapshot) => {
        const pacientes = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        callback(pacientes);
    }, (error) => {
        console.error("Error in pacientes listener:", error);
        callback([]);
    });
};
// Borrar paciente
export const deletePaciente = async (id) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting paciente:", error);
        throw error;
    }
};
// Escuchar pacientes asignados a un especialista
export const onPacientesByEspecialistaChange = (especialistaId, callback) => {
    const q = query(pacientesCol, where('especialistaAsignado', '==', especialistaId));
    return onSnapshot(q, (snapshot) => {
        const pacientes = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        callback(pacientes);
    }, (error) => {
        console.error("Error in especialista pacientes listener:", error);
        callback([]);
    });
};
