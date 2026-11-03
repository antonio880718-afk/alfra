const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// --- CONFIGURACION GLOBAL DE NOTIFICACIONES PUSH FCM (SONIDO Y VIBRACION) ---
const ANDROID_NOTIFICATION_CONFIG = {
    priority: 'high',
    notification: {
        channelId: 'alfra_citas_urgentes_v2',
        sound: 'default',
        defaultSound: true,
        defaultVibrateTimings: false,
        vibrateTimingsMillis: [0, 500, 250, 500, 250, 500],
        priority: 'high',
        visibility: 'public'
    }
};

const APNS_NOTIFICATION_CONFIG = {
    headers: {
        'apns-priority': '10'
    },
    payload: {
        aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true
        }
    }
};


exports.enviarNotificacionLlegada = functions.firestore
    .document("alertas_pacientes/{alertaId}")
    .onCreate(async (snap, context) => {
        const alertaId = context.params.alertaId;
        const data = snap.data();
        const especialistaId = data.especialistaId;
        const mensaje = data.mensaje;

        console.log(`[DEBUG_NOTIF] Procesando alerta ${alertaId} para especialista: ${especialistaId}`);

        if (!especialistaId || !mensaje) {
            console.error(`[DEBUG_NOTIF] Faltan datos en la alerta ${alertaId}:`, { especialistaId, mensaje });
            return null;
        }

        try {
            let usuarioSnap = await admin.firestore().collection("usuarios").doc(especialistaId).get();
            let finalUid = especialistaId;

            // --- LÃ“GICA DE AUTO-CORRECCIÃ“N ---
            if (!usuarioSnap.exists) {
                console.warn(`[DEBUG_NOTIF] ID ${especialistaId} no encontrado en 'usuarios'. Buscando por Staff...`);

                // 1. Buscar en la colecciÃ³n 'staff' por el ID que nos llegÃ³
                const staffSnap = await admin.firestore().collection("staff").doc(especialistaId).get();

                if (staffSnap.exists) {
                    const staffData = staffSnap.data();
                    const email = staffData.email;

                    if (email) {
                        console.log(`[DEBUG_NOTIF] Staff encontrado (${staffData.nombre}). Buscando UID por email: ${email}`);

                        // 2. Buscar en 'usuarios' por ese email
                        const userQuery = await admin.firestore().collection("usuarios")
                            .where("email", "==", email.trim())
                            .limit(1)
                            .get();

                        if (!userQuery.empty) {
                            const correctUserDoc = userQuery.docs[0];
                            finalUid = correctUserDoc.id;
                            usuarioSnap = correctUserDoc;

                            console.log(`[DEBUG_NOTIF] Â¡Ã‰XITO! Mapeado a UID real: ${finalUid}. Parcheando documento de staff...`);

                            // 3. AUTO-PARCHE: Guardar el UID correcto en el documento de staff para siempre
                            await staffSnap.ref.update({ uid: finalUid });
                        }
                    }
                }
            }

            if (!usuarioSnap.exists) {
                console.error(`[DEBUG_NOTIF] ERROR: No se pudo resolver la identidad de ${especialistaId} tras todos los intentos.`);
                return snap.ref.update({ estado: 'error', errorDetalle: 'Identidad no resuelta' });
            }

            const usuarioData = usuarioSnap.data();
            const fcmToken = usuarioData.fcmToken;

            if (!fcmToken) {
                console.warn(`[DEBUG_NOTIF] Usuario ${usuarioData.nombre || finalUid} NO TIENE fcmToken.`);
                return snap.ref.update({ estado: 'error', errorDetalle: 'Sin Token FCM' });
            }

            console.log(`[DEBUG_NOTIF] Enviando notificaciÃ³n a: ${usuarioData.nombre}`);

            const payload = {
                notification: {
                    title: "Â¡Paciente en Sala de Espera!",
                    body: mensaje
                },
                android: ANDROID_NOTIFICATION_CONFIG,
                apns: APNS_NOTIFICATION_CONFIG,
                token: fcmToken
            };

            const response = await admin.messaging().send(payload);
            console.log(`[DEBUG_NOTIF] ENVÃO EXITOSO: ${response}`);

            return snap.ref.update({
                estado: 'completado',
                enviadoEn: admin.firestore.FieldValue.serverTimestamp(),
                fcmResponse: response,
                uidResuelto: finalUid // Guardamos para auditorÃ­a
            });

        } catch (error) {
            console.error(`[DEBUG_NOTIF] ERROR FATAL: ${error.message}`);
            return snap.ref.update({
                estado: 'error',
                errorDetalle: error.message
            });
        }
    });

