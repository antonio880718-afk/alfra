import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
    PlusCircle, Edit, Trash2, Tag, DollarSign, Package, Percent, Upload, X,
    Search, Clock, Target, Sparkles, CheckCircle2
} from 'lucide-react';
import { getFlyers, uploadFlyer, deleteFlyer } from '../../services/flyersService';
import {
    onServiciosChange, createServicio, updateServicio, deleteServicio,
    onCuponesChange, createCupon, updateCupon, deleteCupon
} from '../../services/comercialService';

export const CATEGORIAS_SERVICIO = [
    'Facial',
    'Corporal',
    'Depilación Láser',
    'Masajes y Spa',
    'Capilar',
    'Post-Operatorio',
    'Médico / Especializado',
    'Otro',
];

export const PRIORIDADES_PLAN = [
    { id: 'alta', label: 'Alta (Servicio Estrella — Mayor volumen diario)', peso: 3 },
    { id: 'media', label: 'Media (Demanda Regular)', peso: 2 },
    { id: 'baja', label: 'Baja (Complementario / Ocasional)', peso: 1 },
];

/** Determina si un item del catálogo es un paquete/plan o no debe tratarse como sesión suelta */
export const detectEsPaquete = (item) => {
    if (!item) return false;
    if (typeof item.esPaquete === 'boolean') return item.esPaquete;
    if (item.tipo === 'Paquete / Plan Tratamiento') return true;
    const n = String(item.nombre || '').toLowerCase();
    return /\(\s*paq|\bpaquete\b|efecto lipo sin bisturi/i.test(n);
};

export const detectIncluirEnPlan = (item) => {
    if (!item) return false;
    if (typeof item.incluirEnPlanDiario === 'boolean') return item.incluirEnPlanDiario;
    if (detectEsPaquete(item)) return false;
    if (item.tipo === 'Producto Físico (Venta)') return false;
    const precio = Number(item.precioVenta) || 0;
    // Excluir por defecto valoraciones de $0-$10 o cirugías mayores (> $15,000) salvo que se marquen
    return precio >= 50 && precio <= 15000;
};

const inferCategoria = (nombre = '') => {
    const n = String(nombre).toLowerCase();
    if (/l[aá]ser|depilaci/i.test(n)) return 'Depilación Láser';
    if (/facial|dermapen|acn[eé]|melasma|peel|glow|microdermo/i.test(n)) return 'Facial';
    if (/post\s*operatorio|pre\s*operatorio|lipoescultura/i.test(n)) return 'Post-Operatorio';
    if (/masaje|relajante|piedras|spa|chakras/i.test(n)) return 'Masajes y Spa';
    if (/capilar|cabello/i.test(n)) return 'Capilar';
    if (/reductivo|anticelulitis|papada|lipoenzimas|gl[uú]teo|abdomen|brazos|body/i.test(n)) return 'Corporal';
    if (/cx|rinoplastia|escleroterapia|botox|valoraci/i.test(n)) return 'Médico / Especializado';
    return 'Facial';
};

const emptyForm = {
    nombre: '',
    categoria: 'Facial',
    tipo: 'Servicio Individual',
    esPaquete: false,
    duracionMin: 60,
    numeroSesiones: 1,
    costoInsumos: '',
    comisionPct: 15,
    precioVenta: '',
    incluirEnPlanDiario: true,
    prioridadPlan: 'media',
    metaDiariaManual: '',
    itemsIncluidos: [],
    cuponId: '',
};

export default function GestionComercial() {
    const [activeView, setActiveView] = useState('catalogo'); // 'catalogo' o 'flyers'
    const [filtroCatalogo, setFiltroCatalogo] = useState('todos'); // 'todos' | 'sueltos' | 'paquetes' | 'plan'
    const [servicios, setServicios] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [cupones, setCupones] = useState([]);

    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);

    // Coupon form refs
    const couponCodeRef = useRef(null);
    const couponValueRef = useRef(null);
    const couponTypeRef = useRef(null);

    useEffect(() => {
        const unsubServicios = onServiciosChange(setServicios);
        const unsubCupones = onCuponesChange(setCupones);
        return () => { unsubServicios(); unsubCupones(); };
    }, []);

    // Flyers state
    const [flyers, setFlyers] = useState([]);
    const [isFlyerModalOpen, setIsFlyerModalOpen] = useState(false);
    const [newFlyer, setNewFlyer] = useState({ title: '', file: null, preview: null });
    const [loadingFlyers, setLoadingFlyers] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadStep, setUploadStep] = useState('');

    const loadFlyers = async () => {
        setLoadingFlyers(true);
        try {
            const data = await getFlyers();
            setFlyers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingFlyers(false);
        }
    };

    useEffect(() => {
        if (activeView === 'flyers') {
            loadFlyers();
        }
    }, [activeView]);

    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState(emptyForm);

    const formatCurrency = (amount) => `$${Number(amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleOpenItemModal = (item = null) => {
        if (item) {
            const esPaq = detectEsPaquete(item);
            setEditingItem(item.id);
            setFormData({
                nombre: item.nombre || '',
                categoria: item.categoria || inferCategoria(item.nombre),
                tipo: item.tipo || (esPaq ? 'Paquete / Plan Tratamiento' : 'Servicio Individual'),
                esPaquete: esPaq,
                duracionMin: Number(item.duracionMin) || 60,
                numeroSesiones: Number(item.numeroSesiones) || (esPaq ? 10 : 1),
                costoInsumos: item.costoInsumos ?? 0,
                comisionPct: item.comisionPct ?? 15,
                precioVenta: item.precioVenta ?? 0,
                incluirEnPlanDiario: detectIncluirEnPlan(item),
                prioridadPlan: item.prioridadPlan || 'media',
                metaDiariaManual: item.metaDiariaManual ?? '',
                itemsIncluidos: item.itemsIncluidos || [],
                cuponId: item.cuponId || '',
            });
        } else {
            setEditingItem(null);
            setFormData(emptyForm);
        }
        setIsItemModalOpen(true);
    };

    const handleSaveItem = async () => {
        if (!formData.nombre.trim() || formData.precioVenta === '') {
            alert('Ingresa el nombre y el precio de venta del servicio.');
            return;
        }

        const esPaq = formData.tipo === 'Paquete / Plan Tratamiento' || Boolean(formData.esPaquete);
        const payload = {
            nombre: formData.nombre.trim(),
            categoria: formData.categoria || 'Facial',
            tipo: formData.tipo,
            esPaquete: esPaq,
            duracionMin: Math.max(5, Number(formData.duracionMin) || 60),
            numeroSesiones: esPaq ? Math.max(1, Number(formData.numeroSesiones) || 1) : 1,
            costoInsumos: Number(formData.costoInsumos) || 0,
            comisionPct: Math.max(0, Math.min(100, Number(formData.comisionPct) || 0)),
            precioVenta: Number(formData.precioVenta) || 0,
            incluirEnPlanDiario: esPaq ? false : Boolean(formData.incluirEnPlanDiario),
            prioridadPlan: formData.prioridadPlan || 'media',
            metaDiariaManual: formData.metaDiariaManual !== '' ? Number(formData.metaDiariaManual) : null,
            itemsIncluidos: formData.itemsIncluidos || [],
            cuponId: formData.cuponId || '',
        };

        try {
            if (editingItem) {
                await updateServicio(editingItem, payload);
            } else {
                await createServicio(payload);
            }
            setIsItemModalOpen(false);
        } catch (err) {
            console.error(err);
            alert('Error al guardar servicio.');
        }
    };

    const handleQuickTogglePlan = async (item) => {
        const actual = detectIncluirEnPlan(item);
        try {
            await updateServicio(item.id, {
                incluirEnPlanDiario: !actual,
                esPaquete: detectEsPaquete(item),
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteItem = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este item del catálogo?')) {
            try {
                await deleteServicio(id);
            } catch (err) {
                console.error(err);
                alert('Error al eliminar servicio.');
            }
        }
    };

    const handleCrearCupon = async () => {
        const codigo = couponCodeRef.current?.value?.trim().toUpperCase();
        const descuento = Number(couponValueRef.current?.value);
        const tipo = couponTypeRef.current?.value === '%' ? 'Porcentaje' : 'Monto Fijo';

        if (!codigo || !descuento) { alert('Ingresa el código y el valor del cupón.'); return; }

        try {
            await createCupon({ codigo, descuento, tipo });
            couponCodeRef.current.value = '';
            couponValueRef.current.value = '';
        } catch (err) {
            console.error(err);
            alert('Error al crear cupón.');
        }
    };

    const handleToggleCupon = async (cupon) => {
        try {
            await updateCupon(cupon.id, { activo: !cupon.activo });
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteCupon = async (id) => {
        if (!window.confirm('¿Eliminar este cupón?')) return;
        try {
            await deleteCupon(id);
        } catch (err) {
            console.error(err);
            alert('Error al eliminar cupón.');
        }
    };

    const stats = useMemo(() => {
        const sueltos = servicios.filter((s) => !detectEsPaquete(s));
        const paquetes = servicios.filter((s) => detectEsPaquete(s));
        const enPlan = servicios.filter((s) => !detectEsPaquete(s) && detectIncluirEnPlan(s));
        const conPrecio = sueltos.filter((s) => Number(s.precioVenta) > 0);
        const precioPromSuelto = conPrecio.length
            ? conPrecio.reduce((a, b) => a + Number(b.precioVenta || 0), 0) / conPrecio.length
            : 0;
        const avgMargin = conPrecio.length
            ? (conPrecio.reduce((acc, curr) => {
                const p = Number(curr.precioVenta) || 0;
                const c = Number(curr.costoInsumos) || 0;
                const com = p * ((Number(curr.comisionPct ?? 15)) / 100);
                return acc + ((p - c - com) / p);
            }, 0) / conPrecio.length * 100).toFixed(1)
            : 0;
        return { sueltos: sueltos.length, paquetes: paquetes.length, enPlan: enPlan.length, precioPromSuelto, avgMargin };
    }, [servicios]);

    const serviciosFiltrados = useMemo(() => {
        return servicios.filter((item) => {
            const matchTxt = (item.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.tipo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.categoria || inferCategoria(item.nombre)).toLowerCase().includes(searchTerm.toLowerCase());
            if (!matchTxt) return false;
            const esPaq = detectEsPaquete(item);
            if (filtroCatalogo === 'sueltos') return !esPaq;
            if (filtroCatalogo === 'paquetes') return esPaq;
            if (filtroCatalogo === 'plan') return !esPaq && detectIncluirEnPlan(item);
            return true;
        });
    }, [servicios, searchTerm, filtroCatalogo]);

    // Cálculos en vivo dentro del modal de servicio
    const modalCalc = useMemo(() => {
        const precio = Number(formData.precioVenta) || 0;
        const insumo = Number(formData.costoInsumos) || 0;
        const comPct = Number(formData.comisionPct) || 0;
        const comMonto = precio * (comPct / 100);
        const utilidadNeta = precio - insumo - comMonto;
        const margenPct = precio > 0 ? (utilidadNeta / precio) * 100 : 0;
        return { precio, insumo, comPct, comMonto, utilidadNeta, margenPct };
    }, [formData.precioVenta, formData.costoInsumos, formData.comisionPct]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-acero">Catálogo de Servicios, Costos y Promociones</h2>
                    <p className="text-gray-500 text-sm">
                        Configura precios, costos de insumo, duración, comisiones y qué servicios sueltos entran al Plan de Ventas Diarias
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="bg-gray-100 p-1 rounded-xl flex gap-1 mr-2">
                        <button
                            onClick={() => setActiveView('catalogo')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === 'catalogo' ? 'bg-white text-acero shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Catálogo ({servicios.length})
                        </button>
                        <button
                            onClick={() => setActiveView('flyers')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeView === 'flyers' ? 'bg-white text-acero shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Flyers App ({flyers.length})
                        </button>
                    </div>
                    {activeView === 'catalogo' && (
                        <>
                            <div className="relative flex-1 sm:w-60">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar servicio o categoría..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-turquesa outline-none"
                                />
                            </div>
                            <Button variant="outline" icon={Tag} onClick={() => setIsCouponModalOpen(true)}>Cupones</Button>
                            <Button variant="primary" icon={PlusCircle} onClick={() => handleOpenItemModal()}>Nuevo Servicio</Button>
                        </>
                    )}
                </div>
            </div>

            {activeView === 'catalogo' ? (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-turquesa/5 border-turquesa/20">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-turquesa/10 rounded-xl text-turquesa"><Package size={22} /></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase">Servicios Sueltos vs Paquetes</p>
                                    <h3 className="text-xl font-black text-gray-900">{stats.sueltos} Sueltos • {stats.paquetes} Paq.</h3>
                                </div>
                            </div>
                        </Card>
                        <Card className="bg-emerald-500/5 border-emerald-500/20">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600"><Target size={22} /></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase">Activos en Plan Diario</p>
                                    <h3 className="text-xl font-black text-emerald-700">{stats.enPlan} servicios sueltos</h3>
                                </div>
                            </div>
                        </Card>
                        <Card className="bg-acero/5 border-acero/20">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-acero/10 rounded-xl text-acero"><DollarSign size={22} /></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase">Margen Libre Promedio</p>
                                    <h3 className="text-xl font-black text-gray-900">{stats.avgMargin}% libre</h3>
                                </div>
                            </div>
                        </Card>
                        <Card className="bg-orange-500/5 border-orange-500/20">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500"><Percent size={22} /></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase">Cupones Activos</p>
                                    <h3 className="text-xl font-black text-gray-900">{cupones.filter((c) => c.activo).length} Promociones</h3>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Filtros rápidos de catálogo */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'todos', label: `Todos (${servicios.length})` },
                            { id: 'sueltos', label: `Servicios Sueltos — No Paquete (${stats.sueltos})` },
                            { id: 'plan', label: `Incluidos en Plan de Meta Diaria (${stats.enPlan})` },
                            { id: 'paquetes', label: `Paquetes / Planes (${stats.paquetes})` },
                        ].map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setFiltroCatalogo(f.id)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                    filtroCatalogo === f.id
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <Card>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-gray-100 text-[11px] uppercase text-gray-500 bg-gray-50/70">
                                        <th className="py-3 px-4 font-bold">Servicio / Categoría</th>
                                        <th className="py-3 px-3 font-bold text-center">Modalidad</th>
                                        <th className="py-3 px-3 font-bold text-center">Duración</th>
                                        <th className="py-3 px-3 font-bold text-right">Costo Insumo</th>
                                        <th className="py-3 px-3 font-bold text-right">Comisión Esp.</th>
                                        <th className="py-3 px-3 font-bold text-right">Precio Venta</th>
                                        <th className="py-3 px-3 font-bold text-right">Utilidad Libre</th>
                                        <th className="py-3 px-3 font-bold text-center">Plan Diario</th>
                                        <th className="py-3 px-4 font-bold text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {serviciosFiltrados.map((item) => {
                                        const esPaq = detectEsPaquete(item);
                                        const enPlan = !esPaq && detectIncluirEnPlan(item);
                                        const precio = Number(item.precioVenta) || 0;
                                        const insumo = Number(item.costoInsumos) || 0;
                                        const comPct = Number(item.comisionPct ?? 15);
                                        const comMonto = precio * (comPct / 100);
                                        const utilidadLibre = precio - insumo - comMonto;
                                        const margenPct = precio > 0 ? Math.round((utilidadLibre / precio) * 100) : 0;
                                        const cat = item.categoria || inferCategoria(item.nombre);
                                        const dur = Number(item.duracionMin) || 60;
                                        const prio = item.prioridadPlan || 'media';

                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="py-3 px-4 font-medium text-gray-900">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-800 text-sm">{item.nombre}</span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                                                                {cat}
                                                            </span>
                                                            {!esPaq && enPlan && (
                                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                                    prio === 'alta'
                                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                        : prio === 'baja'
                                                                            ? 'bg-slate-50 text-slate-500'
                                                                            : 'bg-teal-50 text-teal-700'
                                                                }`}>
                                                                    Prioridad {prio}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                                        esPaq ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                                                    }`}>
                                                        {esPaq ? 'Paquete / Plan' : 'Sesión Suelta'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-center text-slate-600 font-semibold">
                                                    <span className="inline-flex items-center gap-1"><Clock size={12} /> {dur} min</span>
                                                </td>
                                                <td className="py-3 px-3 text-right text-rose-600 font-semibold">
                                                    {formatCurrency(insumo)}
                                                </td>
                                                <td className="py-3 px-3 text-right text-amber-700 font-semibold">
                                                    {formatCurrency(comMonto)} <span className="text-[10px] text-slate-400">({comPct}%)</span>
                                                </td>
                                                <td className="py-3 px-3 text-right text-slate-900 font-black text-sm">
                                                    {formatCurrency(precio)}
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-emerald-600 font-black">{formatCurrency(utilidadLibre)}</span>
                                                        <span className="text-[10px] text-slate-400">{margenPct}% libre</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-center">
                                                    {esPaq ? (
                                                        <span className="text-[10px] text-slate-400 italic">No aplica (Paq.)</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleQuickTogglePlan(item)}
                                                            title="Haz clic para incluir o excluir este servicio del cálculo de ventas diarias en Reportes"
                                                            className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-all ${
                                                                enPlan
                                                                    ? 'bg-emerald-500 text-white shadow-sm'
                                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                            }`}
                                                        >
                                                            {enPlan ? '✓ En Plan Diario' : 'Excluido'}
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenItemModal(item)} />
                                                        <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 hover:text-red-600" icon={Trash2} onClick={() => handleDeleteItem(item.id)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {serviciosFiltrados.length === 0 && (
                                        <tr>
                                            <td colSpan="9" className="py-8 text-center text-gray-400">
                                                No se encontraron servicios con ese filtro.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            ) : (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-acero">Flyers Publicitarios</h3>
                            <p className="text-sm text-gray-500">Sube imágenes de promociones que verán los pacientes en su App</p>
                        </div>
                        <Button variant="primary" icon={Upload} onClick={() => setIsFlyerModalOpen(true)}>Subir Nuevo Flyer</Button>
                    </div>

                    {loadingFlyers ? (
                        <div className="py-20 text-center text-gray-400">Cargando flyers...</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                            {flyers.map((flyer) => (
                                <div key={flyer.id} className="relative group rounded-2xl overflow-hidden shadow-lg border border-gray-100 bg-white">
                                    <img src={flyer.imageUrl} alt={flyer.title} className="w-full h-64 object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-end p-4">
                                        <p className="text-white font-bold text-sm mb-2">{flyer.title}</p>
                                        <button
                                            onClick={async () => {
                                                if (window.confirm('¿Eliminar este flyer?')) {
                                                    await deleteFlyer(flyer.id, flyer.storagePath);
                                                    loadFlyers();
                                                }
                                            }}
                                            className="bg-red-500 text-white p-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold hover:bg-red-600 transition-colors"
                                        >
                                            <Trash2 size={14} /> Eliminar Flyer
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {flyers.length === 0 && (
                                <div className="col-span-full py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                                    <Upload size={48} className="mx-auto text-gray-300 mb-3" />
                                    <p className="text-gray-500 font-medium">No hay flyers activos</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Editar/Crear Servicio con todos los elementos financieros y operativos */}
            <Modal
                isOpen={isItemModalOpen}
                onClose={() => setIsItemModalOpen(false)}
                title={editingItem ? 'Editar Servicio / Paquete' : 'Nuevo Servicio en Catálogo'}
                maxWidth="max-w-xl"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsItemModalOpen(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleSaveItem}>Guardar en Catálogo</Button>
                    </div>
                }
            >
                <div className="space-y-4 text-xs">
                    <div>
                        <label className="font-bold text-gray-700 block mb-1">Nombre del Servicio o Paquete *</label>
                        <input
                            type="text"
                            className="w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-turquesa outline-none bg-gray-50 font-semibold text-sm"
                            placeholder="Ej. Limpieza Facial Profunda + Dermapen"
                            value={formData.nombre}
                            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="font-bold text-gray-700 block mb-1">Categoría Clínica</label>
                            <select
                                className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-turquesa outline-none bg-gray-50 font-semibold"
                                value={formData.categoria}
                                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                            >
                                {CATEGORIAS_SERVICIO.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="font-bold text-gray-700 block mb-1">Tipo / Modalidad</label>
                            <select
                                className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-turquesa outline-none bg-gray-50 font-semibold"
                                value={formData.tipo}
                                onChange={(e) => {
                                    const nuevoTipo = e.target.value;
                                    const esPaq = nuevoTipo === 'Paquete / Plan Tratamiento';
                                    setFormData({
                                        ...formData,
                                        tipo: nuevoTipo,
                                        esPaquete: esPaq,
                                        incluirEnPlanDiario: esPaq ? false : formData.incluirEnPlanDiario,
                                    });
                                }}
                            >
                                <option value="Servicio Individual">Servicio Individual (Sesión suelta)</option>
                                <option value="Procedimiento">Procedimiento Especializado</option>
                                <option value="Paquete / Plan Tratamiento">Paquete / Plan de Tratamiento (Varias sesiones)</option>
                                <option value="Producto Físico (Venta)">Producto Físico (Venta)</option>
                            </select>
                        </div>
                    </div>

                    {/* Duración, Costo de Insumos, Comisión y Precio de Venta */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                            Estructura de Tiempo, Costos y Precio
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="font-bold text-slate-600 block mb-1">Duración (min)</label>
                                <input
                                    type="number"
                                    min="5"
                                    step="5"
                                    value={formData.duracionMin}
                                    onChange={(e) => setFormData({ ...formData, duracionMin: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-xl bg-white font-bold text-slate-800 outline-none focus:border-turquesa"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-rose-600 block mb-1">Costo Insumo ($)</label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0.00"
                                    value={formData.costoInsumos}
                                    onChange={(e) => setFormData({ ...formData, costoInsumos: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-xl bg-white font-bold text-rose-600 outline-none focus:border-turquesa"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-amber-700 block mb-1">Comisión Esp. (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={formData.comisionPct}
                                    onChange={(e) => setFormData({ ...formData, comisionPct: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-xl bg-white font-bold text-amber-700 outline-none focus:border-turquesa"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-emerald-700 block mb-1">Precio Venta ($) *</label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0.00"
                                    value={formData.precioVenta}
                                    onChange={(e) => setFormData({ ...formData, precioVenta: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-xl bg-white font-black text-emerald-700 outline-none focus:border-turquesa"
                                />
                            </div>
                        </div>

                        {/* Resumen de rentabilidad unitaria en vivo */}
                        {modalCalc.precio > 0 && (
                            <div className="pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 text-center">
                                <div className="bg-white p-2 rounded-xl border border-slate-100">
                                    <span className="text-[10px] text-slate-400 font-bold block">Insumo + Comisión</span>
                                    <span className="font-black text-rose-600">
                                        -{formatCurrency(modalCalc.insumo + modalCalc.comMonto)}
                                    </span>
                                </div>
                                <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                                    <span className="text-[10px] text-emerald-700 font-bold block">Utilidad Libre / Sesión</span>
                                    <span className="font-black text-emerald-700">
                                        {formatCurrency(modalCalc.utilidadNeta)}
                                    </span>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-slate-100">
                                    <span className="text-[10px] text-slate-400 font-bold block">% Margen Libre</span>
                                    <span className="font-black text-slate-800">
                                        {modalCalc.margenPct.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Configuración para el Plan de Ingresos Mensual y Meta Diaria */}
                    <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Target size={16} className="text-turquesa" />
                                <span className="font-black text-slate-800 text-xs">
                                    Configuración en Plan de Ingresos Mensual (Ventas Diarias)
                                </span>
                            </div>
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={Boolean(formData.esPaquete)}
                                    onChange={(e) => {
                                        const esPaq = e.target.checked;
                                        setFormData({
                                            ...formData,
                                            esPaquete: esPaq,
                                            incluirEnPlanDiario: esPaq ? false : true,
                                        });
                                    }}
                                />
                                <span>Es un Paquete</span>
                            </label>
                        </div>

                        {!formData.esPaquete ? (
                            <div className="space-y-3">
                                <label className="flex items-center gap-2.5 bg-white p-3 rounded-xl border border-teal-100 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(formData.incluirEnPlanDiario)}
                                        onChange={(e) => setFormData({ ...formData, incluirEnPlanDiario: e.target.checked })}
                                        className="w-4 h-4 accent-teal-600"
                                    />
                                    <div>
                                        <p className="font-black text-slate-800">Incluir este servicio en la Meta de Ventas Diarias</p>
                                        <p className="text-[11px] text-slate-500">
                                            El módulo de Reportes calculará cuántas sesiones diarias de este servicio debes vender para cubrir gastos fijos, nómina y provisiones.
                                        </p>
                                    </div>
                                </label>

                                {formData.incluirEnPlanDiario && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="font-bold text-slate-700 block mb-1">Prioridad / Demanda en Clínica</label>
                                            <select
                                                value={formData.prioridadPlan}
                                                onChange={(e) => setFormData({ ...formData, prioridadPlan: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-xl bg-white font-semibold"
                                            >
                                                {PRIORIDADES_PLAN.map((p) => (
                                                    <option key={p.id} value={p.id}>{p.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="font-bold text-slate-700 block mb-1">Meta Diaria Fija (Opcional)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                placeholder="Automático según prioridad"
                                                value={formData.metaDiariaManual}
                                                onChange={(e) => setFormData({ ...formData, metaDiariaManual: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-xl bg-white font-bold"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-600 italic">
                                Al estar marcado como <strong>Paquete / Plan de varias sesiones</strong>, se excluye automáticamente del cálculo de servicios sueltos diarios tal como solicitaste.
                            </p>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="font-bold text-gray-700 block">Cupón Aplicable (Opcional)</label>
                        <select
                            className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-turquesa outline-none bg-gray-50"
                            value={formData.cuponId}
                            onChange={(e) => setFormData({ ...formData, cuponId: e.target.value })}
                        >
                            <option value="">Ninguno</option>
                            {cupones.filter((c) => c.activo).map((c) => (
                                <option key={c.id} value={c.id}>{c.codigo} ({c.descuento}%)</option>
                            ))}
                        </select>
                    </div>
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
                        <input ref={couponCodeRef} type="text" placeholder="Código (ej. ALFRAVIP)" className="flex-1 px-3 py-2 border rounded-lg text-sm uppercase" />
                        <input ref={couponValueRef} type="number" placeholder="Valor" className="w-24 px-3 py-2 border rounded-lg text-sm" />
                        <select ref={couponTypeRef} className="px-3 py-2 border rounded-lg text-sm outline-none">
                            <option>%</option>
                            <option>$ Fijo</option>
                        </select>
                        <Button variant="primary" size="sm" icon={PlusCircle} onClick={handleCrearCupon}>Crear</Button>
                    </div>

                    <div className="mt-6 space-y-2">
                        <h4 className="font-bold text-sm text-gray-700 border-b pb-2">Cupones Existentes</h4>
                        {cupones.map((cupon) => (
                            <div key={cupon.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${cupon.activo ? 'bg-green-500' : 'bg-gray-300'}`} />
                                    <div>
                                        <p className="font-bold text-acero">{cupon.codigo}</p>
                                        <p className="text-xs text-gray-500">{cupon.descuento}{cupon.tipo === 'Porcentaje' ? '%' : ' MXN'} de descuento</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleToggleCupon(cupon)} className="text-xs px-2 py-1 bg-white border shadow-sm rounded hover:bg-gray-50">
                                        {cupon.activo ? 'Desactivar' : 'Activar'}
                                    </button>
                                    <button onClick={() => handleDeleteCupon(cupon.id)} className="text-xs text-red-500 px-2 py-1 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* Modal: Subir Flyer */}
            <Modal
                isOpen={isFlyerModalOpen}
                onClose={() => setIsFlyerModalOpen(false)}
                title="Subir Nuevo Flyer Promocional"
                footer={
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsFlyerModalOpen(false)}>Cancelar</Button>
                        <Button
                            variant="primary"
                            disabled={!newFlyer.file || !newFlyer.title || uploading}
                            onClick={async () => {
                                setUploading(true);
                                setUploadStep('Iniciando...');
                                try {
                                    await uploadFlyer(newFlyer.file, newFlyer.title, (step) => {
                                        setUploadStep(step);
                                    });
                                    setIsFlyerModalOpen(false);
                                    setNewFlyer({ title: '', file: null, preview: null });
                                    loadFlyers();
                                } catch (e) {
                                    alert('Error al subir: ' + e.message);
                                } finally {
                                    setUploading(false);
                                    setUploadStep('');
                                }
                            }}
                        >
                            {uploading ? uploadStep : 'Publicar Flyer'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-gray-700">Título de la Promoción</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-turquesa"
                            placeholder="Ej. 20% OFF en Botox este mes"
                            value={newFlyer.title}
                            onChange={(e) => setNewFlyer({ ...newFlyer, title: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-bold text-gray-700">Imagen del Flyer</label>
                        {!newFlyer.preview ? (
                            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-50 transition-colors">
                                <Upload size={32} className="text-gray-300 mb-2" />
                                <span className="text-sm text-gray-400">Haz clic para seleccionar imagen</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                setNewFlyer({ ...newFlyer, file, preview: reader.result });
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                />
                            </label>
                        ) : (
                            <div className="relative rounded-2xl overflow-hidden h-48 group">
                                <img src={newFlyer.preview} alt="Preview" className="w-full h-full object-cover" />
                                <button
                                    onClick={() => setNewFlyer({ ...newFlyer, file: null, preview: null })}
                                    className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
