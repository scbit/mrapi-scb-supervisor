const {normalizeStage}=require('./normalizers');

function activePortfolioStages(config={}){
  return new Set((config.portfolio?.active_stages||[]).map(normalizeStage));
}

function classifyPortfolio(deal={},config={}){
  const stage=normalizeStage(deal.stageNorm||deal.stage||deal.snapshot?.stageNorm||deal.snapshot?.stage);
  const active=activePortfolioStages(config).has(stage)&&deal.isClosed!==true&&deal.snapshot?.isClosed!==true;
  return{active,stage};
}

module.exports={activePortfolioStages,classifyPortfolio};
