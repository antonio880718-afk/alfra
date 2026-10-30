import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    Camera, QrCode, MapPin, Wifi, CheckCircle2, Clock, User, Play, Pause,
    Calendar, Shield, AlertTriangle, Map, HelpCircle, UserCheck, RefreshCw, X, Download
} from 'lucide-react';

export default function ChecadorView() {
    const { userRole, currentUser } = useAuth();
    const isClientAdmin = userRole === 'Administrador';

    const [action, setAction] = useState('entrada');
    const [scanning, setScanning] = useState(false);
    const [scanSuccess, setScanSuccess] = useState(false);
    const [scanError, setScanError] = useState(null);
    const [scannedTime, setScannedTime] = useState(null);

    const [gpsMode, setGpsMode] = useState('dentro');
    const [wifiMode, setWifiMode] = useState('conectado');
    const [securityType, setSecurityType] = useState('gps');

    const [personalLogs, setPersonalLogs] = useState([
        { fecha: 'Lunes 18 Mayo', entrada: '08:54 AM', salida: '06:05 PM', estado: 'A tiempo', metodo: 'QR + GPS' },
        { fecha: 'Martes 19 Mayo', entrada: '09:08 AM', salida: '06:12 PM', estado: 'Retardo', demerito: '8 min', metodo: 'QR + GPS' },
        { fecha: 'Miércoles 20 Mayo', entrada: '--', salida: '--', estado: 'Pendiente', metodo: 'QR + GPS' },
    ]);

    const [dynamicQrCode, setDynamicQrCode] = useState('ALFRA-SECURE-TOKEN-92819-XYZ');
    const [qrCountdown, setQrCountdown] = useState(30);
    const [isDynamicActive, setIsDynamicActive] = useState(true);
    const [selectedEmployeeMap, setSelectedEmployeeMap] = useState(null);

    const [adminLogs, setAdminLogs] = useState([
        { id: 1, nombre: 'Dr. Alejandro Ríos', rol: 'Especialista', hora: '08:52 AM', tipo: 'Entrada', estado: 'A tiempo', metodo: 'QR + GPS', lat: '19.4326', lng: '-99.1332', distancia: '12m' },
        { id: 2, nombre: 'Ana Laura Gómez', rol: 'Recepcionista', hora: '09:05 AM', tipo: 'Entrada', estado: 'Retardo', demerito: '5 min', metodo: 'QR + Wi-Fi', lat: '19.4329', lng: '-99.1331', distancia: 'En Red WiFi' },
        { id: 3, nombre: 'Dra. Claudia Esparza', rol: 'Especialista', hora: '08:45 AM', tipo: 'Entrada', estado: 'A tiempo', metodo: 'QR Dinámico', lat: '19.4325', lng: '-99.1333', distancia: '8m' },
        { id: 4, nombre: 'Carlos Mendoza', rol: 'Recepcionista', hora: '09:12 AM', tipo: 'Entrada', estado: 'Retardo', demerito: '12 min', metodo: 'QR + GPS', lat: '19.4327', lng: '-99.1330', distancia: '25m' },
    ]);

    // Audio confirmation simulation (Web Audio API)
    const playBeep = (type) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'success') {
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
                
                setTimeout(() => {
                    const osc2 = ctx.createOscillator();
                    const gain2 = ctx.createGain();
                    osc2.connect(gain2);
                    gain2.connect(ctx.destination);
                    osc2.frequency.setValueAtTime(1200, ctx.currentTime);
                    gain2.gain.setValueAtTime(0.1, ctx.currentTime);
                    osc2.start();
                    osc2.stop(ctx.currentTime + 0.15);
                }, 120);
            } else {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, ctx.currentTime); 
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.3);
            }
        } catch (e) {
            console.log("Audio not supported");
        }
    };

    // Dynamic QR countdown generator
    useEffect(() => {
        let interval = null;
        if (isDynamicActive && isClientAdmin) {
            interval = setInterval(() => {
                setQrCountdown((prev) => {
                    if (prev <= 1) {
                        const randomToken = Math.random().toString(36).substring(2, 7).toUpperCase();
                        setDynamicQrCode(`ALFRA-SECURE-${randomToken}-${Date.now().toString().slice(-4)}`);
                        return 30;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isDynamicActive, isClientAdmin]);

    // Simulate scanning action
    const handleSimulateScan = () => {
        setScanning(true);
        setScanSuccess(false);
        setScanError(null);

        setTimeout(() => {
            setScanning(false);

            if (securityType === 'gps' && gpsMode === 'fuera') {
                playBeep('error');
                setScanError('Fallo de Verificación GPS: Te encuentras a 3.4 km de la clínica. Debes estar en las instalaciones.');
                return;
            }

            if (securityType === 'wifi' && wifiMode === 'desconectado') {
                playBeep('error');
                setScanError('Fallo de Conexión WiFi: Conéctate a la red "Alfra Clinica Privada" para poder checar.');
                return;
            }

            // Success case
            playBeep('success');
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setScannedTime(timeString);
            setScanSuccess(true);

            const todayStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
            const capitalizedStr = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);
            
            const isLate = now.getHours() >= 9 && now.getMinutes() > 0 && action === 'entrada';
            const estado = isLate ? 'Retardo' : 'A tiempo';
            const demerito = isLate ? `${now.getMinutes()} min` : undefined;

            setPersonalLogs((prev) => {
                const cleanLogs = prev.filter(l => !l.fecha.includes('Miércoles'));
                return [
                    {
                        fecha: capitalizedStr,
                        entrada: action === 'entrada' ? timeString : '09:00 AM',
                        salida: action === 'salida' ? timeString : '--',
                        estado: estado,
                        demerito: demerito,
                        metodo: securityType === 'gps' ? 'QR + GPS' : securityType === 'wifi' ? 'QR + Wi-Fi' : 'QR Dinámico'
                    },
                    ...cleanLogs
                ];
            });

            const newAdminLog = {
                id: Date.now(),
                nombre: currentUser?.nombre || 'Dr. Alejandro Ríos',
                rol: userRole,
                hora: timeString,
                tipo: action === 'entrada' ? 'Entrada' : 'Salida',
                estado: estado,
                demerito: demerito,
                metodo: securityType === 'gps' ? 'QR + GPS' : securityType === 'wifi' ? 'QR + Wi-Fi' : 'QR Dinámico',
                lat: '19.4326',
                lng: '-99.1332',
                distancia: securityType === 'gps' ? (gpsMode === 'dentro' ? '4m' : '3.4km') : 'Red WiFi'
            };
            setAdminLogs(prev => [newAdminLog, ...prev]);

        }, 1500);
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#F4F6F8] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                        {isClientAdmin ? 'Panel de Asistencia y Checador' : 'Checador Digital Alfra'}
                    </h1>
                    <p className="text-gray-500 font-medium mt-1">
                        {isClientAdmin ? 'Gestión, monitoreo de puntualidad y claves QR de la clínica.' : 'Registra tu entrada y salida escaneando el código de la sucursal.'}
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
                    <Shield size={20} className="text-turquesa" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Estatus Seguridad:</span>
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Activo</span>
                </div>
            </div>

            {isClientAdmin ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-28">
                                <div className="absolute top-4 right-4 bg-turquesa/10 p-2.5 rounded-2xl text-turquesa"><UserCheck size={20} /></div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Activos Hoy</span>
                                <h3 className="text-3xl font-black text-gray-900">8 <span className="text-sm font-bold text-gray-400">/ 12</span></h3>
                            </div>
                            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-28">
                                <div className="absolute top-4 right-4 bg-amber-50 p-2.5 rounded-2xl text-amber-500"><Clock size={20} /></div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Retardos</span>
                                <h3 className="text-3xl font-black text-amber-600">2 <span className="text-sm font-bold text-gray-400">empleados</span></h3>
                            </div>
                            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-28">
                                <div className="absolute top-4 right-4 bg-emerald-50 p-2.5 rounded-2xl text-emerald-600"><Wifi size={20} /></div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Método Activo</span>
                                <h3 className="text-md font-black text-emerald-600 uppercase tracking-widest mt-1">GPS + QR</h3>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                    <Calendar size={18} className="text-turquesa" />
                                    Registro de Asistencia Reciente (Hoy)
                                </h2>
                                <button className="flex items-center gap-1.5 text-xs font-bold text-turquesa bg-turquesa/10 px-3 py-1.5 rounded-xl hover:bg-turquesa/20 transition-all">
                                    <Download size={14} /> EXPORTAR EXCEL
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                            <th className="pb-3">Colaborador</th>
                                            <th className="pb-3">Rol</th>
                                            <th className="pb-3">Hora</th>
                                            <th className="pb-3">Tipo</th>
                                            <th className="pb-3">Estatus</th>
                                            <th className="pb-3">Método</th>
                                            <th className="pb-3 text-right">Ubicación</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 text-sm font-medium text-gray-700">
                                        {adminLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="py-4 flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-turquesa/10 flex items-center justify-center text-turquesa font-bold text-xs">
                                                        {log.nombre.split(' ')[1] ? log.nombre.split(' ')[1].slice(0, 2).toUpperCase() : 'ST'}
                                                    </div>
                                                    <span className="font-bold text-gray-900">{log.nombre}</span>
                                                </td>
                                                <td className="py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{log.rol}</td>
                                                <td className="py-4 font-black">{log.hora}</td>
                                                <td className="py-4">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                        log.tipo === 'Entrada' ? 'text-emerald-700 bg-emerald-50' : 'text-blue-700 bg-blue-50'
                                                    }`}>
                                                        {log.tipo}
                                                    </span>
                                                </td>
                                                <td className="py-4">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                        log.estado === 'A tiempo' ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'
                                                    }`}>
                                                        {log.estado} {log.demerito ? `(${log.demerito})` : ''}
                                                    </span>
                                                </td>
                                                <td className="py-4">
                                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wider">{log.metodo}</span>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <button 
                                                        onClick={() => setSelectedEmployeeMap(log)}
                                                        className="inline-flex items-center gap-1 text-xs font-bold text-turquesa hover:underline"
                                                    >
                                                        <MapPin size={12} /> {log.distancia}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
                            <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                <QrCode size={20} className="text-turquesa" />
                                Generador de QR Oficial
                            </h2>
                            <p className="text-xs text-gray-500 font-bold leading-relaxed">
                                Este QR debe colocarse en recepción. Los empleados lo escanearán para registrar asistencia.
                            </p>

                            <div className="flex justify-center p-6 bg-gradient-to-br from-turquesa/5 to-transparent rounded-3xl border border-dashed border-gray-200 relative overflow-hidden">
                                <div className="flex flex-col items-center space-y-4">
                                    <div className="w-48 h-48 bg-white p-4 rounded-2xl shadow-md border border-gray-100 flex items-center justify-center relative">
                                        <div className="grid grid-cols-5 gap-2 w-full h-full opacity-80">
                                            {Array.from({ length: 25 }).map((_, i) => (
                                                <div key={i} className={`rounded-sm ${
                                                    (i % 3 === 0 || i % 4 === 0 || i < 5 || i % 5 === 0 || i > 20) && i !== 12 ? 'bg-gray-800' : 'bg-transparent'
                                                }`} />
                                            ))}
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-10 h-10 bg-white rounded-xl shadow-inner border border-gray-100 flex items-center justify-center text-turquesa font-black text-xs">
                                                ALFRA
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-center">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Código del Token</span>
                                        <code className="text-xs font-black text-gray-700 block bg-gray-50 px-3 py-1 rounded-xl mt-1 max-w-[200px] truncate">{dynamicQrCode}</code>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                                        <RefreshCw size={14} className="text-turquesa animate-spin" />
                                        QR Dinámico Antifraude
                                    </span>
                                    <button 
                                        onClick={() => setIsDynamicActive(!isDynamicActive)}
                                        className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${isDynamicActive ? 'bg-turquesa' : 'bg-gray-200'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${isDynamicActive ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                {isDynamicActive && (
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <span className="text-gray-400">Rota automáticamente en:</span>
                                        <span className="text-turquesa font-black bg-turquesa/10 px-2 py-0.5 rounded-full">{qrCountdown} seg</span>
                                    </div>
                                )}
                                <p className="text-[10px] text-gray-400 font-bold leading-normal">
                                    *Si está activo, el QR cambia cada 30 segundos en recepción. Nadie podrá usar capturas de pantalla viejas para checar.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                        
                        <div className="bg-amber-50/50 rounded-2xl border border-dashed border-amber-200 p-4 space-y-3">
                            <span className="text-xs font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Shield size={16} />
                                Panel de Simulación Localhost (Prueba las Reglas)
                            </span>
                            <p className="text-xs text-amber-700/80 font-bold leading-normal">
                                Modifica los sensores virtuales de tu celular aquí abajo para ver cómo reacciona la seguridad del checador al escanear:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                                <div>
                                    <label className="block text-[9px] font-black text-amber-800 uppercase tracking-wider mb-1">Método Activo</label>
                                    <select 
                                        value={securityType} 
                                        onChange={(e) => setSecurityType(e.target.value)}
                                        className="w-full bg-white border border-amber-200 rounded-xl px-2 py-1.5 text-xs font-bold text-gray-700 focus:outline-none"
                                    >
                                        <option value="gps">Opción B: QR + GPS Clínica</option>
                                        <option value="wifi">Opción C: QR + Wi-Fi Clínica</option>
                                        <option value="dinamico">Opción A: QR Dinámico</option>
                                    </select>
                                </div>
                                
                                {securityType === 'gps' && (
                                    <div>
                                        <label className="block text-[9px] font-black text-amber-800 uppercase tracking-wider mb-1">GPS Virtual</label>
                                        <select 
                                            value={gpsMode} 
                                            onChange={(e) => setGpsMode(e.target.value)}
                                            className="w-full bg-white border border-amber-200 rounded-xl px-2 py-1.5 text-xs font-bold text-gray-700 focus:outline-none"
                                        >
                                            <option value="dentro">En la clínica (a 5 metros)</option>
                                            <option value="fuera">En su casa (a 3.4 kilómetros)</option>
                                        </select>
                                    </div>
                                )}

                                {securityType === 'wifi' && (
                                    <div>
                                        <label className="block text-[9px] font-black text-amber-800 uppercase tracking-wider mb-1">Red Wi-Fi Virtual</label>
                                        <select 
                                            value={wifiMode} 
                                            onChange={(e) => setWifiMode(e.target.value)}
                                            className="w-full bg-white border border-amber-200 rounded-xl px-2 py-1.5 text-xs font-bold text-gray-700 focus:outline-none"
                                        >
                                            <option value="conectado">Conectado a "Alfra WiFi"</option>
                                            <option value="desconectado">Conectado a "Red Móvil 5G"</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => { setAction('entrada'); setScanSuccess(false); }}
                                className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 border transition-all ${
                                    action === 'entrada'
                                        ? 'bg-turquesa text-white border-turquesa shadow-md'
                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <Play size={16} /> Registrar Entrada
                            </button>
                            <button
                                onClick={() => { setAction('salida'); setScanSuccess(false); }}
                                className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 border transition-all ${
                                    action === 'salida'
                                        ? 'bg-acero text-white border-acero shadow-md'
                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <Pause size={16} /> Registrar Salida
                            </button>
                        </div>

                        <div className="bg-gray-900 aspect-video rounded-3xl border border-gray-800 overflow-hidden relative shadow-inner flex flex-col items-center justify-center">
                            {scanning && (
                                <div className="absolute inset-x-0 h-1 bg-turquesa shadow-[0_0_15px_#2DD4BF] top-0 animate-bounce" style={{ animationDuration: '2s' }} />
                            )}

                            {scanSuccess ? (
                                <div className="text-center space-y-4 p-6 z-10 bg-gray-950/80 rounded-3xl max-w-sm border border-emerald-500/20 backdrop-blur-md">
                                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 mx-auto border border-emerald-500/20">
                                        <CheckCircle2 size={36} />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-black text-lg uppercase tracking-wider">¡Registro Exitoso!</h3>
                                        <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mt-1">{action === 'entrada' ? 'Entrada' : 'Salida'} Grabada</p>
                                        <p className="text-gray-400 text-xs font-bold mt-2">Hora: <span className="text-white font-black">{scannedTime}</span></p>
                                    </div>
                                    <button 
                                        onClick={() => setScanSuccess(false)}
                                        className="w-full py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                                    >
                                        Entendido
                                    </button>
                                </div>
                            ) : scanError ? (
                                <div className="text-center space-y-4 p-6 z-10 bg-gray-950/80 rounded-3xl max-w-sm border border-red-500/20 backdrop-blur-md">
                                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-400 mx-auto border border-red-500/20">
                                        <AlertTriangle size={36} />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-black text-lg uppercase tracking-wider">Error de Checado</h3>
                                        <p className="text-red-400 text-xs font-bold mt-2 leading-relaxed">{scanError}</p>
                                    </div>
                                    <button 
                                        onClick={() => setScanError(null)}
                                        className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className={`w-40 h-40 border-2 rounded-2xl relative transition-all duration-300 ${
                                        scanning ? 'border-turquesa scale-105 shadow-[0_0_10px_rgba(45,212,191,0.2)]' : 'border-gray-600'
                                    }`}>
                                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-white -mt-1 -ml-1 rounded-tl-sm" />
                                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-white -mt-1 -mr-1 rounded-tr-sm" />
                                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-white -mb-1 -ml-1 rounded-bl-sm" />
                                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-white -mb-1 -mr-1 rounded-br-sm" />
                                        
                                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                            <QrCode size={70} className="text-white" />
                                        </div>
                                    </div>

                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-6">
                                        {scanning ? 'Apuntando al QR...' : 'Coloca el QR en el recuadro'}
                                    </p>

                                    {!scanning && (
                                        <button
                                            onClick={handleSimulateScan}
                                            className="absolute bottom-4 bg-turquesa text-white px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                                        >
                                            <Camera size={16} /> Escanear QR Clínica
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
                            <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                <Clock size={20} className="text-turquesa" />
                                Mis Registros de la Semana
                            </h2>

                            <div className="divide-y divide-gray-100">
                                {personalLogs.map((log, idx) => (
                                    <div key={idx} className="py-3 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-xs font-black text-gray-900 uppercase tracking-wide">{log.fecha}</p>
                                            <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
                                                <span className="flex items-center gap-1"><Play size={10} className="text-emerald-500" /> Entrada: <strong className="text-gray-700">{log.entrada}</strong></span>
                                                {log.salida !== '--' && (
                                                    <span className="flex items-center gap-1"><Pause size={10} className="text-acero" /> Salida: <strong className="text-gray-700">{log.salida}</strong></span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                log.estado === 'A tiempo' ? 'text-emerald-600 bg-emerald-50' : log.estado === 'Retardo' ? 'text-amber-600 bg-amber-50' : 'text-gray-400 bg-gray-50'
                                            }`}>
                                                {log.estado} {log.demerito ? `(${log.demerito})` : ''}
                                            </span>
                                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">{log.metodo}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedEmployeeMap && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden border border-gray-100 shadow-2xl animate-scale-in">
                        <div className="p-6 bg-gradient-to-r from-turquesa/5 to-transparent border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 uppercase tracking-wider">Ubicación GPS de Checado</h3>
                                <p className="text-xs text-gray-500 font-bold mt-1">Colaborador: {selectedEmployeeMap.nombre}</p>
                            </div>
                            <button 
                                onClick={() => setSelectedEmployeeMap(null)}
                                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-slate-100 aspect-video rounded-2xl border border-gray-200 relative overflow-hidden flex items-center justify-center">
                                <div className="absolute inset-0 opacity-10" style={{
                                    backgroundImage: 'radial-gradient(circle, #0F172A 1px, transparent 1px)',
                                    backgroundSize: '16px 16px'
                                }} />
                                
                                <div className="absolute top-1/2 left-0 w-full h-8 bg-slate-200 -translate-y-1/2" />
                                <div className="absolute top-0 left-1/3 w-8 h-full bg-slate-200" />
                                
                                <div className="absolute top-1/2 left-1/3 w-28 h-28 bg-turquesa/10 border-2 border-dashed border-turquesa rounded-full -translate-x-12 -translate-y-14 flex items-center justify-center">
                                    <span className="text-[8px] font-black text-turquesa uppercase tracking-wider bg-white/95 px-1.5 py-0.5 rounded-full border shadow-sm">
                                        Radio Clínica Alfra
                                    </span>
                                </div>

                                <div className="absolute top-1/2 left-1/3 -translate-x-4 -translate-y-6 flex flex-col items-center">
                                    <div className="bg-turquesa text-white p-1 rounded-full shadow-md z-10 animate-bounce">
                                        <Shield size={16} />
                                    </div>
                                    <div className="w-2.5 h-1 bg-turquesa/30 rounded-full blur-xs mt-0.5" />
                                </div>

                                <div className="absolute top-[48%] left-[38%] flex flex-col items-center">
                                    <div className="bg-red-500 text-white p-1 rounded-full shadow-md z-10">
                                        <MapPin size={16} />
                                    </div>
                                    <span className="absolute bottom-full text-[8px] font-black text-red-500 bg-white border border-red-200 px-1 py-0.5 rounded-md shadow-sm whitespace-nowrap mb-1">
                                        {selectedEmployeeMap.nombre.split(' ')[1]} ({selectedEmployeeMap.distancia})
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs font-bold bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div>
                                    <span className="text-gray-400 block text-[9px] uppercase tracking-wider">Fecha y Hora</span>
                                    <span className="text-gray-800 font-black">{selectedEmployeeMap.hora}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block text-[9px] uppercase tracking-wider">Verificación</span>
                                    <span className="text-gray-800 font-black">{selectedEmployeeMap.metodo}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block text-[9px] uppercase tracking-wider">Distancia del local</span>
                                    <span className="text-emerald-600 font-black">{selectedEmployeeMap.distancia}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block text-[9px] uppercase tracking-wider">Coordenadas GPS</span>
                                    <code className="text-[10px] text-gray-600 block">{selectedEmployeeMap.lat}, {selectedEmployeeMap.lng}</code>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button 
                                onClick={() => setSelectedEmployeeMap(null)}
                                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
