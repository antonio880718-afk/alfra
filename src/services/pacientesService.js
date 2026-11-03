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
        // 1. Verificar si /usuarios/{uid} ya tiene su pacienteId canónico asignado
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

        // 2. Extraer identificadores del usuario (email, teléfono y nombre)
        const targetEmail = (optionalEmail || userDocData?.email || auth?.currentUser?.email || '').trim().toLowerCase();
        let cleanPhone = String(userDocData?.telefono || auth?.currentUser?.phoneNumber || '').replace(/\D/g, '');
        
        if (!cleanPhone && targetEmail && targetEmail.includes('@paciente.alfra.mx')) {
            cleanPhone = targetEmail.split('@')[0].replace(/\D/g, '');
        }
        if (!cleanPhone && optionalEmail && optionalEmail.includes('@paciente.alfra.mx')) {
            cleanPhone = optionalEmail.split('@')[0].replace(/\D/g, '');
        }

        // 3. Resolución canónica inmediata por teléfono en directorio_pacientes
        if (cleanPhone && cleanPhone.length >= 7) {
            try {
                const snapDir = await getDoc(doc(db, 'directorio_pacientes', cleanPhone));
                if (snapDir.exists() && snapDir.data().pacienteId) {
                    const canId = snapDir.data().pacienteId;
                    const snapCan = await getDoc(doc(db, COLLECTION_NAME, canId));
                    if (snapCan.exists()) {
                        const cData = snapCan.data();
                        try {
                            if (!cData.uid || cData.uid !== uid) {
                                await updateDoc(doc(db, COLLECTION_NAME, canId), { uid, updatedAt: new Date().toISOString() });
                            }
                            await setDoc(doc(db, 'usuarios', uid), { pacienteId: canId, telefono: cleanPhone }, { merge: true });
                        } catch (_) {}
                        return { ...cData, uid, id: canId };
                    }
                }
            } catch (dirErr) {
                console.warn("Aviso resolviendo paciente por directorio:", dirErr);
            }
        }

        // 4. Búsqueda por email
        if (targetEmail && !targetEmail.includes('@paciente.alfra.mx')) {
            try {
                const qEmail = query(pacientesCol, where('email', '==', targetEmail));
                const snapEmail = await getDocs(qEmail);
                if (!snapEmail.empty) {
                    const d = snapEmail.docs[0];
                    const pData = d.data();
                    try {
                        await updateDoc(doc(db, COLLECTION_NAME, d.id), { uid, updatedAt: new Date().toISOString() });
                        await setDoc(doc(db, 'usuarios', uid), { pacienteId: d.id }, { merge: true });
                    } catch(linkErr) {}
                    return { ...pData, uid, id: d.id };
                }
            } catch(e) {}
        }

        // 5. Búsqueda inteligente por teléfono normalizado (a 10 dígitos)
        if (cleanPhone && cleanPhone.length >= 7) {
            try {
                const snapAll = await getDocs(pacientesCol);
                const candidates = [];
                snapAll.docs.forEach(d => {
                    const pData = d.data();
                    const pTel = String(pData.telefono || pData.celular || '').replace(/\D/g, '');
                    if (pTel && (pTel === cleanPhone || pTel.endsWith(cleanPhone) || cleanPhone.endsWith(pTel))) {
                        candidates.push({ id: d.id, ...pData });
                    }
                });

                if (candidates.length > 0) {
                    candidates.sort((a, b) => {
                        const scoreA = (a.especialistaAsignado ? 10 : 0) + (a.tipoTratamiento && a.tipoTratamiento !== 'Mixto' ? 5 : 0) + (a.fechaNacimiento ? 2 : 0);
                        const scoreB = (b.especialistaAsignado ? 10 : 0) + (b.tipoTratamiento && b.tipoTratamiento !== 'Mixto' ? 5 : 0) + (b.fechaNacimiento ? 2 : 0);
                        return scoreB - scoreA;
                    });
                    const best = candidates[0];
                    try {
                        await updateDoc(doc(db, COLLECTION_NAME, best.id), { uid, updatedAt: new Date().toISOString() });
                        await setDoc(doc(db, 'usuarios', uid), { pacienteId: best.id, telefono: cleanPhone }, { merge: true });
                    } catch(linkErr) {}
                    return { ...best, uid, id: best.id };
                }
            } catch(e) {}
        }

        // 6. Búsqueda por nombre de paciente (Insensible a mayúsculas y acentos)
        const targetName = (userDocData?.nombre || auth?.currentUser?.displayName || '').trim();
        if (targetName && targetName.length > 3) {
            try {
                const normTarget = targetName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                const snapAll = await getDocs(pacientesCol);
                for (const d of snapAll.docs) {
                    const dData = d.data();
                    const dNorm = (dData.nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                    if (dNorm && (dNorm === normTarget || dNorm.includes(normTarget) || normTarget.includes(dNorm))) {
                        try {
                            await updateDoc(doc(db, COLLECTION_NAME, d.id), { uid, updatedAt: new Date().toISOString() });
                            await setDoc(doc(db, 'usuarios', uid), { pacienteId: d.id }, { merge: true });
                        } catch(_) {}
                        return { ...dData, uid, id: d.id };
                    }
                }
            } catch (_) {}
        }

        // 7. Si definitivamente no existía en pacientes, inicializar su registro base
        const defaultNombre = userDocData?.nombre || auth?.currentUser?.displayName || (targetEmail ? targetEmail.split('@')[0] : 'Paciente');
        const defaultTel = cleanPhone || '';
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
                await setDoc(doc(db, 'usuarios', uid), { pacienteId: newDocRef.id, telefono: defaultTel }, { merge: true });
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
            console.error("Error creando nuevo paciente base:", createErr);
            return null;
        }
    } catch (error) {
        console.error("Error en getPacienteByUid:", error);
        return null;
    }
};

