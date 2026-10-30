import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    DollarSign, Calendar, Receipt, Search, Filter, ChevronDown, 
    ChevronUp, ExternalLink, CheckCircle2, Sparkles, ShoppingBag, 
    Activity, Layers, Clock
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import ReciboNomina from '../ui/ReciboNomina';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function DetalleComisionesContent({ staffDoc, isModal = false, onCloseModal }) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('actual');
    const [filtroTipo, setFiltroTipo] = useState('Todos');
    const [busqueda, setBusqueda] = useState('');
    const [pagoExpandidoIdx, setPagoExpandidoIdx] = useState(null);
    const [datosReciboNomina, setDatosReciboNomina] = useState(null);

    const formatCurrency = (val) => {
        const num = Number(val);
        if (isNaN(num)) return '$0.00';
        return `$${num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDate = (isoString) => {
        if (!isoString) return 'Sin fecha';
        try {
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return isoString;
            return format(d, "dd 'de' MMM, yyyy • hh:mm a", { locale: es });
        } catch {
            return isoString;
        }
    };

    const formatDateShort = (isoString) => {
        if (!isoString) return 'Sin fecha';
        try {
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return isoString;
            return format(d, "dd/MM/yyyy", { locale: es });
        } catch {
            return isoString;
        }
    };

    const saldoTotal = Number(staffDoc?.saldoComisiones || 0);
    const historial = staffDoc?.historialComisiones || [];
    const historialPagos = staffDoc?.historialPagos || [];

    const comisionServicios = historial
        .filter(h => h.tipoVenta === 'Servicio')
        .reduce((acc, h) => acc + Number(h.comisionGanada || 0), 0);

    const comisionProductos = historial
        .filter(h => h.tipoVenta === 'Producto')
        .reduce((acc, h) => acc + Number(h.comisionGanada || 0), 0);

    const tasaServicios = staffDoc?.comisionServicios || 0;
    const tasaProductos = staffDoc?.comisionProductos || 0;

    const totalComisionesPagadasHistorico = historialPagos.reduce(
        (acc, p) => acc + Number(p.totalComisiones || 0), 0
    );

    const historialFiltrado = historial
        .map((item, originalIdx) => ({ ...item, originalIdx }))
        .filter(item => {
            if (filtroTipo !== 'Todos' && item.tipoVenta !== filtroTipo) {
                return false;
            }
            if (busqueda.trim() !== '') {
                const query = busqueda.toLowerCase();
                const motivo = (item.detalleMotivo || '').toLowerCase();
                const paciente = (item.pacienteNombre || '').toLowerCase();
                return motivo.includes(query) || paciente.includes(query);
            }
            return true;
        })
        .reverse();

    const sumaFiltrada = historialFiltrado.reduce((acc, h) => acc + Number(h.comisionGanada || 0), 0);

    return (
        <div className="space-y-6">
            {/* TARJETAS DE MÉTRICAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-turquesa/15 to-turquesa/5 p-5 rounded-2xl border border-turquesa/30 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-turquesa bg-turquesa/10 px-2 py-0.5 rounded-full mb-1">
                                <Clock size={11} /> Pendiente de Liquidar
                            </span>
                            <p className="text-xs font-bold text-gray-500">Saldo de Comisiones</p>
                        </div>
                        <div className="p-2.5 bg-turquesa text-white rounded-xl shadow-sm">
                            <DollarSign size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <p className="text-3xl font-black text-gray-900 leading-none">
                            {formatCurrency(saldoTotal)}
                            <span className="text-xs font-semibold text-gray-400 ml-1">MXN</span>
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1 font-medium">
                            {historial.length} {historial.length === 1 ? 'registro acumulado' : 'registros acumulados'}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-acero bg-acero/10 px-2 py-0.5 rounded-full mb-1">
                                <Sparkles size={11} /> Servicios
                            </span>
                            <p className="text-xs font-bold text-gray-500">Tratamientos y Consultas</p>
                        </div>
                        <div className="p-2.5 bg-acero/10 text-acero rounded-xl">
                            <Activity size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <p className="text-2xl font-black text-gray-900 leading-none">
                            {formatCurrency(comisionServicios)}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-1.5">
                            <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                {tasaServicios}% comisión
                            </span>
                            <span>por servicio</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full mb-1">
                                <ShoppingBag size={11} /> Productos
                            </span>
                            <p className="text-xs font-bold text-gray-500">Ventas en Mostrador</p>
                        </div>
                        <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                            <ShoppingBag size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <p className="text-2xl font-black text-gray-900 leading-none">
                            {formatCurrency(comisionProductos)}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-1.5">
                            <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                {tasaProductos}% comisión
                            </span>
                            <span>por producto</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full mb-1">
                                <CheckCircle2 size={11} /> Pagado
                            </span>
                            <p className="text-xs font-bold text-gray-500">Histórico Liquidado</p>
                        </div>
                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                            <Receipt size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <p className="text-2xl font-black text-gray-900 leading-none">
                            {formatCurrency(totalComisionesPagadasHistorico)}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1.5 font-medium">
                            En {historialPagos.length} {historialPagos.length === 1 ? 'nómina' : 'nóminas'}
                        </p>
                    </div>
                </div>
            </div>

            {/* BARRA DE PESTAÑAS */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('actual')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'actual'
                                ? 'bg-turquesa text-white shadow-sm shadow-turquesa/30'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        <Clock size={16} />
                        Periodo Actual (Por Cobrar)
                        <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
                            activeTab === 'actual' ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'
                        }`}>
                            {historial.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('liquidaciones')}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'liquidaciones'
                                ? 'bg-turquesa text-white shadow-sm shadow-turquesa/30'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        <Receipt size={16} />
                        Historial de Liquidaciones
                        <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
                            activeTab === 'liquidaciones' ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'
                        }`}>
                            {historialPagos.length}
                        </span>
                    </button>
                </div>

                {isModal && (
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={ExternalLink}
                        onClick={() => {
                            if (onCloseModal) onCloseModal();
                            navigate('/mis-comisiones');
                        }}
                        className="text-gray-500 hover:text-turquesa"
                    >
                        Pantalla Completa
                    </Button>
                )}
            </div>

            {/* CONTENIDO PESTAÑA 1: PERIODO ACTUAL */}
            {activeTab === 'actual' && (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/70 p-3 rounded-2xl border border-gray-100">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por tratamiento, paciente o producto..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white rounded-xl text-sm border border-gray-200 focus:outline-none focus:border-turquesa transition-all"
                            />
                            {busqueda && (
                                <button
                                    onClick={() => setBusqueda('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600"
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-gray-400 mr-1 flex items-center gap-1">
                                <Filter size={12} /> Tipo:
                            </span>
                            {['Todos', 'Servicio', 'Producto', 'Ajuste Manual'].map((tipo) => (
                                <button
                                    key={tipo}
                                    onClick={() => setFiltroTipo(tipo)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        filtroTipo === tipo
                                            ? 'bg-acero text-white shadow-xs'
                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                    {tipo}
                                </button>
                            ))}
                        </div>
                    </div>

                    {historialFiltrado.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center space-y-3">
                            <div className="w-14 h-14 bg-turquesa/10 text-turquesa rounded-2xl flex items-center justify-center mx-auto">
                                <Sparkles size={28} />
                            </div>
                            <h4 className="text-base font-bold text-gray-900">Sin comisiones en este filtro</h4>
                            <p className="text-sm text-gray-500 max-w-sm mx-auto">
                                {busqueda || filtroTipo !== 'Todos'
                                    ? 'No encontramos comisiones que coincidan con tus criterios de búsqueda.'
                                    : 'Aún no se han registrado comisiones en este periodo. Cuando completes sesiones o ventas en caja, aparecerán aquí automáticamente.'}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                            {/* Versión Desktop: Tabla */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-gray-50/80 text-[11px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                            <th className="py-3 px-4">Fecha y Hora</th>
                                            <th className="py-3 px-4">Tipo</th>
                                            <th className="py-3 px-4">Concepto / Motivo</th>
                                            <th className="py-3 px-4">Paciente</th>
                                            <th className="py-3 px-4 text-right">Monto Venta</th>
                                            <th className="py-3 px-4 text-right">% Com.</th>
                                            <th className="py-3 px-4 text-right">Comisión Ganada</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {historialFiltrado.map((h, i) => (
                                            <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                                                <td className="py-3.5 px-4 text-gray-600 font-medium text-xs whitespace-nowrap">
                                                    {formatDate(h.fecha)}
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                        h.tipoVenta === 'Servicio'
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : h.tipoVenta === 'Producto'
                                                            ? 'bg-purple-100 text-purple-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {h.tipoVenta}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 font-bold text-gray-900 max-w-[240px]">
                                                    <p className="truncate" title={h.detalleMotivo}>
                                                        {h.detalleMotivo || 'Sin detalle'}
                                                    </p>
                                                </td>
                                                <td className="py-3.5 px-4 text-gray-600 text-xs">
                                                    {h.pacienteNombre ? (
                                                        <span className="font-semibold text-gray-800">
                                                            {h.pacienteNombre}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 italic">Venta mostrador</span>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4 text-right font-medium text-gray-700 text-xs whitespace-nowrap">
                                                    {h.tipoVenta === 'Ajuste Manual' ? '—' : formatCurrency(h.montoVenta)}
                                                </td>
                                                <td className="py-3.5 px-4 text-right text-gray-500 text-xs font-semibold whitespace-nowrap">
                                                    {h.tipoVenta === 'Ajuste Manual' ? '—' : `${h.porcentajeAplicado}%`}
                                                </td>
                                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                    <span className={`font-black text-sm ${
                                                        Number(h.comisionGanada) < 0 ? 'text-red-500' : 'text-turquesa'
                                                    }`}>
                                                        {formatCurrency(h.comisionGanada)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Versión Móvil: Tarjetas compactas */}
                            <div className="md:hidden divide-y divide-gray-100">
                                {historialFiltrado.map((h, i) => (
                                    <div key={i} className="p-4 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                h.tipoVenta === 'Servicio'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : h.tipoVenta === 'Producto'
                                                    ? 'bg-purple-100 text-purple-700'
                                                    : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {h.tipoVenta}
                                            </span>
                                            <span className="text-[11px] text-gray-400 font-medium">
                                                {formatDate(h.fecha)}
                                            </span>
                                        </div>

                                        <div>
                                            <p className="font-bold text-gray-900 text-sm leading-tight">
                                                {h.detalleMotivo || 'Sin detalle'}
                                            </p>
                                            {h.pacienteNombre && (
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    Paciente: <span className="font-semibold text-gray-700">{h.pacienteNombre}</span>
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                                            <div className="text-xs text-gray-500">
                                                {h.tipoVenta !== 'Ajuste Manual' && (
                                                    <span>Venta: {formatCurrency(h.montoVenta)} ({h.porcentajeAplicado}%)</span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <span className={`font-black text-base ${
                                                    Number(h.comisionGanada) < 0 ? 'text-red-500' : 'text-turquesa'
                                                }`}>
                                                    +{formatCurrency(h.comisionGanada)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pie de sumatoria */}
                            <div className="bg-gray-50/90 p-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <span className="text-xs text-gray-500 font-medium">
                                    Mostrando <strong className="text-gray-900">{historialFiltrado.length}</strong> de {historial.length} comisiones registradas
                                </span>
                                <div className="text-right">
                                    <span className="text-xs text-gray-400 uppercase font-bold mr-2">Total Filtrado:</span>
                                    <span className="text-base font-black text-gray-900">
                                        {formatCurrency(sumaFiltrada)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* CONTENIDO PESTAÑA 2: HISTORIAL DE LIQUIDACIONES */}
            {activeTab === 'liquidaciones' && (
                <div className="space-y-4">
                    {historialPagos.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center space-y-3">
                            <div className="w-14 h-14 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto">
                                <Receipt size={28} />
                            </div>
                            <h4 className="text-base font-bold text-gray-900">Sin nóminas liquidadas</h4>
                            <p className="text-sm text-gray-500 max-w-sm mx-auto">
                                Cuando la administración liquide tu nómina y comisiones, aquí quedará registrado el comprobante y el desglose de cada pago.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {[...historialPagos].reverse().map((pago, idx) => {
                                const originalIdx = historialPagos.length - 1 - idx;
                                const isExpanded = pagoExpandidoIdx === originalIdx;
                                const totalComisionesPago = Number(pago.totalComisiones || 0);
                                const totalNetoPago = Number(pago.totalNeto || 0);
                                const itemsDetalle = pago.historialComisiones || [];

                                return (
                                    <div
                                        key={pago.folio || originalIdx}
                                        className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden transition-all"
                                    >
                                        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-xs font-black bg-turquesa/10 text-turquesa px-2.5 py-0.5 rounded-md">
                                                        {pago.folio || `NOM-${originalIdx + 1}`}
                                                    </span>
                                                    <Badge variant="green">Liquidado</Badge>
                                                    <span className="text-xs text-gray-500 font-medium">
                                                        Método: {pago.metodoPago || 'Transferencia'}
                                                    </span>
                                                </div>
                                                <h4 className="text-base font-black text-gray-900">
                                                    {pago.periodo || 'Periodo Liquidado'}
                                                </h4>
                                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Calendar size={13} className="text-gray-400" />
                                                    Liquidado el {formatDate(pago.fecha)}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                                                {Number(pago.sueldoBase) > 0 && (
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Sueldo Base</p>
                                                        <p className="text-sm font-bold text-gray-700">{formatCurrency(pago.sueldoBase)}</p>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Comisiones</p>
                                                    <p className="text-sm font-black text-turquesa">{formatCurrency(totalComisionesPago)}</p>
                                                </div>
                                                {(Number(pago.bonoPuntualidad) > 0 || Number(pago.bonoProductividad) > 0) && (
                                                    <div>
                                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Bonos</p>
                                                        <p className="text-sm font-bold text-purple-600">
                                                            {formatCurrency((Number(pago.bonoPuntualidad) || 0) + (Number(pago.bonoProductividad) || 0))}
                                                        </p>
                                                    </div>
                                                )}
                                                <div className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 text-right">
                                                    <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Total Neto</p>
                                                    <p className="text-lg font-black text-gray-900 leading-tight">
                                                        {formatCurrency(totalNetoPago)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    icon={Receipt}
                                                    onClick={() => setDatosReciboNomina({
                                                        ...pago,
                                                        empleadoNombre: staffDoc?.nombre || 'Especialista',
                                                        puesto: staffDoc?.puesto || 'Especialista',
                                                    })}
                                                    className="text-xs"
                                                >
                                                    Ver Recibo
                                                </Button>

                                                {itemsDetalle.length > 0 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={isExpanded ? ChevronUp : ChevronDown}
                                                        onClick={() => setPagoExpandidoIdx(isExpanded ? null : originalIdx)}
                                                        className="text-xs text-gray-600"
                                                    >
                                                        {isExpanded ? 'Ocultar' : `Detalle (${itemsDetalle.length})`}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {isExpanded && itemsDetalle.length > 0 && (
                                            <div className="border-t border-gray-100 bg-gray-50/50 p-4 sm:p-5 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h5 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                                        <Layers size={13} className="text-turquesa" />
                                                        Comisiones integradas en esta nómina
                                                    </h5>
                                                    <span className="text-xs text-gray-500 font-medium">
                                                        {itemsDetalle.length} partidas liquidadas
                                                    </span>
                                                </div>

                                                <div className="overflow-x-auto bg-white rounded-xl border border-gray-100">
                                                    <table className="w-full text-left border-collapse text-xs">
                                                        <thead>
                                                            <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                                                <th className="py-2.5 px-3">Fecha</th>
                                                                <th className="py-2.5 px-3">Tipo</th>
                                                                <th className="py-2.5 px-3">Concepto</th>
                                                                <th className="py-2.5 px-3 text-right">Monto Venta</th>
                                                                <th className="py-2.5 px-3 text-right">%</th>
                                                                <th className="py-2.5 px-3 text-right text-turquesa">Comisión</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {itemsDetalle.map((item, itIdx) => (
                                                                <tr key={itIdx} className="hover:bg-gray-50/50">
                                                                    <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                                                                        {formatDateShort(item.fecha)}
                                                                    </td>
                                                                    <td className="py-2 px-3">
                                                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                                                            item.tipoVenta === 'Servicio'
                                                                                ? 'bg-blue-50 text-blue-700'
                                                                                : item.tipoVenta === 'Producto'
                                                                                ? 'bg-purple-50 text-purple-700'
                                                                                : 'bg-amber-50 text-amber-700'
                                                                        }`}>
                                                                            {item.tipoVenta}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2 px-3 font-medium text-gray-800 max-w-[200px] truncate" title={item.detalleMotivo}>
                                                                        {item.detalleMotivo}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right text-gray-600">
                                                                        {item.tipoVenta === 'Ajuste Manual' ? '—' : formatCurrency(item.montoVenta)}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right text-gray-400">
                                                                        {item.tipoVenta === 'Ajuste Manual' ? '—' : `${item.porcentajeAplicado}%`}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right font-bold text-turquesa">
                                                                        {formatCurrency(item.comisionGanada)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {datosReciboNomina && (
                <ReciboNomina
                    isOpen={!!datosReciboNomina}
                    onClose={() => setDatosReciboNomina(null)}
                    datosNomina={datosReciboNomina}
                />
            )}
        </div>
    );
}
