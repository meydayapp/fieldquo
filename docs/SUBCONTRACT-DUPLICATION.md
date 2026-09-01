# Subcontracted work showing twice on Q-2026-0014

**Report:** "Small Painting Company Inc" issued quote Q-2026-0002. "Big Painter
Inc" imported it into their own quote Q-2026-0014. On that quote:

```
Subcontracted work    $9,871.68
Subcontracted work    $9,871.68
```

reported total: **$18,132.68**.

## Which of (a)/(b)/(c) it was

**(a) — a display bug. The total was right; the screen was wrong.**

$9,871.68 × 2 = $19,743.36, which is *more* than the reported total of
$18,132.68 — the first sign the total was never double-counting the line. A
reconstructed fixture with the exact reported cost ($9,871.68) plus one other
scope group of $8,261.00 (the only invented number here — the report only gave
the total) lands on $18,132.68 **exactly**, to the cent
(`scripts/check-quote-builder.mjs`, section 9a). That is one subcontracted
line, once, plus the rest of Big Painter's own quote — not two.

## The actual cause

`recomputeQuoteTotals` (`lib/quotes/importQuote.js`) sums `QuoteScopeGroup.subtotal`
once per group. There is exactly one `QuoteScopeGroup` per import — confirmed
by executing `performImport`, a second `performImport` on the same
(source, target) pair, an editor save that round-trips the group through
`reconcileScopeGroups`, and a markup re-scale through `updateImportMarkup` (all
in `check-quote-builder.mjs`, section 9). None of them ever produced a second
row. The money was never doubled anywhere in the data layer.

The duplicate was in **rendering**. `buildGroupLines`'s default ("blended")
path creates a scope group whose:

