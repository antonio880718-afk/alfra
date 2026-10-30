import {
    collection, addDoc, updateDoc, deleteDoc,
    doc, getDocs, getDoc, query, orderBy, where, serverTimestamp, onSnapshot
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

const TRATAMIENTOS_COL = 'tratamientos';
const SESIONES_COL = 'sesiones';

// ─── TRATAMIENTOS ─────────────────────────────────────────────────────────────

/**
 * Crea un nuevo tratamiento para un paciente.
 * Un paciente puede tener múltiples tratamientos activos al mismo tiempo.
 */
export const crearTratamiento = async (pacienteId, { tipo, nombre, especialistaId, especialistaNombre }) => {
    const docRef = await addDoc(collection(db, TRATAMIENTOS_COL), {
        pacienteId,
        tipo,            // 'Facial' | 'Corporal'
        nombre,          // Ej: 'Reducción de medidas', 'Limpieza profunda'
        especialistaId,
        especialistaNombre,
        fechaInicio: new Date().toISOString(),
        activo: true,
        creadoEn: new Date().toISOString(),
    });
    return docRef.id;
};

/**
 * Obtiene todos los tratamientos de un paciente (activos e históricos).
 */
export const getTratamientosPaciente = async (pacienteId) => {
    const q = query(
        collection(db, TRATAMIENTOS_COL),
        where('pacienteId', '==', pacienteId)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => !d.eliminado) // Filtro de soft delete
        .sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio));
};

/**
 * Finaliza un tratamiento (lo marca como inactivo).
 */
export const finalizarTratamiento = async (tratamientoId) => {
    await updateDoc(doc(db, TRATAMIENTOS_COL, tratamientoId), {
        activo: false,
        fechaFin: new Date().toISOString(),
    });
};

/**
 * El Especialista solicita la eliminación de un Tratamiento.
 * Esto lo enviará a la bandeja del Administrador para su aprobación.
 */
export const solicitarEliminacionTratamiento = async (tratamientoId, especialistaKey = 'Especialista') => {
    await updateDoc(doc(db, TRATAMIENTOS_COL, tratamientoId), {
        solicitudEliminacion: true,
        solicitadoPor: especialistaKey,
        fechaSolicitudEliminacion: new Date().toISOString()
    });
};

/**
 * El Administrador rechaza la solicitud de eliminación y reactiva el tratamiento.
 */
export const rechazarEliminacionTratamiento = async (tratamientoId) => {
    await updateDoc(doc(db, TRATAMIENTOS_COL, tratamientoId), {
        solicitudEliminacion: false,
        solicitadoPor: null,
        fechaSolicitudEliminacion: null,
        rechazoEliminacionEn: new Date().toISOString()
    });
};

/**
 * Obtiene todos los tratamientos que están pendientes de eliminación (Admin)
 */
