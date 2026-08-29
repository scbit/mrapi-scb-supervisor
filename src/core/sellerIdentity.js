function canonicalToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^mailto:/, "")
    .replace(/\s+/g, " ");
}

function slug(value) {
  return canonicalToken(value)
    .replace(/@.*$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

class SellerIdentityResolver {
  constructor(config = {}) {
    this.aliases = new Map();
    this.directory = new Map();
    const source = config?.seller_identity?.aliases || {};
    for (const [canonicalId, values] of Object.entries(source)) {
      this.register(canonicalId, [canonicalId, ...(Array.isArray(values) ? values : [values])], "configured_alias");
    }
  }

  register(canonicalId, candidates = [], source = "discovered") {
    const id = String(canonicalId || "").trim() || slug(candidates.find(Boolean));
    const clean = [id, ...candidates].flat().filter(Boolean).map(v => String(v).trim()).filter(Boolean);
    if (!clean.length) return null;
    for (const value of clean) this.aliases.set(canonicalToken(value), id);
    const previous = this.directory.get(id) || { id, aliases: [], sources: [] };
    previous.aliases = Array.from(new Set([...previous.aliases, ...clean]));
    previous.sources = Array.from(new Set([...previous.sources, source]));
    this.directory.set(id, previous);
    return previous;
  }

  registerCrmUser(user = {}) {
    const canonical = user.email || user.id || user.name;
    return this.register(canonical, [user.id, user.name, user.email], "crm_user");
  }

  registerHunterUser(user = {}) {
    const canonical = user.email || user.id || user.name;
    return this.register(canonical, [user.id, user.name, user.email], "hunter_user");
  }

  resolve(...candidates) {
    const clean = candidates.flat().filter(Boolean).map(String).map(x => x.trim()).filter(Boolean);
    for (const candidate of clean) {
      const key = canonicalToken(candidate);
      if (this.aliases.has(key)) {
        const id = this.aliases.get(key);
        return { id, label: this.directory.get(id)?.aliases?.[0] || candidate, source: "mapped", raw: candidate };
      }
    }
    const preferred = clean.find(x => x.includes("@")) || clean[0] || "unknown";
    return { id: slug(preferred), label: preferred, source: "derived", raw: preferred };
  }

  snapshot() {
    return [...this.directory.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}

module.exports = { canonicalToken, slug, SellerIdentityResolver };
