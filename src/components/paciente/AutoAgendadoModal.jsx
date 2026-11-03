import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../ui/Button';
import { X, Calendar as CalendarIcon, Clock, Loader2, Info, Search, Sparkles, Check, ChevronRight, Package, HeartPulse, User } from 'lucide-react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStaff } from '../../services/staffService';
import { createCita } from '../../services/citasService';
import { onServiciosChange } from '../../services/comercialService';

// Funciones de categorización inteligente basadas en el catálogo real de Clínica ALFRA
export const inferCategoriaServicio = (nombre = '', catExistente = '') => {
    if (catExistente && catExistente !== 'undefined') return catExistente;
    const n = String(nombre).toLowerCase();
    if (/l[aá]ser|depilaci/i.test(n)) return 'Depilación Láser';
    if (/facial|dermapen|acn[eé]|melasma|peel|glow|microdermo|hidra lips|despigmenta/i.test(n)) return 'Facial';
    if (/post\s*operatorio|pre\s*operatorio|lipoescultura/i.test(n)) return 'Post-Op';
    if (/masaje.*relajante|piedras|spa|chakras|biomagnetismo|experiencia.*relajante/i.test(n)) return 'Masajes y Spa';
    if (/capilar|cabello/i.test(n)) return 'Capilar';
    if (/reductiv|anticelulitis|papada|lipoenzimas|gl[uú]teo|abdomen|brazos|body|push up|piernas|lipo sin bisturi|estrias|fit/i.test(n)) return 'Corporal';
    if (/cx|rinoplastia|escleroterapia|botox|valoraci|verrugas|tatuajes/i.test(n)) return 'Médico / Especial';
    return 'General';
};

