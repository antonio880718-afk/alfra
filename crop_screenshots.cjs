const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = 'C:\\Users\\aleja\\Downloads';
const outDir = path.join(__dirname, 'capturas_playstore');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
}

const files = fs.readdirSync(dir).filter(f => f.startsWith('WhatsApp Image 2026-03-18') && (f.endsWith('.jpeg') || f.endsWith('.jpg') || f.endsWith('.png')));

async function processImages() {
    let count = 0;
    console.log(`Revisando ${files.length} capturas de WhatsApp...`);
    
    for (const file of files) {
        const input = path.join(dir, file);
        const output = path.join(outDir, `Captura_PlayStore_${count + 1}.jpg`);
        try {
            // Forzamos el redimensionado al estándar HD (720x1280) que cumple nativamente con la proporción < 2:1
            // Usamos 'cover' y posición 'north' (arriba) para priorizar el encabezado de la app y solo mochar los bordes inferiores vacíos de navegación del Android.
            await sharp(input)
                .resize(720, 1280, { fit: 'cover', position: 'north' })
                .jpeg({ quality: 100 })
                .toFile(output);
            
            console.log(`✓ Procesada: ${output}`);
            count++;
        } catch (e) {
            console.error('Error con:', file, e.message);
        }
    }
    console.log(`¡Éxito! Logré procesar y recortar quirúrgicamente ${count} capturas.`);
}

processImages();
