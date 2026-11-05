import { reproducirSonidoNotificacion } from '../../services/notificationService';
import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
    Clock, CheckCircle, FileText, User, Target, Gift, Loader, Calendar,
    Bell, Receipt, Play, Plus, Search, MessageCircle, ShoppingBag,
    ChevronLeft, ChevronRight, Sparkles, AlertTriangle, Users, Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../lib/firebase';
import {
    onCitasEspecialistaChange, updateCitaStatus, onAlertasEspecialistaChange,
    markAlertAsRead, createCita, resolverDuracionCitaMinutos, extraerRangoCitaLocal
} from '../../services/citasService';
import { getStaffDocByUid, onStaffDocChange } from '../../services/staffService';
import { getPacientes } from '../../services/pacientesService';
import { onServiciosChange } from '../../services/comercialService';
import { onInventarioChange } from '../../services/inventarioService';
import { Modal } from '../../components/ui/Modal';
import DetalleComisionesContent from '../../components/especialista/DetalleComisionesContent';
import {
    format, startOfWeek, endOfWeek, isWithinInterval, startOfMonth,
    endOfMonth, eachDayOfInterval, isSameDay, addDays
} from 'date-fns';
import { es } from 'date-fns/locale';

const META_DIARIA_TRATAMIENTOS = 5;

const getStatusBadge = (status) => {
    switch (status) {
        case 'En Sala de Espera': return <Badge variant="yellow">🔔 En Sala de Espera</Badge>;
        case 'En Cabina': return <Badge variant="turquesa">⚡ En Cabina</Badge>;
        case 'Confirmada': return <Badge variant="turquesa">Lista para Consulta</Badge>;
        case 'Pendiente': return <Badge variant="yellow">Por Llegar</Badge>;
        case 'Pendiente Pase a Caja': return <Badge variant="yellow">⏳ Esperando Autorización Recepción</Badge>;
        case 'Completada': return <Badge variant="green">Completada</Badge>;
        case 'Cancelada': return <Badge variant="red">Cancelada</Badge>;
        default: return <Badge variant="gray">{status || 'Pendiente'}</Badge>;
    }
};

