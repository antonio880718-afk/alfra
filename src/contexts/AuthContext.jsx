import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

import { sincronizarBajasStaff } from '../services/staffService';
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
                    const debeCambiar = userData ? userData.debeCambiarPassword : false;
                    setDebeCambiarPassword(debeCambiar || false);
                    if (role && role !== 'Inactivo') {
                        setUserRole(role);
                        localStorage.removeItem('mockRole');
                        registerPushNotifications(user.uid);
                    } else {
                        // El usuario existe en Auth pero no en /usuarios -> tratar como Paciente
                        setUserRole('Paciente');
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

    // ── Registro de Notificaciones Push (Solo Especialistas / Móvil) ──────
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
                throw new Error('Permisos de notificacion denegados');
            }

            // 2. Registrar con Apple / Google
            await PushNotifications.register();

            // 3. Obtener el Token
            PushNotifications.addListener('registration', async (token) => {
                console.log('Push registration success, token: ' + token.value);
                // 4. Guardarlo en Firestore (setDoc merge para crear o actualizar)
                await setDoc(doc(db, 'usuarios', uid), {
                    fcmToken: token.value,
                    fcmTokenUpdatedAt: new Date().toISOString()
                }, { merge: true });
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('Error on registration: ' + JSON.stringify(error));
            });

            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('Push received: ' + JSON.stringify(notification));
                try {
                    const audio = new Audio('/notification.mp3');
                    audio.play().catch(() => {});
                } catch (_) {}
            });

        } catch (error) {
            console.error('Error registrando Push Notifications:', error);
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
        const mailLow = email.toLowerCase().trim();
        const masterAdmins = [
            'antonio880718@gmail.com',
            'alejandra291714@gmail.com'
        ];

        try {
            // Intentar login real
            const cred = await signInWithEmailAndPassword(auth, mailLow, password);
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
            const debeCambiar = userData ? userData.debeCambiarPassword : false;
            setDebeCambiarPassword(debeCambiar || false);

            setCurrentUser(cred.user);
            setUserRole(role || 'Paciente');

            localStorage.removeItem('mockRole');
            return cred;
        } catch (error) {
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

    // ── Registro de Paciente ───────────────────────────────────────────────
    const registerPaciente = async ({ email, password, nombre, telefono, fechaNacimiento, comoNosConocio }) => {
        // 1. Crear cuenta en Firebase Auth
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = cred.user.uid;

        // 2. Crear documento en /usuarios con role=Paciente
        await setDoc(doc(db, 'usuarios', uid), {
            uid,
            email,
            nombre,
            role: 'Paciente',
            createdAt: new Date().toISOString(),
        });

        // 3. Buscar si el paciente ya existe por correo o telefono para unificar (Merge)
        const { addDoc, collection, getDocs, updateDoc, query: fsQuery, where: fsWhere, doc: firestoreDoc } = await import('firebase/firestore');
        let existingPatientRef = null;
        let matchedPatientId = null;

        const targetEmail = email ? String(email).toLowerCase().trim() : '';
        const targetPhone = telefono ? String(telefono).replace(/\D/g, '') : '';
        const EXCLUDED_PHONES = ['4591155385'];

        if (targetEmail) {
            try {
                const qEmail = fsQuery(collection(db, 'pacientes'), fsWhere('email', '==', targetEmail));
                const snapEmail = await getDocs(qEmail);
                if (!snapEmail.empty) {
                    existingPatientRef = firestoreDoc(db, 'pacientes', snapEmail.docs[0].id);
                    matchedPatientId = snapEmail.docs[0].id;
                }
            } catch (err) {
                console.warn('Busqueda merge email omitida:', err);
            }
        }

        if (!existingPatientRef && targetPhone && targetPhone.length >= 7 && !EXCLUDED_PHONES.includes(targetPhone)) {
            try {
                const qTel = fsQuery(collection(db, 'pacientes'), fsWhere('telefono', '==', targetPhone));
                const snapTel = await getDocs(qTel);
                if (!snapTel.empty) {
                    existingPatientRef = firestoreDoc(db, 'pacientes', snapTel.docs[0].id);
                    matchedPatientId = snapTel.docs[0].id;
                }
            } catch (err) {
                console.warn('Busqueda merge telefono omitida:', err);
            }
        }

        if (existingPatientRef) {
            // Unificar cuenta: Actualizar el UID sin borrar historial de citas o tratamientos
            await updateDoc(existingPatientRef, {
                uid,
                email,
                nombre: nombre || '',
                telefono: telefono || '',
                fechaNacimiento: fechaNacimiento || '',
                ...(comoNosConocio ? { comoNosConocio } : {}),
                updatedAt: new Date().toISOString()
            });
            if (matchedPatientId) {
                try {
                    await setDoc(doc(db, 'usuarios', uid), { pacienteId: matchedPatientId }, { merge: true });
                } catch(e) {}
            }
        } else {
            // Crear nuevo perfil si no hay coincidencias
            const newDoc = await addDoc(collection(db, 'pacientes'), {
                uid,
                nombre,
                email,
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
            try {
                await setDoc(doc(db, 'usuarios', uid), { pacienteId: newDoc.id }, { merge: true });
            } catch(e) {}
        }

        // onAuthStateChanged manejará el estado del usuario
        return cred.user;
    };

    // ── Logout ────────────────────────────────────────────────────────────
    const logout = async () => {
        localStorage.removeItem('mockRole');
        setCurrentUser(null);
        setUserRole(null);
        try { await signOut(auth); } catch { /* ignore */ }
    };

    // ── Reset Password ────────────────────────────────────────────────────
    const resetPassword = (email) => {
        return sendPasswordResetEmail(auth, email);
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