// --- RECORDATORIO DE CITAS (1 HORA ANTES) ---
// Se ejecuta cada 15 minutos para buscar citas prÃ³ximas
exports.enviarRecordatorioCita = functions.pubsub
    .schedule('every 15 minutes')
    .onRun(async (context) => {
        const ahora = new Date();
        const unaHoraDespues = new Date(ahora.getTime() + (60 * 60 * 1000));
        const unaHoraYMediaDespues = new Date(ahora.getTime() + (90 * 60 * 1000));

        // Formato ISO para comparar con el string de fechaHora en Firestore
        const minTime = unaHoraDespues.toISOString();
        const maxTime = unaHoraYMediaDespues.toISOString();

        console.log(`[DEBUG_REMAINDER] Buscando citas entre ${minTime} y ${maxTime}`);

        try {
            const citasSnap = await admin.firestore().collection("citas")
                .where("fechaHora", ">=", minTime)
                .where("fechaHora", "<=", maxTime)
                .where("notificadoRecordatorio", "==", false)
                .get();

            if (citasSnap.empty) {
                console.log("[DEBUG_REMAINDER] No hay citas prÃ³ximas para notificar.");
                return null;
            }

            const promises = citasSnap.docs.map(async (doc) => {
                const cita = doc.data();
                const pacienteId = cita.pacienteId;

                if (!pacienteId) return null;

                // 1. Obtener UID del paciente desde la colecciÃ³n 'pacientes'
                const pacienteSnap = await admin.firestore().collection("pacientes").doc(pacienteId).get();
                if (!pacienteSnap.exists) return null;

                const uid = pacienteSnap.data().uid;
                if (!uid) return null;

                // 2. Obtener Token FCM del usuario
                const usuarioSnap = await admin.firestore().collection("usuarios").doc(uid).get();
                if (!usuarioSnap.exists) return null;

                const fcmToken = usuarioSnap.data().fcmToken;
                if (!fcmToken) return null;

                // 3. Enviar NotificaciÃ³n
                const payload = {
                    notification: {
                        title: "â° Recordatorio de Cita",
                        body: `Hola ${cita.pacienteNombre}, te recordamos tu cita de ${cita.servicio} en 1 hora.`
                    },
                    android: ANDROID_NOTIFICATION_CONFIG,
                    apns: APNS_NOTIFICATION_CONFIG,
                    token: fcmToken
                };

                try {
                    await admin.messaging().send(payload);
                    // 4. Marcar como notificado
                    await doc.ref.update({ notificadoRecordatorio: true });
                    console.log(`[DEBUG_REMAINDER] NotificaciÃ³n enviada a ${cita.pacienteNombre}`);
                } catch (err) {
                    console.error(`[DEBUG_REMAINDER] Error enviando a ${cita.pacienteNombre}:`, err);
                }
            });

            await Promise.all(promises);
            return null;
        } catch (error) {
            console.error("[DEBUG_REMAINDER] Error procesando recordatorios:", error);
            return null;
        }
    });

