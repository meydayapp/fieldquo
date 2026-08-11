// app/data/lineItemGroups.js
//
// Section headings for the trades whose suggestion list is long enough to need
// them. Kept out of defaultLineItems.js so that file stays what it says it is —
// the lists themselves — and so a trade can gain a list without gaining groups.
//
// Only electrical and plumbing have these. The other trades ship six to nine
// suggestions, where a heading costs more attention than it saves.

import { ELECTRICAL_LINE_ITEM_GROUPS } from "@/app/data/electricalCatalog";
import { PLUMBING_LINE_ITEM_GROUPS } from "@/app/data/plumbingCatalog";

const GROUPS = {
  electrical: ELECTRICAL_LINE_ITEM_GROUPS,
  plumbing: PLUMBING_LINE_ITEM_GROUPS,
};

/** Ordered `{key,label}` sections for a category, or an empty array. Empty is
 *  the signal to render a flat list — not an error, and not a reason to invent
 *  a single "Other" heading around everything. */
export function getLineItemGroups(categoryKey) {
  return GROUPS[categoryKey] || [];
}
