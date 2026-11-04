import { NavLink } from 'react-router-dom';
import React from 'react';
import {
    LayoutDashboard, Users as UsersIcon, Calendar, DollarSign, LogOut,
    Stethoscope, Tag, PiggyBank, TrendingUp, UserPlus, Archive, Megaphone, User,
    CreditCard, PieChart, ClipboardList, Bell, Clock, Sparkles
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getStaffDocByUid, onStaffDocChange } from '../../services/staffService';

export default function Sidebar() {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const { userRole, logout, currentUser } = useAuth();
    const [staffPerfil, setStaffPerfil] = useState(null);

    useEffect(() => {
        let unsub = () => {};
        if (currentUser?.uid && userRole && userRole !== 'Paciente') {
            getStaffDocByUid(currentUser.uid, currentUser.email, currentUser.displayName).then(doc => {
                if (doc) {
                    setStaffPerfil(doc);
                    unsub = onStaffDocChange(doc.id, (updated) => {
                        if (updated) setStaffPerfil(updated);
                    });
                }
            }).catch(() => {});
        }
        return () => unsub();
    }, [currentUser, userRole]);

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
            { name: 'Solicitudes', icon: ClipboardList, path: '/solicitudes' },
            { name: 'Limpieza y Mant.', icon: Sparkles, path: '/admin-tareas-limpieza' },
            { name: 'Checador y Asistencia', icon: Clock, path: '/checador' },
            { name: 'Inventario', icon: Archive, path: '/inventario' },
            { name: 'Mi Perfil', icon: User, path: '/mi-perfil' },
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
            { name: 'Mi Perfil', icon: User, path: '/mi-perfil' },
        ];
    } else if (userRole === 'Especialista' || userRole === 'Doctor') {
        menuItems = [
            { name: 'Mi Agenda', icon: Calendar, path: '/agenda' },
            { name: 'Mis Comisiones', icon: DollarSign, path: '/mis-comisiones' },
            { name: 'Mis Pacientes', icon: UsersIcon, path: '/mis-pacientes' },
            { name: 'Checador Digital', icon: Clock, path: '/checador' },
            { name: 'Inventario', icon: Archive, path: '/inventario' },
            { name: 'Mi Perfil', icon: User, path: '/mi-perfil' },
        ];
    } else if (userRole === 'Paciente') {
        menuItems = [
            { name: 'Mi Perfil', icon: User, path: '/pacientes' },
            { name: 'Novedades', icon: Megaphone, path: '/promociones' }
        ];
    } else if (userRole === 'Limpieza') {
        menuItems = [
            { name: 'Dashboard', icon: Sparkles, path: '/limpieza' },
            { name: 'Checador Digital', icon: Clock, path: '/checador' },
            { name: 'Mi Perfil', icon: User, path: '/mi-perfil' },
        ];
    }

    return (
        <aside className="hidden md:flex flex-col w-64 3xl:w-72 4xl:w-80 h-screen bg-blancoPuro border-r border-gray-200">
            <div className="pt-6 pb-4 px-5 flex flex-col items-center w-full border-b border-gray-100/80 mb-2">
                <div className="relative flex items-center justify-center mb-2">
                    <img 
                        src="/logo.png" 
                        alt="Clínica ALFRA" 
                        className="w-44 max-w-[185px] h-auto object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300" 
                    />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-turquesa/10 border border-turquesa/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-turquesa animate-pulse" />
                    <p className="text-[10px] text-center text-turquesa font-black uppercase tracking-widest">{userRole}</p>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all-200 uppercase tracking-widest text-[10px] ${isActive
                                ? 'bg-turquesa text-white font-black shadow-md'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-acero font-bold'
                            }`
                        }
                    >
                        <item.icon size={16} />
                        <span>{item.name}</span>
                    </NavLink>
                ))}
            </nav>

                        <div className="p-3 border-t border-gray-100 space-y-2">
                {userRole !== 'Paciente' && (
                    <NavLink
                        to="/mi-perfil"
                        className={({ isActive }) =>
                            `flex items-center gap-3 p-2 rounded-2xl transition-all ${
                                isActive ? 'bg-turquesa/10 border border-turquesa/30 shadow-xs' : 'hover:bg-slate-50 border border-transparent'
                            }`
                        }
                    >
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-teal-300 border border-teal-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                            {(staffPerfil?.fotoUrl || currentUser?.photoURL) ? (
                                <img src={staffPerfil?.fotoUrl || currentUser?.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <User size={16} />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">
                                {staffPerfil?.alias || staffPerfil?.nombre || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Mi Perfil'}
                            </p>
                            <p className="text-[10px] text-teal-700 font-bold uppercase truncate flex items-center gap-1">
                                <Sparkles size={10} /> Personalizar Perfil
                            </p>
                        </div>
                    </NavLink>
                )}

                <button
                    onClick={logout}
                    className="flex items-center gap-3 px-3 py-2 w-full text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-xl text-xs font-bold transition-all-200 cursor-pointer"
                >
                    <LogOut size={16} />
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    );
}
