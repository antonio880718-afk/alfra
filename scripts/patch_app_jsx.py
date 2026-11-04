# -*- coding: utf-8 -*-
import sys

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add AlertTriangle to imports from lucide-react
if 'AlertTriangle' not in text:
    old_lucide = "import { Activity, Calendar, DollarSign, Users as UsersIcon, Stethoscope, Sparkles } from 'lucide-react';"
    new_lucide = "import { Activity, Calendar, DollarSign, Users as UsersIcon, Stethoscope, Sparkles, AlertTriangle } from 'lucide-react';"
    if old_lucide in text:
        text = text.replace(old_lucide, new_lucide, 1)
        print("AlertTriangle agregado a imports de lucide-react.")
    else:
        print("Aviso: old_lucide no coincidio exactamente.")

# 2. Update Login component to read sessionStorage on mount and handleLogin to preserve ACCESO DENEGADO message
old_login_comp = """const Login = () => {
  const { login, resetPassword } = useAuth();
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
  };"""

new_login_comp = """const Login = () => {
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
  };"""

if old_login_comp in text:
    text = text.replace(old_login_comp, new_login_comp, 1)
    print("Login component y handleLogin actualizados con exito.")
else:
    print("Error: old_login_comp no coincidio.")
    sys.exit(1)

# 3. Update error banner styling in Login
old_error_div = '{error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium">{error}</div>}'
new_error_div = """{error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 text-red-700 rounded-2xl text-sm font-bold text-left flex items-start gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
            <div className="p-2 bg-red-600 text-white rounded-xl shrink-0 mt-0.5 shadow-md">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <p className="font-black text-red-900 uppercase text-xs tracking-wider mb-1">Aviso de Seguridad</p>
              <p className="text-red-800 leading-snug">{error}</p>
            </div>
          </div>
        )}"""

if old_error_div in text:
    text = text.replace(old_error_div, new_error_div, 1)
    print("Banner de error en Login estilizado con AlertTriangle.")
else:
    print("Aviso: old_error_div no coincidio exactamente.")

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("App.jsx actualizado con exito.")
