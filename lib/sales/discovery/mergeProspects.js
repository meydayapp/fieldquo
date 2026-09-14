// lib/sales/discovery/mergeProspects.js
//
// Two rows, one business: fill the gaps in the one the rep holds, retire the
// other, and keep enough of a record to take it apart again.
//
// ══ The owner's ask ════════════════════════════════════════════════════════
//
// "Make sure that if we flag a duplicate we can obtain whatever information
// might have been missed in the one used by the sales rep." dedupe.js flags
// rather than merges, for a reason its header argues and this file does not
// relax: a wrong merge that collapsed two rows into one threw the second
// row's evidence away at ingest. But the flag left the rep with half a
// business. The register row has the licence and the trade; the directory
// row has the website and the phone; the rep sees whichever one they hold.
//
// ══ What a merge is here — and is not ══════════════════════════════════════
//
//   * The SURVIVOR keeps every value it has. Only its EMPTY fields are filled,
//     from the other rows in a fixed order, and every fill is written down as
//     (field, value, from which row, from which source). That list is the
//     plan, and the plan is the audit: it is what the confirm screen shows,
//     what `mergedFrom` stores, and what `unmerge` reverses.
//   * The OTHER rows are RETIRED, not deleted: `mergedIntoId` and `mergedAt`
//     are set and nothing else on them changes. Their evidence, capabilities
//     and inferences STAY ATTACHED to them — ProspectCapability and
//     ProspectInference are unique per (prospect, code), so moving them would
//     have to drop the collisions, which is the deletion this file refuses —
//     and the read path unions them in (mergedReads.js).
//   * What a REP's work hangs off moves to the survivor: contact numbers (by
//     number, so the picker never shows one twice), leads, queue claims, call
//     attempts, and a live claim itself. Two live claims by two different
//     reps is a refusal, with both names: the merge would make one of them
//     lose a row they are working, and that is a conversation, not a write.
//   * Nothing here is automatic on the fuzzy match. A same-name-same-town
//     pair stays a question (dedupe.js step 4). The ingest-time AUTOFILL —
//     the same field logic, `kind: "autofill"`, retiring nothing — runs only
//     on the two near-proof matches, same phone and same domain.
//
// ══ Pure planning, transactional apply ════════════════════════════════════
//
// planMerge() and planFills() touch no database, so scripts/check-sales-merge.mjs
// can drive them against fixtures: fills only empty fields, in a deterministic
// order, refuses two claimants. applyMerge() and unmerge() take a client and
// do everything in ONE transaction, so a refusal halfway leaves nothing half
// merged.
import { Prisma } from "@prisma/client";
import { normaliseDomain, normalisePhone } from "@/lib/sales/suppressionRules";
import { fuzzyKey, cityKey } from "./dedupe";
import { mergeRetireEffects, fillEffects, counterUpdates } from "./reviewFolder";

export const MERGE_VERSION = "1";

/**
 * The scalar facts a merge may fill, in the order the confirm screen lists
 * them. Every one is nullable on Prospect; a fill only ever writes into a
 * null.
 *
 * NOT here, on purpose:
 *   googlePlaceId  — @unique; the retired row keeps it and the survivor
 *                    cannot hold the same value. Read through the merged ids.
 *   sourceProvider / sourceRecordId / sourceRelease / licenceNumber — the
 *                    survivor's provenance is its own; the other row's stays
 *                    on the other row, which is why the row is kept.
 *   status / classification / suggested* / the retry pool — decisions and
 *                    state about THIS row, not facts about the business.
 */
export const MERGE_FIELDS = Object.freeze([
  "websiteUrl",
  "domain",
  "hasWebsite",
  "phoneE164",
  "email",
  "emailSource",
  "addressLine",
  "city",
  "province",
  "postalCode",
  "country",
  "latitude",
  "longitude",
  "tradeKey",
  "businessStatus",
  "googleRating",
  "googleReviewCount",
  "sourceUpdatedAt",
  "doNotContactAt",
  "doNotContactReason",
]);