/**
 * Normaliza cadenas para comparaciones ultra-tolerantes (sin acentos, minúsculas, espacios colapsados)
 */
export const stripAccents = (str = '') => {
    return String(str || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();
};

export const cleanPhone = (str = '') => {
    return String(str || '').replace(/\D/g, '');
};

export const normalizeForMatch = (str = '') => {
    return stripAccents(str).toLowerCase().replace(/\s+/g, ' ').trim();
};

/**
 * Comprueba si un registro pertenece a un paciente determinado:
 * - Coincidencia directa de ID (pacienteId, id, uid)
 * - Coincidencia por tel?fono (?ltimos 10 d?gitos)
 * - Coincidencia exacta o parcial de nombres (insensible a may?sculas, min?sculas y acentos)
 */
export const isSamePerson = ({
    targetId,
    targetPhone,
    targetNames = [],
    docId,
    docPhone,
    docName,
}) => {
    // 1. Coincidencia por ID de paciente
    if (targetId && docId && String(targetId) === String(docId)) return true;

    // 2. Coincidencia por tel?fono (si ambos tienen al menos 7 d?gitos v?lidos)
    const tClean = cleanPhone(targetPhone);
    const dClean = cleanPhone(docPhone);
    if (tClean && dClean && tClean.length >= 7 && dClean.length >= 7) {
        const t10 = tClean.slice(-10);
        const d10 = dClean.slice(-10);
        if (t10 === d10) return true;
    }

    // 3. Coincidencia por nombre normalizado
    const dNorm = normalizeForMatch(docName);
    if (!dNorm) return false;

    for (const t of targetNames) {
        const tNorm = normalizeForMatch(t);
        if (!tNorm) continue;
        if (tNorm === dNorm) return true;
        // Si uno contiene al otro y tiene longitud razonable (evitar falsos positivos con nombres cortos)
        if (tNorm.length >= 6 && dNorm.length >= 6) {
            if (tNorm.includes(dNorm) || dNorm.includes(tNorm)) return true;
        }
    }

    return false;
};

/**
 * Ejecuta actualizaciones en paralelo seguro sin transacciones todo-o-nada:
 * Si un documento falla (por ejemplo por permisos o reglas en usuarios),
 * NO revierte los dem?s. Planes, recibos, citas y tratamientos se guardan 100%.
 */
async function executeSafeUpdates(updates = []) {
    if (!updates || updates.length === 0) return 0;
    let successCount = 0;
    const CHUNK_SIZE = 25;

    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE);
        await Promise.allSettled(chunk.map(async ({ ref, data, colName }) => {
            try {
                await updateDoc(ref, data);
                successCount++;
            } catch (err) {
                console.warn(`[CASCADA PACIENTE] Advertencia al actualizar en "${colName}" (${ref.id}):`, err.message);
            }
        }));
    }
    return successCount;
}

