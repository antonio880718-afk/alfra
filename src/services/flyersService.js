import { db, storage } from '../lib/firebase';
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from 'firebase/storage';

const COLLECTION_NAME = 'flyers';

export const getFlyers = async () => {
    try {
        const q = query(collection(db, COLLECTION_NAME));
        const querySnapshot = await getDocs(q);
        const flyersArray = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        // Sort locally to bypass strict Firestore index crash
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
        const fileName = `${Date.now()}.${fileExtension}`;
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
                        title,
                        imageUrl: downloadURL,
                        storagePath: `flyers/${fileName}`,
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

export const deleteFlyer = async (id, storagePath) => {
    try {
        // 1. Delete from Storage
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);

        // 2. Delete from Firestore
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
        console.error("Error deleting flyer:", error);
        throw error;
    }
};
