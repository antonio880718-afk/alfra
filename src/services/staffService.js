import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const STAFF_COL = collection(db, 'staff');

// Obtener todo el staff (empleados)
export const getStaff = async () => {
    try {
        const q = query(STAFF_COL, orderBy('nombre', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(d => !d.eliminado);
    } catch (error) {
        console.error("Error fetching staff:", error);
        return [];
    }
};

// Escuchar cambios en tiempo real al staff
export const onStaffChange = (callback) => {
    const q = query(STAFF_COL, orderBy('nombre', 'asc'));
    return onSnapshot(q, (snapshot) => {
        const staff = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(d => !d.eliminado);
        callback(staff);
    }, (error) => {
        console.error('Error in staff listener:', error);
        callback([]); // fallback — no crashea la UI
    });
};

// Crear nuevo empleado
export const createEmpleado = async (data) => {
    try {
        // Sanitizar objeto para eliminar campos undefined que Firestore rechaza
        const sanitized = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined)
        );
        const docRef = await addDoc(STAFF_COL, {
            ...sanitized,
            saldoComisiones: Number(sanitized.saldoComisiones) || 0,
            estatus: sanitized.estatus || 'Activo',
            createdAt: new Date().toISOString(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Error creating empleado:", error);
        throw error;
    }
};

// Actualizar empleado
export const updateEmpleado = async (id, data) => {
    try {
        const docRef = doc(db, 'staff', id);
        await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
    } catch (error) {
        console.error("Error updating empleado:", error);
        throw error;
    }
};

// Borrar empleado y revocar de inmediato todos sus accesos al sistema
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

// Buscar el documento de staff que corresponde al Auth UID, email o nombre del usuario logueado
// Retorna { id: firestoreDocId, ...data } o null si no lo encuentra
export const getStaffDocByUid = async (uid, email = '', displayName = '') => {
    try {
        if (!uid && !email && !displayName) return null;

        // 1. Buscar por campo uid === uid
        if (uid) {
            const q = query(STAFF_COL, where('uid', '==', uid));
            const snapshot = await getDocs(q);
            const activeDocs = snapshot.docs.filter(d => !d.data().eliminado);
            if (activeDocs.length > 0) {
                const d = activeDocs[0];
                return { id: d.id, ...d.data() };
            }

            // 2. Verificar si el ID del documento es directamente el uid
            const directRef = doc(db, 'staff', uid);
            const directSnap = await getDoc(directRef);
            if (directSnap.exists() && !directSnap.data().eliminado) {
                return { id: directSnap.id, ...directSnap.data() };
            }
        }

        // 3. Fallback: buscar en la colección por correo/email o por nombre y auto-vincular el uid
        const allSnap = await getDocs(STAFF_COL);
        const allStaff = allSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(d => !d.eliminado);

        const norm = (str) => String(str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const targetEmail = String(email || '').trim().toLowerCase();
        const targetName = norm(displayName);

        let matched = null;
        if (targetEmail) {
            matched = allStaff.find(s =>
                String(s.email || s.correo || '').trim().toLowerCase() === targetEmail
            );
        }
        if (!matched && targetName && targetName.length >= 3) {
            matched = allStaff.find(s => {
                const sName = norm(s.nombre);
                return sName === targetName || (sName.length >= 4 && (sName.includes(targetName) || targetName.includes(sName)));
            });
        }

        if (matched) {
            if (uid && matched.uid !== uid) {
                try {
                    await updateDoc(doc(db, 'staff', matched.id), { uid, updatedAt: new Date().toISOString() });
                } catch (linkErr) {
                    console.warn('No se pudo auto-vincular uid en staff:', linkErr);
                }
            }
            return { ...matched, uid: uid || matched.uid };
        }

        return null;
    } catch (error) {
        console.error("Error fetching staff by uid:", error);
        return null;
    }
};

// Escuchar en tiempo real cambios al documento del empleado
export const onStaffDocChange = (staffId, callback) => {
    try {
        const docRef = doc(db, 'staff', staffId);
        return onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                callback({ id: docSnap.id, ...docSnap.data() });
            } else {
                callback(null);
            }
        }, (error) => {
            console.error('Error in staff doc listener:', error);
            callback(null);
        });
    } catch (error) {
        console.error('Error setting up staff doc listener:', error);
        return () => {};
    }
};

// Asignar comisión a un empleado basado en una venta
export const asignarComision = async (staffId, montoVenta, tipoVenta, detalleMotivo, pacienteNombre = '') => {
    try {
        const docRef = doc(db, 'staff', staffId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) return null;

        const staffData = snapshot.data();
        if (!staffData.usaComisiones) return null; // El empleado no tiene el esquema de comisiones activo

        let porcentaje = 0;
        if (tipoVenta === 'Servicio') {
            porcentaje = Number(staffData.comisionServicios) || 0;
        } else if (tipoVenta === 'Producto') {
            porcentaje = Number(staffData.comisionProductos) || 0;
        }

        if (porcentaje <= 0) return null;

        const comisionGanada = (montoVenta * porcentaje) / 100;
        const nuevoSaldo = (Number(staffData.saldoComisiones) || 0) + comisionGanada;

        const nuevoHistorial = staffData.historialComisiones || [];
        nuevoHistorial.push({
            fecha: new Date().toISOString(),
            montoVenta,
            tipoVenta,
            detalleMotivo,
            pacienteNombre: pacienteNombre || '',
            porcentajeAplicado: porcentaje,
            comisionGanada
        });

        await updateDoc(docRef, {
            saldoComisiones: nuevoSaldo,
            historialComisiones: nuevoHistorial,
            updatedAt: new Date().toISOString()
        });

        return comisionGanada;
    } catch (error) {
        console.error("Error asignando comisión:", error);
        throw error;
    }
};

// Ajuste manual de comisión (positivo o negativo)
export const ajustarComisionManual = async (staffId, montoAjuste, motivo) => {
    try {
        const docRef = doc(db, 'staff', staffId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) return null;

        const staffData = snapshot.data();
        const nuevoSaldo = (Number(staffData.saldoComisiones) || 0) + Number(montoAjuste);

        const nuevoHistorial = staffData.historialComisiones || [];
        nuevoHistorial.push({
            fecha: new Date().toISOString(),
            montoVenta: 0,
            tipoVenta: 'Ajuste Manual',
            detalleMotivo: motivo || 'Ajuste administrativo',
            porcentajeAplicado: 0,
            comisionGanada: Number(montoAjuste)
        });

        await updateDoc(docRef, {
            saldoComisiones: nuevoSaldo,
            historialComisiones: nuevoHistorial,
            updatedAt: new Date().toISOString()
        });

        return nuevoSaldo;
    } catch (error) {
        console.error("Error ajustando comisión:", error);
        throw error;
    }
};

// Eliminar una comisión específica del historial
export const eliminarComisionHistorial = async (staffId, index) => {
    try {
        const docRef = doc(db, 'staff', staffId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) return null;

        const staffData = snapshot.data();
        const historial = staffData.historialComisiones || [];
        
        if (index < 0 || index >= historial.length) return null;

        const comisionAEliminar = historial[index];
        const montoARestar = comisionAEliminar.comisionGanada || 0;
        
        const nuevoSaldo = Math.max(0, (Number(staffData.saldoComisiones) || 0) - montoARestar);
        const nuevoHistorial = [...historial];
        nuevoHistorial.splice(index, 1);

        await updateDoc(docRef, {
            saldoComisiones: nuevoSaldo,
            historialComisiones: nuevoHistorial,
            updatedAt: new Date().toISOString()
        });

        return nuevoSaldo;
    } catch (error) {
        console.error("Error eliminando comisión:", error);
        throw error;
    }
};

// Editar monto de venta de una comisión
export const editarComisionHistorial = async (staffId, index, nuevoMontoVenta) => {
    try {
        const docRef = doc(db, 'staff', staffId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) return null;

        const staffData = snapshot.data();
        const historial = staffData.historialComisiones || [];
        
        if (index < 0 || index >= historial.length) return null;

        const comisionAEditar = historial[index];
        const montoComisionAnterior = comisionAEditar.comisionGanada || 0;
        
        const nuevoMontoComision = (Number(nuevoMontoVenta) * Number(comisionAEditar.porcentajeAplicado)) / 100;

        const nuevoHistorial = [...historial];
        nuevoHistorial[index] = {
            ...comisionAEditar,
            montoVenta: Number(nuevoMontoVenta),
            comisionGanada: nuevoMontoComision
        };

        const nuevoSaldo = Math.max(0, (Number(staffData.saldoComisiones) || 0) - montoComisionAnterior + nuevoMontoComision);

        await updateDoc(docRef, {
            saldoComisiones: nuevoSaldo,
            historialComisiones: nuevoHistorial,
            updatedAt: new Date().toISOString()
        });

        return { nuevoSaldo, nuevoHistorial };
    } catch (error) {
        console.error("Error editando comisión:", error);
        throw error;
    }
};

// Liquidar nómina de un empleado (pagar sueldo + comisiones y resetear saldo)
export const liquidarNomina = async (staffId, { periodo, metodoPago, sueldoBase, bonoPuntualidad = 0, bonoProductividad = 0 }) => {
    try {
        const docRef = doc(db, 'staff', staffId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) throw new Error('Empleado no encontrado');

        const staffData = snapshot.data();
        const historial = staffData.historialComisiones || [];

        // Calcular desglose de comisiones
        const usaComisiones = !!staffData.usaComisiones;
        const comisionServicios = usaComisiones ? historial.filter(h => h.tipoVenta === 'Servicio').reduce((acc, h) => acc + Number(h.comisionGanada || 0), 0) : 0;
        const comisionProductos = usaComisiones ? historial.filter(h => h.tipoVenta === 'Producto').reduce((acc, h) => acc + Number(h.comisionGanada || 0), 0) : 0;
        const totalComisiones = usaComisiones ? (Number(staffData.saldoComisiones) || 0) : 0;
        const sueldoFinal = Number(sueldoBase) || Number(staffData.sueldoBase) || 0;
        
        const bonoPunt = Number(bonoPuntualidad) || 0;
        const bonoProd = Number(bonoProductividad) || 0;
        
        const totalNeto = sueldoFinal + totalComisiones + bonoPunt + bonoProd;

        // Generar folio único
        const folio = `NOM-${Date.now().toString().slice(-6)}`;

        // Registro de pago en historialPagos del empleado
        const pagoRegistrado = {
            folio,
            fecha: new Date().toISOString(),
            periodo,
            metodoPago,
            sueldoBase: sueldoFinal,
            comisionServicios,
            comisionProductos,
            totalComisiones,
            bonoPuntualidad: bonoPunt,
            bonoProductividad: bonoProd,
            usaComisiones: !!staffData.usaComisiones,
            usaBonos: !!staffData.usaBonos,
            totalNeto,
            historialComisiones: [...historial], // snapshot del historial al momento del pago
        };

        const historialPagos = staffData.historialPagos || [];
        historialPagos.push(pagoRegistrado);

        // Resetear saldo y guardar
        await updateDoc(docRef, {
            saldoComisiones: 0,
            historialComisiones: [],   // limpiar comisiones al liquidar
            bonoPuntualidad: 0,        // limpiar bonos después del pago
            bonoProductividad: 0,
            historialPagos,
            updatedAt: new Date().toISOString(),
        });

        return {
            ...pagoRegistrado,
            empleadoNombre: staffData.nombre,
            puesto: staffData.puesto,
        };
    } catch (error) {
        console.error('Error liquidando nómina:', error);
        throw error;
    }
};

// ============================================================================
// SERVICIOS DE AUTOSERVICIO: MI PERFIL DE COLABORADOR (STAFF SELF-SERVICE)
// ============================================================================

/**
 * Comprime una imagen a JPEG en Base64 para avatar o rúbrica de firma digital
 */
export const comprimirImagenBase64 = (file, maxWidth = 600, maxHeight = 600, quality = 0.82) => {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
};

/**
 * Obtiene el documento de staff del colaborador activo o lo inicializa si no existe
 */
export const obtenerOCrearPerfilColaborador = async (user, userRole = 'Especialista') => {
    if (!user) return null;
    let staffDoc = await getStaffDocByUid(user.uid, user.email, user.displayName);
    if (!staffDoc) {
        const nuevoStaff = {
            uid: user.uid,
            nombre: user.displayName || user.email?.split('@')[0] || 'Colaborador ALFRA',
            alias: '',
            email: user.email || '',
            puesto: userRole === 'Administrador' ? 'Administrador' : (userRole || 'Especialista'),
            fotoUrl: user.photoURL || '',
            telefono: '',
            biografia: '',
            cedulaProfesional: '',
            cedulaEspecialidad: '',
            universidad: '',
            firmaUrl: '',
            fechaNacimiento: '',
            curp: '',
            rfc: '',
            domicilio: '',
            datosBancarios: { banco: '', clabe: '', titular: '' },
            contactoEmergencia: { nombre: '', parentesco: '', telefono: '' },
            fechaIngreso: new Date().toISOString().split('T')[0],
            sueldoBase: 0,
            comisionServicios: 0,
            comisionProductos: 0,
            saldoComisiones: 0,
            estatus: 'Activo',
            eliminado: false,
            createdAt: new Date().toISOString()
        };
        const id = await createEmpleado(nuevoStaff);
        return { id, ...nuevoStaff };
    }
    return staffDoc;
};

/**
 * Actualiza los campos permitidos del perfil del colaborador (sin alterar comisiones ni sueldos)
 */
export const actualizarMiPerfilColaborador = async (staffId, datosPermitidos) => {
    if (!staffId) throw new Error('Se requiere el ID del colaborador');

    const {
        nombre,
        alias,
        fotoUrl,
        telefono,
        biografia,
        curp,
        rfc,
        domicilio,
        cedulaProfesional,
        cedulaEspecialidad,
        universidad,
        firmaUrl,
        fechaNacimiento,
        datosBancarios,
        contactoEmergencia
    } = datosPermitidos;

    const dataAActualizar = {
        updatedAt: new Date().toISOString()
    };

    if (nombre !== undefined) dataAActualizar.nombre = String(nombre).trim();
    if (alias !== undefined) dataAActualizar.alias = String(alias).trim();
    if (fotoUrl !== undefined) {
        dataAActualizar.fotoUrl = fotoUrl;
        dataAActualizar.foto = fotoUrl;
    }
    if (telefono !== undefined) dataAActualizar.telefono = String(telefono).trim();
    if (biografia !== undefined) dataAActualizar.biografia = String(biografia).trim();
    if (curp !== undefined) dataAActualizar.curp = String(curp).toUpperCase().trim();
    if (rfc !== undefined) dataAActualizar.rfc = String(rfc).toUpperCase().trim();
    if (domicilio !== undefined) dataAActualizar.domicilio = String(domicilio).trim();
    if (cedulaProfesional !== undefined) dataAActualizar.cedulaProfesional = String(cedulaProfesional).trim();
    if (cedulaEspecialidad !== undefined) dataAActualizar.cedulaEspecialidad = String(cedulaEspecialidad).trim();
    if (universidad !== undefined) dataAActualizar.universidad = String(universidad).trim();
    if (firmaUrl !== undefined) dataAActualizar.firmaUrl = firmaUrl;
    if (fechaNacimiento !== undefined) dataAActualizar.fechaNacimiento = String(fechaNacimiento).trim();
    
    if (datosBancarios !== undefined && typeof datosBancarios === 'object') {
        const bancoLimpio = String(datosBancarios.banco || '').trim();
        const clabeLimpia = String(datosBancarios.clabe || '').trim();
        const titularLimpio = String(datosBancarios.titular || '').trim();
        dataAActualizar.datosBancarios = {
            banco: bancoLimpio,
            clabe: clabeLimpia,
            titular: titularLimpio
        };
        dataAActualizar.banco = bancoLimpio;
        dataAActualizar.cuentaClabe = clabeLimpia;
    }

    if (contactoEmergencia !== undefined && typeof contactoEmergencia === 'object') {
        const nom = String(contactoEmergencia.nombre || '').trim();
        const par = String(contactoEmergencia.parentesco || '').trim();
        const tel = String(contactoEmergencia.telefono || '').trim();
        dataAActualizar.contactoEmergencia = {
            nombre: nom,
            parentesco: par,
            telefono: tel
        };
        dataAActualizar.contactoEmergenciaNombre = nom + (par ? ` (${par})` : '');
        dataAActualizar.contactoEmergenciaTelefono = tel;
    }

    await updateEmpleado(staffId, dataAActualizar);
    return dataAActualizar;
};
