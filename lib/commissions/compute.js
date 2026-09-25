// lib/commissions/compute.js
//
// What each person has earned in commission on one job. Pure — no database,
// no clock — so scripts/check-commissions.mjs can drive every branch with
// fixtures, and so the job card, the ledger and the pay run cannot disagree
// about a number: they all come from here.
//
// ══ The model (Housecall Pro's, on FieldQuo's rows) ═══════════════════════
//
// Two roles. WORKED — the people who did the job. SOLD — the person who sold
// it. Each earner has a rate for their role (Member.workedByPct/soldByPct), a
// price-book item can carry its own rate that beats the member's
// (Product.workedByPct/soldByPct), and an item can be marked not
// commissionable at all.
//
// The basis of a line is its price after the invoice's discount and before
// tax. On the "gross_profit" basis that is multiplied by the JOB's gross
// margin — (revenue − actual cost) ÷ revenue, clamped to 0–100% — so a job
// that lost money pays nobody a commission rather than a negative one.
//
//   line commission = line basis × rate% × this earner's share of the line
//
// ══ Splits, and why they renormalise per line ════════════════════════════
//
// Everyone in a role has a split (they sum to 100 across the role). An earner
// can opt out of lines ("members pick the lines they earn on"). A line's
// share for earner i is split_i ÷ Σ split_j over the earners of that role who
// did NOT opt out of it. So two workers at 50/50 who each did one of two lines
// each get 100% of their own line — which is what picking lines means — and
// nobody's share of a line leaks to someone who opted out of it.
//
// A FIXED override replaces an earner's computed amount with a dollar figure
// for the job. Their split still counts in the denominator: the fixed amount
// replaces THEIR share, it does not hand it to anyone else. An owner who wants
// the other earner on 100% says so with the split.
//
// ══ Earned, not invoiced ═════════════════════════════════════════════════
//
// Everything above is the POTENTIAL — what the line would pay if the invoice
// were fully collected. What is EARNED is that times the invoice family's paid
// fraction (amountPaid ÷ total, where amountPaid is already net of refunds and
// lost disputes — lib/invoices/computeInvoiceState.js). A deposit earns its
// share, a refund takes its share back, and a sent-but-unpaid invoice earns
// nothing.
//
// ══ Cents ═══════════════════════════════════════════════════════════════
//
// Each (earner, role, invoice family) figure is rounded to the cent once, at
// the end, and every total above it is a sum of those integers. The ledger
// writes differences of these integers, so it never accumulates a stray
// fraction of a cent across a deposit, a balance and a refund.

export const ROLES = Object.freeze(["worked", "sold"]);
export const BASES = Object.freeze(["revenue", "gross_profit"]);

/** Refused rather than clamped past these — see lib/costing/actualJobCost.js#sane. */
export const MAX_PCT = 100;
export const MAX_FIXED = 1_000_000;
const MAX_EARNERS = 20;
const MAX_EXCLUDED = 200;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
/** Nearest cent as an integer. EPSILON so 1.005 is 101, not 100. */
export const toCents = (v) => {
  const n = num(v);
  const c = Math.round((n + Math.sign(n) * Number.EPSILON) * 100);
  return Number.isFinite(c) ? c : 0;
};
export const fromCents = (c) => Math.round(num(c)) / 100;
const round2 = (v) => fromCents(toCents(v));

/** A rate as stored (Decimal | string | null) → a number, or null for "none". */
export function pctOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > MAX_PCT) return null;
  return round2(n);
}

/**
 * A rate typed into a form → what may be stored.
 *
 * "" / null clears it (the member is not on commission for that role; the
 * item falls back to the member's rate). Anything else must be a number from
 * 0 to 100 — refused otherwise, never clamped: 150% is a typo, and storing
 * 100% in its place would put a number nobody typed into someone's pay.
 *
 * @returns {{ ok: true, value: number|null } | { ok: false }}
 */
export function parseRateInput(v) {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  if (typeof v !== "number" && typeof v !== "string") return { ok: false };
  const n = typeof v === "string" ? Number(v.trim()) : v;
  if (typeof v === "string" && !v.trim()) return { ok: true, value: null };
  if (!Number.isFinite(n) || n < 0 || n > MAX_PCT) return { ok: false };
  return { ok: true, value: round2(n) };
}

/**
 * The commission fields of a price-book PATCH/POST body → Prisma data, or an
 * error. Absent keys are left alone.
 */
export function productCommissionData(body) {
  const data = {};
  if (!body || typeof body !== "object") return { ok: true, data };
  if (body.commissionable !== undefined) data.commissionable = body.commissionable !== false;
  for (const field of ["workedByPct", "soldByPct"]) {
    if (body[field] === undefined) continue;
    const r = parseRateInput(body[field]);
    if (!r.ok) return { ok: false, error: "A commission rate must be between 0 and 100%." };
    data[field] = r.value;
  }
  return { ok: true, data };
}

