const { Firestore } = require("@google-cloud/firestore");

function createDatabases() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || undefined;
  const common = projectId ? { projectId } : {};
  const inboxDatabaseId = process.env.INBOX_DATABASE_ID || "bsscb";
  const crmDatabaseId = process.env.CRM_DATABASE_ID || "bscrmscb";
  const hunterDatabaseId = process.env.HUNTER_DATABASE_ID || "scb-hunter-bd";
  const supervisorDatabaseId = process.env.SUPERVISOR_DATABASE_ID || inboxDatabaseId;

  return {
    inbox: new Firestore({ ...common, databaseId: inboxDatabaseId }),
    crm: new Firestore({ ...common, databaseId: crmDatabaseId }),
    hunter: new Firestore({ ...common, databaseId: hunterDatabaseId }),
    supervisor: new Firestore({ ...common, databaseId: supervisorDatabaseId }),
    ids: { inboxDatabaseId, crmDatabaseId, hunterDatabaseId, supervisorDatabaseId }
  };
}

module.exports = { createDatabases };
