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
    const source = config?.seller_identity?.aliases || {};
    for (const [canonicalId, values] of Object.entries(source)) {
      const all = Array.isArray(values) ? values : [values];
      this.aliases.set(canonicalToken(canonicalId), canonicalId);
      for (const value of all) this.aliases.set(canonicalToken(value), canonicalId);
    }
  }

  resolve(...candidates) {
    const clean = candidates.flat().filter(Boolean).map(String).map(x => x.trim()).filter(Boolean);
    for (const candidate of clean) {
      const key = canonicalToken(candidate);
      if (this.aliases.has(key)) {
        return { id: this.aliases.get(key), label: candidate, source: "configured_alias", raw: candidate };
      }
    }
    const preferred = clean.find(x => x.includes("@")) || clean[0] || "unknown";
    return { id: slug(preferred), label: preferred, source: "derived", raw: preferred };
  }
}

module.exports = { canonicalToken, slug, SellerIdentityResolver };
