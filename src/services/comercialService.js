import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

// ─── SERVICIOS (Catálogo) ────────────────────────────────────────────────────
const serviciosCol = collection(db, 'servicios');

export const createServicio = async (data) => {
    const docRef = await addDoc(serviciosCol, { ...data, createdAt: new Date().toISOString() });
    return docRef.id;
};

export const updateServicio = async (id, data) => {
    await updateDoc(doc(db, 'servicios', id), { ...data, updatedAt: new Date().toISOString() });
};

export const deleteServicio = async (id) => {
    await deleteDoc(doc(db, 'servicios', id));
};

export const onServiciosChange = (callback) => {
    return onSnapshot(serviciosCol, (snapshot) => {
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(items);
    }, (error) => {
        console.error('Error in servicios listener:', error);
        callback([]);
    });
};

// ─── CUPONES ─────────────────────────────────────────────────────────────────
const cuponesCol = collection(db, 'cupones');

/**
 * Verifica si un cupón se encuentra vigente considerando su campo activo y sus fechas de vigencia (fechaInicio / fechaFin).
 */
export const isCuponVigente = (cupon) => {
    if (!cupon || cupon.activo === false) return false;
    const hoyStr = new Date().toISOString().split('T')[0];
    if (cupon.fechaInicio && String(cupon.fechaInicio).slice(0, 10) > hoyStr) {
        return false;
    }
    if (cupon.fechaFin && String(cupon.fechaFin).slice(0, 10) < hoyStr) {
        return false;
    }
    return true;
};

/**
 * Parsea un texto de vigencia de la plantilla (ej. "15 dias", "2026-11-30", "2026-11-01 al 2026-11-30")
 * y devuelve { fechaInicio, fechaFin, vigenciaTexto }.
 */
export const parseVigenciaCupon = (rawStr = '') => {
    const txt = String(rawStr || '').trim();
    const hoy = new Date();
    const hoyIso = hoy.toISOString().split('T')[0];

    if (!txt) {
        return { fechaInicio: hoyIso, fechaFin: '', vigenciaTexto: 'Indefinida' };
    }

    // Caso 1: "15 dias" o "30 días"
    const matchDias = txt.match(/^(\d+)\s*d[ií]as?$/i);
    if (matchDias) {
        const dias = parseInt(matchDias[1], 10) || 15;
        const fin = new Date(hoy.getTime() + dias * 86400000);
        const finIso = fin.toISOString().split('T')[0];
        return {
            fechaInicio: hoyIso,
            fechaFin: finIso,
            vigenciaTexto: `${dias} días (hasta ${finIso})`
        };
    }

    // Caso 2: Rango "2026-11-01 al 2026-11-30" o "2026-11-01 a 2026-11-30"
    const matchRango = txt.match(/(\d{4}-\d{2}-\d{2})\s*(?:al?|hasta|-)\s*(\d{4}-\d{2}-\d{2})/i);
    if (matchRango) {
        return {
            fechaInicio: matchRango[1],
            fechaFin: matchRango[2],
            vigenciaTexto: `${matchRango[1]} al ${matchRango[2]}`
        };
    }

    // Caso 3: Fecha única YYYY-MM-DD
    const matchFecha = txt.match(/(\d{4}-\d{2}-\d{2})/);
    if (matchFecha) {
        return {
            fechaInicio: hoyIso,
            fechaFin: matchFecha[1],
            vigenciaTexto: `Hasta ${matchFecha[1]}`
        };
    }

    // Caso 4: Fecha DD/MM/YYYY
    const matchSlash = txt.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (matchSlash) {
        const dd = String(matchSlash[1]).padStart(2, '0');
        const mm = String(matchSlash[2]).padStart(2, '0');
        const yyyy = matchSlash[3];
        const iso = `${yyyy}-${mm}-${dd}`;
        return {
            fechaInicio: hoyIso,
            fechaFin: iso,
            vigenciaTexto: `Hasta ${iso}`
        };
    }

    return { fechaInicio: hoyIso, fechaFin: '', vigenciaTexto: txt };
};

export const createCupon = async (data) => {
    const docRef = await addDoc(cuponesCol, { ...data, activo: true, createdAt: new Date().toISOString() });
    return docRef.id;
};

export const updateCupon = async (id, data) => {
    await updateDoc(doc(db, 'cupones', id), { ...data, updatedAt: new Date().toISOString() });
};

export const deleteCupon = async (id) => {
    await deleteDoc(doc(db, 'cupones', id));
};

export const onCuponesChange = (callback) => {
    return onSnapshot(cuponesCol, (snapshot) => {
        const hoyStr = new Date().toISOString().split('T')[0];
        const items = snapshot.docs.map(d => {
            const raw = d.data();
            const expiradoPorFecha = Boolean(raw.fechaFin && String(raw.fechaFin).slice(0, 10) < hoyStr);
            return {
                id: d.id,
                ...raw,
                expiradoPorFecha,
                activo: raw.activo !== false && !expiradoPorFecha
            };
        });
        callback(items);
    }, (error) => {
        console.error('Error in cupones listener:', error);
        callback([]);
    });
};
