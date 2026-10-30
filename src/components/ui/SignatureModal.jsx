import React, { useRef, useState, useEffect } from 'react';
import { X, Eraser, Check, FileCheck, Info } from 'lucide-react';
import { Button } from './Button';
import { LOGO_ALFRA_BASE64 } from '../../assets/logoAlfraBase64';

export function SignatureModal({ isOpen, onClose, onSave, documentName, documentText }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        if (isOpen && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#0B2239'; // Color acero oscuro para la firma
            ctx.fillStyle = '#f8fafc'; // Fondo ligeramente gris/azulado (slate-50) para que contraste
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        e.preventDefault();
        if (!isDrawing) return;
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.closePath();
            setIsDrawing(false);
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const handleSave = () => {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        onSave(dataUrl);
    };

    const defaultText = `Por medio de la presente carta compromiso, yo, en mi carácter de paciente de Clínica ALFRA, manifiesto mi total disposición y compromiso voluntario para llevar a cabo de manera estricta y puntual todas las indicaciones y recomendaciones emitidas por mi especialista.

1. Cumplimiento de Hábitos (El Principio 50/50):
Comprendo y acepto que el éxito y la visibilidad de los resultados de mi tratamiento reductivo y de moldeo corporal dependen en un 50% de la aparatología y técnicas aplicadas en cabina, y en un 50% fundamental de mi disciplina personal en casa. Me comprometo a:
   • Cumplir rigurosamente con la meta calórica asignada.
   • Alcanzar el objetivo de minutos de actividad física diaria recomendada (ejercicio cardiovascular o caminata).
   • Registrar diariamente mi ingesta calórica y mi actividad física en la aplicación para mi seguimiento semanal.
   • Mantener una hidratación óptima según las indicaciones de la clínica.

2. Registro Clínico y Seguimiento:
Otorgo mi consentimiento expreso para que el personal de Clínica ALFRA realice el registro de mis medidas corporales y la toma de fotografías clínicas (antes, durante y al finalizar el tratamiento). Entiendo que este material será resguardado bajo la más estricta confidencialidad médica y su único fin es documentar y auditar la evolución real de mis resultados.

3. Asistencia y Continuidad:
Me comprometo a asistir puntualmente a cada una de las sesiones programadas en mi paquete, reconociendo que la interrupción o espaciamiento irregular del tratamiento afectará directamente los resultados proyectados.

4. Renovación de Compromiso:
Entiendo y acepto plenamente que esta Carta de Compromiso deberá ser leída y firmada nuevamente al inicio de cada una de mis sesiones subsecuentes. Esta firma recurrente sirve como un recordatorio constante de mi corresponsabilidad hasta la conclusión formal de mi tratamiento.

Al firmar este documento, certifico que he leído y comprendido a plenitud mi nivel de corresponsabilidad en este proceso.`;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in duration-300">
                
                {/* Header Premium */}
                <div className="flex justify-between items-center px-8 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-turquesa/10 flex items-center justify-center text-turquesa">
                            <FileCheck size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-acero">{documentName || 'Carta Compromiso'}</h3>
                            <p className="text-xs font-bold text-gray-400 mt-0.5">Firma Electrónica de Paciente</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Document View (A4 Paper Style) */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-100/50">
                    <div className="bg-white mx-auto max-w-2xl p-8 md:p-12 rounded-xl shadow-sm border border-gray-200">
                        {/* Logo ALFRA */}
                        <div className="flex justify-center mb-10">
                            <img src={LOGO_ALFRA_BASE64} alt="ALFRA" className="h-32 object-contain" />
                        </div>
                        
                        <h4 className="text-center text-lg font-black text-acero uppercase tracking-widest mb-8 border-b-2 border-acero/10 pb-4">
                            CARTA DE COMPROMISO Y CORRESPONSABILIDAD
                        </h4>

                        <div className="text-[13px] md:text-sm font-medium text-gray-600 whitespace-pre-wrap leading-loose text-justify">
                            {documentText || defaultText}
                        </div>
                        
                        <div className="mt-12 text-center text-xs font-bold text-gray-400">
                            Documento generado digitalmente por Clínica ALFRA.
                        </div>
                    </div>
                </div>

                {/* Signature Section */}
                <div className="px-8 py-6 bg-white border-t border-gray-100 shadow-[0_-10px_30px_rgba(0,0,0,0.02)] z-10 relative">
                    <div className="flex flex-col md:flex-row gap-8 items-end">
                        <div className="flex-1 w-full space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-[11px] font-black text-turquesa uppercase tracking-widest flex items-center gap-2">
                                    <Info size={14} /> Firma Autógrafa del Paciente
                                </label>
                                <button onClick={clearCanvas} className="text-[11px] font-bold text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors bg-gray-50 px-3 py-1 rounded-full">
                                    <Eraser size={12} /> Limpiar Lienzo
                                </button>
                            </div>
                            <div className="border border-gray-200 rounded-2xl overflow-hidden relative shadow-inner">
                                <canvas
                                    ref={canvasRef}
                                    className="w-full h-32 md:h-40 cursor-crosshair touch-none bg-slate-50"
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                />
                                <div className="absolute bottom-4 left-6 right-6 border-b-2 border-dashed border-gray-300 pointer-events-none opacity-50"></div>
                            </div>
                        </div>
                        
                        <div className="w-full md:w-auto flex flex-row md:flex-col gap-3">
                            <Button variant="outline" className="flex-1 md:flex-none border-gray-200 text-gray-500 hover:bg-gray-50" onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button className="flex-1 md:flex-none bg-acero hover:bg-acero/90 text-white shadow-lg shadow-acero/20 px-8" onClick={handleSave}>
                                <Check size={18} className="mr-2" /> Guardar
                            </Button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
