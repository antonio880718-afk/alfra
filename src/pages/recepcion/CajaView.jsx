import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DollarSign, Search, PlusCircle, CreditCard, Banknote, Bell, Gift, CheckCircle, Loader } from 'lucide-react';
import ReciboDigital from '../../components/ui/ReciboDigital';
import { registrarMovimiento, getFlujoCaja } from '../../services/finanzasService';
import { createRecibo } from '../../services/recibosService';
import { getPacientes } from '../../services/pacientesService';

export default function CajaView() {
    const [monto, setMonto] = useState('');
    const [motivo, setMotivo] = useState('');
    const [pacienteNombre, setPacienteNombre] = useState('');
    const [pacienteId, setPacienteId] = useState(null);
    const [pacienteTelefono, setPacienteTelefono] = useState('');
    const [paqueteInfo, setPaqueteInfo] = useState('');
    const [saving, setSaving] = useState(false);

    // Búsqueda de pacientes
    const [busquedaPaciente, setBusquedaPaciente] = useState('');
    const [pacientesLista, setPacientesLista] = useState([]);
    const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

    // Abono
    const [pacienteAbono, setPacienteAbono] = useState('');
    const [montoAbono, setMontoAbono] = useState('');
    const [savingAbono, setSavingAbono] = useState(false);

    // Movimientos de hoy
    const [movimientosHoy, setMovimientosHoy] = useState([]);
    const [totalHoy, setTotalHoy] = useState(0);

    // Estado para el Recibo
    const [isReciboOpen, setIsReciboOpen] = useState(false);
    const [datosReciboActual, setDatosReciboActual] = useState(null);

    // Alertas cumpleaños (desde Firestore)
    const [cumpleanosPacientes, setCumpleanosPacientes] = useState([]);

    useEffect(() => {
        // Cargar lista de pacientes para búsqueda
        getPacientes().then(setPacientesLista).catch(console.error);

        // Cargar movimientos de hoy
        cargarMovimientosHoy();
    }, []);

    const cargarMovimientosHoy = async () => {
        try {
            const flujo = await getFlujoCaja();
            const hoy = new Date().toDateString();
            const hoyMovs = flujo.historial.filter(m => new Date(m.createdAt).toDateString() === hoy);
            setMovimientosHoy(hoyMovs);
            setTotalHoy(hoyMovs.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + Number(m.monto), 0));

            // Cumpleaños — pacientes cuyo mes y día coinciden con hoy
            const today = new Date();
            const cumples = flujo.historial; // placeholder — se obtendría de getPacientes
        } catch (err) {
            console.error(err);
        }
    };

    const pacientesFiltrados = pacientesLista.filter(p =>
        p.nombre?.toLowerCase().includes(busquedaPaciente.toLowerCase())
    ).slice(0, 6);

    const seleccionarPaciente = (p) => {
        setPacienteNombre(p.nombre);
        setPacienteId(p.id);
        setPacienteTelefono(p.telefono || p.phone || '');
        setBusquedaPaciente(p.nombre);
        setMostrarSugerencias(false);
    };

    const handleCobrar = async (metodo) => {
        if (!monto || !motivo || !pacienteNombre) {
            alert('Por favor llena los datos: Paciente, Monto y Motivo.');
            return;
        }
        setSaving(true);
        try {
            // 1. Registrar ingreso en finanzas
            await registrarMovimiento({
                tipo: 'Ingreso',
                monto: parseFloat(monto),
                motivo: motivo,
                metodoPago: metodo,
                pacienteId: pacienteId || null,
                pacienteNombre: pacienteNombre,
                fecha: new Date().toISOString(),
            });

            // 2. Generar recibo en Firestore
            const recibo = await createRecibo({
                pacienteId: pacienteId || null,
                pacienteNombre,
                concepto: motivo,
                monto: parseFloat(monto),
                metodoPago: metodo,
                paqueteInfo: paqueteInfo || null,
                telefono: pacienteTelefono || '',
            });

            // 3. Mostrar recibo en pantalla
            setDatosReciboActual({
                ...recibo,
                fecha: recibo.fechaLegible,
            });
            setIsReciboOpen(true);

            // 4. Limpiar y recargar
            setMonto('');
            setMotivo('');
            setPacienteNombre('');
            setPacienteId(null);
            setPacienteTelefono('');
            setPaqueteInfo('');
            setBusquedaPaciente('');
            await cargarMovimientosHoy();
        } catch (err) {
            console.error(err);
            alert('Error al registrar el pago. Revisa tu conexión.');
        } finally {
            setSaving(false);
        }
    };

    const handleRegistrarAbono = async () => {
        if (!pacienteAbono || !montoAbono) {
            alert('Indica el nombre del paciente y el monto del abono.');
            return;
        }
        setSavingAbono(true);
        try {
            await registrarMovimiento({
                tipo: 'Ingreso',
                subTipo: 'abono_tratamiento',
                monto: parseFloat(montoAbono),
                motivo: `Abono a Plan de Tratamiento — ${pacienteAbono}`,
                pacienteNombre: pacienteAbono,
                fecha: new Date().toISOString(),
            });
            alert(`✅ Abono de $${parseFloat(montoAbono).toLocaleString('es-MX')} registrado correctamente para ${pacienteAbono}.`);
            setPacienteAbono('');
            setMontoAbono('');
            await cargarMovimientosHoy();
        } catch (err) {
            console.error(err);
            alert('Error al registrar el abono.');
        } finally {
            setSavingAbono(false);
        }
    };

    return (
        <div className="space-y-6 relative pb-20">
            <ReciboDigital
                isOpen={isReciboOpen}
                onClose={() => setIsReciboOpen(false)}
                datosRecibo={datosReciboActual}
            />

            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-acero">Caja / Recepción</h2>
                    <p className="text-gray-500 text-sm">Todos los movimientos se guardan en Firebase en tiempo real</p>
                </div>
                <div className="bg-turquesa/10 text-turquesa font-bold px-4 py-2 rounded-xl text-lg">
                    Hoy: ${totalHoy.toLocaleString('es-MX')}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cobro de Servicio */}
                <Card title="Registrar Pago de Servicio o Consulta" className="border-t-4 border-t-turquesa shadow-sm">
                    <div className="space-y-4">
                        {/* Buscar Paciente con autocompletado */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Paciente</label>
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar paciente registrado..."
                                    value={busquedaPaciente}
                                    onChange={(e) => {
                                        setBusquedaPaciente(e.target.value);
                                        setPacienteNombre(e.target.value);
                                        setMostrarSugerencias(e.target.value.length > 1);
                                    }}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-1 focus:ring-turquesa outline-none"
                                />
                                {mostrarSugerencias && pacientesFiltrados.length > 0 && (
                                    <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-20 mt-1">
                                        {pacientesFiltrados.map(p => (
                                            <div
                                                key={p.id}
                                                className="px-4 py-3 hover:bg-turquesa/5 cursor-pointer flex justify-between items-center"
                                                onClick={() => seleccionarPaciente(p)}
                                            >
                                                <span className="font-medium text-gray-800">{p.nombre}</span>
                                                <span className="text-xs text-gray-400">{p.telefono || p.phone || ''}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <Input
                            label="Servicio / Producto / Motivo"
                            placeholder="Ej. Botox Completo"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                        />

                        <Input
                            label="Información de Paquete (Opcional)"
                            placeholder="Ej. Sesión 2 de 5 - Depilación Láser"
                            value={paqueteInfo}
                            onChange={(e) => setPaqueteInfo(e.target.value)}
                        />

                        <Input
                            label="Monto a cobrar ($)"
                            type="number"
                            placeholder="0.00"
                            icon={DollarSign}
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                        />

                        <div className="flex gap-3 pt-4">
                            <Button variant="primary" fullWidth icon={saving ? Loader : CreditCard} onClick={() => handleCobrar('Tarjeta Débito/Crédito')} disabled={saving}>
                                {saving ? 'Guardando...' : 'Cobrar Tarjeta'}
                            </Button>
                            <Button variant="outline" fullWidth icon={Banknote} onClick={() => handleCobrar('Efectivo')} disabled={saving}>
                                {saving ? '...' : 'Cobrar Efectivo'}
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Abono a Planes de Tratamiento */}
                <Card title="Abonar a Planes de Tratamiento" className="border-t-4 border-t-acero bg-acero/5 shadow-sm">
                    <div className="space-y-4">
                        <div className="p-4 bg-white rounded-xl border border-acero/20 mb-4">
                            <p className="text-xs text-acero uppercase font-bold tracking-wider mb-1">Impacto Automático</p>
                            <p className="text-sm text-gray-600">Al registrar este abono, se sumará al progreso personal del paciente y se registrará un ingreso para el Administrador.</p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Paciente con Plan de Tratamiento</label>
                            <div className="relative">
                                <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Nombre del paciente..."
                                    value={pacienteAbono}
                                    onChange={(e) => setPacienteAbono(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:border-acero focus:ring-1 focus:ring-acero outline-none"
                                />
                            </div>
                        </div>

                        <Input
                            label="Monto del Abono ($)"
                            type="number"
                            placeholder="0.00"
                            icon={DollarSign}
                            value={montoAbono}
                            onChange={(e) => setMontoAbono(e.target.value)}
                        />

                        <Button
                            variant="secondary"
                            className="mt-4"
                            fullWidth
                            icon={savingAbono ? Loader : PlusCircle}
                            onClick={handleRegistrarAbono}
                            disabled={savingAbono}
                        >
                            {savingAbono ? 'Guardando...' : 'Registrar Abono Seguro'}
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Panel Inferior */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card title={`Movimientos de Hoy (${movimientosHoy.length})`}>
                        {movimientosHoy.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">No hay movimientos registrados hoy.</div>
                        ) : (
                            <div className="space-y-3 max-h-72 overflow-y-auto">
                                {movimientosHoy.map((m, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${m.tipo === 'Ingreso' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                                                <CheckCircle size={16} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800">{m.motivo || m.concepto}</p>
                                                <p className="text-xs text-gray-400">{m.metodoPago || m.tipo} • {m.pacienteNombre || ''}</p>
                                            </div>
                                        </div>
                                        <span className={`font-bold text-base ${m.tipo === 'Ingreso' ? 'text-green-600' : 'text-red-500'}`}>
                                            {m.tipo === 'Ingreso' ? '+' : '-'}${Number(m.monto).toLocaleString('es-MX')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                <div>
                    <Card title="Alertas de Recepción" className="h-full border-turquesa/20">
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-2">
                                <Bell className="text-turquesa" size={16} /> Próximos Cumpleaños
                            </h4>
                            {cumpleanosPacientes.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-4">Sin cumpleaños esta semana.</p>
                            ) : cumpleanosPacientes.map((c, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-turquesa/10 p-2 rounded-lg text-turquesa"><Gift size={16} /></div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{c.nombre}</p>
                                            <p className="text-xs text-gray-500">{c.telefono}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-turquesa text-white animate-pulse">{c.fechaTexto}</span>
                                </div>
                            ))}
                            <p className="text-xs text-turquesa font-medium mt-2 text-center">Aplica el <span className="font-bold">20% de descuento</span> en su próxima visita.</p>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
