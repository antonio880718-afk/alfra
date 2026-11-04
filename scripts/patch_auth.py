# -*- coding: utf-8 -*-
import sys

with open('src/contexts/AuthContext.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

marker1 = 'const registerPushNotifications = async'
marker2 = 'const selectRole = (role) => {'

idx1 = text.find(marker1)
idx2 = text.find(marker2)

if idx1 == -1 or idx2 == -1:
    print("Error: No se encontraron los marcadores en AuthContext.jsx")
    sys.exit(1)

replacement = """const registerPushNotifications = async (uid) => {
        // En PC / Navegador Web: solicitar permisos de notificaciones del sistema
        if (!Capacitor.isNativePlatform()) {
            if (typeof window !== 'undefined' && 'Notification' in window) {
                if (Notification.permission === 'default') {
                    try {
                        await Notification.requestPermission();
                    } catch (_) {}
                }
            }
            return;
        }

        try {
            // 1. Pedir permisos nativos
            let permStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive !== 'granted') {
                throw new Error('Permisos de notificacion denegados');
            }

            // 2. Registrar con Apple / Google
            await PushNotifications.register();

            // 3. Obtener el Token
            PushNotifications.addListener('registration', async (token) => {
                console.log('Push registration success, token: ' + token.value);
                // 4. Guardarlo en Firestore (setDoc merge para crear o actualizar)
                await setDoc(doc(db, 'usuarios', uid), {
                    fcmToken: token.value,
                    fcmTokenUpdatedAt: new Date().toISOString()
                }, { merge: true });
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('Error on registration: ' + JSON.stringify(error));
            });

            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('Push received: ' + JSON.stringify(notification));
                try {
                    const audio = new Audio('/notification.mp3');
                    audio.play().catch(() => {});
                } catch (_) {}
            });

        } catch (error) {
            console.error('Error registrando Push Notifications:', error);
        }
    };

    """

new_text = text[:idx1] + replacement + text[idx2:]
with open('src/contexts/AuthContext.jsx', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("AuthContext.jsx actualizado con exito.")
