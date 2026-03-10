import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
    Camera, Save, ArrowLeft, FileText, Activity, User, Calendar, Search,
    Ruler, AlertCircle, HeartPulse, CheckCircle, Loader, Plus, Trash2, Home, Lock
} from 'lucide-react';
import { getPacienteById } from '../../services/pacientesService';
import {
    createSeguimiento, getSeguimientosPaciente,
    saveApoyoEnCasa, getApoyoEnCasa, CUIDADOS_PRESET
} from '../../services/seguimientoService';

export default function ExpedienteClinico() {
    const { pacienteId } = useParams();
    const navigate = useNavigate();

    const [paciente, setPaciente] = useState({
        id: pacienteId || '',
        nombre: '', // Empty initially to show skeleton
        ultimaCita: '',
        requiereActualizacion: false,
        telefono: '',
    });
    const [loadingPaciente, setLoadingPaciente] = useState(true);
    const [historialSeguimiento, setHistorialSeguimiento] = useState([]);
    const [saving, setSaving] = useState(false);
    const [guardadoExito, setGuardadoExito] = useState(false);

    // Mock Adherence Data
    const mockAdherenciaDiaria = [
        { d: 'Lun', cals: 1450, lim: 1500, check: 6 },
        { d: 'Mar', cals: 1600, lim: 1500, check: 5 },
        { d: 'Mié', cals: 1480, lim: 1500, check: 6 },
        { d: 'Jue', cals: 1900, lim: 1500, check: 3 },
        { d: 'Vie', cals: 1850, lim: 1500, check: 4 },
        { d: 'Sáb', cals: 2100, lim: 1500, check: 2 },
        { d: 'Dom', cals: 1500, lim: 1500, check: 6 },
    ];

    // Apoyo en casa — cuidados personalizados por paciente
    const [apoyoCuidados, setApoyoCuidados] = useState([]);
    const [apoyoLoading, setApoyoLoading] = useState(true);
    const [apoyoSaving, setApoyoSaving] = useState(false);
    const [apoyoExito, setApoyoExito] = useState(false);
    const [nuevoCuidado, setNuevoCuidado] = useState('');

    useEffect(() => {
        if (!pacienteId) return;

        getPacienteById(pacienteId).then(p => {
            if (p) {
                setPaciente({
                    id: p.id,
                    nombre: p.nombre || 'Sin nombre',
                    ultimaCita: p.ultimaCita || '—',
                    requiereActualizacion: false,
                    telefono: p.telefono || p.phone || '',
                });
            }
            setLoadingPaciente(false);
        }).catch(err => {
            console.error(err);
            setLoadingPaciente(false);
        });

        getSeguimientosPaciente(pacienteId).then(setHistorialSeguimiento).catch(console.error);

        // Cargar apoyo en casa del paciente
        getApoyoEnCasa(pacienteId).then(cuidados => {
            if (cuidados && cuidados.length > 0) {
                setApoyoCuidados(cuidados);
            } else {
                // Primera vez: preset completo, todos desactivados
                const todos = [
                    ...CUIDADOS_PRESET.Facial.map(c => ({ ...c, categoria: 'Facial', activo: false })),
                    ...CUIDADOS_PRESET.Corporal.map(c => ({ ...c, categoria: 'Corporal', activo: false })),
                    ...CUIDADOS_PRESET.General.map(c => ({ ...c, categoria: 'General', activo: false })),
                ];
                setApoyoCuidados(todos);
            }
            setApoyoLoading(false);
        }).catch(() => setApoyoLoading(false));
    }, [pacienteId]);

    const [activeTab, setActiveTab] = useState('evolucion');
    const [treatmentType, setTreatmentType] = useState('Corporal');

    const [medidas, setMedidas] = useState({
        peso: '', altura: '', cintura: '', abdomen: '', cadera: '', muslos: '',
        observaciones: '', protocolo: '', biotipoCutaneo: 'Piel Mixta',
    });
    const setMedida = (key, val) => setMedidas(prev => ({ ...prev, [key]: val }));

    const [consents, setConsents] = useState([
        { id: 1, name: 'Aplicación de Toxina Botulínica (Botox)', type: 'Facial', signed: true, signatureInfo: 'ALFRA-SIG-X9K2M-1402', date: '12-Oct-2026 10:30 AM' },
        { id: 2, name: 'Armonización Facial con Ácido Hialurónico', type: 'Facial', signed: false, signatureInfo: null, date: null },
        { id: 4, name: 'Lipoescultura Mela / Enzimas Recombinantes', type: 'Corporal', signed: false, signatureInfo: null, date: null },
    ]);

    const toggleCuidado = (id) => {
        setApoyoCuidados(prev => prev.map(c => c.id === id ? { ...c, activo: !c.activo } : c));
    };

    const addCuidadoPersonalizado = () => {
        if (!nuevoCuidado.trim()) return;
        const nuevo = {
            id: Date.now().toString(),
            texto: nuevoCuidado,
            categoria: 'Personalizado',
            activo: true
        };
        setApoyoCuidados(prev => [...prev, nuevo]);
        setNuevoCuidado('');
    };

    const handleSaveApoyo = async () => {
        setApoyoSaving(true);
        try {
            await saveApoyoEnCasa(pacienteId, apoyoCuidados);
            setApoyoExito(true);
            setTimeout(() => setApoyoExito(false), 3000);
        } catch (err) {
            console.error(err);
        } finally {
            setApoyoSaving(false);
        }
    };

    const [fotos, setFotos] = useState([
        { id: 1, url: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&q=80&w=400', label: 'Sesión anterior', date: '10 Sep 2026' }
    ]);

    const [signingConsent, setSigningConsent] = useState(null);
    const fileInputRef = useRef(null);

    const handleSignConsent = () => {
        if (!signingConsent) return;
        const signature = `ALFRA-SIG-${Math.random().toString(36).substr(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const now = new Date().toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        setConsents(consents.map(c =>
            c.id === signingConsent.id ? { ...c, signed: true, signatureInfo: signature, date: now } : c
        ));
        setSigningConsent(null);
    };

    const handleGuardarEvolucion = async () => {
        if (!pacienteId) { alert('No se pudo identificar al paciente.'); return; }
        setSaving(true);
        try {
            await createSeguimiento(pacienteId, {
                peso: parseFloat(medidas.peso) || 0,
                estatura: parseFloat(medidas.altura) || 0,
                cintura: parseFloat(medidas.cintura) || 0,
                abdomen: parseFloat(medidas.abdomen) || 0,
                cadera: parseFloat(medidas.cadera) || 0,
                muslos: parseFloat(medidas.muslos) || 0,
                tipoCita: treatmentType,
                protocolo: medidas.protocolo || '',
                biotipoCutaneo: medidas.biotipoCutaneo || '',
                observaciones: medidas.observaciones || '',
            });
            const nuevas = await getSeguimientosPaciente(pacienteId);
            setHistorialSeguimiento(nuevas);
            setGuardadoExito(true);
            setTimeout(() => { setGuardadoExito(false); navigate(-1); }, 1500);
        } catch (err) {
            console.error(err);
            alert('Error al guardar la evolución. Verifica tu conexión.');
        } finally {
            setSaving(false);
        }
    };

    const handleSubirFotosBtnClick = () => { if (fileInputRef.current) fileInputRef.current.click(); };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const now = new Date().toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
                setFotos(prev => [...prev, { id: Date.now(), url: reader.result, label: 'Nueva Evidencia (Hoy)', date: now, isNew: true }]);
            };
            reader.readAsDataURL(file);
        }
    };

    const imc = (medidas.peso && medidas.altura)
        ? (medidas.peso / ((medidas.altura / 100) * (medidas.altura / 100))).toFixed(1)
        : '0.0';

    const catColors = { Facial: 'purple', Corporal: 'cyan', General: 'green', Personalizado: 'rose' };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20">
            {/* Back header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} icon={ArrowLeft} className="px-2 border border-gray-200 bg-white shadow-sm">Volver a Agenda</Button>
                <div>
                    <h2 className="text-2xl font-bold text-acero">Expediente Clínico</h2>
                    <p className="text-gray-500 text-sm">Registro de consulta, consentimientos y evidencia</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Patient header */}
                <div className="relative group overflow-hidden">
                    {/* Deeper "Executive Deep" Palette - Ultra Dark Slate Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617] group-hover:scale-105 transition-transform duration-1000 pointer-events-none" />
                    <div className="absolute top-0 right-0 w-80 h-80 bg-turquesa/5 rounded-full -mr-32 -mt-32 blur-[100px] pointer-events-none animate-pulse" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-acero/10 rounded-full -ml-32 -mb-32 blur-[80px] pointer-events-none" />

                    <div className="relative z-10 p-8 md:p-10 text-white flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex flex-col md:flex-row items-center gap-8 w-full md:w-auto">
                            <div className={`w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-4xl font-black shadow-[0_20px_50px_rgba(0,0,0,0.3)] ring-1 ring-white/20 ${loadingPaciente ? 'animate-pulse' : ''}`}>
                                {loadingPaciente ? (
                                    <User size={40} className="text-white/20" />
                                ) : (
                                    paciente.nombre.charAt(0)
                                )}
                            </div>
                            <div className="text-center md:text-left flex-1">
                                {loadingPaciente ? (
                                    <div className="space-y-4">
                                        <div className="h-10 w-64 bg-white/10 rounded-2xl animate-pulse backdrop-blur-md" />
                                        <div className="flex justify-center md:justify-start gap-3">
                                            <div className="h-7 w-24 bg-white/5 rounded-full animate-pulse" />
                                            <div className="h-7 w-32 bg-white/5 rounded-full animate-pulse" />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-4xl font-black tracking-tight drop-shadow-2xl animate-in fade-in slide-in-from-left-4 duration-500">{paciente.nombre}</h2>
                                        <div className="flex flex-wrap justify-center md:justify-start gap-3 text-sm text-white/60 mt-4 font-bold uppercase tracking-widest">
                                            <span className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-2xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
                                                <User size={14} className="text-turquesa" /> ID: {paciente.id.toUpperCase().slice(0, 8)}
                                            </span>
                                            <span className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-2xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
                                                <Calendar size={14} className="text-turquesa" /> {paciente.ultimaCita}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {!loadingPaciente && (
                            <div className="flex gap-3 animate-in fade-in zoom-in duration-500">
                                <Button
                                    variant="outline"
                                    className="bg-white/5 border-white/10 text-white hover:bg-white hover:text-[#0f172a] font-black rounded-2xl h-14 px-8 shadow-xl backdrop-blur-md transition-all hover:scale-105 active:scale-95"
                                    onClick={() => window.open(`https://wa.me/${paciente.telefono}`, '_blank')}
                                >
                                    WhatsApp Directo
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs — scroll horizontal garantizado en móvil para evitar que se amontonen */}
                <div className="flex flex-row flex-nowrap bg-white px-2 border-b border-gray-200 overflow-x-auto no-scrollbar scrollbar-hide shrink-0 gap-1 sticky top-0 z-20 shadow-sm">
                    {[
                        { key: 'historial', icon: <FileText size={16} />, label: 'Historial Clínico Base', activeClass: 'text-acero bg-acero/5 border-acero' },
                        { key: 'evolucion', icon: <Activity size={16} />, label: 'Alta de Evolución (Notas)', activeClass: 'text-turquesa bg-turquesa/5 border-turquesa' },
                        { key: 'adherencia', icon: <Home size={16} />, label: 'Adherencia & Apoyo en Casa', activeClass: 'text-orange-600 bg-orange-50 border-orange-500' },
                        { key: 'fotos', icon: <Camera size={16} />, label: 'Galería Fotográfica', activeClass: 'text-purple-600 bg-purple-50 border-purple-500' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex flex-row items-center gap-2 px-6 py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all border-b-4 whitespace-nowrap shrink-0 flex-none ${activeTab === tab.key ? tab.activeClass : 'text-gray-300 border-transparent hover:text-gray-500 hover:bg-gray-50'}`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="p-4 md:p-8 bg-gray-50 min-h-[500px]">

                    {/* ── HISTORIAL TAB ── */}
                    {activeTab === 'historial' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <Card variant="glass" title="Antecedentes Médicos" icon={Activity}>
                                    <div className="mt-2 relative">
                                        <textarea
                                            className="w-full h-40 p-4 text-sm border-none bg-gray-50/50 rounded-2xl outline-none focus:ring-2 focus:ring-acero/20 transition-all font-medium leading-relaxed"
                                            defaultValue="- Alergia a la Penicilina&#10;- Tratamiento previo con Isotretinoína (hace 2 años)&#10;- Sin contraindicaciones recientes"
                                        />
                                        <div className="absolute bottom-3 right-3">
                                            <div className="w-2 h-2 rounded-full bg-turquesa animate-pulse" />
                                        </div>
                                    </div>
                                </Card>

                                <Card variant="premium" title="Consentimientos Digitales" icon={FileText}>
                                    <div className="space-y-4 mt-2">
                                        {consents.filter(c => c.signed).length === 0 ? (
                                            <div className="py-8 text-center flex flex-col items-center gap-2">
                                                <AlertCircle size={32} className="text-gray-300" />
                                                <p className="text-sm text-gray-400 italic">No hay documentos firmados.</p>
                                            </div>
                                        ) : (
                                            consents.filter(c => c.signed).map(consent => (
                                                <div key={consent.id} className="p-6 bg-white shadow-xl shadow-gray-200/50 rounded-[2rem] border border-gray-100 hover:scale-[1.02] transition-all group relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-bl-[4rem] -mr-8 -mt-8 pointer-events-none" />
                                                    <div className="flex items-center justify-between mb-4">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-green-700 bg-green-50 px-3 py-1.5 rounded-full flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                                            Documento Firmado
                                                        </span>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{consent.date}</span>
                                                    </div>
                                                    <div className="mb-4">
                                                        <h4 className="text-sm font-black text-acero leading-tight">{consent.name}</h4>
                                                    </div>
                                                    <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 bg-gray-50 rounded-lg">
                                                                <FileText size={12} className="text-gray-400" />
                                                            </div>
                                                            <p className="text-[9px] text-gray-500 font-mono tracking-wider">{consent.signatureInfo}</p>
                                                        </div>
                                                        <div className="px-2 py-1 bg-green-500 text-white rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg shadow-green-500/20">Validado</div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </Card>
                            </div>
                            <div className="mt-8 flex justify-end animate-in fade-in">
                                <Button variant="primary" icon={Save} onClick={handleGuardarEvolucion} className="sm:w-64 text-lg shadow-md">Guardar y Cerrar Expediente</Button>
                            </div>
                        </div>
                    )}

                    {/* ── EVOLUCIÓN TAB ── */}
                    {activeTab === 'evolucion' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-6 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm glass-card">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-turquesa/10 flex items-center justify-center text-turquesa">
                                        <Plus size={24} />
                                    </div>
                                    <label className="text-base font-black text-acero">Tratamiento de Hoy:</label>
                                </div>
                                <select
                                    className="px-6 py-3 border-2 border-turquesa/20 rounded-2xl outline-none focus:border-turquesa focus:ring-4 focus:ring-turquesa/10 font-black text-acero bg-gray-50/50 flex-1 cursor-pointer transition-all hover:bg-white"
                                    value={treatmentType}
                                    onChange={e => setTreatmentType(e.target.value)}
                                >
                                    <option value="Facial">✨ Tratamiento Facial</option>
                                    <option value="Corporal">💪 Tratamiento Corporal / Medidas</option>
                                </select>
                            </div>

                            <Card variant="premium" className="bg-white">
                                {treatmentType === 'Facial' && (
                                    <div className="space-y-8 animate-in fade-in duration-500">
                                        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                                            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-sm">
                                                <User size={24} />
                                            </div>
                                            <h3 className="font-black text-2xl text-acero">Evaluación Facial</h3>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Biotipo Cutáneo</label>
                                                <select
                                                    className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm bg-gray-50/50 outline-none focus:bg-white focus:border-turquesa/50 focus:ring-4 focus:ring-turquesa/5 transition-all font-bold text-acero shadow-sm hover:border-gray-200"
                                                    value={medidas.biotipoCutaneo}
                                                    onChange={e => setMedida('biotipoCutaneo', e.target.value)}
                                                >
                                                    <option>Piel Mixta</option>
                                                    <option>Piel Grasa</option>
                                                    <option>Piel Seca</option>
                                                    <option>Piel Sensible / Rosácea</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Protocolo / Servicios</label>
                                                <input
                                                    type="text"
                                                    className="w-full p-4 border-2 border-gray-100 rounded-2xl text-sm bg-gray-50/50 outline-none focus:bg-white focus:border-turquesa/50 focus:ring-4 focus:ring-turquesa/5 transition-all font-bold text-acero shadow-sm hover:border-gray-200"
                                                    placeholder="Ej. Dermapen + Cóctel Vitaminas"
                                                    value={medidas.protocolo}
                                                    onChange={e => setMedida('protocolo', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Observaciones y Reacciones</label>
                                            <textarea
                                                className="w-full p-5 border-2 border-gray-100 rounded-2xl text-sm bg-gray-50/50 outline-none h-40 focus:bg-white focus:border-turquesa/50 focus:ring-4 focus:ring-turquesa/5 transition-all font-medium leading-relaxed shadow-sm hover:border-gray-200"
                                                placeholder="Describa a detalle el procedimiento y reacciones observadas..."
                                                value={medidas.observaciones}
                                                onChange={e => setMedida('observaciones', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {treatmentType === 'Corporal' && (
                                    <div className="space-y-8 animate-in fade-in duration-500">
                                        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                                            <div className="w-12 h-12 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-600 shadow-sm">
                                                <Ruler size={24} />
                                            </div>
                                            <h3 className="font-black text-2xl text-acero">Control de Medidas</h3>
                                        </div>

                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 bg-gradient-to-br from-acero/5 to-turquesa/5 p-8 rounded-3xl border border-acero/10 shadow-inner">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center block">Peso (kg)</label>
                                                <input type="number" className="w-full p-4 border-none rounded-2xl text-2xl font-black text-center bg-white shadow-xl ring-2 ring-acero/5 focus:ring-turquesa/20 outline-none transition-all" value={medidas.peso} onChange={e => setMedida('peso', e.target.value)} placeholder="00.0" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center block">Estatura (cm)</label>
                                                <input type="number" className="w-full p-4 border-none rounded-2xl text-2xl font-black text-center bg-white shadow-xl ring-2 ring-acero/5 focus:ring-turquesa/20 outline-none transition-all" value={medidas.altura} onChange={e => setMedida('altura', e.target.value)} placeholder="165" />
                                            </div>
                                            <div className="col-span-2 lg:col-span-1 flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-turquesa/30 p-4 shadow-xl ring-4 ring-white">
                                                <label className="text-[10px] font-black text-turquesa uppercase tracking-widest">I.M.C</label>
                                                <span className={`text-4xl font-black mt-1 ${imc > 25 ? 'text-red-500' : 'text-green-500'}`}>{imc}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                            {[
                                                { label: 'Cintura', key: 'cintura' },
                                                { label: 'Abdomen', key: 'abdomen' },
                                                { label: 'Cadera', key: 'cadera' },
                                                { label: 'Muslos', key: 'muslos' },
                                            ].map((m) => (
                                                <div key={m.key} className="space-y-2 group">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 group-hover:text-acero transition-colors">{m.label} (cm)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full p-4 border-2 border-gray-100 rounded-2xl text-lg font-bold text-center bg-gray-50/50 outline-none focus:bg-white focus:border-cyan-500/30 focus:ring-4 focus:ring-cyan-500/5 transition-all shadow-sm"
                                                        value={medidas[m.key]}
                                                        onChange={e => setMedida(m.key, e.target.value)}
                                                        placeholder="0.0"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Observaciones de Sesión</label>
                                            <textarea className="w-full p-5 border-2 border-gray-100 rounded-2xl text-sm bg-gray-50/50 outline-none h-32 focus:bg-white focus:border-cyan-500/30 focus:ring-4 focus:ring-cyan-500/5 transition-all font-medium leading-relaxed shadow-sm" placeholder="Procedimientos aplicados y recomendaciones..." value={medidas.observaciones} onChange={e => setMedida('observaciones', e.target.value)} />
                                        </div>
                                    </div>
                                )}

                                {/* Consentimientos */}
                                <div className="mt-12 border-t border-gray-100 pt-10">
                                    <div className="flex items-center gap-2 mb-6">
                                        <div className="p-2 bg-orange-50 rounded-lg">
                                            <FileText size={20} className="text-orange-500" />
                                        </div>
                                        <h3 className="font-black text-xl text-acero">Firmas Requeridas</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {consents.filter(c => c.type === treatmentType).map(consent => (
                                            <div key={consent.id} className={`p-6 rounded-3xl border-2 transition-all duration-300 flex flex-col justify-between gap-6 ${consent.signed ? 'bg-green-50/50 border-green-100 shadow-inner' : 'bg-white border-orange-100 shadow-lg shadow-orange-500/5 hover:shadow-xl hover:shadow-orange-500/10'}`}>
                                                <div className="flex items-start justify-between">
                                                    <div className="space-y-1">
                                                        <span className={`text-base font-black leading-tight ${consent.signed ? 'text-green-800' : 'text-acero'}`}>{consent.name}</span>
                                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">Vigencia: 24 meses</p>
                                                    </div>
                                                    {consent.signed ? (
                                                        <div className="bg-green-100 text-green-700 p-1.5 rounded-full shadow-sm">
                                                            <CheckCircle size={14} />
                                                        </div>
                                                    ) : (
                                                        <div className="bg-orange-100 text-orange-600 p-1.5 rounded-full animate-pulse shadow-sm">
                                                            <AlertCircle size={14} />
                                                        </div>
                                                    )}
                                                </div>
                                                {!consent.signed && (
                                                    <Button onClick={() => setSigningConsent(consent)} variant="primary" className="w-full bg-gradient-to-r from-orange-500 to-orange-600 border-none hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20 py-6 text-base font-black" size="lg">
                                                        Recabar Firma Ahora
                                                    </Button>
                                                )}
                                                {consent.signed && (
                                                    <div className="flex items-center gap-2 text-[10px] font-mono text-green-600/70 bg-white/50 p-2 rounded-lg">
                                                        <Lock size={10} /> {consent.signatureInfo}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {consents.filter(c => c.type === treatmentType).length === 0 && (
                                            <div className="col-span-full py-12 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                                                <p className="text-sm text-gray-400 font-medium italic">No se requieren consentimientos adicionales.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-12 flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t border-gray-100">
                                    <Button variant="ghost" className="px-10 text-gray-400 font-bold hover:text-red-500" onClick={() => setMedidas({ peso: '', altura: '', cintura: '', abdomen: '', cadera: '', muslos: '', observaciones: '', protocolo: '', biotipoCutaneo: 'Piel Mixta' })}>Limpiar Formulario</Button>
                                    <Button
                                        variant="primary"
                                        icon={guardadoExito ? CheckCircle : saving ? Loader : Save}
                                        onClick={handleGuardarEvolucion}
                                        disabled={saving || guardadoExito}
                                        className={`sm:w-80 text-lg font-black shadow-xl shadow-acero/20 py-8 transition-all relative overflow-hidden ${guardadoExito ? 'bg-green-500 border-green-500 shadow-green-500/20' : 'bg-acero border-acero hover:scale-[1.02]'}`}
                                    >
                                        {guardadoExito ? '¡Expediente Guardado!' : saving ? 'Guardando...' : 'Finalizar y Guardar'}
                                        {saving && <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />}
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* ── IMPACTO & HÁBITOS TAB (ANÁLISIS + CONFIG) ── */}
                    {activeTab === 'adherencia' && (() => {
                        const totalDias = mockAdherenciaDiaria.length;
                        const diasExcedidos = mockAdherenciaDiaria.filter(d => d.cals > d.lim).length;
                        const promedioCheck = mockAdherenciaDiaria.reduce((s, d) => s + d.check, 0) / totalDias;
                        const maxCheck = 6;
                        const pctExcedido = Math.round((diasExcedidos / totalDias) * 100);
                        const peorDia = [...mockAdherenciaDiaria].sort((a, b) => (b.cals - b.lim) - (a.cals - a.lim))[0];
                        const peorCheck = [...mockAdherenciaDiaria].sort((a, b) => a.check - b.check)[0];

                        let nivel;
                        if (diasExcedidos === 0 && promedioCheck >= 5) nivel = 'excelente';
                        else if (diasExcedidos <= 2 && promedioCheck >= 4) nivel = 'moderado';
                        else nivel = 'critico';

                        const alertaTexto = (() => {
                            if (nivel === 'excelente') return `Excelente control calórico. El progreso va en línea con los objetivos.`;
                            if (nivel === 'moderado') return `Exceso calórico en ${diasExcedidos} de ${totalDias} días (${pctExcedido}%). El ${peorDia.d} fue el día con mayor desviación.`;
                            return `Alerta: exceso calórico recurrente (${pctExcedido}%). El día ${peorCheck.d} fue el de menor adherencia.`;
                        })();

                        const pronosticoTexto = (() => {
                            if (nivel === 'excelente') return `Resultados en trayectoria óptima.`;
                            if (nivel === 'moderado') return `Retraso estimado del 10%-15% en resultados.`;
                            return `Adherencia deficiente: compromete resultados entre 20%-35%. Abordar obstáculos del ${peorDia.d}.`;
                        })();

                        const panelColor = nivel === 'excelente'
                            ? { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', accent: 'bg-green-500/10', icon: '✅' }
                            : nivel === 'moderado'
                                ? { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', accent: 'bg-yellow-500/10', icon: '⚠️' }
                                : { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', accent: 'bg-orange-500/10', icon: '🚨' };

                        return (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                {/* SECCIÓN 1: ANÁLISIS DE IMPACTO */}
                                <Card variant="glass" className="border-gray-200">
                                    <h3 className="text-xl font-bold flex items-center gap-2 text-acero mb-6 pb-3 border-b"><HeartPulse className="text-orange-500" /> Control Semanal y Pronóstico</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white/60 p-4 rounded-3xl border border-gray-100 shadow-sm">
                                            <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-4 text-sm"><Activity size={16} className="text-turquesa" /> Cumplimiento Diario</h4>
                                            <div className="space-y-3">
                                                {mockAdherenciaDiaria.map((d, i) => {
                                                    const excedido = d.cals > d.lim;
                                                    return (
                                                        <div key={i} className="flex justify-between items-center bg-gray-50/50 p-2 rounded-xl">
                                                            <span className="font-bold text-gray-400 w-10 text-[10px] uppercase">{d.d}</span>
                                                            <div className="flex-1 px-4">
                                                                <div className="w-full bg-white rounded-full h-1.5 shadow-inner">
                                                                    <div className={`h-1.5 rounded-full transition-all ${excedido ? 'bg-orange-400' : 'bg-turquesa'}`} style={{ width: `${Math.min((d.cals / d.lim) * 100, 100)}%` }} />
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className={`text-[10px] font-black ${excedido ? 'text-orange-600' : 'text-acero'}`}>{d.cals}</span>
                                                                <span className="text-[10px] text-gray-300">/{d.lim}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-4">
                                            <div className={`${panelColor.bg} border ${panelColor.border} p-6 rounded-[2rem] shadow-sm relative overflow-hidden`}>
                                                <div className={`absolute top-0 right-0 w-16 h-16 ${panelColor.accent} rounded-bl-full pointer-events-none`} />
                                                <h4 className={`text-xs font-black uppercase tracking-widest ${panelColor.text} mb-3 flex items-center gap-2`}>
                                                    <AlertCircle size={14} /> Impacto Real
                                                </h4>
                                                <p className={`text-xs ${panelColor.text} leading-relaxed mb-3 font-medium`}>
                                                    <strong>{panelColor.icon} Eficacia:</strong> {alertaTexto}
                                                </p>
                                                <p className={`text-xs ${panelColor.text} leading-relaxed font-bold`}>
                                                    <strong>Pronóstico:</strong> {pronosticoTexto}
                                                </p>
                                            </div>
                                            <div className="bg-acero/5 border border-acero/10 p-6 rounded-[2rem] shadow-inner text-sm">
                                                <h4 className="text-xs font-black text-acero uppercase tracking-widest mb-4 flex items-center gap-2"><CheckCircle size={14} /> Checklist Promedio</h4>
                                                <div className="flex items-end gap-3">
                                                    <span className={`text-4xl font-black ${promedioCheck >= 5 ? 'text-turquesa' : 'text-orange-500'}`}>
                                                        {promedioCheck.toFixed(1)}<span className="text-xs text-gray-400 font-bold ml-1">/{maxCheck}</span>
                                                    </span>
                                                </div>
                                                <div className="mt-4 w-full bg-white rounded-full h-1.5 shadow-inner overflow-hidden">
                                                    <div className={`h-1.5 transition-all ${promedioCheck >= 5 ? 'bg-turquesa' : 'bg-orange-400'}`} style={{ width: `${(promedioCheck / maxCheck) * 100}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                {/* SECCIÓN 2: CONFIGURACIÓN DE APOYO EN CASA */}
                                <Card variant="glass" className="border-t-4 border-orange-400">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 pb-6 border-b border-orange-100">
                                        <div>
                                            <h3 className="text-2xl font-black flex items-center gap-3 text-orange-700">
                                                <div className="p-2 bg-orange-500 text-white rounded-xl shadow-lg shadow-orange-500/20">
                                                    <Home size={24} />
                                                </div>
                                                Plan de Apoyo en Casa
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-2 font-medium">Recomendaciones personalizadas para <strong>{paciente.nombre}</strong>.</p>
                                        </div>
                                        <Button
                                            variant="primary"
                                            icon={apoyoExito ? CheckCircle : apoyoSaving ? Loader : Save}
                                            disabled={apoyoSaving || apoyoExito}
                                            onClick={handleSaveApoyo}
                                            className={`shrink-0 px-8 py-6 text-base font-black shadow-lg transition-all ${apoyoExito ? 'bg-green-500 border-none' : 'bg-orange-500 border-none hover:bg-orange-600 shadow-orange-500/20'}`}
                                        >
                                            {apoyoExito ? 'Plan Guardado' : apoyoSaving ? 'Guardando...' : 'Guardar Plan'}
                                        </Button>
                                    </div>

                                    {apoyoLoading ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-orange-400 gap-4">
                                            <Loader className="animate-spin" size={48} />
                                            <p className="font-black text-lg animate-pulse">Cargando catálogo...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-10">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                                {['Facial', 'Corporal', 'General', 'Personalizado'].map(cat => {
                                                    const items = apoyoCuidados.filter(c => c.categoria === cat);
                                                    if (items.length === 0) return null;
                                                    const col = catColors[cat] || 'gray';
                                                    return (
                                                        <div key={cat} className="space-y-4">
                                                            <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] text-${col}-600 mb-5 flex items-center gap-3`}>
                                                                <div className={`w-2 h-2 rounded-full bg-${col}-500 shadow-lg shadow-${col}-500/50`} />
                                                                Categoría {cat}
                                                            </h4>
                                                            <div className="space-y-3">
                                                                {items.map(cuidado => (
                                                                    <div
                                                                        key={cuidado.id}
                                                                        onClick={() => toggleCuidado(cuidado.id)}
                                                                        className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all select-none group ${cuidado.activo ? 'bg-green-50 border-green-200 shadow-inner' : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-md'}`}
                                                                    >
                                                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border-2 transition-all duration-300 ${cuidado.activo ? 'bg-green-500 border-green-500 shadow-lg shadow-green-500/30' : 'border-gray-200 bg-gray-50'}`}>
                                                                            {cuidado.activo && <CheckCircle size={14} className="text-white" />}
                                                                        </div>
                                                                        <div className="flex-1 space-y-1">
                                                                            <span className={`text-sm leading-snug transition-colors ${cuidado.activo ? 'text-green-800 font-bold' : 'text-gray-600 font-medium'}`}>
                                                                                {cuidado.texto}
                                                                            </span>
                                                                        </div>
                                                                        {cuidado.categoria === 'Personalizado' && (
                                                                            <button onClick={e => { e.stopPropagation(); setApoyoCuidados(prev => prev.filter(c => c.id !== cuidado.id)); }} className="ml-auto text-gray-300 hover:text-red-500 p-1 transition-colors">
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="bg-white/50 p-8 rounded-[2rem] border-2 border-dashed border-gray-100 group hover:border-orange-200 transition-all">
                                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 group-hover:text-orange-500 transition-colors">Nuevo cuidado ad-hoc</h4>
                                                <div className="flex gap-3">
                                                    <input
                                                        type="text"
                                                        value={nuevoCuidado}
                                                        onChange={e => setNuevoCuidado(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') addCuidadoPersonalizado(); }}
                                                        placeholder="Ej: 'Aplicar suero de noche...'"
                                                        className="flex-1 px-6 py-4 border-2 border-gray-100 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-orange-500/5 focus:border-orange-500/20 bg-white font-medium"
                                                    />
                                                    <button onClick={addCuidadoPersonalizado} className="w-14 h-14 bg-orange-500 text-white rounded-2xl hover:bg-orange-600 active:scale-95 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center">
                                                        <Plus size={24} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        );
                    })()}

                    {/* ── GALERÍA TAB ── */}
                    {activeTab === 'fotos' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-acero/5 mb-8 animate-in slide-in-from-top-2">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-inner">
                                        <Camera size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-xl text-acero">Evidencia Clínica</h3>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Respaldo fotográfico del paciente</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                                    <Button variant="primary" icon={Plus} className="w-full sm:w-auto bg-purple-600 border-none hover:bg-purple-700 shadow-lg shadow-purple-600/20 py-4 px-8 rounded-2xl font-black" onClick={handleSubirFotosBtnClick}>Añadir Foto</Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                {fotos.map(foto => (
                                    <div key={foto.id} className={`group bg-white p-3 rounded-[2rem] border-2 transition-all duration-500 hover:scale-[1.05] hover:shadow-2xl ${foto.isNew ? 'border-turquesa shadow-xl shadow-turquesa/10 ring-4 ring-turquesa/5' : 'border-gray-50 shadow-md hover:border-acero/20'}`}>
                                        <div className="aspect-[4/5] bg-gray-50 rounded-[1.5rem] overflow-hidden relative shadow-inner">
                                            <img src={foto.url} alt={foto.label} className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${!foto.isNew ? 'opacity-90 filter brightness-95' : ''}`} />
                                            {foto.isNew && (
                                                <div className="absolute top-3 left-3 bg-turquesa text-white text-[8px] font-black uppercase px-2 py-1 rounded-full shadow-lg animate-bounce">
                                                    Nueva
                                                </div>
                                            )}
                                            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                                                <Button size="sm" variant="ghost" className="text-white bg-white/20 backdrop-blur-md rounded-full w-10 h-10 p-0 hover:bg-white hover:text-acero">
                                                    <Search size={16} />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="pt-4 px-2">
                                            <p className={`font-black text-xs truncate ${foto.isNew ? 'text-turquesa' : 'text-acero'}`}>{foto.label}</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <Calendar size={10} className="text-gray-300" />
                                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">{foto.date}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div
                                    className="bg-gray-50/50 border-4 border-dashed border-gray-100 rounded-[2rem] flex flex-col items-center justify-center text-gray-300 hover:text-purple-400 hover:border-purple-200 hover:bg-purple-50 transition-all cursor-pointer min-h-[240px] group"
                                    onClick={handleSubirFotosBtnClick}
                                >
                                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                        <Camera size={32} className="opacity-30 group-hover:opacity-100" />
                                    </div>
                                    <span className="font-black text-[10px] uppercase tracking-widest text-center px-6 leading-relaxed">Tomar fotografía <br /> o subir archivo</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {signingConsent && (
                <div className="fixed inset-0 z-[100] flex justify-center items-center bg-gray-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-500 border border-white">
                        <div className="bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617] p-10 text-white text-center rounded-t-[2.5rem] relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                            <div className="bg-white/10 w-20 h-20 rounded-2xl backdrop-blur-md border border-white/20 flex items-center justify-center mx-auto mb-6 shadow-2xl">
                                <FileText size={40} className="text-turquesa" />
                            </div>
                            <h3 className="font-black text-3xl tracking-tight relative z-10">Firma del Procedimiento</h3>
                            <p className="text-turquesa font-black mt-3 bg-white/10 inline-block px-5 py-2 rounded-2xl border border-white/10 relative z-10 text-sm">{signingConsent.name}</p>
                        </div>
                        <div className="p-10 space-y-8 bg-white">
                            <div className="bg-gray-50/50 p-8 rounded-[2rem] border border-gray-100 text-xs text-gray-600 h-64 overflow-y-auto shadow-inner leading-loose text-justify font-medium scrollbar-hide">
                                <p className="font-black mb-4 text-center text-acero text-base uppercase tracking-widest">Autorización Médica Digital</p>
                                <p className="mb-4">Yo, <b>{paciente.nombre}</b>, autorizo de manera libre y consciente el procedimiento: <span className="text-acero font-bold">{signingConsent.name}</span>.</p>
                                <p className="mb-4">Se me ha informado detalladamente sobre los beneficios esperados, los posibles riesgos colaterales, el tiempo estimado de recuperación y los cuidados post-operatorios necesarios.</p>
                                <p className="mb-4 font-bold text-acero">Entiendo que los resultados pueden variar según mi respuesta biológica y el cumplimiento estricto de las indicaciones médicas.</p>
                                <div className="bg-orange-50 p-6 rounded-2xl mt-6 border-2 border-dashed border-orange-200">
                                    <p className="font-black text-orange-700 text-center text-[11px] leading-relaxed">AL SELECCIONAR "ACEPTAR Y FIRMAR", CONFIRMO MI VOLUNTAD Y AUTORIZO LA GENERACIÓN DE UNA CADENA DIGITAL (HASH) CON COMPLETA VALIDEZ LEGAL SEGÚN LOS TÉRMINOS CONTRATADOS CON CLÍNICA ALFRA.</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-4">
                                <Button
                                    variant="primary"
                                    fullWidth
                                    size="lg"
                                    onClick={handleSignConsent}
                                    className="h-20 text-xl bg-gradient-to-r from-acero to-acero/90 border-none hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-acero/30 font-black rounded-3xl"
                                >
                                    Aceptar y Firmar Digitalmente
                                </Button>
                                <button
                                    onClick={() => setSigningConsent(null)}
                                    className="w-full py-4 text-gray-400 font-bold hover:text-red-500 transition-colors"
                                >
                                    Regresar sin Firmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
