// lib/invoices/documentGroups.js
//
// Give an invoice's flat line items their scope groups back.
//
// ── The shape mismatch this bridges ────────────────────────────────────────
//
// A quote is built as scope groups: one per trade, each with its own line
// items, its own subtotal, and its own "what's included" and "what could change
// this price". An invoice is a flat `lineItems` array — Invoice has no
// scopeGroups relation and should not grow one, because an invoice is a
// statement of what was billed, not a re-run of the estimate.
//
// createInvoiceFromQuote already preserves the grouping, just not as structure:
// it writes each description as `"<group label>: <item description>"`. So the
// information is there and every screen since has thrown it away. The invoice
// PDF says as much in its own comment — it wraps the whole flat list in one
// card labelled "Work completed" because "invoices genuinely are one flat list".
// They are one flat list because nothing ever put them back together.
//
// ── Why prefixes are matched, never split ──────────────────────────────────
//
// The tempting version is `description.split(": ")`, and it is wrong: "Supply
// and fit: 3 drawers, soft close" would become a group called "Supply and fit"
// that no trade content matches and that the client never saw on their quote.
// This only strips a prefix that EXACTLY equals one of the quote's own scope
// group labels. Anything else is left whole and lands in the ungrouped bucket,
// which the page renders without a heading rather than under an invented one.
//
// An invoice raised by hand, or one whose descriptions were edited, therefore
// produces a single ungrouped list — the same document the PDF renders today,
// which is the honest answer for an invoice that has no trade structure behind
// it.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param {Array}  lineItems  Invoice.lineItems — [{ description, quantity, amount, ... }]
 * @param {Array}  scopeGroups the ORIGINATING quote's groups, or [] when there
 *                 is no quote: [{ id, label, categoryKey, sortOrder }]
 * @returns {{key, label, categoryKey, lineItems, subtotal, matched}[]}
 *   `matched` is false for the ungrouped bucket, so the caller can tell "this
 *   is the painting work" from "these are the lines we couldn't place".
 */
export function groupInvoiceLineItems(lineItems, scopeGroups = []) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  if (items.length === 0) return [];

  // Longest label first. Two groups called "Painting" and "Painting — exterior"
  // would otherwise let the shorter one claim the longer one's lines, because
  // "Painting — exterior: Soffits" does start with "Painting".
  const labels = (Array.isArray(scopeGroups) ? scopeGroups : [])
    .filter((g) => g && typeof g.label === "string" && g.label.trim())
    .map((g) => ({
      id: g.id,
      label: g.label.trim(),
      categoryKey: g.categoryKey || null,
      sortOrder: num(g.sortOrder),
    }))
    .sort((a, b) => b.label.length - a.label.length);

  const buckets = new Map();
  const ungrouped = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const description = String(item.description ?? "");
    const hit = labels.find((g) => description.startsWith(`${g.label}: `));
    if (!hit) {
      ungrouped.push(item);
      continue;
    }
    if (!buckets.has(hit.id))
      buckets.set(hit.id, { ...hit, lineItems: [], subtotal: 0 });
    const bucket = buckets.get(hit.id);
    bucket.lineItems.push({
      ...item,
      // The label is the heading now; repeating it on every row underneath is
      // the noise the grouping exists to remove.
      description: description.slice(hit.label.length + 2),
    });
    bucket.subtotal += num(item.amount);
  }

  const groups = [...buckets.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => ({
      key: g.id,
      label: g.label,
      categoryKey: g.categoryKey,
      lineItems: g.lineItems,
      subtotal: Math.round(g.subtotal * 100) / 100,
      matched: true,
    }));

  if (ungrouped.length > 0) {
    groups.push({
      key: "__ungrouped",
      label: null,
      categoryKey: null,
      lineItems: ungrouped,
      subtotal:
        Math.round(ungrouped.reduce((s, i) => s + num(i.amount), 0) * 100) / 100,
      matched: false,
    });
  }

  return groups;
}