/** Which price-book item a line carries, if any. */
export function lineProductId(line) {
  if (!line || typeof line !== "object") return null;
  const direct = typeof line.productId === "string" ? line.productId : null;
  if (direct) return direct;
  const tpl = line.meta?.template?.productId;
  return typeof tpl === "string" && tpl ? tpl : null;
}

/**
 * The key an earner's "not on this line" choice is stored against. The item
 * when there is one — a price-book service is the same service on every
 * invoice of the job — otherwise the line's own wording, lower-cased.
 */
export function lineKey(line) {
  const pid = lineProductId(line);
  if (pid) return `p:${pid}`;
  const d = String(line?.description ?? line?.name ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 120);
  return `d:${d}`;
}

/**
 * One invoice's priced lines, each with its share of the discount taken off.
 *
 * The discount is spread over the lines in proportion to their amounts — the
 * document states one discount for the whole invoice, and a line-level figure
 * is the only way to apply an item's own rate to what that item actually
 * sold for. Tax is never part of a basis. A line with no amount (a heading, a
 * text block) is not a line anyone earns on.
 */
export function familyLines(invoice) {
  const raw = Array.isArray(invoice?.lineItems) ? invoice.lineItems : [];
  const priced = raw
    .filter((l) => l && typeof l === "object")
    .map((l) => ({ line: l, amount: num(l.amount) }))
    .filter((x) => x.amount !== 0);
  const gross = priced.reduce((s, x) => s + x.amount, 0);
  const discount = Math.min(Math.max(num(invoice?.discount), 0), Math.max(gross, 0));
  const factor = gross > 0 ? (gross - discount) / gross : 1;
  return priced.map(({ line, amount }) => ({
    key: lineKey(line),
    productId: lineProductId(line),
    description: String(line.description ?? line.name ?? "").slice(0, 200),
    net: amount * factor,
  }));
}

/** amountPaid ÷ total, 0–1. A zero or negative total has nothing to collect. */
export function paidFraction({ total, amountPaid } = {}) {
  const t = num(total);
  if (t <= 0) return 0;
  return Math.min(Math.max(num(amountPaid) / t, 0), 1);
}

/** (revenue − cost) ÷ revenue, 0–1. No revenue is no margin, not 100%. */
export function grossProfitRatio({ revenue, cost } = {}) {
  const r = num(revenue);
  if (r <= 0) return 0;
  return Math.min(Math.max((r - num(cost)) / r, 0), 1);
}

/**
 * n even splits that sum to exactly 100.00 — 33.33 / 33.33 / 33.34, never
 * three 33.33s that leave a cent of every line unpaid.
 */
export function evenSplits(n) {
  const count = Math.max(0, Math.floor(num(n)));
  if (!count) return [];
  const base = Math.floor(10000 / count);
  const out = Array.from({ length: count }, () => base);
  out[count - 1] += 10000 - base * count;
  return out.map((c) => c / 100);
}

/**
 * The rate on one line for one earner. The item beats the member; an item
 * marked not commissionable pays nobody; no rate anywhere is 0, and says so.
 */
export function rateFor({ role, memberPct, product }) {
  if (product && product.commissionable === false) return { pct: 0, source: "not_commissionable" };
  const item = product ? pctOrNull(role === "sold" ? product.soldByPct : product.workedByPct) : null;
  if (item !== null) return { pct: item, source: "item" };
  const own = pctOrNull(memberPct);
  if (own !== null) return { pct: own, source: "member" };
  return { pct: 0, source: "none" };
}

/**
 * The browser → database boundary for the job card's earner list.
 *
 * @param input      what the card posted
 * @param knownIds   Set of this company's member ids — anyone else is refused
 * @returns {{ ok: true, earners } | { ok: false, error, code }}
 */
