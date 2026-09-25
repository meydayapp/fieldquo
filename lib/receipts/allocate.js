// lib/receipts/allocate.js
//
// One receipt, booked as one expense or split across several — in integer
// cents, adding up to the paper to the cent.
//
// ══ The rule every split obeys ═════════════════════════════════════════════
//
// The rows a receipt becomes add up to the receipt's total EXACTLY. Not to
// within a cent: exactly. An accountant ticking a receipt against the books
// finds a $0.01 gap just as surely as a $100 one, and has no way to know which
// kind it is. So shares are computed by the largest-remainder method — every
// cent is handed to exactly one row — and the same for the tax inside them.
//
// ══ Two ways to split, and when each is allowed ════════════════════════════
//
//   BY LINES   "the paint to Elm St, the screws to Oak Ave". Allowed only when
//              lib/receipts/validate.js says the lines ARE the purchase (all
//              readable, adding up). Every line must go somewhere, exactly
//              once — a line left out would be money on the paper booked
//              nowhere. The total (tax included) is shared in proportion to
//              each group's lines.
//   BY AMOUNT  the person types what each part cost. Required when the lines
//              do not add up — a split computed from lines that disagree with
//              the total would present our arithmetic as the receipt's. The
//              typed amounts must add up to the total exactly.
//
// One target is neither: it takes the whole total and the whole tax.
//
// Pure — no database. scripts/check-receipt-books.mjs attacks it.

/**
 * Split `total` cents in proportion to `weights`, handing out every cent.
 * Weights must all be positive; the caller guarantees it (see allocate()).
 */
export function apportion(total, weights) {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!weights.length || !(sum > 0)) return null;
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const raw = weights.map((w) => (abs * w) / sum);
  const floors = raw.map((r) => Math.floor(r));
  let left = abs - floors.reduce((s, f) => s + f, 0);
  // Largest fractional part first; ties go to the earlier row so the result
  // is deterministic — the same receipt split the same way twice must book
  // the same cents twice.
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors.map((f) => f * sign);
}

/** A target is a job, overhead, or neither ("general"). */
export function normaliseTarget(part) {
  const kind = part?.kind === "job" || part?.kind === "overhead" ? part.kind : "general";
  return {
    kind,
    jobId: kind === "job" && typeof part?.jobId === "string" && part.jobId ? part.jobId : null,
    category: typeof part?.category === "string" && part.category.trim() ? part.category.trim().slice(0, 80) : null,
  };
}

/**
 * Turn the person's allocation into the rows to write.
 *
 * @param validation  lib/receipts/validate.js's result for this receipt
 * @param parts       [{ kind, jobId?, category?, lineIndexes?: number[], amountCents?: number }]
 * @param overrides   { totalCents?, taxCents? } — figures the PERSON corrected on
 *                    screen. The paper's figure otherwise.
 *
 * @returns {{ ok: true, rows: [{ target, amountCents, taxCents, taxBreakdown, lineIndexes }] }}
 *       or {{ ok: false, reason }}
 */
export function allocate(validation, parts, overrides = {}) {
  const list = Array.isArray(parts) ? parts : [];
  if (!list.length) return { ok: false, reason: "no_parts" };
  if (list.length > 12) return { ok: false, reason: "too_many_parts" };

  const totalCents = Number.isInteger(overrides.totalCents) ? overrides.totalCents : validation?.totalCents;
  if (!Number.isInteger(totalCents)) return { ok: false, reason: "no_total" };
  const taxCents = Number.isInteger(overrides.taxCents)
    ? overrides.taxCents
    : Number.isInteger(validation?.taxCents)
      ? validation.taxCents
      : null;
  if (taxCents !== null && Math.abs(taxCents) > Math.abs(totalCents)) return { ok: false, reason: "tax_exceeds_total" };

  const targets = list.map(normaliseTarget);
  for (const t of targets) {
    if (t.kind === "job" && !t.jobId) return { ok: false, reason: "job_missing" };
  }

  const breakdown = Array.isArray(validation?.taxBreakdown) ? validation.taxBreakdown : null;
  // A person-corrected tax invalidates the printed per-label split: the labels
  // no longer add up to the figure being booked, so they are not carried.
  const useBreakdown = breakdown && !Number.isInteger(overrides.taxCents);

  // ── One target: the whole receipt ────────────────────────────────────────
  if (list.length === 1) {
    return {
      ok: true,
      rows: [
        {
          target: targets[0],
          amountCents: totalCents,
          taxCents,
          taxBreakdown: useBreakdown ? breakdown.map((b) => ({ label: b.label, cents: b.cents })) : null,
          lineIndexes: null,
        },
      ],
    };
  }

  if (totalCents <= 0) return { ok: false, reason: "cannot_split_refund" };

  const byLines = list.every((p) => Array.isArray(p?.lineIndexes) && p.lineIndexes.length > 0);
  const byAmount = list.every((p) => Number.isInteger(p?.amountCents));

  let weights;
  let lineIndexesPer = list.map(() => null);

  if (byLines) {
    // Lines are only a basis when the paper's lines are the purchase, AND
    // the person has not typed a different total — a corrected total means
    // the lines no longer describe what was paid.
    if (!validation?.canSplitByLines) return { ok: false, reason: "lines_do_not_add_up" };
    if (Number.isInteger(overrides.totalCents) && overrides.totalCents !== validation.totalCents) {
      return { ok: false, reason: "lines_do_not_add_up" };
    }
    const lines = validation.reconciliation.lines;
    const seen = new Set();
    weights = [];
    for (const [i, part] of list.entries()) {
      let w = 0;
      const idx = [];
      for (const raw of part.lineIndexes) {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0 || n >= lines.length) return { ok: false, reason: "bad_line" };
        if (seen.has(n)) return { ok: false, reason: "line_twice" };
        seen.add(n);
        idx.push(n);
        w += lines[n].lineTotalCents;
      }
      // A group whose lines net to nothing (a discount on its own) cannot
      // carry a share of the total — there is nothing to be proportional to.
      if (!(w > 0)) return { ok: false, reason: "group_not_positive" };
      weights.push(w);
      lineIndexesPer[i] = idx.sort((a, b) => a - b);
    }
    if (seen.size !== lines.length) return { ok: false, reason: "lines_unassigned" };
  } else if (byAmount) {
    weights = list.map((p) => p.amountCents);
    if (weights.some((w) => !(w > 0))) return { ok: false, reason: "amount_not_positive" };
    const sum = weights.reduce((s, w) => s + w, 0);
    if (sum !== totalCents) return { ok: false, reason: "amounts_do_not_add_up", sumCents: sum, totalCents };
  } else {
    return { ok: false, reason: "mixed_split" };
  }

  const amounts = byAmount ? weights.slice() : apportion(totalCents, weights);
  const taxes = taxCents === null ? list.map(() => null) : apportion(taxCents, weights);
  const perLabel = useBreakdown
    ? breakdown.map((b) => ({ label: b.label, shares: apportion(b.cents, weights) }))
    : null;

  return {
    ok: true,
    rows: list.map((_, i) => ({
      target: targets[i],
      amountCents: amounts[i],
      taxCents: taxes[i],
      taxBreakdown: perLabel ? perLabel.map((p) => ({ label: p.label, cents: p.shares[i] })) : null,
      lineIndexes: lineIndexesPer[i],
    })),
  };
}
