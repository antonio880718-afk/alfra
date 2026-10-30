import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const PLANES_COL = collection(db, 'planes');

// Escuchar cambios en tiempo real en planes de tratamiento/financiamiento
export const onPlanesChange = (callback) => {
    const q = query(PLANES_COL, orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const planes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(planes);
    });
};

// Obtener todos los planes
export const getPlanes = async () => {
    try {
        const q = query(PLANES_COL, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error("Error fetching planes:", error);
        return [];
    }
};

// Crear nuevo plan de tratamiento
export const createPlan = async (data) => {
    try {
        const docRef = await addDoc(PLANES_COL, {
            ...data,
            acumulado: data.acumulado || 0,
            anticipo: data.anticipo || 0,
            costoPorSesion: data.costoPorSesion || 0,
            morosidad: false,
            createdAt: new Date().toISOString(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Error creating plan:", error);
        throw error;
    }
};

// Actualizar plan (abonar, ajustar, etc.)
export const updatePlan = async (id, data) => {
    try {
        const docRef = doc(db, 'planes', id);
        await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
    } catch (error) {
        console.error("Error updating plan:", error);
        throw error;
    }
};

// Eliminar un plan definitivamente de la base de datos
export const deletePlan = async (id) => {
    try {
        const docRef = doc(db, 'planes', id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting plan:", error);
        throw error;
    }
};

/**
 * Fusiona / Unifica dos planes del mismo paciente:
 * 1. Financiero: Traspasa el saldo acumulado del plan origen al plan destino.
 * 2. Sesiones manuales: Concatena sesiones registradas.
 * 3. Recibos de caja: Reasigna los recibos al plan destino para mantener el estado de cuenta intacto.
 * 4. EXPEDIENTE CLÍNICO TOTAL: Traspasa todas las sesiones clínicas, fotos de antes/después,
 *    medidas corporales/faciales, protocolos y notas médicas hacia el tratamiento destino.
 * 5. CERO PÉRDIDA: Ninguna fotografía ni archivo en Storage es eliminado.
 * 6. Elimina o archiva el plan origen financiero según la preferencia.
 */
export const fusionarPlanes = async ({ planOrigenId, planDestinoId, eliminarOrigen = true, motivo = 'Fusión de duplicados' }) => {
    try {
        const origenRef = doc(db, 'planes', planOrigenId);
        const destinoRef = doc(db, 'planes', planDestinoId);

        const [origenSnap, destinoSnap] = await Promise.all([
            getDoc(origenRef),
            getDoc(destinoRef)
        ]);

        if (!origenSnap.exists() || !destinoSnap.exists()) {
            throw new Error('Uno o ambos planes no fueron encontrados en la base de datos.');
        }

        const origen = origenSnap.data();
        const destino = destinoSnap.data();

        const saldoATraspasar = parseFloat(origen.acumulado) || 0;
        const acumuladoActualDestino = parseFloat(destino.acumulado) || 0;
        const nuevoAcumulado = acumuladoActualDestino + saldoATraspasar;
        const metaDestino = parseFloat(destino.meta) || 0;

        // Combinar sesiones manuales en el plan
        const sesionesOrigen = origen.sesionesManuales || [];
        const sesionesDestino = destino.sesionesManuales || [];
        const sesionesCombinadas = [...sesionesDestino, ...sesionesOrigen];

        // Bitácora de ajuste
        const fechaHoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
        const notaLog = `Unificación (${fechaHoy}): Traspaso de $${saldoATraspasar.toLocaleString('es-MX', { minimumFractionDigits: 2 })} del plan "${origen.objetivo}". ${motivo}`;
        const historialActualizado = [...(destino.historialAjustes || []), notaLog];

        // 1. Actualizar plan destino financiero
        await updateDoc(destinoRef, {
            acumulado: nuevoAcumulado,
            morosidad: nuevoAcumulado < (metaDestino * 0.1),
            sesionesManuales: sesionesCombinadas,
            historialAjustes: historialActualizado,
            ultimoAjuste: notaLog,
            updatedAt: new Date().toISOString()
        });

        // 2. Re-vincular recibos emitidos al paquete origen
        try {
            const recibosQ = query(collection(db, 'recibos'), where('paqueteInfo', '==', origen.objetivo));
            const recibosSnap = await getDocs(recibosQ);
            for (const rDoc of recibosSnap.docs) {
                const rData = rDoc.data();
                if ((rData.pacienteNombre || '').trim().toLowerCase() === (origen.paciente || '').trim().toLowerCase()) {
                    await updateDoc(doc(db, 'recibos', rDoc.id), {
                        paqueteInfo: destino.objetivo,
                        planId: planDestinoId,
                        notaFusion: `Reasignado por fusión de "${origen.objetivo}" a "${destino.objetivo}"`
                    });
                }
            }
        } catch (eRec) {
            console.warn('Aviso al re-vincular recibos:', eRec);
        }

        // 3. TRASPASO ÍNTEGRO DEL EXPEDIENTE CLÍNICO (Tratamientos, Sesiones, Fotos y Medidas)
        let sesionesTraspasadasCount = 0;
        try {
            const pacNorm = (origen.paciente || '').trim().toLowerCase();
            const tratCol = collection(db, 'tratamientos');
            const tratSnap = await getDocs(tratCol);

            // Identificar los tratamientos del paciente en la colección 'tratamientos'
            const tratPaciente = tratSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(t => {
                    const tPac = (t.pacienteNombre || t.paciente || '').trim().toLowerCase();
                    const tPacId = t.pacienteId;
                    return (
                        (origen.pacienteId && tPacId === origen.pacienteId) ||
                        (destino.pacienteId && tPacId === destino.pacienteId) ||
                        (tPac && tPac === pacNorm)
                    );
                });

            const objOrigenNorm = (origen.objetivo || '').trim().toLowerCase();
            const objDestinoNorm = (destino.objetivo || '').trim().toLowerCase();

            // Tratamiento clínico origen
            const tratOrigenClinico = tratPaciente.find(t => {
                const nNorm = (t.nombre || '').trim().toLowerCase();
                return nNorm === objOrigenNorm || nNorm.includes(objOrigenNorm) || objOrigenNorm.includes(nNorm);
            });

            // Tratamiento clínico destino
            const tratDestinoClinico = tratPaciente.find(t => {
                if (tratOrigenClinico && t.id === tratOrigenClinico.id) return false;
                const nNorm = (t.nombre || '').trim().toLowerCase();
                return nNorm === objDestinoNorm || nNorm.includes(objDestinoNorm) || objDestinoNorm.includes(nNorm);
            });

            if (tratOrigenClinico && tratDestinoClinico) {
                // Traspasar todas las sesiones clínicas vinculadas al origen hacia el destino
                const sesCol = collection(db, 'sesiones');
                const sesQ = query(sesCol, where('tratamientoId', '==', tratOrigenClinico.id));
                const sesSnap = await getDocs(sesQ);

                for (const sDoc of sesSnap.docs) {
                    await updateDoc(doc(db, 'sesiones', sDoc.id), {
                        tratamientoId: tratDestinoClinico.id,
                        tratamientoNombreOriginal: tratOrigenClinico.nombre,
                        notaFusion: `Sesión clínica traspasada por unificación desde "${tratOrigenClinico.nombre}"`
                    });
                    sesionesTraspasadasCount++;
                }

                // Desactivar el tratamiento clínico origen marcándolo como fusionado (NUNCA BORRAR FOTOS)
                await updateDoc(doc(db, 'tratamientos', tratOrigenClinico.id), {
                    activo: false,
                    fusionadoEnTratamientoId: tratDestinoClinico.id,
                    notaFusion: `Tratamiento clínico unificado en "${tratDestinoClinico.nombre}". ${sesionesTraspasadasCount} sesiones traspasadas.`
                });
            } else if (tratOrigenClinico && !tratDestinoClinico) {
                // Si el origen tenía sesiones en el expediente pero el destino aún no tenía doc clínico,
                // renombramos el tratamiento clínico para que adopte el nombre del paquete maestro
                await updateDoc(doc(db, 'tratamientos', tratOrigenClinico.id), {
                    nombre: destino.objetivo,
                    nombreAnterior: tratOrigenClinico.nombre,
                    notaFusion: `Nombre actualizado por unificación de paquete con "${destino.objetivo}"`
                });
                sesionesTraspasadasCount = 'Tratamiento adoptado como maestro';
            }
        } catch (eTrat) {
            console.warn('Aviso durante el traspaso de expediente clínico:', eTrat);
        }

        // 4. Eliminar o archivar plan origen financiero
        if (eliminarOrigen) {
            await deleteDoc(origenRef);
        } else {
            await updateDoc(origenRef, {
                activo: false,
                archivado: true,
                fusionadoEn: planDestinoId,
                acumulado: 0,
                nota: `Plan absorbido por "${destino.objetivo}"`
            });
        }

        return {
            saldoTransferido: saldoATraspasar,
            nuevoAcumulado,
            planDestinoNombre: destino.objetivo,
            sesionesClinicasTraspasadas: sesionesTraspasadasCount
        };
    } catch (error) {
        console.error("Error al fusionar planes:", error);
        throw error;
    }
};

/**
 * Detecta planes de tratamiento que son duplicados o potencialmente duplicados por paciente:
 * - Coincidencia exacta o parcial de nombre del tratamiento.
 * - Registros en $0 (creados en blanco) concurrentes con paquetes con monto.
 */
/**
 * Comprueba si dos nombres de tratamiento son similares (mismo tratamiento o variación):
 * ej. "Efecto lipo" vs "Efecto Lipo sin Bisturí" -> true
 * ej. "Despigmentacion" vs "Despigmentacion entrepierna" -> true
 * ej. "Limpieza facial" vs "Efecto lipo" -> false
 */
export const sonTratamientosSimilares = (nombreA = '', nombreB = '') => {
    const oA = (nombreA || '').trim().toLowerCase();
    const oB = (nombreB || '').trim().toLowerCase();
    if (!oA || !oB) return false;
    if (oA === oB) return true;

    // Si uno contiene al otro completamente (mínimo 4 caracteres)
    if (oA.length >= 4 && oB.length >= 4) {
        if (oA.includes(oB) || oB.includes(oA)) return true;
    }

    // Palabras clínicas clave (ignorando palabras comunes cortas)
    const stopWords = ['para', 'zona', 'sesion', 'sesiones', 'plan', 'paquete', 'con', 'sin', 'del', 'los', 'las'];
    const palabrasA = oA.split(/\s+/).filter(w => w.length > 3 && !stopWords.includes(w));
    const palabrasB = oB.split(/\s+/).filter(w => w.length > 3 && !stopWords.includes(w));

    return palabrasA.some(w => palabrasB.includes(w)) || palabrasB.some(w => palabrasA.includes(w));
};

/**
 * Detecta ÚNICAMENTE tratamientos duplicados del MISMO tipo/servicio por paciente.
 * NUNCA agrupa tratamientos no relacionados (ej. Limpieza facial NO se mezcla con Efecto lipo).
 */
export const detectarPlanesDuplicados = (planes = []) => {
    if (!planes || planes.length === 0) return [];

    const agrupados = {};
    for (const p of planes) {
        if (p.archivado || p.activo === false) continue;
        const pacNombre = (p.paciente || '').trim();
        const pacKey = pacNombre.toLowerCase();
        if (!pacKey) continue;
        if (!agrupados[pacKey]) {
            agrupados[pacKey] = {
                paciente: pacNombre,
                planes: []
            };
        }
        agrupados[pacKey].planes.push(p);
    }

    const resultado = [];

    for (const [key, data] of Object.entries(agrupados)) {
        if (data.planes.length < 2) continue;

        const visitados = new Set();
        const gruposSimilares = [];

        for (let i = 0; i < data.planes.length; i++) {
            const pA = data.planes[i];
            if (visitados.has(pA.id)) continue;

            const grupo = [pA];
            for (let j = 0; j < data.planes.length; j++) {
                if (i === j) continue;
                const pB = data.planes[j];
                if (visitados.has(pB.id)) continue;

                if (sonTratamientosSimilares(pA.objetivo, pB.objetivo)) {
                    grupo.push(pB);
                    visitados.add(pB.id);
                }
            }

            if (grupo.length > 1) {
                visitados.add(pA.id);

                // Ordenar: el plan con mayor meta o acumulado es el Maestro (Destino)
                // El de $0 o menor saldo es el Duplicado (Origen a absorber)
                grupo.sort((a, b) => {
                    const saldoA = (Number(a.meta) || 0) * 10 + (Number(a.acumulado) || 0);
                    const saldoB = (Number(b.meta) || 0) * 10 + (Number(b.acumulado) || 0);
                    return saldoB - saldoA;
                });

                const maestro = grupo[0];
                const duplicado = grupo[grupo.length - 1];

                gruposSimilares.push({
                    idGrupo: `grp_${maestro.id}_${duplicado.id}`,
                    nombreTratamiento: maestro.objetivo,
                    planMaestroSugerido: maestro,
                    planDuplicadoSugerido: duplicado,
                    planes: grupo
                });
            }
        }

        if (gruposSimilares.length > 0) {
            resultado.push({
                paciente: data.paciente,
                pacienteKey: key,
                totalGrupos: gruposSimilares.length,
                grupos: gruposSimilares
            });
        }
    }

    return resultado;
};