export function normaliseEarners(input, knownIds) {
  if (!Array.isArray(input)) return { ok: false, code: "shape", error: "Earners must be a list." };
  if (input.length > MAX_EARNERS) return { ok: false, code: "too_many", error: "Too many earners on one job." };
  const known = knownIds instanceof Set ? knownIds : new Set(knownIds || []);
  const seen = new Set();
  const earners = [];
  for (const e of input) {
    if (!e || typeof e !== "object") return { ok: false, code: "shape", error: "Every earner needs a person and a role." };
    const memberId = typeof e.memberId === "string" ? e.memberId : "";
    const role = ROLES.includes(e.role) ? e.role : null;
    if (!memberId || !role) return { ok: false, code: "shape", error: "Every earner needs a person and a role." };
    if (!known.has(memberId)) return { ok: false, code: "unknown_member", error: "That person isn't on this company's team." };
    const dup = `${memberId}:${role}`;
    if (seen.has(dup)) return { ok: false, code: "duplicate", error: "Someone is listed twice in the same role." };
    seen.add(dup);
    const split = Number(e.splitPct);
    if (!Number.isFinite(split) || split < 0 || split > 100) {
      return { ok: false, code: "split_range", error: "A split must be between 0 and 100%." };
    }
    let fixedAmount = null;
    if (e.fixedAmount !== null && e.fixedAmount !== undefined && e.fixedAmount !== "") {
      const f = Number(e.fixedAmount);
      // Refused, not clamped: a fixed override of a million dollars is a typo,
      // and rewriting it as the ceiling would put an invented figure on a pay run.
      if (!Number.isFinite(f) || f < 0 || f > MAX_FIXED) {
        return { ok: false, code: "fixed_range", error: "A fixed amount must be between 0 and 1,000,000." };
      }
      fixedAmount = round2(f);
    }
    const excludedLines = Array.isArray(e.excludedLines)
      ? [...new Set(e.excludedLines.filter((k) => typeof k === "string" && /^[pd]:/.test(k)).map((k) => k.slice(0, 130)))].slice(0, MAX_EXCLUDED)
      : [];
    earners.push({ memberId, role, splitPct: round2(split), fixedAmount, excludedLines });
  }
  // Splits sum to 100 within each role that has anyone in it. Checked on the
  // cents so 33.33 + 33.33 + 33.34 passes and 33.33 × 3 does not.
  for (const role of ROLES) {
    const inRole = earners.filter((e) => e.role === role);
    if (!inRole.length) continue;
    const sum = inRole.reduce((s, e) => s + toCents(e.splitPct), 0);
    if (sum !== 10000) {
      return {
        ok: false,
        code: "split_sum",
        role,
        error: `The ${role === "sold" ? "sold-by" : "worked-by"} splits add up to ${fromCents(sum)}%, not 100%.`,
      };
    }
  }
  return { ok: true, earners };
}

/**
 * Every earner's commission on one job.
 *
 * @param p.basis     "revenue" | "gross_profit"
 * @param p.families  [{ rootId, total, amountPaid, discount, lineItems, eligible }]
 *                    — the LATEST version of each invoice family on the job.
 *                    `eligible: false` (first paid before commissions were
 *                    switched on) still counts toward the job's revenue for
 *                    the margin, and earns nobody anything.
 * @param p.cost      the job's actual gross cost (gross_profit basis only)
 * @param p.earners   [{ memberId, name, role, memberPct, splitPct, fixedAmount, excludedLines }]
 * @param p.products  Map|object productId → { commissionable, workedByPct, soldByPct }
 */
