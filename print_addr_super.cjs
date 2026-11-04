const fs = require("fs");
const lines = fs.readFileSync("src/pages/admin/SupervisionAgenda.jsx", "utf8").split("\n");
console.log(lines.slice(645, 675).join("\n"));
