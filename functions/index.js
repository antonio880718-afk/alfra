const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// --- CONFIGURACION GLOBAL DE NOTIFICACIONES PUSH FCM (SONIDO Y VIBRACION) ---
const ANDROID_NOTIFICATION_CONFIG = {
    priority: "high",
    notification: {
        channelId: "alfra_citas_urgentes_v2",
        sound: "default",
        defaultSound: true,
        defaultVibrateTimings: true,
        vibrateTimingsMillis: [0, 500, 250, 500, 250, 500],
        priority: "high",
        visibility: "public"
    }
};

const APNS_NOTIFICATION_CONFIG = {
    headers: {
        "apns-priority": "10"
    },
    payload: {
        aps: {
            sound: "default",
            badge: 1,
            contentAvailable: true
        }
    }
};

// --- UTILIDADES GLOBALES PARA OBTENCION ROBUSTA DE TOKENS FCM ---

const extractTokens = (raw, tokenSet) => {
    if (!raw) return;
    if (typeof raw === "string" && raw.trim().length > 15) {
        tokenSet.add(raw.trim());
    } else if (Array.isArray(raw)) {
        raw.forEach(item => {
            if (typeof item === "string" && item.trim().length > 15) {
                tokenSet.add(item.trim());
            }
        });
    }
};

const MASTER_ADMIN_EMAILS = [
    "antonio880718@gmail.com",
    "alejandra291714@gmail.com",
    "aleja291714@gmail.com",
    "recepcion@alfra.com",
    "administracion@alfra.com",
    "admin@alfra.com"
];

/**
 * Recupera todos los tokens de administradores y recepcionistas
 * buscando en 'usuarios' y 'staff' de forma redundante e insensible a mayusculas.
 */
const obtenerTokensAdmins = async () => {
    const tokens = new Set();
    try {
        const rolesTarget = [
            "Administrador", "Recepcionista", "admin", "Recepcion", 
            "recepcionista", "administrador", "Admin", "ADMIN", "SuperAdmin", "Directora"
        ];

        // 1. Coleccion 'usuarios' por roles
        for (const r of rolesTarget) {
            try {
                const snap = await admin.firestore().collection("usuarios").where("role", "==", r).get();
                snap.forEach(doc => {
                    const d = doc.data();
                    extractTokens(d.fcmToken, tokens);
                    extractTokens(d.fcmTokens, tokens);
                });
            } catch (_) {}
        }

        // 2. Coleccion 'usuarios' por emails de administradores maestros
        for (const email of MASTER_ADMIN_EMAILS) {
            try {
                const snapEmail = await admin.firestore().collection("usuarios").where("email", "==", email).get();
                snapEmail.forEach(doc => {
                    const d = doc.data();
                    extractTokens(d.fcmToken, tokens);
                    extractTokens(d.fcmTokens, tokens);
                });
            } catch (_) {}
        }

        // 3. Coleccion 'staff' (escaneo de colaboradores)
        try {
            const staffSnap = await admin.firestore().collection("staff").get();
            for (const doc of staffSnap.docs) {
                const d = doc.data();
                const rol = String(d.rol || d.role || "").toLowerCase();
                const email = String(d.email || "").toLowerCase().trim();
                const esAdminORecep = rol.includes("admin") || rol.includes("recep") || rol.includes("direct") || rol.includes("gerent") || MASTER_ADMIN_EMAILS.includes(email);

                if (esAdminORecep) {
                    extractTokens(d.fcmToken, tokens);
                    extractTokens(d.fcmTokens, tokens);

                    if (d.uid) {
                        try {
                            const uDoc = await admin.firestore().collection("usuarios").doc(d.uid).get();
                            if (uDoc.exists) {
                                const ud = uDoc.data();
                                extractTokens(ud.fcmToken, tokens);
                                extractTokens(ud.fcmTokens, tokens);
                            }
                        } catch (_) {}
                    }
                }
            }
        } catch (eStaff) {
            console.error("[DEBUG_ADMIN_NOTIF] Error escaneando staff:", eStaff);
        }

    } catch (e) {
        console.error("[DEBUG_ADMIN_NOTIF] Error obteniendo tokens de administradores:", e);
    }

    const tokenArray = Array.from(tokens);
    console.log(`[DEBUG_ADMIN_NOTIF] Tokens admin/recepcion encontrados: ${tokenArray.length}`);
    return tokenArray;
};

/**
 * Recupera todos los tokens del especialista buscando en 'usuarios' y 'staff'
 * por doc ID, uid y email.
 */
const obtenerTokensEspecialista = async (especialistaId) => {
    const tokens = new Set();
    if (!especialistaId) return [];

    try {
        // 1. Probar como doc ID directo en 'usuarios'
        try {
            const uSnap = await admin.firestore().collection("usuarios").doc(especialistaId).get();
            if (uSnap.exists) {
                const ud = uSnap.data();
                extractTokens(ud.fcmToken, tokens);
                extractTokens(ud.fcmTokens, tokens);
            }
        } catch (_) {}

        // 2. Probar como doc ID directo en 'staff'
        try {
            const sSnap = await admin.firestore().collection("staff").doc(especialistaId).get();
            if (sSnap.exists) {
                const sData = sSnap.data();
                extractTokens(sData.fcmToken, tokens);
                extractTokens(sData.fcmTokens, tokens);

                if (sData.uid) {
                    try {
                        const uDoc = await admin.firestore().collection("usuarios").doc(sData.uid).get();
                        if (uDoc.exists) {
                            const ud = uDoc.data();
                            extractTokens(ud.fcmToken, tokens);
                            extractTokens(ud.fcmTokens, tokens);
                        }
                    } catch (_) {}
                }

                if (sData.email) {
                    const emailClean = String(sData.email).trim().toLowerCase();
                    try {
                        const uQuery = await admin.firestore().collection("usuarios").where("email", "==", emailClean).get();
                        uQuery.forEach(doc => {
                            const ud = doc.data();
                            extractTokens(ud.fcmToken, tokens);
                            extractTokens(ud.fcmTokens, tokens);
                        });
                    } catch (_) {}
                }
            }
        } catch (_) {}

        // 3. Buscar en 'staff' por campo uid == especialistaId
        try {
            const qStaff = await admin.firestore().collection("staff").where("uid", "==", especialistaId).get();
            qStaff.forEach(doc => {
                const sd = doc.data();
                extractTokens(sd.fcmToken, tokens);
                extractTokens(sd.fcmTokens, tokens);
            });
        } catch (_) {}

    } catch (e) {
        console.error(`[DEBUG_ESP_NOTIF] Error buscando tokens especialista ${especialistaId}:`, e);
    }

    const tokenArray = Array.from(tokens);
    console.log(`[DEBUG_ESP_NOTIF] Tokens encontrados para especialista ${especialistaId}: ${tokenArray.length}`);
    return tokenArray;
};