// --- NOTIFICACIONES A ESPECIALISTAS POR CAMBIOS EN AGENDA ---
exports.notificarEspecialistaAgenda = functions.firestore
    .document("citas/{citaId}")
    .onWrite(async (change, context) => {
        const citaId = context.params.citaId;
        const dataAfter = change.after.exists ? change.after.data() : null;
        const dataBefore = change.before.exists ? change.before.data() : null;

        if (!dataAfter && !dataBefore) return null;

        let tipoNotificacion = null; // 'NUEVA', 'REAGENDADA', 'CANCELADA'
        let cita = null;

        if (!dataBefore && dataAfter) {
            tipoNotificacion = 'NUEVA';
            cita = dataAfter;
        } else if (dataBefore && !dataAfter) {
            tipoNotificacion = 'CANCELADA';
            cita = dataBefore;
        } else if (dataBefore && dataAfter) {
            cita = dataAfter;
            if (dataBefore.status !== 'Cancelada' && dataAfter.status === 'Cancelada') {
                tipoNotificacion = 'CANCELADA';
            } else if (
                (dataBefore.status !== 'Reagendada' && dataAfter.status === 'Reagendada') ||
                (dataBefore.fechaYMD !== dataAfter.fechaYMD) ||
                (dataBefore.hora !== dataAfter.hora) ||
                (dataBefore.fechaHora !== dataAfter.fechaHora)
            ) {
                if (dataAfter.status !== 'Cancelada') {
                    tipoNotificacion = 'REAGENDADA';
                }
            }
        }

        if (!tipoNotificacion) return null;

        const especialistaId = cita.especialistaId;
        const especialistaNombre = cita.especialistaNombre || 'Doctor(a)';
        const pacienteNombre = cita.paciente || cita.pacienteNombre || 'Paciente';
        const servicio = cita.servicio || 'Servicio';
        
        // Formatear fecha si es posible para que no sea solo AAAA-MM-DD
        let fechaFormat = 'Fecha';
        let horaFormat = 'Hora';
        
        try {
            if (cita.fechaHora) {
                const partes = cita.fechaHora.split('T');
                if (partes.length >= 2) {
                    const [y, m, d] = partes[0].split('-');
                    fechaFormat = `${d}/${m}/${y}`;
                    
                    const timeStr = partes[1].substring(0, 5); // HH:MM
                    const [hh, mm] = timeStr.split(':');
                    const h = parseInt(hh, 10);
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const h12 = h % 12 || 12;
                    horaFormat = `${h12}:${mm} ${ampm}`;
                }
            } else if (cita.fechaYMD && cita.hora) {
                const [y, m, d] = cita.fechaYMD.split('-');
                fechaFormat = `${d}/${m}/${y}`;
                horaFormat = cita.hora;
            }
        } catch (e) {
            console.warn(`[DEBUG_AGENDA] Error formateando fechaHora:`, e);
        }

        if (!especialistaId) {
            console.warn(`[DEBUG_AGENDA] Cita ${citaId} sin especialistaId, no se puede notificar.`);
            return null;
        }

        try {
            let finalUid = especialistaId;
            let fcmToken = null;

            const usuarioSnap = await admin.firestore().collection("usuarios").doc(especialistaId).get();
            if (usuarioSnap.exists) {
                fcmToken = usuarioSnap.data().fcmToken;
            } else {
                const staffSnap = await admin.firestore().collection("staff").doc(especialistaId).get();
                if (staffSnap.exists && staffSnap.data().email) {
                    const userQuery = await admin.firestore().collection("usuarios")
                        .where("email", "==", staffSnap.data().email.trim())
                        .limit(1)
                        .get();
                    if (!userQuery.empty) {
                        fcmToken = userQuery.docs[0].data().fcmToken;
                        finalUid = userQuery.docs[0].id;
                    }
                }
            }

            if (!fcmToken) {
                console.warn(`[DEBUG_AGENDA] Especialista ${especialistaNombre} (${finalUid}) sin FCM Token.`);
                return null;
            }

            let titulo = "";
            let cuerpo = "";

            if (tipoNotificacion === 'NUEVA') {
                titulo = "NUEVA CITA AGENDADA";
                cuerpo = `Hola ${especialistaNombre}, se te agendó un ${servicio} con el paciente ${pacienteNombre} para el ${fechaFormat} a las ${horaFormat}. Es importante no hacer esperar más de 5 minutos a tu paciente; prepara tu material y herramientas de trabajo con tiempo.`;
            } else if (tipoNotificacion === 'REAGENDADA') {
                titulo = "CITA REAGENDADA";
                cuerpo = `Hola ${especialistaNombre}, se reagendó tu cita de ${servicio} con el paciente ${pacienteNombre} para el ${fechaFormat} a las ${horaFormat}. Es importante no hacer esperar más de 5 minutos a tu paciente; prepara tu material y herramientas de trabajo con tiempo.`;
            } else if (tipoNotificacion === 'CANCELADA') {
                titulo = "CITA CANCELADA";
                cuerpo = `Hola ${especialistaNombre}, se ha cancelado la cita de ${servicio} que tenías con el paciente ${pacienteNombre} el ${fechaFormat} a las ${horaFormat}.`;
            }

            const payload = {
                notification: {
                    title: titulo,
                    body: cuerpo
                },
                android: ANDROID_NOTIFICATION_CONFIG,
                apns: APNS_NOTIFICATION_CONFIG,
                token: fcmToken
            };

            const response = await admin.messaging().send(payload);
            console.log(`[DEBUG_AGENDA] NotificaciÃ³n ${tipoNotificacion} enviada a ${especialistaNombre}. Response: ${response}`);

            await admin.firestore().collection("notificaciones").add({
                android: ANDROID_NOTIFICATION_CONFIG,
                apns: APNS_NOTIFICATION_CONFIG,
                token: fcmToken,
                title: titulo,
                body: cuerpo,
                data: { citaId },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                userId: finalUid,
                tipo: tipoNotificacion
            });

            return null;

        } catch (error) {
            console.error(`[DEBUG_AGENDA] Error en envÃ­o:`, error);
            return null;
        }
    });

// --- UTILIDADES ---
const obtenerTokensAdmins = async () => {
    const tokens = new Set();
    try {
        const roles = ['Administrador', 'Recepcionista', 'admin', 'Recepcion', 'recepcionista', 'administrador'];
        for (const r of roles) {
            try {
                const snap = await admin.firestore().collection('usuarios').where('role', '==', r).get();
                snap.forEach(doc => {
                    const t = doc.data().fcmToken;
                    if (t) tokens.add(t);
                });
            } catch (_) {}
        }

        const masterEmails = [
            'antonio880718@gmail.com',
            'alejandra291714@gmail.com',
            'aleja291714@gmail.com',
            'recepcion@alfra.com'
        ];
        try {
            const masterSnap = await admin.firestore().collection('usuarios').where('email', 'in', masterEmails).get();
            masterSnap.forEach(doc => {
                const t = doc.data().fcmToken;
                if (t) tokens.add(t);
            });
        } catch (_) {}

        try {
            const staffSnap = await admin.firestore().collection('staff').get();
            staffSnap.forEach(doc => {
                const d = doc.data();
                const rol = (d.rol || d.role || '').toLowerCase();
                if (rol.includes('admin') || rol.includes('recep') || masterEmails.includes(String(d.email || '').toLowerCase())) {
                    if (d.fcmToken) tokens.add(d.fcmToken);
                }
            });
        } catch (_) {}
    } catch (e) {
        console.error('[DEBUG_ADMIN_NOTIF] Error obteniendo tokens de administradores:', e);
    }
    return Array.from(tokens);
};

