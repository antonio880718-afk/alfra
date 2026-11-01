import { collection, addDoc, getDocs, getDoc, query, where, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toLocalISOString } from './finanzasService';

const COLLECTION_NAME = 'recibos';
const recibosCol = collection(db, COLLECTION_NAME);

/**
 * Genera un folio único de 5 dígitos.
 */
const generarFolio = () => Math.floor(10000 + Math.random() * 90000).toString();

/**
 * Crea un recibo en Firestore después de procesar un cobro.
 * @param {Object} data - { pacienteId, pacienteNombre, concepto, monto, metodoPago, paqueteInfo, telefono }
 */
export const createRecibo = async (data) => {
    try {
        const fechaReal = data.fecha || toLocalISOString();
        const recibo = {
            ...data,
            folio: generarFolio(),
            fecha: fechaReal,
            fechaLegible: new Date(fechaReal).toLocaleDateString('es-MX', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            }),
            createdAt: fechaReal,
        };
        const docRef = await addDoc(recibosCol, recibo);
        return { id: docRef.id, ...recibo };
    } catch (error) {
        console.error('Error creating recibo:', error);
        throw error;
    }
};

/**
 * Obtiene todos los recibos de un paciente, ordenados del más reciente al más antiguo.
 * @param {string} pacienteId
 */
export const getRecibosPaciente = async (pacienteId, uid = null, pacienteNombre = null, telefono = null) => {
    try {
        const resultsMap = new Map();

        const addDocs = (snap) => {
            if (snap && snap.docs) {
                snap.docs.forEach(d => {
                    if (!resultsMap.has(d.id)) {
                        resultsMap.set(d.id, { id: d.id, ...d.data() });
                    }
                });
            }
        };

        const queries = [];

        // 1. Por ID de Firestore del paciente
        if (pacienteId) {
            queries.push(getDocs(query(recibosCol, where('pacienteId', '==', pacienteId))));
        }

        // 2. Por UID de autenticación (si es diferente del pacienteId)
        if (uid && uid !== pacienteId) {
            queries.push(getDocs(query(recibosCol, where('pacienteId', '==', uid))));
        }

        // 3. Por nombre del paciente (CLAVE: incluye nombre exacto, trimmed, con espacios al final y variantes de mayúsculas/minúsculas)
        const nameVariantsSet = new Set();
        if (pacienteNombre && typeof pacienteNombre === 'string' && pacienteNombre.trim()) {
            const unacc = pacienteNombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            [unacc, unacc.toLowerCase(), unacc.toUpperCase()].forEach(v => nameVariantsSet.add(v));
            const exact = pacienteNombre;
            const trimmed = pacienteNombre.trim();
            const withSingleSpace = trimmed + ' ';
            const withDoubleSpace = trimmed + '  ';

            [exact, trimmed, withSingleSpace, withDoubleSpace].forEach(v => {
                nameVariantsSet.add(v);
                nameVariantsSet.add(v.toLowerCase());
                nameVariantsSet.add(v.toUpperCase());
                nameVariantsSet.add(v.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '));
            });

            nameVariantsSet.forEach(name => {
                queries.push(getDocs(query(recibosCol, where('pacienteNombre', '==', name))));
            });
        }

        if (telefono) {
            const tClean = String(telefono).replace(/\D/g, '');
            if (tClean.length >= 7) {
                queries.push(getDocs(query(recibosCol, where('telefono', '==', telefono))));
                queries.push(getDocs(query(recibosCol, where('telefono', '==', tClean))));
            }
        }
        const snapshots = await Promise.all(queries);
        snapshots.forEach(addDocs);

        // 4. Buscar también en movimientos de Finanzas (abonos a plan de tratamiento)
        if (nameVariantsSet.size > 0 || pacienteId) {
            try {
                const finCol = collection(db, 'finanzas');
                const finQueries = [];
                if (pacienteId) {
                    finQueries.push(getDocs(query(finCol, where('pacienteId', '==', pacienteId))));
                }
                nameVariantsSet.forEach(name => {
                    finQueries.push(getDocs(query(finCol, where('pacienteNombre', '==', name))));
                });

                const finSnapshots = await Promise.all(finQueries);
                const processedFinDocIds = new Set();
                const missingReciboIds = [];

                finSnapshots.forEach(snapFin => {
                    snapFin.docs.forEach(docSnap => {
                        if (processedFinDocIds.has(docSnap.id)) return;
                        processedFinDocIds.add(docSnap.id);

                        const mov = docSnap.data();
                        if (mov.estado === 'Cancelado') return;

                        if (mov.reciboId && !resultsMap.has(mov.reciboId)) {
                            missingReciboIds.push(mov.reciboId);
                        } else if (!mov.reciboId && (mov.subTipo === 'abono_tratamiento' || (mov.motivo || '').toLowerCase().includes('abono') || (mov.motivo || '').toLowerCase().includes('plan'))) {
                            if (!resultsMap.has(`fin_${docSnap.id}`)) {
                                resultsMap.set(`fin_${docSnap.id}`, {
                                    id: `fin_${docSnap.id}`,
                                    folio: docSnap.id.slice(-5),
                                    fecha: mov.fecha || mov.createdAt,
                                    fechaLegible: new Date(mov.fecha || mov.createdAt).toLocaleDateString('es-MX', {
                                        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                    }),
                                    pacienteNombre: mov.pacienteNombre || (pacienteNombre || '').trim(),
                                    concepto: mov.motivo || 'Abono a Plan de Tratamiento',
                                    monto: Number(mov.monto || 0),
                                    metodoPago: mov.metodoPago || 'Efectivo',
                                    paqueteInfo: 'Plan de Tratamiento',
                                    isPlanTratamiento: true
                                });
                            }
                        }
                    });
                });

                if (missingReciboIds.length > 0) {
                    const fetchMissing = missingReciboIds.map(async (rId) => {
                        try {
                            const rSnap = await getDoc(doc(db, 'recibos', rId));
                            if (rSnap.exists()) {
                                resultsMap.set(rSnap.id, { id: rSnap.id, ...rSnap.data(), isPlanTratamiento: true });
                            }
                        } catch (e) {
                            console.warn('Error fetching missing recibo by id:', rId, e);
                        }
                    });
                    await Promise.all(fetchMissing);
                }
            } catch (finErr) {
                console.warn('Aviso al buscar abonos en finanzas:', finErr);
            }
        }

        // 5. Ordenar del más reciente al más antiguo
        return Array.from(resultsMap.values()).sort((a, b) => {
            const parseDate = (item) => {
                if (!item) return 0;
                if (item.createdAt) return new Date(item.createdAt).getTime();
                if (item.fecha?.seconds) return item.fecha.seconds * 1000;
                if (item.fecha) return new Date(item.fecha).getTime();
                return 0;
            };
            return parseDate(b) - parseDate(a);
        });
    } catch (error) {
        console.error('Error fetching recibos:', error);
        return [];
    }
};

/**
 * Obtiene TODOS los recibos (para Admin/Recepcionista).
 */
export const getAllRecibos = async () => {
    try {
        const q = query(recibosCol, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Error fetching all recibos:', error);
        throw error;
    }
};

/**
 * Elimina un recibo por su ID.
 * @param {string} id
 */
export const deleteRecibo = async (id) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Error deleting recibo:', error);
        throw error;
    }
};
