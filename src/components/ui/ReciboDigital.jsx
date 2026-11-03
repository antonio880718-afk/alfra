import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download, FileText, Share2, X, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';
import { descargarArchivoNativo, guardarPdfNativo } from '../../services/nativeDownloadService';
import { abrirWhatsApp } from '../../services/whatsappService';
import { LOGO_ALFRA_BASE64 } from '../../assets/logoAlfraBase64';

export default function ReciboDigital({
    isOpen,
    onClose,
    datosRecibo
}) {
    const reciboRef = useRef(null);

    if (!isOpen || !datosRecibo) return null;

    const {
        folio = '00000',
        fecha = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        pacienteNombre = '',
        concepto = '',
        monto = 0,
        metodoPago = 'Efectivo',
        paqueteInfo = null,
        telefono = '',
    } = datosRecibo;

    const paqueteTexto = typeof paqueteInfo === 'object' && paqueteInfo !== null
        ? (paqueteInfo.nombre || paqueteInfo.objetivo || '')
        : (paqueteInfo || '');

    // Descarga nativa como imagen PNG
    const handleDownloadPng = async () => {
        if (!reciboRef.current) return;
        try {
            const canvas = await html2canvas(reciboRef.current, {
                scale: 3,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
            });
            const base64Image = canvas.toDataURL('image/png');
            const fileName = `Recibo_ALFRA_${folio}.png`;

            await descargarArchivoNativo({
                fileName,
                data: base64Image,
                mimeType: 'image/png',
                title: `Recibo Clínica ALFRA #${folio}`
            });
        } catch (error) {
            console.error('Error generando PNG:', error);
            alert('Hubo un error al generar la imagen del recibo.');
        }
    };

    // Descarga nativa como documento PDF
    const handleDownloadPdf = async () => {
        if (!reciboRef.current) return;
        try {
            const canvas = await html2canvas(reciboRef.current, {
                scale: 3,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
            });
            const base64Image = canvas.toDataURL('image/png');
            
            // Proporciones exactas de ticket clínico ejecutivo en mm
            const mmWidth = 90;
            const mmHeight = (canvas.height * mmWidth) / canvas.width;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [mmWidth, mmHeight + 4]
            });
            doc.addImage(base64Image, 'PNG', 0, 0, mmWidth, mmHeight);
            
            const fileName = `Recibo_ALFRA_${folio}.pdf`;
            await guardarPdfNativo(doc, fileName, `Recibo Clínica ALFRA #${folio}`);
        } catch (error) {
            console.error('Error generando PDF:', error);
            alert('Hubo un error al generar el PDF del recibo.');
        }
    };

    const handleShareWhatsApp = () => {
        const montoStr = parseFloat(monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
        const lineas = [
            `¡Hola ${pacienteNombre}! 🌿`,
            `Gracias por su visita a Clínica ALFRA. Adjuntamos en este chat su recibo digital de pago por el monto de $${montoStr} MXN.`,
            `Concepto: ${concepto}${paqueteTexto ? `\nPaquete/Plan: ${paqueteTexto}` : ''}`,
            `Folio: #${folio}`,
            `¡Quedamos a su disposición para cualquier duda. Lindo día! ✨`,
        ];
        abrirWhatsApp(telefono, lineas.join('\n\n'));
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-sm my-auto animate-in zoom-in-95 duration-300">
                {/* Controles del Modal */}
                <div className="flex justify-between items-center bg-white/10 backdrop-blur-md p-3 rounded-t-2xl border-b border-white/20">
                    <span className="text-white font-bold text-sm">Recibo Digital Generado</span>
                    <button onClick={onClose} className="text-white hover:text-red-300 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Área del Recibo (Solo esto se convierte a PNG/PDF) */}
                <div
                    ref={reciboRef}
                    className="bg-white p-8 relative overflow-hidden"
                    style={{
                        backgroundImage: 'radial-gradient(circle at top right, rgba(32, 178, 170, 0.05) 0%, transparent 40%)',
                    }}
                >
                    {/* Diseño tipo ticket / premium */}
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-turquesa to-acero"></div>

                    {/* Sello de Pagado */}
                    <div className="absolute top-12 right-6 opacity-10 rotate-12 pointer-events-none">
                        <CheckCircle2 size={80} className="text-green-500" />
                    </div>

                    <div className="text-center mb-6 flex flex-col items-center">
                        <img src={LOGO_ALFRA_BASE64} alt="ALFRA Logo" className="w-48 max-w-[210px] h-auto object-contain mb-1.5" />
                        <p className="text-[10px] text-turquesa font-bold tracking-widest uppercase mt-1">Cirugía & Medicina Estética</p>
                    </div>

                    <div className="border-b border-dashed border-gray-300 pb-4 mb-4 text-center">
                        <p className="text-xs text-gray-500 font-mono">Folio: #{folio}</p>
                        <p className="text-xs text-gray-500 font-mono mt-1">{fecha}</p>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Paciente</p>
                            <p className="text-sm font-bold text-gray-800">{pacienteNombre}</p>
                        </div>

                        <div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Concepto</p>
                            <p className="text-sm font-bold text-acero">{concepto}</p>
                            {paqueteTexto && (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-turquesa/10 text-turquesa text-[10px] rounded-full font-bold">
                                    {paqueteTexto}
                                </span>
                            )}
                        </div>

                        <div className="flex justify-between items-end border-t border-gray-100 pt-4">
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Método de Pago</p>
                                <p className="text-xs text-gray-600 font-semibold">{metodoPago}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Pagado</p>
                                <p className="text-2xl font-black text-turquesa">${parseFloat(monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </div>

                    {/* Mensaje de agradecimiento */}
                    <div className="border-t border-dashed border-gray-200 pt-3 mt-4 text-center">
                        <p className="text-[9px] font-bold text-gray-700">Clínica ALFRA · Cirugía & Medicina Estética</p>
                        <p className="text-[8px] text-gray-500 mt-0.5">Calle Río Fuerte #26, Col. Lomas de Bellavista, Lázaro Cárdenas, Michoacán</p>
                        <p className="text-[8px] text-turquesa font-bold mt-0.5">Citas & WhatsApp: 753 538 6018</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center mt-6 border border-gray-100 shadow-sm relative z-10">
                        <p className="text-xs text-acero font-medium italic">
                            "Gracias por confiar en nuestras manos para resaltar tu bienestar y belleza natural."
                        </p>
                    </div>

                    {/* Borde dentado para efecto ticket */}
                    <div className="absolute bottom-0 left-0 w-full flex space-x-2 -mb-2 overflow-hidden pointer-events-none opacity-20">
                        {[...Array(20)].map((_, i) => (
                            <div key={i} className="w-4 h-4 rounded-full bg-gray-100 flex-shrink-0"></div>
                        ))}
                    </div>
                </div>

                {/* Acciones del Modal */}
                <div className="bg-gray-50 p-3 rounded-b-2xl flex flex-col gap-2 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="primary"
                            icon={FileText}
                            onClick={handleDownloadPdf}
                            className="shadow-sm py-2 text-xs"
                        >
                            Descargar PDF
                        </Button>
                        <Button
                            variant="secondary"
                            icon={Download}
                            onClick={handleDownloadPng}
                            className="shadow-sm py-2 text-xs"
                        >
                            Descargar PNG
                        </Button>
                    </div>
                    <Button
                        variant="outline"
                        fullWidth
                        icon={Share2}
                        onClick={handleShareWhatsApp}
                        className="border-green-500 text-green-600 hover:bg-green-50 py-2 text-xs"
                    >
                        Compartir por WhatsApp
                    </Button>
                </div>
                <div className="bg-acero/90 text-white text-[10px] text-center p-2 rounded-b-2xl">
                    Compatible con celular y computadora. El PDF o PNG se guardará directamente en tu dispositivo.
                </div>
            </div>
        </div>
    );
}
