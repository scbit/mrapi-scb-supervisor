const {summary,managerText,html,hubUrl}=require('./dailyGerencial');

function norm(v){return String(v||'').trim().toLowerCase()}
function pct(n,d){return d?Math.round((Number(n||0)/d)*100):0}
function sellerMatches(row,sellerKey){const k=norm(sellerKey);return [row?.seller,row?.owner].some(x=>norm(x)===k)}
function important(row){return !!(row.noHumanResponse||row.botOnly||row.operationalWithoutDiscovery||row.unexploredPotential||row.needsReviewByAi||row.lateCount>0||row.readyToDiscardNoResponse)}

function metrics(rows=[]){
  const client=rows.filter(x=>Number(x.inboundCount||0)>0);
  const n=client.length;
  return{
    clientChats:n,
    responded:client.filter(x=>x.humanResponded).length,
    noHumanResponse:client.filter(x=>x.noHumanResponse).length,
    late:client.filter(x=>Number(x.lateCount||0)>0).length,
    goodCommercial:client.filter(x=>x.goodCommercialResponse).length,
    operationalWithoutDiscovery:client.filter(x=>x.operationalWithoutDiscovery).length,
    unexploredPotential:client.filter(x=>x.unexploredPotential).length,
    followUpOk:rows.filter(x=>x.followUpOk).length,
    importantCases:client.filter(important).length,
    goodRate:pct(client.filter(x=>x.goodCommercialResponse).length,n),
    lateRate:pct(client.filter(x=>Number(x.lateCount||0)>0).length,n),
    noDiscoveryRate:pct(client.filter(x=>x.operationalWithoutDiscovery).length,n),
    unexploredRate:pct(client.filter(x=>x.unexploredPotential).length,n)
  };
}

function filteredInsights(insights,sellerKey){
  if(!insights?.available)return insights||{available:false};
  const keep=x=>norm(x.seller)===norm(sellerKey);
  const poorly=(insights.excellentPoorlyWorked||[]).filter(keep),well=(insights.excellentWellWorked||[]).filter(keep);
  return{...insights,excellentPoorlyWorked:poorly,excellentWellWorked:well,excellentMatched:poorly.length+well.length};
}
function filteredLeadQuality(lq,sellerKey){
  if(!lq?.available)return lq||{available:false};
  const row=(lq.bySeller||[]).find(x=>norm(x.seller)===norm(sellerKey));
  if(!row)return{...lq,total:0,counts:{EXCELENTE:0,BUENO:0,REGULAR:0,NO_RESPONDE:0,DESCARTADO:0},goodExcellent:0,goodExcellentPct:0,bySeller:[]};
  return{...lq,total:row.total,counts:row.counts,goodExcellent:row.goodExcellent,goodExcellentPct:row.goodExcellentPct,bySeller:[row]};
}

function buildSellerReport(base,sellerKey,label=null){
  const rows=(base.rows||[]).filter(x=>sellerMatches(x,sellerKey)).map(x=>({...x,hubUrl:x.hubUrl||hubUrl(x.conversationId)}));
  const bySeller=summary(rows);
  const report={
    ...base,
    id:`daily_v3_live__${base.date}__${Buffer.from(norm(sellerKey)).toString('base64url').slice(0,120)}`,
    reportType:'daily_v3_live_seller',
    sellerKey:norm(sellerKey),
    sellerLabel:label||bySeller[0]?.seller||sellerKey,
    rows,
    bySeller,
    leadQuality:filteredLeadQuality(base.leadQuality,sellerKey),
    leadQualityInsights:filteredInsights(base.leadQualityInsights,sellerKey),
    generatedAt:new Date().toISOString(),
    dailyV3MotherLogic:true
  };
  report.metrics=metrics(rows);
  report.text=managerText(report);
  report.html=html(report);
  return report;
}

function compareMetrics(a,b){
  const keys=['goodRate','lateRate','noDiscoveryRate','unexploredRate','noHumanResponse'];
  const deltas={}; for(const k of keys)deltas[k]=Number(b[k]||0)-Number(a[k]||0);
  let score=0;
  score += deltas.goodRate;
  score -= deltas.lateRate;
  score -= deltas.noDiscoveryRate;
  score -= deltas.unexploredRate;
  score -= deltas.noHumanResponse*15;
  const verdict=score>=10?'MEJORO':score<=-10?'EMPEORO':'ESTABLE';
  return{verdict,score,deltas};
}

