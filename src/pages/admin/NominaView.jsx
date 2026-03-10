import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Users as UsersIcon, PlusCircle, Settings, ToggleRight, ToggleLeft, CheckCircle, Trash2, KeyRound } from 'lucide-react';
import { onStaffChange, createEmpleado, updateEmpleado, deleteEmpleado } from '../../services/staffService';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, setPersistence, inMemoryPersistence } from 'firebase/auth';

export default function NominaView() {
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
                const base = formData.nombre.trim().split(' ')[0].toLowerCase();
                generatedPassword = `${base}@${Math.floor(1000 + Math.random() * 9000)}`;

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

                // Definir rol en usuarios según puesto
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
                                <th className="p-4 text-center">Activar Com.</th>
                                <th className="p-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan="6" className="p-10 text-center text-gray-400">Cargando personal...</td></tr>
                            ) : staff.length === 0 ? (
                                <tr><td colSpan="6" className="p-10 text-center text-gray-400">No hay personal registrado</td></tr>
                            ) : (
                                staff.map((empleado) => (
                                    <tr key={empleado.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-acero">{empleado.nombre}</div>
                                            <div className="text-[10px] bg-turquesa/10 text-turquesa px-1.5 py-0.5 rounded inline-block font-black mt-1 uppercase">{empleado.puesto}</div>
                                        </td>
                                        <td className="p-4 font-mono text-sm">{formatCurrency(empleado.sueldoBase)}</td>
                                        <td className="p-4 font-bold text-turquesa">{empleado.comisionServicios || 0}%</td>
                                        <td className="p-4 font-bold text-acero/60">{empleado.comisionProductos || 0}%</td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => handleToggleComisiones(empleado.id, empleado.usaComisiones)} className="transition-transform active:scale-95">
                                                {empleado.usaComisiones ? <ToggleRight className="text-turquesa" size={32} /> : <ToggleLeft className="text-gray-300" size={32} />}
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-center gap-1">
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
        </div>
    );
}
