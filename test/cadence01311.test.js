const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');

test('0.13.11 default seller cadence is 45 minutes',()=>{
 const s=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
 assert.ok(s.includes('sellerFrequencyMinutes:45'));
 assert.ok(s.includes('settings.weekday.sellerFrequencyMinutes=45'));
 assert.ok(s.includes('effectiveFrequency=Number(network.settings?.weekday?.sellerFrequencyMinutes||45)'));
});

test('0.13.26 UI exposes fixed live report slots',()=>{
 const s=fs.readFileSync('public/index.html','utf8');
 assert.ok(s.includes('09:00, 11:00, 12:00, 14:00, 15:00 y 16:00'));
 assert.ok(s.includes('cortes 09:00 · 11:00 · 12:00 · 14:00 · 15:00 · 16:00'));
 assert.ok(!s.includes('Al automatizarse correrá cada 45 min.'));
});
