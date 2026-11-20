import React, { useState, useMemo } from 'react';
import { 
    Apple, Scale, Flame, Droplets, ShoppingCart, Printer, 
    Edit3, CheckCircle2, AlertCircle, Calendar, Clock, 
    Sparkles, ChevronDown, ChevronUp, Activity, ShieldCheck, Heart
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { calcularPlanNutricionalOmron } from '../../services/nutricionService';

export default function PlanNutricionalClinicoView({ 
    paciente, 
    tratamiento, 
    sesiones = [], 
    onActualizar 
}) {
    const [activo, setActivo] = useState(() => Boolean(paciente?.planNutricionalActivo));
    const [toggling, setToggling] = useState(false);
    const [modalMedicion, setModalMedicion] = useState(false);
    const [guardandoMedicion, setGuardandoMedicion] = useState(false);
    const [tiempoComidaActivo, setTiempoComidaActivo] = useState('desayuno');

    // Ultima sesion con medidas
    const ultimaSesionConMedidas = useMemo(() => {
        if (!sesiones || sesiones.length === 0) return null;
        for (let i = sesiones.length - 1; i >= 0; i--) {
            const s = sesiones[i];
            if (s?.medidasCorporales?.peso || s?.peso || s?.grasaPct || s?.rmKcal) {
                return s;
            }
        }
        return sesiones[sesiones.length - 1];
    }, [sesiones]);

    // Extraer valores iniciales de la bascula OMRON
    const getValorInicial = (campo, fallback) => {
        const sm = ultimaSesionConMedidas?.medidasCorporales?.[campo];
        if (sm !== undefined && sm !== null && sm !== '') return Number(sm);
        const sDirect = ultimaSesionConMedidas?.[campo];
        if (sDirect !== undefined && sDirect !== null && sDirect !== '') return Number(sDirect);
        const pVal = paciente?.[campo];
        if (pVal !== undefined && pVal !== null && pVal !== '') return Number(pVal);
        const tVal = tratamiento?.[campo];
        if (tVal !== undefined && tVal !== null && tVal !== '') return Number(tVal);
        return fallback;
    };

    // Calcular edad del paciente si existe fechaNacimiento
    const edadCalculada = useMemo(() => {
        if (!paciente?.fechaNacimiento) return 30;
        try {
            const hoy = new Date();
            const nac = new Date(paciente.fechaNacimiento);
            let age = hoy.getFullYear() - nac.getFullYear();
            const m = hoy.getMonth() - nac.getMonth();
            if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) age--;
            return age > 0 ? age : 30;
        } catch (_) {
            return 30;
        }
    }, [paciente?.fechaNacimiento]);

    // Mantener sincronizado si cambian props
    const pesoEfectivo = getValorInicial('peso', 68);
    const estaturaEfectiva = getValorInicial('estatura', 160);
    const grasaPctEfectiva = getValorInicial('grasaPct', 32);
    const musculoPctEfectivo = getValorInicial('musculoPct', 26);
    const grasaVisceralEfectiva = getValorInicial('grasaVisceral', 5);
    const edadCorporalEfectiva = getValorInicial('edadCorporal', edadCalculada);
    const rmKcalEfectivo = getValorInicial('rmKcal', 1380);

    // Estado del formulario de medicion OMRON
    const [formMedicion, setFormMedicion] = useState({
        peso: pesoEfectivo,
        estatura: estaturaEfectiva,
        grasaPct: grasaPctEfectiva,
        musculoPct: musculoPctEfectivo,
        grasaVisceral: grasaVisceralEfectiva,
        edadCorporal: edadCorporalEfectiva,
        rmKcal: rmKcalEfectivo,
    });

    // Calcular Plan Nutricional Completo
    const plan = useMemo(() => {
        return calcularPlanNutricionalOmron({
            peso: pesoEfectivo,
            estatura: estaturaEfectiva,
            edad: edadCalculada,
            sexo: (paciente?.sexo || 'femenino').toLowerCase(),
            rmKcal: rmKcalEfectivo,
            grasaPct: grasaPctEfectiva,
            musculoPct: musculoPctEfectivo,
            grasaVisceral: grasaVisceralEfectiva,
        });
    }, [pesoEfectivo, estaturaEfectiva, edadCalculada, paciente?.sexo, rmKcalEfectivo, grasaPctEfectiva, musculoPctEfectivo, grasaVisceralEfectiva]);

    // IMC
    const imc = useMemo(() => {
        if (!pesoEfectivo || !estaturaEfectiva) return null;
        const h = estaturaEfectiva > 3 ? estaturaEfectiva / 100 : estaturaEfectiva;
        return (pesoEfectivo / (h * h)).toFixed(1);
    }, [pesoEfectivo, estaturaEfectiva]);

    // Sincronizar estado activo cuando cambie paciente
    React.useEffect(() => {
        if (paciente?.planNutricionalActivo !== undefined) {
            setActivo(Boolean(paciente.planNutricionalActivo));
        }
    }, [paciente?.planNutricionalActivo]);
    // Toggle de activacion del plan
    const handleToggleActivo = async () => {
        if (!paciente?.id) return;
        setToggling(true);
        const nuevoEstado = !activo;
        try {
            await updateDoc(doc(db, 'pacientes', paciente.id), {
                planNutricionalActivo: nuevoEstado,
                planNutricionalData: nuevoEstado ? plan : null,
                planNutricionalActualizadoEn: new Date().toISOString()
            });

            if (tratamiento?.id) {
                await updateDoc(doc(db, 'tratamientos', tratamiento.id), {
                    planNutricionalActivo: nuevoEstado,
                    planNutricionalActualizadoEn: new Date().toISOString()
                });
            }

            setActivo(nuevoEstado);
            if (onActualizar) onActualizar();
        } catch (err) {
            console.error('Error toggling plan nutricional:', err);
            alert('Error al actualizar el estado del plan: ' + err.message);
        } finally {
            setToggling(false);
        }
    };

    // Guardar nueva medicion OMRON
    const handleGuardarMedicion = async (e) => {
        e.preventDefault();
        if (!paciente?.id) return;
        setGuardandoMedicion(true);
        try {
            const p = Number(formMedicion.peso) || 70;
            const est = Number(formMedicion.estatura) || 160;
            const g = Number(formMedicion.grasaPct) || 30;
            const m = Number(formMedicion.musculoPct) || 25;
            const gv = Number(formMedicion.grasaVisceral) || 4;
            const ec = Number(formMedicion.edadCorporal) || edadCalculada;
            const rm = Number(formMedicion.rmKcal) || 1350;

            const updatedData = {
                peso: p,
                estatura: est,
                grasaPct: g,
                musculoPct: m,
                grasaVisceral: gv,
                edadCorporal: ec,
                rmKcal: rm,
                medicionOmronActualizadaEn: new Date().toISOString()
            };

            await updateDoc(doc(db, 'pacientes', paciente.id), updatedData);

            if (tratamiento?.id) {
                await updateDoc(doc(db, 'tratamientos', tratamiento.id), updatedData);
            }

            setModalMedicion(false);
            if (onActualizar) onActualizar();
        } catch (err) {
            console.error('Error guardando medicion OMRON:', err);
            alert('Error guardando medicion: ' + err.message);
        } finally {
            setGuardandoMedicion(false);
        }
    };

    // Imprimir Plan
    const handleImprimir = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            {/* ENCABEZADO PRINCIPAL */}
            <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-acero rounded-2xl p-6 text-white shadow-lg border border-teal-500/20 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-400/20 text-teal-300 border border-teal-400/30 flex items-center gap-1.5">
                            <Scale size={12} /> OMRON HBF-514C Full Body Sensor
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                            activo ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${activo ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`}></span>
                            {activo ? 'Activo en App Movil Paciente' : 'Pausado / Inactivo'}
                        </span>
                    </div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <Apple className="text-teal-400" size={24} /> Plan Nutricional Clinico Personalizado
                    </h2>
                    <p className="text-xs text-gray-300 max-w-2xl">
                        Calculo metabolico directo de bioimpedancia para acelerar drenaje linfatico, reduccion de medidas y proteccion de masa muscular magra.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                        variant={activo ? 'outline' : 'primary'}
                        size="sm"
                        onClick={handleToggleActivo}
                        disabled={toggling}
                        className={activo ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/30 font-bold' : 'bg-teal-500 hover:bg-teal-600 text-white font-bold'}
                    >
                        {toggling ? 'Guardando...' : (activo ? 'Plan Activo (Clic para Pausar)' : 'Activar en App Paciente')}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        icon={Edit3}
                        className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                        onClick={() => {
                            setFormMedicion({
                                peso: pesoEfectivo,
                                estatura: estaturaEfectiva,
                                grasaPct: grasaPctEfectiva,
                                musculoPct: musculoPctEfectivo,
                                grasaVisceral: grasaVisceralEfectiva,
                                edadCorporal: edadCorporalEfectiva,
                                rmKcal: rmKcalEfectivo,
                            });
                            setModalMedicion(true);
                        }}
                    >
                        Capturar Bascula OMRON
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        icon={Printer}
                        className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                        onClick={handleImprimir}
                    >
                        Imprimir / PDF
                    </Button>
                </div>
            </div>

            {/* TARJETAS DE LECTURA OMRON HBF-514C */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs hover:border-teal-300 transition-all">
                    <div className="flex items-center justify-between text-gray-400 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider">Peso & IMC</span>
                        <Scale size={14} className="text-teal-500" />
                    </div>
                    <div className="text-xl font-black text-acero">{pesoEfectivo} <span className="text-xs font-bold text-gray-400">kg</span></div>
                    <div className="text-[11px] font-bold text-teal-600 mt-0.5">IMC {imc || '--'}</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs hover:border-teal-300 transition-all">
                    <div className="flex items-center justify-between text-gray-400 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider">% Grasa Total</span>
                        <Activity size={14} className="text-amber-500" />
                    </div>
                    <div className="text-xl font-black text-amber-600">{grasaPctEfectiva}%</div>
                    <div className="text-[11px] font-semibold text-gray-400 mt-0.5">Bioimpedancia 8-pt</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs hover:border-teal-300 transition-all">
                    <div className="flex items-center justify-between text-gray-400 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider">% Musculo Esq.</span>
                        <ShieldCheck size={14} className="text-teal-500" />
                    </div>
                    <div className="text-xl font-black text-teal-700">{musculoPctEfectivo}%</div>
                    <div className="text-[11px] font-semibold text-gray-400 mt-0.5">Tono muscular magro</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs hover:border-teal-300 transition-all">
                    <div className="flex items-center justify-between text-gray-400 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider">Grasa Visceral</span>
                        <Heart size={14} className="text-rose-500" />
                    </div>
                    <div className="text-xl font-black text-rose-600">Nivel {grasaVisceralEfectiva}</div>
                    <div className="text-[11px] font-semibold text-gray-400 mt-0.5">
                        {grasaVisceralEfectiva <= 9 ? 'Rango Optimo (1-9)' : 'Riesgo Elevado (10+)'}
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs hover:border-teal-300 transition-all">
                    <div className="flex items-center justify-between text-gray-400 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider">Edad Metabolica</span>
                        <Sparkles size={14} className="text-purple-500" />
                    </div>
                    <div className="text-xl font-black text-purple-700">{edadCorporalEfectiva} <span className="text-xs font-bold text-gray-400">anos</span></div>
                    <div className="text-[11px] font-semibold text-gray-400 mt-0.5">vs {edadCalculada} cronologica</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs hover:border-teal-300 transition-all">
                    <div className="flex items-center justify-between text-gray-400 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider">Metabolismo RM</span>
                        <Flame size={14} className="text-orange-500" />
                    </div>
                    <div className="text-xl font-black text-orange-600">{rmKcalEfectivo} <span className="text-xs font-bold text-gray-400">kcal</span></div>
                    <div className="text-[11px] font-semibold text-gray-400 mt-0.5">Gasto Basal en Reposo</div>
                </div>
            </div>
            {/* PRESCRIPCION NUTRICIONAL & MACRONUTRIENTES */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-teal-600">Prescripcion Clinica ALFRA</span>
                        <h3 className="text-base font-black text-acero flex items-center gap-2">
                            <Flame className="text-orange-500" size={18} /> Deficit Lipolitico Clinico (-18% en Cabina)
                        </h3>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold">
                        <div className="text-right">
                            <span className="text-gray-400 block text-[10px] uppercase">Gasto Total Diario</span>
                            <span className="text-gray-700">{plan.gastoEnergeticoTotal} kcal</span>
                        </div>
                        <div className="h-8 w-px bg-gray-200"></div>
                        <div className="text-right">
                            <span className="text-teal-600 block text-[10px] uppercase">Meta con Deficit</span>
                            <span className="text-teal-700 text-base font-black">{plan.metaCalorias} kcal</span>
                        </div>
                    </div>
                </div>

                {/* 3 Barras de Macronutrientes + Hidratacion */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-emerald-50/60 border border-emerald-200/50 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-black text-emerald-800 uppercase tracking-wider">Proteina Magra</span>
                            <span className="text-xs font-black text-emerald-700">{plan.gramosProteina} g</span>
                        </div>
                        <div className="text-lg font-black text-emerald-900">{plan.kcalProteina} <span className="text-xs font-normal text-emerald-700">kcal</span></div>
                        <p className="text-[11px] text-emerald-700 mt-1">1.6g / kg para sostener tono muscular y firmeza.</p>
                    </div>

                    <div className="bg-amber-50/60 border border-amber-200/50 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-black text-amber-800 uppercase tracking-wider">Grasas Saludables</span>
                            <span className="text-xs font-black text-amber-700">{plan.gramosGrasas} g</span>
                        </div>
                        <div className="text-lg font-black text-amber-900">{plan.kcalGrasas} <span className="text-xs font-normal text-amber-700">kcal</span></div>
                        <p className="text-[11px] text-amber-700 mt-1">28% del total. Balance hormonal y saciedad prolongada.</p>
                    </div>

                    <div className="bg-teal-50/60 border border-teal-200/50 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-black text-teal-800 uppercase tracking-wider">Carbos Complejos</span>
                            <span className="text-xs font-black text-teal-700">{plan.gramosCarbos} g</span>
                        </div>
                        <div className="text-lg font-black text-teal-900">{plan.kcalCarbos} <span className="text-xs font-normal text-teal-700">kcal</span></div>
                        <p className="text-[11px] text-teal-700 mt-1">Bajo indice glucemico con alto contenido de fibra.</p>
                    </div>

                    <div className="bg-blue-50/60 border border-blue-200/50 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-black text-blue-800 uppercase tracking-wider">Meta Hidratacion</span>
                            <Droplets size={16} className="text-blue-500" />
                        </div>
                        <div className="text-lg font-black text-blue-900">{plan.litrosAguaRecomendados} <span className="text-xs font-normal text-blue-700">Litros / dia</span></div>
                        <p className="text-[11px] text-blue-700 mt-1">Aprox. {plan.vasosAguaAlDia} vasos de 250ml para drenaje linfatico.</p>
                    </div>
                </div>
            </div>

            {/* MENU EN 5 TIEMPOS CLINICOS */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h3 className="text-sm font-black text-acero uppercase tracking-wider flex items-center gap-2">
                            <Calendar size={16} className="text-teal-600" /> 5 Tiempos de Comida con Horarios Clinicos
                        </h3>
                        <p className="text-xs text-gray-400">Aceleracion del metabolismo mediante comidas fraccionadas cada 3 a 3.5 horas</p>
                    </div>
                    <span className="text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1 rounded-full">
                        Sincronizado con Alertas Moviles
                    </span>
                </div>

                {/* Selector de Tiempo de Comida */}
                <div className="flex border-b border-gray-100 bg-gray-50/60 overflow-x-auto scrollbar-none">
                    {Object.entries(plan.menus).map(([key, item]) => {
                        const isSelected = tiempoComidaActivo === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setTiempoComidaActivo(key)}
                                className={`px-5 py-3 text-xs font-black whitespace-nowrap transition-all border-b-2 flex items-center gap-2 ${
                                    isSelected 
                                        ? 'border-teal-600 text-teal-700 bg-white shadow-2xs' 
                                        : 'border-transparent text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                <span>{item.titulo}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                                    isSelected ? 'bg-teal-100 text-teal-800' : 'bg-gray-200 text-gray-600'
                                }`}>
                                    {item.horario}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Contenido del Tiempo Seleccionado */}
                {plan.menus[tiempoComidaActivo] && (
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                <Clock size={14} className="text-teal-600" /> Horario Sugerido: <span className="text-acero font-black">{plan.menus[tiempoComidaActivo].horario}</span>
                            </div>
                            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100">
                                Aporte Aprox: ~{plan.menus[tiempoComidaActivo].caloriasAprox} kcal
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {plan.menus[tiempoComidaActivo].opciones.map((opc, idx) => (
                                <div key={idx} className="bg-gray-50/70 border border-gray-200/70 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:bg-white hover:border-teal-300 transition-all">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 bg-teal-100/60 px-2 py-0.5 rounded">
                                                Opcion {idx + 1}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-black text-acero leading-snug">{opc.nombre}</h4>
                                        <p className="text-xs text-gray-600 leading-relaxed">{opc.descripcion}</p>
                                    </div>
                                    <div className="pt-2 border-t border-gray-200/60">
                                        <span className="text-[10px] font-bold text-gray-400 block mb-1 uppercase">Ingredientes Clave:</span>
                                        <div className="flex flex-wrap gap-1">
                                            {opc.ingredientes.map((ing, ingIdx) => (
                                                <span key={ingIdx} className="text-[10px] bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-md font-medium">
                                                    {ing}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            {/* LISTA DEL SUPER SEMANAL */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <h3 className="text-sm font-black text-acero uppercase tracking-wider flex items-center gap-2">
                        <ShoppingCart size={16} className="text-teal-600" /> Lista Semanal del Super por Categorias
                    </h3>
                    <span className="text-[11px] font-bold text-gray-400">Optimizada para las 5 comidas</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {Object.entries(plan.listaCompras).map(([catKey, items]) => {
                        const titulosMap = {
                            proteinas: 'Proteinas Magras',
                            vegetalesYFrutas: 'Vegetales & Frutas',
                            carbohidratos: 'Carbohidratos',
                            grasasSaludables: 'Grasas Buenas',
                            bebidasEInfusiones: 'Hidratacion'
                        };
                        return (
                            <div key={catKey} className="bg-gray-50/60 border border-gray-200/60 rounded-xl p-3.5 space-y-2">
                                <h4 className="text-xs font-black text-acero pb-1.5 border-b border-gray-200/60">
                                    {titulosMap[catKey] || catKey}
                                </h4>
                                <ul className="space-y-1">
                                    {items.map((it, itIdx) => (
                                        <li key={itIdx} className="text-[11px] text-gray-600 flex items-start gap-1.5 leading-snug">
                                            <span className="text-teal-500 font-bold">•</span> {it}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* MODAL PARA CAPTURAR MEDICION BASCULA OMRON */}
            <Modal
                isOpen={modalMedicion}
                onClose={() => setModalMedicion(false)}
                title="Captura de Bascula OMRON HBF-514C"
            >
                <form onSubmit={handleGuardarMedicion} className="space-y-4 p-2">
                    <p className="text-xs text-gray-500">
                        Ingresa los 6 parametros obtenidos de la bascula de bioimpedancia clinica de 8 sensores (pies y manos).
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1">Peso (kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                required
                                value={formMedicion.peso}
                                onChange={(e) => setFormMedicion({ ...formMedicion, peso: e.target.value })}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black focus:ring-2 focus:ring-teal-500/20 outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1">Estatura (cm)</label>
                            <input
                                type="number"
                                step="1"
                                required
                                value={formMedicion.estatura}
                                onChange={(e) => setFormMedicion({ ...formMedicion, estatura: e.target.value })}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black focus:ring-2 focus:ring-teal-500/20 outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1">% Grasa Corporal (FAT)</label>
                            <input
                                type="number"
                                step="0.1"
                                required
                                value={formMedicion.grasaPct}
                                onChange={(e) => setFormMedicion({ ...formMedicion, grasaPct: e.target.value })}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black focus:ring-2 focus:ring-teal-500/20 outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1">% Musculo Esqueletico (MUSCLE)</label>
                            <input
                                type="number"
                                step="0.1"
                                required
                                value={formMedicion.musculoPct}
                                onChange={(e) => setFormMedicion({ ...formMedicion, musculoPct: e.target.value })}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black focus:ring-2 focus:ring-teal-500/20 outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1">Grasa Visceral (1 - 30)</label>
                            <input
                                type="number"
                                step="1"
                                required
                                value={formMedicion.grasaVisceral}
                                onChange={(e) => setFormMedicion({ ...formMedicion, grasaVisceral: e.target.value })}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black focus:ring-2 focus:ring-teal-500/20 outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1">Edad Corporal (BODY AGE)</label>
                            <input
                                type="number"
                                step="1"
                                required
                                value={formMedicion.edadCorporal}
                                onChange={(e) => setFormMedicion({ ...formMedicion, edadCorporal: e.target.value })}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black focus:ring-2 focus:ring-teal-500/20 outline-none"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="text-[11px] font-bold text-gray-600 block mb-1">Metabolismo Basal RM (kcal)</label>
                            <input
                                type="number"
                                step="1"
                                required
                                value={formMedicion.rmKcal}
                                onChange={(e) => setFormMedicion({ ...formMedicion, rmKcal: e.target.value })}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black focus:ring-2 focus:ring-teal-500/20 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                        <Button variant="outline" type="button" onClick={() => setModalMedicion(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" type="submit" disabled={guardandoMedicion}>
                            {guardandoMedicion ? 'Guardando...' : 'Guardar y Recalcular Plan'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
