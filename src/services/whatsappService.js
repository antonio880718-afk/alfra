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
Calle Río Fuerte #26, (esq. con calle Jaime Torres Bodet) Colonia: Lomas de Bella Vista, Lázaro Cárdenas, Mich.`,
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
