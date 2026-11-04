# -*- coding: utf-8 -*-
import sys

with open('src/contexts/AuthContext.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update onAuthStateChanged staff verification
marker_start = "// REGLA DE BLOQUEO ESTRICTO: Si el usuario fue dado de baja o bloqueado, expulsarlo de inmediato"
marker_end = "const role = userData ? userData.role : null;"

idx1 = text.find(marker_start)
idx2 = text.find(marker_end)

if idx1 == -1 or idx2 == -1:
    print("Error: Marcadores no encontrados en AuthContext.jsx")
    sys.exit(1)

replacement_block = """// REGLA DE BLOQUEO ESTRICTO: Si el usuario fue dado de baja o bloqueado, expulsarlo de inmediato
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

                    """

text = text[:idx1] + replacement_block + text[idx2:]

# 2. Update real-time listener to store sessionStorage error
old_live = """                if (u.bloqueado === true || u.activo === false || u.eliminado === true || u.role === 'Inactivo') {
                    console.warn('[AUTH] Cuenta desactivada en tiempo real por el Administrador. Expulsando sesion...');
                    await signOut(auth);
                    localStorage.clear();
                    setCurrentUser(null);
                    setUserRole(null);
                    window.location.href = '/login';
                }"""

new_live = """                if (u.bloqueado === true || u.activo === false || u.eliminado === true || u.role === 'Inactivo') {
                    console.warn('[AUTH] Cuenta desactivada en tiempo real por el Administrador. Expulsando sesion...');
                    sessionStorage.setItem('loginError', 'ACCESO DENEGADO: Tu cuenta de colaborador ha sido dada de baja por la administracion de Clinica ALFRA.');
                    await signOut(auth);
                    localStorage.clear();
                    setCurrentUser(null);
                    setUserRole(null);
                    window.location.href = '/login';
                }"""

if old_live in text:
    text = text.replace(old_live, new_live, 1)
    print("Real-time listener actualizado con loginError en sessionStorage.")
else:
    print("Aviso: old_live no coincidio exactamente.")

# 3. Update login function to store sessionStorage error and robust staff lookup
old_login_block = """            // VALIDACION ESTRICTA DE BAJA
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
            }"""

new_login_block = """            // VALIDACION ESTRICTA DE BAJA EN USUARIOS
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
            }"""

if old_login_block in text:
    text = text.replace(old_login_block, new_login_block, 1)
    print("Bloque de login en AuthContext actualizado con verificacion exhaustiva.")
else:
    print("Aviso: old_login_block no coincidio exactamente.")

with open('src/contexts/AuthContext.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("AuthContext.jsx actualizado con exito.")
