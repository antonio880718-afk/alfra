# -*- coding: utf-8 -*-
import os
import re

print("Applying Notification & Vibration Fixes...")

# 1. Update src/components/paciente/AutoAgendadoModal.jsx
p_modal = 'src/components/paciente/AutoAgendadoModal.jsx'
with open(p_modal, 'r', encoding='utf-8') as f:
    c_modal = f.read()

target_call = """                const fns = getFunctions();
                const notificar = httpsCallable(fns, 'notificarNuevaCitaPaciente');
                await notificar({ citaId, pacienteNombre: paciente.nombre, fechaHora: selectedTime, especialistaId: finalEspId });"""

replacement_call = """                const fns = getFunctions();
                const notificar = httpsCallable(fns, 'notificarNuevaCitaPaciente');
                await notificar({
                    citaId,
                    pacienteNombre: paciente.nombre || 'Paciente ALFRA',
                    fechaHora: selectedTime,
                    especialistaId: finalEspId,
                    especialistaNombre: finalEspNombre,
                    servicio: servicioSeleccionado.nombre,
                    fecha: selectedDate,
                    hora: horaCitaStr
                });"""

if target_call in c_modal:
    c_modal = c_modal.replace(target_call, replacement_call)
    with open(p_modal, 'w', encoding='utf-8') as f:
        f.write(c_modal)
    print("AutoAgendadoModal.jsx updated successfully!")
else:
    print("Warning: target_call not found in AutoAgendadoModal.jsx, checking regex...")
    pattern = r"await notificar\(\{ citaId, pacienteNombre: paciente\.nombre, fechaHora: selectedTime, especialistaId: finalEspId \}\);"
    if re.search(pattern, c_modal):
        c_modal = re.sub(pattern, """await notificar({
                    citaId,
                    pacienteNombre: paciente.nombre || 'Paciente ALFRA',
                    fechaHora: selectedTime,
                    especialistaId: finalEspId,
                    especialistaNombre: finalEspNombre,
                    servicio: servicioSeleccionado.nombre,
                    fecha: selectedDate,
                    hora: horaCitaStr
                });""", c_modal)
        with open(p_modal, 'w', encoding='utf-8') as f:
            f.write(c_modal)
        print("AutoAgendadoModal.jsx updated via regex successfully!")
    else:
        print("Error: Could not find notificar call in AutoAgendadoModal.jsx")

# 2. Update functions/index.js
p_fns = 'functions/index.js'
with open(p_fns, 'r', encoding='utf-8') as f:
    c_fns = f.read()

# Update ANDROID_NOTIFICATION_CONFIG
old_cfg = """const ANDROID_NOTIFICATION_CONFIG = {
    priority: 'high',
    notification: {
        channelId: 'alfra_citas_alertas',
        sound: 'default',
        defaultSound: true,
        defaultVibrateTimings: true,
        notificationPriority: 'PRIORITY_MAX',
        visibility: 'PUBLIC'
    }
};"""

new_cfg = """const ANDROID_NOTIFICATION_CONFIG = {
    priority: 'high',
    notification: {
        channelId: 'alfra_citas_urgentes_v2',
        sound: 'default',
        defaultSound: true,
        defaultVibrateTimings: false,
        vibrateTimingsMillis: [0, 500, 250, 500, 250, 500],
        priority: 'high',
        visibility: 'public'
    }
};"""

if old_cfg in c_fns:
    c_fns = c_fns.replace(old_cfg, new_cfg)
    print("ANDROID_NOTIFICATION_CONFIG updated in functions/index.js")
else:
    # regex fallback
    c_fns = re.sub(
        r"const ANDROID_NOTIFICATION_CONFIG = \{[\s\S]*?\n\};",
        new_cfg,
        c_fns,
        count=1
    )
    print("ANDROID_NOTIFICATION_CONFIG updated via regex in functions/index.js")

# Update notificarNuevaCitaPaciente logic in functions/index.js
old_notif_logic = """    const { citaId, pacienteNombre, fechaHora, especialistaId, especialistaNombre, servicio, fecha, hora } = data;
    const ahoraStr = new Date().toISOString();
    const fechaFormat = fecha || (fechaHora ? new Date(fechaHora).toLocaleDateString('es-MX') : 'próxima fecha');
    const horaFormat = hora || (fechaHora ? new Date(fechaHora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '');
    const nomEsp = especialistaNombre || 'Especialista ALFRA';
    const nomServ = servicio || 'Tratamiento';
    const nomPac = pacienteNombre || 'Paciente';"""

