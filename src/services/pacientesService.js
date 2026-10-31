import { collection, addDoc, updateDoc, setDoc, deleteDoc, doc, getDocs, getDoc, query, where, onSnapshot, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

const COLLECTION_NAME = 'pacientes';
const pacientesCol = collection(db, COLLECTION_NAME);

// Crear nuevo paciente (used during self-registration)
export const createPaciente = async (data) => {
    try {
        const docRef = await addDoc(pacientesCol, {
            ...data,
            sellosLealtad: 0,
            recompensasDisponibles: 0,
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
// Obtener un paciente específico por su ID de documento Firestore
// Con auto-resolución ultra-resiliente por ID, Auth UID, o ID de Cita
export const getPacienteById = async (id) => {
    if (!id) return null;
    try {
        // 1. Búsqueda directa por ID de documento
        const docRef = doc(db, COLLECTION_NAME, String(id));
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }

        // 2. Fallback: ¿Es un UID de Firebase Auth?
        const qUid = query(pacientesCol, where('uid', '==', String(id)));
        const snapUid = await getDocs(qUid);
        if (!snapUid.empty) {
            const d = snapUid.docs[0];
            return { id: d.id, ...d.data() };
        }

        // 3. Fallback: ¿Es un ID de Cita? Recuperar su pacienteId o vincular por nombre
        try {
            const citaSnap = await getDoc(doc(db, 'citas', String(id)));
            if (citaSnap.exists()) {
                const cData = citaSnap.data();
                if (cData.pacienteId) {
                    const pacSnap = await getDoc(doc(db, COLLECTION_NAME, String(cData.pacienteId)));
                    if (pacSnap.exists()) {
                        return { id: pacSnap.id, ...pacSnap.data() };
                    }
                }
                const nombreTarget = (cData.paciente || cData.pacienteNombre || '').trim().toLowerCase();
                if (nombreTarget) {
                    const snapAll = await getDocs(pacientesCol);
                    const match = snapAll.docs.find(d => (d.data().nombre || '').trim().toLowerCase() === nombreTarget);
                    if (match) {
                        return { id: match.id, ...match.data() };
                    }
                }
            }
        } catch (eCita) {
            // No es ID de cita
        }

        return null;
    } catch (error) {
        console.error('Error getting paciente:', error);
        return null;
    }
};

// Obtener paciente por su UID de Firebase Auth
// Obtener paciente por su UID de Firebase Auth con auto-recuperacion y vinculacion automatica
export const getPacienteByUid = async (uid, optionalEmail = null) => {
    if (!uid) return null;
    try {
        // 1. Busqueda directa por UID
        const q = query(pacientesCol, where('uid', '==', uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const d = snapshot.docs[0];
            return { ...d.data(), id: d.id };
        }

        // Si no se encontro por UID directo, buscar expediente por usuario/email/telefono
        let userDocData = null;
        try {
            const userSnap = await getDoc(doc(db, 'usuarios', uid));
            if (userSnap.exists()) {
                userDocData = userSnap.data();
                if (userDocData.pacienteId) {
                    const pacById = await getDoc(doc(db, COLLECTION_NAME, userDocData.pacienteId));
                    if (pacById.exists()) {
                        const pData = pacById.data();
                        if (!pData.uid || pData.uid !== uid) {
                            try { await updateDoc(doc(db, COLLECTION_NAME, pacById.id), { uid }); } catch(e){}
                        }
                        return { ...pData, uid, id: pacById.id };
                    }
                }
            }
        } catch (uErr) {
            console.warn("Aviso al verificar /usuarios/" + uid + ":", uErr);
        }

        const targetEmail = (optionalEmail || userDocData?.email || auth?.currentUser?.email || '').trim().toLowerCase();

        // 2. Busqueda por email
        if (targetEmail) {
            try {
                const qEmail = query(pacientesCol, where('email', '==', targetEmail));
                const snapEmail = await getDocs(qEmail);
                if (!snapEmail.empty) {
                    const d = snapEmail.docs[0];
                    const pData = d.data();
                    try {
                        await updateDoc(doc(db, COLLECTION_NAME, d.id), { uid, updatedAt: new Date().toISOString() });
                        await setDoc(doc(db, 'usuarios', uid), { pacienteId: d.id }, { merge: true });
                    } catch(linkErr) {
                        console.warn("Aviso vinculando paciente UID:", linkErr);
                    }
                    return { ...pData, uid, id: d.id };
                }
            } catch(e) {}
        }

        // 3. Busqueda por telefono
        const rawPhone = userDocData?.telefono || auth?.currentUser?.phoneNumber || '';
        const cleanPhone = rawPhone ? String(rawPhone).replace(/\D/g, '') : '';
        if (cleanPhone && cleanPhone.length >= 7) {
            try {
                const qTel = query(pacientesCol, where('telefono', '==', cleanPhone));
                const snapTel = await getDocs(qTel);
                if (!snapTel.empty) {
                    const d = snapTel.docs[0];
                    const pData = d.data();
                    try {
                        await updateDoc(doc(db, COLLECTION_NAME, d.id), { uid, updatedAt: new Date().toISOString() });
                        await setDoc(doc(db, 'usuarios', uid), { pacienteId: d.id }, { merge: true });
                    } catch(linkErr) {}
                    return { ...pData, uid, id: d.id };
                }
            } catch(e) {}
        }

        // 4. Si el paciente no existia en pacientes, inicializar su registro base
        const defaultNombre = userDocData?.nombre || auth?.currentUser?.displayName || (targetEmail ? targetEmail.split('@')[0] : 'Paciente');
        const defaultTel = rawPhone || '';
        try {
            const newDocRef = await addDoc(pacientesCol, {
                uid,
                nombre: defaultNombre,
                email: targetEmail,
                telefono: defaultTel,
                tipoTratamiento: 'Mixto',
                estado: 'Activo',
                sellosLealtad: 0,
                recompensasDisponibles: 0,
                createdAt: new Date().toISOString()
            });
            try {
                await setDoc(doc(db, 'usuarios', uid), { pacienteId: newDocRef.id }, { merge: true });
            } catch(e){}
            return {
                id: newDocRef.id,
                uid,
                nombre: defaultNombre,
                email: targetEmail,
                telefono: defaultTel,
                tipoTratamiento: 'Mixto',
                sellosLealtad: 0,
                recompensasDisponibles: 0
            };
        } catch (createErr) {
            console.error("Error al auto-crear paciente:", createErr);
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

// Actualizar lealtad de todos los pacientes en batch
export const updateAllPacientesLealtad = async (pacientes, activar) => {
    console.log('updateAllPacientesLealtad llamado con:', pacientes.length, activar);
    try {
        const batch = writeBatch(db);
        console.log('Batch creado.');
        pacientes.forEach(p => {
            if (!p.id) console.warn('Paciente sin ID:', p);
            const docRef = doc(db, COLLECTION_NAME, p.id);
            batch.update(docRef, { lealtadActiva: activar, updatedAt: new Date().toISOString() });
        });
        console.log('Batch operaciones agregadas. Guardando commit...');
        await batch.commit();
        console.log('Batch commit exitoso.');
    } catch (error) {
        console.error("Error updating all pacientes lealtad:", error);
        throw error;
    }
};

// Activar membresía para un paciente
export const activarMembresia = async (pacienteId, nivel = 'Bronce') => {
    try {
        const docRef = doc(db, COLLECTION_NAME, pacienteId);
        const codigo = 'MEM-' + Math.random().toString(36).substr(2, 5).toUpperCase();
        await updateDoc(docRef, {
            membresia: {
                codigo,
                nivel,
                horasDisponibles: 0,
                activa: true,
                createdAt: new Date().toISOString()
            },
            updatedAt: new Date().toISOString()
        });
        return codigo;
    } catch (error) {
        console.error("Error activating membresia:", error);
        throw error;
    }
};

// Recargar horas de membresía
export const recargarHorasMembresia = async (pacienteId, horas) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, pacienteId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error("Paciente no existe");
        
        const data = docSnap.data();
        const membresia = data.membresia || {};
        const horasActuales = membresia.horasDisponibles || 0;
        
        await updateDoc(docRef, {
            'membresia.horasDisponibles': horasActuales + horas,
            updatedAt: new Date().toISOString()
        });
        
        // Registrar recarga
        await addDoc(collection(db, 'recargas_membresia'), {
            pacienteId,
            pacienteNombre: data.nombre || 'Paciente sin nombre',
            horasRecargadas: horas,
            fecha: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error recharging horas:", error);
        throw error;
    }
};

// Consumir horas de membresía
export const consumirHorasMembresia = async (pacienteId, horas, servicioInfo, reciboId = null) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, pacienteId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error("Paciente no existe");
        
        const data = docSnap.data();
        const membresia = data.membresia || {};
        const horasActuales = membresia.horasDisponibles || 0;
        
        if (horasActuales < horas) {
            throw new Error("El paciente no tiene suficientes horas disponibles");
        }
        
        // 1. Descontar horas
        await updateDoc(docRef, {
            'membresia.horasDisponibles': horasActuales - horas,
            updatedAt: new Date().toISOString()
        });
        
        // 2. Registrar consumo en la colección 'consumos_membresia'
        await addDoc(collection(db, 'consumos_membresia'), {
            pacienteId,
            pacienteNombre: data.nombre || 'Paciente sin nombre',
            servicioId: servicioInfo.id,
            servicioNombre: servicioInfo.nombre,
            horasConsumidas: horas,
            reciboId,
            fecha: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error consuming horas:", error);
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
        const errArray = [];
        errArray.error = error;
        callback(errArray);
    });
};
// Borrar paciente (Cambiado a Soft-Delete por seguridad de datos)
export const deletePaciente = async (id) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        // await deleteDoc(docRef); // HARD DELETE DESACTIVADO
        await updateDoc(docRef, {
            eliminado: true,
            activo: false,
            deletedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error soft-deleting paciente:", error);
        throw error;
    }
};

// Solicitar eliminación de paciente (para recepción)
export const solicitarEliminacionPaciente = async (pacienteId, nombrePaciente, motivo, solicitadoPor) => {
    try {
        await addDoc(collection(db, 'solicitudes_eliminacion_pacientes'), {
            pacienteId,
            nombrePaciente,
            motivo,
            solicitadoPor,
            fecha: new Date().toISOString(),
            estado: 'pendiente'
        });
    } catch (error) {
        console.error("Error soliciting paciente deletion:", error);
        throw error;
    }
};

// Escuchar solicitudes de eliminación pendientes
export const onSolicitudesEliminacionChange = (callback) => {
    const q = query(collection(db, 'solicitudes_eliminacion_pacientes'), where('estado', '==', 'pendiente'));
    return onSnapshot(q, (snapshot) => {
        const solicitudes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(solicitudes);
    }, (error) => {
        console.error("Error in solicitudes listener:", error);
        callback([]);
    });
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

// Escuchar consumos de membresía en tiempo real
export const onConsumosChange = (callback) => {
    return onSnapshot(collection(db, 'consumos_membresia'), (snapshot) => {
        const consumos = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        callback(consumos);
    }, (error) => {
        console.error("Error in consumos listener:", error);
        callback([]);
    });
};

// Escuchar consumos de un paciente específico
export const onConsumosPacienteChange = (pacienteId, callback) => {
    const q = query(collection(db, 'consumos_membresia'), where('pacienteId', '==', pacienteId));
    return onSnapshot(q, (snapshot) => {
        const consumos = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        callback(consumos);
    }, (error) => {
        console.error("Error in consumos paciente listener:", error);
        callback([]);
    });
};

// Escuchar recargas de un paciente específico
export const onRecargasPacienteChange = (pacienteId, callback) => {
    const q = query(collection(db, 'recargas_membresia'), where('pacienteId', '==', pacienteId));
    return onSnapshot(q, (snapshot) => {
        const recargas = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        callback(recargas);
    }, (error) => {
        console.error("Error in recargas listener:", error);
        callback([]);
    });
};

/**
 * Resetea los sellos de lealtad de TODOS los pacientes a 0.
 * Usa batch para ser atómico y eficiente.
 */
export const resetAllSellos = async () => {
    const snap = await getDocs(pacientesCol);
    const BATCH_LIMIT = 499;
    let batch = writeBatch(db);
    let count = 0;

    for (const docSnap of snap.docs) {
        batch.update(doc(db, COLLECTION_NAME, docSnap.id), {
            sellosLealtad: 0,
            ultimoSello: null,
            primerSelloFecha: null,
        });
        count++;
        if (count >= BATCH_LIMIT) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
        }
    }
    if (count > 0) await batch.commit();
    return snap.size;
};

