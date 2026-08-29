const {normalizeStage}=require('./normalizers');
const {asDate}=require('./time');

function activePortfolioStages(config={}){
  return new Set((config.portfolio?.active_stages||[]).map(normalizeStage));
}

function classifyPortfolio(deal={},config={},now=new Date()){
  const stage=normalizeStage(deal.stageNorm||deal.stage||deal.snapshot?.stageNorm||deal.snapshot?.stage);
  const active=activePortfolioStages(config).has(stage)&&deal.isClosed!==true&&deal.snapshot?.isClosed!==true;
  const dueRaw=deal.dueDate??deal.snapshot?.dueDate??null;
  const due=asDate(dueRaw);
  let status='INACTIVE';
  if(active){
    if(!due)status='NO_DUE_DATE';
    else if(due>=now)status='UP_TO_DATE';
    else status='OVERDUE';
  }
  return{
    active,
    stage,
    status,
    upToDate:active&&status==='UP_TO_DATE',
    overdue:active&&status==='OVERDUE',
    noDueDate:active&&status==='NO_DUE_DATE',
    dueDate:dueRaw
  };
}

module.exports={activePortfolioStages,classifyPortfolio};
