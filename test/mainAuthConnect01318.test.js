const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.13.18 main UI exposes visible supervisor connection form',()=>{
  const s=fs.readFileSync('public/index.html','utf8');
  assert.ok(s.includes('🔐 Conectar Supervisor'));
  assert.ok(s.includes('id="authToken"'));
  assert.ok(s.includes('Guardar y conectar'));
  assert.ok(s.includes('Olvidar token de esta PC'));
});

test('0.13.18 saves and validates token locally',()=>{
  const s=fs.readFileSync('public/index.html','utf8');
  assert.ok(s.includes("localStorage.setItem('supervisor_api_token',v)"));
  assert.ok(s.includes("await req('/api/supervisor/automation/health',{headers:H()})"));
  assert.ok(s.includes("localStorage.removeItem('supervisor_api_token')"));
});

test('0.13.18 401 opens auth UI and boot works on new PC',()=>{
  const s=fs.readFileSync('public/index.html','utf8');
  assert.ok(s.includes("if(r.status===401"));
  assert.ok(s.includes('Esta PC todavía no está autenticada'));
  assert.ok(s.includes('bootSupervisor();'));
});

test('0.13.18 keeps same-origin authenticated session flow',()=>{
  const s=fs.readFileSync('public/index.html','utf8');
  assert.ok(s.includes("fetch(url,{credentials:'same-origin',...opt})"));
});