/**
 * Fields that travel together. A survivor with no website takes the OTHER
 * row's websiteUrl AND its domain AND its hasWebsite from the SAME row —
 * a domain from row B under a URL from row A is a record nobody observed.
 * Likewise an address: a street line from one town glued to another town's
 * postcode is worse than no street line.
 */
const GROUPS = Object.freeze({
  website: ["websiteUrl", "domain", "hasWebsite"],
  email: ["email", "emailSource"],
  street: ["addressLine", "postalCode", "latitude", "longitude"],
  dnc: ["doNotContactAt", "doNotContactReason"],
});
const GROUP_OF = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, fs]) => fs.map((f) => [f, g])));
/** The group's LEAD field: the group fills only when the survivor lacks this one. */
const GROUP_LEAD = Object.freeze({ website: "websiteUrl", email: "email", street: "addressLine", dnc: "doNotContactAt" });

const isEmpty = (v) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** The columns planMerge reads. One list, so every caller selects it. */
export const MERGE_SELECT = Object.freeze({
  id: true,
  businessName: true,
  rawName: true,
  tradingNames: true,
  sourceProvider: true,
  sourceRecordId: true,
  licenceNumber: true,
  campaignId: true,
  status: true,
  classification: true,
  possibleDuplicateOfId: true,
  mergedIntoId: true,
  mergedFrom: true,
  assignedRepId: true,
  assignedAt: true,
  claimExpiresAt: true,
  createdAt: true,
  ...Object.fromEntries(MERGE_FIELDS.map((f) => [f, true])),
});

/**
 * Why `other` is believed to be the same business as `survivor`, strongest
 * first — the order the fills are taken in. dedupe.js's order, minus the
 * source-record step (two rows never share one).
 */
export function matchVia(survivor = {}, other = {}) {
  const sp = normalisePhone(survivor.phoneE164);
  if (sp && sp === normalisePhone(other.phoneE164)) return "phone";
  const sd = normaliseDomain(survivor.domain || survivor.websiteUrl);
  if (sd && sd === normaliseDomain(other.domain || other.websiteUrl)) return "domain";
  const sf = fuzzyKey(survivor);
  if (sf && sf === fuzzyKey(other)) return "name";
  if (other.possibleDuplicateOfId === survivor.id || survivor.possibleDuplicateOfId === other.id) return "flagged";
  return "none";
}

const VIA_RANK = { phone: 0, domain: 1, name: 2, flagged: 3, none: 4 };

/** `others` in the order fills are taken: strongest match first, then oldest, then id. */
export function orderOthers(survivor, others = []) {
  return [...others]
    .map((o) => ({ row: o, via: matchVia(survivor, o) }))
    .sort((a, b) => {
      const r = VIA_RANK[a.via] - VIA_RANK[b.via];
      if (r) return r;
      const ta = new Date(a.row.createdAt || 0).getTime();
      const tb = new Date(b.row.createdAt || 0).getTime();
      if (ta !== tb) return ta - tb;
      return String(a.row.id).localeCompare(String(b.row.id));
    });
}

/**
 * The fills: for each empty field on `survivor`, the first non-empty value
 * across `others` in `orderOthers` order. Pure.
 *
 * Grouped fields (website, email, street, do-not-contact) fill from ONE row,
 * chosen by the group's lead field. Street fields fill only from a row in the
 * same town as the survivor, or from any row when the survivor names none.
 *
 * @returns {{ fills: Array<{field:string, value:any, from:string, source:string|null}>,
 *             tradingNames: string[]|null }}
 *   `tradingNames` is the survivor's list plus every name the others traded
 *   under — including their own business names when those differ — or null
 *   when nothing is added. A rep searching the retired row's name has to
 *   find the survivor.
 */