export const getSolicitudesEliminacion = async () => {
    const q = query(
        collection(db, TRATAMIENTOS_COL),
        where('solicitudEliminacion', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => !d.eliminado) // Solo los que siguen vivos
        .sort((a, b) => new Date(b.fechaSolicitudEliminacion || 0) - new Date(a.fechaSolicitudEliminacion || 0));
};

/**
 * Elimina un tratamiento y TODAS sus sesiones (SOFT DELETE).
 * NINGUN ARCHIVO ES ELIMINADO FÍSICAMENTE.
 * (Ahora es accionado prioritariamente por el Admin al Aprobar Solicitudes)
 */
export const eliminarTratamiento = async (tratamientoId) => {
    // 1. Soft-delete todas las sesiones
    const sesiones = await getSesionesTratamiento(tratamientoId);
    for (const sesion of sesiones) {
        await eliminarSesion(sesion.id, sesion.fotosSesion || []);
    }
    // 2. Soft-delete el tratamiento
    await updateDoc(doc(db, TRATAMIENTOS_COL, tratamientoId), {
        activo: false,
        eliminado: true,
        deletedAt: new Date().toISOString()
    });
};

// ─── SESIONES ─────────────────────────────────────────────────────────────────

/**
 * Crea una nueva sesión dentro de un tratamiento.
 * Las fotos deben subirse ANTES y pasarse como array de URLs.
 * INMUTABILIDAD: Los documentos creados aquí se conservan para siempre
 * a menos que se llame explícitamente a eliminarSesion().
 */
export const crearSesion = async (tratamientoId, pacienteId, tipo, {
    protocolo,
    notas,
    medidas,       // objeto con campos específicos según tipo
    fotosSesion,   // array de { url, path } — path para poder eliminar de Storage
    consentimientos,
    fechaOverride,
    citaVinculadaId,
}) => {
    const docRef = await addDoc(collection(db, SESIONES_COL), {
        tratamientoId,
        pacienteId,
        tipo,
        protocolo: protocolo || '',
        notas: notas || '',
        medidas: medidas || {},
        fotosSesion: fotosSesion || [],   // array de { url, storagePath }
        consentimientos: consentimientos || [],
        fecha: fechaOverride || new Date().toISOString(),
        creadoEn: new Date().toISOString(),
        ...(citaVinculadaId && { citaVinculadaId }),
    });
    return docRef.id;
};

/**
 * Escucha en tiempo real todas las sesiones registradas en la clínica (para Auditoría de Expedientes en Corte de Caja y Admin).
 */
export const onSesionesChange = (callback) => {
    return onSnapshot(collection(db, SESIONES_COL), (snap) => {
        const items = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(d => !d.eliminado);
        callback(items);
    }, (err) => {
        console.error('Error in onSesionesChange listener:', err);
        callback([]);
    });
};

/**
 * Resuelve el nombre real de la especialista asignada a una cita cruzando con el catálogo de staff y el expediente del paciente.
 */
const resolverNombreEspecialistaCita = (cita, staffList = [], pacientesList = []) => {
    const rawId = String(cita.especialistaId || '').trim();
    const rawUid = String(cita.especialistaUid || '').trim();
    const rawEmail = String(cita.especialistaEmail || '').trim().toLowerCase();
    const rawNombre = String(cita.especialistaNombre || cita.especialista || '').trim();
    const pacId = String(cita.pacienteId || '').trim();
    const pacNombre = String(cita.pacienteNombre || cita.paciente || '').trim().toLowerCase();

    // 1. Buscar en staffList por ID de documento, UID o Email
    if (Array.isArray(staffList) && staffList.length > 0) {
        const byId = staffList.find(s =>
            (rawId && (s.id === rawId || s.uid === rawId)) ||
            (rawUid && (s.id === rawUid || s.uid === rawUid)) ||
            (rawEmail && (String(s.email || s.correo || '').trim().toLowerCase() === rawEmail))
        );
        if (byId?.nombre) return byId.nombre.trim();

        if (rawNombre && rawNombre.toLowerCase() !== 'especialista' && rawNombre !== '---') {
            const byName = staffList.find(s =>
                String(s.nombre || '').trim().toLowerCase() === rawNombre.toLowerCase()
            );
            if (byName?.nombre) return byName.nombre.trim();
        }
    }

    // 2. Si la cita trae un nombre explícito (y no es un ID ni genérico)
    if (
        rawNombre &&
        rawNombre.toLowerCase() !== 'especialista' &&
        rawNombre.toLowerCase() !== 'personal alfra' &&
        rawNombre !== '---' &&
        rawNombre !== rawId
    ) {
        return rawNombre;
    }

    // 3. Buscar en el expediente del paciente (especialistaAsignadoNombre / especialistaAsignado / tratante)
    if (Array.isArray(pacientesList) && pacientesList.length > 0) {
        const pacDoc = pacientesList.find(p =>
            (pacId && p.id === pacId) ||
            (pacNombre && String(p.nombre || '').trim().toLowerCase() === pacNombre)
        );
        if (pacDoc) {
            if (pacDoc.especialistaAsignadoNombre && pacDoc.especialistaAsignadoNombre.toLowerCase() !== 'especialista') {
                return pacDoc.especialistaAsignadoNombre.trim();
            }
            if (pacDoc.especialistaAsignado && Array.isArray(staffList) && staffList.length > 0) {
                const st = staffList.find(s => s.id === pacDoc.especialistaAsignado || s.uid === pacDoc.especialistaAsignado);
                if (st?.nombre) return st.nombre.trim();
            }
            if (pacDoc.tratante && pacDoc.tratante.toLowerCase() !== 'especialista' && pacDoc.tratante !== '---') {
                return pacDoc.tratante.trim();
            }
        }
    }

    return rawNombre || 'Especialista sin asignar';
};

/**
 * Audita las citas de una fecha ('yyyy-MM-dd') y verifica cuáles tienen su expediente clínico actualizado ese día,
 * agrupando específicamente por cada especialista con su respectivo paciente.
 */
export const auditarExpedientesPorDia = (
    citasDia = [],
    sesiones = [],
    seguimientos = [],
    fechaStr = '',
    staffList = [],
    pacientesList = []
) => {
    const citasValidas = (citasDia || []).filter(c => c.status !== 'Cancelada');
    const actualizados = [];
    const sinActualizar = [];

    citasValidas.forEach((cita) => {
        const pacId = String(cita.pacienteId || '').trim();
        const pacNombre = String(cita.pacienteNombre || cita.paciente || 'Paciente').trim();
        const espNombre = resolverNombreEspecialistaCita(cita, staffList, pacientesList);

        const flagEnCita = Boolean(cita.expedienteActualizado) || Boolean(cita.sesionRegistradaId);
        const tieneSesionHoy = (sesiones || []).some((s) => {
            if (s.eliminado) return false;
            if (cita.id && s.citaVinculadaId === cita.id) return true;
            const fechaS = String(s.fecha || '').slice(0, 10);
            const creadoS = String(s.creadoEn || '').slice(0, 10);
            const coincideFecha = fechaStr ? (fechaS === fechaStr || creadoS === fechaStr) : true;
            if (!coincideFecha) return false;
            if (pacId && s.pacienteId === pacId) return true;
            return false;
        });
        const tieneSeguimientoHoy = (seguimientos || []).some((seg) => {
            const fechaSeg = String(seg.fechaRegistro || '').slice(0, 10);
            if (fechaStr && fechaSeg !== fechaStr) return false;
            if (pacId && seg.pacienteId === pacId) return true;
            return false;
        });

        const mensajeIndividualPaciente = `Especialista ${espNombre}, no actualizaste el expediente del paciente: ${pacNombre}. Recuerda que de no ser actualizado se te penalizará en la nómina. Atte. Administración Clínica ALFRA.`;

        const itemAuditado = {
            ...cita,
            pacienteNombreLimpio: pacNombre,
            especialistaNombreLimpio: espNombre,
            expedienteAlDia: flagEnCita || tieneSesionHoy || tieneSeguimientoHoy,
            mensajeIndividual: mensajeIndividualPaciente,
        };

        if (itemAuditado.expedienteAlDia) {
            actualizados.push(itemAuditado);
        } else {
            sinActualizar.push(itemAuditado);
        }
    });

    // Agrupar faltantes específicamente por cada especialista con sus respectivos pacientes
    const mapaEsp = {};
    sinActualizar.forEach((c) => {
        const esp = c.especialistaNombreLimpio || 'Especialista sin asignar';
        if (!mapaEsp[esp]) {
            mapaEsp[esp] = {
                especialista: esp,
                citas: [],
                pacientes: [],
            };
        }
        mapaEsp[esp].citas.push(c);
        if (!mapaEsp[esp].pacientes.includes(c.pacienteNombreLimpio)) {
            mapaEsp[esp].pacientes.push(c.pacienteNombreLimpio);
        }
    });

    const porEspecialista = Object.values(mapaEsp).map((grupo) => {
        const listaPacientes = grupo.pacientes.join(', ');
        const esUno = grupo.pacientes.length === 1;
        return {
            ...grupo,
            listaPacientes,
            mensaje: esUno
                ? `Especialista ${grupo.especialista}, no actualizaste el expediente del paciente: ${listaPacientes}. Recuerda que de no ser actualizado se te penalizará en la nómina. Atte. Administración Clínica ALFRA.`
                : `Especialista ${grupo.especialista}, no actualizaste los expedientes de los pacientes: ${listaPacientes}. Recuerda que de no ser actualizados se te penalizará en la nómina. Atte. Administración Clínica ALFRA.`,
        };
    });

    const todosPacientesFaltantes = Array.from(new Set(sinActualizar.map(c => c.pacienteNombreLimpio)));

    return {
        fecha: fechaStr,
        totalCitas: citasValidas.length,
        actualizados,
        sinActualizar,
        porEspecialista,
        todosPacientesFaltantes,
    };
};

/**
 * Obtiene todas las sesiones de un tratamiento, ordenadas por fecha ascendente.
 */
export const getSesionesTratamiento = async (tratamientoId) => {
    const q = query(
        collection(db, SESIONES_COL),
        where('tratamientoId', '==', tratamientoId)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => !d.eliminado) // Omitir soft deleted
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
};

/**
 * Obtiene todas las sesiones de un paciente (para vista del paciente).
 */
export const getSesionesPaciente = async (pacienteId) => {
    const q = query(
        collection(db, SESIONES_COL),
        where('pacienteId', '==', pacienteId)
    );
    const snap = await getDocs(q);
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => !d.eliminado)
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
};

