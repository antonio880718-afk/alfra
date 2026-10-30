import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    Activity, 
    Calendar,
    CheckCircle2,
    XCircle,
    Clock,
    Zap,
    ArrowUpRight,
    ArrowDownRight,
    Target,
    BarChart3,
    Plus
} from 'lucide-react';
import { onCitasChange } from '../../services/citasService';
import { format, isSameDay, startOfWeek, endOfWeek, isWithinInterval, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

export default function LaboratorioDashboardFinanciero() {
    const [citas, setCitas] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onCitasChange((data) => {
            const savedPrices = JSON.parse(localStorage.getItem('alfra_lab_prices') || '{}');
            setCitas(data.map(c => ({
                ...c,
                precioProyectado: savedPrices[c.id]?.precio || 0,
                pagado: savedPrices[c.id]?.pagado || false
            })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const hoy = new Date();
    const inicioSemana = startOfWeek(hoy, { locale: es });
    const finSemana = endOfWeek(hoy, { locale: es });

    const stats = useMemo(() => {
        const citasHoy = citas.filter(c => {
            const d = c.fechaHora ? c.fechaHora.split('T')[0] : c.fecha;
            return isSameDay(new Date(d), hoy);
        });

        const citasSemana = citas.filter(c => {
            const d = c.fechaHora ? c.fechaHora.split('T')[0] : c.fecha;
            return isWithinInterval(new Date(d), { start: inicioSemana, end: finSemana });
        });

        // Hoy
        const proyectadoHoy = citasHoy.reduce((acc, c) => acc + (Number(c.precioProyectado) || 0), 0);
        const completadoHoy = citasHoy.filter(c => c.status === 'Completada').reduce((acc, c) => acc + (Number(c.precioProyectado) || 0), 0);
        const fugaHoy = citasHoy.filter(c => c.status === 'Cancelada' || c.status === 'No Asistió').reduce((acc, c) => acc + (Number(c.precioProyectado) || 0), 0);

        // Semana
        const proyectadoSemana = citasSemana.reduce((acc, c) => acc + (Number(c.precioProyectado) || 0), 0);
        const completadoSemana = citasSemana.filter(c => c.status === 'Completada').reduce((acc, c) => acc + (Number(c.precioProyectado) || 0), 0);

        // Breakdown por día (Semana)
        const days = eachDayOfInterval({ start: inicioSemana, end: finSemana });
        const chartData = days.map(day => {
            const dayCitas = citasSemana.filter(c => {
                 const ds = c.fechaHora ? c.fechaHora.split('T')[0] : c.fecha;
                 return isSameDay(new Date(ds), day);
            });
            return {
                label: format(day, 'EEE', { locale: es }),
                total: dayCitas.reduce((acc, c) => acc + (Number(c.precioProyectado) || 0), 0)
            };
        });

        return { 
            proyectadoHoy, completadoHoy, fugaHoy, 
            proyectadoSemana, completadoSemana,
            chartData
        };
    }, [citas]);

    const formatCurrency = (val) => `$${Number(val).toLocaleString('es-MX')}`;

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <Activity className="text-turquesa animate-spin" size={40} />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Calculando Proyecciones...</p>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-24 px-6 mt-10">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-100 pb-10">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-turquesa/10 p-2 rounded-xl text-turquesa"><Zap size={20} className="fill-current" /></div>
                        <h1 className="text-3xl font-extrabold text-acero tracking-tight uppercase">Laboratorio de Inteligencia</h1>
                    </div>
                    <p className="text-gray-500 font-medium text-sm">Monitoreo de ingresos estimados calculados de la agenda diaria y semanal.</p>
                </div>
                
                <div className="bg-white shadow-sm border border-gray-100 px-6 py-3 rounded-full flex items-center gap-3">
                    <Calendar size={14} className="text-turquesa" />
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                        {format(inicioSemana, 'd MMM')} - {format(finSemana, 'd MMM')}
                    </span>
                </div>
            </div>

            {/* CARDS PRINCIPALES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                
                {/* INGRESO ESTIMADO HOY */}
                <Card className="p-8 rounded-[3rem] bg-white border-none shadow-xl border-b-4 border-turquesa transition-all hover:scale-[1.02]">
                    <div className="space-y-6">
                        <div className="p-3 bg-turquesa/10 text-turquesa w-fit rounded-2xl"><Target size={24} /></div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ingreso Estimado Hoy</p>
                            <h4 className="text-4xl font-black text-acero tracking-tighter">{formatCurrency(stats.proyectadoHoy)}</h4>
                            <div className="mt-3 flex items-center gap-2 text-emerald-500">
                                <ArrowUpRight size={14} />
                                <span className="text-[9px] font-black tracking-widest">POTENCIAL DIARIO</span>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* INGRESO ESTIMADO SEMANAL */}
                <Card className="p-8 rounded-[3rem] bg-acero text-white border-none shadow-2xl transition-all hover:scale-[1.02]">
                    <div className="space-y-6">
                        <div className="p-3 bg-white/10 text-turquesa w-fit rounded-2xl"><BarChart3 size={24} /></div>
                        <div>
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Cálculo Semanal</p>
                            <h4 className="text-4xl font-black text-white tracking-tighter">{formatCurrency(stats.proyectadoSemana)}</h4>
                            <div className="mt-3 flex items-center gap-2 text-turquesa">
                                <Calendar size={14} />
                                <span className="text-[9px] font-black tracking-widest">PROYECCIÓN 7 DÍAS</span>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* EFICIENCIA DE COBRO */}
                <Card className="p-8 rounded-[3rem] bg-white border-none shadow-xl transition-all hover:scale-[1.02]">
                    <div className="space-y-6">
                        <div className="p-3 bg-emerald-50 text-emerald-500 w-fit rounded-2xl"><CheckCircle2 size={24} /></div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Corte Real Hoy</p>
                            <h4 className="text-4xl font-black text-emerald-500 tracking-tighter">{formatCurrency(stats.completadoHoy)}</h4>
                            <p className="text-[10px] text-gray-400 font-medium mt-2">Dinero de citas liquidadas y asistidas.</p>
                        </div>
                    </div>
                </Card>

                {/* FUGA POR CANCELACIÓN */}
                <Card className="p-8 rounded-[3rem] bg-white border-none shadow-xl transition-all hover:scale-[1.02]">
                    <div className="space-y-6">
                        <div className="p-3 bg-red-50 text-red-500 w-fit rounded-2xl"><XCircle size={24} /></div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fuga Detectada</p>
                            <h4 className="text-4xl font-black text-red-500 tracking-tighter">{formatCurrency(stats.fugaHoy)}</h4>
                            <p className="text-[10px] text-gray-400 font-medium mt-2">Impacto de faltas y cancelaciones.</p>
                        </div>
                    </div>
                </Card>

            </div>

            {/* SECCIÓN DETALLE SEMANAL */}
            <Card className="rounded-[4rem] p-12 bg-white border-none shadow-2xl space-y-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-acero uppercase tracking-tight">Distribución Semanal de Ingresos</h3>
                        <p className="text-sm text-gray-400 font-medium">Histórico proyectado de lunes a domingo.</p>
                    </div>
                    <Badge className="bg-gray-50 text-gray-400 border-none font-black text-[9px] px-4 py-2 uppercase">Análisis Dinámico</Badge>
                </div>

                <div className="flex items-end justify-between h-48 gap-4 px-4">
                    {stats.chartData.map((d, idx) => {
                        const maxVal = Math.max(...stats.chartData.map(cd => cd.total), 1);
                        const height = (d.total / maxVal) * 100;
                        return (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-4 group">
                                <div className="hidden group-hover:block absolute -top-10 bg-acero text-white text-[10px] px-2 py-1 rounded-lg font-black shadow-xl animate-in slide-in-from-bottom-2">
                                    {formatCurrency(d.total)}
                                </div>
                                <div 
                                    className="w-full rounded-2xl bg-gray-100 group-hover:bg-turquesa transition-all duration-500 relative"
                                    style={{ height: `${height}%`, minHeight: '8px' }}
                                >
                                    {d.total > 0 && <div className="absolute top-0 inset-0 bg-white/20 rounded-2xl" />}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${d.total > 0 ? 'text-acero' : 'text-gray-300'}`}>
                                    {d.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* ACCESO RÁPIDO A LABORATORIO */}
            <div className="flex justify-center">
                <Button 
                    className="h-16 px-12 rounded-full bg-turquesa text-acero font-black uppercase tracking-[0.2em] shadow-2xl hover:scale-105 transition-all flex items-center gap-4"
                    onClick={() => window.location.href = '/laboratorio-proyeccion-agenda'}
                >
                    <Plus size={20} /> Volver a Agenda Simulator
                </Button>
            </div>

        </div>
    );
}

// Helper para graficación (date-fns eachDayOfInterval)
const eachDayOfInterval = ({ start, end }) => {
    const days = [];
    let current = start;
    while (current <= end) {
        days.push(current);
        current = addDays(current, 1);
    }
    return days;
};