export function planFills(survivor = {}, others = []) {
  const ordered = orderOthers(survivor, others);
  const fills = [];
  const filledGroups = new Map();

  for (const field of MERGE_FIELDS) {
    if (!isEmpty(survivor[field])) continue;
    const group = GROUP_OF[field] || null;
    // A grouped field takes its value from the row that supplied the lead.
    if (group) {
      const lead = GROUP_LEAD[group];
      if (isEmpty(survivor[lead])) {
        if (!filledGroups.has(group)) {
          const donor = ordered.find(({ row }) => !isEmpty(row[lead]) && groupAllowed(group, survivor, row));
          filledGroups.set(group, donor || null);
        }
        const donor = filledGroups.get(group);
        if (donor && !isEmpty(donor.row[field])) {
          fills.push({ field, value: donor.row[field], from: donor.row.id, source: donor.row.sourceProvider || null, via: donor.via });
        }
        continue;
      }
      // The survivor has the lead (a website, say) but not this member (its
      // domain). Filling the member from another row would pair it with a
      // lead it did not come from. Leave the gap; it is the survivor's to
      // answer.
      continue;
    }
    const donor = ordered.find(({ row }) => !isEmpty(row[field]));
    if (donor) {
      fills.push({ field, value: donor.row[field], from: donor.row.id, source: donor.row.sourceProvider || null, via: donor.via });
    }
  }

  const known = new Set((survivor.tradingNames || []).map((n) => String(n).trim()).filter(Boolean));
  const ownName = String(survivor.businessName || "").trim().toLowerCase();
  const added = [];
  for (const { row } of ordered) {
    for (const name of [row.businessName, ...(row.tradingNames || [])]) {
      const n = String(name || "").trim();
      if (!n || n.toLowerCase() === ownName) continue;
      if ([...known].some((k) => k.toLowerCase() === n.toLowerCase())) continue;
      known.add(n);
      added.push(n);
    }
  }
  return { fills, tradingNames: added.length ? [...(survivor.tradingNames || []), ...added] : null };
}

function groupAllowed(group, survivor, row) {
  if (group !== "street") return true;
  const sc = cityKey(survivor.city);
  if (!sc) return true;
  return sc === cityKey(row.city);
}

/** A claim that is live now: held, and not lapsed. */
function liveClaim(row, now) {
  if (!row?.assignedRepId) return null;
  if (row.claimExpiresAt && new Date(row.claimExpiresAt) <= now) return null;
  return { repId: row.assignedRepId, assignedAt: row.assignedAt || null, claimExpiresAt: row.claimExpiresAt || null };
}

/**
 * The whole plan for one merge. Pure.
 *
 * @param {{ survivor: object, others: object[], now?: Date, repNames?: Record<string,string> }} args
 * @returns {{ ok:true, plan:object } | { ok:false, error:string }}
 */
export function planMerge({ survivor, others = [], now = new Date(), repNames = {} } = {}) {
  if (!survivor?.id) return { ok: false, error: "Which row survives?" };
  if (survivor.mergedIntoId) return { ok: false, error: "The kept row was itself merged into another; unmerge that first." };
  const list = (Array.isArray(others) ? others : []).filter(Boolean);
  if (!list.length) return { ok: false, error: "Nothing to merge into it." };
  const ids = new Set();
  for (const o of list) {
    if (!o?.id) return { ok: false, error: "A row to merge has no id." };
    if (o.id === survivor.id) return { ok: false, error: "A row cannot be merged into itself." };
    if (ids.has(o.id)) return { ok: false, error: `${o.id} is listed twice.` };
    ids.add(o.id);
    if (o.mergedIntoId) return { ok: false, error: `${o.businessName || o.id} was already merged into another row.` };
  }

  // ── Two reps, one business: refuse, and say who ────────────────────────
  const claims = [survivor, ...list].map((r) => ({ id: r.id, name: r.businessName, claim: liveClaim(r, now) })).filter((c) => c.claim);
  const reps = [...new Set(claims.map((c) => c.claim.repId))];
  if (reps.length > 1) {
    const who = claims.map((c) => `${repNames[c.claim.repId] || c.claim.repId} holds ${c.name || c.id}`).join("; ");
    return { ok: false, error: `Two reps hold these rows right now — ${who}. Have one release theirs first.` };
  }

  const { fills, tradingNames } = planFills(survivor, list);
  const ordered = orderOthers(survivor, list);
  const survivorCounters = survivorFillCounters(survivor, fills);

  // A live claim on a retired row moves to the survivor when the survivor has
  // none. Same rep on both, or only the survivor claimed: nothing to move.
  const survivorClaim = liveClaim(survivor, now);
  const donorClaim = !survivorClaim ? ordered.map(({ row }) => ({ row, claim: liveClaim(row, now) })).find((c) => c.claim) : null;
  const claimMove = donorClaim ? { from: donorClaim.row.id, ...donorClaim.claim } : null;

  // The survivor's own flag, when it points at a row being retired, has been
  // acted on. A flag at a THIRD row stays.
  const clearFlag = Boolean(survivor.possibleDuplicateOfId && ids.has(survivor.possibleDuplicateOfId));

  // Campaign counters: each retired row leaves its funnel bucket and lands in
  // "duplicates" — reviewFolder.js's table decides the delta from the row as
  // read, and the same table gives the reverse on unmerge.
  const counters = ordered.map(({ row }) => ({ prospectId: row.id, campaignId: row.campaignId || null, ...mergeRetireEffects(row) }));

  return {
    ok: true,
    plan: {
      version: MERGE_VERSION,
      kind: "merge",
      survivorId: survivor.id,
      retired: ordered.map(({ row, via }) => ({ id: row.id, businessName: row.businessName || null, source: row.sourceProvider || null, via })),
      fills,
      tradingNames,
      previousTradingNames: tradingNames ? [...(survivor.tradingNames || [])] : null,
      claimMove,
      clearFlag: clearFlag ? survivor.possibleDuplicateOfId : null,
      counters,
      survivorCounters,
      // Filled in by applyMerge: which child rows moved.
      moved: null,
    },
  };
}

