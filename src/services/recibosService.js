import { collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const COLLECTION_NAME = 'recibos';
const recibosCol = collection(db, COLLECTION_NAME);

/**
 * Genera un folio único de 5 dígitos.
 */
const generarFolio = () => Math.floor(10000 + Math.random() * 90000).toString();

/**
 * Crea un recibo en Firestore después de procesar un cobro.
 * @param {Object} data - { pacienteId, pacienteNombre, concepto, monto, metodoPago, paqueteInfo, telefono }
 */
export const createRecibo = async (data) => {
    try {
        const recibo = {
            ...data,
            folio: generarFolio(),
            fecha: new Date().toISOString(),
            fechaLegible: new Date().toLocaleDateString('es-MX', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }),
            createdAt: new Date().toISOString(),
        };
        const docRef = await addDoc(recibosCol, recibo);
        return { id: docRef.id, ...recibo };
    } catch (error) {
        console.error('Error creating recibo:', error);
        throw error;
    }
};

/**
 * Obtiene todos los recibos de un paciente, ordenados del más reciente al más antiguo.
 * @param {string} pacienteId
 */
export const getRecibosPaciente = async (pacienteId) => {
    try {
        const q = query(
            recibosCol,
            where('pacienteId', '==', pacienteId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Error fetching recibos:', error);
        throw error;
    }
};

/**
 * Obtiene TODOS los recibos (para Admin/Recepcionista).
 */
export const getAllRecibos = async () => {
    try {
        const q = query(recibosCol, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Error fetching all recibos:', error);
        throw error;
    }
};
