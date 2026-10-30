import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    MapPin, Clock, User, CheckCircle2, AlertTriangle, Shield,
    RefreshCw, Download, Navigation, Map, Compass, Settings, Check, X,
    Calendar, UserCheck, AlertCircle, Lock
} from 'lucide-react';
import {
    getConfigChecadorGPS,
    saveConfigChecadorGPS,
    calcularDistanciaMetros,
    registrarChecadoGPS,
    onAsistenciaHoyChange,
    onMisRegistrosAsistenciaChange,
    CLINICA_COORDS_DEFAULT
} from '../services/asistenciaService';

export default function ChecadorView() {
    const { userRole, currentUser } = useAuth();
    const isClientAdmin = userRole === 'Administrador';

    // Configuraci?n de Geocerca GPS de la Cl?nica
    const [configClinica, setConfigClinica] = useState(CLINICA_COORDS_DEFAULT);
    const [editandoConfig, setEditandoConfig] = useState(false);
    const [nuevoRadio, setNuevoRadio] = useState(150);
    const [guardandoConfig, setGuardandoConfig] = useState(false);

    // Estado del sensor GPS del dispositivo
    const [gpsCoords, setGpsCoords] = useState(null);
    const [distanciaMetros, setDistanciaMetros] = useState(null);
    const [gpsCargando, setGpsCargando] = useState(true);
    const [gpsError, setGpsError] = useState(null);

    // Acci?n y procesamiento de checado
    const [procesandoChecado, setProcesandoChecado] = useState(false);
    const [checadoExitoso, setChecadoExitoso] = useState(null);
    const [checadoError, setChecadoError] = useState(null);

    // Registros de asistencia
    const [misRegistros, setMisRegistros] = useState([]);
    const [asistenciaHoyAdmin, setAsistenciaHoyAdmin] = useState([]);
    const [filtroTipoAdmin, setFiltroTipoAdmin] = useState('todos');

    useEffect(() => {
        getConfigChecadorGPS().then(cfg => {
            setConfigClinica(cfg);
            setNuevoRadio(cfg.radioMetros || 150);
        });
    }, []);

    useEffect(() => {
        if (!currentUser?.uid) return;
        const unsub = onMisRegistrosAsistenciaChange(currentUser.uid, (logs) => {
            setMisRegistros(logs);
        });
        return () => unsub();
    }, [currentUser?.uid]);

    useEffect(() => {
        if (!isClientAdmin) return;
        const unsub = onAsistenciaHoyChange((logs) => {
            setAsistenciaHoyAdmin(logs);
        });
        return () => unsub();
    }, [isClientAdmin]);

    const obtenerUbicacionGPS = () => {
        setGpsCargando(true);
        setGpsError(null);

        if (!navigator.geolocation) {
            setGpsError('Tu navegador o dispositivo no soporta geolocalizaci?n GPS.');
            setGpsCargando(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const precision = Math.round(position.coords.accuracy);

                setGpsCoords({ lat, lng, precision });

                const dist = calcularDistanciaMetros(
                    lat,
                    lng,
                    configClinica.lat,
                    configClinica.lng
                );
                setDistanciaMetros(dist);
                setGpsCargando(false);
            },
            (error) => {
                let msg = 'No se pudo obtener la ubicaci?n GPS.';
                if (error.code === error.PERMISSION_DENIED) {
                    msg = 'Permiso de ubicaci?n denegado. Por favor activa el GPS de tu celular o navegador y autoriza la ubicaci?n para poder checar.';
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    msg = 'Se?al de GPS no disponible en este momento. Intenta al aire libre o cerca de una ventana.';
                } else if (error.code === error.TIMEOUT) {
                    msg = 'Tiempo de espera de GPS agotado. Pulsa actualizar para reintentar.';
                }
                setGpsError(msg);
                setGpsCargando(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    };

    useEffect(() => {
        if (configClinica?.lat) {
            obtenerUbicacionGPS();
        }
    }, [configClinica]);

    const dentroDeLaClinica = useMemo(() => {
        if (distanciaMetros === null) return false;
        return distanciaMetros <= (configClinica.radioMetros || 150);
    }, [distanciaMetros, configClinica]);

    const playBeep = (type = 'success') => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'success') {
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.12);
                setTimeout(() => {
                    const osc2 = ctx.createOscillator();
                    const gain2 = ctx.createGain();
                    osc2.connect(gain2);
                    gain2.connect(ctx.destination);
                    osc2.frequency.setValueAtTime(1174, ctx.currentTime);
                    gain2.gain.setValueAtTime(0.12, ctx.currentTime);
                    osc2.start();
                    osc2.stop(ctx.currentTime + 0.18);
                }, 130);
            } else {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, ctx.currentTime);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.35);
            }
        } catch {}
    };

    const handleChecar = async (tipo = 'Entrada') => {
        if (!dentroDeLaClinica) {
            playBeep('error');
            const distTxt = distanciaMetros >= 1000 ? `${(distanciaMetros / 1000).toFixed(1)} km` : `${distanciaMetros} metros`;
            setChecadoError(`Fallo de Verificaci?n GPS: Te encuentras a ${distTxt} de la cl?nica. Debes estar en las instalaciones para registrar asistencia.`);
            return;
        }

        setProcesandoChecado(true);
        setChecadoExitoso(null);
        setChecadoError(null);

        try {
            const res = await registrarChecadoGPS({
                uid: currentUser?.uid,
                nombre: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Colaborador',
                email: currentUser?.email || '',
                rol: userRole || 'Staff',
                puesto: userRole || 'Staff',
                tipo,
                lat: gpsCoords?.lat,
                lng: gpsCoords?.lng,
                distanciaMetros,
                dentroDeRango: true
            });

            playBeep('success');
            setChecadoExitoso({
                tipo,
                hora: res.horaStr,
                distancia: distanciaMetros,
                estado: res.estado
            });

            setTimeout(() => {
                setChecadoExitoso(null);
            }, 6000);
        } catch (err) {
            console.error('Error registrando checado:', err);
            playBeep('error');
            setChecadoError('Error al guardar asistencia: ' + err.message);
        } finally {
            setProcesandoChecado(false);
        }
    };

    const handleCapturarUbicacionClinica = async () => {
        if (!gpsCoords) {
            alert('Primero activa y detecta tu ubicaci?n GPS actual.');
            return;
        }
        if (!confirm(`?Establecer tu ubicaci?n actual (${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}) como las coordenadas oficiales de ALFRA Cl?nica?`)) {
            return;
        }

        setGuardandoConfig(true);
        try {
            const updated = {
                ...configClinica,
                lat: gpsCoords.lat,
                lng: gpsCoords.lng,
                radioMetros: Number(nuevoRadio) || 150
            };
            await saveConfigChecadorGPS(updated);
            setConfigClinica(updated);
            setEditandoConfig(false);
            alert('? Coordenadas oficiales de la cl?nica actualizadas exitosamente.');
        } catch (e) {
            alert('Error al guardar: ' + e.message);
        } finally {
            setGuardandoConfig(false);
        }
    };

    const handleExportarCSV = () => {
        if (asistenciaHoyAdmin.length === 0) {
            alert('No hay registros de asistencia de hoy para exportar.');
            return;
        }
        const headers = ['Nombre', 'Puesto/Rol', 'Tipo', 'Hora', 'Estado', 'Distancia (m)', 'Fecha', 'Latitud', 'Longitud'];
        const rows = asistenciaHoyAdmin.map(a => [
            `"${a.nombre || ''}"`,
            `"${a.puesto || a.rol || ''}"`,
            `"${a.tipo || ''}"`,
            `"${a.horaStr || ''}"`,
            `"${a.estado || ''}"`,
            a.distanciaMetros || 0,
            `"${a.fechaYMD || ''}"`,
            a.lat || '',
            a.lng || ''
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Asistencia_ALFRA_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const logsAdminFiltrados = useMemo(() => {
        if (filtroTipoAdmin === 'todos') return asistenciaHoyAdmin;
        return asistenciaHoyAdmin.filter(a => a.tipo === filtroTipoAdmin);
    }, [asistenciaHoyAdmin, filtroTipoAdmin]);
    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 pb-24 text-slate-800 dark:text-slate-100">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                        <Compass className="w-8 h-8" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Checador Satelital GPS
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                                100% Satelital - Sin QR
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Verificación de asistencia por presencia física dentro del perímetro de la clínica.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 border ${
                        dentroDeLaClinica
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                    }`}>
                        {dentroDeLaClinica ? (
                            <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-pulse" />
                                <span>Dentro del Perímetro</span>
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <span>Fuera de Rango</span>
                            </>
                        )}
                    </div>

                    <button
                        onClick={obtenerUbicacionGPS}
                        disabled={gpsCargando}
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium transition flex items-center gap-2"
                        title="Actualizar posición satelital"
                    >
                        <RefreshCw className={`w-4 h-4 ${gpsCargando ? 'animate-spin text-teal-600' : ''}`} />
                        <span className="hidden sm:inline">Actualizar GPS</span>
                    </button>
                </div>
            </div>

            {/* Banners de Notificación */}
            {checadoExitoso && (
                <div className="bg-emerald-500 text-white p-5 rounded-2xl shadow-lg flex items-center gap-4 animate-in fade-in duration-300">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Check className="w-7 h-7" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-lg">¡{checadoExitoso.tipo} Registrada con Éxito!</h4>
                        <p className="text-emerald-100 text-sm">
                            Hora: <strong className="text-white">{checadoExitoso.hora}</strong> • Estado: <strong className="text-white">{checadoExitoso.estado}</strong> • A <strong className="text-white">{checadoExitoso.distancia}m</strong> de la clínica.
                        </p>
                    </div>
                </div>
            )}

            {checadoError && (
                <div className="bg-rose-500 text-white p-5 rounded-2xl shadow-lg flex items-center gap-4 animate-in fade-in duration-300">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-7 h-7" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-lg">No se pudo registrar asistencia</h4>
                        <p className="text-rose-100 text-sm">{checadoError}</p>
                    </div>
                    <button onClick={() => setChecadoError(null)} className="p-1 text-white/80 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {gpsError && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl text-amber-800 dark:text-amber-200 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm">
                        <p className="font-semibold">Aviso de Localización Satelital</p>
                        <p className="mt-0.5">{gpsError}</p>
                    </div>
                    <button
                        onClick={obtenerUbicacionGPS}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition shrink-0"
                    >
                        Reintentar GPS
                    </button>
                </div>
            )}

            {/* Panel Principal: Radar Satelital & Botones de Checado */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Columna Izquierda: Radar y Acciones (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                    {/* Radar Card */}
                    <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden">
                        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
                        <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

                        <div className="relative z-10 flex flex-col items-center text-center space-y-5">
                            {/* Radar Visual */}
                            <div className="relative w-36 h-36 flex items-center justify-center my-2">
                                <div className={`absolute inset-0 rounded-full border border-dashed border-teal-500/40 ${gpsCargando ? 'animate-spin' : ''}`} />
                                <div className={`absolute inset-3 rounded-full border border-teal-500/20 ${dentroDeLaClinica ? 'bg-emerald-500/10 animate-ping duration-1000' : ''}`} />
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-transform ${
                                    dentroDeLaClinica
                                        ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white scale-105'
                                        : 'bg-slate-700 text-slate-300'
                                }`}>
                                    <MapPin className="w-10 h-10" />
                                </div>
                            </div>

                            {/* Distancia y Estado */}
                            <div>
                                <div className="text-xs uppercase tracking-wider text-teal-400 font-semibold mb-1">
                                    Distancia a Clínica ALFRA
                                </div>
                                <div className="text-4xl md:text-5xl font-black tracking-tight text-white">
                                    {gpsCargando ? (
                                        <span className="text-slate-400 text-3xl font-medium">Localizando satélite...</span>
                                    ) : distanciaMetros !== null ? (
                                        distanciaMetros >= 1000
                                            ? `${(distanciaMetros / 1000).toFixed(2)} km`
                                            : `${distanciaMetros} metros`
                                    ) : (
                                        '--'
                                    )}
                                </div>
                                <p className="text-sm text-slate-300 mt-2 max-w-md mx-auto">
                                    {gpsCargando ? (
                                        'Consultando antena GPS de tu dispositivo...'
                                    ) : dentroDeLaClinica ? (
                                        `✅ Te encuentras dentro del radio autorizado (${configClinica.radioMetros || 150}m). Presiona un botón abajo para checar.`
                                    ) : (
                                        `🔒 Te encuentras fuera del perímetro permitido (${configClinica.radioMetros || 150}m). Acércate a la clínica para habilitar el registro.`
                                    )}
                                </p>
                            </div>

                            {/* Badge de Precisión Satelital */}
                            {gpsCoords && (
                                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/80 px-3.5 py-1.5 rounded-full border border-slate-700">
                                    <Compass className="w-3.5 h-3.5 text-teal-400" />
                                    <span>Precisión GPS: ±{gpsCoords.precision}m</span>
                                    <span>•</span>
                                    <span>{gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Botones de Acción: Entrada y Salida */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Botón Entrada */}
                        <button
                            onClick={() => handleChecar('Entrada')}
                            disabled={!dentroDeLaClinica || procesandoChecado}
                            className={`p-6 rounded-2xl flex flex-col items-center text-center transition-all duration-200 border-2 ${
                                dentroDeLaClinica && !procesandoChecado
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-emerald-400/30 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:scale-[1.02] cursor-pointer'
                                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/60 cursor-not-allowed'
                            }`}
                        >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                                dentroDeLaClinica
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                            }`}>
                                {dentroDeLaClinica ? <CheckCircle2 className="w-8 h-8" /> : <Lock className="w-7 h-7" />}
                            </div>
                            <span className="text-lg font-bold">
                                {procesandoChecado ? 'Procesando...' : 'Registrar Entrada'}
                            </span>
                            <span className="text-xs mt-1 opacity-90">
                                {dentroDeLaClinica ? 'Presiona al iniciar turno' : 'Bloqueado (fuera de rango)'}
                            </span>
                        </button>

                        {/* Botón Salida */}
                        <button
                            onClick={() => handleChecar('Salida')}
                            disabled={!dentroDeLaClinica || procesandoChecado}
                            className={`p-6 rounded-2xl flex flex-col items-center text-center transition-all duration-200 border-2 ${
                                dentroDeLaClinica && !procesandoChecado
                                    ? 'bg-gradient-to-br from-indigo-600 to-slate-800 hover:from-indigo-700 hover:to-slate-900 text-white border-indigo-400/30 shadow-lg shadow-indigo-600/25 hover:shadow-xl hover:scale-[1.02] cursor-pointer'
                                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700/60 cursor-not-allowed'
                            }`}
                        >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                                dentroDeLaClinica
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                            }`}>
                                {dentroDeLaClinica ? <Clock className="w-8 h-8" /> : <Lock className="w-7 h-7" />}
                            </div>
                            <span className="text-lg font-bold">
                                {procesandoChecado ? 'Procesando...' : 'Registrar Salida'}
                            </span>
                            <span className="text-xs mt-1 opacity-90">
                                {dentroDeLaClinica ? 'Presiona al terminar turno' : 'Bloqueado (fuera de rango)'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Columna Derecha: Información de la Clínica y Mis Registros (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                    {/* Tarjeta de Geocerca Oficial */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                                <h3 className="font-bold text-slate-900 dark:text-white">
                                    Ubicación Oficial ALFRA
                                </h3>
                            </div>
                            <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                                Radio: {configClinica.radioMetros || 150}m
                            </span>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
                            <p className="font-medium text-slate-900 dark:text-white">
                                {configClinica.nombre || 'CLINICA ALFRA LZC'}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                                {configClinica.direccion || 'Río Fuerte 26, Lomas de Bella Vista, Cd. Lázaro Cárdenas, Mich.'}
                            </p>
                            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60">
                                <span className="font-mono text-[11px] text-slate-400">
                                    GPS: {Number(configClinica.lat).toFixed(5)}, {Number(configClinica.lng).toFixed(5)}
                                </span>
                                <a
                                    href={`https://maps.google.com/?q=${configClinica.lat},${configClinica.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1 font-semibold text-xs"
                                >
                                    Ver en Maps ↗
                                </a>
                            </div>
                        </div>

                        {/* Opciones de Calibración para Administrador */}
                        {isClientAdmin && (
                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                                {!editandoConfig ? (
                                    <button
                                        onClick={() => setEditandoConfig(true)}
                                        className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition"
                                    >
                                        <Settings className="w-3.5 h-3.5" />
                                        <span>Calibrar Geocerca GPS (Admin)</span>
                                    </button>
                                ) : (
                                    <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                Ajustes de Perímetro
                                            </span>
                                            <button
                                                onClick={() => setEditandoConfig(false)}
                                                className="text-slate-400 hover:text-slate-600 text-xs"
                                            >
                                                Cerrar
                                            </button>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] text-slate-500 mb-1">
                                                Radio de cobertura en metros:
                                            </label>
                                            <select
                                                value={nuevoRadio}
                                                onChange={(e) => setNuevoRadio(e.target.value)}
                                                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                            >
                                                <option value="80">80 metros (Solo interior)</option>
                                                <option value="120">120 metros</option>
                                                <option value="150">150 metros (Recomendado)</option>
                                                <option value="200">200 metros (Con estacionamiento)</option>
                                                <option value="300">300 metros</option>
                                            </select>
                                        </div>

                                        <button
                                            onClick={handleCapturarUbicacionClinica}
                                            disabled={guardandoConfig}
                                            className="w-full py-2 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm"
                                        >
                                            <MapPin className="w-3.5 h-3.5" />
                                            <span>{guardandoConfig ? 'Guardando...' : 'Fijar mi GPS actual como la Clínica'}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Mis Registros de Hoy */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                <h3 className="font-bold text-slate-900 dark:text-white">
                                    Mis Registros Recientes
                                </h3>
                            </div>
                            <span className="text-xs text-slate-500 font-mono">
                                {misRegistros.length} checado(s)
                            </span>
                        </div>

                        {misRegistros.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                <p>No tienes checados registrados hoy.</p>
                                <p className="text-xs mt-1 text-slate-400">Presiona Registrar Entrada al llegar.</p>
                            </div>
                        ) : (
                            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                                {misRegistros.map((reg) => (
                                    <div
                                        key={reg.id}
                                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                                reg.tipo === 'Entrada'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                    : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                                            }`}>
                                                {reg.tipo === 'Entrada' ? 'E' : 'S'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                    {reg.tipo}
                                                </p>
                                                <p className="text-[11px] text-slate-400">
                                                    {reg.fechaYMD} • a {reg.distanciaMetros || 0}m (GPS)
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                                                {reg.horaStr}
                                            </p>
                                            <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                                reg.estado === 'Retardo'
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                            }`}>
                                                {reg.estado || 'A tiempo'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Panel de Supervisión para Administradores */}
            {isClientAdmin && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                                    Supervisión de Asistencia en Tiempo Real (Hoy)
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Auditoría de presencia de colaboradores verificada vía satélite GPS.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Filtro tipo */}
                            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-700 p-1 text-xs">
                                {['todos', 'Entrada', 'Salida'].map(tipo => (
                                    <button
                                        key={tipo}
                                        onClick={() => setFiltroTipoAdmin(tipo)}
                                        className={`px-3 py-1 rounded-lg font-medium transition ${
                                            filtroTipoAdmin === tipo
                                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                    >
                                        {tipo === 'todos' ? 'Todos' : tipo}
                                    </button>
                                ))}
                            </div>

                            {/* Exportar CSV */}
                            <button
                                onClick={handleExportarCSV}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
                                title="Exportar asistencia del día en formato CSV / Excel"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Exportar CSV</span>
                            </button>
                        </div>
                    </div>

                    {/* Tabla de Registros */}
                    {logsAdminFiltrados.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                            <p>No se han registrado checados el día de hoy.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider">
                                    <tr>
                                        <th className="p-3.5">Colaborador</th>
                                        <th className="p-3.5">Puesto / Rol</th>
                                        <th className="p-3.5">Tipo</th>
                                        <th className="p-3.5">Hora</th>
                                        <th className="p-3.5">Distancia Satelital</th>
                                        <th className="p-3.5">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {logsAdminFiltrados.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition">
                                            <td className="p-3.5 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    {(log.nombre || 'U')[0].toUpperCase()}
                                                </div>
                                                <span>{log.nombre || log.email || 'Colaborador'}</span>
                                            </td>
                                            <td className="p-3.5 text-slate-500 dark:text-slate-400 text-xs">
                                                {log.puesto || log.rol || 'Staff'}
                                            </td>
                                            <td className="p-3.5">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                    log.tipo === 'Entrada'
                                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                                                }`}>
                                                    {log.tipo === 'Entrada' ? '📍 Entrada' : '🚪 Salida'}
                                                </span>
                                            </td>
                                            <td className="p-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                                                {log.horaStr}
                                            </td>
                                            <td className="p-3.5 text-xs text-slate-500 font-mono">
                                                {log.distanciaMetros !== undefined ? `${log.distanciaMetros}m` : '--'}
                                            </td>
                                            <td className="p-3.5">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    log.estado === 'Retardo'
                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                                }`}>
                                                    {log.estado || 'A tiempo'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