/**
 * The survivor's OWN funnel move, from the fills: a banked row that gains a
 * trade is accepted, an accepted row that gains a phone becomes call-ready.
 * reviewFolder.js's table decides; this only builds the "after".
 */
export function survivorFillCounters(survivor = {}, fills = []) {
  if (!survivor?.campaignId || !fills.length) return null;
  const after = { ...survivor };
  for (const f of fills) after[f.field] = f.value;
  const counters = fillEffects(survivor, after);
  return Object.keys(counters).length ? { campaignId: survivor.campaignId, counters } : null;
}

// ── Apply ─────────────────────────────────────────────────────────────────

/**
 * Write the fills onto the survivor, each guarded on the field STILL being
 * empty, and append `entry` to its `mergedFrom`. Shared by the merge and by
 * ingest's autofill, so both write the same shape.
 *
 * Per-field `updateMany … WHERE field IS NULL` rather than one update: the
 * plan was computed from a read a moment ago, and two ingest ticks flagging
 * the same survivor must not have the second overwrite what the first filled.
 * A fill the guard refuses is reported as `skipped`, not written.
 */
export async function applyFills(tx, { survivorId, survivor = null, fills = [], tradingNames = null, entry }) {
  const written = [];
  const skipped = [];
  for (const fill of fills) {
    const r = await tx.prospect.updateMany({
      where: { id: survivorId, [fill.field]: null },
      data: { [fill.field]: fill.value },
    });
    (r.count === 1 ? written : skipped).push(fill);
  }
  if (tradingNames) {
    await tx.prospect.update({ where: { id: survivorId }, data: { tradingNames } });
  }
  // The survivor's funnel move, from what was ACTUALLY written — a fill the
  // guard refused moved nothing.
  const survivorCounters = survivor ? survivorFillCounters(survivor, written) : null;
  if (survivorCounters) {
    await tx.prospectCampaign.update({ where: { id: survivorCounters.campaignId }, data: counterUpdates(survivorCounters.counters) });
  }
  const record = { ...entry, fills: written, skippedFills: skipped.length ? skipped : undefined, tradingNames, survivorCounters };
  // jsonb append in the database rather than read-modify-write here: the
  // same two-ticks race, and an audit list that could lose an entry is not
  // an audit.
  await tx.$executeRaw(
    Prisma.sql`UPDATE "Prospect" SET "mergedFrom" = COALESCE("mergedFrom", '[]'::jsonb) || ${JSON.stringify([record])}::jsonb WHERE "id" = ${survivorId}`,
  );
  return { written, skipped };
}

