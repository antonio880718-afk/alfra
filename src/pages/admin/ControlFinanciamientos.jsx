import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { PiggyBank, Edit3, AlertCircle, PlusCircle, Loader } from 'lucide-react';
import { onPlanesChange, updatePlan, createPlan } from '../../services/planesService';

export default function ControlFinanciamientos() {
    const [planes, setPlanes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isNuevoOpen, setIsNuevoOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [nuevoSaldo, setNuevoSaldo] = useState('');
    const [razon, setRazon] = useState('');
    const [saving, setSaving] = useState(false);
    const [nuevoPlan, setNuevoPlan] = useState({ paciente: '', objetivo: '', meta: '' });

    useEffect(() => {
        const unsub = onPlanesChange((data) => {
            const normalized = data.map(p => ({
                ...p,
                faltante: Math.max(0, (Number(p.meta) || 0) - (Number(p.acumulado) || 0)),
            }));
            setPlanes(normalized);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const formatCurrency = (amount) => `$${Number(amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

    const handleOpenModal = (plan) => {
        setSelectedPlan(plan);
        setNuevoSaldo(plan.acumulado);
        setRazon('');
        setIsModalOpen(true);
    };

    const handleAplicarAjuste = async () => {
        if (!razon) { alert('Ingresa la razón del ajuste.'); return; }
        setSaving(true);
        try {
            await updatePlan(selectedPlan.id, {
                acumulado: parseFloat(nuevoSaldo) || 0,
                ultimoAjuste: razon,
                morosidad: parseFloat(nuevoSaldo) < (selectedPlan.meta * 0.1),
            });
            setIsModalOpen(false);
        } catch (err) {
            alert('Error al aplicar ajuste.'); console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleCrearPlan = async () => {
        if (!nuevoPlan.paciente || !nuevoPlan.meta) { alert('Completa los campos.'); return; }
        setSaving(true);
        try {
            await createPlan({
                paciente: nuevoPlan.paciente,
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
                    <h2 className="text-2xl font-bold text-acero">Control de Financiamientos y Planes de Tratamiento</h2>
                    <p className="text-gray-500 text-sm">Supervisión de metas de pacientes, condonación y ajustes manuales de saldos</p>
                </div>
                <Button variant="primary" icon={PlusCircle} onClick={() => setIsNuevoOpen(true)}>Nuevo Plan</Button>
            </div>

            <Card>
                {loading ? (
                    <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
                        <Loader size={24} className="animate-spin text-turquesa" />
                        <span className="text-sm">Cargando planes desde Firebase...</span>
                    </div>
                ) : planes.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <PiggyBank size={40} className="mx-auto mb-3 text-gray-300" />
                        <p className="font-medium">Sin planes registrados aún</p>
                        <p className="text-sm">Haz clic en "Nuevo Plan" para agregar el primer financiamiento.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 text-sm text-gray-500 bg-gray-50/50">
                                    <th className="py-3 px-4 font-medium">Paciente / Objetivo</th>
                                    <th className="py-3 px-4 font-medium">Meta Total</th>
                                    <th className="py-3 px-4 font-medium">Saldo Acumulado</th>
                                    <th className="py-3 px-4 font-medium">Estatus</th>
                                    <th className="py-3 px-4 font-medium text-center">Ajuste Maestro</th>
                                </tr>
                            </thead>
                            <tbody>
                                {planes.map((plan) => (
                                    <tr key={plan.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                                        <td className="py-4 px-4 font-medium text-gray-900">
                                            <div className="flex flex-col">
                                                <span>{plan.paciente}</span>
                                                <span className="text-xs text-gray-500 font-normal flex items-center gap-1 mt-1">
                                                    <PiggyBank size={12} /> {plan.objetivo}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-acero font-bold">{formatCurrency(plan.meta)}</td>
                                        <td className="py-4 px-4 text-turquesa font-bold">
                                            {formatCurrency(plan.acumulado)}
                                            <span className="block text-xs text-gray-400 font-normal">Falta: {formatCurrency(plan.faltante)}</span>
                                        </td>
                                        <td className="py-4 px-4">
                                            {plan.morosidad ? <Badge variant="red">Atraso Detectado</Badge> : <Badge variant="green">Corriente</Badge>}
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <Button variant="outline" size="sm" icon={Edit3} onClick={() => handleOpenModal(plan)}>Ajustar Saldo</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Modal ajuste de saldo */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`Ajuste de Saldo Maestro: ${selectedPlan?.paciente}`}
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
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                        <AlertCircle className="text-red-500 flex-shrink-0" />
                        <p className="text-xs text-red-700">Atención Superusuario: Estás a punto de modificar manualmente el saldo de un paciente. Esto alterará los registros contables.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Saldo Actual</label>
                            <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedPlan?.acumulado)}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Nuevo Saldo ($)</label>
                            <input type="number" className="w-full p-3 border rounded-xl text-sm" value={nuevoSaldo} onChange={e => setNuevoSaldo(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Razón / Concepto</label>
                        <input className="w-full p-3 border rounded-xl text-sm" placeholder="Ej. Promoción especial por Dirección" value={razon} onChange={e => setRazon(e.target.value)} />
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
                            <input className="w-full mt-1 p-3 border rounded-xl text-sm" value={nuevoPlan.paciente} onChange={e => setNuevoPlan(prev => ({ ...prev, paciente: e.target.value }))} />
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
        </div>
    );
}
