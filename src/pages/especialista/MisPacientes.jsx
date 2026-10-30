import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
    Search, Users as UsersIcon, UserCircle, ExternalLink, Calendar,
    Phone, Play, AlertTriangle, Sparkles, Award
} from 'lucide-react';
import { onPacientesChange } from '../../services/pacientesService';
import { getStaffDocByUid } from '../../services/staffService';
import { auth } from '../../lib/firebase';
import { abrirWhatsApp } from '../../services/whatsappService';

const normStr = (str) =>
    String(str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function MisPacientes() {
    const navigate = useNavigate();
    const [todosPacientes, setTodosPacientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [alcance, setAlcance] = useState('mios'); // 'mios' | 'todos'
    const [filtroCategoria, setFiltroCategoria] = useState('Todos'); // 'Todos' | 'Activos' | 'Con Alerta Médica'
    const [staffInfo, setStaffInfo] = useState({ id: '', uid: '', nombre: '' });

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) {
            setLoading(false);
            return;
        }

        let unsubPacientes = () => {};

        getStaffDocByUid(user.uid, user.email, user.displayName).then(staffDoc => {
            const info = {
                id: staffDoc?.id || user.uid,
                uid: user.uid,
                nombre: staffDoc?.nombre || user.displayName || ''
            };
            setStaffInfo(info);

            unsubPacientes = onPacientesChange((lista) => {
                setTodosPacientes(lista || []);
                setLoading(false);
            });
        }).catch(err => {
            console.error("Error al obtener datos del especialista:", err);
            setLoading(false);
        });

        return () => unsubPacientes();
    }, []);

    // Pacientes asignados a este especialista (por ID de staff, UID o nombre)
    const misPacientesAsignados = useMemo(() => {
        const targetName = normStr(staffInfo.nombre);
        return todosPacientes.filter(p => {
            const espAsig = String(p.especialistaAsignado || p.especialistaId || '').trim();
            if (espAsig && (espAsig === staffInfo.id || espAsig === staffInfo.uid)) return true;
            const espNom = normStr(p.especialistaNombre || p.especialistaAsignadoNombre || '');
            if (espNom && targetName && (espNom === targetName || espNom.includes(targetName) || targetName.includes(espNom))) {
                return true;
            }
            return false;
        });
    }, [todosPacientes, staffInfo]);

    // Si el especialista aún no tiene pacientes asignados directamente o busca un paciente en general, permitir ver todos
    const baseList = alcance === 'todos' ? todosPacientes : misPacientesAsignados;

    const pacientesFiltrados = useMemo(() => {
        return baseList.filter(p => {
            const tieneAlerta = Boolean(
                (p.alergias && normStr(p.alergias) !== 'ninguna' && normStr(p.alergias) !== 'no') ||
                (p.condicionesMedicas && normStr(p.condicionesMedicas) !== 'ninguna' && normStr(p.condicionesMedicas) !== 'no')
            );
            if (filtroCategoria === 'Activos' && (p.estado || 'Activo') !== 'Activo') return false;
            if (filtroCategoria === 'Con Alerta Médica' && !tieneAlerta) return false;

            if (busqueda.trim()) {
                const q = busqueda.toLowerCase();
                return (
                    (p.nombre || '').toLowerCase().includes(q) ||
                    (p.email || '').toLowerCase().includes(q) ||
                    (p.telefono || '').includes(q) ||
                    (p.tipoTratamiento || '').toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [baseList, filtroCategoria, busqueda]);

    return (
        <div className="space-y-6">
            {/* CABECERA Y CONTROLES */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-black text-acero flex items-center gap-2">
                            <UsersIcon className="text-turquesa" size={22} /> Expedientes de Pacientes
                        </h2>
                        <p className="text-gray-400 text-xs font-medium mt-0.5">
                            Acceso rápido a expedientes clínicos, registro de sesión en cabina y seguimiento
                        </p>
                    </div>

                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, teléfono o tratamiento..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:border-turquesa outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                    <div className="inline-flex bg-gray-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setAlcance('mios')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                alcance === 'mios' ? 'bg-turquesa text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            👤 Mis Asignados ({misPacientesAsignados.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setAlcance('todos')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                alcance === 'todos' ? 'bg-turquesa text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            🏥 Directorio Clínico ({todosPacientes.length})
                        </button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                        {['Todos', 'Activos', 'Con Alerta Médica'].map(cat => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setFiltroCategoria(cat)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                    filtroCategoria === cat
                                        ? 'bg-acero text-white border-acero'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-acero/40'
                                }`}
                            >
                                {cat === 'Con Alerta Médica' ? '⚠️ Con Alerta Médica' : cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="p-12 flex flex-col items-center justify-center text-gray-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-turquesa mb-4"></div>
                    <p className="text-xs font-bold uppercase tracking-widest">Sincronizando expedientes...</p>
                </div>
            ) : pacientesFiltrados.length === 0 ? (
                <Card className="p-12 flex flex-col items-center justify-center text-gray-400 bg-white border-dashed border-2 rounded-3xl text-center space-y-3">
                    <UserCircle size={48} className="opacity-20 text-acero" />
                    <p className="font-black text-acero uppercase tracking-widest text-sm">
                        {alcance === 'mios' ? 'Sin pacientes asignados directamente a tu perfil' : 'No se encontraron pacientes con ese criterio'}
                    </p>
                    {alcance === 'mios' && todosPacientes.length > 0 && (
                        <>
                            <p className="text-xs text-gray-500 max-w-md">
                                Hay {todosPacientes.length} pacientes registrados en la clínica. Puedes ver todo el directorio clínico para abrir cualquier expediente o registrar una sesión.
                            </p>
                            <Button variant="primary" size="sm" onClick={() => setAlcance('todos')}>
                                🏥 Ver Todos los Pacientes de la Clínica ({todosPacientes.length})
                            </Button>
                        </>
                    )}
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {pacientesFiltrados.map((paciente) => {
                        const tieneAlergia = Boolean(
                            paciente.alergias &&
                            normStr(paciente.alergias) !== 'ninguna' &&
                            normStr(paciente.alergias) !== 'no'
                        );
                        const tieneCondicion = Boolean(
                            paciente.condicionesMedicas &&
                            normStr(paciente.condicionesMedicas) !== 'ninguna' &&
                            normStr(paciente.condicionesMedicas) !== 'no'
                        );
                        const sellos = Number(paciente.sellosLealtad || 0);

                        return (
                            <Card key={paciente.id} className="group hover:border-turquesa transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between">
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-3">
                                            {paciente.fotoPerfil ? (
                                                <img
                                                    src={paciente.fotoPerfil}
                                                    alt={paciente.nombre}
                                                    className="w-12 h-12 rounded-2xl object-cover border border-turquesa/30"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-2xl bg-turquesa/10 flex items-center justify-center text-turquesa font-black text-xl">
                                                    {paciente.nombre?.charAt(0) || '?'}
                                                </div>
                                            )}
                                            <div>
                                                <h3
                                                    onClick={() => navigate(`/especialista/expediente/${paciente.id}`)}
                                                    className="font-black text-acero leading-tight group-hover:text-turquesa transition-colors text-base cursor-pointer"
                                                >
                                                    {paciente.nombre}
                                                </h3>
                                                <p className="text-[11px] text-turquesa font-bold flex items-center gap-1 mt-0.5">
                                                    <Sparkles size={12} /> {paciente.tipoTratamiento || 'Valoración General'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase ${
                                            (paciente.estado || 'Activo') === 'Activo'
                                                ? 'bg-green-50 text-green-600 border border-green-200'
                                                : 'bg-gray-100 text-gray-500'
                                        }`}>
                                            {paciente.estado || 'Activo'}
                                        </span>
                                    </div>

                                    {/* Alertas médicas visibles */}
                                    {(tieneAlergia || tieneCondicion) && (
                                        <div className="mb-3 p-2 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-700 text-xs">
                                            <AlertTriangle size={14} className="shrink-0 mt-0.5 text-red-600" />
                                            <div className="leading-snug">
                                                {tieneAlergia && <p className="font-black">Alergias: <span className="font-medium">{paciente.alergias}</span></p>}
                                                {tieneCondicion && <p className="font-bold">Condición: <span className="font-medium">{paciente.condicionesMedicas}</span></p>}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1.5 mb-4 text-xs text-gray-500">
                                        {paciente.telefono && (
                                            <div className="flex items-center justify-between">
                                                <span className="flex items-center gap-1.5">
                                                    <Phone size={13} className="text-gray-400" /> {paciente.telefono}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">
                                                    <Award size={12} /> Lealtad: {sellos}/7
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5">
                                            <Calendar size={13} className="text-gray-400" />
                                            <span>Registro: {paciente.createdAt ? new Date(paciente.createdAt).toLocaleDateString('es-MX') : '—'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        icon={Play}
                                        className="flex-1"
                                        onClick={() => navigate(`/especialista/expediente/${paciente.id}?nuevaSesion=1`)}
                                    >
                                        Nueva Sesión
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        icon={ExternalLink}
                                        className="flex-1"
                                        onClick={() => navigate(`/especialista/expediente/${paciente.id}`)}
                                    >
                                        Expediente
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
