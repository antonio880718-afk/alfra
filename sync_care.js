
import { initializeApp } from 'firebase/app';
import { getFirestore, query, collection, where, getDocs, doc, setDoc } from 'firebase/firestore';

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
    try {
        console.log("Buscando a Antonio Rangel...");
        const q = query(collection(db, 'pacientes'), where('nombre', '==', 'Antonio Rangel'));
        const snap = await getDocs(q);

        if (snap.empty) {
            console.log("No encontrado.");
            return;
        }

        const pId = snap.docs[0].id;
        console.log("ID encontrado:", pId);

        const cuidados = [
            { id: 'f1', texto: 'Aplicar protector solar FPS 50+ cada 4 horas', categoria: 'Facial', activo: true },
            { id: 'c1', texto: 'Tomar mínimo 2 litros de agua al día', categoria: 'Corporal', activo: true },
            { id: 'custom_1', texto: 'RECUERDA TU CITA DE MAÑANA', categoria: 'Personalizado', activo: true }
        ];

        await setDoc(doc(db, 'apoyoEnCasa', pId), {
            pacienteId: pId,
            cuidados,
            updatedAt: new Date().toISOString(),
            updatedBy: 'especialista'
        }, { merge: true });

        console.log("✅ Cuidados asignados con éxito.");
    } catch (e) {
        console.error("❌ Error:", e);
    }
}

run();