// --- ALERTA: PACIENTE EN SALA DE ESPERA ---
exports.enviarNotificacionLlegada = functions.firestore
    .document("alertas_pacientes/{alertaId}")
    .onCreate(async (snap, context) => {
        const alertaId = context.params.alertaId;
        const data = snap.data();
        const especialistaId = data.especialistaId;
        const mensaje = data.mensaje;

        if (data.tipo && data.tipo !== 'PACIENTE_LLEGADA') {
            return null;
        }

        console.log(`[DEBUG_NOTIF] Procesando alerta ${alertaId} para especialista: ${especialistaId}`);

        if (!mensaje) {
            console.error(`[DEBUG_NOTIF] Faltan datos en la alerta ${alertaId}`);
            return null;
        }

        try {
            // 1. Notificar al especialista asignado
            const espTokens = await obtenerTokensEspecialista(especialistaId);
            if (espTokens.length > 0) {
                const espPayload = {
                    tokens: espTokens,
                    notification: {
                        title: "🔔 ¡Paciente en Sala de Espera!",
                        body: mensaje
                    },
                    android: ANDROID_NOTIFICATION_CONFIG,
                    apns: APNS_NOTIFICATION_CONFIG,
                    data: { tipo: "PACIENTE_LLEGADA", alertaId: String(alertaId) }
                };
                await admin.messaging().sendEachForMulticast(espPayload);
                console.log(`[DEBUG_NOTIF] Notificacion enviada a especialista (${espTokens.length} dispositivos)`);
            }

            // 2. Notificar tambien a recepcion y administradores
            const adminTokens = await obtenerTokensAdmins();
            if (adminTokens.length > 0) {
                const adminPayload = {
                    tokens: adminTokens,
                    notification: {
                        title: "🔔 Paciente en Espera",
                        body: mensaje
                    },
                    android: ANDROID_NOTIFICATION_CONFIG,
                    apns: APNS_NOTIFICATION_CONFIG,
                    data: { tipo: "PACIENTE_LLEGADA", alertaId: String(alertaId) }
                };
                await admin.messaging().sendEachForMulticast(adminPayload);
            }

            return snap.ref.update({
                estado: "completado",
                enviadoEn: admin.firestore.FieldValue.serverTimestamp()
            });

        } catch (error) {
            console.error(`[DEBUG_NOTIF] ERROR FATAL en llegada:`, error);
            return snap.ref.update({
                estado: "error",
                errorDetalle: error.message
            });
        }
    });

