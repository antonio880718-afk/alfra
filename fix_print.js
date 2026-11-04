const fs = require('fs');
const file = 'src/pages/admin/ReportesView.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldFuncStart =     const generarPDFCanvas = async (autoPrint = false) => {
        if (filtrados.movs.length === 0 && filtrados.cits.length === 0) {
            alert('No hay datos en este periodo para generar reporte.');
            return;
        }

        try {
            setExporting(true);;

const newFuncStart =     const generarPDFCanvas = async (autoPrint = false) => {
        if (filtrados.movs.length === 0 && filtrados.cits.length === 0) {
            alert('No hay datos en este periodo para generar reporte.');
            return;
        }

        let printWindow = null;
        if (autoPrint) {
            printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write('<html><body style="font-family:sans-serif;text-align:center;margin-top:20%;color:#666;"><h2>Generando reporte...</h2><p>Por favor espera un momento.</p></body></html>');
            }
        }

        try {
            setExporting(true);;

const oldPrintEnd =             if (autoPrint) {
                pdf.autoPrint();
                window.open(pdf.output('bloburl'), '_blank');
            } else {
                pdf.save(\Dashboard_Analitico_ALFRA_\.pdf\);
            };

const newPrintEnd =             if (autoPrint) {
                pdf.autoPrint();
                const blobURL = pdf.output('bloburl');
                if (printWindow) {
                    printWindow.location.href = blobURL;
                } else {
                    const fallbackWindow = window.open(blobURL, '_blank');
                    if (!fallbackWindow) {
                        alert("El navegador bloqueó la ventana emergente para imprimir. Se descargará el archivo en su lugar.");
                        pdf.save(\Dashboard_Analitico_ALFRA_\.pdf\);
                    }
                }
            } else {
                pdf.save(\Dashboard_Analitico_ALFRA_\.pdf\);
            };

if (content.includes('window.open(pdf.output(\'bloburl\'), \'_blank\');')) {
    content = content.replace(oldFuncStart, newFuncStart);
    content = content.replace(oldPrintEnd, newPrintEnd);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed printing in ReportesView.jsx');
} else {
    console.log('Could not find the target string. Already patched?');
}