/**
 * Sincroniza en cascada el nuevo nombre (y opcionalmente tel?fono/email)
 * de un paciente en todas las colecciones vinculadas de Firestore:
 * - planes (Paquetes de tratamientos y financiamientos)
 * - recibos (Recibos de caja y abonos)
 * - finanzas (Movimientos contables de caja)
 * - citas (Agenda y calendario)
 * - tratamientos (Expediente cl?nico)
 * - sesiones (Sesiones cl?nicas, fotos y medidas)
 * - seguimiento_post_consulta
 * - alertas_pacientes
 * - consumos_membresia y recargas_membresia
 * - usuarios (cuenta de acceso a la app m?vil del paciente)
 */
export const sincronizarNombrePacienteEnCascada = async (pacienteId, nuevoNombre, nombreAnterior = null, extraData = {}) => {
    if (!pacienteId || !nuevoNombre) return { totalActualizados: 0 };

    const normNuevo = String(nuevoNombre).trim();
    const normAnterior = nombreAnterior ? String(nombreAnterior).trim() : null;
    const targetNames = [normNuevo, normAnterior, extraData.nombreOriginal].filter(Boolean);
    const targetPhone = extraData.telefono || null;
    const targetEmail = extraData.email ? String(extraData.email).trim().toLowerCase() : null;

    const updates = [];
    const seenRefs = new Set();

    const queueUpdate = (docRef, data, colName) => {
        if (!docRef || !docRef.path) return;
        if (!seenRefs.has(docRef.path)) {
            seenRefs.add(docRef.path);
            updates.push({ ref: docRef, data, colName });
        }
    };

    try {
        // Ejecuci?n en paralelo de la lectura de todas las colecciones vinculadas
        const [
            planesSnap,
            recibosSnap,
            finanzasSnap,
            citasSnap,
            tratamientosSnap,
            sesionesSnap,
            seguimientoSnap,
            alertasSnap,
            consumosSnap,
            recargasSnap
        ] = await Promise.all([
            getDocs(collection(db, 'planes')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'recibos')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'finanzas')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'citas')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'tratamientos')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'sesiones')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'seguimiento_post_consulta')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'alertas_pacientes')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'consumos_membresia')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'recargas_membresia')).catch(() => ({ docs: [] }))
        ]);

        // 1. PLANES (Paquetes de tratamientos / financiamientos)
        planesSnap.docs?.forEach(d => {
            const data = d.data();
            const matches = isSamePerson({
                targetId: pacienteId,
                targetPhone,
                targetNames,
                docId: data.pacienteId,
                docPhone: data.telefono,
                docName: data.paciente || data.pacienteNombre
            });
            if (matches) {
                const needsUpdate = data.paciente !== normNuevo ||
                                    data.pacienteNombre !== normNuevo ||
                                    data.pacienteId !== pacienteId ||
                                    (targetPhone && data.telefono !== targetPhone);
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        paciente: normNuevo,
                        pacienteNombre: normNuevo,
                        pacienteId: pacienteId,
                        ...(targetPhone ? { telefono: targetPhone } : {}),
                        updatedAt: new Date().toISOString()
                    }, 'planes');
                }
            }
        });

        // 2. RECIBOS DE CAJA
        recibosSnap.docs?.forEach(d => {
            const data = d.data();
            const matches = isSamePerson({
                targetId: pacienteId,
                targetPhone,
                targetNames,
                docId: data.pacienteId,
                docPhone: data.telefono,
                docName: data.pacienteNombre || data.paciente
            });
            if (matches) {
                const needsUpdate = data.pacienteNombre !== normNuevo ||
                                    data.paciente !== normNuevo ||
                                    data.pacienteId !== pacienteId ||
                                    (targetPhone && data.telefono !== targetPhone);
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        pacienteNombre: normNuevo,
                        paciente: normNuevo,
                        pacienteId: pacienteId,
                        ...(targetPhone ? { telefono: targetPhone } : {}),
                        updatedAt: new Date().toISOString()
                    }, 'recibos');
                }
            }
        });

        // 3. FINANZAS (Movimientos contables de caja / abonos a tratamientos)
        finanzasSnap.docs?.forEach(d => {
            const data = d.data();
            const matches = isSamePerson({
                targetId: pacienteId,
                targetPhone,
                targetNames,
                docId: data.pacienteId,
                docPhone: data.telefono,
                docName: data.pacienteNombre || data.paciente
            });
            if (matches) {
                const needsUpdate = data.pacienteNombre !== normNuevo ||
                                    data.paciente !== normNuevo ||
                                    data.pacienteId !== pacienteId;
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        pacienteNombre: normNuevo,
                        paciente: normNuevo,
                        pacienteId: pacienteId,
                        updatedAt: new Date().toISOString()
                    }, 'finanzas');
                }
            }
        });

        // 4. CITAS
        citasSnap.docs?.forEach(d => {
            const data = d.data();
            const matches = isSamePerson({
                targetId: pacienteId,
                targetPhone,
                targetNames,
                docId: data.pacienteId,
                docPhone: data.telefono,
                docName: data.paciente || data.pacienteNombre
            });
            if (matches) {
                const needsUpdate = data.paciente !== normNuevo ||
                                    data.pacienteNombre !== normNuevo ||
                                    data.pacienteId !== pacienteId ||
                                    (targetPhone && data.telefono !== targetPhone) ||
                                    (targetEmail && data.pacienteEmail !== targetEmail);
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        paciente: normNuevo,
                        pacienteNombre: normNuevo,
                        pacienteId: pacienteId,
                        ...(targetPhone ? { telefono: targetPhone } : {}),
                        ...(targetEmail ? { pacienteEmail: targetEmail } : {}),
                        updatedAt: new Date().toISOString()
                    }, 'citas');
                }
            }
        });

        // 5. TRATAMIENTOS
        tratamientosSnap.docs?.forEach(d => {
            const data = d.data();
            const matches = isSamePerson({
                targetId: pacienteId,
                targetPhone,
                targetNames,
                docId: data.pacienteId,
                docPhone: data.telefono,
                docName: data.pacienteNombre || data.paciente
            });
            if (matches) {
                const needsUpdate = data.pacienteNombre !== normNuevo ||
                                    data.paciente !== normNuevo ||
                                    data.pacienteId !== pacienteId;
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        pacienteNombre: normNuevo,
                        paciente: normNuevo,
                        pacienteId: pacienteId,
                        updatedAt: new Date().toISOString()
                    }, 'tratamientos');
                }
            }
        });

        // 6. SESIONES
        sesionesSnap.docs?.forEach(d => {
            const data = d.data();
            const matches = isSamePerson({
                targetId: pacienteId,
                targetPhone,
                targetNames,
                docId: data.pacienteId,
                docPhone: data.telefono,
                docName: data.pacienteNombre || data.paciente
            });
            if (matches) {
                const needsUpdate = data.pacienteNombre !== normNuevo ||
                                    data.paciente !== normNuevo ||
                                    data.pacienteId !== pacienteId;
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        pacienteNombre: normNuevo,
                        paciente: normNuevo,
                        pacienteId: pacienteId,
                        updatedAt: new Date().toISOString()
                    }, 'sesiones');
                }
            }
        });

        // 7. SEGUIMIENTO POST CONSULTA
        seguimientoSnap.docs?.forEach(d => {
            const data = d.data();
            const matches = isSamePerson({
                targetId: pacienteId,
                targetPhone,
                targetNames,
                docId: data.pacienteId,
                docPhone: data.pacienteTelefono,
                docName: data.pacienteNombre
            });
            if (matches) {
                const needsUpdate = data.pacienteNombre !== normNuevo ||
                                    data.pacienteId !== pacienteId ||
                                    (targetPhone && data.pacienteTelefono !== targetPhone);
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        pacienteNombre: normNuevo,
                        pacienteId: pacienteId,
                        ...(targetPhone ? { pacienteTelefono: targetPhone } : {}),
                        updatedAt: new Date().toISOString()
                    }, 'seguimiento_post_consulta');
                }
            }
        });

        // 8. ALERTAS PACIENTES
        alertasSnap.docs?.forEach(d => {
            const data = d.data();
            const matches = isSamePerson({
                targetId: pacienteId,
                targetPhone,
                targetNames,
                docId: data.pacienteId,
                docPhone: data.telefono,
                docName: data.pacienteNombre || data.paciente
            });
            if (matches) {
                const needsUpdate = data.pacienteNombre !== normNuevo ||
                                    data.paciente !== normNuevo ||
                                    data.pacienteId !== pacienteId;
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        pacienteNombre: normNuevo,
                        paciente: normNuevo,
                        pacienteId: pacienteId,
                        updatedAt: new Date().toISOString()
                    }, 'alertas_pacientes');
                }
            }
        });

        // 9. CONSUMOS Y RECARGAS MEMBRES?A
        [consumosSnap, recargasSnap].forEach(snap => {
            snap.docs?.forEach(d => {
                const data = d.data();
                const matches = isSamePerson({
                    targetId: pacienteId,
                    targetPhone,
                    targetNames,
                    docId: data.pacienteId,
                    docPhone: null,
                    docName: data.pacienteNombre
                });
                if (matches && (data.pacienteNombre !== normNuevo || data.pacienteId !== pacienteId)) {
                    queueUpdate(d.ref, {
                        pacienteNombre: normNuevo,
                        pacienteId: pacienteId,
                        updatedAt: new Date().toISOString()
                    }, d.ref.parent.id);
                }
            });
        });

        // 10. USUARIOS (Aislado para que permisos de Auth no bloqueen colecciones maestras)
        try {
            const usrSnap = await getDocs(collection(db, 'usuarios'));
            usrSnap.docs?.forEach(d => {
                const data = d.data();
                const matches = (data.pacienteId && String(data.pacienteId) === String(pacienteId)) ||
                                (targetEmail && data.email && String(data.email).trim().toLowerCase() === targetEmail);
                if (matches && (data.nombre !== normNuevo || data.pacienteId !== pacienteId)) {
                    queueUpdate(d.ref, {
                        nombre: normNuevo,
                        pacienteId: pacienteId,
                        ...(targetPhone && !data.telefono ? { telefono: targetPhone } : {}),
                        updatedAt: new Date().toISOString()
                    }, 'usuarios');
                }
            });
        } catch (uErr) {
            console.warn('[CASCADA PACIENTE] Aviso en coleccion usuarios:', uErr);
        }

        const totalActualizados = await executeSafeUpdates(updates);
        console.log(`[CASCADA PACIENTE] ?xito: ${totalActualizados} registros sincronizados en cascada para "${normNuevo}" (${pacienteId})`);
        return { totalActualizados, totalEncolados: updates.length };
    } catch (error) {
        console.error("Error en sincronizarNombrePacienteEnCascada:", error);
        throw error;
    }
};

