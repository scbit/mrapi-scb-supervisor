const express = require("express");

function createApp({ engine, databases, config }) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({
      ok: true,
      service: "SUPERVISOR SCB V3",
      version: "0.1.0",
      roadmap: "ROADMAP 1 — CORE DE SUPERVISIÓN COMERCIAL"
    });
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "mrapi-scb-supervisor",
      databases: databases.ids,
      config: {
        timezone: config.timezone,
        lateAfterMinutes: config.response.late_after_minutes,
        severeAfterDays: config.follow_up.severe_after_days
      }
    });
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
