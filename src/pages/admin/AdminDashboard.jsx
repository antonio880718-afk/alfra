import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Activity, AlertTriangle, GitMerge, Users, CalendarDays, CalendarCheck, CalendarX, Clock, UserMinus, Gift, Loader, X, Coins, Crown, CheckCircle2, AlertCircle, ShieldAlert, FileText, Sparkles, Send, Copy, Check, ChevronRight, Lock, UserCheck, Flame } from 'lucide-react';
import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { toLocalISOString, getCortesAprobados } from '../../services/finanzasService';
import { onStaffChange } from '../../services/staffService';
import { onSesionesChange, auditarExpedientesPorDia } from '../../services/tratamientosService';
import { onCitasChange } from '../../services/citasService';
import { onMovimientosChange } from '../../services/finanzasService';
import { onPacientesChange } from '../../services/pacientesService';
import { onPlanesChange, detectarPlanesDuplicados } from '../../services/planesService';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const navigate = useNavigate();

    const [citas, setCitas] = useState([]);
    const [movimientos, setMovimientos] = useState([]);
    const [pacientes, setPacientes] = useState([]);
    const [staff, setStaff] = useState([]);
    const [sesiones, setSesiones] = useState([]);
    const [cortesAprobados, setCortesAprobados] = useState([]);
    const [copiedEsp, setCopiedEsp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [planes, setPlanes] = useState([]);
    const [showIncidenciasModal, setShowIncidenciasModal] = useState(null);
    const [detalleModal, setDetalleModal] = useState(null);
    
    // Estados para reset de password de staff
    const [staffEmail, setStaffEmail] = useState('');
    const [genericPassword, setGenericPassword] = useState('Alfra2026!');
    const [loadingReset, setLoadingReset] = useState(false);
    const [resetMessage, setResetMessage] = useState(null);

    useEffect(() => {
        const unsubPlanes = onPlanesChange(setPlanes);
        const unsubCitas = onCitasChange((data) => setCitas(data));
        const unsubMovs = onMovimientosChange((data) => { setMovimientos(data); setLoading(false); });
        const unsubPac = onPacientesChange((data) => setPacientes(data));
        const unsubStaff = onStaffChange((data) => setStaff(data));
        const unsubSesiones = onSesionesChange((data) => setSesiones(data));

        getCortesAprobados().then(cortes => setCortesAprobados(cortes || [])).catch(e => console.warn(e));

        return () => { 
            if (unsubPlanes) unsubPlanes();
            unsubCitas(); 
            unsubMovs(); 
            unsubPac(); 
            unsubStaff(); 
            unsubSesiones(); 
        };
    }, []);

    const paquetesDuplicados = useMemo(() => {
        return detectarPlanesDuplicados(planes);
    }, [planes]);

    const handleResetPassword = async () => {
        if (!staffEmail || !genericPassword) {
            setResetMessage({ type: 'error', text: 'Completa todos los campos.' });
            return;
        }
        try {
            setLoadingReset(true);
            setResetMessage(null);
            
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const cambiarPasswordStaff = httpsCallable(functions, 'cambiarPasswordStaff');
            
            const res = await cambiarPasswordStaff({ email: staffEmail, newPassword: genericPassword });
            
            if (res.data.success) {
                setResetMessage({ type: 'success', text: '¡Contraseña asignada con éxito! Se le pedirá cambiarla al entrar.' });
                setStaffEmail('');
                setGenericPassword('Alfra2026!');
            }
        } catch (err) {
            console.error(err);
            setResetMessage({ type: 'error', text: 'Error: ' + err.message });
        } finally {
            setLoadingReset(false);
        }
    };

    const formatValue = (value) => `$${Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;
    const handleCopyMensaje = (espNombre, mensaje) => {
        if (!mensaje) return;
        navigator.clipboard.writeText(mensaje);
        setCopiedEsp(espNombre);
        setTimeout(() => setCopiedEsp(null), 3000);
    };

    const fechaSeleccionadaStr = useMemo(() => {
        try { return format(selectedDate, 'yyyy-MM-dd'); } catch { return ''; }
    }, [selectedDate]);

// Citas del día seleccionado
    const citasDelDia = citas.filter(c => {
        try { return isSameDay(new Date(c.fechaHora || c.fecha), selectedDate); } catch { return false; }
    });

    const kpisAgenda = {
        agendadas: citasDelDia.length,
        atendidas: citasDelDia.filter(c => c.status === 'Completada').length,
        canceladas: citasDelDia.filter(c => c.status === 'Cancelada').length,
        reagendadas: citasDelDia.filter(c => c.status === 'Reagendada').length,
        noAsistio: citasDelDia.filter(c => c.status === 'No Asistió').length,
    };


    // 1. Auditoría de expedientes clínicos para la fecha seleccionada
    const auditoriaExpedientes = useMemo(() => {
        try {
            return auditarExpedientesPorDia(citasDelDia, sesiones, [], fechaSeleccionadaStr, staff, pacientes);
        } catch (e) {
            console.error("Error auditando expedientes:", e);
            return { actualizados: [], sinActualizar: [], porEspecialista: [] };
        }
    }, [citasDelDia, sesiones, fechaSeleccionadaStr, staff, pacientes]);

    // 2. Solicitudes de Pase a Caja en Cita Única
    const citasPaseCajaUnica = useMemo(() => {
        return (citasDelDia || []).filter(c => 
            c.status === 'Pendiente Pase a Caja' || 
            c.paseCaja?.estadoAutorizacion === 'Pendiente' ||
            (c.paseCaja?.motivoCitaUnica && c.status !== 'Cancelada')
        );
    }, [citasDelDia]);

    const solicitudesPendientesPase = useMemo(() => {
        return citasPaseCajaUnica.filter(c => c.status === 'Pendiente Pase a Caja' || c.paseCaja?.estadoAutorizacion === 'Pendiente');
    }, [citasPaseCajaUnica]);

    // 3. Estado de Corte y Arqueo para la fecha seleccionada
    const estadoCorteDia = useMemo(() => {
        const aprobado = (cortesAprobados || []).some(ca => ca.fecha === fechaSeleccionadaStr);
        return aprobado ? { cerrado: true, label: "Corte Aprobado y Sellado", color: "text-emerald-700 bg-emerald-50 border-emerald-200" } 
                        : { cerrado: false, label: "Caja Abierta (Operación)", color: "text-turquesa bg-turquesa/10 border-turquesa/20" };
    }, [cortesAprobados, fechaSeleccionadaStr]);

    // 4. Productividad y comisiones del Staff
    const especialistasStats = useMemo(() => {
        const espList = (staff || []).filter(s => {
            const p = (s.puesto || s.rol || '').toLowerCase();
            return p.includes('especialista') || p.includes('terapeuta') || p.includes('cosmet') || p.includes('medica') || p.includes('doctora');
        });

        return espList.map(esp => {
            const citasEspHoy = (citasDelDia || []).filter(c => {
                const cEspId = String(c.especialistaId || c.staffId || '').trim();
                const cEspNom = String(c.especialista || c.especialistaNombre || '').toLowerCase();
                const espNom = String(esp.nombre || '').toLowerCase();
                return (cEspId && cEspId === String(esp.id)) || (espNom && cEspNom.includes(espNom));
            });

            const atendidasHoy = citasEspHoy.filter(c => c.status === 'Completada').length;
            const citasAuditoria = auditoriaExpedientes.porEspecialista.find(pe => 
                pe.especialista.toLowerCase().includes(esp.nombre?.toLowerCase()) || 
                esp.nombre?.toLowerCase().includes(pe.especialista.toLowerCase())
            );

            return {
                id: esp.id,
                nombre: esp.nombre,
                puesto: esp.puesto || 'Especialista',
                atendidasHoy,
                citasHoyCount: citasEspHoy.length,
                expedientesPendientes: citasAuditoria?.citas?.length || 0,
                mensajeAviso: citasAuditoria?.mensaje || null,
                pacientesFaltantes: citasAuditoria?.listaPacientes || '',
                saldoComisiones: Number(esp.saldoComisiones || 0)
            };
        });
    }, [staff, citasDelDia, auditoriaExpedientes]);

    // 5. Tasa de Retención / Continuidad en Cabina
    const metricasRetencion = useMemo(() => {
        const completadas = kpisAgenda.atendidas;
        const unicas = citasPaseCajaUnica.filter(c => c.status === 'Completada' || c.status === 'Pendiente Pase a Caja').length;
        const porcentaje = completadas > 0 ? Math.max(0, Math.min(100, Math.round(((completadas - unicas) / completadas) * 100))) : 100;
        return {
            completadas,
            unicas,
            porcentaje
        };
    }, [kpisAgenda, citasPaseCajaUnica]);

    // KPIs financieros excluyendo los movimientos Cancelados
    const movsValidos = movimientos.filter(m => m.estado !== 'Cancelado');

    // El contexto temporal del dashboard ahora depende de la fecha seleccionada
    const hoyDate = selectedDate;
    const checkIsThisWeek = (dateStr) => {
        try {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            const start = startOfWeek(hoyDate, { weekStartsOn: 1 });
            const end = endOfWeek(hoyDate, { weekStartsOn: 1 });
            return d >= start && d <= end;
        } catch { return false; }
    };
    const checkIsThisMonth = (dateStr) => {
        try {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d.getMonth() === hoyDate.getMonth() && d.getFullYear() === hoyDate.getFullYear();
        } catch { return false; }
    };

    // Calcular Pacientes Nuevos
    const pacientesNuevosEsteMes = pacientes.filter(p => checkIsThisMonth(p.createdAt)).length;

    const incidenciasMes = citas.filter(c => checkIsThisMonth(c.fecha || c.fechaHora || c.createdAt));
    const inasistenciasMesCount = incidenciasMes.filter(c => c.status === 'No Asistió').length;
    const cancelacionesMesCount = incidenciasMes.filter(c => c.status === 'Cancelada').length;

    const ingresosSemana = movsValidos.filter(m => m.tipo === 'Ingreso' && checkIsThisWeek(m.createdAt || m.fecha)).reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const egresosSemana = movsValidos.filter(m => m.tipo === 'Egreso' && checkIsThisWeek(m.createdAt || m.fecha)).reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const utilidadSemana = ingresosSemana - egresosSemana;
    const margenSemana = ingresosSemana > 0 ? Math.round((utilidadSemana / ingresosSemana) * 100) : 0;

    const ingresosMes = movsValidos.filter(m => m.tipo === 'Ingreso' && checkIsThisMonth(m.createdAt || m.fecha)).reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const egresosMes = movsValidos.filter(m => m.tipo === 'Egreso' && checkIsThisMonth(m.createdAt || m.fecha)).reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const utilidadMes = ingresosMes - egresosMes;

    // Gráfica: evolución por día de los últimos 7 días
    const semanaActual = eachDayOfInterval({ start: startOfWeek(hoyDate, { weekStartsOn: 1 }), end: endOfWeek(hoyDate, { weekStartsOn: 1 }) });
    const graficaData = semanaActual.map(day => {
        const dayStr = format(day, 'EEE', { locale: es });
        const ingresosDia = movsValidos.filter(m => m.tipo === 'Ingreso' && (m.createdAt || m.fecha)?.startsWith(format(day, 'yyyy-MM-dd'))).reduce((a, m) => a + Number(m.monto || 0), 0);
        const egresosDia = movsValidos.filter(m => m.tipo === 'Egreso' && (m.createdAt || m.fecha)?.startsWith(format(day, 'yyyy-MM-dd'))).reduce((a, m) => a + Number(m.monto || 0), 0);
        return { name: dayStr.toUpperCase(), ingresos: ingresosDia, egresos: egresosDia, utilidad: ingresosDia - egresosDia };
    });

    // --- LÓGICA DE DISTRIBUCIÓN DE GASTOS (MES ACTUAL) ---
    const egresosMesFiltrados = movsValidos.filter(m => m.tipo === 'Egreso' && checkIsThisMonth(m.createdAt || m.fecha));
    const gastosPorCategoria = egresosMesFiltrados.reduce((acc, m) => {
        const cat = m.categoria || (m.motivo ? m.motivo.split(':')[0] : 'Otro');
        acc[cat] = (acc[cat] || 0) + Number(m.monto || 0);
        return acc;
    }, {});

    const COLORS_PIE = [
        '#0d9488', '#f87171', '#fbbf24', '#3b82f6', '#a855f7',
        '#64748b', '#fb923c', '#ec4899', '#14b8a6', '#8b5cf6',
        '#f43f5e', '#84cc16'
    ];
    const categoriasGraficaData = Object.keys(gastosPorCategoria)
        .map((cat, index) => ({
            name: cat,
            value: gastosPorCategoria[cat],
            color: COLORS_PIE[index % COLORS_PIE.length]
        }))
        .sort((a, b) => b.value - a.value);

    // --- LÓGICA DE SERVICIOS MÁS VENDIDOS (MES ACTUAL) ---
    const citasMesCompletadas = citas.filter(c => checkIsThisMonth(c.fecha || c.fechaHora || c.createdAt) && c.status === 'Completada');

    const normalizeString = (str) => {
        return str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : '';
    };

    const serviciosVendidos = citasMesCompletadas.reduce((acc, c) => {
        let srvRaw = c.servicio || 'Otro';
        let srvNorm = normalizeString(srvRaw);

        let existingKey = Object.keys(acc).find(k => normalizeString(k) === srvNorm);

        if (existingKey) {
            acc[existingKey] += 1;
        } else {
            const displaySrv = srvRaw.charAt(0).toUpperCase() + srvRaw.slice(1).toLowerCase();
            acc[displaySrv] = 1;
        }
        return acc;
    }, {});

    const topServiciosData = Object.keys(serviciosVendidos)
        .map((srv, index) => ({
            name: srv,
            value: serviciosVendidos[srv],
            color: COLORS_PIE[(index + 4) % COLORS_PIE.length]
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    const maxServicioCount = topServiciosData.length > 0 ? topServiciosData[0].value : 1;

    // --- LÓGICA DE COMPARATIVA MENSUAL (SEMANAS) ---
    const agruparPorSemanasDelMes = (movimientosArray, targetDate) => {
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth();
        let semanas = { "Semana 1": 0, "Semana 2": 0, "Semana 3": 0, "Semana 4": 0 };

        movimientosArray.forEach(m => {
            if (m.tipo !== 'Ingreso') return;
            try {
                const d = new Date(m.createdAt || m.fecha);
                if (d.getFullYear() === year && d.getMonth() === month) {
                    const date = d.getDate();
                    if (date <= 7) semanas["Semana 1"] += Number(m.monto || 0);
                    else if (date <= 14) semanas["Semana 2"] += Number(m.monto || 0);
                    else if (date <= 21) semanas["Semana 3"] += Number(m.monto || 0);
                    else semanas["Semana 4"] += Number(m.monto || 0);
                }
            } catch { }
        });
        return semanas;
    };

    const mesAnteriorDate = new Date(hoyDate.getFullYear(), hoyDate.getMonth() - 1, 1);
    const semanasActual = agruparPorSemanasDelMes(movsValidos, hoyDate);
    const semanasAnterior = agruparPorSemanasDelMes(movsValidos, mesAnteriorDate);

    const comparativaMensualData = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"].map(sem => ({
        name: sem,
        "Mes Actual": semanasActual[sem],
        "Mes Anterior": semanasAnterior[sem]
    }));

    // --- LÓGICA DE COMPARATIVA MENSUAL DE GASTOS (SEMANAS) ---
    const agruparGastosPorSemanas = (movimientosArray, targetDate) => {
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth();
        let semanas = {
            "Semana 1": { gasto: 0, inversion: 0 },
            "Semana 2": { gasto: 0, inversion: 0 },
            "Semana 3": { gasto: 0, inversion: 0 },
            "Semana 4": { gasto: 0, inversion: 0 }
        };

        movimientosArray.forEach(m => {
            if (m.tipo !== 'Egreso') return;
            try {
                const d = new Date(m.createdAt || m.fecha);
                if (d.getFullYear() === year && d.getMonth() === month) {
                    const date = d.getDate();
                    const catLower = (m.categoria || m.motivo || '').toLowerCase();
                    const isInversion = catLower.includes('inversión') || catLower.includes('inversion');
                    const amt = Number(m.monto || 0);

                    let week = "Semana 4";
                    if (date <= 7) week = "Semana 1";
                    else if (date <= 14) week = "Semana 2";
                    else if (date <= 21) week = "Semana 3";

                    if (isInversion) semanas[week].inversion += amt;
                    else semanas[week].gasto += amt;
                }
            } catch { }
        });
        return semanas;
    };

    const gastosSemanasActual = agruparGastosPorSemanas(movsValidos, hoyDate);
    const gastosSemanasAnterior = agruparGastosPorSemanas(movsValidos, mesAnteriorDate);

    const comparativaGastosData = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"].map(sem => ({
        name: sem,
        "Gasto Anterior": gastosSemanasAnterior[sem].gasto,
        "Inversión Anterior": gastosSemanasAnterior[sem].inversion,
        "Gasto Actual": gastosSemanasActual[sem].gasto,
        "Inversión Actual": gastosSemanasActual[sem].inversion
    }));


    // Pacientes de cumpleaños esta semana
    const cumpleanosPacientes = pacientes.filter(p => {
        try {
            const cumple = p.fechaNacimiento;
            if (!cumple) return false;
            const fecha = new Date(cumple);
            return fecha.getMonth() === hoyDate.getMonth() && Math.abs(fecha.getDate() - hoyDate.getDate()) <= 3;
        } catch { return false; }
    });

    // --- KPIs REALES DEL DÍA (desde Firebase movimientos) ---
    const hoyRealActual = new Date(); // Fecha real de hoy para marcar "Hoy" en la UI si coincide
    const hoyStr = format(hoyRealActual, 'yyyy-MM-dd');
    const selStr = format(selectedDate, 'yyyy-MM-dd');

    // Corte Real Hoy: ingresos ya cobrados en Firestore para la fecha seleccionada
    const corteRealHoy = movsValidos
        .filter(m => m.tipo === 'Ingreso' && (m.createdAt || m.fecha || '').startsWith(selStr))
        .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    // Egresos del día seleccionado
    const egresosHoy = movsValidos
        .filter(m => m.tipo === 'Egreso' && (m.createdAt || m.fecha || '').startsWith(selStr))
        .reduce((acc, m) => acc + Number(m.monto || 0), 0);

    // Ingreso Estimado Hoy: suma de precios de citas no canceladas del día
    // Prioridad: precio en Firestore (c.precio) → localStorage labPrices → 0
    const labPrices = JSON.parse(localStorage.getItem('alfra_lab_prices') || '{}');
    const ingresoPotencialHoy = citasDelDia
        .filter(c => c.status !== 'Cancelada' && c.status !== 'No Asistió')
        .reduce((acc, c) => {
            const local = labPrices[c.id];
            const precio = Number(c.precio || local?.precio || 0);
            return acc + precio;
        }, 0);

    // Mostrar $0 si realmente no hay precios — NO usar corteReal como fallback
    const ingresoPotencialFinal = ingresoPotencialHoy;

    // Fuga Hoy: citas canceladas/no asistió del día con precio registrado
    const fugaHoy = citasDelDia
        .filter(c => c.status === 'Cancelada' || c.status === 'No Asistió')
        .reduce((acc, c) => {
            const local = labPrices[c.id];
            return acc + Number(c.precio || local?.precio || 0);
        }, 0);

    // Ingreso Semanal Estimado: ingresos reales de la semana + proyección de citas pendientes
    const ingresoRealSemana = movsValidos
        .filter(m => m.tipo === 'Ingreso' && checkIsThisWeek(m.createdAt || m.fecha))
        .reduce((acc, m) => acc + Number(m.monto || 0), 0);
    // Citas de la semana actual
    const citasSemana = citas.filter(c => {
        try { return checkIsThisWeek(c.fechaHora || c.fecha); } catch { return false; }
    });

    const ingresoPotencialSemana = citasSemana
        .filter(c => c.status !== 'Cancelada' && c.status !== 'No Asistió')
        .reduce((acc, c) => {
            const local = labPrices[c.id];
            return acc + Number(c.precio || local?.precio || 0);
        }, 0);
    const ingresoEstSemana = ingresoPotencialSemana > 0 ? ingresoPotencialSemana : ingresoRealSemana;

    // Gráfica de Proyección Próximos 7 días (relativo a la fecha seleccionada)
    const proximosDias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + i);
        return d;
    });
    const proyeccionGraficaData = proximosDias.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const ingresosDelDia = movsValidos
            .filter(m => m.tipo === 'Ingreso' && (m.createdAt || m.fecha || '').startsWith(dayStr))
            .reduce((a, m) => a + Number(m.monto || 0), 0);
        const citasDeEseDia = citas.filter(c => (c.fechaHora || c.fecha || '').startsWith(dayStr));
        const potencialCitas = citasDeEseDia
            .filter(c => c.status !== 'Cancelada' && c.status !== 'No Asistió')
            .reduce((a, c) => {
                const extra = labPrices[c.id];
                return a + Number(extra?.precio || c.precio || c.monto || 0);
            }, 0);
        return {
            name: format(day, 'EEE', { locale: es }).toUpperCase(),
            monto: potencialCitas > 0 ? potencialCitas : ingresosDelDia
        };
    });

    const fechaInicio = selectedDate;
    const fechaFin = proximosDias[6];
    const diaInicio = format(fechaInicio, 'd');
    const diaFin = format(fechaFin, 'd');
    const mesInicio = format(fechaInicio, 'MMMM', { locale: es });
    const mesFin = format(fechaFin, 'MMMM', { locale: es });
    const anoFin = format(fechaFin, 'yyyy');

    const textoRango = fechaInicio.getMonth() === fechaFin.getMonth()
        ? `DEL ${diaInicio} AL ${diaFin} DE ${mesFin.toUpperCase()} ${anoFin}`
        : `DEL ${diaInicio} DE ${mesInicio.toUpperCase()} AL ${diaFin} DE ${mesFin.toUpperCase()} ${anoFin}`;

    const textoFechaHoy = format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es });

    // --- LÓGICA DE EVOLUCIÓN ANUAL (CITAS) ---
    const getCitasAnoData = () => {
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const currentYear = hoyDate.getFullYear().toString();
        let data = meses.map(m => ({ name: m, completadas: 0, inasistencias: 0, canceladas: 0 }));

        citas.forEach(c => {
            const cDateStr = c.fecha || c.fechaHora || c.createdAt;
            if (!cDateStr) return;

            if (cDateStr.startsWith(currentYear)) {
                const monthStr = cDateStr.split('-')[1];
                if (monthStr) {
                    const mesIndex = parseInt(monthStr, 10) - 1;
                    if (mesIndex >= 0 && mesIndex < 12) {
                        if (c.status === 'Completada') data[mesIndex].completadas += 1;
                        else if (c.status === 'No Asistió') data[mesIndex].inasistencias += 1;
                        else if (c.status === 'Cancelada') data[mesIndex].canceladas += 1;
                    }
                }
            }
        });
        return data;
    };
    const evolucionCitasData = getCitasAnoData();

    // --- TOP 10 PACIENTES MÁS FRECUENTES DEL MES (solo completadas) ---
    const topPacientesMes = (() => {
        const citasDelMes = citas.filter(c => checkIsThisMonth(c.fecha || c.fechaHora || c.createdAt));
        const conteo = {};
        citasDelMes.forEach(c => {
            const nombre = c.pacienteNombre || c.paciente || 'Sin nombre';
            const id = c.pacienteId || nombre;
            if (!conteo[id]) conteo[id] = { nombre, completadas: 0, total: 0 };
            conteo[id].total++;
            if (c.status === 'Completada') conteo[id].completadas++;
        });
        return Object.values(conteo)
            .filter(p => p.completadas > 0)
            .sort((a, b) => b.completadas - a.completadas)
            .slice(0, 10);
    })();
    const maxVisitasMes = topPacientesMes.length > 0 ? topPacientesMes[0].completadas : 1;

    const incidenciasLista = showIncidenciasModal ? citas.filter(c => {
        const isThisMonth = checkIsThisMonth(c.fecha || c.fechaHora || c.createdAt);
        if (!isThisMonth) return false;
        if (showIncidenciasModal === 'inasistencias' && c.status === 'No Asistió') return true;
        if (showIncidenciasModal === 'cancelaciones' && c.status === 'Cancelada') return true;
        return false;
    }) : [];

    return (
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-10 pb-12 px-1 sm:px-0">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                <div>
                    <h2 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight">Dashboard Ejecutivo</h2>
                    <p className="text-gray-500 font-medium mt-1">Sincronización en tiempo real — <span className="text-turquesa font-bold">ALFRA Cloud</span></p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white/80 backdrop-blur-sm p-1 rounded-2xl border border-gray-100 shadow-sm">
                        <button
                            onClick={() => {
                                const d = new Date(selectedDate);
                                d.setMonth(d.getMonth() - 1);
                                setSelectedDate(d);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-turquesa"
                            title="Mes Anterior"
                        >
                            <TrendingDown size={18} className="rotate-90" />
                        </button>
                        <div className="flex items-center gap-2 px-2 border-x border-gray-100">
                            <CalendarDays className="text-turquesa" size={18} />
                            <input
                                type="date"
                                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-800 cursor-pointer outline-none w-[125px]"
                                value={format(selectedDate, 'yyyy-MM-dd')}
                                onChange={(e) => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
                            />
                        </div>
                        <button
                            onClick={() => {
                                const d = new Date(selectedDate);
                                d.setMonth(d.getMonth() + 1);
                                setSelectedDate(d);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-turquesa"
                            title="Mes Siguiente"
                        >
                            <TrendingUp size={18} className="-rotate-90" />
                        </button>
                    </div>
                </div>
            </div>

            {/* TIRA DE PULSO OPERATIVO EN VIVO (ALERTA EJECUTIVA RÁPIDA) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Sensor Expedientes */}
                <div 
                    onClick={() => {
                        const el = document.getElementById("seccion-auditoria-clinica");
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between shadow-sm ${
                        auditoriaExpedientes.sinActualizar.length > 0 
                            ? "bg-red-500/10 border-red-500/30 text-red-900 hover:bg-red-500/15" 
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 hover:bg-emerald-500/15"
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${auditoriaExpedientes.sinActualizar.length > 0 ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
                            {auditoriaExpedientes.sinActualizar.length > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Expedientes Clínicos Hoy</p>
                            <h4 className="text-sm font-black">
                                {auditoriaExpedientes.sinActualizar.length > 0 
                                    ? `⚠️ ${auditoriaExpedientes.sinActualizar.length} pendiente(s) por llenar` 
                                    : "✓ 100% Expedientes al Día"}
                            </h4>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                </div>

                {/* 2. Sensor Citas Únicas / Pases a Caja */}
                <div 
                    onClick={() => navigate('/citas')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between shadow-sm ${
                        solicitudesPendientesPase.length > 0 
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-900 hover:bg-amber-500/15" 
                            : "bg-blue-500/10 border-blue-500/30 text-blue-900 hover:bg-blue-500/15"
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${solicitudesPendientesPase.length > 0 ? "bg-amber-500 text-white" : "bg-blue-500 text-white"}`}>
                            <Lock size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Pases a Caja & Cita Única</p>
                            <h4 className="text-sm font-black">
                                {solicitudesPendientesPase.length > 0 
                                    ? `🔒 ${solicitudesPendientesPase.length} solicitud(es) por autorizar` 
                                    : "✓ Cierre de Citas Normal"}
                            </h4>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                </div>

                {/* 3. Sensor Corte y Arqueo de Caja */}
                <div 
                    onClick={() => navigate('/corte-caja')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between shadow-sm ${estadoCorteDia.color}`}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gray-900 text-white">
                            <Coins size={18} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Corte y Arqueo Diario</p>
                            <h4 className="text-sm font-black">{estadoCorteDia.label}</h4>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                </div>
            </div>

            {/* KPI Cards de Proyección (LABORATORIO) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 sm:gap-4">
                <Card variant="premium" className="bg-white border-blue-100 relative overflow-hidden group border-2 flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <CalendarDays size={100} className="text-blue-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] relative z-10">Citas del Mes</p>
                        <h3 className="text-3xl font-black mt-1 leading-none text-blue-700 relative z-10">{incidenciasMes.length}</h3>
                    </div>
                    <div className="mt-4 flex flex-col gap-1.5 relative z-10 w-full border-t border-blue-50 pt-3">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                            <span className="text-emerald-500">Completadas</span>
                            <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md border border-emerald-100">{incidenciasMes.filter(c => c.status === 'Completada').length}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                            <span className="text-amber-500">Inasistencias</span>
                            <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md border border-amber-100">{inasistenciasMesCount}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                            <span className="text-rose-500">Canceladas</span>
                            <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-md border border-rose-100">{cancelacionesMesCount}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                            <span className="text-blue-400">Por Atender</span>
                            <span className="bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-md border border-blue-100">{incidenciasMes.filter(c => c.status === 'Pendiente' || c.status === 'Confirmada').length}</span>
                        </div>
                    </div>
                </Card>

                <Card variant="premium" className="bg-gradient-to-br from-turquesa to-turquesa/80 text-white border-none relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => setDetalleModal('ingreso_estimado')}>
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <TrendingUp size={120} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Ingreso Estimado ({textoFechaHoy})</p>
                    <h3 className="text-3xl font-black mt-2 leading-none">{formatValue(ingresoPotencialFinal)}</h3>
                    <div className="mt-4 flex items-center gap-2">
                        <Badge variant="subtle" className="bg-white/20 text-white border-none text-[8px] font-black">{citasDelDia.length} CITAS</Badge>
                    </div>
                </Card>

                <Card variant="premium" className="bg-white border-turquesa/20 relative overflow-hidden group border-2 border-dashed cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => setDetalleModal('ingreso_semanal')}>
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <Coins size={120} className="text-turquesa" />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Ingreso Est. Semanal</p>
                    <h3 className="text-3xl font-black mt-2 leading-none text-acero">{formatValue(ingresoEstSemana)}</h3>
                    <div className="mt-4 flex items-center gap-2">
                        <Badge variant="subtle" className="bg-turquesa/10 text-turquesa border-none text-[8px] font-black">{textoRango}</Badge>
                    </div>
                </Card>

                <Card variant="premium" className="bg-white border-emerald-100 relative overflow-hidden group border-2 shadow-lg shadow-emerald-500/20 cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => setDetalleModal('corte_real')}>
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <TrendingUp size={120} className="text-emerald-500" />
                    </div>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Corte Real ({textoFechaHoy})</p>
                    <h3 className="text-3xl font-black mt-2 leading-none text-emerald-700">{formatValue(corteRealHoy)}</h3>
                    <div className="mt-4 flex items-center gap-2">
                        <Badge variant="subtle" className="bg-emerald-50 text-emerald-600 border-none text-[8px] font-black">COBRADO HOY</Badge>
                    </div>
                </Card>

                <Card variant="premium" className="bg-white border-red-50 relative overflow-hidden group border-2 shadow-lg shadow-red-500/20 cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => setDetalleModal('fuga')}>
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <TrendingDown size={120} className="text-red-500" />
                    </div>
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em]">Fuga Detectada ({textoFechaHoy})</p>
                    <h3 className="text-3xl font-black mt-2 leading-none text-red-500">{formatValue(fugaHoy)}</h3>
                    <div className="mt-4 flex items-center gap-2">
                        <Badge variant="subtle" className="bg-red-50 text-red-500 border-none text-[8px] font-black">INASISTENCIAS / CANCELADOS</Badge>
                    </div>
                </Card>
            </div>

            {/* KPI Cards Financieras */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
                <Card variant="premium" className="relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => setDetalleModal('ingreso_semanal_real')}>
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <TrendingUp size={120} />
                    </div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-xs font-black text-turquesa uppercase tracking-widest mb-2">Ingreso Semanal</p>
                            <h3 className="text-4xl font-black text-gray-900 leading-none">
                                {loading ? <Loader size={32} className="animate-spin text-turquesa" /> : formatValue(ingresosSemana)}
                            </h3>
                        </div>
                        <div className="p-4 bg-turquesa/10 rounded-2xl text-turquesa shadow-inner"><TrendingUp size={24} /></div>
                    </div>
                    <div className="mt-8 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Badge variant="success" className="bg-turquesa/10 text-turquesa border-none px-3 py-1">
                                {format(selectedDate, 'MMMM', { locale: es }).toUpperCase()}
                            </Badge>
                        </div>
                        <p className="text-sm text-gray-500 font-bold">Total: {formatValue(ingresosMes)}</p>
                    </div>
                </Card>

                <Card variant="default" className="relative overflow-hidden group border-red-100 cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => setDetalleModal('gasto_semanal')}>
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <TrendingDown size={120} />
                    </div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-xs font-black text-red-400 uppercase tracking-widest mb-2">Gasto Semanal</p>
                            <h3 className="text-4xl font-black text-gray-900 leading-none">{loading ? '...' : formatValue(egresosSemana)}</h3>
                        </div>
                        <div className="p-4 bg-red-50 rounded-2xl text-red-500 shadow-inner"><TrendingDown size={24} /></div>
                    </div>
                    <div className="mt-8 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Badge variant="error" className="bg-red-50 text-red-500 border-none px-3 py-1">
                                {format(selectedDate, 'MMMM', { locale: es }).toUpperCase()}
                            </Badge>
                        </div>
                        <p className="text-sm text-gray-500 font-bold">Total: {formatValue(egresosMes)}</p>
                    </div>
                </Card>

                <Card variant="glass" className="relative border-none ring-1 ring-acero/20 overflow-hidden group">
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-acero" style={{ width: `${Math.max(0, Math.min(100, margenSemana))}%` }} />
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-xs font-black text-acero uppercase tracking-widest mb-2">Utilidad Semanal</p>
                            <h3 className={`text-4xl font-black leading-none ${utilidadSemana >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                {loading ? '...' : formatValue(utilidadSemana)}
                            </h3>
                        </div>
                        <div className="p-4 bg-acero/10 rounded-2xl text-acero shadow-inner"><DollarSign size={24} /></div>
                    </div>
                    <div className="mt-8">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-xs font-bold text-gray-400 uppercase mb-0.5">Utilidad Mes: <span className={utilidadMes >= 0 ? "text-acero" : "text-red-500"}>{formatValue(utilidadMes)}</span></span>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Margen Semanal</span>
                                <span className="text-xs font-black text-acero leading-none">{margenSemana}%</span>
                            </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden flex">
                            <div className="bg-acero h-full rounded-full transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, margenSemana))}%` }} />
                        </div>
                    </div>
                </Card>
            </div>

            {/* NUEVA SECCIÓN: CENTRO DE CONTROL OPERATIVO & DISCIPLINA CLÍNICA */}
            <div id="seccion-auditoria-clinica" className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                
                {/* BLOQUE A: Semáforo de Auditoría Clínica & Penalización en Nómina */}
                <Card variant="premium" className="bg-white border-2 border-slate-100 shadow-md p-5 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-2xl ${auditoriaExpedientes.sinActualizar.length > 0 ? "bg-red-50 text-red-500 border border-red-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
                                <ShieldAlert size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-gray-900">Auditoría de Expedientes & Nómina</h3>
                                <p className="text-xs text-gray-400">Verificación de notas clínicas por especialista para {format(selectedDate, "d 'de' MMMM", { locale: es })}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/auditoria')}
                            className="text-xs font-black text-turquesa hover:text-turquesa/80 flex items-center gap-1 cursor-pointer"
                        >
                            Ver Todo <ChevronRight size={14} />
                        </button>
                    </div>

                    {auditoriaExpedientes.sinActualizar.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/60 text-emerald-900 flex items-center gap-3">
                            <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider">¡Excelente! 100% de expedientes al día</p>
                                <p className="text-xs text-emerald-700/80 mt-0.5">Todas las citas atendidas en esta fecha cuentan con su nota de evolución registrada.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800 flex items-center gap-2">
                                <AlertTriangle size={16} className="text-red-500 shrink-0" />
                                <span><strong>{auditoriaExpedientes.sinActualizar.length} paciente(s)</strong> atendidos sin nota. Se aplicará deducción si no se corrigen antes de nómina.</span>
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {auditoriaExpedientes.porEspecialista.map((grupo, idx) => (
                                    <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-sm text-gray-900">{grupo.especialista}</span>
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                                                    {grupo.citas.length} pendiente(s)
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Pacientes: <strong className="text-gray-700">{grupo.listaPacientes}</strong></p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyMensaje(grupo.especialista, grupo.mensaje)}
                                            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                                copiedEsp === grupo.especialista 
                                                    ? "bg-emerald-500 text-white border-emerald-600 shadow-sm" 
                                                    : "bg-white text-gray-700 hover:bg-gray-100 border-gray-300 shadow-xs"
                                            }`}
                                        >
                                            {copiedEsp === grupo.especialista ? (
                                                <><Check size={14} /> ¡Copiado!</>
                                            ) : (
                                                <><Copy size={14} /> Copiar WhatsApp</>
                                            )}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>

                {/* BLOQUE B: Monitor de Retención & Comisiones de Especialistas */}
                <Card variant="premium" className="bg-white border-2 border-slate-100 shadow-md p-5 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-teal-50 text-turquesa border border-teal-200">
                                <Users size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-gray-900">Rendimiento & Retención en Cabina</h3>
                                <p className="text-xs text-gray-400">Disciplina de continuidad y saldo de comisiones generado</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/nomina')}
                            className="text-xs font-black text-turquesa hover:text-turquesa/80 flex items-center gap-1 cursor-pointer"
                        >
                            Nómina <ChevronRight size={14} />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl border border-teal-200/50">
                            <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">Tasa de Continuidad</p>
                            <p className="text-2xl font-black text-teal-950 mt-1">{metricasRetencion.porcentaje}%</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">Pacientes con próxima cita agendada</p>
                        </div>
                        <div className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200/50">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Excepciones Cita Única</p>
                            <p className="text-2xl font-black text-amber-950 mt-1">{metricasRetencion.unicas}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">Cerradas sin cita de seguimiento</p>
                        </div>
                    </div>

                    <div className="space-y-2 pt-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Comisiones Acumuladas esta Semana</p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {especialistasStats.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-2">Sin especialistas registradas.</p>
                            ) : (
                                especialistasStats.map((esp) => (
                                    <div key={esp.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-turquesa/20 text-turquesa flex items-center justify-center font-bold text-[10px]">
                                                {esp.nombre.charAt(0)}
                                            </div>
                                            <span className="font-bold text-gray-800">{esp.nombre}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] text-gray-400">{esp.atendidasHoy} cita(s) hoy</span>
                                            <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                                {formatValue(esp.saldoComisiones)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Métricas de Agenda */}
            <section className="space-y-6">
                <div className="flex items-center gap-4 px-2">
                    <div className="h-px flex-1 bg-gray-100" />
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">
                        Métricas de Agenda — {format(selectedDate, "d MMMM", { locale: es })}
                    </h3>
                    <div className="h-px flex-1 bg-gray-100" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-6">
                    {[
                        { label: 'Agendadas', value: kpisAgenda.agendadas, icon: CalendarDays, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200' },
                        { label: 'Atendidas', value: kpisAgenda.atendidas, icon: CalendarCheck, color: 'text-turquesa', bg: 'bg-turquesa/10', border: 'border-turquesa/20' },
                        { label: 'Canceladas', value: kpisAgenda.canceladas, icon: CalendarX, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' },
                        { label: 'Reagendadas', value: kpisAgenda.reagendadas, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
                        { label: 'No Asistió', value: kpisAgenda.noAsistio, icon: UserMinus, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
                    ].map(({ label, value, icon: Icon, color, bg, border }) => (
                        <Card key={label} variant="subtle" className={`group hover:border-inherit ${border} border-dashed cursor-pointer hover:scale-[1.02] transition-transform`} onClick={() => setDetalleModal('agenda_' + label.toLowerCase().replace(/ /g, '_').replace('ó', 'o').replace('í', 'i').replace('Ã³', 'o'))}>
                            <div className="flex flex-col items-center text-center space-y-3">
                                <div className={`p-3 ${bg} ${color} rounded-2xl transition-transform group-hover:scale-110 duration-300`}>
                                    <Icon size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
                                    <h4 className="text-3xl font-black text-gray-900 leading-none">{value}</h4>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Gráfica + Columna lateral */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card
                        title="Evolución del Negocio"
                        subtitle="Comparativo Ingresos vs Gastos — Semana Actual"
                    >
                        <div className="h-[400px] mt-6">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={graficaData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorUtilidad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4682B4" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#4682B4" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={700} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis width={80} stroke="#94a3b8" fontSize={11} fontWeight={700} tickLine={false} axisLine={false} tickFormatter={formatValue} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                        itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                                    />
                                    <Area type="monotone" dataKey="utilidad" stroke="#4682B4" strokeWidth={4} fillOpacity={1} fill="url(#colorUtilidad)" name="Utilidad Neta" />
                                    <Line type="monotone" dataKey="ingresos" stroke="#20B2AA" strokeWidth={3} dot={{ r: 4, fill: '#20B2AA', strokeWidth: 0 }} name="Ingresos" />
                                    <Line type="monotone" dataKey="egresos" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e', strokeWidth: 0 }} name="Egresos" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Card title="Distribución de Gastos" subtitle="Análisis de egresos del mes actual por categoría">
                            {categoriasGraficaData.length === 0 ? (
                                <div className="h-[300px] flex items-center justify-center text-gray-400 italic">No hay gastos registrados en el mes actual.</div>
                            ) : (
                                <div className="h-[320px] w-full mt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={categoriasGraficaData}
                                                cx="50%"
                                                cy="45%"
                                                innerRadius={70}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {categoriasGraficaData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value) => formatValue(value)}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                            />
                                            <Legend verticalAlign="bottom" align="center" layout="horizontal" wrapperStyle={{ fontSize: '12px', fontWeight: 700, paddingTop: '20px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Card>

                        <Card title="Comparativa de Ingresos" subtitle="Mes Actual vs Mes Anterior">
                            <div className="h-[300px] mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={comparativaMensualData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={700} tickLine={false} axisLine={false} dy={10} />
                                        <YAxis width={80} stroke="#94a3b8" fontSize={11} fontWeight={700} tickLine={false} axisLine={false} tickFormatter={formatValue} />
                                        <Tooltip
                                            formatter={(val) => formatValue(val)}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                            cursor={{ fill: '#f8fafc' }}
                                        />
                                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                                        <Bar dataKey="Mes Anterior" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} />
                                        <Bar dataKey="Mes Actual" fill="#20B2AA" radius={[4, 4, 0, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        <Card title="Top Servicios Vendidos" subtitle="Ranking de los más solicitados este mes">
                            {topServiciosData.length === 0 ? (
                                <div className="h-[300px] flex items-center justify-center text-gray-400 italic font-bold">No hay servicios completados este mes.</div>
                            ) : (
                                <div className="h-[300px] mt-4 flex flex-col justify-center gap-4 px-2">
                                    {topServiciosData.map((s, i) => (
                                        <div key={i} className="relative w-full bg-gray-50/80 rounded-2xl overflow-hidden h-12 flex items-center px-4 border border-gray-100/50 hover:scale-[1.02] transition-transform">
                                            <div className="absolute left-0 top-0 h-full rounded-2xl opacity-20 transition-all duration-1000" style={{ width: `${(s.value / maxServicioCount) * 100}%`, backgroundColor: s.color }}></div>
                                            <div className="relative z-10 flex justify-between w-full items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-black text-xs shadow-sm" style={{ backgroundColor: s.color }}>{i + 1}</div>
                                                    <span className="font-black text-acero text-sm">{s.name}</span>
                                                </div>
                                                <span className="font-black text-sm flex items-center gap-1" style={{ color: s.color }}>
                                                    {s.value} <span className="text-[10px] text-gray-400 uppercase tracking-widest ml-1">citas</span>
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>

                        <Card title="Comparativa de Gastos e Inversión" subtitle="Mes Actual vs Mes Anterior">
                            <div className="h-[350px] mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={comparativaGastosData} margin={{ top: 50, right: 10, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={700} tickLine={false} axisLine={false} dy={10} />
                                        <YAxis width={80} stroke="#94a3b8" fontSize={11} fontWeight={700} tickLine={false} axisLine={false} tickFormatter={formatValue} />
                                        <Tooltip
                                            formatter={(val) => formatValue(val)}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                            cursor={{ fill: '#f8fafc' }}
                                        />
                                        <Legend verticalAlign="top" wrapperStyle={{ top: -10, left: 0, fontSize: '11px', fontWeight: 700 }} />

                                        <Bar dataKey="Gasto Anterior" stackId="anterior" fill="#cbd5e1" barSize={30} />
                                        <Bar dataKey="Inversión Anterior" stackId="anterior" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={30} />
                                        <Bar dataKey="Gasto Actual" stackId="actual" fill="#f43f5e" barSize={30} />
                                        <Bar dataKey="Inversión Actual" stackId="actual" fill="#fbbf24" radius={[4, 4, 0, 0]} barSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                </div>


                <div className="space-y-8">
                    <Card title="📈 Proyección Semanal" subtitle="Ingresos esperados por día">
                        <div className="h-[200px] mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={proyeccionGraficaData} margin={{ left: 10 }}>
                                    <Area type="monotone" dataKey="monto" stroke="#20B2AA" fill="#20B2AA" fillOpacity={0.1} strokeWidth={3} />
                                    <Tooltip
                                        formatter={(val) => formatValue(val)}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontWeight={800} />
                                    <YAxis width={60} stroke="#94a3b8" fontSize={10} fontWeight={700} tickLine={false} axisLine={false} tickFormatter={formatValue} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                    <Card title="Evolución de Citas" subtitle="Comportamiento mensual de agenda este año">
                        <div className="h-[250px] mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={evolucionCitasData} margin={{ top: 30, right: 10, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight={700} tickLine={false} axisLine={false} dy={5} />
                                    <YAxis width={40} stroke="#94a3b8" fontSize={10} fontWeight={700} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                        cursor={{ fill: '#f8fafc' }}
                                    />
                                    <Legend verticalAlign="top" wrapperStyle={{ top: -10, left: 0, fontSize: '10px', fontWeight: 700 }} />
                                    <Bar dataKey="completadas" name="Completadas" stackId="citas" fill="#10b981" barSize={12} />
                                    <Bar dataKey="inasistencias" name="Inasistencias" stackId="citas" fill="#f59e0b" barSize={12} />
                                    <Bar dataKey="canceladas" name="Canceladas" stackId="citas" fill="#f43f5e" radius={[2, 2, 0, 0]} barSize={12} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card variant="subtle" className="border-l-4 border-l-turquesa">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-turquesa/10 rounded-2xl">
                                <Users size={32} className="text-turquesa" />
                            </div>
                            <div>
                                <h4 className="text-4xl font-black text-gray-900 leading-none">{pacientesNuevosEsteMes}</h4>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
                                    Pacientes Nuevos ({format(selectedDate, 'MMMM', { locale: es })})
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card title="🎁 Próximos Cumpleaños" variant="subtle">
                        {cumpleanosPacientes.length === 0 ? (
                            <p className="text-sm text-gray-400 italic text-center py-6">No hay cumpleaños cercanos.</p>
                        ) : (
                            <div className="space-y-4">
                                {cumpleanosPacientes.map((paciente) => (
                                    <div key={paciente.id} className="group flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-turquesa/5 text-turquesa rounded-xl group-hover:scale-110 transition-transform"><Gift size={20} /></div>
                                            <div>
                                                <p className="text-sm font-black text-gray-900 leading-tight">{paciente.nombre}</p>
                                                <p className="text-[10px] font-bold text-turquesa uppercase tracking-wider">{paciente.tratamiento || 'Paciente VIP'}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card title="Alertas Críticas" subtitle="Atención inmediata">
                        <div className="space-y-4">
                            {paquetesDuplicados.length > 0 && (
                                <div 
                                    onClick={() => navigate('/financiamientos')} 
                                    className="flex items-start gap-4 p-4 bg-purple-50 hover:bg-purple-100 rounded-2xl border border-purple-200 group cursor-pointer transition-colors shadow-sm"
                                >
                                    <div className="p-2.5 bg-purple-100 group-hover:bg-purple-200 text-purple-700 rounded-xl shrink-0 transition-colors shadow-sm">
                                        <GitMerge size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-purple-700 bg-purple-200/60 px-2 py-0.5 rounded-md">Auditoría</span>
                                            <p className="text-sm font-black text-purple-950 leading-tight">
                                                {paquetesDuplicados.length === 1 
                                                    ? '1 Paciente con Paquetes Duplicados' 
                                                    : `${paquetesDuplicados.length} Pacientes con Paquetes Duplicados`}
                                            </p>
                                        </div>
                                        <p className="text-xs font-semibold text-purple-800 mt-1">
                                            {paquetesDuplicados.map(d => `${d.paciente} (${(d.grupos || []).map(g => g.nombreTratamiento).join(', ')})`).join(' • ')}
                                        </p>
                                        <span className="text-[11px] font-black text-purple-700 underline mt-1.5 block hover:text-purple-950">
                                            Clic para ir a Paquetes y Unificarlos →
                                        </span>
                                    </div>
                                </div>
                            )}
                            {inasistenciasMesCount > 0 && (
                                <div onClick={() => setShowIncidenciasModal('inasistencias')} className="flex items-start gap-4 p-4 bg-amber-50 hover:bg-amber-100 rounded-2xl border border-amber-100 group cursor-pointer transition-colors">
                                    <div className="p-2 bg-amber-100 group-hover:bg-amber-200 text-amber-600 rounded-lg shrink-0 transition-colors"><AlertTriangle size={18} /></div>
                                    <div>
                                        <p className="text-sm font-black text-amber-900 leading-tight">Inasistencias</p>
                                        <p className="text-xs font-medium text-amber-700 mt-1">{inasistenciasMesCount} paciente(s) sin contactar este mes.</p>
                                    </div>
                                </div>
                            )}
                            {cancelacionesMesCount > 0 && (
                                <div onClick={() => setShowIncidenciasModal('cancelaciones')} className="flex items-start gap-4 p-4 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-100 group cursor-pointer transition-colors">
                                    <div className="p-2 bg-rose-100 group-hover:bg-rose-200 text-rose-500 rounded-lg shrink-0 transition-colors"><CalendarX size={18} /></div>
                                    <div>
                                        <p className="text-sm font-black text-rose-900 leading-tight">Cancelaciones</p>
                                        <p className="text-xs font-medium text-rose-700 mt-1">{cancelacionesMesCount} cita(s) cancelada(s) este mes.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Modal de Incidencias */}
            {showIncidenciasModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-acero/70 backdrop-blur-xl p-4 animate-in fade-in duration-500" onClick={() => setShowIncidenciasModal(null)}>
                    <div className="bg-white rounded-[2rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-20 duration-700 border border-white/20 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                        <div className={`p-6 flex justify-between items-center text-white ${showIncidenciasModal === 'inasistencias' ? 'bg-amber-500' : 'bg-rose-500'}`}>
                            <div>
                                <h3 className="font-black text-2xl tracking-tighter flex items-center gap-3">
                                    {showIncidenciasModal === 'inasistencias' ? <AlertTriangle size={24} /> : <CalendarX size={24} />}
                                    {showIncidenciasModal === 'inasistencias' ? 'Inasistencias del Mes' : 'Cancelaciones del Mes'}
                                </h3>
                                <p className="text-white/80 font-bold text-xs mt-1">
                                    {incidenciasLista.length} paciente(s) encontrado(s) en este mes.
                                </p>
                            </div>
                            <button onClick={() => setShowIncidenciasModal(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"><X size={24} /></button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar-agenda flex-1 bg-gray-50/50">
                            {incidenciasLista.length === 0 ? (
                                <p className="text-center text-gray-400 italic py-8 font-bold">No hay registros este mes.</p>
                            ) : (
                                <div className="space-y-3">
                                    {incidenciasLista.map(cita => (
                                        <div key={cita.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-gray-200 transition-colors">
                                            <div>
                                                <p className="font-black text-acero text-lg leading-tight">{cita.pacienteNombre || cita.paciente}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs font-bold text-gray-400 flex items-center gap-1"><Clock size={12} /> {format(new Date(cita.fechaHora || cita.fecha || new Date()), "dd MMM yyyy", { locale: es })}</span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-turquesa bg-turquesa/10 px-2 py-0.5 rounded-full">{cita.servicio || 'Consulta'}</span>
                                                </div>
                                            </div>
                                            <div className="text-left sm:text-right w-full sm:w-auto mt-2 sm:mt-0 bg-gray-50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Teléfono de Contacto</p>
                                                <p className="font-bold text-acero text-sm">{cita.telefono || 'Sin teléfono registrado'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Detalle de Tarjetas */}
            {detalleModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-acero/70 backdrop-blur-xl p-4 animate-in fade-in duration-500" onClick={() => setDetalleModal(null)}>
                    <div className="bg-white rounded-[2rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-20 duration-700 border border-white/20 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                        <div className={`p-6 flex justify-between items-center text-white ${
                            detalleModal === 'ingreso_estimado' ? 'bg-turquesa' : 
                            detalleModal === 'ingreso_semanal' ? 'bg-turquesa/80' : 
                            detalleModal === 'ingreso_semanal_real' ? 'bg-turquesa' :
                            detalleModal === 'gasto_semanal' ? 'bg-red-500' :
                            detalleModal?.startsWith('agenda_') ? 'bg-indigo-500' :
                            detalleModal === 'corte_real' ? 'bg-emerald-500' : 'bg-red-500'
                        }`}>
                            <div>
                                <h3 className="font-black text-2xl tracking-tighter flex items-center gap-3">
                                    {detalleModal === 'ingreso_estimado' && <TrendingUp size={24} />}
                                    {detalleModal === 'ingreso_semanal' && <Coins size={24} />}
                                    {detalleModal === 'ingreso_semanal_real' && <TrendingUp size={24} />}
                                    {detalleModal === 'gasto_semanal' && <TrendingDown size={24} />}
                                    {detalleModal === 'corte_real' && <TrendingUp size={24} />}
                                    {detalleModal === 'fuga' && <TrendingDown size={24} />}
                                    {detalleModal?.startsWith('agenda_') && <CalendarDays size={24} />}
                                    
                                    {detalleModal === 'ingreso_estimado' && 'Detalle: Ingreso Estimado Hoy'}
                                    {detalleModal === 'ingreso_semanal' && 'Detalle: Ingreso Est. Semanal'}
                                    {detalleModal === 'ingreso_semanal_real' && 'Detalle: Ingreso Semanal Real'}
                                    {detalleModal === 'gasto_semanal' && 'Detalle: Gasto Semanal'}
                                    {detalleModal === 'corte_real' && 'Detalle: Corte Real Hoy'}
                                    {detalleModal === 'fuga' && 'Detalle: Fuga Detectada'}
                                    {detalleModal === 'agenda_agendadas' && 'Agenda: Agendadas Hoy'}
                                    {detalleModal === 'agenda_atendidas' && 'Agenda: Atendidas Hoy'}
                                    {detalleModal === 'agenda_canceladas' && 'Agenda: Canceladas Hoy'}
                                    {detalleModal === 'agenda_reagendadas' && 'Agenda: Reagendadas Hoy'}
                                    {detalleModal === 'agenda_no_asisti' && 'Agenda: No Asistió Hoy'}
                                </h3>
                                <p className="text-white/80 font-bold text-xs mt-1">
                                    {detalleModal === 'ingreso_estimado' && `${citasDelDia.filter(c => c.status !== 'Cancelada' && !c.status?.includes('No Asisti')).length} citas activas hoy`}
                                    {detalleModal === 'ingreso_semanal' && `${citasSemana.filter(c => c.status !== 'Cancelada' && !c.status?.includes('No Asisti')).length} citas activas esta semana`}
                                    {detalleModal === 'corte_real' && `${movsValidos.filter(m => m.tipo === 'Ingreso' && (m.createdAt || m.fecha || '').startsWith(selStr)).length} cobros realizados hoy`}
                                    {detalleModal === 'fuga' && `${citasDelDia.filter(c => c.status === 'Cancelada' || c.status?.includes('No Asisti')).length} inasistencias o cancelaciones hoy`}
                                    {detalleModal === 'ingreso_semanal_real' && `${movsValidos.filter(m => m.tipo === 'Ingreso' && checkIsThisWeek(m.createdAt || m.fecha)).length} cobros registrados en la semana`}
                                    {detalleModal === 'gasto_semanal' && `${movsValidos.filter(m => m.tipo === 'Egreso' && checkIsThisWeek(m.createdAt || m.fecha)).length} egresos registrados en la semana`}
                                    {detalleModal?.startsWith('agenda_') && 'Citas programadas para la fecha seleccionada'}
                                </p>
                            </div>
                            <button onClick={() => setDetalleModal(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"><X size={24} /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar-agenda flex-1 bg-gray-50/50">
                            <div className="space-y-3">
                                {detalleModal === 'ingreso_estimado' && citasDelDia.filter(c => c.status !== 'Cancelada' && !c.status?.includes('No Asisti')).map(cita => {
                                    const local = labPrices[cita.id];
                                    const precio = Number(cita.precio || local?.precio || 0);
                                    return (
                                        <div key={cita.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center hover:border-gray-200 transition-colors">
                                            <div>
                                                <p className="font-black text-acero text-lg leading-tight">{cita.pacienteNombre || cita.paciente}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-turquesa bg-turquesa/10 px-2 py-0.5 rounded-full">{cita.servicio || 'Consulta'}</span>
                                                    <span className="text-xs font-bold text-gray-400">{cita.hora || 'Sin hora'}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black text-turquesa">{formatValue(precio)}</p>
                                            </div>
                                        </div>
                                    );
                                })}

                                {detalleModal === 'ingreso_semanal' && citasSemana.filter(c => c.status !== 'Cancelada' && !c.status?.includes('No Asisti')).map(cita => {
                                    const local = labPrices[cita.id];
                                    const precio = Number(cita.precio || local?.precio || 0);
                                    return (
                                        <div key={cita.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center hover:border-gray-200 transition-colors">
                                            <div>
                                                <p className="font-black text-acero text-lg leading-tight">{cita.pacienteNombre || cita.paciente}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-turquesa bg-turquesa/10 px-2 py-0.5 rounded-full">{cita.servicio || 'Consulta'}</span>
                                                    <span className="text-xs font-bold text-gray-400">{format(new Date(cita.fechaHora || cita.fecha), "dd MMM", { locale: es })}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black text-turquesa">{formatValue(precio)}</p>
                                            </div>
                                        </div>
                                    );
                                })}

                                {detalleModal === 'ingreso_semanal_real' && Object.entries(
                                    movsValidos.filter(m => m.tipo === 'Ingreso' && checkIsThisWeek(m.createdAt || m.fecha))
                                    .reduce((acc, mov) => {
                                        const dateStr = new Date(mov.createdAt || mov.fecha).toLocaleDateString();
                                        if(!acc[dateStr]) acc[dateStr] = [];
                                        acc[dateStr].push(mov);
                                        return acc;
                                    }, {})
                                ).sort((a, b) => {
                                    const dateA = a[1][0] ? new Date(a[1][0].createdAt || a[1][0].fecha) : new Date(0);
                                    const dateB = b[1][0] ? new Date(b[1][0].createdAt || b[1][0].fecha) : new Date(0);
                                    return dateB - dateA;
                                }).map(([date, movs]) => (
                                    <div key={date} className="mb-6">
                                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <CalendarDays size={16} /> {date}
                                        </h4>
                                        <div className="space-y-3">
                                            {movs.map(mov => (
                                                <div key={mov.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center hover:border-gray-200 transition-colors">
                                                    <div>
                                                        <p className="font-black text-acero text-lg leading-tight">{mov.pacienteNombre || 'Cliente General'}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Badge variant="subtle" className="bg-turquesa/10 text-turquesa border-none">{mov.metodoPago || 'Efectivo'}</Badge>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xl font-black text-emerald-600">{formatValue(mov.monto)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {detalleModal === 'gasto_semanal' && Object.entries(
                                    movsValidos.filter(m => m.tipo === 'Egreso' && checkIsThisWeek(m.createdAt || m.fecha))
                                    .reduce((acc, mov) => {
                                        const dateStr = new Date(mov.createdAt || mov.fecha).toLocaleDateString();
                                        if(!acc[dateStr]) acc[dateStr] = [];
                                        acc[dateStr].push(mov);
                                        return acc;
                                    }, {})
                                ).sort((a, b) => {
                                    const dateA = a[1][0] ? new Date(a[1][0].createdAt || a[1][0].fecha) : new Date(0);
                                    const dateB = b[1][0] ? new Date(b[1][0].createdAt || b[1][0].fecha) : new Date(0);
                                    return dateB - dateA;
                                }).map(([date, movs]) => (
                                    <div key={date} className="mb-6">
                                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <CalendarDays size={16} /> {date}
                                        </h4>
                                        <div className="space-y-3">
                                            {movs.map(mov => (
                                                <div key={mov.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center hover:border-gray-200 transition-colors">
                                                    <div>
                                                        <p className="font-black text-acero text-lg leading-tight">{mov.motivo || 'Gasto Operativo'}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Badge variant="subtle" className="bg-red-50 text-red-500 border-none">{mov.categoria || 'Gasto'}</Badge>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xl font-black text-red-500">-{formatValue(mov.monto)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {detalleModal === 'corte_real' && movsValidos.filter(m => m.tipo === 'Ingreso' && (m.createdAt || m.fecha || '').startsWith(selStr)).map(mov => (
                                    <div key={mov.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center hover:border-gray-200 transition-colors">
                                        <div>
                                            <p className="font-black text-acero text-lg leading-tight">{mov.pacienteNombre || 'Cliente General'}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="subtle" className="bg-turquesa/10 text-turquesa border-none">{mov.metodoPago || 'Efectivo'}</Badge>
                                                <span className="text-xs text-gray-400 font-bold">{mov.createdAt ? new Date(mov.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-black text-emerald-600">{formatValue(mov.monto)}</p>
                                        </div>
                                    </div>
                                ))}

                                {detalleModal === 'fuga' && citasDelDia.filter(c => c.status === 'Cancelada' || c.status?.includes('No Asisti')).map(cita => {
                                    const local = labPrices[cita.id];
                                    const precio = Number(cita.precio || local?.precio || 0);
                                    return (
                                        <div key={cita.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center hover:border-gray-200 transition-colors">
                                            <div>
                                                <p className="font-black text-acero text-lg leading-tight">{cita.pacienteNombre || cita.paciente}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${cita.status === 'Cancelada' ? 'text-red-500 bg-red-50' : 'text-purple-600 bg-purple-50'}`}>{cita.status}</span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-turquesa bg-turquesa/10 px-2 py-0.5 rounded-full">{cita.servicio || 'Consulta'}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-black text-red-500">{formatValue(precio)}</p>
                                            </div>
                                        </div>
                                    );
                                })}

                                {detalleModal?.startsWith('agenda_') && citasDelDia.filter(c => {
                                    if (detalleModal === 'agenda_agendadas') return true;
                                    if (detalleModal === 'agenda_atendidas') return c.status === 'Completada';
                                    if (detalleModal === 'agenda_canceladas') return c.status === 'Cancelada';
                                    if (detalleModal === 'agenda_reagendadas') return c.status === 'Reagendada';
                                    if (detalleModal?.includes('no_asisti')) return c.status?.includes('No Asisti');
                                    return false;
                                }).map(cita => (
                                    <div key={cita.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center hover:border-gray-200 transition-colors">
                                        <div>
                                            <p className="font-black text-acero text-lg leading-tight">{cita.pacienteNombre || cita.paciente || 'Paciente No Registrado'}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="subtle" className="bg-indigo-50 text-indigo-500 border-none">{cita.motivoConsulta || 'Consulta'}</Badge>
                                                <span className="text-xs text-gray-400 font-bold">{cita.hora}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="subtle" className={
                                                cita.status === 'Completada' ? 'bg-turquesa/10 text-turquesa border-none' :
                                                cita.status === 'Cancelada' ? 'bg-red-50 text-red-500 border-none' :
                                                cita.status === 'Reagendada' ? 'bg-amber-50 text-amber-600 border-none' :
                                                cita.status?.includes('No Asisti') ? 'bg-purple-50 text-purple-600 border-none' :
                                                'bg-gray-100 text-gray-600 border-none'
                                            }>{cita.status || 'Agendada'}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


