import React, { useState, useEffect, useRef } from 'react';
import {
    User, Camera, Shield, Stethoscope, CreditCard, Award, Phone, Calendar,
    HeartHandshake, Save, CheckCircle, AlertCircle, Copy, Check, Trash2,
    Edit3, Sparkles, Clock, Building, FileText, Lock, ChevronRight, RefreshCw, MapPin, Hash
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
    obtenerOCrearPerfilColaborador,
    actualizarMiPerfilColaborador,
    comprimirImagenBase64,
    onStaffDocChange
} from '../../services/staffService';
import { getCitas } from '../../services/citasService';

export default function MiPerfilColaborador() {
    const { currentUser, userRole } = useAuth();

    const [staffData, setStaffData] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'clinico' | 'bancario' | 'desempeno'
    const [toastMsg, setToastMsg] = useState('');
    const [copiadoClabe, setCopiadoClabe] = useState(false);
    const [citasDelMes, setCitasDelMes] = useState(0);

    const [form, setForm] = useState({
        nombre: '',
        alias: '',
        fotoUrl: '',
        telefono: '',
        biografia: '',
        cedulaProfesional: '',
        cedulaEspecialidad: '',
        universidad: '',
        firmaUrl: '',
        fechaNacimiento: '',
        curp: '',
        rfc: '',
        domicilio: '',
        datosBancarios: {
            banco: '',
            clabe: '',
            titular: ''
        },
        contactoEmergencia: {
            nombre: '',
            parentesco: '',
            telefono: ''
        }
    });

    const fileInputRef = useRef(null);
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tieneTrazoFirma, setTieneTrazoFirma] = useState(false);

    useEffect(() => {
        let unsub = () => {};
        const cargar = async () => {
            if (!currentUser) return;
            setCargando(true);
            try {
                const doc = await obtenerOCrearPerfilColaborador(currentUser, userRole);
                if (doc) {
                    setStaffData(doc);
                    poblarFormulario(doc);
                    unsub = onStaffDocChange(doc.id, (actualizado) => {
                        if (actualizado) {
                            setStaffData(actualizado);
                        }
                    });
                }
            } catch (err) {
                console.error('Error al cargar perfil de colaborador:', err);
            } finally {
                setCargando(false);
            }
        };

        cargar();
        return () => unsub();
    }, [currentUser, userRole]);

    useEffect(() => {
        const calcularCitas = async () => {
            if (!currentUser?.uid) return;
            try {
                const citas = await getCitas();
                const now = new Date();
                const mesActual = now.getMonth();
                const anioActual = now.getFullYear();

                const citasMes = (citas || []).filter(c => {
                    const f = new Date(c.fecha || c.start || 0);
                    const esMes = f.getMonth() === mesActual && f.getFullYear() === anioActual;
                    const esStaff = c.especialistaId === currentUser.uid ||
                                    c.doctorUid === currentUser.uid ||
                                    c.especialistaNombre === currentUser.displayName;
                    return esMes && esStaff && c.estado !== 'cancelada';
                });
                setCitasDelMes(citasMes.length);
            } catch (_) {}
        };
        calcularCitas();
    }, [currentUser]);

    const poblarFormulario = (doc) => {
        setForm({
            nombre: doc.nombre || currentUser?.displayName || '',
            alias: doc.alias || '',
            fotoUrl: doc.fotoUrl || currentUser?.photoURL || '',
            telefono: doc.telefono || '',
            biografia: doc.biografia || '',
            cedulaProfesional: doc.cedulaProfesional || '',
            cedulaEspecialidad: doc.cedulaEspecialidad || '',
            universidad: doc.universidad || '',
            firmaUrl: doc.firmaUrl || '',
            fechaNacimiento: doc.fechaNacimiento || '',
            curp: doc.curp || '',
            rfc: doc.rfc || '',
            domicilio: doc.domicilio || '',
            datosBancarios: {
                banco: doc.datosBancarios?.banco || '',
                clabe: doc.datosBancarios?.clabe || '',
                titular: doc.datosBancarios?.titular || doc.nombre || ''
            },
            contactoEmergencia: {
                nombre: doc.contactoEmergencia?.nombre || '',
                parentesco: doc.contactoEmergencia?.parentesco || '',
                telefono: doc.contactoEmergencia?.telefono || ''
            }
        });
    };

    const mostrarToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 4000);
    };

    const handleSubirFoto = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            mostrarToast('Procesando fotografía...');
            const base64 = await comprimirImagenBase64(file, 600, 600, 0.85);
            if (base64) {
                setForm(prev => ({ ...prev, fotoUrl: base64 }));
                mostrarToast('Foto cargada. Recuerda guardar los cambios.');
            }
        } catch (err) {
            console.error('Error al procesar foto:', err);
            alert('No se pudo procesar la imagen seleccionada');
        }
    };

    const iniciarTrazo = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
        setTieneTrazoFirma(true);
    };

    const dibujar = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

        ctx.lineTo(x, y);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };

    const terminarTrazo = () => setIsDrawing(false);

    const limpiarCanvasFirma = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setTieneTrazoFirma(false);
    };

    const guardarFirmaDesdeCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        setForm(prev => ({ ...prev, firmaUrl: dataUrl }));
        limpiarCanvasFirma();
        mostrarToast('Firma digital actualizada. Recuerda guardar cambios.');
    };

    const copiarClabe = () => {
        if (!form.datosBancarios?.clabe) return;
        navigator.clipboard.writeText(form.datosBancarios.clabe);
        setCopiadoClabe(true);
        setTimeout(() => setCopiadoClabe(false), 2500);
        mostrarToast('CLABE copiada al portapapeles');
    };

    const handleGuardarPerfil = async (e) => {
        if (e) e.preventDefault();
        if (!staffData?.id) return alert('No se localizó el registro de staff');

        setGuardando(true);
        try {
            await actualizarMiPerfilColaborador(staffData.id, form);
            mostrarToast('✓ Perfil de colaborador actualizado satisfactoriamente');
        } catch (err) {
            console.error('Error al guardar perfil:', err);
            alert('Error al guardar los datos del perfil');
        } finally {
            setGuardando(false);
        }
    };

    const calcularAntiguedad = (fechaStr) => {
        if (!fechaStr) return 'Reciente ingreso';
        const fechaIngreso = new Date(fechaStr);
        if (isNaN(fechaIngreso)) return 'Reciente';
        const hoy = new Date();
        const diffMeses = (hoy.getFullYear() - fechaIngreso.getFullYear()) * 12 + (hoy.getMonth() - fechaIngreso.getMonth());
        if (diffMeses <= 0) return 'Menos de 1 mes en ALFRA';
        if (diffMeses === 1) return '1 mes en ALFRA';
        if (diffMeses < 12) return `${diffMeses} meses en ALFRA`;
        const anios = Math.floor(diffMeses / 12);
        const rem = diffMeses % 12;
        return `${anios} año${anios > 1 ? 's' : ''}${rem > 0 ? ` y ${rem} m.` : ''} en ALFRA`;
    };

    if (cargando) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
                <RefreshCw size={36} className="text-teal-600 animate-spin" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cargando tu perfil de colaborador...</p>
            </div>
        );
    }

    const puestoOficial = staffData?.puesto || userRole || 'Colaborador';
    const esDoctor = puestoOficial.toLowerCase().includes('doctor');

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-24">
            {toastMsg && (
                <div className="fixed top-5 right-5 z-50 bg-slate-900 text-teal-300 px-5 py-3 rounded-2xl shadow-2xl border border-teal-500/30 flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-4">
                    <Sparkles size={16} className="text-teal-400" />
                    <span>{toastMsg}</span>
                </div>
            )}

            {/* HEADER / CREDENCIAL DIGITAL */}
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-teal-500/20 overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
                    <div className="relative group shrink-0">
                        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border-4 border-teal-400/80 bg-slate-800 shadow-2xl flex items-center justify-center">
                            {form.fotoUrl ? (
                                <img
                                    src={form.fotoUrl}
                                    alt={form.nombre}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                            ) : (
                                <User size={56} className="text-teal-400/60" />
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute -bottom-2 -right-2 p-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-2xl shadow-lg border-2 border-slate-900 transition-all hover:scale-110 active:scale-95 cursor-pointer"
                            title="Tomar o cambiar fotografía de perfil"
                        >
                            <Camera size={16} className="stroke-[2.5]" />
                        </button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleSubirFoto}
                            className="hidden"
                        />
                    </div>

                    <div className="flex-1 text-center sm:text-left space-y-2">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                {esDoctor ? <Stethoscope size={13} /> : <Shield size={13} />}
                                {puestoOficial}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {staffData?.estatus || 'Activo'}
                            </span>
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                            {form.alias || form.nombre || 'Colaborador ALFRA'}
                        </h1>

                        {form.alias && form.nombre !== form.alias && (
                            <p className="text-xs text-slate-300 font-medium">
                                Nombre legal: <strong>{form.nombre}</strong>
                            </p>
                        )}

                        <p className="text-xs text-slate-400 max-w-xl line-clamp-2">
                            {form.biografia || 'Sin biografía profesional asignada. Personaliza tu perfil para que tus pacientes y equipo te conozcan mejor.'}
                        </p>

                        <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-300">
                            <span className="flex items-center gap-1.5">
                                <Calendar size={13} className="text-teal-400" />
                                {calcularAntiguedad(staffData?.fechaIngreso)}
                            </span>
                            {form.cedulaProfesional && (
                                <span className="flex items-center gap-1.5 font-bold text-teal-300">
                                    <Award size={13} />
                                    {form.cedulaProfesional}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 pt-2 sm:pt-0 flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-teal-200 border border-teal-400/30 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex-1 sm:flex-initial"
                        >
                            <Camera size={15} />
                            <span>Cambiar Foto</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleGuardarPerfil}
                            disabled={guardando}
                            className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 rounded-2xl text-xs font-black uppercase tracking-wider shadow-xl shadow-teal-900/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer flex-1 sm:flex-initial"
                        >
                            <Save size={16} />
                            {guardando ? 'Guardando...' : 'Guardar Perfil'}
                        </button>
                    </div>
                </div>
            </div>

            {/* PESTAÑAS */}
            <div className="flex border-b border-slate-200 overflow-x-auto gap-2 text-xs font-black uppercase tracking-wider">
                <button
                    onClick={() => setActiveTab('personal')}
                    className={`pb-3 px-3 transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
                        activeTab === 'personal'
                            ? 'border-teal-600 text-teal-700'
                            : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                >
                    <User size={15} /> 1. Datos Personales
                </button>
                <button
                    onClick={() => setActiveTab('clinico')}
                    className={`pb-3 px-3 transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
                        activeTab === 'clinico'
                            ? 'border-teal-600 text-teal-700'
                            : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                >
                    <Award size={15} /> 2. Cédula & Firma Digital
                </button>
                <button
                    onClick={() => setActiveTab('bancario')}
                    className={`pb-3 px-3 transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
                        activeTab === 'bancario'
                            ? 'border-teal-600 text-teal-700'
                            : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                >
                    <CreditCard size={15} /> 3. Pago de Nómina (CLABE)
                </button>
                <button
                    onClick={() => setActiveTab('desempeno')}
                    className={`pb-3 px-3 transition-colors flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer ${
                        activeTab === 'desempeno'
                            ? 'border-teal-600 text-teal-700'
                            : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                >
                    <Sparkles size={15} /> 4. Mi Desempeño
                </button>
            </div>

            <form onSubmit={handleGuardarPerfil} className="space-y-6">

                {activeTab === 'personal' && (
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                        <div>
                            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                <User size={18} className="text-teal-600" /> Información Personal y de Contacto
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Datos visibles en tu perfil, agenda y coordinación interna de la clínica.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo Oficial:</label>
                                <input
                                    type="text"
                                    value={form.nombre}
                                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                    placeholder="Ej. Alondra Frausto Martínez"
                                    className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:border-teal-500 outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Alias / Nombre de Presentación:</label>
                                <input
                                    type="text"
                                    value={form.alias}
                                    onChange={(e) => setForm({ ...form, alias: e.target.value })}
                                    placeholder="Ej. Dra. Alondra Frausto"
                                    className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:border-teal-500 outline-none"
                                />
                                <span className="text-[10px] text-slate-400 mt-1 block">Cómo te verán los pacientes en recetas y citas.</span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono Personal / WhatsApp:</label>
                                <div className="relative">
                                    <Phone size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
                                    <input
                                        type="tel"
                                        value={form.telefono}
                                        onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                                        placeholder="Ej. 449 123 4567"
                                        className="w-full text-xs pl-10 pr-3 py-3 rounded-2xl border border-slate-200 focus:border-teal-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Fecha de Cumpleaños:</label>
                                <div className="relative">
                                    <Calendar size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
                                    <input
                                        type="date"
                                        value={form.fechaNacimiento}
                                        onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })}
                                        className="w-full text-xs pl-10 pr-3 py-3 rounded-2xl border border-slate-200 focus:border-teal-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">CURP:</label>
                                <div className="relative">
                                    <Hash size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        maxLength={18}
                                        value={form.curp}
                                        onChange={(e) => setForm({ ...form, curp: e.target.value.toUpperCase().trim() })}
                                        placeholder="ABCD000000HDFR..."
                                        className="w-full text-xs pl-10 pr-3 py-3 rounded-2xl border border-slate-200 focus:border-teal-500 outline-none font-mono uppercase tracking-wider"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">RFC <span className="text-slate-400 font-normal">(Opcional):</span></label>
                                <div className="relative">
                                    <Hash size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        maxLength={13}
                                        value={form.rfc}
                                        onChange={(e) => setForm({ ...form, rfc: e.target.value.toUpperCase().trim() })}
                                        placeholder="ABCD000000XXX"
                                        className="w-full text-xs pl-10 pr-3 py-3 rounded-2xl border border-slate-200 focus:border-teal-500 outline-none font-mono uppercase tracking-wider"
                                    />
                                </div>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">Domicilio Particular / Dirección:</label>
                                <div className="relative">
                                    <MapPin size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={form.domicilio}
                                        onChange={(e) => setForm({ ...form, domicilio: e.target.value })}
                                        placeholder="Calle, número exterior/interior, colonia, C.P. y municipio/ciudad"
                                        className="w-full text-xs pl-10 pr-3 py-3 rounded-2xl border border-slate-200 focus:border-teal-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Biografía y Enfoque Profesional:</label>
                            <textarea
                                rows={3}
                                value={form.biografia}
                                onChange={(e) => setForm({ ...form, biografia: e.target.value })}
                                placeholder="Describe brevemente tus especialidades clínicas, técnicas dominadas o experiencia en medicina estética..."
                                className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:border-teal-500 outline-none"
                            />
                        </div>

                        {/* CONTACTO DE EMERGENCIA */}
                        <div className="pt-4 border-t border-slate-100 space-y-4">
                            <div className="flex items-center gap-2">
                                <HeartHandshake size={16} className="text-rose-500" />
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Contacto de Emergencia</h4>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre Completo:</label>
                                    <input
                                        type="text"
                                        value={form.contactoEmergencia.nombre}
                                        onChange={(e) => setForm({
                                            ...form,
                                            contactoEmergencia: { ...form.contactoEmergencia, nombre: e.target.value }
                                        })}
                                        placeholder="Ej. Carlos Martínez"
                                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-teal-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Parentesco:</label>
                                    <input
                                        type="text"
                                        value={form.contactoEmergencia.parentesco}
                                        onChange={(e) => setForm({
                                            ...form,
                                            contactoEmergencia: { ...form.contactoEmergencia, parentesco: e.target.value }
                                        })}
                                        placeholder="Ej. Cónyuge / Hermano / Mamá"
                                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-teal-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Teléfono Directo:</label>
                                    <input
                                        type="tel"
                                        value={form.contactoEmergencia.telefono}
                                        onChange={(e) => setForm({
                                            ...form,
                                            contactoEmergencia: { ...form.contactoEmergencia, telefono: e.target.value }
                                        })}
                                        placeholder="Ej. 449 987 6543"
                                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-teal-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'clinico' && (
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                        <div>
                            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                <Award size={18} className="text-teal-600" /> Cédula Profesional y Firma Digital Oficial
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Utilizadas para recetas médicas, notas de evolución y expedientes clínicos conforme a NOM-004-SSA3-2012.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Cédula Profesional SSA:</label>
                                <input
                                    type="text"
                                    value={form.cedulaProfesional}
                                    onChange={(e) => setForm({ ...form, cedulaProfesional: e.target.value })}
                                    placeholder="Ej. CED. PROF. 12849203 SSA"
                                    className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:border-teal-500 outline-none font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Cédula de Especialidad / Posgrado (Opcional):</label>
                                <input
                                    type="text"
                                    value={form.cedulaEspecialidad}
                                    onChange={(e) => setForm({ ...form, cedulaEspecialidad: e.target.value })}
                                    placeholder="Ej. ESP. 9841249 MEDICINA ESTÉTICA"
                                    className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:border-teal-500 outline-none font-mono"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">Universidad / Institución de Egreso:</label>
                                <div className="relative">
                                    <Building size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={form.universidad}
                                        onChange={(e) => setForm({ ...form, universidad: e.target.value })}
                                        placeholder="Ej. Universidad Autónoma de Aguascalientes"
                                        className="w-full text-xs pl-10 pr-3 py-3 rounded-2xl border border-slate-200 focus:border-teal-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* LIENZO DE FIRMA */}
                        <div className="pt-4 border-t border-slate-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Edit3 size={16} className="text-teal-600" />
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Lienzo de Firma Digital</h4>
                                </div>
                                {form.firmaUrl && (
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                        <CheckCircle size={11} /> Firma guardada y activa
                                    </span>
                                )}
                            </div>

                            <p className="text-xs text-slate-500">
                                Dibuja tu firma oficial con el dedo o lápiz en la pantalla táctil (o con el ratón en PC).
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                <div className="space-y-2">
                                    <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 overflow-hidden shadow-inner touch-none">
                                        <canvas
                                            ref={canvasRef}
                                            width={360}
                                            height={140}
                                            onMouseDown={iniciarTrazo}
                                            onMouseMove={dibujar}
                                            onMouseUp={terminarTrazo}
                                            onMouseLeave={terminarTrazo}
                                            onTouchStart={iniciarTrazo}
                                            onTouchMove={dibujar}
                                            onTouchEnd={terminarTrazo}
                                            className="w-full h-36 bg-white cursor-crosshair"
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={limpiarCanvasFirma}
                                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-100 transition-all flex items-center gap-1"
                                        >
                                            <Trash2 size={12} /> Limpiar Trazo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={guardarFirmaDesdeCanvas}
                                            disabled={!tieneTrazoFirma}
                                            className="px-4 py-1.5 rounded-xl bg-slate-900 text-teal-300 text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-40"
                                        >
                                            Fijar como Mi Firma
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center min-h-[140px] text-center space-y-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rúbrica Oficial Guardada</span>
                                    {form.firmaUrl ? (
                                        <div className="relative group bg-white p-2 rounded-xl border border-slate-200 shadow-xs max-w-[200px]">
                                            <img src={form.firmaUrl} alt="Firma oficial" className="h-16 w-auto object-contain mx-auto" />
                                            <button
                                                type="button"
                                                onClick={() => setForm(prev => ({ ...prev, firmaUrl: '' }))}
                                                className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Eliminar firma"
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">Aún no has fijado tu firma digital.</p>
                                    )}
                                    <span className="text-[10px] text-slate-400">Protegida por NOM-004-SSA3-2012</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'bancario' && (
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                        <div>
                            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                <CreditCard size={18} className="text-teal-600" /> Cuenta Bancaria para Pago de Nómina y Comisiones
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Asegúrate de que la cuenta CLABE corresponda a tu nombre para evitar retrasos en tus transferencias semanales.
                            </p>
                        </div>

                        <div className="p-4 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl flex items-center justify-between text-xs text-teal-900">
                            <div className="flex items-center gap-3">
                                <CreditCard size={22} className="text-teal-600 shrink-0" />
                                <div>
                                    <p className="font-black">Dispersión Semanal</p>
                                    <p className="text-[11px] text-teal-700">Administración utiliza estos datos directamente para la transferencia semanal de tu sueldo base y comisiones generadas.</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Banco Receptor:</label>
                                <select
                                    value={form.datosBancarios.banco}
                                    onChange={(e) => setForm({
                                        ...form,
                                        datosBancarios: { ...form.datosBancarios, banco: e.target.value }
                                    })}
                                    className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:border-teal-500 outline-none bg-white font-medium"
                                >
                                    <option value="">Selecciona tu banco...</option>
                                    <option value="BBVA">BBVA México</option>
                                    <option value="Santander">Santander</option>
                                    <option value="Banorte">Banorte</option>
                                    <option value="Nu">Nu México</option>
                                    <option value="Citibanamex">Citibanamex</option>
                                    <option value="HSBC">HSBC</option>
                                    <option value="Mercado Pago">Mercado Pago Wallet</option>
                                    <option value="Scotiabank">Scotiabank</option>
                                    <option value="Banco Azteca">Banco Azteca</option>
                                    <option value="Otro">Otro Banco</option>
                                </select>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">CLABE Interbancaria (18 dígitos):</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        maxLength={18}
                                        value={form.datosBancarios.clabe}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 18);
                                            setForm({
                                                ...form,
                                                datosBancarios: { ...form.datosBancarios, clabe: val }
                                            });
                                        }}
                                        placeholder="012180001234567890"
                                        className={`w-full text-xs p-3 rounded-2xl border font-mono tracking-widest outline-none pr-28 ${
                                            form.datosBancarios.clabe.length === 18
                                                ? 'border-emerald-500 bg-emerald-50/20 text-emerald-950 font-bold'
                                                : 'border-slate-200 focus:border-teal-500'
                                        }`}
                                    />
                                    <div className="absolute right-2 top-2 flex items-center gap-1.5">
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                            form.datosBancarios.clabe.length === 18 ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400'
                                        }`}>
                                            {form.datosBancarios.clabe.length}/18
                                        </span>
                                        {form.datosBancarios.clabe.length === 18 && (
                                            <button
                                                type="button"
                                                onClick={copiarClabe}
                                                className="px-2 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                                title="Copiar CLABE"
                                            >
                                                {copiadoClabe ? <Check size={11} /> : <Copy size={11} />}
                                                {copiadoClabe ? 'Copiada' : 'Copiar'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="sm:col-span-3">
                                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo del Titular de la Cuenta:</label>
                                <input
                                    type="text"
                                    value={form.datosBancarios.titular}
                                    onChange={(e) => setForm({
                                        ...form,
                                        datosBancarios: { ...form.datosBancarios, titular: e.target.value }
                                    })}
                                    placeholder="Nombre tal como aparece en tu estado de cuenta"
                                    className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:border-teal-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'desempeno' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                        <Sparkles size={18} className="text-teal-600" /> Tu Desempeño y Esquema Semanal
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Métricas transparentes y acumulados en tiempo real.
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200">
                                    <Lock size={12} /> Modificable solo por Administración
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
                                    <span className="text-[10px] font-bold uppercase text-emerald-700">Comisiones de la Semana</span>
                                    <p className="text-2xl font-black text-emerald-900 mt-1">
                                        ${Number(staffData?.saldoComisiones || 0).toLocaleString('es-MX')}
                                    </p>
                                    <span className="text-[10px] text-emerald-600 mt-0.5 block">Acumulado a liquidar</span>
                                </div>

                                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
                                    <span className="text-[10px] font-bold uppercase text-slate-600">Sueldo Base Semanal</span>
                                    <p className="text-2xl font-black text-slate-900 mt-1">
                                        ${Number(staffData?.sueldoBase || 0).toLocaleString('es-MX')}
                                    </p>
                                    <span className="text-[10px] text-slate-500 mt-0.5 block">Monto fijo estipulado</span>
                                </div>

                                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
                                    <span className="text-[10px] font-bold uppercase text-blue-700">% Comisión Servicios</span>
                                    <p className="text-2xl font-black text-blue-900 mt-1">
                                        {Number(staffData?.comisionServicios || 0)}%
                                    </p>
                                    <span className="text-[10px] text-blue-600 mt-0.5 block">Sobre precio de consulta</span>
                                </div>

                                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200">
                                    <span className="text-[10px] font-bold uppercase text-purple-700">Citas en el Mes</span>
                                    <p className="text-2xl font-black text-purple-900 mt-1">
                                        {citasDelMes}
                                    </p>
                                    <span className="text-[10px] text-purple-600 mt-0.5 block">Sesiones agendadas</span>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Puesto Asignado</span>
                                    <p className="font-bold text-slate-800 mt-0.5">{staffData?.puesto || 'Especialista'}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Turno Habitual</span>
                                    <p className="font-bold text-slate-800 mt-0.5">{staffData?.turno || 'Turno Completo (Clínica ALFRA)'}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Fecha de Registro</span>
                                    <p className="font-bold text-slate-800 mt-0.5">{staffData?.fechaIngreso || '2024'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <span className="text-xs text-slate-400">
                        Los cambios se reflejan inmediatamente en tu credencial y expediente.
                    </span>

                    <button
                        type="submit"
                        disabled={guardando}
                        className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-teal-900/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        <Save size={16} />
                        {guardando ? 'Guardando...' : 'Guardar Todos los Cambios'}
                    </button>
                </div>
            </form>
        </div>
    );
}
