import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SignatureModal } from '../../components/ui/SignatureModal';
import {
    Camera, Save, ArrowLeft, FileText, Activity, User, Calendar,
    Ruler, AlertCircle, HeartPulse, CheckCircle, Loader, Plus, Trash2,
    Home, Lock, TrendingUp, X, ChevronRight, ChevronDown, Clipboard,
    Image, ZoomIn, BarChart2, Target, ClipboardCheck, PenTool, Download,
    Sparkles, Play, Copy, AlertTriangle, Award, Phone, Columns,
    Compass, ShieldAlert, Pill, Droplets, Sun, Flame, CheckCircle2, Printer, FileSignature, MessageSquare
} from 'lucide-react';

import { jsPDF } from 'jspdf';
import { guardarPdfNativo } from '../../services/nativeDownloadService';
import { getPacienteById, updatePaciente } from '../../services/pacientesService';
import { getStaffDocByUid } from '../../services/staffService';
import { saveApoyoEnCasa, getApoyoEnCasa, CUIDADOS_PRESET, getSeguimientosPaciente, getDailyTrackers } from '../../services/seguimientoService';
import { abrirWhatsApp } from '../../services/whatsappService';
import {
    crearTratamiento, getTratamientosPaciente, finalizarTratamiento, eliminarTratamiento,
    crearSesion, getSesionesTratamiento, eliminarSesion, solicitarEliminacionTratamiento,
    actualizarFaseRoadmapTratamiento,
    MEDIDAS_CORPORALES, CAMPOS_FACIALES
} from '../../services/tratamientosService';
import { CONSENT_TEMPLATES } from '../../data/consentTemplates';
import { LOGO_ALFRA_BASE64 } from '../../assets/logoAlfraBase64';
import {
    LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, LabelList
} from 'recharts';
import { auth, storage, db } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { addDoc, collection, serverTimestamp, doc, onSnapshot } from 'firebase/firestore';
import { createCita, getCitasByPaciente, updateCitaStatus } from '../../services/citasService';
import { createPlan, getPlanes } from '../../services/planesService';
import { useAuth } from '../../contexts/AuthContext';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const calcIMC = (peso, estatura) => {
    if (!peso || !estatura || estatura === 0) return null;
    const h = estatura > 3 ? estatura / 100 : estatura;
    return (peso / (h * h)).toFixed(1);
};

const fmt = (v) => v ? String(v) : '';
const logoData = LOGO_ALFRA_BASE64;


// Catálogo de Protocolos Rápidos en 1 Toque para Cabina
const PROTOCOLOS_CHIPS = {
    Corporal: [
        'Cavitación Ultrasónica',
        'Radiofrecuencia Corporal',
        'Lipo-Láser No Invasivo',
        'Vacumterapia de Moldeo',
        'Maderoterapia Reductiva',
        'Drenaje Linfático Manual',
        'Gimnasia Pasiva / EMS',
        'Enzimas Recombinantes',
        'Criolipólisis',
        'Termoterapia / Vendas',
        'Masaje Reductivo Manual',
        'Ultrasonido Terapéutico'
    ],
    Facial: [
        'Limpieza Facial Profunda',
        'Hidrafacial (Hidrodermoabrasión)',
        'Dermapen / Microneedling',
        'Radiofrecuencia Facial Lifting',
        'Peeling Ultrasónico',
        'Peeling Químico Renovador',
        'Máscara LED Fotodinámica',
        'Alta Frecuencia',
        'Velo de Colágeno / Hidratación',
        'Drenaje Linfático Facial',
        'Toxina Botulínica',
        'Ácido Hialurónico'
    ]
};

// ─── GENERADOR DE PDF DE CONSENTIMIENTOS CLÍNICOS (PROPORCIONES EJECUTIVAS Y ARMONÍA CLÍNICA) ─────
const generarPDFConsentimientoUniversal = (jsPDFLib, c, paciente, especialistaNombre, logoBase64) => {
    const PDFConstructor = typeof jsPDFLib === 'function' ? jsPDFLib : (jsPDFLib?.jsPDF || jsPDFLib?.default);
    if (!PDFConstructor) {
        alert("Error: Librería jsPDF no encontrada.");
        return;
    }
    const doc = new PDFConstructor({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
    });

    const pageW = 210;
    const pageH = 297;
    const margin = 16;
    const contentW = pageW - (margin * 2); // 178 mm

    const colorNavy = [11, 34, 57];
    const colorTeal = [20, 184, 166];
    const colorSlateDark = [30, 41, 59];
    const colorSlateMuted = [100, 116, 139];
    const colorBgSection = [245, 247, 250];
    const colorBorder = [226, 232, 240];

    // 1. LOGO ALFRA OFICIAL (Proporción armónica equilibrada: 27 mm x 23.35 mm)
    const logoImg = logoBase64 || LOGO_ALFRA_BASE64;
    try {
        if (logoImg) {
            const logoW = 27;
            const logoH = logoW / 1.156; // 23.35 mm (ratio exacto 1.156)
            const logoX = (pageW - logoW) / 2;
            doc.addImage(logoImg, 'PNG', logoX, 7, logoW, logoH, undefined, 'FAST');
        }
    } catch (e) {
        console.error("No se pudo inyectar el logo en el PDF", e);
    }

    const tmpl = CONSENT_TEMPLATES.find(t => t.id === c?.templateId || t.name === c?.name || t.id === c?.id) || c;
    const tituloDoc = (tmpl?.tituloPdf || tmpl?.name || c?.name || 'CONSENTIMIENTO INFORMADO').toUpperCase();

    // 2. BANNER DE TÍTULO (Sleek: altura 8 mm con acento turquesa en base)
    const bannerY = 34.5;
    const bannerH = 8;
    doc.setFillColor(...colorNavy);
    doc.roundedRect(margin, bannerY, contentW, bannerH, 1.2, 1.2, 'F');
    doc.setFillColor(...colorTeal);
    doc.rect(margin, bannerY + bannerH - 0.8, contentW, 0.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(tituloDoc.length > 55 ? 8 : 8.8);
    doc.setTextColor(255, 255, 255);
    doc.text(tituloDoc, pageW / 2, bannerY + 5.2, { align: 'center', maxWidth: contentW - 8 });

    // 3. TARJETA DE METADATOS CLÍNICOS ESTRUCTURADOS (13.5 mm)
    const cardY = bannerY + bannerH + 3.5; // 46 mm
    const cardH = 13.5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...colorBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, cardY, contentW, cardH, 1.2, 1.2, 'FD');

    // Indicador turquesa en tarjeta
    doc.setFillColor(...colorTeal);
    doc.roundedRect(margin, cardY, 2.5, cardH, 0.8, 0.8, 'F');

    const nombrePaciente = (paciente?.nombre || 'PACIENTE REGISTRADO').toUpperCase();
    const fechaHoy = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    const expFolio = paciente?.expedienteNumero || paciente?.folio || (paciente?.id ? paciente.id.slice(0, 10).toUpperCase() : 'EXP-ALFRA-2026');
    const espNombre = (especialistaNombre || paciente?.especialistaAsignadoNombre || 'Dra. Selene Mayret Farías Pérez').toUpperCase();

    // Columna 1: Paciente y Expediente
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorSlateMuted);
    doc.text('PACIENTE:', margin + 6, cardY + 4.5);
    doc.setFontSize(8);
    doc.setTextColor(...colorNavy);
    doc.text(nombrePaciente, margin + 22, cardY + 4.5);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorSlateMuted);
    doc.text('EXPEDIENTE:', margin + 6, cardY + 10.2);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colorSlateDark);
    doc.text(expFolio, margin + 25, cardY + 10.2);

    // Columna 2: Fecha y Especialista
    const col2X = margin + 98;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorSlateMuted);
    doc.text('FECHA:', col2X, cardY + 4.5);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colorSlateDark);
    doc.text(fechaHoy, col2X + 13, cardY + 4.5);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorSlateMuted);
    doc.text('ESPECIALISTA:', col2X, cardY + 10.2);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorNavy);
    doc.text(espNombre, col2X + 22, cardY + 10.2);

    // 4. SECCIONES CLÍNICAS (Módulos unificados, alineación vertical perfecta y holgura de texto)
    const defaultProcedimiento = `Por medio del presente documento, yo, ${nombrePaciente}, certifico que he sido informado(a) detalladamente sobre las características, objetivos clínicos, aparatología y protocolos a emplear en Clínica ALFRA.`;
    const defaultBeneficios = 'Optimización dérmica y estética integral, promoviendo el bienestar y armonización biológica bajo supervisión profesional continua.';
    const defaultRiesgos = 'Posibles reacciones temporales esperadas asociadas al tratamiento (enrojecimiento pasajero, calor local o sensibilidad transitoria), las cuales remiten espontáneamente.';
    const defaultCuidados = 'Cumplimiento estricto de las indicaciones post-cabina: hidratación adecuada, fotoprotección solar, control nutricional y asistencia puntual a las sesiones programadas.';
    const defaultDeclaracion = 'Manifiesto mi total conformidad y consentimiento voluntario para la realización del protocolo, comprometiéndome a seguir de forma estricta las indicaciones de mi especialista.';

    const secciones = [
        { num: '1', titulo: 'DESCRIPCIÓN Y ALCANCE DEL PROCEDIMIENTO', texto: tmpl?.procedimiento || defaultProcedimiento },
        { num: '2', titulo: 'BENEFICIOS ESPERADOS Y OBJETIVOS TERAPÉUTICOS', texto: tmpl?.beneficios || defaultBeneficios },
        { num: '3', titulo: 'REACCIONES ESPERADAS Y RIESGOS PREVISIBLES', texto: tmpl?.riesgos || defaultRiesgos },
        { num: '4', titulo: 'CUIDADOS OBLIGATORIOS Y CORRESPONSABILIDAD (50/50)', texto: tmpl?.cuidados || defaultCuidados },
        { num: '5', titulo: 'DECLARACIÓN DE CONFORMIDAD Y CONSENTIMIENTO INFORMADO', texto: tmpl?.declaracion || defaultDeclaracion }
    ];

    let curY = cardY + cardH + 4; // 63.5 mm
    const maxPageContentY = 228;

    // Calcular densidad de texto para ajustar armónicamente los espacios
    doc.setFontSize(7.5);
    let totalTextLines = 0;
    secciones.forEach(s => {
        const l = doc.splitTextToSize(s.texto, contentW - 10);
        totalTextLines += l.length;
    });

    const sectionGap = totalTextLines <= 8 ? 6.5 : 4.5;
    const bodyLineH = totalTextLines <= 8 ? 3.6 : 3.2;

    const drawHeaderFooter = (pageIdx, totalPages) => {
        doc.setDrawColor(...colorBorder);
        doc.setLineWidth(0.3);
        doc.line(margin, 282, pageW - margin, 282);

        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colorSlateMuted);
        doc.text('Clínica ALFRA · Cirugía & Medicina Estética  |  Calle Río Fuerte #26, Col. Lomas de Bellavista, Lázaro Cárdenas, Michoacán  |  Citas & WhatsApp: 753 538 6018', pageW / 2, 286, { align: 'center' });
        doc.setFontSize(5.5);
        doc.text('Documento médico-legal oficial emitido conforme a la NOM-004-SSA3-2012 del Expediente Clínico. Confidencial.', margin, 289.5);
        doc.text(`Página ${pageIdx} de ${totalPages}`, pageW - margin, 289.5, { align: 'right' });
    };

    secciones.forEach((sec) => {
        const headerH = 5.2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        const lineasTexto = doc.splitTextToSize(sec.texto, contentW - 10);
        const textH = lineasTexto.length * bodyLineH;
        const totalSecH = headerH + 4.2 + textH + sectionGap;

        if (curY + totalSecH > maxPageContentY) {
            doc.addPage();
            curY = 16;
            doc.setFillColor(...colorNavy);
            doc.roundedRect(margin, curY, contentW, 6, 1, 1, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(255, 255, 255);
            doc.text(`${tituloDoc} (CONTINUACIÓN)`, margin + 4, curY + 4.2);
            curY += 9;
        }

        // 1. Barra de encabezado unificada (sin píldoras flotantes despegadas)
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(margin, curY, contentW, headerH, 1, 1, 'F');
        
        // Pestaña lateral turquesa integrada
        doc.setFillColor(...colorTeal);
        doc.roundedRect(margin, curY, 2.5, headerH, 0.8, 0.8, 'F');

        // Título del encabezado (número y título integrados)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...colorNavy);
        doc.text(`${sec.num}.  ${sec.titulo}`, margin + 6, curY + 3.7);

        curY += headerH;

        // 2. Texto del cuerpo: alineado al inicio del título (margin + 6) y con holgura vertical garantizada
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...colorSlateDark);

        const textBaselineY = curY + 4.2;
        doc.text(lineasTexto, margin + 6, textBaselineY, { lineHeightFactor: 1.25 });

        curY = textBaselineY + textH - bodyLineH + sectionGap;
    });

    // 5. CLÁUSULA LEGAL Y NORMATIVA DE RESPALDO (Equilibra la proporción vertical de la página)
    const avisoH = 12;
    let avisoY = Math.max(curY + 2, 198);
    const boxFirmaH = 34;

    if (avisoY + avisoH + boxFirmaH > 276) {
        doc.addPage();
        avisoY = 20;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...colorBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, avisoY, contentW, avisoH, 1.2, 1.2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...colorNavy);
    doc.text('MARCO LEGAL Y CONFIDENCIALIDAD MÉDICA (NOM-004-SSA3-2012):', margin + 4, avisoY + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...colorSlateMuted);
    const avisoTexto = "El paciente manifiesta que ha resuelto sus dudas y otorga su consentimiento informado de manera libre y voluntaria. La información recabada y el material clínico fotográfico se encuentran resguardados bajo estricto secreto profesional y la legislación aplicable en materia de salud y protección de datos personales.";
    const avisoLineas = doc.splitTextToSize(avisoTexto, contentW - 8);
    doc.text(avisoLineas, margin + 4, avisoY + 7.6);

    // 6. BLOQUE DE FIRMAS (Tarjeta ejecutiva enmarcada)
    const firmaY = avisoY + avisoH + 3.5;
    doc.setFillColor(252, 253, 254);
    doc.setDrawColor(...colorBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, firmaY, contentW, boxFirmaH, 1.2, 1.2, 'FD');

    // Header firma
    doc.setFillColor(...colorNavy);
    doc.roundedRect(margin, firmaY, contentW, 4.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text('CONSTANCIA DE ACEPTACIÓN, FIRMA AUTÓGRAFA Y VALIDEZ CLÍNICA', pageW / 2, firmaY + 3.2, { align: 'center' });

    const colFirmaW = (contentW - 12) / 2;
    const f1X = margin + 6;
    const f2X = margin + 6 + colFirmaW + 6;

    if (c?.signatureData) {
        try {
            doc.addImage(c.signatureData, 'PNG', f1X + (colFirmaW - 38)/2, firmaY + 6.5, 38, 14, undefined, 'FAST');
        } catch (e) {
            console.error('Error insertando firma paciente', e);
        }
    }

    // Firma Paciente
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.4);
    doc.line(f1X + 4, firmaY + 22, f1X + colFirmaW - 4, firmaY + 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...colorNavy);
    doc.text(nombrePaciente, f1X + (colFirmaW / 2), firmaY + 26, { align: 'center', maxWidth: colFirmaW - 8 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...colorSlateMuted);
    doc.text('Firma del Paciente / Consentimiento Otorgado', f1X + (colFirmaW / 2), firmaY + 29.8, { align: 'center' });

    // Firma Especialista
    doc.line(f2X + 4, firmaY + 22, f2X + colFirmaW - 4, firmaY + 22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...colorNavy);
    doc.text(espNombre, f2X + (colFirmaW / 2), firmaY + 26, { align: 'center', maxWidth: colFirmaW - 8 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...colorSlateMuted);
    doc.text('Especialista Responsable · Clínica ALFRA', f2X + (colFirmaW / 2), firmaY + 29.8, { align: 'center' });

    // Paginación en footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawHeaderFooter(i, totalPages);
    }

    const safeName = (tmpl?.name || c?.name || 'Consentimiento_Informado').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safePaciente = (paciente?.nombre || 'Paciente').replace(/\s+/g, '_');
    guardarPdfNativo(doc, `${safeName}_${safePaciente}.pdf`, `Consentimiento Informado - ${tmpl?.name || "ALFRA"}`);
};

