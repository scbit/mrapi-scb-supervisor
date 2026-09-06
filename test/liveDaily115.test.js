const test=require('node:test');
const assert=require('node:assert/strict');
const {buildCommercialCase}=require('../src/core/liveDailySupervisor');

test('0.11.5 multidimensional rubric separates speed from quality',()=>{
  const c=buildCommercialCase({
    noHumanResponse:false,botOnly:false,
    lateResponses:[{minutes:73,humanAt:'x'}],lastHumanAt:'x',
    operationalWithoutDiscovery:false,unexploredPotential:false,needsReviewByAi:false
  });
  assert.equal(c.dimensions.responseTime.code,'VERY_LATE');
  assert.equal(c.dimensions.responseQuality.code,'GOOD');
  assert.equal(c.dimensions.advisory.code,'GOOD');
  assert.equal(c.quality,'A_CORREGIR');
});

test('0.11.5 poor commercial handling is visible across separate dimensions',()=>{
  const c=buildCommercialCase({
    noHumanResponse:false,botOnly:false,lateResponses:[],
    operationalWithoutDiscovery:true,unexploredPotential:true,needsReviewByAi:true
  });
  assert.equal(c.dimensions.responseQuality.code,'POOR');
  assert.equal(c.dimensions.advisory.code,'POOR');
  assert.equal(c.dimensions.guidance.code,'INSUFFICIENT');
  assert.equal(c.dimensions.opportunity.code,'NOT_DEVELOPED');
});

test('0.11.5 regular quality can be REVIEW without being good',()=>{
  const c=buildCommercialCase({
    noHumanResponse:false,botOnly:false,lateResponses:[],
    operationalWithoutDiscovery:false,unexploredPotential:false,needsReviewByAi:true
  });
  assert.equal(c.quality,'REVISAR');
  assert.equal(c.dimensions.responseQuality.code,'REGULAR');
});
