import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Users as UsersIcon, Search, UserCog, CheckCircle, UserPlus, Trash2, Stamp, Gift, Calendar, Clock, History, X, ChevronDown, Receipt, DollarSign, Download, CreditCard, Sparkles, FileText } from 'lucide-react';
import ReciboDigital from '../../components/ui/ReciboDigital';
import { getRecibosPaciente } from '../../services/recibosService';
import { getDocs, query, collection, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { onPacientesChange, updatePaciente, createPaciente, deletePaciente, updateAllPacientesLealtad, activarMembresia, recargarHorasMembresia, solicitarEliminacionPaciente, resetAllSellos } from '../../services/pacientesService';
import { sellarVisita, canjearRecompensa } from '../../services/lealtadService';
import { onStaffChange } from '../../services/staffService';
import { createCita } from '../../services/citasService';
import { useAuth } from '../../contexts/AuthContext';
import { KeyRound, Mail } from 'lucide-react';

const TIPOS = ['Por definir', 'Facial', 'Corporal', 'Mixto'];
const ESTADOS = ['Activo', 'En pausa', 'Alta médica', 'Prospecto'];
const CANALES_ORIGEN = ['Facebook', 'Instagram', 'TikTok', 'Google / Maps', 'Recomendación de un paciente', 'Volante / Publicidad impresa', 'Pasaba por aquí', 'WhatsApp', 'Otro'];

const emptyNuevo = {
    nombre: '',
    telefono: '',
    email: '',
    fechaNacimiento: '',
    comoNosConocio: '',
    tipoTratamiento: 'Por definir',
    estado: 'Activo',
    observaciones: '',
    ahorroMeta: 0,
    ahorroActual: 0,
    nombreTratamientoAhorro: '',
};

export default function AdminPacientes() {
    const { userRole } = useAuth();
    const navigate = useNavigate();
    const [motivoEliminacion, setMotivoEliminacion] = useState('');
    const [pacientes, setPacientes] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const { resetPassword } = useAuth();
    const [resetting, setResetting] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);

    const [modalNuevo, setModalNuevo] = useState(false);
    const [formNuevo, setFormNuevo] = useState(emptyNuevo);
    const [savingNuevo, setSavingNuevo] = useState(false);
    const [exitoNuevo, setExitoNuevo] = useState(false);
    const [pacientesError, setPacientesError] = useState(null);

    const [pacienteToDelete, setPacienteToDelete] = useState(null);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [exitoAsignacion, setExitoAsignacion] = useState(false);

    // ── Historial de Citas y Pagos ───────────────────────────────
    const [historialModal, setHistorialModal] = useState(false);
    const [historialPaciente, setHistorialPaciente] = useState(null);
    const [historialCitas, setHistorialCitas] = useState([]);
    const [historialPagos, setHistorialPagos] = useState([]);
    const [historialPlanes, setHistorialPlanes] = useState([]);
    const [historialTab, setHistorialTab] = useState('citas');
    const [loadingHistorial, setLoadingHistorial] = useState(false);
    const [reciboVisualizar, setReciboVisualizar] = useState(null);

    const abrirHistorial = async (paciente, e, initialTab = 'citas') => {
        e?.stopPropagation();
        setHistorialPaciente(paciente);
        setHistorialCitas([]);
        setHistorialPagos([]);
        setHistorialPlanes([]);
        setHistorialTab(initialTab);
        setHistorialModal(true);
        setLoadingHistorial(true);
        try {
            const citasPromise = (async () => {
                const snap = await getDocs(
                    query(collection(db, 'citas'), where('pacienteId', '==', paciente.id))
                );
                return snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => new Date(b.fechaHora || b.fecha || 0) - new Date(a.fechaHora || a.fecha || 0));
            })();

            // CRUCIAL: Se envía paciente.nombre para detectar abonos a planes de tratamiento históricos o futuros
            const pagosPromise = getRecibosPaciente(paciente.id, paciente.uid, paciente.nombre);

            // Consultar planes de tratamiento vinculados por ID y por nombre del paciente (con variantes de whitespace)
            const planesPromise = (async () => {
                try {
                    const exact = paciente.nombre || '';
                    const trimmed = exact.trim();
                    const nameVariants = Array.from(new Set([exact, trimmed, trimmed + ' '])).filter(Boolean);
                    
                    const planQueries = [];
                    if (paciente.id) {
                        planQueries.push(getDocs(query(collection(db, 'planes'), where('pacienteId', '==', paciente.id))));
                    }
                    nameVariants.forEach(name => {
                        planQueries.push(getDocs(query(collection(db, 'planes'), where('paciente', '==', name))));
                        planQueries.push(getDocs(query(collection(db, 'planes'), where('pacienteNombre', '==', name))));
                    });

                    const snaps = await Promise.all(planQueries);
                    const planMap = new Map();
                    snaps.forEach(snap => {
                        snap.docs.forEach(d => {
                            if (!planMap.has(d.id)) {
                                planMap.set(d.id, { id: d.id, ...d.data() });
                            }
                        });
                    });
                    return Array.from(planMap.values());
                } catch (e) {
                    console.warn('Error fetching patient planes:', e);
                    return [];
                }
            })();

            const [citasList, pagosList, planesList] = await Promise.all([citasPromise, pagosPromise, planesPromise]);
            setHistorialCitas(citasList || []);
            setHistorialPagos(pagosList || []);
            setHistorialPlanes(planesList || []);
        } catch (err) {
            console.error('Error al cargar historial:', err);
        } finally {
            setLoadingHistorial(false);
        }
    };

    // ── Lealtad ──────────────────────────────────────────────────
    const [sellandoId, setSellandoId] = useState(null);
    const [sellandoMsg, setSellandoMsg] = useState(null); // { id, msg, ok }
    const [canjeandoId, setCanjeandoId] = useState(null);
    const [canjeMsgModal, setCanjeMsgModal] = useState(null); // { ok, msg }

    // Confirmación antes de sellar
    const [confirmarSello, setConfirmarSello] = useState(null); // paciente a sellar
    const [resetandoSellos, setResetandoSellos] = useState(false);

    const iniciarSello = (paciente, e) => {
        e?.stopPropagation();
        if (paciente.lealtadActiva === false) return; // Doble guard
        setConfirmarSello(paciente);
    };

    const confirmarYSellar = async () => {
        if (!confirmarSello) return;
        const paciente = confirmarSello;
        setConfirmarSello(null);
        setSellandoId(paciente.id);
        setSellandoMsg(null);
        try {
            const res = await sellarVisita(paciente.id);
            setSellandoMsg({ id: paciente.id, msg: res.msg, ok: res.ok });
            setTimeout(() => setSellandoMsg(null), 3500);
        } catch (err) {
            setSellandoMsg({ id: paciente.id, msg: '❌ Error al sellar: ' + err.message, ok: false });
        } finally {
            setSellandoId(null);
        }
    };

    const handleResetAllSellos = async () => {
        if (!window.confirm('¿Seguro que deseas resetear los sellos de TODOS los pacientes a 0? Esta acción no se puede deshacer.')) return;
        setResetandoSellos(true);
        try {
            const n = await resetAllSellos();
            alert(`Se resetearon los sellos de ${n} pacientes correctamente.`);
        } catch (err) {
            alert('Error al resetear: ' + err.message);
        } finally {
            setResetandoSellos(false);
        }
    };

    const handleCanjear = async (pacienteId, e) => {
        e?.stopPropagation();
        if (!window.confirm('¿Confirmas el canje manual de la recompensa para este paciente?')) return;
        setCanjeandoId(pacienteId);
        setCanjeMsgModal(null);
        try {
            const res = await canjearRecompensa(pacienteId);
            setCanjeMsgModal({ ok: res.ok, msg: res.msg });
            setTimeout(() => setCanjeMsgModal(null), 4000);
        } catch (err) {
            setCanjeMsgModal({ ok: false, msg: '❌ Error: ' + err.message });
        } finally {
            setCanjeandoId(null);
        }
    };

    // ── Agenda Premio ────────────────────────────────────────────
    const [modalAgendar, setModalAgendar] = useState(false);
    const [pacientePremio, setPacientePremio] = useState(null);
    const [formAgendar, setFormAgendar] = useState({ fechaHora: '', especialistaId: '' });
    const [agendandoPremio, setAgendandoPremio] = useState(false);

    const abrirModalAgendar = (paciente, e) => {
        e?.stopPropagation();
        setPacientePremio(paciente);
        setFormAgendar({ fechaHora: '', especialistaId: '' });
        setModalAgendar(true);
    };

    const handleAgendarPremio = async () => {
        if (!formAgendar.fechaHora || !formAgendar.especialistaId) {
            alert('Por favor selecciona la fecha, hora y el especialista.');
            return;
        }
        setAgendandoPremio(true);
        try {
            const esp = staff.find(s => s.id === formAgendar.especialistaId);
            await createCita({
                pacienteId: pacientePremio.id,
                pacienteNombre: pacientePremio.nombre,
                telefono: pacientePremio.telefono,
                especialistaId: formAgendar.especialistaId,
                especialistaNombre: esp ? esp.nombre : 'Especialista',
                servicio: '🎁 Premio: ' + pacientePremio.recompensaElegida,
                fechaHora: formAgendar.fechaHora,
                duracionMin: 60
            });
            await canjearRecompensa(pacientePremio.id);
            setModalAgendar(false);
            setCanjeMsgModal({ ok: true, msg: '✅ Premio agendado y canjeado con éxito.' });
            setTimeout(() => setCanjeMsgModal(null), 4000);
        } catch (error) {
            alert('Error al agendar: ' + error.message);
        } finally {
            setAgendandoPremio(false);
        }
    };

    const handleToggleAllLealtad = async (activar) => {
        // Removido confirmación temporalmente
        console.log('Iniciando actualización masiva en batch...', activar);
        try {
            await updateAllPacientesLealtad(pacientes, activar);
            alert(`Se han ${activar ? 'activado' : 'desactivado'} las tarjetas de todos los pacientes.`);
        } catch (err) {
            console.error('Error en actualización masiva:', err);
            alert('Error al actualizar todos los pacientes.');
        }
    };

    const setN = (k, v) => setFormNuevo(prev => ({ ...prev, [k]: v }));

    const handleCrearPaciente = async () => {
        if (!formNuevo.nombre.trim()) { alert('El nombre es obligatorio.'); return; }
        if (!formNuevo.telefono.trim()) { alert('El teléfono es obligatorio.'); return; }
        setSavingNuevo(true);
        try {
            await createPaciente({
                ...formNuevo,
                nombre: formNuevo.nombre.trim(),
                telefono: formNuevo.telefono.trim(),
                especialistaAsignado: '',
                especialistaAsignadoNombre: '',
            });

            setExitoNuevo(true);
            setTimeout(() => {
                setModalNuevo(false);
                setFormNuevo(emptyNuevo);
                setExitoNuevo(false);
            }, 1500);
        } catch (err) {
            alert('Error: ' + err.message);
            console.error(err);
        } finally {
            setSavingNuevo(false);
        }
    };

    const [modal, setModal] = useState(false);
    const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
    const [formAsignacion, setFormAsignacion] = useState({
        nombre: '', telefono: '', email: '', fechaNacimiento: '', comoNosConocio: '', observaciones: '',
        especialistaAsignado: '', especialistaAsignadoNombre: '',
        tipoTratamiento: 'Por definir', estado: 'Activo',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const unsubPac = onPacientesChange((data) => {
            if (data.error) {
                setPacientesError(data.error.message);
                setPacientes([]);
            } else {
                setPacientesError(null);
                setPacientes(data);
            }
        });
        const unsubStaff = onStaffChange(data => {
            setStaff(data.filter(s => (s.puesto || '').toLowerCase().includes('especialista') || (s.puesto || '').toLowerCase().includes('cosmet')));
        });
        setLoading(false);
        return () => { unsubPac(); unsubStaff(); };
    }, []);

    const pacientesFiltrados = pacientes.filter(p => {
        const q = busqueda.toLowerCase();
        return !p.eliminado && (!q || (p.nombre || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q) || (p.telefono || '').includes(q));
    });

    const abrirModal = (paciente) => {
        setPacienteSeleccionado(paciente);
        setFormAsignacion({
            nombre: paciente.nombre || '',
            telefono: paciente.telefono || '',
            email: paciente.email || '',
            fechaNacimiento: paciente.fechaNacimiento || '',
            comoNosConocio: paciente.comoNosConocio || '',
            observaciones: paciente.observaciones || '',
            especialistaAsignado: paciente.especialistaAsignado || '',
            especialistaAsignadoNombre: paciente.especialistaAsignadoNombre || '',
            tipoTratamiento: paciente.tipoTratamiento || 'Por definir',
            estado: paciente.estado || 'Activo',
            ahorroMeta: paciente.ahorroMeta || 0,
            ahorroActual: paciente.ahorroActual || 0,
            nombreTratamientoAhorro: paciente.nombreTratamientoAhorro || '',
            lealtadActiva: paciente.lealtadActiva !== false,
            membresia: paciente.membresia || null,
        });
        setModal(true);
        setExitoAsignacion(false);
    };

    const handleGuardar = async () => {
        if (!pacienteSeleccionado) return;
        if (!formAsignacion.nombre.trim()) { alert('El nombre del paciente es obligatorio.'); return; }
        if (!formAsignacion.telefono.trim()) { alert('El teléfono es obligatorio.'); return; }
        setSaving(true);
        try {
            await updatePaciente(pacienteSeleccionado.id, formAsignacion);
            setExitoAsignacion(true);
            setTimeout(() => { setModal(false); setExitoAsignacion(false); }, 1200);
        } catch (err) { alert('Error al guardar.'); console.error(err); }
        finally { setSaving(false); }
    };

    const handleResetPassword = async () => {
        if (!pacienteSeleccionado?.email) {
            alert('El paciente no tiene un correo registrado.');
            return;
        }
        if (!window.confirm(`¿Enviar correo de restablecimiento a ${pacienteSeleccionado.email}?`)) return;

        setResetting(true);
        try {
            await resetPassword(pacienteSeleccionado.email);
            setResetSuccess(true);
            setTimeout(() => setResetSuccess(false), 3000);
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setResetting(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!pacienteToDelete) return;
        
        if (userRole?.toLowerCase() === 'recepcionista' || userRole?.toLowerCase() === 'recepcion') {
            if (!motivoEliminacion.trim()) {
                alert('El motivo es obligatorio para solicitar la eliminación.');
                return;
            }
            setConfirmingDelete(true);
            try {
                await solicitarEliminacionPaciente(
                    pacienteToDelete.id,
                    pacienteToDelete.nombre,
                    motivoEliminacion.trim(),
                    'Recepción'
                );
                alert('Solicitud de eliminación enviada al Administrador.');
                setPacienteToDelete(null);
                setMotivoEliminacion('');
            } catch (err) { alert('Error al enviar solicitud.'); console.error(err); }
            finally { setConfirmingDelete(false); }
            return;
        }

        setConfirmingDelete(true);
        try {
            await deletePaciente(pacienteToDelete.id);
            setPacienteToDelete(null);
        } catch (err) { alert('Error al eliminar.'); console.error(err); }
        finally { setConfirmingDelete(false); }
    };

    const getEstadoBadge = (estado) => {
        switch (estado) {
            case 'Activo': return <Badge variant="green">Activo</Badge>;
            case 'En pausa': return <Badge variant="yellow">En pausa</Badge>;
            case 'Alta médica': return <Badge variant="turquesa">Alta médica</Badge>;
            case 'Prospecto': return <Badge variant="gray">Prospecto</Badge>;
            default: return <Badge variant="gray">{estado || 'Sin estado'}</Badge>;
        }
    };

    const inputCls = "w-full p-2.5 border rounded-xl outline-none text-sm bg-gray-50 focus:bg-white transition-all";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-lg font-black text-acero flex items-center gap-2 uppercase">
                        <UsersIcon className="text-turquesa" size={22} /> Pacientes
                    </h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Gestión de expedientes</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="xs" onClick={() => handleToggleAllLealtad(true)}>Activar Tarjetas</Button>
                    <Button variant="outline" size="xs" onClick={() => handleToggleAllLealtad(false)}>Desactivar Tarjetas</Button>
                    <Button
                        variant="outline" size="xs" onClick={handleResetAllSellos} disabled={resetandoSellos} className="border-red-200 text-red-500 hover:bg-red-50">{resetandoSellos ? "Reseteando..." : "Reset Sellos"}
                    </Button>
                    <Button variant="primary" icon={UserPlus} onClick={() => { setFormNuevo(emptyNuevo); setExitoNuevo(false); setModalNuevo(true); }}>
                        Nuevo
                    </Button>
                </div>
            </div>

            <Card className="p-3">
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-turquesa/20 transition-all" />
                </div>
            </Card>

            <Card className="p-0 overflow-hidden shadow-sm">
                <div className="divide-y">
                    {pacientesFiltrados.map(p => (
                        <div key={p.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-turquesa/10 text-turquesa flex items-center justify-center font-black relative">
                                        {(p.nombre || '?')[0].toUpperCase()}
                                        {/* Indicador de recompensa pendiente */}
                                        {(p.recompensasDisponibles || 0) > 0 && (
                                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-[9px] font-black text-white shadow">
                                                {p.recompensasDisponibles}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800">{p.nombre}</p>
                                        <p className="text-xs text-gray-400">{p.telefono} • {p.email || 'Sin correo'}</p>
                                        {/* Mini barra de sellos */}
                                        <div className="flex items-center gap-1 mt-1">
                                            {Array.from({ length: 7 }).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="w-3 h-3 rounded-full flex items-center justify-center transition-all"
                                                    style={{
                                                        background: i < (p.sellosLealtad || 0)
                                                            ? 'linear-gradient(135deg, #20B2AA, #0d8a85)'
                                                            : 'rgba(32,178,170,0.12)',
                                                    }}
                                                >
                                                    {i < (p.sellosLealtad || 0) && (
                                                        <svg width="7" height="7" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M12 2L13.8 10.2L22 12L13.8 13.8L12 22L10.2 13.8L2 12L10.2 10.2Z" />
                                                        </svg>
                                                    )}
                                                </div>
                                            ))}
                                            <span className="text-[10px] text-gray-400 ml-1 font-bold">{p.sellosLealtad || 0}/7</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {getEstadoBadge(p.estado)}
                                    {/* Botón Canjear/Agendar – solo visible si tiene recompensas */}
                                    {(p.recompensasDisponibles || 0) > 0 && (
                                        p.recompensaElegida ? (
                                            <button
                                                onClick={(e) => abrirModalAgendar(p, e)}
                                                title={`Agendar: ${p.recompensaElegida}`}
                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white' }}
                                            >
                                                <Calendar size={13} />
                                                <span>Agendar Premio</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => handleCanjear(p.id, e)}
                                                disabled={canjeandoId === p.id}
                                                title={`Canjear recompensa manual (${p.recompensasDisponibles} disponibles)`}
                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white' }}
                                            >
                                                {canjeandoId === p.id
                                                    ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                                                    : <Gift size={13} />}
                                                <span>{p.recompensasDisponibles}</span>
                                            </button>
                                        )
                                    )}
                                    {/* Botón sellar visita */}
                                    {/* Botón sellar visita — solo si tiene tarjeta activa */}
                                    {p.lealtadActiva !== false && (
                                        <button
                                            onClick={(e) => iniciarSello(p, e)}
                                            disabled={sellandoId === p.id}
                                            title="Sellar visita de hoy"
                                            className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                            style={{ background: 'linear-gradient(135deg, #20B2AA, #0d8a85)' }}
                                        >
                                            {sellandoId === p.id
                                                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                                                : <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L13.8 10.2L22 12L13.8 13.8L12 22L10.2 13.8L2 12L10.2 10.2Z" /></svg>}
                                        </button>
                                    )}
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            const nuevoEstado = p.lealtadActiva !== false ? false : true;
                                            try {
                                                await updatePaciente(p.id, { lealtadActiva: nuevoEstado });
                                            } catch (err) {
                                                console.error(err);
                                                alert('Error al actualizar lealtad');
                                            }
                                        }}
                                        title={p.lealtadActiva !== false ? "Desactivar Tarjeta de Lealtad" : "Activar Tarjeta de Lealtad"}
                                        className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95"
                                        style={{ 
                                            background: p.lealtadActiva !== false ? 'linear-gradient(135deg, #20B2AA, #0d8a85)' : '#F3F4F6',
                                            border: p.lealtadActiva !== false ? 'none' : '1px solid #E5E7EB'
                                        }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={p.lealtadActiva !== false ? "white" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                                    </button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        icon={FileText}
                                        onClick={() => navigate(`/especialista/expediente/${p.id}`)}
                                        title="Abrir Expediente Clínico Completo"
                                        className="border-turquesa/30 text-acero hover:bg-turquesa hover:text-white text-xs"
                                    >
                                        Expediente
                                    </Button>
                                    <Button variant="ghost" size="sm" icon={History}
                                        onClick={(e) => abrirHistorial(p, e, 'citas')}
                                        title="Ver historial de citas"
                                    />
                                    <Button variant="ghost" size="sm" icon={Receipt}
                                        onClick={(e) => abrirHistorial(p, e, 'pagos')}
                                        title="Ver historial de pagos y recibos"
                                        className="text-turquesa hover:text-turquesa/80 hover:bg-turquesa/10"
                                    />
                                    <Button variant="ghost" size="sm" icon={UserCog} onClick={() => abrirModal(p)} />
                                    <button onClick={() => setPacienteToDelete(p)} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                                </div>
                            </div>
                            {/* Mensaje feedback de sellado */}
                            {sellandoMsg?.id === p.id && (
                                <div className={`mt-2 px-3 py-2 rounded-xl text-xs font-semibold animate-in slide-in-from-top-2 ${
                                    sellandoMsg.ok ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>
                                    {sellandoMsg.msg}
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && <div className="p-8 text-center text-gray-500">Cargando pacientes...</div>}
                    {pacientesError && <div className="p-12 text-center text-red-500 font-bold">Error: {pacientesError}</div>}
                    {!loading && !pacientesError && pacientesFiltrados.length === 0 && (
                        <div className="p-12 text-center text-gray-400">No se encontraron pacientes.</div>
                    )}
                </div>
            </Card>

            {/* MODAL NUEVO PACIENTE (Solo Expediente) */}
            <Modal isOpen={modalNuevo} onClose={() => setModalNuevo(false)} title="Nuevo Registro de Paciente">
                {exitoNuevo ? (
                    <div className="text-center py-8 space-y-4">
                        <CheckCircle size={64} className="text-green-500 mx-auto" />
                        <h3 className="font-black text-xl text-acero">¡Expediente Creado!</h3>
                        <p className="text-gray-500">Los datos básicos se han guardado correctamente.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-xs text-gray-400 bg-blue-50 p-3 rounded-lg border border-blue-100 italic">
                            Nota: Aquí solo registras el expediente médico. El paciente puede crear su cuenta de acceso en la pantalla de inicio para ver sus seguimientos.
                        </p>
                        <div className="space-y-3">
                            <input type="text" placeholder="Nombre completo *" value={formNuevo.nombre} onChange={e => setN('nombre', e.target.value)} className={inputCls} />
                            <input type="tel" placeholder="Teléfono *" value={formNuevo.telefono} onChange={e => setN('telefono', e.target.value)} className={inputCls} />
                            <input type="email" placeholder="Correo electrónico (opcional)" value={formNuevo.email} onChange={e => setN('email', e.target.value)} className={inputCls} />
                            <input type="date" placeholder="Fecha de Nacimiento" value={formNuevo.fechaNacimiento} onChange={e => setN('fechaNacimiento', e.target.value)} className={inputCls} />
                            <select value={formNuevo.comoNosConocio || ''} onChange={e => setN('comoNosConocio', e.target.value)} className={inputCls}>
                                <option value="">— ¿Cómo nos conoció? (Canal de origen) —</option>
                                {CANALES_ORIGEN.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" fullWidth onClick={() => setModalNuevo(false)}>Cancelar</Button>
                            <Button variant="primary" fullWidth onClick={handleCrearPaciente} disabled={savingNuevo}>
                                {savingNuevo ? 'Guardando...' : 'Crear Expediente'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL EDITAR PACIENTE */}
            <Modal isOpen={modal} onClose={() => setModal(false)} title="Editar Paciente">
                {exitoAsignacion ? (
                    <div className="text-center py-6"><CheckCircle size={40} className="text-green-500 mx-auto" /></div>
                ) : (
                    <div className="space-y-4">

                        {/* ── Datos personales ── */}
                        <div>
                            <p className="text-[10px] font-black text-turquesa uppercase tracking-widest mb-3">Datos del Paciente</p>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nombre Completo *</label>
                                    <input
                                        type="text"
                                        value={formAsignacion.nombre}
                                        onChange={e => setFormAsignacion(p => ({ ...p, nombre: e.target.value }))}
                                        className={inputCls}
                                        placeholder="Nombre completo"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Teléfono *</label>
                                        <input
                                            type="tel"
                                            value={formAsignacion.telefono}
                                            onChange={e => setFormAsignacion(p => ({ ...p, telefono: e.target.value }))}
                                            className={inputCls}
                                            placeholder="10 dígitos"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Fecha Nacimiento</label>
                                        <input
                                            type="date"
                                            value={formAsignacion.fechaNacimiento}
                                            onChange={e => setFormAsignacion(p => ({ ...p, fechaNacimiento: e.target.value }))}
                                            className={inputCls}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Correo Electrónico</label>
                                    <input
                                        type="email"
                                        value={formAsignacion.email}
                                        onChange={e => setFormAsignacion(p => ({ ...p, email: e.target.value }))}
                                        className={inputCls}
                                        placeholder="email@ejemplo.com"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">¿Cómo nos conoció? (Canal de Origen)</label>
                                    <select
                                        value={formAsignacion.comoNosConocio || ''}
                                        onChange={e => setFormAsignacion(p => ({ ...p, comoNosConocio: e.target.value }))}
                                        className={inputCls}
                                    >
                                        <option value="">— Sin especificar —</option>
                                        {CANALES_ORIGEN.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Observaciones Generales</label>
                                    <textarea
                                        value={formAsignacion.observaciones}
                                        onChange={e => setFormAsignacion(p => ({ ...p, observaciones: e.target.value }))}
                                        className={`${inputCls} h-20 resize-none`}
                                        placeholder="Notas internas del expediente..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── Asignación clínica ── */}
                        <div className="pt-3 border-t border-gray-100">
                            <p className="text-[10px] font-black text-acero uppercase tracking-widest mb-3">Asignación Clínica</p>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Especialista Responsable</label>
                            <select
                                value={formAsignacion.especialistaAsignado}
                                onChange={e => {
                                    const sel = staff.find(s => s.id === e.target.value);
                                    setFormAsignacion(prev => ({ ...prev, especialistaAsignado: e.target.value, especialistaAsignadoNombre: sel?.nombre || '' }));
                                }}
                                className={inputCls}
                            >
                                <option value="">— Seleccionar Especialista —</option>
                                {staff.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.puesto})</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Tipo Tratamiento</label>
                                <select value={formAsignacion.tipoTratamiento} onChange={e => setFormAsignacion(p => ({ ...p, tipoTratamiento: e.target.value }))} className={inputCls}>
                                    {TIPOS.map(e => <option key={e}>{e}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Estado Actual</label>
                                <select value={formAsignacion.estado} onChange={e => setFormAsignacion(p => ({ ...p, estado: e.target.value }))} className={inputCls}>
                                    {ESTADOS.map(e => <option key={e}>{e}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 space-y-3">
                            <label className="text-xs font-bold text-turquesa uppercase block">Meta de Ahorro para Tratamiento</label>
                            <input
                                type="text"
                                placeholder="Nombre del tratamiento (ej. Lipoescultura)"
                                value={formAsignacion.nombreTratamientoAhorro}
                                onChange={e => setFormAsignacion(p => ({ ...p, nombreTratamientoAhorro: e.target.value }))}
                                className={inputCls}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Monto Meta ($)</label>
                                    <input
                                        type="number"
                                        value={formAsignacion.ahorroMeta}
                                        onChange={e => setFormAsignacion(p => ({ ...p, ahorroMeta: Number(e.target.value) }))}
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Monto Actual ($)</label>
                                    <input
                                        type="number"
                                        value={formAsignacion.ahorroActual}
                                        onChange={e => setFormAsignacion(p => ({ ...p, ahorroActual: Number(e.target.value) }))}
                                        className={inputCls}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase block">Accesos y Seguridad</label>
                            {pacienteSeleccionado?.email ? (
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Mail size={14} className="text-turquesa" />
                                        <span>{pacienteSeleccionado.email}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={resetSuccess ? CheckCircle : KeyRound}
                                        className={resetSuccess ? 'text-green-600 bg-green-50' : 'text-turquesa hover:bg-turquesa/5'}
                                        onClick={handleResetPassword}
                                        disabled={resetting}
                                    >
                                        {resetting ? 'Enviando...' : (resetSuccess ? 'Enviado' : 'Restablecer Clave')}
                                    </Button>
                                </div>
                            ) : (
                                <div className="p-3 bg-yellow-50 text-yellow-700 text-[10px] rounded-lg border border-yellow-100 italic">
                                    Paciente sin correo electrónico. No se pueden gestionar accesos.
                                </div>
                            )}
                        </div>

                            {/* ── Lealtad ── */}
                            <div className="pt-4 border-t border-gray-100 space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#20B2AA' }}>Tarjeta de Lealtad</p>
                                {/* Barra de sellos visual */}
                                <div className="flex items-center gap-1.5">
                                    {Array.from({ length: 7 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 h-7 rounded-xl flex items-center justify-center transition-all overflow-hidden"
                                            style={{
                                                background: i < (pacienteSeleccionado?.sellosLealtad || 0)
                                                    ? 'linear-gradient(145deg, #24c4bc, #0d8a85)'
                                                    : 'rgba(32,178,170,0.06)',
                                                border: i < (pacienteSeleccionado?.sellosLealtad || 0)
                                                    ? 'none'
                                                    : '1.5px dashed rgba(32,178,170,0.3)',
                                            }}
                                        >
                                            {i < (pacienteSeleccionado?.sellosLealtad || 0)
                                                ? <svg className="alfra-star" width="12" height="12" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L13.8 10.2L22 12L13.8 13.8L12 22L10.2 13.8L2 12L10.2 10.2Z" /></svg>
                                                : <span className="text-[10px] font-black" style={{ color: 'rgba(32,178,170,0.35)' }}>{i + 1}</span>}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-400 font-medium">
                                        {pacienteSeleccionado?.sellosLealtad || 0} / 7 visitas
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setFormAsignacion(prev => ({ ...prev, lealtadActiva: !prev.lealtadActiva }))}
                                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                        style={{
                                            backgroundColor: formAsignacion.lealtadActiva ? '#20B2AA' : '#E5E7EB',
                                            color: formAsignacion.lealtadActiva ? 'white' : '#9CA3AF'
                                        }}
                                    >
                                        {formAsignacion.lealtadActiva ? 'Tarjeta Activa' : 'Tarjeta Inactiva'}
                                    </button>
                                </div>

                                {/* Banner + botón de canje cuando hay recompensas */}
                                {(pacienteSeleccionado?.recompensasDisponibles || 0) > 0 && (
                                    <div
                                        className="rounded-2xl p-4 flex items-center gap-4"
                                        style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', border: '1.5px solid #f59e0b' }}
                                    >
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                                            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                                        >
                                            <Gift size={20} className="text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-black text-amber-800 text-sm leading-tight">
                                                {pacienteSeleccionado.recompensasDisponibles} recompensa(s) disponible(s)
                                            </p>
                                            {pacienteSeleccionado.recompensaElegida ? (
                                                <p className="text-[12px] font-bold text-amber-900 mt-1 bg-amber-500/20 inline-block px-2 py-0.5 rounded-md">
                                                    Eligió: {pacienteSeleccionado.recompensaElegida}
                                                </p>
                                            ) : (
                                                <p className="text-[11px] text-amber-700 mt-0.5">El paciente aún no elige su premio en la app</p>
                                            )}
                                        </div>
                                        {pacienteSeleccionado.recompensaElegida ? (
                                            <button
                                                onClick={(e) => abrirModalAgendar(pacienteSeleccionado, e)}
                                                className="px-4 py-2 rounded-xl font-black text-white text-xs transition-all hover:scale-105 active:scale-95 shrink-0 flex items-center gap-1.5"
                                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                                            >
                                                <Calendar size={14} /> Agendar Premio
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => handleCanjear(pacienteSeleccionado.id, e)}
                                                disabled={canjeandoId === pacienteSeleccionado.id}
                                                className="px-4 py-2 rounded-xl font-black text-white text-xs transition-all hover:scale-105 active:scale-95 disabled:opacity-60 shrink-0"
                                                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                                            >
                                                {canjeandoId === pacienteSeleccionado.id ? 'Canjeando...' : 'Canjear Manual'}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Feedback del canje */}
                                {canjeMsgModal && (
                                    <div className={`px-3 py-2 rounded-xl text-xs font-semibold ${
                                        canjeMsgModal.ok ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                                    }`}>
                                        {canjeMsgModal.msg}
                                    </div>
                                )}
                            </div>

                        <Button variant="primary" fullWidth onClick={handleGuardar} disabled={saving}>
                            {saving ? 'Aplicando cambios...' : 'Guardar Cambios'}
                        </Button>
                    </div>
                )}
            </Modal>

            {/* MODAL ELIMINAR */}
            <Modal isOpen={!!pacienteToDelete} onClose={() => { setPacienteToDelete(null); setMotivoEliminacion(''); }} title={userRole?.toLowerCase() === 'recepcionista' || userRole?.toLowerCase() === 'recepcion' ? "Solicitar Eliminación" : "Eliminar Registro"} maxWidth="max-w-sm">
                <div className="text-center space-y-4 py-2">
                    <Trash2 size={40} className="text-red-500 mx-auto" />
                    <p className="font-bold text-acero leading-tight">
                        {userRole?.toLowerCase() === 'recepcionista' || userRole?.toLowerCase() === 'recepcion' 
                            ? `¿Estás seguro de solicitar la eliminación del expediente de `
                            : `¿Estás seguro de eliminar el expediente de `}
                        <span className="text-turquesa">{pacienteToDelete?.nombre}</span>?
                    </p>
                    
                    {userRole?.toLowerCase() === 'recepcionista' || userRole?.toLowerCase() === 'recepcion' ? (
                        <div className="text-left mt-4">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Motivo de la eliminación:</label>
                            <textarea
                                value={motivoEliminacion}
                                onChange={(e) => setMotivoEliminacion(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all text-sm"
                                placeholder="Escribe el motivo aquí..."
                                rows={3}
                            />
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400">Esta acción no se puede deshacer y borrará todo el historial asociado.</p>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" fullWidth onClick={() => { setPacienteToDelete(null); setMotivoEliminacion(''); }}>No, cancelar</Button>
                        <Button 
                            variant="primary" 
                            className="bg-red-500 border-red-500 hover:bg-red-600" 
                            fullWidth 
                            onClick={handleConfirmDelete} 
                            disabled={confirmingDelete}
                        >
                            {confirmingDelete ? 'Procesando...' : (userRole?.toLowerCase() === 'recepcionista' || userRole?.toLowerCase() === 'recepcion' ? 'Enviar Solicitud' : 'Sí, eliminar')}
                        </Button>
                    </div>
                </div>
            </Modal>
            {/* MODAL AGENDAR PREMIO */}
            <Modal isOpen={modalAgendar} onClose={() => setModalAgendar(false)} title="Agendar Premio de Lealtad">
                <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                        <Gift size={32} className="text-amber-500 mb-2" />
                        <p className="text-sm text-amber-800 font-bold mb-1">{pacientePremio?.nombre}</p>
                        <p className="text-xs text-amber-600 bg-amber-200/50 px-3 py-1 rounded-full font-bold">
                            {pacientePremio?.recompensaElegida}
                        </p>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Concepto de Cita (No editable)</label>
                            <input
                                type="text"
                                value={`🎁 Premio: ${pacientePremio?.recompensaElegida || ''}`}
                                disabled
                                className={`${inputCls} bg-gray-50 text-gray-500 font-medium`}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Especialista *</label>
                                <select
                                    value={formAgendar.especialistaId}
                                    onChange={e => setFormAgendar(p => ({ ...p, especialistaId: e.target.value }))}
                                    className={inputCls}
                                >
                                    <option value="">— Seleccionar —</option>
                                    {staff.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Fecha y Hora *</label>
                                <input
                                    type="datetime-local"
                                    value={formAgendar.fechaHora}
                                    onChange={e => setFormAgendar(p => ({ ...p, fechaHora: e.target.value }))}
                                    className={inputCls}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                            <Clock size={14} className="text-turquesa" />
                            <span>Duración asignada por defecto: <b>60 minutos</b></span>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-100 mt-4">
                        <Button variant="outline" fullWidth onClick={() => setModalAgendar(false)}>Cancelar</Button>
                        <Button variant="primary" fullWidth onClick={handleAgendarPremio} disabled={agendandoPremio} className="bg-amber-500 hover:bg-amber-600 border-none">
                            {agendandoPremio ? 'Agendando...' : 'Confirmar Cita'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* MODAL CONFIRMACIÓN DE SELLO */}
            {confirmarSello && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-acero/60 backdrop-blur-md p-4" onClick={() => setConfirmarSello(null)}>
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 text-center space-y-5" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #20B2AA, #0d8a85)' }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M12 2L13.8 10.2L22 12L13.8 13.8L12 22L10.2 13.8L2 12L10.2 10.2Z" /></svg>
                        </div>
                        <div>
                            <h3 className="font-black text-xl text-acero">Confirmar Sello</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                ¿Registrar visita de hoy para
                            </p>
                            <p className="font-black text-turquesa text-lg mt-0.5">{confirmarSello.nombre}</p>
                        </div>
                        <div className="bg-turquesa/5 border border-turquesa/10 rounded-2xl p-3 text-xs text-gray-500">
                            Sellos actuales:
                            <span className="font-black text-turquesa ml-1">{confirmarSello.sellosLealtad || 0} / 7</span>
                            &nbsp;&mdash; Esta acción no se puede deshacer.
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" fullWidth onClick={() => setConfirmarSello(null)}>Cancelar</Button>
                            <Button
                                variant="primary"
                                fullWidth
                                onClick={confirmarYSellar}
                                className="bg-turquesa border-turquesa"
                            >
                                Sí, sellar visita
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            ﻿{/* MODAL HISTORIAL DE CITAS Y PAGOS */}
            {historialModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-acero/60 backdrop-blur-md p-4" onClick={() => setHistorialModal(false)}>
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-start shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-black text-xl text-acero">Historial del Paciente</h3>
                                    <Badge variant="turquesa">{historialPaciente?.estado || 'Paciente'}</Badge>
                                </div>
                                <p className="text-sm text-turquesa font-bold mt-0.5">
                                    {historialPaciente?.nombre}
                                    {historialPaciente?.telefono && (
                                        <span className="text-gray-400 font-normal text-xs ml-2">📱 {historialPaciente.telefono}</span>
                                    )}
                                </p>
                            </div>
                            <button onClick={() => setHistorialModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Selector de Pestañas */}
                        <div className="px-6 py-2.5 bg-gray-50/80 border-b border-gray-100 flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setHistorialTab('citas')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                    historialTab === 'citas'
                                        ? 'bg-acero text-white shadow-xs'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                }`}
                            >
                                <Calendar size={14} />
                                Historial de Citas
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    historialTab === 'citas' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                                }`}>
                                    {historialCitas.length}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setHistorialTab('pagos')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                    historialTab === 'pagos'
                                        ? 'bg-turquesa text-white shadow-xs shadow-turquesa/30'
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                }`}
                            >
                                <Receipt size={14} />
                                Historial de Pagos y Recibos
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    historialTab === 'pagos' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                                }`}>
                                    {historialPagos.length}
                                </span>
                            </button>
                        </div>

                        {/* PESTAÑA: HISTORIAL DE CITAS */}
                        {historialTab === 'citas' && (
                            <>
                                {/* Resumen rápido de citas */}
                                {!loadingHistorial && historialCitas.length > 0 && (() => {
                                    const total = historialCitas.length;
                                    const completadas = historialCitas.filter(c => c.status === 'Completada').length;
                                    const canceladas = historialCitas.filter(c => c.status === 'Cancelada').length;
                                    const noAsistio = historialCitas.filter(c => c.status === 'No Asistió').length;
                                    const reagendadas = historialCitas.filter(c => c.status === 'Reagendada').length;
                                    return (
                                        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-5 gap-2 shrink-0">
                                            {[
                                                { label: 'Total', val: total, color: 'text-gray-700 bg-gray-100' },
                                                { label: 'Completadas', val: completadas, color: 'text-emerald-700 bg-emerald-50' },
                                                { label: 'Canceladas', val: canceladas, color: 'text-red-600 bg-red-50' },
                                                { label: 'No Asistió', val: noAsistio, color: 'text-amber-600 bg-amber-50' },
                                                { label: 'Reagendadas', val: reagendadas, color: 'text-blue-600 bg-blue-50' },
                                            ].map(item => (
                                                <div key={item.label} className={`rounded-xl px-2 py-2 text-center ${item.color}`}>
                                                    <p className="text-lg font-black leading-none">{item.val}</p>
                                                    <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-70">{item.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {/* Lista de Citas */}
                                <div className="overflow-y-auto flex-1 p-4 space-y-2">
                                    {loadingHistorial ? (
                                        <div className="py-12 text-center text-gray-400 font-bold">Cargando historial de citas...</div>
                                    ) : historialCitas.length === 0 ? (
                                        <div className="py-12 text-center text-gray-400 italic">No hay citas registradas para este paciente.</div>
                                    ) : (
                                        historialCitas.map(cita => {
                                            const fecha = cita.fechaHora || cita.fecha;
                                            const fechaDate = fecha ? new Date(fecha) : null;
                                            const statusConfig = {
                                                'Completada':  { cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                                                'Cancelada':   { cls: 'bg-red-50 text-red-600 border-red-100' },
                                                'No Asistió':  { cls: 'bg-amber-50 text-amber-600 border-amber-100' },
                                                'Reagendada':  { cls: 'bg-blue-50 text-blue-600 border-blue-100' },
                                                'Pendiente':   { cls: 'bg-gray-50 text-gray-500 border-gray-200' },
                                                'Confirmada':  { cls: 'bg-purple-50 text-purple-600 border-purple-100' },
                                            };
                                            const sc = statusConfig[cita.status] || statusConfig['Pendiente'];
                                            return (
                                                <div key={cita.id} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-2xl hover:border-turquesa/20 transition-colors">
                                                    <div className="shrink-0 w-12 text-center bg-turquesa/8 rounded-xl py-1.5">
                                                        <p className="text-base font-black text-turquesa leading-none">{fechaDate ? fechaDate.getDate() : '--'}</p>
                                                        <p className="text-[9px] font-bold uppercase text-turquesa/70">
                                                            {fechaDate ? fechaDate.toLocaleDateString('es-MX', { month: 'short' }) : ''}
                                                        </p>
                                                        <p className="text-[9px] font-bold text-gray-400">
                                                            {fechaDate ? fechaDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </p>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-acero text-sm truncate">{cita.servicio || 'Consulta general'}</p>
                                                        <p className="text-[11px] text-gray-400 truncate">{cita.especialistaNombre || cita.especialista || 'Especialista por asignar'}</p>
                                                    </div>
                                                    <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${sc.cls}`}>
                                                        {cita.status || 'Pendiente'}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </>
                        )}

                        {/* PESTAÑA: HISTORIAL DE PAGOS Y RECIBOS */}
                        {historialTab === 'pagos' && (
                            <>
                                {/* Resumen rápido de pagos */}
                                {!loadingHistorial && (
                                    <div className="px-6 py-3 bg-turquesa/5 border-b border-turquesa/15 flex items-center justify-between shrink-0">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-xl bg-turquesa/15 text-turquesa flex items-center justify-center">
                                                <Receipt size={16} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total de Pagos</p>
                                                <p className="text-xs font-bold text-gray-700">
                                                    {historialPagos.length} {historialPagos.length === 1 ? 'recibo emitido' : 'recibos emitidos'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Monto Total Acumulado</p>
                                            <p className="text-lg font-black text-turquesa leading-none">
                                                ${historialPagos.reduce((acc, p) => acc + Number(p.monto || p.total || 0), 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                <span className="text-xs font-medium text-gray-400 ml-1">MXN</span>
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Lista de Pagos y Planes de Tratamiento */}
                                <div className="overflow-y-auto flex-1 p-4 space-y-3">
                                    {/* Resumen de Planes de Tratamiento si existen */}
                                    {!loadingHistorial && historialPlanes.length > 0 && (
                                        <div className="p-4 bg-gradient-to-br from-teal-50 via-emerald-50/40 to-teal-50/20 rounded-2xl border border-teal-200/70 shadow-xs space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1.5 bg-teal-600 text-white rounded-lg shadow-xs">
                                                        <Sparkles size={14} />
                                                    </span>
                                                    <div>
                                                        <h4 className="text-xs font-black uppercase tracking-wider text-acero">
                                                            Plan de Tratamiento Activo
                                                        </h4>
                                                        <p className="text-[11px] text-gray-500 font-medium">
                                                            Control financiero y saldo acumulado
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-200">
                                                    {historialPlanes.length} {historialPlanes.length === 1 ? 'plan activo' : 'planes'}
                                                </span>
                                            </div>

                                            {historialPlanes.map(plan => {
                                                const meta = Number(plan.meta || 0);
                                                const acumulado = Number(plan.acumulado || 0);
                                                const restante = Math.max(0, meta - acumulado);
                                                const pct = meta > 0 ? Math.min(100, Math.round((acumulado / meta) * 100)) : 0;

                                                return (
                                                    <div key={plan.id} className="p-3.5 bg-white rounded-xl border border-teal-100 shadow-2xs space-y-2.5">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-sm font-bold text-gray-900">{plan.objetivo || 'Tratamiento Integral'}</p>
                                                                    {plan.morosidad && (
                                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200">
                                                                            Saldo pendiente
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {plan.costoPorSesion > 0 && (
                                                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                                                        Costo por sesión: <strong className="text-teal-700 font-bold">${Number(plan.costoPorSesion).toLocaleString('es-MX')}</strong>
                                                                        {plan.anticipo > 0 && ` • Anticipo requerido: $${Number(plan.anticipo).toLocaleString('es-MX')}`}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <span className="text-sm font-black text-teal-700">{pct}%</span>
                                                                <span className="text-[10px] text-gray-400 block font-semibold leading-none">cubierto</span>
                                                            </div>
                                                        </div>

                                                        {/* Barra de progreso */}
                                                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                                            <div
                                                                className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                                                            <div className="bg-gray-50 rounded-xl p-2 border border-gray-100">
                                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Costo Meta</p>
                                                                <p className="text-xs font-black text-gray-800">${meta.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                                            </div>
                                                            <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-100">
                                                                <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Total Abonado</p>
                                                                <p className="text-xs font-black text-emerald-700">${acumulado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                                            </div>
                                                            <div className="bg-amber-50 rounded-xl p-2 border border-amber-100">
                                                                <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Saldo Faltante</p>
                                                                <p className="text-xs font-black text-amber-700">${restante.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {loadingHistorial ? (
                                        <div className="py-12 text-center text-gray-400 font-bold">Cargando pagos y recibos...</div>
                                    ) : historialPagos.length === 0 ? (
                                        <div className="py-12 text-center text-gray-400 space-y-2">
                                            <Receipt size={32} className="mx-auto text-gray-300" />
                                            <p className="font-bold text-sm text-gray-600">No hay pagos ni recibos registrados para este paciente.</p>
                                            <p className="text-xs text-gray-400">Cuando se procese un cobro o abono a plan en Caja, el recibo aparecerá aquí.</p>
                                        </div>
                                    ) : (
                                        historialPagos.map((pago, pIdx) => {
                                            const fechaVal = pago.fecha?.seconds ? pago.fecha.seconds * 1000 : pago.fecha || pago.createdAt;
                                            const fechaDate = fechaVal ? new Date(fechaVal) : null;
                                            const montoNum = Number(pago.monto || pago.total || 0);
                                            const folioStr = pago.folio || (pago.id ? pago.id.slice(-5) : '00000');
                                            const conceptoStr = pago.concepto || pago.motivo || pago.servicio || 'Pago en Clínica';
                                            const metodoStr = pago.metodoPago || 'Efectivo';

                                            const isPlan = pago.isPlanTratamiento ||
                                                (pago.concepto || '').toLowerCase().includes('plan') ||
                                                (pago.concepto || '').toLowerCase().includes('abono') ||
                                                Boolean(pago.paqueteInfo);

                                            const paqueteTexto = typeof pago.paqueteInfo === 'object' && pago.paqueteInfo !== null
                                                ? (pago.paqueteInfo.nombre || pago.paqueteInfo.objetivo || '')
                                                : (pago.paqueteInfo || '');

                                            const metodoColors = {
                                                'Efectivo': 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                                'Tarjeta': 'bg-blue-50 text-blue-700 border-blue-200',
                                                'Transferencia': 'bg-purple-50 text-purple-700 border-purple-200',
                                            };
                                            const mc = metodoColors[metodoStr] || 'bg-gray-100 text-gray-700 border-gray-200';

                                            return (
                                                <div
                                                    key={pago.id || pIdx}
                                                    className="p-3.5 bg-white border border-gray-100 rounded-2xl hover:border-turquesa/30 shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="shrink-0 w-12 text-center bg-turquesa/8 rounded-xl py-1.5">
                                                            <p className="text-base font-black text-turquesa leading-none">
                                                                {fechaDate ? fechaDate.getDate() : '--'}
                                                            </p>
                                                            <p className="text-[9px] font-bold uppercase text-turquesa/70">
                                                                {fechaDate ? fechaDate.toLocaleDateString('es-MX', { month: 'short' }) : ''}
                                                            </p>
                                                            <p className="text-[8px] font-semibold text-gray-400 mt-0.5">
                                                                {fechaDate ? fechaDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}
                                                            </p>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-mono text-[10px] font-black bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md border border-gray-200">
                                                                    Folio #{folioStr}
                                                                </span>
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${mc}`}>
                                                                    {metodoStr}
                                                                </span>
                                                                {isPlan ? (
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1">
                                                                        <Sparkles size={10} className="text-teal-600" />
                                                                        {paqueteTexto && paqueteTexto !== 'Plan de Tratamiento'
                                                                            ? `Plan: ${paqueteTexto}`
                                                                            : 'Plan de Tratamiento'}
                                                                    </span>
                                                                ) : paqueteTexto ? (
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                                                        {paqueteTexto}
                                                                    </span>
                                                                ) : null}
                                                            </div>

                                                            <h4 className="font-bold text-acero text-sm leading-snug">
                                                                {conceptoStr}
                                                            </h4>

                                                            {paqueteTexto && (
                                                                <p className="text-xs text-gray-500 font-medium">
                                                                    {paqueteTexto}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                                                        <div className="text-right">
                                                            <p className="text-[9px] uppercase font-bold text-gray-400">Monto</p>
                                                            <p className="text-base font-black text-turquesa leading-none">
                                                                ${montoNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                            </p>
                                                        </div>

                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            icon={Receipt}
                                                            onClick={() => setReciboVisualizar({
                                                                folio: folioStr,
                                                                fecha: pago.fechaLegible || (fechaDate ? fechaDate.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleString('es-MX')),
                                                                pacienteNombre: pago.pacienteNombre || historialPaciente?.nombre || 'Paciente',
                                                                concepto: conceptoStr,
                                                                monto: montoNum,
                                                                metodoPago: metodoStr,
                                                                paqueteInfo: paqueteTexto || (isPlan ? 'Plan de Tratamiento' : null),
                                                                telefono: pago.telefono || historialPaciente?.telefono || '',
                                                            })}
                                                            className="rounded-xl border-turquesa/30 text-turquesa hover:bg-turquesa hover:text-white text-xs font-bold gap-1.5 shadow-xs"
                                                        >
                                                            Generar Recibo
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL RECIBO DIGITAL OFICIAL */}
            {reciboVisualizar && (
                <ReciboDigital
                    isOpen={!!reciboVisualizar}
                    onClose={() => setReciboVisualizar(null)}
                    datosRecibo={reciboVisualizar}
                    showActions={true}
                />
            )}
        </div>
    );
}
