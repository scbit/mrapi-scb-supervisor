const crypto = require("crypto");

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

function authPolicy(env = process.env) {
  const required = String(env.SUPERVISOR_REQUIRE_AUTH ?? "true").toLowerCase() !== "false";
  const token = String(env.SUPERVISOR_API_TOKEN || "").trim();
  return { required, configured: token.length > 0, token };
}

function authorizeRequest(req, env = process.env) {
  const policy = authPolicy(env);
  if (!policy.required) return { ok: true, mode: "disabled" };
  if (!policy.configured) return { ok: false, status: 503, code: "CORE_AUTH_NOT_CONFIGURED" };
  const supplied = req?.get?.("x-supervisor-token") || req?.headers?.["x-supervisor-token"] || "";
  if (!safeEqual(supplied, policy.token)) return { ok: false, status: 401, code: "UNAUTHORIZED" };
  return { ok: true, mode: "token" };
}

function requireCoreAuth(env = process.env) {
  return (req, res, next) => {
    const result = authorizeRequest(req, env);
    if (!result.ok) return res.status(result.status).json({ ok: false, error: result.code });
    req.supervisorAuth = result;
    return next();
  };
}

module.exports = { safeEqual, authPolicy, authorizeRequest, requireCoreAuth };
