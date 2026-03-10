import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DollarSign, CheckCircle, CreditCard, Banknote, Building2, Loader, RefreshCw } from 'lucide-react';
import { getCortesPorDia } from '../../services/finanzasService';

export default function CorteCajaGlobal() {
    const [cortes, setCortes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [aprobados, setAprobados] = useState({});

    const cargarCortes = async () => {
        setLoading(true);
        try {
            const data = await getCortesPorDia();
            setCortes(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargarCortes(); }, []);

    const formatCurrency = (amount) => `$${Number(amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

    const handleAprobar = (fecha) => {
        if (window.confirm(`¿Confirmar aprobación del corte del ${fecha}?`)) {
            setAprobados(prev => ({ ...prev, [fecha]: true }));
        }
    };

    const cortesTotales = cortes.reduce((acc, c) => acc + c.ingresosTotales, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-acero">Corte de Caja Global</h2>
                    <p className="text-gray-500 text-sm">Supervisión y auditoría de ingresos diarios por método de pago — datos reales de Firebase</p>
                </div>
                <div className="flex items-center gap-3">
                    {!loading && (
                        <div className="bg-turquesa/10 px-4 py-2 rounded-xl border border-turquesa/20 text-right">
                            <p className="text-xs text-turquesa font-bold">Total Captado</p>
                            <p className="text-xl font-black text-gray-900">{formatCurrency(cortesTotales)}</p>
                        </div>
                    )}
                    <Button variant="outline" icon={RefreshCw} onClick={cargarCortes}>Actualizar</Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
                    <Loader size={28} className="animate-spin text-turquesa" />
                    <span>Calculando cortes desde Firebase...</span>
                </div>
            ) : cortes.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                    <DollarSign size={48} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-lg font-semibold">Sin movimientos registrados</p>
                    <p className="text-sm">Los cobros de la Caja aparecerán aquí automáticamente.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {cortes.map((corte) => {
                        const isAprobado = aprobados[corte.fecha] || corte.estado === 'Aprobado';
                        return (
                            <Card key={corte.fecha} className={isAprobado ? 'border-green-100 bg-green-50/10' : 'border-yellow-200 bg-yellow-50/10'}>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-lg font-bold text-gray-900">{corte.fecha}</h3>
                                            {isAprobado
                                                ? <Badge variant="green">Auditado y Aprobado</Badge>
                                                : <Badge variant="yellow">Pendiente de Revisión</Badge>
                                            }
                                        </div>
                                        <p className="text-sm text-gray-500">Caja Principal — {corte.movimientos?.length || 0} movimientos</p>
                                    </div>

                                    <div className="text-right w-full md:w-auto">
                                        <p className="text-sm text-gray-500 font-medium">Ingreso Total Reportado</p>
                                        <p className="text-3xl font-bold text-turquesa">{formatCurrency(corte.ingresosTotales)}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 border-t border-gray-100 pt-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-100 text-green-600 rounded-lg"><Banknote size={20} /></div>
                                        <div>
                                            <p className="text-xs text-gray-400 font-medium">Efectivo</p>
                                            <p className="text-lg font-bold text-gray-900">{formatCurrency(corte.efectivo)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><CreditCard size={20} /></div>
                                        <div>
                                            <p className="text-xs text-gray-400 font-medium">Tarjeta</p>
                                            <p className="text-lg font-bold text-gray-900">{formatCurrency(corte.tarjeta)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Building2 size={20} /></div>
                                        <div>
                                            <p className="text-xs text-gray-400 font-medium">Transferencia</p>
                                            <p className="text-lg font-bold text-gray-900">{formatCurrency(corte.transferencia)}</p>
                                        </div>
                                    </div>
                                </div>

                                {!isAprobado && (
                                    <div className="mt-6 flex justify-end">
                                        <Button variant="primary" icon={CheckCircle} onClick={() => handleAprobar(corte.fecha)} className="bg-green-500 border-green-500 hover:bg-green-600">
                                            Aprobar Corte
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
