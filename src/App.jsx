import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

// Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPacientes from './pages/admin/AdminPacientes';
import MembresiasView from './pages/admin/MembresiasView';
import NominaView from './pages/admin/NominaView';
import SupervisionAgenda from './pages/admin/SupervisionAgenda';
import AuditoriaClinica from './pages/admin/AuditoriaClinica';
import GestionComercial from './pages/admin/GestionComercial';
import CorteCajaGlobal from './pages/admin/CorteCajaGlobal';
import ControlFinanciamientos from './pages/admin/ControlFinanciamientos';
import ContabilidadView from './pages/admin/ContabilidadView';
import ReportesView from './pages/admin/ReportesView';
import LaboratorioAgendaInteligente from './pages/admin/LaboratorioAgendaInteligente';
import LaboratorioDashboardFinanciero from './pages/admin/LaboratorioDashboardFinanciero';
import CalendarioCitas from './pages/recepcion/CalendarioCitas';
import CajaView from './pages/recepcion/CajaView';
import AgendaDiaria from './pages/especialista/AgendaDiaria';
import MisPacientes from './pages/especialista/MisPacientes';
import MisComisiones from './pages/especialista/MisComisiones';
import ExpedienteClinico from './pages/especialista/ExpedienteClinico';
import PacienteProfile from './pages/paciente/PacienteProfile';
import Promociones from './pages/paciente/Promociones';
import LimpiezaDashboard from './pages/limpieza/LimpiezaDashboard';
import AdminTareasLimpieza from './pages/admin/AdminTareasLimpieza';
import RegistroPaciente from './pages/auth/RegistroPaciente';
import InventarioView from './pages/inventario/InventarioView';
import MiPerfilColaborador from './pages/staff/MiPerfilColaborador';
import SolicitudesView from './pages/admin/SolicitudesView';
import ChecadorView from './pages/ChecadorView';
import { Activity, Calendar, DollarSign, Users as UsersIcon, Stethoscope, Sparkles, AlertTriangle } from 'lucide-react';

const Login = () => {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('Administrador');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Leer aviso de bloqueo si el usuario fue expulsado o revocado previamente
  useEffect(() => {
    const savedError = sessionStorage.getItem('loginError');
    if (savedError) {
      setError(savedError);
      sessionStorage.removeItem('loginError');
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setIsSubmitting(true);
      await login(email, password);
      navigate('/');
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('ACCESO DENEGADO')) {
        setError(msg);
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Credenciales incorrectas o usuario no encontrado.');
      } else {
        setError(msg || 'Credenciales incorrectas o usuario no encontrado.');
      }
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Por favor, ingresa tu correo electrónico primero.");
      return;
    }
    try {
      await resetPassword(email);
      alert("Se ha enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.");
    } catch (err) {
      alert("Error al enviar el correo: " + err.message);
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex flex-col items-center justify-center bg-fondo relative overflow-y-auto px-4 py-8 sm:py-12"
      style={{ 
        paddingTop: 'max(env(safe-area-inset-top, 0px), 2rem)', 
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 2rem)' 
      }}
    >
      <div className="absolute top-10 left-10 w-64 h-64 bg-turquesa/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-acero/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="bg-blancoPuro p-6 sm:p-10 rounded-3xl shadow-2xl border border-gray-100/80 w-full max-w-md text-center relative z-10 my-auto backdrop-blur-sm">
        {/* Presentación protagónica y de alta definición del logotipo ALFRA */}
        <div className="relative inline-flex items-center justify-center mb-4">
          <div className="absolute inset-0 bg-turquesa/15 rounded-full blur-2xl transform scale-125 pointer-events-none" />
          <img 
            src="/logo.png" 
            alt="Clínica ALFRA" 
            className="relative z-10 h-36 sm:h-44 md:h-48 w-auto object-contain drop-shadow-md hover:scale-[1.03] transition-all duration-300"
            loading="eager"
            decoding="async" 
          />
        </div>
        <h1 className="text-xl sm:text-2xl text-acero font-black mb-1 tracking-tight uppercase">Bienvenido a ALFRA</h1>
        <p className="text-turquesa font-bold text-xs sm:text-sm tracking-[0.2em] uppercase mb-1">Cirugía & Medicina Estética</p>
        <p className="text-gray-400 font-medium text-[11px] sm:text-xs italic mb-6">"Resaltando tu bienestar y belleza natural"</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 text-red-700 rounded-2xl text-sm font-bold text-left flex items-start gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
            <div className="p-2 bg-red-600 text-white rounded-xl shrink-0 mt-0.5 shadow-md">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <p className="font-black text-red-900 uppercase text-xs tracking-wider mb-1">Aviso de Seguridad</p>
              <p className="text-red-800 leading-snug">{error}</p>
            </div>
          </div>
        )}

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

        <p className="mt-4 text-sm text-center">
          <button 
            onClick={handleForgotPassword} 
            className="text-turquesa font-bold hover:underline"
            type="button"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </p>

        <p className="mt-6 text-sm text-gray-500 text-center">
          ¿Eres paciente nuevo?{' '}
          <Link to="/registro" className="text-turquesa font-bold hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
};

