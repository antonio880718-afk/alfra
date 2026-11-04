const sharp = require('sharp');
const path = require('path');

async function run() {
  const input = path.join(__dirname, 'public', 'logo.png.png');
  const iconOutput = path.join(__dirname, 'icono-ALFRA-SOLID.jpg');
  const featureOutput = path.join(__dirname, 'banner-ALFRA-SOLID.jpg');

  try {
    // 512x512 Icon - JPG format completely removes alpha
    await sharp(input)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } }) // Black background
      .flatten({ background: '#000000' })
      .jpeg({ quality: 100 })
      .toFile(iconOutput);

    // 1024x500 Feature Graphic - JPG format completely removes alpha
    await sharp(input)
      .resize(800, 400, { fit: 'contain', background: { r: 13, g: 148, b: 136, alpha: 1 } })
      .extend({
        top: 50, bottom: 50, left: 112, right: 112,
        background: { r: 13, g: 148, b: 136, alpha: 1 }
      })
      .flatten({ background: { r: 13, g: 148, b: 136 } })
      .jpeg({ quality: 100 })
      .toFile(featureOutput);

    console.log("JPG Images compiled exactly to Google Play Spec.");
  } catch (err) {
    console.error(err);
  }
}
run();
