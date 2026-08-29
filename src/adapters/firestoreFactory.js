const {Firestore}=require('@google-cloud/firestore');
function createDatabases(env=process.env){
 const projectId=env.GOOGLE_CLOUD_PROJECT||undefined; const common=projectId?{projectId}:{};
 const inboxDatabaseId=env.INBOX_DATABASE_ID||'bsscb'; const crmDatabaseId=env.CRM_DATABASE_ID||'bscrmscb'; const hunterDatabaseId=env.HUNTER_DATABASE_ID||'scb-hunter-bd';
 const supervisorDatabaseId=String(env.SUPERVISOR_DATABASE_ID||'').trim();
 if(!supervisorDatabaseId) throw new Error('SUPERVISOR_DATABASE_ID_REQUIRED');
 if([inboxDatabaseId,crmDatabaseId,hunterDatabaseId].includes(supervisorDatabaseId)) throw new Error('SUPERVISOR_DATABASE_MUST_BE_ISOLATED');
 return {inbox:new Firestore({...common,databaseId:inboxDatabaseId}),crm:new Firestore({...common,databaseId:crmDatabaseId}),hunter:new Firestore({...common,databaseId:hunterDatabaseId}),supervisor:new Firestore({...common,databaseId:supervisorDatabaseId}),ids:{inboxDatabaseId,crmDatabaseId,hunterDatabaseId,supervisorDatabaseId},sourceReadOnly:true};
}
module.exports={createDatabases};
