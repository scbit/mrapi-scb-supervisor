const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.13.11 default seller cadence is 45 minutes',()=>{
 const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
 assert.ok(s.includes('sellerFrequencyMinutes:45'));
 assert.ok(s.includes('settings.weekday.sellerFrequencyMinutes=45'));
 assert.ok(s.includes('effectiveFrequency=Number(network.settings?.weekday?.sellerFrequencyMinutes||45)'));
});

test('0.13.11 UI says every 45 minutes',()=>{
 const s=fs.readFileSync('public/index.html','utf8');
 assert.ok(s.includes('correrá cada 45 min'));
 assert.ok(s.includes('Revisar vendedores cada 45 min'));
 assert.ok(!s.includes('correrá cada 30 min'));
});
