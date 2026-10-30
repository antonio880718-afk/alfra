import {
    collection, addDoc, getDocs, doc, getDoc, setDoc,
    query, where, orderBy, onSnapshot, serverTimestamp, limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const ASISTENCIA_COL = collection(db, 'asistencia');
const CONFIG_DOC = doc(db, 'configuracion', 'checador_gps');

// Coordenadas oficiales de CLÍNICA ALFRA LZC
// Calle Río Fuerte #26, Col. Lomas de Bella Vista, Cd. Lázaro Cárdenas, Mich.
export const CLINICA_COORDS_DEFAULT = {
    lat: 17.9714,
    lng: -102.2216,
    radioMetros: 250, // Perímetro permitido (250m para cubrir clínica y tolerar geolocalización por Wi-Fi de PC)
    nombre: 'CLINICA ALFRA LZC',
    direccion: 'Calle Río Fuerte #26, Col. Lomas de Bella Vista, Lázaro Cárdenas, Mich.'
};

/**
 * Fórmula de Haversine para calcular la distancia en metros entre dos coordenadas GPS
 */
export function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

/**
 * Obtener configuración de GPS de la clínica
 */
export async function getConfigChecadorGPS() {
    try {
        const snap = await getDoc(CONFIG_DOC);
        if (snap.exists()) {
            const data = snap.data();
            // Si tiene las coordenadas antiguas de prueba (17.9881351), usar las reales de Río Fuerte 26
            if (data.lat && Math.abs(data.lat - 17.9881351) < 0.001) {
                return CLINICA_COORDS_DEFAULT;
            }
            return { ...CLINICA_COORDS_DEFAULT, ...data };
        }
    } catch (e) {
        console.warn('Usando coordenadas por defecto:', e);
    }
    return CLINICA_COORDS_DEFAULT;
}

/**
 * Guardar nueva configuración de GPS de la clínica (Solo Administrador)
 */
export async function saveConfigChecadorGPS(config) {
    await setDoc(CONFIG_DOC, {
        ...config,
        actualizadoEn: new Date().toISOString()
    }, { merge: true });
}

/**
 * Registrar checado de entrada o salida exclusivamente por GPS
 */
export async function registrarChecadoGPS({
    uid,
    nombre,
    email,
    rol,
    puesto,
    tipo = 'Entrada', // 'Entrada' | 'Salida'
    lat,
    lng,
    distanciaMetros,
    dentroDeRango = true
}) {
    const ahora = new Date();
    const hoyYMD = ahora.toISOString().split('T')[0];
    const horaStr = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Determinar si es retardo (Entradas después de las 09:10 AM)
    const horaNum = ahora.getHours();
    const minNum = ahora.getMinutes();
    const esRetardo = tipo === 'Entrada' && (horaNum > 9 || (horaNum === 9 && minNum > 10));
    const demeritoMin = esRetardo ? ((horaNum - 9) * 60 + minNum) : 0;
    const estado = esRetardo ? 'Retardo' : 'A tiempo';

    const registro = {
        uid: uid || 'anon',
        nombre: nombre || 'Colaborador',
        email: email || '',
        rol: rol || 'Staff',
        puesto: puesto || rol || 'Staff',
        tipo, // 'Entrada' o 'Salida'
        fechaYMD: hoyYMD,
        horaStr,
        timestamp: serverTimestamp(),
        creadoEn: ahora.toISOString(),
        metodo: 'GPS Satelital',
        lat: Number(lat) || 0,
        lng: Number(lng) || 0,
        distanciaMetros: Number(distanciaMetros) || 0,
        dentroDeRango: Boolean(dentroDeRango),
        estado,
        demeritoMin
    };

    const docRef = await addDoc(ASISTENCIA_COL, registro);
    return { id: docRef.id, ...registro };
}

/**
 * Escuchar registros de asistencia de hoy (Para el Administrador)
 */
export function onAsistenciaHoyChange(callback) {
    const hoyYMD = new Date().toISOString().split('T')[0];
    const q = query(
        ASISTENCIA_COL,
        where('fechaYMD', '==', hoyYMD)
    );
    return onSnapshot(q, (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => new Date(b.creadoEn || 0) - new Date(a.creadoEn || 0));
        callback(docs);
    }, (err) => {
        console.warn('Error escuchando asistencia de hoy:', err);
        callback([]);
    });
}

/**
 * Escuchar registros de asistencia personales de un colaborador
 */
export function onMisRegistrosAsistenciaChange(uid, callback) {
    if (!uid) {
        callback([]);
        return () => {};
    }
    const q = query(
        ASISTENCIA_COL,
        where('uid', '==', uid)
    );
    return onSnapshot(q, (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => new Date(b.creadoEn || 0) - new Date(a.creadoEn || 0));
        callback(docs.slice(0, 30));
    }, (err) => {
        console.warn('Error escuchando registros personales:', err);
        callback([]);
    });
}