function NuevaSesionForm({ tratamiento, pacienteId, onSaved, onCancel, esPrimeraSesion, paciente, ultimaSesion, citaIdPreseleccionada }) {
    const [medidas, setMedidas] = useState(() => {
        // Pre-cargar automáticamente la estatura de la sesión anterior para ahorrar tiempo
        if (ultimaSesion?.medidas?.estatura) {
            return { estatura: ultimaSesion.medidas.estatura };
        }
        return {};
    });
    const [protocolo, setProtocolo] = useState('');
    const [notas, setNotas] = useState('');
    const [fotos, setFotos] = useState([]);  // { url, storagePath, name }
    const [consentimientos, setConsentimientos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [signingDocument, setSigningDocument] = useState(null);
    const [citasPaciente, setCitasPaciente] = useState([]);
    const [metaCalorica, setMetaCalorica] = useState(ultimaSesion?.metasPaciente?.metaCalorica || paciente?.metaCalorica || '1500');
    const [metaEjercicio, setMetaEjercicio] = useState(ultimaSesion?.metasPaciente?.metaEjercicio || paciente?.metaEjercicio || '40');
    const [auditoriaDieta, setAuditoriaDieta] = useState(false);
    const [auditoriaEjercicio, setAuditoriaEjercicio] = useState(false);
    const [citaVinculada, setCitaVinculada] = useState(citaIdPreseleccionada || '');
    const [loadingCitas, setLoadingCitas] = useState(true);

    // Auto-agregar Carta Compromiso si es Paquete Reductivo
    useEffect(() => {
        if (tratamiento?.tipo === 'Paquete Reductivo' && consentimientos.length === 0) {
            const tmpl = CONSENT_TEMPLATES.find(t => t.name.includes('Carta Compromiso'));
            if (tmpl) {
                setConsentimientos([{
                    id: Date.now().toString(),
                    templateId: tmpl.id,
                    name: tmpl.name,
                    signed: false
                }]);
            }
        }
    }, [tratamiento]);

    // Cargar citas del paciente para vincular (y auto-seleccionar la cita de hoy si existe)
    useEffect(() => {
        if (!pacienteId) return;
        setLoadingCitas(true);
        (async () => {
            try {
                let citas = await getCitasByPaciente(pacienteId);

                if (citas.length === 0) {
                    const pacInfo = await getPacienteById(pacienteId);
                    if (pacInfo?.nombre) {
                        const { getCitas } = await import('../../services/citasService');
                        const todasCitas = await getCitas();
                        const nombreLower = pacInfo.nombre.toLowerCase().trim();
                        citas = todasCitas.filter(c => {
                            const citaNombre = (c.pacienteNombre || c.paciente || '').toLowerCase().trim();
                            return citaNombre === nombreLower || c.pacienteId === pacienteId;
                        });
                    }
                }

                const hoyIso = new Date().toISOString().slice(0, 10);
                const sorted = citas
                    .map(c => {
                        let fecha = '--';
                        let hora = '';
                        let isoDate = '';
                        if (c.fechaHora) {
                            const d = new Date(c.fechaHora);
                            if (!isNaN(d.getTime())) {
                                fecha = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
                                hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                                isoDate = d.toISOString().slice(0, 10);
                            }
                        } else if (c.fecha) {
                            fecha = c.fecha;
                            hora = c.hora || '';
                            isoDate = String(c.fecha).slice(0, 10);
                        }
                        return { ...c, fecha, hora, isoDate };
                    })
                    .sort((a, b) => {
                        const dA = a.fechaHora ? new Date(a.fechaHora) : new Date(0);
                        const dB = b.fechaHora ? new Date(b.fechaHora) : new Date(0);
                        return dB - dA;
                    })
                    .slice(0, 20);

                setCitasPaciente(sorted);

                // Auto-vincular cita si viene por URL o si hay una cita el día de hoy
                if (citaIdPreseleccionada) {
                    setCitaVinculada(citaIdPreseleccionada);
                } else {
                    const citaHoy = sorted.find(c => c.isoDate === hoyIso && c.status !== 'Cancelada');
                    if (citaHoy) setCitaVinculada(citaHoy.id);
                }
            } catch (e) { console.error('Error cargando citas:', e); }
            setLoadingCitas(false);
        })();
    }, [pacienteId, citaIdPreseleccionada]);

    const [agendarSiguiente, setAgendarSiguiente] = useState(true);
    const [siguienteFecha, setSiguienteFecha] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    const [siguienteHora, setSiguienteHora] = useState('10:00');
    const [siguienteDuracion, setSiguienteDuracion] = useState(60);
    const [motivoCitaUnicaSesion, setMotivoCitaUnicaSesion] = useState('');
    const fileRef = useRef(null);

    const setMedida = (k, v) => setMedidas(prev => ({ ...prev, [k]: v }));
    const esCorporal = tratamiento.tipo === 'Corporal' || tratamiento.tipo === 'Paquete Reductivo';
    const imc = esCorporal ? calcIMC(medidas.peso, medidas.estatura) : null;

    // Copiar medidas de la sesión anterior en 1 clic
    const handleCopiarMedidasAnteriores = () => {
        if (!ultimaSesion?.medidas) return;
        setMedidas({ ...ultimaSesion.medidas });
    };

    // Agregar o quitar chip de protocolo rápido
    const chipsDisponibles = esCorporal ? PROTOCOLOS_CHIPS.Corporal : PROTOCOLOS_CHIPS.Facial;
    const handleToggleProtocoloChip = (chip) => {
        setProtocolo(prev => {
            const actual = prev.trim();
            if (actual.toLowerCase().includes(chip.toLowerCase())) {
                // Quitarlo si ya estaba
                return actual
                    .split(',')
                    .map(s => s.trim())
                    .filter(s => s && s.toLowerCase() !== chip.toLowerCase())
                    .join(', ');
            }
            return actual ? `${actual}, ${chip}` : chip;
        });
    };

    // Templates filtrados por tipo de tratamiento
    const templatesDisponibles = CONSENT_TEMPLATES.filter(
        t => t.type === tratamiento.tipo || t.type === 'Mixto'
    );

    const handleAddConsent = () => {
        if (!selectedTemplateId) return;
        const tmpl = CONSENT_TEMPLATES.find(t => t.id === selectedTemplateId);
        if (!tmpl) return;
        if (consentimientos.find(c => c.templateId === tmpl.id)) return;
        setConsentimientos(prev => [...prev, {
            id: Date.now().toString(),
            templateId: tmpl.id,
            name: tmpl.name,
            type: tmpl.type,
            signed: false,
            status: 'pendiente',
            dateSent: new Date().toISOString()
        }]);
        setSelectedTemplateId('');
    };

    const handleDownloadPDF = async (c) => {
        generarPDFConsentimientoUniversal(jsPDF, c, paciente, auth.currentUser?.displayName, logoData);
    };

    const handleUploadFoto = async (e) => {
        const file = e.target.files[0];
        if (!file || !pacienteId) return;
        setUploading(true);
        try {
            const ts = Date.now();
            const storagePath = `sesiones_v2/${pacienteId}/${ts}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setFotos(prev => [...prev, { url, storagePath, name: file.name, fecha: new Date().toISOString() }]);
        } catch (err) {
            console.error('Error subiendo foto:', err);
            alert('Error al subir la fotografía.');
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveFoto = async (foto) => {
        setFotos(prev => prev.filter(f => f.storagePath !== foto.storagePath));
    };

    const handleGuardar = async () => {
        if (!protocolo.trim()) {
            alert('Por favor selecciona o describe el protocolo realizado en esta sesión.');
            return;
        }
        if (agendarSiguiente && (!siguienteFecha || !siguienteHora)) {
            alert('Por favor selecciona fecha y hora para la siguiente cita.');
            return;
        }
        setSaving(true);
        try {
            const citaSel = citaVinculada ? citasPaciente.find(c => c.id === citaVinculada) : null;
            const fechaSesion = citaSel?.fechaHora || null;

            const sesionId = await crearSesion(tratamiento.id, pacienteId, tratamiento.tipo, {
                protocolo,
                notas,
                medidas: esCorporal ? { ...medidas, imc } : medidas,
                metasPaciente: esCorporal ? { metaCalorica, metaEjercicio } : null,
                auditoriaSemana: esCorporal ? { cumplioDieta: auditoriaDieta, cumplioEjercicio: auditoriaEjercicio } : null,
                fotosSesion: fotos,
                consentimientos,
                pacienteNombre: paciente?.nombre || '',
                ...(fechaSesion && { fechaOverride: fechaSesion }),
                ...(citaVinculada && { citaVinculadaId: citaVinculada }),
            });

            // Si se vinculó a una cita (o existe cita del paciente hoy):
            // - Si agendó siguiente cita: se cierra como 'Completada'
            // - Si es Cita Única (no agendó próxima cita): pasa a 'Pendiente Pase a Caja' esperando autorización de Recepción
            const todayKey = new Date().toISOString().split('T')[0];
            const citaDelDia = citaVinculada
                ? citaVinculada
                : (citasPaciente.find(c => String(c.fecha || c.fechaHora || '').startsWith(todayKey) && c.status !== 'Cancelada')?.id || '');
            if (citaDelDia) {
                try {
                    const user = auth.currentUser;
                    if (agendarSiguiente && siguienteFecha && siguienteHora) {
                        await updateCitaStatus(citaDelDia, 'Completada', {
                            expedienteActualizado: true,
                            sesionRegistradaId: sesionId,
                            fechaActualizacionExpediente: new Date().toISOString(),
                        });
                    } else {
                        await updateCitaStatus(citaDelDia, 'Pendiente Pase a Caja', {
                            expedienteActualizado: true,
                            sesionRegistradaId: sesionId,
                            fechaActualizacionExpediente: new Date().toISOString(),
                            esCitaUnica: true,
                            paseCaja: {
                                esCitaUnica: true,
                                motivoCitaUnica: motivoCitaUnicaSesion.trim() || 'Cita única sin seguimiento programado',
                                estadoAutorizacion: 'pendiente_recepcion',
                                atendidoPor: user?.displayName || user?.email || 'Especialista',
                                actualizadoEn: new Date().toISOString(),
                            },
                        });
                    }
                } catch (e) {
                    console.warn('No se pudo actualizar estado de la cita vinculada:', e);
                }
            }
            try {
                await updatePaciente(pacienteId, {
                    ultimaActualizacionExpediente: todayKey,
                    requiereActualizacion: false,
                });
            } catch {}

            // Sincronizar fotos de la sesión a la galería global del paciente
            if (fotos && fotos.length > 0 && paciente) {
                try {
                    const galleryPhotos = fotos.map(f => ({
                        id: `g_${Date.now()}_${Math.random()}`,
                        url: f.url,
                        path: f.storagePath || f.path,
                        date: new Date().toLocaleDateString('es-MX')
                    }));
                    await updatePaciente(pacienteId, { gallery: [...(paciente.gallery || []), ...galleryPhotos] });
                } catch (e) {
                    console.error("Error al sincronizar galería:", e);
                }
            }

            // Sincronizar las metas directamente al perfil del paciente
            if (esCorporal) {
                await updatePaciente(pacienteId, {
                    metaCalorica: metaCalorica,
                    metaEjercicio: metaEjercicio
                });
            }

            // Agendar Siguiente Sesión (vinculando tanto ID de staff como UID y Nombre para que siempre aparezca en AgendaDiaria)
            if (agendarSiguiente && siguienteFecha && siguienteHora) {
                try {
                    const user = auth.currentUser;
                    const [pInfo, staff] = await Promise.all([
                        getPacienteById(pacienteId).catch(() => paciente),
                        user ? getStaffDocByUid(user.uid, user.email, user.displayName).catch(() => null) : Promise.resolve(null)
                    ]);

                    const [year, month, day] = siguienteFecha.split('-');
                    const [hh, mm] = siguienteHora.split(':');
                    const fechaBase = new Date(year, parseInt(month) - 1, day, parseInt(hh), parseInt(mm));

                    const citaId = await createCita({
                        pacienteId,
                        pacienteNombre: pInfo?.nombre || paciente?.nombre || 'Paciente',
                        telefono: pInfo?.telefono || paciente?.telefono || '',
                        especialistaId: staff?.id || user?.uid || '',
                        especialistaUid: user?.uid || '',
                        especialistaNombre: staff?.nombre || user?.displayName || 'Especialista',
                        especialistaEmail: staff?.email || user?.email || '',
                        servicio: tratamiento.nombre || tratamiento.tipo,
                        fecha: siguienteFecha,
                        fechaYMD: siguienteFecha,
                        hora: siguienteHora,
                        fechaHora: `${siguienteFecha}T${siguienteHora.length === 5 ? siguienteHora + ':00' : siguienteHora}`,
                        duracionMin: Number(siguienteDuracion || 60),
                        status: 'Confirmada',
                        notas: 'Agendada desde expediente clínico tras sesión de ' + tratamiento.nombre,
                    });

                    await addDoc(collection(db, 'alertas_pacientes'), {
                        especialistaId: 'global',
                        mensaje: `Nueva Cita Agendada en Cabina: ${pInfo?.nombre || paciente?.nombre || 'Paciente'} reservó su próxima sesión de ${tratamiento.nombre} para el ${siguienteFecha} a las ${siguienteHora}.`,
                        estado: 'pendiente',
                        createdAt: serverTimestamp(),
                        pacienteNombre: pInfo?.nombre || paciente?.nombre || 'Paciente',
                        citaId
                    });
                } catch (citaErr) {
                    console.error('Error auto-agendando cita:', citaErr);
                }
            }

            onSaved();
        } catch (err) {
            console.error('Error guardando sesión:', err);
            alert('Error al guardar la sesión. Verifica tu conexión.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200 bg-slate-50/60 p-4 sm:p-6 rounded-3xl border-2 border-turquesa/30">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${esCorporal ? 'bg-turquesa text-white' : 'bg-purple-600 text-white'} shadow-md`}>
                        {esCorporal ? <Ruler size={22} /> : <Sparkles size={22} />}
                    </div>
                    <div>
                        <h3 className="font-black text-acero text-base uppercase tracking-tight">
                            ⚡ Registro Rápido de Sesión en Cabina
                        </h3>
                        <p className="text-xs text-turquesa font-bold">
                            {tratamiento.nombre} · {tratamiento.tipo} {esPrimeraSesion ? '(Sesión Inicial #1)' : ''}
                        </p>
                    </div>
                </div>
                <button onClick={onCancel} className="p-2 rounded-xl bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 border border-gray-200 transition-colors cursor-pointer">
                    <X size={18} />
                </button>
            </div>

            {/* Vincular a Cita Agendada (Compacto en Píldoras) */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-black text-acero uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar size={14} className="text-turquesa" /> Cita Vinculada a esta Sesión
                    </label>
                    <span className="text-[10px] font-bold text-gray-400">
                        Al guardar, la cita seleccionada se marcará como "Completada" automáticamente
                    </span>
                </div>
                {loadingCitas ? (
                    <p className="text-gray-400 text-xs">Buscando citas del paciente...</p>
                ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setCitaVinculada('')}
                            className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                !citaVinculada
                                    ? 'bg-turquesa text-white border-turquesa shadow-sm'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            🕒 Registrar con hora actual (Sin cita previa)
                        </button>
                        {citasPaciente.slice(0, 6).map((cita) => {
                            const isSelected = citaVinculada === cita.id;
                            return (
                                <button
                                    type="button"
                                    key={cita.id}
                                    onClick={() => setCitaVinculada(cita.id)}
                                    className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                        isSelected
                                            ? 'bg-acero text-white border-acero shadow-sm'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-acero/40'
                                    }`}
                                >
                                    <span>📅 {cita.fecha} {cita.hora}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        {cita.servicio || 'Cita'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Medidas Corporales con Referencia Anterior en Vivo y Delta */}
            {esCorporal ? (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <h4 className="text-xs font-black text-acero uppercase tracking-wider flex items-center gap-2">
                                <Ruler size={15} className="text-turquesa" /> Medidas Corporales de la Sesión
                            </h4>
                            <p className="text-[11px] text-gray-400">
                                Compara en tiempo real contra la sesión anterior mientras capturas
                            </p>
                        </div>
                        {ultimaSesion?.medidas && (
                            <button
                                type="button"
                                onClick={handleCopiarMedidasAnteriores}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-turquesa/10 text-turquesa hover:bg-turquesa hover:text-white text-xs font-black border border-turquesa/30 transition-all cursor-pointer"
                            >
                                <Copy size={13} /> Copiar medidas de sesión anterior
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {MEDIDAS_CORPORALES.map(campo => {
                            const prevVal = parseFloat(ultimaSesion?.medidas?.[campo.key]);
                            const currVal = parseFloat(medidas[campo.key]);
                            const hasDiff = !isNaN(prevVal) && !isNaN(currVal) && prevVal > 0 && currVal > 0 && campo.key !== 'estatura';
                            const diff = hasDiff ? (currVal - prevVal) : null;

                            return (
                                <div key={campo.key} className="bg-gray-50/70 p-2.5 rounded-xl border border-gray-100 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                            {campo.label} <span className="text-gray-400">({campo.unit})</span>
                                        </label>
                                        {diff !== null && diff !== 0 && (
                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                                diff < 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)} {campo.unit}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-base font-black text-center bg-white outline-none focus:border-turquesa transition-all"
                                        value={fmt(medidas[campo.key])}
                                        onChange={e => setMedida(campo.key, e.target.value)}
                                        placeholder={!isNaN(prevVal) ? String(prevVal) : '0'}
                                    />
                                    {!isNaN(prevVal) && (
                                        <p className="text-[10px] font-bold text-gray-400 text-center">
                                            Anterior: <span className="text-acero">{prevVal} {campo.unit}</span>
                                        </p>
                                    )}
                                </div>
                            );
                        })}

                        {/* IMC Auto */}
                        <div className="bg-gray-50/70 p-2.5 rounded-xl border border-gray-100 space-y-1 flex flex-col justify-between">
                            <label className="text-[10px] font-black text-turquesa uppercase tracking-wider block text-center">
                                IMC (Automático)
                            </label>
                            <div className={`w-full p-2.5 border-2 rounded-xl text-base font-black text-center border-dashed ${
                                imc > 25 ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-emerald-300 text-emerald-700 bg-emerald-50'
                            }`}>
                                {imc || '—'}
                            </div>
                            {ultimaSesion?.medidas?.imc && (
                                <p className="text-[10px] font-bold text-gray-400 text-center">
                                    Anterior: {ultimaSesion.medidas.imc}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-acero uppercase tracking-wider flex items-center gap-2">
                            <User size={14} className="text-purple-600" /> Evaluación Facial en Cabina
                        </h4>
                        {ultimaSesion?.medidas && (
                            <button
                                type="button"
                                onClick={handleCopiarMedidasAnteriores}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white text-xs font-black border border-purple-200 transition-all cursor-pointer"
                            >
                                <Copy size={13} /> Copiar evaluación anterior
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {CAMPOS_FACIALES.map(campo => (
                            <div key={campo.key} className="space-y-1">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{campo.label}</label>
                                {campo.tipo === 'select' ? (
                                    <select
                                        className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-bold bg-gray-50 outline-none focus:bg-white focus:border-turquesa/40 transition-all"
                                        value={medidas[campo.key] || campo.opciones[0]}
                                        onChange={e => setMedida(campo.key, e.target.value)}
                                    >
                                        {campo.opciones.map(o => <option key={o}>{o}</option>)}
                                    </select>
                                ) : campo.tipo === 'textarea' ? (
                                    <textarea
                                        className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-medium bg-gray-50 outline-none focus:bg-white focus:border-turquesa/40 transition-all h-20 resize-none"
                                        value={medidas[campo.key] || ''}
                                        onChange={e => setMedida(campo.key, e.target.value)}
                                        placeholder={`Describe ${campo.label.toLowerCase()}...`}
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-medium bg-gray-50 outline-none focus:bg-white focus:border-turquesa/40 transition-all"
                                        value={medidas[campo.key] || ''}
                                        onChange={e => setMedida(campo.key, e.target.value)}
                                        placeholder="Ej. Frente, mejillas, mentón..."
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* PROTOCOLO DE SESIÓN CON CHIPS DE 1 TOQUE */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-black text-acero uppercase tracking-wider flex items-center gap-2">
                        <Clipboard size={15} className="text-turquesa" /> Protocolo y Aparatología Aplicada <span className="text-red-500">*</span>
                    </label>
                    {ultimaSesion?.protocolo && (
                        <button
                            type="button"
                            onClick={() => setProtocolo(ultimaSesion.protocolo)}
                            className="text-[11px] font-bold text-turquesa hover:underline flex items-center gap-1 cursor-pointer"
                        >
                            <Copy size={12} /> Repetir protocolo anterior
                        </button>
                    )}
                </div>

                {/* Chips clicables de 1 toque */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                        ⚡ Toca para agregar aparatología o técnica al instante:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {chipsDisponibles.map(chip => {
                            const active = protocolo.toLowerCase().includes(chip.toLowerCase());
                            return (
                                <button
                                    key={chip}
                                    type="button"
                                    onClick={() => handleToggleProtocoloChip(chip)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                        active
                                            ? 'bg-turquesa text-white border-turquesa shadow-xs'
                                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-turquesa/50 hover:bg-white'
                                    }`}
                                >
                                    {active ? '✓ ' : '+ '}{chip}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <textarea
                    className="w-full p-3.5 border-2 border-gray-200 rounded-xl text-sm font-medium bg-gray-50/50 outline-none focus:bg-white focus:border-turquesa transition-all h-24 resize-none"
                    value={protocolo}
                    onChange={e => setProtocolo(e.target.value)}
                    placeholder="Selecciona los equipos arriba o detalla tiempos, intensidades, zonas trabajadas y activos aplicados..."
                />

                <div>
                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider block mb-1">
                        Notas Clínicas / Observaciones Post-Sesión (Opcional)
                    </label>
                    <input
                        type="text"
                        className="w-full p-3 border-2 border-gray-100 rounded-xl text-sm font-medium bg-gray-50/50 outline-none focus:bg-white focus:border-turquesa transition-all"
                        value={notas}
                        onChange={e => setNotas(e.target.value)}
                        placeholder="Reacciones observadas, tolerancia del paciente, recomendaciones para la siguiente visita..."
                    />
                </div>
            </div>

            {/* Sección de Compromiso del Paciente (Para Tratamientos Corporales / Paquete Reductivo) */}
            {esCorporal && (
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white shadow-lg border border-gray-700/50">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4">
                        <Activity size={16} className="text-turquesa" />
                        Seguimiento Nutricional y Metas Semanales (App Paciente)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/10">
                            <label className="text-[10px] font-black text-turquesa uppercase tracking-widest block">
                                Auditoría de la Semana Pasada
                            </label>
                            {esPrimeraSesion ? (
                                <p className="text-xs font-bold text-gray-300">
                                    Primera sesión del tratamiento (sin auditoría previa).
                                </p>
                            ) : (
                                <div className="space-y-2.5">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={auditoriaDieta}
                                            onChange={e => setAuditoriaDieta(e.target.checked)}
                                            className="w-4 h-4 accent-turquesa rounded"
                                        />
                                        <span className="text-xs font-bold text-gray-200">Cumplió meta calórica asignada</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={auditoriaEjercicio}
                                            onChange={e => setAuditoriaEjercicio(e.target.checked)}
                                            className="w-4 h-4 accent-turquesa rounded"
                                        />
                                        <span className="text-xs font-bold text-gray-200">Cumplió minutos de actividad física</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/10">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-turquesa uppercase tracking-widest">
                                    Metas para Próxima Sesión
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const p = parseFloat(medidas.peso || ultimaSesion?.medidas?.peso);
                                        const e = parseFloat(medidas.estatura || ultimaSesion?.medidas?.estatura);
                                        if (p > 0 && e > 0) {
                                            const bmr = (10 * p) + (6.25 * e) - (5 * 35) - 161;
                                            const tdee = bmr * 1.2;
                                            const meta = Math.round((tdee - 500) / 10) * 10;
                                            setMetaCalorica(meta >= 1100 ? meta.toString() : '1200');
                                        } else {
                                            alert("Ingresa Peso y Estatura arriba para auto-calcular.");
                                        }
                                    }}
                                    className="text-[10px] bg-turquesa/20 text-turquesa hover:bg-turquesa hover:text-slate-900 px-2.5 py-0.5 rounded-full font-black transition-colors cursor-pointer"
                                >
                                    🪄 Auto-Calcular Kcal
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 block mb-1">Meta Kcal / Día</span>
                                    <input
                                        type="number"
                                        value={metaCalorica}
                                        onChange={e => setMetaCalorica(e.target.value)}
                                        className="w-full bg-black/30 border border-white/15 rounded-xl p-2 text-base text-center font-black text-white"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 block mb-1">Minutos Ejercicio</span>
                                    <input
                                        type="number"
                                        value={metaEjercicio}
                                        onChange={e => setMetaEjercicio(e.target.value)}
                                        className="w-full bg-black/30 border border-white/15 rounded-xl p-2 text-base text-center font-black text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Fotografías y Consentimientos lado a lado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Fotos de la sesión */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-acero uppercase tracking-wider flex items-center gap-1.5">
                            <Camera size={14} className="text-turquesa" /> Fotos de la Sesión ({fotos.length})
                        </label>
                        <Button
                            size="sm"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            icon={uploading ? Loader : Camera}
                        >
                            {uploading ? 'Subiendo...' : 'Subir Foto'}
                        </Button>
                        <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={handleUploadFoto} />
                    </div>

                    {fotos.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {fotos.map((foto, i) => (
                                <div key={i} className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200">
                                    <img src={foto.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveFoto(foto)}
                                        className="absolute top-1 right-1 p-1.5 bg-red-600 text-white rounded-lg opacity-80 hover:opacity-100"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-1.5 cursor-pointer hover:border-turquesa/40 hover:bg-turquesa/5 transition-all"
                        >
                            <Camera size={24} className="text-gray-300" />
                            <p className="text-[11px] text-gray-400 font-bold">Toca para tomar o subir foto de avance</p>
                        </div>
                    )}
                </div>

                {/* Consentimientos Informados / Carta Compromiso */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3">
                    <label className="text-xs font-black text-acero uppercase tracking-wider flex items-center gap-1.5">
                        <Lock size={14} className="text-turquesa" /> {tratamiento?.tipo === 'Paquete Reductivo' ? 'Carta Compromiso' : 'Consentimientos Informados'}
                    </label>
                    <div className="flex gap-2">
                        <select
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold bg-gray-50 outline-none focus:border-turquesa"
                            value={selectedTemplateId}
                            onChange={e => setSelectedTemplateId(e.target.value)}
                        >
                            <option value="">Seleccionar documento a firmar...</option>
                            <optgroup label="✨ Faciales">
                                {CONSENT_TEMPLATES.filter(t => t.categoria === 'Facial').map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="💪 Corporales">
                                {CONSENT_TEMPLATES.filter(t => t.categoria === 'Corporal').map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="⚡ Láser y Fototerapia">
                                {CONSENT_TEMPLATES.filter(t => t.categoria === 'Láser').map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="📋 Generales y Cartas Compromiso">
                                {CONSENT_TEMPLATES.filter(t => t.categoria === 'General').map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </optgroup>
                        </select>
                        <Button size="sm" variant="outline" disabled={!selectedTemplateId} onClick={handleAddConsent}>
                            + Añadir
                        </Button>
                    </div>

                    {consentimientos.length > 0 && (
                        <div className="space-y-2 pt-1">
                            {consentimientos.map(c => (
                                <div key={c.id} className={`flex items-center justify-between p-2.5 rounded-xl border ${c.signed ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                                    <span className={`text-xs font-bold truncate ${c.signed ? 'text-green-800' : 'text-amber-800'}`}>
                                        {c.signed ? '✓ ' : '⏳ '}{c.name}
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {!c.signed && (
                                            <button
                                                type="button"
                                                onClick={() => setSigningDocument(c)}
                                                className="text-[11px] font-black bg-turquesa text-white px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                                            >
                                                <PenTool size={11} /> Firmar
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadPDF(c)}
                                            className="text-[11px] font-bold bg-white text-blue-600 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                                        >
                                            <Download size={11} /> PDF
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Agendar Siguiente Sesión (Obligatorio para Pase a Caja o Solicitar Autorización de Cita Única) */}
            <div className="bg-white p-4 rounded-2xl border-2 border-turquesa/30 space-y-3">
                <div className="flex items-center justify-between">
                    <label
                        className="text-xs font-black text-acero uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                        onClick={() => setAgendarSiguiente(!agendarSiguiente)}
                    >
                        <Calendar size={15} className={agendarSiguiente ? "text-turquesa" : "text-amber-500"} />
                        {agendarSiguiente
                            ? '📅 Agendar Próxima Cita (Obligatorio para cerrar cita)'
                            : '🔒 Cita Única (Requiere autorización de Pase a Caja en Recepción)'}
                    </label>
                    <button
                        type="button"
                        onClick={() => setAgendarSiguiente(!agendarSiguiente)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${agendarSiguiente ? 'bg-turquesa' : 'bg-amber-500'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${agendarSiguiente ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {agendarSiguiente ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Fecha Próxima Cita *</label>
                            <input
                                type="date"
                                value={siguienteFecha}
                                onChange={e => setSiguienteFecha(e.target.value)}
                                className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Hora *</label>
                            <input
                                type="time"
                                value={siguienteHora}
                                onChange={e => setSiguienteHora(e.target.value)}
                                className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Duración</label>
                            <select
                                value={siguienteDuracion}
                                onChange={e => setSiguienteDuracion(parseInt(e.target.value))}
                                className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold"
                            >
                                <option value="30">30 min</option>
                                <option value="60">1 hora</option>
                                <option value="90">1.5 horas</option>
                                <option value="120">2 horas</option>
                            </select>
                        </div>
                    </div>
                ) : (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-2">
                        <p className="text-xs font-bold text-amber-900">
                            ⚠️ Si es <strong>Cita Única</strong> y no agendas próxima cita, tu cita quedará en espera de que <strong>Recepción autorice el Pase a Caja</strong> para poder cerrarse satisfactoriamente.
                        </p>
                        <input
                            type="text"
                            value={motivoCitaUnicaSesion}
                            onChange={e => setMotivoCitaUnicaSesion(e.target.value)}
                            placeholder="Indica el motivo de Cita Única para Recepción (ej. sesión única, alta, paciente foráneo)..."
                            className="w-full p-2.5 border border-amber-300 bg-white rounded-xl text-xs font-medium"
                        />
                    </div>
                )}
            </div>

            <SignatureModal
                isOpen={!!signingDocument}
                onClose={() => setSigningDocument(null)}
                documentName={signingDocument?.name}
                onSave={(signatureData) => {
                    setConsentimientos(prev => prev.map(c =>
                        c.id === signingDocument.id ? { ...c, signed: true, signatureData } : c
                    ));
                    setSigningDocument(null);
                }}
            />

            {/* Botones de Guardado */}
            <div className="flex gap-3 justify-end pt-2">
                <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button
                    variant="primary"
                    icon={saving ? Loader : Save}
                    onClick={handleGuardar}
                    disabled={saving}
                    className="px-8 font-black shadow-lg"
                >
                    {saving ? 'Guardando Sesión...' : '✓ Guardar Sesión Clínica'}
                </Button>
            </div>
        </div>
    );
}

// ─── SUBCOMPONENT: TABLA DE SESIONES ─────────────────────────────────────────
function SesionesTratamiento({ tratamiento, sesiones, onNuevaSesion, onEliminarSesion, onSolicitarEliminarTratamiento, onDownloadConsentPDF, esCorporal, onActualizarTratamiento }) {
    const [faseRoadmapManual, setFaseRoadmapManual] = useState(tratamiento?.faseRoadmapManual || 'auto');
    const [guardandoFase, setGuardandoFase] = useState(false);
    const [avisoFase, setAvisoFase] = useState(null);

    useEffect(() => {
        setFaseRoadmapManual(tratamiento?.faseRoadmapManual || 'auto');
    }, [tratamiento?.id, tratamiento?.faseRoadmapManual]);

    const catRoadmap = (() => {
        const txt = `${tratamiento?.tipo || ''} ${tratamiento?.nombre || ''}`.toLowerCase();
        if (txt.includes('laser') || txt.includes('láser') || txt.includes('depil')) return 'laser';
        if (txt.includes('despigment') || txt.includes('aclarad') || txt.includes('mancha') || txt.includes('melasma')) return 'despigmentacion';
        if (txt.includes('facial') || txt.includes('dermapen') || txt.includes('peeling') || txt.includes('limpieza') || txt.includes('hidra')) return 'facial';
        return 'corporal';
    })();

    const calcularFaseAuto = (num) => {
        if (catRoadmap === 'corporal') {
            if (num >= 12) return 4;
            if (num >= 8) return 3;
            if (num >= 4) return 2;
            return 1;
        }
        if (catRoadmap === 'facial') {
            if (num >= 9) return 4;
            if (num >= 6) return 3;
            if (num >= 3) return 2;
            return 1;
        }
        // laser o despigmentacion (8 a 12 sesiones)
        if (num >= 10) return 4;
        if (num >= 7) return 3;
        if (num >= 4) return 2;
        return 1;
    };

    const handleCambiarFase = async (nuevaFase) => {
        setFaseRoadmapManual(nuevaFase);
        setGuardandoFase(true);
        try {
            await actualizarFaseRoadmapTratamiento(tratamiento.id, nuevaFase);
            if (onActualizarTratamiento) {
                onActualizarTratamiento({ ...tratamiento, faseRoadmapManual: nuevaFase });
            }
            const faseTexto = nuevaFase === 'auto'
                ? `Automático (Fase ${calcularFaseAuto(sesiones.length)})`
                : `Fase ${nuevaFase}`;
            setAvisoFase(`Fase sincronizada: ${faseTexto}`);
            setTimeout(() => setAvisoFase(null), 3500);
        } catch (err) {
            console.error('Error al guardar fase del roadmap:', err);
            alert('Error al guardar fase: ' + err.message);
        } finally {
            setGuardandoFase(false);
        }
    };
    const [expanded, setExpanded] = useState(() => (sesiones.length > 0 ? sesiones[sesiones.length - 1]?.id : null));

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 gap-3">
                    <div>
                        <span className="text-xs font-black text-acero uppercase tracking-wider">
                            Historial de Sesiones — {tratamiento.nombre}
                        </span>
                        <span className="ml-2 text-xs font-bold text-turquesa bg-turquesa/10 px-2.5 py-0.5 rounded-full">
                            {sesiones.length} {tratamiento.numSesionesTotal ? `/ ${tratamiento.numSesionesTotal}` : ''} registradas
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {tratamiento.solicitudEliminacion ? (
                            <span className="text-[10px] font-black text-orange-600 uppercase px-3 py-1.5 bg-orange-50 rounded-xl">
                                ⏳ Baja Pendiente
                            </span>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onSolicitarEliminarTratamiento(tratamiento)}
                                className="text-red-400 hover:text-red-600 text-xs"
                            >
                                <Trash2 size={13} className="mr-1" /> Solicitar Baja
                            </Button>
                        )}
                        <Button
                            variant="primary"
                            size="sm"
                            icon={Plus}
                            onClick={onNuevaSesion}
                        >
                            + Registrar Nueva Sesión
                        </Button>
                    </div>
                </div>
                {/* Control de Fase del Roadmap Clínico (Propuesta 4 - Punto 3) */}
                <div className="px-5 py-3 bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-slate-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-turquesa/15 text-turquesa flex items-center justify-center border border-turquesa/20">
                            <Target size={16} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-gray-800 uppercase tracking-wider">
                                    Fase del Roadmap Clínico en App:
                                </span>
                                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                    faseRoadmapManual === 'auto'
                                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                        : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                }`}>
                                    {faseRoadmapManual === 'auto'
                                        ? `⚡ Auto por Sesiones (Fase ${calcularFaseAuto(sesiones.length)})`
                                        : `📍 Manual Especialista (Fase ${faseRoadmapManual})`}
                                </span>
                                {guardandoFase && <Loader size={12} className="animate-spin text-turquesa" />}
                                {avisoFase && (
                                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full animate-in fade-in">
                                        ✓ {avisoFase}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                                Asigna manualmente la fase biológica del paciente o déjala en automático por número de sesiones.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-xs">
                        <label className="text-[11px] font-black text-gray-600 uppercase tracking-wider">
                            Control de Fase:
                        </label>
                        <select
                            value={faseRoadmapManual}
                            onChange={(e) => handleCambiarFase(e.target.value)}
                            disabled={guardandoFase}
                            className="text-xs font-black bg-transparent text-gray-900 border-none outline-none cursor-pointer pr-1"
                        >
                            <option value="auto">⚡ Auto por Sesiones (Fase {calcularFaseAuto(sesiones.length)})</option>
                            <option value="1">Fase 1: {catRoadmap === 'laser' ? 'Debilitamiento Folicular (Ses. 1-3)' : catRoadmap === 'despigmentacion' ? 'Preparación & Bloqueo Pigmento (Ses. 1-3)' : catRoadmap === 'facial' ? 'Higiene Profunda & Balance (Ses. 1-2)' : 'Desintoxicación & Drenaje (Ses. 1-3)'}</option>
                            <option value="2">Fase 2: {catRoadmap === 'laser' ? 'Reducción Drástica Densidad (Ses. 4-6)' : catRoadmap === 'despigmentacion' ? 'Aclarado Activo & Renovación (Ses. 4-6)' : catRoadmap === 'facial' ? 'Renovación Tisular (Ses. 3-5)' : 'Lipo-activación & Reducción (Ses. 4-7)'}</option>
                            <option value="3">Fase 3: {catRoadmap === 'laser' ? 'Destrucción Folículos Residuales (Ses. 7-9)' : catRoadmap === 'despigmentacion' ? 'Despigmentación Profunda (Ses. 7-9)' : catRoadmap === 'facial' ? 'Redensificación & Colágeno (Ses. 6-8)' : 'Compactación & Moldeo (Ses. 8-11)'}</option>
                            <option value="4">Fase 4: {catRoadmap === 'laser' ? 'Piel de Seda Permanente (Ses. 10-12+)' : catRoadmap === 'despigmentacion' ? 'Blindaje Antimanchas (Ses. 10-12+)' : catRoadmap === 'facial' ? 'Blindaje & Efecto Glow (Ses. 9-10+)' : 'Tonificación & Mantenimiento (Ses. 12-14+)'}</option>
                        </select>
                    </div>
                </div>

                {sesiones.length === 0 ? (
                    <div className="py-14 text-center space-y-3">
                        <Clipboard size={36} className="mx-auto text-gray-200" />
                        <div>
                            <p className="text-gray-600 text-sm font-black">Aún no hay sesiones registradas en este tratamiento</p>
                            <p className="text-gray-400 text-xs mt-0.5">Registra la primera sesión con medidas, protocolo y fotografías.</p>
                        </div>
                        <Button variant="primary" size="sm" icon={Plus} onClick={onNuevaSesion}>
                            Iniciar Sesión #1 Ahora
                        </Button>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {[...sesiones].reverse().map((sesion, i) => {
                            const realIndex = sesiones.length - 1 - i;
                            const num = realIndex + 1;
                            const prevSesion = realIndex > 0 ? sesiones[realIndex - 1] : null;
                            const fecha = new Date(sesion.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
                            const isOpen = expanded === sesion.id;

                            const pesoDiff = (esCorporal && prevSesion?.medidas?.peso && sesion.medidas?.peso)
                                ? (parseFloat(sesion.medidas.peso) - parseFloat(prevSesion.medidas.peso)).toFixed(1)
                                : null;
                            const cinturaDiff = (esCorporal && prevSesion?.medidas?.cintura && sesion.medidas?.cintura)
                                ? (parseFloat(sesion.medidas.cintura) - parseFloat(prevSesion.medidas.cintura)).toFixed(1)
                                : null;

                            return (
                                <div key={sesion.id}>
                                    <button
                                        type="button"
                                        onClick={() => setExpanded(isOpen ? null : sesion.id)}
                                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/80 transition-colors text-left cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <span className={`text-xs font-black px-2.5 py-1 rounded-xl shrink-0 ${esCorporal ? 'bg-turquesa/15 text-acero' : 'bg-purple-50 text-purple-700'}`}>
                                                Sesión #{num}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-acero">{fecha}</p>
                                                <p className="text-xs text-gray-500 font-medium truncate max-w-md">
                                                    {sesion.protocolo || 'Sin protocolo registrado'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {esCorporal && sesion.medidas?.peso && (
                                                <span className="text-xs font-black text-acero bg-gray-100 px-2.5 py-1 rounded-lg">
                                                    {sesion.medidas.peso} kg
                                                    {pesoDiff && Number(pesoDiff) !== 0 && (
                                                        <span className={`ml-1 ${Number(pesoDiff) < 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                            ({Number(pesoDiff) > 0 ? `+${pesoDiff}` : pesoDiff})
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                            {esCorporal && sesion.medidas?.cintura && (
                                                <span className="hidden sm:inline-block text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
                                                    Cintura: {sesion.medidas.cintura} cm
                                                    {cinturaDiff && Number(cinturaDiff) !== 0 && (
                                                        <span className={`ml-1 font-black ${Number(cinturaDiff) < 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                            ({Number(cinturaDiff) > 0 ? `+${cinturaDiff}` : cinturaDiff})
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                            {sesion.fotosSesion?.length > 0 && (
                                                <span className="text-xs text-turquesa font-bold bg-turquesa/10 px-2 py-1 rounded-lg flex items-center gap-1">
                                                    <Camera size={12} /> {sesion.fotosSesion.length}
                                                </span>
                                            )}
                                            {isOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                                        </div>
                                    </button>

                                    {isOpen && (
                                        <div className="px-5 pb-5 pt-2 space-y-4 bg-gray-50/50 border-t border-gray-100">
                                            {esCorporal && Object.keys(sesion.medidas || {}).some(k => k !== 'imc' && sesion.medidas[k]) && (
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Medidas Registradas</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {MEDIDAS_CORPORALES.filter(c => sesion.medidas?.[c.key]).map(c => (
                                                            <span key={c.key} className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-xl font-bold text-acero shadow-2xs">
                                                                {c.label}: <span className="text-turquesa font-black">{sesion.medidas[c.key]} {c.unit}</span>
                                                            </span>
                                                        ))}
                                                        {sesion.medidas?.imc && (
                                                            <span className={`text-xs px-3 py-1.5 rounded-xl font-black border ${parseFloat(sesion.medidas.imc) > 25 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                                                                IMC: {sesion.medidas.imc}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {!esCorporal && sesion.medidas && Object.keys(sesion.medidas).length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Evaluación Facial</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {CAMPOS_FACIALES.filter(c => sesion.medidas?.[c.key]).map(c => (
                                                            <span key={c.key} className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-xl font-bold text-acero">
                                                                {c.label}: <span className="text-purple-600">{sesion.medidas[c.key]}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {sesion.protocolo && (
                                                    <div className="bg-white p-3 rounded-xl border border-gray-100">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Protocolo Aplicado</p>
                                                        <p className="text-xs font-medium text-gray-700">{sesion.protocolo}</p>
                                                    </div>
                                                )}
                                                {sesion.notas && (
                                                    <div className="bg-white p-3 rounded-xl border border-gray-100">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Observaciones Post-Sesión</p>
                                                        <p className="text-xs font-medium text-gray-700">{sesion.notas}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {sesion.fotosSesion?.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Fotografías ({sesion.fotosSesion.length})</p>
                                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                                        {sesion.fotosSesion.map((foto, fi) => (
                                                            <a key={fi} href={foto.url} target="_blank" rel="noreferrer" className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200">
                                                                <img src={foto.url} alt={`Foto ${fi + 1}`} className="w-full h-full object-cover" />
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {sesion.consentimientos?.length > 0 && (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase">Documentos:</span>
                                                    {sesion.consentimientos.map(c => (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            onClick={() => onDownloadConsentPDF(c)}
                                                            className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-lg border cursor-pointer ${
                                                                c.signed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                                            }`}
                                                        >
                                                            {c.signed ? <CheckCircle size={12} /> : <AlertCircle size={12} />} {c.name} <Download size={12} />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex justify-end pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => onEliminarSesion(sesion)}
                                                    className="text-xs text-red-400 hover:text-red-600 font-bold flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Trash2 size={13} /> Eliminar sesión
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── MAIN COMPONENT: EXPEDIENTE CLÍNICO UNIFICADO ────────────────────────────
export default function ExpedienteClinico() {
    const { pacienteId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const authCtx = useAuth() || {};
    const role = authCtx.role || authCtx.userRole || '';
    const userRole = role;

    const [paciente, setPaciente] = useState(null);
    const [loadingPaciente, setLoadingPaciente] = useState(true);
    const [tratamientos, setTratamientos] = useState([]);
    const [tratamientoActivo, setTratamientoActivo] = useState(null);
    const [sesiones, setSesiones] = useState([]);
    const [loadingSesiones, setLoadingSesiones] = useState(false);
    const [showNuevaSesion, setShowNuevaSesion] = useState(() => searchParams.get('nuevaSesion') === '1');
    const [citaIdPreseleccionada] = useState(() => searchParams.get('citaId') || '');
    const [showNuevoTratamiento, setShowNuevoTratamiento] = useState(false);
    const [nuevoTrat, setNuevoTrat] = useState({ tipo: 'Corporal', nombre: '', numSesiones: '10' });
    const [creandoTrat, setCreandoTrat] = useState(false);
    const [sesionToDelete, setSesionToDelete] = useState(null);

    // ── Navegación por Pestañas (Cero Scroll Innecesario) ───────────────────
    const [activeTab, setActiveTab] = useState('sesiones'); // 'sesiones' | 'evolucion' | 'galeria' | 'apoyo' | 'ficha'

    // ── Datos de Seguimiento, Trackers y Citas ──────────────────────────────
    const [seguimientos, setSeguimientos] = useState([]);
    const [loadingSeg, setLoadingSeg] = useState(false);
    const [riesgoMode, setRiesgoMode] = useState('sesion');
    const [showRiesgoModal, setShowRiesgoModal] = useState(false);
    const [trackersDiarios, setTrackersDiarios] = useState([]);
    const [citasHistorial, setCitasHistorial] = useState([]);

    // ── Galería y Comparador Antes / Después ────────────────────────────────
    const [galeria, setGaleria] = useState([]);
    const [uploadingGaleria, setUploadingGaleria] = useState(false);
    const galeriaRef = useRef(null);
    const [fotoAntesIdx, setFotoAntesIdx] = useState(0);
    const [fotoDespuesIdx, setFotoDespuesIdx] = useState(1);

    // ── Apoyo en Casa ─────────────────────────────────────────────────────────
    const [apoyoList, setApoyoList] = useState([]);
    const [savingApoyo, setSavingApoyo] = useState(false);
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [apoyoPersonalizado, setApoyoPersonalizado] = useState('');
    const [frecuenciaPersonalizada, setFrecuenciaPersonalizada] = useState('Diario');

    // ── Antecedentes Médicos Completos, Alertas y Ficha Clínica ────────────
    const [isEditingAntecedentes, setIsEditingAntecedentes] = useState(false);
    const [guardandoFaseGlobal, setGuardandoFaseGlobal] = useState(false);
    const [avisoFaseGlobal, setAvisoFaseGlobal] = useState(null);
    const [selectedConsentFicha, setSelectedConsentFicha] = useState('');

    const [editAntecedentes, setEditAntecedentes] = useState({
        // Antecedentes Patológicos & Alertas de Seguridad
        alergias: '',
        condicionesMedicas: '',
        medicamentosActuales: '',
        cirugiasPrevias: '',
        implantesMetalicos: 'No',
        cicatrizacionQueloide: 'No',
        problemasCirculatorios: 'No',
        // Salud Femenina & Gineco-Obstétrica
        embarazoLactancia: 'No',
        metodoAnticonceptivo: '',
        // Hábitos & Estilo de Vida
        consumoAguaLitros: '1.5',
        actividadFisica: 'Sedentario',
        tabaquismo: 'No',
        protectorSolar: 'Diario',
        // Valoración Estética / Cutánea Inicial
        fototipoCutaneo: 'IV (Morena clara)',
        biotipoCutaneo: 'Mixta',
        zonasInteres: '',
        expectativasPaciente: '',
        // Datos Demográficos & Emergencia
        telefono: '',
        fechaNacimiento: '',
        ocupacion: '',
        contactoEmergenciaNombre: '',
        contactoEmergenciaTelefono: '',
        tipoTratamiento: ''
    });

    const handleOpenEditAntecedentes = () => {
        setEditAntecedentes({
            alergias: paciente?.alergias || '',
            condicionesMedicas: paciente?.condicionesMedicas || '',
            medicamentosActuales: paciente?.medicamentosActuales || '',
            cirugiasPrevias: paciente?.cirugiasPrevias || '',
            implantesMetalicos: paciente?.implantesMetalicos || 'No',
            cicatrizacionQueloide: paciente?.cicatrizacionQueloide || 'No',
            problemasCirculatorios: paciente?.problemasCirculatorios || 'No',
            embarazoLactancia: paciente?.embarazoLactancia || 'No',
            metodoAnticonceptivo: paciente?.metodoAnticonceptivo || '',
            consumoAguaLitros: paciente?.consumoAguaLitros || '1.5',
            actividadFisica: paciente?.actividadFisica || 'Sedentario',
            tabaquismo: paciente?.tabaquismo || 'No',
            protectorSolar: paciente?.protectorSolar || 'Diario',
            fototipoCutaneo: paciente?.fototipoCutaneo || 'IV (Morena clara)',
            biotipoCutaneo: paciente?.biotipoCutaneo || 'Mixta',
            zonasInteres: paciente?.zonasInteres || '',
            expectativasPaciente: paciente?.expectativasPaciente || '',
            telefono: paciente?.telefono || '',
            fechaNacimiento: paciente?.fechaNacimiento || '',
            ocupacion: paciente?.ocupacion || '',
            contactoEmergenciaNombre: paciente?.contactoEmergenciaNombre || '',
            contactoEmergenciaTelefono: paciente?.contactoEmergenciaTelefono || '',
            tipoTratamiento: paciente?.tipoTratamiento || ''
        });
        setIsEditingAntecedentes(true);
    };

    const handleSaveAntecedentes = async () => {
        const targetId = paciente?.id || pacienteId;
        if (!targetId) return;
        try {
            await updatePaciente(targetId, editAntecedentes);
            setPaciente(prev => ({ ...prev, ...editAntecedentes }));
            setIsEditingAntecedentes(false);
        } catch (e) {
            console.error('Error al guardar antecedentes:', e);
            alert('Error al guardar ficha médica: ' + e.message);
        }
    };

    const calcularEdad = (fechaNac) => {
        if (!fechaNac) return null;
        try {
            const diff = Date.now() - new Date(fechaNac).getTime();
            const ageDate = new Date(diff);
            return Math.abs(ageDate.getUTCFullYear() - 1970);
        } catch (e) { return null; }
    };

    const handleCambiarFaseRoadmapDirecto = async (nuevaFase) => {
        if (!tratamientoActivo) {
            alert('Selecciona o crea un tratamiento primero.');
            return;
        }
        setGuardandoFaseGlobal(true);
        try {
            await actualizarFaseRoadmapTratamiento(tratamientoActivo.id, nuevaFase);
            const updated = { ...tratamientoActivo, faseRoadmapManual: nuevaFase };
            setTratamientoActivo(updated);
            setTratamientos(prev => prev.map(t => t.id === updated.id ? updated : t));
            const texto = nuevaFase === 'auto'
                ? `Automático (Fase ${calcularFaseAuto(sesiones.length)})`
                : `Fase ${nuevaFase}`;
            setAvisoFaseGlobal(`Fase sincronizada: ${texto}`);
            setTimeout(() => setAvisoFaseGlobal(null), 3500);
        } catch (e) {
            console.error('Error al guardar fase:', e);
            alert('Error al actualizar fase: ' + e.message);
        } finally {
            setGuardandoFaseGlobal(false);
        }
    };

    const categoriaRoadmapActivo = useMemo(() => {
        const txt = `${tratamientoActivo?.tipo || ''} ${tratamientoActivo?.nombre || ''}`.toLowerCase();
        if (txt.includes('laser') || txt.includes('láser') || txt.includes('depil')) return 'laser';
        if (txt.includes('despigment') || txt.includes('aclarad') || txt.includes('mancha') || txt.includes('melasma')) return 'despigmentacion';
        if (txt.includes('facial') || txt.includes('dermapen') || txt.includes('peeling') || txt.includes('limpieza') || txt.includes('hidra')) return 'facial';
        return 'corporal';
    }, [tratamientoActivo]);

    const calcularFaseAuto = (num) => {
        if (categoriaRoadmapActivo === 'corporal') {
            if (num >= 12) return 4;
            if (num >= 8) return 3;
            if (num >= 4) return 2;
            return 1;
        }
        if (categoriaRoadmapActivo === 'facial') {
            if (num >= 9) return 4;
            if (num >= 6) return 3;
            if (num >= 3) return 2;
            return 1;
        }
        if (num >= 10) return 4;
        if (num >= 7) return 3;
        if (num >= 4) return 2;
        return 1;
    };

    const faseActualGlobal = useMemo(() => {
        if (tratamientoActivo?.faseRoadmapManual && tratamientoActivo.faseRoadmapManual !== 'auto') {
            return Number(tratamientoActivo.faseRoadmapManual) || 1;
        }
        return calcularFaseAuto(sesiones.length);
    }, [tratamientoActivo?.faseRoadmapManual, sesiones.length, categoriaRoadmapActivo]);

    const esCorporal = tratamientoActivo?.tipo === 'Corporal' || tratamientoActivo?.tipo === 'Paquete Reductivo';
    const fasesRoadmapEspecialista = useMemo(() => {
        if (categoriaRoadmapActivo === 'laser') {
            return [
                { num: 1, nombre: 'Debilitamiento del Folículo Anágeno', sub: 'Sesiones 1-3', desc: 'Ataque térmico selectivo al bulbo piloso activo.' },
                { num: 2, nombre: 'Reducción Drástica de Densidad', sub: 'Sesiones 4-6', desc: 'Disminución >50% del vello y eliminación de foliculitis.' },
                { num: 3, nombre: 'Destrucción de Folículos Residuales', sub: 'Sesiones 7-9', desc: 'Erradicación de vello fino y folículos de ciclo lento.' },
                { num: 4, nombre: 'Piel de Seda & Consolidación', sub: 'Sesiones 10-12+', desc: 'Cierre de poros y resultado permanente.' }
            ];
        }
        if (categoriaRoadmapActivo === 'despigmentacion') {
            return [
                { num: 1, nombre: 'Preparación & Bloqueo de Pigmento', sub: 'Sesiones 1-3', desc: 'Renovación epidérmica e inhibición de tirosinasa.' },
                { num: 2, nombre: 'Aclarado Activo & Renovación', sub: 'Sesiones 4-6', desc: 'Degradación progresiva de cúmulos de melanina.' },
                { num: 3, nombre: 'Despigmentación Profunda', sub: 'Sesiones 7-9', desc: 'Unificación de tono dérmico y luminosidad.' },
                { num: 4, nombre: 'Blindaje Antimanchas', sub: 'Sesiones 10-12+', desc: 'Estabilización celular y memoria despigmentante.' }
            ];
        }
        if (categoriaRoadmapActivo === 'facial') {
            return [
                { num: 1, nombre: 'Higiene Profunda & Balance Cutáneo', sub: 'Sesiones 1-2', desc: 'Limpieza profunda, regulación del pH y oxigenación.' },
                { num: 2, nombre: 'Renovación Tisular & Micro-estimulación', sub: 'Sesiones 3-5', desc: 'Estimulación de capa basal y oxigenación celular.' },
                { num: 3, nombre: 'Redensificación & Síntesis de Colágeno', sub: 'Sesiones 6-8', desc: 'Reactivación de fibroblastos y firmeza dérmica.' },
                { num: 4, nombre: 'Blindaje Antioxidante & Efecto Glow', sub: 'Sesiones 9-10+', desc: 'Efecto glow duradero y protección antioxidante.' }
            ];
        }
        return [
            { num: 1, nombre: 'Desintoxicación Linfática & Drenaje', sub: 'Sesiones 1-3', desc: 'Desintoxicación del tejido linfático y circulatorio.' },
            { num: 2, nombre: 'Lipo-activación & Reducción Intensiva', sub: 'Sesiones 4-7', desc: 'Movilización adiposa con aparatología intensiva.' },
            { num: 3, nombre: 'Compactación & Moldeo de Silueta', sub: 'Sesiones 8-11', desc: 'Compactación dérmica y perfilado de silueta.' },
            { num: 4, nombre: 'Tonificación & Mantenimiento Escultórico', sub: 'Sesiones 12-14+', desc: 'Fijación de resultados metabólicos y mantenimiento.' }
        ];
    }, [categoriaRoadmapActivo]);

    // Cargar paciente reactivamente (onSnapshot), tratamientos, citas y galería usando siempre el realId
    useEffect(() => {
        if (!pacienteId) return;
        let isMounted = true;
        let unsubDoc = () => {};

        (async () => {
            setLoadingPaciente(true);
            const p = await getPacienteById(pacienteId);
            if (!isMounted) return;

            if (p) {
                const realId = p.id;
                setPaciente({ ...p, id: realId });
                if (p.gallery) setGaleria(p.gallery);

                // Listener en tiempo real del documento del paciente para reflejar
                // instantáneamente cualquier cambio de nombre o datos hecho en Admin/Recepción
                unsubDoc = onSnapshot(doc(db, 'pacientes', realId), (snap) => {
                    if (snap.exists() && isMounted) {
                        const fresh = { id: snap.id, ...snap.data() };
                        setPaciente(fresh);
                        if (fresh.gallery) setGaleria(fresh.gallery);
                    }
                });

                if (!p.especialistaAsignado) {
                    const user = auth.currentUser;
                    if (user) {
                        try {
                            const staff = await getStaffDocByUid(user.uid, user.email, user.displayName);
                            if (staff && isMounted) {
                                await updatePaciente(realId, {
                                    especialistaAsignado: staff.id,
                                    especialistaAsignadoNombre: staff.nombre
                                });
                            }
                        } catch (e) { console.error(e); }
                    }
                }

                // Cargar tratamientos utilizando SIEMPRE el realId del paciente
                getTratamientosPaciente(realId, p.nombre, p.telefono).then(lista => {
                    if (!isMounted) return;
                    setTratamientos(lista);
                    if (lista.length > 0) {
                        setTratamientoActivo(lista[0]);
                    } else if (searchParams.get('nuevaSesion') === '1') {
                        setShowNuevoTratamiento(true);
                    }
                });

                // Cargar seguimientos usando el realId del paciente
                setLoadingSeg(true);
                getSeguimientosPaciente(realId).then(s => {
                    if (!isMounted) return;
                    setSeguimientos(s);
                    setLoadingSeg(false);
                }).catch(() => { if (isMounted) setLoadingSeg(false); });

                // Cargar citas usando el realId del paciente
                getCitasByPaciente(realId).then(c => {
                    if (isMounted) setCitasHistorial(c || []);
                }).catch(() => {});
            }
            setLoadingPaciente(false);
        })();

        return () => {
            isMounted = false;
            unsubDoc();
        };
    }, [pacienteId]);

    // Listener de trackers diarios del paciente
    useEffect(() => {
        const targetId = paciente?.id || pacienteId;
        if (!targetId) return;
        let unsub = () => {};
        import('../../services/seguimientoService').then(({ onDailyTrackersChange }) => {
            unsub = onDailyTrackersChange(targetId, (trackers) => {
                setTrackersDiarios(trackers || []);
            });
        });
        return () => unsub();
    }, [paciente?.id, pacienteId]);

    // Cargar sesiones cuando cambia el tratamiento activo
    useEffect(() => {
        if (!tratamientoActivo) return;
        setLoadingSesiones(true);
        getSesionesTratamiento(tratamientoActivo.id).then(lista => {
            setSesiones(lista || []);
            setLoadingSesiones(false);
        });
        getApoyoEnCasa(tratamientoActivo.id).then(cuidados => {
            setApoyoList(cuidados || []);
        });
    }, [tratamientoActivo]);

    // Fotos unificadas (galería general + fotos de todas las sesiones del tratamiento activo)
    const todasLasFotos = useMemo(() => {
        const list = [];
        const seenUrls = new Set();
        sesiones.forEach((s, idx) => {
            const fechaLabel = new Date(s.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
            (s.fotosSesion || []).forEach(f => {
                if (f.url && !seenUrls.has(f.url)) {
                    seenUrls.add(f.url);
                    list.push({
                        id: f.storagePath || f.url,
                        url: f.url,
                        path: f.storagePath,
                        date: fechaLabel,
                        etiqueta: `Sesión #${idx + 1} (${fechaLabel})`,
                        fromSesion: true
                    });
                }
            });
        });
        (galeria || []).forEach(g => {
            if (g.url && !seenUrls.has(g.url)) {
                seenUrls.add(g.url);
                list.push({
                    ...g,
                    etiqueta: g.date ? `Galería (${g.date})` : 'Galería'
                });
            }
        });
        return list;
    }, [sesiones, galeria]);

    useEffect(() => {
        if (todasLasFotos.length >= 2) {
            setFotoAntesIdx(0);
            setFotoDespuesIdx(todasLasFotos.length - 1);
        }
    }, [todasLasFotos.length]);

    const trackersDelTratamiento = useMemo(() => {
        if (!tratamientoActivo || (!tratamientoActivo.creadoEn && !tratamientoActivo.fechaInicio && !tratamientoActivo.createdAt)) return trackersDiarios;
        let fechaBase = tratamientoActivo.creadoEn || tratamientoActivo.fechaInicio || tratamientoActivo.createdAt;
        const inicioTrat = fechaBase.seconds ? new Date(fechaBase.seconds * 1000) : new Date(fechaBase);
        inicioTrat.setHours(0, 0, 0, 0);
        return trackersDiarios.filter(t => new Date(t.fecha + 'T12:00:00') >= inicioTrat);
    }, [trackersDiarios, tratamientoActivo]);

    const riesgoHorasData = useMemo(() => {
        if (!trackersDelTratamiento || trackersDelTratamiento.length === 0) return [];
        let trks = trackersDelTratamiento;
        if (riesgoMode === 'sesion' && sesiones.length > 0) {
            const lastSesion = sesiones[sesiones.length - 1];
            let lsStr = lastSesion.fecha;
            if (lastSesion.createdAt) {
                lsStr = lastSesion.createdAt.seconds
                    ? new Date(lastSesion.createdAt.seconds * 1000).toISOString()
                    : (lastSesion.createdAt.toISOString ? lastSesion.createdAt.toISOString() : lastSesion.fecha);
            }
            const lastSesionDate = new Date(lsStr);
            lastSesionDate.setHours(0, 0, 0, 0);
            trks = trks.filter(t => new Date(t.fecha + 'T12:00:00') >= lastSesionDate);
        }
        const horasMap = {};
        for (let i = 0; i < 24; i++) horasMap[i] = 0;
        trks.forEach(t => {
            const alimentos = t.data?.alimentos || t.alimentos || t.registros || [];
            if (t.tipo === 'alimentacion' && alimentos.length > 0) {
                alimentos.forEach(a => {
                    if (a.timestamp) {
                        const d = new Date(a.timestamp.seconds ? a.timestamp.seconds * 1000 : a.timestamp);
                        if (!isNaN(d.getTime())) {
                            horasMap[d.getHours()] += (Number(a.calorias) || 0);
                        }
                    }
                });
            }
        });
        const data = [];
        for (let i = 0; i < 24; i++) {
            const label = i === 0 ? '12am' : i < 12 ? i + 'am' : i === 12 ? '12pm' : (i - 12) + 'pm';
            data.push({ hora: i, label, calorias: horasMap[i] });
        }
        const firstIndex = data.findIndex(d => d.calorias > 0);
        const lastIndex = data.findLastIndex(d => d.calorias > 0);
        if (firstIndex === -1) return [];
        return data.slice(Math.max(0, firstIndex - 1), Math.min(23, lastIndex + 1) + 1);
    }, [trackersDelTratamiento, sesiones, riesgoMode]);

    const nutricionData = useMemo(() => {
        return trackersDelTratamiento
            .filter(t => t.tipo === 'alimentacion')
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
            .map(t => ({
                fecha: new Date(t.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
                calorias: t.data?.totalCalorias ?? t.totalCalorias ?? 0,
                meta: t.data?.metaCalorias ?? t.metaCalorias ?? 0
            }));
    }, [trackersDelTratamiento]);

    // Métricas resumen de evolución física (Sesión 1 vs Última Sesión)
    const resumenEvolucion = useMemo(() => {
        if (!sesiones || sesiones.length === 0) return null;
        const primera = sesiones[0]?.medidas || {};
        const ultima = sesiones[sesiones.length - 1]?.medidas || {};
        const calcDelta = (key) => {
            const v1 = parseFloat(primera[key]);
            const v2 = parseFloat(ultima[key]);
            if (isNaN(v1) || isNaN(v2) || v1 === 0 || v2 === 0) return null;
            return (v2 - v1).toFixed(1);
        };
        return {
            pesoInicial: primera.peso || null,
            pesoActual: ultima.peso || null,
            deltaPeso: calcDelta('peso'),
            deltaCintura: calcDelta('cintura'),
            deltaAbdomen: calcDelta('abdomen'),
            deltaCadera: calcDelta('cadera'),
            imcActual: ultima.imc || null
        };
    }, [sesiones]);

    const handleCrearTratamiento = async () => {
        if (!nuevoTrat.nombre.trim()) { alert('Escribe un nombre para el tratamiento.'); return; }
        setCreandoTrat(true);
        try {
            const user = auth.currentUser;
            let staff = null;
            if (user) staff = await getStaffDocByUid(user.uid, user.email, user.displayName).catch(() => null);
            const targetId = paciente?.id || pacienteId;
            const targetNombre = paciente?.nombre || '';
            const id = await crearTratamiento(targetId, {
                tipo: nuevoTrat.tipo,
                nombre: nuevoTrat.nombre,
                numSesionesTotal: parseInt(nuevoTrat.numSesiones) || 0,
                especialistaId: staff?.id || user?.uid || '',
                especialistaNombre: staff?.nombre || user?.displayName || '',
                pacienteNombre: targetNombre,
                pacienteTelefono: paciente?.telefono || '',
            });
            const nuevo = {
                id,
                pacienteId: targetId,
                pacienteNombre: targetNombre,
                tipo: nuevoTrat.tipo,
                nombre: nuevoTrat.nombre,
                numSesionesTotal: parseInt(nuevoTrat.numSesiones) || 0,
                numSesiones: parseInt(nuevoTrat.numSesiones) || 0,
                activo: true,
                fechaInicio: new Date().toISOString(),
            };

            // Vincular de inmediato al plan de financiamiento con el nombre y pacienteId unificados
            (async () => {
                if (targetNombre) {
                    try {
                        const planesExistentes = await getPlanes();
                        const nombreTratNorm = (nuevoTrat.nombre || '').trim().toLowerCase();
                        const yaExiste = planesExistentes.some(p => {
                            const pPacNorm = (p.paciente || p.pacienteNombre || '').trim().toLowerCase();
                            const pObjNorm = (p.objetivo || '').trim().toLowerCase();
                            const mismoPaciente = (p.pacienteId && p.pacienteId === targetId) || pPacNorm === targetNombre.trim().toLowerCase();
                            const mismoObjetivo = pObjNorm === nombreTratNorm || pObjNorm.includes(nombreTratNorm) || nombreTratNorm.includes(pObjNorm);
                            return mismoPaciente && mismoObjetivo;
                        });

                        if (!yaExiste) {
                            await createPlan({
                                paciente: targetNombre,
                                pacienteNombre: targetNombre,
                                pacienteId: targetId,
                                objetivo: nuevoTrat.nombre,
                                meta: 0,
                                acumulado: 0,
                                anticipo: 0,
                                costoPorSesion: 0
                            });
                        }
                    } catch (err) {
                        console.error('Error al verificar/crear plan auto:', err);
                    }
                }
            })();

            setTratamientos(prev => [nuevo, ...prev]);
            setTratamientoActivo(nuevo);
            setSesiones([]);
            setNuevoTrat({ tipo: 'Corporal', nombre: '', numSesiones: '10' });
            setShowNuevoTratamiento(false);
        } catch (e) {
            console.error(e);
            alert('Error al crear el tratamiento.');
        } finally {
            setCreandoTrat(false);
        }
    };

    const handleSesionGuardada = () => {
        setShowNuevaSesion(false);
        if (searchParams.get('nuevaSesion')) {
            setSearchParams({});
        }
        getSesionesTratamiento(tratamientoActivo.id).then(setSesiones);
        getCitasByPaciente(pacienteId).then(c => setCitasHistorial(c || [])).catch(() => {});
    };

    const confirmEliminarSesion = async () => {
        if (!sesionToDelete) return;
        try {
            await eliminarSesion(sesionToDelete.id, sesionToDelete.fotosSesion || []);
            setSesiones(prev => prev.filter(s => s.id !== sesionToDelete.id));
            setSesionToDelete(null);
        } catch (e) {
            console.error(e);
            alert('Error al eliminar la sesión.');
            setSesionToDelete(null);
        }
    };


    // ── Apoyo en Casa handlers ────────────────────────────────────────────────
    const handleTogglePresetApoyo = (cuidado) => {
        setApoyoList(prev => {
            const exists = prev.find(c => c.id === cuidado.id);
            return exists ? prev.filter(c => c.id !== cuidado.id) : [...prev, cuidado];
        });
    };
    const handleAddPersonalizado = () => {
        if (!apoyoPersonalizado.trim()) return;
        const nuevo = { id: `custom_${Date.now()}`, texto: apoyoPersonalizado.trim(), label: apoyoPersonalizado.trim(), frecuencia: frecuenciaPersonalizada };
        setApoyoList(prev => [...prev, nuevo]);
        setApoyoPersonalizado('');
    };
    const handleRemoveApoyo = (id) => setApoyoList(prev => prev.filter(c => c.id !== id));

    const handleDownloadPDF = async (c) => {
        generarPDFConsentimientoUniversal(jsPDF, c, paciente, auth.currentUser?.displayName, logoData);
    };

    // Exportar Resumen Clínico Completo en PDF (Para Paciente, Especialista o Admin)
    const handleExportarResumenClinicoPDF = async () => {
        try {
            const PDFConstructor = typeof jsPDF === 'function' ? jsPDF : (jsPDF.jsPDF || jsPDF.default);
            const doc = new PDFConstructor();
            try {
                if (typeof logoData !== 'undefined' && logoData) {
                    const imgProps = doc.getImageProperties(logoData);
                    const aspectRatio = imgProps.width / imgProps.height;
                    doc.addImage(logoData, 'PNG', 16, 10, 42, 42 / aspectRatio);
                }
            } catch (e) {}

            doc.setTextColor(11, 34, 57);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('EXPEDIENTE Y RESUMEN DE EVOLUCIÓN CLÍNICA', 64, 22);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`Paciente: ${paciente?.nombre || '—'}   |   Tel: ${paciente?.telefono || '—'}   |   Fecha: ${new Date().toLocaleDateString('es-MX')}`, 60, 29);
            doc.text(`Tratamiento Activo: ${tratamientoActivo?.nombre || 'General'} (${sesiones.length} sesiones registradas)`, 60, 35);
            doc.text(`Alergias: ${paciente?.alergias || 'Ninguna'}   |   Condiciones: ${paciente?.condicionesMedicas || 'Ninguna'}`, 60, 41);

            doc.setDrawColor(32, 178, 170);
            doc.line(20, 46, 190, 46);

            let y = 55;
            if (resumenEvolucion) {
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(11, 34, 57);
                doc.text('RESUMEN DE AVANCE FÍSICO (SESIÓN #1 VS. ACTUAL):', 20, y);
                y += 7;
                doc.setFont('helvetica', 'normal');
                doc.text(
                    `Peso Inicial: ${resumenEvolucion.pesoInicial || '—'} kg   |   Peso Actual: ${resumenEvolucion.pesoActual || '—'} kg   |   Diferencia Peso: ${resumenEvolucion.deltaPeso || '0'} kg`,
                    20, y
                );
                y += 6;
                doc.text(
                    `Δ Cintura: ${resumenEvolucion.deltaCintura || '0'} cm   |   Δ Abdomen: ${resumenEvolucion.deltaAbdomen || '0'} cm   |   Δ Cadera: ${resumenEvolucion.deltaCadera || '0'} cm`,
                    20, y
                );
                y += 10;
            }

            doc.setFont('helvetica', 'bold');
            doc.text('HISTORIAL DE SESIONES:', 20, y);
            y += 7;
            doc.setFontSize(9);

            sesiones.forEach((s, idx) => {
                if (y > 265) {
                    doc.addPage();
                    y = 20;
                }
                const f = new Date(s.fecha).toLocaleDateString('es-MX');
                const m = s.medidas || {};
                doc.setFont('helvetica', 'bold');
                doc.text(
                    `Sesión #${idx + 1} (${f}) — Peso: ${m.peso || '—'} kg | Cintura: ${m.cintura || '—'} cm | Abdomen: ${m.abdomen || '—'} cm | Cadera: ${m.cadera || '—'} cm`,
                    20, y
                );
                y += 5;
                doc.setFont('helvetica', 'normal');
                const protLines = doc.splitTextToSize(`Protocolo: ${s.protocolo || '—'}${s.notas ? ' | Notas: ' + s.notas : ''}`, 170);
                doc.text(protLines, 20, y);
                y += (protLines.length * 4.5) + 4;
            });

            await guardarPdfNativo(doc, `Expediente_Clinico_${(paciente?.nombre || 'Paciente').replace(/\s+/g, '_')}.pdf`, 'Expediente Clínico ALFRA');
        } catch (err) {
            console.error(err);
            alert('Error al exportar el resumen clínico PDF.');
        }
    };

    const handleSaveApoyo = async () => {
        if (!pacienteId || !tratamientoActivo) return;
        setSavingApoyo(true);
        try {
            await saveApoyoEnCasa(tratamientoActivo.id, pacienteId, apoyoList);
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 3000);
        } catch (e) { alert('Error al guardar.'); }
        finally { setSavingApoyo(false); }
    };

    const handleGaleriaUpload = async (e) => {
        const files = Array.from(e.target.files);
        const targetId = paciente?.id || pacienteId;
        if (!files.length || !targetId) return;
        setUploadingGaleria(true);
        try {
            const newFotos = [];
            for (const file of files) {
                const path = `galeria_pacientes/${targetId}/${Date.now()}_${file.name}`;
                const storageRef = ref(storage, path);
                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);
                newFotos.push({ id: `g_${Date.now()}_${Math.random()}`, url, path, date: new Date().toLocaleDateString('es-MX') });
            }
            const updated = [...(galeria || []), ...newFotos];
            setGaleria(updated);
            await updatePaciente(targetId, { gallery: updated });
        } catch (err) { console.error('Error galería:', err); }
        finally { setUploadingGaleria(false); }
    };

    const handleDeleteGaleriaPhoto = async (foto) => {
        if (!window.confirm('¿Eliminar esta foto de la galería?')) return;
        const targetId = paciente?.id || pacienteId;
        if (!targetId) return;
        try {
            if (foto.path) await deleteObject(ref(storage, foto.path)).catch(() => {});
            const updated = galeria.filter(f => f.id !== foto.id);
            setGaleria(updated);
            await updatePaciente(targetId, { gallery: updated });
        } catch (err) { console.error(err); }
    };

    // Cálculo de edad y alertas médicas
    const edadPaciente = useMemo(() => {
        if (!paciente?.fechaNacimiento) return null;
        const birth = new Date(paciente.fechaNacimiento);
        if (isNaN(birth.getTime())) return null;
        const diff = Date.now() - birth.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    }, [paciente?.fechaNacimiento]);

    const tieneAlertaMedica = useMemo(() => {
        const a = String(paciente?.alergias || '').trim().toLowerCase();
        const c = String(paciente?.condicionesMedicas || '').trim().toLowerCase();
        const alergiaReal = a && a !== 'ninguna' && a !== 'no' && a !== 'sin registro';
        const condicionReal = c && c !== 'ninguna' && c !== 'no' && c !== 'sin registro';
        return Boolean(alergiaReal || condicionReal);
    }, [paciente]);

    // Índice de compromiso del paciente
    const compromisoPorcentaje = useMemo(() => {
        if (!tratamientoActivo || trackersDelTratamiento.length === 0) return 0;
        const diasRegistrados = new Set(trackersDelTratamiento.map(t => t.fecha)).size;
        const inicioTrat = tratamientoActivo.createdAt?.seconds
            ? new Date(tratamientoActivo.createdAt.seconds * 1000)
            : new Date(tratamientoActivo.fechaInicio || Date.now());
        const diasDesdeInicio = Math.max(1, Math.floor((new Date() - inicioTrat) / (1000 * 60 * 60 * 24)));
        return Math.min(100, Math.round((diasRegistrados / diasDesdeInicio) * 100)) || 0;
    }, [tratamientoActivo, trackersDelTratamiento]);

    const ultimaSesionRegistrada = sesiones.length > 0 ? sesiones[sesiones.length - 1] : null;
    const totalSesionesMeta = Number(tratamientoActivo?.numSesionesTotal || tratamientoActivo?.numSesiones || 0);

    return (
        <div className="space-y-4 max-w-6xl mx-auto pb-20">
            {/* BARRA SUPERIOR DE NAVEGACIÓN Y ACCIONES RÁPIDAS */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)} icon={ArrowLeft} className="px-3 border border-gray-200 bg-white shadow-2xs">
                        Volver
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-acero uppercase tracking-tight">Expediente Clínico Unificado</h2>
                            <span className="text-[10px] font-black uppercase bg-turquesa/10 text-turquesa px-2.5 py-0.5 rounded-full">
                                Vista {userRole || 'Clínica'}
                            </span>
                        </div>
                        <p className="text-gray-400 text-[11px] font-medium">
                            Cabina, medidas corporales, antes/después, nutrición y consentimientos en un solo lugar
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {role === 'Administrador' && (
                        <Button
                            variant="outline"
                            size="sm"
                            icon={Download}
                            onClick={handleExportarResumenClinicoPDF}
                        >
                            Resumen PDF
                        </Button>
                    )}
                    {role !== 'Especialista' && paciente?.telefono && (
                        <Button
                            variant="outline"
                            size="sm"
                            icon={Phone}
                            className="border-green-200 text-green-700 hover:bg-green-50"
                            onClick={() => abrirWhatsApp(paciente.telefono)}
                        >
                            WhatsApp
                        </Button>
                    )}
                    <Button
                        variant="primary"
                        size="sm"
                        icon={Play}
                        onClick={() => {
                            if (!tratamientoActivo && tratamientos.length === 0) {
                                setShowNuevoTratamiento(true);
                            } else {
                                setActiveTab('sesiones');
                                setShowNuevaSesion(true);
                            }
                        }}
                    >
                        ⚡ + Registrar Nueva Sesión
                    </Button>
                </div>
            </div>

            {/* HEADER CLÍNICO COMPACTO DEL PACIENTE (SIEMPRE VISIBLE ARRIBA) */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-acero p-5 text-white">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl font-black overflow-hidden shrink-0">
                                {loadingPaciente ? (
                                    <div className="w-full h-full bg-white/10 animate-pulse" />
                                ) : (paciente?.fotoPerfil || paciente?.fotoUrl) ? (
                                    <img src={paciente.fotoPerfil || paciente.fotoUrl} alt={paciente.nombre} className="w-full h-full object-cover" />
                                ) : (
                                    paciente?.nombre?.charAt(0) || '?'
                                )}
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-xl font-black tracking-tight">{paciente?.nombre || 'Cargando...'}</h1>
                                    {edadPaciente !== null && (
                                        <span className="text-xs font-bold bg-white/10 px-2.5 py-0.5 rounded-full">
                                            {edadPaciente} años
                                        </span>
                                    )}
                                    <span className="text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                        <Award size={12} /> Lealtad: {paciente?.sellosLealtad || 0}/7
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
                                    {paciente?.telefono && <span>📞 {paciente.telefono}</span>}
                                    {paciente?.especialistaAsignadoNombre && (
                                        <span>👩‍⚕️ Especialista: <strong className="text-white">{paciente.especialistaAsignadoNombre}</strong></span>
                                    )}
                                    {paciente?.tipoTratamiento && (
                                        <span>✨ Interés: <strong className="text-turquesa">{paciente.tipoTratamiento}</strong></span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* KPIs Rápidos del Tratamiento Activo */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-2xl border border-white/10">
                                <p className="text-[9px] font-black uppercase text-gray-300 tracking-wider">Sesiones</p>
                                <p className="text-lg font-black text-white">
                                    {sesiones.length}{totalSesionesMeta > 0 ? <span className="text-xs text-gray-300">/{totalSesionesMeta}</span> : ''}
                                </p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-2xl border border-white/10">
                                <p className="text-[9px] font-black uppercase text-gray-300 tracking-wider">Cambio Peso</p>
                                <p className={`text-lg font-black ${Number(resumenEvolucion?.deltaPeso) < 0 ? 'text-emerald-400' : 'text-white'}`}>
                                    {resumenEvolucion?.deltaPeso ? `${resumenEvolucion.deltaPeso} kg` : (resumenEvolucion?.pesoActual ? `${resumenEvolucion.pesoActual} kg` : '—')}
                                </p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-2xl border border-white/10">
                                <p className="text-[9px] font-black uppercase text-gray-300 tracking-wider">Δ Cintura</p>
                                <p className={`text-lg font-black ${Number(resumenEvolucion?.deltaCintura) < 0 ? 'text-turquesa' : 'text-white'}`}>
                                    {resumenEvolucion?.deltaCintura ? `${resumenEvolucion.deltaCintura} cm` : '—'}
                                </p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-2xl border border-white/10">
                                <p className="text-[9px] font-black uppercase text-gray-300 tracking-wider">Compromiso App</p>
                                <p className="text-lg font-black text-emerald-400">{compromisoPorcentaje}%</p>
                            </div>
                        </div>
                    </div>

                    {/* ALERTA MÉDICA ROJA SIEMPRE VISIBLE SI TIENE ALERGIAS O CONDICIONES */}
                    {tieneAlertaMedica && (
                        <div className="mt-4 bg-red-500/20 border border-red-400/50 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 text-red-100 text-xs">
                                <AlertTriangle size={18} className="text-red-300 shrink-0" />
                                <div>
                                    <span className="font-black uppercase tracking-wider text-red-200 mr-2">⚠️ Alerta Médica:</span>
                                    {paciente?.alergias && <span className="mr-3"><strong>Alergias:</strong> {paciente.alergias}</span>}
                                    {paciente?.condicionesMedicas && <span><strong>Condiciones:</strong> {paciente.condicionesMedicas}</span>}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveTab('ficha')}
                                className="text-[11px] font-black text-white underline shrink-0 cursor-pointer"
                            >
                                Ver Ficha Médica
                            </button>
                        </div>
                    )}
                </div>

                {/* BARRA DE SELECCIÓN DE TRATAMIENTO ACTIVO */}
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1">
                            Tratamientos del Paciente:
                        </span>
                        {tratamientos.map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => { setTratamientoActivo(t); setShowNuevaSesion(false); }}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition-all border cursor-pointer ${
                                    tratamientoActivo?.id === t.id
                                        ? 'bg-acero text-white border-acero shadow-sm'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-acero/40'
                                }`}
                            >
                                <span>{t.tipo === 'Facial' ? '✨' : t.tipo === 'Depilación Láser' ? '⚡' : t.tipo === 'Despigmentación' ? '💎' : t.tipo === 'Paquete Reductivo' ? '🔥' : '💪'}</span>
                                <span>{t.nombre}</span>
                                {(t.numSesionesTotal || t.numSesiones) > 0 && (
                                    <span className="text-[10px] opacity-80">({t.numSesionesTotal || t.numSesiones} ses.)</span>
                                )}
                            </button>
                        ))}
                        {tratamientos.length === 0 && (
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                                Sin tratamiento activo — crea uno a la derecha para registrar sesiones
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowNuevoTratamiento(!showNuevoTratamiento)}
                        className="text-xs font-black text-turquesa hover:bg-turquesa/10 px-3 py-1.5 rounded-xl border border-turquesa/30 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                        <Plus size={14} /> Nuevo Tratamiento / Paquete
                    </button>
                </div>

                {/* Formulario Inline para Crear Nuevo Tratamiento */}
                {showNuevoTratamiento && (
                    <div className="p-5 bg-turquesa/5 border-b border-turquesa/20 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-acero uppercase tracking-widest">
                                Crear Nuevo Tratamiento o Paquete Clínico
                            </h4>
                            <button type="button" onClick={() => setShowNuevoTratamiento(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Categoría</label>
                                <select
                                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold bg-white"
                                    value={nuevoTrat.tipo}
                                    onChange={e => {
                                        const tVal = e.target.value;
                                        const defSes = tVal === 'Facial' ? '8' : (tVal === 'Depilación Láser' || tVal === 'Despigmentación') ? '10' : '12';
                                        setNuevoTrat(prev => ({ ...prev, tipo: tVal, nombre: '', numSesiones: defSes }));
                                    }}
                                >
                                    <option value="Corporal">💪 Corporal (8 a 14 ses.)</option>
                                    <option value="Facial">✨ Facial (6 a 10 ses.)</option>
                                    <option value="Depilación Láser">⚡ Depilación Láser (8 a 12 ses.)</option>
                                    <option value="Despigmentación">💎 Despigmentación (8 a 12 ses.)</option>
                                    <option value="Paquete Reductivo">🔥 Paquete Reductivo</option>
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Nombre del Tratamiento / Paquete</label>
                                {nuevoTrat.tipo === 'Paquete Reductivo' ? (
                                    <select
                                        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-medium bg-white"
                                        value={nuevoTrat.nombre}
                                        onChange={e => {
                                            const pkg = e.target.value;
                                            let numSesiones = '10';
                                            if (pkg === 'Efecto Lipo Sin Cirugía') numSesiones = '15';
                                            else if (pkg === 'Reductivo Premium') numSesiones = '14';
                                            else if (pkg === 'Reductivo Body Fit') numSesiones = '12';
                                            else if (pkg === 'Reduce, Define, Reafirma!') numSesiones = '12';
                                            setNuevoTrat(prev => ({ ...prev, nombre: pkg, numSesiones }));
                                        }}
                                    >
                                        <option value="">Selecciona un paquete...</option>
                                        <option value="Efecto Lipo Sin Cirugía">Efecto Lipo Sin Cirugía (15 Sesiones)</option>
                                        <option value="Reductivo Premium">Reductivo Premium (14 Sesiones)</option>
                                        <option value="Reductivo Body Fit">Reductivo Body Fit (12 Sesiones)</option>
                                        <option value="Reduce, Define, Reafirma!">Reduce, Define, Reafirma! (12 Sesiones)</option>
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-medium bg-white"
                                        placeholder="Ej. Moldeo Corporal, Hidrafacial, Dermapen..."
                                        value={nuevoTrat.nombre}
                                        onChange={e => setNuevoTrat(prev => ({ ...prev, nombre: e.target.value }))}
                                    />
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">Núm. Sesiones</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold bg-white"
                                    value={nuevoTrat.numSesiones}
                                    onChange={e => setNuevoTrat(prev => ({ ...prev, numSesiones: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowNuevoTratamiento(false)}>Cancelar</Button>
                            <Button variant="primary" size="sm" onClick={handleCrearTratamiento} disabled={creandoTrat}>
                                {creandoTrat ? 'Creando...' : 'Guardar y Activar Tratamiento'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════════════════
    ROADMAP CLÍNICO DE TRANSFORMACIÓN (VISIBLE EN TODAS LAS PESTAÑAS)
   ═══════════════════════════════════════════════════════════════════════ */}
<div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-teal-500/30 space-y-3 mb-2">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-md">
                <Compass size={22} />
            </div>
            <div>
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black uppercase tracking-wider text-teal-300">
                        Roadmap Clínico ALFRA — {categoriaRoadmapActivo === 'laser' ? '⚡ Depilación Láser (8-12 Ses.)' : categoriaRoadmapActivo === 'despigmentacion' ? '💎 Despigmentación (8-12 Ses.)' : categoriaRoadmapActivo === 'facial' ? '✨ Facial (6-10 Ses.)' : '🌸 Corporal (8-14 Ses.)'}
                    </h3>
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        {tratamientoActivo?.nombre || 'Tratamiento Activo'}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        tratamientoActivo?.faseRoadmapManual && tratamientoActivo.faseRoadmapManual !== 'auto'
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                            : 'bg-sky-400/20 text-sky-300 border border-sky-400/30'
                    }`}>
                        {tratamientoActivo?.faseRoadmapManual && tratamientoActivo.faseRoadmapManual !== 'auto'
                            ? `📍 Manual Especialista (Fase ${tratamientoActivo.faseRoadmapManual})`
                            : `⚡ Auto por Sesiones (Fase ${calcularFaseAuto(sesiones.length)})`}
                    </span>
                    {guardandoFaseGlobal && <Loader size={13} className="animate-spin text-teal-400" />}
                    {avisoFaseGlobal && (
                        <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full animate-in fade-in">
                            ✓ {avisoFaseGlobal}
                        </span>
                    )}
                </div>
                <p className="text-[11px] text-gray-300 font-medium mt-0.5">
                    Sincronizado en tiempo real con la App del Paciente. Puedes hacer clic en cualquier fase para activarla de inmediato.
                </p>
            </div>
        </div>

        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3.5 py-1.5 rounded-xl border border-white/15">
            <label className="text-[11px] font-black text-gray-200 uppercase tracking-wider">
                Fase en App:
            </label>
            <select
                value={tratamientoActivo?.faseRoadmapManual || 'auto'}
                onChange={(e) => handleCambiarFaseRoadmapDirecto(e.target.value)}
                disabled={guardandoFaseGlobal || !tratamientoActivo}
                className="text-xs font-black bg-slate-800 text-white border border-teal-500/40 rounded-lg px-2.5 py-1 outline-none cursor-pointer focus:ring-2 focus:ring-teal-400"
            >
                <option value="auto">⚡ Auto por Sesiones (Fase {calcularFaseAuto(sesiones.length)})</option>
                {fasesRoadmapEspecialista.map(f => (
                    <option key={f.num} value={String(f.num)}>Fase {f.num}: {f.nombre} ({f.sub})</option>
                ))}
            </select>
        </div>
    </div>

    {/* Las 4 Fases Biológicas del Roadmap */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {fasesRoadmapEspecialista.map((fase) => {
            const isActiva = faseActualGlobal === fase.num;
            const isCompletada = faseActualGlobal > fase.num;
            return (
                <div
                    key={fase.num}
                    onClick={() => handleCambiarFaseRoadmapDirecto(String(fase.num))}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isActiva
                            ? 'bg-teal-500/25 border-teal-400 ring-2 ring-teal-400/40 shadow-lg shadow-teal-500/10'
                            : isCompletada
                            ? 'bg-white/5 border-emerald-500/30 opacity-90'
                            : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                    }`}
                >
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                isActiva ? 'bg-teal-400 text-slate-950 font-black' : isCompletada ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-gray-400'
                            }`}>
                                FASE {fase.num}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold">{fase.sub}</span>
                        </div>
                        <h4 className="text-xs font-black text-white leading-tight mb-1">{fase.nombre}</h4>
                        <p className="text-[10px] text-gray-300 leading-snug">{fase.desc}</p>
                    </div>
                    <div className="pt-2 text-[10px] font-black uppercase flex items-center justify-between">
                        <span className={isActiva ? 'text-teal-300' : isCompletada ? 'text-emerald-400' : 'text-gray-400'}>
                            {isActiva ? '📍 En curso (Fijar)' : isCompletada ? '✓ Completada' : '⏳ Pendiente'}
                        </span>
                        <ChevronRight size={13} className={isActiva ? 'text-teal-300' : 'text-gray-500'} />
                    </div>
                </div>
            );
        })}
    </div>
</div>
{/* NAVEGACIÓN DE PESTAÑAS PRINCIPALES (ARRIBA, SIN SCROLL) */}
                <div className="px-4 py-2.5 bg-white flex flex-wrap gap-1.5">
                    {[
                        { key: 'sesiones', label: '⚡ Sesiones y Cabina', count: sesiones.length },
                        { key: 'evolucion', label: '📊 Evolución y Medidas', count: sesiones.length },
                        { key: 'galeria', label: '📸 Galería y Antes / Después', count: todasLasFotos.length },
                        { key: 'roadmap', label: `🗺️ Roadmap Clínico (Fase ${faseActualGlobal})`, count: 4 },
                        { key: 'apoyo', label: '🏠 Apoyo en Casa y Nutrición', count: apoyoList.length },
                        { key: 'ficha', label: '🩺 Ficha Médica, Citas y Firmas', count: citasHistorial.length },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                                activeTab === tab.key
                                    ? 'bg-acero text-white shadow-sm'
                                    : 'text-gray-500 hover:text-acero hover:bg-gray-100'
                            }`}
                        >
                            <span>{tab.label}</span>
                            {tab.count > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                    activeTab === tab.key ? 'bg-turquesa text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════
                TAB 1: SESIONES Y CABINA
               ═══════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'sesiones' && (
                <div className="space-y-4">
                    {!tratamientoActivo ? (
                        <Card className="py-14 text-center space-y-3">
                            <Clipboard size={40} className="mx-auto text-gray-200" />
                            <p className="text-gray-600 font-black text-base">Crea o selecciona un tratamiento arriba para registrar sesiones</p>
                            <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowNuevoTratamiento(true)}>
                                + Crear Primer Tratamiento
                            </Button>
                        </Card>
                    ) : showNuevaSesion ? (
                        <NuevaSesionForm
                            tratamiento={tratamientoActivo}
                            pacienteId={paciente?.id || pacienteId}
                            onSaved={handleSesionGuardada}
                            onCancel={() => setShowNuevaSesion(false)}
                            esPrimeraSesion={sesiones.length === 0}
                            paciente={paciente}
                            ultimaSesion={ultimaSesionRegistrada}
                            citaIdPreseleccionada={citaIdPreseleccionada}
                        />
                    ) : loadingSesiones ? (
                        <Card className="py-12 flex items-center justify-center gap-3 text-gray-400">
                            <Loader className="animate-spin text-turquesa" size={24} />
                            <span className="text-sm font-bold">Cargando sesiones del tratamiento...</span>
                        </Card>
                    ) : (
                        <SesionesTratamiento
                            tratamiento={tratamientoActivo}
                            sesiones={sesiones}
                            onNuevaSesion={() => setShowNuevaSesion(true)}
                            onEliminarSesion={(s) => setSesionToDelete(s)}
                            onDownloadConsentPDF={handleDownloadPDF}
                            onActualizarTratamiento={(updated) => {
                                setTratamientoActivo(updated);
                                setTratamientos(prev => prev.map(t => t.id === updated.id ? updated : t));
                            }}
                            onSolicitarEliminarTratamiento={async (trat) => {
                                if (!window.confirm('¿Solicitar la eliminación de este Tratamiento al Administrador?')) return;
                                try {
                                    const staffName = auth.currentUser?.displayName || 'Especialista';
                                    await solicitarEliminacionTratamiento(trat.id, staffName);
                                    setTratamientoActivo(prev => ({ ...prev, solicitudEliminacion: true }));
                                    alert('Solicitud enviada al Administrador.');
                                } catch (e) {
                                    alert('No se pudo enviar la solicitud.');
                                }
                            }}
                            esCorporal={esCorporal}
                        />
                    )}
                </div>
            )}

            
            {/* ═══════════════════════════════════════════════════════════════════════
                TAB: ROADMAP CLÍNICO COMPLETO
               ═══════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'roadmap' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    <Card className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                            <div>
                                <h3 className="text-sm font-black text-acero uppercase tracking-wider flex items-center gap-2">
                                    <Compass size={18} className="text-turquesa" /> Protocolo de Transformación del Paciente
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Tratamiento: <strong>{tratamientoActivo?.nombre || 'General'}</strong> ({esCorporal ? 'Corporal' : 'Facial'}).
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-turquesa bg-turquesa/10 px-3 py-1 rounded-full">
                                    Fase Actual: {faseActualGlobal} de 4
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {fasesRoadmapEspecialista.map(f => (
                                <div
                                    key={f.num}
                                    className={`p-4 rounded-2xl border transition-all ${
                                        faseActualGlobal === f.num
                                            ? 'bg-teal-50 border-turquesa shadow-sm ring-1 ring-turquesa/30'
                                            : 'bg-gray-50 border-gray-100'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg ${
                                            faseActualGlobal === f.num ? 'bg-turquesa text-white' : 'bg-gray-200 text-gray-700'
                                        }`}>
                                            Fase {f.num} — {f.sub}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleCambiarFaseRoadmapDirecto(String(f.num))}
                                            className="text-xs font-black text-turquesa hover:underline cursor-pointer"
                                        >
                                            {faseActualGlobal === f.num ? '✓ Fase Activa' : 'Fijar esta Fase'}
                                        </button>
                                    </div>
                                    <h4 className="text-sm font-black text-acero mb-1">{f.nombre}</h4>
                                    <p className="text-xs text-gray-600 leading-relaxed mb-3">{f.desc}</p>
                                    <div className="text-[11px] font-bold text-gray-500 bg-white/70 p-2.5 rounded-xl border border-gray-100">
                                        💡 {f.num === 1 ? 'Enfoque en preparar el tejido, desintoxicar y drenar toxinas para asegurar receptividad.' : f.num === 2 ? 'Enfoque en aplicación profunda de aparatología de alta potencia o bioestimulación activa.' : f.num === 3 ? 'Enfoque en perfilado, compactación dérmica y producción natural de colágeno.' : 'Enfoque en mantenimiento VIP y estabilización metabólica para evitar rebotes.'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            )}
{/* ═══════════════════════════════════════════════════════════════════════
                TAB 2: EVOLUCIÓN Y MEDIDAS (GRÁFICAS + COMPARATIVA SESIÓN 1 VS ACTUAL)
               ═══════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'evolucion' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Tarjetas de Impacto Acumulado */}
                    {resumenEvolucion && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card className="bg-emerald-50/60 border-emerald-200">
                                <p className="text-[10px] font-black uppercase text-emerald-700">Cambio de Peso Total</p>
                                <p className="text-2xl font-black text-emerald-800 mt-1">
                                    {resumenEvolucion.deltaPeso ? `${resumenEvolucion.deltaPeso} kg` : 'Sin cambio'}
                                </p>
                                <p className="text-xs text-emerald-600 mt-0.5">
                                    Inicial: {resumenEvolucion.pesoInicial || '—'} kg → Actual: {resumenEvolucion.pesoActual || '—'} kg
                                </p>
                            </Card>
                            <Card className="bg-cyan-50/60 border-cyan-200">
                                <p className="text-[10px] font-black uppercase text-cyan-700">Reducción Cintura</p>
                                <p className="text-2xl font-black text-cyan-800 mt-1">
                                    {resumenEvolucion.deltaCintura ? `${resumenEvolucion.deltaCintura} cm` : '—'}
                                </p>
                                <p className="text-xs text-cyan-600 mt-0.5">Desde la Sesión #1</p>
                            </Card>
                            <Card className="bg-amber-50/60 border-amber-200">
                                <p className="text-[10px] font-black uppercase text-amber-700">Reducción Abdomen</p>
                                <p className="text-2xl font-black text-amber-800 mt-1">
                                    {resumenEvolucion.deltaAbdomen ? `${resumenEvolucion.deltaAbdomen} cm` : '—'}
                                </p>
                                <p className="text-xs text-amber-600 mt-0.5">Desde la Sesión #1</p>
                            </Card>
                            <Card className="bg-purple-50/60 border-purple-200">
                                <p className="text-[10px] font-black uppercase text-purple-700">Reducción Cadera</p>
                                <p className="text-2xl font-black text-purple-800 mt-1">
                                    {resumenEvolucion.deltaCadera ? `${resumenEvolucion.deltaCadera} cm` : '—'}
                                </p>
                                <p className="text-xs text-purple-600 mt-0.5">IMC Actual: {resumenEvolucion.imcActual || '—'}</p>
                            </Card>
                        </div>
                    )}

                    {/* Gráfica combinada de evolución */}
                    {(() => {
                        const chartData = sesiones.map((s, idx) => ({
                            sesion: `#${idx + 1}`,
                            fecha: new Date(s.fecha).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
                            peso: parseFloat(s.medidas?.peso) || null,
                            imc: parseFloat(s.medidas?.imc) || null,
                            cintura: parseFloat(s.medidas?.cintura) || null,
                            abdomen: parseFloat(s.medidas?.abdomen) || null,
                            cadera: parseFloat(s.medidas?.cadera) || null,
                        })).filter(d => d.peso || d.cintura || d.abdomen);

                        return chartData.length >= 2 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <Card>
                                    <h3 className="text-xs font-black text-acero uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <TrendingUp size={15} className="text-turquesa" /> Curva de Peso (kg) e IMC
                                    </h3>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                            <XAxis dataKey="fecha" stroke="#9ca3af" fontSize={10} />
                                            <YAxis stroke="#9ca3af" fontSize={10} />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="peso" stroke="#20b2aa" strokeWidth={3} dot={{ r: 4 }} name="Peso (kg)" />
                                            <Line type="monotone" dataKey="imc" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="IMC" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Card>

                                <Card>
                                    <h3 className="text-xs font-black text-acero uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <Ruler size={15} className="text-turquesa" /> Reducción de Medidas (Cintura, Abdomen y Cadera)
                                    </h3>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                            <XAxis dataKey="fecha" stroke="#9ca3af" fontSize={10} />
                                            <YAxis stroke="#9ca3af" fontSize={10} />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="cintura" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 4 }} name="Cintura (cm)" />
                                            <Line type="monotone" dataKey="abdomen" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} name="Abdomen (cm)" />
                                            <Line type="monotone" dataKey="cadera" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 4 }} name="Cadera (cm)" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Card>
                            </div>
                        ) : null;
                    })()}

                    {/* Tabla Comparativa Sesión por Sesión */}
                    <Card className="overflow-hidden p-0">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-xs font-black text-acero uppercase tracking-wider flex items-center gap-2">
                                <Activity size={15} className="text-turquesa" /> Tabla Comparativa de Medidas por Sesión
                            </h3>
                            {role === 'Administrador' && (
                                <Button variant="outline" size="sm" icon={Download} onClick={handleExportarResumenClinicoPDF}>
                                    Exportar Tabla PDF
                                </Button>
                            )}
                        </div>
                        {sesiones.length === 0 ? (
                            <div className="py-12 text-center text-gray-400 text-sm font-bold">
                                Registra sesiones con medidas corporales para ver la comparativa.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Sesión / Fecha</th>
                                            <th className="px-4 py-3 text-right">Peso</th>
                                            <th className="px-4 py-3 text-right">IMC</th>
                                            <th className="px-4 py-3 text-right">Cintura</th>
                                            <th className="px-4 py-3 text-right">Abdomen</th>
                                            <th className="px-4 py-3 text-right">Cadera</th>
                                            <th className="px-4 py-3 text-left">Protocolo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {[...sesiones].reverse().map((s, i) => {
                                            const num = sesiones.length - i;
                                            return (
                                                <tr key={s.id || i} className="hover:bg-gray-50/60">
                                                    <td className="px-4 py-3 font-black text-acero">
                                                        #{num} — {new Date(s.fecha).toLocaleDateString('es-MX')}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-black text-acero">
                                                        {s.medidas?.peso ? `${s.medidas.peso} kg` : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {s.medidas?.imc ? (
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-black ${parseFloat(s.medidas.imc) > 25 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                                                {s.medidas.imc}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-gray-700">{s.medidas?.cintura ? `${s.medidas.cintura} cm` : '—'}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-gray-700">{s.medidas?.abdomen ? `${s.medidas.abdomen} cm` : '—'}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-gray-700">{s.medidas?.cadera ? `${s.medidas.cadera} cm` : '—'}</td>
                                                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{s.protocolo || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════
                TAB 3: GALERÍA Y COMPARADOR VISUAL "ANTES VS. DESPUÉS"
               ═══════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'galeria' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    {/* COMPARADOR LADO A LADO ANTES VS DESPUÉS */}
                    {todasLasFotos.length >= 2 && (
                        <Card className="bg-slate-900 text-white border-none p-5 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-base font-black flex items-center gap-2 text-turquesa">
                                        <Columns size={18} /> Comparador Clínico Lado a Lado: Antes vs. Después
                                    </h3>
                                    <p className="text-xs text-gray-300">
                                        Selecciona cualquier par de fotografías para mostrarle al paciente su evolución visual en pantalla
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Lado Izquierdo: ANTES */}
                                <div className="bg-white/5 p-3 rounded-2xl border border-white/10 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-black uppercase bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-lg">
                                            ANTES
                                        </span>
                                        <select
                                            value={fotoAntesIdx}
                                            onChange={e => setFotoAntesIdx(Number(e.target.value))}
                                            className="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20"
                                        >
                                            {todasLasFotos.map((f, idx) => (
                                                <option key={idx} value={idx}>{f.etiqueta || `Foto #${idx + 1}`}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="aspect-4/3 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                                        <img
                                            src={todasLasFotos[fotoAntesIdx]?.url}
                                            alt="Antes"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                </div>

                                {/* Lado Derecho: DESPUÉS */}
                                <div className="bg-white/5 p-3 rounded-2xl border border-turquesa/40 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-black uppercase bg-turquesa text-white px-2.5 py-0.5 rounded-lg">
                                            DESPUÉS / ACTUAL
                                        </span>
                                        <select
                                            value={fotoDespuesIdx}
                                            onChange={e => setFotoDespuesIdx(Number(e.target.value))}
                                            className="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20"
                                        >
                                            {todasLasFotos.map((f, idx) => (
                                                <option key={idx} value={idx}>{f.etiqueta || `Foto #${idx + 1}`}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="aspect-4/3 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                                        <img
                                            src={todasLasFotos[fotoDespuesIdx]?.url}
                                            alt="Después"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Galería Completa */}
                    <Card className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black text-acero uppercase tracking-wider flex items-center gap-2">
                                    <Image size={16} className="text-turquesa" /> Todas las Fotografías del Expediente ({todasLasFotos.length})
                                </h3>
                                <p className="text-xs text-gray-400">Incluye las fotos tomadas en cada sesión y las subidas directamente a la galería</p>
                            </div>
                            <Button
                                variant="primary"
                                size="sm"
                                icon={uploadingGaleria ? Loader : Camera}
                                disabled={uploadingGaleria}
                                onClick={() => galeriaRef.current?.click()}
                            >
                                {uploadingGaleria ? 'Subiendo...' : '+ Subir Fotos'}
                            </Button>
                            <input ref={galeriaRef} type="file" multiple accept="image/*" className="hidden" onChange={handleGaleriaUpload} />
                        </div>

                        {todasLasFotos.length === 0 ? (
                            <div className="py-16 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                                <Camera size={40} className="mx-auto text-gray-200 mb-2" />
                                <p className="text-gray-500 font-bold text-sm">Sin fotografías registradas aún</p>
                                <p className="text-gray-400 text-xs mt-1">Sube al menos 2 fotos para activar el Comparador Visual Antes vs. Después.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {todasLasFotos.map((foto, idx) => (
                                    <div key={foto.id || idx} className="group relative aspect-square rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
                                        <img src={foto.url} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 flex items-end justify-between">
                                            <span className="text-[11px] text-white font-bold">{foto.etiqueta}</span>
                                            {!foto.fromSesion && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteGaleriaPhoto(foto)}
                                                    className="text-red-300 hover:text-red-500 p-1 cursor-pointer"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════
                TAB 4: APOYO EN CASA Y NUTRICIÓN
               ═══════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'apoyo' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Resumen de Compromiso y Vulnerabilidad Horaria */}
                    <div className="bg-gradient-to-r from-slate-900 to-acero rounded-2xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-turquesa">Monitoreo en App del Paciente</span>
                            <h3 className="text-lg font-black">
                                Índice de Compromiso: {compromisoPorcentaje}% · Meta Calórica: {sesiones[sesiones.length - 1]?.metasPaciente?.metaCalorica || paciente?.metaCalorica || '1500'} kcal
                            </h3>
                            <p className="text-xs text-gray-300">
                                Revisa qué come el paciente, a qué hora tiene picos calóricos y asigna su rutina de cuidados en casa.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            icon={Target}
                            className="bg-white/10 text-white border-white/20 hover:bg-white/20 shrink-0"
                            onClick={() => setShowRiesgoModal(true)}
                        >
                            Ver Vulnerabilidad Horaria
                        </Button>
                    </div>

                    {/* Historial Calórico */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                            <h3 className="text-xs font-black text-acero uppercase tracking-widest flex items-center gap-2">
                                <BarChart2 size={14} className="text-turquesa" /> Historial Calórico (Apoyo Nutricional)
                            </h3>
                            <span className="text-[10px] bg-turquesa/10 text-turquesa font-bold px-2.5 py-0.5 rounded-md">
                                {nutricionData.length} días registrados
                            </span>
                        </div>
                        {nutricionData.length > 0 ? (
                            <div className="w-full flex flex-col">
                                <div className="p-4 h-56 w-full bg-gray-50/30">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={nutricionData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis dataKey="fecha" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                                            <Tooltip />
                                            <Line type="step" dataKey="meta" stroke="#fb923c" strokeWidth={2} strokeDasharray="5 5" name="Meta" dot={false} />
                                            <Line type="monotone" dataKey="calorias" name="Consumo (kcal)" stroke="#20b2aa" strokeWidth={3} dot={{ r: 4, fill: '#20b2aa' }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                {riesgoHorasData.length > 0 && (
                                    <div className="bg-gradient-to-b from-gray-50/50 to-white p-6 border-t border-gray-100">
                                        <div className="flex justify-between items-center mb-4">
                                            <div>
                                                <h4 className="text-gray-800 font-black text-sm flex items-center gap-2">
                                                    <Target size={14} className="text-turquesa" /> Zonas de Riesgo por Horario
                                                </h4>
                                            </div>
                                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                                <button onClick={() => setRiesgoMode('sesion')} className={`px-3 py-1 rounded-lg text-xs font-bold ${riesgoMode === 'sesion' ? 'bg-white text-turquesa shadow-2xs' : 'text-gray-500'}`}>Esta Sesión</button>
                                                <button onClick={() => setRiesgoMode('acumulado')} className={`px-3 py-1 rounded-lg text-xs font-bold ${riesgoMode === 'acumulado' ? 'bg-white text-turquesa shadow-2xs' : 'text-gray-500'}`}>Acumulado</button>
                                            </div>
                                        </div>
                                        <div className="h-44">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={riesgoHorasData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} />
                                                    <YAxis stroke="#94a3b8" fontSize={10} />
                                                    <Tooltip />
                                                    <Bar dataKey="calorias" name="Calorías" radius={[6, 6, 0, 0]} maxBarSize={40}>
                                                        <LabelList dataKey="calorias" position="top" fill="#64748b" fontSize={10} fontWeight="bold" formatter={(val) => val > 0 ? `${val}` : ''} />
                                                        {riesgoHorasData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.calorias >= 400 ? '#f43f5e' : '#20b2aa'} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-400 text-xs font-bold">
                                El paciente aún no ha registrado alimentos en su App.
                            </div>
                        )}
                    </div>

                    {/* Asignación de Cuidados en Casa */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
                        <h3 className="text-xs font-black text-acero uppercase tracking-widest flex items-center gap-2">
                            <Home size={15} className="text-turquesa" /> Asignar Cuidados de Apoyo en Casa (1 Toque)
                        </h3>

                        <div className="space-y-4">
                            {Object.entries(CUIDADOS_PRESET || {}).map(([categoria, cuidados]) => (
                                <div key={categoria} className="bg-gray-50/60 p-4 rounded-2xl border border-gray-100">
                                    <h4 className="text-[10px] font-black text-turquesa uppercase tracking-widest mb-3">
                                        {categoria === 'General' ? 'Cuidados Generales' : `Cuidados ${categoria}es`}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                        {cuidados.map(c => {
                                            const active = apoyoList.find(a => a.id === c.id);
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => handleTogglePresetApoyo(c)}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                                        active ? 'border-turquesa bg-turquesa/10 text-acero shadow-2xs' : 'border-gray-200 bg-white text-gray-600 hover:border-turquesa/40'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${active ? 'bg-turquesa border-turquesa text-white' : 'border-gray-300'}`}>
                                                        {active && <CheckCircle size={12} />}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black leading-tight">{c.label || c.texto}</p>
                                                        <p className="text-[10px] text-gray-400">{c.frecuencia || 'Diario'}</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Personalizado */}
                        <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                            <input
                                type="text"
                                value={apoyoPersonalizado}
                                onChange={e => setApoyoPersonalizado(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddPersonalizado()}
                                placeholder="Agregar indicación personalizada (ej. Aplicar Gel Reductivo noche)..."
                                className="flex-1 min-w-[220px] px-3 py-2 border border-gray-200 rounded-xl text-sm"
                            />
                            <select
                                value={frecuenciaPersonalizada}
                                onChange={e => setFrecuenciaPersonalizada(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold bg-gray-50"
                            >
                                {['Diario', 'Mañana y noche', 'Una vez a la semana', 'Según indicación'].map(f => <option key={f}>{f}</option>)}
                            </select>
                            <Button size="sm" variant="outline" icon={Plus} onClick={handleAddPersonalizado}>
                                Añadir
                            </Button>
                        </div>

                        {apoyoList.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                {apoyoList.map(c => (
                                    <span key={c.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-turquesa/10 text-acero text-xs font-bold rounded-xl border border-turquesa/20">
                                        {c.label || c.texto} ({c.frecuencia})
                                        <button type="button" onClick={() => handleRemoveApoyo(c.id)} className="text-red-400 hover:text-red-600 cursor-pointer">
                                            <X size={13} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <Button variant="primary" onClick={handleSaveApoyo} disabled={savingApoyo} className="w-full">
                            {savingApoyo ? 'Sincronizando con App del Paciente...' : '✓ Guardar y Enviar Cuidados en Casa al Paciente'}
                        </Button>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════════
                TAB 5: FICHA MÉDICA, CITAS Y DOCUMENTOS FIRMADOS
               ═══════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'ficha' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    {/* ENCABEZADO DE FICHA MÉDICA CLÍNICA */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-acero uppercase tracking-wide flex items-center gap-2">
                                    <HeartPulse size={20} className="text-red-500" /> Historia Clínica & Anamnesis Integral
                                </h3>
                                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                                    Expediente #{paciente?.id?.slice(0, 8) || 'ALFRA'}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Registro médico-estético confidencial, antecedentes patológicos, estilo de vida y valoraciones cosmiátricas.
                            </p>
                        </div>
                        <div>
                            {isEditingAntecedentes ? (
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setIsEditingAntecedentes(false)}>
                                        Cancelar
                                    </Button>
                                    <Button variant="primary" size="sm" icon={Save} onClick={handleSaveAntecedentes}>
                                        Guardar Ficha Médica
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleOpenEditAntecedentes}
                                    className="border-turquesa text-turquesa hover:bg-turquesa/10 font-black text-xs"
                                >
                                    ✏️ Editar Ficha Médica Completa
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* MODO EDICIÓN COMPLETA */}
                    {isEditingAntecedentes ? (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            {/* SECCIÓN 1: ALERTAS MÉDICAS */}
                            <Card className="space-y-4 border-l-4 border-l-red-500">
                                <h4 className="text-xs font-black uppercase text-red-600 tracking-wider flex items-center gap-2">
                                    <ShieldAlert size={16} /> 1. Alertas Clínicas & Antecedentes Patológicos
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">
                                            Alergias Conocidas (Medicamentos, Látex, Cosméticos)
                                        </label>
                                        <textarea
                                            rows={2}
                                            className="w-full p-2.5 border border-red-300 rounded-xl text-xs font-bold bg-red-50/30 outline-none focus:ring-2 focus:ring-red-400"
                                            placeholder="Ej. Alergia a Penicilina, AINEs, Látex, Ácido Salicílico..."
                                            value={editAntecedentes.alergias}
                                            onChange={e => setEditAntecedentes(prev => ({ ...prev, alergias: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">
                                            Condiciones Médicas / Enfermedades Crónicas
                                        </label>
                                        <textarea
                                            rows={2}
                                            className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-turquesa"
                                            placeholder="Ej. Hipertensión, Diabetes, Hipotiroidismo, SOP, Trastornos Hepáticos..."
                                            value={editAntecedentes.condicionesMedicas}
                                            onChange={e => setEditAntecedentes(prev => ({ ...prev, condicionesMedicas: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">
                                            Medicamentos Actuales / Tratamientos Farmacológicos
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-turquesa"
                                            placeholder="Ej. Anticoagulantes, Corticoides, Isotretinoína/Roaccutan, Eutirox..."
                                            value={editAntecedentes.medicamentosActuales}
                                            onChange={e => setEditAntecedentes(prev => ({ ...prev, medicamentosActuales: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">
                                            Cirugías Previas o Tratamientos Estéticos Previos
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-turquesa"
                                            placeholder="Ej. Liposucción (2022), Rinoplastia, Cesárea previa..."
                                            value={editAntecedentes.cirugiasPrevias}
                                            onChange={e => setEditAntecedentes(prev => ({ ...prev, cirugiasPrevias: e.target.value }))}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 md:col-span-2">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-600 block mb-1">
                                                ¿Implantes Metálicos / Marcapasos?
                                            </label>
                                            <select
                                                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                                value={editAntecedentes.implantesMetalicos}
                                                onChange={e => setEditAntecedentes(prev => ({ ...prev, implantesMetalicos: e.target.value }))}
                                            >
                                                <option value="No">No</option>
                                                <option value="Sí (Placas / Tornillos)">Sí (Placas / Tornillos)</option>
                                                <option value="Sí (Marcapasos cardíaco)">Sí (Marcapasos)</option>
                                                <option value="Sí (DIU metálico)">Sí (DIU metálico)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-600 block mb-1">
                                                ¿Cicatrización Queloide?
                                            </label>
                                            <select
                                                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                                value={editAntecedentes.cicatrizacionQueloide}
                                                onChange={e => setEditAntecedentes(prev => ({ ...prev, cicatrizacionQueloide: e.target.value }))}
                                            >
                                                <option value="No">No (Normal)</option>
                                                <option value="Sí (Tendencia Queloide)">Sí (Tendencia Queloide)</option>
                                                <option value="Hipertrófica">Hipertrófica</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-600 block mb-1">
                                                ¿Problemas Circulatorios / Várices?
                                            </label>
                                            <select
                                                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                                value={editAntecedentes.problemasCirculatorios}
                                                onChange={e => setEditAntecedentes(prev => ({ ...prev, problemasCirculatorios: e.target.value }))}
                                            >
                                                <option value="No">No</option>
                                                <option value="Várices moderadas">Várices moderadas</option>
                                                <option value="Fragilidad capilar">Fragilidad capilar</option>
                                                <option value="Historial de Trombosis">Historial de Trombosis</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* SECCIÓN 2: GINECO-OBSTÉTRICA & ESTILO DE VIDA */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="space-y-3">
                                    <h4 className="text-xs font-black uppercase text-pink-600 tracking-wider flex items-center gap-2">
                                        🌸 2. Salud Femenina & Gineco-Obstétrica
                                    </h4>
                                    <div>
                                        <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">
                                            ¿Embarazo Actual o Sospecha / Lactancia?
                                        </label>
                                        <select
                                            className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                            value={editAntecedentes.embarazoLactancia}
                                            onChange={e => setEditAntecedentes(prev => ({ ...prev, embarazoLactancia: e.target.value }))}
                                        >
                                            <option value="No">No</option>
                                            <option value="Embarazo Activo">⚠️ Embarazo Activo</option>
                                            <option value="Periodo de Lactancia">🍼 Periodo de Lactancia</option>
                                            <option value="No Aplica">No Aplica</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">
                                            Método Anticonceptivo en uso
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                            placeholder="Ej. DIU Mirena, Pastillas, Implante subdérmico, Ninguno..."
                                            value={editAntecedentes.metodoAnticonceptivo}
                                            onChange={e => setEditAntecedentes(prev => ({ ...prev, metodoAnticonceptivo: e.target.value }))}
                                        />
                                    </div>
                                </Card>

                                <Card className="space-y-3">
                                    <h4 className="text-xs font-black uppercase text-emerald-600 tracking-wider flex items-center gap-2">
                                        🌿 3. Hábitos Biológicos & Estilo de Vida
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">
                                                Agua Diaria (Litros)
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                                placeholder="Ej. 2.0 Lts"
                                                value={editAntecedentes.consumoAguaLitros}
                                                onChange={e => setEditAntecedentes(prev => ({ ...prev, consumoAguaLitros: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">
                                                Actividad Física
                                            </label>
                                            <select
                                                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                                value={editAntecedentes.actividadFisica}
                                                onChange={e => setEditAntecedentes(prev => ({ ...prev, actividadFisica: e.target.value }))}
                                            >
                                                <option value="Sedentario">Sedentario</option>
                                                <option value="Moderado (1-3 días)">Moderado (1-3 días)</option>
                                                <option value="Activo (4+ días)">Activo (4+ días)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">
                                                Tabaquismo / Alcohol
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                                placeholder="Ej. No fumador, Alcohol social..."
                                                value={editAntecedentes.tabaquismo}
                                                onChange={e => setEditAntecedentes(prev => ({ ...prev, tabaquismo: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">
                                                Protector Solar Facial
                                            </label>
                                            <select
                                                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                                value={editAntecedentes.protectorSolar}
                                                onChange={e => setEditAntecedentes(prev => ({ ...prev, protectorSolar: e.target.value }))}
                                            >
                                                <option value="Diario">Diario</option>
                                                <option value="Ocasional">Ocasional</option>
                                                <option value="Nunca">Nunca</option>
                                            </select>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* SECCIÓN 3: VALORACIÓN CUTÁNEA & DEMOGRÁFICA */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="space-y-3">
                                    <h4 className="text-xs font-black uppercase text-turquesa tracking-wider flex items-center gap-2">
                                        ✨ 4. Valoración Cosmiátrica & Estética
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">
                                                Fototipo (Fitzpatrick)
                                            </label>
                                            <select
                                                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                                value={editAntecedentes.fototipoCutaneo}
                                                onChange={e => setEditAntecedentes(prev => ({ ...prev, fototipoCutaneo: e.target.value }))}
                                            >
                                                <option value="I (Muy clara)">I (Muy clara)</option>
                                                <option value="II (Clara)">II (Clara)</option>
                                                <option value="III (Intermedia)">III (Intermedia)</option>
                                                <option value="IV (Morena clara)">IV (Morena clara)</option>
                                                <option value="V (Morena oscura)">V (Morena oscura)</option>
                                                <option value="VI (Muy oscura)">VI (Muy oscura)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">
                                                Biotipo Cutáneo
                                            </label>
                                            <select
                                                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                                value={editAntecedentes.biotipoCutaneo}
                                                onChange={e => setEditAntecedentes(prev => ({ ...prev, biotipoCutaneo: e.target.value }))}
                                            >
                                                <option value="Normal">Normal</option>
                                                <option value="Grasa">Grasa</option>
                                                <option value="Seca / Alípica">Seca / Alípica</option>
                                                <option value="Mixta">Mixta</option>
                                                <option value="Sensible / Reactiva">Sensible / Reactiva</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">
                                            Zonas Prioritarias de Interés / Motivo de Consulta
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                            placeholder="Ej. Abdomen bajo, flancos, líneas de expresión, pigmentaciones..."
                                            value={editAntecedentes.zonasInteres}
                                            onChange={e => setEditAntecedentes(prev => ({ ...prev, zonasInteres: e.target.value }))}
                                        />
                                    </div>
                                </Card>

                                <Card className="space-y-3">
                                    <h4 className="text-xs font-black uppercase text-gray-700 tracking-wider flex items-center gap-2">
                                        👤 5. Datos Generales & Contacto de Emergencia
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">Teléfono / WhatsApp</label>
                                            <input
                                                type="text"
                                                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                                value={editAntecedentes.telefono}
                                                onChange={e => setEditAntecedentes(prev => ({ ...prev, telefono: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">Fecha de Nacimiento</label>
                                            <input
                                                type="date"
                                                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                                value={editAntecedentes.fechaNacimiento}
                                                onChange={e => setEditAntecedentes(prev => ({ ...prev, fechaNacimiento: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">Ocupación</label>
                                            <input
                                                type="text"
                                                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                                placeholder="Ej. Docente, Administrativo, Hogar..."
                                                value={editAntecedentes.ocupacion}
                                                onChange={e => setEditAntecedentes(prev => ({ ...prev, ocupacion: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black uppercase text-gray-600 block mb-1">Contacto Emergencia (Teléfono)</label>
                                            <input
                                                type="text"
                                                className="w-full p-2.5 border border-gray-300 rounded-xl text-xs font-bold bg-white"
                                                placeholder="Ej. Mamá 4531234567"
                                                value={editAntecedentes.contactoEmergenciaTelefono}
                                                onChange={e => setEditAntecedentes(prev => ({ ...prev, contactoEmergenciaTelefono: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="ghost" onClick={() => setIsEditingAntecedentes(false)}>
                                    Cancelar
                                </Button>
                                <Button variant="primary" icon={Save} onClick={handleSaveAntecedentes}>
                                    Guardar Ficha Médica Completa
                                </Button>
                            </div>
                        </div>
                    ) : (
                        /* MODO VISTA COMPLETA DE LA FICHA MÉDICA */
                        <div className="space-y-5 animate-in fade-in duration-200">
                            {/* CARD 1: ALERTAS Y ANTECEDENTES */}
                            <Card className="space-y-3 border-l-4 border-l-red-500">
                                <h4 className="text-xs font-black uppercase tracking-wider text-red-600 flex items-center justify-between">
                                    <span className="flex items-center gap-2"><ShieldAlert size={16} /> 1. Alertas Clínicas & Antecedentes Patológicos</span>
                                    {paciente?.alergias ? (
                                        <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-black">
                                            ⚠️ Alergias Detectadas
                                        </span>
                                    ) : (
                                        <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-black">
                                            ✓ Sin Alergias Conocidas
                                        </span>
                                    )}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className={`p-3.5 rounded-xl border ${paciente?.alergias ? 'bg-red-50/60 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                                        <p className="text-[10px] font-black uppercase text-gray-500">Alergias Conocidas</p>
                                        <p className={`text-xs font-black mt-1 ${paciente?.alergias ? 'text-red-700' : 'text-gray-700'}`}>
                                            {paciente?.alergias || 'Ninguna registrada'}
                                        </p>
                                    </div>
                                    <div className="p-3.5 rounded-xl border bg-gray-50 border-gray-100">
                                        <p className="text-[10px] font-black uppercase text-gray-500">Condiciones Médicas / Crónicas</p>
                                        <p className="text-xs font-black text-gray-800 mt-1">
                                            {paciente?.condicionesMedicas || 'Ninguna registrada'}
                                        </p>
                                    </div>
                                    <div className="p-3.5 rounded-xl border bg-gray-50 border-gray-100">
                                        <p className="text-[10px] font-black uppercase text-gray-500">Medicamentos Actuales</p>
                                        <p className="text-xs font-black text-gray-800 mt-1">
                                            {paciente?.medicamentosActuales || 'Ninguno registrado'}
                                        </p>
                                    </div>
                                    <div className="p-3.5 rounded-xl border bg-gray-50 border-gray-100">
                                        <p className="text-[10px] font-black uppercase text-gray-500">Cirugías Previas / Estéticas</p>
                                        <p className="text-xs font-black text-gray-800 mt-1">
                                            {paciente?.cirugiasPrevias || 'Ninguna reportada'}
                                        </p>
                                    </div>
                                    <div className="p-3.5 rounded-xl border bg-gray-50 border-gray-100">
                                        <p className="text-[10px] font-black uppercase text-gray-500">Implantes Metálicos / Marcapasos</p>
                                        <p className="text-xs font-black text-gray-800 mt-1">
                                            {paciente?.implantesMetalicos || 'No'}
                                        </p>
                                    </div>
                                    <div className="p-3.5 rounded-xl border bg-gray-50 border-gray-100">
                                        <p className="text-[10px] font-black uppercase text-gray-500">Cicatrización / Queloide</p>
                                        <p className="text-xs font-black text-gray-800 mt-1">
                                            {paciente?.cicatrizacionQueloide || 'Normal'}
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            {/* CARD 2: SALUD FEMENINA & ESTILO DE VIDA */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-pink-600 flex items-center gap-2">
                                        🌸 2. Salud Femenina & Gineco-Obstétrica
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl bg-pink-50/40 border border-pink-100">
                                            <p className="text-[10px] font-black uppercase text-gray-500">Embarazo / Lactancia</p>
                                            <p className="text-xs font-black text-gray-800 mt-1">
                                                {paciente?.embarazoLactancia || 'No'}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-pink-50/40 border border-pink-100">
                                            <p className="text-[10px] font-black uppercase text-gray-500">Método Anticonceptivo</p>
                                            <p className="text-xs font-black text-gray-800 mt-1">
                                                {paciente?.metodoAnticonceptivo || 'Ninguno reportado'}
                                            </p>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 flex items-center gap-2">
                                        🌿 3. Hábitos Biológicos & Estilo de Vida
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-100">
                                            <p className="text-[10px] font-black uppercase text-gray-500">Agua Diaria</p>
                                            <p className="text-xs font-black text-gray-800 mt-1">
                                                {paciente?.consumoAguaLitros ? `${paciente.consumoAguaLitros} Lts / día` : '1.5 Lts / día'}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-100">
                                            <p className="text-[10px] font-black uppercase text-gray-500">Actividad Física</p>
                                            <p className="text-xs font-black text-gray-800 mt-1">
                                                {paciente?.actividadFisica || 'Sedentario'}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-100">
                                            <p className="text-[10px] font-black uppercase text-gray-500">Tabaquismo / Alcohol</p>
                                            <p className="text-xs font-black text-gray-800 mt-1">
                                                {paciente?.tabaquismo || 'No'}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-100">
                                            <p className="text-[10px] font-black uppercase text-gray-500">Protector Solar</p>
                                            <p className="text-xs font-black text-gray-800 mt-1">
                                                {paciente?.protectorSolar || 'Diario'}
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* CARD 3: VALORACIÓN COSMIÁTRICA & DEMOGRÁFICA */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-turquesa flex items-center gap-2">
                                        ✨ 4. Valoración Cosmiátrica Inicial
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl bg-teal-50/40 border border-teal-100">
                                            <p className="text-[10px] font-black uppercase text-gray-500">Fototipo Cutáneo</p>
                                            <p className="text-xs font-black text-gray-800 mt-1">
                                                {paciente?.fototipoCutaneo || 'IV (Morena clara)'}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-teal-50/40 border border-teal-100">
                                            <p className="text-[10px] font-black uppercase text-gray-500">Biotipo Cutáneo</p>
                                            <p className="text-xs font-black text-gray-800 mt-1">
                                                {paciente?.biotipoCutaneo || 'Mixta'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                                        <p className="text-[10px] font-black uppercase text-gray-500">Zonas Prioritarias / Motivo de Interés</p>
                                        <p className="text-xs font-black text-gray-800 mt-1">
                                            {paciente?.zonasInteres || paciente?.tipoTratamiento || 'Por definir'}
                                        </p>
                                    </div>
                                </Card>

                                <Card className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-2">
                                        👤 5. Datos Personales & Emergencia
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                                            <p className="text-[10px] font-black uppercase text-gray-500">Teléfono / WhatsApp</p>
                                            <p className="text-xs font-black text-gray-800 mt-1 flex items-center justify-between">
                                                <span>{paciente?.telefono || '—'}</span>
                                                {paciente?.telefono && (
                                                    <a
                                                        href={`https://wa.me/52${paciente.telefono.replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-emerald-600 hover:text-emerald-700"
                                                        title="Abrir WhatsApp"
                                                    >
                                                        <MessageSquare size={13} />
                                                    </a>
                                                )}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                                            <p className="text-[10px] font-black uppercase text-gray-500">Fecha Nacimiento & Edad</p>
                                            <p className="text-xs font-black text-gray-800 mt-1">
                                                {paciente?.fechaNacimiento
                                                    ? `${paciente.fechaNacimiento} (${calcularEdad(paciente.fechaNacimiento)} años)`
                                                    : '—'}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                                            <p className="text-[10px] font-black uppercase text-gray-500">Ocupación</p>
                                            <p className="text-xs font-black text-gray-800 mt-1">{paciente?.ocupacion || '—'}</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                                            <p className="text-[10px] font-black uppercase text-gray-500">Contacto de Emergencia</p>
                                            <p className="text-xs font-black text-gray-800 mt-1">
                                                {paciente?.contactoEmergenciaTelefono || '—'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                                        <span className="text-xs text-gray-500 font-bold">Especialista Asignado:</span>
                                        <span className="text-xs font-black text-acero">{paciente?.especialistaAsignadoNombre || 'Selene Mayret Farias Perez'}</span>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* SECCIÓN DE CONSENTIMIENTOS INFORMADOS DEL PACIENTE (MODELOS AMPLIOS) */}
                    <Card className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                            <div>
                                <h3 className="text-xs font-black text-acero uppercase tracking-widest flex items-center gap-2">
                                    <FileSignature size={16} className="text-turquesa" /> Catálogo de Consentimientos Informados ({CONSENT_TEMPLATES.length} Modelos Disponibles)
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Genera, revisa o descarga en PDF cualquier documento informado legal para tratamientos faciales, corporales y cartas compromiso.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
                            <select
                                className="flex-1 min-w-[260px] px-3.5 py-2 border border-gray-300 rounded-xl text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-turquesa"
                                value={selectedConsentFicha}
                                onChange={e => setSelectedConsentFicha(e.target.value)}
                            >
                                <option value="">Seleccionar consentimiento informado...</option>
                                <optgroup label="✨ Procedimientos Faciales">
                                    {CONSENT_TEMPLATES.filter(t => t.categoria === 'Facial').map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="💪 Procedimientos Corporales">
                                    {CONSENT_TEMPLATES.filter(t => t.categoria === 'Corporal').map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="⚡ Láser y Fototerapia Médica">
                                    {CONSENT_TEMPLATES.filter(t => t.categoria === 'Láser').map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="📋 Generales & Cartas Compromiso 50/50">
                                    {CONSENT_TEMPLATES.filter(t => t.categoria === 'General').map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </optgroup>
                            </select>

                            <Button
                                size="sm"
                                variant="primary"
                                disabled={!selectedConsentFicha}
                                onClick={() => {
                                    const tmpl = CONSENT_TEMPLATES.find(t => t.id === selectedConsentFicha);
                                    if (tmpl) {
                                        generarPDFConsentimientoUniversal(jsPDF, tmpl, paciente, auth.currentUser?.displayName, logoData);
                                    }
                                }}
                                className="flex items-center gap-1.5"
                            >
                                <Printer size={14} /> Generar y Descargar PDF
                            </Button>
                        </div>

                        {/* Muestrario de Documentos del Paciente */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {CONSENT_TEMPLATES.slice(0, 6).map(tmpl => (
                                <div key={tmpl.id} className="p-3 rounded-xl border border-gray-200 bg-white hover:border-turquesa/50 transition-all flex items-center justify-between gap-2 shadow-2xs">
                                    <div className="truncate">
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                            tmpl.categoria === 'Facial' ? 'bg-purple-100 text-purple-700' : tmpl.categoria === 'Corporal' ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-700'
                                        }`}>
                                            {tmpl.categoria}
                                        </span>
                                        <p className="text-xs font-black text-gray-800 truncate mt-1">{tmpl.name}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => generarPDFConsentimientoUniversal(jsPDF, tmpl, paciente, auth.currentUser?.displayName, logoData)}
                                        className="p-1.5 text-turquesa hover:bg-turquesa/10 rounded-lg shrink-0 cursor-pointer"
                                        title="Descargar este modelo en PDF"
                                    >
                                        <Download size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Historial de Citas del Paciente */}
                    <Card className="space-y-3">
                        <h3 className="text-xs font-black text-acero uppercase tracking-widest flex items-center gap-2">
                            <Calendar size={15} className="text-turquesa" /> Historial de Citas del Paciente ({citasHistorial.length})
                        </h3>
                        {citasHistorial.length === 0 ? (
                            <p className="text-xs text-gray-400 py-4">No hay citas registradas para este paciente.</p>
                        ) : (
                            <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                                {citasHistorial.map(c => (
                                    <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                                        <div>
                                            <span className="font-black text-acero">
                                                {c.fechaHora ? new Date(c.fechaHora).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : c.fecha}
                                            </span>
                                            <span className="ml-2 font-bold text-gray-600">— {c.servicio}</span>
                                            {c.especialistaNombre && <span className="ml-2 text-gray-400">({c.especialistaNombre})</span>}
                                        </div>
                                        <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${
                                            c.status === 'Completada' ? 'bg-green-50 text-green-700' : c.status === 'Cancelada' ? 'bg-red-50 text-red-600' : 'bg-turquesa/10 text-acero'
                                        }`}>
                                            {c.status || 'Pendiente'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            )}

{/* Modal Confirmar Eliminación de Sesión */}
            {sesionToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="w-12 h-12 rounded-full bg-red-100 text-red-500 flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={24} />
                        </div>
                        <h3 className="text-lg font-black text-center text-acero mb-2">¿Eliminar Sesión?</h3>
                        <p className="text-center text-gray-500 text-sm mb-6">
                            Estás a punto de borrar la sesión del <strong>{new Date(sesionToDelete.fecha).toLocaleDateString('es-MX')}</strong>.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setSesionToDelete(null)}>Cancelar</Button>
                            <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white border-0" onClick={confirmEliminarSesion}>Eliminar</Button>
                        </div>
                    </div>
                </div>
            )}

            {showSuccessToast && (
                <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 animate-bounce">
                    <div className="bg-green-500 rounded-full p-1"><CheckCircle size={16} className="text-white" /></div>
                    <span className="font-bold">Cuidados guardados correctamente</span>
                </div>
            )}

            {showRiesgoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 bg-gradient-to-r from-[#1a2a3a] to-[#2d4a5a] text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-xl flex items-center gap-2"><Target size={20} className="text-turquesa" /> Vulnerabilidad Horaria</h3>
                                <p className="text-sm text-gray-300">Análisis global de consumo calórico por horario</p>
                            </div>
                            <button onClick={() => setShowRiesgoModal(false)} className="text-white/70 hover:text-white bg-white/10 p-2 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-8 flex-1 overflow-y-auto">
                            {(() => {
                                try {
                                    const horasObj = { 'Mañana': 0, 'Tarde': 0, 'Noche': 0, 'Madrugada': 0 };
                                    trackersDelTratamiento.forEach(t => {
                                        (t.alimentos || t.data?.alimentos || []).forEach(a => {
                                            const hour = a.hora ? parseInt(a.hora.split(':')[0]) : 14;
                                            if (hour >= 6 && hour < 12) horasObj['Mañana'] += Number(a.calorias) || 0;
                                            else if (hour >= 12 && hour < 19) horasObj['Tarde'] += Number(a.calorias) || 0;
                                            else if (hour >= 19 && hour < 24) horasObj['Noche'] += Number(a.calorias) || 0;
                                            else horasObj['Madrugada'] += Number(a.calorias) || 0;
                                        });
                                    });
                                    const rData = [
                                        { hora: '6:00 - 11:59', calorias: horasObj['Mañana'] },
                                        { hora: '12:00 - 18:59', calorias: horasObj['Tarde'] },
                                        { hora: '19:00 - 23:59', calorias: horasObj['Noche'] },
                                        { hora: '00:00 - 5:59', calorias: horasObj['Madrugada'] }
                                    ];
                                    const maxCal = Math.max(...rData.map(d => d.calorias));
                                    const dangerZone = maxCal > 0 ? rData.find(d => d.calorias === maxCal) : null;
                                    return (
                                        <>
                                            {dangerZone ? (
                                                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl mb-6 flex items-start gap-4">
                                                    <div className="p-3 bg-red-100 text-red-500 rounded-xl"><AlertCircle size={24} /></div>
                                                    <div>
                                                        <h4 className="font-black text-red-800">Alerta de Vulnerabilidad</h4>
                                                        <p className="text-sm text-red-600">Mayor consumo calórico en el bloque de <strong>{dangerZone.hora}</strong> ({dangerZone.calorias} kcal acumuladas).</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-green-50 border border-green-100 p-4 rounded-2xl mb-6 flex items-start gap-4">
                                                    <div className="p-3 bg-green-100 text-green-600 rounded-xl"><CheckCircle size={24} /></div>
                                                    <div>
                                                        <h4 className="font-black text-green-800">Sin Datos Suficientes</h4>
                                                        <p className="text-sm text-green-700">Aún no hay registros calóricos suficientes para calcular la vulnerabilidad.</p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="h-64">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={rData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                                        <XAxis dataKey="hora" stroke="#9ca3af" fontSize={11} />
                                                        <YAxis stroke="#9ca3af" fontSize={11} />
                                                        <Tooltip />
                                                        <Bar dataKey="calorias" name="Calorías Acumuladas" radius={[6, 6, 0, 0]}>
                                                            {rData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={(entry.calorias === maxCal && maxCal > 0) ? '#f43f5e' : '#20b2aa'} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </>
                                    );
                                } catch (error) {
                                    return <div className="text-red-500 p-4">Error al generar gráfica.</div>;
                                }
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
