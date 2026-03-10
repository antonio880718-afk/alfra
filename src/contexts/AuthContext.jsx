import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext({});

// ─── Colección 'usuarios' en Firestore ──────────────────────────────────────
// Estructura: { uid, email, role: 'Administrador'|'Recepcionista'|'Especialista'|'Paciente', nombre }
const getUserRole = async (uid) => {
    try {
        const snap = await getDoc(doc(db, 'usuarios', uid));
        if (snap.exists()) return snap.data().role;
        return null;
    } catch { return null; }
};

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);

    // ── Escuchar estado real de Firebase Auth ──────────────────────────────
    useEffect(() => {
        // 1. Intentar sesión real de Firebase Auth
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                // Buscar el rol en Firestore
                const role = await getUserRole(user.uid);
                if (role) {
                    setUserRole(role);
                    localStorage.removeItem('mockRole'); // Limpiar mock si existe
                } else {
                    // El usuario existe en Auth pero no en /usuarios → tratar como Paciente
                    setUserRole('Paciente');
                }
            } else {
                // 2. Fallback: mock session guardada en localStorage (para cuentas de staff)
                const savedRole = localStorage.getItem('mockRole');
                if (savedRole) {
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

    // ── Login ─────────────────────────────────────────────────────────────
    const login = async (email, password) => {
        const mailLow = email.toLowerCase().trim();
        const masterAdmins = [
            'antonio880718@gmail.com',
            'alejandra291714@gmail.com'
        ];

        // ── BYPASS MAESTRO ── 
        // Si es admin conocido y usa la contraseña pactada, forzamos entrada
        // Esto resuelve el problema si la cuenta ya existía con otra clave.
        if (masterAdmins.includes(mailLow) && password === 'Alfra2026!') {
            const mockUid = `master-${mailLow.split('@')[0]}`;
            const fakeUser = { uid: mockUid, email: mailLow };

            // Persistir en Firestore por si acaso
            await setDoc(doc(db, 'usuarios', mockUid), {
                uid: mockUid,
                email: mailLow,
                role: 'Administrador',
                nombre: mailLow.split('@')[0],
                isMaster: true
            }, { merge: true });

            setCurrentUser(fakeUser);
            setUserRole('Administrador');
            localStorage.setItem('mockRole', 'Administrador');
            return { user: fakeUser };
        }

        try {
            const cred = await signInWithEmailAndPassword(auth, mailLow, password);
            const uid = cred.user.uid;

            // Verificar si es Master Admin en login tradicional
            if (masterAdmins.includes(mailLow)) {
                setUserRole('Administrador');
                await setDoc(doc(db, 'usuarios', uid), {
                    uid, email: mailLow, role: 'Administrador', nombre: mailLow.split('@')[0]
                }, { merge: true });
            }

            return cred;
        } catch (error) {
            console.error("Login error:", error);
            throw error;
        }
    };

    // ── Registro de Paciente ───────────────────────────────────────────────
    const registerPaciente = async ({ email, password, nombre, telefono, fechaNacimiento }) => {
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

        // 3. Crear documento en /pacientes (la lista que ve el admin)
        const { addDoc, collection } = await import('firebase/firestore');
        await addDoc(collection(db, 'pacientes'), {
            uid,
            nombre,
            email,
            telefono: telefono || '',
            fechaNacimiento: fechaNacimiento || '',
            tipoTratamiento: 'Por definir',
            especialistaAsignado: '',
            especialistaAsignadoNombre: '',
            estado: 'Activo',
            createdAt: new Date().toISOString(),
        });

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
        <AuthContext.Provider value={{ currentUser, userRole, loading, login, logout, registerPaciente, resetPassword }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
