import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Clock, CheckCircle, FileText, User, Target, Gift, Loader, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../lib/firebase';
import { onCitasEspecialistaChange, updateCitaStatus } from '../../services/citasService';
import { getStaffDocByUid } from '../../services/staffService';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

const META_DIARIA_TRATAMIENTOS = 5;

const getStatusBadge = (status) => {
    switch (status) {
        case 'Confirmada': return <Badge variant="turquesa">Lista para Consulta</Badge>;
        case 'Pendiente': return <Badge variant="yellow">Por Llegar</Badge>;
        case 'Completada': return <Badge variant="green">Completada</Badge>;
        case 'Cancelada': return <Badge variant="red">Cancelada</Badge>;
        default: return <Badge variant="gray">{status}</Badge>;
    }
};

export default function AgendaDiaria() {
    const { userRole } = useAuth();
    const navigate = useNavigate();

    const [citas, setCitas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [especialistaId, setEspecialistaId] = useState(null);
    const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

    // Pacientes con cumpleaños este mes (calculado desde las citas cargadas)
    const [cumpleanosPacientes, setCumpleanosPacientes] = useState([]);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) {
            setLoading(false);
            return;
        }

        let unsubCitas = () => { };

        // Paso 1: buscar el documento del staff por su Firebase Auth UID
        // Las citas guardan el Firestore doc ID (no el Auth UID), así que necesitamos el doc ID
        getStaffDocByUid(user.uid).then(staffDoc => {
            // Si encontramos el documento de staff, usamos su Firestore doc ID
            // Si NO lo encontramos (ej. admin logueado como especialista), usamos el Auth UID como fallback
            const firestoreDocId = staffDoc ? staffDoc.id : user.uid;
            setEspecialistaId(firestoreDocId);

            unsubCitas = onCitasEspecialistaChange(firestoreDocId, (citasFirestore) => {
                const normalized = citasFirestore.map(c => ({
                    ...c,
                    paciente: c.pacienteNombre || c.paciente || 'Sin nombre',
                    hora: c.fechaHora
                        ? format(new Date(c.fechaHora), 'hh:mm a')
                        : (c.hora || '—'),
                    fecha: c.fechaHora ? new Date(c.fechaHora) : new Date(),
                    dia: c.fechaHora
                        ? format(new Date(c.fechaHora), "EEEE, dd MMM", { locale: es })
                        : 'Sin fecha',
                    comisionEstimada: c.comisionEstimada || 0,
                    notas: c.notas || c.observaciones || '',
                }));
                setCitas(normalized);
                setLoading(false);
            });
        }).catch(() => {
            setLoading(false);
        });

        return () => unsubCitas();
    }, []);

    // Filtrar citas de la semana seleccionada
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const citasSemana = citas.filter(c =>
        c.fecha instanceof Date &&
        !isNaN(c.fecha) &&
        isWithinInterval(c.fecha, { start: weekStart, end: weekEnd })
    );

    // Agrupar por día
    const citasPorDia = citasSemana.reduce((acc, cita) => {
        if (!acc[cita.dia]) acc[cita.dia] = [];
        acc[cita.dia].push(cita);
        return acc;
    }, {});

    // Métricas de hoy
    const hoyStr = format(new Date(), "EEEE, dd MMM", { locale: es });
    const citasHoy = citasPorDia[hoyStr] || [];
    const citasCompletadasHoy = citasHoy.filter(c => c.status === 'Completada').length;
    const progresoProductividad = Math.min((citasCompletadasHoy / META_DIARIA_TRATAMIENTOS) * 100, 100);

    // Comisiones de la semana
    const totalComisiones = citasSemana.filter(c => c.status === 'Completada').reduce((acc, c) => acc + (c.comisionEstimada || 0), 0);

    const handleCompletar = async (id) => {
        const confirmar = window.confirm('¿Confirmar que la consulta finalizó correctamente?');
        if (!confirmar) return;
        try {
            await updateCitaStatus(id, 'Completada');
            // La suscripción en tiempo real actualiza la lista automáticamente
        } catch (err) {
            console.error(err);
            alert('Error al actualizar la cita.');
        }
    };

    const semanaLabel = `${format(weekStart, "dd MMM", { locale: es })} — ${format(weekEnd, "dd MMM yyyy", { locale: es })}`;

    return (
        <div className="space-y-6">

            {cumpleanosPacientes.length > 0 && (
                <div className="bg-gradient-to-r from-turquesa to-acero text-white p-4 rounded-xl shadow-md flex items-center justify-between animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                            <Gift size={24} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">¡Pacientes de Cumpleaños! 🎉</h3>
                            <p className="text-white/80 text-sm">Felicita a <span className="font-bold underline">{cumpleanosPacientes.join(', ')}</span> durante su consulta de hoy.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-acero">Mi Agenda Semanal</h2>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <Button
                            variant="outline"
                            size="sm"
                            icon={Clock}
                            onClick={() => setWeekStart(prev => new Date(prev.getTime() - 7 * 24 * 60 * 60 * 1000))}
                        >
                            Semana Anterior
                        </Button>
                        <span className="font-bold text-turquesa px-4 py-1.5 bg-turquesa/10 rounded-lg text-sm">{semanaLabel}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            icon={Clock}
                            className="flex-row-reverse"
                            onClick={() => setWeekStart(prev => new Date(prev.getTime() + 7 * 24 * 60 * 60 * 1000))}
                        >
                            Siguiente Semana
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={Calendar}
                            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                        >
                            Hoy
                        </Button>
                    </div>
                </div>

                {/* Visor rápido de comisiones */}
                <div className="bg-turquesa/10 px-6 py-3 rounded-xl border border-turquesa/20 text-right flex flex-col justify-center">
                    <p className="text-xs text-turquesa font-bold uppercase tracking-wide">Comisiones Esta Semana</p>
                    <p className="text-2xl font-black text-gray-900">
                        ${totalComisiones.toLocaleString('es-MX', { minimumFractionDigits: 2 })} <span className="text-sm font-medium text-gray-500">MXN</span>
                    </p>
                </div>
            </div>

            {/* BARRA DE PRODUCTIVIDAD */}
            {userRole === 'Especialista' && (
                <Card className="bg-acero/5 border-acero/20 shadow-sm relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white rounded-xl shadow-sm text-acero">
                                <Target size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-acero text-lg">Productividad de Hoy</h3>
                                <p className="text-sm text-gray-500">Meta: {META_DIARIA_TRATAMIENTOS} citas atendidas (Turno 8hrs / 90min c/u)</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Citas Completadas</p>
                            <p className="text-3xl font-black text-gray-900">{citasCompletadasHoy} <span className="text-gray-400 text-lg">/ {META_DIARIA_TRATAMIENTOS}</span></p>
                        </div>
                    </div>

                    <div className="mt-6 relative z-10">
                        <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                            <span>Progreso del Turno</span>
                            <span className={progresoProductividad >= 100 ? 'text-green-500' : 'text-turquesa'}>{progresoProductividad.toFixed(0)}%</span>
                        </div>
                        <div className="h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                            <div
                                className={`h-full transition-all duration-1000 ease-out flex items-center justify-end pr-2 ${progresoProductividad >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-turquesa/50 to-turquesa'}`}
                                style={{ width: `${progresoProductividad}%` }}
                            >
                                {progresoProductividad >= 100 && <span className="text-white text-[10px] font-bold">¡Meta Alcanzada!</span>}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Lista de citas */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                    <Loader size={36} className="animate-spin text-turquesa" />
                    <p className="text-sm font-medium">Cargando tu agenda desde Firebase...</p>
                </div>
            ) : Object.keys(citasPorDia).length === 0 ? (
                <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                    <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-semibold">Sin citas esta semana</p>
                    <p className="text-sm mt-1">La Recepcionista puede agendar citas desde el Calendario Global.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.keys(citasPorDia).map((dia) => (
                        <div key={dia} className="space-y-4">
                            <div className="flex items-center gap-3 border-b-2 border-turquesa/20 pb-2">
                                <h3 className="text-lg font-bold text-acero bg-turquesa/10 px-4 py-1.5 rounded-lg capitalize">{dia}</h3>
                                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{citasPorDia[dia].length} Citas</span>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {citasPorDia[dia].map((cita) => (
                                    <Card key={cita.id} className="relative overflow-hidden group hover:border-turquesa transition-colors">
                                        {cita.status === 'Confirmada' && <div className="absolute top-0 left-0 w-1.5 h-full bg-turquesa" />}
                                        {cita.status === 'Completada' && <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500" />}
                                        {cita.status === 'Pendiente' && <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-400" />}
                                        {cita.status === 'Cancelada' && <div className="absolute top-0 left-0 w-1.5 h-full bg-red-400" />}

                                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                            <div className="flex gap-4 items-start">
                                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center min-w-[80px]">
                                                    <Clock size={16} className="mx-auto text-acero mb-1" />
                                                    <span className="text-sm font-bold text-gray-900">{cita.hora}</span>
                                                </div>

                                                <div>
                                                    <h4 className="text-lg font-bold text-acero flex items-center gap-2 flex-wrap">
                                                        {cita.paciente} {getStatusBadge(cita.status)}
                                                    </h4>
                                                    <p className="text-sm font-medium text-gray-600 mt-1 flex items-center gap-1">
                                                        <User size={14} /> {cita.servicio}
                                                    </p>
                                                    {cita.notas && (
                                                        <p className="text-sm text-gray-400 mt-2 bg-gray-50 p-2 rounded-lg italic">
                                                            "{cita.notas}"
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 min-w-[160px]">
                                                <Button
                                                    variant="outline"
                                                    icon={FileText}
                                                    onClick={() => navigate(`/especialista/expediente/${cita.pacienteId || cita.id}`)}
                                                >
                                                    Ver Expediente
                                                </Button>

                                                {cita.status !== 'Completada' && cita.status !== 'Cancelada' && (
                                                    <Button
                                                        variant="primary"
                                                        icon={CheckCircle}
                                                        onClick={() => handleCompletar(cita.id)}
                                                    >
                                                        Finalizar Consulta
                                                    </Button>
                                                )}

                                                {cita.status === 'Completada' && (
                                                    <div className="text-center py-2 px-4 bg-green-50 text-green-700 rounded-lg text-sm font-bold flex items-center justify-center gap-2 border border-green-100">
                                                        <CheckCircle size={16} /> Consulta Finalizada
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