new_notif_logic = """    const { citaId, pacienteNombre, fechaHora, especialistaId, especialistaNombre, servicio, fecha, hora } = data;
    const ahoraStr = new Date().toISOString();
    let fechaFormat = fecha || (fechaHora ? new Date(fechaHora).toLocaleDateString('es-MX') : '');
    let horaFormat = hora || (fechaHora ? new Date(fechaHora).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '');
    let nomEsp = especialistaNombre;
    let nomServ = servicio;
    let nomPac = pacienteNombre;

    // CONSULTAR DIRECTAMENTE EN FIRESTORE LA CITA SI FALTA EL SERVICIO O ESPECIALISTA
    if (citaId && (!nomServ || nomServ === 'Tratamiento' || !nomEsp || nomEsp === 'Especialista ALFRA' || !nomPac || !fechaFormat || !horaFormat)) {
        try {
            const citaSnap = await admin.firestore().collection('citas').doc(citaId).get();
            if (citaSnap.exists) {
                const cd = citaSnap.data();
                if (!nomServ || nomServ === 'Tratamiento') {
                    nomServ = cd.servicio || cd.tratamiento || cd.nombreServicio || cd.concepto;
                }
                if (!nomEsp || nomEsp === 'Especialista ALFRA') {
                    nomEsp = cd.especialistaNombre || cd.especialista;
                }
                if (!nomPac) {
                    nomPac = cd.pacienteNombre || cd.paciente;
                }
                if (!fechaFormat) {
                    fechaFormat = cd.fecha || cd.fechaYMD || '';
                }
                if (!horaFormat) {
                    horaFormat = cd.hora || '';
                }
            }
        } catch (fetchErr) {
            console.warn('[DEBUG_NOTIF] Error consultando cita en Firestore:', fetchErr);
        }
    }

    nomServ = nomServ || 'Consulta / Tratamiento';
    nomEsp = nomEsp || 'Especialista ALFRA';
    nomPac = nomPac || 'Paciente';
    if (!fechaFormat) fechaFormat = 'próxima fecha';"""

if old_notif_logic in c_fns:
    c_fns = c_fns.replace(old_notif_logic, new_notif_logic)
    print("notificarNuevaCitaPaciente logic updated in functions/index.js")
else:
    # regex fallback for notificarNuevaCitaPaciente
    c_fns = re.sub(
        r"const \{ citaId, pacienteNombre, fechaHora, especialistaId, especialistaNombre, servicio, fecha, hora \} = data;[\s\S]*?const nomPac = pacienteNombre \|\| 'Paciente';",
        new_notif_logic,
        c_fns
    )
    print("notificarNuevaCitaPaciente logic updated via regex in functions/index.js")

with open(p_fns, 'w', encoding='utf-8') as f:
    f.write(c_fns)

# 3. Update android/app/src/main/java/com/clinica/alfra/MainActivity.java
p_main = 'android/app/src/main/java/com/clinica/alfra/MainActivity.java'
new_main_content = """package com.clinica.alfra;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager != null) {
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .build();

                    long[] patronVibracion = new long[]{0, 500, 250, 500, 250, 500};

                    // Purgar canales anteriores para forzar a Android a regenerar la vibración física
                    try {
                        manager.deleteNotificationChannel("alfra_citas_alertas");
                        manager.deleteNotificationChannel("fcm_fallback_notification_channel");
                    } catch (Exception ignored) {}

                    // Canal 1: alfra_citas_urgentes_v2 (Canal prioritario activo con vibración forzada)
                    NotificationChannel channelUrgent = new NotificationChannel(
                        "alfra_citas_urgentes_v2",
                        "Citas y Alertas ALFRA",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    channelUrgent.setDescription("Notificaciones prioritarias sobre citas médicas, recordatorios y avisos clínicos con vibración activa");
                    channelUrgent.enableLights(true);
                    channelUrgent.setLightColor(Color.parseColor("#20B2AA"));
                    channelUrgent.enableVibration(true);
                    channelUrgent.setVibrationPattern(patronVibracion);
                    channelUrgent.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), audioAttributes);
                    channelUrgent.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    manager.createNotificationChannel(channelUrgent);

                    // Canal 2: alfra_citas_alertas (Compatibilidad con payloads existentes)
                    NotificationChannel channel1 = new NotificationChannel(
                        "alfra_citas_alertas",
                        "Citas ALFRA",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    channel1.setDescription("Avisos generales de citas con vibración");
                    channel1.enableLights(true);
                    channel1.setLightColor(Color.parseColor("#20B2AA"));
                    channel1.enableVibration(true);
                    channel1.setVibrationPattern(patronVibracion);
                    channel1.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), audioAttributes);
                    channel1.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    manager.createNotificationChannel(channel1);

                    // Canal 3: fcm_fallback_notification_channel (Fallback oficial de Firebase)
                    NotificationChannel channel2 = new NotificationChannel(
                        "fcm_fallback_notification_channel",
                        "Notificaciones ALFRA",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    channel2.setDescription("Avisos y mensajes directos del sistema ALFRA con vibración");
                    channel2.enableLights(true);
                    channel2.setLightColor(Color.parseColor("#20B2AA"));
                    channel2.enableVibration(true);
                    channel2.setVibrationPattern(patronVibracion);
                    channel2.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), audioAttributes);
                    channel2.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    manager.createNotificationChannel(channel2);
                }
            } catch (Exception e) {
                // Ignorar en caso de error de compatibilidad
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().clearCache(true);
                this.bridge.getWebView().clearFormData();
                this.bridge.getWebView().clearHistory();
            }
        } catch (Exception e) {
            // Ignorar errores silentes si el puente aún no está listo
        }
    }
}
"""

