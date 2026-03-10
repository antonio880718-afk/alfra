import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const COLLECTION_NAME = 'citas';
const citasCol = collection(db, COLLECTION_NAME);

// Status allowed: 'Pendiente', 'Confirmada', 'Completada', 'Cancelada'

export const createCita = async (data) => {
    try {
        const docRef = await addDoc(citasCol, {
            ...data, // { pacienteId, pacienteNombre, telefono, especialistaId, servicio, fechaHora, duracionMin }
            status: 'Pendiente',
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error creating cita:", error);
        throw error;
    }
};

export const getCitas = async () => {
    try {
        const q = query(citasCol, orderBy('fechaHora', 'asc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching citas:", error);
        throw error;
    }
};

// Citas de un paciente específico
export const getCitasByPaciente = async (pacienteId) => {
    try {
        const q = query(citasCol, orderBy('fechaHora', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(c => c.pacienteId === pacienteId);
    } catch (error) {
        console.error("Error fetching citas by paciente:", error);
        return [];
    }
};

// Citas de un especialista específico
export const getCitasByEspecialista = async (especialistaId) => {
    try {
        const q = query(citasCol, orderBy('fechaHora', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(c => c.especialistaId === especialistaId);
    } catch (error) {
        console.error("Error fetching citas by especialista:", error);
        return [];
    }
};

// Escuchar en tiempo real TODAS las citas (para Recepcionista/Admin)
export const onCitasChange = (callback) => {
    const q = query(citasCol, orderBy('fechaHora', 'asc'));
    return onSnapshot(q, (snapshot) => {
        const citas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(citas);
    }, (error) => {
        console.error('Error in citas listener:', error);
        callback([]); // fallback vacío — no crashea la UI
    });
};

// Escuchar citas de un especialista en tiempo real - sin compound index
export const onCitasEspecialistaChange = (especialistaId, callback) => {
    const q = query(citasCol, orderBy('fechaHora', 'asc'));
    return onSnapshot(q, (snapshot) => {
        const citas = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(c => c.especialistaId === especialistaId);
        callback(citas);
    });
};

// Actualizar status de la cita
export const updateCitaStatus = async (id, newStatus, extraData = {}) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            status: newStatus,
            ...extraData,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error updating cita status:", error);
        throw error;
    }
};
