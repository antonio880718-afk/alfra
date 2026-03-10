import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Users as UsersIcon, Search, UserCog, CheckCircle, UserPlus, Trash2 } from 'lucide-react';
import { onPacientesChange, updatePaciente, createPaciente, deletePaciente } from '../../services/pacientesService';
import { onStaffChange } from '../../services/staffService';
import { useAuth } from '../../contexts/AuthContext';
import { KeyRound, Mail } from 'lucide-react';

const TIPOS = ['Por definir', 'Facial', 'Corporal', 'Mixto'];
const ESTADOS = ['Activo', 'En pausa', 'Alta médica', 'Prospecto'];

const emptyNuevo = {
    nombre: '',
    telefono: '',
    email: '',
    fechaNacimiento: '',
    tipoTratamiento: 'Por definir',
    estado: 'Activo',
    observaciones: '',
};

export default function AdminPacientes() {
    const [pacientes, setPacientes] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const { resetPassword } = useAuth();
    const [resetting, setResetting] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);

    const [modalNuevo, setModalNuevo] = useState(false);
    const [formNuevo, setFormNuevo] = useState(emptyNuevo);
    const [savingNuevo, setSavingNuevo] = useState(false);
    const [exitoNuevo, setExitoNuevo] = useState(false);

    const [pacienteToDelete, setPacienteToDelete] = useState(null);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [exitoAsignacion, setExitoAsignacion] = useState(false);

    const setN = (k, v) => setFormNuevo(prev => ({ ...prev, [k]: v }));

    const handleCrearPaciente = async () => {
        if (!formNuevo.nombre.trim()) { alert('El nombre es obligatorio.'); return; }
        if (!formNuevo.telefono.trim()) { alert('El teléfono es obligatorio.'); return; }
        setSavingNuevo(true);
        try {
            await createPaciente({
                ...formNuevo,
                nombre: formNuevo.nombre.trim(),
                telefono: formNuevo.telefono.trim(),
                especialistaAsignado: '',
                especialistaAsignadoNombre: '',
            });

            setExitoNuevo(true);
            setTimeout(() => {
                setModalNuevo(false);
                setFormNuevo(emptyNuevo);
                setExitoNuevo(false);
            }, 1500);
        } catch (err) {
            alert('Error: ' + err.message);
            console.error(err);
        } finally {
            setSavingNuevo(false);
        }
    };

    const [modal, setModal] = useState(false);
    const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
    const [formAsignacion, setFormAsignacion] = useState({
        especialistaAsignado: '', especialistaAsignadoNombre: '',
        tipoTratamiento: 'Por definir', estado: 'Activo',
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const unsubPac = onPacientesChange(setPacientes);
        const unsubStaff = onStaffChange(data => {
            setStaff(data.filter(s => (s.puesto || '').toLowerCase().includes('especialista') || (s.puesto || '').toLowerCase().includes('cosmet')));
        });
        setLoading(false);
        return () => { unsubPac(); unsubStaff(); };
    }, []);

    const pacientesFiltrados = pacientes.filter(p => {
        const q = busqueda.toLowerCase();
        return !q || (p.nombre || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q) || (p.telefono || '').includes(q);
    });

    const abrirModal = (paciente) => {
        setPacienteSeleccionado(paciente);
        setFormAsignacion({
            especialistaAsignado: paciente.especialistaAsignado || '',
            especialistaAsignadoNombre: paciente.especialistaAsignadoNombre || '',
            tipoTratamiento: paciente.tipoTratamiento || 'Por definir',
            estado: paciente.estado || 'Activo',
        });
        setModal(true);
        setExitoAsignacion(false);
    };

    const handleGuardar = async () => {
        if (!pacienteSeleccionado) return;
        setSaving(true);
        try {
            await updatePaciente(pacienteSeleccionado.id, formAsignacion);
            setExitoAsignacion(true);
            setTimeout(() => { setModal(false); setExitoAsignacion(false); }, 1200);
        } catch (err) { alert('Error al guardar.'); console.error(err); }
        finally { setSaving(false); }
    };

    const handleResetPassword = async () => {
        if (!pacienteSeleccionado?.email) {
            alert('El paciente no tiene un correo registrado.');
            return;
        }
        if (!window.confirm(`¿Enviar correo de restablecimiento a ${pacienteSeleccionado.email}?`)) return;

        setResetting(true);
        try {
            await resetPassword(pacienteSeleccionado.email);
            setResetSuccess(true);
            setTimeout(() => setResetSuccess(false), 3000);
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setResetting(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!pacienteToDelete) return;
        setConfirmingDelete(true);
        try {
            await deletePaciente(pacienteToDelete.id);
            setPacienteToDelete(null);
        } catch (err) { alert('Error al eliminar.'); console.error(err); }
        finally { setConfirmingDelete(false); }
    };

    const getEstadoBadge = (estado) => {
        switch (estado) {
            case 'Activo': return <Badge variant="green">Activo</Badge>;
            case 'En pausa': return <Badge variant="yellow">En pausa</Badge>;
            case 'Alta médica': return <Badge variant="turquesa">Alta médica</Badge>;
            case 'Prospecto': return <Badge variant="gray">Prospecto</Badge>;
            default: return <Badge variant="gray">{estado || 'Sin estado'}</Badge>;
        }
    };

    const inputCls = "w-full p-2.5 border rounded-xl outline-none text-sm bg-gray-50 focus:bg-white transition-all";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-acero flex items-center gap-2">
                        <UsersIcon className="text-turquesa" size={26} /> Pacientes
                    </h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Gestión de expedientes</p>
                </div>
                <Button variant="primary" icon={UserPlus} onClick={() => { setFormNuevo(emptyNuevo); setExitoNuevo(false); setModalNuevo(true); }}>
                    Nuevo
                </Button>
            </div>

            <Card className="p-3">
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-turquesa/20 transition-all" />
                </div>
            </Card>

            <Card className="p-0 overflow-hidden shadow-sm">
                <div className="divide-y">
                    {pacientesFiltrados.map(p => (
                        <div key={p.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-turquesa/10 text-turquesa flex items-center justify-center font-black">
                                    {(p.nombre || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800">{p.nombre}</p>
                                    <p className="text-xs text-gray-400">{p.telefono} • {p.email || 'Sin correo'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {getEstadoBadge(p.estado)}
                                <Button variant="ghost" size="sm" icon={UserCog} onClick={() => abrirModal(p)} />
                                <button onClick={() => setPacienteToDelete(p)} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                            </div>
                        </div>
                    ))}
                    {loading && <div className="p-8 text-center text-gray-500">Cargando pacientes...</div>}
                    {!loading && pacientesFiltrados.length === 0 && (
                        <div className="p-12 text-center text-gray-400">No se encontraron pacientes.</div>
                    )}
                </div>
            </Card>

            {/* MODAL NUEVO PACIENTE (Solo Expediente) */}
            <Modal isOpen={modalNuevo} onClose={() => setModalNuevo(false)} title="Nuevo Registro de Paciente">
                {exitoNuevo ? (
                    <div className="text-center py-8 space-y-4">
                        <CheckCircle size={64} className="text-green-500 mx-auto" />
                        <h3 className="font-black text-xl text-acero">¡Expediente Creado!</h3>
                        <p className="text-gray-500">Los datos básicos se han guardado correctamente.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-xs text-gray-400 bg-blue-50 p-3 rounded-lg border border-blue-100 italic">
                            Nota: Aquí solo registras el expediente médico. El paciente puede crear su cuenta de acceso en la pantalla de inicio para ver sus seguimientos.
                        </p>
                        <div className="space-y-3">
                            <input type="text" placeholder="Nombre completo *" value={formNuevo.nombre} onChange={e => setN('nombre', e.target.value)} className={inputCls} />
                            <input type="tel" placeholder="Teléfono *" value={formNuevo.telefono} onChange={e => setN('telefono', e.target.value)} className={inputCls} />
                            <input type="email" placeholder="Correo electrónico (opcional)" value={formNuevo.email} onChange={e => setN('email', e.target.value)} className={inputCls} />
                            <input type="date" placeholder="Fecha de Nacimiento" value={formNuevo.fechaNacimiento} onChange={e => setN('fechaNacimiento', e.target.value)} className={inputCls} />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" fullWidth onClick={() => setModalNuevo(false)}>Cancelar</Button>
                            <Button variant="primary" fullWidth onClick={handleCrearPaciente} disabled={savingNuevo}>
                                {savingNuevo ? 'Guardando...' : 'Crear Expediente'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL ASIGNAR */}
            <Modal isOpen={modal} onClose={() => setModal(false)} title="Asignación y Seguimiento">
                {exitoAsignacion ? (
                    <div className="text-center py-6"><CheckCircle size={40} className="text-green-500 mx-auto" /></div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Especialista Responsable</label>
                            <select
                                value={formAsignacion.especialistaAsignado}
                                onChange={e => {
                                    const sel = staff.find(s => s.id === e.target.value);
                                    setFormAsignacion(prev => ({ ...prev, especialistaAsignado: e.target.value, especialistaAsignadoNombre: sel?.nombre || '' }));
                                }}
                                className={inputCls}
                            >
                                <option value="">— Seleccionar Especialista —</option>
                                {staff.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.puesto})</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Tipo Tratamiento</label>
                                <select value={formAsignacion.tipoTratamiento} onChange={e => setFormAsignacion(p => ({ ...p, tipoTratamiento: e.target.value }))} className={inputCls}>
                                    {TIPOS.map(e => <option key={e}>{e}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Estado Actual</label>
                                <select value={formAsignacion.estado} onChange={e => setFormAsignacion(p => ({ ...p, estado: e.target.value }))} className={inputCls}>
                                    {ESTADOS.map(e => <option key={e}>{e}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="pt-4 border-t border-gray-100 space-y-3">
                            <label className="text-xs font-bold text-gray-400 uppercase block">Accesos y Seguridad</label>
                            {pacienteSeleccionado?.email ? (
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Mail size={14} className="text-turquesa" />
                                        <span>{pacienteSeleccionado.email}</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={resetSuccess ? CheckCircle : KeyRound}
                                        className={resetSuccess ? 'text-green-600 bg-green-50' : 'text-turquesa hover:bg-turquesa/5'}
                                        onClick={handleResetPassword}
                                        disabled={resetting}
                                    >
                                        {resetting ? 'Enviando...' : (resetSuccess ? 'Enviado' : 'Restablecer Clave')}
                                    </Button>
                                </div>
                            ) : (
                                <div className="p-3 bg-yellow-50 text-yellow-700 text-[10px] rounded-lg border border-yellow-100 italic">
                                    Paciente sin correo electrónico. No se pueden gestionar accesos.
                                </div>
                            )}
                        </div>

                        <Button variant="primary" fullWidth onClick={handleGuardar} disabled={saving}>
                            {saving ? 'Aplicando cambios...' : 'Guardar Cambios'}
                        </Button>
                    </div>
                )}
            </Modal>

            {/* MODAL ELIMINAR */}
            <Modal isOpen={!!pacienteToDelete} onClose={() => setPacienteToDelete(null)} title="Eliminar Registro" maxWidth="max-w-sm">
                <div className="text-center space-y-4 py-2">
                    <Trash2 size={40} className="text-red-500 mx-auto" />
                    <p className="font-bold text-acero leading-tight">¿Estás seguro de eliminar el expediente de <span className="text-turquesa">{pacienteToDelete?.nombre}</span>?</p>
                    <p className="text-xs text-gray-400">Esta acción no se puede deshacer y borrará todo el historial asociado.</p>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" fullWidth onClick={() => setPacienteToDelete(null)}>No, cancelar</Button>
                        <Button variant="primary" className="bg-red-500 border-red-500 hover:bg-red-600" fullWidth onClick={handleConfirmDelete} disabled={confirmingDelete}>
                            {confirmingDelete ? 'Eliminando...' : 'Sí, eliminar'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
