import React, { useState, useEffect } from 'react';
import {
    Plus, Pencil, Trash2, Check, X, RotateCcw, Sparkles, Layers,
    ShieldCheck, AlertCircle, Info, Search, HelpCircle, ChevronRight,
    Tag, CheckSquare
} from 'lucide-react';
import {
    ESPACIOS_CLINICA, onEspaciosClinicaChange, agregarEspacioClinica,
    editarEspacioClinica, eliminarEspacioClinica, agregarTareaAEspacio,
    modificarTareaDeEspacio, eliminarTareaDeEspacio, restablecerEspaciosDefault
} from '../../services/limpiezaService';

export default function AdminConfiguracionEspacios({ mostrarToast }) {
    const [espacios, setEspacios] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('todos');

    const [modalNuevoEspacio, setModalNuevoEspacio] = useState(false);
    const [modalEditarEspacio, setModalEditarEspacio] = useState(null);
    const [editandoTarea, setEditandoTarea] = useState({ espacioId: null, idx: null, texto: '' });
    const [nuevaTareaInputs, setNuevaTareaInputs] = useState({});
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        const unsub = onEspaciosClinicaChange((data) => {
            setEspacios(data);
            setCargando(false);
        });
        return () => unsub();
    }, []);

    const notificar = (msg) => {
        if (typeof mostrarToast === 'function') mostrarToast(msg);
        else alert(msg);
    };

    const handleCrearEspacio = async (datos) => {
        setGuardando(true);
        try {
            await agregarEspacioClinica(datos);
            setModalNuevoEspacio(false);
            notificar('Cabina o área agregada al catálogo');
        } catch (err) {
            console.error(err);
            alert('Error al crear cabina o área: ' + (err.message || 'Intenta de nuevo'));
        } finally {
            setGuardando(false);
        }
    };

    const handleGuardarEdicionEspacio = async (id, datos) => {
        setGuardando(true);
        try {
            await editarEspacioClinica(id, datos);
            setModalEditarEspacio(null);
            notificar('Cambios guardados correctamente');
        } catch (err) {
            console.error(err);
            alert('Error al actualizar: ' + (err.message || 'Intenta de nuevo'));
        } finally {
            setGuardando(false);
        }
    };

    const handleEliminarEspacio = async (id, nombre) => {
        const confirmar = window.confirm('¿Eliminar "' + nombre + '"?\n\nSe retirará de las bitácoras diarias del personal.');
        if (!confirmar) return;
        try {
            await eliminarEspacioClinica(id);
            notificar('"' + nombre + '" eliminada');
        } catch (err) {
            console.error(err);
            alert('Error al eliminar área: ' + (err.message || 'Intenta de nuevo'));
        }
    };

    const handleAgregarTarea = async (espacioId) => {
        const texto = (nuevaTareaInputs[espacioId] || '').trim();
        if (!texto) return;
        try {
            await agregarTareaAEspacio(espacioId, texto);
            setNuevaTareaInputs(prev => ({ ...prev, [espacioId]: '' }));
            notificar('Tarea agregada a la cabina');
        } catch (err) {
            console.error(err);
            alert('Error al agregar tarea: ' + (err.message || 'Intenta de nuevo'));
        }
    };

    const handleGuardarEdicionTarea = async (espacioId, idx) => {
        const texto = (editandoTarea.texto || '').trim();
        if (!texto) return;
        try {
            await modificarTareaDeEspacio(espacioId, idx, texto);
            setEditandoTarea({ espacioId: null, idx: null, texto: '' });
            notificar('Tarea modificada');
        } catch (err) {
            console.error(err);
            alert('Error al modificar tarea: ' + (err.message || 'Intenta de nuevo'));
        }
    };

    const handleEliminarTarea = async (espacioId, idx, texto) => {
        const confirmar = window.confirm('¿Eliminar la tarea "' + texto + '" de esta cabina?');
        if (!confirmar) return;
        try {
            await eliminarTareaDeEspacio(espacioId, idx);
            notificar('Tarea eliminada');
        } catch (err) {
            console.error(err);
            alert('Error al eliminar tarea: ' + (err.message || 'Intenta de nuevo'));
        }
    };

    const handleRestaurarDefaults = async () => {
        const confirmar = window.confirm('¿Restablecer todas las cabinas y tareas a la configuración clínica oficial de COFEPRIS?\n\nSe recuperarán los 6 espacios oficiales con sus tareas.');
        if (!confirmar) return;
        setGuardando(true);
        try {
            await restablecerEspaciosDefault();
            notificar('Configuración oficial COFEPRIS restaurada');
        } catch (err) {
            console.error(err);
            alert('Error al restablecer configuración');
        } finally {
            setGuardando(false);
        }
    };

    const espaciosFiltrados = espacios.filter(e => {
        const matchNombre = e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
            (e.tareas && e.tareas.some(t => t.toLowerCase().includes(busqueda.toLowerCase())));
        if (!matchNombre) return false;

        const t = (e.tipoArea || '').toLowerCase();
        if (filtroTipo === 'critica') return t.includes('crítica') || t.includes('aséptica');
        if (filtroTipo === 'comun') return t.includes('común') || t.includes('no crítica');
        if (filtroTipo === 'sanitaria') return t.includes('sanitaria') || t.includes('baño');
        return true;
    });

    const getBadgeStyle = (tipo) => {
        const t = (tipo || '').toLowerCase();
        if (t.includes('crítica') || t.includes('aséptica')) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (t.includes('semicrítica')) return 'bg-blue-100 text-blue-800 border-blue-300';
        if (t.includes('sanitaria')) return 'bg-amber-100 text-amber-800 border-amber-300';
        return 'bg-slate-100 text-slate-700 border-slate-300';
    };

    return (
        <div className="space-y-6">
            {/* HERO BARRA SUPERIOR DE ACCIONES */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-[11px] font-black uppercase tracking-wider mb-1.5 border border-teal-200">
                        <Sparkles size={13} className="text-teal-600" /> Catálogo Personalizable de Limpieza
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                        Cabinas, Áreas Comunes y Tareas Diarias
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 max-w-2xl">
                        Agrega o renombra cabinas, edita áreas comunes y personaliza las tareas que el personal de limpieza debe realizar y registrar en su bitácora.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={() => setModalNuevoEspacio(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95"
                    >
                        <Plus size={16} /> Nueva Cabina / Área
                    </button>
                    <button
                        onClick={handleRestaurarDefaults}
                        disabled={guardando}
                        className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 active:scale-95 disabled:opacity-50"
                        title="Restablece las cabinas y tareas a la norma oficial COFEPRIS"
                    >
                        <RotateCcw size={14} /> Restaurar COFEPRIS
                    </button>
                </div>
            </div>

            {/* FILTROS Y BÚSQUEDA */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar cabina o tarea..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white outline-none focus:border-teal-500 shadow-sm"
                    />
                    {busqueda && (
                        <button
                            onClick={() => setBusqueda('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1">
                    {[
                        { id: 'todos', label: 'Todas las Áreas' },
                        { id: 'critica', label: 'Cabinas Críticas' },
                        { id: 'sanitaria', label: 'Baños / Sanitarias' },
                        { id: 'comun', label: 'Áreas Comunes' }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFiltroTipo(f.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                filtroTipo === f.id
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* GRID DE CABINAS Y ÁREAS */}
            {cargando ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
                    <Sparkles className="animate-spin mx-auto text-teal-600 mb-2" size={28} />
                    <p className="text-sm font-bold text-slate-600">Cargando cabinas y tareas...</p>
                </div>
            ) : espaciosFiltrados.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-3">
                    <AlertCircle className="mx-auto text-slate-300" size={40} />
                    <h3 className="font-bold text-slate-700">No se encontraron cabinas o áreas</h3>
                    <p className="text-xs text-slate-400">Prueba con otro término de búsqueda o agrega una nueva cabina.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {espaciosFiltrados.map((espacio) => (
                        <div
                            key={espacio.id}
                            className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                        >
                            <div className="space-y-4">
                                {/* CABECERA DE LA CABINA */}
                                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200/60 text-teal-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <Layers size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-black text-slate-800 text-base leading-tight truncate">
                                                {espacio.nombre}
                                            </h3>
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${getBadgeStyle(espacio.tipoArea)}`}>
                                                    {espacio.tipoArea || 'Crítica / Aséptica'}
                                                </span>
                                                <span className="text-[11px] font-bold text-slate-400">
                                                    • {espacio.tareas?.length || 0} tareas
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* BOTONES DE EDICIÓN Y ELIMINACIÓN */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={() => setModalEditarEspacio(espacio)}
                                            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-colors"
                                            title="Modificar nombre y tipo de cabina"
                                        >
                                            <Pencil size={15} />
                                        </button>
                                        <button
                                            onClick={() => handleEliminarEspacio(espacio.id, espacio.nombre)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                            title="Eliminar cabina o área"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>

                                {/* PROTOCOLO DE DESINFECCIÓN */}
                                {(espacio.quimicoSugerido || espacio.tecnica) && (
                                    <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/60 text-[11px] text-slate-600 space-y-1">
                                        {espacio.quimicoSugerido && (
                                            <p className="flex items-start gap-1.5">
                                                <strong className="text-slate-700 flex-shrink-0">🧴 Químico:</strong>
                                                <span className="truncate">{espacio.quimicoSugerido}</span>
                                            </p>
                                        )}
                                        {espacio.tecnica && (
                                            <p className="flex items-start gap-1.5">
                                                <strong className="text-slate-700 flex-shrink-0">🧹 Técnica:</strong>
                                                <span className="truncate">{espacio.tecnica}</span>
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* LISTA DE TAREAS */}
                                <div className="space-y-2">
                                    <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                                        <span>Tareas Diarias Obligatorias</span>
                                        <span className="text-teal-700 font-bold">{espacio.tareas?.length || 0}</span>
                                    </p>

                                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                        {(!espacio.tareas || espacio.tareas.length === 0) ? (
                                            <p className="text-xs text-slate-400 italic p-3 text-center bg-slate-50 rounded-xl">
                                                No hay tareas asignadas. Escribe una abajo para agregarla.
                                            </p>
                                        ) : (
                                            espacio.tareas.map((tarea, tIdx) => {
                                                const estaEditando = editandoTarea.espacioId === espacio.id && editandoTarea.idx === tIdx;

                                                return (
                                                    <div
                                                        key={tIdx}
                                                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/60 transition-colors text-xs"
                                                    >
                                                        {estaEditando ? (
                                                            <div className="flex items-center gap-1.5 flex-1">
                                                                <input
                                                                    type="text"
                                                                    value={editandoTarea.texto}
                                                                    onChange={e => setEditandoTarea({ ...editandoTarea, texto: e.target.value })}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') handleGuardarEdicionTarea(espacio.id, tIdx);
                                                                        if (e.key === 'Escape') setEditandoTarea({ espacioId: null, idx: null, texto: '' });
                                                                    }}
                                                                    autoFocus
                                                                    className="flex-1 p-1.5 text-xs font-bold border border-teal-500 rounded-lg outline-none bg-white shadow-inner"
                                                                />
                                                                <button
                                                                    onClick={() => handleGuardarEdicionTarea(espacio.id, tIdx)}
                                                                    className="p-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg shadow-sm"
                                                                    title="Guardar cambio"
                                                                >
                                                                    <Check size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditandoTarea({ espacioId: null, idx: null, texto: '' })}
                                                                    className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg"
                                                                    title="Cancelar"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                    <span className="w-5 h-5 rounded-md bg-teal-100 text-teal-800 font-black text-[10px] flex items-center justify-center flex-shrink-0">
                                                                        {tIdx + 1}
                                                                    </span>
                                                                    <span className="font-semibold text-slate-700 truncate" title={tarea}>
                                                                        {tarea}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                                    <button
                                                                        onClick={() => setEditandoTarea({ espacioId: espacio.id, idx: tIdx, texto: tarea })}
                                                                        className="p-1 text-slate-400 hover:text-teal-600 hover:bg-white rounded-lg transition-colors"
                                                                        title="Modificar nombre de tarea"
                                                                    >
                                                                        <Pencil size={13} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleEliminarTarea(espacio.id, tIdx, tarea)}
                                                                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors"
                                                                        title="Eliminar tarea"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* AGREGAR NUEVA TAREA */}
                            <div className="pt-3 mt-3 border-t border-slate-100">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="➕ Escribe una nueva tarea (ej. Desinfectar camilla)..."
                                        value={nuevaTareaInputs[espacio.id] || ''}
                                        onChange={e => setNuevaTareaInputs(prev => ({ ...prev, [espacio.id]: e.target.value }))}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleAgregarTarea(espacio.id);
                                        }}
                                        className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-500 outline-none transition-colors"
                                    />
                                    <button
                                        onClick={() => handleAgregarTarea(espacio.id)}
                                        className="px-3 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-black rounded-xl uppercase tracking-wider flex items-center gap-1 shadow-sm active:scale-95 transition-all flex-shrink-0"
                                    >
                                        <Plus size={14} /> Agregar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL CREAR NUEVA CABINA */}
            {modalNuevoEspacio && (
                <ModalCrearCabina
                    onClose={() => setModalNuevoEspacio(false)}
                    onCrear={handleCrearEspacio}
                    guardando={guardando}
                />
            )}

            {/* MODAL EDITAR CABINA */}
            {modalEditarEspacio && (
                <ModalEditarCabina
                    espacio={modalEditarEspacio}
                    onClose={() => setModalEditarEspacio(null)}
                    onGuardar={handleGuardarEdicionEspacio}
                    guardando={guardando}
                />
            )}
        </div>
    );
}

function ModalCrearCabina({ onClose, onCrear, guardando }) {
    const [nombre, setNombre] = useState('');
    const [tipoArea, setTipoArea] = useState('Crítica / Aséptica');
    const [quimicoSugerido, setQuimicoSugerido] = useState('Cuaternario de Amonio 5ta Gen. (0.5%) y Alcohol al 70%');
    const [tecnica, setTecnica] = useState('Limpieza unidireccional y doble balde');
    const [tareasTexto, setTareasTexto] = useState(
        'Barrer y trapear con desinfectante\\nDesinfectar superficies de trabajo y camilla\\nLimpiar espejos y cristales\\nRetirar y encamisar bote de basura'
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!nombre.trim()) {
            alert('Por favor ingresa el nombre de la cabina o área');
            return;
        }

        const tareasArray = tareasTexto
            .split('\\n')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        onCrear({
            nombre: nombre.trim(),
            tipoArea,
            quimicoSugerido: quimicoSugerido.trim(),
            tecnica: tecnica.trim(),
            tareas: tareasArray
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div>
                        <h3 className="font-black text-slate-800 text-lg">Nueva Cabina o Área Común</h3>
                        <p className="text-xs text-slate-400">Configura el nuevo espacio y sus tareas de limpieza.</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                            Nombre de la Cabina o Área *
                        </label>
                        <input
                            type="text"
                            placeholder="Ej. Cabina Médica, Cabina Láser, Comedor..."
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            required
                            autoFocus
                            className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-teal-500 outline-none font-bold"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                            Tipo de Área Sanitaria (COFEPRIS)
                        </label>
                        <select
                            value={tipoArea}
                            onChange={e => {
                                setTipoArea(e.target.value);
                                if (e.target.value.includes('Crítica')) {
                                    setQuimicoSugerido('Cuaternario de Amonio 5ta Gen. (0.5%) y Alcohol al 70%');
                                    setTecnica('Limpieza unidireccional y doble balde');
                                } else if (e.target.value.includes('Sanitaria')) {
                                    setQuimicoSugerido('Hipoclorito de Sodio 0.1% y Desincrustante bactericida');
                                    setTecnica('Lavado con cepillo y trapeado con doble cubeta');
                                } else {
                                    setQuimicoSugerido('Detergente neutro y Solución Clorada 0.1%');
                                    setTecnica('Barrido húmedo y sacudido con microfibra');
                                }
                            }}
                            className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-teal-500 outline-none font-medium bg-slate-50"
                        >
                            <option value="Crítica / Aséptica">Crítica / Aséptica (Cabinas faciales, corporales, procedimientos)</option>
                            <option value="Semicrítica">Semicrítica (Cabina capilar, aparatología estética)</option>
                            <option value="Crítica / Sanitaria">Crítica / Sanitaria (Baños, sanitarios, regaderas)</option>
                            <option value="No Crítica / Común">No Crítica / Común (Recepción, sala de espera, pasillos)</option>
                            <option value="No Crítica / Administrativa">No Crítica / Administrativa (Oficinas, bodega)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                Químico Sugerido
                            </label>
                            <input
                                type="text"
                                value={quimicoSugerido}
                                onChange={e => setQuimicoSugerido(e.target.value)}
                                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                Técnica de Limpieza
                            </label>
                            <input
                                type="text"
                                value={tecnica}
                                onChange={e => setTecnica(e.target.value)}
                                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                            Tareas Diarias Iniciales (una por línea)
                        </label>
                        <textarea
                            rows={4}
                            value={tareasTexto}
                            onChange={e => setTareasTexto(e.target.value)}
                            className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-teal-500 outline-none font-mono"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                            Escribe cada tarea en un renglón nuevo. Podrás modificarlas o agregar más después.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={guardando}
                            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md active:scale-95 disabled:opacity-50"
                        >
                            {guardando ? 'Guardando...' : 'Crear Cabina / Área'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ModalEditarCabina({ espacio, onClose, onGuardar, guardando }) {
    const [nombre, setNombre] = useState(espacio.nombre);
    const [tipoArea, setTipoArea] = useState(espacio.tipoArea || 'Crítica / Aséptica');
    const [quimicoSugerido, setQuimicoSugerido] = useState(espacio.quimicoSugerido || '');
    const [tecnica, setTecnica] = useState(espacio.tecnica || '');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!nombre.trim()) {
            alert('El nombre no puede estar vacío');
            return;
        }

        onGuardar(espacio.id, {
            nombre: nombre.trim(),
            tipoArea,
            quimicoSugerido: quimicoSugerido.trim(),
            tecnica: tecnica.trim()
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div>
                        <h3 className="font-black text-slate-800 text-lg">Editar Cabina / Área</h3>
                        <p className="text-xs text-slate-400">Modifica el nombre o tipo de este espacio.</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                            Nombre de la Cabina o Área *
                        </label>
                        <input
                            type="text"
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            required
                            autoFocus
                            className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-teal-500 outline-none font-bold"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                            Tipo de Área Sanitaria (COFEPRIS)
                        </label>
                        <select
                            value={tipoArea}
                            onChange={e => setTipoArea(e.target.value)}
                            className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-teal-500 outline-none font-medium bg-slate-50"
                        >
                            <option value="Crítica / Aséptica">Crítica / Aséptica (Cabinas faciales, corporales, procedimientos)</option>
                            <option value="Semicrítica">Semicrítica (Cabina capilar, aparatología estética)</option>
                            <option value="Crítica / Sanitaria">Crítica / Sanitaria (Baños, sanitarios, regaderas)</option>
                            <option value="No Crítica / Común">No Crítica / Común (Recepción, sala de espera, pasillos)</option>
                            <option value="No Crítica / Administrativa">No Crítica / Administrativa (Oficinas, bodega)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Químico Desinfectante Sugerido
                        </label>
                        <input
                            type="text"
                            value={quimicoSugerido}
                            onChange={e => setQuimicoSugerido(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Técnica de Limpieza
                        </label>
                        <input
                            type="text"
                            value={tecnica}
                            onChange={e => setTecnica(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={guardando}
                            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md active:scale-95 disabled:opacity-50"
                        >
                            {guardando ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
