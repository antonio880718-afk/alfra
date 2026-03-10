import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User, MessageCircle, Plus, Info, X, CheckCircle, Loader } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import ReciboDigital from '../../components/ui/ReciboDigital';
import { onCitasChange, createCita, updateCitaStatus } from '../../services/citasService';
import { createRecibo } from '../../services/recibosService';
import { onStaffChange } from '../../services/staffService';
import { onPacientesChange } from '../../services/pacientesService';

// Colores dinámicos para especialistas
const COLORS = [
    'bg-turquesa/20 border-turquesa text-turquesa',
    'bg-purple-100 border-purple-500 text-purple-700',
    'bg-acero/20 border-acero text-acero',
    'bg-orange-100 border-orange-500 text-orange-700',
    'bg-green-100 border-green-500 text-green-700',
];

export default function CalendarioCitas() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('dia');
    const [citas, setCitas] = useState([]);
    const [loadingCitas, setLoadingCitas] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isModaling, setIsModaling] = useState(false);

    // Datos reales desde Firestore
    const [especialistas, setEspecialistas] = useState([]);
    const [pacientes, setPacientes] = useState([]);
    const [pacienteFiltro, setPacienteFiltro] = useState('');
    const [showPacienteSuggestions, setShowPacienteSuggestions] = useState(false);

    // Estado para el Recibo
    const [isReciboOpen, setIsReciboOpen] = useState(false);
    const [reciboActual, setReciboActual] = useState(null);

    // Suscripción citas en tiempo real
    useEffect(() => {
        const unsub = onCitasChange((citasFirestore) => {
            const normalized = citasFirestore.map(c => {
                const h = c.fechaHora ? c.fechaHora.substring(11, 16) : c.hora || '09:00';
                let f = new Date();
                try {
                    if (c.fechaHora) f = new Date(c.fechaHora);
                    else if (c.fecha) f = new Date(c.fecha);
                } catch (e) { console.error("Invalid date for cita:", c.id); }
                return {
                    ...c,
                    hora: h,
                    fecha: isNaN(f.getTime()) ? new Date() : f,
                    paciente: c.pacienteNombre || c.paciente || 'Sin nombre',
                };
            });
            setCitas(normalized);
            setLoadingCitas(false);
        });
        return () => unsub();
    }, []);

    // Suscripción especialistas (todo el staff puede ser asignado)
    useEffect(() => {
        const unsub = onStaffChange((staff) => {
            setEspecialistas(staff.map((s, idx) => ({
                ...s,
                color: COLORS[idx % COLORS.length],
            })));
        });
        return () => unsub();
    }, []);


    // Suscripción pacientes
    useEffect(() => {
        const unsub = onPacientesChange((pacs) => {
            setPacientes(pacs);
        });
        return () => unsub();
    }, []);

    // Form State
    const [newCita, setNewCita] = useState({
        pacienteId: '',
        paciente: '',
        telefono: '',
        servicio: '',
        especialistaId: '',
        especialistaNombre: '',
        hora: '09:00',
        duracionMin: 30,
        fecha: new Date().toISOString().split('T')[0],
        notas: '',
    });

    // Cuando cambian los especialistas, setear el primero como default
    useEffect(() => {
        if (especialistas.length > 0 && !newCita.especialistaId) {
            setNewCita(prev => ({
                ...prev,
                especialistaId: especialistas[0].id,
                especialistaNombre: especialistas[0].nombre,
            }));
        }
    }, [especialistas]);

    const pacientesSugeridos = pacientes.filter(p =>
        pacienteFiltro.length > 0 &&
        (p.nombre || '').toLowerCase().includes(pacienteFiltro.toLowerCase())
    ).slice(0, 6);

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Confirmada': return 'border-l-4 border-l-turquesa';
            case 'Pendiente': return 'border-l-4 border-l-yellow-500 opacity-80';
            case 'Completada': return 'border-l-4 border-l-green-500 opacity-60';
            case 'Cancelada': return 'border-l-4 border-l-red-500 line-through opacity-50';
            default: return 'border-l-4 border-l-gray-400';
        }
    };

    const enviarWhatsApp = (e, telefono, nombre, fecha, hora) => {
        e.stopPropagation();
        if (!telefono) { alert('Este paciente no tiene un teléfono registrado.'); return; }
        const f = format(fecha, 'dd/MM/yyyy');
        const mensaje = encodeURIComponent(`Hola ${nombre}, te escribimos de Clínica ALFRA para confirmar tu cita el día ${f} a las ${hora}. ¿Nos confirmas tu asistencia?`);
        window.open(`https://wa.me/${telefono.replace('+', '').replace(/\s/g, '')}?text=${mensaje}`, '_blank');
    };

    const horasDia = Array.from({ length: 11 }, (_, i) => i + 9);

    const handleAgendarSubmit = async (e) => {
        e.preventDefault();
        if (!newCita.paciente) { alert('Selecciona o ingresa un nombre de paciente.'); return; }
        if (!newCita.servicio) { alert('Indica el tratamiento/servicio.'); return; }
        if (!newCita.especialistaId) { alert('Selecciona un especialista.'); return; }
        setSaving(true);
        try {
            const [year, month, day] = newCita.fecha.split('-');
            const fechaBase = new Date(year, month - 1, day);
            const [hh, mm] = newCita.hora.split(':');
            fechaBase.setHours(parseInt(hh), parseInt(mm), 0, 0);

            await createCita({
                pacienteId: newCita.pacienteId || null,
                pacienteNombre: newCita.paciente,
                telefono: newCita.telefono || '',
                especialistaId: newCita.especialistaId,
                especialistaNombre: newCita.especialistaNombre,
                servicio: newCita.servicio,
                fechaHora: fechaBase.toISOString(),
                duracionMin: Number(newCita.duracionMin),
                notas: newCita.notas || '',
            });

            setIsModaling(false);
            setNewCita({
                pacienteId: '', paciente: '', telefono: '', servicio: '',
                especialistaId: especialistas[0]?.id || '',
                especialistaNombre: especialistas[0]?.nombre || '',
                hora: '09:00', duracionMin: 30,
                fecha: new Date().toISOString().split('T')[0], notas: '',
            });
            setPacienteFiltro('');
        } catch (err) {
            console.error(err);
            alert('Error al agendar la cita. Verifica tu conexión.');
        } finally {
            setSaving(false);
        }
    };

    const openSlotModal = (hora, especialistaId) => {
        const esp = especialistas.find(e => e.id === especialistaId);
        setNewCita(prev => ({
            ...prev,
            hora: `${hora < 10 ? '0' + hora : hora}:00`,
            especialistaId,
            especialistaNombre: esp?.nombre || '',
            fecha: format(currentDate, 'yyyy-MM-dd'),
        }));
        setPacienteFiltro('');
        setIsModaling(true);
    };

    const handleCompletarCita = async (idCita) => {
        const citaCompletada = citas.find(c => c.id === idCita);
        if (!citaCompletada) return;
        const montoStr = window.prompt(`Monto cobrado a ${citaCompletada.paciente} por ${citaCompletada.servicio}:`, '0');
        if (montoStr === null) return;
        const monto = parseFloat(montoStr) || 0;
        try {
            await updateCitaStatus(idCita, 'Completada');
            const recibo = await createRecibo({
                pacienteId: citaCompletada.pacienteId || null,
                pacienteNombre: citaCompletada.paciente,
                concepto: citaCompletada.servicio,
                monto,
                metodoPago: 'Efectivo / Tarjeta',
                telefono: citaCompletada.telefono || '',
                citaId: idCita,
            });
            setReciboActual({ ...recibo, fecha: recibo.fechaLegible });
            setIsReciboOpen(true);
        } catch (err) {
            console.error(err);
            alert('Error al completar la cita.');
        }
    };

    const inputCls = "w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-turquesa text-sm bg-gray-50 focus:bg-white transition-all";

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20 relative">
            <ReciboDigital isOpen={isReciboOpen} onClose={() => setIsReciboOpen(false)} datosRecibo={reciboActual} />

            {/* Cabecera */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-acero flex items-center gap-2">
                        <CalendarIcon className="text-turquesa" size={28} />
                        Agenda Maestra de Recepción
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Gestión visual de citas y asignación a especialistas</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-gray-100 p-1 rounded-lg flex">
                        <button onClick={() => setViewMode('dia')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${viewMode === 'dia' ? 'bg-white text-acero shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Día</button>
                        <button onClick={() => setViewMode('semana')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${viewMode === 'semana' ? 'bg-white text-acero shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Semana</button>
                    </div>
                    <Button variant="primary" icon={Plus} onClick={() => { setIsModaling(true); setPacienteFiltro(''); }}>Agendar Cita</Button>
                </div>
            </div>

            <Card className="p-0 overflow-hidden shadow-sm border-gray-200">
                {/* Controles de Calendario */}
                <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                    <Button variant="ghost" className="bg-white border shadow-sm px-3" onClick={() => setCurrentDate(subDays(currentDate, 1))}><ChevronLeft size={20} /></Button>
                    <h3 className="text-xl font-black text-acero capitalize">
                        {format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: es })}
                    </h3>
                    <Button variant="ghost" className="bg-white border shadow-sm px-3" onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight size={20} /></Button>
                </div>

                {/* Sin especialistas cargados */}
                {!loadingCitas && especialistas.length === 0 && (
                    <div className="p-12 text-center text-gray-400">
                        <User size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="font-bold text-lg">No hay especialistas dados de alta</p>
                        <p className="text-sm mt-1">Ve a <b>Nómina</b> y agrega a tus especialistas para que aparezcan aquí.</p>
                    </div>
                )}

                {/* VISTA DE DÍA */}
                {viewMode === 'dia' && especialistas.length > 0 && (
                    <div className="overflow-x-auto">
                        <div style={{ minWidth: `${80 + especialistas.length * 220}px` }}>
                            {/* Cabeceras de Especialistas */}
                            <div className={`grid border-b border-gray-200 bg-white sticky top-0 z-10`}
                                style={{ gridTemplateColumns: `80px repeat(${especialistas.length}, 1fr)` }}>
                                <div className="p-4 border-r border-gray-200 flex items-center justify-center bg-gray-50 text-xs font-bold text-gray-400">HORA</div>
                                {especialistas.map(esp => (
                                    <div key={esp.id} className="p-4 border-r border-gray-200 text-center">
                                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${esp.color}`}>
                                            <User size={12} /> {esp.nombre}
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-1">{esp.puesto}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Grid de Horas */}
                            <div className="bg-gray-50 relative">
                                {horasDia.map((hora) => (
                                    <div key={hora} className={`grid border-b border-gray-200 min-h-[100px] relative group`}
                                        style={{ gridTemplateColumns: `80px repeat(${especialistas.length}, 1fr)` }}>
                                        <div className="border-r border-gray-200 p-2 text-right relative bg-white">
                                            <span className="text-xs font-bold text-gray-500 absolute -top-2.5 right-2 bg-white px-1">{hora}:00</span>
                                        </div>
                                        {especialistas.map(esp => {
                                            const citasHora = citas.filter(c =>
                                                c.especialistaId === esp.id &&
                                                parseInt(c.hora.split(':')[0]) === hora &&
                                                c.fecha.toDateString() === currentDate.toDateString()
                                            );
                                            return (
                                                <div key={`${esp.id}-${hora}`} className="border-r border-dashed border-gray-200 p-1 relative cursor-pointer hover:bg-turquesa/5 transition-colors" onClick={() => openSlotModal(hora, esp.id)}>
                                                    {citasHora.length === 0 && (
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="bg-turquesa text-white rounded-full p-1"><Plus size={16} /></span>
                                                        </div>
                                                    )}
                                                    {citasHora.map(cita => (
                                                        <div key={cita.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (cita.status !== 'Completada') {
                                                                    if (window.confirm(`¿Completar cita de ${cita.paciente}?`)) handleCompletarCita(cita.id);
                                                                }
                                                            }}
                                                            className={`absolute left-1 right-1 bg-white border border-gray-200 shadow-sm rounded-lg p-2 z-10 hover:shadow-md transition-shadow cursor-pointer group/cita ${getStatusStyle(cita.status)}`}
                                                            style={{
                                                                top: `${((parseInt(cita.hora?.split(':')[1]) || 0) / 60) * 100}%`,
                                                                height: `${((cita.duracionMin || 30) / 60) * 100}%`,
                                                                minHeight: '40px'
                                                            }}>
                                                            <div className="flex justify-between items-start">
                                                                <span className="font-bold text-xs text-gray-800 truncate block w-full">{cita.paciente}</span>
                                                                <div className="flex gap-1">
                                                                    {cita.status !== 'Completada' && (
                                                                        <button className="text-acero/50 hover:text-acero bg-gray-50 rounded-full p-1 opacity-0 group-hover/cita:opacity-100 transition-opacity" title="Completar y Cobrar">
                                                                            <CheckCircle size={12} />
                                                                        </button>
                                                                    )}
                                                                    {cita.status === 'Pendiente' && (
                                                                        <button onClick={(e) => enviarWhatsApp(e, cita.telefono, cita.paciente, currentDate, cita.hora)} className="text-green-500 hover:text-green-600 bg-green-50 rounded-full p-1">
                                                                            <MessageCircle size={12} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-[10px] text-gray-500 mt-0.5 truncate">{cita.servicio}</div>
                                                            <div className="text-[10px] text-acero font-semibold mt-0.5">{cita.hora} ({cita.duracionMin}m)</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'semana' && (
                    <div className="p-8 text-center text-gray-500 bg-gray-50 min-h-[400px] flex flex-col items-center justify-center">
                        <CalendarIcon size={48} className="text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-700">Vista Semanal en Construcción</h3>
                        <Button variant="outline" className="mt-4" onClick={() => setViewMode('dia')}>Volver a Vista Diaria</Button>
                    </div>
                )}
            </Card>

            {/* MODAL CREAR CITA */}
            {isModaling && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4" onClick={() => setIsModaling(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-acero p-5 flex justify-between items-center text-white">
                            <h3 className="font-black text-lg flex items-center gap-2"><CalendarIcon size={20} /> Nueva Cita</h3>
                            <button onClick={() => setIsModaling(false)} className="text-white/60 hover:text-white transition-colors"><X size={22} /></button>
                        </div>
                        <form onSubmit={handleAgendarSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

                            {/* Selector de Paciente */}
                            <div className="relative">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Paciente *</label>
                                <input
                                    type="text"
                                    placeholder="Buscar paciente registrado o escribir nombre..."
                                    value={pacienteFiltro || newCita.paciente}
                                    onChange={e => {
                                        setPacienteFiltro(e.target.value);
                                        setNewCita(prev => ({ ...prev, paciente: e.target.value, pacienteId: '' }));
                                        setShowPacienteSuggestions(true);
                                    }}
                                    onFocus={() => setShowPacienteSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowPacienteSuggestions(false), 200)}
                                    className={inputCls}
                                />
                                {showPacienteSuggestions && pacientesSugeridos.length > 0 && (
                                    <div className="absolute z-30 w-full bg-white border border-gray-200 rounded-xl shadow-xl top-full mt-1 overflow-hidden">
                                        {pacientesSugeridos.map(p => (
                                            <button
                                                type="button"
                                                key={p.id}
                                                className="w-full text-left px-4 py-3 hover:bg-turquesa/5 border-b border-gray-50 flex items-center gap-3 transition-colors"
                                                onMouseDown={() => {
                                                    setNewCita(prev => ({
                                                        ...prev,
                                                        pacienteId: p.id,
                                                        paciente: p.nombre,
                                                        telefono: p.telefono || prev.telefono,
                                                    }));
                                                    setPacienteFiltro('');
                                                    setShowPacienteSuggestions(false);
                                                }}
                                            >
                                                <div className="w-8 h-8 rounded-full bg-turquesa/10 text-turquesa font-black flex items-center justify-center text-sm shrink-0">
                                                    {(p.nombre || '?')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-800">{p.nombre}</p>
                                                    <p className="text-xs text-gray-400">{p.telefono}</p>
                                                </div>
                                            </button>
                                        ))}
                                        <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 italic">
                                            También puedes ingresar un nombre nuevo sin registro
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Teléfono */}
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Teléfono WhatsApp</label>
                                <input type="tel" placeholder="+52 55... (opcional)" value={newCita.telefono} onChange={e => setNewCita({ ...newCita, telefono: e.target.value })} className={inputCls} />
                            </div>

                            {/* Especialista REAL desde Firestore */}
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Especialista *</label>
                                {especialistas.length === 0 ? (
                                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-700 font-medium">
                                        No hay especialistas dados de alta. Ve a Nómina para agregarlos.
                                    </div>
                                ) : (
                                    <select
                                        className={inputCls}
                                        value={newCita.especialistaId}
                                        onChange={e => {
                                            const esp = especialistas.find(es => es.id === e.target.value);
                                            setNewCita({ ...newCita, especialistaId: e.target.value, especialistaNombre: esp?.nombre || '' });
                                        }}
                                        required
                                    >
                                        <option value="">— Seleccionar Especialista —</option>
                                        {especialistas.map(esp => (
                                            <option key={esp.id} value={esp.id}>{esp.nombre} ({esp.puesto})</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Servicio */}
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Tratamiento / Servicio *</label>
                                <input type="text" placeholder="Ej. Limpieza Facial, Botox, Lipoescultura..." value={newCita.servicio} onChange={e => setNewCita({ ...newCita, servicio: e.target.value })} className={inputCls} required />
                            </div>

                            {/* Fecha y Hora */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Fecha *</label>
                                    <input type="date" required value={newCita.fecha} onChange={e => setNewCita({ ...newCita, fecha: e.target.value })} className={inputCls} />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Hora *</label>
                                    <input type="time" required value={newCita.hora} onChange={e => setNewCita({ ...newCita, hora: e.target.value })} className={inputCls} />
                                </div>
                            </div>

                            {/* Duración */}
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Duración</label>
                                <select className={inputCls} value={newCita.duracionMin} onChange={e => setNewCita({ ...newCita, duracionMin: parseInt(e.target.value) })}>
                                    <option value="30">30 minutos</option>
                                    <option value="45">45 minutos</option>
                                    <option value="60">1 hora</option>
                                    <option value="90">1.5 horas</option>
                                    <option value="120">2 horas</option>
                                </select>
                            </div>

                            {/* Notas */}
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Notas Especiales</label>
                                <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Alergias, indicaciones especiales..." value={newCita.notas} onChange={e => setNewCita({ ...newCita, notas: e.target.value })} />
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <Button variant="ghost" className="flex-1" type="button" onClick={() => setIsModaling(false)}>Cancelar</Button>
                                <Button variant="primary" className="flex-1" type="submit" disabled={saving || especialistas.length === 0}>
                                    {saving ? <><Loader size={14} className="animate-spin mr-2" />Guardando...</> : 'Confirmar Cita'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
