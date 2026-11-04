const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";


function compileHtmlToPdf(htmlContent, outputPdfPath) {
  const manualesDir = path.resolve(__dirname, '../manuales');
  if (!fs.existsSync(manualesDir)) {
    fs.mkdirSync(manualesDir, { recursive: true });
  }

  const tempHtmlPath = path.join(manualesDir, `_temp_${Date.now()}_${Math.floor(Math.random() * 1000)}.html`);
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

  const tempUserDataDir = path.join(os.tmpdir(), `edge_pdf_${Date.now()}_${Math.floor(Math.random() * 10000)}`);
  fs.mkdirSync(tempUserDataDir, { recursive: true });

  const resolvedPdfPath = path.resolve(outputPdfPath);

  const cmd = `\"${EDGE_PATH}\" --headless=new --disable-gpu --no-sandbox --user-data-dir=\"${tempUserDataDir}\" --no-pdf-header-footer --print-to-pdf=\"${resolvedPdfPath}\" \"${tempHtmlPath}\"`;

  try {
    cp.execSync(cmd, { stdio: 'pipe', timeout: 35000 });
  } catch (err) {}

  let attempts = 0;
  while (attempts < 12) {
    if (fs.existsSync(resolvedPdfPath) && fs.statSync(resolvedPdfPath).size > 1000) {
      break;
    }
    const waitTill = new Date(new Date().getTime() + 500);
    while (waitTill > new Date()) {}
    attempts++;
  }

  try {
    if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
    if (fs.existsSync(tempUserDataDir)) fs.rmSync(tempUserDataDir, { recursive: true, force: true });
  } catch (e) {}

  if (!fs.existsSync(resolvedPdfPath) || fs.statSync(resolvedPdfPath).size === 0) {
    throw new Error(`Fallo al generar el PDF: ${outputPdfPath}`);
  }

  const stat = fs.statSync(resolvedPdfPath);
  console.log(`[OK] Generado: ${path.basename(resolvedPdfPath)} (${(stat.size / 1024).toFixed(1)} KB)`);
  return stat.size;
}

module.exports = {
  compileHtmlToPdf
};
