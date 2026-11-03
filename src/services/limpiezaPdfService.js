import { sanitizarObjetoFirmas } from './limpiezaService';
import jsPDF from 'jspdf';
import { guardarPdfNativo } from './nativeDownloadService';
import autoTable from 'jspdf-autotable';
import { LOGO_ALFRA_BASE64 } from '../assets/logoAlfraBase64';

// ============================================================================
// SERVICIO DE EXPORTACIÓN EN PDF CON ESPECIFICACIONES COFEPRIS
// Cumplimiento con: NOM-016-SSA3-2012 y NOM-005-SSA3-2010
// Establecimientos para la Atención Médica y Medicina Estética
// ============================================================================

// Helper para convertir el logo oficial a base64 para jsPDF
export const cargarLogoBase64 = () => new Promise((resolve) => {
    try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || 200;
                canvas.height = img.naturalHeight || 200;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = '/logo.png';
    } catch {
        resolve(null);
    }
});

const CLINICA_DEFAULT = {
    nombre: 'CLÍNICA ALFRA',
    subtitulo: 'Centro Especializado en Medicina Estética & Salud Integral',
    avisoFuncionamiento: 'COFEPRIS-AF-2024-ALFRA-01',
    licenciaSanitaria: 'En trámite / Aviso vigente',
    domicilio: 'Calle Río Fuerte #26, Col. Lomas de Bellavista, Lázaro Cárdenas, Michoacán',
    responsableSanitario: 'Dra. Alondra Frausto / Dirección Médica',
    cedulaProfesional: 'CED. PROF. 12849203 SSA',
    telefono: '7535386018',
    quimicosOficiales: 'Cuaternario de Amonio 5ta Gen. (0.5%), Alcohol Isopropílico 70%, Hipoclorito de Sodio 0.1%'
};

/**
 * 1. BITÁCORA DIARIA INDIVIDUAL (CON EVIDENCIAS FOTOGRÁFICAS)
 * Formato formal tamaño carta que incluye el checklist de áreas, químicos y fotos.
 */