with open(p_main, 'w', encoding='utf-8') as f:
    f.write(new_main_content)
print("MainActivity.java updated successfully!")

# 4. Update android/app/src/main/AndroidManifest.xml
p_manifest = 'android/app/src/main/AndroidManifest.xml'
with open(p_manifest, 'r', encoding='utf-8') as f:
    c_man = f.read()

c_man = c_man.replace(
    'android:value="alfra_citas_alertas"',
    'android:value="alfra_citas_urgentes_v2"'
)
with open(p_manifest, 'w', encoding='utf-8') as f:
    f.write(c_man)
print("AndroidManifest.xml updated with alfra_citas_urgentes_v2!")

# 5. Update src/contexts/AuthContext.jsx
p_auth = 'src/contexts/AuthContext.jsx'
with open(p_auth, 'r', encoding='utf-8') as f:
    c_auth = f.read()

# Add alfra_citas_urgentes_v2 channel in AuthContext
if 'alfra_citas_urgentes_v2' not in c_auth:
    target_ch = """                    // Canal principal con alta prioridad, sonido nativo y vibración
                    await PushNotifications.createChannel({
                        id: 'alfra_citas_alertas',"""
    replacement_ch = """                    // Canal prioritario v2 con vibración forzada y sonido nativo
                    await PushNotifications.createChannel({
                        id: 'alfra_citas_urgentes_v2',
                        name: 'Citas y Alertas ALFRA (Vibración y Sonido)',
                        description: 'Notificaciones sobre citas médicas con vibración física y sonido',
                        importance: 5, // 5 = IMPORTANCE_HIGH (banner emergente, sonido y vibración)
                        visibility: 1, // 1 = Visible en pantalla de bloqueo
                        sound: 'default',
                        vibration: true,
                        lights: true,
                        lightColor: '#20B2AA'
                    });

                    // Canal secundario alfra_citas_alertas
                    await PushNotifications.createChannel({
                        id: 'alfra_citas_alertas',"""
    c_auth = c_auth.replace(target_ch, replacement_ch)
    # Also update vibration in foreground listener
    c_auth = c_auth.replace(
        "navigator.vibrate([250, 150, 250, 150, 400]);",
        "navigator.vibrate([0, 500, 250, 500, 250, 500]);"
    )
    with open(p_auth, 'w', encoding='utf-8') as f:
        f.write(c_auth)
    print("AuthContext.jsx updated with alfra_citas_urgentes_v2 and enhanced vibration!")

# 6. Bump versionCode & versionName in android/app/build.gradle
p_gradle = 'android/app/build.gradle'
with open(p_gradle, 'r', encoding='utf-8') as f:
    c_grad = f.read()

c_grad = re.sub(r'versionCode \d+', 'versionCode 106', c_grad)
c_grad = re.sub(r'versionName "[^"]+"', 'versionName "1.5.3"', c_grad)
with open(p_gradle, 'w', encoding='utf-8') as f:
    f.write(c_grad)
print("android/app/build.gradle bumped to versionCode 106 (v1.5.3)!")

print("All fixes applied!")
