import { collection, addDoc, updateDoc, doc, getDocs, getDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const COLLECTION_NAME = 'citas';
const citasCol = collection(db, COLLECTION_NAME);

// Normalizar texto para comparaciones tolerantes a acentos y mayúsculas
const normStr = (str) =>
    String(str || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

// Asegura que toda cita tenga fechaHora ISO válida incluso si fue creada solo con fecha + hora
export const normalizeCitaDoc = (rawDoc) => {
    const data = typeof rawDoc.data === 'function' ? { id: rawDoc.id, ...rawDoc.data() } : { ...rawDoc };
    if (!data.fechaHora && data.fecha) {
        const horaStr = data.hora && /^\d{2}:\d{2}/.test(data.hora) ? data.hora : '09:00';
        data.fechaHora = `${data.fecha}T${horaStr}:00`;
    }
    return data;
};

const sortCitasAsc = (list) =>
    [...list].sort((a, b) => {
        const tA = new Date(a.fechaHora || a.fecha || 0).getTime() || 0;
        const tB = new Date(b.fechaHora || b.fecha || 0).getTime() || 0;
        return tA - tB;
    });

export const CABINAS_ALFRA = [
    { id: 'cabina_1', nombre: 'Cabina 1 (Facial)', color: 'rose' },
    { id: 'cabina_2', nombre: 'Cabina 2 (Corporal)', color: 'teal' },
    { id: 'cabina_3', nombre: 'Cabina 3 (Láser y Aparatología)', color: 'purple' },
    { id: 'consultorio_medico', nombre: 'Consultorio Médico', color: 'blue' }
];

export const isStaffClinico = (s) => {
    if (!s) return false;
    if (s.eliminado === true || s.activo === false) return false;
    const est = String(s.estatus || s.estado || 'Activo').toLowerCase().trim();
    if (est === 'baja' || est === 'eliminado' || est === 'inactivo') return false;
    const p = String(s.puesto || '').toLowerCase().trim();
    const r = String(s.rol || s.role || '').toLowerCase().trim();
    
    // Excluir personal que NO atiende pacientes
    if ((p.includes('recep') || r.includes('recep')) && !p.includes('especialista') && !r.includes('especialista')) return false;
    if (p.includes('limpieza') || r.includes('limpieza') || p.includes('intendencia')) return false;

    // Aceptar cualquier personal con rol clínico
    if (
        p.includes('especialista') ||
        p.includes('cosmet') ||
        p.includes('cosmiat') ||
        p.includes('doctor') ||
        p.includes('dra') ||
        p.includes('dr.') ||
        p.includes('medic') ||
        p.includes('médic') ||
        p.includes('nutri') ||
        p.includes('cabina') ||
        p.includes('terapeuta') ||
        p.includes('enferm') ||
        r.includes('doctor') ||
        r.includes('especialista') ||
        r.includes('médic') ||
        r.includes('medic')
    ) {
        return true;
    }

    return !p.includes('admin') && !r.includes('admin') && !p.includes('recep') && !r.includes('recep');
};

export const normalizeCabinaKey = (cab) => {
    if (!cab) return '';
    const s = String(cab).toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (s.includes('1') || s.includes('facial')) return 'cabina_1';
    if (s.includes('2') || s.includes('corporal')) return 'cabina_2';
    if (s.includes('3') || s.includes('laser') || s.includes('aparat')) return 'cabina_3';
    if (s.includes('consultorio') || s.includes('medico')) return 'consultorio_medico';
    return s;
};

export const checkConflictoCabina = (citas = [], { cabina, fechaYMD, hora, duracionMin = 60, ignoreCitaId = null }) => {
    if (!cabina || !fechaYMD || !hora) return null;
    const targetCabKey = normalizeCabinaKey(cabina);
    if (!targetCabKey) return null;

    const durMin = Number(duracionMin || 60);
    let startM = 0;
    const match12Target = String(hora).match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (match12Target) {
        let th = parseInt(match12Target[1], 10);
        const tm = parseInt(match12Target[2], 10);
        const isPM = (match12Target[3] || '').toLowerCase() === 'pm';
        const isAM = (match12Target[3] || '').toLowerCase() === 'am';
        if (isPM && th < 12) th += 12;
        if (isAM && th === 12) th = 0;
        startM = th * 60 + tm;
    } else {
        const [h, m] = hora.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        startM = h * 60 + m;
    }
    const endM = startM + durMin;

    const statusIgnorados = [
        'cancelada', 'cancelado', 'no asistio', 'no asistió', 'no_asistio',
        'reagendada', 'reagendado', 'eliminada', 'eliminado', 'baja'
    ];

    const targetIdClean = ignoreCitaId ? String(ignoreCitaId).trim() : null;

    return citas.find(c => {
        // Ignorar la misma cita siendo reagendada / editada
        if (targetIdClean) {
            const cId = String(c.id || c.citaId || c._id || '').trim();
            if (cId && cId === targetIdClean) return false;
        }
        
        const cStatus = String(c.status || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (statusIgnorados.some(s => cStatus.includes(s))) return false;

        const cFecha = c.fechaYMD || (c.fecha || (c.fechaHora ? String(c.fechaHora).split('T')[0] : ''));
        if (cFecha !== fechaYMD) return false;

        const cCabKey = normalizeCabinaKey(c.cabina);
        if (!cCabKey || cCabKey !== targetCabKey) return false;

        let horaRaw = c.hora;
        if (!horaRaw && c.fechaHora) {
            const parts = String(c.fechaHora).split(/[T\s]/);
            if (parts.length > 1) horaRaw = parts[1].slice(0, 5);
        }
        if (!horaRaw) horaRaw = '09:00';

        let cH = 0, cM = 0;
        const match12 = String(horaRaw).match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
        if (match12) {
            cH = parseInt(match12[1], 10);
            cM = parseInt(match12[2], 10);
            const isPM = (match12[3] || '').toLowerCase() === 'pm';
            const isAM = (match12[3] || '').toLowerCase() === 'am';
            if (isPM && cH < 12) cH += 12;
            if (isAM && cH === 12) cH = 0;
        } else {
            const parts = horaRaw.split(':').map(Number);
            if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                cH = parts[0];
                cM = parts[1];
            } else {
                return false;
            }
        }

        const cStart = cH * 60 + cM;
        const cEnd = cStart + Number(c.duracionMin || c.duracionMinutos || 60);

        return (startM < cEnd && endM > cStart);
    }) || null;
};

// Evalúa si una cita pertenece a un especialista (por ID de documento staff, Auth UID, email o nombre)
export const citaMatchesEspecialista = (cita, identifiers) => {
    if (!cita || !identifiers) return false;

    const idSet = new Set();
    const nameSet = new Set();
    const emailSet = new Set();

    if (typeof identifiers === 'string') {
        if (identifiers.trim()) idSet.add(identifiers.trim());
    } else if (Array.isArray(identifiers)) {
        identifiers.forEach(v => { if (v) idSet.add(String(v).trim()); });
    } else if (typeof identifiers === 'object') {
        if (identifiers.staffId) idSet.add(String(identifiers.staffId).trim());
        if (identifiers.id) idSet.add(String(identifiers.id).trim());
        if (identifiers.uid) idSet.add(String(identifiers.uid).trim());
        if (Array.isArray(identifiers.ids)) {
            identifiers.ids.forEach(v => { if (v) idSet.add(String(v).trim()); });
        }
        if (identifiers.nombre) {
            const n = normStr(identifiers.nombre);
            if (n) nameSet.add(n);
        }
        if (identifiers.displayName) {
            const n = normStr(identifiers.displayName);
            if (n) nameSet.add(n);
        }
        if (identifiers.email) {
            const e = String(identifiers.email).trim().toLowerCase();
            if (e) emailSet.add(e);
        }
    }

    // 1. Coincidencia por ID o UID
    const citaEspId = String(cita.especialistaId || '').trim();
    const citaEspUid = String(cita.especialistaUid || '').trim();
    if (citaEspId && idSet.has(citaEspId)) return true;
    if (citaEspUid && idSet.has(citaEspUid)) return true;

    // 2. Coincidencia por Email
    const citaEmail = String(cita.especialistaEmail || '').trim().toLowerCase();
    if (citaEmail && emailSet.has(citaEmail)) return true;

    // 3. Coincidencia por Nombre de Especialista
    const citaEspNombre = normStr(cita.especialistaNombre || cita.especialista || '');
    if (citaEspNombre && nameSet.size > 0) {
        for (const targetName of nameSet) {
            if (citaEspNombre === targetName) return true;
            if (citaEspNombre.length >= 4 && targetName.length >= 4) {
                if (citaEspNombre.includes(targetName) || targetName.includes(citaEspNombre)) {
                    return true;
                }
            }
        }
    }

    return false;
};

// Status allowed: 'Pendiente', 'Confirmada', 'En Cabina', 'Completada', 'Cancelada'

export const createCita = async (data) => {
    try {
        const fechaHora = data.fechaHora || (data.fecha ? `${data.fecha}T${data.hora || '09:00'}:00` : new Date().toISOString());
        const fechaExtraida = data.fecha || data.fechaYMD || (String(fechaHora).includes('T') ? String(fechaHora).split('T')[0] : '');
        const horaExtraida = data.hora || (String(fechaHora).includes('T') ? String(fechaHora).split('T')[1].slice(0, 5) : '09:00');
        const docRef = await addDoc(citasCol, {
            ...data,
            fecha: fechaExtraida,
            fechaYMD: fechaExtraida,
            hora: horaExtraida,
            fechaHora,
            status: data.status || 'Pendiente',
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
        const querySnapshot = await getDocs(citasCol);
        return sortCitasAsc(querySnapshot.docs.map(normalizeCitaDoc));
    } catch (error) {
        console.error("Error fetching citas:", error);
        return [];
    }
};

// Citas de un paciente específico
export const getCitasByPaciente = async (pacienteId) => {
    try {
        const q = query(citasCol, where('pacienteId', '==', pacienteId));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(normalizeCitaDoc)
            .sort((a, b) => new Date(b.fechaHora || 0) - new Date(a.fechaHora || 0));
    } catch (error) {
        console.error("Error fetching citas by paciente:", error);
        return [];
    }
};

// Citas de un especialista específico
export const getCitasByEspecialista = async (identifiers) => {
    try {
        const snapshot = await getDocs(citasCol);
        const all = sortCitasAsc(snapshot.docs.map(normalizeCitaDoc));
        return all.filter(c => citaMatchesEspecialista(c, identifiers));
    } catch (error) {
        console.error("Error fetching citas by especialista:", error);
        return [];
    }
};

// Escuchar en tiempo real TODAS las citas (para Recepcionista/Admin)
export const onCitasChange = (callback) => {
    return onSnapshot(citasCol, (snapshot) => {
        const citas = sortCitasAsc(snapshot.docs.map(normalizeCitaDoc));
        callback(citas);
    }, (error) => {
        console.error('Error in citas listener:', error);
        callback([]);
    });
};

// Escuchar citas de un especialista en tiempo real (soporta ID, UID, Nombre y Email)
export const onCitasEspecialistaChange = (identifiers, callback) => {
    return onSnapshot(citasCol, (snapshot) => {
        const allCitas = sortCitasAsc(snapshot.docs.map(normalizeCitaDoc));
        const filtered = allCitas.filter(c => citaMatchesEspecialista(c, identifiers));
        callback(filtered, allCitas);
    }, (error) => {
        console.error('Error in citas especialista listener:', error);
        callback([], []);
    });
};

// Descartar alertas pendientes vinculadas a una cita que ya fue atendida o completada
export const descartarAlertasPorCita = async (citaId) => {
    if (!citaId) return;
    try {
        const alertsCol = collection(db, 'alertas_pacientes');
        const q = query(alertsCol, where('citaId', '==', citaId), where('estado', '==', 'pendiente'));
        const snap = await getDocs(q);
        const updates = snap.docs.map(d => updateDoc(d.ref, { estado: 'completado', completadoAt: serverTimestamp() }));
        await Promise.all(updates);
    } catch (e) {
        console.warn('Error al descartar alertas por cita:', e);
    }
};

// Actualizar status o datos de la cita
export const updateCitaStatus = async (id, newStatus, extraData = {}) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            status: newStatus,
            ...extraData,
            updatedAt: new Date().toISOString()
        });

        // Si la cita ya paso de sala de espera (en consulta, completada, cancelada), auto-descartar alertas asociadas
        if (['En Consulta', 'Completada', 'Cancelada', 'No Asistio'].includes(newStatus)) {
            descartarAlertasPorCita(id).catch(() => {});
        }
    } catch (error) {
        console.error("Error updating cita status:", error);
        throw error;
    }
};

