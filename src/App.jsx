import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

// Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPacientes from './pages/admin/AdminPacientes';
import NominaView from './pages/admin/NominaView';
import SupervisionAgenda from './pages/admin/SupervisionAgenda';
import AuditoriaClinica from './pages/admin/AuditoriaClinica';
import GestionComercial from './pages/admin/GestionComercial';
import CorteCajaGlobal from './pages/admin/CorteCajaGlobal';
import ControlFinanciamientos from './pages/admin/ControlFinanciamientos';
import ContabilidadView from './pages/admin/ContabilidadView';
import CalendarioCitas from './pages/recepcion/CalendarioCitas';
import CajaView from './pages/recepcion/CajaView';
import AgendaDiaria from './pages/especialista/AgendaDiaria';
import MisPacientes from './pages/especialista/MisPacientes';
import ExpedienteClinico from './pages/especialista/ExpedienteClinico';
import PacienteProfile from './pages/paciente/PacienteProfile';
import RegistroPaciente from './pages/auth/RegistroPaciente';
import InventarioView from './pages/inventario/InventarioView';
import { Activity, Calendar, DollarSign, Users as UsersIcon } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('Administrador');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setIsSubmitting(true);
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Credenciales incorrectas o usuario no encontrado.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-fondo relative overflow-hidden px-4">
      <div className="absolute top-10 left-10 w-64 h-64 bg-turquesa/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-acero/10 rounded-full blur-3xl"></div>

      <div className="bg-blancoPuro p-8 sm:p-12 rounded-2xl shadow-xl border border-gray-100 w-full max-w-md text-center relative z-10">
        <img src="/logo.png.png" alt="ALFRA" className="h-56 w-auto mx-auto object-contain mb-8 hover:scale-105 transition-transform duration-300" />
        <h1 className="text-3xl text-acero font-bold mb-2 tracking-tight">Bienvenido a ALFRA</h1>
        <p className="text-gray-500 mb-8 font-medium">Ingresa tus credenciales para acceder</p>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all"
              placeholder="alfra@clinica.com"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 mt-2 bg-turquesa text-white font-bold text-lg rounded-xl hover:bg-opacity-90 transition-all-200 transform hover:scale-[1.02] shadow-md hover:shadow-lg disabled:opacity-70 disabled:transform-none"
          >
            {isSubmitting ? 'Verificando...' : 'Ingresar al Sistema'}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-500 text-center">
          ¿Eres paciente nuevo?{' '}
          <Link to="/registro" className="text-turquesa font-bold hover:underline">
            Regístrate aquí
          </Link>
        </p>
        <p className="mt-4 text-xs text-gray-400">© 2026 Clínica ALFRA Cirugía y Medicina Estética | <span className="font-bold text-turquesa">v10.5.2 STABLE</span></p>
      </div>
    </div>
  );
};

const RoleRedirect = () => {
  const { userRole } = useAuth();
  if (userRole === 'Administrador') return <Navigate to="/dashboard" replace />;
  if (userRole === 'Recepcionista') return <Navigate to="/citas" replace />;
  if (userRole === 'Especialista') return <Navigate to="/agenda" replace />;
  if (userRole === 'Paciente') return <Navigate to="/pacientes" replace />;
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<RegistroPaciente />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<RoleRedirect />} />

                {/* Admin Routes */}
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="admin-pacientes" element={<AdminPacientes />} />
                <Route path="nomina" element={<NominaView />} />
                <Route path="agenda-global" element={<SupervisionAgenda />} />
                <Route path="auditoria" element={<AuditoriaClinica />} />
                <Route path="comercial" element={<GestionComercial />} />
                <Route path="corte-caja" element={<CorteCajaGlobal />} />
                <Route path="financiamientos" element={<ControlFinanciamientos />} />
                <Route path="finanzas" element={<ContabilidadView />} />

                {/* Recepcion Routes */}
                <Route path="citas" element={<CalendarioCitas />} />
                <Route path="caja" element={<CajaView />} />

                {/* Especialista Routes */}
                <Route path="agenda" element={<AgendaDiaria />} />
                <Route path="mis-pacientes" element={<MisPacientes />} />
                <Route path="especialista/expediente/:pacienteId" element={<ExpedienteClinico />} />

                {/* Paciente Routes */}
                <Route path="pacientes" element={<PacienteProfile />} />

                {/* Shared Routes - Visible to all roles */}
                <Route path="inventario" element={<InventarioView />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
