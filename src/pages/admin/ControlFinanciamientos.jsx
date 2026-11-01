import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Wallet, Edit3, AlertCircle, AlertTriangle, PlusCircle, Loader, FileText, Printer, Calendar, DollarSign, Download, Share2, Search, Trash2, GitMerge, Sparkles, RefreshCw, ShieldCheck, ArrowUpDown } from 'lucide-react';
import { onPlanesChange, updatePlan, createPlan, deletePlan, fusionarPlanes, detectarPlanesDuplicados, sonTratamientosSimilares } from '../../services/planesService';
import { onPacientesChange, sincronizarTodosLosPacientes, normalizeForMatch } from '../../services/pacientesService';
import { getCitas } from '../../services/citasService';
import { getAllRecibos, createRecibo, deleteRecibo } from '../../services/recibosService';
import html2canvas from 'html2canvas';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { abrirWhatsApp } from '../../services/whatsappService';

export default function ControlFinanciamientos() {
    const { userRole } = useAuth();
    const [sincronizando, setSincronizando] = useState(false);

    const getNombrePacientePlan = (plan) => {
        if (!plan) return 'Paciente';
        if (plan.pacienteId) {
            const p = pacientes.find(x => x.id === plan.pacienteId);
            if (p?.nombre) return p.nombre;
        }
        const cleanTel = (plan.telefono || '').replace(/\D/g, '');
        if (cleanTel && cleanTel.length >= 7) {
            const p = pacientes.find(x => (x.telefono || '').replace(/\D/g, '') === cleanTel);
            if (p?.nombre) return p.nombre;
        }
        const normP = normalizeForMatch(plan.paciente || plan.pacienteNombre || '');
        if (normP) {
            const p = pacientes.find(x => normalizeForMatch(x.nombre) === normP);
            if (p?.nombre) return p.nombre;
        }
        return plan.paciente || plan.pacienteNombre || 'Paciente';
    };

    const handleSincronizarPlanes = async () => {
        if (!window.confirm('?Deseas verificar y sincronizar en cascada todos los paquetes de tratamientos con los pacientes actuales?')) return;
        setSincronizando(true);
        try {
            const res = await sincronizarTodosLosPacientes();
            alert(`?Sincronizaci?n completada con ?xito!\n\nPacientes revisados: ${res.totalPacientes}\nRegistros vinculados actualizados: ${res.totalActualizados}`);
        } catch (e) {
            console.error('Error al sincronizar paquetes:', e);
            alert('Error al sincronizar: ' + (e.message || 'Error desconocido'));
        } finally {
            setSincronizando(false);
        }
    };

    const esAdmin = userRole === 'Administrador';
    const [mostrarDetalleDuplicados, setMostrarDetalleDuplicados] = useState(true);
    const [planes, setPlanes] = useState([]);
    const [pacientes, setPacientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isNuevoOpen, setIsNuevoOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [nuevoSaldo, setNuevoSaldo] = useState('');
    const [nuevaMeta, setNuevaMeta] = useState('');
    const [nuevoAnticipo, setNuevoAnticipo] = useState('');
    const [nuevoCostoSesion, setNuevoCostoSesion] = useState('');
    const [razon, setRazon] = useState('');
    const [saving, setSaving] = useState(false);
    const [nuevoPlan, setNuevoPlan] = useState({ paciente: '', objetivo: '', meta: '' });
    const [numSesiones, setNumSesiones] = useState('');
    const [costoSugerido, setCostoSugerido] = useState(0);
    const [isEstadoCuentaOpen, setIsEstadoCuentaOpen] = useState(false);
    const [citasPlan, setCitasPlan] = useState([]);
    const [recibosPlan, setRecibosPlan] = useState([]);
    const [loadingEstado, setLoadingEstado] = useState(false);
    const [isAbonoPasadoOpen, setIsAbonoPasadoOpen] = useState(false);
    const [montoAbono, setMontoAbono] = useState('');
    const [conceptoAbono, setConceptoAbono] = useState('');
    const [fechaAbono, setFechaAbono] = useState(new Date().toISOString().slice(0, 10));
    const [isNuevaSesionManualOpen, setIsNuevaSesionManualOpen] = useState(false);
    const [fechaSesion, setFechaSesion] = useState(new Date().toISOString().slice(0, 10));
    const [servicioSesion, setServicioSesion] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [deleteType, setDeleteType] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const estadoCuentaRef = useRef(null);

    // Estados para Unificación / Fusión de Planes Duplicados
    const [isFusionModalOpen, setIsFusionModalOpen] = useState(false);
    const [planOrigenFusion, setPlanOrigenFusion] = useState(null);
    const [planDestinoIdFusion, setPlanDestinoIdFusion] = useState('');
    const [eliminarOrigenFusion, setEliminarOrigenFusion] = useState(true);
    const [savingFusion, setSavingFusion] = useState(false);

    // Estados para Eliminación directa de Plan Vacío / Erróneo
    const [isDeletePlanModalOpen, setIsDeletePlanModalOpen] = useState(false);
    const [planToDelete, setPlanToDelete] = useState(null);
    const [deletingPlan, setDeletingPlan] = useState(false);

    // Auditoría de tratamientos duplicados exclusiva para el Administrador
    const pacientesConDuplicados = useMemo(() => {
        if (!esAdmin) return [];
        return detectarPlanesDuplicados(planes);
    }, [planes, esAdmin]);

    const handleDownloadPNG = async () => {
        if (!estadoCuentaRef.current) return;
        setIsCapturing(true);
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
            const canvas = await html2canvas(estadoCuentaRef.current, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
            });
            const base64Image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `Estado_Cuenta_${selectedPlan?.paciente || 'Paciente'}.png`;
            link.href = base64Image;
            link.click();
        } catch (error) {
            console.error('Error generando PNG:', error);
            alert('Error al generar la imagen.');
        } finally {
            setIsCapturing(false);
        }
    };

    const handleShareWA = () => {
        if (!selectedPlan) return;
        const texto = `¡Hola ${selectedPlan.paciente}! 👋\n\nLe compartimos su Estado de Cuenta de su Paquete de Tratamiento (${selectedPlan.objetivo}).\n\nMeta Total: $${selectedPlan.meta?.toLocaleString('es-MX')}\nAcumulado: $${selectedPlan.acumulado?.toLocaleString('es-MX')}\nRestante: $${selectedPlan.faltante?.toLocaleString('es-MX')}\n\n¡Lindo día! ✨`;
        abrirWhatsApp(selectedPlan.telefono, texto);
    };

    useEffect(() => {
        const unsub = onPlanesChange((data) => {
            const normalized = data.map(p => ({
                ...p,
                faltante: Math.max(0, (Number(p.meta) || 0) - (Number(p.acumulado) || 0)),
            }));
            setPlanes(normalized);
            setLoading(false);
        });

        const unsubPac = onPacientesChange((data) => {
            setPacientes(data.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')));
        });

        return () => {
            unsub();
            unsubPac();
        };
    }, []);

    useEffect(() => {
        const meta = parseFloat(nuevaMeta) || 0;
        const sesiones = parseInt(numSesiones) || 0;
        
        if (meta > 0) {
            const anticipo = meta * 0.20;
            setNuevoAnticipo(anticipo.toString());
            
            if (sesiones > 0) {
                const sugerido = (meta - anticipo) / sesiones;
                setNuevoCostoSesion(sugerido.toFixed(2));
                setCostoSugerido(sugerido);
            } else {
                setNuevoCostoSesion('');
                setCostoSugerido(0);
            }
        }
    }, [nuevaMeta, numSesiones]);

    const formatCurrency = (amount) => `$${Number(amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

    const handleOpenModal = (plan) => {
        setSelectedPlan(plan);
        setNuevoSaldo(plan.acumulado);
        setNuevaMeta(plan.meta || '');
        setNuevoAnticipo(plan.anticipo || '');
        setNuevoCostoSesion(plan.costoPorSesion || '');
        setRazon('');
        setIsModalOpen(true);
    };

    const handleOpenAbonoPasado = (plan) => {
        setSelectedPlan(plan);
        setMontoAbono('');
        setConceptoAbono(plan.objetivo || '');
        setFechaAbono(new Date().toISOString().slice(0, 10));
        setIsAbonoPasadoOpen(true);
    };

    const handleGuardarAbonoPasado = async () => {
        if (!montoAbono || !conceptoAbono) { alert('Completa los campos.'); return; }
        setSaving(true);
        try {
            const montoNum = parseFloat(montoAbono);
            
            // 1. Crear recibo vinculando pacienteId
            const pacEncontrado = (pacientes || []).find(p => (p.nombre || '').trim().toLowerCase() === (selectedPlan.paciente || '').trim().toLowerCase());
            await createRecibo({
                pacienteId: selectedPlan.pacienteId || pacEncontrado?.id || null,
                pacienteNombre: selectedPlan.paciente,
                concepto: conceptoAbono,
                monto: montoNum,
                metodoPago: 'Abono Histórico',
                paqueteInfo: selectedPlan.objetivo,
                telefono: pacEncontrado?.telefono || '',
                fecha: new Date(fechaAbono).toISOString(),
            });

            // 2. Actualizar acumulado en el plan
            const nuevoAcumulado = (parseFloat(selectedPlan.acumulado) || 0) + montoNum;
            await updatePlan(selectedPlan.id, {
                acumulado: nuevoAcumulado,
                morosidad: nuevoAcumulado < (parseFloat(selectedPlan.meta) * 0.1),
            });

            setIsAbonoPasadoOpen(false);
            alert('Abono registrado exitosamente.');
        } catch (err) {
            alert('Error al registrar abono: ' + (err.message || err));
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAbono = async (reciboId, monto) => {
        setLoadingEstado(true);
        try {
            // 1. Eliminar recibo
            await deleteRecibo(reciboId);
            
            // 2. Actualizar plan
            const nuevoAcumulado = (parseFloat(selectedPlan.acumulado) || 0) - parseFloat(monto);
            await updatePlan(selectedPlan.id, {
                acumulado: nuevoAcumulado,
                morosidad: nuevoAcumulado < (parseFloat(selectedPlan.meta) * 0.1),
            });
            
            // 3. Recargar datos del estado de cuenta
            await handleVerEstadoCuenta(selectedPlan);
            alert('Abono eliminado correctamente.');
        } catch (error) {
            console.error("Error al eliminar abono:", error);
            alert("Error al eliminar el abono.");
        } finally {
            setLoadingEstado(false);
        }
    };

    const handleGuardarSesionManual = async () => {
        if (!fechaSesion || !servicioSesion) { alert('Completa los campos.'); return; }
        setSaving(true);
        try {
            const nuevaSesion = { 
                fecha: fechaSesion + 'T12:00:00', 
                servicio: servicioSesion, 
                id: Math.random().toString(36).substr(2, 9) 
            };
            const sesionesActuales = selectedPlan.sesionesManuales || [];
            await updatePlan(selectedPlan.id, {
                sesionesManuales: [...sesionesActuales, nuevaSesion]
            });
            setIsNuevaSesionManualOpen(false);
            setFechaSesion(new Date().toISOString().slice(0, 10));
            setServicioSesion('');
            
            const planActualizado = { 
                ...selectedPlan, 
                sesionesManuales: [...sesionesActuales, nuevaSesion] 
            };
            setSelectedPlan(planActualizado);
            
            await handleVerEstadoCuenta(planActualizado);
            alert('Sesión registrada exitosamente.');
        } catch (err) {
            alert('Error al registrar sesión.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSesionManual = async (cita) => {
        console.log("Intentando eliminar sesión:", cita);
        setLoadingEstado(true);
        try {
            const sesionesActuales = selectedPlan.sesionesManuales || [];
            console.log("Sesiones actuales antes de filtrar:", sesionesActuales);
            const sesionesFiltradas = sesionesActuales.filter(s => {
                if (s.id && cita.id) return s.id !== cita.id;
                // Fallback: si no tienen ID, comparamos fecha (solo día) y servicio
                const dateS = s.fecha ? s.fecha.split('T')[0] : '';
                const dateC = cita.fechaHora ? cita.fechaHora.split('T')[0] : '';
                return !(dateS === dateC && s.servicio === cita.servicio);
            });
            await updatePlan(selectedPlan.id, {
                sesionesManuales: sesionesFiltradas
            });
            
            const planActualizado = { 
                ...selectedPlan, 
                sesionesManuales: sesionesFiltradas 
            };
            setSelectedPlan(planActualizado);
            
            await handleVerEstadoCuenta(planActualizado);
            alert('Sesión eliminada correctamente.');
        } catch (error) {
            console.error("Error al eliminar sesión:", error);
            alert("Error al eliminar la sesión.");
        } finally {
            setLoadingEstado(false);
        }
    };

    const handleConfirmDelete = async () => {
        setIsConfirmDeleteOpen(false);
        if (deleteType === 'sesion') {
            await handleDeleteSesionManual(itemToDelete);
        } else if (deleteType === 'abono') {
            await handleDeleteAbono(itemToDelete.id, itemToDelete.monto);
        }
    };

    const handleOpenConfirmDelete = (type, item) => {
        setDeleteType(type);
        setItemToDelete(item);
        setIsConfirmDeleteOpen(true);
    };

    const handleOpenFusionModal = (planOrigen, planDestino = null) => {
        setPlanOrigenFusion(planOrigen);
        if (planDestino) {
            setPlanDestinoIdFusion(planDestino.id);
        } else {
            const otros = planes.filter(p => 
                p.id !== planOrigen.id && 
                (p.paciente || '').trim().toLowerCase() === (planOrigen.paciente || '').trim().toLowerCase()
            );
            const coincidente = otros.find(p => sonTratamientosSimilares(planOrigen.objetivo, p.objetivo));
            if (coincidente) {
                setPlanDestinoIdFusion(coincidente.id);
            } else if (otros.length === 1) {
                setPlanDestinoIdFusion(otros[0].id);
            } else {
                setPlanDestinoIdFusion('');
            }
        }
        setEliminarOrigenFusion(true);
        setIsFusionModalOpen(true);
    };

    const handleSwapFusionRoles = () => {
        if (!planOrigenFusion || !planDestinoIdFusion) return;
        const currentDestino = planes.find(p => p.id === planDestinoIdFusion);
        if (!currentDestino) return;
        const newDestinoId = planOrigenFusion.id;
        setPlanOrigenFusion(currentDestino);
        setPlanDestinoIdFusion(newDestinoId);
    };

    const handleConfirmFusion = async () => {
        if (!planOrigenFusion || !planDestinoIdFusion) {
            alert('Por favor selecciona el paquete destino al que deseas transferir el saldo.');
            return;
        }
        const planDestino = planes.find(p => p.id === planDestinoIdFusion);
        if (!planDestino) {
            alert('Paquete destino no encontrado.');
            return;
        }

        setSavingFusion(true);
        try {
            const res = await fusionarPlanes({
                planOrigenId: planOrigenFusion.id,
                planDestinoId: planDestinoIdFusion,
                eliminarOrigen: eliminarOrigenFusion,
                motivo: `Unificación realizada desde Paquetes de Tratamientos`
            });

            alert(`✅ ¡Paquetes unificados con éxito!\n\n• Saldo transferido: $${Number(res.saldoTransferido || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} al paquete "${res.planDestinoNombre}".\n• 🛡️ Expediente clínico intacto: Se traspasaron todas las sesiones previas, fotografías, medidas y notas médicas sin pérdida de datos.`);
            setIsFusionModalOpen(false);
            setPlanOrigenFusion(null);
            setPlanDestinoIdFusion('');
        } catch (err) {
            console.error('Error al fusionar planes:', err);
            alert('Error al unificar los planes: ' + (err.message || err));
        } finally {
            setSavingFusion(false);
        }
    };

    const handleOpenDeletePlan = (plan) => {
        setPlanToDelete(plan);
        setIsDeletePlanModalOpen(true);
    };

    const handleConfirmDeletePlan = async () => {
        if (!planToDelete) return;
        setDeletingPlan(true);
        try {
            await deletePlan(planToDelete.id);
            alert(`El paquete "${planToDelete.objetivo}" de ${planToDelete.paciente} fue eliminado.`);
            setIsDeletePlanModalOpen(false);
            setPlanToDelete(null);
        } catch (err) {
            console.error('Error al eliminar plan:', err);
            alert('Error al eliminar el paquete: ' + (err.message || err));
        } finally {
            setDeletingPlan(false);
        }
    };

    const handleVerEstadoCuenta = async (plan) => {
        setSelectedPlan(plan);
        setLoadingEstado(true);
        setIsEstadoCuentaOpen(true);
        try {
            // Fetch citas
            const allCitas = await getCitas();
            const filteredCitas = allCitas.filter(c => 
                c.pacienteNombre === plan.paciente && 
                c.status === 'Completada' &&
                (c.servicio?.toLowerCase().includes(plan.objetivo?.toLowerCase()) || 
                 c.motivo?.toLowerCase().includes(plan.objetivo?.toLowerCase()))
            );
            
            const manuales = plan.sesionesManuales || [];
            const combinadas = [
                ...filteredCitas, 
                ...manuales.map(s => ({ 
                    fechaHora: s.fecha, 
                    servicio: s.servicio, 
                    status: 'Completada', 
                    isManual: true, 
                    id: s.id 
                }))
            ];
            
            combinadas.sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));
            
            setCitasPlan(combinadas);

            // Fetch recibos
            const allRecibos = await getAllRecibos();
            const nomResuelto = getNombrePacientePlan(plan);
            const nNormTarget = normalizeForMatch(nomResuelto);
            const nNormPlan = normalizeForMatch(plan.paciente);

            const filteredRecibos = allRecibos.filter(r => {
                const matchId = (plan.pacienteId && r.pacienteId && String(plan.pacienteId) === String(r.pacienteId));
                const rNorm = normalizeForMatch(r.pacienteNombre || r.paciente || '');
                const matchName = rNorm && (rNorm === nNormTarget || rNorm === nNormPlan || (nNormTarget && rNorm.includes(nNormTarget)) || (nNormTarget && nNormTarget.includes(rNorm)));
                if (!matchId && !matchName) return false;

                return (
                    r.concepto?.toLowerCase().includes(plan.objetivo?.toLowerCase()) || 
                    r.paqueteInfo?.toLowerCase().includes(plan.objetivo?.toLowerCase()) ||
                    r.isPlanTratamiento
                );
            });
            setRecibosPlan(filteredRecibos);
        } catch (error) {
            console.error("Error al cargar estado de cuenta:", error);
            alert("Error al cargar los datos del estado de cuenta.");
        } finally {
            setLoadingEstado(false);
        }
    };

    const handleAplicarAjuste = async () => {
        if (!razon) { alert('Ingresa la razón del ajuste.'); return; }
        setSaving(true);
        try {
            await updatePlan(selectedPlan.id, {
                meta: parseFloat(nuevaMeta) || 0,
                anticipo: parseFloat(nuevoAnticipo) || 0,
                costoPorSesion: parseFloat(nuevoCostoSesion) || 0,
                acumulado: parseFloat(nuevoSaldo) || 0,
                ultimoAjuste: razon,
                morosidad: parseFloat(nuevoSaldo) < (parseFloat(nuevaMeta) * 0.1),
            });
            setIsModalOpen(false);
        } catch (err) {
            alert('Error al aplicar ajuste: ' + (err.message || err));
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleCrearPlan = async () => {
        if (!nuevoPlan.paciente || !nuevoPlan.meta) { alert('Completa los campos.'); return; }
        setSaving(true);
        try {
            const pacEncontrado = pacientes.find(p => (p.nombre || '').trim().toLowerCase() === nuevoPlan.paciente.trim().toLowerCase());
            await createPlan({
                paciente: pacEncontrado?.nombre || nuevoPlan.paciente,
                pacienteNombre: pacEncontrado?.nombre || nuevoPlan.paciente,
                pacienteId: pacEncontrado?.id || null,
                telefono: pacEncontrado?.telefono || '',
                objetivo: nuevoPlan.objetivo,
                meta: parseFloat(nuevoPlan.meta),
                acumulado: 0
            });
            setIsNuevoOpen(false);
            setNuevoPlan({ paciente: '', objetivo: '', meta: '' });
        } catch (err) {
            alert('Error al crear plan.'); console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-acero">Paquetes de Tratamientos</h2>
                    <p className="text-gray-500 text-sm">Supervisión de metas a pago de pacientes, condonaciones y ajustes de saldos</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        icon={RefreshCw}
                        disabled={sincronizando}
                        onClick={handleSincronizarPlanes}
                        className="text-xs font-bold border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100"
                    >
                        {sincronizando ? 'Sincronizando...' : 'Sincronizar Nombres'}
                    </Button>
                    <Button variant="primary" icon={PlusCircle} onClick={() => setIsNuevoOpen(true)}>Nuevo Plan</Button>
                </div>
            </div>

            {/* ALERTA EXCLUSIVA PARA EL ADMINISTRADOR: DETECCIÓN DE TRATAMIENTOS DUPLICADOS */}
            {esAdmin && pacientesConDuplicados.length > 0 && (
                <div className="p-5 bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border-2 border-amber-300 rounded-3xl shadow-sm space-y-4 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-md">
                                        Auditoría Exclusiva Administrador
                                    </span>
                                    <h4 className="font-black text-base text-amber-950">
                                        {pacientesConDuplicados.length === 1 
                                            ? '1 Paciente con Tratamientos Duplicados Detectado' 
                                            : `${pacientesConDuplicados.length} Pacientes con Tratamientos Duplicados Detectados`}
                                    </h4>
                                </div>
                                <p className="text-xs text-amber-800 mt-0.5">
                                    Los tratamientos duplicados se agrupan estrictamente por tipo de servicio. Unifica con 1 clic para dejar limpio el historial sin mezclar tratamientos diferentes.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMostrarDetalleDuplicados(!mostrarDetalleDuplicados)}
                            className="self-start sm:self-auto text-xs font-black text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 px-3.5 py-2 rounded-xl transition-all shadow-sm"
                        >
                            {mostrarDetalleDuplicados ? 'Ocultar Detalle' : `Ver Lista (${pacientesConDuplicados.length})`}
                        </button>
                    </div>

                    {mostrarDetalleDuplicados && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-amber-200">
                            {pacientesConDuplicados.map((item, idx) => (
                                <div key={idx} className="p-4 bg-white/95 border border-amber-200/90 rounded-2xl space-y-3 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-black text-xs">
                                                {item.paciente[0]}
                                            </div>
                                            <span className="font-black text-sm text-acero">{item.paciente}</span>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-lg">
                                            {item.grupos.length} {item.grupos.length === 1 ? 'tratamiento duplicado' : 'tratamientos duplicados'}
                                        </span>
                                    </div>

                                    {/* Listado por tratamientos aislados */}
                                    <div className="space-y-3">
                                        {item.grupos.map((grp) => (
                                            <div key={grp.idGrupo} className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-black text-amber-950 flex items-center gap-1.5">
                                                        <Sparkles size={13} className="text-amber-600" />
                                                        {grp.nombreTratamiento}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-amber-800 bg-white px-2 py-0.5 rounded-md border border-amber-200">
                                                        {grp.planes.length} paquetes
                                                    </span>
                                                </div>

                                                <div className="space-y-1.5">
                                                    {grp.planes.map(p => {
                                                        const esSugeridoMaestro = grp.planMaestroSugerido?.id === p.id;
                                                        return (
                                                            <div key={p.id} className={`text-xs flex items-center justify-between px-3 py-2 rounded-xl border ${esSugeridoMaestro ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' : 'bg-white border-gray-100 text-gray-700'}`}>
                                                                <div className="truncate max-w-[170px]">
                                                                    <span className="font-bold">{p.objetivo}</span>
                                                                    {esSugeridoMaestro && (
                                                                        <span className="ml-1.5 text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                                                            Destino Sugerido
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[11px] text-gray-500 font-medium">
                                                                    Meta: <strong className="text-acero">{formatCurrency(p.meta)}</strong> | Acum: <strong className="text-turquesa">{formatCurrency(p.acumulado)}</strong>
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenFusionModal(grp.planDuplicadoSugerido, grp.planMaestroSugerido)}
                                                    className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-indigo-200 mt-2"
                                                >
                                                    <GitMerge size={13} /> Unificar {grp.nombreTratamiento}
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setBusqueda(item.paciente.split(' ')[0]);
                                                window.scrollTo({ top: 350, behavior: 'smooth' });
                                            }}
                                            className="w-full py-1.5 px-3 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <Search size={12} /> Ver historial completo de {item.paciente.split(' ')[0]}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Buscar paciente o tratamiento..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-turquesa/20 transition-all text-sm" />
                </div>
                <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                    <button onClick={() => setFiltroEstado('todos')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filtroEstado === 'todos' ? 'bg-white text-acero shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Todos</button>
                    <button onClick={() => setFiltroEstado('activos')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filtroEstado === 'activos' ? 'bg-white text-acero shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Activos</button>
                    <button onClick={() => setFiltroEstado('inactivos')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filtroEstado === 'inactivos' ? 'bg-white text-acero shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Inactivos</button>
                </div>
            </div>

            <Card>
                {loading ? (
                    <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
                        <Loader size={24} className="animate-spin text-turquesa" />
                        <span className="text-sm">Cargando planes desde Firebase...</span>
                    </div>
                ) : planes.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <Wallet size={40} className="mx-auto mb-3 text-gray-300" />
                        <p className="font-medium">Sin planes registrados aún</p>
                        <p className="text-sm">Haz clic en "Nuevo Plan" para agregar el primer financiamiento.</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {planes
                            .filter(plan => {
                                const q = busqueda.toLowerCase();
                                const nomPlanActual = getNombrePacientePlan(plan);
                                const matchesSearch = !q || (plan.paciente || '').toLowerCase().includes(q) || nomPlanActual.toLowerCase().includes(q) || (plan.objetivo || '').toLowerCase().includes(q);
                                
                                const matchesFilter = filtroEstado === 'todos' || 
                                    (filtroEstado === 'activos' && plan.activo !== false) || 
                                    (filtroEstado === 'inactivos' && plan.activo === false);
                                
                                return matchesSearch && matchesFilter;
                            })
                            .map((plan) => (
                            <div key={plan.id} className="p-3.5 sm:p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-turquesa/10 text-turquesa flex items-center justify-center font-black shrink-0 mt-0.5 sm:mt-0">
                                            {(getNombrePacientePlan(plan) || '?')[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-800 text-sm sm:text-base leading-tight break-words">{getNombrePacientePlan(plan)}</p>
                                            <p className="text-xs text-gray-500 font-normal flex items-center gap-1 mt-1">
                                                <Wallet size={12} className="text-turquesa shrink-0" /> <span className="truncate">{plan.objetivo}</span>
                                            </p>
                                            <div className="text-xs text-gray-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                <span>Meta: <strong className="text-acero">{formatCurrency(plan.meta)}</strong></span>
                                                <span>•</span>
                                                <span>Acumulado: <strong className="text-turquesa">{formatCurrency(plan.acumulado)}</strong></span>
                                                <span>•</span>
                                                <span className="text-amber-700 font-bold">Falta: {formatCurrency(plan.faltante)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-end w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-gray-100">
                                        <button
                                            onClick={async () => {
                                                const nuevoEstado = plan.activo !== false ? false : true;
                                                try {
                                                    await updatePlan(plan.id, { activo: nuevoEstado });
                                                } catch (err) {
                                                    console.error(err);
                                                    alert('Error al actualizar estado del plan');
                                                }
                                            }}
                                            title={plan.activo !== false ? "Desactivar Plan" : "Activar Plan"}
                                            className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95"
                                            style={{ 
                                                background: plan.activo !== false ? 'linear-gradient(135deg, #20B2AA, #0d8a85)' : '#F3F4F6',
                                                border: plan.activo !== false ? 'none' : '1px solid #E5E7EB'
                                            }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={plan.activo !== false ? "white" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                                        </button>
                                        <Button variant="outline" size="xs" icon={FileText} onClick={() => handleVerEstadoCuenta(plan)}>Edo. Cta</Button>
                                        <Button variant="outline" size="xs" icon={DollarSign} onClick={() => handleOpenAbonoPasado(plan)}>Abono</Button>
                                        <Button variant="outline" size="xs" icon={Edit3} onClick={() => handleOpenModal(plan)}>Ajustar</Button>
                                        <Button 
                                            variant="outline" 
                                            size="xs" 
                                            icon={GitMerge} 
                                            onClick={() => handleOpenFusionModal(plan)}
                                            className="border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 hover:border-indigo-300 font-bold"
                                            title="Unificar saldo con otro paquete de este paciente"
                                        >
                                            Unificar
                                        </Button>
                                        <button
                                            onClick={() => handleOpenDeletePlan(plan)}
                                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-gray-200 hover:border-rose-200"
                                            title="Eliminar este paquete"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Modal ajuste de saldo */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`Ajuste de Saldo Maestro: ${getNombrePacientePlan(selectedPlan)}`}
                footer={
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleAplicarAjuste} disabled={saving}>
                            {saving ? 'Guardando...' : 'Aplicar Ajuste en Firebase'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-start gap-3">
                        <AlertCircle className="text-green-500 flex-shrink-0" />
                        <p className="text-xs text-green-700">Ajuste de Historial: Estos cambios son solo para corregir el estado de cuenta y generar recibos. No generan ingresos en caja ni afectan la contabilidad diaria.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Costo Total del Paquete (Meta) ($)</label>
                            <input type="number" className="w-full p-3 border rounded-xl text-sm" value={nuevaMeta} onChange={e => setNuevaMeta(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Número de Sesiones</label>
                            <input type="number" className="w-full p-3 border rounded-xl text-sm" value={numSesiones} onChange={e => setNumSesiones(e.target.value)} placeholder="Ej. 10" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Anticipo (Sugerido 20%) ($)</label>
                            <input type="number" className="w-full p-3 border rounded-xl text-sm" value={nuevoAnticipo} onChange={e => setNuevoAnticipo(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Costo Por Sesión ($)</label>
                            <input type="number" className="w-full p-3 border rounded-xl text-sm" value={nuevoCostoSesion} onChange={e => setNuevoCostoSesion(e.target.value)} />
                            {costoSugerido > 0 && <span className="text-[10px] text-gray-400">Sugerido: {formatCurrency(costoSugerido)}</span>}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Saldo Acumulado Actual ($)</label>
                        <input type="number" className="w-full p-3 border rounded-xl text-sm" value={nuevoSaldo} onChange={e => setNuevoSaldo(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Razón / Concepto del Ajuste</label>
                        <input className="w-full p-3 border rounded-xl text-sm" placeholder="Ej. Actualización de paquete clínico" value={razon} onChange={e => setRazon(e.target.value)} />
                    </div>
                </div>
            </Modal>

            {/* Modal nuevo plan */}
            {isNuevoOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
                        <h3 className="text-lg font-bold text-acero">Nuevo Plan de Tratamiento</h3>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Nombre del Paciente</label>
                            <select 
                                className="w-full mt-1 p-3 border rounded-xl text-sm" 
                                value={nuevoPlan.paciente} 
                                onChange={e => setNuevoPlan(prev => ({ ...prev, paciente: e.target.value }))}
                            >
                                <option value="">— Seleccionar Paciente —</option>
                                {pacientes.map(p => (
                                    <option key={p.id} value={p.nombre}>{p.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Objetivo / Tratamiento</label>
                            <input className="w-full mt-1 p-3 border rounded-xl text-sm" placeholder="Ej. Lipoescultura HD" value={nuevoPlan.objetivo} onChange={e => setNuevoPlan(prev => ({ ...prev, objetivo: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Meta Total ($)</label>
                            <input type="number" className="w-full mt-1 p-3 border rounded-xl text-sm" value={nuevoPlan.meta} onChange={e => setNuevoPlan(prev => ({ ...prev, meta: e.target.value }))} />
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setIsNuevoOpen(false)} className="flex-1">Cancelar</Button>
                            <Button variant="primary" onClick={handleCrearPlan} disabled={saving} className="flex-1">{saving ? 'Guardando...' : 'Crear Plan'}</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Abono Pasado */}
            <Modal
                isOpen={isAbonoPasadoOpen}
                onClose={() => setIsAbonoPasadoOpen(false)}
                title={`Registrar Abono Pasado: ${getNombrePacientePlan(selectedPlan)}`}
                footer={
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsAbonoPasadoOpen(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleGuardarAbonoPasado} disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar Abono'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                        <AlertCircle className="text-amber-500 flex-shrink-0" />
                        <p className="text-xs text-amber-700">Este abono se registrará con fines de historial y estado de cuenta. **No afectará la contabilidad ni la caja de hoy**.</p>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Monto del Abono ($)</label>
                        <input type="number" className="w-full p-3 border rounded-xl text-sm" value={montoAbono} onChange={e => setMontoAbono(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Concepto</label>
                        <input className="w-full p-3 border rounded-xl text-sm" value={conceptoAbono} onChange={e => setConceptoAbono(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Fecha del Pago</label>
                        <input type="date" className="w-full p-3 border rounded-xl text-sm" value={fechaAbono} onChange={e => setFechaAbono(e.target.value)} />
                    </div>
                </div>
            </Modal>


            <Modal
                isOpen={isEstadoCuentaOpen}
                onClose={() => setIsEstadoCuentaOpen(false)}
                title={`Estado de Cuenta: ${getNombrePacientePlan(selectedPlan)}`}
            >
                {loadingEstado ? (
                    <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
                        <Loader size={24} className="animate-spin text-turquesa" />
                        <span className="text-sm">Cargando historial...</span>
                    </div>
                ) : (
                    <div className="max-h-[70vh] overflow-y-auto">
                        <div ref={estadoCuentaRef} className="space-y-6 p-6 bg-white">
                            {/* Encabezado estilo Recibo */}
                            <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
                            <img src="/logo.png" alt="ALFRA" className="h-28 mx-auto mb-2 object-contain" />
                            <h3 className="text-sm font-bold text-acero uppercase tracking-wider">Estado de Cuenta</h3>
                            <p className="text-xs text-gray-500">{selectedPlan?.objetivo}</p>
                        </div>

                        {/* Resumen de Saldos */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 grid grid-cols-3 gap-2 text-center">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Meta Total</p>
                                <p className="text-sm font-bold text-acero">{formatCurrency(selectedPlan?.meta)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Acumulado</p>
                                <p className="text-sm font-bold text-turquesa">{formatCurrency(selectedPlan?.acumulado)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Restante</p>
                                <p className="text-sm font-bold text-red-500">{formatCurrency(selectedPlan?.faltante)}</p>
                            </div>
                        </div>

                        {/* Citas Tomadas */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                                    <Calendar size={14} /> Citas Tomadas ({citasPlan.length})
                                </h4>
                                {!isCapturing && (
                                    <button 
                                        onClick={() => {
                                            setServicioSesion(selectedPlan?.objetivo || '');
                                            setFechaSesion(new Date().toISOString().slice(0, 10));
                                            setIsNuevaSesionManualOpen(true);
                                        }}
                                        className="p-1 text-turquesa hover:bg-turquesa/10 rounded-full transition-all"
                                        title="Registrar Sesión Manual"
                                    >
                                        <PlusCircle size={16} />
                                    </button>
                                )}
                            </div>
                            {citasPlan.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">No hay citas registradas como completadas.</p>
                            ) : (
                                <div className="space-y-2">
                                    {citasPlan.map((cita, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-gray-100 text-xs">
                                            <div>
                                                <p className="font-medium text-gray-800">
                                                    {new Date(cita.fechaHora).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    {cita.isManual && !isCapturing && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">Manual</span>}
                                                </p>
                                                <p className="text-gray-500">{cita.servicio || 'Servicio'}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={cita.isManual ? 'outline' : 'green'}>Completada</Badge>
                                                {cita.isManual && !isCapturing && (
                                                    <button 
                                                        onClick={() => handleOpenConfirmDelete('sesion', cita)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Eliminar Sesión"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Abonos Realizados */}
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                <DollarSign size={14} /> Abonos Realizados ({recibosPlan.length})
                            </h4>
                            {recibosPlan.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">No hay abonos registrados.</p>
                            ) : (
                                <div className="space-y-2">
                                    {recibosPlan.map((recibo, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-gray-100 text-xs">
                                            <div>
                                                <p className="font-medium text-gray-800">{new Date(recibo.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                <p className="text-gray-500">{recibo.concepto || 'Abono'}</p>
                                                <p className="text-[10px] text-gray-400">{recibo.metodoPago}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-turquesa">{formatCurrency(recibo.monto)}</p>
                                                {!isCapturing && (
                                                    <button 
                                                        onClick={() => handleOpenConfirmDelete('abono', recibo)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Eliminar Abono"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Pie de ticket */}
                            <div className="text-center border-t border-dashed border-gray-300 pt-4 mt-4">
                                <p className="text-xs text-gray-500 font-italic">"Gracias por tu confianza en Clínica ALFRA"</p>
                            </div>
                        </div>

                        {/* Botones fuera del ref para que no salgan en la foto */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100 p-4 bg-gray-50 rounded-b-2xl">
                            <Button variant="primary" fullWidth icon={Download} onClick={handleDownloadPNG}>
                                Descargar PNG
                            </Button>
                            <Button variant="outline" fullWidth icon={Share2} onClick={handleShareWA} className="border-green-500 text-green-600 hover:bg-green-50">
                                Compartir WA
                            </Button>
                            <Button variant="ghost" onClick={() => setIsEstadoCuentaOpen(false)}>
                                Cerrar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal Sesión Manual */}
            <Modal
                isOpen={isNuevaSesionManualOpen}
                onClose={() => setIsNuevaSesionManualOpen(false)}
                title={`Registrar Sesión Manual: ${selectedPlan?.paciente}`}
                footer={
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsNuevaSesionManualOpen(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleGuardarSesionManual} disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar Sesión'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                        <AlertCircle className="text-blue-500 flex-shrink-0" />
                        <p className="text-xs text-blue-700">Esta sesión se registrará solo para el historial de este paquete. **No afectará la agenda ni el calendario**.</p>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Tratamiento / Servicio</label>
                        <input className="w-full p-3 border rounded-xl text-sm" value={servicioSesion} onChange={e => setServicioSesion(e.target.value)} placeholder="Ej. Depilación láser" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Fecha de la Sesión</label>
                        <input type="date" className="w-full p-3 border rounded-xl text-sm" value={fechaSesion} onChange={e => setFechaSesion(e.target.value)} />
                    </div>
                </div>
            </Modal>

            {/* MODAL DE UNIFICACIÓN / FUSIÓN DE PLANES DUPLICADOS */}
            <Modal
                isOpen={isFusionModalOpen}
                onClose={() => { if (!savingFusion) setIsFusionModalOpen(false); }}
                title="Unificar / Fusionar Paquete de Tratamiento"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsFusionModalOpen(false)} disabled={savingFusion}>
                            Cancelar
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={handleConfirmFusion} 
                            disabled={savingFusion || !planDestinoIdFusion}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 shadow-lg shadow-indigo-200"
                        >
                            {savingFusion ? <Loader className="animate-spin" size={16} /> : <GitMerge size={16} />}
                            {savingFusion ? 'Unificando...' : 'Confirmar y Fusionar Planes'}
                        </Button>
                    </div>
                }
            >
                {planOrigenFusion && (() => {
                    const otrosPlanesPaciente = planes.filter(p => 
                        p.id !== planOrigenFusion.id && 
                        (p.paciente || '').trim().toLowerCase() === (planOrigenFusion.paciente || '').trim().toLowerCase()
                    );
                    const coincidenciasTratamiento = otrosPlanesPaciente.filter(p => sonTratamientosSimilares(planOrigenFusion.objetivo, p.objetivo));
                    const otrosTratamientos = otrosPlanesPaciente.filter(p => !sonTratamientosSimilares(planOrigenFusion.objetivo, p.objetivo));

                    const planDestinoSeleccionado = planes.find(p => p.id === planDestinoIdFusion);
                    const saldoTransferir = parseFloat(planOrigenFusion.acumulado) || 0;
                    const acumuladoDestino = parseFloat(planDestinoSeleccionado?.acumulado) || 0;
                    const metaDestino = parseFloat(planDestinoSeleccionado?.meta) || 0;
                    const nuevoAcumuladoDestino = acumuladoDestino + saldoTransferir;
                    const nuevoFaltanteDestino = Math.max(0, metaDestino - nuevoAcumuladoDestino);

                    return (
                        <div className="space-y-5">
                            <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                    <GitMerge size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-indigo-950">
                                        Unificación de Paquetes: {planOrigenFusion.paciente}
                                    </h4>
                                    <p className="text-xs text-indigo-700 mt-0.5">
                                        Traspasa automáticamente el saldo abonado, recibos y sesiones clínicas hacia el paquete maestro correcto.
                                    </p>
                                </div>
                            </div>

                            {/* GARANTÍA CLÍNICA */}
                            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-start gap-3 text-xs text-emerald-900 font-medium">
                                <ShieldCheck className="text-emerald-600 shrink-0 mt-0.5" size={20} />
                                <div>
                                    <p className="font-bold text-emerald-950">
                                        🛡️ Protección Total del Expediente Clínico:
                                    </p>
                                    <p className="mt-0.5 text-emerald-800">
                                        Al unificar, <strong>se traspasa el 100% de la información clínica</strong>: sesiones previas, fotografías de antes/después, medidas faciales/corporales y notas médicas del especialista. <strong>Ningún dato clínico ni fotografía se elimina.</strong>
                                    </p>
                                </div>
                            </div>

                            {/* Plan Origen */}
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                        1. Paquete a Absorber / Eliminar (Origen)
                                    </span>
                                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                                        Se absorberá
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-black text-sm text-slate-800">{planOrigenFusion.objetivo}</p>
                                        <span className="text-xs text-slate-500">
                                            Meta: <strong>{formatCurrency(planOrigenFusion.meta)}</strong> | 
                                            Sesiones: <strong>{planOrigenFusion.sesionesRealizadas || 0}/{planOrigenFusion.sesionesTotal || 0}</strong>
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Saldo a Transferir</span>
                                        <span className="text-lg font-black text-turquesa">{formatCurrency(saldoTransferir)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* BOTÓN INTERCAMBIAR ROLES */}
                            {planDestinoSeleccionado && (
                                <div className="flex justify-center -my-2 relative z-10">
                                    <button
                                        type="button"
                                        onClick={handleSwapFusionRoles}
                                        className="px-4 py-1.5 bg-white hover:bg-indigo-50 border-2 border-indigo-200 hover:border-indigo-400 text-indigo-700 rounded-full text-xs font-black flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95"
                                        title="Intercambiar: convertir el paquete destino en origen y viceversa"
                                    >
                                        <ArrowUpDown size={13} /> Intercambiar Origen y Destino
                                    </button>
                                </div>
                            )}

                            {/* Selector de Plan Destino */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-wider text-acero/80">
                                    2. Selecciona el Paquete Maestro (Destino que conservará el paciente) *
                                </label>
                                {otrosPlanesPaciente.length > 0 ? (
                                    <select
                                        value={planDestinoIdFusion}
                                        onChange={e => setPlanDestinoIdFusion(e.target.value)}
                                        className="w-full h-14 px-4 bg-white border-2 border-indigo-200 rounded-2xl font-bold text-acero text-sm outline-none focus:border-indigo-600 shadow-sm"
                                    >
                                        <option value="">-- Elige el paquete maestro destino --</option>
                                        {coincidenciasTratamiento.length > 0 && (
                                            <optgroup label="⭐ Coincidencias de este tratamiento (Recomendado)">
                                                {coincidenciasTratamiento.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.objetivo} | Meta: {formatCurrency(p.meta)} | Acumulado: {formatCurrency(p.acumulado)}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {otrosTratamientos.length > 0 && (
                                            <optgroup label="Otros paquetes del paciente (No recomendado)">
                                                {otrosTratamientos.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.objetivo} | Meta: {formatCurrency(p.meta)} | Acumulado: {formatCurrency(p.acumulado)}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>
                                ) : (
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs">
                                        <p className="font-bold">No se encontraron otros paquetes para {planOrigenFusion.paciente}.</p>
                                        <p className="mt-1">Si este registro fue un error o está en $0, puedes eliminarlo directamente usando el botón de papelera 🗑️.</p>
                                    </div>
                                )}
                            </div>

                            {/* Previsualización del Resultado de Fusión */}
                            {planDestinoSeleccionado && (
                                <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-2 animate-in fade-in">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                                        <Sparkles size={13} /> Resultado tras la unificación
                                    </span>
                                    <div className="grid grid-cols-2 gap-3 pt-1">
                                        <div>
                                            <span className="text-[10px] text-emerald-800 font-bold block">Paquete Destino:</span>
                                            <span className="text-sm font-black text-emerald-950">{planDestinoSeleccionado.objetivo}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-emerald-800 font-bold block">Meta:</span>
                                            <span className="text-sm font-black text-emerald-950">{formatCurrency(metaDestino)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-emerald-800 font-bold block">Nuevo Acumulado:</span>
                                            <span className="text-base font-black text-emerald-600">{formatCurrency(nuevoAcumuladoDestino)}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-emerald-800 font-bold block">Nuevo Saldo Restante:</span>
                                            <span className="text-base font-black text-emerald-950">{formatCurrency(nuevoFaltanteDestino)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Opción Eliminar Origen */}
                            <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={eliminarOrigenFusion}
                                    onChange={e => setEliminarOrigenFusion(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                />
                                <span className="text-xs font-medium text-gray-700">
                                    Eliminar el paquete duplicado/origen tras fusionar (recomendado para limpiar el listado)
                                </span>
                            </label>
                        </div>
                    );
                })()}
            </Modal>

            {/* MODAL CONFIRMAR ELIMINACIÓN DE PLAN */}
            <Modal
                isOpen={isDeletePlanModalOpen}
                onClose={() => { if (!deletingPlan) setIsDeletePlanModalOpen(false); }}
                title="Eliminar Paquete de Tratamiento"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsDeletePlanModalOpen(false)} disabled={deletingPlan}>
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleConfirmDeletePlan}
                            disabled={deletingPlan}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                        >
                            {deletingPlan ? 'Eliminando...' : 'Eliminar Definitivamente'}
                        </Button>
                    </div>
                }
            >
                {planToDelete && (
                    <div className="space-y-4">
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                            <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={22} />
                            <div className="space-y-1">
                                <p className="font-bold text-sm text-rose-950">
                                    ¿Estás seguro de eliminar el paquete "{planToDelete.objetivo}"?
                                </p>
                                <p className="text-xs text-rose-800">
                                    Paciente: <strong>{getNombrePacientePlan(planToDelete)}</strong>
                                </p>
                                {parseFloat(planToDelete.acumulado) > 0 ? (
                                    <div className="mt-2.5 p-3 bg-white/90 rounded-xl border border-rose-300 text-xs text-rose-900">
                                        ⚠️ <strong>Atención:</strong> Este paquete cuenta con un saldo acumulado de <strong>{formatCurrency(planToDelete.acumulado)}</strong>. Si solo deseas corregir un duplicado sin perder este dinero, te sugerimos cancelar y usar el botón <strong>"Unificar"</strong> para transferir el saldo a su otro plan.
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 mt-1">
                                        Este registro está en $0.00 y no tiene abonos pendientes. Se eliminará de la base de datos limpiamente.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

{/* Modal Confirmar Eliminación */}
            <Modal
                isOpen={isConfirmDeleteOpen}
                onClose={() => setIsConfirmDeleteOpen(false)}
                title="Confirmar Eliminación"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsConfirmDeleteOpen(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleConfirmDelete} className="bg-red-500 hover:bg-red-600 text-white">Eliminar</Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                        <AlertCircle className="text-red-500 flex-shrink-0" />
                        <p className="text-xs text-red-700">
                            ¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.
                        </p>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
