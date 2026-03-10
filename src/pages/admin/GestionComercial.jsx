import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { PlusCircle, Edit, Trash2, Tag, DollarSign, Package, Percent } from 'lucide-react';

const initialServicios = [
    { id: 1, tipo: 'Servicio Individual', nombre: 'Limpieza Facial Profunda', costoInsumos: 150, precioVenta: 800 },
    { id: 2, tipo: 'Procedimiento', nombre: 'Aplicación de Botox (Zona)', costoInsumos: 1200, precioVenta: 3500 },
    { id: 3, tipo: 'Paquete / Plan Tratamiento', nombre: 'Plan Lipoescultura + 5 Masajes Post', costoInsumos: 15000, precioVenta: 65000 },
];

const initialCupones = [
    { id: 1, codigo: 'BOTOX20', descuento: 20, tipo: 'Porcentaje', activo: true },
    { id: 2, codigo: 'VERANO500', descuento: 500, tipo: 'Monto Fijo', activo: false },
];

export default function GestionComercial() {
    const [servicios, setServicios] = useState(initialServicios);
    const [cupones, setCupones] = useState(initialCupones);

    // Modals state
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);

    // Form state
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ nombre: '', costoInsumos: '', precioVenta: '', tipo: 'Servicio Individual' });

    const formatCurrency = (amount) => `$${Number(amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

    // --- ITEM MANAGEMENT ---
    const handleOpenItemModal = (item = null) => {
        if (item) {
            setEditingItem(item.id);
            setFormData({ ...item });
        } else {
            setEditingItem(null);
            setFormData({ nombre: '', costoInsumos: '', precioVenta: '', tipo: 'Servicio Individual' });
        }
        setIsItemModalOpen(true);
    };

    const handleSaveItem = () => {
        if (!formData.nombre || !formData.precioVenta) return;

        const newItem = {
            ...formData,
            id: editingItem || Date.now(),
            costoInsumos: Number(formData.costoInsumos) || 0,
            precioVenta: Number(formData.precioVenta) || 0,
        };

        if (editingItem) {
            setServicios(servicios.map(s => s.id === editingItem ? newItem : s));
        } else {
            setServicios([...servicios, newItem]);
        }
        setIsItemModalOpen(false);
    };

    const handleDeleteItem = (id) => {
        if (window.confirm('¿Estás seguro de eliminar este item del catálogo?')) {
            setServicios(servicios.filter(s => s.id !== id));
        }
    };

    // --- KPIs ---
    const totalItems = servicios.length;
    const avgMargin = servicios.length > 0
        ? (servicios.reduce((acc, curr) => acc + ((curr.precioVenta - curr.costoInsumos) / curr.precioVenta), 0) / servicios.length * 100).toFixed(1)
        : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-acero">Catálogo y Gestión Comercial</h2>
                    <p className="text-gray-500 text-sm">Control real de servicios, paquetes, costos y cupones de descuento</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" icon={Tag} onClick={() => setIsCouponModalOpen(true)}>Gestor de Cupones</Button>
                    <Button variant="primary" icon={PlusCircle} onClick={() => handleOpenItemModal()}>Nuevo Item</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card className="bg-turquesa/5 border-turquesa/20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-turquesa/10 rounded-xl text-turquesa"><Package size={24} /></div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total en Catálogo</p>
                            <h3 className="text-2xl font-bold text-gray-900">{totalItems} Items Activos</h3>
                        </div>
                    </div>
                </Card>
                <Card className="bg-acero/5 border-acero/20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-acero/10 rounded-xl text-acero"><DollarSign size={24} /></div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Margen de Ganancia Promedio</p>
                            <h3 className="text-2xl font-bold text-gray-900">{avgMargin}%</h3>
                        </div>
                    </div>
                </Card>
                <Card className="bg-orange-500/5 border-orange-500/20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500"><Percent size={24} /></div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Cupones Activos</p>
                            <h3 className="text-2xl font-bold text-gray-900">{cupones.filter(c => c.activo).length} Promociones</h3>
                        </div>
                    </div>
                </Card>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 text-sm text-gray-500 bg-gray-50/50">
                                <th className="py-3 px-4 font-medium">Nombre / Tipo</th>
                                <th className="py-3 px-4 font-medium">Costo (Insumos)</th>
                                <th className="py-3 px-4 font-medium">Precio Venta</th>
                                <th className="py-3 px-4 font-medium">Margen Libre</th>
                                <th className="py-3 px-4 font-medium text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {servicios.map((item) => {
                                const margenLibre = item.precioVenta - item.costoInsumos;
                                const margenPorcentaje = item.precioVenta > 0 ? Math.round((margenLibre / item.precioVenta) * 100) : 0;

                                return (
                                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                                        <td className="py-3 px-4 font-medium text-gray-900">
                                            <div className="flex flex-col">
                                                <span>{item.nombre}</span>
                                                <span className="text-xs text-turquesa font-semibold mt-1">{item.tipo}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-red-500 font-medium">
                                            {formatCurrency(item.costoInsumos)}
                                        </td>
                                        <td className="py-3 px-4 text-gray-900 font-bold">
                                            {formatCurrency(item.precioVenta)}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-col">
                                                <span className="text-green-600 font-bold">{formatCurrency(margenLibre)}</span>
                                                <span className="text-[10px] text-gray-400">({margenPorcentaje}% rentabilidad)</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenItemModal(item)} />
                                                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 hover:text-red-600" icon={Trash2} onClick={() => handleDeleteItem(item.id)} />
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {servicios.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="py-8 text-center text-gray-400">
                                        No hay servicios registrados en el catálogo.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Modal: Editar/Crear Item */}
            <Modal
                isOpen={isItemModalOpen}
                onClose={() => setIsItemModalOpen(false)}
                title={editingItem ? "Editar Item Comercial" : "Nuevo Item en Catálogo"}
                footer={
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsItemModalOpen(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleSaveItem}>Guardar en Catálogo</Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-gray-700">Nombre del Servicio o Paquete</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-turquesa outline-none bg-gray-50"
                            placeholder="Ej. Depilación Láser Piernas"
                            value={formData.nombre}
                            onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-700 mb-1 block">Tipo de Item</label>
                        <select
                            className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-turquesa outline-none bg-gray-50"
                            value={formData.tipo}
                            onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                        >
                            <option value="Servicio Individual">Servicio Individual</option>
                            <option value="Procedimiento">Procedimiento Especializado</option>
                            <option value="Paquete / Plan Tratamiento">Paquete / Plan Tratamiento</option>
                            <option value="Producto Físico (Venta)">Producto Físico (Venta)</option>
                        </select>
                    </div>

                    {formData.tipo === 'Paquete / Plan Tratamiento' && (
                        <div className="p-4 bg-turquesa/5 border border-turquesa/20 rounded-xl space-y-4">
                            <h4 className="font-bold text-sm text-acero flex items-center gap-2">
                                <Package size={16} /> Configuración del Paquete
                            </h4>
                            {/* Constructor Visual Simplificado */}
                            <div className="space-y-2">
                                <div className="flex gap-2 text-xs font-bold text-gray-500 uppercase px-2">
                                    <div className="flex-1">Servicio Incluido</div>
                                    <div className="w-20 text-center">Sesiones</div>
                                </div>
                                {/* Item 1 Mock */}
                                <div className="flex gap-2 items-center">
                                    <select className="flex-1 px-3 py-2 text-sm border rounded-lg bg-white outline-none">
                                        <option>Limpieza Facial Profunda ($800)</option>
                                        <option>Aplicación de Botox ($3,500)</option>
                                    </select>
                                    <input type="number" defaultValue="5" className="w-20 px-3 py-2 text-sm border rounded-lg bg-white outline-none text-center" min="1" />
                                    <button className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16} /></button>
                                </div>
                                <Button variant="ghost" size="sm" icon={PlusCircle} className="text-turquesa w-full mt-2 border border-dashed border-turquesa/30 bg-white">Añadir otro servicio al paquete</Button>
                            </div>

                            <div className="pt-3 border-t border-turquesa/20">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">Suma Individual Total:</span>
                                    <span className="font-bold text-gray-400 line-through">$4,000.00</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-acero font-bold">Descuento de Paquete (%):</span>
                                    <input type="number" defaultValue="15" className="w-20 px-2 py-1 text-sm border rounded bg-white outline-none text-right font-bold text-turquesa" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-bold text-gray-700">Costo de Insumos ({formData.tipo === 'Paquete / Plan Tratamiento' ? 'Total' : '$'})</label>
                            <input
                                type="number"
                                className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-turquesa outline-none ${formData.tipo === 'Paquete / Plan Tratamiento' ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-red-600 font-medium'}`}
                                placeholder="0.00"
                                value={formData.tipo === 'Paquete / Plan Tratamiento' ? 750 : formData.costoInsumos}
                                onChange={e => {
                                    if (formData.tipo !== 'Paquete / Plan Tratamiento') {
                                        setFormData({ ...formData, costoInsumos: e.target.value })
                                    }
                                }}
                                readOnly={formData.tipo === 'Paquete / Plan Tratamiento'}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-bold text-gray-700">Precio Venta Final ({formData.tipo === 'Paquete / Plan Tratamiento' ? 'Con Desc.' : '$'})</label>
                            <input
                                type="number"
                                className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-turquesa outline-none text-green-600 font-bold ${formData.tipo === 'Paquete / Plan Tratamiento' ? 'bg-turquesa/5' : 'bg-gray-50'}`}
                                placeholder="0.00"
                                value={formData.tipo === 'Paquete / Plan Tratamiento' ? 3400 : formData.precioVenta}
                                onChange={e => {
                                    if (formData.tipo !== 'Paquete / Plan Tratamiento') {
                                        setFormData({ ...formData, precioVenta: e.target.value })
                                    }
                                }}
                                readOnly={formData.tipo === 'Paquete / Plan Tratamiento'}
                            />
                        </div>
                    </div>

                    {/* Live Margin Calculator preview */}
                    {(formData.precioVenta > 0 || formData.tipo === 'Paquete / Plan Tratamiento') && (
                        <div className="mt-4 p-3 bg-acero/5 border border-acero/20 rounded-lg flex justify-between items-center">
                            <span className="text-sm text-gray-600">Margen Proyectado:</span>
                            <span className="font-bold text-green-600">
                                {formData.tipo === 'Paquete / Plan Tratamiento'
                                    ? formatCurrency(3400 - 750)
                                    : formatCurrency(formData.precioVenta - (formData.costoInsumos || 0))
                                }
                                <span className="text-xs text-gray-500 ml-1">
                                    ({formData.tipo === 'Paquete / Plan Tratamiento'
                                        ? Math.round(((3400 - 750) / 3400) * 100)
                                        : Math.round(((formData.precioVenta - (formData.costoInsumos || 0)) / formData.precioVenta) * 100)
                                    }%)
                                </span>
                            </span>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Modal: Gestor de Cupones */}
            <Modal
                isOpen={isCouponModalOpen}
                onClose={() => setIsCouponModalOpen(false)}
                title="Gestor Estratégico de Cupones"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-500 mb-4">Crea códigos de descuento para que las recepcionistas los apliquen en caja y cierren más ventas.</p>

                    <div className="flex gap-2">
                        <input type="text" placeholder="Código (ej. ALFRAVIP)" className="flex-1 px-3 py-2 border rounded-lg text-sm uppercase" />
                        <input type="number" placeholder="Valor" className="w-24 px-3 py-2 border rounded-lg text-sm" />
                        <select className="px-3 py-2 border rounded-lg text-sm outline-none">
                            <option>%</option>
                            <option>$ Fijo</option>
                        </select>
                        <Button variant="primary" size="sm" icon={PlusCircle}>Crear</Button>
                    </div>

                    <div className="mt-6 space-y-2">
                        <h4 className="font-bold text-sm text-gray-700 border-b pb-2">Cupones Existentes</h4>
                        {cupones.map(cupon => (
                            <div key={cupon.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${cupon.activo ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                    <div>
                                        <p className="font-bold text-acero">{cupon.codigo}</p>
                                        <p className="text-xs text-gray-500">{cupon.descuento}{cupon.tipo === 'Porcentaje' ? '%' : ' MXN'} de descuento</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="text-xs px-2 py-1 bg-white border shadow-sm rounded hover:bg-gray-50">
                                        {cupon.activo ? 'Desactivar' : 'Activar'}
                                    </button>
                                    <button className="text-xs text-red-500 px-2 py-1 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