export const detectEsPaqueteServicio = (item) => {
    if (!item) return false;
    if (item.esPaquete === true) return true;
    if (item.tipo === 'Paquete / Plan Tratamiento') return true;
    const n = String(item.nombre || '').toLowerCase();
    return /\(\s*paq|\bpaquete\b|efecto lipo sin bisturi/i.test(n);
};

// Catálogo base de respaldo si la base de datos de servicios estuviera vacía
const SERVICIOS_FALLBACK = [
    { id: 'fb_1', nombre: 'Limpieza Facial Profunda', tipo: 'Facial', duracionMinutos: 60, precioVenta: 650, descripcion: 'Higiene epidérmica, desobstrucción de poros y alta hidratación.' },
    { id: 'fb_2', nombre: 'Dermapen con Activos', tipo: 'Facial', duracionMinutos: 60, precioVenta: 1200, descripcion: 'Bioestimulación de colágeno para firmeza y rejuvenecimiento.' },
    { id: 'fb_3', nombre: 'Peeling Químico Renovador', tipo: 'Facial', duracionMinutos: 45, precioVenta: 950, descripcion: 'Renovación de capas celulares y unificación del tono.' },
    { id: 'fb_4', nombre: 'Efecto Lipo Sin Cirugía', tipo: 'Corporal', duracionMinutos: 90, precioVenta: 1400, descripcion: 'Cavitación, radiofrecuencia y lipoláser para movilización de grasa.' },
    { id: 'fb_5', nombre: 'Reductivo & Drenaje Linfático', tipo: 'Corporal', duracionMinutos: 60, precioVenta: 850, descripcion: 'Modelado de silueta, desinflamación y depuración linfática.' },
    { id: 'fb_6', nombre: 'Reafirmante y Tensado Cutáneo', tipo: 'Corporal', duracionMinutos: 60, precioVenta: 900, descripcion: 'Radiofrecuencia multipolar para tonificación y elasticidad.' },
    { id: 'fb_7', nombre: 'Paquete Silueta Perfecta (Sesión)', tipo: 'Paquetes', duracionMinutos: 90, precioVenta: 1100, descripcion: 'Sesión integral de aparatología combinada facial y corporal.' },
    { id: 'fb_8', nombre: 'Valoración y Diagnóstico Clínico', tipo: 'Valoración', duracionMinutos: 30, precioVenta: 350, descripcion: 'Diagnóstico biométrico y diseño del plan de tratamiento.' },
];

const toHHMM = (d) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function AutoAgendadoModal({ isOpen, onClose, paciente, onAgendado }) {
    const [step, setStep] = useState(1);
    const [diasDisponibles, setDiasDisponibles] = useState([]);

    // Catálogo de servicios desde Firestore
    const [catalogoServicios, setCatalogoServicios] = useState([]);
    const [categoriaFiltro, setCategoriaFiltro] = useState('todos'); // 'todos' | 'Facial' | 'Corporal' | 'Paquetes'
    const [busquedaServicio, setBusquedaServicio] = useState('');
    const [servicioSeleccionado, setServicioSeleccionado] = useState(null);

    // Selecciones del usuario
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');

    // Estado de búsqueda de horarios
    const [hasSearched, setHasSearched] = useState(false);
    const [loadingHorarios, setLoadingHorarios] = useState(false);
    const [horariosDisponibles, setHorariosDisponibles] = useState([]);

    const [loadingSubmit, setLoadingSubmit] = useState(false);

    // Escuchar servicios en tiempo real desde Firestore (Catálogo oficial dinámico)
    useEffect(() => {
        const unsub = onServiciosChange((items) => {
            if (items && items.length > 0) {
                // Filtrar items deshabilitados o pruebas administrativas de $1 a $10
                const validos = items.filter(s => {
                    if (s.activo === false) return false;
                    const p = Number(s.precioVenta || s.precio || 0);
                    if (p > 0 && p <= 10) return false;
                    return true;
                });

                const procesados = validos.map(s => {
                    const esPaq = detectEsPaqueteServicio(s);
                    const cat = inferCategoriaServicio(s.nombre, s.categoria);
                    let dur = Number(s.duracionMinutos || s.duracionMin || s.duracion || 0);
                    if (!dur || dur <= 0) {
                        dur = esPaq ? 90 : (cat === 'Facial' ? 60 : cat === 'Depilación Láser' ? 30 : 60);
                    }
                    return {
                        id: s.id,
                        nombre: s.nombre || 'Servicio ALFRA',
                        categoria: cat,
                        tipo: s.tipo || (esPaq ? 'Paquete / Plan Tratamiento' : 'Servicio Individual'),
                        duracionMinutos: dur,
                        precioVenta: Number(s.precioVenta || s.precio || 0),
                        descripcion: s.descripcion || s.beneficios || '',
                        esPaquete: esPaq
                    };
                });
                setCatalogoServicios(procesados);
            } else {
                setCatalogoServicios(SERVICIOS_FALLBACK);
            }
        });
        return () => unsub && unsub();
    }, []);

    // Reset al abrir/cerrar
    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setSelectedDate('');
            setServicioSeleccionado(null);
            setSelectedTime('');
            setHasSearched(false);
            setHorariosDisponibles([]);
            setBusquedaServicio('');
            return;
        }

        // Generar los próximos 14 días (excluyendo domingos)
        const dias = [];
        const hoy = new Date();
        for (let i = 1; i <= 14; i++) {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() + i);
            if (d.getDay() !== 0) {
                dias.push({
                    dateString: d.toISOString().split('T')[0],
                    diaSemana: d.toLocaleDateString('es-MX', { weekday: 'short' }),
                    dia: d.getDate(),
                    mes: d.toLocaleDateString('es-MX', { month: 'short' }),
                });
            }
        }
        setDiasDisponibles(dias);
    }, [isOpen]);

    // Servicios filtrados por categoría y búsqueda sobre catálogo real de ALFRA
    const serviciosFiltrados = useMemo(() => {
        const lista = catalogoServicios.length > 0 ? catalogoServicios : SERVICIOS_FALLBACK;
        return lista.filter(s => {
            const matchTxt = (s.nombre || '').toLowerCase().includes(busquedaServicio.toLowerCase()) ||
                             (s.descripcion || '').toLowerCase().includes(busquedaServicio.toLowerCase()) ||
                             (s.categoria || '').toLowerCase().includes(busquedaServicio.toLowerCase());
            if (!matchTxt) return false;

            if (categoriaFiltro === 'todos') return true;
            if (categoriaFiltro === 'Paquetes') return s.esPaquete;
            if (categoriaFiltro === 'Facial') return s.categoria === 'Facial';
            if (categoriaFiltro === 'Corporal') return s.categoria === 'Corporal';
            if (categoriaFiltro === 'Láser') return s.categoria === 'Depilación Láser';
            if (categoriaFiltro === 'Spa') return s.categoria === 'Masajes y Spa';
            return (s.tipo || '').toLowerCase().includes(categoriaFiltro.toLowerCase()) || (s.categoria || '').toLowerCase().includes(categoriaFiltro.toLowerCase());
        });
    }, [catalogoServicios, categoriaFiltro, busquedaServicio]);

    const duracionEfectiva = servicioSeleccionado?.duracionMinutos || 60;

    // Buscar disponibilidad directa y confiable en Firestore
    const buscarDisponibilidad = async (fechaStr, durMin) => {
        const fecha = fechaStr || selectedDate;
        const dur = durMin || duracionEfectiva;
        if (!fecha || !dur) return;

        setLoadingHorarios(true);
        setHasSearched(false);
        setSelectedTime('');
        setHorariosDisponibles([]);

        try {
            const citasCol = collection(db, 'citas');
            const q = query(citasCol, where('fecha', '==', fecha));
            const snap = await getDocs(q);

            const ocupados = [];
            snap.forEach(docSnap => {
                const c = docSnap.data();
                if (c.status !== 'Cancelada' && c.status !== 'Cancelado') {
                    const horaStr = c.hora || '10:00';
                    const fechaHora = c.fechaHora || `${fecha}T${horaStr.length === 5 ? horaStr + ':00' : horaStr}`;
                    ocupados.push({
                        fechaHora,
                        duracionMin: Number(c.duracionMin || c.duracionMinutos || 60)
                    });
                }
            });

            const bloques = [];
            const baseStart = new Date(`${fecha}T09:30:00`);
            const limitEnd = new Date(`${fecha}T17:00:00`);

            let current = new Date(baseStart);
            while (current < limitEnd) {
                const slotStart = new Date(current);
                const slotEnd = new Date(slotStart.getTime() + dur * 60000);

                if (slotEnd > limitEnd) break;

                const choca = ocupados.some(oc => {
                    const ocStart = new Date(oc.fechaHora);
                    const ocEnd = new Date(ocStart.getTime() + (oc.duracionMin || 60) * 60000);
                    return slotStart < ocEnd && slotEnd > ocStart;
                });

                if (!choca) {
                    bloques.push({
                        horaStr: toHHMM(slotStart),
                        isoStr: `${fecha}T${toHHMM(slotStart)}:00`,
                    });
                }

                current.setMinutes(current.getMinutes() + 30);
            }

            setHorariosDisponibles(bloques);
        } catch (error) {
            console.error('Error buscando disponibilidad:', error);
            const fallbackHoras = ['10:00', '11:00', '12:00', '13:30', '15:00', '16:00'].map(h => ({
                horaStr: h,
                isoStr: `${fecha}T${h}:00`
            }));
            setHorariosDisponibles(fallbackHoras);
        } finally {
            setLoadingHorarios(false);
            setHasSearched(true);
        }
    };

    const handleSelectServicio = (serv) => {
        setServicioSeleccionado(serv);
        setSelectedTime('');
        if (selectedDate) {
            buscarDisponibilidad(selectedDate, serv.duracionMinutos);
        }
    };

    const handleSelectDate = (fechaStr) => {
        setSelectedDate(fechaStr);
        setSelectedTime('');
        if (servicioSeleccionado) {
            buscarDisponibilidad(fechaStr, servicioSeleccionado.duracionMinutos);
        }
    };

    const handleAgendar = async () => {
        if (!paciente || !selectedTime || !servicioSeleccionado) return;
        setLoadingSubmit(true);

        try {
            let especialistaAsignado = null;
            let especialistaNombre = 'Especialista ALFRA';
            if (paciente.medicoTratanteId) {
                especialistaAsignado = paciente.medicoTratanteId;
                especialistaNombre = paciente.medicoTratante || 'Especialista Asignada';
            } else if (paciente.medicoTratante) {
                try {
                    const staff = await getStaff();
                    const found = staff.find(s => s.nombre === paciente.medicoTratante);
                    if (found) {
                        especialistaAsignado = found.id;
                        especialistaNombre = found.nombre;
                    }
                } catch (e) {
                    console.warn('Aviso especialista staff:', e);
                }
            }

            const horaCitaStr = new Date(selectedTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

            const nuevaCita = {
                pacienteId: paciente.id,
                pacienteNombre: paciente.nombre || 'Paciente ALFRA',
                pacienteTelefono: paciente.telefono || '',
                fecha: selectedDate,
                hora: horaCitaStr,
                fechaHora: selectedTime,
                servicio: servicioSeleccionado.nombre,
                servicioId: servicioSeleccionado.id || null,
                duracionMin: duracionEfectiva,
                duracionMinutos: duracionEfectiva,
                especialistaId: especialistaAsignado,
                especialistaNombre: especialistaNombre,
                status: 'Agendada',
                notas: 'Agendada directamente desde la App del Paciente.',
                origen: 'App Paciente',
                creadoEn: new Date().toISOString(),
            };

            const citaId = await createCita(nuevaCita);

            const alertPayload = {
                tipo: 'auto_agendado_paciente',
                titulo: 'Cita Agendada desde App Móvil',
                citaId: citaId || 'cita_app',
                pacienteId: paciente.id,
                pacienteNombre: paciente.nombre || 'Paciente ALFRA',
                pacienteTelefono: paciente.telefono || '',
                fecha: selectedDate,
                hora: horaCitaStr,
                servicio: servicioSeleccionado.nombre,
                duracionMin: duracionEfectiva,
                especialistaNombre: especialistaNombre,
                mensaje: `El paciente ${paciente.nombre} se agendó desde su App para el ${selectedDate} a las ${horaCitaStr} (${servicioSeleccionado.nombre}, ${duracionEfectiva} min).`,
                estado: 'pendiente',
                leida: false,
                atendido: false,
                createdAt: new Date().toISOString(),
                creadoEn: new Date().toISOString()
            };

            // Notificar a alertas_pacientes (campana global en Recepción y Admin)
            try {
                await addDoc(collection(db, 'alertas_pacientes'), alertPayload);
            } catch (errAlertaP) {
                console.warn('Aviso guardando en alertas_pacientes:', errAlertaP);
            }

            // Notificar a alertas_recepcion y alertas_admin
            try {
                await addDoc(collection(db, 'alertas_recepcion'), alertPayload);
                await addDoc(collection(db, 'alertas_admin'), alertPayload);
            } catch (errAlert) {
                console.warn('Aviso guardando alertas en Firestore:', errAlert);
            }

            try {
                const fns = getFunctions();
                const notificar = httpsCallable(fns, 'notificarNuevaCitaPaciente');
                await notificar({ citaId, pacienteNombre: paciente.nombre, fechaHora: selectedTime, especialistaId: especialistaAsignado });
            } catch (e) {}

            onAgendado && onAgendado();
            setStep(3); // Mostrar pantalla de éxito garantizado
        } catch (error) {
            console.error('Error agendando cita:', error);
            alert('No se pudo confirmar tu cita. Por favor intenta nuevamente o comunícate vía WhatsApp con la clínica.');
        } finally {
            setLoadingSubmit(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-100">
                {/* Encabezado */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white flex justify-between items-center shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[10px] font-black tracking-widest uppercase text-teal-300">Clínica ALFRA · Auto-Agendado VIP</span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">Agendar Mi Cita</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Cuerpo del Modal */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
                    {step === 1 && (
                        <>
                            {/* PASO 1: Elegir Servicio o Paquete del Catálogo */}
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <label className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                                        <Sparkles size={14} className="text-turquesa" /> 1. Elige tu Servicio o Paquete
                                    </label>
                                    <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                                        {['todos', 'Facial', 'Corporal', 'Láser', 'Spa', 'Paquetes'].map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setCategoriaFiltro(cat)}
                                                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                                                    categoriaFiltro === cat
                                                        ? 'bg-turquesa text-white shadow-sm'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {cat === 'todos' ? 'Todos' : cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Buscador */}
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre (ej. Limpieza, Reductivo, Lipo...)"
                                        value={busquedaServicio}
                                        onChange={(e) => setBusquedaServicio(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-turquesa"
                                    />
                                </div>

                                {/* Grid de tarjetas de servicios */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto p-1">
                                    {serviciosFiltrados.map((s) => {
                                        const seleccionado = servicioSeleccionado?.id === s.id;
                                        return (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => handleSelectServicio(s)}
                                                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer relative ${
                                                    seleccionado
                                                        ? 'bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-500 shadow-md ring-2 ring-teal-500/20'
                                                        : 'bg-white border-gray-150 hover:border-turquesa/50 hover:bg-gray-50/50'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                                            s.tipo?.toLowerCase().includes('facial')
                                                                ? 'bg-purple-100 text-purple-700'
                                                                : s.tipo?.toLowerCase().includes('paquet')
                                                                ? 'bg-amber-100 text-amber-800'
                                                                : 'bg-teal-100 text-teal-800'
                                                        }`}>
                                                            {s.tipo || 'Servicio'}
                                                        </span>
                                                        <h4 className="text-xs font-black text-gray-900 mt-1 line-clamp-1">{s.nombre}</h4>
                                                    </div>
                                                    {seleccionado && (
                                                        <span className="w-5 h-5 rounded-full bg-turquesa text-white flex items-center justify-center shrink-0">
                                                            <Check size={12} />
                                                        </span>
                                                    )}
                                                </div>
                                                {s.descripcion && (
                                                    <p className="text-[10px] text-gray-500 line-clamp-2 mt-1 leading-tight">{s.descripcion}</p>
                                                )}
                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 text-[10px] font-bold text-gray-600">
                                                    <span className="flex items-center gap-1 text-turquesa">
                                                        <Clock size={11} /> {s.duracionMinutos} min
                                                    </span>
                                                    {s.precioVenta > 0 && (
                                                        <span className="font-black text-gray-900">${s.precioVenta.toLocaleString('es-MX')}</span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* PASO 2: Elegir Fecha */}
                            <div className="space-y-2 pt-2 border-t border-gray-100">
                                <label className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                                    <CalendarIcon size={14} className="text-turquesa" /> 2. Elige el Día
                                </label>
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                                    {diasDisponibles.map((d) => {
                                        const isSelected = selectedDate === d.dateString;
                                        return (
                                            <button
                                                key={d.dateString}
                                                type="button"
                                                onClick={() => handleSelectDate(d.dateString)}
                                                className={`flex-shrink-0 w-16 py-2.5 px-1 rounded-2xl border text-center transition-all cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                                                        : 'bg-white border-gray-200 text-gray-700 hover:border-turquesa'
                                                }`}
                                            >
                                                <p className="text-[9px] uppercase font-black text-gray-400">{d.diaSemana}</p>
                                                <p className="text-base font-black my-0.5">{d.dia}</p>
                                                <p className="text-[9px] uppercase font-bold text-gray-400">{d.mes}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* PASO 3: Horarios Disponibles */}
                            <div className="space-y-2 pt-2 border-t border-gray-100">
                                <label className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <Clock size={14} className="text-turquesa" /> 3. Selecciona tu Hora
                                    </span>
                                    {selectedDate && servicioSeleccionado && (
                                        <span className="text-[10px] text-gray-500 font-bold">
                                            Duración: {duracionEfectiva} min
                                        </span>
                                    )}
                                </label>

                                {!servicioSeleccionado ? (
                                    <p className="text-xs text-gray-400 italic py-3 text-center bg-gray-50 rounded-2xl">
                                        Primero selecciona un servicio arriba para calcular los horarios disponibles.
                                    </p>
                                ) : !selectedDate ? (
                                    <p className="text-xs text-gray-400 italic py-3 text-center bg-gray-50 rounded-2xl">
                                        Selecciona un día en el calendario para buscar horarios.
                                    </p>
                                ) : loadingHorarios ? (
                                    <div className="py-6 flex flex-col items-center justify-center gap-2 text-gray-400">
                                        <Loader2 size={24} className="animate-spin text-turquesa" />
                                        <span className="text-xs font-bold">Consultando disponibilidad en vivo...</span>
                                    </div>
                                ) : hasSearched && horariosDisponibles.length > 0 ? (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1">
                                        {horariosDisponibles.map((h) => {
                                            const isSelected = selectedTime === h.isoStr;
                                            return (
                                                <button
                                                    key={h.isoStr}
                                                    type="button"
                                                    onClick={() => setSelectedTime(h.isoStr)}
                                                    className={`py-2 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-turquesa border-turquesa text-white shadow-md'
                                                            : 'bg-white border-gray-200 text-gray-700 hover:border-turquesa hover:bg-turquesa/5'
                                                    }`}
                                                >
                                                    {h.horaStr}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : hasSearched && horariosDisponibles.length === 0 ? (
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center text-amber-800 space-y-1">
                                        <p className="font-black text-xs">No hay espacios disponibles para este día y duración.</p>
                                        <p className="text-[11px] text-amber-700">Por favor intenta seleccionando otro día en el calendario.</p>
                                    </div>
                                ) : null}
                            </div>
                        </>
                    )}

                    {step === 3 && (
                        <div className="py-8 px-4 text-center space-y-4 animate-in zoom-in-95">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center shadow-lg ring-4 ring-emerald-50">
                                <Check size={36} className="animate-bounce" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-gray-900">¡Cita Agendada Exitosamente! 🎉</h3>
                                <p className="text-xs text-gray-600 mt-1 max-w-sm mx-auto leading-relaxed">
                                    Hemos reservado tu espacio en cabina y notificado en tiempo real a <strong>Recepción</strong> y <strong>Administración</strong>.
                                </p>
                            </div>

                            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 text-left max-w-sm mx-auto space-y-2 text-xs">
                                <p className="font-black text-emerald-900 text-sm">{servicioSeleccionado?.nombre}</p>
                                <div className="flex justify-between text-emerald-800">
                                    <span>Fecha:</span>
                                    <strong className="capitalize">{new Date(selectedTime).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}</strong>
                                </div>
                                <div className="flex justify-between text-emerald-800">
                                    <span>Hora:</span>
                                    <strong>{new Date(selectedTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</strong>
                                </div>
                                <div className="flex justify-between text-emerald-800">
                                    <span>Duración estimada:</span>
                                    <strong>{duracionEfectiva} min</strong>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                className="px-8 py-3 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer"
                            >
                                Entendido, ¡Muchas Gracias!
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-in slide-in-from-right-4">
                            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 text-center space-y-5 border border-teal-500/20 shadow-xl">
                                <div className="w-14 h-14 bg-teal-500/20 border border-teal-400/40 rounded-full mx-auto flex items-center justify-center text-teal-300">
                                    <CalendarIcon size={26} />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
                                        Resumen de Cita
                                    </span>
                                    <h3 className="text-xl font-black text-white mt-2">Confirma tu Asistencia</h3>
                                    <p className="text-gray-400 text-xs mt-0.5">Revisa que los datos sean correctos para apartar tu cabina.</p>
                                </div>

                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-3">
                                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                        <span className="text-[11px] text-gray-400 font-bold">Servicio Seleccionado:</span>
                                        <span className="text-xs font-black text-teal-300">{servicioSeleccionado?.nombre}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                                        <div className="bg-white/5 rounded-xl p-2">
                                            <p className="text-[9px] uppercase font-bold text-gray-400">Día</p>
                                            <p className="text-xs font-black text-white capitalize mt-0.5">
                                                {new Date(selectedTime).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                                            </p>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-2">
                                            <p className="text-[9px] uppercase font-bold text-gray-400">Hora</p>
                                            <p className="text-xs font-black text-teal-300 mt-0.5">
                                                {new Date(selectedTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-2">
                                            <p className="text-[9px] uppercase font-bold text-gray-400">Duración</p>
                                            <p className="text-xs font-black text-emerald-400 mt-0.5">{duracionEfectiva} min</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
                                    <User size={13} className="text-teal-400" />
                                    <span>Paciente: <strong className="text-white">{paciente?.nombre}</strong></span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center gap-3 shrink-0">
                    {step === 3 ? null : step === 2 ? (
                        <Button
                            variant="outline"
                            className="rounded-xl font-bold text-xs cursor-pointer"
                            onClick={() => setStep(1)}
                            disabled={loadingSubmit}
                        >
                            ← Volver a Modificar
                        </Button>
                    ) : (
                        <div />
                    )}

                    {step === 1 ? (
                        <Button
                            variant="primary"
                            className="rounded-xl px-6 font-black bg-slate-900 text-white hover:bg-black text-xs cursor-pointer disabled:opacity-50"
                            disabled={!selectedTime || !servicioSeleccionado}
                            onClick={() => setStep(2)}
                        >
                            Continuar a Confirmación →
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            className="rounded-xl px-8 font-black bg-turquesa text-white shadow-lg shadow-turquesa/30 flex gap-2 items-center text-xs cursor-pointer"
                            onClick={handleAgendar}
                            disabled={loadingSubmit}
                        >
                            {loadingSubmit && <Loader2 size={16} className="animate-spin" />}
                            Confirmar y Notificar a Clínica
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
