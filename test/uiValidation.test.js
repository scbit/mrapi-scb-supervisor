const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pkg = require("../package.json");

test("Core browser UI exposes navigation/action buttons", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/validate.html"), "utf8");
  assert.equal(pkg.version, "0.5.3");
  for (const text of [
    "Validar fuentes",
    "Estado Core",
    "Vendedores",
    "Clientes esperando",
    "Fallas CRM",
    "Contratos",
    "Ejecutar Core ahora"
  ]) assert.match(html, new RegExp(text));
  assert.match(html, /x-supervisor-token/);
  assert.match(html, /\/api\/core\/validate-sources/);
  assert.match(html, /\/api\/core\/status/);
  assert.match(html, /\/api\/core\/run/);
});
