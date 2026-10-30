import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import {
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User,
    MessageCircle, Plus, Info, X, CheckCircle, Loader, Bell, Search,
    History, Edit, DollarSign, Zap
} from 'lucide-react';
import { format, addDays, subDays, startOfDay, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { onCitasChange, createCita } from '../../services/citasService';
import { onStaffChange } from '../../services/staffService';
import { onPacientesChange } from '../../services/pacientesService';
import { onServiciosChange } from '../../services/comercialService';

export default function LaboratorioAgendaInteligente() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [citas, setCitas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModaling, setIsModaling] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Catalogos
    const [especialistas, setEspecialistas] = useState([]);
    const [pacientes, setPacientes] = useState([]);
    const [servicios, setServicios] = useState([]);
    const [pacienteFiltro, setPacienteFiltro] = useState('');
    const [showPacienteSuggestions, setShowPacienteSuggestions] = useState(false);
    
    // Form State
    const [newCita, setNewCita] = useState({
        pacienteId: '', paciente: '', telefono: '', servicio: '',
        especialistaId: '', especialistaNombre: '', hora: '09:00',
        duracionMin: 30, fecha: new Date().toISOString().split('T')[0], 
        precioProyectado: '', pagado: false, notas: ''
    });

    useEffect(() => {
        const unsubCitas = onCitasChange((data) => {
            const savedProyecciones = JSON.parse(localStorage.getItem('alfra_lab_prices') || '{}');
            setCitas(data.map(c => ({
                ...c,
                precioProyectado: savedProyecciones[c.id]?.precio || 0,
                pagado: savedProyecciones[c.id]?.pagado || false
            })));
            setLoading(false);
        });
        const unsubStaff = onStaffChange(setEspecialistas);
        const unsubPac = onPacientesChange(setPacientes);
        const unsubServ = onServiciosChange(setServicios);
        
        return () => { unsubCitas(); unsubStaff(); unsubPac(); unsubServ(); };
    }, []);

    const handleSelectService = (nombre) => {
        const found = servicios.find(s => s.nombre === nombre);
        setNewCita(prev => ({
            ...prev,
            servicio: nombre,
            precioProyectado: found ? found.precio : prev.precioProyectado
        }));
    };

    const handleSaveSimulatedPrice = (citaId, precio, pagado) => {
        const saved = JSON.parse(localStorage.getItem('alfra_lab_prices') || '{}');
        saved[citaId] = { precio, pagado };
        localStorage.setItem('alfra_lab_prices', JSON.stringify(saved));
        setCitas(prev => prev.map(c => c.id === citaId ? { ...c, precioProyectado: precio, pagado } : c));
    };

    const handleAgendarSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // En modo laboratorio, creamos la cita real pero guardamos el precio en localStorage
            const res = await createCita({
                pacienteNombre: newCita.paciente,
                especialistaId: newCita.especialistaId,
                especialistaNombre: newCita.especialistaNombre,
                servicio: newCita.servicio,
                fechaHora: `${newCita.fecha}T${newCita.hora}:00`,
                duracionMin: newCita.duracionMin,
                notas: `[LAB] ${newCita.notas}`
            });

            if (res?.id) {
                handleSaveSimulatedPrice(res.id, newCita.precioProyectado, newCita.pagado);
            }
            
            setIsModaling(false);
            setNewCita({
                pacienteId: '', paciente: '', telefono: '', servicio: '',
                especialistaId: especialistas[0]?.id || '', especialistaNombre: especialistas[0]?.nombre || '',
                hora: '09:00', duracionMin: 30, fecha: new Date().toISOString().split('T')[0], 
                precioProyectado: '', pagado: false, notas: ''
            });
        } catch (err) {
            console.error(err);
            alert('Error al simular cita');
        } finally {
            setSaving(false);
        }
    };

    const citasDelDia = useMemo(() => {
        const currentYMD = format(currentDate, 'yyyy-MM-dd');
        return citas.filter(c => {
            const dateStr = c.fechaHora ? c.fechaHora.split('T')[0] : c.fecha;
            return dateStr === currentYMD;
        });
    }, [citas, currentDate]);

    const proyeccionDia = useMemo(() => {
        return citasDelDia.reduce((acc, c) => acc + (Number(c.precioProyectado) || 0), 0);
    }, [citasDelDia]);

    const pacientesSugeridos = useMemo(() => {
        return pacientes.filter(p =>
            pacienteFiltro.length > 0 &&
            (p.nombre || '').toLowerCase().includes(pacienteFiltro.toLowerCase())
        ).slice(0, 6);
    }, [pacientes, pacienteFiltro]);

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-32 px-6">
            
            {/* ALERT LOCALHOST */}
            <div className="bg-turquesa p-8 rounded-[3rem] flex items-center justify-between shadow-2xl mt-8 text-acero">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-white/20 rounded-3xl backdrop-blur-md"><Zap size={32} /></div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">Laboratorio de Ingresos</h1>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Probando precios y proyecciones en vivo</p>
                    </div>
                </div>
                <div className="flex gap-8">
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase opacity-60">Proyectado Hoy</p>
                        <p className="text-3xl font-black">${proyeccionDia.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* NAVEGACIÓN Y ACCIÓN */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 bg-white p-3 rounded-[2rem] shadow-sm border border-gray-100">
                    <button onClick={() => setCurrentDate(subDays(currentDate, 1))} className="w-12 h-12 flex items-center justify-center hover:bg-gray-50 rounded-2xl transition-all"><ChevronLeft /></button>
                    <h2 className="font-black text-acero uppercase tracking-widest text-sm px-4">{format(currentDate, "EEEE d 'MMMM'", { locale: es })}</h2>
                    <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="w-12 h-12 flex items-center justify-center hover:bg-gray-50 rounded-2xl transition-all"><ChevronRight /></button>
                </div>

                <Button 
                    onClick={() => setIsModaling(true)}
                    className="h-14 px-10 rounded-[1.5rem] bg-acero text-white font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-3"
                >
                    <Plus size={20} /> Agendar con Precio
                </Button>
            </div>

            {/* LISTA DE CITAS */}
            <section className="space-y-4">
                {citasDelDia.length === 0 ? (
                    <div className="py-20 text-center text-gray-300">
                        <CalendarIcon size={64} className="mx-auto mb-4 opacity-10" />
                        <p className="font-black uppercase tracking-widest text-sm">Sin citas para proyectar hoy</p>
                    </div>
                ) : citasDelDia.map(cita => (
                    <Card key={cita.id} className="p-8 rounded-[2.5rem] bg-white border-none shadow-lg flex items-center justify-between hover:shadow-xl transition-all">
                        <div className="flex items-center gap-8">
                            <div className="flex flex-col items-center justify-center bg-gray-50 rounded-3xl w-20 h-20 shrink-0">
                                <Clock size={20} className="text-turquesa mb-1" />
                                <span className="text-[10px] font-black text-acero">{cita.hora || '09:00'}</span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-acero uppercase leading-none mb-1">{cita.paciente || cita.pacienteNombre}</h3>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Badge variant="outline" className="text-[9px] border-turquesa/20 text-turquesa capitalize">{cita.servicio}</Badge>
                                    <span>{cita.especialista || cita.especialistaNombre}</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-10">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Impacto Financiero</p>
                                <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-2xl">
                                    <span className="font-black text-acero text-lg">${Number(cita.precioProyectado).toLocaleString()}</span>
                                    {cita.pagado ? (
                                        <Badge className="bg-emerald-500 text-white border-none font-black text-[8px] tracking-widest">PAGADO</Badge>
                                    ) : (
                                        <Badge className="bg-amber-500 text-white border-none font-black text-[8px] tracking-widest">PENDIENTE</Badge>
                                    )}
                                </div>
                            </div>
                            <div className={`px-4 py-2 rounded-xl border font-black text-[9px] uppercase tracking-widest ${
                                cita.status === 'Completada' ? 'bg-emerald-50 border-emerald-100 text-emerald-500' : 'bg-white border-gray-100 text-gray-400'
                            }`}>
                                {cita.status}
                            </div>
                        </div>
                    </Card>
                ))}
            </section>

            {/* MODAL INTEGRADO (COMO LA IMAGEN) */}
            {isModaling && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-acero/70 backdrop-blur-xl p-4 animate-in fade-in" onClick={() => setIsModaling(false)}>
                    <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-acero p-10 flex justify-between items-center text-white">
                            <div>
                                <h3 className="font-black text-3xl">Nueva Cita</h3>
                                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-1">Auditoría y Supervisión Admin</p>
                            </div>
                            <button onClick={() => setIsModaling(false)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X size={24} /></button>
                        </div>
                        
                        <form onSubmit={handleAgendarSubmit} className="p-12 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar-agenda">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Paciente Registrado o Nuevo *</label>
                                    <div className="relative">
                                        <input type="text" placeholder="Buscar paciente o escribir nombre..." value={pacienteFiltro || newCita.paciente} onChange={e => { setPacienteFiltro(e.target.value); setNewCita(prev => ({ ...prev, paciente: e.target.value })); setShowPacienteSuggestions(true); }} onFocus={() => setShowPacienteSuggestions(true)} onBlur={() => setTimeout(() => setShowPacienteSuggestions(false), 200)} className="w-full h-16 pl-12 pr-6 bg-gray-50 border-none rounded-[1.2rem] outline-none focus:bg-white focus:ring-2 focus:ring-turquesa/20 transition-all font-bold text-acero text-lg" required />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-turquesa/40"><Search size={22} /></div>
                                        {showPacienteSuggestions && pacientesSugeridos.length > 0 && (
                                            <div className="absolute z-50 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl top-full mt-2 overflow-hidden">
                                                {pacientesSugeridos.map(p => (
                                                    <button key={p.id} type="button" className="w-full text-left px-6 py-4 hover:bg-turquesa/5 flex items-center gap-4 border-b border-gray-50 last:border-0" onMouseDown={() => { setNewCita(prev => ({ ...prev, pacienteId: p.id, paciente: p.nombre, telefono: p.telefono || prev.telefono })); setPacienteFiltro(''); setShowPacienteSuggestions(false); }}>
                                                        <span className="font-black text-acero">{p.nombre}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Especialista *</label>
                                    <select className="w-full h-16 px-4 bg-gray-50 border-none rounded-[1.2rem] outline-none focus:bg-white focus:ring-2 focus:ring-turquesa/20 font-bold" value={newCita.especialistaId} onChange={e => { const s = especialistas.find(es => es.id === e.target.value); setNewCita({ ...newCita, especialistaId: e.target.value, especialistaNombre: s?.nombre || '' }); }} required>
                                        <option value="">Seleccionar Médico</option>
                                        {especialistas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Servicio *</label>
                                    <div className="relative">
                                        <input list="lab-servicios" type="text" placeholder="Tratamiento..." value={newCita.servicio} onChange={e => handleSelectService(e.target.value)} className="w-full h-16 px-4 bg-gray-50 border-none rounded-[1.2rem] outline-none focus:bg-white focus:ring-2 focus:ring-turquesa/20 font-bold" required />
                                        <datalist id="lab-servicios">
                                            {servicios.map(s => <option key={s.id} value={s.nombre}>{formatCurrency(s.precio)}</option>)}
                                        </datalist>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha *</label>
                                    <input type="date" value={newCita.fecha} onChange={e => setNewCita({ ...newCita, fecha: e.target.value })} className="w-full h-16 px-4 bg-gray-50 border-none rounded-[1.2rem] font-bold" />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hora *</label>
                                    <input type="time" value={newCita.hora} onChange={e => setNewCita({ ...newCita, hora: e.target.value })} className="w-full h-16 px-4 bg-gray-50 border-none rounded-[1.2rem] font-bold" />
                                </div>

                                {/* CAMPOS DE LABORATORIO DE PRECIOS */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-turquesa uppercase tracking-widest flex items-center gap-2">
                                        <DollarSign size={12} /> Monto a Cobrar *
                                    </label>
                                    <input type="number" placeholder="Ej. 1500" value={newCita.precioProyectado} onChange={e => setNewCita({ ...newCita, precioProyectado: e.target.value })} className="w-full h-16 px-4 bg-turquesa/5 border-2 border-turquesa/20 rounded-[1.2rem] font-black text-acero text-xl outline-none focus:bg-white transition-all shadow-inner" />
                                </div>

                                <div className="flex items-center justify-between bg-gray-50 p-6 rounded-[1.2rem]">
                                    <div>
                                        <p className="text-[10px] font-black text-acero uppercase tracking-widest">Estado de Pago</p>
                                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">¿Marcar como liquidado ahora?</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setNewCita(prev => ({ ...prev, pagado: !prev.pagado }))}
                                        className={`w-14 h-8 rounded-full transition-all relative ${newCita.pagado ? 'bg-emerald-500' : 'bg-gray-200'}`}
                                    >
                                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${newCita.pagado ? 'left-7' : 'left-1 shadow-sm'}`} />
                                    </button>
                                </div>
                            </div>

                            <div className="pt-8">
                                <Button variant="primary" type="submit" className="w-full h-20 rounded-[1.5rem] bg-turquesa text-acero font-black uppercase text-sm shadow-2xl shadow-turquesa/20" disabled={saving}>
                                    {saving ? 'Guardando...' : 'Confirmar Cita y Proyección'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const formatCurrency = (val) => `$${Number(val).toLocaleString('es-MX')}`;
