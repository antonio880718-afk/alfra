import React, { useState, useMemo } from 'react';
import { 
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User, Phone, 
    CheckCircle, AlertTriangle, Sparkles, Filter, Search, Plus, MapPin, 
    MessageCircle, DollarSign, ArrowRight, LayoutGrid, List, Check, Shield, 
    Stethoscope, Users, RefreshCw, FileText, ChevronDown, CheckCircle2,
    CalendarCheck, UserCheck, AlertCircle, X, UserX, Stamp, Bell
} from 'lucide-react';
import { 
    format, addDays, subDays, isToday 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { CABINAS_ALFRA } from '../../services/citasService';

// Paleta distinguida de colores para especialistas
const COLORES_ESPECIALISTAS = [
    { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-900', badge: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500' },
    { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-950', badge: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-500' },
    { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-950', badge: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
    { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-950', badge: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500' },
    { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-950', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-950', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
    { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-950', badge: 'bg-cyan-100 text-cyan-800', dot: 'bg-cyan-500' },
];

// Extractor robusto de fecha en formato YYYY-MM-DD
const getCitaFechaYMD = (c) => {
    if (!c) return '';
    if (c.fechaYMD && typeof c.fechaYMD === 'string') {
        return c.fechaYMD.trim();
    }
    if (c.fecha && typeof c.fecha === 'string') {
        const match = c.fecha.match(/^\d{4}-\d{2}-\d{2}/);
        if (match) return match[0];
    }
    if (c.fechaHora && typeof c.fechaHora === 'string') {
        const match = c.fechaHora.match(/^\d{4}-\d{2}-\d{2}/);
        if (match) return match[0];
    }
    if (c.fecha && typeof c.fecha.toDate === 'function') {
        try { return format(c.fecha.toDate(), 'yyyy-MM-dd'); } catch (e) {}
    }
    if (c.fechaHora && typeof c.fechaHora.toDate === 'function') {
        try { return format(c.fechaHora.toDate(), 'yyyy-MM-dd'); } catch (e) {}
    }
    if (c.fechaHora || c.fecha) {
        try {
            const d = new Date(c.fechaHora || c.fecha);
            if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
        } catch (e) {}
    }
    return '';
};

const getCitaHoraDisplay = (c) => {
    if (c.horaFormateada) return c.horaFormateada;
    if (c.hora) return c.hora;
    if (c.fechaHora && typeof c.fechaHora === 'string' && c.fechaHora.includes('T')) {
        try {
            const d = new Date(c.fechaHora);
            if (!isNaN(d.getTime())) return format(d, 'hh:mm a');
        } catch (e) {}
    }
    return '09:00';
};

export default function AgendaGlobalEjecutiva({
    citas = [],
    especialistas = [],
    pacientes = [],
    servicios = [],
    currentDate = new Date(),
    setCurrentDate = () => {},
    onAgendarCita = () => {},
    onReagendarCita = () => {},
    onEnviarWhatsApp = null,
    onCambiarStatus = null,
    onCobrarCita = null,
    onVerExpediente = null,
    onNotificarLlegada = null,
    onNoAsistio = null,
    onCancelarCita = null,
    onCompletarCita = null,
    onSellarVisita = null,
    sellandoCitaId = null,
    selloMsg = null,
    userRole = 'Administrador',
    currentStaffId = null
}) {
    // Submodo de organización para el día: 'cronologico' | 'por_especialista' | 'por_cabina'
    const [subModoDia, setSubModoDia] = useState('cronologico');

    // Filtros activos
    const [filtroEsp, setFiltroEsp] = useState('todos'); // 'todos' | 'mis_citas' | espId
    const [filtroCabina, setFiltroCabina] = useState('todas');
    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [busqueda, setBusqueda] = useState('');

    // Resuelve el título real y profesional del especialista (Cero asunciones)
    const getStaffInfo = (espId, espNombre) => {
        const esp = especialistas.find(s => 
            s.id === espId || 
            (s.nombre && espNombre && s.nombre.toLowerCase().trim() === espNombre.toLowerCase().trim()) ||
            (s.nombre && espId && s.nombre.toLowerCase().trim() === String(espId).toLowerCase().trim())
        );
        const puesto = (esp?.puesto || esp?.rol || '').trim();
        const pLow = puesto.toLowerCase();
        const name = esp?.nombre || espNombre || 'Por asignar';

        let titulo = name;
        if (pLow.includes('doctor') || pLow.includes('medic') || pLow.includes('médic')) {
            titulo = `Dr(a). ${name}`;
        } else if (pLow.includes('cosmet') || pLow.includes('cosmiat')) {
            titulo = `Cosmetóloga ${name}`;
        } else if (pLow.includes('nutri')) {
            titulo = `Nutrióloga/o ${name}`;
        } else if (pLow.includes('enferm')) {
            titulo = `Enfra. ${name}`;
        } else if (pLow.includes('terap')) {
            titulo = `Terapeuta ${name}`;
        } else if (puesto) {
            titulo = `${puesto}: ${name}`;
        }

        const hash = (espId || name).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const color = COLORES_ESPECIALISTAS[hash % COLORES_ESPECIALISTAS.length];

        return {
            esp,
            nombreOriginal: name,
            tituloCompleto: titulo,
            iniciales: name.split(' ').map(n => n[0]).slice(0, 2).join(''),
            color
        };
    };

    // Resuelve información de la cabina
    const getCabinaInfo = (cabinaId) => {
        if (!cabinaId) return { nombre: 'Sin Cabina', color: 'gray' };
        const found = CABINAS_ALFRA.find(c => c.id === cabinaId || c.nombre?.toLowerCase() === cabinaId.toLowerCase());
        return found || { nombre: cabinaId, color: 'slate' };
    };

    // Calcular minutos de espera
    const getMinutosEspera = (llegadaAt) => {
        if (!llegadaAt) return 0;
        try {
            const fechaLlegada = llegadaAt.toDate ? llegadaAt.toDate() : new Date(llegadaAt);
            const diffMs = new Date() - fechaLlegada;
            return Math.max(0, Math.floor(diffMs / 60000));
        } catch (e) {
            return 0;
        }
    };

    // Navegación ágil de días
    const handlePrev = () => setCurrentDate(prev => subDays(prev, 1));
    const handleNext = () => setCurrentDate(prev => addDays(prev, 1));
    const handleHoy = () => setCurrentDate(new Date());

    // Filtrado inteligente de citas
    const filtrarCitas = (lista) => {
        if (!lista || lista.length === 0) return [];
        return lista.filter(cita => {
            const espId = cita.especialistaId || '';
            const espNombre = (cita.especialistaNombre || cita.especialista || '').toLowerCase().trim();

            // Filtro especialista
            if (filtroEsp === 'mis_citas' && currentStaffId) {
                const curId = String(currentStaffId).toLowerCase().trim();
                const matchId = espId && espId.toLowerCase() === curId;
                const matchNom = espNombre.includes(curId);
                if (!matchId && !matchNom) return false;
            } else if (filtroEsp !== 'todos') {
                const target = String(filtroEsp).toLowerCase().trim();
                const matchId = espId && espId.toLowerCase() === target;
                const matchNom = espNombre && (espNombre === target || espNombre.includes(target) || target.includes(espNombre));
                if (!matchId && !matchNom) return false;
            }

            // Filtro cabina
            if (filtroCabina !== 'todas') {
                if (cita.cabina !== filtroCabina) return false;
            }

            // Filtro status
            if (filtroStatus !== 'todos') {
                if (cita.status !== filtroStatus) return false;
            }

            // Búsqueda en vivo
            if (busqueda.trim()) {
                const b = busqueda.toLowerCase().trim();
                const pac = (cita.paciente || cita.pacienteNombre || '').toLowerCase();
                const serv = (cita.servicio || cita.servicioNombre || cita.tratamiento || '').toLowerCase();
                if (!pac.includes(b) && !serv.includes(b) && !espNombre.includes(b)) {
                    return false;
                }
            }

            return true;
        });
    };

    // Citas del día actual
    const citasDelDia = useMemo(() => {
        const diaStr = format(currentDate, 'yyyy-MM-dd');
        const filtradas = citas.filter(c => getCitaFechaYMD(c) === diaStr);
        return filtrarCitas(filtradas).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    }, [citas, currentDate, filtroEsp, filtroCabina, filtroStatus, busqueda, currentStaffId]);

    // Resumen de métricas del día
    const metricas = useMemo(() => {
        const total = citasDelDia.length;
        const enEspera = citasDelDia.filter(c => c.status === 'En Sala de Espera').length;
        const enAtencion = citasDelDia.filter(c => c.status === 'En Cabina' || c.status === 'En Consulta' || c.status === 'En Atención').length;
        const completadas = citasDelDia.filter(c => c.status === 'Completada' || c.status === 'Realizada').length;
        const pagadas = citasDelDia.filter(c => c.estadoPago === 'Pagado' || c.pagado === true).length;

        return { total, enEspera, enAtencion, completadas, pagadas };
    }, [citasDelDia]);

    // Render de una Tarjeta Ejecutiva de Cita
    const renderCitaCard = (cita) => {
        const staff = getStaffInfo(cita.especialistaId, cita.especialistaNombre || cita.especialista);
        const cabina = getCabinaInfo(cita.cabina);
        const esEspera = cita.status === 'En Sala de Espera';
        const minEspera = esEspera ? getMinutosEspera(cita.llegadaAt) : 0;
        const esCompletada = cita.status === 'Completada' || cita.status === 'Realizada';
        const esCancelada = cita.status === 'Cancelada';
        const esNoAsistio = cita.status === 'No Asistió';
        const esEnCabina = cita.status === 'En Cabina' || cita.status === 'En Consulta' || cita.status === 'En Atención';
        const estaPagada = cita.estadoPago === 'Pagado' || cita.pagado === true;

        return (
            <div 
                key={cita.id}
                className={`group relative bg-white border rounded-3xl transition-all duration-200 hover:shadow-xl ${
                    esEnCabina 
                        ? 'border-indigo-400 ring-2 ring-indigo-200 shadow-md' 
                        : esEspera 
                            ? 'border-amber-300 ring-2 ring-amber-200 shadow-md' 
                            : esCancelada
                                ? 'border-rose-200 bg-rose-50/20 opacity-70'
                                : esNoAsistio
                                    ? 'border-orange-200 bg-orange-50/20 opacity-80'
                                    : 'border-slate-200/90 hover:border-turquesa/60 shadow-sm'
                } p-4 space-y-3`}
            >
                {/* Cabecera de la Cita: Hora, Cabina y Estado */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1 bg-slate-900 text-white rounded-xl text-xs font-black tracking-tight flex items-center gap-1.5 shadow-sm">
                            <Clock size={12} className="text-turquesa" />
                            {getCitaHoraDisplay(cita)}
                        </span>
                        {cita.duracionMin && (
                            <span className="text-[11px] font-bold text-slate-400">
                                {cita.duracionMin} min
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5">
                        {/* Badge de Cabina */}
                        {cita.cabina && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[130px]">
                                🚪 {cabina.nombre.replace(/Cabina\s*/i, 'C.')}
                            </span>
                        )}

                        {/* Estado Clínico */}
                        {esEspera ? (
                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md flex items-center gap-1 animate-pulse ${
                                minEspera >= 15 ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}>
                                <Clock size={10} /> Espera {minEspera}m
                            </span>
                        ) : esEnCabina ? (
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200 flex items-center gap-1">
                                <Sparkles size={10} className="text-indigo-600" /> En Cabina
                            </span>
                        ) : esCompletada ? (
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                <Check size={10} /> Realizada
                            </span>
                        ) : esCancelada ? (
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                                Cancelada
                            </span>
                        ) : esNoAsistio ? (
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-orange-100 text-orange-800 border border-orange-200">
                                No Asistió
                            </span>
                        ) : (
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200">
                                Confirmada
                            </span>
                        )}
                    </div>
                </div>

                {/* Paciente y Teléfono */}
                <div className="space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                        <h4 className="font-black text-base text-slate-900 leading-tight truncate group-hover:text-turquesa transition-colors">
                            {cita.paciente || cita.pacienteNombre || 'Paciente'}
                        </h4>
                        {cita.esTratamientoActivo && (
                            <span className="shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-0.5" title="Sesión de Tratamiento Activo">
                                ✨ Plan Activo
                            </span>
                        )}
                    </div>
                    {cita.telefono && (
                        <p className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                            <Phone size={11} className="text-slate-400" /> {cita.telefono}
                        </p>
                    )}
                </div>

                {/* Tratamiento / Servicio */}
                <div className="p-2.5 bg-slate-50/90 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-xs font-bold text-slate-800 leading-tight block">
                        {cita.servicio || cita.servicioNombre || cita.tratamiento || 'Servicio General'}
                    </span>
                </div>

                {/* Quién Atiende (Especialista con puesto real) */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-2 truncate">
                        <div className={`w-7 h-7 rounded-xl ${staff.color.bg} ${staff.color.text} border ${staff.color.border} flex items-center justify-center font-black text-[11px] shrink-0`}>
                            {staff.iniciales}
                        </div>
                        <div className="truncate">
                            <span className="text-xs font-black text-slate-800 block truncate">
                                {staff.tituloCompleto}
                            </span>
                        </div>
                    </div>

                    {/* Estado de Cobro Claro (Sin confusión con Pendiente) */}
                    <div>
                        {estaPagada ? (
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <DollarSign size={10} /> Pagada
                            </span>
                        ) : Number(cita.monto) > 0 ? (
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <DollarSign size={10} /> Cobro: ${Number(cita.monto).toLocaleString('es-MX')}
                            </span>
                        ) : (
                            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                                <DollarSign size={10} /> Cobro en Caja
                            </span>
                        )}
                    </div>
                </div>

                {/* Feedback de Sello de Lealtad si aplica */}
                {selloMsg && selloMsg.citaId === cita.id && (
                    <div className={`p-2 rounded-xl text-xs font-bold border ${selloMsg.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'} animate-in fade-in`}>
                        {selloMsg.msg}
                    </div>
                )}

                {/* BARRA DE ACCIONES COMPLETAS (Llegada, WhatsApp, Reagendar, Expediente, Completar, No Asistió, Cancelar, Sellar) */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {/* 1. Notificar Llegada */}
                        {!esCompletada && !esCancelada && !esNoAsistio && (
                            <button
                                type="button"
                                onClick={() => onNotificarLlegada ? onNotificarLlegada(cita) : onCambiarStatus?.(cita.id, 'En Sala de Espera', { llegadaAt: new Date() })}
                                className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 border border-blue-200 flex items-center justify-center transition-all shadow-sm active:scale-95"
                                title="Notificar Llegada (Pasa a Sala de Espera)"
                            >
                                <Bell size={14} />
                            </button>
                        )}

                        {/* 2. WhatsApp */}
                        {onEnviarWhatsApp && (
                            <button
                                type="button"
                                onClick={() => onEnviarWhatsApp(cita)}
                                className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600 border border-emerald-200 flex items-center justify-center transition-all shadow-sm active:scale-95"
                                title="Enviar WhatsApp de confirmación / recordatorio"
                            >
                                <MessageCircle size={14} />
                            </button>
                        )}

                        {/* 3. Reagendar Rápido (Fecha, Hora y Cabina) */}
                        {!esCompletada && !esCancelada && onReagendarCita && (
                            <button
                                type="button"
                                onClick={() => onReagendarCita(cita)}
                                className="w-8 h-8 rounded-xl bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-600 border border-purple-200 flex items-center justify-center transition-all shadow-sm active:scale-95"
                                title="Reagendar Cita (Fecha, Hora y Cabina)"
                            >
                                <CalendarIcon size={14} />
                            </button>
                        )}

                        {/* 4. Ver Expediente */}
                        {onVerExpediente && (
                            <button
                                type="button"
                                onClick={() => onVerExpediente(cita)}
                                className="w-8 h-8 rounded-xl bg-sky-50 hover:bg-sky-600 hover:text-white text-sky-600 border border-sky-200 flex items-center justify-center transition-all shadow-sm active:scale-95"
                                title="Abrir Expediente Clínico del Paciente"
                            >
                                <FileText size={14} />
                            </button>
                        )}

                        {/* 5. Completar Cita (Validando expediente) */}
                        {!esCompletada && !esCancelada && !esNoAsistio && onCompletarCita && (
                            <button
                                type="button"
                                onClick={() => onCompletarCita(cita.id)}
                                className="w-8 h-8 rounded-xl bg-green-50 hover:bg-green-600 hover:text-white text-green-600 border border-green-200 flex items-center justify-center transition-all shadow-sm active:scale-95"
                                title="Completar Cita"
                            >
                                <CheckCircle size={14} />
                            </button>
                        )}

                        {/* 6. No Asistió */}
                        {!esCompletada && !esCancelada && !esNoAsistio && onNoAsistio && (
                            <button
                                type="button"
                                onClick={() => onNoAsistio(cita.id)}
                                className="w-8 h-8 rounded-xl bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-600 border border-amber-200 flex items-center justify-center transition-all shadow-sm active:scale-95"
                                title="Marcar que el Paciente No Asistió"
                            >
                                <UserX size={14} />
                            </button>
                        )}

                        {/* 7. Cancelar Cita */}
                        {!esCompletada && !esCancelada && !esNoAsistio && onCancelarCita && (
                            <button
                                type="button"
                                onClick={() => onCancelarCita(cita.id)}
                                className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 border border-rose-200 flex items-center justify-center transition-all shadow-sm active:scale-95"
                                title="Cancelar Cita"
                            >
                                <X size={14} />
                            </button>
                        )}

                        {/* 8. Sellar Visita (Tarjeta de Lealtad) — Manualmente desde Recepción */}
                        {esCompletada && onSellarVisita && (
                            <button
                                type="button"
                                onClick={() => onSellarVisita(cita)}
                                disabled={sellandoCitaId === cita.id}
                                className="h-8 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
                                title="Sellar visita en Tarjeta de Lealtad Digital (Acción Manual)"
                            >
                                <Stamp size={14} />
                                <span>{sellandoCitaId === cita.id ? 'Sellando...' : '🪷 Sellar Visita'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* BARRA SUPERIOR: CONTROLES, NAVEGACIÓN DE DÍA Y FILTROS */}
            <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Navegación y Fecha del Día */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                            <button
                                type="button"
                                onClick={handlePrev}
                                className="w-9 h-9 rounded-xl hover:bg-white text-slate-700 flex items-center justify-center transition-colors shadow-none hover:shadow-sm"
                                title="Día Anterior"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={handleHoy}
                                className="px-3.5 h-9 rounded-xl font-black text-xs uppercase tracking-wider bg-white text-slate-900 hover:text-turquesa transition-colors shadow-sm"
                            >
                                Hoy
                            </button>
                            <button
                                type="button"
                                onClick={handleNext}
                                className="w-9 h-9 rounded-xl hover:bg-white text-slate-700 flex items-center justify-center transition-colors shadow-none hover:shadow-sm"
                                title="Día Siguiente"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl md:text-2xl font-black text-slate-900 capitalize tracking-tight leading-none">
                                    {format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: es })}
                                </h2>
                                {isToday(currentDate) && (
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-turquesa/10 text-turquesa border border-turquesa/30">
                                        Hoy
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-semibold text-slate-400 mt-0.5">
                                Agenda Diaria Clínica ALFRA • {metricas.total} {metricas.total === 1 ? 'cita programada' : 'citas programadas'}
                            </p>
                        </div>
                    </div>

                    {/* Botón Agendar Cita */}
                    <div>
                        <button
                            type="button"
                            onClick={() => onAgendarCita()}
                            className="h-10 px-5 rounded-2xl bg-turquesa hover:bg-turquesa/90 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-turquesa/20 transition-all hover:scale-105 active:scale-95 shrink-0"
                        >
                            <Plus size={16} /> Agendar Cita
                        </button>
                    </div>
                </div>

                {/* TARJETAS DE MÉTRICAS DEL DÍA */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-3 border-t border-slate-100">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Citas</span>
                        <span className="text-xl font-black text-slate-900">{metricas.total}</span>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/80">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">En Sala Espera</span>
                        <span className="text-xl font-black text-amber-900">{metricas.enEspera}</span>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200/80">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block">En Cabina</span>
                        <span className="text-xl font-black text-indigo-950">{metricas.enAtencion}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200/80">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">Completadas</span>
                        <span className="text-xl font-black text-emerald-900">{metricas.completadas}</span>
                    </div>
                    <div className="p-3 bg-cyan-50 rounded-2xl border border-cyan-200/80 col-span-2 sm:col-span-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-cyan-700 block">Pagadas</span>
                        <span className="text-xl font-black text-cyan-950">{metricas.pagadas}</span>
                    </div>
                </div>

                {/* FILTROS POR ESPECIALISTA, CABINA Y BÚSQUEDA */}
                <div className="pt-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Filtro Píldoras Especialistas */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1">
                            <Users size={12} /> Atiende:
                        </span>
                        <button
                            type="button"
                            onClick={() => setFiltroEsp('todos')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 transition-all ${
                                filtroEsp === 'todos'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Todos
                        </button>
                        {currentStaffId && (
                            <button
                                type="button"
                                onClick={() => setFiltroEsp('mis_citas')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 transition-all ${
                                    filtroEsp === 'mis_citas'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                                }`}
                            >
                                ⭐ Mis Citas
                            </button>
                        )}
                        {especialistas.map(esp => {
                            const info = getStaffInfo(esp.id, esp.nombre);
                            const isSelected = filtroEsp === esp.id || filtroEsp === esp.nombre;
                            return (
                                <button
                                    key={esp.id}
                                    type="button"
                                    onClick={() => setFiltroEsp(esp.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                                        isSelected
                                            ? `${info.color.bg} ${info.color.text} border-2 ${info.color.border} shadow-sm font-black`
                                            : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${info.color.dot}`} />
                                    <span>{esp.nombre.split(' ')[0]}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Buscador Rápido y Filtro Cabina */}
                    <div className="flex items-center gap-2">
                        <select
                            value={filtroCabina}
                            onChange={e => setFiltroCabina(e.target.value)}
                            className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-turquesa"
                        >
                            <option value="todas">🚪 Todas las Cabinas</option>
                            {CABINAS_ALFRA.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                        </select>

                        <div className="relative flex-1 md:w-56">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar paciente / servicio..."
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-turquesa"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ORGANIZACIÓN DEL DÍA (Cronológico, Por Especialista, Por Cabina) */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Ver Por:</span>
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setSubModoDia('cronologico')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                                    subModoDia === 'cronologico' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                Cronológico
                            </button>
                            <button
                                type="button"
                                onClick={() => setSubModoDia('por_especialista')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                                    subModoDia === 'por_especialista' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                Por Especialista
                            </button>
                            <button
                                type="button"
                                onClick={() => setSubModoDia('por_cabina')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                                    subModoDia === 'por_cabina' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                Por Cabina
                            </button>
                        </div>
                    </div>

                    <span className="text-xs font-black text-slate-700">
                        {citasDelDia.length} citas programadas para hoy
                    </span>
                </div>

                {citasDelDia.length === 0 ? (
                    <div className="p-16 text-center bg-white rounded-3xl border border-slate-200/80 text-slate-400 space-y-3">
                        <CalendarIcon size={48} className="mx-auto opacity-30 text-turquesa" />
                        <h3 className="font-black text-base text-slate-700 uppercase tracking-wider">No hay citas programadas para este día</h3>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            Puedes agendar una nueva cita o consultar otros días con las flechas de navegación.
                        </p>
                        <button
                            type="button"
                            onClick={() => onAgendarCita({ fecha: format(currentDate, 'yyyy-MM-dd') })}
                            className="px-5 py-2.5 rounded-2xl bg-turquesa text-white font-black text-xs uppercase tracking-wider shadow-md hover:scale-105 transition-all"
                        >
                            + Agendar Primera Cita
                        </button>
                    </div>
                ) : subModoDia === 'cronologico' ? (
                    /* Submodo 1: Cronológico en tarjetas ejecutivas amplias */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {citasDelDia.map(cita => renderCitaCard(cita))}
                    </div>
                ) : subModoDia === 'por_especialista' ? (
                    /* Submodo 2: Columnas en paralelo por Especialista */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {especialistas.map(esp => {
                            const info = getStaffInfo(esp.id, esp.nombre);
                            const citasEsp = citasDelDia.filter(c => 
                                c.especialistaId === esp.id || 
                                (c.especialistaNombre && c.especialistaNombre.toLowerCase() === esp.nombre.toLowerCase())
                            );

                            return (
                                <div key={esp.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
                                    <div className={`p-4 border-b ${info.color.bg} ${info.color.border} flex items-center justify-between`}>
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-xl bg-white ${info.color.text} flex items-center justify-center font-black text-xs shadow-sm`}>
                                                {info.iniciales}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-xs text-slate-900 leading-tight">
                                                    {info.tituloCompleto}
                                                </h4>
                                                <span className="text-[10px] font-bold text-slate-500">
                                                    {citasEsp.length} {citasEsp.length === 1 ? 'cita' : 'citas'}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onAgendarCita({ especialistaId: esp.id, especialistaNombre: esp.nombre })}
                                            className="w-7 h-7 rounded-xl bg-white hover:bg-slate-900 hover:text-white text-slate-700 flex items-center justify-center transition-colors shadow-sm"
                                            title={`Agendar con ${esp.nombre.split(' ')[0]}`}
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>

                                    <div className="p-3 flex-1 space-y-3 overflow-y-auto max-h-[700px]">
                                        {citasEsp.length === 0 ? (
                                            <div className="py-12 text-center text-slate-300">
                                                <p className="text-xs font-bold uppercase tracking-wider">Sin citas hoy</p>
                                            </div>
                                        ) : (
                                            citasEsp.map(c => renderCitaCard(c))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Submodo 3: Columnas por Cabinas */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {CABINAS_ALFRA.map(cab => {
                            const citasCab = citasDelDia.filter(c => c.cabina === cab.id);

                            return (
                                <div key={cab.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
                                    <div className="p-4 border-b bg-slate-50 border-slate-200/80 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">🚪</span>
                                            <div>
                                                <h4 className="font-black text-xs text-slate-900">{cab.nombre}</h4>
                                                <span className="text-[10px] font-bold text-slate-500">
                                                    {citasCab.length} {citasCab.length === 1 ? 'cita' : 'citas'}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onAgendarCita({ cabina: cab.id })}
                                            className="w-7 h-7 rounded-xl bg-white hover:bg-slate-900 hover:text-white text-slate-700 flex items-center justify-center transition-colors shadow-sm"
                                            title={`Agendar en ${cab.nombre}`}
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>

                                    <div className="p-3 flex-1 space-y-3 overflow-y-auto max-h-[700px]">
                                        {citasCab.length === 0 ? (
                                            <div className="py-12 text-center text-slate-300">
                                                <p className="text-xs font-bold uppercase tracking-wider">Cabina Disponible</p>
                                            </div>
                                        ) : (
                                            citasCab.map(c => renderCitaCard(c))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
