import { Capacitor } from '@capacitor/core';

// Web Audio API para reproducir un chime melodioso (2 tonos suaves) sin requerir archivos externos
export const reproducirSonidoNotificacion = () => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            const ctx = new AudioCtx();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            const now = ctx.currentTime;

            // Nota 1: La 5 (880 Hz) - suave
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, now);
            gain1.gain.setValueAtTime(0.18, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.35);

            // Nota 2: Mi 6 (1318.5 Hz) - campana armónica
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1318.5, now + 0.1);
            gain2.gain.setValueAtTime(0.22, now + 0.1);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.1);
            osc2.stop(now + 0.55);
            try {
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate([200, 100, 250]);
                }
            } catch (_) {}
            return;
        }
    } catch (_) {
        // Fallback a reproductor de audio estándar
    }

    try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
    } catch (_) {}
};

// Solicitar permisos de notificación tanto en móvil nativo (Android/iOS) como en PC (Navegador)
export const solicitarPermisoNotificaciones = async () => {
    // 1. Entorno móvil nativo (Capacitor Android / iOS)
    if (Capacitor.isNativePlatform()) {
        try {
            const { PushNotifications } = await import('@capacitor/push-notifications');
            let perm = await PushNotifications.checkPermissions();
            if (perm.receive === 'prompt') {
                perm = await PushNotifications.requestPermissions();
            }
            if (perm.receive === 'granted') {
                await PushNotifications.register();
                return true;
            }
            return false;
        } catch (e) {
            console.warn('[NOTIF] Error solicitando permisos push nativos:', e);
            return false;
        }
    }

    // 2. Entorno Web / PC (Chrome, Edge, Firefox, Safari)
    if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
            if (Notification.permission === 'granted') return true;
            if (Notification.permission !== 'denied') {
                const res = await Notification.requestPermission();
                return res === 'granted';
            }
        } catch (e) {
            console.warn('[NOTIF] Error solicitando permisos de notificación web:', e);
        }
    }

    return false;
};

// Comprobar si las notificaciones están permitidas
export const estanNotificacionesPermitidas = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
        return Notification.permission === 'granted';
    }
    return false;
};

// Emitir notificación visual en escritorio (PC) y sonido
// Se auto-descarta a los 6 segundos para no quedarse fija por la eternidad
export const emitirNotificacion = (titulo, opciones = {}) => {
    // 1. Reproducir sonido de aviso
    if (opciones.sonido !== false) {
        reproducirSonidoNotificacion();
    }

    // 2. Notificación en sistema operativo (PC / Desktop / Web)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
            const notif = new Notification(titulo || 'Clínica ALFRA', {
                body: opciones.body || '',
                icon: opciones.icon || '/logo.png',
                badge: '/logo.png',
                tag: opciones.tag || 'alfra-' + Date.now(),
                silent: true // El sonido ya lo gestionamos con Web Audio API
            });

            // Auto-cerrar a los 6 segundos (garantiza que NUNCA se queda por la eternidad)
            const autoCloseMs = opciones.duracionMs || 6000;
            const timer = setTimeout(() => {
                try {
                    notif.close();
                } catch (_) {}
            }, autoCloseMs);

            notif.onclick = () => {
                clearTimeout(timer);
                try {
                    window.focus();
                    if (typeof opciones.onClick === 'function') {
                        opciones.onClick();
                    }
                    notif.close();
                } catch (_) {}
            };

            return notif;
        } catch (e) {
            console.warn('[NOTIF] Error mostrando notificación web:', e);
        }
    }

    return null;
};