export default function AgendaDiaria() {
    const { userRole } = useAuth();
    const navigate = useNavigate();

    const [misCitas, setMisCitas] = useState([]);
    const [todasCitas, setTodasCitas] = useState([]);
    const [vistaModo, setVistaModo] = useState('semana'); // 'hoy' | 'semana' | 'mes'
    const [selectedDateStr, setSelectedDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [monthAnchor, setMonthAnchor] = useState(startOfMonth(new Date()));
    const [filtroEstado, setFiltroEstado] = useState('Todos');
    const [busqueda, setBusqueda] = useState('');

    const [loading, setLoading] = useState(true);
    const [especialistaId, setEspecialistaId] = useState(null);
    const [staffDoc, setStaffDoc] = useState(null);
    const [modalComisionesOpen, setModalComisionesOpen] = useState(false);

    // Alertas de llegada de pacientes
    const [alertas, setAlertas] = useState([]);
    const [cumpleanosPacientes, setCumpleanosPacientes] = useState([]);

    // Catálogos para Agendar Cita y Pase de Salida a Caja
    const [pacientesList, setPacientesList] = useState([]);
    const resolvePacienteId = (cita) => {
        if (!cita) return '';
        if (cita.pacienteId) return cita.pacienteId;
        const pacNom = (cita.paciente || cita.pacienteNombre || '').trim().toLowerCase();
        if (pacNom && pacientesList && pacientesList.length > 0) {
            const found = pacientesList.find(p => (p.nombre || '').trim().toLowerCase() === pacNom);
            if (found?.id) return found.id;
        }
        return cita.id || '';
    };
    const [serviciosList, setServiciosList] = useState([]);
    const [productosList, setProductosList] = useState([]);

    // Modal Agendar Cita Rápida
    const [modalNuevaCitaOpen, setModalNuevaCitaOpen] = useState(false);
    const [savingCita, setSavingCita] = useState(false);
    const [nuevaCitaForm, setNuevaCitaForm] = useState({
        pacienteId: '',
        pacienteNombre: '',
        telefono: '',
        servicio: '',
        fecha: format(new Date(), 'yyyy-MM-dd'),
        hora: '10:00',
        duracionMin: 60,
        notas: ''
    });

    // Modal Pase de Salida a Caja (Al finalizar consulta)
    const [modalPaseCaja, setModalPaseCaja] = useState(null); // cita object
    const [paseItems, setPaseItems] = useState([]); // [{ id, nombre, tipo, precio }]
    const [paseNota, setPaseNota] = useState('');
    const [paseTipoCierre, setPaseTipoCierre] = useState('agendar_proxima'); // 'agendar_proxima' | 'cita_unica'
    const [paseProximaFecha, setPaseProximaFecha] = useState(() => format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    const [paseProximaHora, setPaseProximaHora] = useState('10:00');
    const [paseProximoServicio, setPaseProximoServicio] = useState('');
    const [paseMotivoUnica, setPaseMotivoUnica] = useState('');
    const [savingPase, setSavingPase] = useState(false);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) {
            setLoading(false);
            return;
        }

        let unsubCitas = () => {};
        let unsubAlertas = () => {};
        let unsubStaff = () => {};
        const unsubServicios = onServiciosChange((servs) => setServiciosList(servs || []));
        const unsubInventario = onInventarioChange((items) => {
            setProductosList((items || []).filter(i => i.tipo === 'producto' || !i.tipo));
        });

        // Cargar pacientes para agendar cita / cumpleaños
        getPacientes().catch(() => []).then((pacs) => {
            setPacientesList(pacs || []);

            // Cumpleaños de hoy o esta semana
            const currentMonth = new Date().getMonth() + 1;
            const currentDay = new Date().getDate();
            const cumpleHoy = (pacs || []).filter(p => {
                if (!p.fechaNacimiento) return false;
                const parts = String(p.fechaNacimiento).split('-');
                if (parts.length < 3) return false;
                return Number(parts[1]) === currentMonth && Math.abs(Number(parts[2]) - currentDay) <= 2;
            }).map(p => p.nombre);
            setCumpleanosPacientes(cumpleHoy);
        });

        // Paso 1: buscar el documento del staff por UID, Email o Nombre
        getStaffDocByUid(user.uid, user.email, user.displayName).then(foundStaff => {
            const firestoreDocId = foundStaff ? foundStaff.id : user.uid;
            setEspecialistaId(firestoreDocId);
            if (foundStaff) {
                setStaffDoc(foundStaff);
                unsubStaff = onStaffDocChange(firestoreDocId, (updated) => {
                    if (updated) setStaffDoc(updated);
                });
            }

            const identifiers = {
                staffId: firestoreDocId,
                uid: user.uid,
                nombre: foundStaff?.nombre || user.displayName || '',
                email: foundStaff?.email || foundStaff?.correo || user.email || ''
            };

            const mapCitaUI = (c) => {
                const parsedDate = c.fechaHora ? new Date(c.fechaHora) : new Date();
                const validDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
                return {
                    ...c,
                    paciente: c.pacienteNombre || c.paciente || 'Sin nombre',
                    hora: c.fechaHora && !isNaN(new Date(c.fechaHora).getTime())
                        ? format(new Date(c.fechaHora), 'hh:mm a')
                        : (c.hora || '09:00 AM'),
                    hora24: c.fechaHora && !isNaN(new Date(c.fechaHora).getTime())
                        ? format(new Date(c.fechaHora), 'HH:mm')
                        : (c.hora || '09:00'),
                    fecha: validDate,
                    fechaKey: format(validDate, 'yyyy-MM-dd'),
                    dia: format(validDate, "EEEE, dd MMM", { locale: es }),
                    comisionEstimada: c.comisionEstimada || 0,
                    notas: c.notas || c.observaciones || '',
                };
            };

            // Escuchar citas del especialista + todas las citas de la clínica
            unsubCitas = onCitasEspecialistaChange(identifiers, (citasMias, citasClinica) => {
                setMisCitas((citasMias || []).map(mapCitaUI));
                setTodasCitas((citasClinica || []).map(mapCitaUI));
                setLoading(false);
            });

            // Escuchar alertas de sala de espera con sonido melodioso sintetizado
            unsubAlertas = onAlertasEspecialistaChange(identifiers, (nuevasAlertas) => {
                setAlertas(nuevasAlertas);
                if (nuevasAlertas.length > 0) {
                    reproducirSonidoNotificacion();
                }
            });
        }).catch(() => {
            setLoading(false);
        });

        return () => {
            unsubCitas();
            unsubAlertas();
            unsubStaff();
            if (unsubServicios) unsubServicios();
            if (unsubInventario) unsubInventario();
        };
    }, []);

    // El especialista únicamente puede ver su propia agenda asignada
    const citasBase = misCitas;

    // Filtros de búsqueda y estado
    const citasFiltradas = useMemo(() => {
        return citasBase.filter(c => {
            if (filtroEstado !== 'Todos' && c.status !== filtroEstado) return false;
            if (busqueda.trim()) {
                const q = busqueda.toLowerCase();
                const matchPac = (c.paciente || '').toLowerCase().includes(q);
                const matchServ = (c.servicio || '').toLowerCase().includes(q);
                const matchNotas = (c.notas || '').toLowerCase().includes(q);
                if (!matchPac && !matchServ && !matchNotas) return false;
            }
            return true;
        });
    }, [citasBase, filtroEstado, busqueda]);

    const hoyKey = format(new Date(), 'yyyy-MM-dd');
    const citasHoy = useMemo(
        () => citasBase.filter(c => c.fechaKey === hoyKey && c.status !== 'Cancelada'),
        [citasBase, hoyKey]
    );
    const citasCompletadasHoy = citasHoy.filter(c => c.status === 'Completada').length;
    const progresoProductividad = Math.min((citasCompletadasHoy / META_DIARIA_TRATAMIENTOS) * 100, 100);

    // Siguiente paciente en turno hoy (En Cabina > En Sala de Espera > Confirmada > Pendiente)
    const siguienteCitaHoy = useMemo(() => {
        const pendientesHoy = citasHoy.filter(c => c.status !== 'Completada' && c.status !== 'Cancelada');
        const enCabina = pendientesHoy.find(c => c.status === 'En Cabina');
        if (enCabina) return enCabina;
        const enEspera = pendientesHoy.find(c => c.status === 'En Sala de Espera');
        if (enEspera) return enEspera;
        const confirmada = pendientesHoy.find(c => c.status === 'Confirmada');
        if (confirmada) return confirmada;
        return pendientesHoy[0] || null;
    }, [citasHoy]);

    // Citas según modo de vista ('hoy' / 'semana' / 'mes')
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const citasVistaActual = useMemo(() => {
        if (vistaModo === 'hoy') {
            return citasFiltradas.filter(c => c.fechaKey === selectedDateStr);
        }
        if (vistaModo === 'semana') {
            return citasFiltradas.filter(c =>
                c.fecha instanceof Date &&
                !isNaN(c.fecha) &&
                isWithinInterval(c.fecha, { start: weekStart, end: weekEnd })
            );
        }
        // Mes
        const mStart = startOfMonth(monthAnchor);
        const mEnd = endOfMonth(monthAnchor);
        return citasFiltradas.filter(c =>
            c.fecha instanceof Date &&
            !isNaN(c.fecha) &&
            isWithinInterval(c.fecha, { start: mStart, end: mEnd })
        );
    }, [citasFiltradas, vistaModo, selectedDateStr, weekStart, weekEnd, monthAnchor]);

    // Agrupar por fechaKey (yyyy-MM-dd) para evitar errores de formato por idioma
    const citasPorDiaKey = useMemo(() => {
        return citasVistaActual.reduce((acc, cita) => {
            if (!acc[cita.fechaKey]) acc[cita.fechaKey] = [];
            acc[cita.fechaKey].push(cita);
            return acc;
        }, {});
    }, [citasVistaActual]);

    // Días de la semana actual (Lunes a Domingo) para barra rápida
    const diasSemanaActual = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const d = addDays(weekStart, i);
            const key = format(d, 'yyyy-MM-dd');
            const count = citasBase.filter(c => c.fechaKey === key && c.status !== 'Cancelada').length;
            return { date: d, key, count };
        });
    }, [weekStart, citasBase]);

    // Días del mes para vista calendario mensual
    const diasMesActual = useMemo(() => {
        const start = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [monthAnchor]);

    // Comisiones reales desde el documento de staff en Firestore
    const saldoTotal = Number(staffDoc?.saldoComisiones || 0);
    const historial = staffDoc?.historialComisiones || [];
    const comisionServicios = historial
        .filter(h => h.tipoVenta === 'Servicio')
        .reduce((acc, h) => acc + Number(h.comisionGanada || 0), 0);
    const comisionProductos = historial
        .filter(h => h.tipoVenta === 'Producto')
        .reduce((acc, h) => acc + Number(h.comisionGanada || 0), 0);

    // Iniciar sesión en cabina con 1 clic (marca En Cabina y abre Expediente con formulario de Nueva Sesión listo)
    const handleIniciarSesionCabina = async (cita) => {
        try {
            if (cita.status === 'Pendiente' || cita.status === 'Confirmada' || cita.status === 'En Sala de Espera') {
                await updateCitaStatus(cita.id, 'En Cabina');
            }
        } catch (e) {
            console.warn('No se pudo actualizar estado a En Cabina:', e);
        }
        const targetPacId = resolvePacienteId(cita);
        navigate(`/especialista/expediente/${targetPacId}?nuevaSesion=1&citaId=${cita.id}`);
    };

    // Detectar si el paciente del modal Pase a Caja ya tiene una próxima cita agendada en días posteriores
    const proximaCitaExistenteModal = useMemo(() => {
        if (!modalPaseCaja) return null;
        const pacId = String(modalPaseCaja.pacienteId || '').trim();
        const pacNom = String(modalPaseCaja.paciente || '').trim().toLowerCase();
        return todasCitas.find(c =>
            c.id !== modalPaseCaja.id &&
            c.status !== 'Cancelada' &&
            c.fechaKey > modalPaseCaja.fechaKey &&
            ((pacId && c.pacienteId === pacId) || (pacNom && String(c.paciente || '').trim().toLowerCase() === pacNom))
        ) || null;
    }, [modalPaseCaja, todasCitas]);

    // Abrir modal de Pase de Salida a Caja al finalizar consulta
    const handleAbrirPaseCaja = (cita) => {
        setModalPaseCaja(cita);
        setPaseItems(cita.paseCaja?.itemsRecomendados || []);
        setPaseNota(cita.paseCaja?.notaRecepcion || cita.notas || '');
        setPaseTipoCierre('agendar_proxima');
        setPaseProximaFecha(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
        setPaseProximaHora(cita.hora24 || '10:00');
        setPaseProximoServicio(cita.servicio || '');
        setPaseMotivoUnica(cita.paseCaja?.motivoCitaUnica || '');
    };

    const handleToggleItemPase = (item, tipo) => {
        const key = `${tipo}-${item.id}`;
        setPaseItems(prev => {
            if (prev.some(i => i.key === key)) {
                return prev.filter(i => i.key !== key);
            }
            return [...prev, {
                key,
                id: item.id,
                nombre: item.nombre,
                tipo,
                precio: Number(item.precio || 0)
            }];
        });
    };

    const handleConfirmarFinalizarCita = async () => {
        if (!modalPaseCaja) return;

        // Validación obligatoria: o agenda próxima cita (o ya la agendó), o solicita autorización a recepción por cita única
        if (paseTipoCierre === 'agendar_proxima' && !proximaCitaExistenteModal) {
            if (!paseProximaFecha || !paseProximaHora) {
                alert('Es obligatorio seleccionar la Fecha y Hora de la próxima cita para poder dar el Pase a Caja. Si es cita única, selecciona la opción "Es Cita Única (Solicitar autorización a Recepción)".');
                return;
            }
        }

        setSavingPase(true);
        try {
            const user = auth.currentUser;
            const espId = staffDoc?.id || especialistaId || user?.uid || '';
            const espNombre = staffDoc?.nombre || user?.displayName || 'Especialista';

            if (paseTipoCierre === 'agendar_proxima') {
                let proxCitaId = proximaCitaExistenteModal?.id || null;
                let proxFechaFinal = proximaCitaExistenteModal?.fechaKey || paseProximaFecha;
                let proxHoraFinal = proximaCitaExistenteModal?.hora || paseProximaHora;

                // Si aún no tenía próxima cita agendada, crearla ahora mismo
                if (!proximaCitaExistenteModal) {
                    const fechaHoraISO = `${paseProximaFecha}T${paseProximaHora}:00`;
                    proxCitaId = await createCita({
                        pacienteId: modalPaseCaja.pacienteId || '',
                        pacienteNombre: modalPaseCaja.paciente || 'Paciente',
                        telefono: modalPaseCaja.telefono || '',
                        especialistaId: espId,
                        especialistaUid: user?.uid || '',
                        especialistaNombre: espNombre,
                        especialistaEmail: staffDoc?.email || user?.email || '',
                        servicio: paseProximoServicio || modalPaseCaja.servicio || 'Seguimiento',
                        fecha: paseProximaFecha,
                        hora: paseProximaHora,
                        fechaHora: fechaHoraISO,
                        duracionMin: resolverDuracionCitaMinutos({ servicio: paseProximoServicio || modalPaseCaja.servicio, duracionMin: modalPaseCaja.duracionMin }, serviciosList),
                        notas: `Próxima cita agendada al dar Pase a Caja (${modalPaseCaja.servicio || 'Tratamiento'})`,
                        status: 'Confirmada'
                    });
                }

                const paseData = {
                    itemsRecomendados: paseItems,
                    notaRecepcion: paseNota.trim(),
                    especialistaId: espId,
                    especialistaNombre: espNombre,
                    esCitaUnica: false,
                    proximaCitaAgendada: true,
                    proximaCitaId: proxCitaId,
                    proximaCitaFecha: proxFechaFinal,
                    proximaCitaHora: proxHoraFinal,
                    estadoAutorizacion: 'completado',
                    enviadoAt: new Date().toISOString()
                };

                await updateCitaStatus(modalPaseCaja.id, 'Completada', {
                    paseCaja: paseData
                });
                setModalPaseCaja(null);
            } else {
                // CITA ÚNICA: Requiere autorización de Recepción para poder cerrar satisfactoriamente la cita
                const paseData = {
                    itemsRecomendados: paseItems,
                    notaRecepcion: paseNota.trim(),
                    especialistaId: espId,
                    especialistaNombre: espNombre,
                    esCitaUnica: true,
                    motivoCitaUnica: paseMotivoUnica.trim() || 'Cita única / Sin próxima cita',
                    proximaCitaAgendada: false,
                    estadoAutorizacion: 'pendiente_recepcion',
                    solicitadoEn: new Date().toISOString(),
                    enviadoAt: new Date().toISOString()
                };

                await updateCitaStatus(modalPaseCaja.id, 'Pendiente Pase a Caja', {
                    paseCaja: paseData
                });
                setModalPaseCaja(null);
                alert('Solicitud enviada a Recepción. Al ser Cita Única, Recepción deberá autorizar el Pase a Caja en su pantalla para que tu cita quede cerrada satisfactoriamente.');
            }
        } catch (err) {
            console.error(err);
            alert('Error al procesar el Pase a Caja.');
        } finally {
            setSavingPase(false);
        }
    };

    // Agendar nueva cita desde la vista del especialista
    const handleGuardarNuevaCita = async (e) => {
        e.preventDefault();
        if (!nuevaCitaForm.pacienteId && !nuevaCitaForm.pacienteNombre.trim()) {
            alert('Selecciona un paciente.');
            return;
        }
        if (!nuevaCitaForm.servicio) {
            alert('Selecciona el servicio o tratamiento.');
            return;
        }
        setSavingCita(true);
        try {
            const user = auth.currentUser;
            const pacObj = pacientesList.find(p => p.id === nuevaCitaForm.pacienteId);
            const fechaHoraISO = `${nuevaCitaForm.fecha}T${nuevaCitaForm.hora}:00`;

            await createCita({
                pacienteId: pacObj?.id || nuevaCitaForm.pacienteId || '',
                pacienteNombre: pacObj?.nombre || nuevaCitaForm.pacienteNombre.trim(),
                telefono: pacObj?.telefono || nuevaCitaForm.telefono || '',
                especialistaId: staffDoc?.id || especialistaId || user?.uid || '',
                especialistaUid: user?.uid || '',
                especialistaNombre: staffDoc?.nombre || user?.displayName || 'Especialista',
                especialistaEmail: staffDoc?.email || user?.email || '',
                servicio: nuevaCitaForm.servicio,
                fecha: nuevaCitaForm.fecha,
                hora: nuevaCitaForm.hora,
                fechaHora: fechaHoraISO,
                duracionMin: resolverDuracionCitaMinutos({ servicio: nuevaCitaForm.servicio, duracionMin: nuevaCitaForm.duracionMin }, serviciosList),
                notas: nuevaCitaForm.notas.trim(),
                status: 'Confirmada'
            });

            setModalNuevaCitaOpen(false);
            setSelectedDateStr(nuevaCitaForm.fecha);
        } catch (err) {
            console.error(err);
            alert('Error al agendar la cita: ' + err.message);
        } finally {
            setSavingCita(false);
        }
    };

    const semanaLabel = `${format(weekStart, "dd MMM", { locale: es })} — ${format(weekEnd, "dd MMM yyyy", { locale: es })}`;

    return (
        <div className="space-y-6">

            {/* ALERTAS DE LLEGADA (CAMPANA) */}
            {alertas.map((alerta) => (
                <div key={alerta.id} className="bg-amber-50 border-2 border-amber-300 p-4 md:p-5 rounded-2xl shadow-xl animate-in slide-in-from-top-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="bg-amber-100 p-3 rounded-xl text-amber-600 animate-bounce">
                            <Bell size={24} fill="currentColor" />
                        </div>
                        <div>
                            <h3 className="font-black text-amber-900 text-base md:text-lg">¡PACIENTE EN SALA DE ESPERA!</h3>
                            <p className="text-amber-800 font-bold text-sm">{alerta.mensaje}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {alerta.pacienteId && (
                            <Button
                                variant="outline"
                                size="sm"
                                icon={Play}
                                className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
                                onClick={() => {
                                    markAlertAsRead(alerta.id);
                                    navigate(`/especialista/expediente/${alerta.pacienteId}?nuevaSesion=1`);
                                }}
                            >
                                Pasar a Cabina
                            </Button>
                        )}
                        <Button
                            variant="primary"
                            size="sm"
                            icon={CheckCircle}
                            className="bg-amber-600 hover:bg-amber-700 border-none px-5"
                            onClick={() => markAlertAsRead(alerta.id)}
                        >
                            Entendido
                        </Button>
                    </div>
                </div>
            ))}

            {cumpleanosPacientes.length > 0 && (
                <div className="bg-gradient-to-r from-turquesa to-acero text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
                            <Gift size={22} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base leading-tight">¡Pacientes de Cumpleaños! 🎂</h3>
                            <p className="text-white/90 text-xs mt-0.5">
                                Felicita a <span className="font-black underline">{cumpleanosPacientes.join(', ')}</span> en su visita.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* CABECERA PRINCIPAL + VISOR DE COMISIONES */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-black text-acero">Mi Agenda Clínica</h2>
                        {staffDoc?.nombre && (
                            <span className="text-xs font-bold bg-turquesa/10 text-turquesa px-3 py-1 rounded-full border border-turquesa/20">
                                👩‍⚕️ {staffDoc.nombre}
                            </span>
                        )}
                        <Button
                            variant="primary"
                            size="sm"
                            icon={Plus}
                            onClick={() => {
                                setNuevaCitaForm(prev => ({ ...prev, fecha: selectedDateStr }));
                                setModalNuevaCitaOpen(true);
                            }}
                        >
                            + Agendar Cita
                        </Button>
                    </div>

                    {/* Selector de Modo de Vista y Alcance */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex bg-gray-100 p-1 rounded-xl">
                            {[
                                { id: 'hoy', label: '📅 Día / Hoy' },
                                { id: 'semana', label: '📆 Semana' },
                                { id: 'mes', label: '🗓️ Calendario Mensual' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => {
                                        setVistaModo(tab.id);
                                        if (tab.id === 'hoy') setSelectedDateStr(format(new Date(), 'yyyy-MM-dd'));
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                        vistaModo === tab.id
                                            ? 'bg-acero text-white shadow-xs'
                                            : 'text-gray-600 hover:text-acero'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Indicador de Agenda Personal (Exclusiva del Especialista) */}
                        <div className="inline-flex items-center gap-1.5 bg-turquesa/10 border border-turquesa/30 px-3.5 py-1.5 rounded-xl text-xs font-black text-acero">
                            👤 Mis Citas Asignadas ({misCitas.length})
                        </div>
                    </div>
                </div>

                {/* Visor rápido de comisiones */}
                <div className="bg-turquesa/10 px-5 py-3.5 rounded-2xl border border-turquesa/20 text-right flex flex-col justify-center min-w-[230px]">
                    <p className="text-[10px] text-turquesa font-black uppercase tracking-widest mb-0.5">Saldo de Comisiones</p>
                    <p className="text-2xl font-black text-gray-900 leading-none">
                        ${saldoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        <span className="text-xs font-medium text-gray-400 ml-1">MXN</span>
                    </p>
                    <div className="flex justify-end gap-4 mt-2 pt-1.5 border-t border-turquesa/20">
                        <div className="text-left">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Servicios</p>
                            <p className="text-xs font-black text-turquesa">${comisionServicios.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-left">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Productos</p>
                            <p className="text-xs font-black text-acero">${comisionProductos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setModalComisionesOpen(true)}
                        className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white text-turquesa text-xs font-bold rounded-xl border border-turquesa/30 hover:bg-turquesa hover:text-white shadow-xs transition-all cursor-pointer"
                    >
                        <Receipt size={13} /> Ver Detalle de Comisiones
                    </button>
                </div>
            </div>

            {/* TARJETA DESTACADA: PACIENTE EN TURNO / SIGUIENTE CITA DE HOY + PRODUCTIVIDAD */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-acero text-white border-none shadow-lg relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                        {siguienteCitaHoy ? (
                            <>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-turquesa text-white">
                                            <Sparkles size={11} /> {siguienteCitaHoy.status === 'En Cabina' ? 'Actualmente en Cabina' : 'Siguiente Paciente de Hoy'}
                                        </span>
                                        <span className="text-xs font-bold text-turquesa bg-white/10 px-2.5 py-0.5 rounded-lg">
                                            🕒 {siguienteCitaHoy.hora}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-2xl font-black text-white leading-tight">
                                            {siguienteCitaHoy.paciente}
                                        </h3>
                                        {getStatusBadge(siguienteCitaHoy.status)}
                                        {siguienteCitaHoy.cabina && (
                                            <span className="bg-white/20 text-white font-bold text-xs px-2.5 py-0.5 rounded-full border border-white/30">
                                                🏢 {siguienteCitaHoy.cabina}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-200 font-medium">
                                        Tratamiento / Servicio: <span className="font-bold text-turquesa">{siguienteCitaHoy.servicio}</span>
                                    </p>
                                    {siguienteCitaHoy.notas && (
                                        <p className="text-xs text-amber-200 bg-white/10 px-3 py-1.5 rounded-lg italic max-w-xl">
                                            "{siguienteCitaHoy.notas}"
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col sm:flex-row lg:flex-col gap-2 min-w-[210px]">
                                    <button
                                        type="button"
                                        onClick={() => handleIniciarSesionCabina(siguienteCitaHoy)}
                                        className="w-full py-3 px-4 bg-turquesa hover:bg-turquesa/90 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
                                    >
                                        <Play size={16} fill="currentColor" /> Iniciar Sesión en Cabina
                                    </button>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/especialista/expediente/${resolvePacienteId(siguienteCitaHoy)}`)}
                                            className="py-2 px-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            <FileText size={13} /> Expediente
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleAbrirPaseCaja(siguienteCitaHoy)}
                                            className="py-2 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            <ShoppingBag size={13} /> Pase a Caja
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4 py-2">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-turquesa">Estado de Cabina Hoy</span>
                                    <h3 className="text-xl font-black text-white mt-1">
                                        {citasCompletadasHoy > 0
                                            ? `¡Excelente! Completaste tus ${citasCompletadasHoy} citas programadas hoy`
                                            : 'No tienes pacientes pendientes para hoy en tu agenda'}
                                    </h3>
                                    <p className="text-xs text-gray-300 mt-1">
                                        Puedes agendar una cita rápida o abrir el expediente de cualquier paciente desde "Mis Pacientes".
                                    </p>
                                </div>
                                <Button
                                    variant="primary"
                                    icon={Plus}
                                    onClick={() => {
                                        setNuevaCitaForm(prev => ({ ...prev, fecha: hoyKey }));
                                        setModalNuevaCitaOpen(true);
                                    }}
                                >
                                    Agendar Cita Hoy
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Meta de Productividad Diaria */}
                <Card className="bg-acero/5 border-acero/20 shadow-sm flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white rounded-xl shadow-xs text-acero">
                                <Target size={22} />
                            </div>
                            <div>
                                <h3 className="font-black text-acero text-sm">Productividad de Hoy</h3>
                                <p className="text-xs text-gray-500">Meta diaria: {META_DIARIA_TRATAMIENTOS} sesiones</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-gray-900 leading-none">
                                {citasCompletadasHoy}<span className="text-gray-400 text-sm">/{META_DIARIA_TRATAMIENTOS}</span>
                            </p>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Atendidas</span>
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="flex justify-between text-xs font-bold text-gray-500 mb-1.5">
                            <span>Avance del Turno ({citasHoy.length} programadas hoy)</span>
                            <span className={progresoProductividad >= 100 ? 'text-green-600 font-black' : 'text-turquesa font-black'}>
                                {progresoProductividad.toFixed(0)}%
                            </span>
                        </div>
                        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-700 ${
                                    progresoProductividad >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-turquesa to-acero'
                                }`}
                                style={{ width: `${progresoProductividad}%` }}
                            />
                        </div>
                    </div>
                </Card>
            </div>

            {/* BARRA DE NAVEGACIÓN DE FECHAS Y FILTROS */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Controles de navegación según vista */}
                    {vistaModo === 'hoy' && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button
                                variant="outline"
                                size="sm"
                                icon={ChevronLeft}
                                onClick={() => {
                                    const d = addDays(new Date(selectedDateStr + 'T12:00:00'), -1);
                                    setSelectedDateStr(format(d, 'yyyy-MM-dd'));
                                }}
                            >
                                Día Anterior
                            </Button>
                            <input
                                type="date"
                                value={selectedDateStr}
                                onChange={(e) => e.target.value && setSelectedDateStr(e.target.value)}
                                className="px-3 py-1.5 rounded-xl border border-turquesa/40 bg-turquesa/5 text-acero font-black text-sm focus:outline-none"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                icon={ChevronRight}
                                onClick={() => {
                                    const d = addDays(new Date(selectedDateStr + 'T12:00:00'), 1);
                                    setSelectedDateStr(format(d, 'yyyy-MM-dd'));
                                }}
                            >
                                Día Siguiente
                            </Button>
                            {selectedDateStr !== hoyKey && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedDateStr(hoyKey)}
                                >
                                    Ir a Hoy
                                </Button>
                            )}
                        </div>
                    )}

                    {vistaModo === 'semana' && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button
                                variant="outline"
                                size="sm"
                                icon={ChevronLeft}
                                onClick={() => setWeekStart(prev => addDays(prev, -7))}
                            >
                                Semana Anterior
                            </Button>
                            <span className="font-black text-turquesa px-4 py-1.5 bg-turquesa/10 rounded-xl text-sm capitalize">
                                {semanaLabel}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                icon={ChevronRight}
                                onClick={() => setWeekStart(prev => addDays(prev, 7))}
                            >
                                Siguiente Semana
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                            >
                                Esta Semana
                            </Button>
                        </div>
                    )}

                    {vistaModo === 'mes' && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button
                                variant="outline"
                                size="sm"
                                icon={ChevronLeft}
                                onClick={() => setMonthAnchor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                            >
                                Mes Anterior
                            </Button>
                            <span className="font-black text-turquesa px-4 py-1.5 bg-turquesa/10 rounded-xl text-sm capitalize">
                                {format(monthAnchor, 'MMMM yyyy', { locale: es })}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                icon={ChevronRight}
                                onClick={() => setMonthAnchor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                            >
                                Siguiente Mes
                            </Button>
                        </div>
                    )}

                    {/* Buscador y filtro por estado */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar paciente o servicio..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-turquesa w-48 sm:w-56"
                            />
                        </div>
                        <select
                            value={filtroEstado}
                            onChange={(e) => setFiltroEstado(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-gray-50 focus:outline-none"
                        >
                            <option value="Todos">Todos los estados</option>
                            <option value="Pendiente">Por Llegar</option>
                            <option value="En Sala de Espera">En Sala de Espera</option>
                            <option value="Confirmada">Confirmadas</option>
                            <option value="En Cabina">En Cabina</option>
                            <option value="Completada">Completadas</option>
                            <option value="Cancelada">Canceladas</option>
                        </select>
                    </div>
                </div>

                {/* Tira rápida de los 7 días de la semana cuando está en modo Semana o Día */}
                {vistaModo !== 'mes' && (
                    <div className="grid grid-cols-7 gap-1.5 pt-2 border-t border-gray-100">
                        {diasSemanaActual.map(({ date, key, count }) => {
                            const isToday = key === hoyKey;
                            const isSelected = vistaModo === 'hoy' && key === selectedDateStr;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => {
                                        setSelectedDateStr(key);
                                        setVistaModo('hoy');
                                    }}
                                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                                        isSelected
                                            ? 'bg-acero text-white border-acero shadow-sm'
                                            : isToday
                                                ? 'bg-turquesa/10 border-turquesa/40 text-acero'
                                                : 'bg-gray-50/70 border-gray-100 text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    <p className={`text-[10px] font-black uppercase ${isSelected ? 'text-turquesa' : 'text-gray-400'}`}>
                                        {format(date, 'EEE', { locale: es })}
                                    </p>
                                    <p className="text-base font-black leading-tight mt-0.5">
                                        {format(date, 'dd')}
                                    </p>
                                    <span className={`inline-block mt-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                        count > 0
                                            ? isSelected ? 'bg-turquesa text-white' : 'bg-turquesa/20 text-acero'
                                            : 'text-gray-400'
                                    }`}>
                                        {count} {count === 1 ? 'cita' : 'citas'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* VISTA DE CALENDARIO MENSUAL */}
            {vistaModo === 'mes' && !loading && (
                <Card className="p-4">
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase text-gray-400 pb-2 border-b border-gray-100">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                            <div key={d}>{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5 mt-2">
                        {diasMesActual.map((dayDate) => {
                            const key = format(dayDate, 'yyyy-MM-dd');
                            const dayCitas = citasPorDiaKey[key] || [];
                            const isCurrentMonth = dayDate.getMonth() === monthAnchor.getMonth();
                            const isToday = key === hoyKey;
                            return (
                                <div
                                    key={key}
                                    onClick={() => {
                                        setSelectedDateStr(key);
                                        setVistaModo('hoy');
                                    }}
                                    className={`min-h-[88px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                                        !isCurrentMonth
                                            ? 'bg-gray-50/40 border-gray-100 opacity-50'
                                            : isToday
                                                ? 'bg-turquesa/5 border-turquesa shadow-xs'
                                                : 'bg-white border-gray-100 hover:border-turquesa/50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className={`text-xs font-black ${isToday ? 'bg-turquesa text-white px-1.5 py-0.5 rounded-md' : 'text-gray-700'}`}>
                                            {format(dayDate, 'd')}
                                        </span>
                                        {dayCitas.length > 0 && (
                                            <span className="text-[10px] font-black bg-acero/10 text-acero px-1.5 py-0.5 rounded-full">
                                                {dayCitas.length}
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-1 mt-1 overflow-hidden">
                                        {dayCitas.slice(0, 3).map(c => (
                                            <div
                                                key={c.id}
                                                className={`text-[10px] font-bold truncate px-1.5 py-0.5 rounded ${
                                                    c.status === 'Completada'
                                                        ? 'bg-green-50 text-green-700'
                                                        : c.status === 'Confirmada' || c.status === 'En Cabina'
                                                            ? 'bg-turquesa/15 text-acero'
                                                            : 'bg-amber-50 text-amber-800'
                                                }`}
                                            >
                                                {c.hora24} {c.paciente}
                                            </div>
                                        ))}
                                        {dayCitas.length > 3 && (
                                            <p className="text-[9px] font-bold text-gray-400 text-center">
                                                +{dayCitas.length - 3} más
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* LISTA DE CITAS (PARA VISTA DÍA O SEMANA) */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
                    <Loader size={36} className="animate-spin text-turquesa" />
                    <p className="text-sm font-medium">Sincronizando tu agenda clínica en tiempo real...</p>
                </div>
            ) : vistaModo !== 'mes' && Object.keys(citasPorDiaKey).length === 0 ? (
                <div className="text-center py-16 px-4 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200 space-y-3">
                    <Calendar size={44} className="mx-auto text-gray-300" />
                    <div>
                        <p className="text-lg font-bold text-gray-700">
                            {vistaModo === 'hoy'
                                ? `Sin citas programadas para el ${format(new Date(selectedDateStr + 'T12:00:00'), "EEEE dd 'de' MMMM", { locale: es })}`
                                : 'Sin citas registradas en esta semana'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            Puedes agendar una cita directamente con el botón de abajo.
                        </p>
                    </div>
                    <div className="flex justify-center gap-3 pt-2">
                        <Button
                            variant="primary"
                            size="sm"
                            icon={Plus}
                            onClick={() => {
                                setNuevaCitaForm(prev => ({ ...prev, fecha: selectedDateStr }));
                                setModalNuevaCitaOpen(true);
                            }}
                        >
                            + Agendar Cita Aquí
                        </Button>
                    </div>
                </div>
            ) : vistaModo !== 'mes' && (
                <div className="space-y-8">
                    {Object.keys(citasPorDiaKey).sort().map((fechaKey) => {
                        const diaCitas = citasPorDiaKey[fechaKey];
                        const diaLabel = format(new Date(fechaKey + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: es });
                        const esHoy = fechaKey === hoyKey;

                        return (
                            <div key={fechaKey} className="space-y-3">
                                <div className="flex items-center justify-between border-b-2 border-turquesa/20 pb-2">
                                    <div className="flex items-center gap-2.5">
                                        <h3 className={`text-base font-black px-3.5 py-1 rounded-xl capitalize ${
                                            esHoy ? 'bg-turquesa text-white' : 'bg-turquesa/10 text-acero'
                                        }`}>
                                            {esHoy ? `📍 HOY — ${diaLabel}` : diaLabel}
                                        </h3>
                                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                                            {diaCitas.length} {diaCitas.length === 1 ? 'Cita' : 'Citas'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNuevaCitaForm(prev => ({ ...prev, fecha: fechaKey }));
                                            setModalNuevaCitaOpen(true);
                                        }}
                                        className="text-xs font-bold text-turquesa hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <Plus size={14} /> Agregar cita este día
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {diaCitas.map((cita) => {
                                        return (
                                            <Card key={cita.id} className="relative overflow-hidden group hover:border-turquesa transition-all">
                                                {cita.status === 'En Cabina' && <div className="absolute top-0 left-0 w-2 h-full bg-turquesa animate-pulse" />}
                                                {cita.status === 'En Sala de Espera' && <div className="absolute top-0 left-0 w-2 h-full bg-amber-400 animate-pulse" />}
                                                {cita.status === 'Confirmada' && <div className="absolute top-0 left-0 w-2 h-full bg-turquesa" />}
                                                {cita.status === 'Completada' && <div className="absolute top-0 left-0 w-2 h-full bg-green-500" />}
                                                {cita.status === 'Pendiente Pase a Caja' && <div className="absolute top-0 left-0 w-2 h-full bg-amber-500 animate-pulse" />}
                                                {cita.status === 'Pendiente' && <div className="absolute top-0 left-0 w-2 h-full bg-yellow-400" />}
                                                {cita.status === 'Cancelada' && <div className="absolute top-0 left-0 w-2 h-full bg-red-400" />}

                                                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                                                    <div className="flex gap-4 items-start">
                                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center min-w-[85px]">
                                                            <Clock size={16} className="mx-auto text-acero mb-1" />
                                                            <span className="text-sm font-black text-gray-900 block">{cita.hora}</span>
                                                            {cita.duracionMin && (
                                                                <span className="text-[10px] font-bold text-gray-400">{cita.duracionMin} min</span>
                                                            )}
                                                        </div>

                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4
                                                                    onClick={() => navigate(`/especialista/expediente/${resolvePacienteId(cita)}`)}
                                                                    className="text-lg font-black text-acero hover:text-turquesa cursor-pointer transition-colors"
                                                                >
                                                                    {cita.paciente}
                                                                </h4>
                                                                {getStatusBadge(cita.status)}
                                                                {cita.cabina && (
                                                                    <span className="text-[11px] font-bold bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full border border-purple-200">
                                                                        🏢 {cita.cabina}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {cita.status === 'En Sala de Espera' && (
                                                                <div className="pt-0.5">
                                                                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 animate-pulse">
                                                                        🔔 ¡Paciente en Sala de Espera! Listo para pasar a cabina.
                                                                    </span>
                                                                </div>
                                                            )}

                                                            <p className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                                                                <Sparkles size={14} className="text-turquesa" /> {cita.servicio}
                                                            </p>

                                                            {cita.notas && (
                                                                <p className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg italic border border-gray-100">
                                                                    "{cita.notas}"
                                                                </p>
                                                            )}

                                                            {cita.paseCaja?.itemsRecomendados?.length > 0 && (
                                                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                                    <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                                                        🛒 Pase a Caja: {cita.paseCaja.itemsRecomendados.map(i => i.nombre).join(', ')}
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {cita.status === 'Pendiente Pase a Caja' && (
                                                                <div className="pt-1">
                                                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                                                        ⏳ Cita Única — Esperando autorización de Recepción para cerrar satisfactoriamente
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {cita.paseCaja?.estadoAutorizacion === 'rechazado' && cita.status !== 'Completada' && (
                                                                <div className="pt-1">
                                                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                                                                        ⚠️ Recepción rechazó el cierre como Cita Única. Por favor agenda la próxima cita en "Finalizar / Pase a Caja".
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Acciones Rápidas en 1 Toque */}
                                                    <div className="flex flex-wrap items-center gap-2 justify-end">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            icon={FileText}
                                                            onClick={() => navigate(`/especialista/expediente/${resolvePacienteId(cita)}`)}
                                                        >
                                                            Expediente
                                                        </Button>

                                                        {cita.status !== 'Completada' && cita.status !== 'Cancelada' && (
                                                            <>
                                                                <Button
                                                                    variant="primary"
                                                                    size="sm"
                                                                    icon={Play}
                                                                    onClick={() => handleIniciarSesionCabina(cita)}
                                                                >
                                                                    Iniciar Sesión
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    icon={ShoppingBag}
                                                                    className={cita.status === 'Pendiente Pase a Caja'
                                                                        ? 'border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100'
                                                                        : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}
                                                                    onClick={() => handleAbrirPaseCaja(cita)}
                                                                >
                                                                    {cita.status === 'Pendiente Pase a Caja' ? 'Ver Pase / Agendar Próxima' : 'Finalizar / Pase a Caja'}
                                                                </Button>
                                                            </>
                                                        )}

                                                        {cita.status === 'Completada' && (
                                                            <div className="py-1.5 px-3 bg-green-50 text-green-700 rounded-xl text-xs font-black flex items-center gap-1.5 border border-green-200">
                                                                <CheckCircle size={15} /> Atendida
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL AGENDAR CITA RÁPIDA (ESPECIALISTA) */}
            <Modal
                isOpen={modalNuevaCitaOpen}
                onClose={() => setModalNuevaCitaOpen(false)}
                title="Agendar Cita para Paciente"
            >
                <form onSubmit={handleGuardarNuevaCita} className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1">Paciente *</label>
                        <select
                            required
                            value={nuevaCitaForm.pacienteId}
                            onChange={(e) => {
                                const pac = pacientesList.find(p => p.id === e.target.value);
                                setNuevaCitaForm(prev => ({
                                    ...prev,
                                    pacienteId: e.target.value,
                                    pacienteNombre: pac?.nombre || '',
                                    telefono: pac?.telefono || ''
                                }));
                            }}
                            className="w-full p-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-turquesa"
                        >
                            <option value="">— Seleccionar paciente —</option>
                            {pacientesList.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.nombre} {p.telefono ? `(${p.telefono})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1">Servicio / Tratamiento *</label>
                        <select
                            required
                            value={nuevaCitaForm.servicio}
                            onChange={(e) => {
                                const val = e.target.value;
                                const servObj = serviciosList.find(s => s.nombre === val);
                                const durCalc = resolverDuracionCitaMinutos(servObj || { servicio: val }, serviciosList);
                                setNuevaCitaForm(prev => ({ ...prev, servicio: val, duracionMin: durCalc }));
                            }}
                            className="w-full p-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-turquesa"
                        >
                            <option value="">— Seleccionar servicio —</option>
                            {serviciosList.map(s => (
                                <option key={s.id} value={s.nombre}>
                                    {s.nombre} {s.precio ? `($${s.precio})` : ''}
                                </option>
                            ))}
                            <option value="Sesión de Paquete Reductivo">Sesión de Paquete Reductivo</option>
                            <option value="Valoración Corporal / Facial">Valoración Corporal / Facial</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Fecha *</label>
                            <input
                                type="date"
                                required
                                value={nuevaCitaForm.fecha}
                                onChange={(e) => setNuevaCitaForm(prev => ({ ...prev, fecha: e.target.value }))}
                                className="w-full p-2.5 rounded-xl border border-gray-200 text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Hora *</label>
                            <input
                                type="time"
                                required
                                value={nuevaCitaForm.hora}
                                onChange={(e) => setNuevaCitaForm(prev => ({ ...prev, hora: e.target.value }))}
                                className="w-full p-2.5 rounded-xl border border-gray-200 text-sm font-bold"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1">Notas / Indicaciones de Cabina</label>
                        <textarea
                            rows={2}
                            value={nuevaCitaForm.notas}
                            onChange={(e) => setNuevaCitaForm(prev => ({ ...prev, notas: e.target.value }))}
                            placeholder="Ej. Sesión 4 de paquete, enfocar abdomen..."
                            className="w-full p-2.5 rounded-xl border border-gray-200 text-sm"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setModalNuevaCitaOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" variant="primary" disabled={savingCita}>
                            {savingCita ? 'Agendando...' : 'Confirmar Cita'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* MODAL PASE DE SALIDA A CAJA (FINALIZAR CONSULTA) */}
            <Modal
                isOpen={!!modalPaseCaja}
                onClose={() => setModalPaseCaja(null)}
                title="Finalizar Consulta y Pase de Salida a Caja"
                maxWidth="max-w-2xl"
            >
                {modalPaseCaja && (
                    <div className="space-y-4">
                        <div className="bg-turquesa/10 border border-turquesa/20 p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase text-turquesa">Paciente Atendido</p>
                                <h4 className="text-lg font-black text-acero">{modalPaseCaja.paciente}</h4>
                                <p className="text-xs font-bold text-gray-600">Servicio de cita: {modalPaseCaja.servicio}</p>
                            </div>
                            <Badge variant={paseTipoCierre === 'cita_unica' ? 'yellow' : 'green'}>
                                {paseTipoCierre === 'cita_unica' ? 'Solicitud Cita Única' : 'Con Próxima Cita'}
                            </Badge>
                        </div>

                        {/* PASO 1 OBLIGATORIO: AGENDAR PRÓXIMA CITA O SOLICITAR AUTORIZACIÓN DE CITA ÚNICA */}
                        <div className="p-4 rounded-2xl border-2 border-turquesa/30 bg-turquesa/5 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs font-black uppercase text-acero">
                                        📅 Paso 1 (Obligatorio): Seguimiento / Próxima Cita
                                    </p>
                                    <p className="text-[11px] text-gray-600">
                                        Para dar el pase a caja es obligatorio agendar la próxima cita, o solicitar autorización a Recepción si es Cita Única.
                                    </p>
                                </div>
                            </div>

                            {/* Selector de modalidad de cierre */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPaseTipoCierre('agendar_proxima')}
                                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                        paseTipoCierre === 'agendar_proxima'
                                            ? 'bg-acero text-white border-acero shadow-sm'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-turquesa'
                                    }`}
                                >
                                    <p className="text-xs font-black">📅 Agendar Próxima Cita (Obligatorio)</p>
                                    <p className={`text-[10px] mt-0.5 ${paseTipoCierre === 'agendar_proxima' ? 'text-gray-200' : 'text-gray-500'}`}>
                                        Cierra la cita satisfactoriamente al instante
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPaseTipoCierre('cita_unica')}
                                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                        paseTipoCierre === 'cita_unica'
                                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-amber-400'
                                    }`}
                                >
                                    <p className="text-xs font-black">🔒 Es Cita Única (Pedir Autorización)</p>
                                    <p className={`text-[10px] mt-0.5 ${paseTipoCierre === 'cita_unica' ? 'text-amber-100' : 'text-gray-500'}`}>
                                        Requiere autorización de Recepción para cerrar
                                    </p>
                                </button>
                            </div>

                            {paseTipoCierre === 'agendar_proxima' ? (
                                proximaCitaExistenteModal ? (
                                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
                                        <span>
                                            ✅ El paciente ya cuenta con próxima cita agendada el <strong>{proximaCitaExistenteModal.dia}</strong> a las <strong>{proximaCitaExistenteModal.hora}</strong> ({proximaCitaExistenteModal.servicio}).
                                        </span>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white p-3 rounded-xl border border-gray-200">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Próxima Fecha *</label>
                                            <input
                                                type="date"
                                                required
                                                min={hoyKey}
                                                value={paseProximaFecha}
                                                onChange={(e) => setPaseProximaFecha(e.target.value)}
                                                className="w-full p-2 rounded-lg border border-gray-200 text-xs font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Hora *</label>
                                            <input
                                                type="time"
                                                required
                                                value={paseProximaHora}
                                                onChange={(e) => setPaseProximaHora(e.target.value)}
                                                className="w-full p-2 rounded-lg border border-gray-200 text-xs font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Servicio Seguimiento *</label>
                                            <select
                                                value={paseProximoServicio}
                                                onChange={(e) => setPaseProximoServicio(e.target.value)}
                                                className="w-full p-2 rounded-lg border border-gray-200 text-xs font-bold"
                                            >
                                                <option value={modalPaseCaja.servicio || 'Sesión de Seguimiento'}>
                                                    {modalPaseCaja.servicio || 'Mismo servicio'}
                                                </option>
                                                {serviciosList.map(s => (
                                                    <option key={s.id} value={s.nombre}>{s.nombre}</option>
                                                ))}
                                                <option value="Sesión de Paquete Reductivo">Sesión de Paquete Reductivo</option>
                                                <option value="Valoración de Control">Valoración de Control</option>
                                            </select>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-2">
                                    <p className="text-[11px] font-bold text-amber-900">
                                        ⚠️ Al marcar como <strong>Cita Única</strong>, tu cita quedará en estado <strong>"Esperando Autorización de Recepción"</strong> hasta que Recepción valide y autorice el Pase a Caja.
                                    </p>
                                    <div>
                                        <label className="block text-[10px] font-black text-amber-900 uppercase mb-1">
                                            Motivo de Cita Única (Para validación en Recepción) *
                                        </label>
                                        <input
                                            type="text"
                                            value={paseMotivoUnica}
                                            onChange={(e) => setPaseMotivoUnica(e.target.value)}
                                            placeholder="Ej. Paciente foráneo, limpieza facial única, alta de tratamiento..."
                                            className="w-full p-2 rounded-lg border border-amber-300 bg-white text-xs font-medium"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <p className="text-xs font-black text-gray-600 uppercase mb-2">
                                🛒 Paso 2: ¿Recomendaste o aplicaste algún Producto / Servicio adicional para cobro en Recepción?
                            </p>
                            <p className="text-[11px] text-gray-400 mb-3">
                                Selecciona los productos o servicios extra para que Recepción los vea listos al cobrar y tu comisión quede vinculada.
                            </p>

                            <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-xl p-3 space-y-3 bg-gray-50/50">
                                {productosList.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-acero mb-1.5">Productos de Apoyo en Casa / Cabina</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {productosList.map(prod => {
                                                const active = paseItems.some(i => i.key === `Producto-${prod.id}`);
                                                return (
                                                    <button
                                                        key={prod.id}
                                                        type="button"
                                                        onClick={() => handleToggleItemPase(prod, 'Producto')}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                                            active
                                                                ? 'bg-turquesa text-white border-turquesa shadow-xs'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-turquesa'
                                                        }`}
                                                    >
                                                        {active ? '✓ ' : '+ '}{prod.nombre} (${prod.precio || 0})
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {serviciosList.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-acero mb-1.5">Servicios / Sesiones Adicionales</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {serviciosList.map(serv => {
                                                const active = paseItems.some(i => i.key === `Servicio-${serv.id}`);
                                                return (
                                                    <button
                                                        key={serv.id}
                                                        type="button"
                                                        onClick={() => handleToggleItemPase(serv, 'Servicio')}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                                            active
                                                                ? 'bg-acero text-white border-acero shadow-xs'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-acero'
                                                        }`}
                                                    >
                                                        {active ? '✓ ' : '+ '}{serv.nombre} (${serv.precio || 0})
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-600 uppercase mb-1.5 flex items-center justify-between">
                                <span>🩺 Indicaciones Concierge & Nota para Recepción</span>
                                <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md">Visible en la App del Paciente</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {[
                                    '💧 Tomar 2.5L de agua hoy',
                                    '🚫 Evitar vapor/sauna 24h',
                                    '🚶‍♀️ Caminata suave de 20 min',
                                    '🥗 Alimentación antiinflamatoria',
                                    '🧴 Aplicar gel reafirmante en zona'
                                ].map((chip, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setPaseNota(prev => prev ? `${prev}. ${chip}` : chip)}
                                        className="text-[10px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                                    >
                                        + {chip}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                value={paseNota}
                                onChange={(e) => setPaseNota(e.target.value)}
                                placeholder="Ej. Cobrar sesión suelta + crema reductiva, agendar próxima semana..."
                                className="w-full p-2.5 rounded-xl border border-gray-200 text-sm"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                            <Button type="button" variant="ghost" onClick={() => setModalPaseCaja(null)}>
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                icon={CheckCircle}
                                disabled={savingPase}
                                onClick={handleConfirmarFinalizarCita}
                            >
                                {savingPase
                                    ? 'Procesando...'
                                    : paseTipoCierre === 'cita_unica'
                                        ? '🔒 Solicitar Autorización a Recepción (Cita Única)'
                                        : '✅ Agendar Próxima Cita y Enviar Pase a Caja'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL DETALLE DE COMISIONES */}
            <Modal
                isOpen={modalComisionesOpen}
                onClose={() => setModalComisionesOpen(false)}
                title="Detalle de Mis Comisiones"
                maxWidth="max-w-4xl"
            >
                {staffDoc && (
                    <DetalleComisionesContent
                        staffDoc={staffDoc}
                        isModal={true}
                        onCloseModal={() => setModalComisionesOpen(false)}
                    />
                )}
            </Modal>
        </div>
    );
}
