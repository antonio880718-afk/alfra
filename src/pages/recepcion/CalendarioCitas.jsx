import { enviarWhatsAppCita } from '../../services/whatsappService';
import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import {
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, User, FileText, AlertCircle, AlertTriangle, Building, Sparkles,
    MessageCircle, Plus, Info, X, CheckCircle, Loader, Bell, Search,
    Filter, LayoutGrid, List, Navigation, History, Trash2, Edit, PlusCircle, MapPin, Stamp, Heart, MessageSquare, Gift
} from 'lucide-react';
import { format, addDays, subDays, startOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import ReciboDigital from '../../components/ui/ReciboDigital';
import AgendaGlobalEjecutiva from '../../components/agenda/AgendaGlobalEjecutiva';
import { obtenerProximosCumpleanos } from '../../utils/cumpleanosUtils';
import ModalTarjetaCumpleanos from '../../components/cumpleanos/ModalTarjetaCumpleanos';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { onCitasChange, createCita, updateCitaStatus, crearAlertaPaciente, CABINAS_ALFRA, checkConflictoCabina, checkConflictoEspecialista, citaMatchesEspecialista, resolverDuracionCitaMinutos, extraerRangoCitaLocal, isStaffClinico, getTratamientosYPlanesActivosPaciente, verificarMovimientosExpediente } from '../../services/citasService';
import { onServiciosChange } from '../../services/comercialService';
import { createRecibo } from '../../services/recibosService';
import { onStaffChange } from '../../services/staffService';
import { onPacientesChange } from '../../services/pacientesService';
import { sellarVisita } from '../../services/lealtadService';
import { addDoc, collection, serverTimestamp, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// Colores dinámicos para especialistas (Premium Palette)
const COLORS = [
    'bg-turquesa/10 border-turquesa/30 text-turquesa',
    'bg-indigo-50 border-indigo-200 text-indigo-700',
    'bg-emerald-50 border-emerald-200 text-emerald-700',
    'bg-rose-50 border-rose-200 text-rose-700',
    'bg-amber-50 border-amber-200 text-amber-700',
];

export default function CalendarioCitas() {
    const { userRole, currentUser } = useAuth();
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [busquedaGlobal, setBusquedaGlobal] = useState('');

    // Tratamientos Activos del Paciente
    const [isPreguntaTratamientoOpen, setIsPreguntaTratamientoOpen] = useState(false);
    const [tratamientosActivosEncontrados, setTratamientosActivosEncontrados] = useState([]);
    const [buscandoTratamientos, setBuscandoTratamientos] = useState(false);
    const [tratamientoSeleccionado, setTratamientoSeleccionado] = useState(null);
    const [isVerificacionFinancieraOpen, setIsVerificacionFinancieraOpen] = useState(false);
    const [montoSesionPropuesto, setMontoSesionPropuesto] = useState('');
    const [sesionYaPagada, setSesionYaPagada] = useState(false);

    // Modal Rápido de Reagendación (Solo Fecha y Hora)
    const [citaAReagendar, setCitaAReagendar] = useState(null);
    const [reagendarFecha, setReagendarFecha] = useState('');
    const [reagendarHora, setReagendarHora] = useState('');
    const [reagendarCabina, setReagendarCabina] = useState('');
    const [reagendarEspecialistaId, setReagendarEspecialistaId] = useState('');
    const [reagendarEspecialistaNombre, setReagendarEspecialistaNombre] = useState('');
    const [savingReagendar, setSavingReagendar] = useState(false);
    const [viewMode, setViewMode] = useState('tablero'); // 'tablero' | 'lista' | 'disponibilidad'
    const [availView, setAvailView] = useState('dia'); // 'dia' | 'semana'
    const [citas, setCitas] = useState([]);
    const [loadingCitas, setLoadingCitas] = useState(true);
    const [pacientesLista, setPacientesLista] = useState([]);
    const [pacienteCumpleModal, setPacienteCumpleModal] = useState(null);
    const [showCumpleanosModal, setShowCumpleanosModal] = useState(false);

    useEffect(() => {
        const unsubP = onPacientesChange((pList) => {
            setPacientesLista(pList || []);
        });
        return () => { if (unsubP) unsubP(); };
    }, []);

    const cumpleanosProximos = useMemo(() => {
        return obtenerProximosCumpleanos(pacientesLista, 30);
    }, [pacientesLista]);
    const [saving, setSaving] = useState(false);
    const [isModaling, setIsModaling] = useState(false);
    const [editingCitaId, setEditingCitaId] = useState(null); // null = nueva cita, 'abc' = editando cita existente
    const [isNuevoPacienteModaling, setIsNuevoPacienteModaling] = useState(false);
    const [formNuevoPaciente, setFormNuevoPaciente] = useState({
        nombre: '', telefono: '', email: '', fechaNacimiento: ''
    });

    // Datos reales desde Firestore
    const [especialistas, setEspecialistas] = useState([]);
    const [pacientes, setPacientes] = useState([]);
    const [servicios, setServicios] = useState([]);
    const [pacienteFiltro, setPacienteFiltro] = useState('');
    const [showPacienteSuggestions, setShowPacienteSuggestions] = useState(false);
    const [servicioFiltro, setServicioFiltro] = useState('');
    const [showServicioSuggestions, setShowServicioSuggestions] = useState(false);
    const [selectedServicios, setSelectedServicios] = useState([]);
    const [isConfirmDuracionOpen, setIsConfirmDuracionOpen] = useState(false);
    const [isPedirPrecioOpen, setIsPedirPrecioOpen] = useState(false);
    const [precioManual, setPrecioManual] = useState('');

    // Estado para el Recibo
    const [isReciboOpen, setIsReciboOpen] = useState(false);
    const [reciboActual, setReciboActual] = useState(null);

    // ── Lealtad (Sellado desde Recepción) ─────────────────────────
    const [sellandoCitaId, setSellandoCitaId] = useState(null);
    const [selloMsg, setSelloMsg] = useState(null); // { citaId, msg, ok }

    const handleSellarDesdeCita = async (cita) => {
        if (!cita.pacienteId) {
            setSelloMsg({ citaId: cita.id, msg: '⚠️ Paciente sin ID vinculado. Vincúla desde Admin > Pacientes.', ok: false });
            setTimeout(() => setSelloMsg(null), 4000);
            return;
        }
        setSellandoCitaId(cita.id);
        setSelloMsg(null);
        try {
            const res = await sellarVisita(cita.pacienteId);
            setSelloMsg({ citaId: cita.id, msg: res.msg, ok: res.ok });
            setTimeout(() => setSelloMsg(null), 4000);
        } catch (err) {
            setSelloMsg({ citaId: cita.id, msg: '❌ Error: ' + err.message, ok: false });
        } finally {
            setSellandoCitaId(null);
        }
    };

    // Filtro multi-selección para disponibilidad
    const [selectedEspIds, setSelectedEspIds] = useState(['todos']);
    const [duracionFiltro, setDuracionFiltro] = useState(90);
    const [isCopied, setIsCopied] = useState(false);
    const [isUbicacionCopied, setIsUbicacionCopied] = useState(false);

    // Suscripción citas en tiempo real
    useEffect(() => {
        const unsub = onCitasChange((citasFirestore) => {
            const normalized = citasFirestore.map(c => {
                // Si la fecha ya viene en formato local (ISO sin Z) o es vieja con Z
                let fechaObj;
                if (c.fechaHora && c.fechaHora.includes('T')) {
                    // Si incluye 'T' pero no 'Z', es el nuevo formato local
                    // Si incluye 'T' y 'Z', es el viejo formato UTC
                    fechaObj = new Date(c.fechaHora);
                } else if (c.fecha) {
                    const [y, m, d] = c.fecha.split('-');
                    fechaObj = new Date(y, m - 1, d);
                } else {
                    fechaObj = new Date();
                }

                const h = c.hora || format(fechaObj, 'HH:mm');
                const fechaYMD = format(fechaObj, 'yyyy-MM-dd');
                const horaFormateada = format(fechaObj, 'hh:mm a');

                return {
                    ...c,
                    hora: h,
                    fechaYMD,
                    horaFormateada,
                    paciente: c.pacienteNombre || c.paciente || 'Sin nombre',
                    especialista: c.especialistaNombre || c.especialistaId || '---',
                    log: c.log || 'Registrado en sistema',
                };
            });
            setCitas(normalized);
            setLoadingCitas(false);
        });
        return () => unsub();
    }, []);

    // Suscripción especialistas
    useEffect(() => {
        const unsub = onStaffChange((staff) => {
            const filteredStaff = staff.filter(isStaffClinico);
            setEspecialistas(filteredStaff.map((s, idx) => ({
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

    // Suscripción servicios
    useEffect(() => {
        const unsub = onServiciosChange(setServicios);
        return () => unsub();
    }, []);

    const [newCita, setNewCita] = useState({
        pacienteId: '', paciente: '', telefono: '', servicio: '',
        especialistaId: '', especialistaNombre: '', hora: '09:00',
        duracionMin: 90, fecha: new Date().toISOString().split('T')[0], notas: '',
        monto: '', citaPagada: false, cabina: '', anticipo: ''
    });

        const conflictoCabinaReagendar = useMemo(() => {
        if (!citaAReagendar || !reagendarCabina || !reagendarFecha || !reagendarHora) return null;
        return checkConflictoCabina(citas, {
            cabina: reagendarCabina,
            fechaYMD: reagendarFecha,
            hora: reagendarHora,
            duracionMin: citaAReagendar.duracionMin || 60,
            ignoreCitaId: citaAReagendar.id
        });
    }, [citas, citaAReagendar, reagendarCabina, reagendarFecha, reagendarHora]);

    const especialistaEstaDeBaja = useMemo(() => {
        if (!citaAReagendar) return false;
        const espId = reagendarEspecialistaId || citaAReagendar.especialistaId;
        const espNom = reagendarEspecialistaNombre || citaAReagendar.especialistaNombre || citaAReagendar.especialista;
        if (!espId && !espNom) return false;
        const esActivo = especialistas.some(e =>
            (espId && e.id === espId) ||
            (espNom && (e.nombre || '').toLowerCase().trim() === String(espNom).toLowerCase().trim())
        );
        return !esActivo;
    }, [especialistas, citaAReagendar, reagendarEspecialistaId, reagendarEspecialistaNombre]);

    const handleSeleccionarPaciente = async (p) => {
        setNewCita(prev => ({
            ...prev,
            pacienteId: p.id,
            paciente: p.nombre,
            telefono: p.telefono || prev.telefono || ''
        }));
        setPacienteFiltro('');
        setShowPacienteSuggestions(false);

        // Buscar si tiene tratamientos o planes activos
        setBuscandoTratamientos(true);
        try {
            const activos = await getTratamientosYPlanesActivosPaciente(p.id);
            if (activos && activos.length > 0) {
                setTratamientosActivosEncontrados(activos);
                setIsPreguntaTratamientoOpen(true);
            }
        } catch (err) {
            console.warn('Error al buscar tratamientos activos:', err);
        } finally {
            setBuscandoTratamientos(false);
        }
    };

    const getStaffDisplayTitle = (espId, espNombre) => {
        if (!espNombre && !espId) return 'Por asignar';
        const esp = especialistas.find(s => s.id === espId || s.nombre?.toLowerCase() === espNombre?.toLowerCase());
        const puesto = (esp?.puesto || esp?.rol || '').trim();
        const pLow = puesto.toLowerCase();
        const name = esp?.nombre || espNombre;

        if (pLow.includes('doctor') || pLow.includes('medic') || pLow.includes('médic')) {
            return `Dr(a). ${name}`;
        }
        if (pLow.includes('cosmet') || pLow.includes('cosmiat')) {
            return `Cosmetóloga ${name}`;
        }
        if (pLow.includes('nutri')) {
            return `Nutrióloga/o ${name}`;
        }
        if (pLow.includes('enferm')) {
            return `Enfra. ${name}`;
        }
        if (pLow.includes('terap')) {
            return `Terapeuta ${name}`;
        }
        if (puesto) {
            return `${puesto}: ${name}`;
        }
        return `Especialista: ${name}`;
    };

    const handleSeleccionarTratamientoActivo = (trat) => {
        setTratamientoSeleccionado(trat);
        setIsPreguntaTratamientoOpen(false);

        let montoSugerido = 0;
        let yaPagada = false;

        if (trat.costoPorSesion > 0) {
            montoSugerido = trat.costoPorSesion;
        } else if (trat.tienePlan && trat.faltante <= 0 && trat.meta > 0) {
            montoSugerido = 0;
            yaPagada = true;
        } else {
            const servEncontrado = servicios.find(s => s.nombre?.toLowerCase() === trat.nombre?.toLowerCase());
            montoSugerido = Number(servEncontrado?.precioVenta || servEncontrado?.precio || 0);
        }

        setMontoSesionPropuesto(montoSugerido.toString());
        setSesionYaPagada(yaPagada);
        setIsVerificacionFinancieraOpen(true);
    };

    const handleConfirmarFinanciamientoSesion = () => {
        if (!tratamientoSeleccionado) return;
        const t = tratamientoSeleccionado;
        const montoFinal = sesionYaPagada ? '0' : (montoSesionPropuesto || '0');

        const durRealTrat = resolverDuracionCitaMinutos(t, servicios);
        setSelectedServicios([{
            id: t.id || ('trat_activo_' + Date.now()),
            nombre: t.nombre,
            precio: montoFinal,
            duracionMin: durRealTrat,
            esTratamientoActivo: true
        }]);
        setServicioFiltro('');

        setNewCita(prev => ({
            ...prev,
            servicio: t.nombre,
            duracionMin: durRealTrat,
            especialistaId: t.especialistaId || prev.especialistaId || '',
            especialistaNombre: t.especialistaNombre || prev.especialistaNombre || '',
            citaPagada: sesionYaPagada,
            monto: montoFinal,
            notas: prev.notas
                ? `${prev.notas} | ${t.nombre} (${sesionYaPagada ? 'Sesión ya pagada' : 'A cobrar: $' + montoFinal})`
                : `${t.nombre} (${sesionYaPagada ? 'Sesión ya pagada' : 'A cobrar: $' + montoFinal})`
        }));
        setIsVerificacionFinancieraOpen(false);
        setTratamientoSeleccionado(null);
    };

    const handleRechazarTratamientoActivo = () => {
        setIsPreguntaTratamientoOpen(false);
    };

    const handleAbrirReagendarRapido = (cita) => {
        setCitaAReagendar(cita);
        const ymd = cita.fechaYMD || (cita.fechaHora ? String(cita.fechaHora).split('T')[0] : (cita.fecha || new Date().toISOString().split('T')[0]));
        setReagendarFecha(ymd);
        setReagendarHora(cita.hora || '10:00');
        setReagendarCabina(cita.cabina || '');

        const espId = cita.especialistaId;
        const espNom = cita.especialistaNombre || cita.especialista;
        const sigueActivo = especialistas.some(e =>
            (espId && e.id === espId) ||
            (espNom && (e.nombre || '').toLowerCase().trim() === String(espNom).toLowerCase().trim())
        );

        if (sigueActivo) {
            setReagendarEspecialistaId(espId || '');
            setReagendarEspecialistaNombre(espNom || '');
        } else {
            setReagendarEspecialistaId('');
            setReagendarEspecialistaNombre('');
        }
    };

    const handleConfirmarReagendacionRapida = async () => {
        if (!citaAReagendar || !reagendarFecha || !reagendarHora) {
            alert('Por favor selecciona fecha y hora para reagendar.');
            return;
        }
        if (especialistaEstaDeBaja && !reagendarEspecialistaId) {
            alert('La especialista anterior ya no labora en la clínica. Por favor selecciona una especialista activa de la lista.');
            return;
        }
        setSavingReagendar(true);
        try {
            const [year, month, day] = reagendarFecha.split('-');
            const [hh, mm] = reagendarHora.split(':');
            const fechaBase = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hh), parseInt(mm));
            const fechaHoraLocal = format(fechaBase, "yyyy-MM-dd'T'HH:mm:ss");

            const finalEspId = reagendarEspecialistaId || citaAReagendar.especialistaId || null;
            const finalEspNombre = reagendarEspecialistaNombre || citaAReagendar.especialistaNombre || citaAReagendar.especialista || 'Especialista ALFRA';

            await updateCitaStatus(citaAReagendar.id, 'Pendiente', {
                fechaHora: fechaHoraLocal,
                fechaYMD: reagendarFecha,
                fecha: reagendarFecha,
                hora: reagendarHora,
                cabina: reagendarCabina || '',
                especialistaId: finalEspId,
                especialistaNombre: finalEspNombre,
                especialista: finalEspNombre,
                log: `Reagendada para el ${reagendarFecha} a las ${reagendarHora} con ${finalEspNombre}`,
                updatedAt: new Date().toISOString()
            });

            if (citaAReagendar.pacienteId) {
                const fechaTxt = format(fechaBase, "d 'de' MMMM", { locale: es });
                const horaTxt = format(fechaBase, 'hh:mm a');
                crearAlertaPaciente(citaAReagendar.pacienteId,
                    `Tu cita de ${citaAReagendar.servicio || 'tratamiento'} ha sido reagendada para el ${fechaTxt} a las ${horaTxt}.`,
                    { tipo: 'cita_reagendada', citaId: citaAReagendar.id }
                );
            }

            const espIdParaAlerta = finalEspId || citaAReagendar.especialistaId;
            if (espIdParaAlerta) {
                await addDoc(collection(db, 'alertas_pacientes'), {
                    especialistaId: espIdParaAlerta,
                    mensaje: `Cita de ${citaAReagendar.paciente} fue reagendada para el ${reagendarFecha} a las ${reagendarHora}.`,
                    estado: 'pendiente',
                    createdAt: serverTimestamp(),
                    pacienteNombre: citaAReagendar.paciente,
                    citaId: citaAReagendar.id
                });
            }

            alert(`✅ Cita de ${citaAReagendar.paciente} reagendada con éxito para el ${reagendarFecha} a las ${reagendarHora}.`);
            setCitaAReagendar(null);
        } catch (err) {
            console.error('Error al reagendar cita:', err);
            alert('Error al reagendar cita: ' + err.message);
        } finally {
            setSavingReagendar(false);
        }
    };

    const conflictoCabina = useMemo(() => {
        return checkConflictoCabina(citas, {
            cabina: newCita.cabina,
            fechaYMD: newCita.fecha,
            hora: newCita.hora,
            duracionMin: newCita.duracionMin,
            ignoreCitaId: editingCitaId
        });
    }, [citas, newCita.cabina, newCita.fecha, newCita.hora, newCita.duracionMin, editingCitaId]);

    const conflictoEspecialista = useMemo(() => {
        if (!newCita.especialistaId && !newCita.especialistaNombre) return null;
        const espObj = especialistas.find(e => e.id === newCita.especialistaId);
        return checkConflictoEspecialista(citas, {
            especialistaIdent: {
                id: newCita.especialistaId,
                staffId: newCita.especialistaId,
                uid: espObj?.uid || null,
                email: espObj?.email || null,
                nombre: espObj?.nombre || newCita.especialistaNombre || ''
            },
            fechaYMD: newCita.fecha,
            hora: newCita.hora,
            duracionMin: newCita.duracionMin,
            ignoreCitaId: editingCitaId,
            catalogoServicios: servicios
        });
    }, [citas, especialistas, servicios, newCita.especialistaId, newCita.especialistaNombre, newCita.fecha, newCita.hora, newCita.duracionMin, editingCitaId]);

    const citasEncontradas = useMemo(() => {
        const q = busquedaGlobal.trim().toLowerCase();
        if (!q || q.length < 2) return [];
        return citas.filter(c =>
            (c.paciente || '').toLowerCase().includes(q) ||
            (c.telefono || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
            (c.servicio || '').toLowerCase().includes(q) ||
            (c.especialista || '').toLowerCase().includes(q)
        ).slice(0, 8);
    }, [citas, busquedaGlobal]);

    const getMinutosEspera = (llegadaAt) => {
        if (!llegadaAt) return null;
        const diff = Math.floor((Date.now() - new Date(llegadaAt).getTime()) / 60000);
        return Math.max(0, diff);
    };

    useEffect(() => {
        if (especialistas.length > 0 && !newCita.especialistaId) {
            setNewCita(prev => ({
                ...prev,
                especialistaId: especialistas[0].id,
                especialistaNombre: especialistas[0].nombre,
            }));
        }
    }, [especialistas]);

    const pacientesSugeridos = useMemo(() => {
        return pacientes.filter(p =>
            pacienteFiltro.length > 0 &&
            (p.nombre || '').toLowerCase().includes(pacienteFiltro.toLowerCase())
        ).slice(0, 6);
    }, [pacientes, pacienteFiltro]);

    const serviciosSugeridos = useMemo(() => {
        return servicios.filter(s =>
            servicioFiltro.length > 0 &&
            (s.nombre || '').toLowerCase().includes(servicioFiltro.toLowerCase())
        ).slice(0, 6);
    }, [servicios, servicioFiltro]);

    const citasDelDia = useMemo(() => {
        const currentYMD = format(currentDate, 'yyyy-MM-dd');
        return citas.map(c => {
            // Derivar campos si faltan (para citas nuevas que solo guardan fechaHora ISO)
            if (c.fechaHora && (!c.fechaYMD || !c.hora)) {
                const d = new Date(c.fechaHora);
                return {
                    ...c,
                    fechaYMD: format(d, 'yyyy-MM-dd'),
                    hora: format(d, 'HH:mm'),
                    horaFormateada: format(d, 'hh:mm a')
                };
            }
            return c;
        }).filter(c => {
            const matchesDate = c.fechaYMD === currentYMD;
            // En modo lista, si es 'todos' mostramos todos, si no, filtramos por el primero seleccionado o por el array
            const matchesEsp = selectedEspIds.includes('todos') || selectedEspIds.includes(c.especialistaId);
            return matchesDate && matchesEsp;
        });
    }, [citas, currentDate, selectedEspIds]);

        const [dudasPostConsulta, setDudasPostConsulta] = useState([]);

    useEffect(() => {
        const q = query(
            collection(db, "seguimiento_post_consulta"),
            where("atendido", "==", false)
        );
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setDudasPostConsulta(list);
        }, (err) => console.warn("Aviso dudas listener:", err));
        return () => unsub();
    }, []);

    const handleResolverDudaPostConsulta = async (id) => {
        try {
            await updateDoc(doc(db, "seguimiento_post_consulta", id), {
                atendido: true,
                atendidoPor: 'Recepción',
                atendidoEn: new Date().toISOString()
            });
        } catch(err) {
            console.error("Error al resolver duda:", err);
        }
    };

    const citasPendientesAutorizacionPase = useMemo(() => {
        return citas.filter(c => c.status === 'Pendiente Pase a Caja' || c.paseCaja?.estadoAutorizacion === 'pendiente_recepcion');
    }, [citas]);

    const handleAutorizarPaseCajaCitaUnica = async (cita) => {
        try {
            setSaving(true);
            await updateCitaStatus(cita.id, 'Completada', {
                paseCaja: {
                    ...(cita.paseCaja || {}),
                    estadoAutorizacion: 'autorizado',
                    autorizadoPor: 'Recepción',
                    autorizadoEn: new Date().toISOString(),
                }
            });
            alert(`✅ Pase a Caja autorizado. La cita de ${cita.paciente} se ha cerrado satisfactoriamente.`);
        } catch (err) {
            console.error(err);
            alert('Error al autorizar Pase a Caja: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleRechazarPaseCajaCitaUnica = async (cita) => {
        try {
            setSaving(true);
            await updateCitaStatus(cita.id, 'En Cabina', {
                paseCaja: {
                    ...(cita.paseCaja || {}),
                    estadoAutorizacion: 'rechazado',
                    rechazadoPor: 'Recepción',
                    rechazadoEn: new Date().toISOString(),
                }
            });
            alert(`Se notificó a la especialista que debe agendar la próxima cita de ${cita.paciente}.`);
        } catch (err) {
            console.error(err);
            alert('Error al rechazar Pase a Caja: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'En Sala de Espera': return 'bg-amber-100 text-amber-900 border-amber-300 ring-4 ring-amber-100 animate-pulse font-black shadow-sm';
            case 'En Cabina': return 'bg-teal-50 text-teal-800 border-teal-300 ring-4 ring-teal-100 font-bold';
            case 'Confirmada': return 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-emerald-100/50 ring-4 ring-emerald-50 font-bold';
            case 'Pendiente': return 'bg-white text-amber-600 border-amber-200 shadow-amber-100/50 ring-4 ring-amber-50';
            case 'Pendiente Pase a Caja': return 'bg-purple-50 text-purple-800 border-purple-300 ring-4 ring-purple-100 animate-pulse font-black';
            case 'Completada': return 'bg-white text-emerald-600 border-emerald-200 shadow-emerald-100/50 ring-4 ring-emerald-50 opacity-80';
            case 'Cancelada': return 'bg-gray-50 text-gray-400 border-gray-200 line-through grayscale opacity-60';
            case 'No Asistió':
            case 'No Asisti': return 'bg-red-50 text-red-500 border-red-200 opacity-70';
            case 'Reagendada': return 'bg-orange-50 text-orange-500 border-orange-200 opacity-70';
            default: return 'bg-white text-gray-500 border-gray-200';
        }
    };

    const handleNotificarLlegada = async (cita) => {
        if (!cita.especialistaId) { alert('Esta cita no tiene un especialista válido.'); return; }

        const esp = especialistas.find(s => s.id === cita.especialistaId);
        const realUid = esp?.uid || cita.especialistaId;

        if (confirm(`¿Notificar al Dr(a). ${cita.especialistaNombre || cita.especialista || 'Asignado'} que ${cita.paciente} ya está en sala de espera?`)) {
            try {
                const nowIso = new Date().toISOString();
                const alertData = {
                    mensaje: `Tu paciente ${cita.paciente} ya está en sala de espera para su cita de las ${cita.horaFormateada || cita.hora} (${cita.servicio}).`,
                    estado: 'pendiente',
                    createdAt: serverTimestamp(),
                    pacienteNombre: cita.paciente,
                    citaId: cita.id
                };

                await addDoc(collection(db, 'alertas_pacientes'), {
                    ...alertData,
                    especialistaId: cita.especialistaId
                });

                if (esp?.uid && esp.uid !== cita.especialistaId) {
                    await addDoc(collection(db, 'alertas_pacientes'), {
                        ...alertData,
                        especialistaId: esp.uid
                    });
                }

                await addDoc(collection(db, 'alertas_pacientes'), { ...alertData, especialistaId: 'admin', targetRole: 'admin' });

                await updateCitaStatus(cita.id, 'En Sala de Espera', {
                    llegadaAt: nowIso
                });

                alert(`🔔 ¡Notificación enviada a Dr(a). ${cita.especialistaNombre || cita.especialista}! ${cita.paciente} registrado en Sala de Espera.`);
            } catch (error) {
                console.error(error);
                alert('Error al enviar la notificación.');
            }
        }
    };

    const handleCompletarCita = async (citaId) => {
        const cita = citas.find(c => c.id === citaId);
        if (!cita) return;

        const esAdmin = userRole === 'Administrador';

        setSaving(true);
        let tieneMovimientos = false;
        try {
            tieneMovimientos = await verificarMovimientosExpediente(cita);
        } catch (e) {
            console.warn('Error verificando movimientos:', e);
        }

        // Si es recepción (no admin) y no se detectan movimientos en el expediente:
        if (!esAdmin && !tieneMovimientos) {
            setSaving(false);
            alert(`⚠️ ACCIÓN BLOQUEADA POR POLÍTICA CLÍNICA:

No es posible completar esta cita desde recepción porque el especialista aún no ha registrado notas, medidas ni sesiones en el Expediente Clínico de ${cita.paciente}.

Por favor, solicita al especialista que ingrese al expediente clínico y registre su atención antes de completar la cita.`);
            return;
        }

        // Si es Administrador y no tiene movimientos: advertencia con confirmación de privilegio
        if (esAdmin && !tieneMovimientos) {
            const continuarAdmin = confirm(`⚠️ Auditoría Administrador:
No se detectaron notas ni sesiones registradas por el especialista en el expediente clínico de ${cita.paciente}.

Como Administrador tienes privilegios para completar esta cita sin movimientos previos. ¿Deseas completarla de todos modos?`);
            if (!continuarAdmin) {
                setSaving(false);
                return;
            }
        } else {
            // Confirmación normal
            if (!confirm(`¿Marcar la cita de ${cita.paciente} como completada?`)) {
                setSaving(false);
                return;
            }
        }

        try {
            await updateCitaStatus(citaId, 'Completada', {
                completadaPor: userRole || 'Recepción',
                completadaAt: new Date().toISOString()
            });

            alert(`✓ Cita de ${cita.paciente} marcada como completada exitosamente.
El cobro y emisión de recibos se gestionan directamente desde el módulo de CAJA.`);
        } catch (err) {
            console.error(err);
            alert('Error al completar la cita: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCancelarCita = async (citaId) => {
        const cita = citas.find(c => c.id === citaId);
        if (!cita) return;
        if (confirm(`¿Cancelar la cita de ${cita.paciente}?`)) {
            try {
                setSaving(true);
                await updateCitaStatus(citaId, 'Cancelada');
            } catch (err) {
                console.error(err);
                alert('Error al cancelar cita.');
            } finally {
                setSaving(false);
            }
        }
    };

    const handleNoAsistio = async (citaId) => {
        const cita = citas.find(c => c.id === citaId);
        if (!cita) return;
        if (confirm(`¿Marcar que ${cita.paciente} no asistió a su cita?`)) {
            try {
                setSaving(true);
                await updateCitaStatus(citaId, 'No Asistió');
            } catch (err) {
                console.error(err);
                alert('Error al actualizar cita.');
            } finally {
                setSaving(false);
            }
        }
    };

    const enviarWhatsApp = async (e, cita) => {
        e?.stopPropagation();
        enviarWhatsAppCita(cita);
        try {
            const nowIso = new Date().toISOString();
            await updateCitaStatus(cita.id, cita.status === 'Pendiente' ? 'Confirmada' : cita.status, {
                whatsappEnviadoAt: nowIso
            });
        } catch (err) {
            console.error('Error registrando whatsapp:', err);
        }
    };

    const handleCrearPacienteYContinuar = async () => {
        if (!formNuevoPaciente.nombre || !formNuevoPaciente.telefono) {
            alert('Por favor completa los campos obligatorios (*)');
            return;
        }
        setSaving(true);
        try {
            const docRef = await addDoc(collection(db, 'pacientes'), {
                nombre: formNuevoPaciente.nombre,
                telefono: formNuevoPaciente.telefono,
                email: formNuevoPaciente.email || '',
                fechaNacimiento: formNuevoPaciente.fechaNacimiento || '',
                createdAt: serverTimestamp(),
                status: 'Activo'
            });
            
            setNewCita(prev => ({ 
                ...prev, 
                pacienteId: docRef.id,
                paciente: formNuevoPaciente.nombre,
                telefono: formNuevoPaciente.telefono
            }));
            
            setIsNuevoPacienteModaling(false);
            alert('¡Paciente creado exitosamente! Ahora puedes confirmar la cita.');
        } catch (error) {
            console.error(error);
            alert('Error al crear el paciente.');
        } finally {
            setSaving(false);
        }
    };

    const handleAgendarSubmit = (e) => {
        e.preventDefault();
        if (!newCita.paciente) { alert('Ingresa el nombre del paciente.'); return; }
        if (!newCita.pacienteId) {
            setFormNuevoPaciente({ nombre: newCita.paciente, telefono: newCita.telefono || '', email: '', fechaNacimiento: '' });
            setIsNuevoPacienteModaling(true);
            return;
        }
        if (!newCita.especialistaId) { alert('Selecciona un especialista.'); return; }
        if (!newCita.servicio) { alert('Indica el servicio.'); return; }
        const montoNum = Number(newCita.monto);
        if ((newCita.monto === '' || newCita.monto === undefined || montoNum === 0) && !newCita.citaPagada) {
            setIsPedirPrecioOpen(true);
            return;
        }
        
        setIsConfirmDuracionOpen(true);
    };

    const handleConfirmarCitaFinal = async () => {
        setIsConfirmDuracionOpen(false);
        setSaving(true);
        try {
            // Crear fecha en tiempo LOCAL para evitar desviaciones UTC
            const [year, month, day] = newCita.fecha.split('-');
            const [hh, mm] = newCita.hora.split(':');
            const fechaBase = new Date(year, month - 1, day, parseInt(hh), parseInt(mm));

            // Guardamos como string ISO LOCAL (sin la Z al final) para que sea agnóstico a la zona horaria del visor
            const fechaHoraLocal = format(fechaBase, "yyyy-MM-dd'T'HH:mm:ss");

            // --- VINCULACIÓN ROBUSTA DE PACIENTE ---
            let finalPacienteId = newCita.pacienteId;
            if (!finalPacienteId && newCita.paciente) {
                const searchName = newCita.paciente.toLowerCase().trim();
                const matched = pacientes.find(p => (p.nombre || '').toLowerCase().trim() === searchName);
                if (matched) {
                    finalPacienteId = matched.id;
                } else {
                    // No encontrado: abrir modal de nuevo paciente
                    setFormNuevoPaciente({ nombre: newCita.paciente, telefono: '', email: '', fechaNacimiento: '' });
                    setIsNuevoPacienteModaling(true);
                    setSaving(false);
                    return; // Detener ejecución
                }
            }

            if (editingCitaId) {
                // REAGENDAR: Actualizar la cita existente en vez de crear duplicado
                                // REAGENDAR: Actualizar la cita existente en vez de crear duplicado
                await updateCitaStatus(editingCitaId, 'Reagendada', {
                    pacienteId: finalPacienteId || null,
                    pacienteNombre: newCita.paciente,
                    telefono: newCita.telefono || '',
                    especialistaId: newCita.especialistaId,
                    especialistaNombre: newCita.especialistaNombre,
                    servicio: newCita.servicio,
                    fechaHora: fechaHoraLocal,
                    duracionMin: Number(newCita.duracionMin),
                    notas: newCita.notas || '',
                    cabina: newCita.cabina || '',
                    anticipo: Number(newCita.anticipo || 0),
                    status: 'Pendiente',
                });

            } else {
                // NUEVA CITA
                                const docId = await createCita({
                    pacienteId: finalPacienteId || null,
                    pacienteNombre: newCita.paciente,
                    telefono: newCita.telefono || '',
                    especialistaId: newCita.especialistaId,
                    especialistaNombre: newCita.especialistaNombre,
                    servicio: newCita.servicio,
                    fechaHora: fechaHoraLocal,
                    duracionMin: Number(newCita.duracionMin),
                    notas: newCita.notas || '',
                    cabina: newCita.cabina || '',
                    anticipo: Number(newCita.anticipo || 0),
                    precio: Number(newCita.monto || 0),
                    citaPagada: newCita.citaPagada || false,
                });

                // Persistencia local como caché secundario (compatibilidad)
                if (docId) {
                    const labPrices = JSON.parse(localStorage.getItem('alfra_lab_prices') || '{}');
                    labPrices[docId] = {
                        precio: Number(newCita.monto || 0),
                        citaPagada: newCita.citaPagada
                    };
                    localStorage.setItem('alfra_lab_prices', JSON.stringify(labPrices));

                // Notificar al paciente que tiene nueva cita
                if (finalPacienteId) {
                    const fechaCita = format(fechaBase, "d 'de' MMMM", { locale: es });
                    const horaCita = format(fechaBase, 'hh:mm a');
                    crearAlertaPaciente(finalPacienteId, 
                        'Se ha agendado tu cita de ' + (newCita.servicio || 'tratamiento') + ' para el ' + fechaCita + ' a las ' + horaCita + '. Te esperamos en Clinica ALFRA.',
                        { tipo: 'nueva_cita', citaId: docId }
                    );
                }
                }
            }
            setIsModaling(false);
            setEditingCitaId(null);
            setNewCita(prev => ({ ...prev, pacienteId: '', paciente: '', telefono: '', servicio: '', notas: '', monto: '', citaPagada: false, cabina: '', anticipo: '' }));
            setPacienteFiltro('');
            setSelectedServicios([]);
            setServicioFiltro('');
        } catch (err) {
            console.error(err);
            alert('Error al agendar.');
        } finally {
            setSaving(false);
        }
    };

    // v18.5: Grid logic removed to force v21 list view

    // ── Lógica de Disponibilidad (Huecos de 1.5h) ──────────────────────────
    const getHorasDisponibles = (fecha, espIds, duracionSolicitada = 90) => {
        const startH = 9, endH = 19;
        const duracionBloque = Number(duracionSolicitada || 90);
        const slots = [];

        const dayStr = format(fecha, 'yyyy-MM-dd');

        const idsAEvaluar = espIds.includes('todos')
            ? especialistas.map(e => e.id)
            : espIds;

        const rangosPorEsp = {};
        const candidatosExtra = new Set();
        idsAEvaluar.forEach(eid => {
            const esp = especialistas.find(e => e.id === eid);
            const ident = {
                id: eid,
                staffId: eid,
                uid: esp?.uid || null,
                email: esp?.email || null,
                nombre: esp?.nombre || ''
            };
            const rangos = [];
            citas.forEach(c => {
                if (!citaMatchesEspecialista(c, ident)) return;
                const r = extraerRangoCitaLocal(c, servicios);
                if (r && r.fechaYMD === dayStr) {
                    rangos.push(r);
                    if (r.endMin >= startH * 60 && r.endMin + duracionBloque <= endH * 60) {
                        candidatosExtra.add(r.endMin);
                    }
                }
            });
            rangosPorEsp[eid] = rangos;
        });

        const candidatosMin = new Set();
        for (let m = startH * 60; m + duracionBloque <= endH * 60; m += 30) {
            candidatosMin.add(m);
        }
        candidatosExtra.forEach(m => candidatosMin.add(m));

        const sortedCandidatos = Array.from(candidatosMin).sort((a, b) => a - b);

        for (const slotStartMin of sortedCandidatos) {
            const slotEndMin = slotStartMin + duracionBloque;
            if (slotEndMin > endH * 60) continue;

            const hayAlMenosUnoLibre = idsAEvaluar.some(eid => {
                const rangosEsp = rangosPorEsp[eid] || [];
                const estaOcupado = rangosEsp.some(r => slotStartMin < r.endMin && slotEndMin > r.startMin);
                return !estaOcupado;
            });

            if (hayAlMenosUnoLibre) {
                const h = Math.floor(slotStartMin / 60);
                const m = slotStartMin % 60;
                const sStart = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), h, m, 0, 0).getTime();
                slots.push(format(new Date(sStart), 'hh:mm a'));
            }
        }
        return slots;
    };

    const copyToClipboard = async (text) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback para navegadores antiguos o contextos no seguros
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textArea);
                return success;
            }
        } catch (err) {
            console.error('Error al copiar:', err);
            return false;
        }
    };

    const handleCopyDisponibilidadProfesional = async (fecha, slots, especialistasNombres) => {
        const fStr = format(fecha, "EEEE d 'de' MMMM", { locale: es }).toUpperCase();
        const fSimple = format(fecha, "EEEE d 'de' MMMM", { locale: es });

        const mensaje = `🌸 *HOLA, TENEMOS AGENDA DISPONIBLE PARA EL DÍA ${fStr}* 🌸\n\n` +
            `¡Hola! Qué gusto saludarte. 😊 Te compartimos los espacios que tenemos disponibles para tu próxima cita el día *${fSimple}*:\n\n` +
            `🗓 *Horarios Disponibles:*\n` +
            `${slots.map(s => `• ${s}`).join('\n')}\n\n` +
            `¿Le gustaría agendar su cita en alguno de estos horarios? ✨\n\n` +
            `*Clínica ALFRA* 🌿`;

        const success = await copyToClipboard(mensaje);
        if (success) {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 3000);
        } else {
            alert('No se pudo copiar el mensaje automáticamente. Por favor intenta de nuevo.');
        }
    };

    const handleCopyUbicacion = async () => {
        const text = `📍 *UBICACIÓN:*\n` +
            `Calle Rio Fuerte #26, (esq.con calle Jaime Torres Bodet) Colonia: Lomas de Bellavista, Lázaro Cárdenas, Mich\n\n` +
            `🗺️ *REFERENCIA:*\n` +
            `En la Av Melchor Ocampo, a la altura de los edificios de las palmas, después de terminar los puestos de comida, está la farmacia del Ahorro, por esa calle (#Jaime Torres Bodet) va a subir en dirección a los edificios, 2 calles justo en la esquina, es color blanco, tiene herrería dorada y puerta café.\n\n` +
            `🔗 *GOOGLE MAPS:*\n` +
            `https://maps.app.goo.gl/hLycVd8Dm5MFAehm9`;

        const success = await copyToClipboard(text);
        if (success) {
            setIsUbicacionCopied(true);
            setTimeout(() => setIsUbicacionCopied(false), 3000);
        }
    };

    const DisponibilidadView = () => {
        const diasAMostrar = availView === 'dia' ? [currentDate] : Array.from({ length: 7 }).map((_, i) => addDays(currentDate, i));
        
        // Especialistas seleccionados (excluyendo 'todos')
        const idsSeleccionados = selectedEspIds.includes('todos') 
            ? especialistas.map(e => e.id) 
            : selectedEspIds;

        return (
            <div className="space-y-12 animate-in fade-in zoom-in-95 duration-500">
                {/* Selector de Duración */}
                <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Duración del Tratamiento:</span>
                    <div className="flex flex-wrap gap-2">
                        {[30, 45, 60, 90, 120, 150, 180].map(dur => (
                            <button 
                                key={dur} 
                                onClick={() => setDuracionFiltro(dur)} 
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${duracionFiltro === dur ? 'bg-turquesa text-white shadow-md' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                            >
                                {dur} min
                            </button>
                        ))}
                    </div>
                </div>

                {diasAMostrar.map((dia, dIdx) => {
                    const slotsGlobales = getHorasDisponibles(dia, idsSeleccionados, duracionFiltro);
                    const espsDisponibles = especialistas.filter(e => idsSeleccionados.includes(e.id));
                    
                    // Solo mostramos si hay slots
                    if (slotsGlobales.length === 0) return (
                        <div key={dIdx} className="p-10 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 text-gray-400">
                             No hay disponibilidad para los especialistas seleccionados el {format(dia, "EEEE d", { locale: es })}.
                        </div>
                    );

                    return (
                        <div key={dIdx} className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-gray-100 space-y-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                                <CalendarIcon size={200} className="text-turquesa" />
                            </div>

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-50 pb-8">
                                <div className="space-y-3">
                                    <h3 className="text-3xl font-black text-acero capitalize">
                                        {format(dia, "EEEE d 'de' MMMM", { locale: es })}
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {especialistas.map(e => {
                                            const isSelected = selectedEspIds.includes(e.id) || selectedEspIds.includes('todos');
                                            return (
                                                <button 
                                                    key={e.id}
                                                    onClick={() => {
                                                        setSelectedEspIds(prev => {
                                                            const currentlySelected = prev.includes('todos') ? especialistas.map(x => x.id) : prev;
                                                            if (currentlySelected.includes(e.id)) {
                                                                const filtered = currentlySelected.filter(id => id !== e.id);
                                                                return filtered.length === 0 ? ['todos'] : filtered;
                                                            }
                                                            return [...currentlySelected, e.id];
                                                        });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${
                                                        isSelected 
                                                            ? 'bg-turquesa text-white border-turquesa shadow-md shadow-turquesa/20' 
                                                            : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    {e.nombre.split(' ')[0]}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <button 
                                        onClick={handleCopyUbicacion}
                                        disabled={isUbicacionCopied}
                                        className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 border-2 ${
                                            isUbicacionCopied 
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-none' 
                                                : 'bg-gray-50 text-acero hover:bg-white border-gray-100 hover:border-turquesa/30 shadow-sm'
                                        }`}
                                    >
                                        {isUbicacionCopied ? (
                                            <>
                                                <CheckCircle size={16} /> ¡Ubicación Copiada!
                                            </>
                                        ) : (
                                            <>
                                                <MapPin size={16} className="text-turquesa" /> Copiar Ubicación
                                            </>
                                        )}
                                    </button>

                                    <button 
                                        onClick={() => handleCopyDisponibilidadProfesional(dia, slotsGlobales, espsDisponibles.map(e => e.nombre.split(' ')[0]))}
                                        disabled={isCopied}
                                        className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95 min-w-[280px] ${
                                            isCopied 
                                                ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                                                : 'bg-acero text-white hover:bg-turquesa hover:shadow-2xl hover:shadow-turquesa/30'
                                        }`}
                                    >
                                        {isCopied ? (
                                            <>
                                                <CheckCircle size={20} className="animate-in zoom-in duration-300" /> ¡Mensaje Copiado!
                                            </>
                                        ) : (
                                            <>
                                                <MessageCircle size={20} /> Copiar Mensaje
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {slotsGlobales.map((s, i) => (
                                    <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center justify-center gap-1 hover:border-turquesa/30 hover:bg-white transition-all cursor-default group/slot">
                                        <Clock size={14} className="text-gray-300 group-hover/slot:text-turquesa transition-colors" />
                                        <span className="font-black text-acero text-sm">{s}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="max-w-[1700px] mx-auto space-y-8 animate-in fade-in duration-500 pb-24 px-4 md:px-8">
            <ReciboDigital isOpen={isReciboOpen} onClose={() => setIsReciboOpen(false)} datosRecibo={reciboActual} />

            {/* Header - Agenda Maestra de Recepción */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-turquesa/10 rounded-xl text-turquesa">
                        <CalendarIcon size={24} />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-black text-acero leading-none uppercase tracking-tight">Agenda Maestra</h1>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm">
                    <button 
                        onClick={() => setViewMode('tablero')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                            viewMode === 'tablero' ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-950/5' : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <LayoutGrid size={14} className={viewMode === 'tablero' ? "text-turquesa" : "text-slate-400"} /> 
                        <span>Tablero Ejecutivo</span>
                    </button>
                    <button 
                        onClick={() => setViewMode('lista')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                            viewMode === 'lista' ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-950/5' : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <List size={14} className={viewMode === 'lista' ? "text-turquesa" : "text-slate-400"} /> 
                        <span>Lista Detallada</span>
                    </button>
                    <button 
                        onClick={() => setViewMode('disponibilidad')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                            viewMode === 'disponibilidad' ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-950/5' : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Clock size={14} className={viewMode === 'disponibilidad' ? "text-turquesa" : "text-slate-400"} /> 
                        <span>Disponibilidad WhatsApp</span>
                    </button>
                </div>

                <button 
                    type="button"
                    onClick={() => setShowCumpleanosModal(true)}
                    className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-900 shadow-md font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 whitespace-nowrap !flex-nowrap shrink-0 transition-all cursor-pointer relative"
                    title="Ver próximos cumpleaños y diseñar tarjeta de regalo personalizada"
                >
                    <Gift size={14} className="shrink-0 text-slate-900" />
                    <span>🎂 Cumpleaños</span>
                    {cumpleanosProximos.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.2 bg-slate-950 text-white text-[9px] font-black rounded-full shadow-sm">
                            {cumpleanosProximos.length}
                        </span>
                    )}
                </button>

                <Button 
                    variant="primary" 
                    className="h-9 px-4 rounded-xl bg-turquesa shadow-md shadow-turquesa/10 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 whitespace-nowrap !flex-nowrap shrink-0 max-w-fit" 
                    onClick={() => { setEditingCitaId(null); setIsModaling(true); setPacienteFiltro(''); }}
                >
                    <Plus size={14} className="shrink-0" /> <span className="whitespace-nowrap">Agendar Cita</span>
                </Button>
            </div>

            {/* Alertas Inteligentes Post-Consulta Concierge */}
            {dudasPostConsulta.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-pink-50 border-2 border-teal-300 rounded-2xl p-4 space-y-3 shadow-md animate-in fade-in">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-teal-600 text-white rounded-xl">
                            <Heart size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                                🛎️ {dudasPostConsulta.length} Seguimiento(s) de Pacientes Post-Consulta
                            </h4>
                            <p className="text-xs text-slate-600">
                                Check-ins completados por pacientes desde su App tras su sesión:
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {dudasPostConsulta.map((duda) => {
                            const esExcelente = duda.estado === 'excelente';
                            const esBien = duda.estado === 'bien' || (duda.nota || '').toLowerCase().includes('normal');
                            const esDuda = duda.estado === 'duda';
                            const nombre = (duda.pacienteNombre || 'Paciente').split(' ')[0];
                            const esp = duda.especialistaNombre || 'Clínica ALFRA';

                            let msgWhatsApp = '';
                            if (esExcelente) {
                                msgWhatsApp = `¡Hola ${nombre}! 🌟 En Clínica ALFRA nos alegra muchísimo saber que te sentiste de maravilla tras tu última sesión con ${esp}. Queremos felicitarte y recordarte que la constancia, la hidratación y la disciplina son el secreto de tus resultados. ¡Estamos contigo en cada paso de tu cambio! 💖✨`;
                            } else if (esBien) {
                                msgWhatsApp = `¡Hola ${nombre}! 🌿 En Clínica ALFRA nos da mucho gusto saber que tu evolución marcha muy bien tras tu sesión con ${esp}. Recuerda continuar con tus cuidados en casa y tomar suficiente agua. ¡Cualquier duda o inquietud estamos a tus órdenes! ✨`;
                            } else {
                                msgWhatsApp = `Hola ${nombre}, te escribimos de Recepción Clínica ALFRA respecto a la duda que nos compartiste sobre tu sesión con ${esp}. ¿Cómo te podemos apoyar?`;
                            }

                            return (
                                <div key={duda.id} className="bg-white p-3 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-black text-gray-900">
                                                {duda.pacienteNombre} <span className="text-[10px] text-gray-500 font-bold">({duda.servicio || 'Tratamiento'} con {duda.especialistaNombre})</span>
                                            </p>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                                esExcelente
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                    : esBien
                                                    ? 'bg-teal-100 text-teal-800 border-teal-300'
                                                    : 'bg-rose-100 text-rose-800 border-rose-300'
                                            }`}>
                                                {esExcelente ? '🤩 Excelente' : esBien ? '🙂 Normal / Bien' : '🤔 Duda'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100 italic">
                                            "{duda.nota || (esExcelente ? 'Se sintió excelente' : esBien ? 'Evolución normal' : 'Tiene una duda sobre sus cuidados')}"
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {duda.pacienteTelefono && (
                                            <a
                                                href={`https://wa.me/${duda.pacienteTelefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msgWhatsApp)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer shadow-sm text-white ${
                                                    esExcelente || esBien ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                                                }`}
                                            >
                                                <MessageSquare size={13} />
                                                {esExcelente ? 'Felicitar por WhatsApp' : esBien ? 'WhatsApp Motivador' : 'Atender Duda'}
                                            </a>
                                        )}
                                        <button
                                            onClick={() => handleResolverDudaPostConsulta(duda.id)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
                                        >
                                            ✓ Marcar Atendido
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Solicitudes de Autorización de Pase a Caja en Cita Única */}
            {citasPendientesAutorizacionPase.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 space-y-3 shadow-md">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-amber-500 text-white rounded-xl animate-pulse">
                            <Bell size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                                🔒 {citasPendientesAutorizacionPase.length} Solicitud(es) de Autorización de Pase a Caja (Cita Única)
                            </h4>
                            <p className="text-xs text-amber-800">
                                La especialista solicita autorización de Recepción para cerrar la cita sin próxima cita agendada:
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {citasPendientesAutorizacionPase.map(c => (
                            <div key={c.id} className="bg-white border border-amber-300 rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-xs">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-black text-acero">👤 {c.paciente}</span>
                                        <span className="text-[11px] font-bold bg-turquesa/10 text-acero px-2 py-0.5 rounded-lg">
                                            👩‍⚕️ {c.paseCaja?.atendidoPor || c.especialistaNombre || c.especialista}
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-gray-700">
                                        Servicio: <span className="text-turquesa">{c.servicio}</span> ({c.horaFormateada})
                                    </p>
                                    {c.paseCaja?.motivoCitaUnica && (
                                        <p className="text-xs text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                            <strong>Motivo Cita Única:</strong> {c.paseCaja.motivoCitaUnica}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => handleAutorizarPaseCajaCitaUnica(c)}
                                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer"
                                    >
                                        ✅ Autorizar Pase a Caja y Cerrar Cita
                                    </button>
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => handleRechazarPaseCajaCitaUnica(c)}
                                        className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                    >
                                        ❌ Rechazar (Pedir agendar cita)
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ESPECIALISTAS v21 - Solo visibles en Lista o fuera del Grid? En el screenshot van dentro del grid o arriba?
                En el screenshot 18:02 se ve que los especialistas van dentro del grid. 
                Pero arriba hay unos filtros? No se ven en el screenshot 18:02. El screenshot 17:55 si los tenia. 
                Seguiré el screenshot 18:02 para el Grid y el 17:55 para los filtros si el usuario esta en modo lista. 
            */}

            {/* BUSCADOR RÁPIDO DE CITAS FUTURAS */}
            <div className="w-full max-w-3xl mx-auto mb-6 relative">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="🔍 Buscar cita por paciente, teléfono o servicio (cualquier fecha)..."
                        value={busquedaGlobal}
                        onChange={(e) => setBusquedaGlobal(e.target.value)}
                        className="w-full h-14 pl-12 pr-10 bg-white border-2 border-gray-100 rounded-2xl shadow-sm outline-none focus:border-turquesa font-bold text-sm text-acero transition-all"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-turquesa/50">
                        <Search size={20} />
                    </div>
                    {busquedaGlobal && (
                        <button
                            onClick={() => setBusquedaGlobal('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-black text-xs"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Resultados de búsqueda flotantes */}
                {busquedaGlobal.trim().length >= 2 && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white rounded-3xl shadow-2xl border border-gray-100 p-4 space-y-2 max-h-96 overflow-y-auto">
                        <div className="text-[11px] font-black uppercase tracking-wider text-gray-400 px-3 py-1 flex items-center justify-between border-b border-gray-50 pb-2">
                            <span>Resultados ({citasEncontradas.length})</span>
                            <span className="text-turquesa font-bold">Haz clic en una cita para ir a su fecha</span>
                        </div>
                        {citasEncontradas.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-400 font-bold">
                                No se encontraron citas para "{busquedaGlobal}"
                            </div>
                        ) : (
                            citasEncontradas.map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => {
                                        const tDate = c.fechaYMD ? new Date(c.fechaYMD + 'T12:00:00') : (c.fechaHora ? new Date(c.fechaHora) : new Date());
                                        setCurrentDate(tDate);
                                        setBusquedaGlobal('');
                                    }}
                                    className="p-3.5 rounded-2xl border border-gray-100 hover:border-turquesa/50 hover:bg-turquesa/5 transition-all cursor-pointer flex items-center justify-between gap-4"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-black text-base text-acero">{c.paciente}</span>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
                                            <span className="font-bold text-turquesa flex items-center gap-1">
                                                <CalendarIcon size={12} /> {c.fechaYMD ? format(new Date(c.fechaYMD + 'T12:00:00'), "d 'de' MMMM", { locale: es }) : c.fecha}
                                            </span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1 font-semibold text-acero">
                                                <Clock size={12} /> {c.horaFormateada || c.hora}
                                            </span>
                                            <span>•</span>
                                            <span className="text-gray-400 font-medium">{c.especialista} ({c.servicio})</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {c.cabina && (
                                            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full border border-purple-200">
                                                🏢 {c.cabina}
                                            </span>
                                        )}
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${getStatusStyles(c.status)}`}>
                                            {c.status}
                                        </span>
                                        <span className="text-xs font-bold text-turquesa hover:underline">
                                            Ver día →
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* FILTROS Y NAVEGACIÓN (Solo visible en modo lista) */}
            {viewMode !== 'tablero' && (
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between w-full max-w-md">
                    <button onClick={() => setCurrentDate(subDays(currentDate, 1))} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl text-acero hover:bg-turquesa hover:text-white transition-all">
                        <ChevronLeft size={20} />
                    </button>

                    <h2 className="text-sm font-black text-acero uppercase tracking-widest">
                        {format(currentDate, "EEEE, d 'De' MMMM", { locale: es })}
                    </h2>

                    <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl text-acero hover:bg-turquesa hover:text-white transition-all">
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto max-w-full">
                    <button 
                        onClick={() => setSelectedEspIds(['todos'])}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedEspIds.includes('todos') ? 'bg-turquesa text-white shadow-md' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                    >
                        Todos
                    </button>
                    {especialistas.map(esp => {
                        const isSelected = selectedEspIds.includes(esp.id);
                        return (
                            <button 
                                key={esp.id}
                                onClick={() => {
                                    setSelectedEspIds(prev => {
                                        if (prev.includes('todos')) return [esp.id];
                                        if (prev.includes(esp.id)) {
                                            const filtered = prev.filter(id => id !== esp.id);
                                            return filtered.length === 0 ? ['todos'] : filtered;
                                        }
                                        return [...prev, esp.id];
                                    });
                                }}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${isSelected ? 'bg-acero text-white shadow-md' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                            >
                                {esp.nombre.split(' ')[0]}
                            </button>
                        );
                    })}
                </div>
            </div>

                        )}

            <div className="min-h-[600px]">
                {loadingCitas ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-gray-400 animate-pulse">
                        <Loader className="animate-spin mb-4" size={40} />
                        <p className="font-black text-sm uppercase tracking-widest">Sincronizando Agenda...</p>
                    </div>
                ) : viewMode === 'tablero' ? (
                    <AgendaGlobalEjecutiva
                        citas={citas}
                        especialistas={especialistas}
                        pacientes={pacientes}
                        servicios={servicios}
                        currentDate={currentDate}
                        setCurrentDate={setCurrentDate}
                        onAgendarCita={(prefill = {}) => {
                            setEditingCitaId(null);
                            setFormNuevoPaciente(prev => ({
                                ...prev,
                                ...(prefill.fecha ? { fecha: prefill.fecha } : {}),
                                ...(prefill.especialistaId ? { especialistaId: prefill.especialistaId, especialistaNombre: prefill.especialistaNombre } : {}),
                                ...(prefill.cabina ? { cabina: prefill.cabina } : {})
                            }));
                            setIsModaling(true);
                        }}
                        onReagendarCita={handleAbrirReagendarRapido}
                        onEnviarWhatsApp={(cita) => {
                            const pac = pacientes.find(p => p.nombre?.toLowerCase() === cita.paciente?.toLowerCase());
                            enviarWhatsAppCita(cita, pac?.telefono || cita.telefono);
                        }}
                        onCambiarStatus={async (citaId, status, extra) => {
                            await updateCitaStatus(citaId, status, extra);
                        }}
                        onCobrarCita={(cita) => {
                            setReciboActual(cita);
                            setIsReciboOpen(true);
                        }}
                        onVerExpediente={(cita) => {
                            const pac = pacientes.find(p => p.nombre?.toLowerCase() === cita.paciente?.toLowerCase());
                            if (pac?.id) {
                                navigate(`/especialista/expediente/${pac.id}`);
                            } else if (cita.pacienteId) {
                                navigate(`/especialista/expediente/${cita.pacienteId}`);
                            }
                        }}
                        userRole={userRole || 'Recepcionista'}
                        currentStaffId={currentUser?.uid}
                        onNotificarLlegada={handleNotificarLlegada}
                        onCompletarCita={handleCompletarCita}
                        onNoAsistio={handleNoAsistio}
                        onCancelarCita={handleCancelarCita}
                        onSellarVisita={handleSellarDesdeCita}
                        sellandoCitaId={sellandoCitaId}
                        selloMsg={selloMsg}
                    />
                ) : viewMode === 'disponibilidad' ? (
                    <DisponibilidadView />
                ) : (
                    <div className="bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 bg-gray-50/30">
                                    <tr>
                                        <th className="px-4 md:px-10 py-4 md:py-8 font-black">Paciente / Hora</th>
                                        <th className="px-4 md:px-8 py-4 md:py-8 font-black">Especialista / Servicio</th>
                                        <th className="px-4 md:px-8 py-4 md:py-8 font-black">Estado / Log</th>
                                        <th className="px-4 md:px-10 py-4 md:py-8 font-black text-right">Auditoría</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-acero">
                                    {citasDelDia.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="px-4 md:px-10 py-20 text-center text-gray-400">
                                                <CalendarIcon size={48} className="mx-auto mb-4 opacity-20" />
                                                <p className="font-black uppercase tracking-widest text-xs">No hay citas registradas para este día</p>
                                            </td>
                                        </tr>
                                    ) : citasDelDia.map(cita => (
                                        <tr key={cita.id} className="hover:bg-turquesa/5 transition-all duration-300 group">
                                            <td className="px-4 md:px-10 py-4 md:py-8">
                                                <div className="flex flex-col gap-2">
                                                    <span className="text-xl md:text-2xl font-black uppercase text-acero leading-none">{cita.paciente}</span>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-400">
                                                        <span className="flex items-center gap-1.5 text-acero">
                                                            <Clock size={14} className="text-turquesa" /> {cita.horaFormateada || cita.hora}
                                                        </span>
                                                        {cita.telefono && (
                                                            <span className="text-gray-400 font-medium">({cita.telefono})</span>
                                                        )}
                                                        {cita.status === 'En Sala de Espera' && cita.llegadaAt && (
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black animate-pulse flex items-center gap-1 ${
                                                                getMinutosEspera(cita.llegadaAt) >= 15 ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                                                            }`}>
                                                                🔔 En espera: {getMinutosEspera(cita.llegadaAt)} min
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 md:px-8 py-4 md:py-8">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-lg font-black flex items-center gap-2 text-acero/80">
                                                        {cita.especialista}
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{cita.servicio}</span>
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                        {cita.cabina && (
                                                            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                                                                🏢 {cita.cabina}
                                                            </span>
                                                        )}
                                                        {Number(cita.anticipo) > 0 && (
                                                            <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                                                                💵 Anticipo: ${cita.anticipo}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 md:px-8 py-4 md:py-8">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className={`w-fit px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusStyles(cita.status)}`}>
                                                        {cita.status}
                                                    </span>
                                                    {cita.whatsappEnviadoAt && (
                                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                                            ✓ WhatsApp enviado
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-gray-300 italic flex items-center gap-1.5">
                                                        <History size={12} /> {cita.log}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 md:px-10 py-4 md:py-8">
                                                <div className="flex items-center justify-end gap-2 flex-wrap transition-all opacity-90 group-hover:opacity-100">
                                                    {/* Notificar Llegada */}
                                                    <button
                                                        onClick={() => handleNotificarLlegada(cita)}
                                                        className="w-12 h-12 bg-white shadow-xl rounded-2xl text-blue-500 hover:bg-blue-500 hover:text-white transition-all transform active:scale-90 border border-gray-100 flex items-center justify-center"
                                                        title="Notificar Llegada"
                                                    >
                                                        <Bell size={20} />
                                                    </button>

                                                    {/* WhatsApp */}
                                                    <button
                                                        onClick={(e) => enviarWhatsApp(e, cita)}
                                                        className="w-12 h-12 bg-white shadow-xl rounded-2xl text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all transform active:scale-90 border border-gray-100 flex items-center justify-center"
                                                        title="Enviar WhatsApp de Confirmación"
                                                    >
                                                        <MessageCircle size={20} />
                                                    </button>

                                                    {/* Ver Expediente */}
                                                    {cita.pacienteId && (
                                                        <button
                                                            onClick={() => navigate(`/especialista/expediente/${cita.pacienteId}`)}
                                                            className="w-12 h-12 bg-white shadow-xl rounded-2xl text-purple-600 hover:bg-purple-600 hover:text-white transition-all transform active:scale-90 border border-purple-100 flex items-center justify-center"
                                                            title="Ver Expediente Clínico"
                                                        >
                                                            <FileText size={20} />
                                                        </button>
                                                    )}

                                                    {/* Completar / Recibo */}
                                                    {cita.status !== 'Completada' && cita.status !== 'Cancelada' && cita.status !== 'No Asistió' && (
                                                        <button
                                                            onClick={() => handleCompletarCita(cita.id)}
                                                            className="w-12 h-12 bg-white shadow-xl rounded-2xl text-green-600 hover:bg-green-600 hover:text-white transition-all transform active:scale-90 border border-gray-100 flex items-center justify-center"
                                                            title="Completar y Recibo"
                                                        >
                                                            <CheckCircle size={20} />
                                                        </button>
                                                    )}

                                                    {/* No Asistió */}
                                                    {cita.status !== 'Completada' && cita.status !== 'Cancelada' && cita.status !== 'No Asistió' && (
                                                        <button
                                                            onClick={() => handleNoAsistio(cita.id)}
                                                            className="w-12 h-12 bg-white shadow-xl rounded-2xl text-orange-500 hover:bg-orange-500 hover:text-white transition-all transform active:scale-90 border border-gray-100 flex items-center justify-center"
                                                            title="No Asistió"
                                                        >
                                                            <User size={20} />
                                                        </button>
                                                    )}

                                                    {/* Cancelar Cita */}
                                                    {cita.status !== 'Completada' && cita.status !== 'Cancelada' && cita.status !== 'No Asistió' && (
                                                        <button
                                                            onClick={() => handleCancelarCita(cita.id)}
                                                            className="w-12 h-12 bg-white shadow-xl rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all transform active:scale-90 border border-gray-100 flex items-center justify-center"
                                                            title="Cancelar Cita"
                                                        >
                                                            <X size={20} />
                                                        </button>
                                                    )}

                                                    {/* Reagendar Rápido (Solo Fecha y Hora) */}
                                                    {cita.status !== 'Completada' && cita.status !== 'Cancelada' && (
                                                        <button
                                                            onClick={() => handleAbrirReagendarRapido(cita)}
                                                            className="w-12 h-12 bg-white shadow-xl rounded-2xl text-turquesa hover:bg-turquesa hover:text-white transition-all transform active:scale-90 border border-gray-100 flex items-center justify-center"
                                                            title="Reagendar Cita (Fecha y Hora)"
                                                        >
                                                            <CalendarIcon size={20} />
                                                        </button>
                                                    )}

                                                    {/* 🪷 Sellar Visita — solo visible en citas Completadas */}
                                                    {cita.status === 'Completada' && (
                                                        <button
                                                            onClick={() => handleSellarDesdeCita(cita)}
                                                            disabled={sellandoCitaId === cita.id}
                                                            title="Sellar visita en tarjeta de lealtad"
                                                            className="w-12 h-12 rounded-2xl shadow-xl transition-all transform active:scale-90 border flex items-center justify-center disabled:opacity-50 hover:scale-105"
                                                            style={{
                                                                background: sellandoCitaId === cita.id
                                                                    ? 'rgba(32,178,170,0.5)'
                                                                    : 'linear-gradient(135deg, #20B2AA, #0d8a85)',
                                                                borderColor: 'transparent',
                                                                color: 'white',
                                                            }}
                                                        >
                                                            {sellandoCitaId === cita.id
                                                                ? <Loader size={18} className="animate-spin" />
                                                                : <Stamp size={18} />}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Feedback de sellado inline */}
                                                {selloMsg?.citaId === cita.id && (
                                                    <div className={`mt-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                                                        selloMsg.ok
                                                            ? 'bg-teal-50 text-teal-700 border border-teal-100'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                                                    }`}>
                                                        {selloMsg.msg}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {isModaling && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-acero/70 backdrop-blur-xl p-4 transition-all animate-in fade-in" onClick={() => setIsModaling(false)}>
                    <div className="bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-acero p-10 flex justify-between items-center text-white">
                            <div>
                                <h3 className="font-black text-3xl">{editingCitaId ? 'Reagendar Cita' : 'Nueva Cita'}</h3>
                                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-1">{editingCitaId ? 'Modificar fecha/hora sin crear duplicado' : 'Gestión Central Alfra'}</p>
                            </div>
                            <button onClick={() => { setIsModaling(false); setEditingCitaId(null); }} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleAgendarSubmit} className="p-8 md:p-12 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar-agenda">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Paciente *</label>
                                    <div className="relative">
                                        <input type="text" placeholder="Buscar o escribir nombre..." value={pacienteFiltro || newCita.paciente} onChange={e => { setPacienteFiltro(e.target.value); setNewCita(prev => ({ ...prev, paciente: e.target.value, pacienteId: '' })); setShowPacienteSuggestions(true); }} onFocus={() => setShowPacienteSuggestions(true)} onBlur={() => setTimeout(() => setShowPacienteSuggestions(false), 200)} className="w-full h-14 pl-12 pr-6 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-turquesa transition-all font-bold text-acero text-lg shadow-sm" required />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-turquesa/40"><Search size={22} /></div>
                                        {showPacienteSuggestions && pacientesSugeridos.length > 0 && (
                                            <div className="absolute z-50 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl top-full mt-2 overflow-hidden">
                                                {pacientesSugeridos.map(p => (
                                                    <button key={p.id} type="button" className="w-full text-left px-6 py-4 hover:bg-turquesa/5 flex items-center gap-4 border-b border-gray-50 last:border-0" onMouseDown={() => handleSeleccionarPaciente(p)}>
                                                        <div className="w-10 h-10 rounded-full bg-turquesa/10 flex items-center justify-center font-black text-turquesa">{p.nombre[0]}</div>
                                                        <span className="font-black text-acero">{p.nombre}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Especialista *</label>
                                    <select className="w-full h-14 px-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-turquesa/30 font-bold text-turquesa" value={newCita.especialistaId} onChange={e => { const s = especialistas.find(es => es.id === e.target.value); setNewCita({ ...newCita, especialistaId: e.target.value, especialistaNombre: s?.nombre || '' }); }} required>
                                        <option value="">Seleccionar Especialista...</option>
                                        {especialistas.map(s => <option key={s.id} value={s.id}>{getStaffDisplayTitle(s.id, s.nombre)}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Servicios Seleccionados *</label>
                                        {tratamientosActivosEncontrados.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setIsPreguntaTratamientoOpen(true)}
                                                className="text-[10px] font-black uppercase text-turquesa hover:underline flex items-center gap-1"
                                            >
                                                <Sparkles size={12} />
                                                Ver Tratamientos Activos ({tratamientosActivosEncontrados.length})
                                            </button>
                                        )}
                                    </div>
                                    
                                    {/* LISTA DE SERVICIOS SELECCIONADOS (CARRITO) */}
                                    {(selectedServicios.length > 0 || newCita.servicio) && (
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {selectedServicios.length > 0 ? (
                                                selectedServicios.map(s => (
                                                    <div 
                                                        key={s.id} 
                                                        className={`px-4 py-2.5 rounded-2xl flex items-center gap-2.5 font-bold text-sm shadow-sm border transition-all animate-in fade-in ${
                                                            s.esTratamientoActivo
                                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/20'
                                                                : 'bg-turquesa/10 text-turquesa border-turquesa/20'
                                                        }`}
                                                    >
                                                        {s.esTratamientoActivo && (
                                                            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">
                                                                ✨
                                                            </span>
                                                        )}
                                                        <span className="font-extrabold">{s.nombre}</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-lg font-black ${
                                                            s.esTratamientoActivo
                                                                ? (newCita.citaPagada ? 'bg-emerald-200/60 text-emerald-900' : 'bg-emerald-100 text-emerald-800')
                                                                : 'bg-turquesa/20 text-turquesa'
                                                        }`}>
                                                            {s.esTratamientoActivo && newCita.citaPagada ? 'Cubierto / Pagado' : `$${s.precio}`}
                                                        </span>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => {
                                                                const filtered = selectedServicios.filter(item => item.id !== s.id);
                                                                setSelectedServicios(filtered);
                                                                const total = filtered.reduce((sum, item) => sum + Number(item.precio), 0);
                                                                const totalDur = filtered.length > 0
                                                                    ? filtered.reduce((sum, item) => sum + Number(item.duracionMin || resolverDuracionCitaMinutos(item, servicios)), 0)
                                                                    : 60;
                                                                setNewCita(prev => ({
                                                                    ...prev,
                                                                    monto: total.toString(),
                                                                    duracionMin: totalDur,
                                                                    servicio: filtered.map(item => item.nombre).join(', '),
                                                                    citaPagada: filtered.length === 0 ? false : prev.citaPagada
                                                                }));
                                                            }}
                                                            className="hover:text-red-500 text-gray-400 transition-colors ml-1 p-0.5"
                                                            title="Quitar"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="bg-turquesa/10 text-turquesa px-4 py-2.5 rounded-2xl flex items-center gap-2 font-bold text-sm border border-turquesa/20">
                                                    <span>{newCita.servicio} (${newCita.monto || '0'})</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setNewCita(prev => ({ ...prev, servicio: '', monto: '0' }))}
                                                        className="hover:text-red-500 text-gray-400 transition-colors ml-1"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder={selectedServicios.length > 0 || newCita.servicio ? "+ Agregar otro servicio adicional..." : "Buscar y agregar tratamiento... (puedes agregar varios)"} 
                                            value={servicioFiltro} 
                                            onChange={e => {
                                                setServicioFiltro(e.target.value);
                                                setShowServicioSuggestions(true);
                                            }} 
                                            onFocus={() => setShowServicioSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowServicioSuggestions(false), 200)}
                                            className="w-full h-14 pl-12 pr-6 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-turquesa transition-all font-bold text-acero text-lg shadow-sm" 
                                        />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-turquesa/40"><Search size={22} /></div>
                                        {showServicioSuggestions && serviciosSugeridos.length > 0 && (
                                            <div className="absolute z-50 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl top-full mt-2 overflow-hidden">
                                                {serviciosSugeridos.map(s => (
                                                    <button 
                                                        key={s.id} 
                                                        type="button" 
                                                        className="w-full text-left px-6 py-4 hover:bg-turquesa/5 flex items-center gap-4 border-b border-gray-50 last:border-0" 
                                                        onMouseDown={() => { 
                                                            const alreadySelected = selectedServicios.find(item => item.id === s.id);
                                                            if (alreadySelected) { alert('Este servicio ya fue agregado.'); return; }
                                                            
                                                            const precio = s.precioVenta || s.precio || 0;
                                                            const durServ = resolverDuracionCitaMinutos(s, servicios);
                                                            const updated = [...selectedServicios, { id: s.id, nombre: s.nombre, precio, duracionMin: durServ }];
                                                            setSelectedServicios(updated);

                                                            const total = updated.reduce((sum, item) => sum + Number(item.precio), 0);
                                                            const totalDur = updated.reduce((sum, item) => sum + Number(item.duracionMin || resolverDuracionCitaMinutos(item, servicios)), 0);

                                                            setNewCita(prev => ({
                                                                ...prev,
                                                                monto: total.toString(),
                                                                servicio: updated.map(item => item.nombre).join(', '),
                                                                duracionMin: totalDur
                                                            })); 
                                                            
                                                            setServicioFiltro(''); 
                                                            setShowServicioSuggestions(false); 
                                                        }}
                                                    >
                                                        <div className="w-10 h-10 rounded-full bg-turquesa/10 flex items-center justify-center font-black text-turquesa">{s.nombre[0]}</div>
                                                        <div>
                                                            <p className="font-semibold text-acero text-sm">{s.nombre}</p>
                                                            <p className="text-xs text-gray-400">${s.precioVenta || s.precio} • {resolverDuracionCitaMinutos(s, servicios)} min</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-turquesa">Monto a Cobrar ($) *</label>
                                    <input 
                                        type="number" 
                                        placeholder="0.00" 
                                        value={newCita.monto} 
                                        onChange={e => setNewCita({ ...newCita, monto: e.target.value })} 
                                        className="w-full h-14 px-4 bg-turquesa/5 border-2 border-turquesa/20 rounded-2xl outline-none focus:bg-white focus:border-turquesa font-black text-turquesa text-lg" 
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Duración (minutos) *</label>
                                    <input 
                                        type="number" 
                                        placeholder="90" 
                                        value={newCita.duracionMin} 
                                        onChange={e => setNewCita({ ...newCita, duracionMin: e.target.value })} 
                                        className="w-full h-14 px-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-turquesa transition-all font-bold text-acero text-lg shadow-sm" 
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">¿Es un servicio ya pagado?</label>
                                    <button 
                                        type="button"
                                        onClick={() => setNewCita(prev => ({ ...prev, citaPagada: !prev.citaPagada }))}
                                        className={`w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all ${newCita.citaPagada ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                                    >
                                        <CheckCircle size={20} className={newCita.citaPagada ? 'text-emerald-500' : 'text-gray-400'} />
                                        {newCita.citaPagada ? 'Servicio ya pagado (Paquete/Anticipo)' : 'No, se cobrará el día de la cita'}
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha *</label>
                                    <div className="relative">
                                        <input type="date" value={newCita.fecha} onChange={e => setNewCita({ ...newCita, fecha: e.target.value })} className="w-full h-14 pl-12 pr-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-turquesa/30" />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><CalendarIcon size={20} /></div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hora *</label>
                                    <div className="relative">
                                        <input type="time" value={newCita.hora} onChange={e => setNewCita({ ...newCita, hora: e.target.value })} className="w-full h-14 pl-12 pr-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-turquesa/30" />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Clock size={20} /></div>
                                    </div>
                                    {conflictoEspecialista && (
                                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-bold flex items-start gap-2">
                                            <span>⏱️</span>
                                            <div>
                                                <p className="font-black">Especialista en tratamiento en ese horario:</p>
                                                <p className="text-[11px] font-normal text-amber-800">
                                                    {conflictoEspecialista.especialistaNombre || conflictoEspecialista.especialista} tiene <strong>{conflictoEspecialista.servicio}</strong> de <strong>{conflictoEspecialista.horaInicioStr} a {conflictoEspecialista.horaFinStr}</strong> ({conflictoEspecialista.duracionRealMin} min) con {conflictoEspecialista.paciente || conflictoEspecialista.pacienteNombre}.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cabina / Espacio (Opcional)</label>
                                    <select 
                                        value={newCita.cabina || ''} 
                                        onChange={e => setNewCita({ ...newCita, cabina: e.target.value })} 
                                        className="w-full h-14 px-4 bg-white border-2 border-gray-100 rounded-2xl outline-none focus:border-turquesa transition-all font-bold text-acero text-sm shadow-sm"
                                    >
                                        <option value="">Sin cabina fija</option>
                                        {CABINAS_ALFRA.map(c => (
                                            <option key={c.id} value={c.nombre}>{c.nombre}</option>
                                        ))}
                                    </select>
                                    {conflictoCabina && (
                                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-start gap-2">
                                            <span>⚠️</span>
                                            <div>
                                                <p className="font-black">Empalme de Cabina detectado:</p>
                                                <p className="text-[11px] font-normal text-rose-700">{newCita.cabina} ya está ocupada por {conflictoCabina.especialistaNombre || conflictoCabina.especialista} ({conflictoCabina.horaFormateada || conflictoCabina.hora} - {conflictoCabina.servicio}).</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Anticipo / Apartado ($)</label>
                                    <input 
                                        type="number" 
                                        placeholder="0.00" 
                                        value={newCita.anticipo || ''} 
                                        onChange={e => setNewCita({ ...newCita, anticipo: e.target.value })} 
                                        className="w-full h-14 px-4 bg-emerald-50/40 border-2 border-emerald-100 rounded-2xl outline-none focus:bg-white focus:border-emerald-500 font-black text-emerald-700 text-lg" 
                                    />
                                </div>
                            </div>
                            <div className="pt-8 flex flex-col sm:flex-row gap-4">
                                <Button variant="ghost" className="flex-1 h-16 rounded-2xl font-black uppercase text-xs" onClick={() => { setIsModaling(false); setEditingCitaId(null); }}>Cancelar</Button>
                                <Button variant="primary" type="submit" className="flex-1 h-16 rounded-2xl font-black uppercase text-xs shadow-lg shadow-turquesa/20" disabled={saving}>{saving ? 'Guardando...' : editingCitaId ? 'Guardar Cambios' : 'Confirmar Cita'}</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* MODAL CONFIRMACIÓN DURACIÓN */}
            {isConfirmDuracionOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-acero/70 backdrop-blur-xl p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-amber-500 p-8 text-white">
                            <h3 className="font-black text-2xl">Confirmar Duración</h3>
                            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">Verifica el tiempo del tratamiento</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <p className="text-acero text-lg font-bold text-center">
                                ¿Estás seguro que el tratamiento dura <span className="text-turquesa font-black">{newCita.duracionMin}</span> minutos?
                            </p>
                            <div className="pt-4 flex gap-4">
                                <Button variant="ghost" className="flex-1 h-14 rounded-xl font-black text-gray-400" onClick={() => setIsConfirmDuracionOpen(false)}>Cancelar</Button>
                                <Button variant="primary" className="flex-1 h-14 rounded-xl shadow-lg shadow-turquesa/20 font-black bg-turquesa" onClick={handleConfirmarCitaFinal}>Sí, Confirmar</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PEDIR PRECIO */}
            {isPedirPrecioOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-acero/70 backdrop-blur-xl p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-turquesa p-8 text-white">
                            <h3 className="font-black text-2xl">Ingresar Monto</h3>
                            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">El monto no puede ser cero</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto a Cobrar ($)</label>
                                <input 
                                    type="number" 
                                    placeholder="0.00" 
                                    value={precioManual} 
                                    onChange={e => setPrecioManual(e.target.value)} 
                                    className="w-full h-12 px-4 bg-gray-50 border-2 border-transparent rounded-xl outline-none focus:border-turquesa/30 font-bold"
                                />
                            </div>
                            <div className="pt-4 flex gap-4">
                                <Button variant="ghost" className="flex-1 h-14 rounded-xl font-black text-gray-400" onClick={() => setIsPedirPrecioOpen(false)}>Cancelar</Button>
                                <Button variant="primary" className="flex-1 h-14 rounded-xl shadow-lg shadow-turquesa/20 font-black" onClick={() => {
                                    const pNum = Number(precioManual);
                                    if (!precioManual || pNum === 0) { alert('El monto debe ser mayor a cero.'); return; }
                                    setNewCita(prev => ({ ...prev, monto: precioManual }));
                                    setIsPedirPrecioOpen(false);
                                    setIsConfirmDuracionOpen(true);
                                }}>Confirmar Monto</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {isNuevoPacienteModaling && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-acero/70 backdrop-blur-xl p-4 transition-all animate-in fade-in" onClick={() => setIsNuevoPacienteModaling(false)}>
                    <div className="bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-acero p-8 flex justify-between items-center text-white">
                            <div>
                                <h3 className="font-black text-2xl">Nuevo Paciente</h3>
                                <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-1">El paciente no está registrado</p>
                            </div>
                            <button onClick={() => setIsNuevoPacienteModaling(false)} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X size={20} /></button>
                        </div>
                        <div className="p-8 space-y-4">
                            <p className="text-xs text-gray-400 bg-blue-50 p-3 rounded-lg border border-blue-100 italic">
                                Nota: Registra los datos básicos para poder agendar la cita.
                            </p>
                            <div className="space-y-3">
                                <input type="text" placeholder="Nombre completo *" value={formNuevoPaciente.nombre} onChange={e => setFormNuevoPaciente({ ...formNuevoPaciente, nombre: e.target.value })} className="w-full h-12 px-4 bg-gray-50 border-2 border-transparent rounded-xl outline-none focus:border-turquesa/30 font-bold" />
                                <input type="tel" placeholder="Teléfono *" value={formNuevoPaciente.telefono} onChange={e => setFormNuevoPaciente({ ...formNuevoPaciente, telefono: e.target.value })} className="w-full h-12 px-4 bg-gray-50 border-2 border-transparent rounded-xl outline-none focus:border-turquesa/30 font-bold" />
                                <input type="email" placeholder="Correo electrónico (opcional)" value={formNuevoPaciente.email} onChange={e => setFormNuevoPaciente({ ...formNuevoPaciente, email: e.target.value })} className="w-full h-12 px-4 bg-gray-50 border-2 border-transparent rounded-xl outline-none focus:border-turquesa/30 font-bold" />
                                <input type="date" placeholder="Fecha de Nacimiento" value={formNuevoPaciente.fechaNacimiento} onChange={e => setFormNuevoPaciente({ ...formNuevoPaciente, fechaNacimiento: e.target.value })} className="w-full h-12 px-4 bg-gray-50 border-2 border-transparent rounded-xl outline-none focus:border-turquesa/30 font-bold" />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" fullWidth onClick={() => setIsNuevoPacienteModaling(false)}>Cancelar</Button>
                                <Button variant="primary" fullWidth onClick={handleCrearPacienteYContinuar} disabled={saving}>
                                    {saving ? 'Guardando...' : 'Crear y Continuar'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PREGUNTA TRATAMIENTO ACTIVO */}
            {isPreguntaTratamientoOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-acero/70 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
                        <div className="bg-gradient-to-r from-turquesa to-teal-600 p-6 text-white">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
                                <Sparkles size={24} className="text-white" />
                            </div>
                            <h3 className="font-black text-2xl">Tratamiento Activo Detectado</h3>
                            <p className="text-white/80 text-xs font-semibold mt-1">
                                {newCita.paciente} tiene tratamientos o paquetes activos en su expediente.
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-acero font-bold text-sm">
                                ¿Esta cita es para el tratamiento que tiene activo?
                            </p>

                            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                                {tratamientosActivosEncontrados.map((trat) => (
                                    <div
                                        key={trat.id}
                                        onClick={() => handleSeleccionarTratamientoActivo(trat)}
                                        className="p-4 rounded-2xl border-2 border-turquesa/30 bg-turquesa/5 hover:bg-turquesa/15 hover:border-turquesa transition-all cursor-pointer flex items-center justify-between group"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase text-turquesa tracking-wider">
                                                {trat.tipoLabel} • {trat.categoria || 'Clínico'}
                                            </span>
                                            <span className="font-black text-base text-acero group-hover:text-turquesa transition-colors">
                                                {trat.nombre}
                                            </span>
                                            {trat.especialistaNombre && (
                                                <span className="text-xs text-gray-700 font-bold flex items-center gap-1.5 mt-0.5">
                                                    <User size={13} className="text-turquesa" />
                                                    <span>{getStaffDisplayTitle(trat.especialistaId, trat.especialistaNombre)}</span>
                                                </span>
                                            )}
                                            {trat.tipoOrigen === 'plan' && (
                                                <span className="text-xs text-emerald-600 font-bold">
                                                    {trat.costoPorSesion > 0 ? `Costo por sesión: $${trat.costoPorSesion}` : 'Incluido en paquete'}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className="px-4 py-2 bg-turquesa text-white font-black text-xs rounded-xl shadow-md group-hover:scale-105 transition-transform"
                                        >
                                            Sí, agendar este
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-2 flex gap-3">
                                <Button
                                    variant="ghost"
                                    className="flex-1 h-12 rounded-xl text-gray-500 font-black text-xs hover:bg-gray-100"
                                    onClick={handleRechazarTratamientoActivo}
                                >
                                    No, es para otro servicio nuevo
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            
            {/* MODAL VERIFICACIÓN FINANCIERA FORMAL */}
            {isVerificacionFinancieraOpen && tratamientoSeleccionado && (
                <div className="fixed inset-0 z-[85] flex items-center justify-center bg-acero/75 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
                        {/* Encabezado formal ALFRA */}
                        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-acero p-6 text-white">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-turquesa">
                                    Control Financiero de Sesión
                                </span>
                                <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded-full text-white/80 font-bold">
                                    Clínica ALFRA
                                </span>
                            </div>
                            <h3 className="font-black text-2xl leading-tight">
                                {tratamientoSeleccionado.nombre}
                            </h3>
                            <p className="text-white/70 text-xs font-semibold mt-1">
                                Paciente: <span className="text-white font-bold">{newCita.paciente}</span>
                            </p>
                        </div>

                        <div className="p-6 md:p-8 space-y-6">
                            {/* Resumen de pagos realizados (si tiene plan/paquete) */}
                            {tratamientoSeleccionado.tienePlan ? (
                                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-acero/60">
                                            Estado de Cuenta del Paquete
                                        </span>
                                        <span className="text-xs font-bold text-turquesa">
                                            {tratamientoSeleccionado.faltante <= 0 ? '✓ Liquidado' : 'Con saldo pendiente'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase">Total Paquete</span>
                                            <span className="text-sm font-black text-acero">${tratamientoSeleccionado.meta?.toLocaleString('es-MX')}</span>
                                        </div>
                                        <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100 shadow-sm">
                                            <span className="block text-[10px] font-bold text-emerald-600 uppercase">Abonado / Pagado</span>
                                            <span className="text-sm font-black text-emerald-700">${tratamientoSeleccionado.acumulado?.toLocaleString('es-MX')}</span>
                                        </div>
                                        <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-100 shadow-sm">
                                            <span className="block text-[10px] font-bold text-amber-700 uppercase">Saldo Pendiente</span>
                                            <span className="text-sm font-black text-amber-800">${tratamientoSeleccionado.faltante?.toLocaleString('es-MX')}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 text-xs text-blue-900 font-medium">
                                    ℹ️ Este paciente cuenta con el tratamiento activo en su expediente clínico. A continuación confirme el importe a cobrar en esta sesión.
                                </div>
                            )}

                            {/* Pregunta formal */}
                            <div className="space-y-4">
                                <div className="text-sm text-acero font-bold leading-relaxed">
                                    {sesionYaPagada ? (
                                        <p className="text-emerald-700 font-black">
                                            Esta sesión se registrará como cubierta / pagada ($0.00 a cobrar en caja).
                                        </p>
                                    ) : (
                                        <p>
                                            El costo por sesión registrado para este tratamiento es de{' '}
                                            <span className="text-turquesa font-black text-base">
                                                ${Number(montoSesionPropuesto || 0).toLocaleString('es-MX')} MXN
                                            </span>
                                            . ¿Es correcto este importe o desea ajustarlo?
                                        </p>
                                    )}
                                </div>

                                {/* Botón interactivo para marcar cita ya pagada */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nuevoEstado = !sesionYaPagada;
                                        setSesionYaPagada(nuevoEstado);
                                        if (nuevoEstado) {
                                            setMontoSesionPropuesto('0');
                                        } else {
                                            setMontoSesionPropuesto(tratamientoSeleccionado.costoPorSesion ? String(tratamientoSeleccionado.costoPorSesion) : '0');
                                        }
                                    }}
                                    className={`w-full p-4 rounded-2xl border-2 font-bold text-sm flex items-center justify-between transition-all ${
                                        sesionYaPagada
                                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                                            sesionYaPagada ? 'bg-emerald-500 text-white' : 'border-2 border-gray-300'
                                        }`}>
                                            {sesionYaPagada && '✓'}
                                        </div>
                                        <div className="text-left">
                                            <span className="block font-black text-xs uppercase tracking-wide">
                                                {sesionYaPagada ? 'Sesión Marcada como Ya Pagada' : 'Marcar que esta sesión ya está pagada'}
                                            </span>
                                            <span className="text-[11px] font-normal text-gray-500 block">
                                                {sesionYaPagada ? 'Cubierta por paquete, prepago o saldo a favor' : 'Se cobrará el monto indicado en caja'}
                                            </span>
                                        </div>
                                    </div>
                                    <Badge variant={sesionYaPagada ? 'green' : 'gray'}>
                                        {sesionYaPagada ? 'Pagada' : 'Por Cobrar'}
                                    </Badge>
                                </button>

                                {/* Input para modificar el monto si no está ya pagada */}
                                {!sesionYaPagada && (
                                    <div className="space-y-1.5 animate-in fade-in">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            Monto a cobrar en esta sesión ($ MXN)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={montoSesionPropuesto}
                                                onChange={e => setMontoSesionPropuesto(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full h-14 pl-10 pr-4 bg-gray-50 border-2 border-gray-200 rounded-2xl font-black text-acero text-lg outline-none focus:border-turquesa focus:bg-white transition-all shadow-sm"
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Botones de acción */}
                            <div className="pt-2 flex flex-col sm:flex-row gap-3">
                                <Button
                                    variant="ghost"
                                    className="flex-1 h-14 rounded-2xl font-black uppercase text-xs text-gray-400"
                                    onClick={() => {
                                        setIsVerificacionFinancieraOpen(false);
                                        setTratamientoSeleccionado(null);
                                    }}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    variant="primary"
                                    className="flex-1 h-14 rounded-2xl font-black uppercase text-xs shadow-xl shadow-turquesa/20"
                                    onClick={handleConfirmarFinanciamientoSesion}
                                >
                                    Confirmar y Continuar Agendando
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL RÁPIDO DE REAGENDACIÓN (SOLO FECHA Y HORA) */}
            {citaAReagendar && (
                <div className="fixed inset-0 z-[75] flex items-center justify-center bg-acero/70 backdrop-blur-xl p-3 sm:p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
                        {/* Cabecera Pinned / Shrink-0 */}
                        <div className="bg-gradient-to-r from-turquesa to-teal-700 px-5 py-4 sm:px-6 sm:py-5 text-white relative shrink-0">
                            <button
                                onClick={() => setCitaAReagendar(null)}
                                className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
                            >
                                <X size={20} />
                            </button>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                    <CalendarIcon size={20} className="text-white" />
                                </span>
                                <div className="min-w-0 pr-8">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/80 block">Reagendación Rápida</span>
                                    <h3 className="font-black text-lg sm:text-2xl leading-tight text-white truncate">{citaAReagendar.paciente}</h3>
                                </div>
                            </div>
                            <div className="mt-2 bg-white/10 rounded-xl px-3 py-2 text-xs text-white/90 flex flex-wrap items-center gap-x-4 gap-y-1">
                                <span>💆‍♀️ <b>Servicio:</b> {citaAReagendar.servicio}</span>
                                <span>👩‍⚕️ <b>Dr(a) previa:</b> {citaAReagendar.especialista}</span>
                            </div>
                        </div>

                        {/* Formulario con Scroll Interno fluido */}
                        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                            {/* Alerta de Horario Anterior */}
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 font-bold flex items-center gap-3">
                                <Clock size={20} className="text-amber-600 flex-shrink-0" />
                                <div>
                                    <span className="font-black uppercase tracking-wide block text-[10px] text-amber-700">Horario Anterior:</span>
                                    <span>{citaAReagendar.fechaYMD ? format(new Date(citaAReagendar.fechaYMD + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es }) : citaAReagendar.fecha} a las {citaAReagendar.horaFormateada || citaAReagendar.hora}</span>
                                </div>
                            </div>

                            {/* Grid 2 Columnas en tablet/desktop, 1 columna en móvil */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                                {/* Fecha */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">
                                        ¿Para qué fecha? *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            required
                                            value={reagendarFecha}
                                            onChange={e => setReagendarFecha(e.target.value)}
                                            className="w-full h-12 sm:h-13 pl-11 pr-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-acero text-sm sm:text-base outline-none focus:border-turquesa focus:bg-white transition-all shadow-sm"
                                        />
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-turquesa">
                                            <CalendarIcon size={18} />
                                        </div>
                                    </div>
                                </div>

                                {/* Hora */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">
                                        ¿A qué hora? *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="time"
                                            required
                                            value={reagendarHora}
                                            onChange={e => setReagendarHora(e.target.value)}
                                            className="w-full h-12 sm:h-13 pl-11 pr-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-acero text-sm sm:text-base outline-none focus:border-turquesa focus:bg-white transition-all shadow-sm"
                                        />
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-turquesa">
                                            <Clock size={18} />
                                        </div>
                                    </div>
                                </div>

                                {/* Especialista Asignada */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">
                                            Especialista Asignada *
                                        </label>
                                        {especialistaEstaDeBaja && (
                                            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                                Previa dada de baja
                                            </span>
                                        )}
                                    </div>
                                    <select
                                        value={reagendarEspecialistaId || ''}
                                        onChange={e => {
                                            const esp = especialistas.find(s => s.id === e.target.value);
                                            setReagendarEspecialistaId(e.target.value);
                                            setReagendarEspecialistaNombre(esp ? esp.nombre : '');
                                        }}
                                        className={`w-full h-12 sm:h-13 px-3.5 bg-gray-50 border-2 ${especialistaEstaDeBaja && !reagendarEspecialistaId ? 'border-rose-400 bg-rose-50/50' : 'border-gray-100'} rounded-xl font-bold text-acero text-sm outline-none focus:border-turquesa focus:bg-white transition-all shadow-sm`}
                                    >
                                        <option value="">Selecciona especialista...</option>
                                        {especialistas.map(esp => (
                                            <option key={esp.id} value={esp.id}>
                                                {esp.nombre} {esp.puesto ? `(${esp.puesto})` : ''}
                                            </option>
                                        ))}
                                        {especialistaEstaDeBaja && (
                                            <option value="" disabled>
                                                ❌ {reagendarEspecialistaNombre || citaAReagendar.especialista || 'Especialista anterior'} (DADA DE BAJA)
                                            </option>
                                        )}
                                    </select>
                                    {especialistaEstaDeBaja && !reagendarEspecialistaId && (
                                        <p className="text-[11px] text-rose-700 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200">
                                            ⚠️ La especialista que atendía esta cita ya no labora en la clínica. Por favor selecciona una especialista activa de la lista superior para reasignar la cita.
                                        </p>
                                    )}
                                </div>

                                {/* Cabina / Espacio */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">
                                        Cabina / Espacio (Opcional)
                                    </label>
                                    <select
                                        value={reagendarCabina || ''}
                                        onChange={e => setReagendarCabina(e.target.value)}
                                        className="w-full h-12 sm:h-13 px-3.5 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-acero text-sm outline-none focus:border-turquesa focus:bg-white transition-all shadow-sm"
                                    >
                                        <option value="">Sin cabina fija</option>
                                        {CABINAS_ALFRA.map(c => (
                                            <option key={c.id} value={c.nombre}>{c.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Alerta de Conflicto de Cabina */}
                            {conflictoCabinaReagendar && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-start gap-2">
                                    <span>⚠️</span>
                                    <div>
                                        <p className="font-black">Empalme de Cabina en nuevo horario:</p>
                                        <p className="text-[11px] font-normal text-rose-700">{reagendarCabina} ya está ocupada por {conflictoCabinaReagendar.especialistaNombre || conflictoCabinaReagendar.especialista} ({conflictoCabinaReagendar.horaFormateada || conflictoCabinaReagendar.hora}).</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Pinned / Shrink-0 */}
                        <div className="px-5 py-3 sm:px-6 sm:py-4 bg-gray-50/90 border-t border-gray-100 shrink-0 space-y-2">
                            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                                <Button
                                    variant="ghost"
                                    className="flex-1 h-11 sm:h-12 rounded-xl font-black uppercase text-xs text-gray-500 hover:bg-gray-200/60"
                                    onClick={() => setCitaAReagendar(null)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    variant="primary"
                                    className="flex-1 h-11 sm:h-12 rounded-xl font-black uppercase text-xs shadow-lg shadow-turquesa/20"
                                    onClick={handleConfirmarReagendacionRapida}
                                    disabled={savingReagendar}
                                >
                                    {savingReagendar ? 'Guardando...' : 'Confirmar Reagendación'}
                                </Button>
                            </div>

                            <div className="text-center pt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const c = citaAReagendar;
                                        setCitaAReagendar(null);
                                        setEditingCitaId(c.id);
                                        setNewCita({
                                            pacienteId: c.pacienteId || '',
                                            paciente: c.paciente,
                                            telefono: c.telefono || '',
                                            servicio: c.servicio,
                                            especialistaId: c.especialistaId,
                                            especialistaNombre: c.especialista,
                                            hora: c.hora,
                                            duracionMin: resolverDuracionCitaMinutos(c, servicios),
                                            fecha: c.fechaYMD,
                                            cabina: c.cabina || '',
                                            anticipo: c.anticipo || '',
                                            notas: c.notas || '',
                                            monto: c.precio || '',
                                            citaPagada: c.citaPagada || false
                                        });
                                        setIsModaling(true);
                                    }}
                                    className="text-[11px] text-gray-400 hover:text-turquesa font-bold transition-colors"
                                >
                                    ¿Deseas editar otros datos avanzados (monto, notas, etc.)? Haz clic aquí
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Próximos Cumpleaños para Recepción */}
            {showCumpleanosModal && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in"
                    onClick={() => setShowCumpleanosModal(false)}
                >
                    <div 
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-amber-200/50 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Cabecera */}
                        <div className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 p-5 text-slate-900 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/30 backdrop-blur-sm rounded-2xl text-slate-900 shadow-sm">
                                    <Gift size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-black text-xl tracking-tight text-slate-950">Próximos Cumpleaños</h3>
                                        <span className="text-xs font-black bg-slate-950 text-amber-300 px-2.5 py-0.5 rounded-full">
                                            {cumpleanosProximos.length} pacientes
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-800 mt-0.5">
                                        Fechas exactas calculadas para los próximos 30 días • Clínica ALFRA
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowCumpleanosModal(false)}
                                className="p-2 text-slate-900 hover:bg-black/10 rounded-xl transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Contenido / Listado */}
                        <div className="p-5 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
                            {cumpleanosProximos.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Gift size={32} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-700">No hay cumpleaños en los próximos 30 días</p>
                                    <p className="text-xs text-slate-400 mt-1">Los cumpleaños se calcularán automáticamente según la fecha de nacimiento de cada expediente.</p>
                                </div>
                            ) : (
                                cumpleanosProximos.map((paciente) => {
                                    const tel = String(paciente.telefono || paciente.phone || '').replace(/\D/g, '');
                                    const esHoy = paciente.detalleCumple?.esHoy;
                                    return (
                                        <div 
                                            key={paciente.id}
                                            className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                                esHoy 
                                                    ? 'bg-gradient-to-r from-amber-50 via-white to-amber-50/50 border-amber-300 shadow-md ring-2 ring-amber-300/40' 
                                                    : 'bg-white border-slate-200/80 hover:border-amber-200 hover:shadow-sm'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-3 rounded-2xl shrink-0 ${
                                                    esHoy ? 'bg-amber-400 text-slate-950 animate-bounce' : 'bg-turquesa/10 text-turquesa'
                                                }`}>
                                                    <Gift size={20} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="text-sm font-black text-slate-900">{paciente.nombre}</h4>
                                                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                                            esHoy
                                                                ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                                                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                        }`}>
                                                            {paciente.detalleCumple?.textoProximidad}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs">
                                                        <span className="font-bold text-turquesa flex items-center gap-1">
                                                            📅 {paciente.detalleCumple?.textoFechaExacta}
                                                        </span>
                                                        {paciente.detalleCumple?.edadCumple && (
                                                            <span className="text-slate-500 font-semibold">
                                                                • Cumple {paciente.detalleCumple.edadCumple} años
                                                            </span>
                                                        )}
                                                        {paciente.telefono && (
                                                            <span className="text-slate-400 text-[11px]">
                                                                📞 {paciente.telefono}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                                {tel && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const saludo = esHoy
                                                                ? `¡Feliz Cumpleaños ${paciente.nombre}! 🎉 De parte de todo el equipo de Clínica ALFRA te deseamos un día maravilloso.`
                                                                : `¡Hola ${paciente.nombre}! En Clínica ALFRA sabemos que tu cumpleaños es el ${paciente.detalleCumple?.textoFechaExacta} 🎂 y queremos consentirte.`;
                                                            window.open(`https://wa.me/52${tel}?text=${encodeURIComponent(saludo)}`, '_blank');
                                                        }}
                                                        className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                                                        title="Enviar felicitación rápida por WhatsApp"
                                                    >
                                                        <MessageCircle size={14} className="text-emerald-600" /> WhatsApp
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setPacienteCumpleModal(paciente)}
                                                    className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-900 text-xs font-black rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                                                    title="Diseñar tarjeta de regalo personalizada (PNG/JPEG) con regalo manual o sugerido"
                                                >
                                                    <Sparkles size={14} /> 🎁 Tarjeta & Regalo
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Pie con recordatorio */}
                        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                            <span className="text-[11px] text-turquesa font-bold">
                                💡 Tip: Aplica el 20% de descuento o un regalo especial a los pacientes en su mes.
                            </span>
                            <Button 
                                variant="ghost" 
                                className="h-8 px-4 text-xs font-bold"
                                onClick={() => setShowCumpleanosModal(false)}
                            >
                                Cerrar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Tarjeta de Cumpleaños ALFRA VIP (Descargable PNG/JPEG con Regalo) */}
            {pacienteCumpleModal && (
                <ModalTarjetaCumpleanos
                    isOpen={!!pacienteCumpleModal}
                    onClose={() => setPacienteCumpleModal(null)}
                    paciente={pacienteCumpleModal}
                />
            )}

        </div>
    );
}
