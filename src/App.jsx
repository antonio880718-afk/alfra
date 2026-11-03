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
import { Activity, Calendar, DollarSign, Users as UsersIcon, Stethoscope, Sparkles, AlertTriangle, ArrowRight, KeyRound, LogOut } from 'lucide-react';

const Login = () => {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('Administrador');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pacienteParaActivar, setPacienteParaActivar] = useState(null);

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
    setPacienteParaActivar(null);
    setError('');
    try {
      setIsSubmitting(true);
      await login(email, password);
      navigate('/');
    } catch (err) {
      if (err.code === 'PACIENTE_REQUIERE_ACTIVACION' || err.paciente) {
        setPacienteParaActivar(err.paciente);
        setError('');
        return;
      }
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
      alert("Por favor, ingresa tu correo electrónico o teléfono primero.");
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

        {/* Tarjeta de Detección Inteligente de Expediente Clínico */}
        {pacienteParaActivar && (
          <div className="mb-6 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-400 rounded-2xl shadow-md text-left animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0 shadow-sm mt-0.5">
                <Sparkles size={22} />
              </div>
              <div className="flex-1">
                <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-md mb-1">
                  Expediente Clínico Encontrado
                </span>
                <h4 className="font-bold text-gray-900 text-base leading-tight">
                  ¡Hola {pacienteParaActivar.nombre}! 🎉
                </h4>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Ya estás dado(a) de alta en la clínica con el teléfono <strong>{pacienteParaActivar.telefono}</strong>, pero aún no has activado tu contraseña de acceso para tu App móvil.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/registro', { state: pacienteParaActivar })}
                  className="mt-3 w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center justify-center gap-2"
                >
                  <span>Crear contraseña y activar mi App</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 text-red-700 rounded-2xl text-sm font-bold text-left flex items-start gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
            <div className="p-2 bg-red-600 text-white rounded-xl shrink-0 mt-0.5 shadow-md">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <p className="font-black text-red-900 uppercase text-xs tracking-wider mb-1">Aviso</p>
              <p className="text-red-800 leading-snug">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Correo Electrónico o Teléfono</label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (pacienteParaActivar) setPacienteParaActivar(null);
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all"
              placeholder="ej. alfra@clinica.com o 4531224124"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
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
          <button
            type="button"
            onClick={() => navigate('/registro', { state: email ? { telefono: email } : null })}
            className="text-turquesa font-bold hover:underline"
          >
            Regístrate aquí
          </button>
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
  const { debeCambiarPassword, setDebeCambiarPassword, currentUser, userRole, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exito, setExito] = useState(false);

  if (debeCambiarPassword && currentUser && userRole !== 'Paciente') {
    const handleUpdate = async (e) => {
      e.preventDefault();
      setError('');
      if (!newPassword || !confirmPassword) {
        setError('Por favor llena ambos campos.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      if (newPassword.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (newPassword === 'Alfra2026!') {
        setError('Por seguridad, debes elegir una contraseña personal diferente a la genérica Alfra2026!.');
        return;
      }
      try {
        setLoading(true);
        const { updatePassword } = await import('firebase/auth');
        const { doc, updateDoc, collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('./lib/firebase');
        
        // 1. Actualizar contraseña en Firebase Auth
        await updatePassword(currentUser, newPassword);

        const ahoraIso = new Date().toISOString();

        // 2. Limpiar flag en /usuarios
        await updateDoc(doc(db, 'usuarios', currentUser.uid), {
          debeCambiarPassword: false,
          passwordTemporal: null,
          fechaCambioPassword: ahoraIso
        }).catch(() => {});

        // 3. Limpiar flag en /staff (por docId o email)
        try {
          await updateDoc(doc(db, 'staff', currentUser.uid), {
            debeCambiarPassword: false,
            passwordTemporal: null,
            fechaCambioPassword: ahoraIso
          }).catch(async () => {
            if (currentUser.email) {
              const qStaff = query(collection(db, 'staff'), where('email', '==', currentUser.email.toLowerCase().trim()));
              const snapStaff = await getDocs(qStaff);
              for (const d of snapStaff.docs) {
                await updateDoc(d.ref, {
                  debeCambiarPassword: false,
                  passwordTemporal: null,
                  fechaCambioPassword: ahoraIso
                });
              }
            }
          });
        } catch (_) {}

        setExito(true);
        setTimeout(() => {
          setDebeCambiarPassword(false);
        }, 1000);
      } catch (err) {
        console.error(err);
        if (err.code === 'auth/requires-recent-login') {
          setError('Tu sesión requiere re-autenticación. Cierra sesión e ingresa nuevamente con Alfra2026! para continuar.');
        } else {
          setError('Error al actualizar la contraseña: ' + (err.message || 'Intenta de nuevo.'));
        }
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in">
        <div className="bg-white p-8 rounded-3xl max-w-md w-full shadow-2xl border border-amber-200/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-turquesa to-amber-500" />
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl">
              <KeyRound size={26} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Seguridad Requerida
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-1">Cambio de Contraseña</h2>
            </div>
          </div>

          <p className="text-slate-600 text-xs mb-5 leading-relaxed">
            Has ingresado con la contraseña provisional <strong className="font-mono bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200">Alfra2026!</strong>. Por políticas de seguridad de <strong>Clínica ALFRA</strong>, debes establecer tu nueva contraseña personal antes de continuar.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {exito && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold text-center">
              ✓ ¡Contraseña actualizada con éxito! Ingresando al sistema...
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Nueva Contraseña Personal
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all text-sm"
                placeholder="Mínimo 6 caracteres"
                disabled={loading || exito}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Confirmar Nueva Contraseña
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all text-sm"
                placeholder="Repite exactamente tu nueva contraseña"
                disabled={loading || exito}
              />
            </div>
            <button
              type="submit"
              disabled={loading || exito}
              className="w-full py-3.5 bg-gradient-to-r from-turquesa to-teal-600 hover:from-teal-600 hover:to-turquesa text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-turquesa/20 transition-all disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Guardando...' : exito ? '¡Acceso Concedido!' : 'Guardar y Entrar al Sistema'}
            </button>
          </form>

          <div className="mt-5 text-center border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={logout}
              className="text-xs text-slate-400 hover:text-rose-600 font-bold transition-colors inline-flex items-center gap-1"
            >
              <LogOut size={13} /> Cerrar Sesión
            </button>
          </div>
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
