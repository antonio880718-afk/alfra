import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import {
    Package, ShoppingBag, PlusCircle, Edit3, Trash2, Download,
    AlertTriangle, CheckCircle, XCircle, Clock, Send, Loader,
    Search, RefreshCw, ChevronDown, ChevronUp, Info, DollarSign
} from 'lucide-react';
import {
    onInventarioChange, createInventarioItem, updateInventarioItem, deleteInventarioItem,
    onSolicitudesChange, createSolicitud, responderSolicitud,
} from '../../services/inventarioService';
import { useAuth } from '../../contexts/AuthContext';

const UNIDADES = ['pz', 'ml', 'g', 'lt', 'kg', 'caja', 'ampolleta', 'rollo', 'sobre', 'otro'];
const CATEGORIAS_PRODUCTO = ['Cuidado Facial', 'Cuidado Corporal', 'Protección Solar', 'Tratamiento Capilar', 'Suplementos', 'Otro'];
const CATEGORIAS_INSUMO = ['Facial', 'Corporal', 'Aparatología', 'Higiene y Asepsia', 'Inyectables', 'Otro'];

const emptyItem = {
    nombre: '', descripcion: '', categoria: '', tipo: 'insumo',
    stock: '', stockMinimo: '5', precio: '', costo: '',
    fechaAdquisicion: new Date().toISOString().split('T')[0],
    unidad: 'pz', proveedor: '',
};

const inputCls = 'w-full p-2.5 border rounded-xl border-gray-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none text-sm bg-gray-50 focus:bg-white transition-all';

function StockBadge({ stock, minimo }) {
    const s = Number(stock) || 0, m = Number(minimo) || 5;
    if (s === 0) return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">Sin stock</span>;
    if (s <= m) return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">Stock bajo</span>;
    return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">OK</span>;
}