// --- 1. NOTIFICACIÃ“N CANCELACIÃ“N DE CAJA ---
exports.notificarCancelacionCaja = functions.firestore
    .document("movimientos/{movId}")
    .onUpdate(async (change, context) => {
        const dataBefore = change.before.data();
        const dataAfter = change.after.data();

        // Detectar cambio de estado a 'Pendiente CancelaciÃ³n'
        if (dataBefore.estado !== 'Pendiente CancelaciÃ³n' && dataAfter.estado === 'Pendiente CancelaciÃ³n') {
            const tokens = await obtenerTokensAdmins();
            if (tokens.length === 0) return null;

            const monto = dataAfter.monto ? `$${Number(dataAfter.monto).toLocaleString('es-MX')}` : '';
            const concepto = dataAfter.motivo || dataAfter.concepto || 'Movimiento';
            const motivoCancelacion = dataAfter.motivoCancelacion || 'No especificado';

            const payload = {
                notification: {
                    title: "ðŸš¨ Solicitud de CancelaciÃ³n",
                    body: `RecepciÃ³n solicita cancelar un cobro/gasto de ${monto} por '${concepto}'. Motivo: ${motivoCancelacion}. Requiere tu aprobaciÃ³n en caja.`
                }
            };

            try {
                const response = await admin.messaging().sendEachForMulticast({ tokens, notification: payload.notification, android: ANDROID_NOTIFICATION_CONFIG, apns: APNS_NOTIFICATION_CONFIG });
                console.log("[DEBUG_ADMIN_NOTIF] NotificaciÃ³n de cancelaciÃ³n de caja enviada. Response:", response);
                return response;
            } catch(e) {
                console.error("[DEBUG_ADMIN_NOTIF] Error enviando notif cancelaciÃ³n caja:", e);
                return null;
            }
        }
        return null;
    });

// --- 2. NOTIFICACIÃ“N INVENTARIO BAJO ---
exports.notificarInventarioBajo = functions.firestore
    .document("inventario/{itemId}")
    .onUpdate(async (change, context) => {
        const dataBefore = change.before.data();
        const dataAfter = change.after.data();

        const stockAnterior = Number(dataBefore.stock) || 0;
        const stockActual = Number(dataAfter.stock) || 0;

        // Detectar cuando cruza el umbral de 2 piezas hacia abajo
        if (stockAnterior > 2 && stockActual <= 2) {
            const tokens = await obtenerTokensAdmins();
            if (tokens.length === 0) return null;

            const nombreItem = dataAfter.nombre || 'Producto no identificado';

            const payload = {
                notification: {
                    title: "ðŸ“¦ Alerta de Inventario Bajo",
                    body: `El producto '${nombreItem}' estÃ¡ por agotarse (quedan ${stockActual} piezas). Favor de re-ordenar.`
                }
            };

            try {
                const response = await admin.messaging().sendEachForMulticast({ tokens, notification: payload.notification, android: ANDROID_NOTIFICATION_CONFIG, apns: APNS_NOTIFICATION_CONFIG });
                console.log("[DEBUG_ADMIN_NOTIF] NotificaciÃ³n de inventario bajo enviada. Response:", response);
                return response;
            } catch(e) {
                console.error("[DEBUG_ADMIN_NOTIF] Error enviando notif inventario:", e);
                return null;
            }
        }
        return null;
    });

