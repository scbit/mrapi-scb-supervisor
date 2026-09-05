class AiProvider{
  async analyzeConversation(){throw new Error('AI_PROVIDER_ANALYZE_NOT_IMPLEMENTED')}
  async verifyCorrection(){throw new Error('AI_PROVIDER_VERIFY_NOT_IMPLEMENTED')}
  async analyzeWeekendOpportunity(){throw new Error('AI_PROVIDER_WEEKEND_NOT_IMPLEMENTED')}
  async analyzeSupervisionNeed(){throw new Error('AI_PROVIDER_SUPERVISION_NEED_NOT_IMPLEMENTED')}
}
module.exports={AiProvider};
