import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Activity, AlertTriangle, Users, CalendarDays, CalendarCheck, CalendarX, Clock, UserMinus, Gift, Loader } from 'lucide-react';
import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { onCitasChange } from '../../services/citasService';
import { onMovimientosChange } from '../../services/finanzasService';
import { onPacientesChange } from '../../services/pacientesService';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const navigate = useNavigate();

    const [citas, setCitas] = useState([]);
    const [movimientos, setMovimientos] = useState([]);
    const [pacientes, setPacientes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubCitas = onCitasChange((data) => setCitas(data));
        const unsubMovs = onMovimientosChange((data) => { setMovimientos(data); setLoading(false); });
        const unsubPac = onPacientesChange((data) => setPacientes(data));
        return () => { unsubCitas(); unsubMovs(); unsubPac(); };
    }, []);

    const formatValue = (value) => `$${Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;

    // Citas del día seleccionado
    const citasDelDia = citas.filter(c => {
        try { return isSameDay(new Date(c.fechaHora || c.fecha), selectedDate); } catch { return false; }
    });

    const kpisAgenda = {
        agendadas: citasDelDia.length,
        atendidas: citasDelDia.filter(c => c.status === 'Completada').length,
        canceladas: citasDelDia.filter(c => c.status === 'Cancelada').length,
        reagendadas: citasDelDia.filter(c => c.status === 'Reagendada').length,
        noAsistio: citasDelDia.filter(c => c.status === 'No Asistió').length,
    };

    // KPIs financieros (todos los movimientos)
    const totalIngresos = movimientos.filter(m => m.tipo === 'Ingreso').reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const totalEgresos = movimientos.filter(m => m.tipo === 'Egreso').reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const utilidadNeta = totalIngresos - totalEgresos;
    const margen = totalIngresos > 0 ? Math.round((utilidadNeta / totalIngresos) * 100) : 0;

    // Gráfica: evolución por día de los últimos 7 días
    const hoy = new Date();
    const semanaActual = eachDayOfInterval({ start: startOfWeek(hoy, { weekStartsOn: 1 }), end: endOfWeek(hoy, { weekStartsOn: 1 }) });
    const graficaData = semanaActual.map(day => {
        const dayStr = format(day, 'EEE', { locale: es });
        const ingresosDia = movimientos.filter(m => m.tipo === 'Ingreso' && m.createdAt?.startsWith(format(day, 'yyyy-MM-dd'))).reduce((a, m) => a + Number(m.monto || 0), 0);
        const egresosDia = movimientos.filter(m => m.tipo === 'Egreso' && m.createdAt?.startsWith(format(day, 'yyyy-MM-dd'))).reduce((a, m) => a + Number(m.monto || 0), 0);
        return { name: dayStr.toUpperCase(), ingresos: ingresosDia, egresos: egresosDia, utilidad: ingresosDia - egresosDia };
    });

    // Pacientes de cumpleaños esta semana
    const cumpleanosPacientes = pacientes.filter(p => {
        try {
            const cumple = p.fechaNacimiento;
            if (!cumple) return false;
            const fecha = new Date(cumple);
            const hoyDate = new Date();
            return fecha.getMonth() === hoyDate.getMonth() && Math.abs(fecha.getDate() - hoyDate.getDate()) <= 3;
        } catch { return false; }
    });

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                <div>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">Dashboard Ejecutivo</h2>
                    <p className="text-gray-500 font-medium mt-1">Sincronización en tiempo real — <span className="text-turquesa font-bold">ALFRA Cloud</span></p>
                </div>
                <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm p-3 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
                    <CalendarDays className="text-turquesa" size={20} />
                    <input
                        type="date"
                        className="bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-800 cursor-pointer outline-none"
                        value={format(selectedDate, 'yyyy-MM-dd')}
                        onChange={(e) => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
                    />
                </div>
            </div>

            {/* KPI Cards Financieras */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Card variant="premium" className="relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <TrendingUp size={120} />
                    </div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-xs font-black text-turquesa uppercase tracking-widest mb-2">Ingresos Brutos</p>
                            <h3 className="text-4xl font-black text-gray-900 leading-none">
                                {loading ? <Loader size={32} className="animate-spin text-turquesa" /> : formatValue(totalIngresos)}
                            </h3>
                        </div>
                        <div className="p-4 bg-turquesa/10 rounded-2xl text-turquesa shadow-inner"><TrendingUp size={24} /></div>
                    </div>
                    <div className="mt-8 flex items-center gap-2">
                        <Badge variant="success" className="bg-turquesa/10 text-turquesa border-none px-3 py-1">REAL TIME</Badge>
                        <p className="text-xs text-gray-400 font-bold">{movimientos.filter(m => m.tipo === 'Ingreso').length} transacciones</p>
                    </div>
                </Card>

                <Card variant="default" className="relative overflow-hidden group border-red-100">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <TrendingDown size={120} />
                    </div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-xs font-black text-red-400 uppercase tracking-widest mb-2">Gastos Operativos</p>
                            <h3 className="text-4xl font-black text-gray-900 leading-none">{loading ? '...' : formatValue(totalEgresos)}</h3>
                        </div>
                        <div className="p-4 bg-red-50 rounded-2xl text-red-500 shadow-inner"><TrendingDown size={24} /></div>
                    </div>
                    <div className="mt-8 flex items-center gap-2">
                        <Badge variant="error" className="bg-red-50 text-red-500 border-none px-3 py-1">EGRESOS</Badge>
                        <p className="text-xs text-gray-400 font-bold">{movimientos.filter(m => m.tipo === 'Egreso').length} registros</p>
                    </div>
                </Card>

                <Card variant="glass" className="relative border-none ring-1 ring-acero/20 overflow-hidden group">
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-acero" style={{ width: `${Math.max(0, Math.min(100, margen))}%` }} />
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <p className="text-xs font-black text-acero uppercase tracking-widest mb-2">Utilidad Neta</p>
                            <h3 className={`text-4xl font-black leading-none ${utilidadNeta >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                {loading ? '...' : formatValue(utilidadNeta)}
                            </h3>
                        </div>
                        <div className="p-4 bg-acero/10 rounded-2xl text-acero shadow-inner"><DollarSign size={24} /></div>
                    </div>
                    <div className="mt-8">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-gray-400 uppercase">Eficiencia</span>
                            <span className="text-xs font-black text-acero">{margen}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-acero h-full rounded-full transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, margen))}%` }} />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Métricas de Agenda */}
            <section className="space-y-6">
                <div className="flex items-center gap-4 px-2">
                    <div className="h-px flex-1 bg-gray-100" />
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">
                        Métricas de Agenda — {format(selectedDate, "d MMMM", { locale: es })}
                    </h3>
                    <div className="h-px flex-1 bg-gray-100" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    {[
                        { label: 'Agendadas', value: kpisAgenda.agendadas, icon: CalendarDays, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200' },
                        { label: 'Atendidas', value: kpisAgenda.atendidas, icon: CalendarCheck, color: 'text-turquesa', bg: 'bg-turquesa/10', border: 'border-turquesa/20' },
                        { label: 'Canceladas', value: kpisAgenda.canceladas, icon: CalendarX, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' },
                        { label: 'Reagendadas', value: kpisAgenda.reagendadas, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
                        { label: 'No Asistió', value: kpisAgenda.noAsistio, icon: UserMinus, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
                    ].map(({ label, value, icon: Icon, color, bg, border }) => (
                        <Card key={label} variant="subtle" className={`group hover:border-inherit ${border} border-dashed`}>
                            <div className="flex flex-col items-center text-center space-y-3">
                                <div className={`p-3 ${bg} ${color} rounded-2xl transition-transform group-hover:scale-110 duration-300`}>
                                    <Icon size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
                                    <h4 className="text-3xl font-black text-gray-900 leading-none">{value}</h4>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Gráfica + Columna lateral */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <Card
                        title="Evolución del Negocio"
                        subtitle="Comparativo Ingresos vs Gastos — Semana Actual"
                        className="h-full"
                    >
                        <div className="h-[400px] mt-6">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={graficaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorUtilidad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4682B4" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#4682B4" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={700} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis stroke="#94a3b8" fontSize={11} fontWeight={700} tickLine={false} axisLine={false} tickFormatter={formatValue} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                        itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                                    />
                                    <Area type="monotone" dataKey="utilidad" stroke="#4682B4" strokeWidth={4} fillOpacity={1} fill="url(#colorUtilidad)" name="Utilidad Neta" />
                                    <Line type="monotone" dataKey="ingresos" stroke="#20B2AA" strokeWidth={3} dot={{ r: 4, fill: '#20B2AA', strokeWidth: 0 }} name="Ingresos" />
                                    <Line type="monotone" dataKey="egresos" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e', strokeWidth: 0 }} name="Egresos" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                <div className="space-y-8">
                    <Card variant="premium" className="bg-turquesa text-white border-none py-8">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm"><Users size={32} /></div>
                            <div>
                                <h4 className="text-4xl font-black leading-none">{pacientes.length}</h4>
                                <p className="text-xs font-bold text-white/70 uppercase tracking-widest mt-1">Pacientes Activos</p>
                            </div>
                        </div>
                    </Card>

                    <Card title="🎁 Próximos Cumpleaños" variant="subtle">
                        {cumpleanosPacientes.length === 0 ? (
                            <p className="text-sm text-gray-400 italic text-center py-6">No hay cumpleaños cercanos.</p>
                        ) : (
                            <div className="space-y-4">
                                {cumpleanosPacientes.map((paciente) => (
                                    <div key={paciente.id} className="group flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-turquesa/5 text-turquesa rounded-xl group-hover:scale-110 transition-transform"><Gift size={20} /></div>
                                            <div>
                                                <p className="text-sm font-black text-gray-900 leading-tight">{paciente.nombre}</p>
                                                <p className="text-[10px] font-bold text-turquesa uppercase tracking-wider">{paciente.tratamiento || 'Paciente VIP'}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card title="Alertas Críticas" subtitle="Atención inmediata">
                        <div className="space-y-4">
                            {citas.filter(c => c.status === 'No Asistió').length > 0 && (
                                <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 group">
                                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg shrink-0"><AlertTriangle size={18} /></div>
                                    <div>
                                        <p className="text-sm font-black text-amber-900 leading-tight">Inasistencias</p>
                                        <p className="text-xs font-medium text-amber-700 mt-1">{citas.filter(c => c.status === 'No Asistió').length} pacientes sin contactar.</p>
                                    </div>
                                </div>
                            )}
                            {kpisAgenda.canceladas > 0 && (
                                <div className="flex items-start gap-4 p-4 bg-rose-50 rounded-2xl border border-rose-100">
                                    <div className="p-2 bg-rose-100 text-rose-500 rounded-lg shrink-0"><CalendarX size={18} /></div>
                                    <div>
                                        <p className="text-sm font-black text-rose-900 leading-tight">Cancelaciones</p>
                                        <p className="text-xs font-medium text-rose-700 mt-1">{kpisAgenda.canceladas} citas perdidas hoy.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
