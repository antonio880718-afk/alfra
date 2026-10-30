import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

const COLLECTION_NAME = 'pacientes_paquetes';
const paquetesCol = collection(db, COLLECTION_NAME);

// Definición estática de los 4 paquetes base de la clínica
export const PAQUETES_BASE = [
    {
        id: 'lipo_sin_cirugia',
        nombre: 'Efecto Lipo Sin Cirugía',
        metaKilosMin: 15,
        metaKilosMax: 20,
        sesiones: 15,
        duracionMinutos: 120,
        precio: 12400
    },
    {
        id: 'reductivo_premium',
        nombre: 'Reductivo Premium',
        metaKilosMin: 10,
        metaKilosMax: 15,
        sesiones: 14,
        duracionMinutos: 90,
        precio: 10500
    },
    {
        id: 'reductivo_body_fit',
        nombre: 'Reductivo Body Fit',
        metaKilosMin: 5,
        metaKilosMax: 10,
        sesiones: 12,
        duracionMinutos: 90,
        precio: 8500
    },
    {
        id: 'reduce_define_reafirma',
        nombre: 'Reduce, Define, Reafirma!',
        metaKilosMin: 1, // Hasta 5kg
        metaKilosMax: 5,
        metaTallas: '1 a 2',
        sesiones: 12,
        duracionMinutos: 60,
        precio: 6500
    }
];

// Asignar un nuevo paquete a un paciente
export const asignarPaquete = async (pacienteId, paqueteId, medidasIniciales, metaCaloriasDiarias) => {
    try {
        const paqueteBase = PAQUETES_BASE.find(p => p.id === paqueteId);
        if (!paqueteBase) throw new Error("Paquete no encontrado");

        const nuevoPaquete = {
            pacienteId,
            paqueteId: paqueteBase.id,
            nombrePaquete: paqueteBase.nombre,
            estado: 'activo', // activo, completado, abandonado
            fechaInicio: new Date().toISOString(),
            sesionesTotales: paqueteBase.sesiones,
            sesionesCompletadas: 0,
            metaKilos: paqueteBase.metaKilosMax,
            metaCaloriasActual: metaCaloriasDiarias || 1500, // Meta editable por el especialista
            medidasIniciales: medidasIniciales || {
                peso: 0,
                cintura: 0,
                abdomen: 0,
                espalda: 0
            },
            medidasActuales: medidasIniciales || { peso: 0, cintura: 0, abdomen: 0, espalda: 0 },
            historialSesiones: [], // Aquí guardaremos cada sesión (peso, medidas, índice de compromiso)
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(paquetesCol, nuevoPaquete);
        return docRef.id;
    } catch (error) {
        console.error("Error asignando paquete:", error);
        throw error;
    }
};

// Obtener paquetes activos de un paciente
export const getPaquetesActivosPaciente = async (pacienteId) => {
    try {
        const q = query(paquetesCol, where('pacienteId', '==', pacienteId), where('estado', '==', 'activo'));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error al obtener paquetes activos:", error);
        throw error;
    }
};

// Registrar una sesión en cabina
export const registrarSesionPaquete = async (paqueteDbId, datosSesion) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, paqueteDbId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) throw new Error("Registro de paquete no existe");
        
        const data = docSnap.data();
        const nuevoHistorial = [...(data.historialSesiones || []), {
            fecha: new Date().toISOString(),
            ...datosSesion // Debe incluir peso, medidas, fotos, y el metaCalorias (si se ajustó)
        }];

        await updateDoc(docRef, {
            sesionesCompletadas: (data.sesionesCompletadas || 0) + 1,
            medidasActuales: {
                peso: datosSesion.peso || data.medidasActuales?.peso,
                cintura: datosSesion.cintura || data.medidasActuales?.cintura,
                abdomen: datosSesion.abdomen || data.medidasActuales?.abdomen,
                espalda: datosSesion.espalda || data.medidasActuales?.espalda,
            },
            historialSesiones: nuevoHistorial,
            // Si el especialista actualizó la meta en esta sesión
            ...(datosSesion.nuevaMetaCalorias && { metaCaloriasActual: datosSesion.nuevaMetaCalorias })
        });

        return true;
    } catch (error) {
        console.error("Error al registrar sesión:", error);
        throw error;
    }
};

// Actualizar la meta calórica independiente de la sesión
export const actualizarMetaCalorias = async (paqueteDbId, nuevaMeta) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, paqueteDbId);
        await updateDoc(docRef, { metaCaloriasActual: nuevaMeta });
        return true;
    } catch (error) {
        console.error("Error al actualizar meta calórica:", error);
        throw error;
    }
};

// Real-time listener para los paquetes de un paciente
export const onPaquetesPacienteChange = (pacienteId, callback) => {
    const q = query(paquetesCol, where('pacienteId', '==', pacienteId));
    return onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Ordenar por fechaInicio descendente
        list.sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));
        callback(list);
    });
};
