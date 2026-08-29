const SOURCE_CONTRACTS = Object.freeze({
  inbox: {
    databaseEnv: "INBOX_DATABASE_ID",
    defaultDatabaseId: "bsscb",
    collections: {
      conversations: "conversations",
      messagesPath: "conversations/{conversationId}/messages",
      users: "users"
    },
    conversationFields: [
      "contactId", "contactName", "dealId", "phone", "stage", "lastMessageAt",
      "lastInboundAt", "lastOutboundAt", "leadPlatform", "sourceChannel", "owner"
    ],
    messageFields: [
      "direction", "type", "source", "provider", "channel", "user", "userEmail",
      "owner", "agent", "sentBy", "text", "body", "message", "content", "timestamp", "createdAt"
    ]
  },
  crm: {
    databaseEnv: "CRM_DATABASE_ID",
    defaultDatabaseId: "bscrmscb",
    collections: {
      deals: "deals",
      contacts: "contacts",
      users: "users",
      automationConfigs: "automation_configs",
      dealNotesPath: "deals/{dealId}/notes"
    },
    dealFields: [
      "title", "name", "dealName", "contactId", "owner", "ownerEmail", "assignedTo",
      "seller", "vendedor", "stage", "status", "dueDate", "nextDueDate", "fechaVencimiento",
      "vencimiento", "nextFollowUpAt", "followUpDate", "conversationId", "updatedAt", "lastActivityAt"
    ],
    contactFields: [
      "name", "company", "companyName", "phone", "whatsapp", "mobile", "email",
      "owner", "ownerEmail", "assignedTo", "seller", "vendedor"
    ]
  },
  hunter: {
    databaseEnv: "HUNTER_DATABASE_ID",
    defaultDatabaseId: "scb-hunter-bd",
    collections: {
      contactSources: "hunter_contact_sources",
      customsGroups: "hunter_customs_groups",
      customsItems: "hunter_customs_items",
      prospects: "hunter_prospects",
      notes: "hunter_notes",
      tasks: "hunter_tasks",
      users: "hunter_users",
      jobs: "hunter_upload_jobs",
      jobRows: "hunter_upload_job_rows",
      matchIndex: "hunter_match_index"
    },
    managementFields: [
      "prospectId", "userId", "userName", "result", "note", "nextActionDate",
      "taskType", "taskTypeLabel", "isFollowUp", "createdAt"
    ],
    assignmentFields: [
      "commercial.assignedTo", "commercial.assignedToName", "commercial.status",
      "commercial.lastResult", "commercial.lastNoteAt", "commercial.nextActionDate"
    ]
  }
});

function publicContractSummary() {
  return JSON.parse(JSON.stringify(SOURCE_CONTRACTS));
}

module.exports = { SOURCE_CONTRACTS, publicContractSummary };