/**
 * Herramienta de auto-reparaci?n general para la base de datos:
 * Recorre todos los pacientes y sincroniza/normaliza citas, planes, tratamientos,
 * sesiones, recibos y usuarios que tengan nombres antiguos o pacienteId hu?rfano.
 */
export const sincronizarTodosLosPacientes = async () => {
    try {
        const pacSnap = await getDocs(pacientesCol);
        const pacientes = pacSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const updates = [];
        const seenRefs = new Set();

        const queueUpdate = (docRef, data, colName) => {
            if (!docRef || !docRef.path) return;
            if (!seenRefs.has(docRef.path)) {
                seenRefs.add(docRef.path);
                updates.push({ ref: docRef, data, colName });
            }
        };

        const [
            planesSnap,
            recibosSnap,
            finanzasSnap,
            citasSnap,
            tratamientosSnap,
            sesionesSnap,
            usuariosSnap
        ] = await Promise.all([
            getDocs(collection(db, 'planes')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'recibos')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'finanzas')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'citas')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'tratamientos')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'sesiones')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'usuarios')).catch(() => ({ docs: [] }))
        ]);

        const findPac = (docId, docPhone, docName, docEmail = null) => {
            // 1. Por ID directo
            if (docId) {
                const found = pacientes.find(p => p.id === docId);
                if (found) return found;
            }
            // 2. Por tel?fono
            const dClean = cleanPhone(docPhone);
            if (dClean && dClean.length >= 7) {
                const found = pacientes.find(p => {
                    const pClean = cleanPhone(p.telefono);
                    return pClean && pClean.slice(-10) === dClean.slice(-10);
                });
                if (found) return found;
            }
            // 3. Por email
            if (docEmail) {
                const cleanEm = String(docEmail).trim().toLowerCase();
                const found = pacientes.find(p => (p.email || '').trim().toLowerCase() === cleanEm);
                if (found) return found;
            }
            // 4. Por nombre normalizado
            const dNorm = normalizeForMatch(docName);
            if (dNorm && dNorm.length >= 3) {
                const found = pacientes.find(p => {
                    const pNorm = normalizeForMatch(p.nombre);
                    return pNorm === dNorm || (pNorm.length >= 6 && (pNorm.includes(dNorm) || dNorm.includes(pNorm)));
                });
                if (found) return found;
            }
            return null;
        };

        // 1. Planes
        planesSnap.docs?.forEach(d => {
            const data = d.data();
            const p = findPac(data.pacienteId, data.telefono, data.paciente || data.pacienteNombre);
            if (p) {
                const needsUpdate = data.paciente !== p.nombre ||
                                    data.pacienteNombre !== p.nombre ||
                                    data.pacienteId !== p.id ||
                                    (p.telefono && !data.telefono);
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        paciente: p.nombre,
                        pacienteNombre: p.nombre,
                        pacienteId: p.id,
                        ...(p.telefono && !data.telefono ? { telefono: p.telefono } : {}),
                        updatedAt: new Date().toISOString()
                    }, 'planes');
                }
            }
        });

        // 2. Recibos
        recibosSnap.docs?.forEach(d => {
            const data = d.data();
            const p = findPac(data.pacienteId, data.telefono, data.pacienteNombre || data.paciente);
            if (p) {
                const needsUpdate = data.pacienteNombre !== p.nombre ||
                                    data.paciente !== p.nombre ||
                                    data.pacienteId !== p.id ||
                                    (p.telefono && !data.telefono);
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        pacienteNombre: p.nombre,
                        paciente: p.nombre,
                        pacienteId: p.id,
                        ...(p.telefono && !data.telefono ? { telefono: p.telefono } : {}),
                        updatedAt: new Date().toISOString()
                    }, 'recibos');
                }
            }
        });

        // 3. Finanzas
        finanzasSnap.docs?.forEach(d => {
            const data = d.data();
            const p = findPac(data.pacienteId, data.telefono, data.pacienteNombre || data.paciente);
            if (p) {
                const needsUpdate = data.pacienteNombre !== p.nombre ||
                                    data.paciente !== p.nombre ||
                                    data.pacienteId !== p.id;
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        pacienteNombre: p.nombre,
                        paciente: p.nombre,
                        pacienteId: p.id,
                        updatedAt: new Date().toISOString()
                    }, 'finanzas');
                }
            }
        });

        // 4. Citas
        citasSnap.docs?.forEach(d => {
            const data = d.data();
            const p = findPac(data.pacienteId, data.telefono, data.paciente || data.pacienteNombre, data.pacienteEmail);
            if (p) {
                const needsUpdate = data.paciente !== p.nombre ||
                                    data.pacienteNombre !== p.nombre ||
                                    data.pacienteId !== p.id ||
                                    (p.telefono && !data.telefono);
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        paciente: p.nombre,
                        pacienteNombre: p.nombre,
                        pacienteId: p.id,
                        ...(p.telefono && !data.telefono ? { telefono: p.telefono } : {}),
                        updatedAt: new Date().toISOString()
                    }, 'citas');
                }
            }
        });

        // 5. Tratamientos
        tratamientosSnap.docs?.forEach(d => {
            const data = d.data();
            const p = findPac(data.pacienteId, data.telefono, data.pacienteNombre || data.paciente);
            if (p) {
                const needsUpdate = data.pacienteNombre !== p.nombre ||
                                    data.paciente !== p.nombre ||
                                    data.pacienteId !== p.id;
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        pacienteNombre: p.nombre,
                        paciente: p.nombre,
                        pacienteId: p.id,
                        updatedAt: new Date().toISOString()
                    }, 'tratamientos');
                }
            }
        });

        // 6. Sesiones
        sesionesSnap.docs?.forEach(d => {
            const data = d.data();
            const p = findPac(data.pacienteId, data.telefono, data.pacienteNombre || data.paciente);
            if (p) {
                const needsUpdate = data.pacienteNombre !== p.nombre ||
                                    data.paciente !== p.nombre ||
                                    data.pacienteId !== p.id;
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        pacienteNombre: p.nombre,
                        paciente: p.nombre,
                        pacienteId: p.id,
                        updatedAt: new Date().toISOString()
                    }, 'sesiones');
                }
            }
        });

        // 7. Usuarios
        usuariosSnap.docs?.forEach(d => {
            const data = d.data();
            const p = findPac(data.pacienteId, data.telefono, data.nombre, data.email);
            if (p && (data.role === 'Paciente' || !data.role)) {
                const needsUpdate = data.nombre !== p.nombre || data.pacienteId !== p.id;
                if (needsUpdate) {
                    queueUpdate(d.ref, {
                        nombre: p.nombre,
                        pacienteId: p.id,
                        ...(p.telefono && !data.telefono ? { telefono: p.telefono } : {}),
                        updatedAt: new Date().toISOString()
                    }, 'usuarios');
                }
            }
        });

        const totalActualizados = await executeSafeUpdates(updates);
        console.log(`[SINCRONIZAR TODOS] Se revisaron ${pacientes.length} pacientes. Total registros actualizados: ${totalActualizados}`);
        return {
            totalPacientes: pacientes.length,
            totalActualizados
        };
    } catch (error) {
        console.error("Error en sincronizarTodosLosPacientes:", error);
        throw error;
    }
};

