
const admin = require('firebase-admin');
admin.initializeApp();

(async () => {
    try {
        console.log('Buscando admins...');
        const snap = await admin.firestore().collection('usuarios').where('role', '==', 'Administrador').get();
        const tokens = [];
        snap.forEach(d => {
            const data = d.data();
            console.log('Encontrado Admin:', data.nombre, 'Email:', data.email, 'Token:', data.fcmToken ? 'SI' : 'NO');
            if (data.fcmToken) tokens.push(data.fcmToken);
        });

        console.log('Total tokens:', tokens.length);

        if (tokens.length > 0) {
            const response = await admin.messaging().sendEachForMulticast({
                tokens,
                notification: {
                    title: 'Prueba de Sistema',
                    body: 'Esta es una prueba de conectividad de Alfra.'
                }
            });
            console.log('Resultado envío:', response);
        } else {
            console.log('NO HAY TOKENS, abortando envío.');
        }
    } catch(e) {
        console.error('Error:', e);
    }
    process.exit(0);
})();
