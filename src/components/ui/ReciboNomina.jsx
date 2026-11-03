import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { FileText } from 'lucide-react';
import { descargarArchivoNativo, guardarPdfNativo } from '../../services/nativeDownloadService';
import { Download, X, Printer } from 'lucide-react';
import { Button } from './Button';
import { LOGO_ALFRA_BASE64 } from '../../assets/logoAlfraBase64';

const TURQUESA = '#0d9488';
const ACERO    = '#1e3a5f';

/**
 * ReciboNomina — Recibo electrónico de pago de nómina / liquidación de comisiones
 *
 * Props:
 *  isOpen        boolean
 *  onClose       () => void
 *  datosNomina   {
 *    folio, fecha, empleadoNombre, puesto,
 *    periodo, metodoPago,
 *    sueldoBase, comisionServicios, comisionProductos,
 *    totalComisiones, totalNeto,
 *    historialComisiones[]   (opcional — filas de detalle)
 *  }
 */
export default function ReciboNomina({ isOpen, onClose, datosNomina }) {
    const reciboRef = useRef(null);

    if (!isOpen || !datosNomina) return null;

    const {
        folio            = '00000',
        fecha            = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
        empleadoNombre   = '',
        puesto           = '',
        periodo          = '',
        metodoPago       = 'Transferencia',
        sueldoBase       = 0,
        comisionServicios= 0,
        comisionProductos= 0,
        totalComisiones  = 0,
        bonoPuntualidad  = 0,
        bonoProductividad= 0,
        usaComisiones,
        usaBonos,
        totalNeto        = 0,
        historialComisiones = [],
    } = datosNomina;

    const showComisiones = usaComisiones !== undefined ? usaComisiones : true;
    const showBonos = usaBonos !== undefined ? usaBonos : false;

    const fmt = (v) => `$${Number(v || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

    const handleDownload = async () => {
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
            const link = document.createElement('a');
            link.download = `Nomina_ALFRA_${folio}.png`;
            link.href = base64Image;
            link.click();
        } catch (error) {
            console.error('Error generando recibo:', error);
            alert('Error al generar la imagen del recibo.');
        }
    };

    // Últimas 10 comisiones del historial (más recientes primero)
    const detalleComisiones = [...historialComisiones]
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 10);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-md animate-in zoom-in-95 duration-300 my-4">

                {/* Barra superior */}
                <div className="flex justify-between items-center bg-white/10 backdrop-blur-md p-3 rounded-t-2xl border-b border-white/20">
                    <span className="text-white font-bold text-sm">Recibo de Nómina</span>
                    <button onClick={onClose} className="text-white hover:text-red-300 transition-colors"><X size={20} /></button>
                </div>

                {/* ── ÁREA DEL RECIBO (estilos inline para html2canvas) ── */}
                <div
                    ref={reciboRef}
                    data-recibo-nomina="true"
                    style={{
                        background: '#ffffff',
                        padding: '32px',
                        fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    {/* Barra superior degradada */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: `linear-gradient(to right, ${TURQUESA}, ${ACERO})` }} />

                    {/* Logo + clínica */}
                    <div style={{ textAlign: 'center', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <img
                            src={LOGO_ALFRA_BASE64}
                            alt="ALFRA"
                            style={{ width: '165px', maxWidth: '100%', height: 'auto', objectFit: 'contain', marginBottom: '6px' }}
                        />
                        <p style={{ fontSize: '8px', color: TURQUESA, fontWeight: '700', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 2px' }}>
                            Cirugía &amp; Medicina Estética
                        </p>
                        <p style={{ fontSize: '10px', color: ACERO, fontWeight: '900', letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>
                            RECIBO DE NÓMINA
                        </p>
                    </div>

                    {/* Folio y fecha */}
                    <div style={{ borderBottom: '1.5px dashed #d1d5db', paddingBottom: '14px', marginBottom: '16px', textAlign: 'center' }}>
                        <p style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace', margin: '0 0 2px' }}>Folio: #{folio}</p>
                        <p style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace', margin: '0 0 2px' }}>{fecha}</p>
                        <p style={{ fontSize: '10px', color: TURQUESA, fontWeight: '700', margin: 0 }}>Período: {periodo}</p>
                    </div>

                    {/* Datos del empleado */}
                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '18px', border: '1px solid #e2e8f0' }}>
                        <p style={{ fontSize: '8px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 4px' }}>Empleado</p>
                        <p style={{ fontSize: '16px', fontWeight: '900', color: ACERO, margin: '0 0 2px' }}>{empleadoNombre}</p>
                        <p style={{ fontSize: '10px', color: TURQUESA, fontWeight: '700', margin: 0 }}>{puesto}</p>
                    </div>

                    {/* Desglose de pago */}
                    <div style={{ marginBottom: '16px' }}>
                        <p style={{ fontSize: '8px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 10px' }}>Desglose de Pago</p>

                        {/* Fila: Sueldo base */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                            <span style={{ fontSize: '12px', color: '#4b5563', fontWeight: '600' }}>Sueldo Base</span>
                            <span style={{ fontSize: '13px', color: ACERO, fontWeight: '700', fontFamily: 'monospace' }}>{fmt(sueldoBase)}</span>
                        </div>

                        {showComisiones && (
                            <>
                                {/* Fila: Comisiones servicios */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontSize: '12px', color: '#4b5563', fontWeight: '600' }}>Comisiones por Servicios</span>
                                    <span style={{ fontSize: '13px', color: TURQUESA, fontWeight: '700', fontFamily: 'monospace' }}>{fmt(comisionServicios)}</span>
                                </div>

                                {/* Fila: Comisiones productos */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontSize: '12px', color: '#4b5563', fontWeight: '600' }}>Comisiones por Productos</span>
                                    <span style={{ fontSize: '13px', color: TURQUESA, fontWeight: '700', fontFamily: 'monospace' }}>{fmt(comisionProductos)}</span>
                                </div>
                            </>
                        )}

                        {/* Bonos */}
                        {showBonos && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: '600' }}>Bono de Puntualidad</span>
                                    <span style={{ fontSize: '13px', color: '#4f46e5', fontWeight: '700', fontFamily: 'monospace' }}>{fmt(bonoPuntualidad)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                    <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: '600' }}>Bono de Productividad</span>
                                    <span style={{ fontSize: '13px', color: '#4f46e5', fontWeight: '700', fontFamily: 'monospace' }}>{fmt(bonoProductividad)}</span>
                                </div>
                            </>
                        )}

                        {/* Total comisiones y bonos */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1.5px solid #e5e7eb' }}>
                            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600' }}>{showBonos ? 'Total Comisiones y Bonos' : 'Total Comisiones'}</span>
                            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '700', fontFamily: 'monospace' }}>{fmt(totalComisiones + (showBonos ? Number(bonoPuntualidad) + Number(bonoProductividad) : 0))}</span>
                        </div>

                        {/* TOTAL NETO */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 0' }}>
                            <span style={{ fontSize: '13px', color: ACERO, fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL A PAGAR</span>
                            <span style={{ fontSize: '28px', color: TURQUESA, fontWeight: '900', fontFamily: 'monospace', lineHeight: 1 }}>{fmt(totalNeto)}</span>
                        </div>
                    </div>

                    {/* Historial de comisiones (últimas 10) */}
                    {detalleComisiones.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ fontSize: '8px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 8px' }}>Detalle de Comisiones ({detalleComisiones.length})</p>
                            {detalleComisiones.map((h, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f9fafb' }}>
                                    <div>
                                        <span style={{ fontSize: '10px', color: '#374151', fontWeight: '600', display: 'block' }}>{h.detalleMotivo || h.tipoVenta}</span>
                                        <span style={{ fontSize: '9px', color: '#9ca3af' }}>
                                            {h.tipoVenta} · {h.porcentajeAplicado}% · {h.fecha ? new Date(h.fecha).toLocaleDateString('es-MX') : ''}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '11px', color: TURQUESA, fontWeight: '700', fontFamily: 'monospace' }}>+{fmt(h.comisionGanada)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Método de pago */}
                    <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #bbf7d0', marginBottom: '16px' }}>
                        <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Método de Pago</span>
                        <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '700' }}>{metodoPago}</span>
                    </div>

                    {/* Firma */}
                    <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: '14px', display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={{ height: '1px', background: '#d1d5db', marginBottom: '4px' }} />
                            <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>Firma Empleado</p>
                        </div>
                        <div style={{ width: '32px' }} />
                        <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={{ height: '1px', background: '#d1d5db', marginBottom: '4px' }} />
                            <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>Autorizado por</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <p style={{ textAlign: 'center', fontSize: '9px', color: '#d1d5db', marginTop: '14px', margin: '14px 0 0' }}>
                        Clínica ALFRA · Calle Río Fuerte #26, Col. Lomas de Bellavista, Lázaro Cárdenas, Michoacán · Tel: 753 538 6018 · Documento generado electrónicamente · {new Date().getFullYear()}
                    </p>
                </div>

                {/* Botones fuera del área capturada */}
                <div className="bg-gray-50 p-4 rounded-b-2xl flex gap-3 border-t border-gray-200">
                    <Button variant="primary" fullWidth icon={Download} onClick={handleDownload} className="shadow-md">
                        Descargar PNG
                    </Button>
                    <Button variant="outline" fullWidth icon={X} onClick={onClose}>
                        Cerrar
                    </Button>
                </div>
            </div>
        </div>
    );
}
