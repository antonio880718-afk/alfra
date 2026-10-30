import React, { useState, useEffect } from 'react';
import { X, FileText, Printer, CheckCircle, ShieldCheck, UserCheck, Save, Sparkles, AlertCircle } from 'lucide-react';
import { getConfiguracionFirmas, guardarConfiguracionFirmas, sanitizarObjetoFirmas } from '../../services/limpiezaService';

export default function ModalConfigurarFirmasPDF({
    isOpen,
    onClose,
    onGenerarPDF,
    tituloReporte = 'Bitácora Diaria de Aseo',
    subtituloReporte = 'Exportación oficial con especificaciones sanitarias COFEPRIS',
    defaultOperador = '',
    defaultSupervisor = '',
    mostrarToast = () => {}
}) {
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [recordarDefaults, setRecordarDefaults] = useState(true);

    const [form, setForm] = useState({
        operadorNombre: defaultOperador || 'Personal de Intendencia',
        operadorCargo: 'Personal Operativo de Intendencia',
        operadorDetalle: 'Ejecutó aseo y desinfección bajo protocolo',
        supervisorNombre: defaultSupervisor || 'Dra. Alondra Frausto',
        supervisorCargo: 'Responsable Sanitario / Dirección Médica',
        supervisorCedula: 'CED. PROF. 12849203 SSA',
        avisoSanitario: 'COFEPRIS-AF-2024-ALFRA-01',
        licenciaSanitaria: 'En trámite / Aviso vigente',
        nombreClinica: 'CLÍNICA ALFRA',
        subtituloClinica: 'Centro Especializado en Medicina Estética & Salud Integral'
    });

    useEffect(() => {
        if (!isOpen) return;
        const cargar = async () => {
            setCargando(true);
            try {
                const configGuardada = await getConfiguracionFirmas();
                const configLimpia = sanitizarObjetoFirmas(configGuardada);
                setForm(prev => ({
                    ...prev,
                    ...configLimpia,
                    operadorNombre: defaultOperador || configLimpia.operadorNombre || prev.operadorNombre,
                    supervisorNombre: defaultSupervisor || configLimpia.supervisorNombre || prev.supervisorNombre
                }));
            } catch (err) {
                console.error('Error al cargar firmas:', err);
            } finally {
                setCargando(false);
            }
        };
        cargar();
    }, [isOpen, defaultOperador, defaultSupervisor]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);
        const formLimpio = sanitizarObjetoFirmas(form);
        try {
            if (recordarDefaults) {
                await guardarConfiguracionFirmas(formLimpio);
            }
            await onGenerarPDF(formLimpio);
            onClose();
        } catch (err) {
            console.error('Error al generar PDF con firmas:', err);
            mostrarToast('Error al generar el reporte PDF');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-2xl w-full space-y-5 shadow-2xl border border-slate-100 my-8">
                {/* CABECERA */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0 shadow-xs">
                            <Printer size={24} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                                {tituloReporte}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {subtituloReporte}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* BANNER INFORMATIVO: LOGO INCLUIDO */}
                <div className="bg-gradient-to-r from-slate-900 to-teal-950 p-4 rounded-2xl text-white flex items-center justify-between gap-3 shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow">
                            <img src="/logo.png" alt="Logo ALFRA" className="max-w-full max-h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                        </div>
                        <div>
                            <p className="text-xs font-black text-white flex items-center gap-1.5">
                                <Sparkles size={13} className="text-teal-400" /> Logotipo Oficial ALFRA Incluido
                            </p>
                            <p className="text-[11px] text-teal-200/80">
                                El membrete sanitario en alta resolución aparecerá en el encabezado del documento.
                            </p>
                        </div>
                    </div>
                    <span className="hidden sm:inline-flex text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/40 px-2.5 py-1 rounded-lg">
                        COFEPRIS NOM-016
                    </span>
                </div>

                {/* FORMULARIO DE FIRMAS EDITABLES */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* BLOQUE FIRMA OPERADOR */}
                        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs pb-1 border-b border-slate-200">
                                <UserCheck size={16} className="text-teal-600" />
                                <span>1. Firma: Personal de Intendencia</span>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-700 mb-1">
                                    Nombre del Operador(a):
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.operadorNombre}
                                    onChange={e => setForm({ ...form, operadorNombre: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                                    placeholder="Ej. María Gómez / Personal de Limpieza"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-700 mb-1">
                                    Cargo o Puesto:
                                </label>
                                <input
                                    type="text"
                                    value={form.operadorCargo}
                                    onChange={e => setForm({ ...form, operadorCargo: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                                    placeholder="Personal Operativo de Intendencia"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-700 mb-1">
                                    Leyenda de Ejecución:
                                </label>
                                <input
                                    type="text"
                                    value={form.operadorDetalle}
                                    onChange={e => setForm({ ...form, operadorDetalle: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 font-medium focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                                    placeholder="Ejecutó aseo y desinfección bajo protocolo"
                                />
                            </div>
                        </div>

                        {/* BLOQUE FIRMA SUPERVISOR / MÉDICO */}
                        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs pb-1 border-b border-slate-200">
                                <ShieldCheck size={16} className="text-teal-600" />
                                <span>2. Firma: Dirección Médica / Supervisor</span>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-700 mb-1">
                                    Nombre del Responsable Sanitario:
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.supervisorNombre}
                                    onChange={e => setForm({ ...form, supervisorNombre: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                                    placeholder="Ej. Dra. Alondra Frausto"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-700 mb-1">
                                    Cargo Oficial:
                                </label>
                                <input
                                    type="text"
                                    value={form.supervisorCargo}
                                    onChange={e => setForm({ ...form, supervisorCargo: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                                    placeholder="Responsable Sanitario / Dirección Médica"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-700 mb-1">
                                    Cédula Profesional:
                                </label>
                                <input
                                    type="text"
                                    value={form.supervisorCedula}
                                    onChange={e => setForm({ ...form, supervisorCedula: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                                    placeholder="CED. PROF. 12849203 SSA"
                                />
                            </div>
                        </div>
                    </div>

                    {/* DATOS GENERALES DE AVISO COFEPRIS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Aviso de Funcionamiento:
                            </label>
                            <input
                                type="text"
                                value={form.avisoSanitario}
                                onChange={e => setForm({ ...form, avisoSanitario: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-700 focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                                placeholder="COFEPRIS-AF-2024-ALFRA-01"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Nombre Oficial de la Clínica:
                            </label>
                            <input
                                type="text"
                                value={form.nombreClinica}
                                onChange={e => setForm({ ...form, nombreClinica: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-700 focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                                placeholder="CLÍNICA ALFRA"
                            />
                        </div>
                    </div>

                    {/* RECORDAR PARA FUTUROS REPORTES */}
                    <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-teal-50/60 border border-teal-200/80 cursor-pointer transition-all hover:bg-teal-50">
                        <input
                            type="checkbox"
                            checked={recordarDefaults}
                            onChange={e => setRecordarDefaults(e.target.checked)}
                            className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                        />
                        <span className="text-xs font-bold text-teal-900">
                            Recordar estas firmas y datos sanitarios como predeterminados para futuras bitácoras
                        </span>
                    </label>

                    {/* BOTONES */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={guardando}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-teal-900/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Printer size={15} />
                            {guardando ? 'Generando PDF...' : 'Generar e Imprimir Reporte PDF'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
