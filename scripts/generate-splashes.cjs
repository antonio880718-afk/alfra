const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const projectRoot = path.join(__dirname, '..');
const srcLogo = path.join(projectRoot, 'public', 'logo.png');
const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

const splashes = [
    // Default
    { file: path.join(resDir, 'drawable', 'splash.png'), w: 480, h: 320, logoH: 110 },

    // Portrait (Mobile)
    { file: path.join(resDir, 'drawable-port-mdpi', 'splash.png'), w: 320, h: 480, logoW: 160 },
    { file: path.join(resDir, 'drawable-port-hdpi', 'splash.png'), w: 480, h: 800, logoW: 240 },
    { file: path.join(resDir, 'drawable-port-xhdpi', 'splash.png'), w: 720, h: 1280, logoW: 360 },
    { file: path.join(resDir, 'drawable-port-xxhdpi', 'splash.png'), w: 960, h: 1600, logoW: 480 },
    { file: path.join(resDir, 'drawable-port-xxxhdpi', 'splash.png'), w: 1280, h: 1920, logoW: 640 },

    // Landscape (Tablet / Dex)
    { file: path.join(resDir, 'drawable-land-mdpi', 'splash.png'), w: 480, h: 320, logoH: 110 },
    { file: path.join(resDir, 'drawable-land-hdpi', 'splash.png'), w: 800, h: 480, logoH: 165 },
    { file: path.join(resDir, 'drawable-land-xhdpi', 'splash.png'), w: 1280, h: 720, logoH: 260 },
    { file: path.join(resDir, 'drawable-land-xxhdpi', 'splash.png'), w: 1600, h: 960, logoH: 340 },
    { file: path.join(resDir, 'drawable-land-xxxhdpi', 'splash.png'), w: 1920, h: 1280, logoH: 450 },
];

async function generateSplashes() {
    console.log('Generando Splash Screens HD centrados para Android...');
    for (const item of splashes) {
        fs.mkdirSync(path.dirname(item.file), { recursive: true });

        // Resize logo according to target width or height
        const resizeOpts = item.logoW 
            ? { width: item.logoW } 
            : { height: item.logoH };

        const logoBuffer = await sharp(srcLogo)
            .resize({ ...resizeOpts, fit: 'inside' })
            .toBuffer();

        await sharp({
            create: {
                width: item.w,
                height: item.h,
                channels: 3,
                background: { r: 255, g: 255, b: 255 }
            }
        })
        .composite([{ input: logoBuffer, gravity: 'center' }])
        .png({ quality: 100, compressionLevel: 8 })
        .toFile(item.file);

        console.log(`✅ ${path.relative(resDir, item.file)} (${item.w}x${item.h})`);
    }
    console.log('\n🚀 Todas las pantallas Splash Screen HD para celular generadas con éxito.');
}

generateSplashes().catch(console.error);
