import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { X, Calendar as CalendarIcon, Clock, Loader2, Info, Search, ChevronDown } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStaff } from '../../services/staffService';
import { createCita } from '../../services/citasService';

const DURACIONES = [
    { min: 30,  label: '30 min',  desc: 'Consulta rápida' },
    { min: 60,  label: '60 min',  desc: '1 hora' },
    { min: 90,  label: '90 min',  desc: '1h 30min' },
    { min: 120, label: '120 min', desc: '2 horas' },
    { min: 150, label: '150 min', desc: '2h 30min' },
];

// Genera HH:MM a partir de un Date
const toHHMM = (d) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function AutoAgendadoModal({ isOpen, onClose, paciente, onAgendado }) {
    const [step, setStep] = useState(1);
    const [diasDisponibles, setDiasDisponibles] = useState([]);

    // Selecciones del usuario
    const [selectedDate, setSelectedDate] = useState('');
    const [duracionMin, setDuracionMin] = useState(null);
    const [selectedTime, setSelectedTime] = useState('');

    // Estado de búsqueda
    const [hasSearched, setHasSearched] = useState(false);
    const [loadingHorarios, setLoadingHorarios] = useState(false);
    const [horariosDisponibles, setHorariosDisponibles] = useState([]);

    const [loadingSubmit, setLoadingSubmit] = useState(false);

    // Reset al abrir/cerrar
    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setSelectedDate('');
            setDuracionMin(null);
            setSelectedTime('');
            setHasSearched(false);
            setHorariosDisponibles([]);
            return;
        }

        // Generar los próximos 14 días (sin domingos)
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

    // Cuando cambia la fecha o la duración, resetea la búsqueda anterior
    const handleSelectDate = (fechaStr) => {
        setSelectedDate(fechaStr);
        setSelectedTime('');
        setHasSearched(false);
        setHorariosDisponibles([]);
    };

    const handleSelectDuracion = (min) => {
        setDuracionMin(min);
        setSelectedTime('');
        setHasSearched(false);
        setHorariosDisponibles([]);
    };

    // Busca disponibilidad real
    const buscarDisponibilidad = async () => {
        if (!selectedDate || !duracionMin) return;
        setLoadingHorarios(true);
        setHasSearched(false);
        setSelectedTime('');
        setHorariosDisponibles([]);

        try {
            const functions = getFunctions();
            const getHorariosOcupados = httpsCallable(functions, 'getHorariosOcupados');
            const res = await getHorariosOcupados({ fecha: selectedDate });
            const ocupados = res.data.ocupados || []; // [{fechaHora, duracionMin}]

            // Generar candidatos cada 30 min desde 9:30 hasta 17:00
            const bloques = [];
            const baseStart = new Date(`${selectedDate}T09:30:00`);
            const limitEnd  = new Date(`${selectedDate}T17:00:00`);

            let current = new Date(baseStart);
            while (current < limitEnd) {
                const slotStart = new Date(current);
                const slotEnd   = new Date(slotStart.getTime() + duracionMin * 60000);

                // El slot debe terminar antes o exactamente a las 17:00
                if (slotEnd > limitEnd) break;

                // Colisión: el slot nuevo [slotStart, slotEnd] choca con
                // una cita existente [ocStart, ocStart + ocDuracion]
                const choca = ocupados.some(oc => {
                    const ocStart = new Date(oc.fechaHora);
                    const ocEnd   = new Date(ocStart.getTime() + (oc.duracionMin || 90) * 60000);
                    // Overlap: slotStart < ocEnd  &&  slotEnd > ocStart
                    return slotStart < ocEnd && slotEnd > ocStart;
                });

                if (!choca) {
                    bloques.push({
                        horaStr: toHHMM(slotStart),
                        isoStr:  `${selectedDate}T${toHHMM(slotStart)}:00`,
                    });
                }

                current.setMinutes(current.getMinutes() + 30);
            }

            setHorariosDisponibles(bloques);
        } catch (error) {
            console.error('Error buscando horarios:', error);
        } finally {
            setLoadingHorarios(false);
            setHasSearched(true);
        }
    };

    const handleAgendar = async () => {
        setLoadingSubmit(true);
        try {
            let especialistaAsignado = null;
            if (paciente.medicoTratanteId) {
                especialistaAsignado = paciente.medicoTratanteId;
            } else if (paciente.medicoTratante) {
                try {
                    const staff = await getStaff();
                    const found = staff.find(s => s.nombre === paciente.medicoTratante);
                    if (found) especialistaAsignado = found.id;
                } catch (e) {
                    console.warn('No se pudo obtener el ID del especialista:', e);
                }
            }

            const nuevaCita = {
                pacienteId:      paciente.id,
                pacienteNombre:  paciente.nombre,
                telefono:        paciente.telefono || '',
                fechaHora:       selectedTime,
                duracionMin:     duracionMin,
                motivo:          'Cita Agendada por App Paciente',
                especialistaId:  especialistaAsignado,
                status:          'Agendada',
                notas:           'Generada desde auto-agendado',
                creadoEn:        new Date().toISOString(),
            };

            const citaId = await createCita(nuevaCita);

            const fns = getFunctions();
            const notificar = httpsCallable(fns, 'notificarNuevaCitaPaciente');
            await notificar({ citaId, pacienteNombre: paciente.nombre, fechaHora: selectedTime, especialistaId: especialistaAsignado });

            onAgendado && onAgendado();
            onClose();
        } catch (error) {
            console.error('Error agendando cita:', error);
            alert('No pudimos agendar tu cita. Intenta más tarde.');
        } finally {
            setLoadingSubmit(false);
        }
    };

    if (!isOpen) return null;

    const puedesBuscar = selectedDate && duracionMin;
    const durSeleccionada = DURACIONES.find(d => d.min === duracionMin);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-acero/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-[2.5rem] w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">

                {/* ── Header ─────────────────────────────────────── */}
                <div className="p-6 bg-gradient-to-br from-turquesa/10 to-transparent border-b border-gray-100 flex justify-between items-start shrink-0">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 bg-turquesa text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                            <CalendarIcon size={12} /> Auto Agendado
                        </div>
                        <h2 className="text-2xl font-black text-acero tracking-tight">
                            {step === 1 ? 'Nueva Cita' : 'Confirma tu Cita'}
                        </h2>
                        <p className="text-gray-500 font-medium text-sm">
                            {step === 1 ? 'Elige día, duración y horario disponible.' : 'Revisa los detalles antes de confirmar.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-gray-50 text-gray-400 transition-colors shadow-sm border border-gray-100">
                        <X size={20} />
                    </button>
                </div>

                {/* ── Body ───────────────────────────────────────── */}
                <div className="p-6 overflow-y-auto flex-1 space-y-7">

                    {step === 1 && (
                        <>
                            {/* 1. Día */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-turquesa inline-block" />
                                    1. Elige un día
                                </p>
                                <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x hide-scrollbar">
                                    {diasDisponibles.map((dia) => (
                                        <button
                                            key={dia.dateString}
                                            onClick={() => handleSelectDate(dia.dateString)}
                                            className={`shrink-0 snap-start w-[70px] rounded-2xl border-2 flex flex-col items-center justify-center py-3 gap-0.5 transition-all
                                                ${selectedDate === dia.dateString
                                                    ? 'border-turquesa bg-turquesa text-white shadow-lg shadow-turquesa/30 scale-105'
                                                    : 'border-gray-100 bg-white text-gray-600 hover:border-turquesa/40 hover:bg-turquesa/5'}`}
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-wider opacity-80">{dia.diaSemana}</span>
                                            <span className="text-2xl font-black leading-tight">{dia.dia}</span>
                                            <span className="text-[10px] font-medium opacity-75">{dia.mes}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 2. Duración */}
                            {selectedDate && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-turquesa inline-block" />
                                        2. Duración de la cita
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {DURACIONES.map((d) => (
                                            <button
                                                key={d.min}
                                                onClick={() => handleSelectDuracion(d.min)}
                                                className={`flex flex-col items-center px-4 py-2.5 rounded-2xl border-2 transition-all text-sm font-black
                                                    ${duracionMin === d.min
                                                        ? 'border-acero bg-acero text-white shadow-md shadow-acero/20'
                                                        : 'border-gray-100 bg-white text-gray-600 hover:border-gray-300'}`}
                                            >
                                                {d.label}
                                                <span className={`text-[9px] font-medium mt-0.5 ${duracionMin === d.min ? 'text-white/70' : 'text-gray-400'}`}>
                                                    {d.desc}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 3. Buscar disponibilidad */}
                            {puedesBuscar && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <button
                                        onClick={buscarDisponibilidad}
                                        disabled={loadingHorarios}
                                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm tracking-wide transition-all
                                            bg-gradient-to-r from-turquesa to-teal-500 text-white shadow-md shadow-turquesa/25
                                            hover:shadow-lg hover:shadow-turquesa/35 hover:scale-[1.01] disabled:opacity-60 disabled:scale-100"
                                    >
                                        {loadingHorarios
                                            ? <><Loader2 size={16} className="animate-spin" /> Buscando espacios...</>
                                            : <><Search size={16} /> Buscar disponibilidad</>}
                                    </button>
                                </div>
                            )}

                            {/* 4. Resultado de la búsqueda */}
                            {hasSearched && !loadingHorarios && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-turquesa inline-block" />
                                        3. Elige un horario
                                        <span className="text-gray-300">·</span>
                                        <span className="text-turquesa">{horariosDisponibles.length} espacios libres</span>
                                    </p>

                                    {horariosDisponibles.length > 0 ? (
                                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                            {horariosDisponibles.map((h) => (
                                                <button
                                                    key={h.isoStr}
                                                    onClick={() => setSelectedTime(h.isoStr)}
                                                    className={`py-2.5 rounded-xl border-2 text-sm font-black tracking-wide transition-all
                                                        ${selectedTime === h.isoStr
                                                            ? 'border-turquesa bg-turquesa text-white shadow-md shadow-turquesa/25'
                                                            : 'border-gray-100 bg-white text-gray-600 hover:border-turquesa/50 hover:bg-turquesa/5'}`}
                                                >
                                                    {h.horaStr}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 text-center text-orange-600 flex flex-col items-center gap-2">
                                            <Info size={22} className="opacity-50" />
                                            <p className="font-bold text-sm">No hay espacios de {durSeleccionada?.label} disponibles este día.</p>
                                            <p className="text-xs opacity-70">Prueba con otra fecha o una duración menor.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-in slide-in-from-right-4">
                            <div className="bg-gray-50 rounded-[2rem] p-8 text-center space-y-6 border border-gray-100">
                                <div className="w-14 h-14 bg-white rounded-full mx-auto flex items-center justify-center shadow-sm text-turquesa">
                                    <CalendarIcon size={28} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-acero tracking-tight">Confirma tu cita</h3>
                                    <p className="text-gray-400 font-medium text-sm mt-1">Revisa que todo esté correcto.</p>
                                </div>

                                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 grid grid-cols-3 gap-4 text-left">
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Día</p>
                                        <p className="text-sm font-black text-acero capitalize">
                                            {new Date(selectedTime).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Hora</p>
                                        <p className="text-sm font-black text-acero flex items-center gap-1">
                                            <Clock size={13} className="text-turquesa" />
                                            {new Date(selectedTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Duración</p>
                                        <p className="text-sm font-black text-turquesa">{durSeleccionada?.label}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────────── */}
                <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center gap-3 shrink-0">
                    {step === 2 ? (
                        <Button variant="outline" className="rounded-xl font-bold" onClick={() => setStep(1)} disabled={loadingSubmit}>
                            Atrás
                        </Button>
                    ) : <div />}

                    {step === 1 ? (
                        <Button
                            variant="primary"
                            className="rounded-xl px-8 font-black bg-acero text-white hover:bg-black"
                            disabled={!selectedTime}
                            onClick={() => setStep(2)}
                        >
                            Continuar →
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            className="rounded-xl px-8 font-black bg-turquesa text-white shadow-lg shadow-turquesa/30 flex gap-2 items-center"
                            onClick={handleAgendar}
                            disabled={loadingSubmit}
                        >
                            {loadingSubmit && <Loader2 size={16} className="animate-spin" />}
                            Confirmar Cita
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
