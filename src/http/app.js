const express = require("express");
const { publicContractSummary } = require("../contracts/sourceContracts");
const { localDateParts } = require("../core/time");
const { version } = require("../../package.json");

function createApp({ engine, databases, config }) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

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
      }
    });
  });

  app.get("/api/core/contracts", (_req, res) => {
    res.json({ ok: true, contracts: publicContractSummary() });
  });

  app.get("/api/core/identity", (_req, res) => {
    res.json({ ok: true, sellers: engine.identities.snapshot() });
  });

  app.get("/api/core/sellers", async (req, res) => {
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

  app.get("/api/core/waiting", async (req, res) => {
    try {
      const date = String(req.query.date || localDateParts(new Date(), config.timezone).ymd);
      const rows = await engine.store.listWaitingConversations(date, Number(req.query.limit || 500));
      res.json({ ok: true, date, count: rows.length, conversations: rows });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/core/follow-up-failures", async (req, res) => {
    try {
      const rows = await engine.store.listActiveFollowUpFailures(Number(req.query.limit || 500));
      rows.sort((a, b) => Number(b.daysOverdue || 0) - Number(a.daysOverdue || 0));
      res.json({ ok: true, count: rows.length, failures: rows });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/core/run", async (req, res) => {
    try {
      const now = req.body?.now ? new Date(req.body.now) : new Date();
      const forceSince = req.body?.forceSince ? new Date(req.body.forceSince) : null;
      const result = await engine.run({ now, forceSince });
      res.json({ ok: true, result });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  return app;
}

module.exports = { createApp };
