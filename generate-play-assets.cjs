const sharp = require('sharp');
const path = require('path');

async function run() {
  const input = path.join(__dirname, 'public', 'logo.png.png');
  const iconOutput = path.join(__dirname, 'icono-ALFRA-512x512.png');
  const featureOutput = path.join(__dirname, 'banner-ALFRA-1024x500.png');

  try {
    // 512x512 Icon
    await sharp(input)
      .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .toFile(iconOutput);

    // 1024x500 Feature Graphic (con fondo turquesa de ALFRA)
    await sharp(input)
      .resize(800, 400, { fit: 'contain', background: { r: 13, g: 148, b: 136, alpha: 0 } })
      .extend({
        top: 50, bottom: 50, left: 112, right: 112,
        background: { r: 13, g: 148, b: 136, alpha: 1 }
      })
      .flatten({ background: { r: 13, g: 148, b: 136 } })
      .toFile(featureOutput);

    console.log("Images compiled exactly to Google Play Spec.");
  } catch (err) {
    console.error(err);
  }
}
run();
