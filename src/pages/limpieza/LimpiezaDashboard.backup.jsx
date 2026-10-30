import React, { useState, useEffect } from 'react';
import {
    Sparkles, CheckCircle, Clock, AlertCircle, Wrench, Package, ClipboardList,
    Plus, Trash2, Send, X, Bell, Calendar
} from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { getCitas, crearAlertaPaciente } from '../../services/citasService';
import {
    ESPACIOS_CLINICA, registrarTareaCompletada, onBitacoraChange,
    crearReporteMantenimiento, getReportesMantenimiento,
    crearSolicitudInsumos, getSolicitudesInsumos,
    onTareasChange, completarTarea
} from '../../services/limpiezaService';

const auth = getAuth();
const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const HOY = getLocalDateString();

export default function LimpiezaDashboard() {
    const user = auth.currentUser;
    const [activeTab, setActiveTab] = useState('limpieza');
    const [bitacora, setBitacora] = useState([]);
    const [tareas, setTareas] = useState([]);
    const [selectedDate, setSelectedDate] = useState(HOY);
    const [horaEntrada, setHoraEntrada] = useState('08:00 AM');

    // ============ HORA DE ENTRADA ============
    useEffect(() => {
        const calcHoraEntrada = async () => {
            try {
                const hoy = new Date();
                const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0);
                const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59);
                const citas = await getCitas(inicio, fin);
                if (citas && citas.length > 0) {
                    const sorted = citas.sort((a, b) => {
                        const da = a.fechaHora?.toDate ? a.fechaHora.toDate() : new Date(a.fechaHora);
                        const db2 = b.fechaHora?.toDate ? b.fechaHora.toDate() : new Date(b.fechaHora);
                        return da - db2;
                    });
                    const primera = sorted[0].fechaHora?.toDate ? sorted[0].fechaHora.toDate() : new Date(sorted[0].fechaHora);
                    primera.setMinutes(primera.getMinutes() - 40);
                    setHoraEntrada(primera.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }));
                }
            } catch (e) { console.error(e); }
        };
        calcHoraEntrada();
    }, []);

    // ============ LISTENERS ============
    useEffect(() => {
        const unsub1 = onBitacoraChange(selectedDate, setBitacora);
        let unsub2 = () => {};
        if (user?.uid) unsub2 = onTareasChange(user.uid, setTareas);
        return () => { unsub1(); unsub2(); };
    }, [selectedDate, user]);

    const tabs = [
        { id: 'limpieza', label: 'Bitácora', icon: Sparkles },
        { id: 'mantenimiento', label: 'Mantenimiento', icon: Wrench },
        { id: 'solicitudes', label: 'Solicitud Insumos', icon: Package },
        { id: 'tareas', label: 'Tareas Extra', icon: ClipboardList },
    ];

    const espaciosLimpios = bitacora.filter(b => b.completado).map(b => b.espacioId);
    const tareasP = tareas.filter(t => t.estado === 'pendiente');

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header con hora de entrada */}
            <div className="bg-gradient-to-br from-acero via-[#1a3040] to-acero rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-turquesa/10 rounded-full blur-2xl"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight uppercase">Limpieza y Mantenimiento</h1>
                        <p className="text-white/60 text-sm font-medium mt-1">
                            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                    <div className="text-left sm:text-right bg-white/5 border border-white/10 rounded-2xl p-3 px-4">
                        <p className="text-[10px] text-turquesa font-black uppercase tracking-widest">Hora de entrada hoy</p>
                        <p className="text-2xl font-black text-turquesa mt-0.5">{horaEntrada}</p>
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider mt-0.5">40 min antes de 1ra cita</p>
                    </div>
                </div>
                {/* Progress */}
                <div className="mt-6 flex items-center gap-3 relative z-10">
                    <div className="flex-1 bg-white/10 rounded-full h-3 overflow-hidden">
                        <div className="bg-gradient-to-r from-turquesa to-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${(espaciosLimpios.length / ESPACIOS_CLINICA.length) * 100}%` }} />
                    </div>
                    <span className="text-xs font-black text-turquesa bg-turquesa/10 px-2.5 py-1 rounded-md">
                        {espaciosLimpios.length} / {ESPACIOS_CLINICA.length} COMPLETADOS
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-acero text-white shadow-lg scale-[1.02]' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}>
                        <tab.icon size={16} />
                        {tab.label}
                        {tab.id === 'tareas' && tareasP.length > 0 && (
                            <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">{tareasP.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            {activeTab === 'limpieza' && (
                <TabLimpieza 
                    bitacora={bitacora} 
                    user={user} 
                    selectedDate={selectedDate} 
                    setSelectedDate={setSelectedDate} 
                />
            )}
            {activeTab === 'mantenimiento' && <TabMantenimiento user={user} />}
            {activeTab === 'solicitudes' && <TabSolicitudes user={user} />}
            {activeTab === 'tareas' && <TabTareas tareas={tareas} user={user} />}
        </div>
    );
}

