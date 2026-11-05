import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import {
    Tag, Megaphone, Loader2, Image as ImageIcon, MessageSquare,
    ZoomIn, X
} from 'lucide-react';
import { getFlyers } from '../../services/flyersService';
import { useAuth } from '../../contexts/AuthContext';
import { getPacienteByUid } from '../../services/pacientesService';
import { enviarWhatsAppQuieroEsto } from '../../services/whatsappService';

export default function Promociones() {
    const { currentUser } = useAuth();
    const [paciente, setPaciente] = useState(null);
    const [flyers, setFlyers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [flyerZoom, setFlyerZoom] = useState(null);


    useEffect(() => {
        const loadFlyers = async () => {
            try {
                const data = await getFlyers();
                setFlyers(data || []);
            } catch (error) {
                console.error("Error cargando flyers:", error);
            } finally {
                setLoading(false);
            }
        };
        loadFlyers();
    }, []);

    useEffect(() => {
        let mounted = true;
        const cargarPaciente = async () => {
            if (!currentUser?.uid) return;
            try {
                const p = await getPacienteByUid(currentUser.uid);
                if (mounted && p) {
                    setPaciente(p);
                }
            } catch (e) {
                console.warn("Aviso cargando perfil en promociones:", e);
            }
        };
        cargarPaciente();
        return () => { mounted = false; };
    }, [currentUser]);

    const nombrePacienteActual = useMemo(() => {
        return paciente?.nombre || currentUser?.displayName || '';
    }, [paciente, currentUser]);

    const handleQuieroFlyer = (flyer) => {
        enviarWhatsAppQuieroEsto({
            tipo: 'flyer',
            titulo: flyer?.title || 'Promoción del Mes',
            pacienteNombre: nombrePacienteActual
        });
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-10 animate-in fade-in duration-700">
            <header className="space-y-2 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 bg-turquesa/10 text-turquesa px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-turquesa/20">
                        <Megaphone size={14} /> Exclusivo para ti
                    </div>
                    <h1 className="text-2xl md:text-4xl font-black tracking-tight text-acero leading-none">
                        Novedades y Promociones
                    </h1>
                    <p className="text-gray-500 font-medium text-xs sm:text-sm">
                        Conoce nuestras promociones vigentes. Si alguna es de tu interés, nuestro equipo te atenderá de forma personalizada vía WhatsApp.
                    </p>
                </div>
            </header>

            {/* SECCIÓN 1: FLYERS PROMOCIONALES A TAMAÑO COMPLETO (SIN RECORTAR) */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="animate-spin text-turquesa" size={40} />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Cargando promociones...</p>
                </div>
            ) : flyers.length > 0 ? (
                <div className={`grid gap-6 pt-2 ${flyers.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {flyers.map((flyer) => (
                        <div
                            key={flyer.id}
                            className="group rounded-3xl overflow-hidden shadow-xl border border-gray-100 bg-white hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
                        >
                            {/* Contenedor de imagen completa sin recorte (object-contain) */}
                            <div
                                onClick={() => setFlyerZoom(flyer)}
                                className="relative bg-slate-950/5 flex items-center justify-center cursor-zoom-in overflow-hidden"
                            >
                                <img
                                    src={flyer.imageUrl}
                                    alt={flyer.title}
                                    className="w-full h-auto max-h-[82vh] object-contain mx-auto block transition-transform duration-500 group-hover:scale-[1.01]"
                                />
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFlyerZoom(flyer);
                                    }}
                                    className="absolute top-3 right-3 bg-slate-900/75 hover:bg-slate-900 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 backdrop-blur-md shadow-lg cursor-pointer"
                                >
                                    <ZoomIn size={13} /> Ver Grande
                                </button>
                            </div>

                            {/* Pie del Flyer con Título y Botón "¡Quiero esto!" a WhatsApp */}
                            <div className="p-5 sm:p-6 bg-white border-t border-gray-100 space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <span className="inline-flex items-center gap-1 bg-turquesa/15 text-teal-800 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-1.5">
                                            <Tag size={11} className="text-turquesa" /> Promoción Vigente
                                        </span>
                                        <h2 className="text-slate-900 font-black text-lg sm:text-xl tracking-tight leading-snug">
                                            {flyer.title}
                                        </h2>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => handleQuieroFlyer(flyer)}
                                        className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                                    >
                                        <MessageSquare size={16} /> Solicitar Información
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <Card className="flex flex-col items-center justify-center py-14 text-center space-y-3">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                        <ImageIcon size={34} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-black text-acero">Por el momento no hay flyers publicados</h3>
                        <p className="text-xs text-gray-500">Vuelve pronto para conocer nuestras próximas promociones.</p>
                    </div>
                </Card>
            )}

            {/* MODAL ZOOM PANTALLA COMPLETA PARA VER EL FLYER SIN RECORTE */}
            {flyerZoom && (
                <div
                    onClick={() => setFlyerZoom(null)}
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative max-w-3xl w-full flex flex-col items-center bg-slate-950 rounded-3xl overflow-hidden border border-white/15 shadow-2xl max-h-[94vh]"
                    >
                        <button
                            type="button"
                            onClick={() => setFlyerZoom(null)}
                            className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center border border-white/20 cursor-pointer"
                        >
                            <X size={20} />
                        </button>

                        <div className="w-full flex-1 overflow-y-auto flex items-center justify-center p-2 sm:p-4">
                            <img
                                src={flyerZoom.imageUrl}
                                alt={flyerZoom.title}
                                className="w-auto max-w-full max-h-[76vh] object-contain mx-auto rounded-2xl"
                            />
                        </div>

                        <div className="w-full p-4 sm:p-5 bg-slate-900 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="text-center sm:text-left">
                                <span className="text-[10px] font-black uppercase tracking-widest text-teal-400 block">
                                    Promoción Clínica ALFRA
                                </span>
                                <h3 className="text-white font-black text-base sm:text-lg">{flyerZoom.title}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleQuieroFlyer(flyerZoom)}
                                className="w-full sm:w-auto py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <MessageSquare size={16} /> Solicitar Información
                            </button>
                        </div>
                    </div>
                </div>
            )}


            <footer className="pt-10 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">© 2026 Clínica ALFRA | Cirugía y Medicina Estética</p>
            </footer>
        </div>
    );
}
