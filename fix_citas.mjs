import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs, deleteDoc, doc, where } from 'firebase/firestore';

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
    const ref = collection(db, 'citas');
    const q = query(ref);
    const snap = await getDocs(q);
    
    let antonioCitas = [];
    snap.forEach(doc => {
        const data = doc.data();
        if (data.pacienteNombre?.toLowerCase().includes('antonio') && data.servicio?.includes('Premio')) {
            antonioCitas.push({ id: doc.id, ...data });
        }
    });

    console.log(`Encontré ${antonioCitas.length} citas de premio para Antonio.`);
    
    // Sort by createdAt desc
    antonioCitas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Delete all except the newest one, or delete the older ones
    if (antonioCitas.length > 1) {
        for (let i = 1; i < antonioCitas.length; i++) {
            const cita = antonioCitas[i];
            console.log(`Borrando cita duplicada (antigua): ${cita.id}`);
            await deleteDoc(doc(db, 'citas', cita.id));
        }
    }

    console.log("Limpieza terminada.");
    process.exit(0);
}

run().catch(console.error);
