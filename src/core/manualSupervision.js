const {hubUrl}=require('./dailyGerencial');
const {daysOverdue}=require('./time');

function norm(v){return String(v||'').trim().toLowerCase()}
function sellerMatch(r,key){return norm(r?.seller||r?.owner)===norm(key)}
function pct(n,d){return d?Math.round(n/d*100):0}
function product(row){
  const ai=row.ai||{},n=String(ai.product_name||'').trim();
  if(n)return{defined:true,name:n,source:String(ai.product_source||'CONTEXTO').toUpperCase(),sellerDiscovered:ai.seller_discovered_product===true};
  const texts=[...(Array.isArray(row.clientTexts)?row.clientTexts:[]),...(Array.isArray(row.botTexts)?row.botTexts:[]),...(Array.isArray(row.humanTexts)?row.humanTexts.map(x=>x?.text||''):[]),row.lastClientText||'',row.lastHumanText||''].map(x=>String(x||'').trim()).filter(Boolean);
  for(const t of texts){
    const m=t.match(/\b(?:importar|traer|comprar|cotizar|necesit[oa]|busc[oa])\s+(?:una?|unos?|las?|los?)?\s*(.{3,120})/i);
    if(m){const name=m[1].replace(/[.!?].*$/,'').trim();if(name&&name.length<=120)return{defined:true,name,source:'CONTEXTO',sellerDiscovered:false}}
  }
  return{defined:false,name:'',source:'NO_CLARO',sellerDiscovered:false}
}
function profile(row){return String(row?.ai?.customer_profile_type||row?.ai?.customer_profile_guess||'DESCONOCIDO').toUpperCase()}
function checklist(row){const a=row.ai||{},g=a.guide_checklist||{};return{business:g.understood_business===true||a.did_ask_business_context===true,experience:g.knows_import_experience===true||a.did_ask_import_experience===true,supplier:g.knows_supplier===true,scb:g.explained_scb_value===true||a.scb_value_explained===true,recommendation:g.gave_useful_recommendation===true||a.useful_recommendation===true,next:g.left_concrete_next_step===true||a.concrete_next_step===true}}
function commercialAdvance(row){
  return row?.commercialAdvance===true||row?.goodCommercialResponse===true
}
function needsCorrection(row){
  if(row.leadActivationInsufficient||row.followUpNeedsCorrection||row.noHumanResponse||row.botOnly||row.ai?.grave_failure===true)return true;
  if(row.inboundCount>0)return !commercialAdvance(row);
  return false
}
function severity(row){const l=String(row?.ai?.grave_failure_level||'NONE').toUpperCase();if(l==='HIPER_GRAVE')return'HIPER_GRAVE';if(l==='GRAVE'||row.noHumanResponse)return'GRAVE';return needsCorrection(row)?'A_CORREGIR':'OK'}
function caseReason(row){const a=row.ai||{};if(row.leadActivationInsufficient)return`Lead de publicidad sin respuesta real del cliente. En el primer día de activación el vendedor hizo ${Number(row.leadActivationAttempts||0)} de 3 contactos mínimos.`;return String((row.followUpNeedsCorrection&&a.follow_up_reason)||a.grave_failure_reason||a.sales_coaching||a.summary||a.bad_points?.[0]|| (row.noHumanResponse?'Sin respuesta humana.':row.operationalWithoutDiscovery?'Respondió sin suficiente indagación comercial.':row.unexploredPotential?'Potencial comercial no explorado.':row.lateCount>0?`Respuesta tardía (${row.maxHumanResponseMinutes||0} min).`:'Revisar gestión comercial.')).trim()}
function expected(row){const a=row.ai||{};if(row.leadActivationInsufficient)return`Completar 3 contactos útiles en el día de activación. Si no responde después de los 3, pasar a seguimiento pasivo cada 7-10 días y mantener vigente la próxima fecha CRM.`;if(row.followUpNeedsCorrection&&a.follow_up_expected_action)return String(a.follow_up_expected_action);const p=product(row),c=checklist(row),parts=[];if(!p.defined)parts.push('descubrir qué producto quiere traer');if(!c.business)parts.push('entender el negocio/canal de venta');if(!c.experience)parts.push('saber si ya importó');if(!c.supplier)parts.push('confirmar proveedor');if(!c.scb)parts.push('explicar valor SCB según perfil');if(!c.recommendation)parts.push('dar una recomendación útil');if(!c.next)parts.push('dejar próximo paso concreto');return parts.slice(0,4).join(', ')||String(a.next_best_reply||'Mantener seguimiento comercial concreto')}
function humanMinutes(v){const n=Number(v);if(!Number.isFinite(n)||n<0)return null;if(n<60)return `${Math.round(n)} min`;const h=Math.floor(n/60),m=Math.round(n%60);return m?`${h}h ${m}m`:`${h}h`}
function responseStatus(row){if(row.leadActivationRequired)return`ACTIVACIÓN INICIAL · ${Number(row.leadActivationAttempts||0)}/3 mensajes`;if(row.noHumanResponse)return'SIN RESPUESTA HUMANA';const max=Number(row.maxHumanResponseMinutes);if(Number(row.lateCount||0)>0&&Number.isFinite(max))return`TARDE · ${humanMinutes(max)}`;if(Number.isFinite(max))return`A TIEMPO · ${humanMinutes(max)}`;return row.humanResponded?'RESPONDIÓ · sin demora calculable':'SIN RESPUESTA HUMANA'}
function followUpLabel(row){if(row.readyToDiscardNoResponse)return`PARA DESCARTAR · ${Number(row.followUpAttemptsAfterLastClient||0)} intentos`;if(row.followUpNeedsCorrection)return`INSUFICIENTE · ${Number(row.followUpAttemptsAfterLastClient||0)} intento${Number(row.followUpAttemptsAfterLastClient||0)===1?'':'s'}`;if(row.followUpCorrect)return`CORRECTO · ${Number(row.followUpAttemptsAfterLastClient||0)} intento${Number(row.followUpAttemptsAfterLastClient||0)===1?'':'s'}`;if(row.sellerFollowUpInWindow)return`REVISAR · ${Number(row.followUpAttemptsAfterLastClient||0)} intento${Number(row.followUpAttemptsAfterLastClient||0)===1?'':'s'}`;return'NO APLICA'}
function humanCorrectionStatus(v){const x=String(v||'PENDIENTE').toUpperCase();if(x==='CORRECTED'||x==='CORREGIDA')return'CORREGIDA';if(x==='NOT_CORRECTED'||x==='NO_CORREGIDA')return'NO_CORREGIDA';return'PENDIENTE'}
function productDiscoveryLabel(p){if(p.sellerDiscovered||p.source==='VENDEDOR_DESCUBRIO'||p.source==='SELLER')return'VENDEDOR';if(p.source==='CLIENTE'||p.source==='CUSTOMER')return'CLIENTE';return p.defined?'CLIENTE / CONTEXTO':'NO IDENTIFICADO'}
function rowCase(row){const p=product(row);return{conversationId:row.conversationId,contactName:row.contactName||'Sin nombre',seller:row.seller||row.owner||'',product:p,profile:profile(row),severity:severity(row),needsCorrection:needsCorrection(row),reason:caseReason(row),expected:expected(row),hubUrl:row.hubUrl||hubUrl(row.conversationId),lastClientText:row.lastClientText||'',lastHumanText:row.lastHumanText||'',lateMinutes:row.maxHumanResponseMinutes||0,responseStatus:responseStatus(row),followUpStatus:followUpLabel(row),followUpAttempts:Number(row.followUpAttemptsAfterLastClient||0),checklist:checklist(row),opportunity:p.defined===true}}