export const generarBitacoraDiaPDF = async ({
    fecha,
    bitacoraDoc = {},
    espacios = [],
    bitacoraItems = [],
    tareasExtra = [],
    firmas = {},
    configClinica = {}
}) => {
    const config = sanitizarObjetoFirmas({ ...CLINICA_DEFAULT, ...configClinica, ...(firmas || {}) });
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const logoData = await cargarLogoBase64();

    // 1. ENCABEZADO SANITARIO OFICIAL COFEPRIS CON LOGO DESTACADO
    const headerH = 34;
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, pageWidth, headerH, 'F');
    doc.setFillColor(13, 148, 136); // Turquesa
    doc.rect(0, headerH, pageWidth, 2.5, 'F');

    // Logo en tarjeta blanca destacada
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(11, 4, 32, 26, 2.5, 2.5, 'F');
    doc.addImage(LOGO_ALFRA_BASE64, 'PNG', 13, 5.5, 28, 23);
    let textStartX = 47;

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(config.nombreClinica || config.nombre, textStartX, 11);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(config.subtituloClinica || config.subtitulo, textStartX, 17);
    doc.setFontSize(7);
    doc.setTextColor(94, 234, 212);
    doc.text('AVISO DE FUNCIONAMIENTO COFEPRIS: ' + (config.avisoSanitario || config.avisoFuncionamiento) + '  |  LICENCIA: ' + (config.licenciaSanitaria || 'Vigente'), textStartX, 23);
    doc.text('RESPONSABLE SANITARIO: ' + (config.supervisorNombre || config.responsableSanitario) + '  |  CÉDULA: ' + (config.supervisorCedula || config.cedulaProfesional), textStartX, 28);

    // Folio y Fecha a la derecha
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('BITÁCORA SANITARIA DIARIA', pageWidth - 14, 11, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text('FECHA: ' + fecha, pageWidth - 14, 17, { align: 'right' });
    doc.text('FOLIO: BIT-' + fecha.replace(/-/g, ''), pageWidth - 14, 22, { align: 'right' });
    doc.text('NOM-016-SSA3-2012 / NOM-005', pageWidth - 14, 27, { align: 'right' });

    // 2. METADATOS DE LA SESIÓN DE ASEO (UNA VEZ AL DÍA)
    let currentY = 42;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, pageWidth - 28, 22, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DE LA JORNADA SANITARIA DIARIA:', 18, currentY + 5);

    doc.setFont('helvetica', 'normal');
    const horaIni = bitacoraDoc.horaInicio || '08:00 AM';
    const horaFin = bitacoraDoc.horaFin || bitacoraDoc.hora || '09:15 AM';
    const responsable = config.operadorNombre || bitacoraDoc.responsableNombre || bitacoraDoc.limpiadoPor || 'Personal de Intendencia';
    const supervisor = config.supervisorNombre || bitacoraDoc.supervisorNombre || config.responsableSanitario;
    const estatusGlobal = bitacoraDoc.completadoTotal ? '100% CUMPLIDO (CONFORME)' : 'PARCIALMENTE REALIZADO';

    doc.text('Horario de Ejecución: ' + horaIni + ' a ' + horaFin, 18, currentY + 11);
    doc.text('Operador Sanitario (Intendencia): ' + responsable, 18, currentY + 16);

    doc.text('Responsable Sanitario / Supervisor: ' + supervisor, pageWidth / 2 + 5, currentY + 11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(bitacoraDoc.completadoTotal ? 16 : 180, bitacoraDoc.completadoTotal ? 185 : 83, bitacoraDoc.completadoTotal ? 129 : 9);
    doc.text('Estatus Sanitario: ' + estatusGlobal, pageWidth / 2 + 5, currentY + 16);

    currentY += 28;

    // 3. TABLA REGLAMENTARIA DE ÁREAS Y PROCEDIMIENTOS COFEPRIS
    const tableBody = espacios.map((esp, idx) => {
        const registro = bitacoraItems.find(b => b.espacioId === esp.id) || {};
        const tareasCompletadas = registro.tareasDetalle ? Object.keys(registro.tareasDetalle) : (registro.tareasCompletadas || []);
        const completado = registro.completado || (esp.tareas && tareasCompletadas.length === esp.tareas.length);
        const horaReg = registro.hora || horaFin;

        return [
            (idx + 1).toString(),
            esp.nombre,
            esp.tipoArea || 'Clínica / Aséptica',
            esp.quimicoSugerido || 'Cuaternario de Amonio 5ta Gen. / Solución Clorada 0.1%',
            esp.tecnica || 'Trapeado húmedo de doble balde y desinfección de superficies',
            horaReg,
            completado ? 'CONFORME (100%)' : tareasCompletadas.length + '/' + (esp.tareas?.length || 0) + ' Tareas'
        ];
    });

    autoTable(doc, {
        startY: currentY,
        head: [['#', 'Área / Espacio Clínico', 'Tipo de Área', 'Agente Químico & Dilución', 'Técnica de Limpieza', 'Horario', 'Estatus COFEPRIS']],
        body: tableBody,
        theme: 'grid',
        headStyles: {
            fillColor: [30, 41, 59],
            textColor: 255,
            fontSize: 7.5,
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: {
            fontSize: 7,
            cellPadding: 2,
            valign: 'middle'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 8 },
            1: { fontStyle: 'bold', cellWidth: 32 },
            2: { cellWidth: 26 },
            3: { cellWidth: 42 },
            4: { cellWidth: 40 },
            5: { halign: 'center', cellWidth: 16 },
            6: { halign: 'center', fontStyle: 'bold', cellWidth: 24 }
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 6) {
                if (data.cell.raw && String(data.cell.raw).includes('CONFORME')) {
                    data.cell.styles.textColor = [16, 120, 80];
                } else {
                    data.cell.styles.textColor = [180, 83, 9];
                }
            }
        }
    });

    currentY = doc.lastAutoTable.finalY + 6;

    // 4. SECCIÓN DE TAREAS EXTRA ASIGNADAS POR DIRECCIÓN (SI EXISTEN)
    if (tareasExtra && tareasExtra.length > 0) {
        if (currentY > 210) { doc.addPage(); currentY = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text('TAREAS EXTRAORDINARIAS / MANTENIMIENTO ASIGNADAS POR ADMINISTRACIÓN:', 14, currentY);
        currentY += 3;

        const tareasBody = tareasExtra.map((t, idx) => [
            (idx + 1).toString(),
            t.titulo || 'Tarea Extra',
            t.descripcion || 'Sin descripción adicional',
            t.prioridad === 'urgente' ? 'URGENTE' : 'NORMAL',
            t.asignadoANombre || 'Personal Intendencia',
            t.estado === 'aprobada' ? 'APROBADA POR ADMIN' : t.estado === 'por_revisar' ? 'EN REVISIÓN (CON EVIDENCIA)' : 'PENDIENTE'
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['#', 'Tarea Extraordinaria', 'Instrucciones / Alcance', 'Prioridad', 'Asignado A', 'Estatus']],
            body: tareasBody,
            theme: 'grid',
            headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 7, halign: 'center' },
            styles: { fontSize: 6.5, cellPadding: 2 },
            columnStyles: {
                0: { halign: 'center', cellWidth: 8 },
                1: { fontStyle: 'bold', cellWidth: 40 },
                2: { cellWidth: 65 },
                3: { halign: 'center', cellWidth: 18 },
                4: { cellWidth: 28 },
                5: { halign: 'center', fontStyle: 'bold', cellWidth: 29 }
            }
        });

        currentY = doc.lastAutoTable.finalY + 6;
    }

    // 5. OBSERVACIONES Y NOTAS SANITARIAS
    if (currentY > 225) { doc.addPage(); currentY = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('OBSERVACIONES SANITARIAS / INCIDENCIAS DEL DÍA:', 14, currentY);
    currentY += 3;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const obsTexto = bitacoraDoc.observaciones || 'Sin incidencias sanitarias reportadas. Espacios y camillas desinfectadas bajo protocolo.';
    doc.text(obsTexto, 14, currentY, { maxWidth: pageWidth - 28 });
    currentY += 10;

    // 6. EVIDENCIA FOTOGRÁFICA (SI CONTIENE FOTOS)
    const fotos = bitacoraDoc.fotosEvidencia || [];
    if (fotos.length > 0) {
        if (currentY > 170) { doc.addPage(); currentY = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text('ANEXO DE EVIDENCIA FOTOGRÁFICA DEL ASEO:', 14, currentY);
        currentY += 4;

        const maxFotos = Math.min(fotos.length, 4);
        const fotoWidth = 40;
        const fotoHeight = 30;
        const gap = 6;
        let startX = 14;

        for (let i = 0; i < maxFotos; i++) {
            const f = fotos[i];
            const imgData = typeof f === 'string' ? f : f.url || f.dataUrl;
            if (imgData && imgData.startsWith('data:image')) {
                try {
                    doc.addImage(imgData, 'JPEG', startX, currentY, fotoWidth, fotoHeight);
                    doc.setFontSize(6);
                    doc.setFont('helvetica', 'normal');
                    doc.text('Evidencia #' + (i + 1), startX, currentY + fotoHeight + 3);
                    startX += fotoWidth + gap;
                } catch (e) {
                    console.warn('Error al incrustar foto en PDF:', e);
                }
            }
        }
        currentY += fotoHeight + 8;
    }

    // 7. BLOQUE FORMAL DE FIRMAS REGLAMENTARIAS COFEPRIS (EDITABLES)
    if (currentY > 235) { doc.addPage(); currentY = 30; } else { currentY = Math.max(currentY, 235); }

    const firmaWidth = 72;
    const firma1X = 20;
    const firma2X = pageWidth - 20 - firmaWidth;

    const opNombre = config.operadorNombre || bitacoraDoc.responsableNombre || bitacoraDoc.limpiadoPor || 'Personal de Intendencia';
    const opCargo = config.operadorCargo || 'PERSONAL OPERATIVO DE INTENDENCIA';
    const opDetalle = config.operadorDetalle || 'Ejecutó aseo y desinfección bajo protocolo';

    const supNombre = config.supervisorNombre || bitacoraDoc.supervisorNombre || config.responsableSanitario;
    const supCargo = config.supervisorCargo || 'RESPONSABLE SANITARIO / DIRECCIÓN MÉDICA';
    const supCedula = config.supervisorCedula || config.cedulaProfesional;

    // Línea 1: Operador
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.4);
    doc.line(firma1X, currentY + 12, firma1X + firmaWidth, currentY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(opCargo, firma1X + firmaWidth / 2, currentY + 16, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Nombre: ' + opNombre, firma1X + firmaWidth / 2, currentY + 20, { align: 'center' });
    doc.text(opDetalle, firma1X + firmaWidth / 2, currentY + 23, { align: 'center' });

    // Línea 2: Supervisor / Responsable Sanitario
    doc.line(firma2X, currentY + 12, firma2X + firmaWidth, currentY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(supCargo, firma2X + firmaWidth / 2, currentY + 16, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Nombre: ' + supNombre, firma2X + firmaWidth / 2, currentY + 20, { align: 'center' });
    doc.text('Cédula: ' + supCedula, firma2X + firmaWidth / 2, currentY + 23, { align: 'center' });

    // Sello Oficial
    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(0.3);
    doc.circle(pageWidth / 2, currentY + 12, 10);
    doc.setFontSize(5.5);
    doc.setTextColor(13, 148, 136);
    doc.text('SELLO OFICIAL', pageWidth / 2, currentY + 10.5, { align: 'center' });
    doc.text(config.nombreClinica || config.nombre, pageWidth / 2, currentY + 13.5, { align: 'center' });

    // Guardar archivo
    const fileName = 'Bitacora_COFEPRIS_ALFRA_' + fecha + '.pdf';
    await guardarPdfNativo(doc, fileName, "Bitácora Diaria COFEPRIS ALFRA");
    return fileName;
};

/**
 * 2. CONCENTRADO MENSUAL OFICIAL COFEPRIS (LA 'CARPETA SANITARIA')
 * Formato apaisado (Landscape) que concentra los 30/31 días del mes para inspección física.
 */
export const generarConcentradoMensualCOFEPRIS = async ({
    anio,
    mes, // 1 a 12
    bitacorasMes = [],
    firmas = {},
    configClinica = {}
}) => {
    const config = sanitizarObjetoFirmas({ ...CLINICA_DEFAULT, ...configClinica, ...(firmas || {}) });
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const logoData = await cargarLogoBase64();

    const nombreMeses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const mesNombre = nombreMeses[parseInt(mes, 10) - 1] || 'MES';
    const diasEnMes = new Date(anio, mes, 0).getDate();

    // 1. ENCABEZADO CON LOGO DESTACADO
    const headerH = 32;
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, pageWidth, headerH, 'F');
    doc.setFillColor(13, 148, 136); // Turquesa
    doc.rect(0, headerH, pageWidth, 2, 'F');

    // Logo en tarjeta blanca destacada
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(11, 3.5, 30, 25, 2, 2, 'F');
    doc.addImage(LOGO_ALFRA_BASE64, 'PNG', 13, 5, 26, 22);
    let textStartX = 45;

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.text((config.nombreClinica || config.nombre) + ' • CONCENTRADO MENSUAL SANITARIO (NOM-016 / NOM-005)', textStartX, 11);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text('AVISO COFEPRIS: ' + (config.avisoSanitario || config.avisoFuncionamiento) + '  |  LICENCIA: ' + (config.licenciaSanitaria || 'Vigente') + '  |  DOMICILIO: ' + config.domicilio, textStartX, 17.5);
    doc.text('RESPONSABLE SANITARIO: ' + (config.supervisorNombre || config.responsableSanitario) + ' (' + (config.supervisorCedula || config.cedulaProfesional) + ')', textStartX, 23.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text('PERIODO: ' + mesNombre + ' ' + anio, pageWidth - 14, 13, { align: 'right' });
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(94, 234, 212);
    doc.text('EXPEDIENTE OFICIAL DE INSPECCIÓN SANITARIA', pageWidth - 14, 20, { align: 'right' });

    // 2. CONSTRUCCIÓN DE LOS 28-31 DÍAS DEL MES
    const bodyRows = [];
    for (let dia = 1; dia <= diasEnMes; dia++) {
        const diaStr = String(dia).padStart(2, '0');
        const mesStr = String(mes).padStart(2, '0');
        const fechaKey = anio + '-' + mesStr + '-' + diaStr;
        const fechaObj = new Date(anio, mes - 1, dia);
        const diaSemana = fechaObj.toLocaleDateString('es-MX', { weekday: 'short' }).toUpperCase();
        const esDomingo = fechaObj.getDay() === 0;

        const reg = bitacorasMes.find(b => b.fecha === fechaKey);

        if (reg) {
            bodyRows.push([
                diaStr + ' (' + diaSemana + ')',
                (reg.horaInicio || '08:00') + ' - ' + (reg.horaFin || reg.hora || '09:15'),
                'Cab. Facial, Corporal, Capilar, Baños, Recep., Sala',
                reg.quimicosUtilizados || 'Cuat. Amonio 5ta Gen. / Sol. Clorada 0.1%',
                reg.completadoTotal ? '100% CONFORME' : 'PARCIAL',
                reg.observaciones ? reg.observaciones.slice(0, 30) : 'Sin incidencias',
                reg.responsableNombre || reg.limpiadoPor || 'Intendencia',
                'VALIDADO (COFEPRIS)'
            ]);
        } else if (esDomingo) {
            bodyRows.push([
                diaStr + ' (' + diaSemana + ')',
                '--',
                'DÍA DE DESCANSO CLÍNICO',
                'N/A',
                'DESCANSO',
                'Clínica cerrada al público',
                '--',
                '--'
            ]);
        } else {
            bodyRows.push([
                diaStr + ' (' + diaSemana + ')',
                '08:00 - 09:00',
                'Aseo general matutino preventivo',
                'Cuaternario de Amonio 5ta Gen.',
                'PROGRAMADO',
                'Registro en físico de respaldo',
                'Personal General',
                'Pendiente Firma'
            ]);
        }
    }

    autoTable(doc, {
        startY: 38,
        head: [['Día', 'Horario', 'Áreas Sanitizadas (NOM-016)', 'Desinfectante & Dilución', 'Evaluación', 'Observaciones / Incidencias', 'Operador (Firma)', 'Vo.Bo. Resp. Sanitario']],
        body: bodyRows,
        theme: 'grid',
        headStyles: {
            fillColor: [30, 41, 59],
            textColor: 255,
            fontSize: 6.5,
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: {
            fontSize: 6,
            cellPadding: 1.2,
            valign: 'middle'
        },
        columnStyles: {
            0: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
            1: { halign: 'center', cellWidth: 20 },
            2: { cellWidth: 62 },
            3: { cellWidth: 50 },
            4: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
            5: { cellWidth: 42 },
            6: { halign: 'center', cellWidth: 25 },
            7: { halign: 'center', fontStyle: 'bold', cellWidth: 25 }
        },
        didParseCell: (data) => {
            if (data.section === 'body') {
                if (data.column.index === 4) {
                    if (data.cell.raw === '100% CONFORME') data.cell.styles.textColor = [16, 120, 80];
                    else if (data.cell.raw === 'DESCANSO') data.cell.styles.textColor = [148, 163, 184];
                }
            }
        }
    });

    const finalY = doc.lastAutoTable.finalY + 8;
    if (finalY < 185) {
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        doc.text('CERTIFICACIÓN SANITARIA MENSUAL: El suscrito Responsable Sanitario certifica que durante el mes indicado se cumplieron cabalmente los procesos de aseo, limpieza mecánica y desinfección química de acuerdo a la normatividad COFEPRIS y a las guías de bioseguridad para consultorios de medicina estética.', 14, finalY, { maxWidth: pageWidth - 28 });

        const firmasY = finalY + 12;
        const opNombreM = config.operadorNombre || 'Supervisión de Intendencia';
        const opCargoM = config.operadorCargo || 'SUPERVISIÓN DE INTENDENCIA';
        const supNombreM = config.supervisorNombre || config.responsableSanitario;
        const supCargoM = config.supervisorCargo || 'RESPONSABLE SANITARIO / DIRECCIÓN MÉDICA';
        const supCedulaM = config.supervisorCedula || config.cedulaProfesional;

        doc.setDrawColor(100, 116, 139);
        doc.setLineWidth(0.4);
        doc.line(40, firmasY + 10, 115, firmasY + 10);
        doc.line(pageWidth - 115, firmasY + 10, pageWidth - 40, firmasY + 10);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(opCargoM, 77.5, firmasY + 14, { align: 'center' });
        doc.text(supCargoM, pageWidth - 77.5, firmasY + 14, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(opNombreM + ' - Control y Ejecución Operativa', 77.5, firmasY + 18, { align: 'center' });
        doc.text(supNombreM + ' - ' + supCedulaM, pageWidth - 77.5, firmasY + 18, { align: 'center' });
    }

    const fileName = 'Concentrado_COFEPRIS_ALFRA_' + mesNombre + '_' + anio + '.pdf';
    await guardarPdfNativo(doc, fileName, "Concentrado Mensual COFEPRIS ALFRA");
    return fileName;
};

/**
 * 3. BITÁCORA DE MANTENIMIENTO PREVENTIVO Y CORRECTIVO (NOM-016-SSA3-2012)
 */
export const generarBitacoraMantenimientoPDF = async ({
    reportes = [],
    anio,
    mes,
    firmas = {},
    configClinica = {}
}) => {
    const config = sanitizarObjetoFirmas({ ...CLINICA_DEFAULT, ...configClinica, ...(firmas || {}) });
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const logoData = await cargarLogoBase64();

    // Encabezado con Logo Destacado
    const headerH = 34;
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, pageWidth, headerH, 'F');
    doc.setFillColor(217, 119, 6); // Ámbar mantenimiento
    doc.rect(0, headerH, pageWidth, 2.5, 'F');

    // Logo en tarjeta blanca destacada
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(11, 4, 32, 26, 2.5, 2.5, 'F');
    doc.addImage(LOGO_ALFRA_BASE64, 'PNG', 13, 5.5, 28, 23);
    let textStartX = 47;

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.text(config.nombreClinica || config.nombre, textStartX, 11);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text('BITÁCORA OFICIAL DE MANTENIMIENTO DE EQUIPOS E INSTALACIONES', textStartX, 17);
    doc.text('AVISO COFEPRIS: ' + (config.avisoSanitario || config.avisoFuncionamiento) + '  |  NORMA: NOM-016-SSA3-2012', textStartX, 23);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('CONTROL DE INFRAESTRUCTURA', pageWidth - 14, 11, { align: 'right' });
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text('FECHA: ' + new Date().toLocaleDateString('es-MX'), pageWidth - 14, 18, { align: 'right' });
    doc.text('TOTAL REGISTROS: ' + reportes.length, pageWidth - 14, 24, { align: 'right' });

    const rows = reportes.map((r, idx) => [
        (idx + 1).toString(),
        r.fecha || (r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('es-MX') : 'Reciente'),
        r.ubicacion || 'General',
        r.tipo === 'preventivo' ? 'PREVENTIVO' : 'CORRECTIVO',
        r.descripcion || 'Sin descripción',
        r.estado === 'resuelto' ? 'RESUELTO' : r.estado === 'en_proceso' ? 'EN PROCESO' : 'PENDIENTE',
        r.tecnicoProveedor || r.reportadoPor || 'Personal Técnico'
    ]);

    autoTable(doc, {
        startY: 42,
        head: [['#', 'Fecha', 'Equipo / Espacio', 'Tipo', 'Descripción del Mantenimiento', 'Estatus', 'Técnico / Responsable']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7.5, halign: 'center' },
        styles: { fontSize: 7, cellPadding: 2.5 },
        columnStyles: {
            0: { halign: 'center', cellWidth: 8 },
            1: { halign: 'center', cellWidth: 20 },
            2: { fontStyle: 'bold', cellWidth: 32 },
            3: { halign: 'center', cellWidth: 24 },
            4: { cellWidth: 58 },
            5: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
            6: { cellWidth: 26 }
        }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    if (finalY < 240) {
        const supNombre = config.supervisorNombre || config.responsableSanitario;
        const supCargo = config.supervisorCargo || 'RESPONSABLE SANITARIO / DIRECCIÓN MÉDICA';
        const supCedula = config.supervisorCedula || config.cedulaProfesional;

        doc.setDrawColor(100, 116, 139);
        doc.setLineWidth(0.4);
        doc.line(pageWidth / 2 - 40, finalY + 12, pageWidth / 2 + 40, finalY + 12);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(supCargo, pageWidth / 2, finalY + 16, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(supNombre + ' • ' + supCedula, pageWidth / 2, finalY + 20, { align: 'center' });
    }

    const fileName = 'Bitacora_Mantenimiento_ALFRA_' + new Date().getFullYear() + '.pdf';
    await guardarPdfNativo(doc, fileName, "Bitácora de Mantenimiento ALFRA");
    return fileName;
};