// ===================== TAB LIMPIEZA =====================
function TabLimpieza({ bitacora, user, selectedDate, setSelectedDate }) {
    const [checking, setChecking] = useState({});

    const handleCheckTarea = async (espacio, tareaNombre) => {
        const key = `${espacio.id}-${tareaNombre}`;
        setChecking(p => ({ ...p, [key]: true }));
        try {
            const res = await registrarTareaCompletada({
                espacioId: espacio.id,
                nombreEspacio: espacio.nombre,
                tareaNombre,
                usuarioNombre: user?.displayName || user?.email || 'Limpieza',
                usuarioUid: user?.uid || '',
                fecha: selectedDate
            });

            // Si al marcar esta tarea, se completó todo el espacio, notificar al admin
            if (res.completado) {
                await crearAlertaPaciente(
                    'admin', 
                    `🧹 ${espacio.nombre} ha sido limpiado completamente por ${user?.displayName || user?.email}`, 
                    { tipo: 'limpieza_completada', especialistaId: 'admin' }
                );
            }
        } catch (e) {
            console.error(e);
            alert('Error al registrar la tarea');
        }
        setChecking(p => ({ ...p, [key]: false }));
    };

    return (
        <div className="space-y-6">
            {/* Selector de Fecha */}
            <div className="bg-white rounded-3xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div>
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Historial y Fecha de Bitácora</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Selecciona un día para visualizar o registrar limpiezas</p>
                </div>
                <div className="flex items-center gap-3">
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)} 
                        className="p-3 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:border-turquesa bg-gray-50/50"
                    />
                </div>
            </div>

            {/* Grid Premium de Cabinas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {ESPACIOS_CLINICA.map(espacio => {
                    const registro = bitacora.find(b => b.espacioId === espacio.id);
                    const completado = !!registro?.completado;
                    const tareasDetalle = registro?.tareasDetalle || {};
                    const tareasCompletadasCount = Object.keys(tareasDetalle).length;

                    return (
                        <div 
                            key={espacio.id} 
                            className={`rounded-3xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                                completado 
                                ? 'bg-gradient-to-br from-emerald-50/40 to-emerald-50/10 border-emerald-200/80' 
                                : 'bg-white border-gray-150'
                            }`}
                        >
                            {/* Card Top */}
                            <div className="p-5 space-y-4">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className={`font-black text-base ${completado ? 'text-emerald-800' : 'text-gray-800'}`}>
                                        {espacio.nombre}
                                    </h4>
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                                        completado 
                                        ? 'bg-emerald-100 border-emerald-200 text-emerald-700' 
                                        : tareasCompletadasCount > 0 
                                            ? 'bg-amber-100 border-amber-200 text-amber-700'
                                            : 'bg-gray-100 border-gray-200 text-gray-400'
                                    }`}>
                                        {completado 
                                            ? 'Completado' 
                                            : tareasCompletadasCount > 0 
                                                ? `${tareasCompletadasCount}/${espacio.tareas.length} Tareas`
                                                : 'Pendiente'
                                        }
                                    </span>
                                </div>

                                {/* Checklist de Tareas con registro de hora bloqueada */}
                                <div className="space-y-2">
                                    {espacio.tareas.map(tarea => {
                                        const checkTime = tareasDetalle[tarea];
                                        const isChecked = !!checkTime;
                                        const isChecking = checking[`${espacio.id}-${tarea}`];

                                        return (
                                            <div 
                                                key={tarea} 
                                                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                                                    isChecked 
                                                    ? 'bg-emerald-50/30 border-emerald-100/50' 
                                                    : 'bg-white border-gray-100 hover:border-turquesa/20'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        disabled={isChecked || isChecking}
                                                        onChange={() => handleCheckTarea(espacio, tarea)}
                                                        className="w-5 h-5 rounded-md border-gray-300 text-turquesa focus:ring-turquesa/20 transition-all checked:bg-turquesa cursor-pointer disabled:cursor-not-allowed"
                                                    />
                                                    <span className={`text-xs font-bold transition-all ${
                                                        isChecked ? 'text-gray-400 line-through' : 'text-gray-700'
                                                    }`}>
                                                        {tarea}
                                                    </span>
                                                </div>
                                                {isChecked && (
                                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50/50 px-2.5 py-1 rounded-lg border border-emerald-100/50 flex items-center gap-1 animate-in fade-in duration-200">
                                                        <Clock size={11} className="text-emerald-500" />
                                                        {checkTime}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Info de finalización si aplica */}
                            {completado && (
                                <div className="px-5 pb-4 pt-2 border-t border-emerald-100/30 bg-emerald-50/5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                                            <CheckCircle size={14} />
                                        </div>
                                        <p className="text-[10px] text-emerald-700 font-bold">
                                            Finalizado a las {registro.hora} por {registro.limpiadoPor}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ===================== TAB MANTENIMIENTO =====================
function TabMantenimiento({ user }) {
    const [reportes, setReportes] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ descripcion: '', tipo: 'correctivo', ubicacion: 'Cabina Facial' });
    const [saving, setSaving] = useState(false);

    const loadReportes = async () => {
        try {
            const data = await getReportesMantenimiento();
            setReportes(data.sort((a,b) => {
                const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return db2 - da;
            }));
        } catch(e) { console.error(e); }
    };

    useEffect(() => { loadReportes(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.descripcion.trim()) return alert('Describe el problema');
        setSaving(true);
        try {
            await crearReporteMantenimiento({
                ...form,
                reportadoPor: user?.displayName || user?.email || 'Mantenimiento',
                reportadoPorUid: user?.uid || '',
                estado: 'pendiente'
            });
            await crearAlertaPaciente('admin', '🔧 Nuevo reporte de mantenimiento: ' + form.descripcion.substring(0, 50), { tipo: 'mantenimiento', especialistaId: 'admin' });
            setForm({ descripcion: '', tipo: 'correctivo', ubicacion: 'Cabina Facial' });
            setShowForm(false);
            loadReportes();
        } catch (e) { console.error(e); alert('Error'); }
        setSaving(false);
    };

    const statusColors = { pendiente: 'text-amber-600 bg-amber-50 border-amber-100', en_proceso: 'text-blue-600 bg-blue-50 border-blue-100', resuelto: 'text-emerald-600 bg-emerald-50 border-emerald-100' };

    return (
        <div className="space-y-4">
            <button onClick={() => setShowForm(!showForm)} className="w-full bg-white border-2 border-dashed border-gray-200 hover:border-turquesa text-gray-500 hover:text-turquesa font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all">
                <Plus size={18} /> Crear Reporte de Mantenimiento
            </button>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-lg">
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Ubicación</label>
                        <select value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))} className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm focus:border-acero outline-none bg-white font-bold text-gray-700">
                            {ESPACIOS_CLINICA.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                            <option value="Baños Generales">Baños Generales</option>
                            <option value="Fachada y Pasillos">Fachada y Pasillos</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Tipo de reporte</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['correctivo', 'preventivo'].map(t => (
                                <button key={t} type="button" onClick={() => setForm(p => ({ ...p, tipo: t }))}
                                    className={`py-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${form.tipo === t ? 'bg-acero border-acero text-white' : 'border-gray-200 text-gray-500'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">Descripción del problema</label>
                        <textarea value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Escribe detalles aquí..." className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm resize-none h-24 focus:border-acero outline-none" />
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm">Cancelar</button>
                        <button type="submit" disabled={saving} className="flex-1 bg-turquesa text-white font-black py-3 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"><Send size={16} /> {saving ? 'Reportando...' : 'Enviar Reporte'}</button>
                    </div>
                </form>
            )}

            {reportes.length === 0 ? (
                <div className="text-center py-12"><Wrench size={32} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm font-bold">Sin reportes de mantenimiento</p></div>
            ) : reportes.map(r => (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3 shadow-sm">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${r.tipo === 'preventivo' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                        <Wrench size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800">{r.descripcion}</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-0.5">{r.ubicacion} | {r.tipo} | {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('es-MX') : ''}</p>
                    </div>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full border ${statusColors[r.estado] || statusColors.pendiente}`}>{r.estado}</span>
                </div>
            ))}
        </div>
    );
}

// ===================== TAB SOLICITUDES =====================
function TabSolicitudes({ user }) {
    const [solicitudes, setSolicitudes] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [items, setItems] = useState([{ nombre: '', cantidad: 1 }]);
    const [notasSol, setNotasSol] = useState('');
    const [saving, setSaving] = useState(false);

    const loadSolicitudes = async () => {
        try {
            const data = await getSolicitudesInsumos();
            setSolicitudes(data.sort((a,b) => {
                const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return db2 - da;
            }));
        } catch(e) { console.error(e); }
    };

    useEffect(() => { loadSolicitudes(); }, []);

    const handleAddItem = () => setItems(p => [...p, { nombre: '', cantidad: 1 }]);
    const handleRemoveItem = (idx) => setItems(p => p.filter((_, i) => i !== idx));
    const handleItemChange = (idx, field, val) => setItems(p => p.map((item, i) => i === idx ? { ...item, [field]: val } : item));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validItems = items.filter(item => item.nombre.trim());
        if (validItems.length === 0) return alert('Agrega al menos un producto válido');
        setSaving(true);
        try {
            await crearSolicitudInsumos({ 
                items: validItems, 
                notas: notasSol, 
                solicitadoPor: user?.displayName || user?.email || 'Limpieza', 
                solicitadoPorUid: user?.uid || '',
                estado: 'pendiente'
            });
            await crearAlertaPaciente('admin', '📦 Nueva solicitud de insumos de limpieza (' + validItems.length + ' productos)', { tipo: 'solicitud_insumos', especialistaId: 'admin' });
            setItems([{ nombre: '', cantidad: 1 }]);
            setNotasSol('');
            setShowForm(false);
            loadSolicitudes();
        } catch (e) { console.error(e); alert('Error'); }
        setSaving(false);
    };

    const statusColors = { pendiente: 'text-amber-600 bg-amber-50 border-amber-100', aprobada: 'text-emerald-600 bg-emerald-50 border-emerald-100', rechazada: 'text-red-600 bg-red-50 border-red-100' };

    return (
        <div className="space-y-4">
            <button onClick={() => setShowForm(!showForm)} className="w-full bg-white border-2 border-dashed border-gray-200 hover:border-turquesa text-gray-500 hover:text-turquesa font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all">
                <Plus size={18} /> Nueva Solicitud de Insumos
            </button>

            {showForm && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-lg">
                    <p className="text-xs font-black text-acero uppercase tracking-widest">Productos solicitados</p>
                    {items.map((item, i) => (
                        <div key={i} className="flex gap-2 items-center">
                            <input value={item.nombre} onChange={e => handleItemChange(i, 'nombre', e.target.value)} placeholder="Nombre del producto" className="flex-1 p-3 border-2 border-gray-200 rounded-xl text-sm focus:border-acero outline-none" />
                            <input type="number" value={item.cantidad} onChange={e => handleItemChange(i, 'cantidad', parseInt(e.target.value) || 1)} min="1" className="w-20 p-3 border-2 border-gray-200 rounded-xl text-sm text-center focus:border-acero outline-none" />
                            {items.length > 1 && <button onClick={() => handleRemoveItem(i)} className="p-2 text-red-400 hover:text-red-600"><X size={16} /></button>}
                        </div>
                    ))}
                    <button onClick={handleAddItem} className="text-turquesa text-xs font-bold flex items-center gap-1"><Plus size={14} /> Agregar producto</button>
                    <textarea value={notasSol} onChange={e => setNotasSol(e.target.value)} placeholder="Notas adicionales..." className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm resize-none h-16 focus:border-acero outline-none" />
                    <div className="flex gap-2">
                        <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm">Cancelar</button>
                        <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-turquesa text-white font-black py-3 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"><Send size={16} /> {saving ? 'Enviando...' : 'Enviar Solicitud'}</button>
                    </div>
                </div>
            )}

            {solicitudes.length === 0 ? (
                <div className="text-center py-12"><Package size={32} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm font-bold">Sin solicitudes</p></div>
            ) : solicitudes.map(s => (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-500">{s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString('es-MX') : 'Hoy'}</p>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full border ${statusColors[s.estado] || ''}`}>{s.estado}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {(s.items || []).map((item, i) => (
                            <span key={i} className="text-[10px] bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full font-bold text-gray-600">{item.nombre} x{item.cantidad}</span>
                        ))}
                    </div>
                    {s.notasAdmin && <p className="text-[10px] text-acero font-bold bg-acero/5 p-2 rounded-lg">Admin: {s.notasAdmin}</p>}
                </div>
            ))}
        </div>
    );
}