/**
 * The merge, in one transaction.
 *
 * @param {{ db:object, plan:object, adminId:string, now?:Date }} args
 * @returns {Promise<{ ok:true, plan:object } | { ok:false, status:number, error:string }>}
 */
export async function applyMerge({ db, plan, adminId, now = new Date() } = {}) {
  if (!db) throw new Error("applyMerge: db is required");
  if (!plan?.survivorId || !Array.isArray(plan.retired) || !plan.retired.length) {
    return { ok: false, status: 400, error: "That is not a merge plan." };
  }
  const retiredIds = plan.retired.map((r) => r.id);
  let refused = null;
  let moved = null;

  await db.$transaction(async (tx) => {
    // Re-read the rows AT the write. The plan came from a read a screen ago;
    // a rep may have claimed one since, or another admin merged it.
    const rows = await tx.prospect.findMany({
      where: { id: { in: [plan.survivorId, ...retiredIds] } },
      select: MERGE_SELECT,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const survivor = byId.get(plan.survivorId);
    const others = retiredIds.map((id) => byId.get(id)).filter(Boolean);
    if (!survivor || others.length !== retiredIds.length) {
      refused = { status: 404, error: "One of these rows no longer exists." };
      throw new Error("refused");
    }
    const fresh = planMerge({ survivor, others, now });
    if (!fresh.ok) {
      refused = { status: 409, error: fresh.error };
      throw new Error("refused");
    }
    const live = fresh.plan;

    // ── 1. Retire the others. Guarded on not-already-retired. ─────────────
    const retired = await tx.prospect.updateMany({
      where: { id: { in: retiredIds }, mergedIntoId: null },
      data: { mergedIntoId: survivor.id, mergedAt: now },
    });
    if (retired.count !== retiredIds.length) {
      refused = { status: 409, error: "Somebody merged one of these rows since you loaded it. Reload." };
      throw new Error("refused");
    }

    // ── 2. Re-parent what a rep's work hangs off ──────────────────────────
    //
    // Contact numbers by NUMBER: one the survivor already holds stays on
    // the retired row (the unique on (prospectId, e164) would refuse it, and
    // the picker must not show a number twice). Leads, claims and attempts
    // move whole; ids are recorded so unmerge can put each back.
    const survivorNumbers = await tx.salesContactNumber.findMany({ where: { prospectId: survivor.id }, select: { e164: true } });
    const held = new Set(survivorNumbers.map((n) => n.e164));
    const otherNumbers = await tx.salesContactNumber.findMany({
      where: { prospectId: { in: retiredIds } },
      select: { id: true, e164: true, prospectId: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const movedNumbers = [];
    for (const n of otherNumbers) {
      if (held.has(n.e164)) continue;
      await tx.salesContactNumber.update({ where: { id: n.id }, data: { prospectId: survivor.id } });
      held.add(n.e164);
      movedNumbers.push({ id: n.id, from: n.prospectId });
    }

    const moveIds = async (model) => {
      const rowsToMove = await tx[model].findMany({ where: { prospectId: { in: retiredIds } }, select: { id: true, prospectId: true } });
      if (rowsToMove.length) {
        await tx[model].updateMany({ where: { id: { in: rowsToMove.map((r) => r.id) } }, data: { prospectId: survivor.id } });
      }
      return rowsToMove.map((r) => ({ id: r.id, from: r.prospectId }));
    };
    const movedLeads = await moveIds("salesLead");
    const movedClaims = await moveIds("salesQueueClaim");
    const movedAttempts = await moveIds("salesCallAttempt");

    // ── 3. The live claim, when only a retired row held one ───────────────
    if (live.claimMove) {
      await tx.prospect.updateMany({
        where: { id: survivor.id, assignedRepId: null },
        data: { assignedRepId: live.claimMove.repId, assignedAt: live.claimMove.assignedAt, claimExpiresAt: live.claimMove.claimExpiresAt },
      });
    }

    // ── 4. Flags: the survivor's own, and any third row's pointing at a retired one ─
    const repointed = await tx.prospect.findMany({
      where: { possibleDuplicateOfId: { in: retiredIds }, id: { notIn: [survivor.id, ...retiredIds] } },
      select: { id: true, possibleDuplicateOfId: true },
    });
    if (repointed.length) {
      await tx.prospect.updateMany({ where: { id: { in: repointed.map((r) => r.id) } }, data: { possibleDuplicateOfId: survivor.id } });
    }
    if (live.clearFlag) {
      await tx.prospect.updateMany({ where: { id: survivor.id, possibleDuplicateOfId: live.clearFlag }, data: { possibleDuplicateOfId: null } });
    }

    // ── 5. The campaign funnels ───────────────────────────────────────────
    for (const c of live.counters) {
      const data = counterUpdates(c.counters);
      if (c.campaignId && Object.keys(data).length) {
        await tx.prospectCampaign.update({ where: { id: c.campaignId }, data });
      }
    }

    // ── 6. The fills, and the record of all of the above ──────────────────
    moved = {
      contactNumbers: movedNumbers,
      leads: movedLeads,
      queueClaims: movedClaims,
      callAttempts: movedAttempts,
      repointed: repointed.map((r) => ({ id: r.id, was: r.possibleDuplicateOfId })),
    };
    const entry = {
      version: MERGE_VERSION,
      kind: "merge",
      at: now.toISOString(),
      by: adminId || null,
      retired: live.retired,
      claimMove: live.claimMove,
      clearFlag: live.clearFlag,
      counters: live.counters,
      previousTradingNames: live.previousTradingNames,
      moved,
    };
    const { written, skipped } = await applyFills(tx, { survivorId: survivor.id, survivor, fills: live.fills, tradingNames: live.tradingNames, entry });
    moved.fills = written;
    moved.skippedFills = skipped;

    await tx.platformAuditLog.create({
      data: {
        platformAdminId: adminId,
        action: "sales_prospects_merged",
        details: {
          surface: "duplicate_group",
          survivorId: survivor.id,
          businessName: survivor.businessName,
          retiredIds,
          filled: written.map((f) => f.field),
          moved: { contactNumbers: movedNumbers.length, leads: movedLeads.length, queueClaims: movedClaims.length, callAttempts: movedAttempts.length },
        },
      },
    });
  }).catch((err) => {
    if (!refused) throw err;
  });

  if (refused) return { ok: false, ...refused };
  return { ok: true, plan: { ...plan, moved } };
}

/**
 * Take every merge on `survivorId` apart, newest first.
 *
 * Clears ONLY the fields the plans filled, and only where the survivor still
 * carries the filled value — a value a human changed since is theirs, and
 * is reported as kept rather than clobbered. Moves the re-parented rows back
 * to the row each came from. Reactivates the retired rows. Reverses the
 * campaign counters. Keeps the `autofill` entries: those retired nothing.
 *
 * @returns {Promise<{ ok:true, reactivated:string[], cleared:string[], kept:string[] }
 *                  | { ok:false, status:number, error:string }>}
 */
export async function unmerge({ db, survivorId, adminId, now = new Date() } = {}) {
  if (!db) throw new Error("unmerge: db is required");
  const id = String(survivorId ?? "").trim();
  if (!id) return { ok: false, status: 400, error: "Which row?" };
  let refused = null;
  const result = { reactivated: [], cleared: [], kept: [], movedBack: 0 };

  await db.$transaction(async (tx) => {
    const survivor = await tx.prospect.findUnique({ where: { id }, select: MERGE_SELECT });
    if (!survivor) {
      refused = { status: 404, error: "No such prospect." };
      throw new Error("refused");
    }
    const entries = Array.isArray(survivor.mergedFrom) ? survivor.mergedFrom : [];
    const merges = entries.filter((e) => e?.kind === "merge");
    if (!merges.length) {
      refused = { status: 400, error: "Nothing was merged into this row." };
      throw new Error("refused");
    }

    const before = { ...survivor };
    for (const entry of [...merges].reverse()) {
      const retiredIds = (entry.retired || []).map((r) => r.id);
      const moved = entry.moved || {};

      // Fields: back to empty, where the filled value still stands.
      for (const fill of entry.fills || []) {
        const current = survivor[fill.field];
        if (sameValue(current, fill.value)) {
          await tx.prospect.update({ where: { id }, data: { [fill.field]: null } });
          survivor[fill.field] = null;
          result.cleared.push(fill.field);
        } else {
          result.kept.push(fill.field);
        }
      }
      if (entry.tradingNames && entry.previousTradingNames) {
        await tx.prospect.update({ where: { id }, data: { tradingNames: entry.previousTradingNames } });
      }
      if (entry.claimMove) {
        // Only if the survivor still holds THAT rep's claim; a claim taken
        // since by somebody else is not the one that was moved.
        await tx.prospect.updateMany({
          where: { id, assignedRepId: entry.claimMove.repId },
          data: { assignedRepId: null, assignedAt: null, claimExpiresAt: null },
        });
      }
      if (entry.clearFlag) {
        await tx.prospect.updateMany({ where: { id, possibleDuplicateOfId: null }, data: { possibleDuplicateOfId: entry.clearFlag } });
      }

      const backBy = async (model, list) => {
        for (const m of list || []) {
          await tx[model].updateMany({ where: { id: m.id, prospectId: id }, data: { prospectId: m.from } });
          result.movedBack++;
        }
      };
      await backBy("salesContactNumber", moved.contactNumbers);
      await backBy("salesLead", moved.leads);
      await backBy("salesQueueClaim", moved.queueClaims);
      await backBy("salesCallAttempt", moved.callAttempts);
      for (const r of moved.repointed || []) {
        await tx.prospect.updateMany({ where: { id: r.id, possibleDuplicateOfId: id }, data: { possibleDuplicateOfId: r.was } });
      }

      for (const c of entry.counters || []) {
        const reversed = Object.fromEntries(Object.entries(c.counters || {}).map(([k, v]) => [k, -v]));
        const data = counterUpdates(reversed);
        if (c.campaignId && Object.keys(data).length) {
          await tx.prospectCampaign.update({ where: { id: c.campaignId }, data });
        }
      }

      const back = await tx.prospect.updateMany({
        where: { id: { in: retiredIds }, mergedIntoId: id },
        data: { mergedIntoId: null, mergedAt: null },
      });
      result.reactivated.push(...retiredIds.slice(0, back.count));
    }

    // The survivor's own funnel move, reversed from what was ACTUALLY
    // cleared — a kept field keeps its counter — through the same table
    // that moved it.
    if (survivor.campaignId) {
      const data = counterUpdates(fillEffects(before, survivor));
      if (Object.keys(data).length) await tx.prospectCampaign.update({ where: { id: survivor.campaignId }, data });
    }

    // The autofill entries stay; the merge entries are done with. Replace the
    // list rather than append a "reversed" marker: a survivor whose list
    // still said "merged" would be shown a panel for a merge that no longer
    // exists.
    const remaining = entries.filter((e) => e?.kind !== "merge");
    await tx.prospect.update({ where: { id }, data: { mergedFrom: remaining.length ? remaining : Prisma.DbNull } });

    await tx.platformAuditLog.create({
      data: {
        platformAdminId: adminId,
        action: "sales_prospects_unmerged",
        details: { surface: "duplicate_group", survivorId: id, businessName: survivor.businessName, reactivated: result.reactivated, cleared: result.cleared, kept: result.kept },
      },
    });
  }).catch((err) => {
    if (!refused) throw err;
  });

  if (refused) return { ok: false, ...refused };
  return { ok: true, ...result };
}

function sameValue(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
  if (typeof a === "object" && typeof a.toString === "function") return a.toString() === String(b);
  return String(a) === String(b);
}

/** The ids merged into this row, from its own record. Pure. */
export function mergedFromIds(prospect = {}) {
  const entries = Array.isArray(prospect?.mergedFrom) ? prospect.mergedFrom : [];
  const ids = [];
  for (const e of entries) {
    if (e?.kind !== "merge") continue;
    for (const r of e.retired || []) if (r?.id && !ids.includes(r.id)) ids.push(r.id);
  }
  return ids;
}
