import { db, storage } from '../lib/firebase';
import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    setDoc,
    deleteDoc,
    doc,
    query,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from 'firebase/storage';

const COLLECTION_NAME = 'flyers';
const CONFIG_DOC_REF = () => doc(db, 'configuracion', 'control_flyers_mensual');

export const getMesActualClave = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
};

export const getNombreMesActual = () => {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const now = new Date();
    return `${meses[now.getMonth()]} ${now.getFullYear()}`;
};

export const getFlyers = async () => {
    try {
        const q = query(collection(db, COLLECTION_NAME));
        const querySnapshot = await getDocs(q);
        const flyersArray = querySnapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        }));
        return flyersArray.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });
    } catch (error) {
        console.error("Error fetching flyers:", error);
        throw error;
    }
};

export const uploadFlyer = (file, title, onProgress) => {
    if (!file) return Promise.reject(new Error("No se seleccionó ningún archivo"));

    return new Promise((resolve, reject) => {
        const fileExtension = file.name ? file.name.split('.').pop() : 'png';
        const rand = Math.random().toString(36).slice(2, 7);
        const fileName = `${Date.now()}_${rand}.${fileExtension}`;
        const storageRef = ref(storage, `flyers/${fileName}`);

        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                onProgress?.(`Cargando: ${Math.round(progress)}%`);
            },
            (error) => {
                console.error("Detalle del error de subida:", error);
                let message = `Error (${error.code}): ${error.message}`;
                if (error.code === 'storage/unauthorized') message = "Permiso denegado. Revisa las reglas de seguridad en Firebase Storage.";
                if (error.code === 'storage/retry-limit-exceeded') message = "Tiempo de espera agotado. Revisa tu conexión de internet.";
                if (error.code === 'storage/canceled') message = "Subida cancelada.";
                reject(new Error(message));
            },
            async () => {
                try {
                    onProgress?.('Generando link...');
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                    onProgress?.('Guardando...');
                    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                        title: title || 'Promoción ALFRA',
                        imageUrl: downloadURL,
                        storagePath: `flyers/${fileName}`,
                        mesClave: getMesActualClave(),
                        active: true,
                        createdAt: serverTimestamp()
                    });
                    resolve({ id: docRef.id, imageUrl: downloadURL });
                } catch (e) {
                    reject(e);
                }
            }
        );
    });
};

/**
 * Sube un lote de flyers de forma masiva e informa el progreso general.
 * items = [{ file, title }, ...]
 */
export const uploadFlyersBatch = async (items = [], onProgressBatch) => {
    const resultados = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        onProgressBatch?.({
            current: i + 1,
            total: items.length,
            title: item.title,
            step: `Subiendo ${i + 1} de ${items.length}: ${item.title}...`
        });
        const res = await uploadFlyer(item.file, item.title, (subStep) => {
            onProgressBatch?.({
                current: i + 1,
                total: items.length,
                title: item.title,
                step: `(${i + 1}/${items.length}) ${item.title} — ${subStep}`
            });
        });
        resultados.push(res);
    }
    return resultados;
};

export const deleteFlyer = async (id, storagePath) => {
    try {
        if (storagePath) {
            try {
                const storageRef = ref(storage, storagePath);
                await deleteObject(storageRef);
            } catch (storageErr) {
                console.warn("Aviso al borrar objeto de Storage (puede no existir):", storageErr);
            }
        }
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
        console.error("Error deleting flyer:", error);
        throw error;
    }
};

/**
 * Elimina múltiples flyers de forma masiva
 */
export const deleteFlyersBatch = async (flyersList = [], onProgress) => {
    let eliminados = 0;
    for (let i = 0; i < flyersList.length; i++) {
        const f = flyersList[i];
        onProgress?.(`Eliminando ${i + 1} de ${flyersList.length}...`);
        await deleteFlyer(f.id, f.storagePath);
        eliminados++;
    }
    return eliminados;
};

/**
 * Escucha en tiempo real el estado mensual de renovación de flyers
 */
export const onControlFlyersMensualChange = (callback) => {
    const mesActual = getMesActualClave();
    return onSnapshot(CONFIG_DOC_REF(), (snap) => {
        const data = snap.exists() ? snap.data() : {};
        const completadoEsteMes = data.ultimoMesCompletado === mesActual;
        callback({
            mesActual,
            nombreMesActual: getNombreMesActual(),
            completadoEsteMes,
            ultimoMesCompletado: data.ultimoMesCompletado || null,
            fechaCompletado: data.fechaCompletado || null,
            completadoPor: data.completadoPor || null,
            cantidadFlyersSubidos: data.cantidadFlyersSubidos || 0
        });
    }, (err) => {
        console.warn("Error leyendo control_flyers_mensual:", err);
        callback({
            mesActual,
            nombreMesActual: getNombreMesActual(),
            completadoEsteMes: false
        });
    });
};

/**
 * Marca como completado (o reabre) el cambio de flyers del mes en curso
 */
export const marcarFlyersMesCompletado = async (completado = true, usuarioEmail = 'Administración', cantidad = 0) => {
    const mesActual = getMesActualClave();
    await setDoc(CONFIG_DOC_REF(), {
        ultimoMesCompletado: completado ? mesActual : '',
        fechaCompletado: completado ? new Date().toISOString() : null,
        completadoPor: usuarioEmail,
        cantidadFlyersSubidos: cantidad,
        updatedAt: new Date().toISOString()
    }, { merge: true });
};
