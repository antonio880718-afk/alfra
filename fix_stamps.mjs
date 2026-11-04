import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBbWdhkDBvClLLgv7O3aOHjcMze0E_H2oA",
    authDomain: "clinica-alfra.firebaseapp.com",
    projectId: "clinica-alfra",
    storageBucket: "clinica-alfra.firebasestorage.app",
    messagingSenderId: "572433894677",
    appId: "1:572433894677:web:b366f7b13bbf6a30a16d1c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    console.log("Conectando a base de datos...");
    const ref = collection(db, 'pacientes');
    const q = query(ref);
    const snap = await getDocs(q);
    
    let antonioId = null;

    snap.forEach(doc => {
        const nombre = doc.data().nombre?.toLowerCase() || '';
        if (nombre.includes('antonio rangel')) antonioId = doc.id;
    });

    if (antonioId) {
        console.log("Seteando premio a Antonio (ID: " + antonioId + ")");
        await updateDoc(doc(db, 'pacientes', antonioId), {
            sellosLealtad: 0,
            recompensasDisponibles: 1, // Le damos 1 recompensa directo
            recompensaElegida: null, // Limpiamos si tenía algo
            ultimoSello: null 
        });
        console.log("Antonio listo con su premio disponible.");
    } else {
        console.log("No encontré a Antonio.");
    }

    console.log("¡Proceso terminado!");
    process.exit(0);
}

run().catch(console.error);
