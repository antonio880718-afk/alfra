const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp({ projectId: 'clinica-alfra' });

const auth = admin.auth();

const users = [
    { email: 'antonio880718@gmail.com', password: 'Alfra2026!', label: 'Admin' },
    { email: 'dra.prueba@alfra.com', password: 'Alfra2026!', label: 'Specialist' },
    { email: 'recepcion@alfra.com', password: 'Alfra2026!', label: 'Receptionist' },
    { email: 'antoniolopez202191@yahoo.com', password: 'Alfra2026!', label: 'Patient' }
];

async function updatePasswords() {
    for (const user of users) {
        try {
            const userRecord = await auth.getUserByEmail(user.email);
            await auth.updateUser(userRecord.uid, {
                password: user.password
            });
            console.log(`✅ Contraseña actualizada para ${user.label} (${user.email})`);
        } catch (error) {
            console.error(`❌ Error con ${user.label} (${user.email}):`, error.message);
        }
    }
}

updatePasswords().then(() => {
    console.log('Finalizado.');
    process.exit(0);
});