function visibleDailyRows(rows){
  return (rows||[]).filter(r=>Number(r.messagesInWindow||0)>0||Number(r.humanCount||0)>0||Number(r.inboundCount||0)>0||r.sellerFollowUpInWindow||r.leadActivationRequired);
}
function displayStatus(row){
  if(needsCorrection(row))return'A CORREGIR';
  if(row.followUpCorrect)return'SEGUIMIENTO CORRECTO';
  if(row.sellerFollowUpInWindow)return'REVISAR SEGUIMIENTO';
  if(commercialAdvance(row))return'BIEN TRABAJADO';
  if(row.noHumanResponse||row.botOnly)return'A CORREGIR';
  return'REVISAR';
}
function goodReason(row){
  const a=row.ai||{};
  return String(a.commercial_advance_reason||a.summary||a.good_points?.[0]||'Hubo avance comercial concreto en este chat.').trim();
}
function metrics(rows){
  const visible=visibleDailyRows(rows),clients=visible.filter(x=>x.inboundCount>0),allCases=visible.map(rowCase),goodRows=visible.filter(x=>displayStatus(x)==='BIEN TRABAJADO'),followUps=visible.filter(x=>x.followUpCorrect),maxDelay=Math.max(0,...clients.map(x=>Number(x.maxHumanResponseMinutes||0)));
  return{visibleChats:visible.length,clients:clients.length,responded:clients.filter(x=>x.humanResponded).length,noResponse:clients.filter(x=>x.noHumanResponse).length,late:clients.filter(x=>x.lateCount>0).length,maxDelayMinutes:maxDelay,activationToCorrect:visible.filter(x=>x.leadActivationInsufficient).length,followUpsCorrect:followUps.length,followUpsToCorrect:visible.filter(x=>x.followUpNeedsCorrection).length,followUpsReview:visible.filter(x=>x.sellerFollowUpInWindow&&!x.followUpCorrect&&!x.followUpNeedsCorrection).length,good:goodRows.length,toCorrect:visible.filter(x=>needsCorrection(x)).length,opportunities:allCases.filter(x=>x.opportunity).length,grave:allCases.filter(x=>x.severity==='GRAVE').length,hyperGrave:allCases.filter(x=>x.severity==='HIPER_GRAVE').length,goodPct:pct(goodRows.length,visible.length),correctionPct:pct(visible.filter(x=>needsCorrection(x)).length,Math.max(1,visible.length))}
}
function liveText({date,cutoff,label,rows,trend='BASELINE',correctionStatuses={}}){
  const visible=visibleDailyRows(rows),m=metrics(visible);
  const L=[`📊 SUPERVISOR EN VIVO — ${label}`,`${date} · corte ${cutoff}:00 · acumulado desde 09:00`,'',
    `Está trabajando: ${visible.some(x=>x.humanResponded||x.humanCount>0)?'SÍ':'NO'} · Tendencia: ${trend}`,
    `Chats del día: ${m.visibleChats} · Clientes que escribieron: ${m.clients} · Respondidos: ${m.responded}`,
    `Tarde: ${m.late}${m.maxDelayMinutes?` · Máxima demora: ${humanMinutes(m.maxDelayMinutes)}`:''}`,
    `Activaciones a corregir: ${m.activationToCorrect} · Seguimientos correctos: ${m.followUpsCorrect} · Seguimientos a corregir: ${m.followUpsToCorrect} · Seguimientos a revisar: ${m.followUpsReview}`,
    `Bien trabajados: ${m.good} · A corregir: ${m.toCorrect} · Oportunidades: ${m.opportunities}`,'',
    `TODOS LOS CHATS DEL DÍA (${visible.length})`];
  if(!visible.length)L.push('Sin actividad en este corte.');
  visible.forEach((r,i)=>{
    const c=rowCase(r),status=displayStatus(r),corrStatus=humanCorrectionStatus(correctionStatuses[c.conversationId]);
    const shownStatus=status==='A CORREGIR'?corrStatus:status;
    L.push('',`${i+1}. ${c.contactName} — ${shownStatus}${c.severity==='HIPER_GRAVE'?' 🚨':c.severity==='GRAVE'?' 🔴':''}`,
      `Producto: ${c.product.defined?c.product.name||'Producto identificado':'NO IDENTIFICADO'}`);
    if(r.leadActivationRequired)L.push(`Contacto: ACTIVACIÓN INICIAL · ${Number(r.leadActivationAttempts||0)}/3 mensajes`);
    else if(r.sellerFollowUpInWindow)L.push(`Seguimiento: ${followUpLabel(r)}`);
    else L.push(`Respuesta: ${c.responseStatus}`);
    L.push(`Perfil: ${c.profile}`);
    if(status==='A CORREGIR')L.push(`Problema: ${c.reason}`,`Qué corregir: ${c.expected}`);
    else if(status==='BIEN TRABAJADO')L.push(`Resultado: BIEN TRABAJADO`,`Motivo: ${goodReason(r)}`);
    else if(status==='SEGUIMIENTO CORRECTO')L.push(`Resultado: SEGUIMIENTO CORRECTO`);
    else if(status==='REVISAR SEGUIMIENTO')L.push(`Resultado: REVISAR SEGUIMIENTO`,`Motivo: hubo seguimiento humano, pero todavía no quedó clasificado como correcto ni insuficiente.`);
    else L.push(`Resultado: REVISAR`);
    L.push(`HUB: ${c.hubUrl}`);
  });
  return L.join('\n')
}
function trendFrom(prev,current){if(!prev)return'BASELINE';const a=prev.metrics||{},b=current;const delta=(Number(b.goodPct||0)-Number(a.goodPct||0))-(Number(b.correctionPct||0)-Number(a.correctionPct||0));return delta>=10?'MEJORANDO':delta<=-10?'EMPEORANDO':'ESTABLE'}
function superText({date,cutoff,rows}){const cases=rows.filter(x=>x.inboundCount>0).map(rowCase),opps=cases.filter(x=>x.opportunity),bad=cases.filter(x=>['GRAVE','HIPER_GRAVE'].includes(x.severity));const L=[`🚨 SUPER SUPERVISOR — ${cutoff}:00`,`Fecha ${date}`,'',`Oportunidades con producto definido: ${opps.length}`,`Fallos graves: ${bad.filter(x=>x.severity==='GRAVE').length}`,`Fallos HIPER GRAVES: ${bad.filter(x=>x.severity==='HIPER_GRAVE').length}`,'','🔥 OPORTUNIDADES QUE NO SE PUEDEN PERDER'];if(!opps.length)L.push('Sin oportunidades concretas detectadas.');opps.slice(0,30).forEach((c,i)=>L.push('',`${i+1}. ${c.contactName} — ${c.seller}`,`Producto: ${c.product.name||'Producto identificado'}`,`Perfil: ${c.profile}`,`Gestión: ${c.needsCorrection?'REQUIERE ACCIÓN':'BIEN TRABAJADA'}`,c.needsCorrection?`Falla: ${c.reason}`:'Sin falla grave detectada.',`HUB: ${c.hubUrl}`));L.push('','🚨 FALLOS GRAVES / HIPER GRAVES');if(!bad.length)L.push('Sin fallos graves detectados.');bad.slice(0,30).forEach((c,i)=>L.push('',`${i+1}. ${c.severity} — ${c.contactName} — ${c.seller}`,`Producto: ${c.product.defined?c.product.name||'identificado':'no identificado'}`,`Perfil: ${c.profile}`,`Qué pasó: ${c.reason}`,`Qué debería hacer: ${c.expected}`,`HUB: ${c.hubUrl}`));return L.join('\n')}
function closeText({date,base,rows,dealStates=[]}){const cases=rows.filter(x=>x.inboundCount>0).map(rowCase),opps=cases.filter(x=>x.opportunity);const bySeller=new Map();for(const c of cases){const k=c.seller||'No detectado',x=bySeller.get(k)||{seller:k,clients:0,opps:0,toCorrect:0,grave:0};x.clients++;if(c.opportunity)x.opps++;if(c.needsCorrection)x.toCorrect++;if(['GRAVE','HIPER_GRAVE'].includes(c.severity))x.grave++;bySeller.set(k,x)}const active=dealStates.filter(d=>d.portfolio?.active===true),overdue=active.filter(d=>d.portfolio?.overdue===true),red=overdue.filter(d=>{const due=d.portfolio?.dueDate||d.snapshot?.dueDate;return due&&daysOverdue(due,new Date(`${date}T23:59:59-03:00`))>=7});const L=[`📊 CIERRE DIARIO GERENCIAL — ${date}`,'09:00–17:00','',`Clientes del día: ${cases.length}`,`Oportunidades con producto definido: ${opps.length}`,`Casos a corregir: ${cases.filter(x=>x.needsCorrection).length}`,`Fallos graves/hiper graves: ${cases.filter(x=>['GRAVE','HIPER_GRAVE'].includes(x.severity)).length}`,'','🔴 VENCIDOS — PRIORIDAD GERENCIAL',`Tratos activos: ${active.length}`,`Vencidos: ${overdue.length}`,`Con +7 días: ${red.length}`,'','🔥 OPORTUNIDADES DEL DÍA'];if(!opps.length)L.push('Sin oportunidades concretas detectadas.');opps.slice(0,40).forEach((c,i)=>L.push('',`${i+1}. ${c.contactName} — ${c.seller}`,`Producto: ${c.product.name||'Producto identificado'}`,`Perfil: ${c.profile}`,`Desarrollo: ${c.needsCorrection?'A DESARROLLAR':'BIEN DESARROLLADA'}`,c.needsCorrection?`Qué falta: ${c.expected}`:'',`HUB: ${c.hubUrl}`));L.push('','📋 RESUMEN POR VENDEDOR');[...bySeller.values()].sort((a,b)=>b.toCorrect-a.toCorrect).forEach(x=>L.push(`• ${x.seller}: clientes ${x.clients} · oportunidades ${x.opps} · a corregir ${x.toCorrect} · graves ${x.grave}`));return L.join('\n')}

