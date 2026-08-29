const express = require("express");
const { publicContractSummary } = require("../contracts/sourceContracts");
const { localDateParts } = require("../core/time");
const { version } = require("../../package.json");
const { requireCoreAuth, authPolicy } = require("./security");

function createApp({ engine, databases, config }) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  const coreAuth = requireCoreAuth(process.env);

  app.get("/", (_req, res) => {
    res.json({
      ok: true,
      service: "SUPERVISOR SCB V3",
      version,
      roadmap: "ROADMAP 1 — CORE DE SUPERVISIÓN COMERCIAL"
    });
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "mrapi-scb-supervisor",
      version,
      databases: databases.ids,
      config: {
        timezone: config.timezone,
        lateAfterMinutes: config.response.late_after_minutes,
        severeAfterDays: config.follow_up.severe_after_days
      },
      coreAuth: (() => { const p = authPolicy(process.env); return { required: p.required, configured: p.configured }; })()
    });
  });

  app.get("/api/core/contracts", coreAuth, (_req, res) => {
    res.json({ ok: true, contracts: publicContractSummary() });
  });

  app.get("/api/core/identity", coreAuth, (_req, res) => {
    res.json({ ok: true, sellers: engine.identities.snapshot() });
  });

  app.get("/api/core/status", coreAuth, async (_req, res) => {
    try {
      const [checkpoints, latestRun] = await Promise.all([
        engine.store.getSourceCheckpoints(),
        engine.store.getLatestRun()
      ]);
      res.json({
        ok: true,
        version,
        checkpoints,
        latestRun,
        identityCount: engine.identities.snapshot().length
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/core/sellers", coreAuth, async (req, res) => {
    try {
      const date = String(req.query.date || localDateParts(new Date(), config.timezone).ymd);
      const sellers = await engine.store.listSellerDaily(date, Number(req.query.limit || 500));
      sellers.sort((a, b) => {
        if (a.clientsWaiting !== b.clientsWaiting) return Number(b.clientsWaiting || 0) - Number(a.clientsWaiting || 0);
        if (a.severeFollowUpFailures !== b.severeFollowUpFailures) return Number(b.severeFollowUpFailures || 0) - Number(a.severeFollowUpFailures || 0);
        return String(a.sellerLabel || '').localeCompare(String(b.sellerLabel || ''));
      });
      res.json({ ok: true, date, sellers });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/core/waiting", coreAuth, async (req, res) => {
    try {
      const date = String(req.query.date || localDateParts(new Date(), config.timezone).ymd);
      const rows = await engine.store.listWaitingConversations(date, Number(req.query.limit || 500));
      res.json({ ok: true, date, count: rows.length, conversations: rows });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/core/follow-up-failures", coreAuth, async (req, res) => {
    try {
      const rows = await engine.store.listActiveFollowUpFailures(Number(req.query.limit || 500));
      rows.sort((a, b) => Number(b.daysOverdue || 0) - Number(a.daysOverdue || 0));
      res.json({ ok: true, count: rows.length, failures: rows });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/core/run", coreAuth, async (req, res) => {
    try {
      const now = req.body?.now ? new Date(req.body.now) : new Date();
      const forceSince = req.body?.forceSince ? new Date(req.body.forceSince) : null;
      if (Number.isNaN(now.getTime())) return res.status(400).json({ ok: false, error: "INVALID_NOW" });
      if (forceSince && Number.isNaN(forceSince.getTime())) return res.status(400).json({ ok: false, error: "INVALID_FORCE_SINCE" });
      if (forceSince && forceSince > now) return res.status(400).json({ ok: false, error: "FORCE_SINCE_AFTER_NOW" });
      const maxForceDays = Number(process.env.SUPERVISOR_MAX_FORCE_SINCE_DAYS || 31);
      if (forceSince && (now - forceSince) / 86400000 > maxForceDays) {
        return res.status(400).json({ ok: false, error: "FORCE_SINCE_TOO_OLD", maxDays: maxForceDays });
      }
      const result = await engine.run({ now, forceSince });
      res.json({ ok: true, result });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  return app;
}

module.exports = { createApp };
