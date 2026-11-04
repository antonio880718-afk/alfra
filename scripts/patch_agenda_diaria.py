# -*- coding: utf-8 -*-
import sys

with open('src/pages/especialista/AgendaDiaria.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add import
if 'reproducirSonidoNotificacion' not in text:
    import_line = "import { reproducirSonidoNotificacion } from '../../services/notificationService';\n"
    insert_pos = text.find("import { onCitasEspecialistaChange")
    if insert_pos != -1:
        text = text[:insert_pos] + import_line + text[insert_pos:]
    else:
        text = import_line + text

# 2. Update sound play in unsubAlertas
old_audio = """            // Escuchar alertas de sala de espera
            unsubAlertas = onAlertasEspecialistaChange(identifiers, (nuevasAlertas) => {
                setAlertas(nuevasAlertas);
                if (nuevasAlertas.length > 0) {
                    try {
                        const audio = new Audio('/notification.mp3');
                        audio.play().catch(() => {});
                    } catch (e) {}
                }
            });"""

new_audio = """            // Escuchar alertas de sala de espera con sonido melodioso sintetizado
            unsubAlertas = onAlertasEspecialistaChange(identifiers, (nuevasAlertas) => {
                setAlertas(nuevasAlertas);
                if (nuevasAlertas.length > 0) {
                    reproducirSonidoNotificacion();
                }
            });"""

if old_audio in text:
    text = text.replace(old_audio, new_audio)
    print("unsubAlertas en AgendaDiaria.jsx actualizado.")
else:
    print("Aviso: old_audio no coincidio exactamente.")

with open('src/pages/especialista/AgendaDiaria.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("AgendaDiaria.jsx actualizado con exito.")
