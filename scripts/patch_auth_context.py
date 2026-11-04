# -*- coding: utf-8 -*-
import sys

with open('src/contexts/AuthContext.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add import for onSnapshot and sincronizarBajasStaff
if 'onSnapshot' not in text:
    text = text.replace("import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';", "import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';")

if 'sincronizarBajasStaff' not in text:
    import_sync = "import { sincronizarBajasStaff } from '../services/staffService';\n"
    insert_pos = text.find("const AuthContext = createContext({});")
    text = text[:insert_pos] + import_sync + text[insert_pos:]

# 2. Update onAuthStateChanged logic
marker_auth_start = "const unsubscribe = onAuthStateChanged(auth, async (user) => {"
marker_auth_end = "setLoading(false);\n        });"

idx1 = text.find(marker_auth_start)
idx2 = text.find(marker_auth_end)

if idx1 == -1 or idx2 == -1:
    print("Error: Marcadores de onAuthStateChanged no encontrados en AuthContext.jsx")
    sys.exit(1)

replacement_auth = """const unsubscribe = onAuthStateChanged(auth, async (user) => {
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
                        await signOut(auth);
                        localStorage.clear();
                        setCurrentUser(null);
                        setUserRole(null);
                        setLoading(false);
                        return;
                    }

                    // 2. Verificar tambien en la coleccion 'staff' si el correo esta dado de baja
                    if (emailLow) {
                        try {
                            const { collection, getDocs, query: fsQuery, where: fsWhere } = await import('firebase/firestore');
                            const qStaff = fsQuery(collection(db, 'staff'), fsWhere('email', '==', emailLow));
                            const staffSnap = await getDocs(qStaff);
                            if (!staffSnap.empty) {
                                const stData = staffSnap.docs[0].data();
                                if (stData.eliminado === true || stData.estatus === 'Eliminado' || stData.activo === false) {
                                    console.warn('[AUTH] Colaborador eliminado en staff:', emailLow);
                                    await signOut(auth);
                                    localStorage.clear();
                                    setCurrentUser(null);
                                    setUserRole(null);
                                    setLoading(false);
                                    return;
                                }
                            }
                        } catch (_) {}
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
            """

text = text[:idx1] + replacement_auth + text[idx2:]

# 3. Add Real-time listener for current user expulsion
if 'unsubLiveUser' not in text:
    live_listener = """
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
"""
    insert_point = text.find("const selectRole = (role) => {")
    if insert_point != -1:
        text = text[:insert_point] + live_listener + "\n    " + text[insert_point:]

# 4. Update login function to reject blocked/inactivo users
old_login = """            const userData = await getUserData(uid);
            const role = userData ? userData.role : null;
            const debeCambiar = userData ? userData.debeCambiarPassword : false;
            setDebeCambiarPassword(debeCambiar || false);

            setCurrentUser(cred.user);

            // Si es un admin maestro, asignar acceso directo
            if (masterAdmins.includes(mailLow)) {
                setUserRole('Administrador');
            } else {
                setUserRole(role || 'Paciente');
            }"""

new_login = """            const userData = await getUserData(uid);

            // Si es un admin maestro, asignar acceso directo
            if (masterAdmins.includes(mailLow)) {
                setCurrentUser(cred.user);
                setUserRole('Administrador');
                localStorage.removeItem('mockRole');
                sincronizarBajasStaff().catch(() => {});
                return cred;
            }

            // VALIDACION ESTRICTA DE BAJA
            if (userData?.bloqueado === true || userData?.activo === false || userData?.eliminado === true || userData?.role === 'Inactivo') {
                await signOut(auth);
                localStorage.clear();
                throw new Error('ACCESO DENEGADO: Tu cuenta de colaborador ha sido dada de baja por la administracion de Clinica ALFRA.');
            }

            // Validar si el colaborador esta marcado como eliminado en la coleccion staff
            const { collection: fsCol, getDocs: fsGet, query: fsQ, where: fsW } = await import('firebase/firestore');
            const qStaff = fsQ(fsCol(db, 'staff'), fsW('email', '==', mailLow));
            const staffSnap = await fsGet(qStaff);
            if (!staffSnap.empty) {
                const st = staffSnap.docs[0].data();
                if (st.eliminado === true || st.estatus === 'Eliminado' || st.activo === false) {
                    await signOut(auth);
                    localStorage.clear();
                    throw new Error('ACCESO DENEGADO: Este colaborador ha sido dado de baja de la clinica.');
                }
            }

            const role = userData ? userData.role : null;
            const debeCambiar = userData ? userData.debeCambiarPassword : false;
            setDebeCambiarPassword(debeCambiar || false);

            setCurrentUser(cred.user);
            setUserRole(role || 'Paciente');"""

if old_login in text:
    text = text.replace(old_login, new_login, 1)
    print("Funcion login actualizada con validacion estricta de baja.")
else:
    print("Aviso: old_login no coincidio exactamente.")

with open('src/contexts/AuthContext.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("AuthContext.jsx actualizado con exito.")
