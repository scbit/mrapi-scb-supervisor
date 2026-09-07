const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.13.19 defaults expose three independent automatic switches',()=>{
 const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
 assert.ok(s.includes('liveAutoEnabled:false'));
 assert.ok(s.includes('superAutoEnabled:false'));
 assert.ok(s.includes('closingAutoEnabled:false'));
 assert.ok(s.includes("closingAutoTime:'17:00'"));
});

test('0.13.19 UI exposes controls and preserves manual buttons',()=>{
 const s=fs.readFileSync('public/index.html','utf8');
 assert.ok(s.includes('Control de automatización'));
 assert.ok(s.includes('id="autoLive"'));
 assert.ok(s.includes('id="autoSuper"'));
 assert.ok(s.includes('id="autoClose"'));
 assert.ok(s.includes('Guardar automatización'));
 assert.ok(s.includes('Generar prueba'));
 assert.ok(s.includes('Enviar al grupo SUPER SUPERVISOR'));
 assert.ok(s.includes('Generar cierre'));
});

test('0.13.19 control save persists each product independently',()=>{
 const s=fs.readFileSync('public/index.html','utf8');
 assert.ok(s.includes('liveAutoEnabled:autoLive.checked'));
 assert.ok(s.includes('superAutoEnabled:autoSuper.checked'));
 assert.ok(s.includes('closingAutoEnabled:autoClose.checked'));
 assert.ok(s.includes('closingAutoTime:autoCloseTime.value'));
});

test('0.13.19 existing 15 minute tick runs approved product automation',()=>{
 const s=fs.readFileSync('src/http/app.js','utf8');
 assert.ok(s.includes('runProductAutomation({now,send:automaticSend})'));
 assert.ok(s.includes('runApprovedLiveAuto'));
 assert.ok(s.includes('runApprovedSuperAuto'));
 assert.ok(s.includes('runApprovedCloseAuto'));
});

test('0.13.19 weekday legacy tick does not send duplicate seller telegram',()=>{
 const s=fs.readFileSync('src/http/app.js','utf8');
 assert.ok(s.includes('send:isWeekend?automaticSend:false'));
});

test('0.13.19 approved live automatic reuses one global base and same live formatter',()=>{
 const app=fs.readFileSync('src/http/app.js','utf8');
 const manual=fs.readFileSync('src/core/manualSupervision.js','utf8');
 assert.ok(app.includes('manualSupervisionService.base(p.date,cutoff,false,null)'));
 assert.ok(app.includes('liveSellerFromBase'));
 assert.ok(manual.includes('async liveSellerFromBase'));
});

test('0.13.19 dedicated SUPER scheduler respects product switch',()=>{
 const s=fs.readFileSync('src/http/app.js','utf8');
 assert.ok(s.includes("setup.settings?.weekday?.superAutoEnabled!==true"));
 assert.ok(s.includes("reason:'SUPER_AUTO_DISABLED'"));
});
