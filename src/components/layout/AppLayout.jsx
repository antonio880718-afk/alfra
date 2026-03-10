import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import Sidebar from './Sidebar';
import {
    LayoutDashboard, Users as UsersIcon, Calendar, DollarSign, Stethoscope,
    Tag, PiggyBank, TrendingUp, LogOut, Menu, X, UserPlus, Archive
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function AppLayout() {
    const { userRole, logout } = useAuth();
    const [drawerOpen, setDrawerOpen] = useState(false);

    let menuItems = [];
    if (userRole === 'Administrador') {
        menuItems = [
            { name: 'Dashboard KPIs', icon: LayoutDashboard, path: '/dashboard' },
            { name: 'Pacientes', icon: UserPlus, path: '/admin-pacientes' },
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
            { name: 'Mi Perfil Wellness', icon: Stethoscope, path: '/pacientes' },
        ];
    }

    return (
        <div className="flex h-screen bg-fondo font-sans">

            {/* ── DESKTOP SIDEBAR (hidden on mobile) ── */}
            <Sidebar />

            <main className="flex-1 flex flex-col h-full overflow-hidden relative">

                {/* ── MOBILE HEADER ── */}
                <header className="md:hidden flex items-center justify-between px-4 bg-white border-b border-gray-100 shadow-sm z-40"
                    style={{ paddingTop: 'env(safe-area-inset-top, 0px)', minHeight: '110px' }}>
                    {/* Logo grande 3x */}
                    <img
                        src="/logo.png.png"
                        alt="ALFRA Clínica"
                        style={{ height: '96px', width: 'auto', objectFit: 'contain', maxWidth: '75%' }}
                    />
                    {/* Botón abrir menú lateral */}
                    <button
                        onClick={() => setDrawerOpen(true)}
                        className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-turquesa/10 active:bg-turquesa/25"
                        style={{ minWidth: '56px', minHeight: '56px' }}
                        aria-label="Abrir menú"
                    >
                        <Menu size={30} className="text-turquesa" strokeWidth={2.5} />
                    </button>
                </header>

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
                    style={{ width: '280px', paddingTop: 'env(safe-area-inset-top, 0px)' }}
                >
                    {/* Encabezado del drawer — logo grande */}
                    <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100 bg-gradient-to-r from-turquesa/5 to-transparent">
                        <img
                            src="/logo.png.png"
                            alt="ALFRA Clínica"
                            style={{ height: '100px', width: 'auto', objectFit: 'contain', maxWidth: '70%' }}
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
                <div className="flex-1 overflow-y-auto p-4 md:p-8"
                    style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
                    <Outlet />
                </div>

            </main>
        </div>
    );
}
