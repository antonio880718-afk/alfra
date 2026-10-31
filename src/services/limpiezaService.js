import { collection, addDoc, updateDoc, doc, getDocs, getDoc, query, where, orderBy, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

// ============================================================================
// ESPACIOS DE LA CLÍNICA Y PROTOCOLOS OFICIALES COFEPRIS
// NOM-016-SSA3-2012 / NOM-005-SSA3-2010
// ============================================================================
export const ESPACIOS_CLINICA = [
    {
        id: 'cabina_facial',
        nombre: 'Cabina Facial',
        tipoArea: 'Crítica / Aséptica',
        quimicoSugerido: 'Cuaternario de Amonio 5ta Gen. (0.5%) y Alcohol Isopropílico 70%',
        tecnica: 'Doble balde y limpieza unidireccional de superficies',
        tareas: [
            'Barrer y trapear con desinfectante',
            'Limpiar y desinfectar camilla clínica',
            'Desinfectar superficies de trabajo y carritos auxiliares',
            'Limpiar espejos y cristales',
            'Lavar y desinfectar lavamanos / sanitario',
            'Retirar y encamisar botes de basura'
        ]
    },
    {
        id: 'cabina_corporal',
        nombre: 'Cabina Corporal & Sauna',
        tipoArea: 'Crítica / Aséptica',
        quimicoSugerido: 'Cuaternario de Amonio 5ta Gen. y Solución Clorada 0.1%',
        tecnica: 'Trapeado húmedo y sanitización profunda',
        tareas: [
            'Barrer y trapear con desinfectante',
            'Desinfección de camillas y protectores',
            'Limpieza y secado de cabina de sauna',
            'Limpiar espejos y manerales',
            'Lavar y desinfectar sanitario y regadera',
            'Retirar y encamisar botes de basura'
        ]
    },
    {
        id: 'cabina_capilar',
        nombre: 'Cabina Capilar',
        tipoArea: 'Semicrítica',
        quimicoSugerido: 'Detergente enzimático y Alcohol Isopropílico 70%',
        tecnica: 'Limpieza mecánica y desinfección de superficies',
        tareas: [
            'Barrer y trapear con desinfectante',
            'Desinfectar sillón / camilla capilar',
            'Limpieza profunda de lavacabezas y desagües',
            'Limpiar espejos',
            'Retirar residuos capilares y basura'
        ]
    },
    {
        id: 'banos_generales',
        nombre: 'Baños Generales / Pacientes',
        tipoArea: 'Crítica / Sanitaria',
        quimicoSugerido: 'Hipoclorito de Sodio 0.1% y Desincrustante bactericida',
        tecnica: 'Lavado con cepillo, enjuague y trapeado con doble cubeta',
        tareas: [
            'Lavar y desinfectar inodoros y mingitorios',
            'Lavar lavabos, grifería y espejos',
            'Reponer papel higiénico, toallas y jabón',
            'Trapear con solución clorada y aromatizar',
            'Retirar bolsas de residuos sanitarios'
        ]
    },
    {
        id: 'sala_espera',
        nombre: 'Sala de Espera y Pasillos',
        tipoArea: 'No Crítica / Común',
        quimicoSugerido: 'Detergente neutro y Solución Clorada 0.1%',
        tecnica: 'Barrido húmedo y sacudido con microfibra',
        tareas: [
            'Barrer y trapear pisos generales',
            'Sacudir y desinfectar sillones y mesas',
            'Limpiar cristales y canceles de acceso',
            'Vaciado de botes de basura comunes'
        ]
    },
    {
        id: 'recepcion',
        nombre: 'Recepción y Mostrador',
        tipoArea: 'No Crítica / Administrativa',
        quimicoSugerido: 'Alcohol al 70% en superficies de contacto',
        tecnica: 'Limpieza con paño de microfibra desinfectante',
        tareas: [
            'Barrer y trapear área de recepción',
            'Desinfectar mostrador, teclado, terminales y teléfonos',
            'Limpiar anaqueles de exhibición y folletería',
            'Retirar botes de basura'
        ]
    }
];

// ============================================================================
// COMPRESIÓN Y SUBIDA DE EVIDENCIA FOTOGRÁFICA
// ============================================================================
export const comprimirImagen = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.75) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
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
                canvas.toBlob((blob) => {
                    resolve({ blob, dataUrl: canvas.toDataURL('image/jpeg', quality) });
                }, 'image/jpeg', quality);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

