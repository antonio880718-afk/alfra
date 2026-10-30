import { doc, updateDoc, increment, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Sella una visita del paciente en la tarjeta de lealtad.
 * - Máximo 1 sello por día (validación anti-doble sello).
 * - Al llegar a 7 sellos: resetea a 0 y suma 1 recompensa disponible.
 * 
 * @returns {{ ok: boolean, msg: string, nuevoTotal: number, recompensa: boolean }}
 */
export async function sellarVisita(pacienteId) {
    const ref = doc(db, 'pacientes', pacienteId);
    const snap = await getDoc(ref);

    if (!snap.exists()) throw new Error('Paciente no encontrado');

    const data = snap.data();
    const hoy = new Date().toISOString().split('T')[0]; // "2026-05-05"

    // ── Validación anti-doble sello ──────────────────────────────
    const ultimoSello = data.ultimoSello;
    if (ultimoSello) {
        let fechaUltimo;
        if (ultimoSello?.toDate) {
            fechaUltimo = ultimoSello.toDate().toISOString().split('T')[0];
        } else {
            fechaUltimo = new Date(ultimoSello).toISOString().split('T')[0];
        }
        if (fechaUltimo === hoy) {
            return {
                ok: false,
                msg: '⚠️ Ya se registró un sello hoy para este paciente.',
                nuevoTotal: data.sellosLealtad || 0,
                recompensa: false,
            };
        }
    }

    // ── Cálculo de sellos ────────────────────────────────────────
    const sellosActuales = data.sellosLealtad || 0;
    const nuevoTotal = sellosActuales + 1;
    const completoCiclo = nuevoTotal >= 7;

    const ahora = Timestamp.now();

    if (completoCiclo) {
        // ¡Tarjeta completa! Dar recompensa y reiniciar
        await updateDoc(ref, {
            sellosLealtad: 0,
            recompensasDisponibles: increment(1),
            ultimoSello: ahora,
            primerSelloFecha: ahora, // reinicia el primer sello del nuevo ciclo
        });
        return {
            ok: true,
            msg: '🎉 ¡Tarjeta completa! Se otorgó una recompensa al paciente.',
            nuevoTotal: 0,
            recompensa: true,
        };
    } else {
        const updates = {
            sellosLealtad: increment(1),
            ultimoSello: ahora,
        };
        // Guarda la fecha del primer sello del ciclo
        if (sellosActuales === 0) {
            updates.primerSelloFecha = ahora;
        }
        await updateDoc(ref, updates);
        return {
            ok: true,
            msg: `🪷 ¡Sello registrado! Visita ${nuevoTotal} de 7.`,
            nuevoTotal,
            recompensa: false,
        };
    }
}

export async function elegirRecompensa(pacienteId, premioElegido) {
    const ref = doc(db, 'pacientes', pacienteId);
    await updateDoc(ref, {
        recompensaElegida: premioElegido
    });
    return { ok: true, msg: '✅ Premio elegido exitosamente.' };
}

/**
 * Canjea (consume) una recompensa disponible del paciente.
 */
export async function canjearRecompensa(pacienteId) {
    const ref = doc(db, 'pacientes', pacienteId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Paciente no encontrado');

    const disponibles = snap.data().recompensasDisponibles || 0;
    if (disponibles <= 0) {
        return { ok: false, msg: 'El paciente no tiene recompensas disponibles.' };
    }

    await updateDoc(ref, {
        recompensasDisponibles: increment(-1),
        ultimoCanjeRecompensa: Timestamp.now(),
        recompensaElegida: null // Limpiamos la elección tras el canje
    });

    return { ok: true, msg: '✅ Recompensa canjeada exitosamente.' };
}