// --- RECORDATORIO DE CITAS (CADA 15 MINUTOS) ---
exports.enviarRecordatorioCita = functions.pubsub
    .schedule("every 15 minutes")
    .onRun(async (context) => {
        const ahora = new Date();
        const unaHoraDespues = new Date(ahora.getTime() + (60 * 60 * 1000));
        const unaHoraYMediaDespues = new Date(ahora.getTime() + (90 * 60 * 1000));

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
                console.log("[DEBUG_REMAINDER] No hay citas proximas para notificar.");
                return null;
            }

            const promises = citasSnap.docs.map(async (doc) => {
                const cita = doc.data();
                const pacienteId = cita.pacienteId;
                if (!pacienteId) return null;

                const tokens = new Set();

                // 1. Buscar en coleccion 'pacientes'
                try {
                    const pacienteSnap = await admin.firestore().collection("pacientes").doc(pacienteId).get();
                    if (pacienteSnap.exists) {
                        const pd = pacienteSnap.data();
                        extractTokens(pd.fcmToken, tokens);
                        extractTokens(pd.fcmTokens, tokens);

                        if (pd.uid) {
                            const uSnap = await admin.firestore().collection("usuarios").doc(pd.uid).get();
                            if (uSnap.exists) {
                                const ud = uSnap.data();
                                extractTokens(ud.fcmToken, tokens);
                                extractTokens(ud.fcmTokens, tokens);
                            }
                        }
                    }
                } catch (_) {}

                const tokenList = Array.from(tokens);
                if (tokenList.length === 0) return null;

                const payload = {
                    tokens: tokenList,
                    notification: {
                        title: "⏰ Recordatorio de Cita",
                        body: `Hola ${cita.pacienteNombre || "Paciente"}, te recordamos tu cita de ${cita.servicio || "Consulta"} en 1 hora en Clinica ALFRA.`
                    },
                    android: ANDROID_NOTIFICATION_CONFIG,
                    apns: APNS_NOTIFICATION_CONFIG,
                    data: { tipo: "RECORDATORIO_CITA", citaId: doc.id }
                };

                try {
                    await admin.messaging().sendEachForMulticast(payload);
                    await doc.ref.update({ notificadoRecordatorio: true });
                    console.log(`[DEBUG_REMAINDER] Notificacion enviada a ${cita.pacienteNombre}`);
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


﻿// --- NOTIFICACIONES POR CAMBIOS EN AGENDA (NUEVA, REAGENDADA, CANCELADA) ---
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
            tipoNotificacion = "NUEVA";
            cita = dataAfter;
        } else if (dataBefore && !dataAfter) {
            tipoNotificacion = "CANCELADA";
            cita = dataBefore;
        } else if (dataBefore && dataAfter) {
            cita = dataAfter;
            if (dataBefore.status !== "Cancelada" && dataAfter.status === "Cancelada") {
                tipoNotificacion = "CANCELADA";
            } else if (
                (dataBefore.status !== "Reagendada" && dataAfter.status === "Reagendada") ||
                (dataBefore.fechaYMD !== dataAfter.fechaYMD) ||
                (dataBefore.hora !== dataAfter.hora) ||
                (dataBefore.fechaHora !== dataAfter.fechaHora)
            ) {
                if (dataAfter.status !== "Cancelada") {
                    tipoNotificacion = "REAGENDADA";
                }
            }
        }

        if (!tipoNotificacion) return null;

        const especialistaId = cita.especialistaId;
        const especialistaNombre = cita.especialistaNombre || cita.especialista || "Doctor(a)";
        const pacienteNombre = cita.paciente || cita.pacienteNombre || "Paciente";
        const servicio = cita.servicio || "Consulta / Tratamiento";
        
        let fechaFormat = "Fecha";
        let horaFormat = "Hora";
        
        try {
            if (cita.fechaHora) {
                const partes = cita.fechaHora.split("T");
                if (partes.length >= 2) {
                    const [y, m, d] = partes[0].split("-");
                    fechaFormat = `${d}/${m}/${y}`;
                    
                    const timeStr = partes[1].substring(0, 5);
                    const [hh, mm] = timeStr.split(":");
                    const h = parseInt(hh, 10);
                    const ampm = h >= 12 ? "PM" : "AM";
                    const h12 = h % 12 || 12;
                    horaFormat = `${h12}:${mm} ${ampm}`;
                }
            } else if (cita.fechaYMD && cita.hora) {
                const [y, m, d] = cita.fechaYMD.split("-");
                fechaFormat = `${d}/${m}/${y}`;
                horaFormat = cita.hora;
            }
        } catch (e) {
            console.warn("[DEBUG_AGENDA] Error formateando fechaHora:", e);
        }

        try {
            let tituloAdmin = "";
            let cuerpoAdmin = "";
            let tituloEsp = "";
            let cuerpoEsp = "";

            if (tipoNotificacion === "NUEVA") {
                tituloAdmin = "📅 ¡Nueva Cita Agendada!";
                cuerpoAdmin = `${pacienteNombre} agendó '${servicio}' para el ${fechaFormat} ${horaFormat} con ${especialistaNombre}.`;
                tituloEsp = "📅 ¡Nueva Cita en tu Agenda!";
                cuerpoEsp = `Hola ${especialistaNombre}, tienes una nueva cita de '${servicio}' con el paciente ${pacienteNombre} para el ${fechaFormat} ${horaFormat}. Prepara tu material y herramientas de trabajo.`;
            } else if (tipoNotificacion === "REAGENDADA") {
                tituloAdmin = "📅 Cita Reagendada";
                cuerpoAdmin = `Se reagendó la cita de ${pacienteNombre} ('${servicio}') para el ${fechaFormat} ${horaFormat} con ${especialistaNombre}.`;
                tituloEsp = "📅 Cita Reagendada";
                cuerpoEsp = `Hola ${especialistaNombre}, se reagendó tu cita de '${servicio}' con el paciente ${pacienteNombre} para el ${fechaFormat} ${horaFormat}.`;
            } else if (tipoNotificacion === "CANCELADA") {
                tituloAdmin = "❌ Cita Cancelada";
                cuerpoAdmin = `Se canceló la cita de ${pacienteNombre} ('${servicio}') programada para el ${fechaFormat} ${horaFormat} con ${especialistaNombre}.`;
                tituloEsp = "❌ Cita Cancelada";
                cuerpoEsp = `Hola ${especialistaNombre}, se canceló la cita de '${servicio}' que tenías con el paciente ${pacienteNombre} el ${fechaFormat} ${horaFormat}.`;
            }

            // ENVIAR A ADMINISTRADORES Y RECEPCION (SIEMPRE)
            const adminTokens = await obtenerTokensAdmins();
            if (adminTokens.length > 0) {
                try {
                    await admin.messaging().sendEachForMulticast({
                        tokens: adminTokens,
                        notification: { title: tituloAdmin, body: cuerpoAdmin },
                        android: ANDROID_NOTIFICATION_CONFIG,
                        apns: APNS_NOTIFICATION_CONFIG,
                        data: { tipo: tipoNotificacion, citaId: String(citaId) }
                    });
                    console.log(`[DEBUG_AGENDA] Push enviado a Admins (${adminTokens.length} dispositivos)`);
                } catch (eAdm) {
                    console.error("[DEBUG_AGENDA] Error enviando a admins:", eAdm);
                }
            }

            // ENVIAR AL ESPECIALISTA ASIGNADO
            if (especialistaId) {
                const espTokens = await obtenerTokensEspecialista(especialistaId);
                if (espTokens.length > 0) {
                    try {
                        await admin.messaging().sendEachForMulticast({
                            tokens: espTokens,
                            notification: { title: tituloEsp, body: cuerpoEsp },
                            android: ANDROID_NOTIFICATION_CONFIG,
                            apns: APNS_NOTIFICATION_CONFIG,
                            data: { tipo: tipoNotificacion, citaId: String(citaId) }
                        });
                        console.log(`[DEBUG_AGENDA] Push enviado a Especialista ${especialistaNombre} (${espTokens.length} dispositivos)`);
                    } catch (eEsp) {
                        console.error("[DEBUG_AGENDA] Error enviando a especialista:", eEsp);
                    }
                }
            }

            // CREAR ALERTA EN TIEMPO REAL PARA PC Y NAVEGADOR
            try {
                await admin.firestore().collection("alertas_pacientes").add({
                    tipo: "CITA_" + tipoNotificacion,
                    titulo: tituloAdmin,
                    mensaje: cuerpoAdmin,
                    estado: "pendiente",
                    citaId: String(citaId),
                    paraRol: "Administrador",
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } catch (_) {}

            return null;

        } catch (error) {
            console.error("[DEBUG_AGENDA] Error en notificarEspecialistaAgenda:", error);
            return null;
        }
    });

// --- 1. NOTIFICACION CANCELACION DE CAJA ---
exports.notificarCancelacionCaja = functions.firestore
    .document("movimientos/{movId}")
    .onUpdate(async (change, context) => {
        const dataBefore = change.before.data();
        const dataAfter = change.after.data();

        if (dataBefore.estado !== "Pendiente Cancelación" && dataAfter.estado === "Pendiente Cancelación") {
            const tokens = await obtenerTokensAdmins();
            if (tokens.length === 0) return null;

            const monto = dataAfter.monto ? `$${Number(dataAfter.monto).toLocaleString("es-MX")}` : "";
            const concepto = dataAfter.motivo || dataAfter.concepto || "Movimiento";
            const motivoCancelacion = dataAfter.motivoCancelacion || "No especificado";

            const payload = {
                notification: {
                    title: "🚨 Solicitud de Cancelación de Movimiento",
                    body: `Recepción solicita cancelar cobro/gasto de ${monto} por '${concepto}'. Motivo: ${motivoCancelacion}. Requiere tu aprobación en caja.`
                }
            };

            try {
                const response = await admin.messaging().sendEachForMulticast({
                    tokens,
                    notification: payload.notification,
                    android: ANDROID_NOTIFICATION_CONFIG,
                    apns: APNS_NOTIFICATION_CONFIG
                });
                console.log("[DEBUG_ADMIN_NOTIF] Notificacion cancelacion caja enviada:", response.successCount);
                return response;
            } catch(e) {
                console.error("[DEBUG_ADMIN_NOTIF] Error enviando notif cancelacion caja:", e);
                return null;
            }
        }
        return null;
    });

// --- 2. NOTIFICACION INVENTARIO BAJO ---
exports.notificarInventarioBajo = functions.firestore
    .document("inventario/{itemId}")
    .onUpdate(async (change, context) => {
        const dataBefore = change.before.data();
        const dataAfter = change.after.data();

        const stockAnterior = Number(dataBefore.stock) || 0;
        const stockActual = Number(dataAfter.stock) || 0;

        if (stockAnterior > 2 && stockActual <= 2) {
            const tokens = await obtenerTokensAdmins();
            if (tokens.length === 0) return null;

            const nombreItem = dataAfter.nombre || "Producto no identificado";

            const payload = {
                notification: {
                    title: "📦 Alerta de Inventario Bajo",
                    body: `El producto '${nombreItem}' está por agotarse (quedan ${stockActual} piezas). Favor de re-ordenar.`
                }
            };

            try {
                const response = await admin.messaging().sendEachForMulticast({
                    tokens,
                    notification: payload.notification,
                    android: ANDROID_NOTIFICATION_CONFIG,
                    apns: APNS_NOTIFICATION_CONFIG
                });
                console.log("[DEBUG_ADMIN_NOTIF] Notificacion inventario bajo enviada:", response.successCount);
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
    .schedule("every day 21:00")
    .timeZone("America/Mexico_City")
    .onRun(async (context) => {
        try {
            const tokens = await obtenerTokensAdmins();
            if (tokens.length === 0) {
                console.log("[DEBUG_ADMIN_NOTIF] Corte diario: No hay tokens de admin.");
                return null;
            }

            const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Mexico_City" }); 
            const hoyStr = formatter.format(new Date()); 

            let ingresos = 0;
            let egresos = 0;
            let totalMovimientos = 0;

            // 1. Coleccion 'finanzas'
            try {
                const finSnap = await admin.firestore().collection("finanzas").get();
                finSnap.forEach(doc => {
                    const mov = doc.data();
                    const rawFecha = mov.fecha || mov.createdAt || "";
                    const fechaDoc = String(rawFecha).substring(0, 10);
                    if (fechaDoc === hoyStr && mov.estado !== "Cancelado") {
                        totalMovimientos++;
                        const monto = Number(mov.monto) || 0;
                        if (mov.tipo === "Ingreso") ingresos += monto;
                        if (mov.tipo === "Egreso") egresos += monto;
                    }
                });
            } catch (eFin) {
                console.error("[DEBUG_ADMIN_NOTIF] Error leyendo finanzas:", eFin);
            }

            // 2. Respaldo 'recibos'
            if (ingresos === 0) {
                try {
                    const recibosSnap = await admin.firestore().collection("recibos").get();
                    recibosSnap.forEach(doc => {
                        const r = doc.data();
                        const rawFecha = r.fecha || r.createdAt || "";
                        const fechaDoc = String(rawFecha).substring(0, 10);
                        if (fechaDoc === hoyStr && r.estado !== "Cancelado") {
                            const monto = Number(r.total || r.monto) || 0;
                            ingresos += monto;
                        }
                    });
                } catch (eRec) {
                    console.error("[DEBUG_ADMIN_NOTIF] Error leyendo recibos:", eRec);
                }
            }

            // 3. Respaldo 'cajas_diarias/{hoyStr}'
            try {
                const cajaDoc = await admin.firestore().collection("cajas_diarias").doc(hoyStr).get();
                if (cajaDoc.exists) {
                    const cData = cajaDoc.data() || {};
                    if (ingresos === 0 && Number(cData.ingresosTotales) > 0) {
                        ingresos = Number(cData.ingresosTotales);
                    }
                    if (egresos === 0 && Number(cData.egresosTotales) > 0) {
                        egresos = Number(cData.egresosTotales);
                    }
                }
            } catch (eCaja) {
                console.error("[DEBUG_ADMIN_NOTIF] Error leyendo cajas_diarias:", eCaja);
            }

            const utilidad = ingresos - egresos;
            const formatoMx = (num) => `$${Number(num).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            const payload = {
                notification: {
                    title: "📊 Corte de Caja del Día",
                    body: `Hoy (${hoyStr}): Ingresos ${formatoMx(ingresos)}, Egresos ${formatoMx(egresos)}. Utilidad: ${formatoMx(utilidad)}.`
                }
            };

            const response = await admin.messaging().sendEachForMulticast({
                tokens,
                notification: payload.notification,
                android: ANDROID_NOTIFICATION_CONFIG,
                apns: APNS_NOTIFICATION_CONFIG,
                data: { tipo: "CORTE_DIARIO", fecha: hoyStr }
            });
            console.log("[DEBUG_ADMIN_NOTIF] Notificacion de corte diario enviada. Exito:", response.successCount);

            try {
                await admin.firestore().collection("alertas_pacientes").add({
                    tipo: "CORTE_DIARIO",
                    titulo: payload.notification.title,
                    mensaje: payload.notification.body,
                    estado: "pendiente",
                    paraRol: "Administrador",
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } catch (_) {}
            return response;
        } catch (error) {
            console.error("[DEBUG_ADMIN_NOTIF] Error en corteDiarioCaja:", error);
            return null;
        }
    });


﻿// --- ENDPOINT HTTP MANUAL PARA TESTEAR EL CORTE DIARIO Y LAS ALERTAS ---
exports.testCorteDiarioManual = functions.https.onRequest(async (req, res) => {
    try {
        const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Mexico_City" }); 
        const hoyStr = req.query.fecha || formatter.format(new Date()); 

        let ingresos = 0;
        let egresos = 0;
        let totalMovimientos = 0;

        const finSnap = await admin.firestore().collection("finanzas").get();
        finSnap.forEach(doc => {
            const mov = doc.data();
            const rawFecha = mov.fecha || mov.createdAt || "";
            const fechaDoc = String(rawFecha).substring(0, 10);
            if (fechaDoc === hoyStr && mov.estado !== "Cancelado") {
                totalMovimientos++;
                const monto = Number(mov.monto) || 0;
                if (mov.tipo === "Ingreso") ingresos += monto;
                if (mov.tipo === "Egreso") egresos += monto;
            }
        });

        if (ingresos === 0) {
            const recibosSnap = await admin.firestore().collection("recibos").get();
            recibosSnap.forEach(doc => {
                const r = doc.data();
                const rawFecha = r.fecha || r.createdAt || "";
                const fechaDoc = String(rawFecha).substring(0, 10);
                if (fechaDoc === hoyStr && r.estado !== "Cancelado") {
                    const monto = Number(r.total || r.monto) || 0;
                    ingresos += monto;
                }
            });
        }

        const cajaDoc = await admin.firestore().collection("cajas_diarias").doc(hoyStr).get();
        if (cajaDoc.exists) {
            const cData = cajaDoc.data() || {};
            if (ingresos === 0 && Number(cData.ingresosTotales) > 0) {
                ingresos = Number(cData.ingresosTotales);
            }
            if (egresos === 0 && Number(cData.egresosTotales) > 0) {
                egresos = Number(cData.egresosTotales);
            }
        }

        const utilidad = ingresos - egresos;
        const tokens = await obtenerTokensAdmins();
        let notifRes = null;
        const debeEnviarPush = req.query.enviarPush !== "0";

        if (tokens.length > 0 && debeEnviarPush) {
            const formatoMx = (num) => `$${Number(num).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const payload = {
                notification: {
                    title: "📊 Corte de Caja del Día (Prueba)",
                    body: `Hoy (${hoyStr}): Ingresos ${formatoMx(ingresos)}, Egresos ${formatoMx(egresos)}. Utilidad: ${formatoMx(utilidad)}.`
                }
            };
            notifRes = await admin.messaging().sendEachForMulticast({
                tokens,
                notification: payload.notification,
                android: ANDROID_NOTIFICATION_CONFIG,
                apns: APNS_NOTIFICATION_CONFIG,
                data: { tipo: "CORTE_DIARIO_TEST", fecha: hoyStr }
            });
        }

        res.json({
            success: true,
            fecha: hoyStr,
            ingresos,
            egresos,
            utilidad,
            totalMovimientos,
            tokensAdminsCount: tokens.length,
            pushEnviado: notifRes ? notifRes.successCount : 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 4. CANCELACION DE CITAS DE ALTO VALOR ---
exports.notificarAdminCancelacionCita = functions.firestore
    .document("citas/{citaId}")
    .onUpdate(async (change, context) => {
        const dataBefore = change.before.data();
        const dataAfter = change.after.data();

        if (dataBefore.status !== "Cancelada" && dataAfter.status === "Cancelada") {
            const servicio = (dataAfter.servicio || "").toLowerCase();
            if (servicio.includes("cirugía") || servicio.includes("tratamiento") || servicio.includes("cirugia")) {
                const tokens = await obtenerTokensAdmins();
                if (tokens.length === 0) return null;

                const pacienteNombre = dataAfter.paciente || dataAfter.pacienteNombre || "Paciente";
                const payload = {
                    notification: {
                        title: "📉 Cancelación Importante",
                        body: `El paciente ${pacienteNombre} canceló su cita de '${dataAfter.servicio}'.`
                    }
                };

                try {
                    const response = await admin.messaging().sendEachForMulticast({
                        tokens,
                        notification: payload.notification,
                        android: ANDROID_NOTIFICATION_CONFIG,
                        apns: APNS_NOTIFICATION_CONFIG
                    });
                    console.log("[DEBUG_ADMIN_NOTIF] Notificacion cancelacion cita enviada:", response.successCount);
                    return response;
                } catch(e) {
                    console.error("[DEBUG_ADMIN_NOTIF] Error enviando notif cancelacion cita:", e);
                    return null;
                }
            }
        }
        return null;
    });

// --- 5. NOTIFICACION DE NUEVO TRATAMIENTO (EXPEDIENTE) ---
exports.notificarAdminNuevoTratamiento = functions.firestore
    .document("tratamientos/{tratamientoId}")
    .onCreate(async (snap, context) => {
        const data = snap.data();
        const especialistaNombre = data.especialistaNombre || "Un especialista";
        const tratamientoNombre = data.nombre || "Tratamiento";
        
        const tokens = await obtenerTokensAdmins();
        if (tokens.length === 0) return null;

        let pacienteNombre = "un paciente";
        try {
            if (data.pacienteId) {
                const pacienteSnap = await admin.firestore().collection("pacientes").doc(data.pacienteId).get();
                if (pacienteSnap.exists) {
                    pacienteNombre = pacienteSnap.data().nombre || "un paciente";
                }
            }
        } catch (e) {
            console.error("[DEBUG_ADMIN_NOTIF] Error obteniendo nombre paciente:", e);
        }

        const payload = {
            notification: {
                title: "📁 Nuevo Expediente Abierto",
                body: `${especialistaNombre} inició el tratamiento de '${tratamientoNombre}' para el paciente ${pacienteNombre}.`
            }
        };

        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens,
                notification: payload.notification,
                android: ANDROID_NOTIFICATION_CONFIG,
                apns: APNS_NOTIFICATION_CONFIG
            });
            console.log("[DEBUG_ADMIN_NOTIF] Notificacion nuevo tratamiento enviada:", response.successCount);
            return response;
        } catch(e) {
            console.error("[DEBUG_ADMIN_NOTIF] Error enviando notif nuevo tratamiento:", e);
            return null;
        }
    });

// --- 6. NOTIFICACION DE NUEVA SESION/EVOLUCION (EXPEDIENTE) ---
exports.notificarAdminNuevaSesion = functions.firestore
    .document("sesiones/{sesionId}")
    .onCreate(async (snap, context) => {
        const data = snap.data();
        
        const tokens = await obtenerTokensAdmins();
        if (tokens.length === 0) return null;

        let pacienteNombre = "un paciente";
        let tratamientoNombre = "un tratamiento";
        let especialistaNombre = "Un especialista";

        try {
            if (data.tratamientoId) {
                const tratamientoSnap = await admin.firestore().collection("tratamientos").doc(data.tratamientoId).get();
                if (tratamientoSnap.exists) {
                    const tData = tratamientoSnap.data();
                    tratamientoNombre = tData.nombre || tratamientoNombre;
                    especialistaNombre = tData.especialistaNombre || especialistaNombre;
                    if (!data.pacienteId && tData.pacienteId) {
                        data.pacienteId = tData.pacienteId;
                    }
                }
            }

            if (data.pacienteId) {
                const pacienteSnap = await admin.firestore().collection("pacientes").doc(data.pacienteId).get();
                if (pacienteSnap.exists) {
                    pacienteNombre = pacienteSnap.data().nombre || pacienteNombre;
                }
            }
        } catch (e) {
            console.error("[DEBUG_ADMIN_NOTIF] Error obteniendo datos para notif sesion:", e);
        }

        const payload = {
            notification: {
                title: "📝 Evolución Registrada",
                body: `${especialistaNombre} firmó una nueva sesión de '${tratamientoNombre}' para el paciente ${pacienteNombre}.`
            }
        };

        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens,
                notification: payload.notification,
                android: ANDROID_NOTIFICATION_CONFIG,
                apns: APNS_NOTIFICATION_CONFIG
            });
            console.log("[DEBUG_ADMIN_NOTIF] Notificacion nueva sesion enviada:", response.successCount);
            return response;
        } catch(e) {
            console.error("[DEBUG_ADMIN_NOTIF] Error enviando notif nueva sesion:", e);
            return null;
        }
    });

// --- NOTIFICACION SOLICITUD ELIMINACION PACIENTE ---
exports.notificarSolicitudEliminacionPaciente = functions.firestore
    .document("solicitudes_eliminacion_pacientes/{id}")
    .onCreate(async (snap, context) => {
        const data = snap.data();
        const tokens = await obtenerTokensAdmins();
        if (tokens.length === 0) return null;

        const pacienteNombre = data.nombrePaciente || "Paciente";
        const motivo = data.motivo || "No especificado";

        const payload = {
            notification: {
                title: "🚨 Solicitud de Eliminación",
                body: `Recepción solicita eliminar al paciente '${pacienteNombre}'. Motivo: ${motivo}. Requiere tu aprobación.`
            }
        };

        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens,
                notification: payload.notification,
                android: ANDROID_NOTIFICATION_CONFIG,
                apns: APNS_NOTIFICATION_CONFIG
            });
            console.log("[DEBUG_ADMIN_NOTIF] Notificacion solicitud eliminacion enviada:", response.successCount);
            return response;
        } catch(e) {
            console.error("[DEBUG_ADMIN_NOTIF] Error enviando notif solicitud eliminacion:", e);
            return null;
        }
    });

// --- CAMBIAR PASSWORD STAFF ---
exports.cambiarPasswordStaff = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
    }
    
    const callerUid = context.auth.uid;
    const callerEmail = context.auth.token.email ? context.auth.token.email.toLowerCase().trim() : "";
    
    let isAuthorized = MASTER_ADMIN_EMAILS.includes(callerEmail);
    
    if (!isAuthorized) {
        const callerSnap = await admin.firestore().collection("usuarios").doc(callerUid).get();
        if (callerSnap.exists) {
            const callerData = callerSnap.data();
            if (callerData.role === "Administrador") {
                isAuthorized = true;
            }
        }
    }
    
    if (!isAuthorized) {
        throw new functions.https.HttpsError("permission-denied", "Solo administradores pueden hacer esto.");
    }
    
    const { email, newPassword } = data;
    
    if (!email || !newPassword) {
        throw new functions.https.HttpsError("invalid-argument", "Faltan datos (email o contraseña).");
    }
    
    try {
        const user = await admin.auth().getUserByEmail(email);
        const uid = user.uid;
        
        await admin.auth().updateUser(uid, {
            password: newPassword
        });
        
        await admin.firestore().collection("usuarios").doc(uid).set({
            debeCambiarPassword: true
        }, { merge: true });
        
        return { success: true, message: "Contraseña actualizada y forzada a cambio." };
    } catch (error) {
        console.error("Error cambiando contraseña:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});


﻿// --- AUTO-AGENDADO PACIENTES: HORARIOS OCUPADOS CON DURACION REAL ---
exports.getHorariosOcupados = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
    const { fecha } = data;
    if (!fecha) throw new functions.https.HttpsError("invalid-argument", "Falta la fecha.");
    try {
        const citasSnap = await admin.firestore().collection("citas")
            .where("fechaHora", ">=", `${fecha}T00:00:00`)
            .where("fechaHora", "<=", `${fecha}T23:59:59`)
            .get();
        const ocupados = [];
        citasSnap.forEach(doc => {
            const c = doc.data();
            if (c.status !== "Cancelada") {
                ocupados.push({
                    fechaHora: c.fechaHora,
                    duracionMin: Number(c.duracionMin) || 90
                });
            }
        });
        return { ocupados };
    } catch (error) {
        console.error("Error obteniendo horarios:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// --- MIS CITAS PACIENTE ---
exports.getMisCitas = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
    const uid = context.auth.uid;
    
    try {
        const pacientesSnap = await admin.firestore().collection("pacientes").where("uid", "==", uid).limit(1).get();
        if (pacientesSnap.empty) return { citas: [] };
        
        const pacienteId = pacientesSnap.docs[0].id;
        const citasSnap = await admin.firestore().collection("citas").where("pacienteId", "==", pacienteId).get();
        
        const citas = [];
        citasSnap.forEach(doc => {
            citas.push({ id: doc.id, ...doc.data() });
        });
        
        citas.sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));
        return { citas };
    } catch (error) {
        console.error("Error getting mis citas:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// --- MIS RECIBOS PACIENTE ---
exports.getMisRecibos = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
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
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// --- NOTIFICAR NUEVA CITA DESDE APP MOVIL DE PACIENTE ---
exports.notificarNuevaCitaPaciente = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
    
    const { citaId, pacienteNombre, fechaHora, especialistaId, especialistaNombre, servicio, fecha, hora } = data;
    const ahoraStr = new Date().toISOString();
    let fechaFormat = fecha || (fechaHora ? new Date(fechaHora).toLocaleDateString("es-MX") : "");
    let horaFormat = hora || (fechaHora ? new Date(fechaHora).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "");
    let nomEsp = especialistaNombre;
    let nomServ = servicio;
    let nomPac = pacienteNombre;

    if (citaId && (!nomServ || nomServ === "Tratamiento" || !nomEsp || nomEsp === "Especialista ALFRA" || !nomPac || !fechaFormat || !horaFormat)) {
        try {
            const citaSnap = await admin.firestore().collection("citas").doc(citaId).get();
            if (citaSnap.exists) {
                const cd = citaSnap.data();
                if (!nomServ || nomServ === "Tratamiento") {
                    nomServ = cd.servicio || cd.tratamiento || cd.nombreServicio || cd.concepto;
                }
                if (!nomEsp || nomEsp === "Especialista ALFRA") {
                    nomEsp = cd.especialistaNombre || cd.especialista;
                }
                if (!nomPac) {
                    nomPac = cd.pacienteNombre || cd.paciente;
                }
                if (!fechaFormat) {
                    fechaFormat = cd.fecha || cd.fechaYMD || "";
                }
                if (!horaFormat) {
                    horaFormat = cd.hora || "";
                }
            }
        } catch (fetchErr) {
            console.warn("[DEBUG_NOTIF] Error consultando cita en Firestore:", fetchErr);
        }
    }

    nomServ = nomServ || "Consulta / Tratamiento";
    nomEsp = nomEsp || "Especialista ALFRA";
    nomPac = nomPac || "Paciente";
    if (!fechaFormat) fechaFormat = "próxima fecha";

    try {
        const alertDoc = {
            tipo: "urgente",
            titulo: "¡Nueva Cita desde App Móvil!",
            mensaje: `${nomPac} agendó ${nomServ} para el ${fechaFormat} ${horaFormat} con ${nomEsp}.`,
            fecha: ahoraStr,
            estado: "activa",
            rolesDestino: ["Administrador", "Recepcionista"],
            referenciaId: citaId || "",
            especialistaId: especialistaId || "",
            servicio: nomServ,
            pacienteNombre: nomPac,
            creadoEn: ahoraStr
        };

        await Promise.all([
            admin.firestore().collection("alertas_pacientes").add(alertDoc).catch(() => {}),
            admin.firestore().collection("alertas_admin").add(alertDoc).catch(() => {}),
            admin.firestore().collection("alertas_recepcion").add(alertDoc).catch(() => {})
        ]);

        // 1. Notificar a Administradores y Recepcion
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
                    data: { tipo: "NUEVA_CITA", citaId: String(citaId || "") }
                };
                await admin.messaging().sendEachForMulticast(adminPayload);
                console.log("[DEBUG_NOTIF] Push enviado a Administradores:", adminTokens.length);
            } catch (errAdm) {
                console.error("[DEBUG_NOTIF] Error enviando push a admins:", errAdm);
            }
        }

        // 2. Notificar al Especialista asignado
        if (especialistaId) {
            try {
                const espTokens = await obtenerTokensEspecialista(especialistaId);
                if (espTokens.length > 0) {
                    const espPayload = {
                        tokens: espTokens,
                        notification: {
                            title: "📅 ¡Nueva Cita en tu Agenda!",
                            body: `Hola ${nomEsp}, tienes una nueva cita de '${nomServ}' con el paciente ${nomPac} el ${fechaFormat} ${horaFormat}.`
                        },
                        android: ANDROID_NOTIFICATION_CONFIG,
                        apns: APNS_NOTIFICATION_CONFIG,
                        data: { tipo: "NUEVA_CITA", citaId: String(citaId || "") }
                    };
                    await admin.messaging().sendEachForMulticast(espPayload);
                    console.log(`[DEBUG_NOTIF] Push enviado al especialista ${nomEsp}`);
                }
            } catch (errEsp) {
                console.error("[DEBUG_NOTIF] Error enviando push al especialista:", errEsp);
            }
        }

        // 3. Notificar al Paciente confirmacion
        try {
            const callerUid = context.auth.uid;
            const pacTokens = new Set();
            const pacUserSnap = await admin.firestore().collection("usuarios").doc(callerUid).get();
            if (pacUserSnap.exists) {
                extractTokens(pacUserSnap.data().fcmToken, pacTokens);
                extractTokens(pacUserSnap.data().fcmTokens, pacTokens);
            }

            const pacTokenList = Array.from(pacTokens);
            if (pacTokenList.length > 0) {
                const pacPayload = {
                    tokens: pacTokenList,
                    notification: {
                        title: "✨ Cita Confirmada en Clínica ALFRA",
                        body: `Tu cita de '${nomServ}' con ${nomEsp} quedó confirmada para el ${fechaFormat} a las ${horaFormat}. ¡Te esperamos!`
                    },
                    android: ANDROID_NOTIFICATION_CONFIG,
                    apns: APNS_NOTIFICATION_CONFIG,
                    data: { tipo: "CONFIRMACION_CITA", citaId: String(citaId || "") }
                };
                await admin.messaging().sendEachForMulticast(pacPayload);
                console.log("[DEBUG_NOTIF] Push de confirmacion enviado al paciente");
            }
        } catch (_) {}

        return { success: true };
    } catch (error) {
        console.error("Error creando alerta y notificando cita:", error);
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// --- FUNCION DE PRUEBA DE NOTIFICACION EN TIEMPO REAL ---
exports.enviarNotificacionPrueba = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Debe estar autenticado.");
    const uid = context.auth.uid;
    
    const tokens = new Set();
    if (data?.token) {
        extractTokens(data.token, tokens);
    }
    
    try {
        const uSnap = await admin.firestore().collection("usuarios").doc(uid).get();
        if (uSnap.exists) {
            extractTokens(uSnap.data().fcmToken, tokens);
            extractTokens(uSnap.data().fcmTokens, tokens);
        }
    } catch (_) {}

    try {
        const sSnap = await admin.firestore().collection("staff").doc(uid).get();
        if (sSnap.exists) {
            extractTokens(sSnap.data().fcmToken, tokens);
            extractTokens(sSnap.data().fcmTokens, tokens);
        }
    } catch (_) {}

    if (tokens.size === 0) {
        const adminTokens = await obtenerTokensAdmins();
        adminTokens.forEach(t => tokens.add(t));
    }
    
    const tokenList = Array.from(tokens);
    if (tokenList.length === 0) {
        throw new functions.https.HttpsError("not-found", "No se encontró un token FCM registrado para tu dispositivo. Abre la app en el teléfono para registrarlo.");
    }
    
    const payload = {
        tokens: tokenList,
        notification: {
            title: "🔔 ¡Alerta de Prueba Clínica ALFRA!",
            body: "Tu celular está conectado y configurado con éxito. Sonido de timbre y vibración física funcionando al 100%."
        },
        android: ANDROID_NOTIFICATION_CONFIG,
        apns: APNS_NOTIFICATION_CONFIG,
        data: { tipo: "TEST_ALERT", timestamp: String(Date.now()) }
    };
    
    try {
        const response = await admin.messaging().sendEachForMulticast(payload);
        console.log("[DEBUG_NOTIF] Notificacion de prueba enviada:", response.successCount);
        return { success: true, count: response.successCount, responses: response.responses };
    } catch (e) {
        console.error("[DEBUG_NOTIF] Error enviando notificacion de prueba:", e);
        throw new functions.https.HttpsError("internal", e.message);
    }
});