- **label** (the card header, shown with the group's subtotal) defaults to
  `"Subcontracted work"` (`performImport`'s `tradeLabel` fallback), and
- **line item description** (shown with the item's own amount, directly below
  the header) is hardcoded to the literal string `"Subcontracted work"`
  (`buildGroupLines`, blended branch) — independent of `tradeLabel`, even when
  a custom label was supplied.

With no custom label, both strings are identical, and so are both amounts
(the header carries `group.subtotal`, the one line item carries the same
number as `amount`). Every surface that draws a scope group — the app quote
page, the PDF, the covering email, the public `/q/[token]` approval page, and
the builder's read-only view of a locked import — draws a card head
(label + subtotal) and then each line item (description + amount)
underneath. For this one group shape, that is genuinely:

```
Subcontracted work    $9,871.68   ← the card head
Subcontracted work    $9,871.68   ← the group's one line item
```

Two rows, same text, same number, adjacent — which reads exactly like two
line items, on **every** surface, including the client-facing PDF, email and
approval page a homeowner or the GC's own client could have already received.
It was not confined to a staff-only screen.

## What was ruled out, and how

Everything below was executed, not just read, against `scripts/check-quote-builder.mjs`
section 9 (`npm run check:quote-builder`):

- **A second `QuoteImport` row for the same (source, target) pair.**
  `@@unique([targetQuoteId, sourceQuoteId])` already exists on `QuoteImport`
  (`prisma/schema.prisma`). A second `performImport` call against the same
  pair throws (mapped to a 409 `ImportError`), and — because the group create
  and the `QuoteImport` create happen inside the same `$transaction` — the
  group create rolls back with it. Section 9b proves this: disabling the
  duplicate check in the test's own fake DB (simulating "no `@@unique`")
  immediately produces 3 scope groups and 2 import rows instead of 2 and 1 —
  the fixture actually depends on the constraint holding, it doesn't just
  assume it.
- **The editor dropping the imported group's `id` on save**, letting
  `reconcileScopeGroups`' create-on-no-match branch (`res.count === 0`)
  create a second group beside the first. Traced end to end — `GET
  /api/quotes/[id]` returns the group's real `id`, `groupFromStored` keeps it
  (`id: g.id`), `scopeGroupPayload` sends it back
  (`...(group?.id ? { id: group.id } : {})`) — the id survives the whole
  round trip in the normal flow (section 9c). The hypothesis was executed
  anyway with the id deliberately stripped (section 9d, simulating a stale
  tab or a future regression): `reconcileScopeGroups`'s own `deleteMany`
  prunes anything **not** in the incoming payload's id set *before* the
  create-on-no-match loop runs, so an id-less or foreign-id group **replaces**
  the row (new id, same data) rather than duplicating it — group count stays
  at 1, not 2. The real cost of that failure mode is different and worse:
  `reconcileImportsForQuote` then finds the `QuoteImport`'s `targetLineId`
  points at nothing and deletes the import row — the subcontractor cost
  silently vanishes, rather than doubles. **This is a real, separate risk**
  (see "Related risk" below), but it is not the reported bug.
- **`flattenSourceLines` reading both `scopeGroups[].lineItems` and top-level
  `lineItems`.** It is an either/or (`if (!lines.length && ...)`), and it
  only runs for `display: "itemized"` — the reported figures (one round
  number, repeated exactly) match `"blended"`, the default, which never calls
  `flattenSourceLines` at all.
- **Duplicating the whole quote / re-running the import.** No such feature
  exists in this codebase (`app/api/quotes/[id]/convert/route.js`'s
  "duplicate" mention is about lead→quote conversion, unrelated).

## The fix

`lib/quotes/scopeGroupDisplay.js` (new) exports one pure function,
`visibleLineItems(group)`, used only at render time in the four surfaces
above:

- `lib/email/quoteSections.js` — `toGroups()`, which both
  `lib/documentSections/ScopeGroupsSection.js` (PDF) and
  `scopeBreakdownHtml` (email) already share, so one change covers both.
- `app/app/quotes/[id]/page.js` — the staff quote detail page's line-item
  loop.
- `app/q/[token]/QuoteApproval.js` — the public, client-facing approval page.
- `app/components/quotes/builder/QuoteBuilder.js` — the builder's read-only
  view of a locked (imported) group.

It hides a group's line item from the rendered list only when it is a single
item whose description is textually identical to the group's own label
*and* whose amount matches the group's subtotal to the cent, with quantity 1
and no `detail` paragraph. Any of those differing keeps the item visible —
an itemized import (several real, differently-worded lines), a custom label
paired with the generic item text (they no longer read as the same claim), a
quantity above 1, a detail paragraph, or an amount that actually disagrees
with the header (a real discrepancy worth seeing, not hiding) are all left
alone. `scripts/check-quote-builder.mjs` section 9f exercises each of those
cases individually.

**Deliberately not fixed by changing what gets stored.** The obvious
alternative — have `buildGroupLines` write no line item at all for a blended
import — was tried first and rejected once traced through
`groupSubtotal` (`lib/quotes/builderPayload.js`): for a `persisted` group it
recomputes the subtotal as `sum(lineItems.map(amount))`, not from
`group.subtotal`. An empty `lineItems` array would make the very next editor
save zero out the cost it just imported — real money silently disappearing,
which is a strictly worse bug than a screen saying the same number twice.
Section 9a's last assertion and section 9e (a markup re-scale after the fix)
both confirm the stored line item is untouched and `groupSubtotal` still
reads the correct amount from it; only what a person is shown changes.

**Left deliberately alone:** `ImportedCostsPanel` (`app/app/quotes/[id]/ImportedCostsPanel.js`),
the staff-only card above the document mirror on the quote detail page, also
shows this import's label and client price. That is a distinct, intentional
management surface (inline markup editing, remove) with its own heading and
its own affordances — not the literal, word-for-word adjacent repeat this fix
addresses — so it was left as is.

## Existing production data

**No migration or cleanup script was written or run**, per the standing rule
against mutating customer data. If quote Q-2026-0014 (or any other quote with
a default-labelled blended import) is reopened today, the fix already applies
— it changes what is rendered, not what is stored, so nothing needs to be
backfilled for the display to read correctly from here on. There is nothing
to repair in the data: the total was always correct (recomputed from exactly
one `QuoteScopeGroup` per import, verified above), so there is no over-charge
or under-charge to reconcile on any existing quote. The one caveat: any PDF
or email that already went out **before** this fix showing the doubled text
is a historical document and stays as it was generated — this fix changes
future renders, not past ones. If the owner wants those specific
already-sent documents corrected (e.g. a corrected PDF re-sent to a client
who saw the doubled line), that is a product decision about re-contacting a
client, not a code fix, and would need the owner's say-so on which quotes and
what to tell the client.

## What could not be verified without production data

- Whether Q-2026-0014 actually used the default label (`"Subcontracted work"`,
  no custom label) — the mechanism above only produces an exact text-and-amount
  duplicate in that case. If Big Painter Inc had typed a custom label, the
  header and the line item would show different text and the page would look
  merely redundant, not identically doubled, which is a weaker match to "the
  line appears TWICE" as reported. Reading the actual `QuoteScopeGroup.label`
  and `QuoteImport.label` for that quote would confirm this precisely; that
  requires production database access this session does not have.
- The exact composition of the rest of Q-2026-0014 (the $8,261.00 figure used
  above is invented to complete the arithmetic — the owner reported only the
  total, and it's the one number that makes 8,261.00 + 9,871.68 land on
  18,132.68 to the cent. It is illustrative, not a claim about the real other
  line items on that quote).
- Whether the reported screenshot was the staff `/app/quotes/[id]` page, the
  PDF, the email, or the public `/q/[token]` link — all four had the identical
  mechanism, so it did not change the diagnosis, but it would confirm which
  surface the owner actually saw.

## Related risk noted, not fixed

Section 9d's fixture demonstrates that a scope group can be silently
**replaced with a new id** (and its `QuoteImport` linkage silently deleted by
`reconcileImportsForQuote`) if an editor save ever sends a scope-group payload
missing the imported group's `id`, or with an id that doesn't match any row
under that quote. The current round trip (GET → `groupFromStored` →
`scopeGroupPayload` → PATCH) never drops the id in the flows this session
traced, so this was not the reported bug and nothing was changed here. It is
worth a second look if imported costs are ever reported as *missing* rather
than *duplicated* — same code path, opposite symptom.
