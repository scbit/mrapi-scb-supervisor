const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeDeal,normalizeLeadQuality}=require('../src/core/normalizers');
const {aggregateLeadQuality,html,managerText}=require('../src/core/dailyGerencial');

test('normalizes CRM lead quality using official five-value contract',()=>{
  assert.equal(normalizeLeadQuality('Excelente'),'EXCELENTE');
  assert.equal(normalizeLeadQuality('No Responde'),'NO_RESPONDE');
  assert.equal(normalizeLeadQuality('no_respuesta'),'NO_RESPONDE');
  assert.equal(normalizeDeal('d1',{leadQuality:'Bueno'}).leadQuality,'BUENO');
});

test('aggregates daily CRM lead quality globally and by seller',()=>{
  const q=aggregateLeadQuality([
    {owner:'a@scb.com',leadQuality:'EXCELENTE'},
    {owner:'a@scb.com',leadQuality:'BUENO'},
    {owner:'a@scb.com',leadQuality:'REGULAR'},
    {owner:'b@scb.com',leadQuality:'NO_RESPONDE'},
    {owner:'b@scb.com',leadQuality:'DESCARTADO'}
  ]);
  assert.equal(q.available,true);
  assert.equal(q.total,5);
  assert.equal(q.counts.EXCELENTE,1);
  assert.equal(q.counts.BUENO,1);
  assert.equal(q.goodExcellent,2);
  assert.equal(q.goodExcellentPct,40);
  assert.equal(q.bySeller.find(x=>x.seller==='a@scb.com').goodExcellentPct,67);
});

test('daily report renders lead quality as hard CRM data',()=>{
  const leadQuality=aggregateLeadQuality([
    {owner:'a@scb.com',leadQuality:'EXCELENTE'},
    {owner:'a@scb.com',leadQuality:'BUENO'},
    {owner:'b@scb.com',leadQuality:'NO_RESPONDE'}
  ]);
  const report={date:'2026-08-28',generatedAt:'2026-08-30T18:00:00Z',businessHours:'09:00 a 17:00',lateMinutes:30,aiUsedCount:0,
    rows:[],bySeller:[],portfolio:{total:0,upToDate:0,overdue:0,noDueDate:0},hunter:{total:0,sellers:0},events:{HORNO:0,GANADO:0,GANADO_FROM_AD:0},leadQuality};
  const mail=html(report);
  const text=managerText(report);
  assert.match(mail,/Calidad de leads ingresados/);
  assert.match(mail,/Dato duro del CRM/);
  assert.match(mail,/Bueno \+ Excelente: 2 \(67%\)/);
  assert.match(text,/CALIDAD DE LEADS INGRESADOS — DATO CRM/);
  assert.match(text,/Excelente: 1 \| Bueno: 1 \| Regular: 0 \| No Responde: 1 \| Descartado: 0/);
});
