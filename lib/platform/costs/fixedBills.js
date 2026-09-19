// lib/platform/costs/fixedBills.js
//
// Bills no API reports, typed in from the invoice — PlatformFixedBill.
//
// ══ Hand-entered is a source, and it is printed as one ═══════════════════
//
// Vercel, Namecheap, Google Maps, Resend and Retell's monthly invoice reach
// FieldQuo as PDFs and dashboard pages, not as endpoints (Retell publishes
// none; Vercel's usage API returns units, not the invoice). So the figure
// is typed in by a superadmin and every print of it says so: "Vercel ·
// September 2026 · $113.18 · entered by Emilio on 2026-09-19". A period
// total that includes one says "includes hand-entered bills". A wrong row
// is edited or voided, never deleted — the correction is part of the record.
//
// ══ Superadmin only, and validated here, not in the route ════════════════
//
// The route checks the role; parseFixedBillInput() is the one place the
// shape is checked, so the check script can run it against garbage without
// a request.
import { db } from "@/lib/db";
import { adminDisplayName } from "@/lib/sales/assignLeads";

export const FIXED_BILL_SOURCE = "hand_entered";

/** The suppliers the form offers, in the order the page lists them. Free text is accepted too. */
export const FIXED_BILL_PROVIDERS = Object.freeze([
  { key: "vercel", label: "Vercel", section: "platform" },
  { key: "neon", label: "Neon", section: "platform" },
  { key: "resend", label: "Resend", section: "platform" },
  { key: "google_maps", label: "Google Maps", section: "platform" },
  { key: "namecheap", label: "Namecheap", section: "platform" },
  { key: "cloudinary", label: "Cloudinary", section: "platform" },
  { key: "retell", label: "Retell (invoice)", section: "companies" },
  { key: "openai", label: "OpenAI (invoice)", section: "sales" },
  { key: "twilio", label: "Twilio (invoice)", section: "sales" },
  { key: "apify", label: "Apify (invoice)", section: "sales" },
  { key: "other", label: "Other", section: "platform" },
]);

/** Which of the three sections a hand-entered provider belongs to; unknown keys are the platform's. */
export function fixedBillSection(provider) {
  return FIXED_BILL_PROVIDERS.find((p) => p.key === provider)?.section || "platform";
}

const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** "2026-09" → the UTC Date of the first of that month. Null for garbage. */
export function monthDate(value) {
  const m = typeof value === "string" ? value.trim().match(MONTH_RE) : null;
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12 || y < 2020 || y > 2100) return null;
  return new Date(Date.UTC(y, mo - 1, 1));
}

