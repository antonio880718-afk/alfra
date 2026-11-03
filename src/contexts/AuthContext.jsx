import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

import { sincronizarBajasStaff } from '../services/staffService';
import { reproducirSonidoNotificacion } from '../services/notificationService';
const AuthContext = createContext({});

// ─── Colección 'usuarios' en Firestore ──────────────────────────────────────
// Estructura: { uid, email, role: 'Administrador'|'Recepcionista'|'Especialista'|'Paciente'|'Limpieza', nombre }
const getUserData = async (uid) => {
    try {
        const snap = await getDoc(doc(db, 'usuarios', uid));
        if (snap.exists()) return snap.data();
        return null;
    } catch { return null; }
};

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [debeCambiarPassword, setDebeCambiarPassword] = useState(false);

    // ── Escuchar estado real de Firebase Auth ──────────────────────────────
    useEffect(() => {
        // 1. Intentar sesión real de Firebase Auth
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                
                const masterAdmins = [
                    'antonio880718@gmail.com',
                    'alejandra291714@gmail.com',
                    'aleja291714@gmail.com'
                ];
                
                const emailLow = user.email ? user.email.toLowerCase().trim() : '';
                
                if (masterAdmins.includes(emailLow)) {
                    setUserRole('Administrador');
                    localStorage.removeItem('mockRole');
                    registerPushNotifications(user.uid);
                    // Sincronizar bajas al iniciar sesion de master admin
                    sincronizarBajasStaff().catch(() => {});
                } else {
                    // 1. Buscar y verificar el rol y estatus en Firestore
                    const userData = await getUserData(user.uid);

                    // REGLA DE BLOQUEO ESTRICTO: Si el usuario fue dado de baja o bloqueado, expulsarlo de inmediato
                    if (userData?.bloqueado === true || userData?.activo === false || userData?.eliminado === true || userData?.role === 'Inactivo') {
                        console.warn('[AUTH] Bloqueo de sesion: usuario dado de baja', user.uid);
                        sessionStorage.setItem('loginError', 'ACCESO DENEGADO: Tu cuenta de colaborador ha sido dada de baja por la administracion de Clinica ALFRA.');
                        await signOut(auth);
                        localStorage.clear();
                        setCurrentUser(null);
                        setUserRole(null);
                        setLoading(false);
                        return;
                    }

                    // 2. Verificar en staff de manera insensible a mayusculas y por UID
                    let estaEliminadoEnStaff = false;
                    try {
                        const { collection, getDocs, query: fsQuery, where: fsWhere, doc: fsDoc, updateDoc: fsUpdateDoc } = await import('firebase/firestore');
                        
                        // Verificar por UID
                        if (user.uid) {
                            const qStaffUid = fsQuery(collection(db, 'staff'), fsWhere('uid', '==', user.uid));
                            const snapStaffUid = await getDocs(qStaffUid);
                            for (const d of snapStaffUid.docs) {
                                const st = d.data();
                                if (st.eliminado === true || st.estatus === 'Eliminado' || st.activo === false) {
                                    estaEliminadoEnStaff = true;
                                    break;
                                }
                            }
                        }

                        // Verificar por email case-insensitive
                        if (!estaEliminadoEnStaff && emailLow) {
                            const snapAllStaff = await getDocs(collection(db, 'staff'));
                            for (const d of snapAllStaff.docs) {
                                const st = d.data();
                                const stEmail = String(st.email || '').toLowerCase().trim();
                                if (stEmail && stEmail === emailLow) {
                                    if (st.eliminado === true || st.estatus === 'Eliminado' || st.activo === false) {
                                        estaEliminadoEnStaff = true;
                                        break;
                                    }
                                }
                            }
                        }

                        if (estaEliminadoEnStaff) {
                            console.warn('[AUTH] Colaborador eliminado en staff detectado:', emailLow || user.uid);
                            // Auto-parchear documento de usuarios para que quede inactivo
                            try {
                                await fsUpdateDoc(fsDoc(db, 'usuarios', user.uid), {
                                    role: 'Inactivo',
                                    activo: false,
                                    bloqueado: true,
                                    eliminado: true,
                                    motivoBaja: 'Baja detectada por eliminacion en staff'
                                });
                            } catch (_) {}

                            sessionStorage.setItem('loginError', 'ACCESO DENEGADO: Tu cuenta de colaborador ha sido dada de baja por la administracion de Clinica ALFRA.');
                            await signOut(auth);
                            localStorage.clear();
                            setCurrentUser(null);
                            setUserRole(null);
                            setLoading(false);
                            return;
                        }
                    } catch (errStaff) {
                        console.warn('Error verificando estatus de staff en onAuthStateChanged:', errStaff);
                    }

                    const role = userData ? userData.role : null;
                    let debeCambiar = userData ? Boolean(userData.debeCambiarPassword) : false;

                    // Si no está marcado en usuarios, revisar en colección staff
                    if (!debeCambiar && (user.uid || emailLow)) {
                        try {
                            const { collection: fsC, query: fsQ, where: fsW, getDocs: fsG } = await import('firebase/firestore');
                            if (user.uid) {
                                const qS = fsQ(fsC(db, 'staff'), fsW('uid', '==', user.uid));
                                const sn = await fsG(qS);
                                for (const d of sn.docs) {
                                    if (d.data().debeCambiarPassword === true) {
                                        debeCambiar = true;
                                        break;
                                    }
                                }
                            }
                            if (!debeCambiar && emailLow) {
                                const qS = fsQ(fsC(db, 'staff'), fsW('email', '==', emailLow));
                                const sn = await fsG(qS);
                                for (const d of sn.docs) {
                                    if (d.data().debeCambiarPassword === true) {
                                        debeCambiar = true;
                                        break;
                                    }
                                }
                            }
                        } catch (_) {}
                    }

                    setDebeCambiarPassword(debeCambiar || false);
                    if (role && role !== 'Inactivo') {
                        setUserRole(role);
                        localStorage.removeItem('mockRole');
                        registerPushNotifications(user.uid);
                    } else {
                        // El usuario existe en Auth pero no en /usuarios -> tratar como Paciente
                        setUserRole('Paciente');
                        registerPushNotifications(user.uid);
                    }
                }
            } else {
                // 2. Fallback: mock session guardada en localStorage (solo para cuentas permitidas)
                const savedRole = localStorage.getItem('mockRole');
                if (savedRole && savedRole !== 'Inactivo') {
                    setCurrentUser({ uid: `mock-${savedRole.toLowerCase()}`, email: 'staff@alfra.com' });
                    setUserRole(savedRole);
                } else {
                    setCurrentUser(null);
                    setUserRole(null);
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // ── Registro de Notificaciones Push (Móvil y Escritorio) ──────
    const registerPushNotifications = async (uid) => {
        // En PC / Navegador Web: solicitar permisos de notificaciones del sistema
        if (!Capacitor.isNativePlatform()) {
            if (typeof window !== 'undefined' && 'Notification' in window) {
                if (Notification.permission === 'default') {
                    try {
                        await Notification.requestPermission();
                    } catch (_) {}
                }
            }
            return;
        }

        try {
            // 1. Pedir permisos nativos
            let permStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive !== 'granted') {
                console.warn('[NOTIF] Permisos de notificación no otorgados');
                return;
            }

            // 2. Crear canal de notificación para Android 8.0+ (Oreo a Android 16)
            if (Capacitor.getPlatform() === 'android') {
                try {
                    await PushNotifications.createChannel({
                        id: 'alfra_citas_alertas',
                        name: 'Citas y Alertas ALFRA',
                        description: 'Notificaciones sobre citas médicas, recordatorios y avisos clínicos',
                        importance: 5, // 5 = High/Heads-up pop-up banner con sonido y vibración
                        visibility: 1, // 1 = Visible en pantalla de bloqueo
                        vibration: true,
                        lights: true,
                        lightColor: '#20B2AA'
                    });
                } catch (chErr) {
                    console.warn('[NOTIF] Aviso al crear canal de notificaciones:', chErr);
                }
            }

            // 3. Registrar ante Firebase Cloud Messaging / APNs
            await PushNotifications.register();

            // 4. Al recibir el Token FCM, guardarlo en Firestore
            PushNotifications.addListener('registration', async (token) => {
                console.log('[NOTIF] Push registration success, token:', token.value);
                const tokenData = {
                    fcmToken: token.value,
                    fcmTokenUpdatedAt: new Date().toISOString(),
                    dispositivo: Capacitor.getPlatform()
                };

                // Guardar en /usuarios/{uid}
                try {
                    await setDoc(doc(db, 'usuarios', uid), tokenData, { merge: true });
                } catch (e) {
                    console.warn('[NOTIF] Error guardando token en usuarios:', e);
                }

                // Sincronizar en /staff/{uid} si es colaborador
                try {
                    const staffRef = doc(db, 'staff', uid);
                    const staffDoc = await getDoc(staffRef);
                    if (staffDoc.exists()) {
                        await setDoc(staffRef, { fcmToken: token.value, fcmTokenUpdatedAt: tokenData.fcmTokenUpdatedAt }, { merge: true });
                    }
                } catch (_) {}

                // Sincronizar en /pacientes si es paciente vinculado
                try {
                    const qPac = query(collection(db, 'pacientes'), where('uid', '==', uid));
                    const pacSnap = await getDocs(qPac);
                    pacSnap.forEach(async (d) => {
                        await setDoc(d.ref, { fcmToken: token.value, fcmTokenUpdatedAt: tokenData.fcmTokenUpdatedAt }, { merge: true });
                    });
                } catch (_) {}
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('[NOTIF] Error en registro push:', error);
            });

            // 5. Notificación entrante (mientras la app está en primer plano)
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('[NOTIF] Push recibido:', notification);
                try {
                    reproducirSonidoNotificacion();
                } catch (_) {}
            });

            // 6. Al tocar la notificación desde la barra de notificaciones del celular
            PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                console.log('[NOTIF] Acción de notificación tocada:', action);
                try {
                    const data = action.notification?.data || {};
                    if (data.url) {
                        window.location.hash = data.url;
                    } else if (data.citaId) {
                        window.location.hash = '/agenda';
                    }
                } catch (_) {}
            });

        } catch (error) {
            console.error('[NOTIF] Error configurando Push Notifications nativas:', error);
        }
    };

    // Escuchar en tiempo real si el admin revoca o da de baja la cuenta del colaborador
    useEffect(() => {
        if (!currentUser?.uid || currentUser.uid.startsWith('mock-') || currentUser.uid.startsWith('master-')) return;

        const masterAdmins = [
            'antonio880718@gmail.com',
            'alejandra291714@gmail.com',
            'aleja291714@gmail.com'
        ];
        if (currentUser.email && masterAdmins.includes(currentUser.email.toLowerCase().trim())) return;

        const unsubLiveUser = onSnapshot(doc(db, 'usuarios', currentUser.uid), async (docSnap) => {
            if (docSnap.exists()) {
                const u = docSnap.data();
                if (u.bloqueado === true || u.activo === false || u.eliminado === true || u.role === 'Inactivo') {
                    console.warn('[AUTH] Cuenta desactivada en tiempo real por el Administrador. Expulsando sesion...');
                    sessionStorage.setItem('loginError', 'ACCESO DENEGADO: Tu cuenta de colaborador ha sido dada de baja por la administracion de Clinica ALFRA.');
                    await signOut(auth);
                    localStorage.clear();
                    setCurrentUser(null);
                    setUserRole(null);
                    window.location.href = '/login';
                }
            }
        }, (err) => console.warn('Error escuchando estado de usuario:', err));

        return () => unsubLiveUser();
    }, [currentUser?.uid]);

    const selectRole = (role) => {
        setUserRole(role);
        localStorage.setItem('selectedRole', role);
    };

    // ── Login ─────────────────────────────────────────────────────────────
    const login = async (email, password) => {
        let mailLow = String(email || '').toLowerCase().trim();
        const isPhone = !mailLow.includes('@');
        let cleanDigits = isPhone ? mailLow.replace(/\D/g, '') : '';
        let matchingPatientDoc = null;

        // ── Si ingresó un número de teléfono (sin '@') ──
        if (isPhone) {
            if (cleanDigits.length < 7) {
                throw new Error('Por favor ingresa un número de teléfono válido (a 10 dígitos) o tu correo electrónico.');
            }

            const { doc: fsDoc, getDoc: fsGetDoc } = await import('firebase/firestore');
            let emailResuelto = null;

            // 1. Consultar directamente en 'directorio_pacientes' (permitido públicamente sin login previo)
            try {
                const snapDir = await fsGetDoc(fsDoc(db, 'directorio_pacientes', cleanDigits));
                if (snapDir.exists()) {
                    const dirData = snapDir.data();
                    matchingPatientDoc = { id: dirData.pacienteId, ...dirData };
                    const m = dirData.email;
                    if (m && String(m).includes('@')) {
                        emailResuelto = String(m).toLowerCase().trim();
                    }
                }
            } catch (errDir) {
                console.warn('Error consultando directorio_pacientes:', errDir);
            }

            // 2. Si no se encontró en directorio (o directorio no ha sincronizado aún), intentar consulta autenticada
            if (!matchingPatientDoc) {
                try {
                    const { collection: fsCol, getDocs: fsGet } = await import('firebase/firestore');
                    const snapP = await fsGet(fsCol(db, 'pacientes'));
                    for (const d of snapP.docs) {
                        const data = d.data();
                        const pTel = String(data.telefono || data.celular || '').replace(/\D/g, '');
                        if (pTel && (pTel === cleanDigits || pTel.endsWith(cleanDigits) || cleanDigits.endsWith(pTel))) {
                            matchingPatientDoc = { id: d.id, ...data };
                            const m = data.email || data.correo;
                            if (m && String(m).includes('@')) {
                                emailResuelto = String(m).toLowerCase().trim();
                            }
                            break;
                        }
                    }
                } catch (_) {}
            }

            if (emailResuelto) {
                mailLow = emailResuelto;
            } else if (matchingPatientDoc) {
                mailLow = `${cleanDigits}@paciente.alfra.mx`;
            } else {
                throw new Error(`No encontramos ningún expediente asociado al teléfono "${cleanDigits}". Si eres paciente nuevo, puedes registrarte abajo.`);
            }

            // Si el usuario no ingresó contraseña
            if (!password) {
                if (matchingPatientDoc && matchingPatientDoc.tienePassword === false) {
                    const errAct = new Error('PACIENTE_REQUIERE_ACTIVACION');
                    errAct.code = 'PACIENTE_REQUIERE_ACTIVACION';
                    errAct.paciente = {
                        id: matchingPatientDoc.id || matchingPatientDoc.pacienteId,
                        nombre: matchingPatientDoc.nombre || '',
                        telefono: matchingPatientDoc.telefono || cleanDigits,
                        email: emailResuelto || matchingPatientDoc.email || ''
                    };
                    throw errAct;
                }
                throw new Error('Por favor ingresa tu contraseña para iniciar sesión.');
            }
        } else {
            if (!password) {
                throw new Error('Por favor ingresa tu contraseña para iniciar sesión.');
            }
        }

        const masterAdmins = [
            'antonio880718@gmail.com',
            'alejandra291714@gmail.com'
        ];

        try {
            // Intentar login real
            const cred = await signInWithEmailAndPassword(auth, mailLow, password);

            // Si inició sesión con teléfono, asegurar sincronización del directorio con tienePassword: true y UID
            if (isPhone && cleanDigits) {
                try {
                    const { doc: fsDoc, setDoc: fsSet } = await import('firebase/firestore');
                    await fsSet(fsDoc(db, 'directorio_pacientes', cleanDigits), {
                        tienePassword: true,
                        uid: cred.user.uid,
                        email: mailLow,
                        pacienteId: matchingPatientDoc?.id || '',
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                } catch(e) {}
            }

            // Sincronización inmediata del expediente clínico real del paciente
            if (matchingPatientDoc && matchingPatientDoc.id) {
                try {
                    const { doc: fsDoc, setDoc: fsSet, updateDoc: fsUp } = await import('firebase/firestore');
                    await fsSet(fsDoc(db, 'usuarios', cred.user.uid), {
                        pacienteId: matchingPatientDoc.id,
                        telefono: cleanDigits || matchingPatientDoc.telefono || '',
                        role: 'Paciente',
                        email: mailLow
                    }, { merge: true });
                    await fsUp(fsDoc(db, 'pacientes', matchingPatientDoc.id), {
                        uid: cred.user.uid,
                        updatedAt: new Date().toISOString()
                    }).catch(() => {});
                } catch(e) {
                    console.warn('Aviso vinculando paciente post-login:', e);
                }
            }
            const uid = cred.user.uid;

            const userData = await getUserData(uid);

            // Si es un admin maestro, asignar acceso directo
            if (masterAdmins.includes(mailLow)) {
                setCurrentUser(cred.user);
                setUserRole('Administrador');
                localStorage.removeItem('mockRole');
                sincronizarBajasStaff().catch(() => {});
                return cred;
            }

            // VALIDACION ESTRICTA DE BAJA EN USUARIOS
            if (userData?.bloqueado === true || userData?.activo === false || userData?.eliminado === true || userData?.role === 'Inactivo') {
                sessionStorage.setItem('loginError', 'ACCESO DENEGADO: Tu cuenta de colaborador ha sido dada de baja por la administracion de Clinica ALFRA.');
                await signOut(auth);
                localStorage.clear();
                throw new Error('ACCESO DENEGADO: Tu cuenta de colaborador ha sido dada de baja por la administracion de Clinica ALFRA.');
            }

            // Validacion exhaustiva en coleccion staff (por UID y por email case-insensitive)
            try {
                const { collection: fsCol, getDocs: fsGet, query: fsQ, where: fsW, doc: fsDoc, updateDoc: fsUpdateDoc } = await import('firebase/firestore');
                let bajaDetectada = false;

                if (uid) {
                    const qStaffUid = fsQ(fsCol(db, 'staff'), fsW('uid', '==', uid));
                    const snapStaffUid = await fsGet(qStaffUid);
                    for (const d of snapStaffUid.docs) {
                        const st = d.data();
                        if (st.eliminado === true || st.estatus === 'Eliminado' || st.activo === false) {
                            bajaDetectada = true;
                            break;
                        }
                    }
                }

                if (!bajaDetectada && mailLow) {
                    const snapAllStaff = await fsGet(fsCol(db, 'staff'));
                    for (const d of snapAllStaff.docs) {
                        const st = d.data();
                        const stEmail = String(st.email || '').toLowerCase().trim();
                        if (stEmail && stEmail === mailLow) {
                            if (st.eliminado === true || st.estatus === 'Eliminado' || st.activo === false) {
                                bajaDetectada = true;
                                break;
                            }
                        }
                    }
                }

                if (bajaDetectada) {
                    try {
                        await fsUpdateDoc(fsDoc(db, 'usuarios', uid), {
                            role: 'Inactivo',
                            activo: false,
                            bloqueado: true,
                            eliminado: true,
                            motivoBaja: 'Baja detectada al intentar login'
                        });
                    } catch (_) {}

                    sessionStorage.setItem('loginError', 'ACCESO DENEGADO: Tu cuenta de colaborador ha sido dada de baja por la administracion de Clinica ALFRA.');
                    await signOut(auth);
                    localStorage.clear();
                    throw new Error('ACCESO DENEGADO: Tu cuenta de colaborador ha sido dada de baja por la administracion de Clinica ALFRA.');
                }
            } catch (errVerif) {
                if (errVerif.message && errVerif.message.includes('ACCESO DENEGADO')) {
                    throw errVerif;
                }
            }

            const role = userData ? userData.role : null;
            let debeCambiar = userData ? Boolean(userData.debeCambiarPassword) : false;

            // REGLA CLAVE ALFRA: Si ingresó con la contraseña genérica Alfra2026! exigir cambio de inmediato
            if (password === 'Alfra2026!') {
                debeCambiar = true;
                try {
                    const { doc: fsDoc, updateDoc: fsUp } = await import('firebase/firestore');
                    await fsUp(fsDoc(db, 'usuarios', uid), {
                        debeCambiarPassword: true,
                        passwordTemporal: 'Alfra2026!'
                    }).catch(() => {});
                } catch (_) {}
            }

            // Si aún no es true, verificar en staff
            if (!debeCambiar && (uid || mailLow)) {
                try {
                    const { collection: fsC, query: fsQ, where: fsW, getDocs: fsG } = await import('firebase/firestore');
                    if (uid) {
                        const qS = fsQ(fsC(db, 'staff'), fsW('uid', '==', uid));
                        const sn = await fsG(qS);
                        for (const d of sn.docs) {
                            if (d.data().debeCambiarPassword === true) {
                                debeCambiar = true;
                                break;
                            }
                        }
                    }
                    if (!debeCambiar && mailLow) {
                        const qS = fsQ(fsC(db, 'staff'), fsW('email', '==', mailLow));
                        const sn = await fsG(qS);
                        for (const d of sn.docs) {
                            if (d.data().debeCambiarPassword === true) {
                                debeCambiar = true;
                                break;
                            }
                        }
                    }
                } catch (_) {}
            }

            setDebeCambiarPassword(debeCambiar || false);

            setCurrentUser(cred.user);
            setUserRole(role || 'Paciente');

            // Identificar si es paciente y cargar info
            if (role === 'Paciente' || !role) {
                // Registrar token para push notifications nativas
                const isNative = Capacitor.isNativePlatform();
                if (isNative) {
                    registerPushNotifications(uid);
                }
            }

            localStorage.removeItem('mockRole');
            return cred;
        } catch (error) {
            // Si el login falla porque el usuario no existe en Auth pero está en directorio:
            if (matchingPatientDoc && (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential')) {
                const errAct = new Error('PACIENTE_REQUIERE_ACTIVACION');
                errAct.code = 'PACIENTE_REQUIERE_ACTIVACION';
                errAct.paciente = {
                    id: matchingPatientDoc.id || matchingPatientDoc.pacienteId,
                    nombre: matchingPatientDoc.nombre || '',
                    telefono: matchingPatientDoc.telefono || cleanDigits,
                    email: mailLow
                };
                throw errAct;
            }

            // BYPASS MAESTRO (Offline/Mock) -> Intentar convertir en usuario REAL
            if (masterAdmins.includes(mailLow) && password === 'Alfra2026!') {
                try {
                    console.log("Intentando crear cuenta real para admin maestro...");
                    const cred = await createUserWithEmailAndPassword(auth, mailLow, password);
                    const uid = cred.user.uid;
                    
                    // Crear documento en /usuarios
                    await setDoc(doc(db, 'usuarios', uid), {
                        uid,
                        email: mailLow,
                        role: 'Administrador',
                        createdAt: new Date().toISOString(),
                    });
                    
                    setCurrentUser(cred.user);
                    setUserRole('Administrador');
                    localStorage.removeItem('mockRole');
                    return cred;
                } catch (createError) {
                    console.warn("No se pudo crear cuenta real (posiblemente ya existe), usando fallback mock:", createError);
                    
                    const mockUid = `master-${mailLow.split('@')[0]}`;
                    const fakeUser = { uid: mockUid, email: mailLow };
                    setCurrentUser(fakeUser);
                    setUserRole('Administrador');
                    localStorage.setItem('mockRole', 'Administrador');
                    
                    const isNative = Capacitor.isNativePlatform();
                    if (isNative) {
                        registerPushNotifications(mockUid);
                    }
                    
                    return { user: fakeUser };
                }
            }
            console.error("Login error:", error);
            throw error;
        }
    };

    const registerPaciente = async ({ email, password, nombre, telefono, fechaNacimiento, comoNosConocio }) => {
        const cleanPhone = String(telefono || '').replace(/\D/g, '');
        
        // Si no se proporcionó correo, se genera uno seguro en base al teléfono
        const targetEmail = (email && String(email).includes('@'))
            ? String(email).toLowerCase().trim()
            : `${cleanPhone || 'paciente'}@paciente.alfra.mx`;

        // 1. Crear cuenta en Firebase Auth
        const cred = await createUserWithEmailAndPassword(auth, targetEmail, password);
        const uid = cred.user.uid;

        // 2. Crear documento en /usuarios con role=Paciente
        await setDoc(doc(db, 'usuarios', uid), {
            uid,
            email: targetEmail,
            nombre: nombre || '',
            telefono: telefono || '',
            role: 'Paciente',
            createdAt: new Date().toISOString(),
        });

        // 3. Buscar si el paciente ya existe en 'pacientes' por correo o teléfono para unificar (Merge)
        const { addDoc, collection, getDocs, updateDoc, doc: firestoreDoc } = await import('firebase/firestore');
        let existingPatientRef = null;
        let matchedPatientId = null;

        try {
            const snapAll = await getDocs(collection(db, 'pacientes'));
            for (const d of snapAll.docs) {
                const data = d.data();
                const pTel = String(data.telefono || data.celular || '').replace(/\D/g, '');
                const pEmail = String(data.email || data.correo || '').toLowerCase().trim();

                const matchTel = cleanPhone && cleanPhone.length >= 7 && pTel && (pTel === cleanPhone || pTel.endsWith(cleanPhone) || cleanPhone.endsWith(pTel));
                const matchEmail = targetEmail && pEmail && pEmail === targetEmail;

                if (matchTel || matchEmail) {
                    existingPatientRef = firestoreDoc(db, 'pacientes', d.id);
                    matchedPatientId = d.id;
                    break;
                }
            }
        } catch (errSearch) {
            console.warn('Busqueda merge paciente omitida:', errSearch);
        }

        if (existingPatientRef) {
            // Unificar cuenta: Actualizar el UID y correo sin borrar historial de citas o tratamientos
            await updateDoc(existingPatientRef, {
                uid,
                email: targetEmail,
                ...(nombre ? { nombre } : {}),
                ...(telefono ? { telefono } : {}),
                ...(fechaNacimiento ? { fechaNacimiento } : {}),
                ...(comoNosConocio ? { comoNosConocio } : {}),
                updatedAt: new Date().toISOString()
            });
            if (matchedPatientId) {
                try {
                    await setDoc(doc(db, 'usuarios', uid), { pacienteId: matchedPatientId }, { merge: true });
                } catch(e) {}
            }
        } else {
            // Crear nuevo perfil si no hay expediente previo en clínica
            const newDoc = await addDoc(collection(db, 'pacientes'), {
                uid,
                nombre: nombre || '',
                email: targetEmail,
                telefono: telefono || '',
                fechaNacimiento: fechaNacimiento || '',
                comoNosConocio: comoNosConocio || '',
                tipoTratamiento: 'Mixto',
                especialistaAsignado: '',
                especialistaAsignadoNombre: '',
                estado: 'Activo',
                sellosLealtad: 0,
                recompensasDisponibles: 0,
                createdAt: new Date().toISOString(),
            });
            matchedPatientId = newDoc.id;
            try {
                await setDoc(doc(db, 'usuarios', uid), { pacienteId: newDoc.id }, { merge: true });
            } catch(e) {}
        }

        // 4. Actualizar directorio_pacientes con estado tienePassword: true
        if (cleanPhone && cleanPhone.length >= 7) {
            try {
                await setDoc(firestoreDoc(db, 'directorio_pacientes', cleanPhone), {
                    telefono: cleanPhone,
                    nombre: nombre || '',
                    email: targetEmail,
                    pacienteId: matchedPatientId,
                    tienePassword: true,
                    uid,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            } catch(errDir) {
                console.warn('Error actualizando directorio_pacientes en registro:', errDir);
            }
        }

        // onAuthStateChanged manejará el estado del usuario
        return cred.user;
    };

    const logout = async () => {
        localStorage.removeItem('mockRole');
        setCurrentUser(null);
        setUserRole(null);
        try { await signOut(auth); } catch { /* ignore */ }
    };

    // ── Reset Password (con soporte a teléfono) ──────────────────────────────────
    const resetPassword = async (emailOrPhone) => {
        let target = String(emailOrPhone || '').trim();
        if (!target.includes('@')) {
            const clean = target.replace(/\D/g, '');
            const { collection: fsCol, getDocs: fsGet } = await import('firebase/firestore');
            let resuelto = null;
            try {
                const snapP = await fsGet(fsCol(db, 'pacientes'));
                for (const d of snapP.docs) {
                    const data = d.data();
                    const pTel = String(data.telefono || data.celular || '').replace(/\D/g, '');
                    if (pTel && (pTel === clean || pTel.endsWith(clean) || clean.endsWith(pTel))) {
                        const m = data.email || data.correo;
                        if (m && String(m).includes('@')) {
                            resuelto = String(m).toLowerCase().trim();
                            break;
                        }
                    }
                }
            } catch (_) {}

            if (!resuelto) {
                try {
                    const snapU = await fsGet(fsCol(db, 'usuarios'));
                    for (const d of snapU.docs) {
                        const data = d.data();
                        const uTel = String(data.telefono || data.celular || '').replace(/\D/g, '');
                        if (uTel && (uTel === clean || uTel.endsWith(clean) || clean.endsWith(uTel))) {
                            const m = data.email || data.correo;
                            if (m && String(m).includes('@')) {
                                resuelto = String(m).toLowerCase().trim();
                                break;
                            }
                        }
                    }
                } catch (_) {}
            }
            if (!resuelto) {
                throw new Error(`No encontramos ningún correo vinculado al teléfono "${clean}".`);
            }
            target = resuelto;
        }
        return sendPasswordResetEmail(auth, target);
    };

    return (
        <AuthContext.Provider value={{ currentUser, userRole, loading, login, logout, registerPaciente, resetPassword, selectRole, debeCambiarPassword, setDebeCambiarPassword }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
