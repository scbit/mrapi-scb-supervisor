const express=require('express');
const path=require('path');
const {requireCoreAuth}=require('./security');
const {validateSources}=require('../core/sourceValidation');
const {TelegramAdapter}=require('../adapters/telegramAdapter');
const {EmailAdapter}=require('../adapters/emailAdapter');
const {BucketAdapter}=require('../adapters/bucketAdapter');
const {version}=require('../../package.json');

function reportSubject(report){
  const stamp=report?.generatedAt?new Date(report.generatedAt):new Date();
  const date=new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(stamp);
  return `SUPERVISOR SCB — Reporte ${date}`;
}
function communicationCheckpoint(channel,result,error=null){
  return{channel,ok:!error,result:result||null,error:error?String(error.message||error):null,at:new Date().toISOString()};
}
function createApp({engine,databases,config,telegramAdapter,emailAdapter,bucketAdapter}){
  const app=express();app.use(express.json({limit:'1mb'}));
  const auth=requireCoreAuth(process.env);
  const telegram=telegramAdapter||new TelegramAdapter(process.env);
  const email=emailAdapter||new EmailAdapter(process.env);
  const bucket=bucketAdapter||new BucketAdapter(process.env);
  const saveComm=(channel,result,error)=>engine.store.saveCheckpoint(`communication_last_${channel}`,communicationCheckpoint(channel,result,error));
  const getComm=channel=>engine.store.getCheckpoint(`communication_last_${channel}`);
  async function latestOrGenerate(run){let report=await engine.store.getLatestReport();if(run||!report){const out=await engine.run({now:new Date()});report=out.report}if(!report)throw new Error('REPORT_NOT_AVAILABLE');return report}
  async function sendTelegramReport(report){const sent=await telegram.send(report.text);const at=new Date().toISOString();await engine.store.saveReport(report.id||report.reportId||`manual-${Date.now()}`,{...report,telegramSent:true,telegramMessageId:sent.messageId,telegramSentAt:at});await saveComm('telegram',sent);return sent}
  async function sendEmailReport(report){const sent=await email.send({subject:reportSubject(report),bodyText:report.text,operationId:`report-${report.id||report.reportId||report.runId||Date.now()}`,source:'supervisor-scb-report'});const at=new Date().toISOString();await engine.store.saveReport(report.id||report.reportId||`manual-${Date.now()}`,{...report,emailSent:true,emailLogId:sent.logId,emailMessageId:sent.messageId,emailSentAt:at});await saveComm('email',sent);return sent}

  app.get('/',(_q,r)=>r.sendFile(path.join(__dirname,'../../public/index.html')));
  app.get('/api',(_q,r)=>r.json({ok:true,service:'SUPERVISOR SCB V3',version,endpoints:['/health','/api/core/status','/api/core/validate-sources','/api/core/run','/api/integrations/status','/api/integrations/email/validate','/api/integrations/email/test','/api/integrations/telegram/test','/api/integrations/bucket/validate','/api/supervisor/report/generate','/api/supervisor/report','/api/supervisor/report/send/telegram','/api/supervisor/report/send/email','/api/supervisor/report/send/all']}));
  app.get('/health',(_q,r)=>r.json({ok:true,version,databases:databases.ids,sourceReadOnly:true,telegramConfigured:telegram.isConfigured(),emailConfigured:email.isConfigured(),bucketConfigured:bucket.isConfigured(),bucketName:bucket.name||null}));
  app.get('/api/core/validate-sources',auth,async(_q,r)=>r.json({ok:true,validation:await validateSources(databases)}));
  app.get('/api/core/status',auth,async(_q,r)=>r.json({ok:true,version,latestRun:await engine.store.getLatestRun(),crmInitialSnapshot:await engine.store.getCheckpoint('crm_initial_snapshot_v1')}));
  app.post('/api/core/run',auth,async(q,r)=>{try{const now=q.body?.now?new Date(q.body.now):new Date();r.json({ok:true,result:await engine.run({now})})}catch(e){r.status(500).json({ok:false,error:e.message})}});

  app.get('/api/integrations/status',auth,async(_q,r)=>{try{const [lastTelegram,lastEmail]=await Promise.all([getComm('telegram'),getComm('email')]);r.json({ok:true,telegram:{configured:telegram.isConfigured(),last:lastTelegram},email:{...email.configStatus(),last:lastEmail},bucket:{configured:bucket.isConfigured(),name:bucket.name||null,mode:'validation_only'}})}catch(e){r.status(500).json({ok:false,error:e.message})}});
  app.post('/api/integrations/email/validate',auth,async(_q,r)=>{try{const result=await email.validateService();r.json({ok:true,result})}catch(e){r.status(500).json({ok:false,error:e.message})}});
  app.post('/api/integrations/email/test',auth,async(_q,r)=>{try{const now=new Date().toISOString();const sent=await email.send({subject:'Prueba SUPERVISOR SCB V3',bodyText:`Prueba de email SUPERVISOR SCB V3\n\nFecha: ${now}\nEstado: OK`,operationId:`email-test-${Date.now()}`,source:'supervisor-scb-test'});await saveComm('email',sent);r.json({ok:true,sent})}catch(e){await saveComm('email',null,e).catch(()=>{});r.status(500).json({ok:false,error:e.message})}});
  app.post('/api/integrations/telegram/test',auth,async(_q,r)=>{try{const sent=await telegram.send(`SUPERVISOR SCB V3 — Prueba Telegram\n${new Date().toISOString()}\nEstado: OK`);await saveComm('telegram',sent);r.json({ok:true,sent})}catch(e){await saveComm('telegram',null,e).catch(()=>{});r.status(500).json({ok:false,error:e.message})}});
  app.post('/api/integrations/bucket/validate',auth,async(_q,r)=>{try{r.json({ok:true,result:await bucket.validate()})}catch(e){r.status(500).json({ok:false,error:e.message})}});

  app.post('/api/supervisor/report/generate',auth,async(q,r)=>{try{const now=q.body?.now?new Date(q.body.now):new Date();const out=await engine.run({now});r.json({ok:true,report:out.report,result:{runId:out.runId||out.report?.runId,processedConversations:out.processedConversations,processedDeals:out.processedDeals,crmMode:out.crmMode}})}catch(e){r.status(500).json({ok:false,error:e.message})}});
  app.get('/api/supervisor/report',auth,async(_q,r)=>r.json({ok:true,report:await engine.store.getLatestReport()}));
  app.post('/api/supervisor/report/send/telegram',auth,async(q,r)=>{try{const report=await latestOrGenerate(q.body?.run===true);r.json({ok:true,sent:await sendTelegramReport(report)})}catch(e){await saveComm('telegram',null,e).catch(()=>{});r.status(500).json({ok:false,error:e.message})}});
  app.post('/api/supervisor/report/send/email',auth,async(q,r)=>{try{const report=await latestOrGenerate(q.body?.run===true);r.json({ok:true,sent:await sendEmailReport(report)})}catch(e){await saveComm('email',null,e).catch(()=>{});r.status(500).json({ok:false,error:e.message})}});
  app.post('/api/supervisor/report/send/all',auth,async(q,r)=>{try{const report=await latestOrGenerate(q.body?.run===true);const result={telegram:null,email:null};const errors=[];try{result.telegram=await sendTelegramReport(report)}catch(e){errors.push({channel:'telegram',error:e.message});await saveComm('telegram',null,e).catch(()=>{})}try{result.email=await sendEmailReport(report)}catch(e){errors.push({channel:'email',error:e.message});await saveComm('email',null,e).catch(()=>{})}const ok=errors.length===0;r.status(ok?200:207).json({ok,result,errors})}catch(e){r.status(500).json({ok:false,error:e.message})}});
  app.post('/api/supervisor/report/send',auth,async(q,r)=>{try{const report=await latestOrGenerate(q.body?.run===true);r.json({ok:true,sent:await sendTelegramReport(report)})}catch(e){r.status(500).json({ok:false,error:e.message})}});
  return app;
}
module.exports={createApp,reportSubject};
