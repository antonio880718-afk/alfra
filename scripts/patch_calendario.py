# -*- coding: utf-8 -*-
with open('src/pages/recepcion/CalendarioCitas.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update imports
target_imp1 = "import { addDoc, collection, serverTimestamp } from 'firebase/firestore';"
replacement_imp1 = "import { addDoc, collection, serverTimestamp, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';"

target_imp2 = "Trash2, Edit, PlusCircle, MapPin, Stamp"
replacement_imp2 = "Trash2, Edit, PlusCircle, MapPin, Stamp, Heart, MessageSquare"

# 2. Add state and effect in component
target_state = "const [citasList, setCitasList] = useState([]);"
if target_state not in text:
    target_state = "const citasPendientesAutorizacionPase = useMemo(() => {"

replacement_state = """    const [dudasPostConsulta, setDudasPostConsulta] = useState([]);

    useEffect(() => {
        const q = query(
            collection(db, "seguimiento_post_consulta"),
            where("atendido", "==", false)
        );
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setDudasPostConsulta(list);
        }, (err) => console.warn("Aviso dudas listener:", err));
        return () => unsub();
    }, []);

    const handleResolverDudaPostConsulta = async (id) => {
        try {
            await updateDoc(doc(db, "seguimiento_post_consulta", id), {
                atendido: true,
                atendidoPor: 'Recepción',
                atendidoEn: new Date().toISOString()
            });
        } catch(err) {
            console.error("Error al resolver duda:", err);
        }
    };

    const citasPendientesAutorizacionPase = useMemo(() => {"""

# 3. Add UI banner
target_ui = "{/* Solicitudes de Autorización de Pase a Caja en Cita Única */}"
if target_ui not in text:
    # Look for unicode or ASCII
    idx = text.find("Pase a Caja en Cita")
    if idx != -1:
        start_comment = text.rfind("{/*", 0, idx)
        end_comment = text.find("*/}", idx) + 3
        target_ui = text[start_comment:end_comment]

replacement_ui = """{/* Alertas de Dudas / Molestias Post-Consulta Concierge */}
            {dudasPostConsulta.length > 0 && (
                <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-2 border-rose-300 rounded-2xl p-4 space-y-3 shadow-md animate-in fade-in">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-rose-500 text-white rounded-xl">
                            <Heart size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-rose-950 uppercase tracking-wide">
                                🛎️ {dudasPostConsulta.length} Seguimiento(s) Concierge Post-Consulta
                            </h4>
                            <p className="text-xs text-rose-800">
                                Los siguientes pacientes completaron su micro check-in reportando dudas o molestias:
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {dudasPostConsulta.map((duda) => (
                            <div key={duda.id} className="bg-white p-3 rounded-xl border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-black text-gray-900">
                                        {duda.pacienteNombre} <span className="text-[10px] text-gray-500 font-bold">({duda.servicio || 'Tratamiento'} con {duda.especialistaNombre})</span>
                                    </p>
                                    <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-100">
                                        "{duda.nota || 'Reportó tener dudas sobre su sesión.'}"
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {duda.pacienteTelefono && (
                                        <a
                                            href={`https://wa.me/${duda.pacienteTelefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${duda.pacienteNombre}, te escribimos de Recepción Clínica ALFRA respecto a tu duda sobre tu sesión con ${duda.especialistaNombre}. ¿Cómo te podemos apoyar?`)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-sm"
                                        >
                                            <MessageSquare size={13} /> WhatsApp
                                        </a>
                                    )}
                                    <button
                                        onClick={() => handleResolverDudaPostConsulta(duda.id)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                                    >
                                        ✓ Marcar Atendido
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            """ + target_ui

if target_imp1 in text and target_state in text:
    text = text.replace(target_imp1, replacement_imp1, 1)
    text = text.replace(target_imp2, replacement_imp2, 1)
    text = text.replace(target_state, replacement_state, 1)
    text = text.replace(target_ui, replacement_ui, 1)
    with open('src/pages/recepcion/CalendarioCitas.jsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print("CalendarioCitas updated successfully with Concierge alerts!")
else:
    print("Could not match targets in CalendarioCitas")
