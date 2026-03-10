import { collection, addDoc, updateDoc, setDoc, doc, getDocs, getDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const COLLECTION_NAME = 'seguimiento';
const APOYO_COLLECTION = 'apoyoEnCasa';
const seguimientoCol = collection(db, COLLECTION_NAME);

// Auto-cálculo del IMC
const calcularIMC = (peso, estatura) => {
    if (!peso || !estatura || estatura === 0) return 0;
    const estaturaMetros = estatura > 3 ? estatura / 100 : estatura;
    const imc = peso / (estaturaMetros * estaturaMetros);
    return Number(imc.toFixed(2));
};

export const createSeguimiento = async (pacienteId, data) => {
    try {
        const { peso, estatura, ...medidas } = data;
        const imc = calcularIMC(peso, estatura);

        const docRef = await addDoc(seguimientoCol, {
            pacienteId,
            peso,
            estatura,
            imc,
            medidas: { ...medidas },
            fotosUrls: [],
            fechaRegistro: new Date().toISOString()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error creating seguimiento:", error);
        throw error;
    }
};

export const getSeguimientosPaciente = async (pacienteId) => {
    try {
        const q = query(seguimientoCol, orderBy('fechaRegistro', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(s => s.pacienteId === pacienteId);
    } catch (error) {
        console.error("Error fetching seguimientos:", error);
        return []; // Return empty instead of throwing
    }
};

// ─── APOYO EN CASA ───────────────────────────────────────────────────────────
// Cuidados personalizados que el especialista asigna a cada paciente

// Cuidados predefinidos por tipo de tratamiento
export const CUIDADOS_PRESET = {
    Facial: [
        { id: 'f1', texto: 'Aplicar protector solar FPS 50+ cada 4 horas' },
        { id: 'f2', texto: 'Limpiar el rostro con jabón neutro 2 veces al día' },
        { id: 'f3', texto: 'Aplicar crema hidratante recomendada por la clínica' },
        { id: 'f4', texto: 'No exponerse al sol directamente durante 48h' },
        { id: 'f5', texto: 'No maquillarse por 24 horas post-tratamiento' },
        { id: 'f6', texto: 'Aplicar serum vitamina C por las mañanas' },
        { id: 'f7', texto: 'No rascar ni frotar el área tratada' },
        { id: 'f8', texto: 'Dormir boca arriba para evitar presión en la zona' },
    ],
    Corporal: [
        { id: 'c1', texto: 'Tomar mínimo 2 litros de agua al día' },
        { id: 'c2', texto: 'Realizar caminata de 30 minutos diarios' },
        { id: 'c3', texto: 'Aplicar crema reductora en zona tratada 2 veces al día' },
        { id: 'c4', texto: 'Evitar carbohidratos simples y azúcar refinada' },
        { id: 'c5', texto: 'Usar faja de compresión indicada por el especialista' },
        { id: 'c6', texto: 'Evitar baños calientes por 48 horas' },
        { id: 'c7', texto: 'Respetar la dieta indicada por la nutrióloga' },
        { id: 'c8', texto: 'No realizar ejercicio de alto impacto por 72 horas' },
    ],
    General: [
        { id: 'g1', texto: 'Asistir puntualmente a su próxima cita' },
        { id: 'g2', texto: 'Reportar cualquier reacción inusual al WhatsApp de la clínica' },
        { id: 'g3', texto: 'Dormir mínimo 7 horas por noche' },
        { id: 'g4', texto: 'Evitar el consumo de alcohol durante el tratamiento' },
        { id: 'g5', texto: 'No fumar durante el período de recuperación' },
    ],
};

// Guardar/actualizar el plan de apoyo en casa de un paciente
export const saveApoyoEnCasa = async (pacienteId, cuidados) => {
    try {
        const docRef = doc(db, APOYO_COLLECTION, pacienteId);
        await setDoc(docRef, {
            pacienteId,
            cuidados, // array de { id, texto, activo: true/false }
            updatedAt: new Date().toISOString(),
            updatedBy: 'especialista',
        }, { merge: true });
    } catch (error) {
        console.error("Error saving apoyo en casa:", error);
        throw error;
    }
};

// Obtener el plan de apoyo en casa de un paciente
export const getApoyoEnCasa = async (pacienteId) => {
    try {
        const docRef = doc(db, APOYO_COLLECTION, pacienteId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data().cuidados || [];
        }
        return null; // null = no hay plan asignado aún
    } catch (error) {
        console.error("Error getting apoyo en casa:", error);
        return null;
    }
};