export function computeJobCommissions({ basis = "revenue", families = [], cost = 0, earners = [], products = {} } = {}) {
  const fams = (Array.isArray(families) ? families : []).map((f) => ({
    rootId: String(f?.rootId || ""),
    eligible: f?.eligible !== false,
    fraction: paidFraction(f),
    lines: familyLines(f),
  }));
  const productOf = (id) => {
    if (!id) return null;
    if (products instanceof Map) return products.get(id) || null;
    return (products && products[id]) || null;
  };

  const revenue = fams.reduce((s, f) => s + f.lines.reduce((a, l) => a + l.net, 0), 0);
  const useGp = basis === "gross_profit";
  const ratio = useGp ? grossProfitRatio({ revenue, cost }) : 1;
  const eligibleNet = fams.filter((f) => f.eligible).reduce((s, f) => s + f.lines.reduce((a, l) => a + l.net, 0), 0);

  const list = (Array.isArray(earners) ? earners : []).filter((e) => e && ROLES.includes(e.role) && e.memberId);
  const excludes = (e, key) => Array.isArray(e.excludedLines) && e.excludedLines.includes(key);

  const out = list.map((e) => {
    const fixed = e.fixedAmount === null || e.fixedAmount === undefined || e.fixedAmount === "" ? null : num(e.fixedAmount);
    const byFamily = fams.map((f) => {
      if (!f.eligible) return { rootId: f.rootId, potentialCents: 0, earnedCents: 0, eligible: false };
      let raw = 0;
      if (fixed !== null) {
        const famNet = f.lines.reduce((a, l) => a + l.net, 0);
        raw = eligibleNet > 0 ? fixed * (famNet / eligibleNet) : 0;
      } else {
        for (const line of f.lines) {
          if (excludes(e, line.key)) continue;
          const denom = list
            .filter((o) => o.role === e.role && !excludes(o, line.key))
            .reduce((s, o) => s + Math.max(num(o.splitPct), 0), 0);
          if (denom <= 0) continue;
          const share = Math.max(num(e.splitPct), 0) / denom;
          const { pct } = rateFor({ role: e.role, memberPct: e.memberPct, product: productOf(line.productId) });
          raw += line.net * ratio * (pct / 100) * share;
        }
      }
      const potential = Math.max(raw, 0);
      return {
        rootId: f.rootId,
        potentialCents: toCents(potential),
        earnedCents: toCents(potential * f.fraction),
        eligible: true,
      };
    });
    return {
      memberId: e.memberId,
      name: e.name || null,
      role: e.role,
      memberPct: pctOrNull(e.memberPct),
      splitPct: round2(e.splitPct),
      fixedAmount: fixed === null ? null : round2(fixed),
      excludedLines: Array.isArray(e.excludedLines) ? e.excludedLines : [],
      potentialCents: byFamily.reduce((s, b) => s + b.potentialCents, 0),
      earnedCents: byFamily.reduce((s, b) => s + b.earnedCents, 0),
      byFamily,
    };
  });

  // The job's lines, one row per key, for the card's "who earns on what".
  const lineRows = new Map();
  for (const f of fams) {
    for (const l of f.lines) {
      const cur = lineRows.get(l.key) || { key: l.key, description: l.description, productId: l.productId, net: 0 };
      cur.net += l.net;
      lineRows.set(l.key, cur);
    }
  }
  const lines = [...lineRows.values()].map((l) => {
    const product = productOf(l.productId);
    return {
      ...l,
      net: round2(l.net),
      commissionable: product ? product.commissionable !== false : true,
      itemWorkedPct: product ? pctOrNull(product.workedByPct) : null,
      itemSoldPct: product ? pctOrNull(product.soldByPct) : null,
    };
  });

  return {
    basis: useGp ? "gross_profit" : "revenue",
    revenue: round2(revenue),
    cost: useGp ? round2(cost) : null,
    grossProfitRatio: useGp ? Math.round(ratio * 10000) / 10000 : null,
    families: fams.map((f) => ({ rootId: f.rootId, eligible: f.eligible, paidFraction: Math.round(f.fraction * 10000) / 10000 })),
    lines,
    earners: out,
    potentialCents: out.reduce((s, e) => s + e.potentialCents, 0),
    earnedCents: out.reduce((s, e) => s + e.earnedCents, 0),
  };
}

/**
 * The default earner list for a job nobody has edited: everyone found in each
 * role who is ON commission for it (a non-null rate), split evenly.
 *
 * @param p.worked  [{ memberId, name, workedByPct }] — approved time or a completed visit
 * @param p.sold    [{ memberId, name, soldByPct }] — the quote's salesperson
 */
export function defaultEarners({ worked = [], sold = [] } = {}) {
  const pick = (rows, field) => {
    const seen = new Set();
    return (Array.isArray(rows) ? rows : []).filter((r) => {
      if (!r?.memberId || seen.has(r.memberId) || pctOrNull(r[field]) === null) return false;
      seen.add(r.memberId);
      return true;
    });
  };
  const w = pick(worked, "workedByPct");
  const s = pick(sold, "soldByPct");
  const ws = evenSplits(w.length);
  const ss = evenSplits(s.length);
  return [
    ...w.map((r, i) => ({ memberId: r.memberId, role: "worked", splitPct: ws[i], fixedAmount: null, excludedLines: [] })),
    ...s.map((r, i) => ({ memberId: r.memberId, role: "sold", splitPct: ss[i], fixedAmount: null, excludedLines: [] })),
  ];
}

/**
 * What the ledger must write to move from what it holds to what is earned now.
 *
 * @param current  Map `${rootId}|${memberId}|${role}` → { totalCents, seq }
 * @param target   Map same key → earnedCents
 * @returns [{ key, rootId, memberId, role, deltaCents, totalCents, seq }] —
 *          only non-zero changes. A key the ledger holds and the computation no
 *          longer produces (someone taken off the job) goes to zero, so their
 *          earnings are reversed rather than silently kept.
 */
export function ledgerDeltas(current, target) {
  const keys = new Set([...(current?.keys?.() || []), ...(target?.keys?.() || [])]);
  const out = [];
  for (const key of keys) {
    const have = current.get(key) || { totalCents: 0, seq: 0 };
    const want = target.has(key) ? Math.round(num(target.get(key))) : 0;
    const delta = want - Math.round(num(have.totalCents));
    if (delta === 0) continue;
    const [rootId, memberId, role] = key.split("|");
    out.push({ key, rootId, memberId, role, deltaCents: delta, totalCents: want, seq: (have.seq || 0) + 1 });
  }
  return out;
}
