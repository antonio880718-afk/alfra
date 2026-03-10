import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Search, Users as UsersIcon, UserCircle, ExternalLink, Calendar, Phone } from 'lucide-react';
import { onPacientesByEspecialistaChange } from '../../services/pacientesService';
import { getStaffDocByUid } from '../../services/staffService';
import { auth } from '../../lib/firebase';

export default function MisPacientes() {
    const navigate = useNavigate();
    const [pacientes, setPacientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [especialistaId, setEspecialistaId] = useState(null);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        // Primero obtenemos el ID de Firestore del especialista logueado
        getStaffDocByUid(user.uid).then(staffDoc => {
            if (staffDoc) {
                setEspecialistaId(staffDoc.id);

                // Suscribirse a sus pacientes
                const unsubscribe = onPacientesByEspecialistaChange(staffDoc.id, (data) => {
                    setPacientes(data);
                    setLoading(false);
                });
                return () => unsubscribe();
            } else {
                setLoading(false);
            }
        }).catch(err => {
            console.error("Error al obtener datos del especialista:", err);
            setLoading(false);
        });
    }, []);

    const pacientesFiltrados = pacientes.filter(p =>
        (p.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.telefono || '').includes(busqueda)
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-acero flex items-center gap-2">
                        <UsersIcon className="text-turquesa" size={28} /> Mis Pacientes Asignados
                    </h2>
                    <p className="text-gray-500 text-sm">Lista de pacientes bajo tu cuidado y seguimiento clínico</p>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, correo o tel..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-xl bg-white focus:ring-2 focus:ring-turquesa/20 outline-none transition-all"
                    />
                </div>
            </div>

            {loading ? (
                <Card className="p-12 flex flex-col items-center justify-center text-gray-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-turquesa mb-4"></div>
                    <p>Cargando tus pacientes...</p>
                </Card>
            ) : pacientesFiltrados.length === 0 ? (
                <Card className="p-12 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 border-dashed">
                    <UsersIcon size={48} className="mb-4 opacity-20" />
                    <p className="font-bold text-lg">No se encontraron pacientes</p>
                    <p className="text-sm">Si crees que esto es un error, verifica tu asignación con administración.</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pacientesFiltrados.map((paciente) => (
                        <Card key={paciente.id} className="group hover:border-turquesa/50 transition-all duration-300 shadow-sm hover:shadow-md">
                            <div className="flex flex-col h-full">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-turquesa/10 flex items-center justify-center text-turquesa font-black text-xl">
                                            {paciente.nombre?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-acero leading-tight group-hover:text-turquesa transition-colors">
                                                {paciente.nombre}
                                            </h3>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                                {paciente.tipoTratamiento || 'Por definir'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-tighter ${paciente.estado === 'Activo' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {paciente.estado || 'Activo'}
                                    </span>
                                </div>

                                <div className="space-y-2 mb-6">
                                    {paciente.telefono && (
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <Phone size={14} className="text-gray-400" />
                                            <span>{paciente.telefono}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Calendar size={14} className="text-gray-400" />
                                        <span>Paciente desde: {paciente.createdAt ? new Date(paciente.createdAt).toLocaleDateString() : '—'}</span>
                                    </div>
                                </div>

                                <div className="mt-auto pt-4 border-t border-gray-50 flex gap-2">
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        fullWidth
                                        icon={ExternalLink}
                                        onClick={() => navigate(`/especialista/expediente/${paciente.id}`)}
                                    >
                                        Abrir Expediente
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="px-3"
                                        onClick={() => window.open(`https://wa.me/${paciente.telefono}`, '_blank')}
                                    >
                                        <Phone size={14} />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