// Tiempo maximo de vida de una alerta en pantalla (24 horas) para evitar acumulacion eterna
const MAX_VIDA_ALERTA_MS = 24 * 60 * 60 * 1000;

// Escuchar alertas de llegada de pacientes para especialistas (soporta multiples IDs)
export const onAlertasEspecialistaChange = (identifiers, callback) => {
    const alertsCol = collection(db, 'alertas_pacientes');
    const q = query(alertsCol, where('estado', '==', 'pendiente'));

    return onSnapshot(q, (snapshot) => {
        const ahora = Date.now();
        const alerts = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(a => {
                // Descartar alertas con mas de 24 horas para que no se queden por la eternidad
                const fecha = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                if (fecha.getTime() > 0 && (ahora - fecha.getTime()) > MAX_VIDA_ALERTA_MS) {
                    return false;
                }
                return citaMatchesEspecialista(a, identifiers);
            })
            .sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return dateB - dateA;
            });
        callback(alerts);
    }, (error) => {
        console.error('Error in alerts listener:', error);
        callback([]);
    });
};

export const markAlertAsRead = async (alertId) => {
    try {
        const docRef = doc(db, 'alertas_pacientes', alertId);
        await updateDoc(docRef, { estado: 'leido' });
    } catch (error) {
        console.error("Error marking alert as read:", error);
    }
};

