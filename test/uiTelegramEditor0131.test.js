const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
test('0.13.1 Telegram seller config is compact editable and uses detected chat dropdown',()=>{
 const s=fs.readFileSync('public/index.html','utf8');
 assert.ok(s.includes('Configuración Telegram por vendedor'));
 assert.ok(s.includes('Actualizar grupos del bot'));
 assert.ok(s.includes('onclick="editSellerTelegram('));
 assert.ok(s.includes('class="tgEditSelect"'));
 assert.ok(s.includes('/api/integrations/telegram/chats'));
 assert.ok(s.includes('/api/supervisor/network/setup'));
 assert.ok(s.includes('Ingresar Chat ID manual'));
});