function manualReportKey(date,cutoff=17,sellerKey=null){const seller=sellerKey?`__seller_${Buffer.from(norm(sellerKey)).toString('base64url').slice(0,80)}`:'';return `${date}__cutoff_${Number(cutoff)}__guide_v1_product_context_v1${seller}`}
class ManualSupervisionService{
  constructor({dailyService,store}){this.dailyService=dailyService;this.store=store}
  async base(date,cutoff=17,forceAi=false,sellerKey=null){
    const reportKey=manualReportKey(date,cutoff,sellerKey);
    if(!forceAi){
      const cached=await this.store.getDailyReport(reportKey);
      if(cached&&Array.isArray(cached.rows))return cached;
    }
    return this.dailyService.generate({date,endHour:Number(cutoff),forceAi,reportKey,reviewScope:'guide_v1_product_context_v1',sellerKey})
  }
  async liveSeller({date,cutoff=17,sellerKey,sellerLabel,forceAi=true}){const base=await this.base(date,cutoff,forceAi,sellerKey),rows=(base.rows||[]).filter(r=>sellerMatch(r,sellerKey));const previous=(await this.store.listLiveDailyReports(300,date)).find(r=>r.reportType==='supervisor_live_operational'&&norm(r.sellerKey)===norm(sellerKey)&&Number(r.cutoff||0)<Number(cutoff));const ms=metrics(rows),trend=trendFrom(previous,ms);const observations=await this.store.listLiveDailyObservationsForSellers([sellerKey],2000);const statuses={};for(const o of observations)if(String(o.sourceDate||'')===String(date)&&o.conversationId)statuses[o.conversationId]=humanCorrectionStatus(o.status);const report={id:`manual_live__${date}__${cutoff}__${Buffer.from(norm(sellerKey)).toString('base64url').slice(0,80)}`,reportType:'supervisor_live_operational',date,cutoff:Number(cutoff),sellerKey:norm(sellerKey),sellerLabel,generatedAt:new Date().toISOString(),metrics:ms,cases:rows.filter(x=>x.inboundCount>0).map(rowCase),trend,text:liveText({date,cutoff,label:sellerLabel||sellerKey,rows,trend,correctionStatuses:statuses})};await this.store.saveLiveDailyReport(report.id,report);return report}
  async superSupervisor({date,cutoff=10,forceAi=true}){const base=await this.base(date,cutoff,forceAi),rows=base.rows||[];const report={id:`super_supervisor__${date}__${cutoff}`,reportType:'super_supervisor',date,cutoff:Number(cutoff),generatedAt:new Date().toISOString(),metrics:metrics(rows),text:superText({date,cutoff,rows})};await this.store.saveLiveDailyReport(report.id,report);return report}
  async closing({date,forceAi=true}){const base=await this.base(date,17,forceAi),dealStates=await this.store.listAllDeals(20000),rows=base.rows||[];const report={id:`gerencial_close__${date}`,reportType:'gerencial_close',date,cutoff:17,generatedAt:new Date().toISOString(),metrics:metrics(rows),text:closeText({date,base,rows,dealStates})};await this.store.saveLiveDailyReport(report.id,report);return report}
}
module.exports={ManualSupervisionService,manualReportKey,rowCase,metrics,needsCorrection,severity,product,profile,checklist,liveText,superText,closeText};