export default function InventarioView() {
    const { userRole, currentUser } = useAuth();
    const canEdit = userRole === 'Administrador' || userRole === 'Recepcionista';
    const isAdmin = userRole === 'Administrador';
    const canRequest = userRole === 'Especialista' || userRole === 'Recepcionista';

    const [tab, setTab] = useState('productos');          // 'productos' | 'insumos' | 'solicitudes'
    const [inventario, setInventario] = useState([]);
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');

    // ── Modal item ────────────────────────────────────────────────────────
    const [modalItem, setModalItem] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formItem, setFormItem] = useState(emptyItem);
    const [savingItem, setSavingItem] = useState(false);
    const setF = (k, v) => setFormItem(p => ({ ...p, [k]: v }));

    // ── Modal solicitud ────────────────────────────────────────────────────
    const [modalSolicitud, setModalSolicitud] = useState(false);
    const [insumoSolicitud, setInsumoSolicitud] = useState(null);
    const [formSolic, setFormSolic] = useState({ cantidad: '1', motivo: '' });
    const [savingSolic, setSavingSolic] = useState(false);
    const [exitoSolic, setExitoSolic] = useState(false);

    useEffect(() => {
        const unsubInv = onInventarioChange((data) => { setInventario(data); setLoading(false); });
        const unsubSol = onSolicitudesChange((data) => setSolicitudes(data));
        return () => { unsubInv(); unsubSol(); };
    }, []);

    const tipoActual = tab === 'productos' ? 'producto' : 'insumo';
    const itemsFiltrados = inventario
        .filter(i => i.tipo === tipoActual)
        .filter(i => !busqueda || (i.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) || (i.categoria || '').toLowerCase().includes(busqueda.toLowerCase()));

    const pendientes = solicitudes.filter(s => s.status === 'Pendiente').length;

    // ── Abrir modal editar/nuevo ──────────────────────────────────────────
    const abrirModalItem = (item = null) => {
        setEditingItem(item);
        setFormItem(item ? {
            nombre: item.nombre || '', descripcion: item.descripcion || '', categoria: item.categoria || '',
            tipo: item.tipo || tipoActual, stock: item.stock ?? '', stockMinimo: item.stockMinimo ?? '5',
            precio: item.precio ?? '', costo: item.costo ?? '',
            fechaAdquisicion: item.fechaAdquisicion || new Date().toISOString().split('T')[0],
            unidad: item.unidad || 'pz', proveedor: item.proveedor || '',
        } : { ...emptyItem, tipo: tipoActual });
        setModalItem(true);
    };

    const handleGuardarItem = async () => {
        if (!formItem.nombre.trim()) { alert('El nombre es obligatorio.'); return; }
        setSavingItem(true);
        try {
            const data = {
                ...formItem,
                stock: Number(formItem.stock) || 0,
                stockMinimo: Number(formItem.stockMinimo) || 5,
                precio: Number(formItem.precio) || 0,
                costo: Number(formItem.costo) || 0,
            };
            if (editingItem) await updateInventarioItem(editingItem.id, data);
            else await createInventarioItem(data);
            setModalItem(false);
        } catch (err) { alert('Error al guardar.'); console.error(err); }
        finally { setSavingItem(false); }
    };

    const handleEliminar = async (id, nombre) => {
        if (!window.confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
        try { await deleteInventarioItem(id); } catch { alert('Error al eliminar.'); }
    };

    // ── Solicitar insumo ─────────────────────────────────────────────────
    const abrirSolicitud = (insumo) => {
        setInsumoSolicitud(insumo);
        setFormSolic({ cantidad: '1', motivo: '' });
        setExitoSolic(false);
        setModalSolicitud(true);
    };

    const handleCrearSolicitud = async () => {
        if (!formSolic.cantidad || Number(formSolic.cantidad) < 1) { alert('Ingresa una cantidad válida.'); return; }
        setSavingSolic(true);
        try {
            await createSolicitud({
                insumoId: insumoSolicitud.id,
                insumoNombre: insumoSolicitud.nombre,
                cantidad: Number(formSolic.cantidad),
                motivo: formSolic.motivo,
                solicitanteNombre: currentUser?.email || userRole,
                solicitanteRole: userRole,
            });
            setExitoSolic(true);
            setTimeout(() => setModalSolicitud(false), 1500);
        } catch (err) { alert('Error al enviar solicitud.'); console.error(err); }
        finally { setSavingSolic(false); }
    };

    // ── Responder solicitud (Admin) ─────────────────────────────────────
    const handleResponder = async (sol, nuevoStatus) => {
        try {
            await responderSolicitud(sol.id, nuevoStatus, sol.insumoId, sol.cantidad);
        } catch { alert('Error al responder.'); }
    };

    const formatFecha = (f) => { if (!f) return '—'; try { return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return f; } };
    const formatCurr = (v) => `$${Number(v || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

    const categorias = tab === 'productos' ? CATEGORIAS_PRODUCTO : CATEGORIAS_INSUMO;

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <Package className="text-turquesa" size={32} /> Inventario
                    </h2>
                    <p className="text-gray-500 font-medium mt-1">
                        {canEdit ? 'Control central de existencias y suministros' : 'Catálogo de productos e insumos'}
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <Card variant="subtle" className="px-5 py-2 border-none">
                        <p className="text-[10px] text-turquesa font-black uppercase tracking-widest">Productos</p>
                        <p className="text-2xl font-black text-gray-900">{inventario.filter(i => i.tipo === 'producto').length}</p>
                    </Card>
                    <Card variant="subtle" className="px-5 py-2 border-none">
                        <p className="text-[10px] text-acero font-black uppercase tracking-widest">Insumos</p>
                        <p className="text-2xl font-black text-gray-900">{inventario.filter(i => i.tipo === 'insumo').length}</p>
                    </Card>
                    {inventario.filter(i => Number(i.stock) <= Number(i.stockMinimo || 5)).length > 0 && (
                        <Card variant="subtle" className="px-5 py-2 border-none bg-rose-50 ring-1 ring-rose-100">
                            <p className="text-[10px] text-rose-500 font-black uppercase tracking-widest flex items-center gap-1">Stock Bajo</p>
                            <p className="text-2xl font-black text-rose-600">{inventario.filter(i => Number(i.stock) <= Number(i.stockMinimo || 5)).length}</p>
                        </Card>
                    )}
                </div>
            </div>

            {/* Navigation & Actions */}
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex p-1.5 bg-gray-100/50 rounded-2xl w-full lg:w-auto gap-1">
                    {[
                        { key: 'productos', label: 'Productos de Venta', icon: ShoppingBag },
                        { key: 'insumos', label: 'Insumos', icon: Package },
                        ...(isAdmin ? [{ key: 'solicitudes', label: `Solicitudes${pendientes > 0 ? ` (${pendientes})` : ''}`, icon: Clock }] : []),
                    ].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`
                                flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300
                                ${tab === t.key ? 'bg-white text-turquesa shadow-md' : 'text-gray-400 hover:text-gray-600'}
                            `}>
                            <t.icon size={18} /> {t.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-80">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar en el catálogo..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-turquesa/20 outline-none text-sm font-medium transition-all"
                        />
                    </div>
                    {canEdit && (tab === 'productos' || tab === 'insumos') && (
                        <Button variant="primary" className="rounded-2xl h-[44px] px-6" icon={PlusCircle} onClick={() => abrirModalItem()}>
                            Nuevo
                        </Button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-turquesa/10 border-t-turquesa rounded-full animate-spin" />
                        <Package className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-turquesa/50" size={24} />
                    </div>
                    <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Sincronizando Inventario</p>
                </div>
            ) : (tab === 'productos' || tab === 'insumos') ? (
                itemsFiltrados.length === 0 ? (
                    <Card variant="subtle" className="text-center py-32 border-dashed">
                        <Package size={64} className="mx-auto mb-6 text-gray-200" />
                        <h3 className="text-xl font-black text-gray-400">Sin resultados encontrados</h3>
                        <p className="text-gray-300 text-sm mt-2">Intenta con otros términos o agrega un nuevo registro.</p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {itemsFiltrados.map(item => (
                            <Card key={item.id} className="group hover:-translate-y-1 overflow-hidden" noPadding>
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-2xl ${tab === 'productos' ? 'bg-turquesa/10 text-turquesa' : 'bg-acero/10 text-acero'}`}>
                                            {tab === 'productos' ? <ShoppingBag size={24} /> : <Package size={24} />}
                                        </div>
                                        <StockBadge stock={item.stock} minimo={item.stockMinimo} />
                                    </div>

                                    <div className="space-y-1">
                                        <h4 className="text-lg font-black text-gray-900 leading-tight group-hover:text-turquesa transition-colors">{item.nombre}</h4>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{item.categoria || 'Sin categoría'}</p>
                                    </div>

                                    {item.descripcion && (
                                        <p className="text-sm text-gray-500 mt-3 line-clamp-2 min-h-[40px] leading-relaxed">
                                            {item.descripcion}
                                        </p>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-50">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Disponible</p>
                                            <p className="text-2xl font-black text-gray-900 leading-none">
                                                {item.stock ?? 0} <span className="text-xs font-bold text-gray-300 tracking-tight">{item.unidad}</span>
                                            </p>
                                        </div>
                                        {tab === 'productos' && (
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Precio</p>
                                                <p className="text-2xl font-black text-turquesa leading-none">{formatCurr(item.precio)}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-gray-50/50 p-3 flex justify-between items-center px-6">
                                    <div className="flex gap-1">
                                        {canEdit && (
                                            <button onClick={() => abrirModalItem(item)} className="p-2 text-gray-400 hover:text-turquesa transition-colors">
                                                <Edit3 size={18} />
                                            </button>
                                        )}
                                        {isAdmin && (
                                            <button onClick={() => handleEliminar(item.id, item.nombre)} className="p-2 text-gray-400 hover:text-rose-500 transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                    {tab === 'insumos' && canRequest && (
                                        <button
                                            onClick={() => abrirSolicitud(item)}
                                            className="px-4 py-2 bg-turquesa text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-turquesa/20 hover:scale-105 transition-all flex items-center gap-2"
                                        >
                                            <Send size={12} /> Solicitar
                                        </button>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )
            ) : (tab === 'solicitudes' && isAdmin) && (
                <div className="space-y-6">
                    {solicitudes.length === 0 ? (
                        <Card variant="subtle" className="text-center py-32 border-dashed">
                            <Clock size={64} className="mx-auto mb-6 text-gray-200" />
                            <h3 className="text-xl font-black text-gray-400">Sin solicitudes pendientes</h3>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {solicitudes.map(sol => (
                                <Card key={sol.id} className="relative overflow-hidden group border-l-4 border-l-turquesa">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex gap-6 items-center">
                                            <div className="w-14 h-14 bg-turquesa/10 flex items-center justify-center rounded-2xl text-turquesa shrink-0 group-hover:scale-110 transition-transform">
                                                <Package size={28} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h4 className="font-black text-gray-900 text-lg leading-none">{sol.insumoNombre}</h4>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${sol.status === 'Pendiente' ? 'bg-amber-100 text-amber-600' : sol.status === 'Aprobada' ? 'bg-turquesa/10 text-turquesa' : 'bg-rose-50 text-rose-500'}`}>
                                                        {sol.status}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-gray-400 italic">
                                                    Solicitado por <span className="text-gray-900 font-bold">{sol.solicitanteNombre}</span> — {formatFecha(sol.createdAt)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-row items-center gap-8">
                                            <div className="text-center border-x border-gray-100 px-8 hidden md:block">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cantidad</p>
                                                <p className="text-2xl font-black text-gray-900 leading-none">{sol.cantidad}</p>
                                            </div>

                                            {sol.status === 'Pendiente' && (
                                                <div className="flex gap-3">
                                                    <button onClick={() => handleResponder(sol, 'Rechazada')} className="p-3 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-2xl transition-all"><XCircle size={22} /></button>
                                                    <button onClick={() => handleResponder(sol, 'Aprobada')} className="p-3 text-turquesa bg-turquesa/10 hover:bg-turquesa/20 rounded-2xl transition-all"><CheckCircle size={22} /></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {sol.motivo && (
                                        <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 relative">
                                            <div className="absolute top-0 left-6 -translate-y-1/2 w-3 h-3 bg-gray-50 border-l border-t border-gray-100 rotate-45" />
                                            <p className="text-xs font-bold text-gray-600 leading-relaxed italic">
                                                <Info size={12} className="inline mr-1 text-gray-400" /> "{sol.motivo}"
                                            </p>
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modals remain structurally the same but with premium style classes used in Card/Button */}
            {/* ══ MODAL: AGREGAR / EDITAR ITEM ═══════════════════════════════ */}
            <Modal isOpen={modalItem} onClose={() => setModalItem(false)} title={editingItem ? `Editar Producto` : `Registrar Nuevo Item`}>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 gap-4">
                        <Input label="Nombre del Producto/Insumo" required placeholder="Ej. Ácido Hialurónico 1ml" value={formItem.nombre} onChange={e => setF('nombre', e.target.value)} />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Categoría</label>
                                <select value={formItem.categoria} onChange={e => setF('categoria', e.target.value)} className={inputCls}>
                                    <option value="">Seleccionar...</option>
                                    {categorias.map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Unidad de Medida</label>
                                <select value={formItem.unidad} onChange={e => setF('unidad', e.target.value)} className={inputCls}>
                                    {UNIDADES.map(u => <option key={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Stock Actual" type="number" value={formItem.stock} onChange={e => setF('stock', e.target.value)} />
                            <Input label="Stock Mínimo (Alerta)" type="number" value={formItem.stockMinimo} onChange={e => setF('stockMinimo', e.target.value)} />
                        </div>

                        {formItem.tipo === 'producto' && (
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Precio Venta" icon={DollarSign} type="number" value={formItem.precio} onChange={e => setF('precio', e.target.value)} />
                                <Input label="Costo Adqu." icon={DollarSign} type="number" value={formItem.costo} onChange={e => setF('costo', e.target.value)} />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Fecha Adquisición" type="date" value={formItem.fechaAdquisicion} onChange={e => setF('fechaAdquisicion', e.target.value)} />
                            <Input label="Proveedor" placeholder="Ej. MedEstetic S.A." value={formItem.proveedor} onChange={e => setF('proveedor', e.target.value)} />
                        </div>

                        <div>
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Descripción Detallada</label>
                            <textarea rows={3} placeholder="Notas sobre el producto..." value={formItem.descripcion} onChange={e => setF('descripcion', e.target.value)} className={`${inputCls} resize-none`} />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Button variant="outline" fullWidth onClick={() => setModalItem(false)}>Cancelar</Button>
                        <Button variant="primary" fullWidth icon={savingItem ? Loader : CheckCircle} disabled={savingItem} onClick={handleGuardarItem}>
                            {savingItem ? 'Guardando...' : editingItem ? 'Actualizar' : 'Registrar'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ══ MODAL: SOLICITAR INSUMO ═══════════════════════════════════ */}
            <Modal isOpen={modalSolicitud} onClose={() => setModalSolicitud(false)} title={`Solicitud de Suministros`}>
                {exitoSolic ? (
                    <div className="text-center py-12">
                        <div className="w-20 h-20 bg-turquesa/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle size={40} className="text-turquesa" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900">¡Solicitud Enviada!</h3>
                        <p className="text-gray-500 font-medium mt-2">Se ha notificado al administrador correctamente.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <Card variant="premium" className="bg-gray-50 border-none">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white rounded-2xl shadow-sm text-turquesa"><Package size={24} /></div>
                                <div>
                                    <p className="text-lg font-black text-gray-900 leading-tight">{insumoSolicitud?.nombre}</p>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Existencia: {insumoSolicitud?.stock} {insumoSolicitud?.unidad}</p>
                                </div>
                            </div>
                        </Card>

                        <Input label="Cantidad Requerida" type="number" value={formSolic.cantidad} onChange={e => setFormSolic(p => ({ ...p, cantidad: e.target.value }))} />

                        <div>
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Motivo / Justificación</label>
                            <textarea rows={4} placeholder="Ej. Reposición para tratamiento de mañana..." value={formSolic.motivo} onChange={e => setFormSolic(p => ({ ...p, motivo: e.target.value }))} className={`${inputCls} resize-none`} />
                        </div>

                        <div className="flex gap-4 pt-2">
                            <Button variant="outline" fullWidth onClick={() => setModalSolicitud(false)}>Cancelar</Button>
                            <Button variant="primary" fullWidth icon={savingSolic ? Loader : Send} disabled={savingSolic} onClick={handleCrearSolicitud}>
                                {savingSolic ? 'Enviando...' : 'Enviar Solicitud'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
