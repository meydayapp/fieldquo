// lib/safeNumber.js
// Prisma returns Decimal fields as Decimal.js objects, not plain numbers — this
// normalizes any of those (or strings, or null) into a safe JS number for math/display.
export function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return value;
  if (typeof value === "object" && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function round2(value) {
  return Math.round(safeNumber(value) * 100) / 100;
}

export function formatCurrency(value, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(
    safeNumber(value),
  );
}
