import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
    DollarSign, CheckCircle, CreditCard, Banknote, Building2,
    Loader, RefreshCw, TrendingUp, TrendingDown, Calendar,
    FileText, ChevronDown, ChevronUp, Printer, ArrowLeft, ArrowRight,
    Calculator, AlertTriangle, PlusCircle, ShieldCheck, Wallet, Download, Tag,
    Copy, Check, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths,
    isWithinInterval, parseISO, isSameDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
    onMovimientosChange,
    onCajasDiariasChange,
    construirCortesPorDia,
    aprobarCorteDefinitivo,
    getCortesAprobados,
    guardarCajaDiaria,
    registrarMovimiento,
    CATALOGO_CATEGORIAS_GASTO,
    DENOMINACIONES_ARQUEO,
    obtenerCatalogoGastosCompleto,
    agregarMotivoPersonalizadoGasto,
    normalizarCategoriaGasto,
    esGastoDeCajaDelDia,
    toLocalISOString,
} from '../../services/finanzasService';
import { onCitasChange } from '../../services/citasService';
import { onSesionesChange, auditarExpedientesPorDia } from '../../services/tratamientosService';
import { onSeguimientosChange } from '../../services/seguimientoService';
import { onStaffChange } from '../../services/staffService';
import { onPacientesChange } from '../../services/pacientesService';
import { useAuth } from '../../contexts/AuthContext';
import jsPDF from 'jspdf';
import { guardarPdfNativo } from '../../services/nativeDownloadService';
import autoTable from 'jspdf-autotable';
import { LOGO_ALFRA_BASE64 } from '../../assets/logoAlfraBase64';