function comparisonText({sellerLabel,dateA,dateB,metricsA,metricsB,comparison}){
  const d=comparison.deltas;
  return `📈 SUPERVISOR SCB — COMPARACIÓN DAILY V3
Vendedor: ${sellerLabel}
${dateA} → ${dateB}

Resultado: ${comparison.verdict}
Índice de mejora: ${comparison.score>0?'+':''}${comparison.score}

${dateA}
Clientes: ${metricsA.clientChats}
Buena respuesta comercial: ${metricsA.goodCommercial} (${metricsA.goodRate}%)
Tarde: ${metricsA.late} (${metricsA.lateRate}%)
Sin indagar: ${metricsA.operationalWithoutDiscovery} (${metricsA.noDiscoveryRate}%)
Potencial no explorado: ${metricsA.unexploredPotential} (${metricsA.unexploredRate}%)
Sin respuesta humana: ${metricsA.noHumanResponse}

${dateB}
Clientes: ${metricsB.clientChats}
Buena respuesta comercial: ${metricsB.goodCommercial} (${metricsB.goodRate}%)
Tarde: ${metricsB.late} (${metricsB.lateRate}%)
Sin indagar: ${metricsB.operationalWithoutDiscovery} (${metricsB.noDiscoveryRate}%)
Potencial no explorado: ${metricsB.unexploredPotential} (${metricsB.unexploredRate}%)
Sin respuesta humana: ${metricsB.noHumanResponse}

CAMBIOS
Buena respuesta: ${d.goodRate>0?'+':''}${d.goodRate} pp
Tarde: ${d.lateRate>0?'+':''}${d.lateRate} pp
Sin indagar: ${d.noDiscoveryRate>0?'+':''}${d.noDiscoveryRate} pp
Potencial no explorado: ${d.unexploredRate>0?'+':''}${d.unexploredRate} pp

Lectura: ${comparison.verdict==='MEJORO'?'Mejoró la gestión comercial respecto del día anterior.':comparison.verdict==='EMPEORO'?'La gestión empeoró y requiere intervención del supervisor.':'No hay una mejora clara todavía; mantener seguimiento.'}`;
}

class DailyV3LiveService{
  constructor({dailyService,store}){this.dailyService=dailyService;this.store=store}
  async generateSeller({date,sellerKey,sellerLabel=null,force=false}={}){
    if(!date)throw new Error('DATE_REQUIRED');if(!sellerKey)throw new Error('SELLER_REQUIRED');
    let base=!force?await this.store.getDailyReport(date):null;
    if(!base||!Array.isArray(base.rows))base=await this.dailyService.generate({date});
    const report=buildSellerReport(base,sellerKey,sellerLabel);
    const observations=await this.store.listLiveDailyObservationsForSellers([norm(sellerKey)],2000);
    const corrections=observations
      .filter(o=>o.issueType==='COMMERCIAL_CHAT_CASE'&&(!o.sourceDate||String(o.sourceDate)===String(date)))
      .map(o=>({conversationId:o.conversationId,status:o.status||'PENDING',quality:o.quality||null,reason:o.reason||'',expected:o.expected||'',hubUrl:o.hubUrl||hubUrl(o.conversationId),lastSeenAt:o.lastSeenAt||null,correctedAt:o.correctedAt||null,notCorrectedAt:o.notCorrectedAt||null}));
    report.corrections=corrections;
    report.correctionSummary={
      pending:corrections.filter(x=>x.status==='PENDING').length,
      corrected:corrections.filter(x=>x.status==='CORRECTED').length,
      notCorrected:corrections.filter(x=>x.status==='NOT_CORRECTED').length
    };
    const corrText=corrections.length?corrections.slice(0,40).map((x,i)=>`${i+1}) ${x.status} — ${x.reason||'Caso comercial'}\n   Esperado: ${x.expected||'-'}\n   HUB: ${x.hubUrl||'-'}`).join('\n\n'):'Sin casos persistidos para esta fecha.';
    report.text += `\n\nSEGUIMIENTO DE CORRECCIONES\nPendientes: ${report.correctionSummary.pending} | Corregidas: ${report.correctionSummary.corrected} | No corregidas: ${report.correctionSummary.notCorrected}\n\n${corrText}`;
    await this.store.saveLiveDailyReport(report.id,report);
    return report;
  }
  async compare({dateA,dateB,sellerKey,sellerLabel=null,force=false}={}){
    const [a,b]=await Promise.all([
      this.generateSeller({date:dateA,sellerKey,sellerLabel,force}),
      this.generateSeller({date:dateB,sellerKey,sellerLabel,force})
    ]);
    const comparison=compareMetrics(a.metrics,b.metrics);
    const out={
      id:`daily_v3_compare__${dateA}__${dateB}__${Buffer.from(norm(sellerKey)).toString('base64url').slice(0,100)}`,
      reportType:'daily_v3_comparison',
      sellerKey:norm(sellerKey),sellerLabel:sellerLabel||b.sellerLabel||a.sellerLabel,
      dateA,dateB,generatedAt:new Date().toISOString(),
      metricsA:a.metrics,metricsB:b.metrics,comparison,
      text:comparisonText({sellerLabel:sellerLabel||b.sellerLabel||a.sellerLabel,dateA,dateB,metricsA:a.metrics,metricsB:b.metrics,comparison}),
      sourceReportIds:[a.id,b.id],
      dailyV3MotherLogic:true
    };
    await this.store.saveLiveDailyReport(out.id,out);
    return out;
  }
}
module.exports={DailyV3LiveService,buildSellerReport,metrics,compareMetrics,comparisonText};
