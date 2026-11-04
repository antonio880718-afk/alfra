# -*- coding: utf-8 -*-
import sys

with open('src/services/staffService.js', 'r', encoding='utf-8') as f:
    text = f.read()

marker1 = '// Borrar empleado (Soft Delete)'
marker2 = '// Buscar el documento de staff que corresponde al Auth UID'

idx1 = text.find(marker1)
idx2 = text.find(marker2)

if idx1 == -1 or idx2 == -1:
    print("Error: Marcadores no encontrados en staffService.js")
    sys.exit(1)

replacement = """// Borrar empleado y revocar de inmediato todos sus accesos al sistema
export const deleteEmpleado = async (id, staffData = null) => {
    try {
        const staffDocRef = doc(db, 'staff', id);
        
        // 1. Obtener datos actuales del colaborador si no fueron provistos
        let targetStaff = staffData;
        if (!targetStaff) {
            try {
                const snap = await getDoc(staffDocRef);
                if (snap.exists()) targetStaff = snap.data();
            } catch (e) {
                console.warn('Error leyendo doc staff antes de eliminar:', e);
            }
        }

        const ahoraIso = new Date().toISOString();

        // 2. Marcar en staff como Eliminado, Inactivo y con Acceso Revocado
        await updateDoc(staffDocRef, {
            estatus: 'Eliminado',
            eliminado: true,
            activo: false,
            accesoRevocado: true,
            deletedAt: ahoraIso
        });

        // 3. Localizar el UID / email del usuario en la coleccion 'usuarios'
        const targetEmail = targetStaff?.email ? String(targetStaff.email).toLowerCase().trim() : '';
        const targetUid = targetStaff?.uid || null;
        const uidsToRevoke = new Set();

        if (targetUid) {
            uidsToRevoke.add(targetUid);
        }

        // Buscar tambien por correo para asegurar revocacion aunque el uid estuviese desvinculado
        if (targetEmail) {
            try {
                const qEmail = query(collection(db, 'usuarios'), where('email', '==', targetEmail));
                const snapEmail = await getDocs(qEmail);
                snapEmail.forEach(docSnap => {
                    uidsToRevoke.add(docSnap.id);
                });
            } catch (errEmail) {
                console.warn('Error buscando usuario por email al dar de baja:', errEmail);
            }
        }

        // 4. Revocar todos los accesos en la coleccion 'usuarios'
        for (const uid of uidsToRevoke) {
            try {
                const userDocRef = doc(db, 'usuarios', uid);
                await updateDoc(userDocRef, {
                    role: 'Inactivo', // Retira privilegios de Especialista, Recepcionista, Limpieza o Admin
                    activo: false,
                    bloqueado: true,
                    eliminado: true,
                    motivoBaja: 'Baja definitiva de colaborador por Administracion',
                    revocadoAt: ahoraIso,
                    fcmToken: null // Desconecta notificaciones push para evitar envio de alertas
                });
                console.log(`[STAFF] Acceso revocado exitosamente en /usuarios/${uid}`);
            } catch (errUser) {
                console.warn(`Error revocando /usuarios/${uid}:`, errUser);
            }
        }
    } catch (error) {
        console.error("Error al dar de baja al empleado:", error);
        throw error;
    }
};

// Sincronizar bajas: Escanear colaboradores eliminados en 'staff' y garantizar que su cuenta en 'usuarios' este bloqueada
export const sincronizarBajasStaff = async () => {
    try {
        const staffSnap = await getDocs(STAFF_COL);
        const eliminados = staffSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(d => d.eliminado || d.estatus === 'Eliminado');

        if (eliminados.length === 0) return 0;

        let revocadosCount = 0;
        const ahoraIso = new Date().toISOString();

        for (const emp of eliminados) {
            const email = emp.email ? String(emp.email).toLowerCase().trim() : '';
            const uid = emp.uid || null;
            const uids = new Set();
            if (uid) uids.add(uid);

            if (email) {
                try {
                    const qEmail = query(collection(db, 'usuarios'), where('email', '==', email));
                    const snapEmail = await getDocs(qEmail);
                    snapEmail.forEach(d => uids.add(d.id));
                } catch (_) {}
            }

            for (const targetUid of uids) {
                try {
                    const userRef = doc(db, 'usuarios', targetUid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        if (userData.role !== 'Inactivo' || userData.activo !== false || !userData.bloqueado) {
                            await updateDoc(userRef, {
                                role: 'Inactivo',
                                activo: false,
                                bloqueado: true,
                                eliminado: true,
                                motivoBaja: 'Baja sincronizada por Administracion',
                                revocadoAt: ahoraIso,
                                fcmToken: null
                            });
                            revocadosCount++;
                            console.log(`[STAFF] Sincronizada baja de usuario UID: ${targetUid} (${email})`);
                        }
                    }
                } catch (err) {
                    console.warn(`Error sincronizando baja de UID ${targetUid}:`, err);
                }
            }
        }
        return revocadosCount;
    } catch (err) {
        console.warn('Error en sincronizarBajasStaff:', err);
        return 0;
    }
};

"""

new_text = text[:idx1] + replacement + text[idx2:]
with open('src/services/staffService.js', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("staffService.js actualizado con exito.")