export const subirFotoEvidencia = async (file, carpeta = 'evidencia_limpieza') => {
    try {
        const { blob, dataUrl } = await comprimirImagen(file);
        const timestamp = Date.now();
        const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'evidencia.jpg';
        const storagePath = carpeta + '/' + timestamp + '_' + safeName;
        
        try {
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, blob);
            const downloadUrl = await getDownloadURL(storageRef);
            return {
                url: downloadUrl,
                path: storagePath,
                dataUrl, // Respaldo local para preview y PDF directo
                timestamp,
                nombre: safeName
            };
        } catch (storageErr) {
            console.warn('Storage falló, usando dataUrl de respaldo:', storageErr);
            return {
                url: dataUrl,
                path: storagePath,
                dataUrl,
                timestamp,
                nombre: safeName
            };
        }
    } catch (err) {
        console.error('Error al comprimir/subir foto:', err);
        throw err;
    }
};

// ============================================================================
// BITÁCORA DIARIA DE LIMPIEZA (POR ESPACIOS Y GENERAL)
// ============================================================================
const BITACORA_COL = 'bitacora_limpieza';
const BITACORA_GENERAL_COL = 'bitacora_diaria_general';

export const registrarTareaCompletada = async (data) => {
    // data = { espacioId, nombreEspacio, tareaNombre, usuarioNombre, usuarioUid, fecha }
    const q = query(
        collection(db, BITACORA_COL),
        where('espacioId', '==', data.espacioId),
        where('fecha', '==', data.fecha)
    );
    const snap = await getDocs(q);
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
    const timestampCheck = dateStr + ' ' + timeStr;
    const horaShort = timeStr;
    
    const espaciosActuales = await getEspaciosClinica();
    const espacioDef = espaciosActuales.find(e => e.id === data.espacioId) || ESPACIOS_CLINICA.find(e => e.id === data.espacioId);
    const totalTareas = data.totalTareas !== undefined ? data.totalTareas : (espacioDef ? espacioDef.tareas.length : 0);

    let res;
    if (snap.empty) {
        const newDocRef = doc(collection(db, BITACORA_COL));
        const currentDetalle = { [data.tareaNombre]: timestampCheck };
        const completado = Object.keys(currentDetalle).length === totalTareas;

        await setDoc(newDocRef, {
            espacioId: data.espacioId,
            nombreEspacio: data.nombreEspacio,
            fecha: data.fecha,
            limpiadoPor: data.usuarioNombre || 'Limpieza',
            limpiadoPorUid: data.usuarioUid || '',
            tareasDetalle: currentDetalle,
            hora: horaShort,
            completado,
            createdAt: serverTimestamp()
        });
        res = { docId: newDocRef.id, hora: timestampCheck, completado };
    } else {
        const docRef = snap.docs[0].ref;
        const currentData = snap.docs[0].data();
        const currentDetalle = currentData.tareasDetalle || {};
        
        if (!currentDetalle[data.tareaNombre]) {
            currentDetalle[data.tareaNombre] = timestampCheck;
        }
        
        const tieneFotos = Array.isArray(currentData.fotosEvidencia) && currentData.fotosEvidencia.length > 0;
        const todasTareasHechas = Object.keys(currentDetalle).length === totalTareas;
        // Evidencia obligatoria: solo es completado si tiene todas las tareas Y al menos una foto de evidencia
        const completado = todasTareasHechas && tieneFotos;
        
        const updateData = {
            tareasDetalle: currentDetalle,
            completado,
            updatedAt: serverTimestamp()
        };
        if (completado) {
            updateData.hora = horaShort;
        }
        
        await updateDoc(docRef, updateData);
        res = { docId: docRef.id, hora: timestampCheck, completado };
    }

    // Actualizar registro general del día en paralelo
    await sincronizarBitacoraGeneralDia(data.fecha, data.usuarioNombre, data.usuarioUid);

    return res;
};