// --- 3. CORTE DIARIO DE CAJA (A las 21:00 CDMX) ---
exports.corteDiarioCaja = functions.pubsub
    .schedule('every day 21:00')
    .timeZone('America/Mexico_City')
    .onRun(async (context) => {
        try {
            const tokens = await obtenerTokensAdmins();
            if (tokens.length === 0) {
                console.log("[DEBUG_ADMIN_NOTIF] Corte diario: No hay tokens de admin.");
                return null;
            }

            // Obtener fecha de hoy en formato local (YYYY-MM-DD) usando Mexico_City timezone
            const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }); 
            const hoyStr = formatter.format(new Date()); 

            const movsSnap = await admin.firestore().collection("movimientos")
                .where("fecha", ">=", `${hoyStr}T00:00:00.000Z`)
                .where("fecha", "<=", `${hoyStr}T23:59:59.999Z`)
                .get();

            let ingresos = 0;
            let egresos = 0;

            movsSnap.forEach(doc => {
                const mov = doc.data();
                if (mov.estado !== 'Cancelado') {
                    if (mov.tipo === 'Ingreso') ingresos += Number(mov.monto) || 0;
                    if (mov.tipo === 'Egreso') egresos += Number(mov.monto) || 0;
                }
            });

            const utilidad = ingresos - egresos;
            const formatoMx = (num) => `$${Number(num).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

            const payload = {
                notification: {
                    title: "ðŸ“Š Corte de Caja del DÃ­a",
                    body: `Hoy (${hoyStr}): Ingresos ${formatoMx(ingresos)}, Egresos ${formatoMx(egresos)}. Utilidad: ${formatoMx(utilidad)}.`
                }
            };

            const response = await admin.messaging().sendEachForMulticast({ tokens, notification: payload.notification, android: ANDROID_NOTIFICATION_CONFIG, apns: APNS_NOTIFICATION_CONFIG });
            console.log("[DEBUG_ADMIN_NOTIF] NotificaciÃ³n de corte diario enviada. Response:", response);
            return response;
        } catch (error) {
            console.error("[DEBUG_ADMIN_NOTIF] Error en corteDiarioCaja:", error);
            return null;
        }
    });

// --- 4. CANCELACIÃ“N DE CITAS DE ALTO VALOR ---
exports.notificarAdminCancelacionCita = functions.firestore
    .document("citas/{citaId}")
    .onUpdate(async (change, context) => {
        const dataBefore = change.before.data();
        const dataAfter = change.after.data();

        if (dataBefore.status !== 'Cancelada' && dataAfter.status === 'Cancelada') {
            const servicio = (dataAfter.servicio || '').toLowerCase();
            if (servicio.includes('cirugÃ­a') || servicio.includes('tratamiento')) {
                const tokens = await obtenerTokensAdmins();
                if (tokens.length === 0) return null;

                const pacienteNombre = dataAfter.paciente || dataAfter.pacienteNombre || 'Paciente';
                const payload = {
                    notification: {
                        title: "ðŸ“‰ CancelaciÃ³n Importante",
                        body: `El paciente ${pacienteNombre} cancelÃ³ su cita de '${dataAfter.servicio}'.`
                    }
                };

                try {
                    const response = await admin.messaging().sendEachForMulticast({ tokens, notification: payload.notification, android: ANDROID_NOTIFICATION_CONFIG, apns: APNS_NOTIFICATION_CONFIG });
                    console.log("[DEBUG_ADMIN_NOTIF] NotificaciÃ³n cancelaciÃ³n cita enviada. Response:", response);
                    return response;
                } catch(e) {
                    console.error("[DEBUG_ADMIN_NOTIF] Error enviando notif cancelaciÃ³n cita:", e);
                    return null;
                }
            }
        }
        return null;
    });

// --- 5. NOTIFICACIÃ“N DE NUEVO TRATAMIENTO (EXPEDIENTE) ---
exports.notificarAdminNuevoTratamiento = functions.firestore
    .document("tratamientos/{tratamientoId}")
    .onCreate(async (snap, context) => {
        const data = snap.data();
        const especialistaNombre = data.especialistaNombre || 'Un especialista';
        const tratamientoNombre = data.nombre || 'Tratamiento';
        
        const tokens = await obtenerTokensAdmins();
        if (tokens.length === 0) return null;

        // Fetch paciente nombre if possible, otherwise use generic
        let pacienteNombre = 'un paciente';
        try {
            if (data.pacienteId) {
                const pacienteSnap = await admin.firestore().collection("pacientes").doc(data.pacienteId).get();
                if (pacienteSnap.exists) {
                    pacienteNombre = pacienteSnap.data().nombre || 'un paciente';
                }
            }
        } catch (e) {
            console.error("[DEBUG_ADMIN_NOTIF] Error obteniendo nombre paciente:", e);
        }

        const payload = {
            notification: {
                title: "ðŸ“‚ Nuevo Expediente Abierto",
                body: `${especialistaNombre} iniciÃ³ el tratamiento de '${tratamientoNombre}' para el paciente ${pacienteNombre}.`
            }
        };

        try {
            const response = await admin.messaging().sendEachForMulticast({ tokens, notification: payload.notification, android: ANDROID_NOTIFICATION_CONFIG, apns: APNS_NOTIFICATION_CONFIG });
            console.log("[DEBUG_ADMIN_NOTIF] NotificaciÃ³n nuevo tratamiento enviada. Response:", response);
            return response;
        } catch(e) {
            console.error("[DEBUG_ADMIN_NOTIF] Error enviando notif nuevo tratamiento:", e);
            return null;
        }
    });

// --- 6. NOTIFICACIÃ“N DE NUEVA SESIÃ“N/EVOLUCIÃ“N (EXPEDIENTE) ---
exports.notificarAdminNuevaSesion = functions.firestore
    .document("sesiones/{sesionId}")
    .onCreate(async (snap, context) => {
        const data = snap.data();
        
        const tokens = await obtenerTokensAdmins();
        if (tokens.length === 0) return null;

        let pacienteNombre = 'un paciente';
        let tratamientoNombre = 'un tratamiento';
        let especialistaNombre = 'Un especialista';

        try {
            // Obtener datos del tratamiento para saber nombre y especialista
            if (data.tratamientoId) {
                const tratamientoSnap = await admin.firestore().collection("tratamientos").doc(data.tratamientoId).get();
                if (tratamientoSnap.exists) {
                    const tData = tratamientoSnap.data();
                    tratamientoNombre = tData.nombre || tratamientoNombre;
                    especialistaNombre = tData.especialistaNombre || especialistaNombre;
                    
                    // Si la sesiÃ³n no tiene pacienteId directo (por alguna razÃ³n), usar el del tratamiento
                    if (!data.pacienteId && tData.pacienteId) {
                        data.pacienteId = tData.pacienteId;
                    }
                }
            }

            // Obtener paciente
            if (data.pacienteId) {
                const pacienteSnap = await admin.firestore().collection("pacientes").doc(data.pacienteId).get();
                if (pacienteSnap.exists) {
                    pacienteNombre = pacienteSnap.data().nombre || pacienteNombre;
                }
            }
        } catch (e) {
            console.error("[DEBUG_ADMIN_NOTIF] Error obteniendo datos para notif sesiÃ³n:", e);
        }

        const payload = {
            notification: {
                title: "ðŸ“ EvoluciÃ³n Registrada",
                body: `${especialistaNombre} firmÃ³ una nueva sesiÃ³n de '${tratamientoNombre}' para el paciente ${pacienteNombre}.`
            }
        };

        try {
            const response = await admin.messaging().sendEachForMulticast({ tokens, notification: payload.notification, android: ANDROID_NOTIFICATION_CONFIG, apns: APNS_NOTIFICATION_CONFIG });
            console.log("[DEBUG_ADMIN_NOTIF] NotificaciÃ³n nueva sesiÃ³n enviada. Response:", response);
            return response;
        } catch(e) {
            console.error("[DEBUG_ADMIN_NOTIF] Error enviando notif nueva sesiÃ³n:", e);
            return null;
        }
    });

// --- NOTIFICACIÃ“N SOLICITUD ELIMINACIÃ“N PACIENTE ---
exports.notificarSolicitudEliminacionPaciente = functions.firestore
    .document("solicitudes_eliminacion_pacientes/{id}")
    .onCreate(async (snap, context) => {
        const data = snap.data();
        const tokens = await obtenerTokensAdmins();
        if (tokens.length === 0) return null;

        const pacienteNombre = data.nombrePaciente || 'Paciente';
        const motivo = data.motivo || 'No especificado';

        const payload = {
            notification: {
                title: "ðŸš¨ Solicitud de EliminaciÃ³n",
                body: `RecepciÃ³n solicita eliminar al paciente '${pacienteNombre}'. Motivo: ${motivo}. Requiere tu aprobaciÃ³n.`
            }
        };

        try {
            const response = await admin.messaging().sendEachForMulticast({ tokens, notification: payload.notification, android: ANDROID_NOTIFICATION_CONFIG, apns: APNS_NOTIFICATION_CONFIG });
            console.log("[DEBUG_ADMIN_NOTIF] NotificaciÃ³n de solicitud de eliminaciÃ³n enviada. Response:", response);
            return response;
        } catch(e) {
            console.error("[DEBUG_ADMIN_NOTIF] Error enviando notif solicitud eliminaciÃ³n:", e);
            return null;
        }
    });

exports.cambiarPasswordStaff = functions.https.onCall(async (data, context) => {
    // 1. Verificar que el usuario que llama es Admin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Debe estar autenticado.');
    }
    
    const callerUid = context.auth.uid;
    const callerEmail = context.auth.token.email ? context.auth.token.email.toLowerCase().trim() : '';
    
    const masterAdmins = [
        'antonio880718@gmail.com',
        'alejandra291714@gmail.com',
        'aleja291714@gmail.com'
    ];
    
    let isAuthorized = masterAdmins.includes(callerEmail);
    
    if (!isAuthorized) {
        const callerSnap = await admin.firestore().collection("usuarios").doc(callerUid).get();
        if (callerSnap.exists) {
            const callerData = callerSnap.data();
            if (callerData.role === 'Administrador') {
                isAuthorized = true;
            }
        }
    }
    
    if (!isAuthorized) {
        throw new functions.https.HttpsError('permission-denied', 'Solo administradores pueden hacer esto.');
    }
    
    const { email, newPassword } = data;
    
    if (!email || !newPassword) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos (email o contraseÃ±a).');
    }
    
    try {
        // 2. Buscar usuario por email
        const user = await admin.auth().getUserByEmail(email);
        const uid = user.uid;
        
        // 3. Actualizar contraseÃ±a
        await admin.auth().updateUser(uid, {
            password: newPassword
        });
        
        // 4. Marcar en Firestore
        await admin.firestore().collection("usuarios").doc(uid).set({
            debeCambiarPassword: true
        }, { merge: true });
        
        return { success: true, message: 'ContraseÃ±a actualizada y forzada a cambio.' };
    } catch (error) {
        console.error("Error cambiando contraseÃ±a:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// --- AUTO-AGENDADO PACIENTES ---

exports.getHorariosOcupados = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Debe estar autenticado.');
    
    const { fecha } = data; // Formato YYYY-MM-DD
    if (!fecha) throw new functions.https.HttpsError('invalid-argument', 'Falta la fecha.');
    
    try {
        const citasSnap = await admin.firestore().collection('citas')
            .where('fechaHora', '>=', `${fecha}T00:00:00`)
            .where('fechaHora', '<=', `${fecha}T23:59:59`)
            .get();
            
        const ocupados = [];
        citasSnap.forEach(doc => {
            const cita = doc.data();
            if (cita.status !== 'Cancelada') {
                ocupados.push(cita.fechaHora); // Ej: 2026-05-12T10:30:00
            }
        });
        
        return { ocupados };
    } catch (error) {
        console.error("Error obteniendo horarios:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// --- AUTO-AGENDADO: devuelve citas del dÃ­a con su duraciÃ³n real ---
exports.getHorariosOcupados = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Debe estar autenticado.');
    const { fecha } = data;
    if (!fecha) throw new functions.https.HttpsError('invalid-argument', 'Falta la fecha.');
    try {
        const citasSnap = await admin.firestore().collection('citas')
            .where('fechaHora', '>=', `${fecha}T00:00:00`)
            .where('fechaHora', '<=', `${fecha}T23:59:59`)
            .get();
        const ocupados = [];
        citasSnap.forEach(doc => {
            const c = doc.data();
            if (c.status !== 'Cancelada') {
                ocupados.push({
                    fechaHora: c.fechaHora,
                    duracionMin: Number(c.duracionMin) || 90
                });
            }
        });
        return { ocupados };
    } catch (error) {
        console.error('Error obteniendo horarios:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.getMisCitas = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Debe estar autenticado.');
    const uid = context.auth.uid;
    
    try {
        // 1. Get paciente ID for this UID
        const pacientesSnap = await admin.firestore().collection("pacientes").where("uid", "==", uid).limit(1).get();
        if (pacientesSnap.empty) return { citas: [] };
        
        const pacienteId = pacientesSnap.docs[0].id;
        
        // 2. Fetch citas for this paciente
        const citasSnap = await admin.firestore().collection("citas").where("pacienteId", "==", pacienteId).get();
        
        const citas = [];
        citasSnap.forEach(doc => {
            citas.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort descending
        citas.sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));
        
        return { citas };
    } catch (error) {
        console.error("Error getting mis citas:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.getMisRecibos = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Debe estar autenticado.');
    const uid = context.auth.uid;
    
    try {
        const pacientesSnap = await admin.firestore().collection("pacientes").where("uid", "==", uid).limit(1).get();
        if (pacientesSnap.empty) return { recibos: [] };
        
        const pacienteId = pacientesSnap.docs[0].id;
        
        const recibosSnap = await admin.firestore().collection("recibos").where("pacienteId", "==", pacienteId).get();
        
        const recibos = [];
        recibosSnap.forEach(doc => {
            recibos.push({ id: doc.id, ...doc.data() });
        });
        
        recibos.sort((a, b) => new Date(b.createdAt || b.fecha || 0) - new Date(a.createdAt || a.fecha || 0));
        
        return { recibos };
    } catch (error) {
        console.error("Error getting mis recibos:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});


exports.notificarNuevaCitaPaciente = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Debe estar autenticado.');
    
    const { citaId, pacienteNombre, fechaHora, especialistaId, especialistaNombre, servicio, fecha, hora } = data;
    const ahoraStr = new Date().toISOString();
    let fechaFormat = fecha || (fechaHora ? new Date(fechaHora).toLocaleDateString('es-MX') : '');
    let horaFormat = hora || (fechaHora ? new Date(fechaHora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '');
    let nomEsp = especialistaNombre;
    let nomServ = servicio;
    let nomPac = pacienteNombre;

    // CONSULTAR DIRECTAMENTE EN FIRESTORE LA CITA SI FALTA EL SERVICIO O ESPECIALISTA
    if (citaId && (!nomServ || nomServ === 'Tratamiento' || !nomEsp || nomEsp === 'Especialista ALFRA' || !nomPac || !fechaFormat || !horaFormat)) {
        try {
            const citaSnap = await admin.firestore().collection('citas').doc(citaId).get();
            if (citaSnap.exists) {
                const cd = citaSnap.data();
                if (!nomServ || nomServ === 'Tratamiento') {
                    nomServ = cd.servicio || cd.tratamiento || cd.nombreServicio || cd.concepto;
                }
                if (!nomEsp || nomEsp === 'Especialista ALFRA') {
                    nomEsp = cd.especialistaNombre || cd.especialista;
                }
                if (!nomPac) {
                    nomPac = cd.pacienteNombre || cd.paciente;
                }
                if (!fechaFormat) {
                    fechaFormat = cd.fecha || cd.fechaYMD || '';
                }
                if (!horaFormat) {
                    horaFormat = cd.hora || '';
                }
            }
        } catch (fetchErr) {
            console.warn('[DEBUG_NOTIF] Error consultando cita en Firestore:', fetchErr);
        }
    }

    nomServ = nomServ || 'Consulta / Tratamiento';
    nomEsp = nomEsp || 'Especialista ALFRA';
    nomPac = nomPac || 'Paciente';
    if (!fechaFormat) fechaFormat = 'próxima fecha';

    try {
        // 1. Guardar en alertas de Firestore para panel web
        const alertDoc = {
            tipo: 'urgente',
            titulo: '¡Nueva Cita desde App Móvil!',
            mensaje: `${nomPac} agendó ${nomServ} para el ${fechaFormat} ${horaFormat} con ${nomEsp}.`,
            fecha: ahoraStr,
            estado: 'activa',
            rolesDestino: ['Administrador', 'Recepcionista'],
            referenciaId: citaId || '',
            especialistaId: especialistaId || '',
            servicio: nomServ,
            pacienteNombre: nomPac,
            creadoEn: ahoraStr
        };

        await Promise.all([
            admin.firestore().collection('alertas_pacientes').add(alertDoc).catch(() => {}),
            admin.firestore().collection('alertas_admin').add(alertDoc).catch(() => {}),
            admin.firestore().collection('alertas_recepcion').add(alertDoc).catch(() => {})
        ]);

        // 2. Enviar PUSH NOTIFICATION CON SONIDO Y VIBRACIÓN A ADMINISTRADORES Y RECEPCIÓN
        const adminTokens = await obtenerTokensAdmins();
        if (adminTokens.length > 0) {
            try {
                const adminPayload = {
                    tokens: adminTokens,
                    notification: {
                        title: "📅 ¡Nueva Cita Agendada en App!",
                        body: `${nomPac} agendó cita de '${nomServ}' para el ${fechaFormat} ${horaFormat} con ${nomEsp}.`
                    },
                    android: ANDROID_NOTIFICATION_CONFIG,
                    apns: APNS_NOTIFICATION_CONFIG,
                    data: { tipo: 'NUEVA_CITA', citaId: String(citaId || '') }
                };
                const admRes = await admin.messaging().sendEachForMulticast(adminPayload);
                console.log("[DEBUG_NOTIF] Push enviado a Administradores/Recepción:", admRes.successCount);
            } catch (errAdm) {
                console.error("[DEBUG_NOTIF] Error enviando push a admins:", errAdm);
            }
        }

        // 3. Enviar PUSH NOTIFICATION AL ESPECIALISTA ASIGNADO
        if (especialistaId) {
            try {
                let espToken = null;
                const uSnap = await admin.firestore().collection("usuarios").doc(especialistaId).get();
                if (uSnap.exists && uSnap.data().fcmToken) {
                    espToken = uSnap.data().fcmToken;
                } else {
                    const stSnap = await admin.firestore().collection("staff").doc(especialistaId).get();
                    if (stSnap.exists) {
                        espToken = stSnap.data().fcmToken;
                        if (!espToken && stSnap.data().email) {
                            const uQ = await admin.firestore().collection("usuarios")
                                .where("email", "==", String(stSnap.data().email).toLowerCase().trim())
                                .limit(1).get();
                            if (!uQ.empty) espToken = uQ.docs[0].data().fcmToken;
                        }
                    }
                }

                if (espToken) {
                    const espPayload = {
                        token: espToken,
                        notification: {
                            title: "📅 ¡Nueva Cita en tu Agenda!",
                            body: `Hola ${nomEsp}, tienes una nueva cita de '${nomServ}' con el paciente ${nomPac} el ${fechaFormat} ${horaFormat}.`
                        },
                        android: ANDROID_NOTIFICATION_CONFIG,
                        apns: APNS_NOTIFICATION_CONFIG,
                        data: { tipo: 'NUEVA_CITA', citaId: String(citaId || '') }
                    };
                    await admin.messaging().send(espPayload);
                    console.log(`[DEBUG_NOTIF] Push enviado al especialista ${nomEsp}`);
                }
            } catch (errEsp) {
                console.error("[DEBUG_NOTIF] Error enviando push al especialista:", errEsp);
            }
        }

        // 4. Enviar PUSH NOTIFICATION DE CONFIRMACIÓN AL PACIENTE
        try {
            const callerUid = context.auth.uid;
            let pacToken = null;
            const pacUserSnap = await admin.firestore().collection("usuarios").doc(callerUid).get();
            if (pacUserSnap.exists && pacUserSnap.data().fcmToken) {
                pacToken = pacUserSnap.data().fcmToken;
            }

            if (pacToken) {
                const pacPayload = {
                    token: pacToken,
                    notification: {
                        title: "✨ Cita Confirmada en Clínica ALFRA",
                        body: `Tu cita de '${nomServ}' con ${nomEsp} quedó confirmada para el ${fechaFormat} a las ${horaFormat}. ¡Te esperamos!`
                    },
                    android: ANDROID_NOTIFICATION_CONFIG,
                    apns: APNS_NOTIFICATION_CONFIG,
                    data: { tipo: 'CONFIRMACION_CITA', citaId: String(citaId || '') }
                };
                await admin.messaging().send(pacPayload);
                console.log("[DEBUG_NOTIF] Push de confirmación enviado al paciente");
            }
        } catch (_) {}

        return { success: true };
    } catch (error) {
        console.error("Error creando alerta y notificando cita:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// --- FUNCIÓN PARA PROBAR NOTIFICACIONES, SONIDO Y VIBRACIÓN EN EL CELULAR EN TIEMPO REAL ---
exports.enviarNotificacionPrueba = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Debe estar autenticado.');
    const uid = context.auth.uid;
    
    let token = data?.token || null;
    if (!token) {
        const uSnap = await admin.firestore().collection("usuarios").doc(uid).get();
        if (uSnap.exists && uSnap.data().fcmToken) {
            token = uSnap.data().fcmToken;
        }
    }
    
    if (!token) {
        const sSnap = await admin.firestore().collection("staff").doc(uid).get();
        if (sSnap.exists && sSnap.data().fcmToken) {
            token = sSnap.data().fcmToken;
        }
    }

    if (!token) {
        // Fallback: buscar cualquier token de admin
        const adminTokens = await obtenerTokensAdmins();
        if (adminTokens.length > 0) token = adminTokens[0];
    }
    
    if (!token) {
        throw new functions.https.HttpsError('not-found', 'No se encontró un token FCM registrado para tu dispositivo. Asegúrate de tener la app abierta en el teléfono.');
    }
    
    const payload = {
        token,
        notification: {
            title: "🔔 ¡Alerta de Prueba Clínica ALFRA!",
            body: "Tu celular está conectado y configurado con éxito. Sonido de timbre y vibración física funcionando al 100%."
        },
        android: ANDROID_NOTIFICATION_CONFIG,
        apns: APNS_NOTIFICATION_CONFIG,
        data: { tipo: 'TEST_ALERT', timestamp: String(Date.now()) }
    };
    
    try {
        const response = await admin.messaging().send(payload);
        console.log("[DEBUG_NOTIF] Notificación de prueba enviada exitosamente:", response);
        return { success: true, response };
    } catch (e) {
        console.error("[DEBUG_NOTIF] Error enviando notificación de prueba:", e);
        throw new functions.https.HttpsError('internal', e.message);
    }
});