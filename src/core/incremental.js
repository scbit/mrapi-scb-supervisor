const crypto = require('crypto');
const { asDate } = require('./time');

function cursorWithLookback(cursor, lookbackMinutes, fallbackNow, fallbackHours = 24) {
  const base = asDate(cursor);
  if (base) return new Date(base.getTime() - Math.max(0, Number(lookbackMinutes || 0)) * 60000);
  const now = asDate(fallbackNow) || new Date();
  return new Date(now.getTime() - Math.max(1, Number(fallbackHours || 24)) * 3600000);
}

function newestDate(values, initial = null) {
  let current = asDate(initial);
  for (const value of values || []) {
    const candidate = asDate(value);
    if (candidate && (!current || candidate > current)) current = candidate;
  }
  return current;
}

function advanceCursor(previous, observedValues) {
  const next = newestDate(observedValues, previous);
  return next ? next.toISOString() : previous || null;
}

function stableFingerprint(value) {
  function canonical(input) {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === 'object') {
      return Object.keys(input).sort().reduce((acc, key) => {
        acc[key] = canonical(input[key]);
        return acc;
      }, {});
    }
    return input;
  }
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

module.exports = { cursorWithLookback, newestDate, advanceCursor, stableFingerprint };