// Actualizar paciente con sincronizaci?n en cascada a todos sus registros vinculados
export const updatePaciente = async (id, data, nombreAnterior = null) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);

        let prevNombre = nombreAnterior;
        let prevTelefono = null;
        try {
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const d = snap.data();
                if (!prevNombre) prevNombre = d.nombre || null;
                prevTelefono = d.telefono || null;
            }
        } catch (e) {
            console.warn('Aviso al obtener datos previos de paciente:', e);
        }

        await updateDoc(docRef, {
            ...data,
            updatedAt: new Date().toISOString()
        });

        let syncResult = { totalActualizados: 0 };
        const normNuevo = data.nombre ? String(data.nombre).trim() : null;
        const normPrev = prevNombre ? String(prevNombre).trim() : null;

        if (normNuevo) {
            try {
                syncResult = await sincronizarNombrePacienteEnCascada(id, normNuevo, normPrev, {
                    telefono: data.telefono || prevTelefono,
                    email: data.email,
                    nombreOriginal: prevNombre
                });
            } catch (cascadaErr) {
                console.error("Error en sincronizaci?n en cascada al actualizar paciente:", cascadaErr);
            }
        }

        return {
            ok: true,
            totalActualizados: syncResult.totalActualizados || 0
        };
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
        const pacPart = String(pacienteId).replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '7024';
        const randPart = Math.floor(1000 + Math.random() * 9000);
        const codigo = `MEM-${pacPart}-${randPart}`;
        await updateDoc(docRef, {
            membresia: {
                id: codigo,
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

/**
 * Sincroniza la colección pública segura 'directorio_pacientes'
 * Permite que pacientes en login resuelvan su teléfono de forma instantánea sin requerir login previo
 */
export const sincronizarDirectorioTelefonos = async (pacientes = []) => {
    try {
        if (!pacientes || pacientes.length === 0) return;
        const BATCH_LIMIT = 450;
        let batch = writeBatch(db);
        let count = 0;

        for (const p of pacientes) {
            const rawTel = p.telefono || p.celular || '';
            const clean = String(rawTel).replace(/\D/g, '');
            if (clean && clean.length >= 7) {
                const ref = doc(db, 'directorio_pacientes', clean);
                batch.set(ref, {
                    telefono: clean,
                    nombre: p.nombre || '',
                    email: p.email || p.correo || '',
                    pacienteId: p.id,
                    tienePassword: Boolean(p.uid),
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                count++;
                if (count >= BATCH_LIMIT) {
                    await batch.commit();
                    batch = writeBatch(db);
                    count = 0;
                }
            }
        }
        if (count > 0) {
            await batch.commit();
            console.log(`[Directorio] Sincronizados ${count} pacientes en directorio_pacientes`);
        }
    } catch (err) {
        console.warn('Error sincronizando directorio_pacientes:', err);
    }
};
