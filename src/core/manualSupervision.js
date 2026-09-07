const {hubUrl}=require('./dailyGerencial');
const {daysOverdue}=require('./time');

function norm(v){return String(v||'').trim().toLowerCase()}
function sellerMatch(r,key){return norm(r?.seller||r?.owner)===norm(key)}
function pct(n,d){return d?Math.round(n/d*100):0}
function product(row){
  const ai=row.ai||{},n=String(ai.product_name||'').trim();
  if(ai.product_defined===true&&n)return{defined:true,name:n,source:String(ai.product_source||'NO_CLARO').toUpperCase(),sellerDiscovered:ai.seller_discovered_product===true};
  const texts=[...(Array.isArray(row.clientTexts)?row.clientTexts:[]),row.lastClientText||''].map(x=>String(x||'').trim()).filter(Boolean);
  for(const t of texts){const m=t.match(/\b(?:importar|traer|comprar)\s+(?:una?|unos?|las?|los?)?\s*(.{3,120})/i);if(m){const name=m[1].replace(/[.!?].*$/,'').trim();if(name)return{defined:true,name,source:'CLIENTE',sellerDiscovered:false}}}
  return{defined:false,name:'',source:'NO_CLARO',sellerDiscovered:false}
}
function profile(row){return String(row?.ai?.customer_profile_type||row?.ai?.customer_profile_guess||'DESCONOCIDO').toUpperCase()}
function checklist(row){const a=row.ai||{},g=a.guide_checklist||{};return{business:g.understood_business===true||a.did_ask_business_context===true,experience:g.knows_import_experience===true||a.did_ask_import_experience===true,supplier:g.knows_supplier===true,scb:g.explained_scb_value===true||a.scb_value_explained===true,recommendation:g.gave_useful_recommendation===true||a.useful_recommendation===true,next:g.left_concrete_next_step===true||a.concrete_next_step===true}}
function commercialAdvance(row){
  const g=row?.ai?.guide_checklist||{};
  return row?.commercialAdvance===true||row?.ai?.commercial_advance===true||row?.goodCommercialResponse===true||g.left_concrete_next_step===true||g.gave_useful_recommendation===true
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
function metrics(rows){
  const clients=rows.filter(x=>x.inboundCount>0),allCases=rows.filter(x=>x.inboundCount>0||x.followUpNeedsCorrection||x.leadActivationInsufficient).map(rowCase),goodCases=clients.filter(x=>commercialAdvance(x)&&!needsCorrection(x)),followUps=rows.filter(x=>x.followUpCorrect),maxDelay=Math.max(0,...clients.map(x=>Number(x.maxHumanResponseMinutes||0)));
  return{clients:clients.length,responded:clients.filter(x=>x.humanResponded).length,noResponse:clients.filter(x=>x.noHumanResponse).length,late:clients.filter(x=>x.lateCount>0).length,maxDelayMinutes:maxDelay,activationToCorrect:rows.filter(x=>x.leadActivationInsufficient).length,followUpsCorrect:followUps.length,followUpsToCorrect:rows.filter(x=>x.followUpNeedsCorrection).length,good:goodCases.length,toCorrect:allCases.filter(x=>x.needsCorrection).length,opportunities:allCases.filter(x=>x.opportunity).length,grave:allCases.filter(x=>x.severity==='GRAVE').length,hyperGrave:allCases.filter(x=>x.severity==='HIPER_GRAVE').length,goodPct:pct(goodCases.length,clients.length),correctionPct:pct(allCases.filter(x=>x.needsCorrection).length,Math.max(1,allCases.length))}
}
function liveText({date,cutoff,label,rows,trend='BASELINE',correctionStatuses={}}){
  const m=metrics(rows),cases=rows.filter(x=>x.inboundCount>0||x.followUpNeedsCorrection||x.leadActivationInsufficient).map(rowCase).filter(x=>x.needsCorrection),followRows=rows.filter(x=>x.followUpCorrect);
  const L=[`📊 SUPERVISOR EN VIVO — ${label}`,`${date} · corte ${cutoff}:00 · acumulado desde 09:00`,'',
    `Está trabajando: ${m.responded>0||m.followUpsCorrect>0?'SÍ':'NO'} · Tendencia: ${trend}`,
    `Clientes: ${m.clients} · Respondidos: ${m.responded} · Tarde: ${m.late}${m.maxDelayMinutes?` · Máxima demora: ${humanMinutes(m.maxDelayMinutes)}`:''}`,
    `Activaciones a corregir: ${m.activationToCorrect} · Seguimientos correctos: ${m.followUpsCorrect} · Seguimientos a corregir: ${m.followUpsToCorrect}`,
    `Bien trabajados: ${m.good} · A corregir: ${m.toCorrect} · Oportunidades: ${m.opportunities}`,'','CLIENTES A CORREGIR'];
  if(!cases.length)L.push('Sin casos a corregir.');
  cases.forEach((c,i)=>{const st=humanCorrectionStatus(correctionStatuses[c.conversationId]);L.push('',
    `${i+1}. ${c.contactName} — ${st}${c.severity==='HIPER_GRAVE'?' 🚨':c.severity==='GRAVE'?' 🔴':''}`,
    `Producto: ${c.product.defined?c.product.name||'Producto identificado':'NO IDENTIFICADO'}`,
    `Respuesta: ${c.responseStatus}`,
    `Perfil: ${c.profile}`,
    `Problema: ${c.reason}`,
    `Qué corregir: ${c.expected}`,
    `HUB: ${c.hubUrl}`)});
  L.push('','SEGUIMIENTOS CORRECTOS');
  if(!followRows.length)L.push('Sin seguimientos correctos detectados en este corte.');
  followRows.slice(0,20).forEach((r,i)=>L.push('',`${i+1}. ${r.contactName||'Sin nombre'}`,`Seguimiento: ${followUpLabel(r)}`,`HUB: ${r.hubUrl||hubUrl(r.conversationId)}`));
  return L.join('\n')
}
function trendFrom(prev,current){if(!prev)return'BASELINE';const a=prev.metrics||{},b=current;const delta=(Number(b.goodPct||0)-Number(a.goodPct||0))-(Number(b.correctionPct||0)-Number(a.correctionPct||0));return delta>=10?'MEJORANDO':delta<=-10?'EMPEORANDO':'ESTABLE'}
function superText({date,cutoff,rows}){const cases=rows.filter(x=>x.inboundCount>0).map(rowCase),opps=cases.filter(x=>x.opportunity),bad=cases.filter(x=>['GRAVE','HIPER_GRAVE'].includes(x.severity));const L=[`🚨 SUPER SUPERVISOR — ${cutoff}:00`,`Fecha ${date}`,'',`Oportunidades con producto definido: ${opps.length}`,`Fallos graves: ${bad.filter(x=>x.severity==='GRAVE').length}`,`Fallos HIPER GRAVES: ${bad.filter(x=>x.severity==='HIPER_GRAVE').length}`,'','🔥 OPORTUNIDADES QUE NO SE PUEDEN PERDER'];if(!opps.length)L.push('Sin oportunidades concretas detectadas.');opps.slice(0,30).forEach((c,i)=>L.push('',`${i+1}. ${c.contactName} — ${c.seller}`,`Producto: ${c.product.name||'Producto identificado'}`,`Perfil: ${c.profile}`,`Gestión: ${c.needsCorrection?'REQUIERE ACCIÓN':'BIEN TRABAJADA'}`,c.needsCorrection?`Falla: ${c.reason}`:'Sin falla grave detectada.',`HUB: ${c.hubUrl}`));L.push('','🚨 FALLOS GRAVES / HIPER GRAVES');if(!bad.length)L.push('Sin fallos graves detectados.');bad.slice(0,30).forEach((c,i)=>L.push('',`${i+1}. ${c.severity} — ${c.contactName} — ${c.seller}`,`Producto: ${c.product.defined?c.product.name||'identificado':'no identificado'}`,`Perfil: ${c.profile}`,`Qué pasó: ${c.reason}`,`Qué debería hacer: ${c.expected}`,`HUB: ${c.hubUrl}`));return L.join('\n')}
function closeText({date,base,rows,dealStates=[]}){const cases=rows.filter(x=>x.inboundCount>0).map(rowCase),opps=cases.filter(x=>x.opportunity);const bySeller=new Map();for(const c of cases){const k=c.seller||'No detectado',x=bySeller.get(k)||{seller:k,clients:0,opps:0,toCorrect:0,grave:0};x.clients++;if(c.opportunity)x.opps++;if(c.needsCorrection)x.toCorrect++;if(['GRAVE','HIPER_GRAVE'].includes(c.severity))x.grave++;bySeller.set(k,x)}const active=dealStates.filter(d=>d.portfolio?.active===true),overdue=active.filter(d=>d.portfolio?.overdue===true),red=overdue.filter(d=>{const due=d.portfolio?.dueDate||d.snapshot?.dueDate;return due&&daysOverdue(due,new Date(`${date}T23:59:59-03:00`))>=7});const L=[`📊 CIERRE DIARIO GERENCIAL — ${date}`,'09:00–17:00','',`Clientes del día: ${cases.length}`,`Oportunidades con producto definido: ${opps.length}`,`Casos a corregir: ${cases.filter(x=>x.needsCorrection).length}`,`Fallos graves/hiper graves: ${cases.filter(x=>['GRAVE','HIPER_GRAVE'].includes(x.severity)).length}`,'','🔴 VENCIDOS — PRIORIDAD GERENCIAL',`Tratos activos: ${active.length}`,`Vencidos: ${overdue.length}`,`Con +7 días: ${red.length}`,'','🔥 OPORTUNIDADES DEL DÍA'];if(!opps.length)L.push('Sin oportunidades concretas detectadas.');opps.slice(0,40).forEach((c,i)=>L.push('',`${i+1}. ${c.contactName} — ${c.seller}`,`Producto: ${c.product.name||'Producto identificado'}`,`Perfil: ${c.profile}`,`Desarrollo: ${c.needsCorrection?'A DESARROLLAR':'BIEN DESARROLLADA'}`,c.needsCorrection?`Qué falta: ${c.expected}`:'',`HUB: ${c.hubUrl}`));L.push('','📋 RESUMEN POR VENDEDOR');[...bySeller.values()].sort((a,b)=>b.toCorrect-a.toCorrect).forEach(x=>L.push(`• ${x.seller}: clientes ${x.clients} · oportunidades ${x.opps} · a corregir ${x.toCorrect} · graves ${x.grave}`));return L.join('\n')}

function manualReportKey(date,cutoff=17,sellerKey=null){const seller=sellerKey?`__seller_${Buffer.from(norm(sellerKey)).toString('base64url').slice(0,80)}`:'';return `${date}__cutoff_${Number(cutoff)}__guide_v1_advance_v1${seller}`}
class ManualSupervisionService{
  constructor({dailyService,store}){this.dailyService=dailyService;this.store=store}
  async base(date,cutoff=17,forceAi=false,sellerKey=null){
    const reportKey=manualReportKey(date,cutoff,sellerKey);
    if(!forceAi){
      const cached=await this.store.getDailyReport(reportKey);
      if(cached&&Array.isArray(cached.rows))return cached;
    }
    return this.dailyService.generate({date,endHour:Number(cutoff),forceAi,reportKey,reviewScope:'guide_v1_advance_v1',sellerKey})
  }
  async liveSeller({date,cutoff=17,sellerKey,sellerLabel,forceAi=true}){const base=await this.base(date,cutoff,forceAi,sellerKey),rows=(base.rows||[]).filter(r=>sellerMatch(r,sellerKey));const previous=(await this.store.listLiveDailyReports(300,date)).find(r=>r.reportType==='supervisor_live_operational'&&norm(r.sellerKey)===norm(sellerKey)&&Number(r.cutoff||0)<Number(cutoff));const ms=metrics(rows),trend=trendFrom(previous,ms);const observations=await this.store.listLiveDailyObservationsForSellers([sellerKey],2000);const statuses={};for(const o of observations)if(String(o.sourceDate||'')===String(date)&&o.conversationId)statuses[o.conversationId]=humanCorrectionStatus(o.status);const report={id:`manual_live__${date}__${cutoff}__${Buffer.from(norm(sellerKey)).toString('base64url').slice(0,80)}`,reportType:'supervisor_live_operational',date,cutoff:Number(cutoff),sellerKey:norm(sellerKey),sellerLabel,generatedAt:new Date().toISOString(),metrics:ms,cases:rows.filter(x=>x.inboundCount>0).map(rowCase),trend,text:liveText({date,cutoff,label:sellerLabel||sellerKey,rows,trend,correctionStatuses:statuses})};await this.store.saveLiveDailyReport(report.id,report);return report}
  async superSupervisor({date,cutoff=10,forceAi=true}){const base=await this.base(date,cutoff,forceAi),rows=base.rows||[];const report={id:`super_supervisor__${date}__${cutoff}`,reportType:'super_supervisor',date,cutoff:Number(cutoff),generatedAt:new Date().toISOString(),metrics:metrics(rows),text:superText({date,cutoff,rows})};await this.store.saveLiveDailyReport(report.id,report);return report}
  async closing({date,forceAi=true}){const base=await this.base(date,17,forceAi),dealStates=await this.store.listAllDeals(20000),rows=base.rows||[];const report={id:`gerencial_close__${date}`,reportType:'gerencial_close',date,cutoff:17,generatedAt:new Date().toISOString(),metrics:metrics(rows),text:closeText({date,base,rows,dealStates})};await this.store.saveLiveDailyReport(report.id,report);return report}
}
module.exports={ManualSupervisionService,manualReportKey,rowCase,metrics,needsCorrection,severity,product,profile,checklist,liveText,superText,closeText};
