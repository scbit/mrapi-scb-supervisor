const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');
const html=fs.readFileSync('public/index.html','utf8');
test('control UI exposes main supervisor actions',()=>{for(const x of ['/api/core/status','/api/core/validate-sources','/api/core/run','/api/supervisor/report','/api/supervisor/report/send'])assert.ok(html.includes(x))});
test('UI sends supervisor token header',()=>assert.ok(html.includes("x-supervisor-token")));
test('UI documents source read only boundary',()=>{assert.ok(html.includes('FUENTES READ ONLY'));assert.ok(html.includes('supervisor-scb'))});
