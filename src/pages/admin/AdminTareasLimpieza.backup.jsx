import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, CheckCircle, Clock, Package, Wrench, Send, X, AlertCircle, Sparkles, Check } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import {
    crearTarea, getAllTareas, onBitacoraChange,
    getReportesMantenimiento, updateReporteEstado,
    getSolicitudesInsumos, updateSolicitudEstado,
    ESPACIOS_CLINICA, onHistorialBitacoraChange
} from '../../services/limpiezaService';
import { crearAlertaPaciente } from '../../services/citasService';

const auth = getAuth();
const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const HOY = getLocalDateString();
const ELIAS_UID = 'jUGAL95pQrgFFaaaEJq0wyU7wqp1';

export default function AdminTareasLimpieza() {
    const [activeTab, setActiveTab] = useState('tareas');
    const [tareas, setTareas] = useState([]);
    const [bitacora, setBitacora] = useState([]);
    const [reportes, setReportes] = useState([]);
    const [solicitudes, setSolicitudes] = useState([]);
    const [selectedDate, setSelectedDate] = useState(HOY);
    const [subTabReportes, setSubTabReportes] = useState('limpieza');
    const [historialLimpieza, setHistorialLimpieza] = useState([]);

    const [showNewTask, setShowNewTask] = useState(false);
    const [newTask, setNewTask] = useState({ titulo: '', descripcion: '', fechaLimite: '' });
    const [saving, setSaving] = useState(false);

    // ============ REAL-TIME LISTENERS & LOADERS ============
    const loadAllStatic = async () => {
        try {
            const [t, r, s] = await Promise.all([
                getAllTareas(),
                getReportesMantenimiento(), 
                getSolicitudesInsumos()
            ]);
            setTareas(t);
            setReportes(r.sort((a,b) => {
                const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return db - da;
            }));
            setSolicitudes(s.sort((a,b) => {
                const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return db - da;
            }));
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        loadAllStatic();
    }, []);

    useEffect(() => {
        const unsub = onBitacoraChange(selectedDate, (data) => {
            setBitacora(data);
        });
        return () => unsub();
    }, [selectedDate]);

    useEffect(() => {
        const unsub = onHistorialBitacoraChange((data) => {
            setHistorialLimpieza(data);
        });
        return () => unsub();
    }, []);

    const handleCrearTarea = async () => {
        if (!newTask.titulo.trim()) return alert('Escribe un título para la tarea');
        setSaving(true);
        try {
            await crearTarea({ 
                ...newTask, 
                asignadoPor: auth.currentUser?.email || 'Admin', 
                asignadoA: ELIAS_UID 
            });
            await crearAlertaPaciente(ELIAS_UID, '🔔 Nueva tarea asignada: ' + newTask.titulo, { tipo: 'nueva_tarea', pacienteId: ELIAS_UID });
            setNewTask({ titulo: '', descripcion: '', fechaLimite: '' });
            setShowNewTask(false);
            loadAllStatic();
        } catch (e) { console.error(e); alert('Error'); }
        setSaving(false);
    };

    const handleSolicitud = async (id, estado) => {
        try {
            const nota = estado === 'rechazada' ? prompt('Razón del rechazo:') || '' : '';
            await updateSolicitudEstado(id, estado, nota);
            await crearAlertaPaciente(ELIAS_UID, `📦 Tu solicitud de insumos fue ${estado}` + (nota ? ` (${nota})` : ''), { tipo: 'solicitud_' + estado, pacienteId: ELIAS_UID });
            loadAllStatic();
        } catch (e) { console.error(e); }
    };

    const handleReporte = async (id, estado) => {
        try {
            await updateReporteEstado(id, estado);
            loadAllStatic();
        } catch (e) { console.error(e); }
    };

    const tabs = [
        { id: 'tareas', label: 'Tareas', icon: ClipboardList },
        { id: 'bitacora', label: 'Bitácoras', icon: Sparkles },
        { id: 'solicitudes', label: 'Solicitudes', icon: Package, badge: solicitudes.filter(s => s.estado === 'pendiente').length },
        { id: 'mantenimiento', label: 'Reportes', icon: Wrench, badge: reportes.filter(r => r.estado === 'pendiente').length },
    ];

    const espaciosLimpios = bitacora.filter(b => b.completado).map(b => b.espacioId);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header / Stats Panel */}
            <div className="bg-gradient-to-br from-acero via-[#1a3040] to-acero rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-turquesa/10 rounded-full blur-2xl"></div>
                <div className="relative z-10">
                    <h1 className="text-2xl font-black tracking-tight uppercase">Gestión de Limpieza</h1>
                    <p className="text-white/60 text-sm font-medium mt-1">Administra tareas, solicitudes e historial de limpieza de la clínica</p>
                    <div className="mt-5 flex flex-wrap gap-4">
                        <div className="bg-white/10 border border-white/5 rounded-2xl px-4 py-2.5">
                            <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Espacios Completados ({selectedDate === HOY ? 'Hoy' : selectedDate})</p>
                            <p className="text-xl font-black text-turquesa mt-0.5">{espaciosLimpios.length} / {ESPACIOS_CLINICA.length}</p>
                        </div>
                        <div className="bg-white/10 border border-white/5 rounded-2xl px-4 py-2.5">
                            <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Tareas Pendientes</p>
                            <p className="text-xl font-black text-amber-400 mt-0.5">{tareas.filter(t => t.estado === 'pendiente').length}</p>
                        </div>
                        <div className="bg-white/10 border border-white/5 rounded-2xl px-4 py-2.5">
                            <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Solicitudes Insumos</p>
                            <p className="text-xl font-black text-red-400 mt-0.5">{solicitudes.filter(s => s.estado === 'pendiente').length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-acero text-white shadow-lg scale-[1.02]' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}>
                        <tab.icon size={16} />
                        {tab.label}
                        {tab.badge > 0 && (
                            <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* TAREAS */}
            {activeTab === 'tareas' && (
                <div className="space-y-4">
                    <button onClick={() => setShowNewTask(!showNewTask)} className="w-full bg-turquesa hover:bg-turquesa/90 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-[0.98]">
                        <Plus size={18} /> Asignar Nueva Tarea
                    </button>
                    {showNewTask && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-lg animate-in fade-in duration-200">
                            <input value={newTask.titulo} onChange={e => setNewTask(p => ({ ...p, titulo: e.target.value }))} placeholder="Título de la tarea..." className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm font-bold focus:border-acero outline-none" />
                            <textarea value={newTask.descripcion} onChange={e => setNewTask(p => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción detallada de la tarea..." className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm resize-none h-20 focus:border-acero outline-none" />
                            <input type="date" value={newTask.fechaLimite} onChange={e => setNewTask(p => ({ ...p, fechaLimite: e.target.value }))} className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm focus:border-acero outline-none font-bold text-gray-700" />
                            <div className="flex gap-2">
                                <button onClick={() => setShowNewTask(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm">Cancelar</button>
                                <button onClick={handleCrearTarea} disabled={saving} className="flex-1 bg-acero text-white font-black py-3 rounded-2xl text-sm disabled:opacity-50">{saving ? 'Creando...' : 'Crear Tarea'}</button>
                            </div>
                        </div>
                    )}
                    {tareas.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-3xl border border-gray-100"><ClipboardList size={32} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm font-bold">Sin tareas asignadas</p></div>
                    ) : tareas.map(t => (
                        <div key={t.id} className={`bg-white rounded-2xl border p-4 flex items-start gap-3 shadow-sm ${t.estado === 'completada' ? 'border-emerald-100 bg-emerald-50/10' : 'border-gray-150'}`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.estado === 'completada' ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-600'}`}>
                                {t.estado === 'completada' ? <CheckCircle size={18} /> : <Clock size={18} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-black ${t.estado === 'completada' ? 'text-emerald-700 line-through' : 'text-gray-800'}`}>{t.titulo}</p>
                                {t.descripcion && <p className="text-xs text-gray-500 mt-0.5">{t.descripcion}</p>}
                                {t.completadaEn ? (
                                    <p className="text-[10px] text-emerald-600 font-bold mt-1">Completada el: {new Date(t.completadaEn).toLocaleString('es-MX')}</p>
                                ) : t.fechaLimite ? (
                                    <p className="text-[10px] text-amber-600 font-bold mt-1">Límite: {t.fechaLimite}</p>
                                ) : null}
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full border ${t.estado === 'completada' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-amber-100 border-amber-200 text-amber-700'}`}>{t.estado}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* BITACORAS */}
            {activeTab === 'bitacora' && (
                <div className="space-y-5">
                    {/* Buscador de Fecha */}
                    <div className="bg-white rounded-3xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                        <div>
                            <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Historial de Bitácoras</h3>
                            <p className="text-xs text-gray-400 mt-0.5">Selecciona una fecha para auditar los registros de limpieza</p>
                        </div>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)} 
                            className="p-3 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-700 outline-none focus:border-turquesa bg-gray-50/50"
                        />
                    </div>

                    {/* Grid Premium de Cabinas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {ESPACIOS_CLINICA.map(espacio => {
                            const registro = bitacora.find(b => b.espacioId === espacio.id);
                            const completado = !!registro?.completado;
                            const tareasDetalle = registro?.tareasDetalle || {};
                            const tareasCompletadasCount = Object.keys(tareasDetalle).length;

                            return (
                                <div key={espacio.id} className={`rounded-3xl border p-5 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md ${
                                    completado 
                                    ? 'bg-gradient-to-br from-emerald-50/40 to-emerald-50/10 border-emerald-200/80' 
                                    : 'bg-white border-gray-150'
                                }`}>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
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

                                        {/* Detalle de Tareas para el Admin */}
                                        <div className="space-y-2">
                                            {espacio.tareas.map(tarea => {
                                                const checkTime = tareasDetalle[tarea];
                                                const isChecked = !!checkTime;

                                                return (
                                                    <div 
                                                        key={tarea} 
                                                        className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                                                            isChecked 
                                                            ? 'bg-emerald-50/20 border-emerald-100/30' 
                                                            : 'bg-white border-gray-100'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                                                                isChecked 
                                                                ? 'bg-emerald-500 border-emerald-500 text-white' 
                                                                : 'border-gray-300 text-transparent'
                                                            }`}>
                                                                {isChecked && <CheckCircle size={12} />}
                                                            </div>
                                                            <span className={`text-xs font-bold ${
                                                                isChecked ? 'text-gray-500' : 'text-gray-700'
                                                            }`}>
                                                                {tarea}
                                                            </span>
                                                        </div>
                                                        {isChecked && (
                                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100/50 flex items-center gap-1">
                                                                <Clock size={11} className="text-emerald-500" />
                                                                {checkTime}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Quién lo limpió y notas */}
                                        {tareasCompletadasCount > 0 && (
                                            <div className="pt-3 border-t border-gray-100 text-[10px] text-gray-500 space-y-1">
                                                <p className="font-bold">
                                                    Realizado por: <span className="text-gray-700">{registro.limpiadoPor}</span>
                                                </p>
                                                {registro.hora && (
                                                    <p className="font-bold">Hora primer registro: <span className="text-gray-700">{registro.hora}</span></p>
                                                )}
                                                {registro.notas && (
                                                    <p className="italic mt-1.5 bg-gray-50 p-2.5 rounded-xl border border-gray-150">Nota: "{registro.notas}"</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* SOLICITUDES */}
            {activeTab === 'solicitudes' && (
                <div className="space-y-3">
                    {solicitudes.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-3xl border border-gray-100"><Package size={32} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm font-bold">Sin solicitudes</p></div>
                    ) : solicitudes.map(s => (
                        <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-gray-800">{s.solicitadoPor}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Solicitado el: {s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString('es-MX') : ''}</p>
                                    {s.notas && <p className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-150/40 mt-1">Notas: "{s.notas}"</p>}
                                </div>
                                <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full border ${
                                    s.estado === 'aprobada' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : s.estado === 'rechazada' ? 'bg-red-100 border-red-200 text-red-700' : 'bg-amber-100 border-amber-200 text-amber-700'
                                }`}>{s.estado}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {(s.items || []).map((item, i) => (
                                    <span key={i} className="text-[10px] bg-gray-50 border border-gray-150/55 px-2.5 py-1 rounded-full font-bold text-gray-600">{item.nombre} x{item.cantidad}</span>
                                ))}
                            </div>
                            {s.notasAdmin && <p className="text-[10px] text-acero font-bold bg-acero/5 p-2 rounded-lg">Admin: {s.notasAdmin}</p>}
                            {s.estado === 'pendiente' && (
                                <div className="flex gap-2 pt-1">
                                    <button onClick={() => handleSolicitud(s.id, 'aprobada')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black py-2.5 rounded-xl transition-all shadow-sm active:scale-[0.98]">Aprobar</button>
                                    <button onClick={() => handleSolicitud(s.id, 'rechazada')} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-black py-2.5 rounded-xl transition-all shadow-sm active:scale-[0.98]">Rechazar</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* REPORTES (LIMPIEZA & MANTENIMIENTO) */}
            {activeTab === 'mantenimiento' && (
                <div className="space-y-6">
                    {/* Toggle Sub-tabs */}
                    <div className="bg-white p-1.5 rounded-2xl border border-gray-150 flex gap-1.5 shadow-sm max-w-md mx-auto">
                        <button 
                            onClick={() => setSubTabReportes('limpieza')}
                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                subTabReportes === 'limpieza' 
                                ? 'bg-acero text-white shadow-md' 
                                : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            Historial de Limpieza
                        </button>
                        <button 
                            onClick={() => setSubTabReportes('mantenimiento')}
                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                subTabReportes === 'mantenimiento' 
                                ? 'bg-acero text-white shadow-md' 
                                : 'text-gray-500 hover:text-gray-800'
                            }`}
                        >
                            Reportes Mantenimiento
                        </button>
                    </div>

                    {/* View based on sub-tab */}
                    {subTabReportes === 'limpieza' ? (
                        <div className="space-y-4">
                            {historialLimpieza.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-3xl border border-gray-100">
                                    <Sparkles size={32} className="text-gray-200 mx-auto mb-3" />
                                    <p className="text-gray-400 text-sm font-bold">Sin registros de limpieza aún</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-100">
                                                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Fecha</th>
                                                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Espacio</th>
                                                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Realizado Por</th>
                                                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Hora Cierre</th>
                                                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Tareas</th>
                                                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-wider">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historialLimpieza.map((reg) => {
                                                    const totalTareas = ESPACIOS_CLINICA.find(e => e.id === reg.espacioId)?.tareas.length || 0;
                                                    const completadas = Object.keys(reg.tareasDetalle || {}).length;
                                                    return (
                                                        <tr key={reg.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                            <td className="p-4 text-xs font-bold text-gray-700">
                                                                {reg.fecha.split('-').reverse().join('/')}
                                                            </td>
                                                            <td className="p-4 text-xs font-black text-acero">
                                                                {reg.nombreEspacio}
                                                            </td>
                                                            <td className="p-4 text-xs font-semibold text-gray-600">
                                                                {reg.limpiadoPor}
                                                            </td>
                                                            <td className="p-4 text-xs font-semibold text-gray-500">
                                                                {reg.hora || '--:--'}
                                                            </td>
                                                            <td className="p-4 text-xs font-bold text-gray-600">
                                                                {completadas} / {totalTareas}
                                                            </td>
                                                            <td className="p-4">
                                                                <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                                                                    reg.completado 
                                                                    ? 'bg-emerald-100 border-emerald-200 text-emerald-700' 
                                                                    : 'bg-amber-100 border-amber-200 text-amber-700'
                                                                }`}>
                                                                    {reg.completado ? 'Completo' : 'Incompleto'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {reportes.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-3xl border border-gray-100">
                                    <Wrench size={32} className="text-gray-200 mx-auto mb-3" />
                                    <p className="text-gray-400 text-sm font-bold">Sin reportes de mantenimiento</p>
                                </div>
                            ) : reportes.map(r => (
                                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-sm">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${r.estado === 'resuelto' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                                <Wrench size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-gray-800">{r.descripcion}</p>
                                                <p className="text-[10px] text-gray-400 font-bold mt-0.5">{r.ubicacion} | {r.tipo} | {r.reportadoPor}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full border ${
                                            r.estado === 'resuelto' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : r.estado === 'en_proceso' ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-amber-100 border-amber-200 text-amber-700'
                                        }`}>{r.estado}</span>
                                    </div>
                                    {r.estado === 'pendiente' && (
                                        <div className="flex gap-2 pt-1">
                                            <button onClick={() => handleReporte(r.id, 'en_proceso')} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-black py-2.5 rounded-xl transition-all shadow-sm active:scale-[0.98]">En Proceso</button>
                                            <button onClick={() => handleReporte(r.id, 'resuelto')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black py-2.5 rounded-xl transition-all shadow-sm active:scale-[0.98]">Resuelto</button>
                                        </div>
                                    )}
                                    {r.estado === 'en_proceso' && (
                                        <button onClick={() => handleReporte(r.id, 'resuelto')} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black py-2.5 rounded-xl transition-all shadow-sm active:scale-[0.98]">Marcar Resuelto</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
