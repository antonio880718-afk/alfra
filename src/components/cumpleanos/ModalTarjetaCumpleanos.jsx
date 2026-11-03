import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { LOGO_ALFRA_BASE64 } from '../../assets/logoAlfraBase64';
import { 
  Download, MessageCircle, Copy, Gift, Sparkles, X, Check, 
  Calendar, Heart, Sparkle, Tag, FileImage
} from 'lucide-react';
import { calcularDetalleCumpleanos } from '../../utils/cumpleanosUtils';

const REGALOS_SUGERIDOS = [
  '✨ Facial de Hidratación Profunda con Hidrodermoabrasión de Cortesía',
  '🎁 Bono de $500 MXN de descuento en tu próximo tratamiento',
  '💆‍♀️ Masaje Relajante Descontracturante (30 minutos)',
  '🌸 Sesión de Radiofrecuencia y Drenaje Linfático Facial',
  '💎 20% de Descuento Exclusivo en Tratamiento o Paquete VIP',
  '🍓 Exfoliación Corporal y Envoltura Nutritiva en Cabina'
];

export default function ModalTarjetaCumpleanos({
  isOpen,
  onClose,
  paciente,
  regaloInicial = '✨ Facial de Hidratación Profunda con Hidrodermoabrasión de Cortesía'
}) {
  const [regalo, setRegalo] = useState(regaloInicial);
  const [formato, setFormato] = useState('png'); // 'png' | 'jpeg'
  const [generando, setGenerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const tarjetaRef = useRef(null);

  if (!isOpen || !paciente) return null;

  const fechaNac = paciente.fechaNacimiento || paciente.cumpleanos || '';
  const detalle = calcularDetalleCumpleanos(fechaNac);
  const telefonoLimpio = String(paciente.telefono || paciente.celular || '').replace(/\D/g, '');

  const mensajeWhatsApp = `¡Hola ${paciente.nombre}! 🎂✨

De parte de todo el equipo y especialistas de Clínica ALFRA te enviamos nuestros mejores deseos en este día tan especial. ¡Que este nuevo año esté lleno de salud, belleza y bienestar! 🎉

🎁 Preparamos un obsequio especial para ti:
*${regalo}*

Te adjuntamos tu Tarjeta Digital de Cumpleaños, válida durante todo este mes en la clínica presentando este mensaje en recepción. ¡Esperamos verte pronto para consentirte y celebrarte! 💆‍♀️✨

📍 Clínica ALFRA • Cuidado y Bienestar Integral`;

  const handleDescargar = async () => {
    if (!tarjetaRef.current) return;
    try {
      setGenerando(true);
      const canvas = await html2canvas(tarjetaRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const mimeType = formato === 'jpeg' ? 'image/jpeg' : 'image/png';
      const ext = formato === 'jpeg' ? 'jpg' : 'png';
      const dataUrl = canvas.toDataURL(mimeType, 0.95);

      const nombreArchivo = (paciente.nombre || 'Paciente')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '');
      const fileName = `Tarjeta_Cumpleanos_ALFRA_${nombreArchivo}.${ext}`;
      await descargarArchivoNativo({
        fileName,
        data: dataUrl,
        mimeType,
        title: `Tarjeta de Cumpleaños - ${paciente.nombre || 'Paciente'}`
      });
    } catch (err) {
      console.error('Error al generar tarjeta de cumpleaños:', err);
      alert('Hubo un error al generar la imagen. Intenta de nuevo.');
    } finally {
      setGenerando(false);
    }
  };

  const handleEnviarWhatsApp = () => {
    const url = `https://wa.me/52${telefonoLimpio}?text=${encodeURIComponent(mensajeWhatsApp)}`;
    window.open(url, '_blank');
  };

  const handleCopiarMensaje = () => {
    navigator.clipboard.writeText(mensajeWhatsApp);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-400/20 text-amber-300 rounded-xl">
              <Gift size={20} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                Tarjeta de Cumpleaños ALFRA VIP
              </h3>
              <p className="text-xs text-gray-300">
                Personaliza el regalo, descárgala en alta resolución y envíala por WhatsApp al paciente.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY CON 2 COLUMNAS */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50">
          
          {/* COLUMNA 1: CONTROLES DE PERSONALIZACIÓN */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Info del Paciente */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                  Paciente Celebrado
                </span>
                {detalle?.textoProximidad && (
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                    detalle.esHoy
                      ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  }`}>
                    {detalle.textoProximidad}
                  </span>
                )}
              </div>
              <h4 className="text-base font-black text-gray-900 leading-tight">{paciente.nombre}</h4>
              <div className="text-xs text-gray-500 space-y-1">
                {detalle?.textoFechaExacta && (
                  <p className="flex items-center gap-1.5 font-bold text-gray-700">
                    <Calendar size={13} className="text-teal-600" /> {detalle.textoFechaExacta}
                    {detalle.edadCumple ? ` (${detalle.edadCumple} años)` : ''}
                  </p>
                )}
                <p className="flex items-center gap-1.5">
                  <MessageCircle size={13} className="text-emerald-600" /> WhatsApp: {paciente.telefono || 'Sin teléfono'}
                </p>
              </div>
            </div>

            {/* Configurar Regalo Manual */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <label className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                <Tag size={14} className="text-amber-500" /> Regalo Asignado (Editable):
              </label>
              <textarea
                value={regalo}
                onChange={(e) => setRegalo(e.target.value)}
                rows={3}
                placeholder="Escribe el regalo que otorgará la clínica..."
                className="w-full text-xs font-medium p-3 rounded-xl border border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none leading-relaxed"
              />

              {/* Botones de selección rápida de regalo */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                  Sugerencias Rápidas:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {REGALOS_SUGERIDOS.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRegalo(sug)}
                      className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                        regalo === sug
                          ? 'bg-amber-400 text-slate-900 border-amber-500 shadow-sm'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {sug.split('(')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Selector de Formato & Botones de Acción */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-gray-700">Formato de Imagen:</span>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFormato('png')}
                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                      formato === 'png' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    PNG (HD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormato('jpeg')}
                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                      formato === 'jpeg' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    JPEG
                  </button>
                </div>
              </div>

              {/* Botón Descargar Tarjeta */}
              <button
                type="button"
                onClick={handleDescargar}
                disabled={generando}
                className="w-full py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {generando ? (
                  <>Procesando imagen HD...</>
                ) : (
                  <>
                    <Download size={16} /> Descargar Tarjeta ({formato.toUpperCase()})
                  </>
                )}
              </button>

              {/* Botón WhatsApp */}
              <button
                type="button"
                onClick={handleEnviarWhatsApp}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <MessageCircle size={16} /> Abrir WhatsApp con Mensaje y Regalo
              </button>

              {/* Botón Copiar Mensaje */}
              <button
                type="button"
                onClick={handleCopiarMensaje}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                {copiado ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                {copiado ? '¡Mensaje Copiado al Portapapeles!' : 'Copiar Texto para WhatsApp'}
              </button>
            </div>
          </div>

          {/* COLUMNA 2: VISTA PREVIA ULTRA HD DE LA TARJETA (CANVAS SOURCE) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center p-3 sm:p-5 bg-slate-100/70 rounded-3xl border border-slate-200/80">
            <div className="w-full max-w-[420px] shadow-2xl rounded-3xl overflow-hidden border-2 border-amber-300/60 bg-white">
              
              {/* LA TARJETA EN SÍ (ESTA ES LA QUE HTML2CANVAS CAPTURA) */}
              <div
                ref={tarjetaRef}
                style={{
                  background: '#FFFFFF',
                  backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(32, 178, 170, 0.08) 0%, transparent 60%), radial-gradient(circle at 100% 100%, rgba(217, 119, 6, 0.07) 0%, transparent 50%), radial-gradient(circle at 0% 100%, rgba(32, 178, 170, 0.05) 0%, transparent 50%)',
                  color: '#0f172a',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
                className="p-6 sm:p-7 text-center relative overflow-hidden select-none space-y-3.5 bg-white"
              >
                {/* BARRA SUPERIOR DECORATIVA MULTICOLOR LUXURY */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-teal-500 via-amber-400 to-teal-600" />

                {/* MARCO REAL DORADO Y TURQUESA */}
                <div className="absolute inset-0 border-2 border-amber-400/35 rounded-2xl pointer-events-none m-3" />
                <div className="absolute inset-0 border border-teal-500/20 rounded-xl pointer-events-none m-4" />

                {/* DETALLES DE ESQUINAS */}
                <div className="absolute top-3.5 left-3.5 w-1.5 h-1.5 rotate-45 bg-amber-400 pointer-events-none" />
                <div className="absolute top-3.5 right-3.5 w-1.5 h-1.5 rotate-45 bg-amber-400 pointer-events-none" />
                <div className="absolute bottom-3.5 left-3.5 w-1.5 h-1.5 rotate-45 bg-amber-400 pointer-events-none" />
                <div className="absolute bottom-3.5 right-3.5 w-1.5 h-1.5 rotate-45 bg-amber-400 pointer-events-none" />

                {/* LOGO OFICIAL ALFRA EN TAMAÑO PERFECTO Y ARMONIOSO */}
                <div className="relative z-10 pt-1 pb-0.5 flex flex-col items-center justify-center">
                  <img
                    src={LOGO_ALFRA_BASE64}
                    alt="Clínica ALFRA"
                    className="w-44 sm:w-48 max-w-[185px] h-auto object-contain drop-shadow-xs transition-transform"
                  />
                </div>

                {/* ENCABEZADO DE CUMPLEAÑOS */}
                <div className="relative z-10 space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-0.5 rounded-full bg-gradient-to-r from-amber-50 via-teal-50/50 to-amber-50 border border-amber-300 text-amber-800 text-[10px] font-black uppercase tracking-widest shadow-xs">
                    <Sparkles size={12} className="text-amber-500 shrink-0" /> Celebración Especial ALFRA
                  </div>
                  <h2 className="text-2xl sm:text-[27px] font-black uppercase tracking-tight text-slate-900 pt-0.5">
                    ¡Feliz Cumpleaños!
                  </h2>
                  <p className="text-lg sm:text-xl font-black text-teal-700 leading-tight">
                    {paciente.nombre}
                  </p>
                </div>

                {/* MENSAJE MÉDICO-AFECTIVO */}
                <div className="relative z-10 px-2 sm:px-4">
                  <p className="text-[11.5px] text-slate-600 leading-relaxed font-normal">
                    De parte de todo el equipo y dirección de <strong className="text-teal-700 font-bold">Clínica ALFRA</strong>, te deseamos un cumpleaños maravilloso lleno de salud, alegría, belleza y bienestar.
                  </p>
                </div>

                {/* CAJA DE REGALO PERSONALIZADA CON PROPORCIONES EXACTAS */}
                <div className="relative z-10 mx-1 p-4 sm:p-4.5 rounded-2xl bg-gradient-to-br from-amber-50/90 via-white to-teal-50/60 border-2 border-amber-400/75 shadow-md text-center">
                  <div className="inline-flex items-center justify-center gap-1.5 text-amber-800 text-[11px] font-black uppercase tracking-widest mb-1">
                    <Gift size={15} className="text-amber-600 shrink-0" />
                    <span>Tu Regalo Exclusivo</span>
                  </div>
                  <p className="text-base sm:text-[17px] font-black text-slate-900 leading-snug px-1 mb-2">
                    {regalo || 'Cortesía Especial de Cumpleaños'}
                  </p>
                  <p className="text-[10.5px] text-slate-500 font-medium leading-relaxed px-1">
                    Presenta esta tarjeta digital en recepción durante tu mes de cumpleaños para consentirte.
                  </p>
                </div>

                {/* FOOTER DE LA TARJETA */}
                <div className="relative z-10 pt-2.5 border-t border-dashed border-slate-200/90 flex items-center justify-between text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider px-2">
                  <span>FOLIO: ALFRA-BDAY-{(paciente.id || 'VIP').slice(0, 6).toUpperCase()}</span>
                  <span className="text-teal-700 font-black">VÁLIDO EN CLÍNICA ALFRA</span>
                </div>

                {/* DETALLE TICKET INFERIOR (ESTILO RECIBOS ALFRA) */}
                <div className="absolute bottom-0 left-0 w-full flex space-x-2 -mb-2 overflow-hidden pointer-events-none opacity-20">
                  {[...Array(24)].map((_, i) => (
                    <div key={i} className="w-3.5 h-3.5 rounded-full bg-slate-300 flex-shrink-0" />
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 mt-3 text-center">
              💡 Vista previa a escala. Al descargar se genera una imagen nítida en alta resolución a 2x lista para enviar por WhatsApp.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}