// ===================== ALERTAS PARA ADMIN Y RECEPCION =====================
export const onAlertasAdminChange = (callback) => {
    const alertsCol = collection(db, 'alertas_pacientes');
    const q = query(alertsCol, where('estado', '==', 'pendiente'));
    return onSnapshot(q, (snapshot) => {
        const ahora = Date.now();
        const alerts = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(a => {
                const fecha = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                if (fecha.getTime() > 0 && (ahora - fecha.getTime()) > MAX_VIDA_ALERTA_MS) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return dateB - dateA;
            });
        callback(alerts);
    }, (error) => {
        console.error('Error in admin alerts listener:', error);
        callback([]);
    });
};

// ===================== ALERTAS PARA PACIENTE =====================
export const onAlertasPacienteChange = (pacienteId, callback) => {
    const alertsCol = collection(db, 'alertas_pacientes');
    const q = query(alertsCol, where('pacienteId', '==', pacienteId), where('estado', '==', 'pendiente'));
    return onSnapshot(q, (snapshot) => {
        const ahora = Date.now();
        const alerts = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(a => {
                const fecha = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                if (fecha.getTime() > 0 && (ahora - fecha.getTime()) > MAX_VIDA_ALERTA_MS) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return dateB - dateA;
            });
        callback(alerts);
    }, (error) => {
        console.error('Error in paciente alerts listener:', error);
        callback([]);
    });
};

