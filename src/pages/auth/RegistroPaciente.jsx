import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { User, Mail, Lock, Phone, Calendar, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';

export default function RegistroPaciente() {
    const navigate = useNavigate();
    const { registerPaciente } = useAuth();

    const [form, setForm] = useState({
        nombre: '',
        email: '',
        password: '',
        confirmar: '',
        telefono: '',
        fechaNacimiento: '',
    });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [exito, setExito] = useState(false);

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.nombre.trim()) { setError('Ingresa tu nombre completo.'); return; }
        if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
        if (form.password !== form.confirmar) { setError('Las contraseñas no coinciden.'); return; }

        setLoading(true);
        try {
            await registerPaciente({
                email: form.email,
                password: form.password,
                nombre: form.nombre,
                telefono: form.telefono,
                fechaNacimiento: form.fechaNacimiento,
            });
            setExito(true);
            setTimeout(() => navigate('/pacientes'), 2000);
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                setError('Este correo ya está registrado. Inicia sesión en su lugar.');
            } else if (err.code === 'auth/invalid-email') {
                setError('El formato del correo no es válido.');
            } else {
                setError('Ocurrió un error al crear tu cuenta. Intenta de nuevo.');
                console.error(err);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-full flex items-center justify-center bg-fondo relative overflow-hidden px-4">
            {/* Fondo decorativo */}
            <div className="absolute top-10 left-10 w-64 h-64 bg-turquesa/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-acero/10 rounded-full blur-3xl pointer-events-none" />

            <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-gray-100 w-full max-w-md relative z-10">
                {exito ? (
                    <div className="text-center py-8">
                        <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Registro exitoso!</h2>
                        <p className="text-gray-500">Tu cuenta ha sido creada. Redirigiendo a tu perfil...</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="text-center mb-6">
                            <img src="/logo.png.png" alt="ALFRA" className="h-24 w-auto mx-auto object-contain mb-4" />
                            <h1 className="text-2xl font-bold text-acero">Crea tu Cuenta de Paciente</h1>
                            <p className="text-gray-500 text-sm mt-1">Únete a Clínica ALFRA y lleva tu tratamiento en un solo lugar</p>
                        </div>

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

                            {/* Email */}
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    required
                                    type="email"
                                    placeholder="Correo electrónico"
                                    value={form.email}
                                    onChange={e => set('email', e.target.value)}
                                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all text-sm"
                                />
                            </div>

                            {/* Teléfono */}
                            <div className="relative">
                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="tel"
                                    placeholder="Teléfono (opcional)"
                                    value={form.telefono}
                                    onChange={e => set('telefono', e.target.value)}
                                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 outline-none transition-all text-sm"
                                />
                            </div>

                            {/* Fecha de nacimiento */}
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
                                className="w-full py-3 mt-2 bg-turquesa text-white font-bold rounded-xl hover:bg-opacity-90 transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Creando cuenta...
                                    </>
                                ) : 'Crear mi Cuenta'}
                            </button>
                        </form>

                        <p className="text-center text-sm text-gray-500 mt-6">
                            ¿Ya tienes cuenta?{' '}
                            <Link to="/login" className="text-turquesa font-bold hover:underline">Inicia sesión</Link>
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
