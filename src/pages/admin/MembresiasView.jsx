import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Search, CreditCard, PlusCircle, RefreshCw, Star, Shield, Award, Crown, Activity, Trash2 } from 'lucide-react';
import { onPacientesChange, activarMembresia, recargarHorasMembresia, updatePaciente, consumirHorasMembresia, onConsumosChange, onRecargasPacienteChange } from '../../services/pacientesService';
import { createRecibo } from '../../services/recibosService';
import ReciboDigital from '../../components/ui/ReciboDigital';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function MembresiasView() {
    const [pacientes, setPacientes] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
    const [horasRecarga, setHorasRecarga] = useState('');
    const [horasAjuste, setHorasAjuste] = useState('');
    const [loading, setLoading] = useState(true);
    const [beneficios, setBeneficios] = useState({ Bronce: [], Plata: [], Oro: [], Platinum: [] });
    const [nuevoBeneficio, setNuevoBeneficio] = useState({ Bronce: '', Plata: '', Oro: '', Platinum: '' });
    const [catalogoServicios, setCatalogoServicios] = useState([]);
    const [nuevoServicio, setNuevoServicio] = useState({ nombre: '', horas: '' });
    const [servicioSeleccionado, setServicioSeleccionado] = useState('');
    const [consumos, setConsumos] = useState([]);
    const [isReciboOpen, setIsReciboOpen] = useState(false);
    const [reciboActual, setReciboActual] = useState(null);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'config', 'membresias'));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setCatalogoServicios(data.catalogoServicios || []);
                }
                
                // Cargar beneficios de la nueva ubicación
                const benefitsSnap = await getDoc(doc(db, 'configuracion', 'beneficios_membresia'));
                if (benefitsSnap.exists()) {
                    const bData = benefitsSnap.data();
                    const b = bData.beneficios || {};
                    // Migrar de string a array si es necesario
                    const migrated = {};
                    ['Bronce', 'Plata', 'Oro', 'Platinum'].forEach(nivel => {
                        if (typeof b[nivel] === 'string') {
                            migrated[nivel] = b[nivel].split('\n').filter(item => item.trim() !== '');
                        } else {
                            migrated[nivel] = b[nivel] || [];
                        }
                    });
                    setBeneficios(migrated);
                } else {
                    // Cargar de localStorage si no hay en BD
                    const localData = localStorage.getItem('beneficios_membresia');
                    if (localData) {
                        setBeneficios(JSON.parse(localData));
                    }
                }
            } catch (err) {
                console.error("Error loading config:", err);
            }
        };
        loadConfig();
    }, []);



    useEffect(() => {
        const unsub = onPacientesChange((data) => {
            setPacientes(data);
            setLoading(false);
            if (pacienteSeleccionado) {
                const actualizado = data.find(p => p.id === pacienteSeleccionado.id);
                if (actualizado) setPacienteSeleccionado(actualizado);
            }
        });
        return () => unsub();
    }, [pacienteSeleccionado]);

    useEffect(() => {
        const unsub = onConsumosChange((data) => {
            setConsumos(data);
        });
        return () => unsub();
    }, []);

    const [recargasPaciente, setRecargasPaciente] = useState([]);

    useEffect(() => {
        if (!pacienteSeleccionado) {
            setRecargasPaciente([]);
            return;
        }
        const unsub = onRecargasPacienteChange(pacienteSeleccionado.id, (data) => {
            setRecargasPaciente(data);
        });
        return () => unsub();
    }, [pacienteSeleccionado]);

    const pacientesFiltrados = pacientes.filter(p => {
        const q = busqueda.toLowerCase();
        const codigoMem = p.membresia?.codigo || '';
        return !q || 
            (p.nombre || '').toLowerCase().includes(q) || 
            (p.telefono || '').includes(q) ||
            codigoMem.toLowerCase().includes(q);
    });

    const consumosPaciente = pacienteSeleccionado ? consumos.filter(c => c.pacienteId === pacienteSeleccionado.id) : [];

    const handleActivar = async (id, nivel = 'Bronce') => {
        try {
            const codigo = await activarMembresia(id, nivel);
            alert('Membresía activada con éxito: ' + codigo);
        } catch (err) {
            alert('Error al activar: ' + err.message);
        }
    };

    const handleRecargar = async () => {
        if (!pacienteSeleccionado || !horasRecarga) return;
        const horas = parseFloat(horasRecarga);
        if (horas <= 0) return;
        
        try {
            await recargarHorasMembresia(pacienteSeleccionado.id, horas);
            alert('Horas recargadas con éxito');
            setHorasRecarga('');
        } catch (err) {
            alert('Error al recargar: ' + err.message);
        }
    };

    const handleAjustar = async () => {
        if (!pacienteSeleccionado || horasAjuste === '') return;
        const horas = parseFloat(horasAjuste);
        if (horas < 0) return;
        
        if (!window.confirm(`¿Estás seguro de cambiar el balance de horas a ${horas} hrs?`)) return;
        
        try {
            await updateDoc(doc(db, 'pacientes', pacienteSeleccionado.id), {
                'membresia.horasDisponibles': horas,
                updatedAt: new Date().toISOString()
            });
            alert('Horas ajustadas con éxito');
            setHorasAjuste('');
        } catch (err) {
            alert('Error al ajustar: ' + err.message);
        }
    };

    const getNivelIcon = (nivel) => {
        switch(nivel) {
            case 'Platinum': return <Crown size={24} className="text-white" />;
            case 'Oro': return <Award size={24} className="text-white" />;
            case 'Plata': return <Shield size={24} className="text-gray-800" />;
            default: return <Star size={24} className="text-white" />;
        }
    };

    const getNivelBg = (nivel) => {
        switch(nivel) {
            case 'Platinum': return 'from-gray-700 to-black text-white';
            case 'Oro': return 'from-yellow-400 to-amber-600 text-white';
            case 'Plata': return 'from-gray-100 to-gray-300 text-gray-800';
            default: return 'from-orange-400 to-orange-600 text-white';
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-acero">Gestión de Membresías</h1>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Control de horas de Spa y Niveles</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Panel de Búsqueda */}
                <div className="md:col-span-1 space-y-4">
                    <Card className="p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Nombre, Teléfono o Código..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-turquesa focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div className="mt-4 space-y-2 max-h-[500px] overflow-y-auto">
                            {loading ? (
                                <p className="text-center text-xs text-gray-400">Cargando pacientes...</p>
                            ) : pacientesFiltrados.length === 0 ? (
                                <p className="text-center text-xs text-gray-400">No se encontraron pacientes</p>
                            ) : (
                                pacientesFiltrados.map(p => (
                                    <div
                                        key={p.id}
                                        className={`p-3 rounded-xl cursor-pointer transition-all ${pacienteSeleccionado?.id === p.id ? 'bg-turquesa/10 border-turquesa' : 'hover:bg-gray-50 border-transparent'} border`}
                                        onClick={() => setPacienteSeleccionado(p)}
                                    >
                                        <p className="text-xs font-bold text-acero">{p.nombre}</p>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="text-[10px] text-gray-400">{p.telefono || 'Sin tel'}</p>
                                            {p.membresia?.activa && (
                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                                    p.membresia.nivel === 'Platinum' ? 'bg-black text-white' :
                                                    p.membresia.nivel === 'Oro' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {p.membresia.nivel}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    {/* Gestión Global de Beneficios */}
                    <Card className="p-4 mt-4">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-black text-acero uppercase">Beneficios Globales por Nivel</h3>
                        </div>
                        <div className="space-y-3">
                            {['Bronce', 'Plata', 'Oro', 'Platinum'].map(nivel => (
                                <div key={nivel} className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">{nivel}</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Agregar beneficio..."
                                            value={nuevoBeneficio[nivel] || ''}
                                            onChange={(e) => setNuevoBeneficio({ ...nuevoBeneficio, [nivel]: e.target.value })}
                                            className="flex-1 text-xs p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-turquesa outline-none"
                                        />
                                        <button
                                            className="bg-turquesa text-white p-2 rounded-lg hover:bg-opacity-90"
                                            onClick={async () => {
                                                const text = nuevoBeneficio[nivel];
                                                if (!text) return;
                                                const currentList = beneficios[nivel] || [];
                                                const newList = [...currentList, text];
                                                const newBeneficios = { ...beneficios, [nivel]: newList };
                                                
                                                setBeneficios(newBeneficios);
                                                setNuevoBeneficio({ ...nuevoBeneficio, [nivel]: '' });
                                                
                                                localStorage.setItem('beneficios_membresia', JSON.stringify(newBeneficios));
                                                try {
                                                    await setDoc(doc(db, 'configuracion', 'beneficios_membresia'), { beneficios: newBeneficios });
                                                } catch (err) {
                                                    console.error("Error saving benefits:", err);
                                                }
                                            }}
                                        >
                                            <PlusCircle size={14} />
                                        </button>
                                    </div>
                                    <div className="space-y-1 max-h-[100px] overflow-y-auto">
                                        {(beneficios[nivel] || []).map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-1.5 bg-gray-50 rounded-lg text-[10px]">
                                                <span className="text-gray-700 flex-1">{item}</span>
                                                <button
                                                    className="text-red-500 hover:text-red-700 ml-2"
                                                    onClick={async () => {
                                                        const newList = (beneficios[nivel] || []).filter((_, i) => i !== idx);
                                                        const newBeneficios = { ...beneficios, [nivel]: newList };
                                                        
                                                        setBeneficios(newBeneficios);
                                                        
                                                        localStorage.setItem('beneficios_membresia', JSON.stringify(newBeneficios));
                                                        try {
                                                            await setDoc(doc(db, 'configuracion', 'beneficios_membresia'), { beneficios: newBeneficios });
                                                        } catch (err) {
                                                            console.error("Error saving benefits:", err);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Detalle de Membresía y Reportes */}
                <div className="md:col-span-2 space-y-6">
                    {/* ── RECUADRO SUPERIOR DERECHA: Reporte de Pacientes con Membresía ── */}
                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-black text-acero uppercase">Reporte de Membresías Activas</h3>
                            <div className="text-xs text-gray-400 font-bold">
                                Total Activas: {pacientes.filter(p => p.membresia?.activa).length}
                            </div>
                        </div>
                        <div className="overflow-x-auto max-h-[200px]">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                                    <tr>
                                        <th className="p-2">Paciente</th>
                                        <th className="p-2">Servicio</th>
                                        <th className="p-2">Horas</th>
                                        <th className="p-2">Fecha</th>
                                        <th className="p-2">Recibo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {consumos.map(c => (
                                        <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                                            <td className="p-2 font-bold text-acero">{c.pacienteNombre}</td>
                                            <td className="p-2 text-gray-700">{c.servicioNombre}</td>
                                            <td className="p-2 font-black text-turquesa">{c.horasConsumidas} hrs</td>
                                            <td className="p-2 text-gray-500">
                                                {new Date(c.fecha).toLocaleDateString('es-MX', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="p-2">
                                                {c.reciboId ? (
                                                    <Button
                                                        variant="outline"
                                                        className="text-[10px] py-0.5 px-1.5"
                                                        onClick={async () => {
                                                            try {
                                                                const docSnap = await getDoc(doc(db, 'recibos', c.reciboId));
                                                                if (docSnap.exists()) {
                                                                    setReciboActual({ id: docSnap.id, ...docSnap.data() });
                                                                    setIsReciboOpen(true);
                                                                } else {
                                                                    alert('Recibo no encontrado');
                                                                }
                                                            } catch (err) {
                                                                alert('Error al cargar recibo: ' + err.message);
                                                            }
                                                        }}
                                                    >
                                                        Ver
                                                    </Button>
                                                ) : (
                                                    <span className="text-gray-400 text-[10px]">Sin recibo</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {consumos.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="p-4 text-center text-gray-400">No hay consumos registrados.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* ── SECCIÓN INFERIOR: Catálogo y Registro / Detalle ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* RECUADRO INFERIOR IZQUIERDA (MEDIO): Catálogo de Servicios */}
                        <Card className="p-4">
                            <h3 className="text-sm font-black text-acero uppercase mb-3">Catálogo de Servicios</h3>
                            {/* Formulario para agregar */}
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    placeholder="Servicio (Ej: Masaje)"
                                    value={nuevoServicio.nombre}
                                    onChange={(e) => setNuevoServicio({ ...nuevoServicio, nombre: e.target.value })}
                                    className="flex-1 text-xs p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-turquesa outline-none"
                                />
                                <input
                                    type="number"
                                    placeholder="Hrs"
                                    value={nuevoServicio.horas}
                                    onChange={(e) => setNuevoServicio({ ...nuevoServicio, horas: e.target.value })}
                                    className="w-16 text-xs p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-turquesa outline-none"
                                />
                                <Button
                                    variant="primary"
                                    className="p-2"
                                    onClick={async () => {
                                        if (!nuevoServicio.nombre || !nuevoServicio.horas) return;
                                        const horas = parseFloat(nuevoServicio.horas);
                                        if (horas <= 0) return;
                                        
                                        const servicio = {
                                            id: 'serv-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
                                            nombre: nuevoServicio.nombre,
                                            horas
                                        };
                                        
                                        const nuevoCatalogo = [...catalogoServicios, servicio];
                                        try {
                                            await setDoc(doc(db, 'config', 'membresias'), { catalogoServicios: nuevoCatalogo }, { merge: true });
                                            setCatalogoServicios(nuevoCatalogo);
                                            setNuevoServicio({ nombre: '', horas: '' });
                                            alert('Servicio agregado');
                                        } catch (err) {
                                            alert('Error: ' + err.message);
                                        }
                                    }}
                                >
                                    <PlusCircle size={16} />
                                </Button>
                            </div>
                            {/* Lista de servicios */}
                            <div className="space-y-2 max-h-[150px] overflow-y-auto">
                                {catalogoServicios.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center">No hay servicios registrados.</p>
                                ) : (
                                    catalogoServicios.map((s, index) => (
                                        <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                                            <div>
                                                <span className="text-xs font-bold text-acero">{s.nombre}</span>
                                                <span className="text-xs font-black text-turquesa ml-2">{s.horas} hrs</span>
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="text-[10px] py-0.5 px-1.5 border-red-500 text-red-500 hover:bg-red-50"
                                                onClick={async () => {
                                                    if (!window.confirm(`¿Estás seguro de eliminar el servicio "${s.nombre}"?`)) return;
                                                    const nuevoCatalogo = catalogoServicios.filter((_, i) => i !== index);
                                                    try {
                                                        await setDoc(doc(db, 'config', 'membresias'), { catalogoServicios: nuevoCatalogo }, { merge: true });
                                                        setCatalogoServicios(nuevoCatalogo);
                                                        alert('Servicio eliminado');
                                                    } catch (err) {
                                                        alert('Error: ' + err.message);
                                                    }
                                                }}
                                            >
                                                <Trash2 size={12} />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        {/* RECUADRO INFERIOR DERECHA: Detalle / Registro de Consumo */}
                        {pacienteSeleccionado ? (
                            <Card className="p-4 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-sm font-black text-acero">{pacienteSeleccionado.nombre}</h2>
                                        <p className="text-[10px] text-gray-400">{pacienteSeleccionado.membresia?.activa ? `Membresía ${pacienteSeleccionado.membresia.nivel}` : 'Sin membresía'}</p>
                                    </div>
                                    {pacienteSeleccionado.membresia?.activa ? (
                                        <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">Activa</span>
                                    ) : (
                                        <span className="bg-gray-100 text-gray-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">Inactiva</span>
                                    )}
                                </div>

                                {pacienteSeleccionado.membresia?.activa ? (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-gray-500">Horas Disponibles:</span>
                                            <span className="font-black text-turquesa text-sm">{pacienteSeleccionado.membresia.horasDisponibles || 0} hrs</span>
                                        </div>
                                        
                                        {/* Registrar Consumo */}
                                        <div className="border-t pt-2" style={{borderColor: 'rgba(0,0,0,0.05)'}}>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Registrar Consumo</label>
                                            <div className="flex gap-2">
                                                <select
                                                    value={servicioSeleccionado}
                                                    onChange={(e) => setServicioSeleccionado(e.target.value)}
                                                    className="flex-1 text-xs p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-turquesa outline-none bg-white"
                                                >
                                                    <option value="">Seleccionar servicio...</option>
                                                    {catalogoServicios.map((s, index) => (
                                                        <option key={index} value={s.id}>{s.nombre} ({s.horas} hrs)</option>
                                                    ))}
                                                </select>
                                                <Button
                                                    variant="primary"
                                                    className="text-xs"
                                                    onClick={async () => {
                                                        if (!servicioSeleccionado) {
                                                            alert('Por favor selecciona un servicio');
                                                            return;
                                                        }
                                                        const servicio = catalogoServicios.find(s => s.id === servicioSeleccionado);
                                                        if (!servicio) return;
                                                                               try {
                                                            // 1. Generar recibo primero
                                                            const recibo = await createRecibo({
                                                                pacienteId: pacienteSeleccionado.id,
                                                                pacienteNombre: pacienteSeleccionado.nombre,
                                                                concepto: `Consumiste ${servicio.horas} horas de tu membresía nivel ${pacienteSeleccionado.membresia?.nivel || 'Bronce'} en ${servicio.nombre}`,
                                                                monto: 0,
                                                                horasConsumidas: servicio.horas,
                                                                metodoPago: 'Membresía',
                                                                telefono: pacienteSeleccionado.telefono || ''
                                                            });
                                                            
                                                            // 2. Consumir horas pasando el ID del recibo
                                                            await consumirHorasMembresia(pacienteSeleccionado.id, servicio.horas, servicio, recibo.id);
                                                            
                                                            setReciboActual(recibo);
                                                            setIsReciboOpen(true);
                                                            alert('Consumo registrado y recibo generado');
                                                            setServicioSeleccionado('');
                                                        } catch (err) {
                                                            alert('Error: ' + err.message);
                                                        }
                                                    }}
                                                >
                                                    Consumir
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Recargar Horas */}
                                        <div className="border-t pt-2" style={{borderColor: 'rgba(0,0,0,0.05)'}}>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Recargar Horas</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    placeholder="Ej. 10"
                                                    value={horasRecarga}
                                                    onChange={(e) => setHorasRecarga(e.target.value)}
                                                    className="flex-1 text-xs p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-turquesa outline-none"
                                                />
                                                <Button variant="outline" className="text-xs" onClick={handleRecargar}>Recargar</Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 space-y-2">
                                        <p className="text-xs text-gray-400">Activa una membresía para este paciente</p>
                                        <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                                            <Button variant="outline" className="text-[10px] py-1 px-2" onClick={() => handleActivar(pacienteSeleccionado.id, 'Bronce')}>Bronce</Button>
                                            <Button variant="outline" className="text-[10px] py-1 px-2" onClick={() => handleActivar(pacienteSeleccionado.id, 'Plata')}>Plata</Button>
                                            <Button variant="outline" className="text-[10px] py-1 px-2" onClick={() => handleActivar(pacienteSeleccionado.id, 'Oro')}>Oro</Button>
                                            <Button variant="primary" className="text-[10px] py-1 px-2" onClick={() => handleActivar(pacienteSeleccionado.id, 'Platinum')}>Platinum</Button>
                                        </div>
                                    </div>
                                )}

                                {/* Ajustar Horas (Visible siempre que haya paciente seleccionado y tenga membresia) */}
                                {pacienteSeleccionado.membresia && (
                                    <div className="border-t pt-2 mt-2" style={{borderColor: 'rgba(0,0,0,0.05)'}}>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Ajustar Horas (Admin)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                placeholder="Nuevo total"
                                                value={horasAjuste}
                                                onChange={(e) => setHorasAjuste(e.target.value)}
                                                className="flex-1 text-xs p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-turquesa outline-none"
                                            />
                                            <Button variant="outline" className="text-xs border-amber-500 text-amber-500" onClick={handleAjustar}>Guardar</Button>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        ) : (
                            <Card className="p-4 flex flex-col items-center justify-center text-center h-full min-h-[150px]">
                                <CreditCard size={32} className="text-gray-300 mb-2" />
                                <p className="text-xs font-bold text-acero">Selecciona un paciente</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Para ver detalles o registrar consumos.</p>
                            </Card>
                        )}
                    </div>

                    {/* Credencial del Paciente */}
                    {pacienteSeleccionado && pacienteSeleccionado.membresia && (
                        <Card className="p-4 mt-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-black text-acero uppercase">Vista Previa de Credencial</h3>
                                <Button
                                    variant={pacienteSeleccionado.membresia.activa ? "outline" : "primary"}
                                    className="text-xs"
                                    onClick={async () => {
                                        const newState = !pacienteSeleccionado.membresia.activa;
                                        try {
                                            await updateDoc(doc(db, 'pacientes', pacienteSeleccionado.id), {
                                                'membresia.activa': newState
                                            });
                                            setPacienteSeleccionado(prev => ({
                                                ...prev,
                                                membresia: { ...prev.membresia, activa: newState }
                                            }));
                                            alert(newState ? 'Membresía activada' : 'Membresía desactivada');
                                        } catch (err) {
                                            alert('Error: ' + err.message);
                                        }
                                    }}
                                >
                                    {pacienteSeleccionado.membresia.activa ? 'Desactivar Membresía' : 'Activar Membresía'}
                                </Button>
                            </div>

                            {/* Credencial (Frente) */}
                            <div className="w-full max-w-[400px] mx-auto bg-white border-2 rounded-2xl overflow-hidden shadow-sm relative flex" style={{
                                height: '220px',
                                borderColor: pacienteSeleccionado.membresia.nivel === 'Platinum' ? '#1f2937' :
                                             pacienteSeleccionado.membresia.nivel === 'Oro' ? '#fbbf24' :
                                             pacienteSeleccionado.membresia.nivel === 'Plata' ? '#9ca3af' :
                                             '#f97316'
                            }}>
                                {/* Fondo con corte diagonal */}
                                <div className="absolute inset-0"
                                     style={{
                                         background: `linear-gradient(105deg, transparent 55%, ${
                                             pacienteSeleccionado.membresia.nivel === 'Platinum' ? 'rgba(0,0,0,0.05)' :
                                             pacienteSeleccionado.membresia.nivel === 'Oro' ? 'rgba(251,191,36,0.05)' :
                                             pacienteSeleccionado.membresia.nivel === 'Plata' ? 'rgba(156,163,175,0.05)' :
                                             'rgba(249,115,22,0.05)'
                                         } 55%)`
                                     }}></div>

                                {/* COLUMNA IZQUIERDA */}
                                <div className="flex flex-col items-center justify-center px-3 gap-2" style={{width: '32%', borderRight: '1px solid rgba(0,0,0,0.05)'}}>
                                    <div className="relative">
                                        <div className="absolute -inset-[2.5px] rounded-2xl"
                                             style={{
                                                 background: pacienteSeleccionado.membresia.nivel === 'Platinum' ? 'linear-gradient(135deg, #000, #4b5563)' :
                                                             pacienteSeleccionado.membresia.nivel === 'Oro' ? 'linear-gradient(135deg, #fbbf24, #d97706)' :
                                                             pacienteSeleccionado.membresia.nivel === 'Plata' ? 'linear-gradient(135deg, #9ca3af, #4b5563)' :
                                                             'linear-gradient(135deg, #f97316, #c2410c)'
                                             }}></div>
                                        {pacienteSeleccionado.fotoUrl ? (
                                            <img src={pacienteSeleccionado.fotoUrl} alt={pacienteSeleccionado.nombre} className="relative object-cover border-2 border-white shadow-lg rounded-2xl" style={{width: '60px', height: '75px'}} />
                                        ) : (
                                            <div className="relative border-2 border-white shadow-lg rounded-2xl flex items-center justify-center text-white font-black" style={{width: '60px', height: '75px', background: 'linear-gradient(160deg, #1f2937, #111827)', fontSize: '1.5rem'}}>
                                                {(pacienteSeleccionado.nombre || 'P').charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-center w-full">
                                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">Paciente</p>
                                        <p className="text-[10px] font-black text-gray-800 leading-tight mt-0.5" style={{wordBreak: 'break-word'}}>{pacienteSeleccionado.nombre || 'Paciente ALFRA'}</p>
                                    </div>
                                </div>

                                {/* COLUMNA DERECHA */}
                                <div className="flex flex-col flex-1 justify-between p-4" style={{position: 'relative'}}>
                                    <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-white text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1 ${
                                        pacienteSeleccionado.membresia.nivel === 'Platinum' ? 'bg-gradient-to-r from-gray-800 to-black' :
                                        pacienteSeleccionado.membresia.nivel === 'Oro' ? 'bg-gradient-to-r from-yellow-400 to-amber-600' :
                                        pacienteSeleccionado.membresia.nivel === 'Plata' ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
                                        'bg-gradient-to-r from-orange-400 to-orange-600'
                                    }`}>
                                        <CreditCard size={10}/> {pacienteSeleccionado.membresia.codigo || 'MEM-0000'}
                                    </div>

                                    <div style={{width: '100%', height: '50px', overflow: 'hidden'}}>
                                        <img src="/logo.png" alt="ALFRA" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                            <Crown size={12} className={pacienteSeleccionado.membresia.nivel === 'Platinum' ? 'text-gray-800' : pacienteSeleccionado.membresia.nivel === 'Oro' ? 'text-amber-500' : 'text-turquesa'}/>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-800">Membresía {pacienteSeleccionado.membresia.nivel}</span>
                                        </div>
                                        <p className="text-[10px] leading-snug font-semibold text-gray-700">
                                            {pacienteSeleccionado.membresia.nivel === 'Platinum' ? '¡Paciente VIP! 🌟' : '¡Sigue consintiéndote en ALFRA! 🌸'}
                                        </p>
                                    </div>

                                    <div className="border-t pt-1.5 flex justify-between items-center" style={{borderColor: 'rgba(0,0,0,0.05)'}}>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Horas</span>
                                            <div className={`text-xl font-black ${pacienteSeleccionado.membresia.nivel === 'Platinum' ? 'text-black' : pacienteSeleccionado.membresia.nivel === 'Oro' ? 'text-amber-600' : 'text-turquesa'}`}>
                                                {pacienteSeleccionado.membresia.horasDisponibles || 0} <span className="text-sm text-gray-400">hrs</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Historial de Consumos del Paciente */}
                            <div className="mt-6 border-t pt-4" style={{borderColor: 'rgba(0,0,0,0.05)'}}>
                                <h4 className="text-xs font-black text-acero uppercase mb-3">Historial de Consumos</h4>
                                {consumosPaciente.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center">No hay consumos registrados para este paciente.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase text-[9px] tracking-widest">
                                                    <th className="p-2">Servicio</th>
                                                    <th className="p-2">Horas</th>
                                                    <th className="p-2">Fecha</th>
                                                    <th className="p-2">Recibo</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {consumosPaciente.map((c, index) => (
                                                    <tr key={index} className="border-b border-gray-50 last:border-0">
                                                        <td className="p-2 font-bold text-gray-800">{c.servicioNombre}</td>
                                                        <td className="p-2 text-turquesa font-black">{c.horasConsumidas} hrs</td>
                                                        <td className="p-2 text-gray-500 font-medium">
                                                            {new Date(c.fecha).toLocaleDateString('es-MX', {
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                hour12: true
                                                            })}
                                                        </td>
                                                        <td className="p-2 flex gap-1">
                                                            {c.reciboId ? (
                                                                <Button
                                                                    variant="outline"
                                                                    className="text-[10px] py-0.5 px-1.5"
                                                                    onClick={async () => {
                                                                        try {
                                                                            const docSnap = await getDoc(doc(db, 'recibos', c.reciboId));
                                                                            if (docSnap.exists()) {
                                                                                setReciboActual({ id: docSnap.id, ...docSnap.data() });
                                                                                setIsReciboOpen(true);
                                                                            } else {
                                                                                alert('Recibo no encontrado');
                                                                            }
                                                                        } catch (err) {
                                                                            alert('Error al cargar recibo: ' + err.message);
                                                                        }
                                                                    }}
                                                                >
                                                                    Ver
                                                                </Button>
                                                            ) : (
                                                                <span className="text-gray-400 text-[10px]">Sin recibo</span>
                                                            )}
                                                            <Button
                                                                variant="outline"
                                                                className="text-[10px] py-0.5 px-1.5 border-red-500 text-red-500 hover:bg-red-50"
                                                                onClick={async () => {
                                                                    if (!window.confirm('¿Estás seguro de eliminar este consumo? Se devolverán las horas al paciente.')) return;
                                                                    try {
                                                                        // 1. Devolver horas
                                                                        await updateDoc(doc(db, 'pacientes', pacienteSeleccionado.id), {
                                                                            'membresia.horasDisponibles': (pacienteSeleccionado.membresia.horasDisponibles || 0) + c.horasConsumidas
                                                                        });
                                                                        
                                                                        // 2. Eliminar consumo
                                                                        await deleteDoc(doc(db, 'consumos_membresia', c.id));
                                                                        
                                                                        // 3. Eliminar recibo si existe
                                                                        if (c.reciboId) {
                                                                            await deleteDoc(doc(db, 'recibos', c.reciboId));
                                                                        }
                                                                        
                                                                        alert('Consumo eliminado y horas devueltas');
                                                                    } catch (err) {
                                                                        alert('Error al eliminar: ' + err.message);
                                                                    }
                                                                }}
                                                            >
                                                                Eliminar
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Historial de Recargas del Paciente */}
                            <div className="mt-6 border-t pt-4" style={{borderColor: 'rgba(0,0,0,0.05)'}}>
                                <h4 className="text-xs font-black text-acero uppercase mb-3">Historial de Recargas</h4>
                                {recargasPaciente.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center">No hay recargas registradas para este paciente.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase text-[9px] tracking-widest">
                                                    <th className="p-2">Horas</th>
                                                    <th className="p-2">Fecha</th>
                                                    <th className="p-2">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recargasPaciente.map((r, index) => (
                                                    <tr key={index} className="border-b border-gray-50 last:border-0">
                                                        <td className="p-2 text-turquesa font-black">+{r.horasRecargadas} hrs</td>
                                                        <td className="p-2 text-gray-500 font-medium">
                                                            {new Date(r.fecha).toLocaleDateString('es-MX', {
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                hour12: true
                                                            })}
                                                        </td>
                                                        <td className="p-2">
                                                            <Button
                                                                variant="outline"
                                                                className="text-[10px] py-0.5 px-1.5 border-red-500 text-red-500 hover:bg-red-50"
                                                                onClick={async () => {
                                                                    if (!window.confirm('¿Estás seguro de eliminar esta recarga? Se restarán las horas al paciente.')) return;
                                                                    try {
                                                                        // 1. Restar horas
                                                                        const horasActuales = pacienteSeleccionado.membresia.horasDisponibles || 0;
                                                                        if (horasActuales < r.horasRecargadas) {
                                                                            if (!window.confirm('El paciente no tiene suficientes horas para restar (el balance quedará negativo). ¿Continuar?')) return;
                                                                        }
                                                                        
                                                                        await updateDoc(doc(db, 'pacientes', pacienteSeleccionado.id), {
                                                                            'membresia.horasDisponibles': horasActuales - r.horasRecargadas
                                                                        });
                                                                        
                                                                        // 2. Eliminar recarga
                                                                        await deleteDoc(doc(db, 'recargas_membresia', r.id));
                                                                        
                                                                        alert('Recarga eliminada y horas restadas');
                                                                    } catch (err) {
                                                                        alert('Error al eliminar: ' + err.message);
                                                                    }
                                                                }}
                                                            >
                                                                Eliminar
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}
                </div>
                </div>
                <ReciboDigital isOpen={isReciboOpen} onClose={() => setIsReciboOpen(false)} datosRecibo={reciboActual} />
            </div>
    );
}
