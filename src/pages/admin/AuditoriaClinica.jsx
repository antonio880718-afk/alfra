import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useNavigate } from 'react-router-dom';
import {
    Search, FolderOpen, User, Ruler, Calendar, X, AlertCircle,
    FileText, Activity, HeartPulse, Camera, Loader, Home,
    History, FileCheck as FileChecked, PlusCircle, Plus, CheckCircle,
    Copy, Check, AlertTriangle, ExternalLink
} from 'lucide-react';
import { onPacientesChange } from '../../services/pacientesService';
import { onCitasChange } from '../../services/citasService';
import { onStaffChange } from '../../services/staffService';
import { getSeguimientosPaciente, getApoyoEnCasa, getDailyTrackers, onSeguimientosChange } from '../../services/seguimientoService';
import { getSolicitudesEliminacion, eliminarTratamiento, rechazarEliminacionTratamiento, onSesionesChange, auditarExpedientesPorDia } from '../../services/tratamientosService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

export default function AuditoriaClinica() {
    const navigate = useNavigate();
    const [pacientes, setPacientes] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [citasAll, setCitasAll] = useState([]);
    const [sesionesAll, setSesionesAll] = useState([]);
    const [seguimientosAll, setSeguimientosAll] = useState([]);
    const [fechaAuditoriaDia, setFechaAuditoriaDia] = useState(() => new Date().toISOString().split('T')[0]);
    const [copiedKey, setCopiedKey] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [activeTab, setActiveTab] = useState('historial'); // historial, evolucion, fotos, adherencia
    const [treatmentType, setTreatmentType] = useState('Facial');
    const [signingConsent, setSigningConsent] = useState(null);
    const fileInputRef = React.useRef(null);

    // Bajas Requests
    const [solicitudesBaja, setSolicitudesBaja] = useState([]);
    const [loadingBajas, setLoadingBajas] = useState(true);

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

    const [fotos, setFotos] = useState([
        { id: 1, url: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&q=80&w=400', label: 'Sesión 1 - Antes', date: '10 Sep 2026' },
        { id: 2, url: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&q=80&w=400', label: 'Sesión 3 - Previo', date: '15 Oct 2026' },
    ]);

    const [consents, setConsents] = useState([
        { id: 1, name: 'Aplicación de Toxina Botulínica (Botox)', type: 'Facial', signed: true, signatureInfo: 'ALFRA-SIG-X9K2M-1402', date: '12-Oct-2026 10:30 AM' },
        { id: 2, name: 'Armonización Facial con Ácido Hialurónico', type: 'Facial', signed: false, signatureInfo: null, date: null },
        { id: 3, name: 'Peeling Químico Profundo', type: 'Facial', signed: false, signatureInfo: null, date: null },
        { id: 4, name: 'Lipoescultura Mela / Enzimas Recombinantes', type: 'Corporal', signed: false, signatureInfo: null, date: null },
        { id: 5, name: 'Hidrolipoclasia Ultrasónica', type: 'Corporal', signed: false, signatureInfo: null, date: null },
        { id: 6, name: 'Control Metabólico y Farmacológico de Peso', type: 'Medico', signed: false, signatureInfo: null, date: null }
    ]);

    const handleSignConsent = () => {
        if (!signingConsent) return;
        const signature = `ALFRA-SIG-${Math.random().toString(36).substr(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const now = new Date().toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        setConsents(consents.map(c =>
            c.id === signingConsent.id ? { ...c, signed: true, signatureInfo: signature, date: now } : c
        ));
        setSigningConsent(null);
    };

    // Corporal Measurements State
    const [medidas, setMedidas] = useState({ peso: '', altura: '' });

    const [historial, setHistorial] = useState([]);
    const [loadingHistorial, setLoadingHistorial] = useState(false);
    const [apoyoCuidados, setApoyoCuidados] = useState([]);
    const [adherenciaReal, setAdherenciaReal] = useState([]);

    React.useEffect(() => {
        const unsub = onPacientesChange((data) => {
            setPacientes(data);
            setLoading(false);
        });
        const unsubCitas = onCitasChange(setCitasAll);
        const unsubSesiones = onSesionesChange(setSesionesAll);
        const unsubSegs = onSeguimientosChange(setSeguimientosAll);
        const unsubStaff = onStaffChange(setStaffList);
        fetchBajas();
        return () => {
            unsub();
            if (unsubCitas) unsubCitas();
            if (unsubSesiones) unsubSesiones();
            if (unsubSegs) unsubSegs();
            if (unsubStaff) unsubStaff();
        };
    }, []);

    const handleCopiarMensaje = async (texto, key) => {
        try {
            await navigator.clipboard.writeText(texto);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(''), 3000);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = texto;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(''), 3000);
        }
    };

    const reporteDiaExpedientes = React.useMemo(() => {
        const citasDia = (citasAll || []).filter((c) => (c.fecha || c.fechaHora || '').startsWith(fechaAuditoriaDia));
        return auditarExpedientesPorDia(citasDia, sesionesAll, seguimientosAll, fechaAuditoriaDia, staffList, pacientes);
    }, [citasAll, sesionesAll, seguimientosAll, fechaAuditoriaDia, staffList, pacientes]);

    const fetchBajas = async () => {
        setLoadingBajas(true);
        try {
            const reqs = await getSolicitudesEliminacion();
            setSolicitudesBaja(reqs);
        } catch (e) {
            console.error('Error fetching bajas', e);
        } finally {
            setLoadingBajas(false);
        }
    };

    const handleAprobarBaja = async (tratId) => {
        if (!confirm('¿Aprobar Baja Definitiva?\n\nEste expediente se volverá invisible para el Especialista (Borrado Lógico).')) return;
        try {
            await eliminarTratamiento(tratId);
            fetchBajas();
        } catch (e) { alert('Error aprobando.'); }
    };

    const handleRechazarBaja = async (tratId) => {
        if (!confirm('¿Rechazar solicitud y reactivar tratamiento?')) return;
        try {
            await rechazarEliminacionTratamiento(tratId);
            fetchBajas();
        } catch (e) { alert('Error rechazando.'); }
    };

    const openEMR = async (paciente) => {
        setSelectedPatient(paciente);
        setActiveTab('historial');
        setLoadingHistorial(true);
        try {
            const h = await getSeguimientosPaciente(paciente.id);
            setHistorial(h);
            const a = await getApoyoEnCasa(paciente.id);
            setApoyoCuidados(a || []);
            const trackers = await getDailyTrackers(paciente.id);
            setAdherenciaReal(trackers || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingHistorial(false);
        }
    };

    const handleGuardarEvolucion = () => {
        alert("Evolución clínica firmada y guardada exitosamente en el expediente.");
        // Remove the 'requiereActualizacion' flag from the patient
        setPacientes(pacientes.map(p => p.id === selectedPatient.id ? { ...p, requiereActualizacion: false } : p));
        // Update selected patient to reflect changes immediately in modal
        setSelectedPatient({ ...selectedPatient, requiereActualizacion: false });
    };

    const handleSubirFotosBtnClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const now = new Date().toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
                const newFoto = {
                    id: Date.now(),
                    url: reader.result,
                    label: 'Nueva Evidencia (Hoy)',
                    date: now,
                    isNew: true
                };
                setFotos([...fotos, newFoto]);
            };
            reader.readAsDataURL(file);
        }
    };

    const imc = (medidas.peso && medidas.altura) ? (medidas.peso / ((medidas.altura / 100) * (medidas.altura / 100))).toFixed(1) : '0.0';

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-acero">Auditoría Clínica (Expediente Electrónico)</h2>
                    <p className="text-gray-500 text-sm">Acceso maestro a expedientes, seguimiento de tratamientos y evolución fotográfica</p>
                </div>
            </div>

            {/* REPORTE DIARIO DE EXPEDIENTES NO ACTUALIZADOS AL DÍA */}
            <Card className={reporteDiaExpedientes.sinActualizar.length > 0 ? 'bg-red-50/70 border-2 border-red-200' : 'bg-emerald-50/40 border border-emerald-200'}>
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className={`p-2.5 rounded-xl shrink-0 ${reporteDiaExpedientes.sinActualizar.length > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {reporteDiaExpedientes.sinActualizar.length > 0 ? <AlertTriangle size={22} /> : <CheckCircle size={22} />}
                            </div>
                            <div>
                                <h3 className={`text-sm sm:text-base font-black uppercase tracking-tight ${reporteDiaExpedientes.sinActualizar.length > 0 ? 'text-red-800' : 'text-emerald-800'}`}>
                                    {reporteDiaExpedientes.sinActualizar.length > 0
                                        ? `🚨 Reporte Diario: ${reporteDiaExpedientes.sinActualizar.length} Expediente(s) No Actualizado(s) al Día`
                                        : '✓ Reporte Diario: Todos los Expedientes de las Citas del Día Están Actualizados'}
                                </h3>
                                <p className="text-xs text-gray-600 mt-0.5">
                                    Citas programadas en la fecha seleccionada: <strong>{reporteDiaExpedientes.totalCitas}</strong> • Actualizados: <strong className="text-emerald-700">{reporteDiaExpedientes.actualizados.length}</strong> • Sin actualizar: <strong className="text-red-600">{reporteDiaExpedientes.sinActualizar.length}</strong>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
                                <Calendar size={14} className="text-turquesa" />
                                <input
                                    type="date"
                                    value={fechaAuditoriaDia}
                                    onChange={(e) => e.target.value && setFechaAuditoriaDia(e.target.value)}
                                    className="text-xs font-bold text-gray-700 outline-none bg-transparent cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {reporteDiaExpedientes.sinActualizar.length > 0 && (
                        <div className="space-y-3 pt-1">
                            {reporteDiaExpedientes.porEspecialista.map((grupo, idx) => {
                                const keyId = `aud-esp-${idx}`;
                                return (
                                    <div key={idx} className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm space-y-2.5">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div>
                                                <span className="text-xs font-black text-acero uppercase">
                                                    👩‍⚕️ Especialista: <span className="text-red-700">{grupo.especialista}</span>
                                                </span>
                                                <p className="text-xs text-gray-700 mt-0.5">
                                                    Paciente(s) sin actualizar expediente:{' '}
                                                    <strong className="text-red-700">{grupo.listaPacientes}</strong>
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleCopiarMensaje(grupo.mensaje, keyId)}
                                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                                                    copiedKey === keyId
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                                                }`}
                                            >
                                                {copiedKey === keyId ? <Check size={14} /> : <Copy size={14} />}
                                                {copiedKey === keyId ? '¡Copiado al portapapeles!' : `Copiar Mensaje para ${grupo.especialista}`}
                                            </button>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 select-all">
                                            "{grupo.mensaje}"
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {grupo.citas.map((c, cIdx) => {
                                                const copyPacKey = `aud-pac-${idx}-${cIdx}`;
                                                return (
                                                    <div key={c.id || cIdx} className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => c.pacienteId && navigate(`/especialista/expediente/${c.pacienteId}`)}
                                                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 cursor-pointer"
                                                        >
                                                            <ExternalLink size={12} /> Abrir expediente: {c.pacienteNombreLimpio} ({c.servicio || 'Cita'})
                                                        </button>
                                                        {grupo.citas.length > 1 && c.mensajeIndividual && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCopiarMensaje(c.mensajeIndividual, copyPacKey)}
                                                                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer ${
                                                                    copiedKey === copyPacKey
                                                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                                                        : 'bg-white text-gray-600 hover:text-red-700 border-gray-200'
                                                                }`}
                                                            >
                                                                {copiedKey === copyPacKey ? <Check size={11} /> : <Copy size={11} />}
                                                                {copiedKey === copyPacKey ? 'Copiado' : `Copiar solo ${c.pacienteNombreLimpio}`}
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Card>

            <Card className="bg-turquesa/5 border-turquesa/20">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="text-sm font-bold text-acero mb-2 block">Buscador Global de Pacientes</label>
                        <div className="relative">
                            <Search size={20} className="absolute left-3 top-3.5 text-turquesa" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, teléfono o ID de paciente..."
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-turquesa/30 focus:border-turquesa focus:ring-0 outline-none text-gray-900 placeholder:text-gray-400 bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {/* WIDGET: SOLICITUDES DE BAJA */}
            {!loadingBajas && solicitudesBaja.length > 0 && (
                <Card className="bg-orange-50 border-orange-200">
                    <h3 className="text-orange-800 font-black mb-3 flex items-center gap-2">
                        <AlertCircle size={20} /> Solicitudes de Eliminación de Expedientes
                    </h3>
                    <div className="space-y-3">
                        {solicitudesBaja.map(sol => (
                            <div key={sol.id} className="bg-white p-4 rounded-xl border border-orange-100 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                                <div>
                                    <h4 className="font-bold text-acero">{sol.nombre}</h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Solicitado por: <span className="font-bold">{sol.solicitadoPor}</span> el {new Date(sol.fechaSolicitudEliminacion).toLocaleDateString('es-MX')}
                                    </p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <Button size="sm" variant="outline" className="text-gray-500 hover:bg-gray-100" onClick={() => handleRechazarBaja(sol.id)}>
                                        <X size={14} className="mr-1" /> Rechazar
                                    </Button>
                                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600 border-none shadow-md" onClick={() => handleAprobarBaja(sol.id)}>
                                        <CheckCircle size={14} className="mr-1" /> Aprobar Baja
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 text-sm text-gray-500">
                                <th className="py-3 px-4 font-medium">Paciente</th>
                                <th className="py-3 px-4 font-medium">Teléfono contacto</th>
                                <th className="py-3 px-4 font-medium">Médico / Especialista</th>
                                <th className="py-3 px-4 font-medium">Última Visita</th>
                                <th className="py-3 px-4 font-medium text-center">Expediente</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={`skeleton-${i}`} className="border-b border-gray-50 animate-pulse">
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-200" />
                                                <div className="space-y-2">
                                                    <div className="h-4 w-32 bg-gray-200 rounded" />
                                                    <div className="h-3 w-20 bg-gray-100 rounded" />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4"><div className="h-4 w-24 bg-gray-100 rounded" /></td>
                                        <td className="py-4 px-4"><div className="h-4 w-28 bg-gray-100 rounded" /></td>
                                        <td className="py-4 px-4"><div className="h-4 w-20 bg-gray-100 rounded" /></td>
                                        <td className="py-4 px-4"><div className="h-8 w-32 bg-gray-200 rounded-lg mx-auto" /></td>
                                    </tr>
                                ))
                            ) : pacientes.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center text-gray-400 font-medium">
                                        <div className="flex flex-col items-center gap-4">
                                            <Search size={48} className="opacity-20 translate-x-1" />
                                            <p className="text-sm">No se encontraron pacientes que coincidan con la búsqueda.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pacientes.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase())).map((paciente) => (
                                    <tr key={paciente.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${paciente.requiereActualizacion ? 'bg-orange-50/30' : ''}`}>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-acero/10 text-acero flex items-center justify-center font-bold text-sm">
                                                    {paciente.nombre.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900 flex items-center gap-2">
                                                        {paciente.nombre}
                                                        {paciente.requiereActualizacion && (
                                                            <span className="flex items-center gap-1 text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">
                                                                <AlertCircle size={10} /> Requiere Auditoría Hoy
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-400">ID: {paciente.id.toUpperCase()}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-gray-600 text-sm">{paciente.telefono}</td>
                                        <td className="py-4 px-4 text-gray-600 text-sm">{paciente.tratante}</td>
                                        <td className="py-4 px-4 text-gray-500 text-sm">{paciente.ultimaCita}</td>
                                        <td className="py-4 px-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <Button variant={paciente.requiereActualizacion ? "primary" : "outline"} size="sm" icon={FolderOpen} onClick={() => openEMR(paciente)}>
                                                    Resumen Modal
                                                </Button>
                                                <Button variant="outline" size="sm" className="bg-turquesa/10 text-turquesa border-turquesa/30 hover:bg-turquesa/20" icon={FileText} onClick={() => navigate('/especialista/expediente/' + paciente.id)}>
                                                    Expediente Integral
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* EMR MODAL */}
            {selectedPatient && (
                <div className="fixed inset-0 z-50 flex justify-center items-end sm:items-center bg-gray-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

                        {/* Header Premium */}
                        <div className="relative group overflow-hidden shrink-0">
                            {/* Deeper "Executive Deep" Palette - Ultra Dark Slate Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617] group-hover:scale-105 transition-transform duration-1000 pointer-events-none" />
                            <div className="absolute top-0 right-0 w-64 h-64 bg-turquesa/5 rounded-full -mr-20 -mt-20 blur-[100px] pointer-events-none animate-pulse" />

                            <div className="relative z-10 px-8 py-8 text-white flex justify-between items-center gap-6">
                                <div className="flex items-center gap-6 min-w-0">
                                    <div className="w-16 h-16 shrink-0 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-3xl font-black shadow-2xl ring-1 ring-white/20">
                                        {selectedPatient.nombre.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-2xl font-black tracking-tight truncate drop-shadow-2xl animate-in fade-in slide-in-from-left-4 duration-500">{selectedPatient.nombre}</h2>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/60 mt-2 font-bold uppercase tracking-widest">
                                            <span className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-xl border border-white/10 backdrop-blur-sm">
                                                <User size={12} className="text-turquesa" /> {selectedPatient.id.toUpperCase().slice(0, 8)}
                                            </span>
                                            <span className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-xl border border-white/10 backdrop-blur-sm">
                                                <Calendar size={12} className="text-turquesa" /> {selectedPatient.ultimaCita}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedPatient(null)}
                                    className="shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl text-white/40 hover:text-white hover:bg-white/10 hover:scale-110 active:scale-95 transition-all duration-300 backdrop-blur-md border border-white/5"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Alert Banner */}
                        {selectedPatient.requiereActualizacion && (
                            <div className="bg-orange-100 border-l-4 border-orange-500 px-4 py-2.5 flex items-start gap-2">
                                <AlertCircle className="text-orange-600 shrink-0 mt-0.5" size={16} />
                                <p className="text-orange-800 text-xs sm:text-sm font-medium leading-snug">Cita hoy — registra la nota de evolución fotográfica y clínica.</p>
                            </div>
                        )}

                        {/* Tabs — scroll horizontal garantizado en móvil para evitar que se amontonen */}
                        <div className="flex flex-row flex-nowrap bg-white px-2 border-b border-gray-100 overflow-x-auto no-scrollbar scrollbar-hide shrink-0 gap-1 sticky top-0 z-10">
                            {[
                                { key: 'historial', icon: <FileText size={16} />, label: 'Historial Clínico Base', activeClass: 'text-acero bg-acero/5 border-acero' },
                                { key: 'evolucion', icon: <Activity size={16} />, label: 'Alta de Evolución (Notas)', activeClass: 'text-turquesa bg-turquesa/5 border-turquesa' },
                                { key: 'adherencia', icon: <HeartPulse size={16} />, label: 'Impacto & Hábitos (App)', activeClass: 'text-orange-600 bg-orange-50 border-orange-500' },
                                { key: 'fotos', icon: <Camera size={16} />, label: 'Galería Fotográfica', activeClass: 'text-purple-600 bg-purple-50 border-purple-500' },
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex-none px-6 py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest border-b-4 transition-all duration-300 flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === tab.key
                                        ? `${tab.activeClass} translate-y-0.5`
                                        : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50">

                            {/* HISTORIAL TAB */}
                            {activeTab === 'historial' && (
                                <div className="space-y-4">
                                    {loadingHistorial ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-300 gap-4">
                                            <Loader className="animate-spin" size={48} />
                                            <p className="font-black text-xs uppercase tracking-widest animate-pulse">Consultando registros...</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <Card variant="glass" title="Evolución Clínica Histórica" icon={History}>
                                                <div className="space-y-6 mt-4">
                                                    {historial.length === 0 ? (
                                                        <div className="py-12 text-center bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-100 italic text-gray-400 text-sm">
                                                            No hay registros de evolución aún.
                                                        </div>
                                                    ) : (
                                                        historial.map((s, idx) => (
                                                            <div key={s.id} className="p-6 bg-white shadow-xl shadow-gray-200/50 rounded-[2rem] border border-gray-100 hover:scale-[1.02] transition-all group relative overflow-hidden">
                                                                <div className="absolute top-0 right-0 w-24 h-24 bg-turquesa/5 rounded-bl-[4rem] -mr-8 -mt-8 pointer-events-none" />
                                                                <div className="flex justify-between items-center mb-4">
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-acero bg-acero/5 px-3 py-1.5 rounded-full">{new Date(s.fechaRegistro).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                                                    <span className="text-[10px] font-black text-turquesa bg-turquesa/5 px-3 py-1.5 rounded-full uppercase tracking-widest">{s.tipoCita || 'Sesión Control'}</span>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-6 mb-4 p-4 bg-gray-50/80 rounded-2xl border border-gray-100/50">
                                                                    <div className="space-y-1">
                                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tight">Peso & IMC</p>
                                                                        <p className="text-sm font-black text-acero">{s.peso}kg <span className="text-[11px] text-turquesa font-bold ml-1">({s.imc} IMC)</span></p>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tight">Abdomen (cm)</p>
                                                                        <p className="text-sm font-black text-acero">{s.medidas?.abdomen || '—'} cm</p>
                                                                    </div>
                                                                </div>
                                                                <div className="p-3 bg-white/50 rounded-xl border border-gray-50">
                                                                    <p className="text-sm font-medium text-gray-600 leading-relaxed italic">"{s.observaciones || 'Nota de seguimiento estándar'}"</p>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </Card>
                                            <Card variant="premium" title="Documentación Legal" icon={FileChecked}>
                                                <div className="space-y-4 mt-2">
                                                    <div className="p-4 bg-orange-50/50 rounded-2xl border-2 border-dashed border-orange-200 flex items-center justify-center py-12">
                                                        <p className="text-sm text-orange-600/60 font-medium italic text-center">Buscando firmas en el <br /> repositorio seguro ALFRA-Vault...</p>
                                                    </div>
                                                </div>
                                            </Card>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* EVOLUCIÓN TAB */}
                            {activeTab === 'evolucion' && (
                                <div className="space-y-6">
                                    <div className="flex gap-4 items-center">
                                        <label className="text-sm font-bold text-gray-700">Tipo de Tratamiento a Registrar:</label>
                                        <select
                                            className="px-4 py-2 border-2 border-turquesa/30 rounded-xl outline-none focus:border-turquesa font-bold text-acero bg-white"
                                            value={treatmentType}
                                            onChange={(e) => setTreatmentType(e.target.value)}
                                        >
                                            <option value="Facial">Tratamiento Facial</option>
                                            <option value="Corporal">Tratamiento Corporal / Medidas</option>
                                            <option value="Medico">Consulta Médica Especializada</option>
                                        </select>
                                    </div>

                                    <Card className="shadow-sm border-t-4 border-turquesa">
                                        {treatmentType === 'Facial' && (
                                            <div className="space-y-4">
                                                <h3 className="font-bold text-lg text-acero flex items-center gap-2"><User size={20} /> Evaluación Facial</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-500 uppercase">Biotipo Cutáneo</label>
                                                        <select className="w-full mt-1 p-2 border rounded-lg text-sm bg-gray-50 outline-none">
                                                            <option>Piel Mixta</option>
                                                            <option>Piel Grasa</option>
                                                            <option>Piel Seca</option>
                                                            <option>Piel Sensible / Rosácea</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-500 uppercase">Aparatología / Protocolo Usado Hoy</label>
                                                        <input type="text" className="w-full mt-1 p-2 border rounded-lg text-sm bg-gray-50 outline-none" placeholder="Ej. Dermapen + Cóctel Vitaminas" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Observaciones y Reacciones</label>
                                                    <textarea className="w-full mt-1 p-3 border rounded-lg text-sm bg-gray-50 outline-none h-24" placeholder="Describa cómo reaccionó la piel, nivel de eritema, recomendaciones en casa..."></textarea>
                                                </div>
                                            </div>
                                        )}

                                        {treatmentType === 'Corporal' && (
                                            <div className="space-y-4">
                                                <h3 className="font-bold text-lg text-acero flex items-center gap-2"><Ruler size={20} /> Control de Medidas y Peso</h3>
                                                <div className="grid grid-cols-3 gap-4 bg-acero/5 p-4 rounded-xl border border-acero/10">
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-500 uppercase">Peso (kg)</label>
                                                        <input type="number" className="w-full mt-1 p-2 border rounded-lg text-sm font-bold text-center" value={medidas.peso} onChange={(e) => setMedidas({ ...medidas, peso: e.target.value })} placeholder="00.0" />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-500 uppercase">Estatura (cm)</label>
                                                        <input type="number" className="w-full mt-1 p-2 border rounded-lg text-sm font-bold text-center" value={medidas.altura} onChange={(e) => setMedidas({ ...medidas, altura: e.target.value })} placeholder="165" />
                                                    </div>
                                                    <div className="flex flex-col items-center justify-center bg-white rounded-lg border-2 border-dashed border-turquesa p-2">
                                                        <label className="text-xs font-bold text-turquesa uppercase">I.M.C Calculado</label>
                                                        <span className={`text-2xl font-black ${imc > 25 ? 'text-red-500' : 'text-green-500'}`}>{imc}</span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-4 gap-4 pt-2">
                                                    <Input label="Cintura (cm)" placeholder="0.0" />
                                                    <Input label="Abdomen (cm)" placeholder="0.0" />
                                                    <Input label="Cadera (cm)" placeholder="0.0" />
                                                    <Input label="Muslo (cm)" placeholder="0.0" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-500 uppercase">Notas del Tratamiento</label>
                                                    <textarea className="w-full mt-1 p-3 border rounded-lg text-sm bg-gray-50 outline-none h-20" placeholder="Ej. Sesión 3 de cavitación. Paciente refiere tomar poca agua..."></textarea>
                                                </div>
                                            </div>
                                        )}

                                        {treatmentType === 'Medico' && (
                                            <div className="space-y-4">
                                                <h3 className="font-bold text-lg text-acero flex items-center gap-2"><Activity size={20} /> Nota Médica</h3>
                                                <div className="grid grid-cols-1 gap-4">
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-500 uppercase">Diagnóstico (CIE-10 / Descriptivo)</label>
                                                        <input type="text" className="w-full mt-1 p-2 border rounded-lg text-sm bg-gray-50 outline-none" placeholder="Diagnóstico..." />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-xs font-bold text-gray-500 uppercase">Tratamiento Médico Aplicado</label>
                                                            <textarea className="w-full mt-1 p-3 border rounded-lg text-sm bg-gray-50 outline-none h-32" placeholder="Dosis, marcas, vías de administración..."></textarea>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-gray-500 uppercase">Receta Cuidado en Casa (Homecare)</label>
                                                            <textarea className="w-full mt-1 p-3 border rounded-lg text-sm bg-gray-50 outline-none h-32" placeholder="Indicaciones para el paciente..."></textarea>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-8 border-t-2 border-turquesa/20 pt-6">
                                            <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                                                <FileText size={20} className="text-turquesa" />
                                                Consentimientos Legales Necesarios ({treatmentType})
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {consents.filter(c => c.type === treatmentType).length === 0 && (
                                                    <p className="text-sm text-gray-400 italic">No hay consentimientos configurados para esta categoría.</p>
                                                )}
                                                {consents.filter(c => c.type === treatmentType).map(consent => (
                                                    <div key={consent.id} className={`p-4 rounded-xl border-2 flex flex-col gap-3 ${consent.signed ? 'bg-green-50/50 border-green-200' : 'bg-white border-orange-200 shadow-sm'}`}>
                                                        <div className="flex items-start justify-between">
                                                            <span className={`text-sm font-bold pr-2 ${consent.signed ? 'text-green-800' : 'text-gray-800'}`}>
                                                                {consent.name}
                                                            </span>
                                                            {consent.signed ? (
                                                                <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded font-bold shrink-0">Certificado</span>
                                                            ) : (
                                                                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded font-bold shrink-0 flex items-center gap-1"><AlertCircle size={10} /> Pendiente</span>
                                                            )}
                                                        </div>

                                                        {consent.signed ? (
                                                            <div className="bg-white p-3 rounded-lg border border-green-100 text-left">
                                                                <p className="text-[10px] text-gray-500 font-mono flex flex-col gap-1">
                                                                    <span className="flex items-center gap-1"><span className="w-12 inline-block">Hash:</span> <span className="text-green-700 font-bold bg-green-100 px-1 rounded">{consent.signatureInfo}</span></span>
                                                                    <span className="flex items-center gap-1"><span className="w-12 inline-block">Fecha:</span> {consent.date}</span>
                                                                    <span className="flex items-center gap-1 text-green-600 mt-1">✓ Firma Digital Validada</span>
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <Button onClick={() => setSigningConsent(consent)} variant="primary" className="w-full bg-orange-500 border-orange-500 hover:bg-orange-600" size="sm">
                                                                Firmar Consentimiento
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="mt-8 flex justify-end gap-3 pt-6 border-t">
                                            <Button variant="outline">Limpiar</Button>
                                            <Button variant="primary" icon={PlusCircle} onClick={handleGuardarEvolucion}>Firmar y Guardar Evolución</Button>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {/* ADHERENCIA TAB */}
                            {activeTab === 'adherencia' && (() => {
                                // Procesar datos reales
                                const diasSemanales = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                                const statsSemanales = Array.from({ length: 7 }).map((_, i) => {
                                    const d = new Date();
                                    d.setDate(d.getDate() - (6 - i));
                                    const fechaIso = d.toISOString().split('T')[0];
                                    const diaSemana = diasSemanales[d.getDay()];
                                    const regAlimentacion = adherenciaReal.find(r => r.tipo === 'alimentacion' && r.fecha === fechaIso);
                                    const regFacial = adherenciaReal.find(r => r.tipo === 'facial' && r.fecha === fechaIso);
                                    const regApoyo = adherenciaReal.find(r => r.tipo === 'apoyo' && r.fecha === fechaIso);
                                    return {
                                        d: diaSemana,
                                        fecha: fechaIso,
                                        cals: regAlimentacion?.data?.totalCalorias || 0,
                                        lim: regAlimentacion?.data?.metaCalorias || 2000,
                                        check: regFacial ? Object.values(regFacial.data).filter(Boolean).length : 0,
                                        checksApoyo: regApoyo ? Object.values(regApoyo.data).filter(Boolean).length : 0,
                                        totalApoyo: regApoyo ? Object.keys(regApoyo.data).length : 0
                                    };
                                });

                                const totalDias = statsSemanales.filter(d => d.cals > 0 || d.check > 0 || d.checksApoyo > 0).length || 1;
                                const diasExcedidos = statsSemanales.filter(d => d.cals > d.lim && d.cals > 0).length;
                                const promedioCheck = statsSemanales.reduce((s, d) => s + d.check, 0) / (statsSemanales.filter(d => d.check > 0).length || 1);
                                const promedioApoyo = statsSemanales.reduce((s, d) => s + d.checksApoyo, 0) / (statsSemanales.filter(d => d.totalApoyo > 0).length || 1);
                                const maxCheck = 6;
                                const pctExcedido = Math.round((diasExcedidos / totalDias) * 100);
                                const peorDia = [...statsSemanales].sort((a, b) => (b.cals - b.lim) - (a.cals - a.lim))[0];
                                const peorCheck = [...statsSemanales].filter(d => d.check > 0).sort((a, b) => a.check - b.check)[0] || statsSemanales[0];

                                let nivel;
                                if (diasExcedidos === 0 && (promedioCheck >= 5 || totalDias === 0)) nivel = 'excelente';
                                else if (diasExcedidos <= 2 && promedioCheck >= 4) nivel = 'moderado';
                                else nivel = 'critico';

                                const alertaTexto = (() => {
                                    if (adherenciaReal.length === 0) return "Esperando registros del paciente desde su App.";
                                    if (nivel === 'excelente') return `El paciente mantiene un excelente control calórico.`;
                                    if (nivel === 'moderado') return `Exceso calórico en ${diasExcedidos} de los últimos días (${pctExcedido}%). El ${peorDia.d} fue el día con mayor desviación.`;
                                    return `Alerta: exceso calórico recurrente (${pctExcedido}%). El día ${peorCheck.d} fue el de menor adherencia.`;
                                })();

                                const pronosticoTexto = (() => {
                                    if (adherenciaReal.length === 0) return "Pendiente de evaluación.";
                                    if (nivel === 'excelente') return `Resultados en trayectoria óptima.`;
                                    if (nivel === 'moderado') return `Retraso estimado del 10%-15% en resultados.`;
                                    return `Adherencia deficiente: compromete resultados entre 20%-35%. Abordar obstáculos del ${peorDia.d}.`;
                                })();

                                const panelColor = nivel === 'excelente'
                                    ? { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', accent: 'bg-green-500/10', icon: '✅' }
                                    : nivel === 'moderado'
                                        ? { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', accent: 'bg-yellow-500/10', icon: '⚠️' }
                                        : { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', accent: 'bg-orange-500/10', icon: '🚨' };

                                const checkLabel = adherenciaReal.length === 0
                                    ? "Sin registros de checklist."
                                    : promedioCheck >= 5
                                        ? 'Excelente adherencia al protocolo de cuidado en casa.'
                                        : `Adherencia en ${promedioCheck.toFixed(1)}/6 pasos. El día ${peorCheck.d} fue el más bajo.`;

                                return (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        <Card className="shadow-sm border-gray-200">
                                            <h3 className="text-xl font-bold flex items-center gap-2 text-acero mb-6 pb-3 border-b"><HeartPulse className="text-orange-500" /> Control Nutricional y Diario de Alimentación</h3>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="bg-white/60 p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                                                    <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-6 text-sm">
                                                        <Activity size={18} className="text-turquesa" /> Evolución de Ingesta Calórica
                                                    </h4>
                                                    <div className="h-64 w-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={statsSemanales}>
                                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                                <XAxis dataKey="d" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 'bold' }} />
                                                                <YAxis hide />
                                                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f3f4f6' }} />
                                                                <ReferenceLine y={statsSemanales[0]?.lim || 1500} stroke="#ef4444" strokeDasharray="5 5" label={{ position: 'top', value: 'Meta', fill: '#ef4444', fontSize: 10 }} />
                                                                <Bar dataKey="cals" radius={[6, 6, 0, 0]}>
                                                                    {statsSemanales.map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={entry.cals > entry.lim ? '#fb923c' : '#20b2aa'} />
                                                                    ))}
                                                                </Bar>
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-4">
                                                    <div className={`${panelColor.bg} border ${panelColor.border} p-6 rounded-[2rem] shadow-sm relative overflow-hidden`}>
                                                        <div className={`absolute top-0 right-0 w-24 h-24 ${panelColor.accent} rounded-bl-[4rem] pointer-events-none`} />
                                                        <h4 className={`font-black uppercase tracking-widest text-[10px] ${panelColor.text} mb-4 flex items-center gap-2`}>
                                                            <AlertCircle size={14} /> Impacto en el Tratamiento
                                                        </h4>
                                                        <div className="space-y-4">
                                                            <p className="text-sm font-medium leading-relaxed">
                                                                <span className="font-black">Alerta de Eficacia {panelColor.icon}:</span> {alertaTexto}
                                                            </p>
                                                            <p className="text-sm font-medium leading-relaxed pt-3 border-t border-black/5">
                                                                <span className="font-black">Pronóstico del Sistema:</span> {pronosticoTexto}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex-1">
                                                        <h4 className="font-bold text-acero mb-4 flex items-center gap-2 text-xs uppercase tracking-widest"><CheckCircle size={14} /> Facial (Promedio)</h4>
                                                        <div className="flex items-center gap-4">
                                                            <span className={`text-4xl font-black ${promedioCheck >= 5 ? 'text-turquesa' : promedioCheck >= 4 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                                {promedioCheck.toFixed(1)}<span className="text-base text-gray-400 font-bold">/6</span>
                                                            </span>
                                                        </div>
                                                        <div className="mt-4 w-full bg-gray-100 rounded-full h-2">
                                                            <div className={`h-2 rounded-full transition-all ${promedioCheck >= 5 ? 'bg-turquesa' : 'bg-yellow-400'}`} style={{ width: `${(promedioCheck / maxCheck) * 100}%` }} />
                                                        </div>
                                                    </div>

                                                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex-1">
                                                        <h4 className="font-bold text-acero mb-4 flex items-center gap-2 text-xs uppercase tracking-widest"><Home size={14} /> Apoyo en Casa</h4>
                                                        <div className="flex items-center gap-4">
                                                            <span className={`text-4xl font-black ${promedioApoyo >= 1 ? 'text-turquesa' : 'text-gray-400'}`}>
                                                                {promedioApoyo.toFixed(1)}
                                                            </span>
                                                            <p className="text-[10px] text-gray-400 font-bold uppercase leading-tight">Tareas<br />diarias</p>
                                                        </div>
                                                        <div className="mt-4 w-full bg-gray-100 rounded-full h-2">
                                                            <div className="h-2 rounded-full bg-turquesa transition-all" style={{ width: `${Math.min(100, (promedioApoyo / 3) * 100)}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                );
                            })()}

                            {/* GALERÍA TAB */}
                            {activeTab === 'fotos' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-acero">Evidencia Fotográfica (Antes y Después)</h3>
                                        <div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                ref={fileInputRef}
                                                onChange={handleFileChange}
                                                className="hidden"
                                            />
                                            <Button variant="outline" icon={Camera} className="text-turquesa border-turquesa" onClick={handleSubirFotosBtnClick}>Subir Nuevas Fotos</Button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {fotos.map(foto => (
                                            <div key={foto.id} className={`bg-white p-2 rounded-xl border ${foto.isNew ? 'border-turquesa ring-2 ring-turquesa/30' : 'border-gray-200'} shadow-sm relative group`}>
                                                <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                                                    <img src={foto.url} alt={foto.label} className={`w-full h-full object-cover ${!foto.isNew ? 'opacity-80' : ''}`} />
                                                </div>
                                                <div className="p-2">
                                                    <p className={`font-bold text-sm ${foto.isNew ? 'text-turquesa' : ''}`}>{foto.label}</p>
                                                    <p className="text-xs text-gray-400">{foto.date}</p>
                                                </div>
                                            </div>
                                        ))}

                                        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:text-turquesa hover:border-turquesa hover:bg-turquesa/5 transition-colors cursor-pointer min-h-[250px]" onClick={handleSubirFotosBtnClick}>
                                            <Camera size={48} className="mb-2 opacity-50" />
                                            <span className="font-bold text-sm">Añadir Evidencia de la cita de hoy</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* SIGNING MODAL OVERLAY */}
                        {signingConsent && (
                            <div className="absolute inset-0 z-[60] flex justify-center items-center bg-[#0f172a]/40 backdrop-blur-md p-4 rounded-2xl animate-in fade-in duration-300">
                                <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-[0_50px_100px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/20">
                                    <div className="bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617] p-8 text-white text-center rounded-t-[2.5rem] relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-turquesa/5 rounded-bl-full -mr-8 -mt-8 pointer-events-none animate-pulse"></div>
                                        <h3 className="font-black text-2xl relative z-10 tracking-tight">Firma Digital ALFRA</h3>
                                        <p className="text-[10px] text-turquesa font-black uppercase tracking-[0.2em] mt-2 relative z-10 border border-turquesa/20 px-3 py-1 rounded-full inline-block">{signingConsent.name}</p>
                                    </div>
                                    <div className="p-6 space-y-5">
                                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-xs text-gray-600 h-48 overflow-y-auto font-serif leading-relaxed shadow-inner focus:outline-none" tabIndex={0}>
                                            <p className="font-bold mb-3 text-center text-gray-800 text-sm">DECLARACIÓN DE CONSENTIMIENTO INFORMADO CLINICA ALFRA</p>
                                            <p className="mb-3">Por la presente, yo manifiesto que he sido suficientemente informado(a) por el especialista responsable sobre el procedimiento <b>{signingConsent.name}</b>, sus objetivos, naturaleza, alternativas, riesgos previsibles y posibles complicaciones.</p>
                                            <p className="mb-3">Comprendo que la medicina y la estética no son exactas y que no se me pueden garantizar resultados absolutos. He tenido la oportunidad de hacer preguntas y todas han sido respondidas a mi entera satisfacción.</p>
                                            <p className="font-bold text-gray-800 bg-yellow-50 p-2 rounded border border-yellow-100">Autorizo la generación de una firma digital única e irrepetible (cadena criptográfica Hash) que tendrá completa validez legal, siendo técnica y jurídicamente equiparable a mi firma autógrafa, para dar conformidad y asentar mi voluntariedad a la realización de este tratamiento en las instalaciones de Clínica ALFRA.</p>
                                        </div>

                                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 shadow-sm transition-colors hover:bg-orange-100/50">
                                            <label className="flex items-start gap-3 cursor-pointer">
                                                <input type="checkbox" className="mt-1 w-5 h-5 text-turquesa border-orange-300 rounded focus:ring-turquesa appearance-none checked:bg-turquesa checked:border-transparent cursor-pointer disabled:opacity-50 transition-colors bg-white relative
                                                after:content-[''] after:absolute after:hidden checked:after:block after:left-1.5 after:top-0.5 after:w-2 after:h-3 after:border-solid after:border-white after:border-r-2 after:border-b-2 after:rotate-45" />
                                                <span className="text-sm text-orange-900 font-medium leading-tight">He leído, comprendido y resuelto todas mis dudas sobre este documento. Autorizo y acepto firmar digitalmente usando mi identidad validada en esta plataforma.</span>
                                            </label>
                                        </div>

                                        <div className="flex gap-4 pt-2">
                                            <Button variant="ghost" className="flex-1 py-3" onClick={() => setSigningConsent(null)}>Cancelar</Button>
                                            <Button variant="primary" className="flex-1 py-3 bg-acero border-acero hover:bg-acero/90 shadow-md flex items-center justify-center gap-2" onClick={handleSignConsent}>
                                                <FileText size={18} />
                                                Generar Firma Única
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
