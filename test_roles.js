const admin = require('firebase-admin');
const serviceAccount = require('./functions/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  const usersRef = db.collection('usuarios');
  const snapshot = await usersRef.get();
  console.log("LISTA DE USUARIOS Y ROLES:");
  snapshot.forEach(doc => {
    const data = doc.data();
    const email = data.email || '';
    const role = data.role || '';
    const token = data.fcmToken ? data.fcmToken.substring(0, 10) + '...' : 'NONE';
    if (role === 'Administrador' || role === 'Master Admin' || email.toLowerCase().includes('alejandra') || email.toLowerCase().includes('antonio')) {
        console.log(`Email: ${email} | Role: ${role} | Token: ${token}`);
    }
  });
  process.exit(0);
}
run();
