import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Target, Activity, Image as ImageIcon, User, Lock, Gift, Camera, Bell, Search, PlusCircle, FileText, Send, Receipt, Home, CheckCircle, CheckSquare } from 'lucide-react';
import { alimentosMexicanos, categoriasAlimentos } from '../../data/alimentosMexicanos';
import ReciboDigital from '../../components/ui/ReciboDigital';
import HistorialMedidasModal from '../../components/ui/HistorialMedidasModal';
import { getPacienteByUid, updatePaciente } from '../../services/pacientesService';
import { getSeguimientosPaciente } from '../../services/seguimientoService';
import { getApoyoEnCasa } from '../../services/seguimientoService';
import { getRecibosPaciente } from '../../services/recibosService';
import { auth } from '../../lib/firebase';

// Estados iniciales — se sobreescribirán con datos reales de Firestore
const emptyProgreso = [];


export default function PacienteProfile() {
    const [activeTab, setActiveTab] = useState('progreso');
    const [ahorroMeta] = useState(60000);
    const [ahorroActual] = useState(25000);
    const progresoPorcentaje = Math.min(Math.round((ahorroActual / ahorroMeta) * 100), 100);

    // Datos reales del paciente desde Firestore
    const [pacienteDocId, setPacienteDocId] = useState(null);
    const [perfilPaciente, setPerfilPaciente] = useState({
        nombre: '...cargando...',
        telefono: '',
        fechaNacimiento: '',
        fotoUrl: null,
        tipoTratamiento: 'Mixto',
    });
    const [progresoData, setProgresoData] = useState(emptyProgreso);
    const [recibos, setRecibos] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // Apoyo en Casa — plan asignado por el especialista
    const [apoyoCuidados, setApoyoCuidados] = useState([]);
    const [apoyoLoading, setApoyoLoading] = useState(true);

    // Suscripción a Firestore al cargar el componente
    useEffect(() => {
        const userAuth = auth.currentUser;
        if (!userAuth) {
            // Sin login real usamos un fallback demo
            setPerfilPaciente(prev => ({ ...prev, nombre: 'Valeria Gema', telefono: '555-019-283', fechaNacimiento: '1995-10-15' }));
            setLoadingData(false);
            return;
        }

        const loadData = async () => {
            try {
                const paciente = await getPacienteByUid(userAuth.uid);
                if (paciente) {
                    setPacienteDocId(paciente.id);
                    setPerfilPaciente({
                        nombre: paciente.nombre || '',
                        telefono: paciente.telefono || paciente.phone || '',
                        fechaNacimiento: paciente.fechaNacimiento || '',
                        fotoUrl: paciente.fotoUrl || null,
                        tipoTratamiento: paciente.tipoTratamiento || 'Mixto',
                    });

                    // Seguimiento (historial peso + medidas)
                    const seguimientos = await getSeguimientosPaciente(paciente.id);
                    const progreso = seguimientos.slice(0, 12).reverse().map(s => ({
                        fecha: new Date(s.fechaRegistro).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
                        peso: s.peso,
                        imc: s.imc,
                    }));
                    setProgresoData(progreso);

                    // Recibos
                    const recibosPaciente = await getRecibosPaciente(paciente.id);
                    setRecibos(recibosPaciente);

                    // Apoyo en casa asignado por el especialista
                    const cuidados = await getApoyoEnCasa(paciente.id);
                    setApoyoCuidados(cuidados || []);
                    setApoyoLoading(false);
                }
            } catch (err) {
                console.error('Error cargando datos del paciente:', err);
                setApoyoLoading(false);
            } finally {
                setLoadingData(false);
            }
        };

        loadData();
    }, []);

    const { resetPassword } = useAuth();
    const [sendingReset, setSendingReset] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const handleResetEmail = async () => {
        const user = auth.currentUser;
        if (!user?.email) return;
        setSendingReset(true);
        try {
            await resetPassword(user.email);
            setResetSent(true);
            setTimeout(() => setResetSent(false), 5000);
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSendingReset(false);
        }
    };


    const [isReciboOpen, setIsReciboOpen] = useState(false);
    const [reciboVisualizar, setReciboVisualizar] = useState(null);
    const [isMedidasOpen, setIsMedidasOpen] = useState(false);

    // Estado del Checklist Facial
    const [checklistFacial, setChecklistFacial] = useState({
        agua: false,
        limpiador: false,
        serum: false,
        protectorSolar: false,
        retoqueSolar: false,
        ceroSol: false,
    });

    // Estado del Tracker de Alimentos
    const [busquedaAlimento, setBusquedaAlimento] = useState('');
    const [alimentosConsumidos, setAlimentosConsumidos] = useState([]);
    const caloriasMeta = 1500;
    const caloriasActuales = alimentosConsumidos.reduce((acc, curr) => acc + curr.calorias, 0);

    const alimentosFiltrados = alimentosMexicanos.filter(a =>
        a.nombre.toLowerCase().includes(busquedaAlimento.toLowerCase())
    );

    const [password, setPassword] = useState({ actual: '', nueva: '', confirmar: '' });
    const fileInputRef = useRef(null);

    const formatCurrency = (amount) => `$${Number(amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })} `;

    const handlePhotoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPerfilPaciente({ ...perfilPaciente, fotoUrl: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveProfile = async () => {
        try {
            if (pacienteDocId) {
                await updatePaciente(pacienteDocId, {
                    nombre: perfilPaciente.nombre,
                    telefono: perfilPaciente.telefono,
                    fechaNacimiento: perfilPaciente.fechaNacimiento,
                    fotoUrl: perfilPaciente.fotoUrl,
                    tipoTratamiento: perfilPaciente.tipoTratamiento,
                });
                alert('✅ Perfil guardado y sincronizado con Firebase exitosamente.');
            } else {
                alert('Perfil guardado localmente (usuario demo).');
            }
        } catch (err) {
            console.error(err);
            alert('Error al guardar el perfil.');
        }
    };



    // Lógica Demo Cumpleaños
    const isBirthdayMonth = true; // Forzamos true para ver la demo de la tarjeta

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            {/* Header / Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-8 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-turquesa/10 rounded-full -mr-32 -mt-32 blur-[100px] pointer-events-none animate-pulse" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-acero/10 rounded-full -ml-32 -mb-32 blur-[80px] pointer-events-none" />

                <div className="flex flex-col md:flex-row items-center gap-8 relative z-10 w-full md:w-auto text-white">
                    <div className="relative group">
                        <div className={`w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-4xl font-black shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden relative cursor-pointer ring-1 ring-white/20 transition-all hover:scale-105 active:scale-95 ${loadingData ? 'animate-pulse' : ''}`} onClick={() => fileInputRef.current?.click()}>
                            {loadingData ? (
                                <User size={40} className="text-white/20" />
                            ) : perfilPaciente.fotoUrl ? (
                                <img src={perfilPaciente.fotoUrl} alt="Perfil" className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110" />
                            ) : (
                                perfilPaciente.nombre.charAt(0)
                            )}
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                                <Camera size={24} className="text-white scale-75 group-hover:scale-100 transition-transform" />
                            </div>
                        </div>
                        {!loadingData && (
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-turquesa border-4 border-[#1e293b] rounded-2xl flex items-center justify-center text-white shadow-xl animate-in zoom-in duration-500">
                                <PlusCircle size={14} />
                            </div>
                        )}
                    </div>
                    <div className="text-center md:text-left flex-1">
                        {loadingData ? (
                            <div className="space-y-4">
                                <div className="h-10 w-64 bg-white/10 rounded-2xl animate-pulse backdrop-blur-md" />
                                <div className="flex justify-center md:justify-start gap-3">
                                    <div className="h-7 w-24 bg-white/5 rounded-full animate-pulse" />
                                    <div className="h-7 w-32 bg-white/5 rounded-full animate-pulse" />
                                </div>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-4xl font-black tracking-tight drop-shadow-2xl animate-in fade-in slide-in-from-left-4 duration-500">¡Hola, {perfilPaciente.nombre.split(' ')[0]}!</h2>
                                <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 mt-4">
                                    <span className="text-[10px] font-black bg-white/5 text-turquesa px-4 py-1.5 rounded-2xl uppercase tracking-widest border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">Miembro Premium</span>
                                    <p className="text-white/40 text-xs font-bold tracking-widest">ID: {pacienteDocId?.toUpperCase().slice(0, 8) || 'ALFRA-001'}</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {!loadingData && (
                    <div className="flex bg-white/5 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 relative z-10 w-full md:w-auto overflow-x-auto hide-scrollbar animate-in fade-in zoom-in duration-500">
                        <button onClick={() => setActiveTab('progreso')} className={`px-6 py-3 rounded-xl text-sm font-black flex items-center gap-2 transition-all whitespace-nowrap uppercase tracking-widest ${activeTab === 'progreso' ? 'bg-white text-[#0f172a] shadow-2xl scale-105 active:scale-95' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                            <Target size={16} /> Mi Progreso
                        </button>
                        <button onClick={() => setActiveTab('cuidados')} className={`px-6 py-3 rounded-xl text-sm font-black flex items-center gap-2 transition-all whitespace-nowrap uppercase tracking-widest ${activeTab === 'cuidados' ? 'bg-white text-orange-600 shadow-2xl scale-105 active:scale-95' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                            <Home size={16} /> Mis Cuidados
                        </button>
                        <button onClick={() => setActiveTab('recibos')} className={`px-6 py-3 rounded-xl text-sm font-black flex items-center gap-2 transition-all whitespace-nowrap uppercase tracking-widest ${activeTab === 'recibos' ? 'bg-white text-[#0f172a] shadow-2xl scale-105 active:scale-95' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                            <Receipt size={16} /> Mis Recibos
                        </button>
                        <button onClick={() => setActiveTab('configuracion')} className={`px-6 py-3 rounded-xl text-sm font-black flex items-center gap-2 transition-all whitespace-nowrap uppercase tracking-widest ${activeTab === 'configuracion' ? 'bg-white text-[#0f172a] shadow-2xl scale-105 active:scale-95' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
                            <User size={16} /> Configuración
                        </button>
                    </div>
                )}
            </div>

            <ReciboDigital
                isOpen={isReciboOpen}
                onClose={() => setIsReciboOpen(false)}
                datosRecibo={reciboVisualizar}
            />

            <HistorialMedidasModal
                isOpen={isMedidasOpen}
                onClose={() => setIsMedidasOpen(false)}
            />

            {/* --- TAB: PROGRESO --- */}
            {activeTab === 'progreso' && (
                <div className="space-y-8 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Tarjeta de Cumpleaños Promocional (Solo visible en mes de cumpleaños) */}
                        {isBirthdayMonth && (
                            <div className="md:col-span-2 bg-gradient-to-br from-turquesa/90 via-acero/90 to-acero rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-8 border border-white/20 animate-in zoom-in-95 duration-700">
                                <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-40 -mt-40 pointer-events-none animate-pulse"></div>
                                <div className="absolute bottom-0 left-0 w-64 h-64 bg-turquesa/20 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>

                                <div className="w-28 h-28 bg-white/10 backdrop-blur-xl rounded-[2rem] p-4 shrink-0 shadow-2xl flex items-center justify-center z-10 border border-white/20">
                                    <img src="/logo.png.png" alt="ALFRA" className="w-full h-full object-contain filter brightness-110" />
                                </div>

                                <div className="flex-1 relative z-10 text-center md:text-left space-y-3">
                                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-2 border border-white/20">
                                        <Gift size={14} className="text-white" /> Mes de Aniversario
                                    </div>
                                    <h3 className="text-3xl md:text-4xl font-black tracking-tight leading-none">¡Felicidades, {perfilPaciente.nombre.split(' ')[0]}! ✨</h3>
                                    <p className="text-white/80 text-lg font-medium leading-relaxed">
                                        Este mes te consentimos con un <span className="text-white font-black underline decoration-turquesa underline-offset-4">20% de Cortesia</span> en cualquier tratamiento. ¡Agenda hoy!
                                    </p>
                                </div>

                                <Button
                                    variant="primary"
                                    className="shrink-0 bg-white text-acero hover:bg-turquesa hover:text-white z-10 font-black py-8 px-10 rounded-3xl shadow-2xl shadow-black/20 transition-all hover:scale-105 active:scale-95 text-lg"
                                    onClick={() => {
                                        const telefonoClinica = '5551234567';
                                        const mensaje = encodeURIComponent(`¡Hola ALFRA! ✨ Soy ${perfilPaciente.nombre} y quiero canjear mi regalo de cumpleaños (20% OFF).`);
                                        window.open(`https://wa.me/${telefonoClinica}?text=${mensaje}`, '_blank');
                                    }}
                                >
                                    Agendar Regalo
                                </Button>
                            </div>
                        )}
                        {/* Gráfico de Evolución */}
                        <Card title="Mi Evolución Clínica" subtitle="Historial de Peso (kg)">
                            <div className="h-64 mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={progresoData.length > 0 ? progresoData : [{ fecha: 'Sin datos', peso: 0 }]} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        <XAxis dataKey="fecha" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Line type="monotone" dataKey="peso" stroke="#20B2AA" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="mt-4 flex gap-4">
                                <Button variant="outline" size="sm" icon={ImageIcon} fullWidth>Ver Galería de Fotos</Button>
                                <Button variant="ghost" size="sm" icon={Activity} fullWidth onClick={() => setIsMedidasOpen(true)}>Historial de Medidas</Button>
                            </div>
                        </Card>

                        <div className="space-y-6">
                            {/* Progreso de Ahorro */}
                            <Card title="Ahorro para Lipoescultura">
                                <div className="flex justify-between text-sm font-medium mb-2">
                                    <span className="text-gray-600">Actual: {formatCurrency(ahorroActual)}</span>
                                    <span className="text-acero">Meta: {formatCurrency(ahorroMeta)}</span>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-gray-100 rounded-full h-4 mb-4 overflow-hidden shadow-inner">
                                    <div
                                        className="bg-turquesa h-4 rounded-full transition-all duration-1000 ease-out relative"
                                        style={{ width: `${progresoPorcentaje}% ` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
                                    </div>
                                </div>

                                <p className="text-center text-sm text-gray-500 font-medium">¡Has logrado el <span className="text-turquesa font-bold text-lg">{progresoPorcentaje}%</span> de tu meta!</p>

                                <div className="mt-6 p-4 bg-acero/5 rounded-xl border border-acero/10 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-acero">Próximo Abono Sugerido</p>
                                        <p className="text-xs text-gray-500">$2,500 MXN para este mes</p>
                                    </div>
                                    <Target className="text-acero/50" />
                                </div>
                            </Card>

                            {/* Próximas Citas */}
                            <Card title="Próximas Citas">
                                <div className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl bg-gray-50/50 hover:border-turquesa/30 transition-colors cursor-pointer group">
                                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center group-hover:scale-110 transition-transform">
                                        <Calendar size={16} className="mx-auto text-turquesa mb-1" />
                                        <span className="text-sm font-bold text-gray-900">15 Oct</span>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-gray-900">Seguimiento Pre-operatorio</h4>
                                        <p className="text-sm text-gray-500 mt-1">Con Dra. Ana López</p>
                                        <p className="text-sm text-turquesa font-medium mt-1">11:00 AM</p>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* NUEVOS MÓDULOS DE SEGUIMIENTO (CONDICIONALES SEGÚN TRATAMIENTO) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            {/* MÓDULO: CHECKLIST FACIAL DIARIO */}
                            {(perfilPaciente.tipoTratamiento === 'Facial' || perfilPaciente.tipoTratamiento === 'Mixto') && (
                                <Card title="Rutina de Cuidado en Casa (Diario)" subtitle="Tratamiento Facial en curso">
                                    <div className="space-y-3 mt-4">
                                        <div className="flex justify-between items-center text-sm mb-4 bg-turquesa/10 p-3 rounded-xl border border-turquesa/20 text-turquesa">
                                            <span className="font-bold flex items-center gap-2"><CheckSquare size={18} /> Progreso de Hoy:</span>
                                            <span className="font-black text-lg">
                                                {Object.values(checklistFacial).filter(Boolean).length} / 6
                                            </span>
                                        </div>

                                        {[
                                            { id: 'agua', label: 'Tomé al menos 2 a 3 litros de agua' },
                                            { id: 'limpiador', label: 'Me lavé la cara (mañana y noche)' },
                                            { id: 'serum', label: 'Apliqué mi suero/tónico recomendado' },
                                            { id: 'protectorSolar', label: 'Apliqué Protector Solar 50+ FPS' },
                                            { id: 'retoqueSolar', label: 'Retoqué mi protector solar cada 3-4 hrs' },
                                            { id: 'ceroSol', label: 'Evité asolearme directamente' },
                                        ].map((item) => (
                                            <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => setChecklistFacial({ ...checklistFacial, [item.id]: !checklistFacial[item.id] })}>
                                                <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-colors ${checklistFacial[item.id] ? 'bg-turquesa border-turquesa text-white' : 'border-gray-300 bg-white'}`}>
                                                    {checklistFacial[item.id] && <CheckSquare size={16} />}
                                                </div>
                                                <span className={`text-sm font-medium ${checklistFacial[item.id] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.label}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Submit to Electronic Record */}
                                    <div className="pt-4 mt-6 border-t border-gray-100 flex justify-end">
                                        <button
                                            onClick={() => {
                                                alert("Rutina enviada exitosamente al Expediente Médico de la Especialista.");
                                                // Reset checklist logic here if needed
                                            }}
                                            className="w-full sm:w-auto bg-acero text-white font-bold py-3 px-6 rounded-xl shadow-md hover:bg-acero/90 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Send size={18} />
                                            Registrar y Enviar a Expediente
                                        </button>
                                    </div>
                                </Card>
                            )}

                            {/* MÓDULO: TRACKER ALIMENTICIO (REDUCTIVO/METABÓLICO) */}
                            {(perfilPaciente.tipoTratamiento === 'Reductivo' || perfilPaciente.tipoTratamiento === 'Mixto') && (
                                <Card title="Diario de Alimentación" subtitle="Tratamiento Reductivo / Metabólico">

                                    <div className="flex items-end justify-between mb-6">
                                        <div>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Calorías Consumidas Hoy</p>
                                            <h3 className="text-3xl font-black text-acero">{caloriasActuales} <span className="text-sm font-medium text-gray-400">/ {caloriasMeta} kcal</span></h3>
                                        </div>
                                        <div className="w-16 h-16 rounded-full border-4 border-turquesa/20 relative flex items-center justify-center">
                                            <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90">
                                                <circle cx="50%" cy="50%" r="28" fill="none" stroke="#20B2AA" strokeWidth="4" strokeDasharray="175" strokeDashoffset={175 - (Math.min(caloriasActuales / caloriasMeta, 1) * 175)} className="transition-all duration-1000 ease-out" />
                                            </svg>
                                            <span className="text-xs font-bold text-turquesa">{Math.round((caloriasActuales / caloriasMeta) * 100)}%</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="relative z-20">
                                            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Busca alimentos o antojitos..."
                                                className="w-full pl-10 pr-4 py-2 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-turquesa outline-none transition-all text-sm"
                                                value={busquedaAlimento}
                                                onChange={(e) => setBusquedaAlimento(e.target.value)}
                                            />

                                            {/* Resultados de Búsqueda */}
                                            {busquedaAlimento.length > 1 && (
                                                <div className="absolute z-30 w-full max-h-48 overflow-y-auto bg-white border rounded-xl shadow-2xl mt-1 top-full left-0">
                                                    {alimentosFiltrados.length === 0 ? (
                                                        <p className="p-3 text-sm text-gray-500 text-center">No se encontraron alimentos.</p>
                                                    ) : (
                                                        alimentosFiltrados.slice(0, 10).map((alimento) => (
                                                            <div key={alimento.id} className="p-3 border-b hover:bg-gray-50 flex justify-between items-center cursor-pointer" onClick={() => {
                                                                setAlimentosConsumidos([{ ...alimento, timestamp: new Date() }, ...alimentosConsumidos]);
                                                                setBusquedaAlimento('');
                                                            }}>
                                                                <div>
                                                                    <p className="text-sm font-bold text-gray-800">{alimento.nombre}</p>
                                                                    <p className="text-xs text-turquesa">{alimento.calorias} kcal <span className="text-gray-400">({alimento.porcion})</span></p>
                                                                </div>
                                                                <PlusCircle size={18} className="text-turquesa/50" />
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Lista de Consumos del Día */}
                                        <div className="space-y-2 mt-4 max-h-48 overflow-y-auto pr-2">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 sticky top-0 bg-white">Registrados Hoy:</p>
                                            {alimentosConsumidos.length === 0 ? (
                                                <p className="text-sm text-gray-400 text-center py-4 italic border-2 border-dashed border-gray-100 rounded-xl">No has registrado alimentos aún.</p>
                                            ) : (
                                                alimentosConsumidos.map((registro, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 animate-in slide-in-from-left-2">
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-800">{registro.nombre}</p>
                                                            <p className="text-[10px] text-gray-400">{registro.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {registro.porcion}</p>
                                                        </div>
                                                        <span className="text-sm font-bold text-red-500">+{registro.calorias}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        {/* Submit to Electronic Record */}
                                        <div className="pt-4 border-t border-gray-100 flex justify-end">
                                            <button
                                                onClick={() => {
                                                    alert("Registro enviado exitosamente al Expediente Médico de la Especialista.");
                                                    setAlimentosConsumidos([]);
                                                }}
                                                className="w-full sm:w-auto bg-acero text-white font-bold py-3 px-6 rounded-xl shadow-md hover:bg-acero/90 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Send size={18} />
                                                Registrar y Enviar a Expediente
                                            </button>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB: MIS CUIDADOS (Apoyo en Casa) --- */}
            {activeTab === 'cuidados' && (
                <div className="space-y-6 animate-in fade-in">
                    <Card className="shadow-sm border-t-4 border-orange-400">
                        <div className="mb-6 pb-3 border-b">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-orange-700">
                                <Home className="text-orange-500" size={22} /> Mis Cuidados en Casa
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Plan personalizado asignado por tu especialista de Clínica ALFRA.
                            </p>
                        </div>

                        {apoyoLoading ? (
                            <div className="flex items-center justify-center py-12 text-orange-400">
                                <svg className="animate-spin mr-2 w-6 h-6" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Cargando tu plan de cuidados...
                            </div>
                        ) : apoyoCuidados.filter(c => c.activo).length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <Home size={48} className="mx-auto mb-4 opacity-30" />
                                <p className="font-bold text-lg">Tu especialista aún no ha asignado cuidados</p>
                                <p className="text-sm mt-1">En tu próxima consulta te asignarán tu plan personalizado.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center gap-4">
                                    <div className="text-4xl font-black text-orange-500">{apoyoCuidados.filter(c => c.activo).length}</div>
                                    <div>
                                        <p className="font-bold text-orange-800">cuidados asignados para ti</p>
                                        <p className="text-xs text-orange-600">Sígue estos pasos en casa para maximizar tus resultados</p>
                                    </div>
                                </div>

                                {['Facial', 'Corporal', 'General', 'Personalizado'].map(cat => {
                                    const items = apoyoCuidados.filter(c => c.categoria === cat && c.activo);
                                    if (items.length === 0) return null;
                                    const catConfig = {
                                        Facial: { color: 'purple', emoji: '✨' },
                                        Corporal: { color: 'cyan', emoji: '💪' },
                                        General: { color: 'green', emoji: '🌿' },
                                        Personalizado: { color: 'rose', emoji: '⭐' },
                                    };
                                    const cfg = catConfig[cat] || { color: 'gray', emoji: '•' };
                                    return (
                                        <div key={cat}>
                                            <h4 className={`text-xs font-black uppercase tracking-widest text-${cfg.color}-600 mb-3 flex items-center gap-2`}>
                                                <span>{cfg.emoji}</span> Cuidados {cat}
                                            </h4>
                                            <div className="space-y-2">
                                                {items.map(cuidado => (
                                                    <div key={cuidado.id} className="flex items-start gap-3 p-3 rounded-xl bg-green-50 border-2 border-green-200">
                                                        <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                                                        <span className="text-sm text-green-800 font-medium leading-snug">{cuidado.texto}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* --- TAB: RECIBOS --- */}
            {activeTab === 'recibos' && (
                <div className="space-y-6 animate-in fade-in">
                    <Card className="shadow-sm border-gray-200">
                        <div className="flex items-center justify-between border-b pb-4 mb-6">
                            <h3 className="text-xl font-bold text-acero flex items-center gap-2">
                                <FileText size={24} className="text-turquesa" />
                                Historial de Pagos y Recibos
                            </h3>
                            <span className="text-xs bg-turquesa/10 text-turquesa px-3 py-1 rounded-full font-bold">
                                {recibos.length} comprobantes
                            </span>
                        </div>

                        <div className="space-y-4">
                            {recibos.map((recibo) => (
                                <div key={recibo.folio} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl hover:bg-white hover:border-turquesa/30 hover:shadow-md transition-all group">
                                    <div className="flex items-start gap-4 mb-4 sm:mb-0">
                                        <div className="w-12 h-12 rounded-xl bg-turquesa/10 text-turquesa flex items-center justify-center shrink-0">
                                            <Receipt size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-lg group-hover:text-turquesa transition-colors">{recibo.concepto}</h4>
                                            <p className="text-sm text-gray-500 mt-0.5">{recibo.fecha} • Folio #{recibo.folio}</p>
                                            <p className="text-xs text-acero font-semibold mt-1 bg-white inline-block px-2 py-0.5 rounded border border-gray-200">{recibo.metodoPago}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                                        <span className="text-xl font-black text-acero">
                                            ${recibo.monto.toLocaleString('es-MX')}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setReciboVisualizar(recibo);
                                                setIsReciboOpen(true);
                                            }}
                                            className="text-turquesa border-turquesa hover:bg-turquesa hover:text-white"
                                        >
                                            Ver Recibo Digital
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            {recibos.length === 0 && (
                                <div className="text-center py-12">
                                    <Receipt size={48} className="mx-auto text-gray-300 mb-4" />
                                    <p className="text-gray-500 font-medium">No se encontraron recibos recientes.</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* --- TAB: CONFIGURACIÓN --- */}
            {activeTab === 'configuracion' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">

                    <Card className="shadow-sm border-gray-200">
                        <h3 className="text-lg font-bold text-acero flex items-center gap-2 border-b pb-3 mb-4"><User size={20} className="text-turquesa" /> Datos Personales</h3>
                        <div className="space-y-4">
                            <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6">
                                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                <div className="w-24 h-24 rounded-full bg-acero text-white flex items-center justify-center text-4xl font-black shadow-md overflow-hidden relative mb-3 group">
                                    {perfilPaciente.fotoUrl ? (
                                        <img src={perfilPaciente.fotoUrl} alt="Perfil" className="w-full h-full object-cover" />
                                    ) : (
                                        perfilPaciente.nombre.charAt(0)
                                    )}
                                </div>
                                <Button variant="outline" size="sm" icon={Camera} onClick={() => fileInputRef.current?.click()}>Cambiar Fotografía</Button>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nombre Completo</label>
                                <input type="text" className="w-full mt-1 p-3 border rounded-xl bg-gray-50 font-medium text-gray-700 outline-none focus:ring-2 focus:ring-turquesa/50 transition-all" value={perfilPaciente.nombre} onChange={(e) => setPerfilPaciente({ ...perfilPaciente, nombre: e.target.value })} />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 flex justify-between items-center uppercase tracking-widest">
                                    <span>Fecha de Nacimiento</span>
                                    <span className="text-[10px] text-turquesa bg-turquesa/10 px-2 py-0.5 rounded-full flex items-center gap-1"><Bell size={10} /> Activa Promos</span>
                                </label>
                                <input type="date" className="w-full mt-1 p-3 border rounded-xl bg-white focus:bg-white font-bold text-gray-800 outline-none focus:ring-2 focus:ring-turquesa/50 transition-all" value={perfilPaciente.fechaNacimiento} onChange={(e) => setPerfilPaciente({ ...perfilPaciente, fechaNacimiento: e.target.value })} />
                                <p className="text-xs text-gray-400 mt-1">* Se enviará un aviso confidencial a Recepción para tus felicitaciones.</p>
                            </div>

                            <Button variant="primary" fullWidth onClick={handleSaveProfile}>Guardar Cambios de Perfil</Button>
                        </div>
                    </Card>

                    <Card className="shadow-sm border-gray-200">
                        <h3 className="text-lg font-bold text-acero flex items-center gap-2 border-b pb-3 mb-4"><Lock size={20} className="text-turquesa" /> Seguridad</h3>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500">
                                Por seguridad, para cambiar tu contraseña te enviaremos un enlace de acceso seguro a tu correo electrónico registrado.
                            </p>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                                <Mail size={20} className="text-turquesa" />
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Correo Registrado</p>
                                    <p className="text-sm font-bold text-acero truncate">{auth.currentUser?.email}</p>
                                </div>
                            </div>

                            <Button
                                variant={resetSent ? "outline" : "primary"}
                                fullWidth
                                onClick={handleResetEmail}
                                disabled={sendingReset || !auth.currentUser?.email}
                                icon={resetSent ? CheckCircle : Mail}
                                className={resetSent ? 'border-green-500 text-green-600' : ''}
                            >
                                {sendingReset ? 'Enviando...' : (resetSent ? 'Correo Enviado' : 'Enviar Enlace de Restablecimiento')}
                            </Button>

                            {resetSent && (
                                <p className="text-[11px] text-green-600 font-medium text-center animate-in fade-in slide-in-from-top-1">
                                    ¡Listo! Revisa tu bandeja de entrada (y la carpeta de spam).
                                </p>
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
