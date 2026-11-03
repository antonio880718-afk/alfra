import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { User, Mail, Lock, Phone, Calendar, Eye, EyeOff, ArrowLeft, CheckCircle, Sparkles } from 'lucide-react';

export default function RegistroPaciente() {
    const navigate = useNavigate();
    const location = useLocation();
    const { registerPaciente } = useAuth();

    const prefill = location.state || {};
    const esActivacion = Boolean(prefill.nombre || prefill.telefono);

    const [form, setForm] = useState({
        nombre: prefill.nombre || '',
        email: (prefill.email && !prefill.email.includes('@paciente.alfra.mx')) ? prefill.email : '',
        password: '',
        confirmar: '',
        telefono: prefill.telefono || '',
        fechaNacimiento: prefill.fechaNacimiento || '',
        comoNosConocio: prefill.comoNosConocio || (esActivacion ? 'Ya era paciente en clínica' : ''),
    });
    const [expedienteDetectado, setExpedienteDetectado] = useState(esActivacion);

    // Auto-detectar expediente clínico en vivo cuando se ingresa el teléfono
    useEffect(() => {
        const clean = form.telefono.replace(/\D/g, '');
        if (clean.length === 10) {
            import('../../lib/firebase').then(async ({ db }) => {
                const { doc, getDoc } = await import('firebase/firestore');
                try {
                    const snap = await getDoc(doc(db, 'directorio_pacientes', clean));
                    if (snap.exists()) {
                        const data = snap.data();
                        setExpedienteDetectado(true);
                        setForm(prev => ({
                            ...prev,
                            nombre: prev.nombre || data.nombre || '',
                            email: prev.email || (data.email && !data.email.includes('@paciente.alfra.mx') ? data.email : ''),
                            comoNosConocio: prev.comoNosConocio || 'Ya era paciente en clínica'
                        }));
                    }
                } catch (e) {
                    // silencioso si no se encuentra
                }
            });
        }
    }, [form.telefono]);
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [exito, setExito] = useState(false);

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.nombre.trim()) { setError('Ingresa tu nombre completo.'); return; }
        if (!form.telefono.trim()) { setError('Ingresa tu teléfono para enlazar tu expediente.'); return; }
        if (form.telefono.replace(/\D/g, '').length < 10) { setError('El número de teléfono debe ser a 10 dígitos.'); return; }
        if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
        if (form.password !== form.confirmar) { setError('Las contraseñas no coinciden.'); return; }

        setLoading(true);
        try {
            const cleanDigits = form.telefono.replace(/\D/g, '');
            const emailToSend = form.email.trim() || `${cleanDigits}@paciente.alfra.mx`;

            await registerPaciente({
                email: emailToSend,
                password: form.password,
                nombre: form.nombre.trim(),
                telefono: form.telefono.trim(),
                fechaNacimiento: form.fechaNacimiento,
                comoNosConocio: form.comoNosConocio,
            });
            setExito(true);
            setTimeout(() => navigate('/pacientes'), 1500);
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                setError('Este teléfono o correo ya tiene una cuenta activa. Inicia sesión en su lugar.');
            } else if (err.code === 'auth/invalid-email') {
                setError('El formato del correo no es válido.');
            } else {
                setError('Ocurrió un error al activar tu cuenta. Intenta de nuevo.');
                console.error(err);
            }
        } finally {
            setLoading(false);
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
            {/* Fondo decorativo */}
            <div className="absolute top-10 left-10 w-64 h-64 bg-turquesa/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-acero/10 rounded-full blur-3xl pointer-events-none" />

            <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-xl border border-gray-100 w-full max-w-md relative z-10 my-auto">
                {exito ? (
                    <div className="text-center py-8">
                        <CheckCircle size={64} className="text-emerald-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Cuenta Activada con Éxito!</h2>
                        <p className="text-gray-500">Tu expediente y tratamientos han sido vinculados. Redirigiendo a tu perfil...</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="text-center mb-6">
                            <div className="relative inline-flex items-center justify-center mb-3 mx-auto">
                                <div className="absolute inset-0 bg-turquesa/15 rounded-full blur-xl transform scale-125 pointer-events-none" />
                                <img 
                                    src="/logo.png" 
                                    alt="Clínica ALFRA" 
                                    className="relative z-10 h-32 sm:h-40 w-auto object-contain drop-shadow-md hover:scale-105 transition-transform duration-300" 
                                />
                            </div>
                            <h1 className="text-2xl font-bold text-acero">
                                {esActivacion ? 'Activa tu Cuenta de Paciente' : 'Crea tu Cuenta de Paciente'}
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">
                                {esActivacion 
                                    ? 'Define tu contraseña personal para acceder a tu App móvil'
                                    : 'Únete a Clínica ALFRA y lleva tu tratamiento en un solo lugar'
                                }
                            </p>
                        </div>

                        {/* Banner de Detección de Paciente */}
                        {(expedienteDetectado || esActivacion) && (
                            <div className="mb-5 p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-left">
                                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                                    <Sparkles size={18} className="text-emerald-600 shrink-0" />
                                    <span>¡Expediente de Clínica Detectado!</span>
                                </div>
                                <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                                    Hola <strong>{form.nombre || 'Paciente'}</strong>. Tu historial clínico, tratamientos y citas con el teléfono <strong>{form.telefono}</strong> se vincularán de forma automática.
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Nombre */}
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    required
                                    type="text"
                                    placeholder="Nombre completo"
                                    value={form.nombre}
                                    onChange={e => set('nombre', e.target.value)}
                                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all text-sm"
                                />
                            </div>

                            {/* Teléfono */}
                            <div className="relative">
                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    required
                                    type="tel"
                                    placeholder="Teléfono a 10 dígitos (Ej. 453 122 4124)"
                                    value={form.telefono}
                                    onChange={e => set('telefono', e.target.value)}
                                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all text-sm"
                                />
                            </div>

                            {/* Email (Opcional si usa teléfono) */}
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="email"
                                    placeholder="Correo electrónico (Opcional si usas teléfono)"
                                    value={form.email}
                                    onChange={e => set('email', e.target.value)}
                                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all text-sm"
                                />
                            </div>

                            {/* Fecha de nacimiento */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-500 ml-1 mb-1 block">Fecha de nacimiento</label>
                                <div className="relative">
                                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="date"
                                        placeholder="Fecha de nacimiento"
                                        value={form.fechaNacimiento}
                                        onChange={e => set('fechaNacimiento', e.target.value)}
                                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all text-sm text-gray-600"
                                    />
                                </div>
                            </div>

                            {/* ¿Cómo nos conociste? */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-500 ml-1 mb-1 block">¿Cómo nos conociste?</label>
                                <select
                                    value={form.comoNosConocio}
                                    onChange={e => set('comoNosConocio', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all text-sm text-gray-600 bg-white"
                                >
                                    <option value="">Selecciona una opción (opcional)</option>
                                    <option value="Ya era paciente en clínica">Ya era paciente en clínica</option>
                                    <option value="Facebook">Facebook</option>
                                    <option value="Instagram">Instagram</option>
                                    <option value="TikTok">TikTok</option>
                                    <option value="Google / Maps">Google / Maps</option>
                                    <option value="Recomendación de un paciente">Recomendación de un paciente</option>
                                    <option value="Volante / Publicidad impresa">Volante / Publicidad impresa</option>
                                    <option value="Pasaba por aquí">Pasaba por aquí</option>
                                    <option value="WhatsApp">WhatsApp</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>

                            {/* Password */}
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    required
                                    type={showPass ? 'text' : 'password'}
                                    placeholder="Contraseña (mín. 6 caracteres)"
                                    value={form.password}
                                    onChange={e => set('password', e.target.value)}
                                    className="w-full pl-9 pr-10 py-3 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all text-sm"
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            {/* Confirmar password */}
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    required
                                    type={showPass ? 'text' : 'password'}
                                    placeholder="Confirmar contraseña"
                                    value={form.confirmar}
                                    onChange={e => set('confirmar', e.target.value)}
                                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all text-sm"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 mt-2 bg-turquesa hover:bg-turquesa/90 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        {esActivacion ? 'Activando tu acceso...' : 'Creando cuenta...'}
                                    </>
                                ) : (esActivacion ? 'Activar Mi Acceso a la App' : 'Crear mi Cuenta')}
                            </button>
                        </form>

                        <p className="text-center text-sm text-gray-500 mt-6">
                            ¿Ya tienes cuenta activada?{' '}
                            <Link to="/login" className="text-turquesa font-bold hover:underline">Inicia sesión</Link>
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
