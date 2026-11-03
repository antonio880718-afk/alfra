const admin = require('firebase-admin');
process.env.GCLOUD_PROJECT = 'clinica-alfra';
try {
  admin.initializeApp();
  console.log("Firebase Admin SDK initialized successfully without config!");
} catch (e) {
  console.error("Initialization error:", e);
}

const db = admin.firestore();

async function run() {
  console.log("Searching for Elias in 'usuarios'...");
  const usuariosRef = db.collection('usuarios');
  const snap = await usuariosRef.get();
  console.log(`Found ${snap.size} documents in 'usuarios'`);
  snap.forEach(doc => {
    const data = doc.data();
    if ((data.nombre && data.nombre.toLowerCase().includes('elias')) || (data.email && data.email.toLowerCase().includes('elias'))) {
      console.log(`FOUND in 'usuarios': Doc ID: ${doc.id} =>`, data);
    }
  });

  console.log("Searching for Elias in 'users'...");
  const usersRef = db.collection('users');
  const snap2 = await usersRef.get();
  console.log(`Found ${snap2.size} documents in 'users'`);
  snap2.forEach(doc => {
    const data = doc.data();
    if ((data.nombre && data.nombre.toLowerCase().includes('elias')) || (data.email && data.email.toLowerCase().includes('elias'))) {
      console.log(`FOUND in 'users': Doc ID: ${doc.id} =>`, data);
    }
  });
  
  process.exit(0);
}

run().catch(err => {
  console.error("Run error:", err);
  process.exit(1);
});
