import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import ReciboNomina from '../../components/ui/ReciboNomina';
import { Users as UsersIcon, PlusCircle, Settings, ToggleRight, ToggleLeft, CheckCircle, Trash2, KeyRound, DollarSign, Banknote, ArrowRightLeft, Receipt, ChevronDown, List, Pencil, Check, X, Award } from 'lucide-react';
import { onStaffChange, createEmpleado, updateEmpleado, deleteEmpleado, liquidarNomina, ajustarComisionManual, eliminarComisionHistorial, editarComisionHistorial } from '../../services/staffService';
import { registrarMovimiento } from '../../services/finanzasService';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';

export default function NominaView() {
    const { userRole } = useAuth();
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        nombre: '', email: '', puesto: 'Especialista', nivelCosmetologa: '1',
        sueldoBase: '', comisionServicios: '', comisionProductos: ''
    });
    const [credenciales, setCredenciales] = useState(null);
    const [copiado, setCopiado] = useState(false);
    const [exitoAlta, setExitoAlta] = useState(false);
    const [employeeToDelete, setEmployeeToDelete] = useState(null);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    // ── Liquidación de Nómina ─────────────────────────────────────────────
    const [empleadoLiquidar, setEmpleadoLiquidar] = useState(null);
    const [liquidandoId, setLiquidandoId] = useState(null);
    const [nominaForm, setNominaForm] = useState({
        periodo: '15 al 30 de Mayo',
        metodoPago: 'Transferencia',
        sueldoBase: '',
        bonoPuntualidad: '',
        bonoProductividad: ''
    });
    const [reciboNominaOpen, setReciboNominaOpen] = useState(false);
    const [datosReciboNomina, setDatosReciboNomina] = useState(null);
    // ── Ajuste Manual de Comisiones ──
    const [empleadoAjuste, setEmpleadoAjuste] = useState(null);
    const [formAjuste, setFormAjuste] = useState({ monto: '', motivo: '' });
    const [ajustando, setAjustando] = useState(false);

    // ── Detalle Historial ──
    const [empleadoDetalle, setEmpleadoDetalle] = useState(null);
    const [editandoComision, setEditandoComision] = useState({ idx: null, monto: '' });

    // ── Bonos ──
    const [empleadoBonos, setEmpleadoBonos] = useState(null);
    const [formBonos, setFormBonos] = useState({ puntualidad: 0, productividad: 0 });


    useEffect(() => {
        const unsub = onStaffChange((data) => {
            setStaff(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const formatCurrency = (amount) => {
        const val = Number(amount);
        if (isNaN(val)) return '$0.00';
        return `$${val.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    };

    const handleToggleComisiones = async (id, current) => {
        try {
            await updateEmpleado(id, { usaComisiones: !current });
        } catch (err) { console.error(err); }
    };

    const handleLiquidar = async (metodo) => {
        if (!empleadoLiquidar) return;
        setLiquidandoId(empleadoLiquidar.id);
        try {
            const pago = await liquidarNomina(empleadoLiquidar.id, {
                periodo: nominaForm.periodo,
                metodoPago: metodo,
                sueldoBase: Number(nominaForm.sueldoBase) || 0,
                bonoPuntualidad: empleadoLiquidar.usaBonos ? (Number(nominaForm.bonoPuntualidad) || 0) : 0,
                bonoProductividad: empleadoLiquidar.usaBonos ? (Number(nominaForm.bonoProductividad) || 0) : 0
            });

            // Registrar el egreso en finanzas (con folio para poder revertir)
            await registrarMovimiento({
                tipo: 'Egreso',
                monto: pago.totalNeto,
                motivo: `Nómina ${pago.empleadoNombre} — ${pago.periodo}`,
                categoria: 'Nómina',
                metodoPago: metodo,
                staffId: empleadoLiquidar.id,
                staffNombre: pago.empleadoNombre,
                folioNomina: pago.folio,
                fecha: new Date().toISOString(),
            });

            // Mostrar recibo
            setDatosReciboNomina(pago);
            setReciboNominaOpen(true);
            setEmpleadoLiquidar(null);
        } catch (err) {
            alert('Error al liquidar nómina: ' + (err.message || 'Intenta de nuevo.'));
            console.error(err);
        } finally {
            setLiquidandoId(null);
        }
    };

    const handleAjustar = async () => {
        if (!empleadoAjuste || !formAjuste.monto) {
            alert('Por favor ingresa un monto.');
            return;
        }
        setAjustando(true);
        try {
            await ajustarComisionManual(empleadoAjuste.id, formAjuste.monto, formAjuste.motivo);
            setEmpleadoAjuste(null);
        } catch (error) {
            alert('Error al ajustar el saldo.');
            console.error(error);
        } finally {
            setAjustando(false);
        }
    };

    const handleEliminarComision = async (originalIdx) => {
        if (!window.confirm('¿Eliminar este registro de comisión? El monto se restará de su saldo acumulado.')) return;
        try {
            await eliminarComisionHistorial(empleadoDetalle.id, originalIdx);
            const nuevoHistorial = [...empleadoDetalle.historialComisiones];
            const comisionRemovida = nuevoHistorial.splice(originalIdx, 1)[0];
            const nuevoSaldo = Math.max(0, empleadoDetalle.saldoComisiones - (comisionRemovida.comisionGanada || 0));
            setEmpleadoDetalle({ ...empleadoDetalle, historialComisiones: nuevoHistorial, saldoComisiones: nuevoSaldo });
            setEditandoComision({ idx: null, monto: '' });
        } catch (error) {
            console.error(error);
            alert('Error al eliminar comisión');
        }
    };

    const handleGuardarEdicion = async (originalIdx) => {
        if (!editandoComision.monto || isNaN(editandoComision.monto)) {
            alert('Ingresa un monto válido.');
            return;
        }
        try {
            const { nuevoSaldo, nuevoHistorial } = await editarComisionHistorial(empleadoDetalle.id, originalIdx, editandoComision.monto);
            setEmpleadoDetalle({ ...empleadoDetalle, historialComisiones: nuevoHistorial, saldoComisiones: nuevoSaldo });
            setEditandoComision({ idx: null, monto: '' });
        } catch (error) {
            console.error(error);
            alert('Error al editar comisión');
        }
    };

    const handleToggleBonos = async (id, currentStatus) => {
        try {
            await updateEmpleado(id, { usaBonos: !currentStatus });
        } catch (error) {
            console.error(error);
            alert('Error al actualizar el estado de bonos');
        }
    };

    const handleGuardarBonos = async () => {
        try {
            await updateEmpleado(empleadoBonos.id, {
                bonoPuntualidad: Number(formBonos.puntualidad) || 0,
                bonoProductividad: Number(formBonos.productividad) || 0
            });
            setEmpleadoBonos(null);
        } catch (error) {
            console.error('Error al guardar bonos:', error);
            alert('Error al guardar bonos');
        }
    };

    const handleOpenModal = (employee = null) => {
        if (employee) {
            setEditingEmployee(employee.id);
            const isCosme = (employee.puesto || '').includes('Cosmetóloga');
            setFormData({
                nombre: employee.nombre || '',
                email: employee.email || '',
                puesto: isCosme ? 'Cosmetóloga' : employee.puesto || 'Especialista',
                nivelCosmetologa: isCosme ? (employee.puesto || '').split(' - ')[1]?.replace('Nivel ', '') || '1' : '1',
                sueldoBase: employee.sueldoBase || '',
                comisionServicios: employee.comisionServicios || '',
                comisionProductos: employee.comisionProductos || ''
            });
        } else {
            setEditingEmployee(null);
            setFormData({
                nombre: '', email: '', puesto: 'Especialista', nivelCosmetologa: '1',
                sueldoBase: '', comisionServicios: '', comisionProductos: ''
            });
        }
        setExitoAlta(false);
        setCredenciales(null);
        setIsModalOpen(true);
    };

    const handleDeleteStaff = async () => {
        if (!employeeToDelete) return;
        setConfirmingDelete(true);
        try {
            await deleteEmpleado(employeeToDelete.id);
            setEmployeeToDelete(null);
        } catch (err) {
            alert('Error al eliminar empleado.');
            console.error(err);
        } finally {
            setConfirmingDelete(false);
        }
    };

    const handleSaveEmployee = async () => {
        if (!formData.nombre || !formData.sueldoBase) {
            alert('Por favor completa nombre y sueldo base.');
            return;
        }
        if (!editingEmployee && !formData.email) {
            alert('El correo electrónico es obligatorio para crear el acceso.');
            return;
        }
        setSaving(true);
        const puestoFinal = formData.puesto === 'Cosmetóloga' ? `Cosmetóloga - Nivel ${formData.nivelCosmetologa}` : formData.puesto;

        try {
            let uid = null;
            let generatedPassword = null;

            if (!editingEmployee) {
                generatedPassword = `Alfra2026!`;

                const secondaryApp = initializeApp(auth.app.options, `SecondaryApp_${Date.now()}`);
                const secondaryAuth = getAuth(secondaryApp);
                await setPersistence(secondaryAuth, inMemoryPersistence);

                try {
                    const userCredential = await createUserWithEmailAndPassword(
                        secondaryAuth,
                        formData.email.trim(),
                        generatedPassword
                    );
                    uid = userCredential.user.uid;
                    await signOut(secondaryAuth);
                    await deleteApp(secondaryApp);
                } catch (authError) {
                    await deleteApp(secondaryApp);
                    throw authError;
                }

                let roleAsignado = 'Especialista';
                if (formData.puesto === 'Administrador') roleAsignado = 'Administrador';
                if (formData.puesto === 'Recepcionista') roleAsignado = 'Recepcionista';

                await setDoc(doc(db, 'usuarios', uid), {
                    uid,
                    email: formData.email.trim(),
                    nombre: formData.nombre.trim(),
                    role: roleAsignado,
                    createdAt: new Date().toISOString(),
                });

                setCredenciales({ email: formData.email.trim(), password: generatedPassword });
            }

            const empleadoData = {
                nombre: formData.nombre,
                email: formData.email,
                puesto: puestoFinal,
                sueldoBase: Number(formData.sueldoBase) || 0,
                comisionServicios: Number(formData.comisionServicios) || 0,
                comisionProductos: Number(formData.comisionProductos) || 0,
                usaComisiones: true,
                uid: editingEmployee ? (staff.find(s => s.id === editingEmployee)?.uid || null) : uid,
                estatus: 'Activo',
            };

            if (editingEmployee) {
                await updateEmpleado(editingEmployee, empleadoData);
                setIsModalOpen(false);
            } else {
                await createEmpleado(empleadoData);
                setExitoAlta(true);
            }
        } catch (err) {
            let msg = err.message;
            if (err.code === 'auth/email-already-in-use') msg = 'Este correo ya tiene una cuenta activa.';
            if (err.code === 'auth/invalid-email') msg = 'El formato del correo no es válido.';
            if (err.code === 'auth/api-key-not-valid') msg = 'Error de Configuración (API Key inválida). Contacte a soporte.';

            alert('ERROR: ' + msg);
            console.error("Detalle del error:", err);
        } finally {
            setSaving(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-acero flex items-center gap-2">
                        <UsersIcon className="text-turquesa" size={28} /> Nómina y Comisiones
                    </h2>
                    <p className="text-gray-500 text-sm">Control de personal, sueldos y porcentajes de rentabilidad</p>
                </div>
                <Button variant="primary" icon={PlusCircle} onClick={() => handleOpenModal()}>Dar de Alta Personal</Button>
            </div>

            <Card className="p-0 overflow-hidden shadow-sm border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider border-b">
                                <th className="p-4">Empleado / Puesto</th>
                                <th className="p-4">Sueldo Base</th>
                                <th className="p-4">C. Servicios</th>
                                <th className="p-4">C. Productos</th>
                                <th className="p-4 text-turquesa">Saldo Comisiones</th>
                                <th className="p-4 text-center">Bonos</th>
                                <th className="p-4 text-center">Activar Com.</th>
                                <th className="p-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan="8" className="p-10 text-center text-gray-400">Cargando personal...</td></tr>
                            ) : staff.length === 0 ? (
                                <tr><td colSpan="8" className="p-10 text-center text-gray-400">No hay personal registrado</td></tr>
                            ) : (
                                staff.map((empleado) => (
                                    <tr key={empleado.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-acero">{empleado.nombre}</div>
                                            <div className="text-[10px] bg-turquesa/10 text-turquesa px-1.5 py-0.5 rounded inline-block font-black mt-1 uppercase">{empleado.puesto}</div>
                                        </td>
                                        <td className="p-4 font-mono text-sm">{formatCurrency(empleado.sueldoBase)}</td>
                                        <td className="p-4 font-bold text-acero/60 text-sm">{empleado.comisionServicios || 0}%</td>
                                        <td className="p-4 font-bold text-acero/60 text-sm">{empleado.comisionProductos || 0}%</td>
                                        <td className="p-4 font-black text-turquesa lg:text-lg">{formatCurrency(empleado.saldoComisiones || 0)}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleToggleBonos(empleado.id, empleado.usaBonos)} className="transition-transform active:scale-95">
                                                    {empleado.usaBonos ? <ToggleRight className="text-indigo-500" size={32} /> : <ToggleLeft className="text-gray-300" size={32} />}
                                                </button>
                                                {empleado.usaBonos && (
                                                    <button 
                                                        title="Configurar Bonos"
                                                        onClick={() => {
                                                            setEmpleadoBonos(empleado);
                                                            setFormBonos({ 
                                                                puntualidad: empleado.bonoPuntualidad || 0, 
                                                                productividad: empleado.bonoProductividad || 0 
                                                            });
                                                        }}
                                                        className="inline-flex items-center justify-center p-1 rounded-full text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                    >
                                                        <Award size={20} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => handleToggleComisiones(empleado.id, empleado.usaComisiones)} className="transition-transform active:scale-95">
                                                {empleado.usaComisiones ? <ToggleRight className="text-turquesa" size={32} /> : <ToggleLeft className="text-gray-300" size={32} />}
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-center gap-1 flex-wrap">
                                                <button
                                                    title="Ver Detalle de Comisiones"
                                                    onClick={() => setEmpleadoDetalle(empleado)}
                                                    className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                                                >
                                                    <List size={18} />
                                                </button>
                                                {userRole === 'Administrador' && (
                                                    <button
                                                        title="Ajuste Manual de Comisión"
                                                        onClick={() => {
                                                            setEmpleadoAjuste(empleado);
                                                            setFormAjuste({ monto: '', motivo: '' });
                                                        }}
                                                        className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                                                    >
                                                        <DollarSign size={18} />
                                                    </button>
                                                )}
                                                <button
                                                    title="Liquidar Nómina"
                                                    onClick={() => {
                                                        setEmpleadoLiquidar(empleado);
                                                        setNominaForm({
                                                            periodo: '',
                                                            metodoPago: 'Efectivo',
                                                            sueldoBase: empleado.sueldoBase || '',
                                                            bonoPuntualidad: empleado.bonoPuntualidad || 0,
                                                            bonoProductividad: empleado.bonoProductividad || 0
                                                        });
                                                    }}
                                                    className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                                >
                                                    <Receipt size={18} />
                                                </button>
                                                <Button variant="ghost" size="sm" icon={Settings} onClick={() => handleOpenModal(empleado)} className="hover:bg-acero/5" />
                                                <button onClick={() => setEmployeeToDelete(empleado)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* MODAL ALTA/EDICIÓN */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingEmployee ? "Configurar Perfil de Empleado" : "Alta de Nuevo Personal"}
                footer={exitoAlta ? null : (
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleSaveEmployee} disabled={saving}>
                            {saving ? 'Guardando...' : (editingEmployee ? 'Actualizar Datos' : 'Registrar y Crear Acceso')}
                        </Button>
                    </div>
                )}
            >
                {exitoAlta && credenciales ? (
                    <div className="text-center space-y-6 py-4">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-acero">¡Acceso Generado!</h3>
                            <p className="text-sm text-gray-500">Comparte estas credenciales con el nuevo empleado para que pueda ingresar al sistema.</p>
                        </div>
                        <div className="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-200 font-mono text-sm text-left relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 bg-turquesa/10"><KeyRound size={16} className="text-turquesa" /></div>
                            <p className="mb-2 uppercase text-[10px] font-black text-gray-400">Usuario / Email</p>
                            <p className="text-acero font-bold mb-4 break-all">{credenciales.email}</p>
                            <p className="mb-2 uppercase text-[10px] font-black text-gray-400">Contraseña Temporal</p>
                            <p className="text-turquesa font-black text-lg tracking-wider">{credenciales.password}</p>
                        </div>
                        <div className="space-y-2">
                            <Button variant="primary" fullWidth onClick={() => copyToClipboard(`${credenciales.email} / ${credenciales.password}`)}>
                                {copiado ? '¡Copiado al Portapapeles!' : 'Copiar Credenciales'}
                            </Button>
                            <Button variant="ghost" fullWidth onClick={() => setIsModalOpen(false)}>Finalizar</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="bg-turquesa/5 p-3 rounded-xl border border-turquesa/10 flex items-start gap-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm"><Settings className="text-turquesa" size={18} /></div>
                            <p className="text-[11px] text-gray-500 leading-tight">Configura el puesto y las comisiones para que el sistema calcule automáticamente los cortes de caja y pagos semanales.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-1 md:col-span-2">
                                <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">Nombre Completo *</label>
                                <input type="text" placeholder="Ej. Ana García" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20 transition-all" />
                            </div>

                            <div className="col-span-1 md:col-span-2">
                                <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">Correo Electrónico (Acceso) *</label>
                                <input type="email" placeholder="email@alfra.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20 transition-all" disabled={!!editingEmployee} />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">Puesto / Rol</label>
                                <select value={formData.puesto} onChange={e => setFormData({ ...formData, puesto: e.target.value })} className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20 transition-all">
                                    <option value="Administrador">Administrador</option>
                                    <option value="Recepcionista">Recepcionista</option>
                                    <option value="Especialista">Especialista</option>
                                    <option value="Cosmetóloga">Cosmetóloga</option>
                                </select>
                            </div>

                            {formData.puesto === 'Cosmetóloga' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">Nivel</label>
                                    <select value={formData.nivelCosmetologa} onChange={e => setFormData({ ...formData, nivelCosmetologa: e.target.value })} className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20 transition-all">
                                        <option value="1">Nivel 1</option>
                                        <option value="2">Nivel 2</option>
                                        <option value="3">Nivel 3</option>
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">Sueldo Base Mensual *</label>
                                <input type="number" placeholder="0.00" value={formData.sueldoBase} onChange={e => setFormData({ ...formData, sueldoBase: e.target.value })} className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20 transition-all font-bold text-acero" />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">% Comisión Servicios</label>
                                <div className="relative">
                                    <input type="number" placeholder="0" value={formData.comisionServicios} onChange={e => setFormData({ ...formData, comisionServicios: e.target.value })} className="w-full p-3 border rounded-xl bg-turquesa/5 text-turquesa font-black focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20 transition-all pl-8" />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-turquesa font-bold">%</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">% Comisión Productos</label>
                                <div className="relative">
                                    <input type="number" placeholder="0" value={formData.comisionProductos} onChange={e => setFormData({ ...formData, comisionProductos: e.target.value })} className="w-full p-3 border rounded-xl bg-gray-50 text-acero/60 font-black focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20 transition-all pl-8" />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-acero/40 font-bold">%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL ELIMINAR */}
            <Modal isOpen={!!employeeToDelete} onClose={() => setEmployeeToDelete(null)} title="Confirmar Baja de Personal" maxWidth="max-w-sm">
                <div className="text-center space-y-4 py-2">
                    <Trash2 size={44} className="text-red-500 mx-auto" />
                    <div>
                        <p className="font-black text-acero text-lg leading-tight tracking-tight">¿Remover a <span className="text-red-500">{employeeToDelete?.nombre}</span>?</p>
                        <p className="text-xs text-gray-400 mt-2">Esta acción eliminará su registro de nómina. Los movimientos financieros históricos se conservarán.</p>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" fullWidth onClick={() => setEmployeeToDelete(null)}>Conservar</Button>
                        <Button variant="primary" className="bg-red-500 border-red-500 hover:bg-red-600 shadow-lg shadow-red-100" fullWidth onClick={handleDeleteStaff} disabled={confirmingDelete}>
                            {confirmingDelete ? 'Procesando baja...' : 'Confirmar Baja'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ═══ MODAL LIQUIDACIÓN DE NÓMINA ═════════════════════════════════ */}
            <Modal
                isOpen={!!empleadoLiquidar}
                onClose={() => setEmpleadoLiquidar(null)}
                title="Liquidar Nómina"
                maxWidth="max-w-md"
            >
                {empleadoLiquidar && (
                    <div className="space-y-4">
                        <div className="bg-turquesa/5 p-4 rounded-2xl border border-turquesa/10 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-turquesa/10 flex items-center justify-center text-turquesa flex-shrink-0">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <p className="font-black text-acero text-lg leading-tight">{empleadoLiquidar.nombre}</p>
                                <p className="text-xs text-turquesa font-bold uppercase tracking-widest">{empleadoLiquidar.puesto}</p>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1 block mb-1">Período de Pago</label>
                            <input type="text" value={nominaForm.periodo} onChange={e => setNominaForm({ ...nominaForm, periodo: e.target.value })} className="w-full p-3 border rounded-xl bg-gray-50" />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1 block mb-1">Sueldo Base a Pagar</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <DollarSign size={16} className="text-gray-400" />
                                </div>
                                <input type="number" required placeholder="0.00" value={nominaForm.sueldoBase} onChange={e => setNominaForm({ ...nominaForm, sueldoBase: e.target.value })} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-turquesa/20 outline-none text-gray-700 bg-gray-50/50" />
                            </div>
                        </div>
                        {empleadoLiquidar.usaBonos && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase ml-1 block mb-1">Bono Puntualidad</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <DollarSign size={16} className="text-gray-400" />
                                        </div>
                                        <input type="number" placeholder="0.00" value={nominaForm.bonoPuntualidad} onChange={e => setNominaForm({ ...nominaForm, bonoPuntualidad: e.target.value })} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-turquesa/20 outline-none text-gray-700 bg-gray-50/50" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase ml-1 block mb-1">Bono Productividad</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <DollarSign size={16} className="text-gray-400" />
                                        </div>
                                        <input type="number" placeholder="0.00" value={nominaForm.bonoProductividad} onChange={e => setNominaForm({ ...nominaForm, bonoProductividad: e.target.value })} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-turquesa/20 outline-none text-gray-700 bg-gray-50/50" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Summary Card */}
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 font-medium">Sueldo Base</span>
                                <span className="font-bold text-gray-700">{formatCurrency(Number(nominaForm.sueldoBase) || 0)}</span>
                            </div>
                            {empleadoLiquidar.usaBonos && Number(nominaForm.bonoPuntualidad) > 0 && (
                                <div className="flex justify-between items-center text-sm text-indigo-600">
                                    <span className="font-medium">Bono Puntualidad</span>
                                    <span className="font-bold">{formatCurrency(Number(nominaForm.bonoPuntualidad) || 0)}</span>
                                </div>
                            )}
                            {empleadoLiquidar.usaBonos && Number(nominaForm.bonoProductividad) > 0 && (
                                <div className="flex justify-between items-center text-sm text-indigo-600">
                                    <span className="font-medium">Bono Productividad</span>
                                    <span className="font-bold">{formatCurrency(Number(nominaForm.bonoProductividad) || 0)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 font-medium">Saldo Comisiones Acumuladas</span>
                                <span className="font-bold text-turquesa">{formatCurrency(empleadoLiquidar.saldoComisiones || 0)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-200 text-base">
                                <span className="font-black text-acero uppercase">TOTAL A PAGAR</span>
                                <span className="text-xl font-black text-turquesa">
                                    {formatCurrency((Number(nominaForm.sueldoBase) || 0) + (Number(empleadoLiquidar.saldoComisiones) || 0) + (empleadoLiquidar.usaBonos ? Number(nominaForm.bonoPuntualidad) || 0 : 0) + (empleadoLiquidar.usaBonos ? Number(nominaForm.bonoProductividad) || 0 : 0))}
                                </span>
                            </div>
                        </div>
                        
                        <p className="text-[10px] text-amber-600 bg-amber-50 rounded-xl p-3 border border-amber-100">
                            ⚠️ Al liquidar, el saldo de comisiones y bonos se resetea a $0 y se genera un recibo de nómina descargable.
                        </p>

                        <div>
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block">Método de Pago</label>
                            <div className="flex gap-3">
                                <Button variant="primary" fullWidth icon={ArrowRightLeft} disabled={!!liquidandoId} onClick={() => handleLiquidar('Transferencia')}>
                                    {liquidandoId ? 'Procesando...' : 'Transferencia'}
                                </Button>
                                <Button variant="outline" fullWidth icon={Banknote} disabled={!!liquidandoId} onClick={() => handleLiquidar('Efectivo')}>
                                    {liquidandoId ? '...' : 'Efectivo'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ═══ RECIBO DE NÓMINA ════════════════════════════════════════════ */}
            <ReciboNomina
                isOpen={reciboNominaOpen}
                onClose={() => setReciboNominaOpen(false)}
                datosNomina={datosReciboNomina}
            />
            {/* ═══ MODAL AJUSTE MANUAL ═════════════════════════════════════════ */}
            <Modal
                isOpen={!!empleadoAjuste}
                onClose={() => setEmpleadoAjuste(null)}
                title="Ajuste Manual de Comisiones"
                maxWidth="max-w-sm"
            >
                {empleadoAjuste && (
                    <div className="space-y-4">
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 mb-4">
                            <p className="text-sm font-bold text-amber-800">Saldo actual: {formatCurrency(empleadoAjuste.saldoComisiones)}</p>
                            <p className="text-xs text-amber-600">Usa números negativos (ej. -105) para restar, o positivos para sumar al saldo.</p>
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">Monto a Ajustar *</label>
                            <input 
                                type="number" 
                                placeholder="Ej. -50.00" 
                                value={formAjuste.monto} 
                                onChange={e => setFormAjuste({ ...formAjuste, monto: e.target.value })} 
                                className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20 transition-all font-bold text-acero" 
                            />
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">Motivo del Ajuste *</label>
                            <input 
                                type="text" 
                                placeholder="Ej. Corrección de comisión errónea" 
                                value={formAjuste.motivo} 
                                onChange={e => setFormAjuste({ ...formAjuste, motivo: e.target.value })} 
                                className="w-full p-3 border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20 transition-all" 
                            />
                        </div>
                        
                        <div className="flex gap-3 pt-4">
                            <Button variant="ghost" fullWidth onClick={() => setEmpleadoAjuste(null)}>Cancelar</Button>
                            <Button variant="primary" fullWidth onClick={handleAjustar} disabled={ajustando}>
                                {ajustando ? 'Ajustando...' : 'Aplicar Ajuste'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
            {/* ═══ MODAL DETALLE HISTORIAL ═════════════════════════════════════════ */}
            <Modal
                isOpen={!!empleadoDetalle}
                onClose={() => setEmpleadoDetalle(null)}
                title={`Detalle de Comisiones - ${empleadoDetalle?.nombre}`}
                maxWidth="max-w-2xl"
            >
                {empleadoDetalle && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <span className="text-sm text-gray-500 font-bold uppercase tracking-wider">Total Acumulado:</span>
                            <span className="text-xl font-black text-turquesa">{formatCurrency(empleadoDetalle.saldoComisiones)}</span>
                        </div>
                        
                        <div className="overflow-y-auto max-h-96">
                            {(!empleadoDetalle.historialComisiones || empleadoDetalle.historialComisiones.length === 0) ? (
                                <p className="text-center text-gray-400 py-10">No hay comisiones registradas en este periodo.</p>
                            ) : (
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr className="text-xs text-gray-500 uppercase">
                                            <th className="p-2 font-bold">Fecha</th>
                                            <th className="p-2 font-bold">Motivo / Venta</th>
                                            <th className="p-2 font-bold">Tipo</th>
                                            <th className="p-2 font-bold text-right">Monto Venta</th>
                                            <th className="p-2 font-bold text-right">%</th>
                                            <th className="p-2 font-bold text-right text-turquesa">Comisión</th>
                                            {userRole === 'Administrador' && <th className="p-2 font-bold text-center"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {[...empleadoDetalle.historialComisiones].reverse().map((hist, reversedIdx) => {
                                            const originalIdx = empleadoDetalle.historialComisiones.length - 1 - reversedIdx;
                                            return (
                                                <tr key={originalIdx} className="hover:bg-gray-50/50">
                                                    <td className="p-2 text-gray-500">{new Date(hist.fecha).toLocaleDateString('es-MX')}</td>
                                                    <td className="p-2 font-medium text-acero max-w-[150px] truncate" title={hist.detalleMotivo}>{hist.detalleMotivo}</td>
                                                    <td className="p-2">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${hist.tipoVenta === 'Ajuste Manual' ? 'bg-amber-100 text-amber-700' : hist.tipoVenta === 'Producto' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {hist.tipoVenta}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 text-right">
                                                        {hist.tipoVenta === 'Ajuste Manual' ? '-' : (
                                                            editandoComision.idx === originalIdx ? (
                                                                <input 
                                                                    type="number" 
                                                                    className="w-20 p-1 border rounded text-right border-turquesa outline-none text-xs" 
                                                                    value={editandoComision.monto} 
                                                                    onChange={e => setEditandoComision({ ...editandoComision, monto: e.target.value })} 
                                                                />
                                                            ) : formatCurrency(hist.montoVenta)
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-right text-gray-400">{hist.porcentajeAplicado}%</td>
                                                    <td className={`p-2 text-right font-black ${Number(hist.comisionGanada) < 0 ? 'text-red-500' : 'text-turquesa'}`}>
                                                        {formatCurrency(hist.comisionGanada)}
                                                    </td>
                                                    {userRole === 'Administrador' && (
                                                        <td className="p-2 text-center">
                                                            {editandoComision.idx === originalIdx ? (
                                                                <div className="flex gap-1 justify-center">
                                                                    <button onClick={() => handleGuardarEdicion(originalIdx)} className="text-emerald-500 p-1 hover:bg-emerald-50 rounded">
                                                                        <Check size={16} />
                                                                    </button>
                                                                    <button onClick={() => setEditandoComision({ idx: null, monto: '' })} className="text-gray-400 p-1 hover:bg-gray-100 rounded">
                                                                        <X size={16} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex gap-1 justify-center">
                                                                    {hist.tipoVenta !== 'Ajuste Manual' && (
                                                                        <button 
                                                                            title="Editar Monto Venta"
                                                                            onClick={() => setEditandoComision({ idx: originalIdx, monto: hist.montoVenta })} 
                                                                            className="text-blue-400 hover:text-blue-600 p-1 hover:bg-blue-50 rounded"
                                                                        >
                                                                            <Pencil size={16} />
                                                                        </button>
                                                                    )}
                                                                    <button 
                                                                        title="Deshacer esta comisión"
                                                                        onClick={() => handleEliminarComision(originalIdx)} 
                                                                        className="text-red-300 hover:text-red-500 p-1 hover:bg-red-50 rounded"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="flex justify-end pt-4 border-t border-gray-100">
                            <Button variant="ghost" onClick={() => setEmpleadoDetalle(null)}>Cerrar</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ═══ MODAL CONFIGURAR BONOS ═════════════════════════════════════════ */}
            <Modal
                isOpen={!!empleadoBonos}
                onClose={() => setEmpleadoBonos(null)}
                title={`Bonos: ${empleadoBonos?.nombre}`}
                maxWidth="max-w-sm"
            >
                {empleadoBonos && (
                    <div className="space-y-4">
                        <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 mb-4">
                            <p className="text-sm font-bold text-indigo-800">Configuración de Bonos</p>
                            <p className="text-xs text-indigo-600">Establece el monto de los bonos para el próximo pago. Al liquidar la nómina podrás confirmar o modificar estos valores.</p>
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">Bono de Puntualidad</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <DollarSign size={16} className="text-gray-400" />
                                </div>
                                <input 
                                    type="number" 
                                    placeholder="0.00" 
                                    value={formBonos.puntualidad} 
                                    onChange={e => setFormBonos({ ...formBonos, puntualidad: e.target.value })} 
                                    className="w-full pl-10 pr-4 py-3 border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20 transition-all font-bold text-acero" 
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">Bono de Productividad</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <DollarSign size={16} className="text-gray-400" />
                                </div>
                                <input 
                                    type="number" 
                                    placeholder="0.00" 
                                    value={formBonos.productividad} 
                                    onChange={e => setFormBonos({ ...formBonos, productividad: e.target.value })} 
                                    className="w-full pl-10 pr-4 py-3 border rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-turquesa/20 transition-all font-bold text-acero" 
                                />
                            </div>
                        </div>
                        
                        <div className="flex gap-3 pt-4">
                            <Button variant="ghost" fullWidth onClick={() => setEmpleadoBonos(null)}>Cancelar</Button>
                            <Button variant="primary" fullWidth onClick={handleGuardarBonos}>
                                Guardar Bonos
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