/** The "YYYY-MM" of a Date, in UTC. */
export function monthKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString().slice(0, 7);
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "September 2026" */
export function monthLabel(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  return `${MONTH_NAMES[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}

/**
 * Validate a form body into the columns. PURE. Returns { ok, data } or
 * { ok: false, error }. Amounts arrive as a string in dollars ("113.18")
 * or as cents (integer `amountCents`); never both. Nothing is defaulted:
 * a missing month or amount is an error, not this month or zero.
 */
export function parseFixedBillInput(body = {}) {
  const provider = typeof body.provider === "string" ? body.provider.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") : "";
  if (!provider || provider.length > 40) return { ok: false, error: "Name the supplier." };
  const periodMonth = monthDate(body.periodMonth);
  if (!periodMonth) return { ok: false, error: "The month is YYYY-MM." };
  let amountCents;
  if (body.amountCents !== undefined && body.amountCents !== null && body.amountCents !== "") {
    amountCents = Number(body.amountCents);
    if (!Number.isInteger(amountCents)) return { ok: false, error: "amountCents is a whole number of cents." };
  } else if (typeof body.amount === "string" || typeof body.amount === "number") {
    const s = String(body.amount).trim().replace(/^[$€£]/, "").replace(/,/g, "");
    if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return { ok: false, error: "The amount is dollars and cents, like 113.18." };
    amountCents = Math.round(Number(s) * 100);
  } else {
    return { ok: false, error: "Enter the amount from the invoice." };
  }
  if (amountCents < 0 || amountCents > 100_000_000) return { ok: false, error: "The amount is out of range." };
  const currency = typeof body.currency === "string" && /^[A-Za-z]{3}$/.test(body.currency.trim()) ? body.currency.trim().toUpperCase() : "USD";
  const invoiceRef = typeof body.invoiceRef === "string" && body.invoiceRef.trim() ? body.invoiceRef.trim().slice(0, 120) : null;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  return { ok: true, data: { provider, periodMonth, amountCents, currency, invoiceRef, note } };
}

/** "Vercel · September 2026 · $113.18 · entered by Emilio on 2026-09-19" — the sentence every print uses. PURE. */
export function fixedBillStatement(row) {
  const label = FIXED_BILL_PROVIDERS.find((p) => p.key === row.provider)?.label || row.provider;
  const amount = `${row.currency && row.currency !== "USD" ? `${row.currency} ` : "$"}${(Number(row.amountCents || 0) / 100).toFixed(2)}`;
  const who = row.enteredByName || adminDisplayName(row.enteredBy) || "a superadmin";
  const when = row.enteredAt ? new Date(row.enteredAt).toISOString().slice(0, 10) : "";
  const edited = row.updatedAt && row.enteredAt && new Date(row.updatedAt).getTime() - new Date(row.enteredAt).getTime() > 60_000 ? `, edited ${new Date(row.updatedAt).toISOString().slice(0, 10)}` : "";
  const voided = row.voidedAt ? ` — voided ${new Date(row.voidedAt).toISOString().slice(0, 10)}` : "";
  return `${label} · ${monthLabel(row.periodMonth)} · ${amount} · entered by ${who} on ${when}${edited}${voided}`;
}

function shape(row) {
  return {
    id: row.id,
    provider: row.provider,
    providerLabel: FIXED_BILL_PROVIDERS.find((p) => p.key === row.provider)?.label || row.provider,
    section: fixedBillSection(row.provider),
    periodMonth: monthKey(row.periodMonth),
    periodMonthLabel: monthLabel(row.periodMonth),
    amountCents: row.amountCents,
    currency: row.currency,
    invoiceRef: row.invoiceRef,
    note: row.note,
    enteredById: row.enteredById,
    enteredByName: adminDisplayName(row.enteredBy),
    enteredAt: row.enteredAt,
    updatedAt: row.updatedAt,
    voidedAt: row.voidedAt,
    source: FIXED_BILL_SOURCE,
    statement: fixedBillStatement({ ...row, enteredByName: adminDisplayName(row.enteredBy) }),
  };
}

/** Bills whose month falls in [from, to] — the whole month counts if any day of it does. */
export async function listFixedBills({ from, to, client = db, includeVoided = true } = {}) {
  const fromMonth = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const toMonth = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  const rows = await client.platformFixedBill.findMany({
    where: { periodMonth: { gte: fromMonth, lte: toMonth }, ...(includeVoided ? {} : { voidedAt: null }) },
    include: { enteredBy: { select: { id: true, email: true } } },
    orderBy: [{ periodMonth: "desc" }, { provider: "asc" }, { enteredAt: "asc" }],
  });
  return rows.map(shape);
}

export async function createFixedBill({ data, adminId, client = db }) {
  const row = await client.platformFixedBill.create({
    data: { ...data, enteredById: adminId },
    include: { enteredBy: { select: { id: true, email: true } } },
  });
  return shape(row);
}

/**
 * Edit a row in place, or void / unvoid it. The row keeps its original
 * enteredBy; `updatedAt` moves and the statement says "edited".
 */
export async function updateFixedBill({ id, data, voided, client = db }) {
  const patch = { ...(data || {}) };
  if (voided === true) patch.voidedAt = new Date();
  if (voided === false) patch.voidedAt = null;
  const row = await client.platformFixedBill.update({
    where: { id },
    data: patch,
    include: { enteredBy: { select: { id: true, email: true } } },
  });
  return shape(row);
}

/**
 * Sum the live (non-voided) bills by provider, prorated to the period by
 * days: a month's bill in a week's view is that week's share, and the
 * statement says the whole month's figure. PURE.
 */
export function fixedBillsForPeriod(bills, from, to) {
  const byProvider = new Map();
  let totalCents = 0;
  const periodFrom = from.getTime();
  const periodTo = to.getTime();
  for (const b of Array.isArray(bills) ? bills : []) {
    if (b.voidedAt) continue;
    const m = monthDate(b.periodMonth);
    if (!m) continue;
    const mStart = m.getTime();
    const mEnd = Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1);
    const overlap = Math.max(0, Math.min(mEnd, periodTo) - Math.max(mStart, periodFrom));
    if (overlap <= 0) continue;
    const share = Math.min(1, overlap / (mEnd - mStart));
    const cents = Math.round(b.amountCents * share * 100) / 100;
    const cur = byProvider.get(b.provider) || { provider: b.provider, label: b.providerLabel || b.provider, section: b.section || fixedBillSection(b.provider), cents: 0, wholeMonthCents: 0, bills: [], currency: b.currency };
    cur.cents = Math.round((cur.cents + cents) * 100) / 100;
    cur.wholeMonthCents += b.amountCents;
    cur.bills.push({ id: b.id, statement: b.statement, share: Math.round(share * 1000) / 1000 });
    byProvider.set(b.provider, cur);
    totalCents = Math.round((totalCents + cents) * 100) / 100;
  }
  return { byProvider: [...byProvider.values()], totalCents, count: [...byProvider.values()].reduce((s, p) => s + p.bills.length, 0) };
}
