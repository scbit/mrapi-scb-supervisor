const crypto=require('crypto');

const ACTION_TYPES=['RESPOND','FOLLOW_UP','DISCOVERY','ADVISE','EXPLAIN_OPTIONS','DO_NOT_DISMISS','IMPROVE_RESPONSE','TRY_TO_CLOSE'];
const QUALITATIVE_TYPES=new Set(['DISCOVERY','ADVISE','EXPLAIN_OPTIONS','DO_NOT_DISMISS','IMPROVE_RESPONSE','TRY_TO_CLOSE']);
const DEFAULT_RUBRICS={
  DISCOVERY:['pregunta producto o mercadería','pregunta cantidad o volumen','pregunta origen','pregunta si tiene proveedor','busca entender objetivo comercial, reventa o recurrencia'],
  ADVISE:['explica al menos una alternativa concreta','adapta la recomendación al caso del cliente','evita una respuesta meramente operativa'],
  EXPLAIN_OPTIONS:['presenta opciones relevantes','explica diferencia o criterio para elegir','propone siguiente paso concreto'],
  DO_NOT_DISMISS:['mantiene la conversación abierta','hace al menos una pregunta útil','no cierra con una frase de despacho'],
  IMPROVE_RESPONSE:['responde con claridad','atiende la necesidad del cliente','agrega orientación o siguiente paso'],
  TRY_TO_CLOSE:['propone una acción concreta de avance','pide confirmación o dato necesario para avanzar','evita cierre pasivo']
};

