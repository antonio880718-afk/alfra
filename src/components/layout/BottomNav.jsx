import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Users, Calendar, DollarSign, Stethoscope,
    Tag, PiggyBank, TrendingUp, ClipboardList, ChevronUp, X, Megaphone, User, Clock,
    CreditCard, Archive, PieChart, UserPlus, Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function BottomNav() {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const { userRole } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);

    let allItems = [];
    if (userRole === 'Administrador') {
        allItems = [
            { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
            { name: 'Agenda', icon: Calendar, path: '/agenda-global' },
            { name: 'Nómina', icon: Users, path: '/nomina' },
            { name: 'Contabilidad', icon: TrendingUp, path: '/finanzas' },
            { name: 'Corte Caja', icon: DollarSign, path: '/corte-caja' },
            { name: 'Paquetes', icon: ClipboardList, path: '/financiamientos' },
            { name: 'Auditoría', icon: Stethoscope, path: '/auditoria' },
            { name: 'Pacientes', icon: UserPlus, path: '/admin-pacientes' },
            { name: 'Membres\u00edas', icon: CreditCard, path: '/membresias' },
            { name: 'Solicitudes', icon: PieChart, path: '/solicitudes' },
            { name: 'Checador', icon: Clock, path: '/checador' },
            { name: 'Inventario', icon: Archive, path: '/inventario' },
            { name: 'Marketing', icon: Tag, path: '/comercial' },
            { name: 'Reportes', icon: PieChart, path: '/reportes' },
            { name: 'Proyeccion IA', icon: TrendingUp, path: '/laboratorio-proyeccion-agenda' },
            { name: 'Finanzas IA', icon: TrendingUp, path: '/laboratorio-proyeccion-dashboard' },
            { name: 'Mi Perfil', icon: User, path: '/mi-perfil' },
        ];
    } else if (userRole === 'Recepcionista') {
        allItems = [
            { name: 'Citas', icon: Calendar, path: '/citas' },
            { name: 'Caja', icon: DollarSign, path: '/caja' },
            { name: 'Pacientes', icon: UserPlus, path: '/admin-pacientes' },
            { name: 'Membres\u00edas', icon: CreditCard, path: '/membresias' },
            { name: 'Paquetes', icon: ClipboardList, path: '/financiamientos' },
            { name: 'Checador', icon: Clock, path: '/checador' },
            { name: 'Inventario', icon: Archive, path: '/inventario' },
            { name: 'Mi Perfil', icon: User, path: '/mi-perfil' },
        ];
    } else if (userRole === 'Especialista' || userRole === 'Doctor') {
        allItems = [
            { name: 'Agenda', icon: Calendar, path: '/agenda' },
            { name: 'Comisiones', icon: DollarSign, path: '/mis-comisiones' },
            { name: 'Pacientes', icon: Users, path: '/mis-pacientes' },
            { name: 'Checador', icon: Clock, path: '/checador' },
            { name: 'Inventario', icon: Archive, path: '/inventario' },
            { name: 'Mi Perfil', icon: User, path: '/mi-perfil' },
        ];
    } else if (userRole === 'Paciente') {
        allItems = [
            { name: 'Mi Perfil', icon: User, path: '/pacientes' },
            { name: 'Novedades', icon: Megaphone, path: '/promociones' },
        ];
    } else if (userRole === 'Limpieza') {
        allItems = [
            { name: 'Limpieza', icon: Sparkles, path: '/limpieza' },
            { name: 'Checador', icon: Clock, path: '/checador' },
            { name: 'Mi Perfil', icon: User, path: '/mi-perfil' },
        ];
    }

    // On mobile: show first 4 in bottom bar + "Más" button if there are more
    const mainItems = allItems.slice(0, 4);
    const extraItems = allItems.slice(4);
    const hasMore = extraItems.length > 0;

    const navLinkClass = ({ isActive }) =>
        `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? 'text-turquesa' : 'text-gray-400 hover:text-acero'
        }`;

    return (
        <>
            {/* Overlay for the "Más" menu */}
            {menuOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/40 z-40"
                    onClick={() => setMenuOpen(false)}
                />
            )}

            {/* "Más" expandable panel */}
            {menuOpen && hasMore && (
                <div className="md:hidden fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 shadow-2xl z-50 rounded-t-2xl px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Más módulos</p>
                        <button onClick={() => setMenuOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {extraItems.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.path}
                                onClick={() => setMenuOpen(false)}
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center p-3 rounded-xl transition-colors gap-1 ${isActive ? 'bg-turquesa/10 text-turquesa' : 'text-gray-500 hover:bg-gray-50'
                                    }`
                                }
                            >
                                <item.icon size={22} />
                                <span className="text-[10px] font-medium text-center leading-tight">{item.name}</span>
                            </NavLink>
                        ))}
                    </div>
                </div>
            )}

            {/* Bottom navigation bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-50 shadow-lg">
                <div className="flex justify-around items-center h-16">
                    {mainItems.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.path}
                            className={navLinkClass}
                        >
                            <item.icon size={20} />
                            <span className="text-[10px] font-medium">{item.name}</span>
                        </NavLink>
                    ))}

                    {hasMore && (
                        <button
                            onClick={() => setMenuOpen(!menuOpen)}
                            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${menuOpen ? 'text-turquesa' : 'text-gray-400'
                                }`}
                        >
                            <ChevronUp size={20} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                            <span className="text-[10px] font-medium">Más</span>
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