const formatCurrency = (amount) =>
    `$${Number(amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function MetodoPagoCard({ icon: Icon, label, monto, sublabel, color, bg }) {
    return (
        <div className={`flex items-center gap-3 p-4 rounded-2xl ${bg} border border-${color}-100`}>
            <div className={`p-2.5 bg-${color}-100 text-${color}-600 rounded-xl`}>
                <Icon size={20} />
            </div>
            <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">{label}</p>
                <p className="text-lg font-black text-gray-900">{formatCurrency(monto)}</p>
                {sublabel && <p className="text-[11px] text-gray-500">{sublabel}</p>}
            </div>
        </div>
    );
}

// ─── Fila desplegable de cada día (Alineada 100% con Recepción) ─────────────
function FilaDia({
    corte,
    citasDia,
    auditoriaExpedientes,
    isAprobado,
    defaultOpen,
    onAbrirAprobarModal,
    onAbrirArqueoModal,
    onAbrirGastoModal,
    onCopiarMensaje,
    copiedKey,
    navigate,
}) {
    const [open, setOpen] = useState(defaultOpen);

    useEffect(() => {
        setOpen(defaultOpen);
    }, [defaultOpen]);

    const ingresos = corte.ingresosTotales || 0;
    const egresos = corte.egresosTotales || 0;
    const utilidad = ingresos - egresos;

    // Conciliación Agenda vs Caja del día
    const citasCompletadas = (citasDia || []).filter((c) => c.status === 'Completada');
    const pacientesCobrados = new Set(
        (corte.movimientos || [])
            .filter((m) => m.tipo === 'Ingreso' && m.estado !== 'Cancelado')
            .map((m) => String(m.pacienteNombre || '').trim().toLowerCase())
    );
    const citasSinCobro = citasCompletadas.filter((c) => {
        const nom = String(c.pacienteNombre || c.paciente || '').trim().toLowerCase();
        return nom && !pacientesCobrados.has(nom);
    });

    const categoriasEgresosEntries = Object.entries(corte.egresosPorCategoria || {}).sort((a, b) => b[1] - a[1]);

    return (
        <div
            className={`rounded-2xl border ${
                isAprobado ? 'border-emerald-200 bg-emerald-50/15' : 'border-amber-200 bg-amber-50/10'
            } overflow-hidden transition-all shadow-sm`}
        >
            {/* Header del día */}
            <button
                className="w-full flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 p-5 hover:bg-black/[0.02] transition-colors"
                onClick={() => setOpen((v) => !v)}
            >
                <div className="flex items-center gap-3 flex-wrap">
                    <div className={`p-2.5 rounded-xl ${isAprobado ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                        <Calendar size={18} className={isAprobado ? 'text-emerald-600' : 'text-amber-600'} />
                    </div>
                    <div className="text-left">
                        <p className="font-black text-gray-900 text-base">{corte.fecha}</p>
                        <p className="text-xs text-gray-500">
                            {corte.movimientos?.length || 0} movimiento(s) • Efectivo en Cajón:{' '}
                            <strong className="text-emerald-700">{formatCurrency(corte.efectivoEsperadoEnCajon)}</strong>
                        </p>
                    </div>
                    {isAprobado ? (
                        <Badge variant="green">Auditado y Sellado ✓</Badge>
                    ) : corte.entregadoRecepcion ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                            Arqueo Recepción Entregado
                        </span>
                    ) : (
                        <Badge variant="yellow">Pendiente Cierre</Badge>
                    )}
                    {citasSinCobro.length > 0 && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                            <AlertTriangle size={12} /> {citasSinCobro.length} cita(s) sin cobro
                        </span>
                    )}
                    {auditoriaExpedientes?.sinActualizar?.length > 0 && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 animate-pulse">
                            <AlertTriangle size={12} /> 🚨 {auditoriaExpedientes.sinActualizar.length} expediente(s) sin actualizar
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-5 flex-wrap w-full lg:w-auto justify-between lg:justify-end">
                    <div className="text-right">
                        <p className="text-[11px] text-gray-400 font-bold uppercase">Ingresos</p>
                        <p className="text-lg font-black text-emerald-600">{formatCurrency(ingresos)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[11px] text-gray-400 font-bold uppercase">Gastos</p>
                        <p className="text-lg font-black text-rose-500">{formatCurrency(egresos)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[11px] text-gray-400 font-bold uppercase">Efectivo Cajón</p>
                        <p className="text-lg font-black text-teal-700">{formatCurrency(corte.efectivoEsperadoEnCajon)}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                        <p className="text-[11px] text-gray-400 font-bold uppercase">Utilidad Día</p>
                        <p className={`text-lg font-black ${utilidad >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                            {formatCurrency(utilidad)}
                        </p>
                    </div>
                    {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
            </button>

            {/* Detalle expandido */}
            {open && (
                <div className="px-5 pb-5 space-y-5 border-t border-gray-100 bg-white">
                    {/* 1. Ecuación del Cajón de Efectivo vs Arqueo Físico de Recepción */}
                    <div className="pt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Wallet size={15} className="text-turquesa" /> Cuadre Exacto del Cajón de Efectivo (Recepción → Admin)
                                </h4>
                                <button
                                    onClick={() => onAbrirGastoModal(corte.fecha)}
                                    className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
                                >
                                    <PlusCircle size={13} /> Registrar Gasto en este Día
                                </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                                <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Fondo Inicial</p>
                                    <p className="text-sm font-black text-gray-800">{formatCurrency(corte.fondoInicial)}</p>
                                </div>
                                <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase">+ Cobros Efectivo</p>
                                    <p className="text-sm font-black text-emerald-600">{formatCurrency(corte.ingresosEfectivo)}</p>
                                </div>
                                <div className="bg-white p-2.5 rounded-xl border border-rose-200">
                                    <p className="text-[10px] font-bold text-rose-500 uppercase">− Gastos de Caja</p>
                                    <p className="text-sm font-black text-rose-600">{formatCurrency(corte.egresosEfectivoCaja)}</p>
                                </div>
                                <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                                    <p className="text-[10px] font-bold text-amber-600 uppercase">− Retiros Admin</p>
                                    <p className="text-sm font-black text-amber-600">{formatCurrency(corte.totalRetiros)}</p>
                                </div>
                                <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-sm col-span-2 sm:col-span-1">
                                    <p className="text-[10px] font-bold uppercase opacity-90">= Esperado Cajón</p>
                                    <p className="text-sm font-black">{formatCurrency(corte.efectivoEsperadoEnCajon)}</p>
                                </div>
                            </div>

                            {corte.retirosEfectivo?.length > 0 && (
                                <div className="text-xs text-amber-800 bg-amber-50/80 px-3 py-2 rounded-xl border border-amber-200">
                                    <strong>Retiros parciales del día:</strong>{' '}
                                    {corte.retirosEfectivo
                                        .map((r) => `${r.concepto} (${formatCurrency(r.monto)} a las ${r.hora || '—'})`)
                                        .join(' • ')}
                                </div>
                            )}
                        </div>

                        {/* Tarjeta Arqueo Físico Recepción */}
                        <div className="p-4 rounded-2xl border border-gray-200 bg-white flex flex-col justify-between space-y-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-black text-acero uppercase flex items-center gap-1.5">
                                        <Calculator size={15} className="text-turquesa" /> Arqueo Físico (Billetes/Monedas)
                                    </span>
                                    {corte.entregadoRecepcion && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                            Por: {corte.entregadoPor || 'Recepción'}
                                        </span>
                                    )}
                                </div>

                                {corte.contadoFisico !== null ? (
                                    <div className="space-y-1.5 mt-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500">Contado Físicamente:</span>
                                            <strong className="text-gray-900">{formatCurrency(corte.contadoFisico)}</strong>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500">Diferencia vs Esperado:</span>
                                            {Math.abs(corte.diferenciaArqueo || 0) < 0.5 ? (
                                                <strong className="text-emerald-600">✓ Cuadre Exacto ($0.00)</strong>
                                            ) : corte.diferenciaArqueo > 0 ? (
                                                <strong className="text-blue-600">Sobrante +{formatCurrency(corte.diferenciaArqueo)}</strong>
                                            ) : (
                                                <strong className="text-rose-600">Faltante {formatCurrency(corte.diferenciaArqueo)}</strong>
                                            )}
                                        </div>
                                        {corte.notasRecepcion && (
                                            <p className="text-[11px] text-gray-500 italic bg-gray-50 p-2 rounded-lg mt-1">
                                                "{corte.notasRecepcion}"
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 mt-2">
                                        Recepción aún no ha capturado el conteo de billetes y monedas de este día.
                                    </p>
                                )}
                            </div>

                            <Button
                                variant="outline"
                                icon={Calculator}
                                onClick={() => onAbrirArqueoModal(corte)}
                                className="w-full text-xs py-1.5"
                            >
                                {corte.contadoFisico !== null ? 'Ver / Editar Desglose de Billetes' : 'Capturar Arqueo Físico'}
                            </Button>
                        </div>
                    </div>

                    {/* 2. Métodos de pago captados */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <MetodoPagoCard
                            icon={Banknote}
                            label="Ingresos en Efectivo"
                            monto={corte.ingresosEfectivo}
                            sublabel={`Neto tras gastos de caja: ${formatCurrency(corte.efectivo)}`}
                            color="green"
                            bg="bg-green-50/50"
                        />
                        <MetodoPagoCard
                            icon={CreditCard}
                            label="Ingresos con Tarjeta"
                            monto={corte.ingresosTarjeta}
                            sublabel="Verificar vouchers en terminal"
                            color="blue"
                            bg="bg-blue-50/50"
                        />
                        <MetodoPagoCard
                            icon={Building2}
                            label="Ingresos Transferencia"
                            monto={corte.ingresosTransferencia}
                            sublabel="Verificar en cuenta bancaria"
                            color="purple"
                            bg="bg-purple-50/50"
                        />
                    </div>

                    {/* 3. Resumen de Gastos del Día por Categoría Obligatoria */}
                    {categoriasEgresosEntries.length > 0 && (
                        <div className="p-4 rounded-2xl bg-rose-50/40 border border-rose-100 space-y-2.5">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Tag size={14} /> Desglose de Gastos del Día por Categoría Obligatoria
                                </h4>
                                <span className="text-xs font-bold text-gray-600">
                                    De Caja: <strong className="text-rose-600">{formatCurrency(corte.egresosEfectivoCaja)}</strong>
                                    {' • '}
                                    Otros Medios: <strong className="text-gray-800">{formatCurrency(corte.egresosOtrosMedios)}</strong>
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {categoriasEgresosEntries.map(([cat, montoCat]) => (
                                    <div
                                        key={cat}
                                        className="px-3 py-1.5 bg-white rounded-xl border border-rose-200 flex items-center gap-2 text-xs shadow-sm"
                                    >
                                        <span className="font-bold text-gray-700">{cat}:</span>
                                        <span className="font-black text-rose-600">{formatCurrency(montoCat)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 4. Semáforo de Conciliación Agenda vs Caja */}
                    {citasSinCobro.length > 0 && (
                        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                                <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                                <div className="text-xs text-amber-900">
                                    <strong>Atención en Conciliación Agenda vs. Caja:</strong> Se encontraron{' '}
                                    <strong>{citasSinCobro.length}</strong> cita(s) marcada(s) como Completada sin cobro registrado en este día:{' '}
                                    {citasSinCobro.map((c) => `${c.pacienteNombre || c.paciente} (${c.servicio || 'Consulta'})`).join(', ')}.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4.B Reporte de Expedientes Clínicos NO Actualizados al Día (Específico por Especialista y su Paciente) */}
                    {auditoriaExpedientes?.sinActualizar?.length > 0 ? (
                        <div className="p-4 rounded-2xl bg-red-50/90 border-2 border-red-200 space-y-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={20} className="text-red-600 shrink-0" />
                                <div>
                                    <h4 className="text-xs sm:text-sm font-black text-red-800 uppercase tracking-tight">
                                        🚨 Reporte de Expedientes Clínicos No Actualizados al Día ({corte.fecha})
                                    </h4>
                                    <p className="text-xs text-red-700">
                                        Se detectaron <strong>{auditoriaExpedientes.sinActualizar.length}</strong> cita(s) del día sin registro de sesión ni actualización en el expediente clínico, desglosadas específicamente por especialista:
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                {auditoriaExpedientes.porEspecialista.map((grupo, idx) => {
                                    const copyId = `esp-${corte.fecha}-${idx}`;
                                    return (
                                        <div key={idx} className="bg-white p-3.5 rounded-xl border border-red-200 shadow-sm space-y-2">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div>
                                                    <span className="text-xs font-black text-acero uppercase">
                                                        👩‍⚕️ Especialista: <span className="text-red-700">{grupo.especialista}</span>
                                                    </span>
                                                    <p className="text-xs text-gray-700 mt-0.5">
                                                        Paciente(s) asignado(s) sin actualizar hoy:{' '}
                                                        <strong className="text-red-700">{grupo.listaPacientes}</strong>
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => onCopiarMensaje(grupo.mensaje, copyId)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                                                        copiedKey === copyId
                                                            ? 'bg-emerald-600 text-white'
                                                            : 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                                                    }`}
                                                >
                                                    {copiedKey === copyId ? <Check size={13} /> : <Copy size={13} />}
                                                    {copiedKey === copyId ? '¡Copiado al portapapeles!' : `Copiar Mensaje para ${grupo.especialista}`}
                                                </button>
                                            </div>
                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700 select-all">
                                                "{grupo.mensaje}"
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                {grupo.citas.map((c, cIdx) => {
                                                    const copyPacId = `pac-${corte.fecha}-${idx}-${cIdx}`;
                                                    return (
                                                        <div key={c.id || cIdx} className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => c.pacienteId && navigate(`/especialista/expediente/${c.pacienteId}`)}
                                                                className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 cursor-pointer"
                                                            >
                                                                <ExternalLink size={11} /> Expediente: {c.pacienteNombreLimpio} ({c.servicio || 'Cita'})
                                                            </button>
                                                            {grupo.citas.length > 1 && c.mensajeIndividual && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onCopiarMensaje(c.mensajeIndividual, copyPacId)}
                                                                    className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border cursor-pointer ${
                                                                        copiedKey === copyPacId
                                                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                                                            : 'bg-white text-gray-600 hover:text-red-700 border-gray-200'
                                                                    }`}
                                                                    title={`Copiar mensaje solo de ${c.pacienteNombreLimpio}`}
                                                                >
                                                                    {copiedKey === copyPacId ? <Check size={10} /> : <Copy size={10} />}
                                                                    {copiedKey === copyPacId ? 'Copiado' : 'Mensaje individual'}
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
                        </div>
                    ) : auditoriaExpedientes?.totalCitas > 0 ? (
                        <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 font-bold">
                            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                            <span>
                                Auditoría Clínica al Día: Los {auditoriaExpedientes.totalCitas} expediente(s) de las citas programadas en esta fecha fueron actualizados correctamente.
                            </span>
                        </div>
                    ) : null}

                    {/* 5. Tabla de Movimientos del Día (con Categoría, Quién Registró y Método) */}
                    {corte.movimientos?.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="text-left p-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Hora</th>
                                        <th className="text-left p-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Concepto / Paciente / Proveedor</th>
                                        <th className="text-left p-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Categoría Oficial</th>
                                        <th className="text-left p-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Método / Origen</th>
                                        <th className="text-left p-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Tipo</th>
                                        <th className="text-right p-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {corte.movimientos.map((m, i) => {
                                        const catOficial = m.tipo === 'Egreso' ? normalizarCategoriaGasto(m) : m.categoria || 'Servicios y Consultas';
                                        const afectaCaja = m.tipo === 'Egreso' && esGastoDeCajaDelDia(m);
                                        return (
                                            <tr
                                                key={m.id || i}
                                                className={`hover:bg-slate-50 transition-colors ${
                                                    m.estado === 'Cancelado' ? 'opacity-40 line-through' : ''
                                                }`}
                                            >
                                                <td className="p-3 text-gray-400 font-mono text-xs">
                                                    {m.createdAt ? format(parseISO(m.createdAt), 'HH:mm') : '—'}
                                                </td>
                                                <td className="p-3 text-gray-800 font-medium max-w-[260px]">
                                                    <div className="truncate font-bold">{m.motivo || m.concepto || 'Sin concepto'}</div>
                                                    <div className="text-[11px] text-gray-400 truncate">
                                                        {m.pacienteNombre ? `Paciente: ${m.pacienteNombre}` : ''}
                                                        {m.proveedor ? `Proveedor/Nota: ${m.proveedor}` : ''}
                                                        {m.registradoPor ? ` • Reg: ${m.registradoPor}` : ''}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <span
                                                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                                            m.tipo === 'Egreso'
                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                : 'bg-teal-50 text-teal-700'
                                                        }`}
                                                    >
                                                        {catOficial}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-xs text-gray-600">
                                                    <span className="font-semibold block">{m.metodoPago || 'Efectivo'}</span>
                                                    {afectaCaja && (
                                                        <span className="text-[10px] text-rose-600 font-bold">Descuenta de Caja del Día</span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <span
                                                        className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                                            m.tipo === 'Ingreso'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-rose-100 text-rose-700'
                                                        }`}
                                                    >
                                                        {m.tipo}
                                                    </span>
                                                </td>
                                                <td
                                                    className={`p-3 text-right font-black ${
                                                        m.tipo === 'Ingreso' ? 'text-emerald-600' : 'text-rose-500'
                                                    }`}
                                                >
                                                    {m.tipo === 'Egreso' ? '−' : '+'}
                                                    {formatCurrency(m.monto)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* 6. Información de Cierre Aprobado o Botón Sellar */}
                    {isAprobado && corte.cierreAdmin ? (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-900">
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                                <div>
                                    <strong>Corte Auditado y Sellado por Administración</strong>
                                    <p className="text-emerald-700">
                                        Efectivo retirado a resguardo: <strong>{formatCurrency(corte.cierreAdmin.efectivoRetiradoAdmin)}</strong>
                                        {' • '}
                                        Fondo dejado para el día siguiente: <strong>{formatCurrency(corte.cierreAdmin.fondoDejadoManana)}</strong>
                                        {corte.cierreAdmin.notasAdmin ? ` • Nota: "${corte.cierreAdmin.notasAdmin}"` : ''}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-end gap-3 pt-2">
                            <Button
                                variant="outline"
                                icon={PlusCircle}
                                onClick={() => onAbrirGastoModal(corte.fecha)}
                                className="border-rose-200 text-rose-600 hover:bg-rose-50"
                            >
                                Agregar Gasto al Corte
                            </Button>
                            {!isAprobado && (
                                <Button
                                    variant="primary"
                                    icon={CheckCircle}
                                    onClick={() => onAbrirAprobarModal(corte)}
                                    className="bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    Sellar y Aprobar Corte
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL: CORTE DE CAJA DEL ADMINISTRADOR
// ═══════════════════════════════════════════════════════════════════════════
export default function CorteCajaGlobal() {
    const navigate = useNavigate();
    const [movimientos, setMovimientos] = useState([]);
    const [cajasMap, setCajasMap] = useState({});
    const [citas, setCitas] = useState([]);
    const [sesiones, setSesiones] = useState([]);
    const [seguimientos, setSeguimientos] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [pacientesList, setPacientesList] = useState([]);
    const [copiedKey, setCopiedKey] = useState('');
    const [loading, setLoading] = useState(true);
    const [aprobados, setAprobados] = useState({});
    const [vista, setVista] = useState('dia'); // 'dia' | 'semana' | 'mes'
    const [fechaRef, setFechaRef] = useState(new Date());
    const printRef = useRef(null);
    const { userRole, currentUser } = useAuth();

    const handleCopiarMensaje = async (texto, key) => {
        try {
            await navigator.clipboard.writeText(texto);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(''), 3000);
        } catch {
            // Fallback para navegadores sin clipboard API directa
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

    // Catálogo unificado de gastos para registrar desde Corte de Caja
    const [catalogoGastos, setCatalogoGastos] = useState(CATALOGO_CATEGORIAS_GASTO);
    const [modalGastoOpen, setModalGastoOpen] = useState(false);
    const [fechaGastoCorte, setFechaGastoCorte] = useState(toLocalISOString().split('T')[0]);
    const [categoriaGasto, setCategoriaGasto] = useState(CATALOGO_CATEGORIAS_GASTO[0].nombre);
    const [motivoGasto, setMotivoGasto] = useState(CATALOGO_CATEGORIAS_GASTO[0].motivos[0]);
    const [detalleGastoExtra, setDetalleGastoExtra] = useState('');
    const [proveedorGasto, setProveedorGasto] = useState('');
    const [montoGasto, setMontoGasto] = useState('');
    const [metodoGasto, setMetodoGasto] = useState('Efectivo en Caja');
    const [savingGasto, setSavingGasto] = useState(false);
    const [nuevoMotivoCustom, setNuevoMotivoCustom] = useState('');
    const [showInputMotivoCustom, setShowInputMotivoCustom] = useState(false);

    // Modal Arqueo Físico desde Admin
    const [modalArqueoCorte, setModalArqueoCorte] = useState(null);
    const [conteoDenominaciones, setConteoDenominaciones] = useState({});
    const [notasArqueoAdmin, setNotasArqueoAdmin] = useState('');
    const [savingArqueo, setSavingArqueo] = useState(false);

    // Modal Sellar y Aprobar Corte Definitivo
    const [modalSellarCorte, setModalSellarCorte] = useState(null);
    const [efectivoRetiradoAdmin, setEfectivoRetiradoAdmin] = useState('');
    const [fondoDejadoManana, setFondoDejadoManana] = useState('');
    const [vouchersConciliados, setVouchersConciliados] = useState(true);
    const [notasCierreAdmin, setNotasCierreAdmin] = useState('');
    const [savingSello, setSavingSello] = useState(false);

    useEffect(() => {
        obtenerCatalogoGastosCompleto().then(setCatalogoGastos).catch(console.error);
        getCortesAprobados().then((list) => {
            const ap = {};
            list.forEach((f) => { ap[f] = true; });
            setAprobados(ap);
        }).catch(console.error);

        const unsubMovs = onMovimientosChange((movs) => {
            setMovimientos(movs);
            setLoading(false);
        });
        const unsubCajas = onCajasDiariasChange(setCajasMap);
        const unsubCitas = onCitasChange(setCitas);
        const unsubSesiones = onSesionesChange(setSesiones);
        const unsubSeguimientos = onSeguimientosChange(setSeguimientos);
        const unsubStaff = onStaffChange(setStaffList);
        const unsubPacientes = onPacientesChange(setPacientesList);

        return () => {
            if (unsubMovs) unsubMovs();
            if (unsubCajas) unsubCajas();
            if (unsubCitas) unsubCitas();
            if (unsubSesiones) unsubSesiones();
            if (unsubSeguimientos) unsubSeguimientos();
            if (unsubStaff) unsubStaff();
            if (unsubPacientes) unsubPacientes();
        };
    }, []);

    // Construir cortes en tiempo real combinando movimientos + cajas_diarias + aprobados
    const cortes = useMemo(() => {
        return construirCortesPorDia(movimientos, cajasMap, aprobados);
    }, [movimientos, cajasMap, aprobados]);

    // Filtrar cortes según vista ('dia' | 'semana' | 'mes') y fechaRef
    const cortesFiltrados = useMemo(() => {
        if (vista === 'dia') {
            const dayStr = format(fechaRef, 'yyyy-MM-dd');
            const encontrados = cortes.filter((c) => c.fecha === dayStr);
            if (encontrados.length > 0) return encontrados;
            // Si es vista por día y aún no hay movimientos, mostrar la estructura vacía del día para poder auditar/abrir caja
            const cajaDoc = cajasMap[dayStr] || {};
            const fondo = Number(cajaDoc.fondoInicial) || 0;
            const contado = cajaDoc.arqueo?.totalContado !== undefined ? Number(cajaDoc.arqueo.totalContado) : null;
            return [
                {
                    fecha: dayStr,
                    ingresosTotales: 0,
                    ingresosEfectivo: 0,
                    ingresosTarjeta: 0,
                    ingresosTransferencia: 0,
                    egresosTotales: 0,
                    egresosEfectivoCaja: 0,
                    egresosOtrosMedios: 0,
                    egresosPorCategoria: {},
                    efectivo: 0,
                    tarjeta: 0,
                    transferencia: 0,
                    fondoInicial: fondo,
                    retirosEfectivo: cajaDoc.retirosEfectivo || [],
                    totalRetiros: 0,
                    efectivoEsperadoEnCajon: fondo,
                    contadoFisico: contado,
                    diferenciaArqueo: contado !== null ? contado - fondo : null,
                    entregadoRecepcion: Boolean(cajaDoc.entregadoRecepcion),
                    entregadoPor: cajaDoc.entregadoPor || '',
                    notasRecepcion: cajaDoc.notasRecepcion || '',
                    cierreAdmin: cajaDoc.cierreAdmin || null,
                    estado: aprobados[dayStr] || cajaDoc.estado === 'Aprobado' ? 'Aprobado' : 'Pendiente Revisión',
                    movimientos: [],
                },
            ];
        } else if (vista === 'semana') {
            const start = startOfWeek(fechaRef, { weekStartsOn: 1 });
            const end = endOfWeek(fechaRef, { weekStartsOn: 1 });
            return cortes.filter((c) => {
                try {
                    const d = parseISO(c.fecha);
                    return isWithinInterval(d, { start, end });
                } catch {
                    return false;
                }
            });
        } else {
            const start = startOfMonth(fechaRef);
            const end = endOfMonth(fechaRef);
            return cortes.filter((c) => {
                try {
                    const d = parseISO(c.fecha);
                    return isWithinInterval(d, { start, end });
                } catch {
                    return false;
                }
            });
        }
    }, [cortes, vista, fechaRef, cajasMap, aprobados]);

    // Totales del período filtrado
    const totales = useMemo(() => {
        return cortesFiltrados.reduce(
            (acc, c) => {
                const egCats = { ...acc.egresosPorCategoria };
                Object.entries(c.egresosPorCategoria || {}).forEach(([k, v]) => {
                    egCats[k] = (egCats[k] || 0) + v;
                });
                return {
                    ingresos: acc.ingresos + (c.ingresosTotales || 0),
                    egresos: acc.egresos + (c.egresosTotales || 0),
                    egresosCaja: acc.egresosCaja + (c.egresosEfectivoCaja || 0),
                    ingresosEfectivo: acc.ingresosEfectivo + (c.ingresosEfectivo || 0),
                    efectivoNeto: acc.efectivoNeto + (c.efectivo || 0),
                    efectivoEsperadoCajon: acc.efectivoEsperadoCajon + (c.efectivoEsperadoEnCajon || 0),
                    tarjeta: acc.tarjeta + (c.ingresosTarjeta || 0),
                    transferencia: acc.transferencia + (c.ingresosTransferencia || 0),
                    egresosPorCategoria: egCats,
                };
            },
            {
                ingresos: 0,
                egresos: 0,
                egresosCaja: 0,
                ingresosEfectivo: 0,
                efectivoNeto: 0,
                efectivoEsperadoCajon: 0,
                tarjeta: 0,
                transferencia: 0,
                egresosPorCategoria: {},
            }
        );
    }, [cortesFiltrados]);

    const periodoLabel = useMemo(() => {
        if (vista === 'dia') {
            return format(fechaRef, "EEEE dd 'de' MMMM yyyy", { locale: es });
        } else if (vista === 'semana') {
            const start = startOfWeek(fechaRef, { weekStartsOn: 1 });
            const end = endOfWeek(fechaRef, { weekStartsOn: 1 });
            return `${format(start, 'dd MMM', { locale: es })} – ${format(end, 'dd MMM yyyy', { locale: es })}`;
        } else {
            return format(fechaRef, "MMMM yyyy", { locale: es });
        }
    }, [vista, fechaRef]);

    const esHoy = vista === 'dia' && isSameDay(fechaRef, new Date());

    // Abrir Modal Registrar Gasto desde Corte de Caja
    const handleAbrirGastoModal = (fechaStr) => {
        setFechaGastoCorte(fechaStr || format(fechaRef, 'yyyy-MM-dd'));
        setMontoGasto('');
        setDetalleGastoExtra('');
        setProveedorGasto('');
        setModalGastoOpen(true);
    };

    const handleCambiarCategoriaModal = (nuevaCat) => {
        setCategoriaGasto(nuevaCat);
        const found = catalogoGastos.find((c) => c.nombre === nuevaCat);
        if (found && found.motivos?.length > 0) {
            setMotivoGasto(found.motivos[0]);
        } else {
            setMotivoGasto('');
        }
    };

    const handleAgregarMotivoCatalogo = async () => {
        const limpio = nuevoMotivoCustom.trim();
        if (!limpio) return;
        await agregarMotivoPersonalizadoGasto(categoriaGasto, limpio);
        const actualizado = await obtenerCatalogoGastosCompleto();
        setCatalogoGastos(actualizado);
        setMotivoGasto(limpio);
        setNuevoMotivoCustom('');
        setShowInputMotivoCustom(false);
    };

    const handleGuardarGastoDesdeCorte = async () => {
        const montoNum = parseFloat(montoGasto);
        if (!montoNum || montoNum <= 0) {
            alert('Ingresa un monto válido para el gasto.');
            return;
        }
        const baseMotivo = motivoGasto.trim();
        const extra = detalleGastoExtra.trim();
        const motivoFinal = baseMotivo && extra ? `${baseMotivo} — ${extra}` : baseMotivo || extra;
        if (!motivoFinal) {
            alert('Selecciona o escribe el motivo del gasto.');
            return;
        }

        setSavingGasto(true);
        try {
            const hoyIso = toLocalISOString().split('T')[0];
            const fechaIso = fechaGastoCorte === hoyIso
                ? toLocalISOString()
                : new Date(`${fechaGastoCorte}T12:00:00.000Z`).toISOString();

            await registrarMovimiento({
                tipo: 'Egreso',
                monto: montoNum,
                categoria: normalizarCategoriaGasto({ categoria: categoriaGasto, motivo: motivoFinal }),
                motivo: motivoFinal,
                proveedor: proveedorGasto.trim() || null,
                metodoPago: metodoGasto,
                estado: 'Pagado',
                registradoPor: userRole || 'Administrador',
                usuarioEmail: currentUser?.email || null,
                origenModulo: 'CorteCajaAdmin',
                fecha: fechaIso,
            });
            setModalGastoOpen(false);
        } catch (err) {
            console.error(err);
            alert('Error al registrar el gasto.');
        } finally {
            setSavingGasto(false);
        }
    };

    // Abrir Modal Arqueo desde Admin
    const handleAbrirArqueoModal = (corte) => {
        setModalArqueoCorte(corte);
        setConteoDenominaciones(corte.arqueo?.cantidades || {});
        setNotasArqueoAdmin(corte.notasRecepcion || '');
    };

    const totalContadoModal = useMemo(() => {
        return DENOMINACIONES_ARQUEO.reduce((acc, d) => {
            const cant = Number(conteoDenominaciones[d.valor]) || 0;
            return acc + cant * d.valor;
        }, 0);
    }, [conteoDenominaciones]);

    const handleGuardarArqueoAdmin = async () => {
        if (!modalArqueoCorte) return;
        setSavingArqueo(true);
        try {
            const esperado = modalArqueoCorte.efectivoEsperadoEnCajon || 0;
            await guardarCajaDiaria(modalArqueoCorte.fecha, {
                arqueo: {
                    cantidades: conteoDenominaciones,
                    totalContado: totalContadoModal,
                    efectivoEsperado: esperado,
                    diferencia: totalContadoModal - esperado,
                    actualizadoEn: new Date().toISOString(),
                },
                entregadoRecepcion: true,
                notasRecepcion: notasArqueoAdmin.trim(),
            });
            setModalArqueoCorte(null);
        } catch (err) {
            console.error(err);
            alert('Error al guardar el arqueo.');
        } finally {
            setSavingArqueo(false);
        }
    };

    // Abrir Modal Sellar y Aprobar Corte
    const handleAbrirAprobarModal = (corte) => {
        setModalSellarCorte(corte);
        const efBase = corte.contadoFisico !== null ? corte.contadoFisico : corte.efectivoEsperadoEnCajon;
        const sugerenciaFondo = corte.fondoInicial > 0 ? corte.fondoInicial : 0;
        const sugerenciaRetiro = Math.max(0, efBase - sugerenciaFondo);
        setEfectivoRetiradoAdmin(String(sugerenciaRetiro));
        setFondoDejadoManana(String(sugerenciaFondo));
        setVouchersConciliados(true);
        setNotasCierreAdmin('');
    };

    const handleConfirmarSelloCorte = async () => {
        if (!modalSellarCorte) return;
        setSavingSello(true);
        try {
            const retirado = Number(efectivoRetiradoAdmin) || 0;
            const fondoManana = Number(fondoDejadoManana) || 0;
            await aprobarCorteDefinitivo(modalSellarCorte.fecha, {
                efectivoEsperado: modalSellarCorte.efectivoEsperadoEnCajon,
                contadoFisico: modalSellarCorte.contadoFisico,
                efectivoRetiradoAdmin: retirado,
                fondoDejadoManana: fondoManana,
                vouchersConciliados,
                notasAdmin: notasCierreAdmin.trim(),
                auditadoPor: currentUser?.email || 'Administrador',
            });

            // Si se dejó fondo para mañana, pre-cargar en la caja del día siguiente
            if (fondoManana > 0) {
                try {
                    const nextDayStr = format(addDays(parseISO(modalSellarCorte.fecha), 1), 'yyyy-MM-dd');
                    await guardarCajaDiaria(nextDayStr, { fondoInicial: fondoManana });
                } catch {}
            }

            setAprobados((prev) => ({ ...prev, [modalSellarCorte.fecha]: true }));
            setModalSellarCorte(null);
        } catch (err) {
            console.error(err);
            alert('No se pudo sellar el corte de caja.');
        } finally {
            setSavingSello(false);
        }
    };

    // Exportar CSV / Excel del Corte
    const exportarCSV = () => {
        const rows = [
            ['Fecha', 'Hora', 'Tipo', 'Categoria Oficial', 'Concepto', 'Paciente / Proveedor', 'Metodo de Pago', 'Afecta Caja Dia', 'Monto', 'Estado'],
        ];
        cortesFiltrados.forEach((c) => {
            (c.movimientos || []).forEach((m) => {
                if (m.estado === 'Cancelado') return;
                const hora = m.createdAt ? format(parseISO(m.createdAt), 'HH:mm') : '';
                const cat = m.tipo === 'Egreso' ? normalizarCategoriaGasto(m) : m.categoria || 'Servicios y Consultas';
                const rel = m.pacienteNombre || m.proveedor || '';
                const afecta = m.tipo === 'Egreso' && esGastoDeCajaDelDia(m) ? 'SI' : 'NO';
                const montoSigno = m.tipo === 'Egreso' ? -Number(m.monto || 0) : Number(m.monto || 0);
                rows.push([
                    c.fecha,
                    hora,
                    m.tipo,
                    `"${cat.replace(/"/g, '""')}"`,
                    `"${String(m.motivo || m.concepto || '').replace(/"/g, '""')}"`,
                    `"${String(rel).replace(/"/g, '""')}"`,
                    `"${String(m.metodoPago || 'Efectivo').replace(/"/g, '""')}"`,
                    afecta,
                    montoSigno.toFixed(2),
                    m.estado || 'Completado',
                ]);
            });
        });

        const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Corte_Caja_ALFRA_${vista}_${format(fechaRef, 'yyyy-MM-dd')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Exportar PDF Oficial con Cuadre de Cajón, Arqueo y Desglose por Categoría Obligatoria
    const exportarPDF = async () => {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 14;
        const utilidad = totales.ingresos - totales.egresos;

        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageW, 44, 'F');
        pdf.setFillColor(13, 148, 136);
        pdf.rect(0, 44, pageW, 2.5, 'F');
        pdf.rect(0, 0, 6, 44, 'F');

        try {
            pdf.addImage(LOGO_ALFRA_BASE64, 'PNG', 12, 5, 34, 30);
        } catch (_) {}

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(30, 41, 59);
        pdf.text('ALFRA Cirugia y Medicina Estetica', 50, 16);
        pdf.setFontSize(9.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 116, 139);
        pdf.text('Corte de Caja y Arqueo de Recepcion — Reporte Oficial', 50, 23);
        pdf.text(`Periodo: ${periodoLabel}`, 50, 30);
        pdf.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageW - margin, 29, { align: 'right' });

        pdf.setFillColor(248, 250, 252);
        pdf.rect(0, 44, pageW, 8, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text('RESUMEN EJECUTIVO Y CUADRE DE CAJA', margin, 49.5);

        const boxY = 56;
        const boxH = 22;
        const boxes = [
            { label: 'INGRESOS TOTALES', value: formatCurrency(totales.ingresos), r: 16, g: 185, b: 129 },
            { label: 'GASTOS TOTALES', value: formatCurrency(totales.egresos), r: 244, g: 63, b: 94 },
            { label: 'EFECTIVO EN CAJON', value: formatCurrency(totales.efectivoEsperadoCajon), r: 13, g: 148, b: 136 },
            { label: 'UTILIDAD NETA', value: formatCurrency(utilidad), r: utilidad >= 0 ? 79 : 220, g: utilidad >= 0 ? 70 : 38, b: utilidad >= 0 ? 229 : 38 },
        ];
        const boxW = (pageW - margin * 2 - 9) / 4;
        boxes.forEach((b, i) => {
            const x = margin + i * (boxW + 3);
            pdf.setFillColor(b.r, b.g, b.b);
            pdf.roundedRect(x, boxY, boxW, boxH, 3, 3, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.text(b.label, x + boxW / 2, boxY + 7, { align: 'center' });
            pdf.setFontSize(10.5);
            pdf.text(b.value, x + boxW / 2, boxY + 16.5, { align: 'center' });
        });

        autoTable(pdf, {
            startY: boxY + boxH + 5,
            head: [['Canal de Cobro', 'Ingresos Captados', 'Gastos Pagados del Canal', 'Saldo Neto Canal']],
            body: [
                [
                    'Efectivo (Cajon Recepcion)',
                    formatCurrency(totales.ingresosEfectivo),
                    formatCurrency(totales.egresosCaja),
                    formatCurrency(totales.ingresosEfectivo - totales.egresosCaja),
                ],
                ['Tarjeta Debito / Credito', formatCurrency(totales.tarjeta), '$0.00', formatCurrency(totales.tarjeta)],
                ['Transferencia Bancaria', formatCurrency(totales.transferencia), '$0.00', formatCurrency(totales.transferencia)],
            ],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold', halign: 'center' },
            columnStyles: {
                1: { halign: 'right', fontStyle: 'bold' },
                2: { halign: 'right' },
                3: { halign: 'right', fontStyle: 'bold' },
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: margin, right: margin },
        });

        // Tabla de Gastos por Categoría Obligatoria en el período
        const catEntries = Object.entries(totales.egresosPorCategoria || {}).sort((a, b) => b[1] - a[1]);
        if (catEntries.length > 0) {
            autoTable(pdf, {
                startY: pdf.lastAutoTable.finalY + 6,
                head: [['Categoria Oficial del Gasto', 'Monto Total', '% de Egresos']],
                body: catEntries.map(([cat, m]) => [
                    cat,
                    formatCurrency(m),
                    totales.egresos > 0 ? `${((m / totales.egresos) * 100).toFixed(1)}%` : '0%',
                ]),
                styles: { fontSize: 8.5 },
                headStyles: { fillColor: [225, 29, 72], fontStyle: 'bold', halign: 'center' },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' }, 2: { halign: 'center' } },
                margin: { left: margin, right: margin },
            });
        }

        const renderMiniHeader = () => {
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageW, 16, 'F');
            pdf.setFillColor(13, 148, 136);
            pdf.rect(0, 16, pageW, 1.5, 'F');
            pdf.rect(0, 0, 5, 16, 'F');
            try {
                pdf.addImage(LOGO_ALFRA_BASE64, 'PNG', 8, 1.5, 15, 13);
            } catch (_) {}
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            pdf.setTextColor(30, 41, 59);
            pdf.text('ALFRA Cirugia y Medicina Estetica — Corte de Caja Oficial', 27, 10);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 116, 139);
            pdf.text(`Periodo: ${periodoLabel}`, pageW - margin, 10, { align: 'right' });
        };

        cortesFiltrados.forEach((corte) => {
            const isAp = aprobados[corte.fecha] || corte.estado === 'Aprobado';
            const movsDia = corte.movimientos || [];

            const ingresosRows = movsDia
                .filter((m) => m.tipo === 'Ingreso' && m.estado !== 'Cancelado')
                .map((m) => [
                    m.createdAt ? format(parseISO(m.createdAt), 'HH:mm') : '—',
                    (m.motivo || m.concepto || 'Sin concepto').substring(0, 42),
                    m.pacienteNombre || '—',
                    m.metodoPago || 'Efectivo',
                    formatCurrency(m.monto),
                ]);

            const egresosRows = movsDia
                .filter((m) => m.tipo === 'Egreso' && m.estado !== 'Cancelado')
                .map((m) => [
                    m.createdAt ? format(parseISO(m.createdAt), 'HH:mm') : '—',
                    normalizarCategoriaGasto(m),
                    (m.motivo || m.concepto || 'Sin concepto').substring(0, 38),
                    m.metodoPago || 'Efectivo en Caja',
                    formatCurrency(m.monto),
                ]);

            const citasDia = citas.filter((c) => (c.fecha || c.fechaHora || '').startsWith(corte.fecha));
            if (ingresosRows.length === 0 && egresosRows.length === 0 && citasDia.length === 0) return;

            pdf.addPage();
            renderMiniHeader();

            const titleY = 22;
            pdf.setFillColor(isAp ? 236 : 254, isAp ? 252 : 249, isAp ? 247 : 231);
            pdf.roundedRect(margin, titleY - 4, pageW - margin * 2, 12, 2, 2, 'F');
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.setTextColor(isAp ? 6 : 120, isAp ? 95 : 53, isAp ? 70 : 15);
            pdf.text(`Corte del ${corte.fecha}`, margin + 3, titleY + 3.5);
            pdf.setFontSize(8);
            pdf.text(isAp ? 'AUDITADO Y SELLADO' : 'PENDIENTE DE REVISION', pageW - margin - 3, titleY + 3.5, { align: 'right' });

            let curY = titleY + 13;

            // Tabla Cuadre de Efectivo del Día
            autoTable(pdf, {
                startY: curY,
                head: [['Fondo Inicial', '+ Cobros Efectivo', '- Gastos Caja', '- Retiros', '= Efectivo Esperado', 'Contado Fisico']],
                body: [[
                    formatCurrency(corte.fondoInicial),
                    formatCurrency(corte.ingresosEfectivo),
                    formatCurrency(corte.egresosEfectivoCaja),
                    formatCurrency(corte.totalRetiros),
                    formatCurrency(corte.efectivoEsperadoEnCajon),
                    corte.contadoFisico !== null ? formatCurrency(corte.contadoFisico) : 'Sin Arqueo',
                ]],
                styles: { fontSize: 8, halign: 'center' },
                headStyles: { fillColor: [15, 118, 110], fontStyle: 'bold' },
                columnStyles: { 4: { fontStyle: 'bold' }, 5: { fontStyle: 'bold' } },
                margin: { left: margin, right: margin },
            });
            curY = pdf.lastAutoTable.finalY + 6;

            if (ingresosRows.length > 0) {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(8.5);
                pdf.setTextColor(5, 150, 105);
                pdf.text('INGRESOS DEL DIA', margin, curY);
                curY += 2;
                autoTable(pdf, {
                    startY: curY,
                    head: [['Hora', 'Concepto', 'Paciente', 'Metodo de Pago', 'Monto']],
                    body: ingresosRows,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [5, 150, 105], fontStyle: 'bold', halign: 'center', textColor: 255 },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 15 },
                        3: { halign: 'center', cellWidth: 32 },
                        4: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
                    },
                    alternateRowStyles: { fillColor: [240, 253, 244] },
                    margin: { left: margin, right: margin },
                });
                curY = pdf.lastAutoTable.finalY + 6;
            }

            if (egresosRows.length > 0) {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(8.5);
                pdf.setTextColor(220, 38, 38);
                pdf.text('GASTOS / EGRESOS DEL DIA (POR CATEGORIA OBLIGATORIA)', margin, curY);
                curY += 2;
                autoTable(pdf, {
                    startY: curY,
                    head: [['Hora', 'Categoria Oficial', 'Motivo / Detalle', 'Pagado Con', 'Monto']],
                    body: egresosRows,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [220, 38, 38], fontStyle: 'bold', halign: 'center', textColor: 255 },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 15 },
                        1: { fontStyle: 'bold', cellWidth: 38 },
                        3: { halign: 'center', cellWidth: 30 },
                        4: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
                    },
                    alternateRowStyles: { fillColor: [255, 241, 242] },
                    margin: { left: margin, right: margin },
                });
                curY = pdf.lastAutoTable.finalY + 5;
            }
        });

        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(7);
            pdf.setTextColor(148, 163, 184);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Documento generado automaticamente por el sistema ALFRA — Uso interno y confidencial', margin, pageH - 6);
            pdf.text(`Pag. ${i} / ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
        }

        await guardarPdfNativo(pdf, `corte-caja-${vista}-${format(fechaRef, 'yyyy-MM-dd')}.pdf`, 'Corte de Caja ALFRA');
    };

    const navAnterior = () => {
        if (vista === 'dia') setFechaRef((d) => subDays(d, 1));
        else if (vista === 'semana') setFechaRef((d) => subWeeks(d, 1));
        else setFechaRef((d) => subMonths(d, 1));
    };
    const navSiguiente = () => {
        if (vista === 'dia') setFechaRef((d) => addDays(d, 1));
        else if (vista === 'semana') setFechaRef((d) => addWeeks(d, 1));
        else setFechaRef((d) => addMonths(d, 1));
    };
    const irAHoy = () => setFechaRef(new Date());

    const categoriaModalObj = useMemo(() => {
        return catalogoGastos.find((c) => c.nombre === categoriaGasto) || catalogoGastos[0];
    }, [catalogoGastos, categoriaGasto]);

    return (
        <div className="space-y-6">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-acero">Corte de Caja y Auditoría</h2>
                    <p className="text-gray-500 text-sm">
                        Sincronizado en tiempo real con los cobros, gastos categorizados y arqueos de Recepción
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant="primary"
                        icon={PlusCircle}
                        onClick={() => handleAbrirGastoModal(format(fechaRef, 'yyyy-MM-dd'))}
                        className="bg-rose-600 border-rose-600 hover:bg-rose-700 text-white"
                    >
                        Registrar Gasto
                    </Button>
                    <Button variant="outline" icon={Download} onClick={exportarCSV}>
                        Exportar Excel/CSV
                    </Button>
                    <Button variant="outline" icon={Printer} onClick={exportarPDF}>
                        Exportar PDF Oficial
                    </Button>
                </div>
            </div>

            {/* ── Tabs Vista y Selector Directo de Fecha ──────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="bg-white rounded-xl p-1 shadow-sm border border-gray-100 flex">
                    {[
                        { id: 'dia', label: 'Por Día' },
                        { id: 'semana', label: 'Por Semana' },
                        { id: 'mes', label: 'Por Mes' },
                    ].map((v) => (
                        <button
                            key={v.id}
                            onClick={() => {
                                setVista(v.id);
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                vista === v.id ? 'bg-turquesa text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>

                {/* Navegación de fecha */}
                <div className="flex items-center gap-1 bg-white rounded-xl px-2 py-1 border border-gray-100 shadow-sm">
                    <button onClick={navAnterior} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <ArrowLeft size={16} className="text-gray-500" />
                    </button>
                    <span className="text-sm font-bold text-gray-700 px-2 capitalize min-w-[190px] text-center">
                        {periodoLabel}
                    </span>
                    <button onClick={navSiguiente} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <ArrowRight size={16} className="text-gray-500" />
                    </button>
                </div>

                {/* Selector directo de calendario */}
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border border-gray-100 shadow-sm">
                    <Calendar size={15} className="text-turquesa" />
                    <input
                        type="date"
                        value={format(fechaRef, 'yyyy-MM-dd')}
                        onChange={(e) => {
                            if (e.target.value) setFechaRef(parseISO(e.target.value));
                        }}
                        className="text-xs font-bold text-gray-700 outline-none bg-transparent cursor-pointer"
                    />
                </div>

                {!esHoy && (
                    <button onClick={irAHoy} className="text-sm text-turquesa font-bold hover:underline">
                        Ir a hoy
                    </button>
                )}
            </div>

            {/* ── KPIs del Período ───────────────────────────────────── */}
            {!loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-lg shadow-emerald-500/20">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp size={16} className="opacity-80" />
                            <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">Ingresos Período</p>
                        </div>
                        <p className="text-2xl font-black">{formatCurrency(totales.ingresos)}</p>
                        <p className="text-[11px] opacity-80 mt-0.5">
                            Efectivo cobrado: {formatCurrency(totales.ingresosEfectivo)}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-4 text-white shadow-lg shadow-rose-500/20">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingDown size={16} className="opacity-80" />
                            <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">Gastos Período</p>
                        </div>
                        <p className="text-2xl font-black">{formatCurrency(totales.egresos)}</p>
                        <p className="text-[11px] opacity-80 mt-0.5">
                            Pagados de Caja: {formatCurrency(totales.egresosCaja)}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-teal-700 to-slate-800 rounded-2xl p-4 text-white shadow-lg">
                        <div className="flex items-center gap-2 mb-1">
                            <Wallet size={16} className="text-turquesa" />
                            <p className="text-[11px] font-bold uppercase tracking-widest text-turquesa">Efectivo en Cajón</p>
                        </div>
                        <p className="text-2xl font-black">{formatCurrency(totales.efectivoEsperadoCajon)}</p>
                        <p className="text-[11px] opacity-80 mt-0.5">Fondo + Efectivo − Gastos Caja − Retiros</p>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-1">
                            <CreditCard size={16} className="text-blue-500" />
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Tarjeta + Transfer</p>
                        </div>
                        <p className="text-xl font-black text-gray-800">
                            {formatCurrency(totales.tarjeta + totales.transferencia)}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            Tarj: {formatCurrency(totales.tarjeta)} • Transf: {formatCurrency(totales.transferencia)}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-4 text-white shadow-lg shadow-indigo-500/20">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign size={16} className="opacity-80" />
                            <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">Utilidad Neta</p>
                        </div>
                        <p className="text-2xl font-black">{formatCurrency(totales.ingresos - totales.egresos)}</p>
                        <p className="text-[11px] opacity-80 mt-0.5">Ingresos Totales − Gastos Totales</p>
                    </div>
                </div>
            )}

            {/* ── Contenido de Cortes por Día ─────────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                    <Loader size={28} className="animate-spin text-turquesa" />
                    <span>Sincronizando cortes en tiempo real desde Firebase...</span>
                </div>
            ) : cortesFiltrados.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                    <FileText size={48} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-lg font-semibold">Sin movimientos en este período</p>
                    <p className="text-sm mt-1">
                        No hay registros de caja para <span className="font-bold capitalize">{periodoLabel}</span>.
                    </p>
                </div>
            ) : (
                <div className="space-y-4" ref={printRef}>
                    {cortesFiltrados.map((corte, idx) => {
                        const citasDelDia = citas.filter((c) => (c.fecha || c.fechaHora || '').startsWith(corte.fecha));
                        const auditoriaExp = auditarExpedientesPorDia(
                            citasDelDia,
                            sesiones,
                            seguimientos,
                            corte.fecha,
                            staffList,
                            pacientesList
                        );
                        return (
                            <FilaDia
                                key={corte.fecha}
                                corte={corte}
                                citasDia={citasDelDia}
                                auditoriaExpedientes={auditoriaExp}
                                isAprobado={aprobados[corte.fecha] || corte.estado === 'Aprobado'}
                                defaultOpen={vista === 'dia' || idx === 0}
                                onAbrirAprobarModal={handleAbrirAprobarModal}
                                onAbrirArqueoModal={handleAbrirArqueoModal}
                                onAbrirGastoModal={handleAbrirGastoModal}
                                onCopiarMensaje={handleCopiarMensaje}
                                copiedKey={copiedKey}
                                navigate={navigate}
                            />
                        );
                    })}
                </div>
            )}

            {/* ── Modal: Registrar Gasto Directamente en el Corte (Categoría Obligatoria) ── */}
            {modalGastoOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-black text-acero flex items-center gap-2">
                            <Tag size={18} className="text-rose-600" /> Registrar Gasto en Corte ({fechaGastoCorte})
                        </h3>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Fecha del Gasto</label>
                            <input
                                type="date"
                                value={fechaGastoCorte}
                                onChange={(e) => setFechaGastoCorte(e.target.value)}
                                className="w-full mt-1 p-2.5 border rounded-xl text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Categoría Obligatoria *</label>
                            <select
                                value={categoriaGasto}
                                onChange={(e) => handleCambiarCategoriaModal(e.target.value)}
                                className="w-full mt-1 p-2.5 border border-rose-200 rounded-xl text-sm font-bold bg-white"
                            >
                                {catalogoGastos.map((c) => (
                                    <option key={c.nombre} value={c.nombre}>
                                        {c.nombre} ({c.grupo})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-gray-500 uppercase">Motivo del Catálogo *</label>
                                <button
                                    type="button"
                                    onClick={() => setShowInputMotivoCustom((v) => !v)}
                                    className="text-[11px] font-bold text-rose-600 hover:underline"
                                >
                                    {showInputMotivoCustom ? 'Cerrar' : '+ Agregar motivo al catálogo'}
                                </button>
                            </div>
                            <select
                                value={motivoGasto}
                                onChange={(e) => setMotivoGasto(e.target.value)}
                                className="w-full mt-1 p-2.5 border rounded-xl text-sm bg-white"
                            >
                                {(categoriaModalObj?.motivos || []).map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                            {showInputMotivoCustom && (
                                <div className="mt-2 flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Nuevo motivo frecuente..."
                                        value={nuevoMotivoCustom}
                                        onChange={(e) => setNuevoMotivoCustom(e.target.value)}
                                        className="flex-1 px-3 py-1.5 border rounded-lg text-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAgregarMotivoCatalogo}
                                        className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Detalle Extra</label>
                                <input
                                    type="text"
                                    placeholder="Opcional..."
                                    value={detalleGastoExtra}
                                    onChange={(e) => setDetalleGastoExtra(e.target.value)}
                                    className="w-full mt-1 p-2.5 border rounded-xl text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Proveedor / Nota</label>
                                <input
                                    type="text"
                                    placeholder="Ej. CFE, Farmacia..."
                                    value={proveedorGasto}
                                    onChange={(e) => setProveedorGasto(e.target.value)}
                                    className="w-full mt-1 p-2.5 border rounded-xl text-sm"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Monto ($)</label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={montoGasto}
                                    onChange={(e) => setMontoGasto(e.target.value)}
                                    className="w-full mt-1 p-2.5 border rounded-xl text-base font-black text-rose-600"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Origen del Pago</label>
                                <select
                                    value={metodoGasto}
                                    onChange={(e) => setMetodoGasto(e.target.value)}
                                    className="w-full mt-1 p-2.5 border rounded-xl text-xs font-bold bg-white"
                                >
                                    <option value="Efectivo en Caja">Efectivo (Caja del Día)</option>
                                    <option value="Efectivo (Cortes Anteriores)">Efectivo (Cortes Anteriores)</option>
                                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                                    <option value="Tarjeta de Crédito/Débito">Tarjeta Débito/Crédito</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setModalGastoOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleGuardarGastoDesdeCorte}
                                disabled={savingGasto}
                                className="flex-1 bg-rose-600 border-rose-600 text-white"
                            >
                                {savingGasto ? 'Guardando...' : 'Guardar Gasto'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Ver / Editar Arqueo Físico de Billetes y Monedas ── */}
            {modalArqueoCorte && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="text-lg font-black text-acero flex items-center gap-2">
                                <Calculator size={20} className="text-turquesa" /> Arqueo de Billetes y Monedas ({modalArqueoCorte.fecha})
                            </h3>
                            <button onClick={() => setModalArqueoCorte(null)} className="text-gray-400 hover:text-gray-700 font-bold">
                                ✕
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center">
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Efectivo Esperado</p>
                                <p className="text-base font-black text-gray-800">{formatCurrency(modalArqueoCorte.efectivoEsperadoEnCajon)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-turquesa uppercase">Contado Físico</p>
                                <p className="text-base font-black text-turquesa">{formatCurrency(totalContadoModal)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Diferencia</p>
                                <p
                                    className={`text-base font-black ${
                                        Math.abs(totalContadoModal - modalArqueoCorte.efectivoEsperadoEnCajon) < 0.5
                                            ? 'text-emerald-600'
                                            : totalContadoModal > modalArqueoCorte.efectivoEsperadoEnCajon
                                                ? 'text-blue-600'
                                                : 'text-rose-600'
                                    }`}
                                >
                                    {formatCurrency(totalContadoModal - modalArqueoCorte.efectivoEsperadoEnCajon)}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {DENOMINACIONES_ARQUEO.map((d) => {
                                const cant = conteoDenominaciones[d.valor] ?? '';
                                return (
                                    <div key={d.valor} className="p-2.5 rounded-xl border border-gray-200 bg-gray-50 flex flex-col">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-bold text-gray-700">{d.label}</span>
                                            <span className="font-black text-emerald-700">{formatCurrency((Number(cant) || 0) * d.valor)}</span>
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={cant}
                                            onChange={(e) =>
                                                setConteoDenominaciones((prev) => ({
                                                    ...prev,
                                                    [d.valor]: e.target.value,
                                                }))
                                            }
                                            className="w-full px-2 py-1 border rounded-lg bg-white text-center font-black text-sm"
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-600 uppercase">Notas del Arqueo</label>
                            <input
                                type="text"
                                value={notasArqueoAdmin}
                                onChange={(e) => setNotasArqueoAdmin(e.target.value)}
                                placeholder="Observaciones del conteo físico..."
                                className="w-full mt-1 p-2.5 border rounded-xl text-sm"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setModalArqueoCorte(null)}>
                                Cerrar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleGuardarArqueoAdmin}
                                disabled={savingArqueo}
                                className="flex-1 bg-turquesa border-turquesa text-white"
                            >
                                {savingArqueo ? 'Guardando...' : 'Guardar Arqueo Físico'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Sellar y Aprobar Corte Definitivo ────────────────── */}
            {modalSellarCorte && (() => {
                const citasModalDia = citas.filter((c) => (c.fecha || c.fechaHora || '').startsWith(modalSellarCorte.fecha));
                const auditoriaModal = auditarExpedientesPorDia(
                    citasModalDia,
                    sesiones,
                    seguimientos,
                    modalSellarCorte.fecha,
                    staffList,
                    pacientesList
                );
                return (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
                            <h3 className="text-xl font-black text-acero flex items-center gap-2">
                                <ShieldCheck size={22} className="text-emerald-600" /> Sellar y Aprobar Corte ({modalSellarCorte.fecha})
                            </h3>
                            <p className="text-xs text-gray-500">
                                Registra cuánto efectivo retira Administración a resguardo y cuánto queda como fondo inicial para el día siguiente.
                            </p>

                            {/* ALERTA AUTOMÁTICA AL AUTORIZAR CORTE: EXPEDIENTES NO ACTUALIZADOS AL DÍA POR ESPECIALISTA */}
                            {auditoriaModal.sinActualizar.length > 0 ? (
                                <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-300 space-y-3 shadow-sm">
                                    <div className="flex items-start gap-2.5">
                                        <AlertTriangle size={22} className="text-red-600 shrink-0 mt-0.5" />
                                        <div className="space-y-1 flex-1">
                                            <h4 className="text-xs sm:text-sm font-black text-red-800 uppercase">
                                                🚨 Alerta: {auditoriaModal.sinActualizar.length} Expediente(s) No Actualizado(s) al Día
                                            </h4>
                                            <p className="text-xs text-red-700">
                                                Antes de autorizar el corte, cada especialista listada abajo tuvo cita con su respectivo paciente y <strong>NO actualizó su expediente clínico</strong>:
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        {auditoriaModal.porEspecialista.map((grupo, idx) => {
                                            const copyModalKey = `modal-esp-${idx}`;
                                            return (
                                                <div key={idx} className="bg-white p-3 rounded-xl border border-red-200 space-y-2">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                        <div>
                                                            <p className="text-xs font-black text-acero">
                                                                👩‍⚕️ Especialista: <span className="text-red-700">{grupo.especialista}</span>
                                                            </p>
                                                            <p className="text-xs text-gray-700">
                                                                Paciente(s) sin expediente al día:{' '}
                                                                <strong className="text-red-700">{grupo.listaPacientes}</strong>
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopiarMensaje(grupo.mensaje, copyModalKey)}
                                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                                                                copiedKey === copyModalKey
                                                                    ? 'bg-emerald-600 text-white'
                                                                    : 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                                                            }`}
                                                        >
                                                            {copiedKey === copyModalKey ? <Check size={14} /> : <Copy size={14} />}
                                                            {copiedKey === copyModalKey ? '¡Mensaje Copiado!' : `Copiar Mensaje para ${grupo.especialista}`}
                                                        </button>
                                                    </div>
                                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-800 select-all">
                                                        {grupo.mensaje}
                                                    </div>
                                                    {grupo.citas.length > 1 && (
                                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                            {grupo.citas.map((c, cIdx) => {
                                                                const copyIndKey = `modal-pac-${idx}-${cIdx}`;
                                                                return (
                                                                    <button
                                                                        key={c.id || cIdx}
                                                                        type="button"
                                                                        onClick={() => handleCopiarMensaje(c.mensajeIndividual, copyIndKey)}
                                                                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer ${
                                                                            copiedKey === copyIndKey
                                                                                ? 'bg-emerald-600 text-white border-emerald-600'
                                                                                : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
                                                                        }`}
                                                                    >
                                                                        {copiedKey === copyIndKey ? <Check size={10} /> : <Copy size={10} />}
                                                                        {copiedKey === copyIndKey ? 'Copiado' : `Copiar solo ${c.pacienteNombreLimpio}`}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : auditoriaModal.totalCitas > 0 ? (
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs font-bold text-emerald-800">
                                    <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                                    <span>
                                        Todos los expedientes de las citas de este día ({auditoriaModal.totalCitas}) están actualizados al día.
                                    </span>
                                </div>
                            ) : null}

                            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <span className="text-gray-500 block">Efectivo Esperado en Cajón:</span>
                                    <strong className="text-base text-slate-900">
                                        {formatCurrency(modalSellarCorte.efectivoEsperadoEnCajon)}
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-gray-500 block">Contado Físico Recepción:</span>
                                    <strong className="text-base text-turquesa">
                                        {modalSellarCorte.contadoFisico !== null
                                            ? formatCurrency(modalSellarCorte.contadoFisico)
                                            : 'No capturado'}
                                    </strong>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-emerald-700 uppercase block mb-1">
                                        Efectivo Retirado por Admin ($)
                                    </label>
                                    <input
                                        type="number"
                                        value={efectivoRetiradoAdmin}
                                        onChange={(e) => setEfectivoRetiradoAdmin(e.target.value)}
                                        className="w-full p-2.5 border border-emerald-200 rounded-xl text-base font-black text-emerald-700"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-acero uppercase block mb-1">
                                        Fondo Dejado para Mañana ($)
                                    </label>
                                    <input
                                        type="number"
                                        value={fondoDejadoManana}
                                        onChange={(e) => setFondoDejadoManana(e.target.value)}
                                        className="w-full p-2.5 border border-gray-200 rounded-xl text-base font-black text-acero"
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-2.5 text-xs font-bold text-gray-700 cursor-pointer bg-blue-50/60 p-3 rounded-xl border border-blue-100">
                                <input
                                    type="checkbox"
                                    checked={vouchersConciliados}
                                    onChange={(e) => setVouchersConciliados(e.target.checked)}
                                    className="rounded text-turquesa"
                                />
                                <span>
                                    Vouchers de Tarjeta ({formatCurrency(modalSellarCorte.ingresosTarjeta)}) y Transferencias (
                                    {formatCurrency(modalSellarCorte.ingresosTransferencia)}) verificados
                                </span>
                            </label>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                                    Notas de Auditoría (Opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej. Corte cuadrado sin diferencias..."
                                    value={notasCierreAdmin}
                                    onChange={(e) => setNotasCierreAdmin(e.target.value)}
                                    className="w-full p-2.5 border rounded-xl text-sm"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" className="flex-1" onClick={() => setModalSellarCorte(null)}>
                                    Cancelar
                                </Button>
                                <Button
                                    variant="primary"
                                    icon={savingSello ? Loader : CheckCircle}
                                    onClick={handleConfirmarSelloCorte}
                                    disabled={savingSello}
                                    className="flex-1 bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {savingSello ? 'Sellando...' : 'Confirmar y Sellar Corte'}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
