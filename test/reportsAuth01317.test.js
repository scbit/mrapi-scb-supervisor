const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const {sessionValue,parseCookies,requireCoreAuth}=require('../src/http/security');

function mockReq({token='',cookie='',proto='https'}={}){
  return {protocol:proto,get:(k)=>({
    'x-supervisor-token':token,
    'cookie':cookie,
    'x-forwarded-proto':proto
  }[String(k).toLowerCase()]||'')};
}
function mockRes(){
  return {
    statusCode:200,headers:{},body:null,
    status(n){this.statusCode=n;return this},
    json(x){this.body=x;return this},
    append(k,v){this.headers[k]=v;return this}
  };
}

test('0.13.17 authenticated header seeds HttpOnly browser session without exposing token',()=>{
  const env={SUPERVISOR_API_TOKEN:'secret-123',SUPERVISOR_REQUIRE_AUTH:'true'};
  const auth=requireCoreAuth(env),req=mockReq({token:'secret-123'}),res=mockRes();let next=false;
  auth(req,res,()=>{next=true});
  assert.equal(next,true);
  const cookie=res.headers['Set-Cookie'];
  assert.ok(cookie.includes('supervisor_session='));
  assert.ok(cookie.includes('HttpOnly'));
  assert.ok(cookie.includes('SameSite=Strict'));
  assert.ok(!cookie.includes('secret-123'));
});

test('0.13.17 session cookie authenticates reports APIs without header token',()=>{
  const token='secret-123',env={SUPERVISOR_API_TOKEN:token,SUPERVISOR_REQUIRE_AUTH:'true'};
  const auth=requireCoreAuth(env),req=mockReq({cookie:`supervisor_session=${sessionValue(token)}`}),res=mockRes();let next=false;
  auth(req,res,()=>{next=true});
  assert.equal(next,true);
});

test('0.13.17 invalid session still fails closed',()=>{
  const auth=requireCoreAuth({SUPERVISOR_API_TOKEN:'secret-123',SUPERVISOR_REQUIRE_AUTH:'true'});
  const req=mockReq({cookie:'supervisor_session=bad'}),res=mockRes();let next=false;
  auth(req,res,()=>{next=true});
  assert.equal(next,false);
  assert.equal(res.statusCode,401);
  assert.equal(res.body.error,'UNAUTHORIZED');
});

test('0.13.17 reports UI uses same-origin session and distinguishes auth from scheduler failure',()=>{
  const s=fs.readFileSync('public/reports.html','utf8');
  assert.ok(s.includes("credentials:'same-origin'"));
  assert.ok(s.includes('No es una falla del Scheduler'));
  assert.ok(s.includes('Sesión autenticada'));
});

test('0.13.17 main UI sends same-origin credentials to seed session',()=>{
  const s=fs.readFileSync('public/index.html','utf8');
  assert.ok(s.includes("fetch(url,{credentials:'same-origin',...opt})"));
});
