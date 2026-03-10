import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Activity, DollarSign, TrendingDown, TrendingUp, PlusCircle, ArrowUpRight, ArrowDownRight, FileText, Loader } from 'lucide-react';
import { onMovimientosChange, registrarMovimiento } from '../../services/finanzasService';

const CATEGORIAS_GASTO = ['Insumos Médicos', 'Nómina', 'Servicios', 'Renta', 'Equipo', 'Otro'];

export default function ContabilidadView() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('Todos');

    // Modal para nuevo gasto
    const [showModal, setShowModal] = useState(false);
    const [nuevoGasto, setNuevoGasto] = useState({ description: '', amount: '', category: 'Insumos Médicos' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const unsub = onMovimientosChange((movimientos) => {
            // Normalizar formato de Firestore a formato de la tabla
            const normalized = movimientos.map(m => ({
                id: m.id,
                date: m.createdAt ? new Date(m.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
                type: m.tipo === 'Ingreso' ? 'Ingreso' : 'Egreso',
                category: m.categoria || m.motivo?.split(':')[0] || 'General',
                description: m.motivo || m.descripcion || m.concepto || '—',
                amount: Number(m.monto) || 0,
                status: m.estado || 'Completado',
            }));
            setTransactions(normalized);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const totalIngresos = transactions.filter(t => t.type === 'Ingreso').reduce((acc, curr) => acc + curr.amount, 0);
    const totalEgresos = transactions.filter(t => t.type === 'Egreso').reduce((acc, curr) => acc + curr.amount, 0);
    const balanceNeto = totalIngresos - totalEgresos;

    const formatCurrency = (amount) => `$${Number(amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

    const handleRegistrarGasto = async () => {
        if (!nuevoGasto.description || !nuevoGasto.amount) {
            alert('Por favor completa todos los campos.');
            return;
        }
        setSaving(true);
        try {
            await registrarMovimiento({
                tipo: 'Egreso',
                monto: parseFloat(nuevoGasto.amount),
                motivo: nuevoGasto.description,
                categoria: nuevoGasto.category,
                metodoPago: 'Efectivo',
                estado: 'Pagado',
            });
            setShowModal(false);
            setNuevoGasto({ description: '', amount: '', category: 'Insumos Médicos' });
        } catch (err) {
            alert('Error al registrar el gasto.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const filteredTransactions = filter === 'Todos' ? transactions : transactions.filter(t => t.type === filter);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-acero">Módulo de Contabilidad</h2>
                    <p className="text-gray-500 text-sm">Control estricto de ingresos, egresos, y salud financiera de la clínica</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" icon={FileText} onClick={() => alert('Exportando reporte contable...')}>Reporte SAT</Button>
                    <Button variant="primary" icon={PlusCircle} onClick={() => setShowModal(true)} className="bg-red-500 hover:bg-red-600 border-red-500 text-white">Registrar Gasto</Button>
                </div>
            </div>

            {/* Modal nuevo gasto */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
                        <h3 className="text-lg font-bold text-acero">Registrar Gasto Operativo</h3>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Categoría</label>
                            <select className="w-full mt-1 p-3 border rounded-xl text-sm" value={nuevoGasto.category} onChange={e => setNuevoGasto(prev => ({ ...prev, category: e.target.value }))}>
                                {CATEGORIAS_GASTO.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Descripción</label>
                            <input className="w-full mt-1 p-3 border rounded-xl text-sm" placeholder="Ej. Compra de Ácido Hialurónico" value={nuevoGasto.description} onChange={e => setNuevoGasto(prev => ({ ...prev, description: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Monto ($)</label>
                            <input type="number" className="w-full mt-1 p-3 border rounded-xl text-sm" placeholder="0.00" value={nuevoGasto.amount} onChange={e => setNuevoGasto(prev => ({ ...prev, amount: e.target.value }))} />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
                            <Button variant="primary" onClick={handleRegistrarGasto} disabled={saving} className="flex-1 bg-red-500 border-red-500">
                                {saving ? 'Guardando...' : 'Registrar Egreso'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white border-l-4 border-turquesa shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-bold text-gray-500 mb-1">Ingresos Brutos (Total)</p>
                            <h3 className="text-3xl font-black text-gray-900">{loading ? '...' : formatCurrency(totalIngresos)}</h3>
                        </div>
                        <div className="p-3 bg-turquesa/10 text-turquesa rounded-xl"><TrendingUp size={24} /></div>
                    </div>
                </Card>

                <Card className="bg-white border-l-4 border-red-500 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-bold text-gray-500 mb-1">Egresos / Gastos Operativos</p>
                            <h3 className="text-3xl font-black text-gray-900">{loading ? '...' : formatCurrency(totalEgresos)}</h3>
                        </div>
                        <div className="p-3 bg-red-50 text-red-500 rounded-xl"><TrendingDown size={24} /></div>
                    </div>
                </Card>

                <Card className={`bg-white border-l-4 shadow-sm ${balanceNeto >= 0 ? 'border-green-500' : 'border-red-500'}`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-bold text-gray-500 mb-1">Balance Neto / Utilidad</p>
                            <h3 className={`text-3xl font-black ${balanceNeto >= 0 ? 'text-green-600' : 'text-red-500'}`}>{loading ? '...' : formatCurrency(balanceNeto)}</h3>
                        </div>
                        <div className={`p-3 rounded-xl ${balanceNeto >= 0 ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}><DollarSign size={24} /></div>
                    </div>
                </Card>
            </div>

            {/* Transactions History */}
            <Card>
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b pb-4 gap-4">
                    <h3 className="text-lg font-bold text-acero flex items-center gap-2"><Activity size={20} /> Historial de Movimientos</h3>
                    <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                        {['Todos', 'Ingreso', 'Egreso'].map(f => (
                            <button key={f} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${filter === f ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} onClick={() => setFilter(f)}>{f}s</button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
                        <Loader size={24} className="animate-spin text-turquesa" />
                        <span className="text-sm">Cargando movimientos desde Firebase...</span>
                    </div>
                ) : filteredTransactions.length === 0 ? (
                    <p className="text-center text-gray-400 italic py-8">No hay movimientos registrados aún.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 text-sm text-gray-500">
                                    <th className="py-3 px-4 font-medium">Fecha</th>
                                    <th className="py-3 px-4 font-medium">Concepto</th>
                                    <th className="py-3 px-4 font-medium">Categoría</th>
                                    <th className="py-3 px-4 font-medium">Estado</th>
                                    <th className="py-3 px-4 font-medium text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.map((trx) => (
                                    <tr key={trx.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 px-4 text-sm text-gray-500">{trx.date}</td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${trx.type === 'Ingreso' ? 'bg-turquesa/10 text-turquesa' : 'bg-red-100 text-red-500'}`}>
                                                    {trx.type === 'Ingreso' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                                                </div>
                                                <span className="font-medium text-gray-900">{trx.description}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4"><span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">{trx.category}</span></td>
                                        <td className="py-4 px-4">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${trx.status === 'Completado' || trx.status === 'Pagado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {trx.status}
                                            </span>
                                        </td>
                                        <td className={`py-4 px-4 text-right font-black ${trx.type === 'Ingreso' ? 'text-turquesa' : 'text-red-500'}`}>
                                            {trx.type === 'Ingreso' ? '+' : '-'}{formatCurrency(trx.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
