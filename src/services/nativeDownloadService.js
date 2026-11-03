import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Convierte un Blob en base64 puro (sin prefijo data:...;base64,)
 */
const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result;
            if (typeof result === 'string') {
                const base64 = result.includes(',') ? result.split(',')[1] : result;
                resolve(base64);
            } else {
                reject(new Error('No se pudo convertir el Blob a Base64'));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Guarda o comparte cualquier archivo tanto en Web/PC como en Móvil (Android/iOS).
 * En móvil nativo utiliza el Cache seguro y la hoja nativa de compartir/guardar de Android/iOS.
 * 
 * @param {Object} options
 * @param {string} options.fileName - Nombre del archivo con extensión (ej. "Recibo_123.pdf")
 * @param {string|Blob} options.data - Datos en base64, Data URL (data:...;base64,...) o Blob
 * @param {string} [options.mimeType] - Tipo MIME (por defecto 'application/pdf')
 * @param {string} [options.title] - Título para la hoja de compartir en móvil
 */
export const descargarArchivoNativo = async ({ fileName, data, mimeType = 'application/pdf', title = 'Documento Clínica ALFRA' }) => {
    try {
        if (!fileName || !data) {
            throw new Error('fileName y data son obligatorios para descargar el archivo.');
        }

        // ── 1. Entorno MÓVIL NATIVO (Capacitor Android / iOS) ──
        if (Capacitor.isNativePlatform()) {
            let base64Data = '';

            if (data instanceof Blob) {
                base64Data = await blobToBase64(data);
            } else if (typeof data === 'string') {
                base64Data = data.includes(',') ? data.split(',')[1] : data;
            } else {
                throw new Error('Tipo de datos no soportado para exportación móvil.');
            }

            // Guardar en Directory.Cache (100% compatible con Scoped Storage en Android 10, 11, 12, 13, 14, 15, 16)
            const saveResult = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Cache
            });

            // Invocar la hoja de compartir nativa del sistema operativo
            // Permite al usuario "Guardar en Descargas", "Guardar en Drive", "Abrir con Lector PDF", "WhatsApp", etc.
            if (await Share.canShare().then(r => r.value).catch(() => true)) {
                await Share.share({
                    title: title || fileName,
                    text: `Documento: ${fileName}`,
                    url: saveResult.uri,
                    dialogTitle: 'Guardar o Compartir Documento'
                });
            }

            return { success: true, uri: saveResult.uri };
        }

        // ── 2. Entorno ESCRITORIO / NAVEGADOR WEB (PC, Mac, Chrome, etc.) ──
        let downloadUrl = '';
        let isBlobUrl = false;

        if (data instanceof Blob) {
            downloadUrl = URL.createObjectURL(data);
            isBlobUrl = true;
        } else if (typeof data === 'string') {
            if (data.startsWith('data:')) {
                downloadUrl = data;
            } else {
                downloadUrl = `data:${mimeType};base64,${data}`;
            }
        }

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (isBlobUrl) {
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
        }

        return { success: true };
    } catch (error) {
        console.error('[DESCARGA_NATIVA] Error al descargar/compartir archivo:', error);
        throw error;
    }
};

/**
 * Guarda o comparte una instancia de jsPDF directamente en Móvil o Web.
 * 
 * @param {import('jspdf').jsPDF} doc - Instancia del documento jsPDF
 * @param {string} fileName - Nombre del archivo (ej. "Consentimiento_Juan.pdf")
 * @param {string} [title] - Título en el diálogo del celular
 */
export const guardarPdfNativo = async (doc, fileName, title = 'Documento PDF ALFRA') => {
    try {
        if (!doc) throw new Error('No se proporcionó una instancia de jsPDF válida.');

        // Asegurar extensión .pdf
        const safeFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

        // En Móvil: extraer Data URI y guardar con Filesystem + Share
        if (Capacitor.isNativePlatform()) {
            const dataUri = doc.output('datauristring');
            return await descargarArchivoNativo({
                fileName: safeFileName,
                data: dataUri,
                mimeType: 'application/pdf',
                title: title || safeFileName
            });
        }

        // En Web / PC: usar el guardado directo de jsPDF
        doc.save(safeFileName);
        return { success: true };
    } catch (error) {
        console.error('[PDF_NATIVO] Error guardando PDF:', error);
        throw error;
    }
};

export default {
    descargarArchivoNativo,
    guardarPdfNativo
};