const RoleSelector = () => {
  const { selectRole, currentUser } = useAuth();
  const roles = [
    { id: 'Administrador', label: 'Administrador', icon: Activity, color: 'bg-acero' },
    { id: 'Doctor', label: 'Doctor', icon: Stethoscope, color: 'bg-emerald-600' },
    { id: 'Especialista', label: 'Especialista', icon: Calendar, color: 'bg-turquesa' },
    { id: 'Recepcionista', label: 'Recepción', icon: DollarSign, color: 'bg-indigo-600' },
    { id: 'Limpieza', label: 'Limpieza', icon: Sparkles, color: 'bg-blue-600' },
    { id: 'Paciente', label: 'Paciente', icon: UsersIcon, color: 'bg-teal-500' }
  ];

  return (
    <div 
      className="min-h-screen w-full flex flex-col items-center justify-center bg-fondo px-4 py-8 overflow-y-auto"
      style={{ 
        paddingTop: 'max(env(safe-area-inset-top, 0px), 2rem)', 
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 2rem)' 
      }}
    >
      <h2 className="text-xl font-black text-acero mb-1 uppercase tracking-tight">Selecciona tu Perfil</h2>
      <p className="text-gray-400 mb-8 text-[10px] font-bold uppercase tracking-[0.2em]">Bienvenido {currentUser?.email}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 w-full max-w-4xl px-4">
        {roles.map(role => (
          <button
            key={role.id}
            onClick={() => selectRole(role.id)}
            className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center gap-3 hover:scale-105 transition-all group active:scale-95"
          >
            <div className={`p-4 rounded-xl ${role.color} text-white shadow-md group-hover:rotate-6 transition-transform`}>
              <role.icon size={24} />
            </div>
            <span className="text-sm font-black text-acero uppercase tracking-widest">{role.label}</span>

          </button>
        ))}
      </div>
      <button
        onClick={() => { localStorage.removeItem('selectedRole'); window.location.reload(); }}
        className="mt-12 text-gray-400 font-bold hover:text-acero transition-colors"
      >
        Cerrar Sesión
      </button>
    </div>
  );
};

const RoleRedirect = () => {
  const { userRole } = useAuth();
  if (userRole === 'PendingSelection') return <Navigate to="/select-role" replace />;
  if (userRole === 'Administrador') return <Navigate to="/dashboard" replace />;
  if (userRole === 'Recepcionista') return <Navigate to="/citas" replace />;
  if (userRole === 'Especialista' || userRole === 'Doctor') return <Navigate to="/agenda" replace />;
  if (userRole === 'Paciente') return <Navigate to="/pacientes" replace />;
  if (userRole === 'Limpieza') return <Navigate to="/limpieza" replace />;
  return <Navigate to="/login" replace />;
};

const RoleGuard = ({ roles, children }) => {
  const { userRole, loading } = useAuth();
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-fondo"><Activity className="text-turquesa animate-spin" size={48} /></div>;
  if (!roles.includes(userRole)) return <Navigate to="/" replace />;
  return children;
};

