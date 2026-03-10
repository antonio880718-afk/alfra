import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Calendar as CalendarIcon, User, PlusCircle, Edit, XCircle, CheckCircle, History, Loader, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { onCitasChange, updateCitaStatus, createCita } from '../../services/citasService';
import { onStaffChange } from '../../services/staffService';
import { onPacientesChange } from '../../services/pacientesService';

export default function SupervisionAgenda() {
    const [citas, setCitas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCita, setEditingCita] = useState(null);

    // Datos reales desde Firestore
    const [staff, setStaff] = useState([]);
    const [pacientes, setPacientes] = useState([]);

    // Autocomplete paciente
    const [pacienteFiltro, setPacienteFiltro] = useState('');
    const [showSugg, setShowSugg] = useState(false);

    const [form, setForm] = useState({
        pacienteId: '',
        pacienteNombre: '',
        telefono: '',
        especialistaId: '',
        especialistaNombre: '',
        servicio: '',
        fecha: new Date().toISOString().split('T')[0],
        hora: '09:00',
        duracionMin: 30,
        notas: '',
    });

    // Suscripciones en tiempo real
    useEffect(() => {
        const unsub = onCitasChange((citasFirestore) => {
            const normalized = citasFirestore.map(c => ({
                ...c,
                paciente: c.pacienteNombre || c.paciente || 'Sin nombre',
                especialista: c.especialistaNombre || c.especialistaId || '---',
                fecha: c.fechaHora ? c.fechaHora.substring(0, 10) : c.fecha || '---',
                horaFormateada: c.fechaHora ? format(new Date(c.fechaHora), 'hh:mm a') : c.hora || '---',
                log: c.log || 'Registrado en sistema',
            }));
            setCitas(normalized);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onStaffChange(setStaff);
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onPacientesChange(setPacientes);
        return () => unsub();
    }, []);

    const pacientesFiltrados = pacientes.filter(p =>
        pacienteFiltro.length > 0 &&
        (p.nombre || '').toLowerCase().includes(pacienteFiltro.toLowerCase())
    ).slice(0, 6);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Confirmada': return <Badge variant="turquesa">Confirmada</Badge>;
            case 'Pendiente': return <Badge variant="yellow">Pendiente</Badge>;
            case 'Completada': return <Badge variant="green">Completada</Badge>;
            case 'Cancelada': return <Badge variant="red">Cancelada</Badge>;
            default: return <Badge variant="gray">{status}</Badge>;
        }
    };

    const handleOpenModal = (cita = null) => {
        setEditingCita(cita);
        if (cita) {
            setForm({
                pacienteId: cita.pacienteId || '',
                pacienteNombre: cita.paciente || '',
                telefono: cita.telefono || '',
                especialistaId: cita.especialistaId || '',
                especialistaNombre: cita.especialista || '',
                servicio: cita.servicio || '',
                fecha: cita.fecha || new Date().toISOString().split('T')[0],
                hora: cita.hora || '09:00',
                duracionMin: cita.duracionMin || 30,
                notas: cita.notas || '',
            });
            setPacienteFiltro('');
        } else {
            setForm({
                pacienteId: '', pacienteNombre: '', telefono: '',
                especialistaId: staff[0]?.id || '', especialistaNombre: staff[0]?.nombre || '',
                servicio: '', fecha: new Date().toISOString().split('T')[0],
                hora: '09:00', duracionMin: 30, notas: '',
            });
            setPacienteFiltro('');
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.pacienteNombre) { alert('Ingresa el nombre del paciente.'); return; }
        if (!form.especialistaId) { alert('Selecciona un especialista.'); return; }
        if (!form.servicio) { alert('Indica el servicio.'); return; }
        setSaving(true);
        try {
            const [year, month, day] = form.fecha.split('-');
            const fechaBase = new Date(year, month - 1, day);
            const [hh, mm] = form.hora.split(':');
            fechaBase.setHours(parseInt(hh), parseInt(mm), 0, 0);

            await createCita({
                pacienteId: form.pacienteId || null,
                pacienteNombre: form.pacienteNombre,
                telefono: form.telefono || '',
                especialistaId: form.especialistaId,
                especialistaNombre: form.especialistaNombre,
                servicio: form.servicio,
                fechaHora: fechaBase.toISOString(),
                duracionMin: Number(form.duracionMin),
                notas: form.notas || '',
            });
            setIsModalOpen(false);
        } catch (err) {
            console.error(err);
            alert('Error al guardar la cita.');
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            await updateCitaStatus(id, newStatus);
        } catch (err) {
            console.error(err);
            alert('Error al cambiar el estado.');
        }
    };

    const inputCls = "w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-turquesa text-sm bg-gray-50 focus:bg-white transition-all";

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-acero">Supervisión de Agenda</h2>
                    <p className="text-gray-500 text-sm">Control absoluto de citas: agendar, reagendar, cancelar y completar</p>
                </div>
                <Button variant="primary" icon={PlusCircle} onClick={() => handleOpenModal()}>Agendar Nueva Cita</Button>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-gray-400 gap-3">
                            <Loader className="animate-spin" size={20} /> Cargando citas...
                        </div>
                    ) : citas.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <CalendarIcon size={48} className="mx-auto mb-3 opacity-30" />
                            <p className="font-bold">No hay citas registradas aún</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 text-sm text-gray-500 bg-gray-50/50">
                                    <th className="py-3 px-4 font-medium">Paciente / Fecha</th>
                                    <th className="py-3 px-4 font-medium">Especialista / Servicio</th>
                                    <th className="py-3 px-4 font-medium">Estado</th>
                                    <th className="py-3 px-4 font-medium text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {citas.map((cita) => (
                                    <tr key={cita.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                                        <td className="py-4 px-4 font-medium text-gray-900">
                                            <div className="flex flex-col">
                                                <span>{cita.paciente}</span>
                                                <span className="text-xs text-gray-500 font-normal flex items-center gap-1 mt-1">
                                                    <CalendarIcon size={12} /> {cita.fecha} • {cita.horaFormateada}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-gray-600 text-sm">
                                            <div className="flex flex-col">
                                                <span className="font-medium">{cita.especialista}</span>
                                                <span className="text-xs text-gray-400 mt-1">{cita.servicio}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex flex-col items-start gap-1">
                                                {getStatusBadge(cita.status)}
                                                <span className="text-[10px] text-gray-400 italic flex items-center gap-1 mt-1">
                                                    <History size={10} /> {cita.log}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenModal(cita)} title="Reagendar/Editar" />
                                                {cita.status !== 'Completada' && cita.status !== 'Cancelada' && (
                                                    <>
                                                        <Button variant="ghost" size="sm" className="text-green-600 hover:bg-green-50" icon={CheckCircle} onClick={() => handleStatusChange(cita.id, 'Completada')} title="Completar" />
                                                        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" icon={XCircle} onClick={() => handleStatusChange(cita.id, 'Cancelada')} title="Cancelar" />
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-acero p-5 flex justify-between items-center text-white">
                            <h3 className="font-black text-lg flex items-center gap-2">
                                <CalendarIcon size={20} />
                                {editingCita ? 'Reagendar / Editar Cita' : 'Agendar Nueva Cita (Admin)'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-white/60 hover:text-white"><X size={22} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

                            {/* Paciente con autocompletado */}
                            {!editingCita && (
                                <div className="relative">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Paciente *</label>
                                    <input
                                        type="text"
                                        placeholder="Buscar paciente registrado o escribir nombre..."
                                        value={pacienteFiltro || form.pacienteNombre}
                                        onChange={e => {
                                            setPacienteFiltro(e.target.value);
                                            setForm(prev => ({ ...prev, pacienteNombre: e.target.value, pacienteId: '' }));
                                            setShowSugg(true);
                                        }}
                                        onFocus={() => setShowSugg(true)}
                                        onBlur={() => setTimeout(() => setShowSugg(false), 200)}
                                        className={inputCls}
                                    />
                                    {showSugg && pacientesFiltrados.length > 0 && (
                                        <div className="absolute z-30 w-full bg-white border border-gray-200 rounded-xl shadow-xl top-full mt-1 overflow-hidden">
                                            {pacientesFiltrados.map(p => (
                                                <button
                                                    type="button"
                                                    key={p.id}
                                                    className="w-full text-left px-4 py-3 hover:bg-turquesa/5 border-b border-gray-50 flex items-center gap-3 transition-colors"
                                                    onMouseDown={() => {
                                                        setForm(prev => ({ ...prev, pacienteId: p.id, pacienteNombre: p.nombre, telefono: p.telefono || prev.telefono }));
                                                        setPacienteFiltro('');
                                                        setShowSugg(false);
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
                                            <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50 italic">También puedes escribir un nombre sin registro</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            {editingCita && (
                                <div>
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Paciente</label>
                                    <input className={`${inputCls} bg-gray-100 cursor-not-allowed`} value={form.pacienteNombre} disabled />
                                </div>
                            )}

                            {/* Especialista dropdown REAL */}
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Especialista *</label>
                                {staff.length === 0 ? (
                                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs text-yellow-700">
                                        No hay personal dado de alta. Ve a Nómina para agregarlos.
                                    </div>
                                ) : (
                                    <select
                                        className={inputCls}
                                        value={form.especialistaId}
                                        onChange={e => {
                                            const s = staff.find(s => s.id === e.target.value);
                                            setForm(prev => ({ ...prev, especialistaId: e.target.value, especialistaNombre: s?.nombre || '' }));
                                        }}
                                        required
                                    >
                                        <option value="">— Seleccionar —</option>
                                        {staff.map(s => (
                                            <option key={s.id} value={s.id}>{s.nombre} ({s.puesto})</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Servicio */}
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Tratamiento / Servicio *</label>
                                <input type="text" placeholder="Ej. Limpieza Facial, Botox..." value={form.servicio} onChange={e => setForm(prev => ({ ...prev, servicio: e.target.value }))} className={inputCls} required />
                            </div>

                            {/* Fecha y Hora */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Fecha *</label>
                                    <input type="date" required value={form.fecha} onChange={e => setForm(prev => ({ ...prev, fecha: e.target.value }))} className={inputCls} />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Hora *</label>
                                    <input type="time" required value={form.hora} onChange={e => setForm(prev => ({ ...prev, hora: e.target.value }))} className={inputCls} />
                                </div>
                            </div>

                            {/* Duración */}
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Duración</label>
                                <select className={inputCls} value={form.duracionMin} onChange={e => setForm(prev => ({ ...prev, duracionMin: parseInt(e.target.value) }))}>
                                    <option value="30">30 minutos</option>
                                    <option value="45">45 minutos</option>
                                    <option value="60">1 hora</option>
                                    <option value="90">1.5 horas</option>
                                    <option value="120">2 horas</option>
                                </select>
                            </div>

                            {editingCita && (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                                    <p className="text-xs text-yellow-800 font-medium">Modificar esta cita registrará tu nombre en el log de auditoría.</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <Button variant="ghost" className="flex-1" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                                <Button variant="primary" className="flex-1" type="submit" disabled={saving || staff.length === 0}>
                                    {saving ? <><Loader size={14} className="animate-spin mr-2" />Guardando...</> : 'Guardar Cita'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
