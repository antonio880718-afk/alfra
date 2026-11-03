package com.clinica.alfra;

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
