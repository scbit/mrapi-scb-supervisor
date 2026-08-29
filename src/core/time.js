function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value._seconds !== undefined) {
    const d = new Date(Number(value._seconds) * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(value) {
  const d = asDate(value);
  return d ? d.toISOString() : null;
}

function minutesBetween(a, b) {
  const da = asDate(a);
  const db = asDate(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / 60000);
}

function daysOverdue(dueValue, asOf = new Date(), timeZone = "America/Argentina/Buenos_Aires") {
  const due = asDate(dueValue);
  const now = asDate(asOf);
  if (!due || !now) return null;
  const dueParts = localDateParts(due, timeZone);
  const nowParts = localDateParts(now, timeZone);
  const dueDay = Date.UTC(Number(dueParts.year), Number(dueParts.month) - 1, Number(dueParts.day));
  const nowDay = Date.UTC(Number(nowParts.year), Number(nowParts.month) - 1, Number(nowParts.day));
  return Math.max(0, Math.floor((nowDay - dueDay) / 86400000));
}

function localDateParts(date, timeZone = "America/Argentina/Buenos_Aires") {
  const d = asDate(date) || new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: weekdayMap[parts.weekday],
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

function hhmmToMinutes(value) {
  const [h, m] = String(value || "00:00").split(":").map(Number);
  return h * 60 + m;
}

function isWithinBusinessHours(date, config) {
  const tz = config.timezone || "America/Argentina/Buenos_Aires";
  const p = localDateParts(date, tz);
  const hours = config.business_hours || {};
  const days = Array.isArray(hours.weekdays) ? hours.weekdays : [1, 2, 3, 4, 5];
  if (!days.includes(p.weekday)) return false;
  const nowMinutes = p.hour * 60 + p.minute;
  return nowMinutes >= hhmmToMinutes(hours.start || "09:00") &&
    nowMinutes <= hhmmToMinutes(hours.end || "17:00");
}

function localDayRange(date, timeZone = "America/Argentina/Buenos_Aires") {
  // Argentina currently uses UTC-03. We avoid hidden production dependencies and keep the
  // operational timezone configurable. This helper derives the UTC offset dynamically.
  const d = asDate(date) || new Date();
  const p = localDateParts(d, timeZone);
  const localMiddayUtc = new Date(`${p.ymd}T12:00:00.000Z`);
  const partsAtUtc = localDateParts(localMiddayUtc, timeZone);
  const representedUtcMinutes = Date.UTC(
    Number(partsAtUtc.year), Number(partsAtUtc.month) - 1, Number(partsAtUtc.day),
    partsAtUtc.hour, partsAtUtc.minute
  ) / 60000;
  const sourceUtcMinutes = localMiddayUtc.getTime() / 60000;
  const offsetMinutes = representedUtcMinutes - sourceUtcMinutes;
  const start = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), 0, 0, 0) - offsetMinutes * 60000);
  const endExclusive = new Date(start.getTime() + 86400000);
  return { ymd: p.ymd, start, endExclusive };
}

module.exports = {
  asDate,
  toIso,
  minutesBetween,
  daysOverdue,
  localDateParts,
  isWithinBusinessHours,
  localDayRange
};
