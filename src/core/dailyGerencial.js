const {cleanSellerLabel,aggregatePortfolio,aggregateFollowUps,humanDuration}=require('./report');
const {localDayRange}=require('./time');

function norm(v){return String(v||'').trim().toLowerCase()}
function ymdArgentina(date=new Date(),timezone='America/Argentina/Buenos_Aires'){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=t=>parts.find(x=>x.type===t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function businessRange(date,config){
  const start=String(config.business_hours?.start||'09:00');
  const end=String(config.business_hours?.end||'17:00');
  const from=new Date(`${date}T${start}:00-03:00`);
  const to=new Date(`${date}T${end}:00-03:00`);
  const fullFrom=new Date(`${date}T00:00:00-03:00`);
  const fullTo=new Date(`${date}T23:59:59.999-03:00`);
  return{from,to,fullFrom,fullTo,label:`${start}–${end}`};
}
function minutes(a,b){const x=new Date(a).getTime(),y=new Date(b).getTime();if(!Number.isFinite(x)||!Number.isFinite(y)||y<x)return null;return Math.round((y-x)/60000)}
function inRange(iso,from,to){const t=new Date(iso||0).getTime();return Number.isFinite(t)&&t>=from.getTime()&&t<=to.getTime()}
function analyzeDailyConversation(conversation,messages,range,lateMinutes=30){
  const all=(messages||[]).filter(m=>m.timestamp).slice().sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp));
  const work=all.filter(m=>inRange(m.timestamp,range.from,range.to));
  const inbound=work.filter(m=>m.actor==='client');
  const bots=work.filter(m=>m.actor==='bot');
  const humans=work.filter(m=>m.actor==='human');
  let pendingAt=null,pendingText='',responses=[],lastHuman=null,lastClient=null;
  for(const m of work){
    if(m.actor==='client'){
      lastClient=m;
      if(!pendingAt){pendingAt=m.timestamp;pendingText=m.text||''}
    }else if(m.actor==='human'){
      lastHuman=m;
      if(pendingAt){const mins=minutes(pendingAt,m.timestamp);responses.push({minutes:mins,inboundAt:pendingAt,humanAt:m.timestamp,seller:m.user||conversation.owner||'',customerText:pendingText,humanText:m.text||''});pendingAt=null;pendingText=''}
    }
  }
  let afterHours=false,businessCloseGrace=false;
  if(pendingAt){
    const nextHuman=all.find(m=>m.actor==='human'&&new Date(m.timestamp)>new Date(pendingAt)&&new Date(m.timestamp)<=range.fullTo);
    if(nextHuman){const mins=minutes(pendingAt,nextHuman.timestamp);responses.push({minutes:mins,inboundAt:pendingAt,humanAt:nextHuman.timestamp,seller:nextHuman.user||conversation.owner||'',customerText:pendingText,humanText:nextHuman.text||''});lastHuman=nextHuman;pendingAt=null;pendingText='';afterHours=new Date(nextHuman.timestamp)>range.to}
  }
  if(pendingAt){const avail=minutes(pendingAt,range.to.toISOString());if(avail!==null&&avail<lateMinutes)businessCloseGrace=true}
  const responseMinutes=responses.map(x=>x.minutes).filter(Number.isFinite);
  const lateResponses=responseMinutes.filter(x=>x>lateMinutes);
  const humanResponded=responses.length>0||humans.length>0;
  const noHumanResponse=inbound.length>0&&!humanResponded&&!businessCloseGrace;
  const botOnly=inbound.length>0&&bots.length>0&&!humanResponded&&!businessCloseGrace;
  const seller=lastHuman?.user||humans.at(-1)?.user||conversation.owner||'sin asignar';
  return{
    conversationId:conversation.id,contactName:conversation.contactName||conversation.phone||'Sin nombre',owner:conversation.owner||null,seller,
    clientMessages:inbound.length,humanMessages:humans.length,botMessages:bots.length,humanResponded,noHumanResponse,botOnly,businessCloseGrace,respondedOutsideBusinessHours:afterHours,
    responseCount:responseMinutes.length,lateCount:lateResponses.length,avgResponseMinutes:responseMinutes.length?Math.round(responseMinutes.reduce((a,b)=>a+b,0)/responseMinutes.length):null,maxResponseMinutes:responseMinutes.length?Math.max(...responseMinutes):null,
    lastClientAt:lastClient?.timestamp||null,lastHumanAt:lastHuman?.timestamp||humans.at(-1)?.timestamp||null
  };
}
function sellerLabel(owner,userMap){return cleanSellerLabel(userMap.get(norm(owner))||owner||'Sin asignar')}
function aggregateAttention(rows,userMap){
  const m=new Map();
  for(const r of rows){
    const key=norm(r.seller||r.owner||'sin asignar');
    if(!m.has(key))m.set(key,{owner:key,label:sellerLabel(r.seller||r.owner,userMap),clientChats:0,humanResponded:0,noHumanResponse:0,botOnly:0,late:0,afterHours:0,responseMinutes:[]});
    const x=m.get(key);x.clientChats++;if(r.humanResponded)x.humanResponded++;if(r.noHumanResponse)x.noHumanResponse++;if(r.botOnly)x.botOnly++;x.late+=r.lateCount||0;if(r.respondedOutsideBusinessHours)x.afterHours++;if(Number.isFinite(r.avgResponseMinutes))x.responseMinutes.push(r.avgResponseMinutes);
  }
  return[...m.values()].map(x=>({...x,avgResponseMinutes:x.responseMinutes.length?Math.round(x.responseMinutes.reduce((a,b)=>a+b,0)/x.responseMinutes.length):null})).sort((a,b)=>b.noHumanResponse-a.noHumanResponse||b.late-a.late||b.clientChats-a.clientChats);
}
function telegramText(r){
  const L=[];
  L.push(`📊 SUPERVISOR SCB — CIERRE GERENCIAL`,`${r.date} · ${r.businessHours}`,'');
  L.push('📥 ATENCIÓN DEL DÍA','',`Conversaciones con clientes: ${r.attention.clientChats}`,`Respondidas por humano: ${r.attention.humanResponded}`,`Sin respuesta humana: ${r.attention.noHumanResponse}`,`Solo bot: ${r.attention.botOnly}`,`Respuestas tarde (+${r.lateMinutes} min): ${r.attention.late}`,`Respondidas fuera de horario: ${r.attention.afterHours}`,`Tiempo promedio respuesta: ${r.attention.avgResponseMinutes===null?'—':humanDuration(r.attention.avgResponseMinutes)}`,'');
  L.push('📊 CARTERA AL CIERRE','',`Vigentes: ${r.portfolio.total}`,`🟢 Al día: ${r.portfolio.upToDate}`,`🔴 Vencidos: ${r.portfolio.overdue}`,`⚪ Sin fecha: ${r.portfolio.noDueDate}`,'');
  L.push('🎯 HUNTER','',`Gestiones del día: ${r.hunter.total}`,`Vendedores con gestiones: ${r.hunter.sellers}`,'');
  L.push('🔥 OPORTUNIDADES','',`Nuevos HORNO: ${r.events.HORNO}`,`🏆 Nuevos GANADO: ${r.events.GANADO}`,`📣 GANADO desde publicidad: ${r.events.GANADO_FROM_AD}`,'');
  L.push('👥 VENDEDORES A REVISAR','');
  const review=r.bySeller.filter(x=>x.noHumanResponse||x.late).slice(0,10);
  if(!review.length)L.push('Sin casos destacados.');
  else for(const s of review)L.push(`${s.label} — ${s.clientChats} chats | ${s.noHumanResponse} sin respuesta | ${s.late} tarde`);
  L.push('','🧠 CALIDAD COMERCIAL','',`Evaluación IA: ${r.aiQuality.status}`,r.aiQuality.note);
  return L.join('\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,4090);
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function metric(label,value,color='#101828'){return `<td width="25%" valign="top" style="padding:8px"><div style="font-family:Arial;font-size:12px;color:#667085">${esc(label)}</div><div style="font-family:Arial;font-size:22px;font-weight:700;color:${color};margin-top:3px">${esc(value)}</div></td>`}
function section(title,body){return `<tr><td style="padding:0 0 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e4e7ec;border-radius:12px"><tr><td style="padding:18px 20px 10px;font-family:Arial;font-size:18px;font-weight:700;color:#101828">${title}</td></tr><tr><td style="padding:0 20px 18px">${body}</td></tr></table></td></tr>`}
function sellerTable(rows){const body=rows.map((s,i)=>`<tr><td style="padding:8px;border-bottom:1px solid #eaecf0;font-family:Arial;font-size:13px">${esc(s.label)}</td><td align="right" style="padding:8px;border-bottom:1px solid #eaecf0;font-family:Arial;font-size:13px">${s.clientChats}</td><td align="right" style="padding:8px;border-bottom:1px solid #eaecf0;font-family:Arial;font-size:13px;color:#b42318;font-weight:700">${s.noHumanResponse}</td><td align="right" style="padding:8px;border-bottom:1px solid #eaecf0;font-family:Arial;font-size:13px;color:#b54708;font-weight:700">${s.late}</td><td align="right" style="padding:8px;border-bottom:1px solid #eaecf0;font-family:Arial;font-size:13px">${s.avgResponseMinutes===null?'—':humanDuration(s.avgResponseMinutes)}</td></tr>`).join('');return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><th align="left" style="padding:8px;background:#f8fafc;font-family:Arial;font-size:12px">Vendedor</th><th align="right" style="padding:8px;background:#f8fafc;font-family:Arial;font-size:12px">Chats</th><th align="right" style="padding:8px;background:#f8fafc;font-family:Arial;font-size:12px">Sin respuesta</th><th align="right" style="padding:8px;background:#f8fafc;font-family:Arial;font-size:12px">Tarde</th><th align="right" style="padding:8px;background:#f8fafc;font-family:Arial;font-size:12px">Promedio</th></tr>${body}</table>`}
function emailHtml(r){
  const att=`<table role="presentation" width="100%"><tr>${metric('Clientes',r.attention.clientChats)}${metric('Respondidos',r.attention.humanResponded,'#027a48')}${metric('Sin respuesta',r.attention.noHumanResponse,'#b42318')}${metric('Solo bot',r.attention.botOnly,'#b54708')}</tr><tr>${metric('Respuestas tarde',r.attention.late,'#b54708')}${metric('Fuera de horario',r.attention.afterHours)}${metric('Promedio',r.attention.avgResponseMinutes===null?'—':humanDuration(r.attention.avgResponseMinutes))}<td></td></tr></table>`;
  const port=`<table role="presentation" width="100%"><tr>${metric('Vigentes',r.portfolio.total)}${metric('Al día',r.portfolio.upToDate,'#027a48')}${metric('Vencidos',r.portfolio.overdue,'#b42318')}${metric('Sin fecha',r.portfolio.noDueDate,'#667085')}</tr></table>`;
  const hunter=`<table role="presentation" width="100%"><tr>${metric('Gestiones del día',r.hunter.total,'#175cd3')}${metric('Vendedores con gestiones',r.hunter.sellers)}${metric('Nuevos HORNO',r.events.HORNO,'#b54708')}${metric('Nuevos GANADO',r.events.GANADO,'#027a48')}</tr></table>`;
  const quality=`<div style="font-family:Arial;font-size:13px;line-height:20px;color:#475467"><b>${esc(r.aiQuality.status)}</b><br>${esc(r.aiQuality.note)}</div>`;
  return `<!doctype html><html><body style="margin:0;background:#f2f4f7"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="900" style="width:100%;max-width:900px"><tr><td style="padding:0 4px 20px"><div style="font-family:Arial;font-size:28px;font-weight:700;color:#101828">SUPERVISOR SCB — CIERRE GERENCIAL</div><div style="font-family:Arial;font-size:14px;color:#667085;margin-top:5px">${esc(r.date)} · ${esc(r.businessHours)}</div></td></tr>${section('📥 ATENCIÓN DEL DÍA',att)}${section('📊 CARTERA AL CIERRE',port)}${section('🎯 HUNTER + OPORTUNIDADES',hunter)}${section('👥 RENDIMIENTO POR VENDEDOR',sellerTable(r.bySeller))}${section('🧠 CALIDAD COMERCIAL',quality)}<tr><td style="font-family:Arial;font-size:11px;color:#98a2b3;padding:0 4px">SUPERVISOR SCB V3 · fuentes operativas READ ONLY · persistencia supervisor-scb.</td></tr></table></td></tr></table></body></html>`;
}
class DailyGerencialService{
  constructor({config,inbox,crm,hunter,store}){this.config=config;this.inbox=inbox;this.crm=crm;this.hunter=hunter;this.store=store}
  async generate({date,now=new Date()}={}){
    const target=date||ymdArgentina(now,this.config.timezone);const range=businessRange(target,this.config);const lateMinutes=30;
    const [conversations,crmUsers,activeDeals,trackedDeals,hunterRows,events]=await Promise.all([
      this.inbox.listConversationsInRange({from:range.fullFrom,to:range.fullTo,limit:Number(this.config.incremental.max_daily_conversation_states||5000)}),
      this.crm.listUsers().catch(()=>[]),this.store.listActiveDeals(20000),this.store.listTrackedDeals(20000),this.store.listHunterDay(target,10000),this.store.listEventsRange(range.fullFrom.toISOString(),range.fullTo.toISOString(),2000)
    ]);
    const userMap=new Map();for(const u of crmUsers){for(const k of [u.email,u.id,u.name])if(k)userMap.set(norm(k),u.name||u.email||u.id)}
    const rows=[];for(const c of conversations){const messages=await this.inbox.getMessages(c.id,this.config.incremental.max_messages_per_conversation);const row=analyzeDailyConversation(c,messages,range,lateMinutes);if(row.clientMessages>0)rows.push(row)}
    const responseValues=rows.map(r=>r.avgResponseMinutes).filter(Number.isFinite);
    const attention={clientChats:rows.length,humanResponded:rows.filter(r=>r.humanResponded).length,noHumanResponse:rows.filter(r=>r.noHumanResponse).length,botOnly:rows.filter(r=>r.botOnly).length,late:rows.reduce((a,r)=>a+(r.lateCount||0),0),afterHours:rows.filter(r=>r.respondedOutsideBusinessHours).length,businessCloseGrace:rows.filter(r=>r.businessCloseGrace).length,avgResponseMinutes:responseValues.length?Math.round(responseValues.reduce((a,b)=>a+b,0)/responseValues.length):null};
    const portfolio=aggregatePortfolio(activeDeals),followUps=aggregateFollowUps(trackedDeals),bySeller=aggregateAttention(rows,userMap);
    const hunterEvents=hunterRows.map(x=>x.row).filter(Boolean);const hunterSellers=new Set(hunterEvents.map(x=>norm(x.sellerId||x.userId||x.owner||x.seller||x.user||x.email)).filter(Boolean));
    const ev={HORNO:0,GANADO:0,GANADO_FROM_AD:0};for(const e of events)if(Object.hasOwn(ev,e.type))ev[e.type]++;
    const report={id:`daily__${target}`,reportType:'daily_gerencial',date:target,generatedAt:now.toISOString(),businessHours:range.label,lateMinutes,attention,portfolio,followUps,hunter:{total:hunterEvents.length,sellers:hunterSellers.size},events:ev,bySeller,aiQuality:{status:'PENDIENTE',note:'La evaluación consultiva con IA del legacy todavía no se activa en V3. Este cierre usa métricas operativas reales y no inventa calidad comercial.'},sourceReadOnly:true};
    report.text=telegramText(report);report.html=emailHtml(report);await this.store.saveDailyReport(target,report);return report;
  }
}
module.exports={DailyGerencialService,analyzeDailyConversation,businessRange,telegramText,emailHtml,ymdArgentina};
