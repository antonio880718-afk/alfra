import { sellarVisita } from '../../services/lealtadService';
import { useNavigate } from 'react-router-dom';
import { enviarWhatsAppCita } from '../../services/whatsappService';
import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import {
    Calendar as CalendarIcon, User, PlusCircle, Edit, XCircle,
    CheckCircle, History, Loader, X, Bell, Search, Filter,
    LayoutGrid, List, Clock, ChevronLeft, ChevronRight, Navigation,
    MessageCircle, Trash2, MapPin
} from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import AgendaGlobalEjecutiva from '../../components/agenda/AgendaGlobalEjecutiva';
import { onCitasChange, updateCitaStatus, verificarMovimientosExpediente, createCita, CABINAS_ALFRA, checkConflictoCabina, isStaffClinico, getTratamientosYPlanesActivosPaciente } from '../../services/citasService';
import { onServiciosChange } from '../../services/comercialService';
import { onStaffChange } from '../../services/staffService';
import { onPacientesChange } from '../../services/pacientesService';
import { addDoc, collection, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function SupervisionAgenda() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('tablero'); // 'tablero' | 'lista' | 'disponibilidad' 
    const [selectedEspIds, setSelectedEspIds] = useState(['todos']);
    const [isCopied, setIsCopied] = useState(false);
    const [isUbicacionCopied, setIsUbicacionCopied] = useState(false);
    const [citas, setCitas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCita, setEditingCita] = useState(null);
    const navigate = useNavigate();
    const [sellandoCitaId, setSellandoCitaId] = useState(null);
    const [selloMsg, setSelloMsg] = useState(null);

    const handleSellarDesdeCita = async (cita) => {
        if (!cita.pacienteId) {
            setSelloMsg({ citaId: cita.id, msg: '?? Paciente sin ID vinculado. Vincúla desde Pacientes.', ok: false });
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
            setSelloMsg({ citaId: cita.id, msg: '? Error: ' + err.message, ok: false });
        } finally {
            setSellandoCitaId(null);
        }
    };

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
    const [savingReagendar, setSavingReagendar] = useState(false);

    // Datos reales desde Firestore
    const [staff, setStaff] = useState([]);
    const [pacientes, setPacientes] = useState([]);
    const [servicios, setServicios] = useState([]);

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
        duracionMin: 90,
        notas: '',
        monto: '',
        estadoPago: 'Pendiente',
        cabina: '',
        anticipo: ''
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

    const handleSeleccionarPacienteAdmin = async (p) => {
        setForm(prev => ({
            ...prev,
            pacienteId: p.id,
            pacienteNombre: p.nombre,
            telefono: p.telefono || prev.telefono || ''
        }));
        setPacienteFiltro('');
        setShowSugg(false);

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

    const getStaffDisplayTitleAdmin = (espId, espNombre) => {
        if (!espNombre && !espId) return 'Por asignar';
        const esp = staff.find(s => s.id === espId || s.nombre?.toLowerCase() === espNombre?.toLowerCase());
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

    const handleSeleccionarTratamientoActivoAdmin = (trat) => {
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

    const handleConfirmarFinanciamientoSesionAdmin = () => {
        if (!tratamientoSeleccionado) return;
        const t = tratamientoSeleccionado;
        const montoFinal = sesionYaPagada ? '0' : (montoSesionPropuesto || '0');

        setSelectedServicios([{
            id: t.id || ('trat_activo_' + Date.now()),
            nombre: t.nombre,
            precio: montoFinal,
            esTratamientoActivo: true
        }]);
        setServicioFiltro('');

        setForm(prev => ({
            ...prev,
            servicio: t.nombre,
            duracionMin: t.duracionMin || prev.duracionMin || 60,
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

    const handleAbrirReagendarRapidoAdmin = (cita) => {
        setCitaAReagendar(cita);
        setReagendarFecha(cita.fechaYMD || new Date().toISOString().split('T')[0]);
        setReagendarHora(cita.hora || '10:00');
        setReagendarCabina(cita.cabina || '');
    };

    const handleConfirmarReagendacionRapidaAdmin = async () => {
        if (!citaAReagendar || !reagendarFecha || !reagendarHora) {
            alert('Por favor selecciona fecha y hora para reagendar.');
            return;
        }
        setSavingReagendar(true);
        try {
            const [year, month, day] = reagendarFecha.split('-');
            const [hh, mm] = reagendarHora.split(':');
            const fechaBase = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hh), parseInt(mm));
            const fechaHoraLocal = format(fechaBase, "yyyy-MM-dd'T'HH:mm:ss");

            await updateCitaStatus(citaAReagendar.id, 'Pendiente', {
                fechaHora: fechaHoraLocal,
                fechaYMD: reagendarFecha,
                hora: reagendarHora,
                cabina: reagendarCabina || '',
                log: `Reagendada para el ${reagendarFecha} a las ${reagendarHora}`,
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

            if (citaAReagendar.especialistaId) {
                await addDoc(collection(db, 'alertas_pacientes'), {
                    especialistaId: citaAReagendar.especialistaId,
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
            alert('Error al reagendar: ' + err.message);
        } finally {
            setSavingReagendar(false);
        }
    };

    const conflictoCabina = useMemo(() => {
        return checkConflictoCabina(citas, {
            cabina: form.cabina,
            fechaYMD: form.fecha,
            hora: form.hora,
            duracionMin: form.duracionMin,
            ignoreCitaId: editingCita?.id
        });
    }, [citas, form.cabina, form.fecha, form.hora, form.duracionMin, editingCita]);
    const [isNuevoPacienteModalOpen, setIsNuevoPacienteModalOpen] = useState(false);
    const [nuevoPaciente, setNuevoPaciente] = useState({ nombre: '', telefono: '', correo: '' });
    const [isConfirmDuracionOpen, setIsConfirmDuracionOpen] = useState(false);
    const [isPedirPrecioOpen, setIsPedirPrecioOpen] = useState(false);
    const [precioManual, setPrecioManual] = useState('');
    const [showServSugg, setShowServSugg] = useState(false);
    const [selectedServicios, setSelectedServicios] = useState([]);
    const [servicioFiltro, setServicioFiltro] = useState('');




    // Suscripciones en tiempo real
    useEffect(() => {
        const unsub = onCitasChange((citasFirestore) => {
            const normalized = citasFirestore.map(c => {
                // Si la fecha ya viene en formato local (ISO sin Z) o es vieja con Z
                let fechaObj;
                if (c.fechaHora && c.fechaHora.includes('T')) {
                    fechaObj = new Date(c.fechaHora);
                } else if (c.fecha) {
                    const [y, m, d] = c.fecha.split('-');
                    fechaObj = new Date(y, m - 1, d);
                } else {
                    fechaObj = new Date();
                }

                // Normalizar fecha a string YYYY-MM-DD para comparación pura
                const fechaYMD = format(fechaObj, 'yyyy-MM-dd');
                const horaFormateada = format(fechaObj, 'hh:mm a');

                return {
                    ...c,
                    paciente: c.pacienteNombre || c.paciente || 'Sin nombre',
                    especialista: c.especialistaNombre || c.especialistaId || '---',
                    fechaYMD,
                    horaFormateada,
                    log: c.log || 'Registrado en sistema',
                };
            });
            setCitas(normalized);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onStaffChange((staffData) => {
            const filtered = staffData.filter(isStaffClinico);
            setStaff(filtered);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onPacientesChange(setPacientes);
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onServiciosChange(setServicios);
        return () => unsub();
    }, []);

    const pacientesFiltrados = useMemo(() => {
        return pacientes.filter(p =>
            pacienteFiltro.length > 0 &&
            (p.nombre || '').toLowerCase().includes(pacienteFiltro.toLowerCase())
        ).slice(0, 6);
    }, [pacientes, pacienteFiltro]);

    const citasDelDia = useMemo(() => {
        const currentYMD = format(currentDate, 'yyyy-MM-dd');
        return citas.filter(c => {
            const matchesDate = c.fechaYMD === currentYMD;
            const matchesEsp = selectedEspIds.includes('todos') || selectedEspIds.includes(c.especialistaId);
            return matchesDate && matchesEsp;
        });
    }, [citas, currentDate, selectedEspIds]);

    const getStatusStyles = (status) => {
        switch (status) {
            case 'En Sala de Espera': return 'bg-amber-100 text-amber-900 border-amber-300 ring-4 ring-amber-100 animate-pulse font-black shadow-sm';
            case 'En Cabina': return 'bg-teal-50 text-teal-800 border-teal-300 ring-4 ring-teal-100 font-bold';
            case 'Confirmada': return 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold';
            case 'Pendiente': return 'bg-amber-50 text-amber-600 border-amber-200';
            case 'Pendiente Pase a Caja': return 'bg-purple-50 text-purple-800 border-purple-300 ring-4 ring-purple-100 animate-pulse font-black';
            case 'Completada': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
            case 'Cancelada': return 'bg-rose-50 text-rose-600 border-rose-200 line-through';
            case 'No Asistió': return 'bg-red-50 text-red-400 border-red-200';
            case 'Reagendada': return 'bg-orange-50 text-orange-500 border-orange-200';
            default: return 'bg-gray-50 text-gray-500 border-gray-200';
        }
    };

    const getMinutosEspera = (llegadaAt) => {
        if (!llegadaAt) return null;
        const diff = Math.floor((Date.now() - new Date(llegadaAt).getTime()) / 60000);
        return Math.max(0, diff);
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
                monto: '',
                estadoPago: 'Pendiente',
                cabina: cita.cabina || '',
                anticipo: cita.anticipo || ''
            });
            setPacienteFiltro('');
        } else {
            setForm({
                pacienteId: '', pacienteNombre: '', telefono: '',
                especialistaId: staff[0]?.id || '', especialistaNombre: staff[0]?.nombre || '',
                servicio: '', fecha: new Date().toISOString().split('T')[0],
                hora: '09:00', duracionMin: 30, notas: '',
                monto: '',
                estadoPago: 'Pendiente',
                cabina: '',
                anticipo: ''
            });
            setPacienteFiltro('');
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.pacienteNombre) { alert('Ingresa el nombre del paciente.'); return; }
        if (!form.pacienteId) {
            setNuevoPaciente({ nombre: form.pacienteNombre, telefono: form.telefono || '', correo: '' });
            setIsNuevoPacienteModalOpen(true);
            return;
        }
        if (!form.especialistaId) { alert('Selecciona un especialista.'); return; }
        if (!form.servicio) { alert('Indica el servicio.'); return; }
        const montoNum = Number(form.monto);
        if ((form.monto === '' || form.monto === undefined || montoNum === 0) && !form.citaPagada) {
            setIsPedirPrecioOpen(true);
            return;
        }
        
        // Abrir modal de confirmación
        setIsConfirmDuracionOpen(true);
    };

    const handleConfirmarCitaFinal = async () => {
        setIsConfirmDuracionOpen(false);
        setSaving(true);
        try {
            const [year, month, day] = form.fecha.split('-');
            const [hh, mm] = form.hora.split(':');
            const fechaBase = new Date(year, month - 1, day, parseInt(hh), parseInt(mm));
            const fechaHoraLocal = format(fechaBase, "yyyy-MM-dd'T'HH:mm:ss");

            if (editingCita) {
                // REAGENDAR: Actualizar la cita existente en vez de crear duplicado
                await updateCitaStatus(editingCita.id, 'Pendiente', {
                    pacienteId: form.pacienteId || null,
                    pacienteNombre: form.pacienteNombre,
                    telefono: form.telefono || '',
                    especialistaId: form.especialistaId,
                    especialistaNombre: form.especialistaNombre,
                    servicio: form.servicio,
                    fechaHora: fechaHoraLocal,
                    duracionMin: Number(form.duracionMin),
                    notas: form.notas || '',
                    cabina: form.cabina || '',
                    anticipo: Number(form.anticipo || 0),
                });
            } else {
                const docId = await createCita({
                    pacienteId: form.pacienteId || null,
                    pacienteNombre: form.pacienteNombre,
                    telefono: form.telefono || '',
                    especialistaId: form.especialistaId,
                    especialistaNombre: form.especialistaNombre,
                    servicio: form.servicio,
                    fechaHora: fechaHoraLocal,
                    duracionMin: Number(form.duracionMin),
                    notas: form.notas || '',
                    cabina: form.cabina || '',
                    anticipo: Number(form.anticipo || 0),
                });

                // --- PERSISTENCIA LOCAL DE PROYECCIÓN (LABORATORIO) ---
                if (docId) {
                    const labPrices = JSON.parse(localStorage.getItem('alfra_lab_prices') || '{}');
                    labPrices[docId] = {
                        precio: Number(form.monto || 0),
                        citaPagada: form.citaPagada
                    };
                    localStorage.setItem('alfra_lab_prices', JSON.stringify(labPrices));
                }
            }
            setIsModalOpen(false);
            setSelectedServicios([]);
            setServicioFiltro('');
            alert('Cita guardada con éxito.');
        } catch (err) {
            console.error(err);
            alert('Error al guardar la cita.');
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        if (!confirm(`¿Cambiar estado a ${newStatus}?`)) return;
        try {
            await updateCitaStatus(id, newStatus);
        } catch (err) {
            console.error(err);
            alert('Error al cambiar el estado.');
        }
    };

    const handleDeleteCita = async (id) => {
        if (!confirm('¿ESTÁS SEGURO DE ELIMINAR ESTA CITA? Esta acción no se puede deshacer.')) return;
        try {
            await deleteDoc(doc(db, 'citas', id));
            alert('Cita eliminada correctamente.');
        } catch (err) {
            console.error(err);
            alert('Error al eliminar la cita.');
        }
    };

        const enviarWhatsApp = (e, cita) => {
        e?.stopPropagation();
        enviarWhatsAppCita(cita);
    };

    const handleNotificarLlegada = async (cita) => {
        if (!cita.especialistaId || cita.especialistaId === '---') {
            alert('Esta cita no tiene un especialista asignado válido.');
            return;
        }

        // Normalización de ID: Buscar el UID real del especialista
        const esp = staff.find(s => s.id === cita.especialistaId);
        const realUid = esp?.uid || cita.especialistaId;

        if (confirm(`¿Notificar al Dr(a). ${cita.especialista} que su paciente ${cita.paciente} ya llegó?`)) {
            try {
                await addDoc(collection(db, 'alertas_pacientes'), {
                    especialistaId: realUid,
                    mensaje: `Tu paciente ${cita.paciente} ya está en la sala de espera para la cita de las ${cita.horaFormateada} (${cita.servicio}).`,
                    estado: 'pendiente',
                    createdAt: serverTimestamp(),
                    pacienteNombre: cita.paciente,
                    citaId: cita.id
                });
                alert('¡Notificación Push enviada con éxito al celular del especialista!');
            } catch (error) {
                console.error('Error enviando notificación:', error);
                alert('Hubo un error al intentar notificar al especialista.');
            }
        }
    };

    const getHorasDisponibles = (fecha, espIds) => {
        const startH = 9, endH = 19;
        const duracionBloque = 90;
        const slots = [];
        
        const dayStr = format(fecha, 'yyyy-MM-dd');
        
        const idsAEvaluar = espIds.includes('todos') 
            ? staff.map(e => e.id) 
            : espIds;

        for (let h = startH; h <= endH; h++) {
            for (let m of [0, 30]) {
                if (h === endH && m > 0) break;
                
                const sStart = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), h, m, 0, 0).getTime();
                const sEnd = sStart + (duracionBloque * 60000);
                
                const endDate = new Date(sEnd);
                if (endDate.getHours() > endH || (endDate.getHours() === endH && endDate.getMinutes() > 0)) continue;
                
                const hayAlMenosUnoLibre = idsAEvaluar.some(eid => {
                    const esp = staff.find(e => e.id === eid);
                    const citasEsp = citas.filter(c => 
                        (c.especialistaId === eid || (esp && c.especialistaNombre === esp.nombre)) && 
                        c.fechaYMD === dayStr && 
                        c.status !== 'Cancelada'
                    );

                    const estaOcupado = citasEsp.some(c => {
                        let cStart;
                        try {
                            cStart = new Date(c.fechaHora).getTime();
                            if (isNaN(cStart)) throw new Error();
                        } catch {
                            const [y, mon, d] = c.fechaYMD.split('-');
                            const [hh, mm] = c.hora.split(':');
                            cStart = new Date(y, mon - 1, d, hh, mm).getTime();
                        }
                        // Bloqueamos el tiempo real de la cita (o 90 min por defecto)
                        const cEnd = cStart + ((c.duracionMin || 90) * 60000);
                        return (sStart < cEnd && sEnd > cStart);
                    });

                    return !estaOcupado;
                });

                if (hayAlMenosUnoLibre) {
                    slots.push(format(new Date(sStart), 'hh:mm a'));
                }
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

    const handleCopyDisponibilidadProfesional = async (fecha, slots) => {
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
            alert('No se pudo copiar el mensaje automáticamente.');
        }
    };

    const handleCopyUbicacion = async () => {
        const text = `📍 *UBICACIÓN:*\n` +
            `Calle Rio Fuerte #26, (esq.con calle Jaime Torres Bodet) Colonia: Lomas de Bella Vista, Lázaro Cárdenas, Mich\n\n` +
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

    const inputCls = "w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:bg-white focus:border-turquesa/30 transition-all font-bold text-acero";

    return (
        <div className="max-w-[1700px] mx-auto space-y-8 animate-in fade-in duration-500 pb-24 px-4">
            {/* CABECERA PREMIUM */}
            <div className="relative group overflow-hidden bg-white/70 backdrop-blur-xl border border-white/40 shadow-2xl shadow-turquesa/5 rounded-2xl md:rounded-[1.5rem] p-4 md:p-5 transition-all duration-500">
                <div className="absolute top-0 right-0 w-64 h-64 md:w-80 md:h-80 bg-turquesa/5 rounded-full blur-[60px] md:blur-[80px] -mr-32 -mt-32 md:-mr-40 md:-mt-40 transition-transform duration-1000 group-hover:scale-110"></div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-4 relative z-10">
                    <div className="flex items-center gap-4 md:gap-4">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-acero to-acero/80 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-lg shadow-acero/30 transform transition-transform group-hover:rotate-6">
                            <PlusCircle size={20} className="md:size-[24px]" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-black text-acero tracking-tight leading-tight uppercase">Supervisión</h1>
                            <div className="flex items-center gap-2 md:gap-3 mt-0.5">
                                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-acero/10 text-acero rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest">
                                    <div className="w-1 h-1 rounded-full bg-acero animate-pulse"></div> Administrador
                                </span>
                                <p className="text-gray-400 font-bold text-[9px] md:text-[10px] tracking-wide hidden sm:block">Control logístico y auditoría</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm">
                            <button
                                onClick={() => setViewMode('tablero')}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                    viewMode === 'tablero' ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-950/5' : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                <LayoutGrid size={14} className={viewMode === 'tablero' ? 'text-turquesa' : 'text-slate-400'} />
                                <span>Tablero Ejecutivo</span>
                            </button>
                            <button
                                onClick={() => setViewMode('lista')}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                    viewMode === 'lista' ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-950/5' : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                <List size={14} className={viewMode === 'lista' ? 'text-turquesa' : 'text-slate-400'} />
                                <span>Lista Detallada</span>
                            </button>
                            <button
                                onClick={() => setViewMode('disponibilidad')}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                    viewMode === 'disponibilidad' ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-950/5' : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                <Clock size={14} className={viewMode === 'disponibilidad' ? 'text-turquesa' : 'text-slate-400'} />
                                <span>Disponibilidad</span>
                            </button>
                        </div>
                        <Button
                            variant="primary"
                            size="lg"
                            className="flex-1 sm:flex-none rounded-xl md:rounded-2xl shadow-lg px-6 py-3 md:px-8 md:py-4 text-xs md:text-sm font-black h-auto"
                            onClick={() => handleOpenModal()}
                        >
                            <PlusCircle size={18} className="mr-2" />
                            <span>Nueva Cita</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* SELECTOR DE ESPECIALISTAS (Pills) */}
            <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar-hide px-1">
                <button
                    onClick={() => setSelectedEspIds(['todos'])}
                    className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${selectedEspIds.includes('todos')
                        ? 'bg-acero text-white border-acero shadow-lg'
                        : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
                        }`}
                >
                    Todos
                </button>
                {staff.map((esp) => (
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
                        className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${selectedEspIds.includes(esp.id)
                            ? 'bg-turquesa text-white border-turquesa shadow-lg shadow-turquesa/20 scale-105'
                            : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
                            }`}
                    >
                        {esp.nombre.split(' ')[0]}
                    </button>
                ))}
            </div>

            {/* CONTROLES DE FECHA */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 bg-white/40 backdrop-blur-sm p-2 md:p-3 rounded-2xl md:rounded-full border border-gray-100 shadow-sm">
                <div className="flex items-center gap-1 md:gap-2 bg-white rounded-full p-1 md:p-1.5 shadow-sm border border-gray-50 text-acero">
                    <button onClick={() => setCurrentDate(subDays(currentDate, 1))} className="p-2 md:p-3 hover:bg-turquesa/5 rounded-full text-gray-400 hover:text-turquesa transition-all"><ChevronLeft size={24} className="md:size-[28px]" strokeWidth={3} /></button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 md:px-6 md:py-2.5 text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-turquesa hover:bg-turquesa/10 rounded-full transition-all border border-turquesa/20">Hoy</button>
                    <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="p-2 md:p-3 hover:bg-turquesa/5 rounded-full text-gray-400 hover:text-turquesa transition-all"><ChevronRight size={24} className="md:size-[28px]" strokeWidth={3} /></button>
                </div>

                <h2 className="text-xl md:text-3xl font-black text-acero capitalize flex items-baseline gap-2">
                    <span className="text-turquesa/20 text-3xl md:text-4xl leading-none">/</span>
                    {format(currentDate, "EEEE, d 'de' MMMM", { locale: es })}
                    <span className="text-gray-300 font-bold text-sm md:text-lg">{format(currentDate, "yyyy")}</span>
                </h2>

                <div className="hidden xl:flex items-center gap-3 pr-6">
                    <History size={20} className="text-gray-300" />
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Auditoría</p>
                        <p className="text-sm font-black text-acero">Sincronización Activa</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-gray-400 bg-white/50 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-gray-200 animate-pulse">
                    <Loader className="animate-spin mb-4" size={40} />
                    <p className="font-black text-xl text-acero opacity-50 uppercase tracking-widest">Cargando Agenda Admin...</p>
                </div>
            ) : viewMode === 'tablero' ? (
                <AgendaGlobalEjecutiva
                    citas={citas}
                    especialistas={staff}
                    pacientes={pacientes}
                    servicios={servicios}
                    currentDate={currentDate}
                    setCurrentDate={setCurrentDate}
                    onAgendarCita={(prefill = {}) => {
                        setEditingCita(null);
                        setForm(prev => ({
                            ...prev,
                            ...(prefill.fecha ? { fecha: prefill.fecha } : {}),
                            ...(prefill.especialistaId ? { especialistaId: prefill.especialistaId, especialistaNombre: prefill.especialistaNombre } : {}),
                            ...(prefill.cabina ? { cabina: prefill.cabina } : {})
                        }));
                        setIsModalOpen(true);
                    }}
                    onReagendarCita={handleAbrirReagendarRapidoAdmin}
                    onVerExpediente={(cita) => {
                        const pac = pacientes.find(p => (p.id && p.id === cita.pacienteId) || (p.nombre?.toLowerCase() === (cita.paciente || cita.pacienteNombre)?.toLowerCase()));
                        if (pac?.id) {
                            navigate('/especialista/expediente/' + pac.id);
                        } else if (cita.pacienteId) {
                            navigate('/especialista/expediente/' + cita.pacienteId);
                        }
                    }}
                    onEnviarWhatsApp={(cita) => {
                        const pac = pacientes.find(p => p.nombre?.toLowerCase() === cita.paciente?.toLowerCase());
                        enviarWhatsAppCita(cita, pac?.telefono || cita.telefono);
                    }}
                    onCambiarStatus={async (citaId, status, extra) => {
                        await updateCitaStatus(citaId, status, extra);
                    }}
                    onNotificarLlegada={handleNotificarLlegada}
                    onNoAsistio={async (citaId) => {
                        if (confirm('¿Marcar que el paciente no asistió?')) {
                            await updateCitaStatus(citaId, 'No Asistió');
                        }
                    }}
                    onCancelarCita={async (citaId) => {
                        if (confirm('¿Cancelar esta cita?')) {
                            await updateCitaStatus(citaId, 'Cancelada');
                        }
                    }}
                    onCompletarCita={async (citaId) => {
                        const cita = citas.find(c => c.id === citaId);
                        if (!cita) return;
                        const tieneMovimientos = await verificarMovimientosExpediente(cita);
                        if (!tieneMovimientos) {
                            const forzar = window.confirm('?? Atención Administrador:\n\nNo se detectaron notas o sesiones registradas en el expediente clínico para esta cita.\n\n¿Deseas completar la cita de todos modos con privilegios de Administrador?');
                            if (!forzar) return;
                        } else {
                            if (!confirm('¿Marcar esta cita como completada?')) return;
                        }
                        try {
                            await updateCitaStatus(citaId, 'Completada', {
                                expedienteCompletadoPorAdmin: !tieneMovimientos,
                                fechaCompletado: new Date().toISOString()
                            });
                        } catch (e) {
                            console.error('Error al completar cita:', e);
                            alert('Error al completar cita: ' + e.message);
                        }
                    }}
                    onSellarVisita={handleSellarDesdeCita}
                    sellandoCitaId={sellandoCitaId}
                    selloMsg={selloMsg}
                    userRole="Administrador"
                />
            ) : viewMode === 'disponibilidad' ? (
                <div className="space-y-6">
                    <Card className="p-10 md:p-16 rounded-[3.5rem] border-none shadow-2xl bg-white/70 backdrop-blur-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-turquesa/5 rounded-full blur-[100px] -mr-48 -mt-48 transition-transform duration-1000 group-hover:scale-110"></div>

                        <div className="relative z-10 space-y-12">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-50 pb-8">
                                <div className="space-y-3">
                                    <h3 className="text-3xl font-black text-acero capitalize">
                                        {format(currentDate, "EEEE d 'de' MMMM", { locale: es })}
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {staff.map(e => {
                                            const isSelected = selectedEspIds.includes(e.id) || selectedEspIds.includes('todos');
                                            return (
                                                <button
                                                    key={e.id}
                                                    onClick={() => {
                                                        setSelectedEspIds(prev => {
                                                            const currentlySelected = prev.includes('todos') ? staff.map(x => x.id) : prev;
                                                            if (currentlySelected.includes(e.id)) {
                                                                const filtered = currentlySelected.filter(id => id !== e.id);
                                                                return filtered.length === 0 ? ['todos'] : filtered;
                                                            }
                                                            return [...currentlySelected, e.id];
                                                        });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${isSelected
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
                                        onClick={() => handleCopyDisponibilidadProfesional(currentDate, getHorasDisponibles(currentDate, selectedEspIds))}
                                        disabled={isCopied}
                                        className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95 min-w-[280px] ${isCopied
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
                                {getHorasDisponibles(currentDate, selectedEspIds).length > 0 ? (
                                    getHorasDisponibles(currentDate, selectedEspIds).map((slot, idx) => (
                                        <div
                                            key={idx}
                                            className="group/slot p-6 bg-gray-50/50 hover:bg-white border-2 border-transparent hover:border-turquesa/20 rounded-3xl transition-all duration-300 text-center relative overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-turquesa opacity-0 group-hover/slot:opacity-[0.02] transition-opacity"></div>
                                            <Clock size={16} className="mx-auto mb-3 text-gray-300 group-hover/slot:text-turquesa transition-colors" />
                                            <span className="text-sm font-black text-acero tracking-tight group-hover/slot:text-turquesa transition-colors">{slot}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-20 text-center">
                                        <XCircle size={48} className="mx-auto mb-4 text-gray-200" />
                                        <p className="text-gray-400 font-bold uppercase tracking-widest">No hay horarios disponibles</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            ) : citasDelDia.length === 0 ? (
                <div className="text-center py-32 bg-white/60 rounded-[3rem] border border-gray-100 shadow-xl">
                    <CalendarIcon size={80} className="mx-auto mb-6 text-gray-200" strokeWidth={1} />
                    <h3 className="text-2xl font-black text-acero opacity-30 uppercase tracking-[0.3em]">Sin Actividad</h3>
                    <p className="text-gray-400 font-bold text-sm mt-3 uppercase tracking-widest">No hay citas para supervisar hoy</p>
                </div>
            ) : (
                <div className="bg-white/60 backdrop-blur-xl rounded-[3rem] shadow-2xl border border-white/60 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 bg-gray-50/30">
                                <tr>
                                    <th className="px-10 py-8 font-black">Paciente / Hora</th>
                                    <th className="px-8 py-8 font-black">Especialista / Servicio</th>
                                    <th className="px-8 py-8 font-black">Estado / Log</th>
                                    <th className="px-10 py-8 font-black text-right">Auditoría</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50/50 text-acero">
                                {citasDelDia.map(cita => (
                                    <tr key={cita.id} className="hover:bg-turquesa/5 transition-all duration-300 group">
                                        <td className="px-10 py-8">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-lg font-black uppercase tracking-tight leading-none group-hover:text-turquesa transition-colors">{cita.paciente}</span>
                                                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-400">
                                                    <span className="flex items-center gap-1.5 text-acero">
                                                        <Clock size={12} /> {cita.horaFormateada || cita.hora}
                                                    </span>
                                                    {cita.telefono && (
                                                        <span className="text-gray-400 font-medium">({cita.telefono})</span>
                                                    )}
                                                    {cita.status === 'En Sala de Espera' && cita.llegadaAt && (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black animate-pulse ${
                                                            getMinutosEspera(cita.llegadaAt) >= 15 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            🔔 Esperando: {getMinutosEspera(cita.llegadaAt)} min
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-8">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-black flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-acero/20"></div> {cita.especialista}
                                                </span>
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{cita.servicio}</span>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                    {cita.cabina && (
                                                        <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
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
                                        <td className="px-8 py-8">
                                            <div className="flex flex-col gap-1.5">
                                                <span className={`w-fit px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusStyles(cita.status)}`}>
                                                    {cita.status}
                                                </span>
                                                {cita.whatsappEnviadoAt && (
                                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-md border border-emerald-200">
                                                        ✓ WhatsApp enviado
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-gray-300 italic flex items-center gap-1.5">
                                                    <History size={12} /> {cita.log}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                                <button onClick={() => handleNotificarLlegada(cita)} className="w-12 h-12 bg-white shadow-xl rounded-2xl text-blue-500 hover:bg-blue-500 hover:text-white transition-all transform active:scale-90 border border-gray-100 flex items-center justify-center" title="Notificar Llegada"><Bell size={20} /></button>

                                                {/* WhatsApp */}
                                                <button
                                                    onClick={(e) => enviarWhatsApp(e, cita)}
                                                    className="w-12 h-12 bg-white shadow-xl rounded-2xl text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all transform active:scale-90 border border-gray-100 flex items-center justify-center"
                                                    title="Enviar WhatsApp"
                                                >
                                                    <MessageCircle size={20} />
                                                </button>

                                                {/* Completar */}
                                                {cita.status !== 'Completada' && cita.status !== 'Cancelada' && cita.status !== 'No Asistió' && (
                                                    <button onClick={() => handleStatusChange(cita.id, 'Completada')} className="w-12 h-12 bg-white shadow-xl rounded-2xl text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all transform active:scale-90 border border-gray-100 flex items-center justify-center" title="Completar"><CheckCircle size={20} /></button>
                                                )}

                                                {/* No Asistió */}
                                                {cita.status !== 'Completada' && cita.status !== 'Cancelada' && cita.status !== 'No Asistió' && (
                                                    <button onClick={() => handleStatusChange(cita.id, 'No Asistió')} className="w-12 h-12 bg-white shadow-xl rounded-2xl text-orange-500 hover:bg-orange-500 hover:text-white transition-all transform active:scale-90 border border-gray-100 flex items-center justify-center" title="No Asistió"><User size={20} /></button>
                                                )}

                                                {/* Cancelar */}
                                                {cita.status !== 'Completada' && cita.status !== 'Cancelada' && cita.status !== 'No Asistió' && (
                                                    <button onClick={() => handleStatusChange(cita.id, 'Cancelada')} className="w-12 h-12 bg-white shadow-xl rounded-2xl text-rose-500 hover:bg-rose-500 hover:text-white transition-all transform active:scale-90 border border-gray-100 flex items-center justify-center" title="Cancelar Cita"><XCircle size={20} /></button>
                                                )}

                                                {/* Reagendar */}
                                                {cita.status !== 'Completada' && cita.status !== 'Cancelada' && (
                                                    <button onClick={() => handleAbrirReagendarRapidoAdmin(cita)} className="w-12 h-12 bg-white shadow-xl rounded-2xl text-turquesa hover:bg-turquesa hover:text-white transition-all transform active:scale-90 border border-gray-100 flex items-center justify-center" title="Reagendar Cita (Fecha y Hora)"><CalendarIcon size={20} /></button>
                                                )}

                                                {/* Eliminar (Solo Admin) */}
                                                <button onClick={() => handleDeleteCita(cita.id)} className="w-12 h-12 bg-white shadow-xl rounded-2xl text-rose-500 hover:bg-rose-500 hover:text-white transition-all transform active:scale-90 border border-gray-100 flex items-center justify-center" title="ELIMINAR"><Trash2 size={20} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL (Diseño Premium) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-acero/70 backdrop-blur-xl p-4 animate-in fade-in duration-500" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-20 duration-700 border border-white/20" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-tr from-acero to-acero/90 p-8 flex justify-between items-center text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-turquesa/10 rounded-full -mr-24 -mt-24 blur-[40px]"></div>
                            <div className="relative z-10">
                                <h3 className="font-black text-2xl tracking-tighter flex items-center gap-3">
                                    <CalendarIcon size={24} className="text-turquesa" />
                                    {editingCita ? 'Editar Cita' : 'Nueva Cita'}
                                </h3>
                                <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em] mt-2 ml-1">Auditoría y Supervisión Admin</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-all transform active:scale-95 border border-white/10"><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-12 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar-agenda">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Paciente con autocompletado */}
                                {!editingCita && (
                                    <div className="relative md:col-span-2 space-y-3">
                                        <label className="text-[10px] font-black text-acero/30 uppercase tracking-[0.3em] px-1">Paciente registrado o nuevo *</label>
                                        <input
                                            type="text"
                                            placeholder="Buscar paciente o escribir nombre..."
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
                                            <div className="absolute z-[70] w-full bg-white border border-gray-100 rounded-[2rem] shadow-2xl top-full mt-2 overflow-hidden backdrop-blur-xl">
                                                {pacientesFiltrados.map(p => (
                                                    <button
                                                        type="button"
                                                        key={p.id}
                                                        className="w-full text-left px-8 py-5 hover:bg-turquesa/5 flex items-center gap-6 border-b border-gray-50 last:border-0 transition-colors"
                                                        onMouseDown={() => {
                                                            setForm(prev => ({ ...prev, pacienteId: p.id, pacienteNombre: p.nombre, telefono: p.telefono || prev.telefono }));
                                                            setPacienteFiltro('');
                                                            setShowSugg(false);
                                                        }}
                                                    >
                                                        <div className="w-12 h-12 rounded-xl bg-turquesa/10 text-turquesa font-black flex items-center justify-center text-xl">{(p.nombre || '?')[0].toUpperCase()}</div>
                                                        <div>
                                                            <p className="font-black text-acero text-lg">{p.nombre}</p>
                                                            <p className="text-xs text-gray-400 font-bold tracking-widest">{p.telefono || 'Sin teléfono'}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {editingCita && (
                                    <div className="md:col-span-2 space-y-3">
                                        <label className="text-[10px] font-black text-acero/30 uppercase tracking-[0.3em] px-1">Paciente</label>
                                        <input className={`${inputCls} bg-gray-100 opacity-50 cursor-not-allowed`} value={form.pacienteNombre} disabled />
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-acero/30 uppercase tracking-[0.3em] px-1">Especialista *</label>
                                    <select
                                        className={inputCls.replace('text-acero', 'text-turquesa')}
                                        value={form.especialistaId}
                                        onChange={e => {
                                            const s = staff.find(s => s.id === e.target.value);
                                            setForm(prev => ({ ...prev, especialistaId: e.target.value, especialistaNombre: s?.nombre || '' }));
                                        }}
                                        required
                                    >
                                        <option value="">— Seleccionar Especialista —</option>
                                        {staff.map(s => <option key={s.id} value={s.id}>{getStaffDisplayTitleAdmin(s.id, s.nombre)}</option>)}
                                    </select>
                                </div>

                                <div className="relative space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-acero/30 uppercase tracking-[0.3em] px-1">Servicios Seleccionados *</label>
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
                                    {(selectedServicios.length > 0 || form.servicio) && (
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {selectedServicios.length > 0 ? (
                                                selectedServicios.map(s => (
                                                    <div 
                                                        key={s.id} 
                                                        className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm shadow-sm border transition-all animate-in fade-in ${
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
                                                                ? (form.citaPagada ? 'bg-emerald-200/60 text-emerald-900' : 'bg-emerald-100 text-emerald-800')
                                                                : 'bg-turquesa/20 text-turquesa'
                                                        }`}>
                                                            {s.esTratamientoActivo && form.citaPagada ? 'Cubierto / Pagado' : `$${s.precio}`}
                                                        </span>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => {
                                                                const filtered = selectedServicios.filter(item => item.id !== s.id);
                                                                setSelectedServicios(filtered);
                                                                const total = filtered.reduce((sum, item) => sum + Number(item.precio), 0);
                                                                setForm(prev => ({ 
                                                                    ...prev, 
                                                                    monto: total.toString(),
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
                                                <div className="bg-turquesa/10 text-turquesa px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm border border-turquesa/20">
                                                    <span>{form.servicio} (${form.monto || '0'})</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setForm(prev => ({ ...prev, servicio: '', monto: '0' }))}
                                                        className="hover:text-red-500 text-gray-400 transition-colors ml-1"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <input 
                                        type="text" 
                                        placeholder={selectedServicios.length > 0 || form.servicio ? "+ Agregar otro servicio adicional..." : "Buscar y agregar tratamiento... (puedes agregar varios)"} 
                                        value={servicioFiltro} 
                                        onChange={e => {
                                            setServicioFiltro(e.target.value);
                                            setShowServSugg(true);
                                        }} 
                                        onFocus={() => setShowServSugg(true)}
                                        onBlur={() => setTimeout(() => setShowServSugg(false), 200)}
                                        className={inputCls} 
                                    />
                                    {showServSugg && servicioFiltro.trim() !== '' && (
                                        <div className="absolute z-[70] w-[320px] md:w-[500px] right-0 bg-white border border-gray-100 rounded-[2.5rem] shadow-2xl top-full mt-2 overflow-hidden backdrop-blur-xl max-h-[400px] overflow-y-auto custom-scrollbar-agenda">
                                            {servicios
                                                .filter(s => s.nombre.toLowerCase().includes(servicioFiltro.toLowerCase().trim()))
                                                .map(s => (
                                                    <button
                                                        type="button"
                                                        key={s.id}
                                                        className="w-full text-left px-6 py-5 hover:bg-turquesa/5 flex items-center gap-5 border-b border-gray-50 last:border-0 transition-colors"
                                                        onMouseDown={() => {
                                                            const alreadySelected = selectedServicios.find(item => item.id === s.id);
                                                            if (alreadySelected) { alert('Este servicio ya fue agregado.'); return; }
                                                            
                                                            const precio = s.precioVenta || s.precio || 0;
                                                            const updated = [...selectedServicios, { id: s.id, nombre: s.nombre, precio }];
                                                            setSelectedServicios(updated);
                                                            
                                                            const total = updated.reduce((sum, item) => sum + Number(item.precio), 0);
                                                            
                                                            setForm(prev => ({ 
                                                                ...prev, 
                                                                monto: total.toString(),
                                                                servicio: updated.map(item => item.nombre).join(', '),
                                                                duracionMin: s.duracionMin || prev.duracionMin || 90
                                                            }));
                                                            
                                                            setServicioFiltro('');
                                                            setShowServSugg(false);
                                                        }}
                                                    >
                                                        <div className="w-10 h-10 rounded-full bg-turquesa/10 flex items-center justify-center font-black text-turquesa">{s.nombre[0]}</div>
                                                        <div>
                                                            <p className="font-semibold text-acero text-sm">{s.nombre}</p>
                                                            <p className="text-xs text-gray-400">${s.precioVenta || s.precio} • {s.duracionMin || 90} min</p>
                                                        </div>
                                                    </button>
                                                ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-turquesa uppercase tracking-[0.3em] px-1 italic">Monto a Cobrar ($) *</label>
                                    <input 
                                        type="number" 
                                        placeholder="0.00" 
                                        value={form.monto} 
                                        onChange={e => setForm(prev => ({ ...prev, monto: e.target.value }))} 
                                        className={`${inputCls} border-turquesa/20 bg-turquesa/5 text-turquesa text-2xl font-black`} 
                                        required 
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-acero/30 uppercase tracking-[0.3em] px-1">¿Es un servicio ya pagado?</label>
                                    <button 
                                        type="button"
                                        onClick={() => setForm(prev => ({ ...prev, citaPagada: !prev.citaPagada }))}
                                        className={`w-full h-14 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all ${form.citaPagada ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                                    >
                                        <CheckCircle size={20} className={form.citaPagada ? 'text-emerald-500' : 'text-gray-400'} />
                                        {form.citaPagada ? 'Servicio ya pagado (Paquete/Anticipo)' : 'No, se cobrará el día de la cita'}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-acero/30 uppercase tracking-[0.3em] px-1">Fecha *</label>
                                    <input type="date" required value={form.fecha} onChange={e => setForm(prev => ({ ...prev, fecha: e.target.value }))} className={inputCls} />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-acero/30 uppercase tracking-[0.3em] px-1">Hora *</label>
                                    <input type="time" required value={form.hora} onChange={e => setForm(prev => ({ ...prev, hora: e.target.value }))} className={inputCls} />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-acero/30 uppercase tracking-[0.3em] px-1">Duración (minutos) *</label>
                                    <input 
                                        type="number" 
                                        placeholder="90" 
                                        value={form.duracionMin} 
                                        onChange={e => setForm(prev => ({ ...prev, duracionMin: e.target.value }))} 
                                        className={inputCls} 
                                        required 
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-acero/30 uppercase tracking-[0.3em] px-1">Cabina / Espacio (Opcional)</label>
                                    <select 
                                        value={form.cabina || ''} 
                                        onChange={e => setForm(prev => ({ ...prev, cabina: e.target.value }))} 
                                        className={inputCls}
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
                                                <p className="text-[11px] font-normal text-rose-700">{form.cabina} ya está ocupada por {conflictoCabina.especialistaNombre || conflictoCabina.especialista} ({conflictoCabina.horaFormateada || conflictoCabina.hora} - {conflictoCabina.servicio}).</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] px-1">Anticipo / Apartado ($)</label>
                                    <input 
                                        type="number" 
                                        placeholder="0.00" 
                                        value={form.anticipo || ''} 
                                        onChange={e => setForm(prev => ({ ...prev, anticipo: e.target.value }))} 
                                        className={inputCls} 
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-acero/30 uppercase tracking-[0.3em] px-1">Teléfono</label>
                                    <input type="tel" value={form.telefono} onChange={e => setForm(prev => ({ ...prev, telefono: e.target.value }))} className={inputCls} />
                                </div>
                            </div>

                            <div className="pt-10 flex flex-col sm:flex-row gap-6">
                                <Button variant="ghost" className="flex-1 h-20 rounded-3xl font-black text-lg text-gray-400" type="button" onClick={() => setIsModalOpen(false)}>Descartar</Button>
                                <Button variant="primary" className="flex-1 h-20 rounded-[2rem] shadow-2xl shadow-turquesa/20 text-xl font-black transform active:scale-95" type="submit" disabled={saving}>
                                    {saving ? <Loader className="animate-spin mr-2" /> : 'Confirmar Cita'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL NUEVO PACIENTE */}
            {isNuevoPacienteModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-acero/70 backdrop-blur-xl p-4 animate-in fade-in" onClick={() => setIsNuevoPacienteModalOpen(false)}>
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-turquesa p-8 text-white">
                            <h3 className="font-black text-2xl">Paciente No Registrado</h3>
                            <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">Completa el alta para continuar</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre Completo</label>
                                <input type="text" value={nuevoPaciente.nombre} onChange={e => setNuevoPaciente({ ...nuevoPaciente, nombre: e.target.value })} className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Teléfono</label>
                                <input type="text" value={nuevoPaciente.telefono} onChange={e => setNuevoPaciente({ ...nuevoPaciente, telefono: e.target.value })} className={inputCls} />
                            </div>
                            <div className="pt-4 flex gap-4">
                                <Button variant="ghost" className="flex-1 h-14 rounded-xl font-black text-gray-400" onClick={() => setIsNuevoPacienteModalOpen(false)}>Cancelar</Button>
                                <Button variant="primary" className="flex-1 h-14 rounded-xl shadow-lg shadow-turquesa/20 font-black" onClick={async () => {
                                    if (!nuevoPaciente.nombre) { alert('El nombre es obligatorio.'); return; }
                                    try {
                                        // 1. Crear Paciente
                                        const docRef = await addDoc(collection(db, 'pacientes'), {
                                            nombre: nuevoPaciente.nombre,
                                            telefono: nuevoPaciente.telefono,
                                            createdAt: new Date().toISOString()
                                        });
                                        
                                        setForm(prev => ({ ...prev, pacienteId: docRef.id, pacienteNombre: nuevoPaciente.nombre, telefono: nuevoPaciente.telefono }));
                                        setIsNuevoPacienteModalOpen(false);

                                        // 2. Validar Precio
                                        const montoNum = Number(form.monto);
                                        if ((form.monto === '' || form.monto === undefined || montoNum === 0) && !form.citaPagada) {
                                            setIsPedirPrecioOpen(true);
                                            return;
                                        }

                                        // 3. Abrir modal de confirmación de duración
                                        setIsConfirmDuracionOpen(true);
                                    } catch (e) {
                                        console.error(e);
                                        alert('Error al procesar la solicitud.');
                                    }
                                }}>Dar de Alta</Button>
                            </div>
                        </div>
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
                                ¿Estás seguro que el tratamiento dura <span className="text-turquesa font-black">{form.duracionMin}</span> minutos?
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
                                    className={inputCls} 
                                />
                            </div>
                            <div className="pt-4 flex gap-4">
                                <Button variant="ghost" className="flex-1 h-14 rounded-xl font-black text-gray-400" onClick={() => setIsPedirPrecioOpen(false)}>Cancelar</Button>
                                <Button variant="primary" className="flex-1 h-14 rounded-xl shadow-lg shadow-turquesa/20 font-black" onClick={() => {
                                    const pNum = Number(precioManual);
                                    if (!precioManual || pNum === 0) { alert('El monto debe ser mayor a cero.'); return; }
                                    setForm(prev => ({ ...prev, monto: precioManual }));
                                    setIsPedirPrecioOpen(false);
                                    setIsConfirmDuracionOpen(true);
                                }}>Confirmar Monto</Button>
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
                                {form.pacienteNombre} tiene tratamientos o paquetes activos en su expediente.
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
                                        onClick={() => handleSeleccionarTratamientoActivoAdmin(trat)}
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
                                                    <span>{getStaffDisplayTitleAdmin(trat.especialistaId, trat.especialistaNombre)}</span>
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
                                    onClick={() => setIsPreguntaTratamientoOpen(false)}
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
                                Paciente: <span className="text-white font-bold">{form.pacienteNombre}</span>
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
                                    onClick={handleConfirmarFinanciamientoSesionAdmin}
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
                <div className="fixed inset-0 z-[75] flex items-center justify-center bg-acero/70 backdrop-blur-xl p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
                        {/* Cabecera */}
                        <div className="bg-gradient-to-r from-turquesa to-teal-700 p-8 text-white relative">
                            <button
                                onClick={() => setCitaAReagendar(null)}
                                className="absolute top-6 right-6 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
                            >
                                <X size={20} />
                            </button>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                    <CalendarIcon size={20} className="text-white" />
                                </span>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Reagendación Rápida</span>
                                    <h3 className="font-black text-2xl leading-none text-white">{citaAReagendar.paciente}</h3>
                                </div>
                            </div>
                            <div className="mt-3 bg-white/10 rounded-xl p-3 text-xs text-white/90 flex flex-wrap items-center gap-3">
                                <span>💆‍♀️ <b>Servicio:</b> {citaAReagendar.servicio}</span>
                                <span>👩‍⚕️ <b>Dr(a):</b> {citaAReagendar.especialista}</span>
                            </div>
                        </div>

                        {/* Formulario enfocado */}
                        <div className="p-8 space-y-6">
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 font-bold flex items-center gap-3">
                                <Clock size={20} className="text-amber-600 flex-shrink-0" />
                                <div>
                                    <span className="font-black uppercase tracking-wide block text-[10px] text-amber-700">Horario Anterior:</span>
                                    <span>{citaAReagendar.fechaYMD ? format(new Date(citaAReagendar.fechaYMD + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es }) : citaAReagendar.fecha} a las {citaAReagendar.horaFormateada || citaAReagendar.hora}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                        ¿Para qué fecha desea reagendar? *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            required
                                            value={reagendarFecha}
                                            onChange={e => setReagendarFecha(e.target.value)}
                                            className="w-full h-14 pl-12 pr-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-acero text-base outline-none focus:border-turquesa focus:bg-white transition-all shadow-sm"
                                        />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-turquesa">
                                            <CalendarIcon size={20} />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                        ¿A qué hora? *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="time"
                                            required
                                            value={reagendarHora}
                                            onChange={e => setReagendarHora(e.target.value)}
                                            className="w-full h-14 pl-12 pr-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-acero text-base outline-none focus:border-turquesa focus:bg-white transition-all shadow-sm"
                                        />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-turquesa">
                                            <Clock size={20} />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                        Cabina / Espacio (Opcional)
                                    </label>
                                    <select
                                        value={reagendarCabina || ''}
                                        onChange={e => setReagendarCabina(e.target.value)}
                                        className="w-full h-14 px-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-acero text-sm outline-none focus:border-turquesa focus:bg-white transition-all shadow-sm"
                                    >
                                        <option value="">Sin cabina fija</option>
                                        {CABINAS_ALFRA.map(c => (
                                            <option key={c.id} value={c.nombre}>{c.nombre}</option>
                                        ))}
                                    </select>
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
                            </div>

                            <div className="pt-2 flex flex-col sm:flex-row gap-3">
                                <Button
                                    variant="ghost"
                                    className="flex-1 h-14 rounded-2xl font-black uppercase text-xs text-gray-400"
                                    onClick={() => setCitaAReagendar(null)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    variant="primary"
                                    className="flex-1 h-14 rounded-2xl font-black uppercase text-xs shadow-xl shadow-turquesa/20"
                                    onClick={handleConfirmarReagendacionRapidaAdmin}
                                    disabled={savingReagendar}
                                >
                                    {savingReagendar ? 'Guardando...' : 'Confirmar Reagendación'}
                                </Button>
                            </div>

                            <div className="text-center pt-1 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const c = citaAReagendar;
                                        setCitaAReagendar(null);
                                        handleOpenModal(c);
                                    }}
                                    className="text-xs text-gray-400 hover:text-turquesa font-bold transition-colors"
                                >
                                    ¿Deseas editar otros datos avanzados (monto, notas, etc.)? Haz clic aquí
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}