// Crear alerta para un paciente o recepción
export const crearAlertaPaciente = async (pacienteId, mensaje, extra = {}) => {
    try {
        await addDoc(collection(db, 'alertas_pacientes'), {
            pacienteId,
            mensaje,
            estado: 'pendiente',
            createdAt: serverTimestamp(),
            ...extra
        });
    } catch (e) { console.error('Error creando alerta paciente:', e); }
};

// Escuchar citas de un paciente en tiempo real
export const onCitasPacienteChange = (pacienteId, callback) => {
    const q = query(citasCol, where('pacienteId', '==', pacienteId));
    return onSnapshot(q, (snapshot) => {
        const citas = snapshot.docs
            .map(normalizeCitaDoc)
            .sort((a, b) => new Date(b.fechaHora || 0) - new Date(a.fechaHora || 0));
        callback(citas);
    });
};


// Obtiene todos los tratamientos y planes activos de un paciente con cruce financiero
export const getTratamientosYPlanesActivosPaciente = async (pacienteId) => {
    if (!pacienteId) return [];
    const resultados = [];

    // 1. Obtener planes y pagos del paciente
    const planesPaciente = [];
    try {
        const qPlanes = query(
            collection(db, 'planes'),
            where('pacienteId', '==', pacienteId)
        );
        const snapPlanes = await getDocs(qPlanes);
        snapPlanes.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.eliminado) {
                planesPaciente.push({ id: docSnap.id, ...data });
            }
        });
    } catch (e) {
        console.warn('Error al consultar planes del paciente:', e);
    }

    // 2. Obtener tratamientos activos de la colección 'tratamientos'
    try {
        const qTrat = query(
            collection(db, 'tratamientos'),
            where('pacienteId', '==', pacienteId)
        );
        const snapTrat = await getDocs(qTrat);
        snapTrat.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (data.activo !== false && !data.eliminado) {
                const normTratNombre = (data.nombre || data.tipo || '').toLowerCase();
                
                // Buscar plan asociado
                const planAsoc = planesPaciente.find(p => {
                    const normPlan = (p.objetivo || p.servicio || p.tratamiento || '').toLowerCase();
                    return normPlan.includes(normTratNombre) || normTratNombre.includes(normPlan);
                });

                resultados.push({
                    id: docSnap.id,
                    tipoOrigen: 'tratamiento',
                    tipoLabel: 'Tratamiento Activo',
                    nombre: data.nombre || data.tipo || 'Tratamiento',
                    categoria: data.tipo || 'Clínico',
                    especialistaId: data.especialistaId || null,
                    especialistaNombre: data.especialistaNombre || '',
                    especialistaPuesto: data.especialistaPuesto || '',
                    fechaInicio: data.fechaInicio || data.creadoEn,
                    duracionMin: 60,
                    // Datos financieros cruzados del plan
                    planId: planAsoc?.id || null,
                    tienePlan: !!planAsoc,
                    meta: Number(planAsoc?.meta || 0),
                    acumulado: Number(planAsoc?.acumulado || 0),
                    faltante: Number(planAsoc?.faltante ?? (planAsoc ? (Number(planAsoc.meta || 0) - Number(planAsoc.acumulado || 0)) : 0)),
                    costoPorSesion: Number(planAsoc?.costoPorSesion || 0),
                    sesionesTotales: Number(planAsoc?.sesiones || planAsoc?.numSesiones || 0),
                });
            }
        });
    } catch (err) {
        console.warn('Error al buscar tratamientos activos:', err);
    }

    // 3. Agregar planes que no coincidan con un tratamiento activo existente
    planesPaciente.forEach(p => {
        const completado = p.estado === 'Completado' || p.estado === 'Finalizado';
        if (!completado) {
            const normP = (p.objetivo || p.servicio || p.tratamiento || '').toLowerCase();
            const yaRegistrado = resultados.some(r => {
                const normR = (r.nombre || '').toLowerCase();
                return r.planId === p.id || normR.includes(normP) || normP.includes(normR);
            });

            if (!yaRegistrado) {
                const metaNum = Number(p.meta || 0);
                const acumNum = Number(p.acumulado || 0);
                const faltanteNum = Number(p.faltante ?? (metaNum - acumNum));
                resultados.push({
                    id: p.id,
                    tipoOrigen: 'plan',
                    tipoLabel: 'Plan / Paquete',
                    nombre: p.objetivo || p.servicio || p.tratamiento || 'Plan de Tratamiento',
                    categoria: 'Paquete de Tratamiento',
                    especialistaId: p.especialistaId || null,
                    especialistaNombre: p.especialistaNombre || '',
                    costoPorSesion: Number(p.costoPorSesion || 0),
                    acumulado: acumNum,
                    meta: metaNum,
                    faltante: faltanteNum,
                    duracionMin: 60,
                    tienePlan: true,
                    sesionesTotales: Number(p.sesiones || p.numSesiones || 0),
                });
            }
        }
    });

    return resultados;
};
/**
 * Verifica si el paciente de la cita tiene registros clínicos (sesiones, notas, medidas)
 * generados por el especialista en el expediente para la cita o en la fecha de atención.
 */
