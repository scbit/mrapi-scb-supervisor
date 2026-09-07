const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.13.13 UI exposes mass real live-report test',()=>{
 const s=fs.readFileSync('public/index.html','utf8');
 assert.ok(s.includes('PROBAR TODOS LOS GRUPOS AHORA'));
 assert.ok(s.includes('testAllLiveGroups()'));
 assert.ok(s.includes("'/api/supervisor/manual/live'"));
 assert.ok(s.includes('send:true'));
 assert.ok(s.includes('Prueba masiva finalizada.'));
});

test('0.13.13 manager destinations are separate in UI',()=>{
 const s=fs.readFileSync('public/index.html','utf8');
 assert.ok(s.includes('superManagerChat'));
 assert.ok(s.includes('closingManagerChat'));
 assert.ok(s.includes('superSupervisorChatId'));
 assert.ok(s.includes('closingChatId'));
 assert.ok(s.includes('Enviar al grupo SUPER SUPERVISOR'));
 assert.ok(s.includes('Enviar al grupo Cierre Diario'));
});

test('0.13.13 backend routes SUPER and CLOSE to different chat ids',()=>{
 const s=fs.readFileSync('src/http/app.js','utf8');
 assert.ok(s.includes('superSupervisorChatId()'));
 assert.ok(s.includes('closingChatId()'));
 assert.ok(s.includes('SUPER_SUPERVISOR_TELEGRAM_NOT_CONFIGURED'));
 assert.ok(s.includes('CLOSING_TELEGRAM_NOT_CONFIGURED'));
});

test('0.13.13 default network settings expose both manager destinations',()=>{
 const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
 assert.ok(s.includes('superSupervisorChatId:null'));
 assert.ok(s.includes('closingChatId:null'));
});
