/**
 * Servicio y plantillas oficiales de WhatsApp para Clínica ALFRA
 */

export const getWhatsAppMensajeCita = (cita) => {
    const f = cita.fechaYMD ? cita.fechaYMD.split('-').reverse().join('/') : (cita.fecha || '');
    const horaStr = cita.horaFormateada || cita.hora || '';
    const pacienteNombre = cita.paciente || cita.pacienteNombre || 'Paciente';
    const servicioNombre = cita.servicio || 'Tratamiento en Clínica ALFRA';
    const especialistaNombre = cita.especialista || cita.especialistaNombre || 'Clínica ALFRA';
    const cabinaInfo = cita.cabina ? `
🏢 *Espacio:* ${cita.cabina}` : '';

    const lineas = [
        `¡Hola, *${pacienteNombre}*! ✨ Esperamos que estés teniendo un excelente día.`,
        `Tu espacio de relajación y cuidado personal en *Clínica ALFRA* está programado:

📅 *Cita:* ${f} a las ${horaStr}
💆‍♀️ *Servicio:* ${servicioNombre}
👩‍⚕️ *Especialista:* ${especialistaNombre}${cabinaInfo}`,
        `Continuar con tu ritmo de citas es fundamental para consolidar tu progreso y alcanzar tus metas. 🌸`,
        `⏰ _Te recordamos que contamos con 10 minutos de tolerancia para garantizar tu sesión completa._`,
        `📍 *UBICACIÓN:*
Calle Río Fuerte #26, (esq. con calle Jaime Torres Bodet) Colonia: Lomas de Bellavista, Lázaro Cárdenas, Mich.`,
        `📌 *REFERENCIA:*
En la Av. Melchor Ocampo, a la altura de los edificios de Las Palmas, pasando los puestos de comida está la Farmacia del Ahorro; por esa calle (Jaime Torres Bodet) sube 2 cuadras en dirección a los edificios. Justo en la esquina, casa color blanco con herrería dorada y puerta café.`,
        `🗺️ *GOOGLE MAPS:*
https://maps.app.goo.gl/hLycVd8Dm5MFAehm9

¿Nos confirmas tu asistencia respondiendo a este mensaje? ¡Te esperamos con gusto! 💆‍♀️✨`
    ];

    return lineas.join('\n\n');
};

export const abrirWhatsApp = (telefono, mensaje = '') => {
    let clean = String(telefono || '').replace(/\D/g, '');
    if (clean.length === 10) {
        clean = '52' + clean;
    }

    const queryParts = [];
    if (clean) queryParts.push(`phone=${clean}`);
    if (mensaje) queryParts.push(`text=${encodeURIComponent(mensaje)}`);
    const query = queryParts.join('&');

    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
        // En celular abre la aplicación nativa directamente con whatsapp:// sin pasar por redirecciones web
        window.open(`whatsapp://send?${query}`, '_blank');
    } else {
        // En PC abre WhatsApp Web directamente, evitando el bug del acortador wa.me que corrompe los emojis
        window.open(`https://web.whatsapp.com/send?${query}`, '_blank');
    }
};

export const enviarWhatsAppCita = (cita) => {
    if (!cita || !cita.telefono) {
        alert('Sin teléfono registrado para este paciente.');
        return;
    }
    const mensaje = getWhatsAppMensajeCita(cita);
    abrirWhatsApp(cita.telefono, mensaje);
};

export const TELEFONO_CLINICA_ALFRA = '527535386018';

/**
 * Envía un mensaje directo por WhatsApp a la Clínica ALFRA cuando el paciente
 * solicita información en un Flyer promocional, Paquete o Servicio desde su App.
 */
export const enviarWhatsAppQuieroEsto = ({
    tipo = 'promocion', // 'flyer' | 'paquete' | 'servicio'
    titulo = '',
    pacienteNombre = '',
    precioTotal = 0,
    esPaquete = false,
    numeroSesiones = 1,
    anticipoSesion1 = 0,
    pagoPorSesionRestante = 0
} = {}) => {
    const nombreLimpio = String(pacienteNombre || '').trim();
    const presentacion = nombreLimpio ? `Mi nombre es *${nombreLimpio}*. ` : '';
    const nombreItem = String(titulo || 'una de sus promociones').trim();
    const fmt = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    let detalleItem = '';
    if (tipo === 'flyer') {
        detalleItem = `Me interesa la promoción *"${nombreItem}"* que vi en la aplicación de la clínica. ¿Podrían brindarme más información y disponibilidad para agendar?`;
    } else if (esPaquete || tipo === 'paquete') {
        const precioFmt = precioTotal > 0 ? ` (inversión total de $${fmt(precioTotal)} por ${numeroSesiones} sesiones, con anticipo de $${fmt(anticipoSesion1 || (precioTotal * 0.2))} en la primera sesión)` : '';
        detalleItem = `Me interesa el paquete *"${nombreItem}"*${precioFmt}. ¿Podrían brindarme más información y disponibilidad para iniciar mi tratamiento?`;
    } else {
        const precioFmt = precioTotal > 0 ? ` (inversión de $${fmt(precioTotal)} por sesión)` : '';
        detalleItem = `Me interesa el tratamiento *"${nombreItem}"*${precioFmt}. ¿Podrían brindarme más información y disponibilidad para agendar?`;
    }

    const mensaje = `Buen día, Clínica ALFRA. ${presentacion}${detalleItem}\n\nQuedo atenta(o) a su respuesta. Muchas gracias.`;
    const url = `https://wa.me/${TELEFONO_CLINICA_ALFRA}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
};