/**
 * Elimina una sesión específica (SOFT DELETE).
 * Las fotos NO se eliminan de Firebase Storage para evitar borrado de expedientes por error.
 */
export const eliminarSesion = async (sesionId, fotosSesion = []) => {
    await updateDoc(doc(db, SESIONES_COL, sesionId), {
        eliminado: true,
        deletedAt: new Date().toISOString()
    });
};

// ─── CAMPOS POR TIPO ──────────────────────────────────────────────────────────

export const MEDIDAS_CORPORALES = [
    { key: 'peso',     label: 'Peso',     unit: 'kg',  tipo: 'number' },
    { key: 'estatura', label: 'Estatura', unit: 'cm',  tipo: 'number' },
    // IMC se calcula auto
    { key: 'cintura',  label: 'Cintura',  unit: 'cm',  tipo: 'number' },
    { key: 'abdomen',  label: 'Abdomen',  unit: 'cm',  tipo: 'number' },
    { key: 'cadera',   label: 'Cadera',   unit: 'cm',  tipo: 'number' },
    { key: 'busto',    label: 'Busto',    unit: 'cm',  tipo: 'number' },
    { key: 'brazo',    label: 'Brazo',    unit: 'cm',  tipo: 'number' },
    { key: 'muslos',   label: 'Muslos',   unit: 'cm',  tipo: 'number' },
    { key: 'pierna',   label: 'Pierna',   unit: 'cm',  tipo: 'number' },
];

export const CAMPOS_FACIALES = [
    { key: 'biotipoCutaneo', label: 'Biotipo Cutáneo', tipo: 'select',
      opciones: ['Piel Mixta', 'Piel Grasa', 'Piel Seca', 'Piel Sensible / Rosácea', 'Piel Normal'] },
    { key: 'tono',           label: 'Tono de Piel',    tipo: 'select',
      opciones: ['Muy Claro', 'Claro', 'Medio', 'Oscuro', 'Muy Oscuro'] },
    { key: 'sensibilidad',   label: 'Sensibilidad',    tipo: 'select',
      opciones: ['Baja', 'Media', 'Alta', 'Muy Alta'] },
    { key: 'zonasTratadas',  label: 'Zonas Tratadas',  tipo: 'text' },
    { key: 'reaccionObservada', label: 'Reacción Observada', tipo: 'textarea' },
];