export const verificarMovimientosExpediente = async (cita) => {
    if (!cita) return false;

    // 1. Si la cita ya tiene registrado que el expediente fue actualizado
    if (cita.expedienteActualizado === true || cita.sesionRegistradaId) {
        return true;
    }

    const pacienteId = cita.pacienteId;
    if (!pacienteId) return false;

    try {
        // 2. Revisar si hay alguna sesión vinculada a esta cita
        const qCita = query(collection(db, 'sesiones'), where('citaVinculadaId', '==', cita.id));
        const snapCita = await getDocs(qCita);
        if (!snapCita.empty) return true;

        // 3. Revisar si hay sesiones registradas para este paciente
        const qPac = query(collection(db, 'sesiones'), where('pacienteId', '==', pacienteId));
        const snapPac = await getDocs(qPac);
        if (!snapPac.empty) {
            const fechaCitaYMD = cita.fechaYMD || (cita.fecha ? String(cita.fecha).substring(0, 10) : '') || (cita.fechaHora ? String(cita.fechaHora).substring(0, 10) : '');
            const hoyYMD = new Date().toISOString().split('T')[0];

            const tieneMovimientoFecha = snapPac.docs.some(d => {
                const data = d.data();
                const f = data.fechaOverride || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : '')) || '';
                return f.startsWith(hoyYMD) || (fechaCitaYMD && f.startsWith(fechaCitaYMD));
            });
            if (tieneMovimientoFecha) return true;
        }

        // 4. Revisar si en el documento del paciente se registró actualización de expediente hoy
        const pacRef = doc(db, 'pacientes', pacienteId);
        const pacSnap = await getDoc(pacRef);
        if (pacSnap.exists()) {
            const pacData = pacSnap.data();
            const hoyYMD = new Date().toISOString().split('T')[0];
            const fechaCitaYMD = cita.fechaYMD || (cita.fecha ? String(cita.fecha).substring(0, 10) : '') || (cita.fechaHora ? String(cita.fechaHora).substring(0, 10) : '');
            if (pacData.ultimaActualizacionExpediente === hoyYMD || (fechaCitaYMD && pacData.ultimaActualizacionExpediente === fechaCitaYMD)) {
                return true;
            }
        }
    } catch (e) {
        console.warn('Error verificando movimientos de expediente:', e);
    }

    return false;
};
