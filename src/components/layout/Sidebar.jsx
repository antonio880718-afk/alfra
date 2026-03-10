import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users as UsersIcon, Calendar, DollarSign, LogOut, Stethoscope, Tag, PiggyBank, TrendingUp, UserPlus, Archive } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Sidebar() {
    const { userRole, logout } = useAuth();

    let menuItems = [];
    if (userRole === 'Administrador') {
        menuItems = [
            { name: 'Dashboard KPIs', icon: LayoutDashboard, path: '/dashboard' },
            { name: 'Pacientes', icon: UserPlus, path: '/admin-pacientes' },
            { name: 'Catálogo y Precios', icon: Tag, path: '/comercial' },
            { name: 'Agenda Global', icon: Calendar, path: '/agenda-global' },
            { name: 'Gestión Nómina', icon: UsersIcon, path: '/nomina' },
            { name: 'Contabilidad', icon: TrendingUp, path: '/finanzas' },
            { name: 'Corte de Caja', icon: DollarSign, path: '/corte-caja' },
            { name: 'Financiamientos', icon: PiggyBank, path: '/financiamientos' },
            { name: 'Auditoría Clínica', icon: Stethoscope, path: '/auditoria' },
            { name: 'Inventario', icon: Archive, path: '/inventario' },
        ];
    } else if (userRole === 'Recepcionista') {
        menuItems = [
            { name: 'Calendario Global', icon: Calendar, path: '/citas' },
            { name: 'Recepción y Caja', icon: DollarSign, path: '/caja' },
            { name: 'Pacientes', icon: UserPlus, path: '/admin-pacientes' },
            { name: 'Inventario', icon: Archive, path: '/inventario' },
        ];
    } else if (userRole === 'Especialista') {
        menuItems = [
            { name: 'Mi Agenda', icon: Calendar, path: '/agenda' },
            { name: 'Mis Pacientes', icon: UsersIcon, path: '/mis-pacientes' },
            { name: 'Inventario', icon: Archive, path: '/inventario' },
        ];
    } else if (userRole === 'Paciente') {
        menuItems = [
            { name: 'Mi Perfil Wellness', icon: Stethoscope, path: '/pacientes' }
        ];
    }

    return (
        <aside className="hidden md:flex flex-col w-64 h-screen bg-blancoPuro border-r border-gray-200">
            <div className="p-4 sm:p-6 flex flex-col items-center w-full">
                <img src="/logo.png.png" alt="ALFRA" className="w-48 sm:w-56 h-auto object-contain mb-2 hover:scale-105 transition-transform duration-300" />
                <p className="text-xs text-center text-turquesa font-bold uppercase tracking-wider">{userRole}</p>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
                {menuItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-xl transition-all-200 ${isActive
                                ? 'bg-turquesa/10 text-turquesa font-semibold'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-acero'
                            }`
                        }
                    >
                        <item.icon size={20} />
                        <span>{item.name}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={logout}
                    className="flex items-center gap-3 px-4 py-3 w-full text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all-200"
                >
                    <LogOut size={20} />
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    );
}
