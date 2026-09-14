// lib/sales/discovery/duplicateGroup.js
//
// The rows that might be one business, side by side, and what merging them
// would fill.
//
// Split from the route so the group's SHAPE is a pure function the check can
// drive: which rows belong (the flagged row, the row it points at, every
// other row pointing at either, the survivor's already-merged rows kept
// apart), which columns line up, and where the gaps are. The route reads and
// this decides.
import { MERGE_FIELDS, MERGE_SELECT, planMerge, matchVia, mergedFromIds } from "./mergeProspects";

/** The columns the side-by-side shows, in order, with the label the column head carries. */
export const GROUP_COLUMNS = Object.freeze([
  { field: "businessName", label: "Name" },
  { field: "tradingNames", label: "Also known as" },
  { field: "websiteUrl", label: "Website" },
  { field: "phoneE164", label: "Phone" },
  { field: "email", label: "Email" },
  { field: "addressLine", label: "Street" },
  { field: "city", label: "City" },
  { field: "province", label: "Province / state" },
  { field: "postalCode", label: "Postal code" },
  { field: "tradeKey", label: "Trade" },
  { field: "sourceProvider", label: "Source" },
  { field: "licenceNumber", label: "Licence" },
  { field: "status", label: "Status" },
  { field: "claimedBy", label: "Claimed by" },
  { field: "createdAt", label: "First seen" },
]);

/** What the group route selects per row: the merge's columns plus what the table shows. */
export const GROUP_SELECT = Object.freeze({ ...MERGE_SELECT, sourceRecordId: true, doNotContactAt: true, lastCrawledAt: true });

/**
 * The ids to load around `row`: itself, the row it is flagged against, and
 * — resolved by the caller into a second read — every row flagged against
 * either. Pure; returns the anchor id the second read keys on.
 */
export function groupAnchor(row = {}) {
  return row?.possibleDuplicateOfId || row?.id || null;
}

/**
 * Assemble the group from the rows the route read.
 *
 * @param {{ focus: object, rows: object[], reps?: Array<{id:string,name:string}>, now?: Date }} args
 *   `rows` — every candidate the route read (may include `focus`, retired
 *   rows, and rows merged into focus). Retired rows that were merged INTO the
 *   focus are listed under `merged`; retired rows merged elsewhere are
 *   dropped (their survivor is the row that belongs here, and it is loaded
 *   when it is flagged).
 */
export function buildGroup({ focus, rows = [], reps = [], now = new Date() } = {}) {
  if (!focus?.id) return { rows: [], merged: [], gaps: {}, canMerge: false };
  const repName = new Map(reps.map((r) => [r.id, r.name || r.email || r.id]));
  const mergedIds = new Set(mergedFromIds(focus));
  const seen = new Set();
  const live = [];
  const merged = [];
  for (const r of [focus, ...rows]) {
    if (!r?.id || seen.has(r.id)) continue;
    seen.add(r.id);
    if (r.mergedIntoId) {
      if (mergedIds.has(r.id) || r.mergedIntoId === focus.id) merged.push(present(r, repName, now, focus));
      continue;
    }
    live.push(present(r, repName, now, focus));
  }
  // Oldest first, the order dedupe's index remembers them in; the focus row
  // keeps its place rather than jumping to the front, so two clicks on two
  // rows of one pair show the same table.
  live.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || String(a.id).localeCompare(b.id));

  // Which columns have a gap somewhere — a row with the value and a row
  // without — so the screen can highlight exactly what a merge would fill.
  const gaps = {};
  for (const col of GROUP_COLUMNS) {
    const have = live.filter((r) => !empty(r[col.field])).length;
    if (have > 0 && have < live.length) gaps[col.field] = true;
  }
  return { rows: live, merged, gaps, canMerge: live.length >= 2 };
}

function empty(v) {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

function present(r, repName, now, focus) {
  const held = r.assignedRepId && (!r.claimExpiresAt || new Date(r.claimExpiresAt) > now);
  return {
    id: r.id,
    businessName: r.businessName,
    tradingNames: r.tradingNames || [],
    websiteUrl: r.websiteUrl || null,
    phoneE164: r.phoneE164 || null,
    email: r.email || null,
    addressLine: r.addressLine || null,
    city: r.city || null,
    province: r.province || null,
    postalCode: r.postalCode || null,
    country: r.country || null,
    tradeKey: r.tradeKey || null,
    sourceProvider: r.sourceProvider || null,
    sourceRecordId: r.sourceRecordId || null,
    licenceNumber: r.licenceNumber || null,
    status: r.status || null,
    classification: r.classification || null,
    claimedBy: held ? repName.get(r.assignedRepId) || r.assignedRepId : null,
    claimedById: held ? r.assignedRepId : null,
    doNotContact: Boolean(r.doNotContactAt),
    createdAt: r.createdAt || null,
    mergedIntoId: r.mergedIntoId || null,
    mergedAt: r.mergedAt || null,
    mergedCount: mergedFromIds(r).length,
    possibleDuplicateOfId: r.possibleDuplicateOfId || null,
    isFocus: r.id === focus.id,
    via: r.id === focus.id ? null : matchVia(focus, r),
  };
}

/**
 * The preview: what keeping `survivorId` and merging the rest would fill,
 * from where. Pure — the route hands it the group's raw rows.
 */
export function previewMerge({ survivorId, otherIds, rows = [], reps = [], now = new Date() } = {}) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const survivor = byId.get(survivorId);
  const others = (otherIds || []).map((id) => byId.get(id)).filter(Boolean);
  if (!survivor) return { ok: false, error: "The kept row is not in this group." };
  if (others.length !== (otherIds || []).length) return { ok: false, error: "A row to merge is not in this group." };
  const repNames = Object.fromEntries(reps.map((r) => [r.id, r.name || r.email || r.id]));
  return planMerge({ survivor, others, now, repNames });
}

export { MERGE_FIELDS };
