const fs = require("fs");
const lines = fs.readFileSync("src/pages/admin/SupervisionAgenda.jsx", "utf8").split("\n");
lines.forEach((l, idx) => {
  if (l.includes("isUbicacionCopied") || l.includes("maps.") || l.includes("Dirección") || l.includes("ubicacion")) {
    console.log((idx+1) + ": " + l.trim());
  }
});