// ===================== TAB TAREAS =====================
function TabTareas({ tareas, user }) {
    const [completing, setCompleting] = useState(null);

    const handleCompletar = async (tarea) => {
        setCompleting(tarea.id);
        try {
            await completarTarea(tarea.id);
            await crearAlertaPaciente('admin', '✅ Tarea completada: ' + tarea.titulo + ' por ' + (user?.displayName || user?.email), { tipo: 'tarea_completada', especialistaId: 'admin' });
        } catch (e) { console.error(e); alert('Error'); }
        setCompleting(null);
    };

    const pendientes = tareas.filter(t => t.estado === 'pendiente');
    const completadas = tareas.filter(t => t.estado === 'completada');

    return (
        <div className="space-y-4">
            {pendientes.length === 0 && completadas.length === 0 ? (
                <div className="text-center py-12"><ClipboardList size={32} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm font-bold">No tienes tareas asignadas</p></div>
            ) : (
                <>
                    {pendientes.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Pendientes ({pendientes.length})</p>
                            {pendientes.map(t => (
                                <div key={t.id} className="bg-white rounded-2xl border-2 border-amber-200 p-4 flex items-start gap-3 shadow-sm">
                                    <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0"><AlertCircle size={18} /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-gray-800">{t.titulo}</p>
                                        {t.descripcion && <p className="text-xs text-gray-500 mt-0.5">{t.descripcion}</p>}
                                        {t.fechaLimite && <p className="text-[10px] text-amber-600 font-bold mt-1">Limite: {t.fechaLimite}</p>}
                                    </div>
                                    <button onClick={() => handleCompletar(t)} disabled={completing === t.id}
                                        className="bg-emerald-500 text-white text-[10px] font-black px-4 py-2 rounded-xl hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50 shrink-0">
                                        {completing === t.id ? '...' : 'Completar'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {completadas.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Completadas ({completadas.length})</p>
                            {completadas.map(t => (
                                <div key={t.id} className="bg-emerald-50/50 rounded-2xl border border-emerald-100 p-4 flex items-center gap-3 opacity-70 shadow-sm">
                                    <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-emerald-700 line-through">{t.titulo}</p>
                                        {t.completadaEn && <p className="text-[10px] text-emerald-500">{new Date(t.completadaEn).toLocaleString('es-MX')}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
