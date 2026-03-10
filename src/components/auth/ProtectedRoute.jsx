import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute({ allowedRoles }) {
    const { currentUser, userRole, loading } = useAuth();

    if (loading) {
        // Mostrar un spinner o loader estilizado
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-fondo">
                <div className="w-12 h-12 border-4 border-turquesa border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-acero font-medium animate-pulse">Cargando...</p>
            </div>
        );
    }

    if (!currentUser) {
        // Si no hay sesión activa, mandarlos a login
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        // Si su rol no está permitido en esta ruta, enviarlo al dashboard default
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}
