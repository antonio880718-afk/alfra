/**
 * Generador profesional de Reportes Ejecutivos (PDF Vectorial A4 multipágina + Impresión + Excel/CSV)
 * Soporta reportes Diario, Semanal, Mensual y Anual con paginación automática.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { LOGO_ALFRA_BASE64 } from '../assets/logoAlfraBase64';
import { es } from 'date-fns/locale';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const fmtMoney = (v) => `$${Number(v || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v) => `${Number(v || 0).toFixed(1)}%`;
const fmtDelta = (kpi) => {
    if (!kpi || kpi.delta === null || kpi.delta === undefined || Number.isNaN(kpi.delta)) return 'Sin base previa';
    const sign = kpi.delta > 0 ? '+' : '';
    const suffix = kpi.deltaEnPuntos ? ' pts' : '%';
    return `${sign}${kpi.delta.toFixed(1)}${suffix} vs. ant.`;
};

const cargarLogoBase64 = () => new Promise((resolve) => {
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

export const generarReporteEjecutivoPDF = async (rep, { autoPrint = false } = {}) => {
    let printWindow = null;
    if (autoPrint && !Capacitor.isNativePlatform()) {
        printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(
                '<html><head><title>Generando Reporte ALFRA...</title></head><body style="font-family:Inter,sans-serif;text-align:center;margin-top:18%;color:#334155;"><h2>Preparando Reporte Ejecutivo ALFRA...</h2><p>Formateando tablas y métricas del periodo.</p></body></html>'
            );
        }
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentW = pageW - margin * 2;
    let y = margin;

    const logoData = await cargarLogoBase64();

    const checkSpace = (needed = 35) => {
        if (y + needed > pageH - 18) {
            doc.addPage();
            y = 16;
        }
    };

    const drawSectionHeader = (numStr, titulo, subtitulo = '') => {
        checkSpace(24);
        doc.setFillColor(15, 23, 42); // slate-900
        doc.roundedRect(margin, y, contentW, 8.5, 1.8, 1.8, 'F');
        doc.setFillColor(32, 178, 170); // turquesa
        doc.roundedRect(margin, y, 10, 8.5, 1.8, 1.8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(numStr, margin + 5, y + 5.7, { align: 'center' });
        doc.setFontSize(9.5);
        doc.text(titulo.toUpperCase(), margin + 13, y + 5.7);
        if (subtitulo) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(203, 213, 225);
            doc.text(subtitulo, pageW - margin - 3, y + 5.7, { align: 'right' });
        }
        y += 11.5;
    };

    // ─── ENCABEZADO CORPORATIVO CON LOGO DESTACADO ───
    const headerH = 36;
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, y, contentW, headerH, 3, 3, 'F');

    // Logo oficial en tarjeta blanca destacada
    try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin + 4, y + 4, 34, 28, 2.5, 2.5, 'F');
        doc.addImage(LOGO_ALFRA_BASE64, 'PNG', margin + 6, y + 5.5, 30, 25);
    } catch (errLogo) {
        console.error('Error inyectando logo en reporte:', errLogo);
    }

    const leftTextX = margin + 42;
    doc.setTextColor(32, 178, 170);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('CLÍNICA ALFRA • DIRECCIÓN Y ADMINISTRACIÓN', leftTextX, y + 9.5);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15.5);
    doc.text(`REPORTE EJECUTIVO ${rep.R.tipoLabel.toUpperCase()}`, leftTextX, y + 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`Periodo analizado: ${rep.R.label}   |   Comparativo base: ${rep.R.prevLabel}`, leftTextX, y + 26);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('EMISIÓN DEL DOCUMENTO', pageW - margin - 5, y + 10, { align: 'right' });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(format(rep.generado || new Date(), "dd/MM/yyyy HH:mm 'hrs'", { locale: es }), pageW - margin - 5, y + 17, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(32, 178, 170);
    doc.text(rep.R.enCurso ? 'Periodo en curso (corte parcial)' : 'Periodo cerrado completo', pageW - margin - 5, y + 24, { align: 'right' });

    y += 41;

    // ─── 1. RESUMEN EJECUTIVO DE KPIS ───
    drawSectionHeader('01', 'Indicadores Clave del Negocio (KPIs)', `Comparado contra ${rep.R.prevLabel}`);

    const kpiRows = [
        [
            'Ingresos Cobrados',
            fmtMoney(rep.actual.ingresos),
            fmtMoney(rep.anterior.ingresos),
            fmtDelta(rep.kpis.ingresos),
            'Ticket Promedio / Visita',
            fmtMoney(rep.actual.ticket),
            fmtMoney(rep.anterior.ticket),
            fmtDelta(rep.kpis.ticket),
        ],
        [
            'Egresos / Gastos',
            fmtMoney(rep.actual.egresos),
            fmtMoney(rep.anterior.egresos),
            fmtDelta(rep.kpis.egresos),
            'Citas Completadas',
            String(rep.actual.completadas),
            String(rep.anterior.completadas),
            fmtDelta(rep.kpis.completadas),
        ],
        [
            'Utilidad Neta',
            fmtMoney(rep.actual.utilidad),
            fmtMoney(rep.anterior.utilidad),
            fmtDelta(rep.kpis.utilidad),
            'Tasa de Inasistencia',
            `${fmtPct(rep.actual.tasaInasistencia)} (${rep.actual.noAsistio})`,
            `${fmtPct(rep.anterior.tasaInasistencia)} (${rep.anterior.noAsistio})`,
            fmtDelta(rep.kpis.tasaInasistencia),
        ],
        [
            'Margen Neto %',
            fmtPct(rep.actual.margen),
            fmtPct(rep.anterior.margen),
            fmtDelta(rep.kpis.margen),
            'Pacientes Nuevos / Atendidos',
            `${rep.actual.nuevos} nuevos / ${rep.pacientes.atendidos} atend.`,
            `${rep.anterior.nuevos} nuevos`,
            fmtDelta(rep.kpis.nuevos),
        ],
    ];

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Indicador Financiero', 'Actual', 'Anterior', 'Variación', 'Indicador Operativo', 'Actual', 'Anterior', 'Variación']],
        body: kpiRows,
        theme: 'grid',
        styles: { fontSize: 7.8, cellPadding: 2.2, textColor: [30, 41, 59] },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8 },
        columnStyles: {
            0: { fontStyle: 'bold', fillColor: [248, 250, 252] },
            1: { halign: 'right', fontStyle: 'bold' },
            2: { halign: 'right', textColor: [100, 116, 139] },
            3: { halign: 'center', fontSize: 7.2 },
            4: { fontStyle: 'bold', fillColor: [248, 250, 252] },
            5: { halign: 'right', fontStyle: 'bold' },
            6: { halign: 'right', textColor: [100, 116, 139] },
            7: { halign: 'center', fontSize: 7.2 },
        },
    });
    y = doc.lastAutoTable.finalY + 5;

    // ─── PUNTO DE EQUILIBRIO Y PROYECCIÓN ───
    if (rep.equilibrio.aplica) {
        const eqRows = [[
            fmtMoney(rep.equilibrio.metaEquilibrio),
            fmtPct(rep.equilibrio.cubierto),
            rep.equilibrio.alcanzado ? 'CUBIERTO' : `Faltan ${fmtMoney(rep.equilibrio.faltante)}`,
            rep.equilibrio.fechaEquilibrio
                ? `${format(rep.equilibrio.fechaEquilibrio, "d 'de' MMM", { locale: es })}${rep.equilibrio.equilibrioEstimado ? ' (est.)' : ''}`
                : 'Pendiente',
            rep.proyeccion ? fmtMoney(rep.proyeccion.ingresos) : fmtMoney(rep.actual.ingresos),
            rep.proyeccion ? fmtMoney(rep.proyeccion.utilidad) : fmtMoney(rep.actual.utilidad),
        ]];
        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Punto de Equilibrio del Periodo', '% Cubierto', 'Estatus Equilibrio', 'Fecha Equilibrio', 'Proyección Cierre Ingresos', 'Proyección Cierre Utilidad']],
            body: eqRows,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2.2, halign: 'center' },
            headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8 },
            columnStyles: {
                0: { fontStyle: 'bold' },
                2: { fontStyle: 'bold' },
                4: { fontStyle: 'bold' },
                5: { fontStyle: 'bold' },
            },
        });
        y = doc.lastAutoTable.finalY + 5;
    }

    // ─── PLAN DE INGRESOS MENSUALES, GASTOS FIJOS, NÓMINA PROMEDIO, BOLSAS Y META DIARIA DE SERVICIOS ───
    if (rep.planIngresos && rep.equilibrio) {
        drawSectionHeader(
            '02',
            'Estructura de Costos Fijos, Bolsas de Provisión y Plan Diario de Servicios',
            `Meta diaria: ${fmtMoney(rep.planIngresos.metaDiariaPesos)} (${rep.planIngresos.diasLaboralesMes} días lab./mes)`
        );

        const eq = rep.equilibrio;
        const pl = rep.planIngresos;

        const compromisoRows = [
            [
                'Renta de Local',
                fmtMoney(eq.fijosDesglose.renta),
                fmtMoney(eq.fijosDesglose.renta / pl.diasLaboralesMes),
                'Nómina Mensual Estimada',
                `${fmtMoney(eq.nominaMensual)}${eq.usaNominaAuto ? ' (Prom. Auto)' : ''}`,
                fmtMoney(pl.cuotaDiaria.nomina),
            ],
            [
                'Luz (CFE)',
                fmtMoney(eq.fijosDesglose.luz),
                fmtMoney(eq.fijosDesglose.luz / pl.diasLaboralesMes),
                'Bolsa Provisión Producto Tratamientos',
                `${fmtMoney(eq.bolsaProductoMensual)}${eq.usaInsumosAuto ? ' (Prom. Auto)' : ''}`,
                fmtMoney(pl.cuotaDiaria.bolsaProducto),
            ],
            [
                'Internet y Teléfono',
                fmtMoney(eq.fijosDesglose.internet),
                fmtMoney(eq.fijosDesglose.internet / pl.diasLaboralesMes),
                `Bolsa Compra Equipo${eq.nombreEquipoMeta ? ` (${eq.nombreEquipoMeta})` : ''}`,
                fmtMoney(eq.bolsaEquipoMensual),
                fmtMoney(pl.cuotaDiaria.bolsaEquipo),
            ],
            [
                'Agua + Otros Fijos',
                fmtMoney((eq.fijosDesglose.agua || 0) + (eq.fijosDesglose.otros || 0)),
                fmtMoney(((eq.fijosDesglose.agua || 0) + (eq.fijosDesglose.otros || 0)) / pl.diasLaboralesMes),
                'Utilidad Libre Deseada / Meta Extra',
                fmtMoney(eq.utilidadDeseada),
                fmtMoney(pl.cuotaDiaria.utilidad),
            ],
            [
                'SUBTOTAL SERVICIOS FIJOS',
                fmtMoney(eq.sumaFijosServicios),
                fmtMoney(pl.cuotaDiaria.fijos),
                'META TOTAL MENSUAL / DIARIA',
                fmtMoney(pl.metaPlanMensual),
                fmtMoney(pl.metaDiariaPesos),
            ],
        ];

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Gasto Fijo Mensual', 'Mensual', 'Por Día Lab.', 'Nómina, Bolsas y Meta', 'Mensual', 'Por Día Lab.']],
            body: compromisoRows,
            theme: 'grid',
            styles: { fontSize: 7.5, cellPadding: 1.9, textColor: [30, 41, 59] },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
            columnStyles: {
                0: { fontStyle: 'bold', fillColor: [248, 250, 252] },
                1: { halign: 'right' },
                2: { halign: 'right', textColor: [100, 116, 139] },
                3: { fontStyle: 'bold', fillColor: [248, 250, 252] },
                4: { halign: 'right', fontStyle: 'bold' },
                5: { halign: 'right', fontStyle: 'bold' },
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.row.index === compromisoRows.length - 1) {
                    data.cell.styles.fillColor = [226, 232, 240];
                    data.cell.styles.fontStyle = 'bold';
                }
            },
        });
        y = doc.lastAutoTable.finalY + 4;

        if (pl.mixDiarioSugerido && pl.mixDiarioSugerido.length > 0) {
            const mixRows = pl.mixDiarioSugerido.slice(0, 15).map((s) => [
                s.nombre,
                s.categoria,
                fmtMoney(s.precio),
                fmtMoney(s.margenNetoUnitario),
                `${s.soloEsteParaMetaDia.toFixed(1)} serv/día (${s.soloEsteParaMetaDiaRedondeado})`,
                `${s.unidadesMixDia} al día (${s.unidadesMixMes}/mes)`,
                fmtMoney(s.ingresoMixDia),
                String(s.vendidosPeriodo || 0),
            ]);

            autoTable(doc, {
                startY: y,
                margin: { left: margin, right: margin },
                head: [[
                    'Servicio Suelto (No Paquete)',
                    'Categoría',
                    'Precio',
                    'Margen Unit.',
                    'Si solo vendieras este',
                    'Mix Diario Sugerido',
                    'Ingreso Mix/Día',
                    'Vendidos Per.',
                ]],
                body: mixRows,
                theme: 'striped',
                styles: { fontSize: 7.3, cellPadding: 1.7 },
                headStyles: { fillColor: [13, 148, 136], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.3 },
                columnStyles: {
                    0: { fontStyle: 'bold' },
                    2: { halign: 'right', fontStyle: 'bold' },
                    3: { halign: 'right' },
                    4: { halign: 'center' },
                    5: { halign: 'center', fontStyle: 'bold' },
                    6: { halign: 'right', fontStyle: 'bold' },
                    7: { halign: 'center' },
                },
            });
            y = doc.lastAutoTable.finalY + 6;
        }
    }

    // ─── DIAGNÓSTICO EJECUTIVO ───
    if (rep.hallazgos.length > 0) {
        drawSectionHeader('03', 'Diagnóstico Ejecutivo y Hallazgos Clave', 'Análisis automático del periodo');
        const hallazgosRows = rep.hallazgos.map((h, i) => [
            `${i + 1}`,
            h.tipo === 'positivo' ? 'FORTALEZA' : h.tipo === 'alerta' ? 'ATENCIÓN' : 'DATO CLAVE',
            h.texto,
        ]);
        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['#', 'Nivel', 'Diagnóstico / Recomendación Accionable']],
            body: hallazgosRows,
            theme: 'striped',
            styles: { fontSize: 7.8, cellPadding: 2, textColor: [30, 41, 59] },
            headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 7.8 },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
                1: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
                2: { cellWidth: contentW - 36 },
            },
        });
        y = doc.lastAutoTable.finalY + 6;
    }

    // ─── 4. EVOLUCIÓN TEMPORAL (SEMANAL / MENSUAL / ANUAL / DIARIO) ───
    const tituloDesglose = rep.R.tipo === 'anio'
        ? 'Evolución Mensual del Año (Enero a Diciembre)'
        : rep.R.tipo === 'mes'
            ? 'Evolución Diaria del Mes'
            : rep.R.tipo === 'semana'
                ? 'Evolución Diaria de la Semana (Lunes a Domingo)'
                : 'Evolución por Horario del Día';

    drawSectionHeader('04', tituloDesglose, rep.R.label);

    const filasDesglose = rep.desglose
        .filter((d) => rep.R.tipo !== 'dia' || d.ingresos > 0 || d.egresos > 0 || d.completadas > 0 || d.noAsistio > 0)
        .map((d) => [
            d.label,
            fmtMoney(d.ingresos),
            fmtMoney(d.egresos),
            fmtMoney(d.utilidad),
            fmtPct(d.margen),
            fmtMoney(d.ticket || 0),
            String(d.completadas),
            String(d.noAsistio),
            String(d.nuevos),
        ]);

    filasDesglose.push([
        'TOTAL DEL PERIODO',
        fmtMoney(rep.actual.ingresos),
        fmtMoney(rep.actual.egresos),
        fmtMoney(rep.actual.utilidad),
        fmtPct(rep.actual.margen),
        fmtMoney(rep.actual.ticket),
        String(rep.actual.completadas),
        String(rep.actual.noAsistio),
        String(rep.actual.nuevos),
    ]);

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [[
            rep.R.tipo === 'anio' ? 'Mes' : rep.R.tipo === 'dia' ? 'Horario' : 'Fecha / Día',
            'Ingresos',
            'Egresos',
            'Utilidad',
            'Margen',
            'Ticket Prom.',
            'Citas Comp.',
            'No Asistió',
            'Pac. Nuevos',
        ]],
        body: filasDesglose,
        theme: 'grid',
        styles: { fontSize: 7.4, cellPadding: 1.8, textColor: [30, 41, 59] },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
        columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right', fontStyle: 'bold' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'center' },
            7: { halign: 'center' },
            8: { halign: 'center' },
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.row.index === filasDesglose.length - 1) {
                data.cell.styles.fillColor = [226, 232, 240];
                data.cell.styles.fontStyle = 'bold';
            }
        },
    });
    y = doc.lastAutoTable.finalY + 6;

    // ─── 5. SALUD FINANCIERA: FUENTES, MÉTODOS DE PAGO, TOP SERVICIOS Y GASTOS ───
    drawSectionHeader('05', 'Desglose Financiero: Ingresos, Métodos de Pago y Gastos', 'Estructura de flujo de efectivo');

    const maxLen = Math.max(rep.finanzas.porFuente.length, rep.finanzas.porMetodo.length, 1);
    const fuenteMetodoRows = [];
    for (let i = 0; i < maxLen; i += 1) {
        const f = rep.finanzas.porFuente[i];
        const m = rep.finanzas.porMetodo[i];
        fuenteMetodoRows.push([
            f ? f.name : '',
            f ? fmtMoney(f.value) : '',
            f ? fmtPct(f.pct) : '',
            m ? m.name : '',
            m ? fmtMoney(m.value) : '',
            m ? fmtPct(m.pct) : '',
        ]);
    }
    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Fuente de Ingreso', 'Monto', '% Ingresos', 'Método de Pago', 'Monto', '% Cobrado']],
        body: fuenteMetodoRows,
        theme: 'grid',
        styles: { fontSize: 7.8, cellPadding: 2 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.8 },
        columnStyles: {
            0: { fontStyle: 'bold' },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { fontStyle: 'bold' },
            4: { halign: 'right' },
            5: { halign: 'right' },
        },
    });
    y = doc.lastAutoTable.finalY + 4;

    if (rep.finanzas.topServicios.length > 0 || rep.finanzas.egresosCat.length > 0) {
        const maxServGasto = Math.max(rep.finanzas.topServicios.length, rep.finanzas.egresosCat.length);
        const sgRows = [];
        for (let i = 0; i < maxServGasto; i += 1) {
            const s = rep.finanzas.topServicios[i];
            const g = rep.finanzas.egresosCat[i];
            sgRows.push([
                s ? `${i + 1}. ${s.name}` : '',
                s ? String(s.count) : '',
                s ? fmtMoney(s.value) : '',
                s ? fmtPct(s.pct) : '',
                g ? g.name : '',
                g ? fmtMoney(g.value) : '',
                g ? fmtPct(g.pct) : '',
            ]);
        }
        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Top Servicios / Tratamientos', 'Pagos', 'Facturado', '% Ing.', 'Categoría de Egreso', 'Gasto', '% Egr.']],
            body: sgRows,
            theme: 'striped',
            styles: { fontSize: 7.6, cellPadding: 1.9 },
            headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6 },
            columnStyles: {
                1: { halign: 'center' },
                2: { halign: 'right', fontStyle: 'bold' },
                3: { halign: 'right' },
                5: { halign: 'right', fontStyle: 'bold' },
                6: { halign: 'right' },
            },
        });
        y = doc.lastAutoTable.finalY + 6;
    }

    // ─── 6. PLANES DE TRATAMIENTO Y CARTERA POR COBRAR ───
    drawSectionHeader('06', 'Planes de Tratamiento y Cartera por Cobrar', `${rep.planes.vigentes} planes activos`);

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Cartera Total por Cobrar', 'Planes Vigentes', 'Vendidos en Periodo', 'Liquidados en Periodo', 'Abonos Cobrados', 'Planes en Atraso (+30d)']],
        body: [[
            fmtMoney(rep.planes.cartera),
            `${rep.planes.vigentes} (${fmtPct(rep.planes.avancePromedio)} avance)`,
            `${rep.planes.vendidos} (${fmtMoney(rep.planes.valorVendido)})`,
            String(rep.planes.liquidados),
            `${fmtMoney(rep.planes.abonosCobrados)} (${fmtPct(rep.planes.pctIngresos)})`,
            `${rep.planes.atrasados.length} (${fmtMoney(rep.planes.montoAtrasado)})`,
        ]],
        theme: 'grid',
        styles: { fontSize: 7.8, cellPadding: 2.2, halign: 'center' },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6 },
        columnStyles: { 0: { fontStyle: 'bold' }, 5: { fontStyle: 'bold' } },
    });
    y = doc.lastAutoTable.finalY + 4;

    if (rep.planes.atrasados.length > 0) {
        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Paciente con Plan Atrasado', 'Teléfono', 'Tratamiento / Objetivo', 'Meta Total', 'Abonado', 'Saldo por Cobrar', 'Días sin Abono']],
            body: rep.planes.atrasados.slice(0, 15).map((p) => [
                p.paciente,
                p.telefono || '—',
                p.objetivo,
                fmtMoney(p.meta),
                fmtMoney(p.acumulado),
                fmtMoney(p.saldo),
                `${p.diasSinPago} días`,
            ]),
            theme: 'striped',
            styles: { fontSize: 7.5, cellPadding: 1.8 },
            headStyles: { fillColor: [190, 18, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
            columnStyles: {
                0: { fontStyle: 'bold' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right', fontStyle: 'bold' },
                6: { halign: 'center', fontStyle: 'bold' },
            },
        });
        y = doc.lastAutoTable.finalY + 6;
    }

    // ─── 7. RENTABILIDAD Y OCUPACIÓN POR ESPECIALISTA ───
    drawSectionHeader('07', 'Productividad, Ocupación e Ingresos por Especialista', `Inasistencias: ~${fmtMoney(rep.operacion.costoInasistencias)} no realizados`);

    if (rep.operacion.especialistas.length > 0) {
        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Especialista', 'Comp.', 'No Asist.', 'Horas', '% Ocup.', 'Ingreso Atribuido', 'Ticket Prom.', 'Comisiones', 'Nómina Pag.', 'Aporte Neto']],
            body: rep.operacion.especialistas.map((e) => [
                e.nombre,
                String(e.completadas),
                `${e.noAsistio} (${fmtPct(e.tasaInasistencia)})`,
                `${e.horasAgendadas.toFixed(1)}h`,
                fmtPct(e.ocupacion),
                fmtMoney(e.ingresos),
                fmtMoney(e.ticket),
                fmtMoney(e.comisiones),
                fmtMoney(e.nomina),
                fmtMoney(e.utilidadNeta),
            ]),
            theme: 'grid',
            styles: { fontSize: 7.4, cellPadding: 1.8 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.4 },
            columnStyles: {
                0: { fontStyle: 'bold' },
                1: { halign: 'center' },
                2: { halign: 'center' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right', fontStyle: 'bold' },
                6: { halign: 'right' },
                7: { halign: 'right' },
                8: { halign: 'right' },
                9: { halign: 'right', fontStyle: 'bold' },
            },
        });
        y = doc.lastAutoTable.finalY + 6;
    }

    // ─── 8. PACIENTES: RETENCIÓN, LTV, CANALES Y TOP 10 VIP ───
    drawSectionHeader('08', 'Retención de Pacientes, LTV y Clientes VIP', `LTV Promedio: ${fmtMoney(rep.pacientes.ltvPromedio)}`);

    const r30 = rep.pacientes.retencion.find((r) => r.dias === 30) || { tasa: 0, regresaron: 0, elegibles: 0 };
    const r60 = rep.pacientes.retencion.find((r) => r.dias === 60) || { tasa: 0, regresaron: 0, elegibles: 0 };
    const r90 = rep.pacientes.retencion.find((r) => r.dias === 90) || { tasa: 0, regresaron: 0, elegibles: 0 };

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Retención 30 días', 'Retención 60 días', 'Retención 90 días', 'Recurrentes vs Nuevos', 'Valor de Vida (LTV)', 'Pacientes en Riesgo (+45d)']],
        body: [[
            `${fmtPct(r30.tasa)} (${r30.regresaron}/${r30.elegibles})`,
            `${fmtPct(r60.tasa)} (${r60.regresaron}/${r60.elegibles})`,
            `${fmtPct(r90.tasa)} (${r90.regresaron}/${r90.elegibles})`,
            `${rep.pacientes.recurrentes} rec. / ${rep.pacientes.nuevosAtendidos} nuev. (${fmtPct(rep.pacientes.pctRecurrentes)})`,
            `${fmtMoney(rep.pacientes.ltvPromedio)} (${rep.pacientes.visitasProm.toFixed(1)} visitas)`,
            `${rep.pacientes.riesgo.length} (${fmtMoney(rep.pacientes.valorRiesgo)} LTV)`,
        ]],
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2, halign: 'center' },
        headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    });
    y = doc.lastAutoTable.finalY + 4;

    if (rep.pacientes.topPacientes.length > 0) {
        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['#', 'Top 10 Pacientes por Facturación (Periodo)', 'Teléfono', 'Pagos Periodo', 'Facturado Periodo', 'Visitas Históricas', 'Valor de Vida (LTV Total)']],
            body: rep.pacientes.topPacientes.map((p, idx) => [
                String(idx + 1),
                p.nombre,
                p.telefono || '—',
                String(p.pagos),
                fmtMoney(p.total),
                String(p.visitas),
                fmtMoney(p.ltv),
            ]),
            theme: 'striped',
            styles: { fontSize: 7.5, cellPadding: 1.8 },
            headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
                1: { fontStyle: 'bold' },
                3: { halign: 'center' },
                4: { halign: 'right', fontStyle: 'bold' },
                5: { halign: 'center' },
                6: { halign: 'right', fontStyle: 'bold' },
            },
        });
        y = doc.lastAutoTable.finalY + 6;
    }

    // ─── 9. INVENTARIO Y PRODUCTOS BAJO STOCK MÍNIMO ───
    drawSectionHeader('09', 'Inventario, Margen de Productos y Alertas de Stock', `${rep.inventario.bajoStock.length} artículos por reabastecer`);

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Valor Inventario (Costo)', 'Valor Productos (Venta)', 'Margen Promedio Catálogo', 'Ventas Productos Periodo', 'Artículos Bajo Stock Mínimo']],
        body: [[
            fmtMoney(rep.inventario.valorCosto),
            fmtMoney(rep.inventario.valorVenta),
            fmtPct(rep.inventario.margenPromedio),
            `${fmtMoney(rep.inventario.ingresoProductos)} (${rep.inventario.unidadesVendidas} uds)`,
            `${rep.inventario.bajoStock.length} (${rep.inventario.agotados} agotados)`,
        ]],
        theme: 'grid',
        styles: { fontSize: 7.8, cellPadding: 2, halign: 'center' },
        headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.6 },
    });
    y = doc.lastAutoTable.finalY + 4;

    if (rep.inventario.bajoStock.length > 0) {
        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Producto / Insumo en Alerta', 'Tipo', 'Stock Actual', 'Stock Mínimo', 'Proveedor', 'Estado']],
            body: rep.inventario.bajoStock.slice(0, 20).map((b) => [
                b.nombre,
                b.tipo === 'producto' ? 'Producto venta' : 'Insumo clínico',
                `${b.stock} ${b.unidad}`,
                `${b.stockMinimo} ${b.unidad}`,
                b.proveedor || '—',
                b.agotado ? 'AGOTADO' : 'BAJO MÍNIMO',
            ]),
            theme: 'striped',
            styles: { fontSize: 7.4, cellPadding: 1.7 },
            headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.4 },
            columnStyles: {
                0: { fontStyle: 'bold' },
                2: { halign: 'center', fontStyle: 'bold' },
                3: { halign: 'center' },
                5: { halign: 'center', fontStyle: 'bold' },
            },
        });
    }

    // ─── PIE DE PÁGINA EN TODAS LAS HOJAS ───
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p += 1) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageH - 11, pageW - margin, pageH - 11);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
            `Clínica ALFRA — Reporte Ejecutivo ${rep.R.tipoLabel} (${rep.R.label}) • Generado el ${format(rep.generado || new Date(), 'dd/MM/yyyy HH:mm')}`,
            margin,
            pageH - 6.5
        );
        doc.setFont('helvetica', 'bold');
        doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 6.5, { align: 'right' });
    }

    const safeLabel = String(rep.R.label || rep.R.periodo).replace(/[^a-zA-Z0-9_-]+/g, '_');
    const fileName = `Reporte_ALFRA_${rep.R.tipoLabel}_${safeLabel}.pdf`;

    if (Capacitor.isNativePlatform()) {
        const base64 = doc.output('datauristring').split(',')[1];
        const saved = await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Documents,
        });
        await Share.share({
            title: `Reporte ${rep.R.tipoLabel} Clínica ALFRA`,
            text: `Reporte Ejecutivo ${rep.R.tipoLabel} (${rep.R.label})`,
            url: saved.uri,
            dialogTitle: 'Compartir o Imprimir Reporte PDF',
        });
        return;
    }

    if (autoPrint) {
        doc.autoPrint();
        const blobURL = doc.output('bloburl');
        if (printWindow) {
            printWindow.location.href = blobURL;
        } else {
            const w = window.open(blobURL, '_blank');
            if (!w) doc.save(fileName);
        }
    } else {
        doc.save(fileName);
    }
};

/** Exporta un archivo CSV compatible con Excel con todas las secciones del reporte */
export const exportarCSVCompleto = (rep) => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lineas = [];

    lineas.push(`REPORTE EJECUTIVO ${rep.R.tipoLabel.toUpperCase()} - CLINICA ALFRA`);
    lineas.push(`Periodo,${esc(rep.R.label)},Comparativo,${esc(rep.R.prevLabel)},Generado,${esc(format(new Date(), 'yyyy-MM-dd HH:mm'))}`);
    lineas.push('');

    lineas.push('1. INDICADORES CLAVE (KPIS)');
    lineas.push('Indicador,Valor Actual,Valor Anterior,Variacion');
    lineas.push(`Ingresos Totales,${rep.actual.ingresos.toFixed(2)},${rep.anterior.ingresos.toFixed(2)},${esc(fmtDelta(rep.kpis.ingresos))}`);
    lineas.push(`Egresos Totales,${rep.actual.egresos.toFixed(2)},${rep.anterior.egresos.toFixed(2)},${esc(fmtDelta(rep.kpis.egresos))}`);
    lineas.push(`Utilidad Neta,${rep.actual.utilidad.toFixed(2)},${rep.anterior.utilidad.toFixed(2)},${esc(fmtDelta(rep.kpis.utilidad))}`);
    lineas.push(`Margen Neto %,${rep.actual.margen.toFixed(2)}%,${rep.anterior.margen.toFixed(2)}%,${esc(fmtDelta(rep.kpis.margen))}`);
    lineas.push(`Ticket Promedio,${rep.actual.ticket.toFixed(2)},${rep.anterior.ticket.toFixed(2)},${esc(fmtDelta(rep.kpis.ticket))}`);
    lineas.push(`Citas Completadas,${rep.actual.completadas},${rep.anterior.completadas},${esc(fmtDelta(rep.kpis.completadas))}`);
    lineas.push(`Inasistencias,${rep.actual.noAsistio} (${rep.actual.tasaInasistencia.toFixed(1)}%),${rep.anterior.noAsistio} (${rep.anterior.tasaInasistencia.toFixed(1)}%),${esc(fmtDelta(rep.kpis.tasaInasistencia))}`);
    lineas.push(`Pacientes Nuevos,${rep.actual.nuevos},${rep.anterior.nuevos},${esc(fmtDelta(rep.kpis.nuevos))}`);
    lineas.push(`Cartera por Cobrar (Planes),${rep.planes.cartera.toFixed(2)},,`);
    lineas.push(`Valor de Vida Promedio (LTV),${rep.pacientes.ltvPromedio.toFixed(2)},,`);
    lineas.push('');

    if (rep.planIngresos && rep.equilibrio) {
        const eq = rep.equilibrio;
        const pl = rep.planIngresos;
        lineas.push('2. ESTRUCTURA DE GASTOS FIJOS, NOMINA PROMEDIO Y BOLSAS DE PROVISION');
        lineas.push('Concepto,Monto Mensual,Cuota por Dia Laboral');
        lineas.push(`Renta de Local,${eq.fijosDesglose.renta.toFixed(2)},${(eq.fijosDesglose.renta / pl.diasLaboralesMes).toFixed(2)}`);
        lineas.push(`Luz (CFE),${eq.fijosDesglose.luz.toFixed(2)},${(eq.fijosDesglose.luz / pl.diasLaboralesMes).toFixed(2)}`);
        lineas.push(`Internet y Telefono,${eq.fijosDesglose.internet.toFixed(2)},${(eq.fijosDesglose.internet / pl.diasLaboralesMes).toFixed(2)}`);
        lineas.push(`Agua,${(eq.fijosDesglose.agua || 0).toFixed(2)},${((eq.fijosDesglose.agua || 0) / pl.diasLaboralesMes).toFixed(2)}`);
        lineas.push(`Otros Gastos Fijos,${(eq.fijosDesglose.otros || 0).toFixed(2)},${((eq.fijosDesglose.otros || 0) / pl.diasLaboralesMes).toFixed(2)}`);
        lineas.push(`Nomina Mensual Estimada,${eq.nominaMensual.toFixed(2)},${pl.cuotaDiaria.nomina.toFixed(2)}`);
        lineas.push(`Bolsa Provision Producto Tratamientos,${eq.bolsaProductoMensual.toFixed(2)},${pl.cuotaDiaria.bolsaProducto.toFixed(2)}`);
        lineas.push(`Bolsa Provision Compra Equipo,${eq.bolsaEquipoMensual.toFixed(2)},${pl.cuotaDiaria.bolsaEquipo.toFixed(2)}`);
        lineas.push(`Utilidad Libre Deseada,${eq.utilidadDeseada.toFixed(2)},${pl.cuotaDiaria.utilidad.toFixed(2)}`);
        lineas.push(`META TOTAL PLAN INGRESOS,${pl.metaPlanMensual.toFixed(2)},${pl.metaDiariaPesos.toFixed(2)}`);
        lineas.push('');

        lineas.push('3. PLAN DE VENTAS DIARIAS DE SERVICIOS SUELTOS (NO PAQUETE)');
        lineas.push('Servicio,Categoria,Precio Venta,Costo Insumo,Comision $,Margen Neto Unitario,Si solo vendieras este al dia,Unidades Mix Diario Sugerido,Ingreso Mix Diario,Vendidos en Periodo');
        (pl.serviciosPlan || []).forEach((s) => {
            const mixItem = (pl.mixDiarioSugerido || []).find((m) => m.id === s.id);
            lineas.push(
                `${esc(s.nombre)},${esc(s.categoria)},${s.precio.toFixed(2)},${s.costoInsumos.toFixed(2)},${s.comisionMonto.toFixed(2)},${s.margenNetoUnitario.toFixed(2)},${s.soloEsteParaMetaDia.toFixed(1)},${mixItem ? mixItem.unidadesMixDia : 0},${mixItem ? mixItem.ingresoMixDia.toFixed(2) : '0.00'},${s.vendidosPeriodo || 0}`
            );
        });
        lineas.push('');
    }

    lineas.push(`4. EVOLUCION DEL PERIODO (${rep.R.tipoLabel.toUpperCase()})`);
    lineas.push('Periodo/Fecha,Ingresos,Egresos,Utilidad,Margen %,Ticket Promedio,Citas Completadas,No Asistio,Pacientes Nuevos');
    rep.desglose.forEach((d) => {
        lineas.push(`${esc(d.label)},${d.ingresos.toFixed(2)},${d.egresos.toFixed(2)},${d.utilidad.toFixed(2)},${d.margen.toFixed(1)}%,${(d.ticket || 0).toFixed(2)},${d.completadas},${d.noAsistio},${d.nuevos}`);
    });
    lineas.push('');

    lineas.push('5. RENDIMIENTO POR ESPECIALISTA');
    lineas.push('Especialista,Citas Completadas,No Asistio,Horas Agenda,% Ocupacion,Ingreso Atribuido,Ticket Promedio,Comisiones,Nomina Pagada,Aporte Neto');
    rep.operacion.especialistas.forEach((e) => {
        lineas.push(`${esc(e.nombre)},${e.completadas},${e.noAsistio},${e.horasAgendadas.toFixed(1)},${e.ocupacion.toFixed(1)}%,${e.ingresos.toFixed(2)},${e.ticket.toFixed(2)},${e.comisiones.toFixed(2)},${e.nomina.toFixed(2)},${e.utilidadNeta.toFixed(2)}`);
    });
    lineas.push('');

    lineas.push('6. PLANES ATRASADOS (+30 DIAS SIN PAGO)');
    lineas.push('Paciente,Telefono,Plan/Objetivo,Meta,Abonado,Saldo Pendiente,Dias sin Pago');
    rep.planes.atrasados.forEach((p) => {
        lineas.push(`${esc(p.paciente)},${esc(p.telefono)},${esc(p.objetivo)},${p.meta.toFixed(2)},${p.acumulado.toFixed(2)},${p.saldo.toFixed(2)},${p.diasSinPago}`);
    });
    lineas.push('');

    lineas.push('7. DETALLE DE MOVIMIENTOS FINANCIEROS DEL PERIODO');
    lineas.push('Fecha,Tipo,Fuente/Categoria,Concepto/Motivo,Paciente,Metodo de Pago,Monto');
    rep.actual.mv.forEach((m) => {
        const fStr = m._d ? format(m._d, 'yyyy-MM-dd HH:mm') : '';
        const cat = m.tipo === 'Ingreso' ? (m._fuente || '') : (m._cat || '');
        lineas.push(`${fStr},${esc(m.tipo)},${esc(cat)},${esc(m.motivo || m.concepto || '')},${esc(m.pacienteNombre || '')},${esc(m._metodo || m.metodoPago || '')},${m._monto.toFixed(2)}`);
    });

    const csv = `\uFEFF${lineas.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const safeLabel = String(rep.R.label || rep.R.periodo).replace(/[^a-zA-Z0-9_-]+/g, '_');
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Reporte_Ejecutivo_ALFRA_${rep.R.tipoLabel}_${safeLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