function id(prefix='rs'){return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`}
function asList(v){if(Array.isArray(v))return v.map(x=>String(x).trim()).filter(Boolean);return String(v||'').split(',').map(x=>x.trim()).filter(Boolean)}
function normSeller(v){return String(v||'').trim().toLowerCase()}
function safeInt(v,d,min,max){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):d}
function hhmm(v,d){const x=String(v||d);return /^([01]\d|2[0-3]):[0-5]\d$/.test(x)?x:d}
function localParts(date,timezone){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(date);const o={};for(const p of parts)o[p.type]=p.value;return{weekday:o.weekday,hour:Number(o.hour),minute:Number(o.minute)}}
function mins(x){const [h,m]=String(x).split(':').map(Number);return h*60+m}
function withinSchedule(cfg,now=new Date()){
  const p=localParts(now,cfg.timezone);if(['Sat','Sun'].includes(p.weekday))return{active:false,reason:'weekend'};const cur=p.hour*60+p.minute,start=mins(cfg.startTime),end=mins(cfg.endTime);if(cur<start||cur>=end)return{active:false,reason:'outside_hours'};for(const pause of cfg.pauses||[]){if(cur>=mins(pause.start)&&cur<mins(pause.end))return{active:false,reason:'pause'}}return{active:true,reason:'active'};
}
function normalizeSupervisorConfig(input={},existing={}){
  const pauses=(Array.isArray(input.pauses)?input.pauses:existing.pauses||[{start:'12:00',end:'13:00'}]).map(p=>({start:hhmm(p.start,'12:00'),end:hhmm(p.end,'13:00')})).filter(p=>mins(p.end)>mins(p.start));
  return{
    id:String(input.id||existing.id||id('supervisor')),
    name:String(input.name??existing.name??'Supervisor remoto').trim()||'Supervisor remoto',
    enabled:input.enabled===undefined?(existing.enabled!==false):!!input.enabled,
    channel:'telegram',
    telegramChatId:String(input.telegramChatId??existing.telegramChatId??'').trim()||null,
    sellers:asList(input.sellers===undefined?existing.sellers:input.sellers),
    timezone:String(input.timezone||existing.timezone||'America/Argentina/Buenos_Aires'),
    startTime:hhmm(input.startTime||existing.startTime,'09:00'),
    endTime:hhmm(input.endTime||existing.endTime,'17:00'),
    pauses,
    frequencyMinutes:safeInt(input.frequencyMinutes??existing.frequencyMinutes,30,5,240),
    lookbackMinutes:safeInt(input.lookbackMinutes??existing.lookbackMinutes,45,10,240),
    content:{activity:true,waiting:true,responseQuality:true,pendingCorrections:true,verificationResults:true,...existing.content,...(input.content||{})},
    updatedAt:new Date().toISOString()
  };
}
function actionRubric(type,custom){const rows=asList(custom);return rows.length?rows:(DEFAULT_RUBRICS[type]||[])}

class RemoteSupervisorService{
  constructor({config,store,inbox,aiProvider,telegram}){this.config=config;this.store=store;this.inbox=inbox;this.ai=aiProvider;this.telegram=telegram}
  async listSupervisors(){return this.store.listRemoteSupervisors()}
  async saveSupervisor(data){const existing=data?.id?await this.store.getRemoteSupervisor(data.id):null;const cfg=normalizeSupervisorConfig(data,existing||{});if(mins(cfg.endTime)<=mins(cfg.startTime))throw new Error('REMOTE_SUPERVISOR_INVALID_HOURS');await this.store.saveRemoteSupervisor(cfg.id,cfg);return cfg}
  async listSellerOptions(){const [convs,deals]=await Promise.all([this.store.listConversationStates(5000),this.store.listAllDeals(20000)]);const map=new Map();for(const r of convs){const s=r.metrics?.owner||r.snapshot?.owner;if(s)map.set(normSeller(s),String(s))}for(const r of deals){const s=r.snapshot?.owner;if(s)map.set(normSeller(s),String(s))}return [...map.values()].sort((a,b)=>a.localeCompare(b))}
  async createAction(input={}){
    const type=String(input.actionType||'').toUpperCase();if(!ACTION_TYPES.includes(type))throw new Error('REMOTE_ACTION_TYPE_INVALID');
    const seller=String(input.seller||input.sellerName||'').trim();const conversationId=String(input.conversationId||'').trim();if(!seller||!conversationId)throw new Error('REMOTE_ACTION_SELLER_AND_CONVERSATION_REQUIRED');
    const duplicate=await this.store.findOpenSupervisionAction({seller,conversationId,actionType:type});if(duplicate)return{...duplicate,duplicate:true};
    const createdAt=new Date().toISOString();const action={id:id('action'),supervisorId:String(input.supervisorId||'manual'),seller,sellerKey:normSeller(seller),conversationId,actionType:type,reason:String(input.reason||'').trim(),expectedBehavior:String(input.expectedBehavior||'').trim(),rubric:actionRubric(type,input.rubric),verificationMode:QUALITATIVE_TYPES.has(type)?'AI':'DETERMINISTIC',status:'WAITING_FOR_ACTION',createdAt,updatedAt:createdAt,attempts:0,recurrenceCount:await this.store.countActionRecurrence({seller,actionType:type})};await this.store.saveSupervisionAction(action.id,action);return action;
  }
  async verifyAction(action){
    if(!['PENDING','WAITING_FOR_ACTION'].includes(action.status))return action;
    const messages=await this.inbox.getMessages(action.conversationId,200);const after=(messages||[]).filter(m=>m.actor==='human'&&new Date(m.timestamp||0)>new Date(action.createdAt));if(!after.length)return action;
    const next=after[0];let verification;
    if(action.verificationMode==='DETERMINISTIC')verification={verified:true,score:100,reason:`Se detectó una acción humana posterior a la corrección: ${String(next.text||'').slice(0,220)}`,evidenceMessageId:next.id,evidenceAt:next.timestamp};
    else{
      if(!this.ai?.verifyCorrection)throw new Error('AI_PROVIDER_VERIFY_CORRECTION_NOT_AVAILABLE');
      verification=await this.ai.verifyCorrection({action,message:next,conversation:await this.inbox.getConversation(action.conversationId)});
    }
    const status=verification.verified?'VERIFIED':'FAILED';const updated={...action,status,attempts:Number(action.attempts||0)+1,nextRelevantSellerMessageAt:next.timestamp,verificationResult:verification,verifiedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await this.store.saveSupervisionAction(action.id,updated);return updated;
  }
  async verifyPending({limit=100}={}){const rows=await this.store.listOpenSupervisionActions(limit);const out=[];for(const a of rows){try{out.push(await this.verifyAction(a))}catch(e){out.push({...a,verificationError:e.message})}}return out}
  async buildSupervisorReport(supervisorId,{now=new Date()}={}){
    const cfg=await this.store.getRemoteSupervisor(supervisorId);if(!cfg)throw new Error('REMOTE_SUPERVISOR_NOT_FOUND');const wanted=new Set((cfg.sellers||[]).map(normSeller));const convs=await this.store.listConversationStates(5000);const mine=convs.filter(c=>!wanted.size||wanted.has(normSeller(c.metrics?.owner||c.snapshot?.owner)));
    const waiting=mine.filter(c=>c.currentWaiting===true||c.metrics?.currentWaiting===true);const sellers=new Map();const ensure=s=>{const k=normSeller(s||'Sin asignar');if(!sellers.has(k))sellers.set(k,{name:s||'Sin asignar',waiting:0,active:0,lastActivityAt:null});return sellers.get(k)};
    for(const c of mine){const seller=c.metrics?.owner||c.snapshot?.owner||'Sin asignar',s=ensure(seller);if(c.currentWaiting===true||c.metrics?.currentWaiting===true)s.waiting++;const iso=c.metrics?.lastSellerActivityAt;if(iso&&(!s.lastActivityAt||iso>s.lastActivityAt))s.lastActivityAt=iso}
    const cutoff=now.getTime()-cfg.lookbackMinutes*60000;for(const s of sellers.values())s.active=s.lastActivityAt&&new Date(s.lastActivityAt).getTime()>=cutoff?1:0;
    const actions=await this.store.listSupervisionActionsForSellers([...wanted],200);const open=actions.filter(a=>['PENDING','WAITING_FOR_ACTION','FAILED'].includes(a.status));const recentlyVerified=actions.filter(a=>a.status==='VERIFIED'&&a.verifiedAt&&new Date(a.verifiedAt).getTime()>=cutoff);
    const lines=[`SUPERVISOR REMOTO — ${cfg.name}`,`Horario ${cfg.startTime}-${cfg.endTime} · frecuencia ${cfg.frequencyMinutes} min`,''];
    lines.push('👥 VENDEDORES');for(const s of [...sellers.values()].sort((a,b)=>a.name.localeCompare(b.name)))lines.push(`${s.active?'🟢':'⚪'} ${s.name} — esperando ${s.waiting}${s.lastActivityAt?` · última actividad ${s.lastActivityAt}`:''}`);
    lines.push('','🚨 CLIENTES ESPERANDO');if(!waiting.length)lines.push('Sin clientes esperando en los vendedores seleccionados.');else waiting.slice(0,12).forEach(c=>lines.push(`• ${c.snapshot?.contactName||c.snapshot?.title||c.id} — ${c.metrics?.owner||c.snapshot?.owner||'Sin asignar'} — ${Math.round(c.metrics?.waitingMinutes||0)} min${c.id?` — https://hub.sentirecustomsbroker.com/?conversationId=${encodeURIComponent(c.id)}`:''}`));
    lines.push('','🎯 CORRECCIONES PENDIENTES');if(!open.length)lines.push('Sin correcciones pendientes.');else open.slice(0,12).forEach(a=>lines.push(`${a.status==='FAILED'?'❌':'🟠'} ${a.seller} — ${a.actionType} — ${a.status}${a.reason?` — ${a.reason}`:''}\nhttps://hub.sentirecustomsbroker.com/?conversationId=${encodeURIComponent(a.conversationId)}`));
    if(recentlyVerified.length){lines.push('','✅ CORRECCIONES APLICADAS');recentlyVerified.slice(0,10).forEach(a=>lines.push(`• ${a.seller} — ${a.actionType} — aplicada`))}
    const report={id:id('remote_report'),supervisorId:cfg.id,generatedAt:now.toISOString(),configSnapshot:cfg,summary:{sellerCount:sellers.size,waiting:waiting.length,pendingCorrections:open.length,verifiedRecent:recentlyVerified.length},text:lines.join('\n')};await this.store.saveRemoteReport(report.id,report);return report;
  }
  async runSupervisor(supervisorId,{now=new Date(),send=true,force=false}={}){
    const cfg=await this.store.getRemoteSupervisor(supervisorId);if(!cfg)throw new Error('REMOTE_SUPERVISOR_NOT_FOUND');if(!cfg.enabled&&!force)return{skipped:true,reason:'disabled'};const sched=withinSchedule(cfg,now);if(!sched.active&&!force)return{skipped:true,reason:sched.reason};const last=await this.store.getRemoteCheckpoint(`last_send_${cfg.id}`);if(!force&&last?.at&&now.getTime()-new Date(last.at).getTime()<cfg.frequencyMinutes*60000)return{skipped:true,reason:'frequency_not_due'};
    const verified=await this.verifyPending();const report=await this.buildSupervisorReport(cfg.id,{now});let sent=null;if(send){sent=await this.telegram.send(report.text,cfg.telegramChatId||undefined);await this.store.saveRemoteCheckpoint(`last_send_${cfg.id}`,{at:now.toISOString(),reportId:report.id})}return{skipped:false,verified,report,sent};
  }
  async tick({now=new Date(),send=true}={}){const configs=(await this.listSupervisors()).filter(x=>x.enabled);const results=[];for(const cfg of configs){try{results.push({supervisorId:cfg.id,...await this.runSupervisor(cfg.id,{now,send})})}catch(e){results.push({supervisorId:cfg.id,error:e.message})}}return{at:now.toISOString(),results}}
  async sellerCompliance(seller){const rows=await this.store.listSupervisionActionsForSeller(seller,500);const verified=rows.filter(x=>x.status==='VERIFIED').length,failed=rows.filter(x=>x.status==='FAILED').length,total=verified+failed;const byType={};for(const r of rows){byType[r.actionType]=(byType[r.actionType]||0)+1}return{seller,total,verified,failed,pending:rows.filter(x=>['PENDING','WAITING_FOR_ACTION'].includes(x.status)).length,compliancePct:total?Math.round(verified/total*100):null,byType}}
}
module.exports={RemoteSupervisorService,ACTION_TYPES,QUALITATIVE_TYPES,DEFAULT_RUBRICS,normalizeSupervisorConfig,withinSchedule};
