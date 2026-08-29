function limitReached(count, limit) {
  const n = Number(count || 0);
  const max = Number(limit || 0);
  return max > 0 && n >= max;
}

function buildRunDiagnostics({ counts = {}, limits = {}, skipped = {}, durationsMs = {}, sourceErrors = {} } = {}) {
  const warnings = [];
  const saturation = {};
  for (const source of ["inbox", "crm", "hunter", "dailyState"]) {
    const hit = limitReached(counts[source], limits[source]);
    saturation[source] = hit;
    if (hit) warnings.push(`${source.toUpperCase()}_LIMIT_REACHED`);
  }
  for (const [source, error] of Object.entries(sourceErrors || {})) {
    if (error) warnings.push(`${String(source).toUpperCase()}_SOURCE_ERROR`);
  }
  return {
    counts,
    limits,
    skipped,
    durationsMs,
    saturation,
    warnings,
    healthy: warnings.length === 0
  };
}

module.exports = { limitReached, buildRunDiagnostics };
