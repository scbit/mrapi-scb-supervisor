const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {issueMap,ACTIVE_OVERDUE_STAGES}=require('../src/core/liveDailySupervisor');

test('0.11.0 uses Daily V3 issue semantics for live supervision',()=>{
  const row={noHumanResponse:true,botOnly:false,lateResponses:[],operationalWithoutDiscovery:true,unexploredPotential:true,needsReviewByAi:true};
  const issues=issueMap(row);
  assert.ok(issues.has('NO_HUMAN_RESPONSE'));
  assert.ok(issues.has('OPERATIONAL_WITHOUT_DISCOVERY'));
  assert.ok(issues.has('UNEXPLORED_POTENTIAL'));
});

test('0.11.0 overdue rule is exact for four active stages',()=>{
  assert.deepEqual([...ACTIVE_OVERDUE_STAGES].sort(),['COTIZADO PARA ENVIAR','HORNO','MARCA PERSONAL','SEGUIMIENTO'].sort());
});

test('0.11.0 UI exposes DRY_RUN and ACTIVE modes',()=>{
  const html=fs.readFileSync('public/index.html','utf8');
  assert.ok(html.includes('MODO PRUEBA'));
  assert.ok(html.includes('ACTIVO — analiza y envía'));
  assert.ok(html.includes('misma lógica Daily V3'));
});

test('0.11.0 remote tick refreshes core incrementally before live supervision',()=>{
  const http=fs.readFileSync('src/http/app.js','utf8');
  const remote=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  assert.ok(http.includes("remoteService.automationTick({engine,now"));
  assert.ok(remote.includes("const core=await engine.run({now});"));
  assert.ok(remote.includes("const result=await this.tick({now,send});"));
});

test('0.11.0 general summary reads persisted live reports, not AI',()=>{
  const remote=fs.readFileSync('src/core/remoteSupervisor.js','utf8');
  const start=remote.indexOf('async buildGeneralSummary');
  const end=remote.indexOf('async buildWeekendGlobalReport',start);
  const block=remote.slice(start,end);
  assert.ok(block.includes('listLatestLiveDailyReports'));
  assert.equal(block.includes('analyzeConversation'),false);
  assert.equal(block.includes('this.ai'),false);
});