export const marcarEspacioCompletoUnClic = async ({ espacioId, fecha, usuarioNombre, usuarioUid }) => {
    const espaciosActuales = await getEspaciosClinica();
    const espacioDef = espaciosActuales.find(e => e.id === espacioId) || ESPACIOS_CLINICA.find(e => e.id === espacioId);
    if (!espacioDef) return;

    const q = query(
        collection(db, BITACORA_COL),
        where('espacioId', '==', espacioId),
        where('fecha', '==', fecha)
    );
    const snap = await getDocs(q);
    const currentData = snap.empty ? null : snap.docs[0].data();
    const tieneFotos = currentData && Array.isArray(currentData.fotosEvidencia) && currentData.fotosEvidencia.length > 0;

    // Validación estricta: No se permite marcar como completado si no cuenta con foto de evidencia
    if (!tieneFotos) {
        const error = new Error('EVIDENCIA_FOTOGRAFICA_OBLIGATORIA');
        error.code = 'EVIDENCIA_REQUERIDA';
        throw error;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
    const timestampCheck = dateStr + ' ' + timeStr;

    const tareasDetalle = {};
    espacioDef.tareas.forEach(t => {
        tareasDetalle[t] = timestampCheck;
    });

    await updateDoc(snap.docs[0].ref, {
        tareasDetalle,
        hora: timeStr,
        completado: true,
        updatedAt: serverTimestamp()
    });

    await sincronizarBitacoraGeneralDia(fecha, usuarioNombre, usuarioUid);
    try {
        await descontarInsumosLimpiezaCabina(espacioDef.nombre);
    } catch (_) {}
};

export const descontarInsumosLimpiezaCabina = async (espacioNombre) => {
    try {
        const invCol = collection(db, 'inventario');
        const snap = await getDocs(invCol);
        if (snap.empty) return;
        for (const d of snap.docs) {
            const item = d.data();
            const nom = (item.nombre || '').toLowerCase();
            if (
                item.tipo === 'insumo' &&
                (nom.includes('amonio') || nom.includes('alcohol') || nom.includes('sanitizante') || nom.includes('desinfectante') || item.categoria === 'Limpieza')
            ) {
                const stockActual = Number(item.stock) || 0;
                if (stockActual > 0) {
                    await updateDoc(d.ref, {
                        stock: Math.max(0, stockActual - 1),
                        ultimoConsumo: new Date().toISOString(),
                        motivoUltimoConsumo: `Limpieza y sanitizaci?n de ${espacioNombre}`
                    });
                    break;
                }
            }
        }
    } catch (e) {
        console.warn('Aviso: no se pudo descontar autom?ticamente el inventario:', e);
    }
};


export const guardarFotoEvidenciaEspacio = async ({ espacioId, nombreEspacio, fecha, file, usuarioNombre, usuarioUid }) => {
    const fotoObj = await subirFotoEvidencia(file, 'evidencia_espacios/' + fecha + '/' + espacioId);
    const fotoData = {
        url: fotoObj.url,
        path: fotoObj.path,
        nombre: fotoObj.nombre,
        timestamp: fotoObj.timestamp,
        dataUrl: fotoObj.dataUrl || fotoObj.url,
        subidoPor: usuarioNombre || 'Personal de Intendencia',
        subidoPorUid: usuarioUid || ''
    };

    const q = query(
        collection(db, BITACORA_COL),
        where('espacioId', '==', espacioId),
        where('fecha', '==', fecha)
    );
    const snap = await getDocs(q);

    const espaciosActuales = await getEspaciosClinica();
    const espacioDef = espaciosActuales.find(e => e.id === espacioId) || ESPACIOS_CLINICA.find(e => e.id === espacioId);
    const totalTareas = espacioDef ? espacioDef.tareas.length : 0;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

    if (snap.empty) {
        const newDocRef = doc(collection(db, BITACORA_COL));
        await setDoc(newDocRef, {
            espacioId,
            nombreEspacio: nombreEspacio || espacioId,
            fecha,
            limpiadoPor: usuarioNombre || 'Limpieza',
            limpiadoPorUid: usuarioUid || '',
            tareasDetalle: {},
            fotosEvidencia: [fotoData],
            completado: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    } else {
        const docRef = snap.docs[0].ref;
        const currentData = snap.docs[0].data();
        const fotosActuales = currentData.fotosEvidencia || [];
        const tareasActuales = currentData.tareasDetalle || {};
        const todasTareasHechas = totalTareas > 0 && Object.keys(tareasActuales).length >= totalTareas;

        const updateData = {
            fotosEvidencia: [...fotosActuales, fotoData],
            updatedAt: serverTimestamp()
        };
        // Si ya tenía todas las tareas listas, al subir la foto obligatoria pasa inmediatamente a completado!
        if (todasTareasHechas && !currentData.completado) {
            updateData.completado = true;
            updateData.hora = currentData.hora || timeStr;
        }
        await updateDoc(docRef, updateData);
    }

    await sincronizarBitacoraGeneralDia(fecha, usuarioNombre, usuarioUid);
    return fotoData;
};

export const eliminarFotoEvidenciaEspacio = async ({ espacioId, fecha, fotoIdx }) => {
    const q = query(
        collection(db, BITACORA_COL),
        where('espacioId', '==', espacioId),
        where('fecha', '==', fecha)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
        const docRef = snap.docs[0].ref;
        const currentData = snap.docs[0].data();
        const fotosActuales = [...(currentData.fotosEvidencia || [])];
        if (fotoIdx >= 0 && fotoIdx < fotosActuales.length) {
            fotosActuales.splice(fotoIdx, 1);
            await updateDoc(docRef, {
                fotosEvidencia: fotosActuales,
                updatedAt: serverTimestamp()
            });
            await sincronizarBitacoraGeneralDia(fecha);
        }
    }
};

export const sincronizarBitacoraGeneralDia = async (fecha, usuarioNombre, usuarioUid) => {
    try {
        const espaciosActuales = await getEspaciosClinica();
        const items = await getBitacoraDelDia(fecha);
        const espaciosCompletados = items.filter(i => i.completado).map(i => i.espacioId);
        const completadoTotal = espaciosActuales.length > 0 && espaciosActuales.every(e => espaciosCompletados.includes(e.id));
        
        const docRef = doc(db, BITACORA_GENERAL_COL, fecha);
        const snap = await getDoc(docRef);

        const dataExistente = snap.exists() ? snap.data() : {};
        const now = new Date();
        const horaStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });

        const payload = {
            fecha,
            espaciosCompletados,
            completadoTotal,
            totalEspacios: espaciosActuales.length,
            responsableNombre: usuarioNombre || dataExistente.responsableNombre || 'Personal de Intendencia',
            responsableUid: usuarioUid || dataExistente.responsableUid || '',
            horaInicio: dataExistente.horaInicio || horaStr,
            horaFin: completadoTotal ? horaStr : (dataExistente.horaFin || ''),
            quimicosUtilizados: dataExistente.quimicosUtilizados || 'Cuaternario de Amonio 5ta Gen. (0.5%), Alcohol Isopropílico 70%, Hipoclorito de Sodio 0.1%',
            observaciones: dataExistente.observaciones || '',
            fotosEvidencia: dataExistente.fotosEvidencia || [],
            supervisorAprobado: dataExistente.supervisorAprobado || false,
            updatedAt: serverTimestamp()
        };

        if (!snap.exists()) {
            payload.createdAt = serverTimestamp();
        }

        await setDoc(docRef, payload, { merge: true });
    } catch (e) {
        console.error('Error al sincronizar bitacora general:', e);
    }
};

export const getBitacoraDelDia = async (fecha) => {
    const q = query(collection(db, BITACORA_COL), where('fecha', '==', fecha));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const onBitacoraChange = (fecha, callback) => {
    const q = query(collection(db, BITACORA_COL), where('fecha', '==', fecha));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
};

export const getBitacoraDiaGeneral = async (fecha) => {
    const snap = await getDoc(doc(db, BITACORA_GENERAL_COL, fecha));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const onBitacoraDiaGeneralChange = (fecha, callback) => {
    return onSnapshot(doc(db, BITACORA_GENERAL_COL, fecha), (snap) => {
        if (snap.exists()) {
            callback({ id: snap.id, ...snap.data() });
        } else {
            callback(null);
        }
    });
};

export const guardarBitacoraDiaGeneral = async (fecha, data) => {
    const docRef = doc(db, BITACORA_GENERAL_COL, fecha);
    await setDoc(docRef, {
        ...data,
        fecha,
        updatedAt: serverTimestamp()
    }, { merge: true });
};

export const sellarBitacoraDiaSupervisor = async (fecha, { supervisorNombre, supervisorCedula, notas }) => {
    const docRef = doc(db, BITACORA_GENERAL_COL, fecha);
    await updateDoc(docRef, {
        supervisorAprobado: true,
        supervisorNombre: supervisorNombre || 'Dirección Clínica ALFRA',
        supervisorCedula: supervisorCedula || 'CED. PROF. 12849203 SSA',
        supervisorNotas: notas || 'Bitácora verificada y conforme con la NOM-016-SSA3-2012.',
        supervisorAprobadoEn: serverTimestamp()
    });
};

export const marcarEspacioLimpio = async (data) => {
    const docRef = await addDoc(collection(db, BITACORA_COL), {
        espacioId: data.espacioId,
        nombreEspacio: data.nombreEspacio,
        tareasCompletadas: data.tareasCompletadas || [],
        limpiadoPor: data.limpiadoPor || '',
        limpiadoPorUid: data.limpiadoPorUid || '',
        notas: data.notas || '',
        fecha: data.fecha || new Date().toISOString().split('T')[0],
        hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

// ============================================================================
// TAREAS EXTRAORDINARIAS ASIGNADAS POR EL ADMINISTRADOR
// ============================================================================
const TAREAS_COL = 'tareas_limpieza';

export const crearTarea = async (data) => {
    return crearTareaExtra(data);
};

export const crearTareaExtra = async (data) => {
    const docRef = await addDoc(collection(db, TAREAS_COL), {
        titulo: data.titulo || '',
        descripcion: data.descripcion || '',
        asignadoPor: data.asignadoPor || 'Administrador',
        asignadoA: data.asignadoA || 'todos',
        asignadoANombre: data.asignadoANombre || 'Personal de Intendencia',
        fechaProgramada: data.fechaProgramada || data.fechaLimite || new Date().toISOString().split('T')[0],
        fechaLimite: data.fechaLimite || data.fechaProgramada || '',
        prioridad: data.prioridad || 'normal', // 'normal' | 'urgente'
        estado: 'pendiente', // 'pendiente' | 'por_revisar' | 'aprobada'
        fotosEvidencia: data.fotosEvidencia || [],
        notasOperador: '',
        notasAdmin: '',
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

export const completarTarea = async (id, payload = {}) => {
    return enviarTareaExtraRevision(id, payload);
};

export const enviarTareaExtraRevision = async (id, { notasOperador = '', fotosEvidencia = [] } = {}) => {
    await updateDoc(doc(db, TAREAS_COL, id), {
        estado: 'por_revisar',
        notasOperador,
        fotosEvidencia,
        completadaEn: serverTimestamp(),
    });
};

export const aprobarTareaExtra = async (id, { notasAdmin = '', aprobadoPor = 'Admin' } = {}) => {
    await updateDoc(doc(db, TAREAS_COL, id), {
        estado: 'aprobada',
        notasAdmin,
        aprobadoPor,
        aprobadaEn: serverTimestamp(),
    });
};

export const solicitarCorreccionTareaExtra = async (id, { notasAdmin = '' } = {}) => {
    await updateDoc(doc(db, TAREAS_COL, id), {
        estado: 'pendiente',
        notasAdmin,
        corregirRequerido: true,
        updatedAt: serverTimestamp(),
    });
};

export const getTareasPorUsuario = async (uid) => {
    const q = query(collection(db, TAREAS_COL), where('asignadoA', 'in', [uid, 'todos']));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const onTareasChange = (uid, callback) => {
    return onSnapshot(collection(db, TAREAS_COL), (snap) => {
        const tareas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const filtradas = uid ? tareas.filter(t => t.asignadoA === uid || t.asignadoA === 'todos' || !t.asignadoA) : tareas;
        callback(filtradas);
    });
};

export const getAllTareas = async () => {
    const snap = await getDocs(collection(db, TAREAS_COL));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const onTodasTareasExtraChange = (callback) => {
    return onSnapshot(collection(db, TAREAS_COL), (snap) => {
        const tareas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(tareas.sort((a,b) => {
            const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return db - da;
        }));
    });
};

// ============================================================================
// BITÁCORA DE MANTENIMIENTO
// ============================================================================
const MANTENIMIENTO_COL = 'bitacora_mantenimiento';

export const crearReporteMantenimiento = async (data) => {
    const docRef = await addDoc(collection(db, MANTENIMIENTO_COL), {
        titulo: data.titulo || data.descripcion?.slice(0, 40) || 'Reporte de Mantenimiento',
        descripcion: data.descripcion || '',
        tipo: data.tipo || 'correctivo', // 'preventivo' | 'correctivo'
        ubicacion: data.ubicacion || 'General',
        prioridad: data.prioridad || 'media',
        reportadoPor: data.reportadoPor || 'Personal de Clínica',
        reportadoPorUid: data.reportadoPorUid || '',
        estado: 'pendiente', // 'pendiente' | 'en_proceso' | 'resuelto'
        fotosEvidencia: data.fotosEvidencia || [],
        tecnicoProveedor: data.tecnicoProveedor || '',
        costo: Number(data.costo || 0),
        fecha: data.fecha || new Date().toISOString().split('T')[0],
        fechaSolucion: '',
        solucionDetalle: '',
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

export const getReportesMantenimiento = async () => {
    const snap = await getDocs(collection(db, MANTENIMIENTO_COL));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const updateReporteEstado = async (id, estado, extra = {}) => {
    const payload = { estado, ...extra, updatedAt: serverTimestamp() };
    if (estado === 'resuelto') {
        payload.fechaSolucion = new Date().toISOString().split('T')[0];
    }
    await updateDoc(doc(db, MANTENIMIENTO_COL, id), payload);
};

export const onReportesMantenimientoChange = (callback) => {
    return onSnapshot(collection(db, MANTENIMIENTO_COL), (snap) => {
        const reportes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(reportes.sort((a,b) => {
            const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return db - da;
        }));
    });
};

// ============================================================================
// SOLICITUDES DE INSUMOS
// ============================================================================
const SOLICITUDES_COL = 'solicitudes_insumos_limpieza';

export const crearSolicitudInsumos = async (data) => {
    const docRef = await addDoc(collection(db, SOLICITUDES_COL), {
        items: data.items || [],
        solicitadoPor: data.solicitadoPor || '',
        solicitadoPorUid: data.solicitadoPorUid || '',
        notas: data.notas || '',
        prioridad: data.prioridad || 'normal',
        estado: 'pendiente',
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

export const getSolicitudesInsumos = async () => {
    const snap = await getDocs(collection(db, SOLICITUDES_COL));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const updateSolicitudEstado = async (id, estado, notasAdmin) => {
    await updateDoc(doc(db, SOLICITUDES_COL, id), { estado, notasAdmin: notasAdmin || '' });
};

export const onSolicitudesChange = (callback) => {
    return onSnapshot(collection(db, SOLICITUDES_COL), (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
};

// ============================================================================
// HISTORIAL Y CONSULTAS MENSUALES COFEPRIS
// ============================================================================
export const onHistorialBitacoraChange = (callback) => {
    const q = query(collection(db, BITACORA_COL), orderBy('fecha', 'desc'));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
};

export const getBitacorasDelMes = async (anio, mes) => {
    const mesStr = String(mes).padStart(2, '0');
    const startStr = anio + '-' + mesStr + '-01';
    const diasEnMes = new Date(anio, mes, 0).getDate();
    const endStr = anio + '-' + mesStr + '-' + String(diasEnMes).padStart(2, '0');

    const snap = await getDocs(collection(db, BITACORA_GENERAL_COL));
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.fecha >= startStr && d.fecha <= endStr);
};

// ============================================================================
// CONFIGURACIÓN DINÁMICA DE CABINAS, ÁREAS Y TAREAS (ADMINISTRADOR)
// ============================================================================
const CONFIG_LIMPIEZA_COL = 'configuracion_limpieza';
const CONFIG_ESPACIOS_DOC = 'espacios';

// Obtener la lista actual de espacios (con fallback a ESPACIOS_CLINICA)
export const getEspaciosClinica = async () => {
    try {
        const docRef = doc(db, CONFIG_LIMPIEZA_COL, CONFIG_ESPACIOS_DOC);
        const snap = await getDoc(docRef);
        if (snap.exists() && Array.isArray(snap.data().espacios) && snap.data().espacios.length > 0) {
            return snap.data().espacios;
        }
        return ESPACIOS_CLINICA;
    } catch (error) {
        console.error("Error obteniendo espacios configurados:", error);
        return ESPACIOS_CLINICA;
    }
};

// Escuchar cambios en tiempo real de las cabinas y tareas configuradas
export const onEspaciosClinicaChange = (callback) => {
    const docRef = doc(db, CONFIG_LIMPIEZA_COL, CONFIG_ESPACIOS_DOC);
    return onSnapshot(docRef, (snap) => {
        if (snap.exists() && Array.isArray(snap.data().espacios) && snap.data().espacios.length > 0) {
            callback(snap.data().espacios);
        } else {
            callback(ESPACIOS_CLINICA);
        }
    }, (error) => {
        console.error("Error en listener de espacios:", error);
        callback(ESPACIOS_CLINICA);
    });
};

// Guardar array completo de espacios y tareas
export const guardarEspaciosClinica = async (espacios) => {
    try {
        const docRef = doc(db, CONFIG_LIMPIEZA_COL, CONFIG_ESPACIOS_DOC);
        await setDoc(docRef, {
            espacios,
            updatedAt: serverTimestamp()
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error guardando espacios configurados:", error);
        throw error;
    }
};

// Restablecer a la configuración predeterminada oficial COFEPRIS
export const restablecerEspaciosDefault = async () => {
    return await guardarEspaciosClinica(ESPACIOS_CLINICA);
};

// Agregar una nueva cabina o área común
export const agregarEspacioClinica = async ({ nombre, tipoArea = 'Crítica / Aséptica', quimicoSugerido = '', tecnica = '', tareas = [] }) => {
    if (!nombre || !nombre.trim()) throw new Error('El nombre de la cabina o área es obligatorio');
    
    const espacios = await getEspaciosClinica();
    const idSafe = nombre.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().slice(-4);

    const tareasIniciales = tareas && tareas.length > 0 ? tareas : [
        'Barrer y trapear con desinfectante',
        'Desinfectar superficies de trabajo',
        'Limpiar espejos y cristales',
        'Retirar y encamisar bote de basura'
    ];

    const nuevoEspacio = {
        id: idSafe,
        nombre: nombre.trim(),
        tipoArea: tipoArea || 'Crítica / Aséptica',
        quimicoSugerido: quimicoSugerido.trim() || 'Cuaternario de Amonio 5ta Gen. (0.5%) y Alcohol al 70%',
        tecnica: tecnica.trim() || 'Limpieza unidireccional y doble balde',
        tareas: tareasIniciales
    };

    const nuevosEspacios = [...espacios, nuevoEspacio];
    await guardarEspaciosClinica(nuevosEspacios);
    return nuevoEspacio;
};

// Modificar datos de una cabina o área común (nombre, tipo, químico, técnica)
export const editarEspacioClinica = async (espacioId, { nombre, tipoArea, quimicoSugerido, tecnica }) => {
    const espacios = await getEspaciosClinica();
    const nuevosEspacios = espacios.map(esp => {
        if (esp.id === espacioId) {
            return {
                ...esp,
                nombre: nombre !== undefined && nombre.trim() ? nombre.trim() : esp.nombre,
                tipoArea: tipoArea !== undefined ? tipoArea : esp.tipoArea,
                quimicoSugerido: quimicoSugerido !== undefined ? quimicoSugerido.trim() : esp.quimicoSugerido,
                tecnica: tecnica !== undefined ? tecnica.trim() : esp.tecnica
            };
        }
        return esp;
    });
    await guardarEspaciosClinica(nuevosEspacios);
    return true;
};

// Eliminar un espacio o cabina
export const eliminarEspacioClinica = async (espacioId) => {
    const espacios = await getEspaciosClinica();
    const nuevosEspacios = espacios.filter(esp => esp.id !== espacioId);
    await guardarEspaciosClinica(nuevosEspacios);
    return true;
};

// Agregar una tarea a un espacio específico
export const agregarTareaAEspacio = async (espacioId, nuevaTareaTexto) => {
    const tareaLimpia = (nuevaTareaTexto || '').trim();
    if (!tareaLimpia) throw new Error('El texto de la tarea no puede estar vacío');
    
    const espacios = await getEspaciosClinica();
    const nuevosEspacios = espacios.map(esp => {
        if (esp.id === espacioId) {
            const tareasActuales = Array.isArray(esp.tareas) ? [...esp.tareas] : [];
            tareasActuales.push(tareaLimpia);
            return { ...esp, tareas: tareasActuales };
        }
        return esp;
    });
    await guardarEspaciosClinica(nuevosEspacios);
    return true;
};

// Modificar una tarea existente dentro de un espacio
export const modificarTareaDeEspacio = async (espacioId, tareaIdx, nuevoTexto) => {
    const tareaLimpia = (nuevoTexto || '').trim();
    if (!tareaLimpia) throw new Error('El texto de la tarea no puede estar vacío');

    const espacios = await getEspaciosClinica();
    const nuevosEspacios = espacios.map(esp => {
        if (esp.id === espacioId) {
            const tareasActuales = Array.isArray(esp.tareas) ? [...esp.tareas] : [];
            if (tareaIdx >= 0 && tareaIdx < tareasActuales.length) {
                tareasActuales[tareaIdx] = tareaLimpia;
            }
            return { ...esp, tareas: tareasActuales };
        }
        return esp;
    });
    await guardarEspaciosClinica(nuevosEspacios);
    return true;
};

// Eliminar una tarea de un espacio
export const eliminarTareaDeEspacio = async (espacioId, tareaIdx) => {
    const espacios = await getEspaciosClinica();
    const nuevosEspacios = espacios.map(esp => {
        if (esp.id === espacioId) {
            const tareasActuales = Array.isArray(esp.tareas) ? [...esp.tareas] : [];
            if (tareaIdx >= 0 && tareaIdx < tareasActuales.length) {
                tareasActuales.splice(tareaIdx, 1);
            }
            return { ...esp, tareas: tareasActuales };
        }
        return esp;
    });
    await guardarEspaciosClinica(nuevosEspacios);
    return true;
};

// ============================================================================
// CONFIGURACIÓN DE FIRMAS Y DATOS SANITARIOS COFEPRIS PARA REPORTES
// ============================================================================
const FIRMAS_CONFIG_DOC = 'firmas_oficiales';
const FIRMAS_LOCAL_KEY = 'alfra_config_firmas_pdf';

export const sanitizarTextoFirmas = (str) => {
    if (!str || typeof str !== 'string') return str;
    return str
        .replace(/CL[\?\ufffd]+NICA/gi, 'CLÍNICA')
        .replace(/Direcci[\?\ufffd]+n/gi, 'Dirección')
        .replace(/M[\?\ufffd]+dica/gi, 'Médica')
        .replace(/M[\?\ufffd]+dico/gi, 'Médico')
        .replace(/Ejecut[\?\ufffd]+/gi, 'Ejecutó')
        .replace(/desinfecci[\?\ufffd]+n/gi, 'desinfección')
        .replace(/tr[\?\ufffd]+mite/gi, 'trámite')
        .replace(/Est[\?\ufffd]+tica/gi, 'Estética')
        .replace(/Bit[\?\ufffd]+cora/gi, 'Bitácora')
        .replace(/C[\?\ufffd]+dula/gi, 'Cédula')
        .replace(/per[\?\ufffd]+odo/gi, 'período')
        .replace(/supervisi[\?\ufffd]+n/gi, 'supervisión')
        .replace(/atenci[\?\ufffd]+n/gi, 'atención')
        .replace(/inspecci[\?\ufffd]+n/gi, 'inspección')
        .replace(/evaluaci[\?\ufffd]+n/gi, 'evaluación')
        .replace(/t[\?\ufffd]+cnica/gi, 'técnica')
        .replace(/garant[\?\ufffd]+as/gi, 'garantías');
};

export const sanitizarObjetoFirmas = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const res = {};
    for (const [key, val] of Object.entries(obj)) {
        res[key] = typeof val === 'string' ? sanitizarTextoFirmas(val) : val;
    }
    return res;
};

export const FIRMAS_DEFAULT = {
    operadorNombre: 'Personal de Intendencia',
    operadorCargo: 'Personal Operativo de Intendencia',
    operadorDetalle: 'Ejecutó aseo y desinfección bajo protocolo',
    supervisorNombre: 'Dra. Alondra Frausto',
    supervisorCargo: 'Responsable Sanitario / Dirección Médica',
    supervisorCedula: 'CED. PROF. 12849203 SSA',
    avisoSanitario: 'COFEPRIS-AF-2024-ALFRA-01',
    licenciaSanitaria: 'En trámite / Aviso vigente',
    nombreClinica: 'CLÍNICA ALFRA',
    subtituloClinica: 'Centro Especializado en Medicina Estética & Salud Integral'
};

export const getConfiguracionFirmas = async () => {
    try {
        const snap = await getDoc(doc(db, CONFIG_LIMPIEZA_COL, FIRMAS_CONFIG_DOC));
        if (snap.exists() && snap.data()) {
            const data = sanitizarObjetoFirmas({ ...FIRMAS_DEFAULT, ...snap.data() });
            try { localStorage.setItem(FIRMAS_LOCAL_KEY, JSON.stringify(data)); } catch (_) {}
            return data;
        }
    } catch (e) {
        console.warn('No se pudo leer firmas de Firestore, usando respaldo local:', e);
    }

    try {
        const local = localStorage.getItem(FIRMAS_LOCAL_KEY);
        if (local) {
            const data = sanitizarObjetoFirmas({ ...FIRMAS_DEFAULT, ...JSON.parse(local) });
            try { localStorage.setItem(FIRMAS_LOCAL_KEY, JSON.stringify(data)); } catch (_) {}
            return data;
        }
    } catch (_) {}

    return sanitizarObjetoFirmas(FIRMAS_DEFAULT);
};

export const guardarConfiguracionFirmas = async (firmas) => {
    const dataGuardar = sanitizarObjetoFirmas({ ...FIRMAS_DEFAULT, ...firmas });
    try {
        localStorage.setItem(FIRMAS_LOCAL_KEY, JSON.stringify(dataGuardar));
    } catch (_) {}

    try {
        const docRef = doc(db, CONFIG_LIMPIEZA_COL, FIRMAS_CONFIG_DOC);
        await setDoc(docRef, {
            ...dataGuardar,
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.warn('Error al guardar firmas en Firestore:', e);
    }
    return dataGuardar;
};
