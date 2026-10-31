import { Outlet, NavLink } from 'react-router-dom';
import Sidebar from './Sidebar';
import React from 'react';
import {
    LayoutDashboard, Users as UsersIcon, User, Calendar, DollarSign, Stethoscope,
    Tag, PiggyBank, TrendingUp, LogOut, Menu, X, UserPlus, Archive,
    CreditCard, PieChart, ClipboardList, Bell, Megaphone, Sparkles, Clock
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { emitirNotificacion, solicitarPermisoNotificaciones } from '../../services/notificationService';
import { onAlertasAdminChange, onAlertasPacienteChange, onAlertasEspecialistaChange, markAlertAsRead } from '../../services/citasService';
import { getPacienteByUid } from '../../services/pacientesService';
import { getStaffDocByUid } from '../../services/staffService';
import { getAuth } from 'firebase/auth';

export default function AppLayout() {
    const { userRole, logout } = useAuth();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [alertas, setAlertas] = useState([]);
    const [showAlertas, setShowAlertas] = useState(false);
    const prevAlertIds = React.useRef(new Set());
    const isFirstAlertLoad = React.useRef(true);

    const procesarAlertas = (alerts) => {
        setAlertas(alerts);
        // Si no es la primera carga inicial, emitir notificacion del sistema y sonido al llegar una alerta nueva
        if (!isFirstAlertLoad.current) {
            const nuevas = alerts.filter(a => !prevAlertIds.current.has(a.id));
            if (nuevas.length > 0) {
                const primera = nuevas[0];
                emitirNotificacion('Clinica ALFRA', {
                    body: primera.mensaje,
                    tag: 'alerta-' + primera.id,
                    onClick: () => setShowAlertas(true)
                });
            }
        } else {
            isFirstAlertLoad.current = false;
        }
        prevAlertIds.current = new Set(alerts.map(a => a.id));
    };

    useEffect(() => {
        let active = true;
        let unsub = () => {};

        // Solicitar permisos nativos y de navegador al montar la sesion
        solicitarPermisoNotificaciones().catch(() => {});

        const setupAlerts = async () => {
            if (userRole === 'Administrador' || userRole === 'Recepcionista') {
                unsub = onAlertasAdminChange((alerts) => {
                    if (active) procesarAlertas(alerts);
                });
            } else if (userRole === 'Especialista' || userRole === 'Doctor') {
                const auth = getAuth();
                const uid = auth.currentUser?.uid;
                if (uid) {
                    const staffDoc = await getStaffDocByUid(uid);
                    if (!active) return;
                    const docId = staffDoc ? staffDoc.id : uid;
                    unsub = onAlertasEspecialistaChange(docId, (alerts) => {
                        if (active) procesarAlertas(alerts);
                    });
                }
            } else if (userRole === 'Paciente' || userRole === 'Limpieza') {
                const auth = getAuth();
                const uid = auth.currentUser?.uid;
                if (uid) {
                    const p = await getPacienteByUid(uid);
                    if (!active) return;
                    if (p?.id) {
                        unsub = onAlertasPacienteChange(p.id, (alerts) => {
                            if (active) procesarAlertas(alerts);
                        });
                    }
                }
            }
        };

        setupAlerts();

        return () => {
            active = false;
            unsub();
        };
    }, [userRole]);

    const handleDismissAlerta = async (id) => {
        await markAlertAsRead(id);
    };

    let menuItems = [];
    if (userRole === 'Administrador') {
        menuItems = [
            { name: 'Dashboard KPIs', icon: LayoutDashboard, path: '/dashboard' },
            { name: 'Pacientes', icon: UserPlus, path: '/admin-pacientes' },
            { name: 'Membresías', icon: CreditCard, path: '/membresias' },
            { name: 'Servicios y Marketing', icon: Tag, path: '/comercial' },
            { name: 'Agenda Global', icon: Calendar, path: '/agenda-global' },
            { name: 'Gestión Nómina', icon: UsersIcon, path: '/nomina' },
            { name: 'Contabilidad', icon: TrendingUp, path: '/finanzas' },
            { name: 'Corte de Caja', icon: DollarSign, path: '/corte-caja' },
            { name: 'Paquetes de Tratamientos', icon: ClipboardList, path: '/financiamientos' },
            { name: 'Reportes', icon: PieChart, path: '/reportes' },
            { name: 'Auditoría Clínica', icon: Stethoscope, path: '/auditoria' },
            { name: 'Limpieza y Mant.', icon: Sparkles, path: '/admin-tareas-limpieza' },
            { name: 'Checador y Asistencia', icon: Clock, path: '/checador' },
            { name: 'Inventario', icon: Archive, path: '/inventario' },
        ];
    } else if (userRole === 'Recepcionista') {
        menuItems = [
            { name: 'Calendario Global', icon: Calendar, path: '/citas' },
            { name: 'Recepción y Caja', icon: DollarSign, path: '/caja' },
            { name: 'Pacientes', icon: UserPlus, path: '/admin-pacientes' },
            { name: 'Membresías', icon: CreditCard, path: '/membresias' },
            { name: 'Paquetes de Tratamientos', icon: ClipboardList, path: '/financiamientos' },
            { name: 'Checador Digital', icon: Clock, path: '/checador' },
            { name: 'Inventario', icon: Archive, path: '/inventario' },
        ];
    } else if (userRole === 'Especialista' || userRole === 'Doctor') {
        menuItems = [
            { name: 'Mi Agenda', icon: Calendar, path: '/agenda' },
            { name: 'Mis Comisiones', icon: DollarSign, path: '/mis-comisiones' },
            { name: 'Mis Pacientes', icon: UsersIcon, path: '/mis-pacientes' },
            { name: 'Checador Digital', icon: Clock, path: '/checador' },
            { name: 'Inventario', icon: Archive, path: '/inventario' },
        ];
    } else if (userRole === 'Limpieza') {
        menuItems = [
            { name: 'Aseo y Limpieza', icon: Sparkles, path: '/limpieza' },
        ];
    } else if (userRole === 'Paciente') {
        menuItems = [
            { name: 'Mi Perfil', icon: User, path: '/pacientes' },
            { name: 'Novedades', icon: Megaphone, path: '/promociones' },
        ];
    }

    return (
        <div className="flex h-screen bg-fondo font-sans">

            {/* ── DESKTOP SIDEBAR (hidden on mobile) ── */}
            <Sidebar />

            <main className="flex-1 flex flex-col h-full overflow-hidden relative">

                {/* ── MOBILE HEADER ── */}
                {/* MOBILE HEADER (Optimizada para pantalla móvil HD) */}
                <header className="md:hidden flex items-center justify-between px-3.5 sm:px-4 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm z-40 sticky top-0"
                    style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: '6px', minHeight: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
                    {/* Logo elegante, nítido y de alta definición */}
                    <img
                        src="/logo.png"
                        alt="ALFRA Clínica"
                        style={{ height: '44px', width: 'auto', objectFit: 'contain', maxWidth: '60%' }}
                        className="drop-shadow-sm active:scale-95 transition-transform"
                    />
                    <div className="flex items-center gap-2">
                    {(userRole === 'Administrador' || userRole === 'Especialista' || userRole === 'Doctor' || userRole === 'Paciente' || userRole === 'Limpieza') && (
                        <button
                            onClick={() => setShowAlertas(!showAlertas)}
                            className="relative p-2.5 rounded-xl bg-turquesa/10 active:bg-turquesa/25 transition-colors flex items-center justify-center"
                            style={{ minWidth: '44px', minHeight: '44px' }}
                        >
                            <Bell size={22} className="text-turquesa" />
                            {alertas.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                    {alertas.length}
                                </span>
                            )}
                        </button>
                    )}
                    {/* Botón abrir menú lateral */}
                    <button
                        onClick={() => setDrawerOpen(true)}
                        className="flex items-center justify-center p-2.5 rounded-xl bg-turquesa/10 active:bg-turquesa/25 transition-colors"
                        style={{ minWidth: '44px', minHeight: '44px' }}
                        aria-label="Abrir men?"
                    >
                        <Menu size={26} className="text-turquesa" strokeWidth={2.5} />
                    </button>
                    </div>
                </header>

                {/* PANEL DE NOTIFICACIONES */}
                {showAlertas && (
                    <div className="fixed inset-0 z-50" onClick={() => setShowAlertas(false)}>
                        <div className="absolute top-0 right-0 left-0 md:left-auto md:right-4 md:top-4 md:w-96 bg-white rounded-b-3xl md:rounded-3xl shadow-2xl border border-gray-100 max-h-[80vh] overflow-hidden animate-in slide-in-from-top duration-300" onClick={e => e.stopPropagation()}>
                            <div className="bg-gradient-to-r from-acero to-[#1a3040] p-5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Bell size={20} className="text-turquesa" />
                                    <h3 className="text-white font-black text-sm uppercase tracking-widest">Notificaciones</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-turquesa/20 text-turquesa text-[10px] font-black px-2.5 py-1 rounded-full">{alertas.length}</span>
                                    {alertas.length > 0 && (
                                        <button onClick={async () => { for (const a of alertas) await handleDismissAlerta(a.id); }} className="text-white/60 hover:text-white text-[10px] font-bold underline">Limpiar</button>
                                    )}
                                </div>
                            </div>
                            <div className="overflow-y-auto max-h-[60vh] p-3 space-y-2">
                                {alertas.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Bell size={32} className="text-gray-200 mx-auto mb-3" />
                                        <p className="text-gray-400 text-sm font-bold">Sin notificaciones pendientes</p>
                                    </div>
                                ) : alertas.map(a => (
                                    <div key={a.id} onClick={() => handleDismissAlerta(a.id)} className="flex items-start gap-3 p-3 bg-turquesa/5 rounded-2xl border border-turquesa/10 hover:bg-turquesa/15 transition-all group cursor-pointer" title="Clic para descartar y marcar como leida">
                                        <div className="w-8 h-8 bg-turquesa/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                                            <Bell size={14} className="text-turquesa" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-800 font-medium leading-snug">{a.mensaje}</p>
                                            <p className="text-[10px] text-gray-400 font-bold mt-1">
                                                {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleString('es-MX', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : ''}
                                            </p>
                                        </div>
                                        <button onClick={() => handleDismissAlerta(a.id)} className="text-gray-400 hover:text-red-500 active:text-red-600 p-2 rounded-xl hover:bg-red-50 active:bg-red-100 transition-all" title="Marcar como leida">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── OVERLAY ── */}
                {drawerOpen && (
                    <div
                        className="md:hidden fixed inset-0 bg-black/50 z-50"
                        onClick={() => setDrawerOpen(false)}
                    />
                )}

                {/* ── DRAWER LATERAL (desde la IZQUIERDA) ── */}
                <div
                    className={`md:hidden fixed top-0 left-0 h-full bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
                    style={{ width: 'min(300px, 85vw)', paddingTop: 'env(safe-area-inset-top, 0px)' }}
                >
                    {/* Encabezado del drawer — logo grande */}
                    <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100 bg-gradient-to-r from-turquesa/5 to-transparent">
                        <img
                            src="/logo.png"
                            alt="ALFRA Clínica"
                            style={{ height: '56px', width: 'auto', objectFit: 'contain', maxWidth: '75%' }} className="drop-shadow-sm"
                        />
                        <button
                            onClick={() => setDrawerOpen(false)}
                            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:bg-gray-200"
                        >
                            <X size={26} />
                        </button>
                    </div>

                    {/* Badge de rol */}
                    <div className="px-5 py-3">
                        <span className="text-xs font-bold text-turquesa uppercase tracking-widest bg-turquesa/10 px-3 py-1.5 rounded-full">
                            {userRole}
                        </span>
                    </div>

                    {/* Lista de navegación */}
                    <nav className="flex-1 px-4 py-2 overflow-y-auto space-y-1">
                        {menuItems.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.path}
                                onClick={() => setDrawerOpen(false)}
                                className={({ isActive }) =>
                                    `flex items-center gap-4 px-4 py-4 rounded-2xl font-semibold text-[15px] transition-all ${isActive
                                        ? 'bg-turquesa text-white shadow-md'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-acero active:bg-gray-100'
                                    }`
                                }
                            >
                                <item.icon size={22} />
                                <span>{item.name}</span>
                            </NavLink>
                        ))}
                    </nav>

                    {/* Cerrar sesión al fondo, encima de los botones del sistema */}
                    <div className="px-4 pb-4 pt-2 border-t border-gray-100"
                        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}>
                        <button
                            onClick={() => { logout(); setDrawerOpen(false); }}
                            className="flex items-center gap-4 px-4 py-4 w-full text-red-500 bg-red-50 hover:bg-red-100 active:bg-red-200 rounded-2xl font-semibold text-[15px] transition-all"
                        >
                            <LogOut size={22} />
                            <span>Cerrar Sesión</span>
                        </button>
                    </div>
                </div>

                {/* ── CONTENIDO DE LA PÁGINA ── */}
                {/* paddingBottom con safe-area para que los botones del sistema no tapen nada */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-8 3xl:p-12 4xl:p-16"
                    style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
                    <Outlet />
                </div>

            </main>
        </div>
    );
}