const ForcePasswordChangeGuard = ({ children }) => {
  const { debeCambiarPassword, setDebeCambiarPassword, currentUser, userRole } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (debeCambiarPassword && currentUser && userRole !== 'Paciente') {
    const handleUpdate = async (e) => {
      e.preventDefault();
      if (newPassword !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      if (newPassword.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      try {
        setLoading(true);
        const { updatePassword } = await import('firebase/auth');
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('./lib/firebase');
        
        await updatePassword(currentUser, newPassword);
        await updateDoc(doc(db, 'usuarios', currentUser.uid), {
          debeCambiarPassword: false
        });
        setDebeCambiarPassword(false);
      } catch (err) {
        console.error(err);
        setError('Error al actualizar la contraseña: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white p-8 rounded-2xl max-w-md w-full shadow-2xl">
          <h2 className="text-xl font-bold text-acero mb-2">Cambio de Contraseña Obligatorio</h2>
          <p className="text-gray-500 text-sm mb-6">Por seguridad, debes cambiar la contraseña genérica que se te asignó antes de continuar.</p>
          
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Nueva Contraseña</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl focus:border-turquesa outline-none"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Confirmar Contraseña</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-xl focus:border-turquesa outline-none"
                placeholder="Repite la contraseña"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-turquesa text-white font-bold rounded-xl hover:bg-opacity-90 transition-colors disabled:opacity-70"
            >
              {loading ? 'Actualizando...' : 'Cambiar Contraseña y Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <ForcePasswordChangeGuard>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<RegistroPaciente />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<RoleRedirect />} />
                <Route path="select-role" element={<RoleSelector />} />

                {/* Admin Routes */}
                <Route path="dashboard" element={<RoleGuard roles={['Administrador']}><AdminDashboard /></RoleGuard>} />
                <Route path="admin-pacientes" element={<RoleGuard roles={['Administrador', 'Recepcionista']}><AdminPacientes /></RoleGuard>} />
                <Route path="membresias" element={<RoleGuard roles={['Administrador', 'Recepcionista']}><MembresiasView /></RoleGuard>} />
                <Route path="nomina" element={<RoleGuard roles={['Administrador']}><NominaView /></RoleGuard>} />
                <Route path="agenda-global" element={<RoleGuard roles={['Administrador', 'Recepcionista']}><SupervisionAgenda /></RoleGuard>} />
                <Route path="auditoria" element={<RoleGuard roles={['Administrador']}><AuditoriaClinica /></RoleGuard>} />
                <Route path="comercial" element={<RoleGuard roles={['Administrador']}><GestionComercial /></RoleGuard>} />
                <Route path="corte-caja" element={<RoleGuard roles={['Administrador']}><CorteCajaGlobal /></RoleGuard>} />
                <Route path="financiamientos" element={<RoleGuard roles={['Administrador', 'Recepcionista']}><ControlFinanciamientos /></RoleGuard>} />
                <Route path="finanzas" element={<RoleGuard roles={['Administrador']}><ContabilidadView /></RoleGuard>} />
                <Route path="reportes" element={<RoleGuard roles={['Administrador']}><ReportesView /></RoleGuard>} />
                <Route path="laboratorio-proyeccion-agenda" element={<RoleGuard roles={['Administrador']}><LaboratorioAgendaInteligente /></RoleGuard>} />
                <Route path="laboratorio-proyeccion-dashboard" element={<RoleGuard roles={['Administrador']}><LaboratorioDashboardFinanciero /></RoleGuard>} />
                <Route path="solicitudes" element={<RoleGuard roles={['Administrador']}><SolicitudesView /></RoleGuard>} />
                <Route path="checador" element={<RoleGuard roles={['Administrador', 'Recepcionista', 'Especialista', 'Doctor', 'Limpieza']}><ChecadorView /></RoleGuard>} />

                {/* Recepcion Routes */}
                <Route path="citas" element={<RoleGuard roles={['Administrador', 'Recepcionista']}><CalendarioCitas /></RoleGuard>} />
                <Route path="caja" element={<RoleGuard roles={['Administrador', 'Recepcionista']}><CajaView /></RoleGuard>} />

                {/* Especialista & Shared Clinical Expediente Routes */}
                <Route path="agenda" element={<RoleGuard roles={['Especialista', 'Doctor']}><AgendaDiaria /></RoleGuard>} />
                <Route path="mis-comisiones" element={<RoleGuard roles={['Especialista', 'Doctor']}><MisComisiones /></RoleGuard>} />
                <Route path="mis-pacientes" element={<RoleGuard roles={['Especialista', 'Doctor']}><MisPacientes /></RoleGuard>} />
                <Route path="especialista/expediente/:pacienteId" element={<RoleGuard roles={['Especialista', 'Doctor', 'Administrador', 'Recepcionista']}><ExpedienteClinico /></RoleGuard>} />

                {/* Paciente Routes */}
                <Route path="pacientes" element={<RoleGuard roles={['Paciente', 'Administrador']}><PacienteProfile /></RoleGuard>} />
                <Route path="promociones" element={<RoleGuard roles={['Paciente', 'Administrador']}><Promociones /></RoleGuard>} />

                {/* Limpieza Routes */}
                <Route path="limpieza" element={<RoleGuard roles={['Limpieza', 'Administrador']}><LimpiezaDashboard /></RoleGuard>} />
                <Route path="admin-tareas-limpieza" element={<RoleGuard roles={['Administrador']}><AdminTareasLimpieza /></RoleGuard>} />

                {/* Shared Routes - Visible to all roles */}
                <Route path="inventario" element={<InventarioView />} />
                    <Route path="mi-perfil" element={<RoleGuard roles={['Administrador', 'Recepcionista', 'Especialista', 'Doctor', 'Limpieza']}><MiPerfilColaborador /></RoleGuard>} />
              </Route>
            </Route>
            </Routes>
          </ForcePasswordChangeGuard>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
