const fs = require("fs");
const path = require("path");

function numberEnv(name, current, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (process.env[name] === undefined || process.env[name] === "") return current;
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}: expected number between ${min} and ${max}`);
  }
  return value;
}

function validateConfig(config) {
  const errors = [];
  if (!config || typeof config !== "object") errors.push("config must be an object");
  if (!config?.timezone) errors.push("timezone is required");
  if (!Array.isArray(config?.follow_up?.active_stages) || !config.follow_up.active_stages.length) {
    errors.push("follow_up.active_stages must contain at least one stage");
  }
  if (!Array.isArray(config?.follow_up?.inactive_stages)) errors.push("follow_up.inactive_stages must be an array");

  const positive = [
    ["response.late_after_minutes", config?.response?.late_after_minutes],
    ["follow_up.severe_after_days", config?.follow_up?.severe_after_days],
    ["incremental.lookback_minutes", config?.incremental?.lookback_minutes],
    ["incremental.max_conversations_per_run", config?.incremental?.max_conversations_per_run],
    ["incremental.max_messages_per_conversation", config?.incremental?.max_messages_per_conversation],
    ["incremental.max_deals_per_run", config?.incremental?.max_deals_per_run],
    ["incremental.max_hunter_events_per_run", config?.incremental?.max_hunter_events_per_run],
    ["incremental.max_daily_conversation_states", config?.incremental?.max_daily_conversation_states]
  ];
  for (const [name, value] of positive) {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) errors.push(`${name} must be > 0`);
  }

  if (errors.length) throw new Error(`Invalid supervisor config: ${errors.join("; ")}`);
  return config;
}

function loadConfig() {
  const configured = process.env.SUPERVISOR_CONFIG_PATH || "config/supervisor.default.json";
  const absolute = path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  const config = JSON.parse(fs.readFileSync(absolute, "utf8"));

  config.incremental.lookback_minutes = numberEnv("SUPERVISOR_LOOKBACK_MINUTES", config.incremental.lookback_minutes, { min: 1, max: 1440 });
  config.incremental.max_conversations_per_run = numberEnv("SUPERVISOR_MAX_CONVERSATIONS_PER_RUN", config.incremental.max_conversations_per_run, { min: 1, max: 10000 });
  config.incremental.max_messages_per_conversation = numberEnv("SUPERVISOR_MAX_MESSAGES_PER_CONVERSATION", config.incremental.max_messages_per_conversation, { min: 1, max: 5000 });
  config.incremental.max_deals_per_run = numberEnv("SUPERVISOR_MAX_DEALS_PER_RUN", config.incremental.max_deals_per_run, { min: 1, max: 20000 });
  config.incremental.max_hunter_events_per_run = numberEnv("SUPERVISOR_MAX_HUNTER_EVENTS_PER_RUN", config.incremental.max_hunter_events_per_run, { min: 1, max: 50000 });
  config.incremental.max_daily_conversation_states = numberEnv("SUPERVISOR_MAX_DAILY_CONVERSATION_STATES", config.incremental.max_daily_conversation_states, { min: 1, max: 50000 });
  config.incremental.bootstrap_hours = numberEnv("SUPERVISOR_BOOTSTRAP_HOURS", config.incremental.bootstrap_hours, { min: 1, max: 720 });

  return validateConfig(config);
}

module.exports = { loadConfig, validateConfig, numberEnv };
