# -*- coding: utf-8 -*-
import sys

# 1. ACTUALIZAR CITAS_SERVICE.JS
with open('src/services/citasService.js', 'r', encoding='utf-8') as f:
    text = f.read()

marker1 = '// Actualizar status o datos de la cita'
marker2 = '// Crear alerta para un paciente o'

idx1 = text.find(marker1)
idx2 = text.find(marker2)

if idx1 == -1 or idx2 == -1:
    print("Error: No se encontraron los marcadores en citasService.js")
    sys.exit(1)

replacement = """// Descartar alertas pendientes vinculadas a una cita que ya fue atendida o completada
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

"""

new_text = text[:idx1] + replacement + text[idx2:]
with open('src/services/citasService.js', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("citasService.js actualizado con exito.")
