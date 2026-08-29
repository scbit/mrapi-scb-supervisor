const fs = require("fs");
const path = require("path");

function loadConfig() {
  const configured = process.env.SUPERVISOR_CONFIG_PATH || "config/supervisor.default.json";
  const absolute = path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  const config = JSON.parse(fs.readFileSync(absolute, "utf8"));

  if (process.env.SUPERVISOR_LOOKBACK_MINUTES) {
    config.incremental.lookback_minutes = Number(process.env.SUPERVISOR_LOOKBACK_MINUTES);
  }
  if (process.env.SUPERVISOR_MAX_CONVERSATIONS_PER_RUN) {
    config.incremental.max_conversations_per_run = Number(process.env.SUPERVISOR_MAX_CONVERSATIONS_PER_RUN);
  }
  if (process.env.SUPERVISOR_MAX_MESSAGES_PER_CONVERSATION) {
    config.incremental.max_messages_per_conversation = Number(process.env.SUPERVISOR_MAX_MESSAGES_PER_CONVERSATION);
  }
  if (process.env.SUPERVISOR_MAX_DEALS_PER_RUN) {
    config.incremental.max_deals_per_run = Number(process.env.SUPERVISOR_MAX_DEALS_PER_RUN);
  }
  return config;
}

module.exports = { loadConfig };
