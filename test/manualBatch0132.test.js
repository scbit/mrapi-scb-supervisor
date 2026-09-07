const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.13.2 manual report flow batches analysis to avoid upstream timeout',()=>{
  const ui=fs.readFileSync('public/index.html','utf8');
  const app=fs.readFileSync('src/http/app.js','utf8');
  assert.ok(ui.includes('/api/supervisor/manual/start'));
  assert.ok(ui.includes('/api/supervisor/manual/process'));
  assert.ok(ui.includes('batchSize:2'));
  assert.ok(ui.includes('Analizando chats con Guía Comercial SCB v1.0…'));
  assert.ok(app.includes("app.post('/api/supervisor/manual/start'"));
  assert.ok(app.includes("app.post('/api/supervisor/manual/process'"));
});
test('0.13.2 manual service reuses cached guide report when available',()=>{
  const s=fs.readFileSync('src/core/manualSupervision.js','utf8');
  assert.ok(s.includes('getDailyReport(reportKey)'));
  assert.ok(s.includes('if(cached&&Array.isArray(cached.rows))return cached'));
});
