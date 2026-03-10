const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const projectRoot = path.join(__dirname, '..');
const srcLogo = path.join(projectRoot, 'public', 'logo.png.png');
const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');


const sizes = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
];

async function generateIcons() {
    for (const { dir, size } of sizes) {
        const outDir = path.join(resDir, dir);
        fs.mkdirSync(outDir, { recursive: true });

        const launcher = path.join(outDir, 'ic_launcher.png');
        const launcherRound = path.join(outDir, 'ic_launcher_round.png');
        const foreground = path.join(outDir, 'ic_launcher_foreground.png');

        await sharp(srcLogo)
            .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .png()
            .toFile(launcher);

        await sharp(srcLogo)
            .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .png()
            .toFile(launcherRound);

        // Foreground for adaptive icons (108dp — use 432px for xxxhdpi scale)
        const fgSize = Math.round(size * 2.25);
        await sharp(srcLogo)
            .resize(fgSize, fgSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .png()
            .toFile(foreground);

        console.log(`✅ ${dir} → ${size}x${size}px`);
    }
    console.log('\n✅ Todos los iconos generados correctamente.');
}

generateIcons().catch(console.error);
