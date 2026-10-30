import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { 
    TrendingUp, 
    Calendar, 
    DollarSign, 
    Plus, 
    Trash2, 
    Zap, 
    Clock, 
    CheckCircle2, 
    AlertCircle,
    Search,
    ChevronRight,
    ArrowUpRight
} from 'lucide-react';
import { onServiciosChange } from '../../services/comercialService';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

export default function LaboratorioProyecciones() {
    const [servicios, setServicios] = useState([]);
    const [proyecciones, setProyecciones] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Form State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedService, setSelectedService] = useState(null);
    const [montoManual, setMontoManual] = useState('');
    const [diasProyeccion, setDiasProyeccion] = useState(0);
    const [isPagado, setIsPagado] = useState(false);

    useEffect(() => {
        const unsub = onServiciosChange((data) => {
            setServicios(data);
            setLoading(false);
        });
        
        // Load local projections
        const saved = localStorage.getItem('alfra_proyecciones_lab');
        if (saved) setProyecciones(JSON.parse(saved));

        return () => unsub();
    }, []);

    useEffect(() => {
        localStorage.setItem('alfra_proyecciones_lab', JSON.stringify(proyecciones));
    }, [proyecciones]);

    const serviciosFiltrados = useMemo(() => {
        if (!searchQuery) return [];
        return servicios.filter(s => 
            s.nombre.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 5);
    }, [searchQuery, servicios]);

    const handleSelectService = (s) => {
        setSelectedService(s);
        setMontoManual(s.precio || '');
        setSearchQuery(s.nombre);
    };

    const handleAddProyeccion = () => {
        const nueva = {
            id: Date.now(),
            servicioNombre: selectedService ? selectedService.nombre : searchQuery || 'Servicio Personalizado',
            monto: Number(montoManual) || 0,
            fecha: addDays(startOfDay(new Date()), diasProyeccion).toISOString(),
            pagado: isPagado,
            createdAt: new Date().toISOString()
        };

        setProyecciones([nueva, ...proyecciones]);
        // Reset form
        setSearchQuery('');
        setSelectedService(null);
        setMontoManual('');
        setDiasProyeccion(0);
        setIsPagado(false);
    };

    const deleteProyeccion = (id) => {
        setProyecciones(proyecciones.filter(p => p.id !== id));
    };

    // Cálculos
    const totals = useMemo(() => {
        const total = proyecciones.reduce((acc, p) => acc + p.monto, 0);
        const pagado = proyecciones.filter(p => p.pagado).reduce((acc, p) => acc + p.monto, 0);
        const pendiente = total - pagado;
        return { total, pagado, pendiente };
    }, [proyecciones]);

    const formatCurrency = (val) => `$${Number(val).toLocaleString('es-MX')}`;

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-24 px-4">
            
            {/* ENCABEZADO LABORAL */}
            <header className="bg-acero p-10 rounded-[3rem] text-white overflow-hidden relative shadow-2xl">
                <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
                    <TrendingUp size={200} />
                </div>
                <div className="relative z-10 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-turquesa p-2 rounded-xl text-acero">
                            <Zap size={20} className="fill-current" />
                        </div>
                        <Badge className="bg-white/10 text-white border-none text-[10px] font-black tracking-widest uppercase">Laboratory v3.0</Badge>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight">Proyecciones de Ingreso</h1>
                    <p className="text-white/60 font-medium max-w-xl">
                        Simula cobros de citas agendadas y visualiza el flujo de caja proyectado sin alterar datos reales de producción.
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                
                {/* 1. CONFIGURADOR DE PROYECCIÓN (4/12) */}
                <aside className="lg:col-span-4 space-y-8">
                    <Card className="rounded-[2.5rem] p-8 border-none shadow-xl bg-white space-y-6">
                        <h3 className="text-sm font-black text-acero uppercase tracking-widest flex items-center gap-2">
                            <Plus size={18} className="text-turquesa" /> Nueva Simulación
                        </h3>

                        <div className="space-y-6">
                            {/* Búsqueda de Servicio */}
                            <div className="space-y-2 relative">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2 text-balance">Servicio a Proyectar</label>
                                <div className="relative">
                                    <Input 
                                        placeholder="Busca un servicio..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            if (selectedService) setSelectedService(null);
                                        }}
                                        className="rounded-2xl pl-10 h-14 bg-gray-50 border-none font-bold text-acero"
                                    />
                                    <Search className="absolute left-4 top-4 text-gray-300" size={20} />
                                </div>
                                
                                {serviciosFiltrados.length > 0 && (
                                    <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden p-2 space-y-1">
                                        {serviciosFiltrados.map(s => (
                                            <div 
                                                key={s.id}
                                                onClick={() => handleSelectService(s)}
                                                className="p-3 hover:bg-turquesa/5 rounded-xl cursor-context-menu flex items-center justify-between group transition-colors"
                                            >
                                                <span className="text-xs font-bold text-acero group-hover:text-turquesa">{s.nombre}</span>
                                                <span className="text-[10px] font-black text-gray-400">{formatCurrency(s.precio)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Monto Proyectado */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Monto a Cobrar ($)</label>
                                <div className="relative">
                                    <Input 
                                        type="number"
                                        placeholder="0.00"
                                        value={montoManual}
                                        onChange={(e) => setMontoManual(e.target.value)}
                                        className="rounded-2xl pl-10 h-14 bg-gray-50 border-none font-black text-xl text-acero"
                                    />
                                    <DollarSign className="absolute left-4 top-4 text-turquesa" size={20} />
                                </div>
                            </div>

                            {/* Fecha Proyectada */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Cuándo se cobrará</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[0, 1, 7].map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setDiasProyeccion(d)}
                                            className={`py-3 rounded-2xl text-[9px] font-black uppercase tracking-tighter transition-all ${diasProyeccion === d ? 'bg-acero text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                        >
                                            {d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : '7 Días'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Estado de Pago */}
                            <div 
                                onClick={() => setIsPagado(!isPagado)}
                                className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${isPagado ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 bg-gray-50 opacity-60'}`}
                            >
                                <div className="flex items-center gap-3">
                                    {isPagado ? <CheckCircle2 className="text-emerald-500" size={20} /> : <Clock className="text-gray-400" size={20} />}
                                    <span className={`text-[10px] font-black uppercase ${isPagado ? 'text-emerald-600' : 'text-gray-400'}`}>
                                        {isPagado ? 'Ya está pagado' : 'Pendiente de cobro'}
                                    </span>
                                </div>
                                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isPagado ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isPagado ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </div>

                            <Button 
                                onClick={handleAddProyeccion}
                                disabled={!searchQuery || !montoManual}
                                className="w-full h-16 rounded-[1.5rem] bg-turquesa text-acero font-black uppercase tracking-widest text-xs hover:scale-[1.02] transition-transform shadow-xl shadow-turquesa/20"
                            >
                                AGREGAR PROYECCIÓN
                            </Button>
                        </div>
                    </Card>

                    {/* RESUMEN DE FLUJO */}
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl space-y-6">
                        <h3 className="text-sm font-black text-acero uppercase tracking-widest">Resumen del Experimento</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <p className="text-[10px] font-black text-gray-400 uppercase">Ingreso Total</p>
                                <p className="text-2xl font-black text-acero tracking-tighter">{formatCurrency(totals.total)}</p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[11px] font-bold">
                                    <span className="text-emerald-500 flex items-center gap-1"><ArrowUpRight size={14}/> Pagado</span>
                                    <span>{formatCurrency(totals.pagado)}</span>
                                </div>
                                <div className="flex justify-between text-[11px] font-bold">
                                    <span className="text-amber-500 flex items-center gap-1"><AlertCircle size={14}/> Por Cobrar</span>
                                    <span>{formatCurrency(totals.pendiente)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* 2. LISTADO DE PROYECCIONES (8/12) */}
                <main className="lg:col-span-8 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-sm font-black text-acero uppercase tracking-[0.2em]">Timeline de Proyección</h3>
                        <Badge className="bg-gray-100 text-gray-500 border-none text-[10px] font-black">{proyecciones.length} ITEMS</Badge>
                    </div>

                    {proyecciones.length === 0 ? (
                        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-[3rem] p-20 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="p-5 bg-white rounded-full shadow-sm text-gray-300">
                                <Calendar size={40} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-black text-acero uppercase">Nada proyectado aún</p>
                                <p className="text-[10px] font-medium text-gray-400">Comienza agregando un servicio para ver cómo afecta el flujo de caja.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {proyecciones.map(p => (
                                <Card key={p.id} className="rounded-3xl p-6 bg-white border-none shadow-sm hover:shadow-md transition-all group overflow-hidden">
                                     <div className="flex items-center gap-6 justify-between relative z-10">
                                        <div className="flex items-center gap-6">
                                            <div className={`p-4 rounded-2xl ${p.pagado ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                                                {p.pagado ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-acero tracking-tight">{p.servicioNombre}</h4>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                                    {isSameDay(new Date(p.fecha), new Date()) ? 'HOY' : format(new Date(p.fecha), "eeee dd 'de' MMMM", { locale: es })}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-8">
                                            <div className="text-right">
                                                <p className="text-xl font-black text-acero tracking-tighter">{formatCurrency(p.monto)}</p>
                                                <Badge variant="outline" className={`text-[8px] font-black uppercase mt-1 ${p.pagado ? 'border-emerald-100 text-emerald-500' : 'border-amber-100 text-amber-500'}`}>
                                                    {p.pagado ? 'SALDO LIQUIDADO' : 'COBRO PENDIENTE'}
                                                </Badge>
                                            </div>
                                            <button 
                                                onClick={() => deleteProyeccion(p.id)}
                                                className="p-3 bg-red-50 text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                     </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </main>

            </div>
        </div>
    );
}
