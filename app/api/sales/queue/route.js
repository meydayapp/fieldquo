// app/api/sales/queue/route.js
//
// The rep's own queue: what they have claimed, and the one control that takes
// the next one.
//
// ══ A FOURTH gate, and why it is not a widening of any of the three ═══════
//
// lib/sales/queueGate.js, beside gate.js, outreachGate.js and smsGate.js. Its
// header argues the case; the short version is that a claim writes `Prospect`,
// which is org-wide discovered data rather than the rep's own notes, and what
// it decides is which rep phones which stranger — an operational lock, not a
// money decision and not a compliance one.
//
// Adding a gate is meant to be a visible edit rather than a silent one: it is
// named in scripts/check-sales-auth.mjs's SALES_GATES, which refuses any
// /api/sales handler resolving a rep through anything else, and its permitted
// writes are the explicit REP_QUEUE_WRITES list that file also asserts.
//
// ══ Why a rep cannot browse the pool ══════════════════════════════════════
//
// GET returns the rep's OWN claims — lib/sales/prospectView.js's queueWhere(),
// shaped after lib/sales/scope.js's assignedCompanyWhere() including the part
// that matters: it never returns `{}`. There is no endpoint here that lists
// unclaimed prospects, because a rep who can see the pool can pick the best
// twenty and leave the rest, and because a list a rep can read is a list a rep
// can phone without claiming. The only way to get a new prospect is to ask for
// the next one, and the server picks it.
//
// ══ Why the claim is a compare-and-set ════════════════════════════════════
//
// Two reps pressing the button in the same second is the ordinary case at 9am,
// not a hypothetical. A read-then-write hands them the same contractor. The
// claim is therefore an `updateMany` whose WHERE still contains the whole
// availability condition, and a zero count means somebody else won — the same
// discipline lib/voice/autoTopup.js uses, and the reason the pipeline runner
// claims tasks the way it does.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkSuppression } from "@/lib/sales/suppression";
import { requireQueueRep } from "@/lib/sales/queueGate";
import { DISCOVERY_TRADES, discoveryTradeKeys } from "@/lib/sales/discovery/trades";
import {
  CLAIM_HOURS,
  buildQueue,
  claimCandidateWhere,
  claimExpiryFrom,
  prospectView,
  queueWhere,
} from "@/lib/sales/prospectView";
import { salesCallReadiness } from "@/lib/sales/callingRules";
import {
  QUEUE_BATCH_MAX,
  QUEUE_DAILY_CLAIM_CAP,
  QUEUE_TOP_UP_BELOW,
  QUEUE_TOP_UP_MIN_INTERVAL_MS,
  SHIFT_HOURS,
  claimBatch,
  claimsTakenToday,
  closeClaim,
  isResearched,
  logSingleClaim,
  releaseClosedUntouched,
  releaseUntouched,
  shiftEndFrom,
  shiftStartFor,
  usableTimeZone,
} from "@/lib/sales/queueBatch";
import { groupByWindow, repClock, zoneAcronym } from "@/lib/sales/queueWindows";
import { loadRetryRules, regroupForRetry, retryViewFor } from "@/lib/sales/retryPool";
import { repLanguageOrNull } from "@/lib/sales/repLanguage";
import { requiredLanguageFor } from "@/lib/sales/leadLanguage";
// Namespace import, not a named one: the pipeline is growing
// ensureResearchQueued() in a concurrent change, and a named import of an
// export that is not there yet is a build error on one bundler and a silent
// undefined on the other. The call site tests for the function before calling.
import * as pipelineProgress from "@/lib/sales/pipeline/progress";
import { attemptsLast24h, ownNumbers } from "@/lib/sales/calls/store";
import { loadWindowPolicyContext } from "@/lib/sales/windowOverrides";
import { publicWindowPolicy, windowPolicyFor } from "@/lib/sales/windowPolicy";
import { CHANNEL_TEXT, CHANNEL_VOICE } from "@/lib/sales/contact/numbers";
import { composeBrief } from "@/lib/sales/intel/brief";
import { openCheckIns } from "@/lib/sales/checkin/store";
import { openTriageThreads } from "@/lib/sales/messages/triageStore";
import { loadContactNumbers, pickContactNumber } from "@/lib/sales/contact/resolve";

const ACTIONS = ["claim", "claim_batch", "release", "release_rest", "worked", "do_not_contact"];
const MAX_REASON = 300;
/** Retries on a lost race before telling the rep the pool moved under them. */
const CLAIM_ATTEMPTS = 3;

/**
 * The columns the queue list needs. Narrow, and the same for both handlers.
 *
 * The list is the rep's DAY now — a hundred rows, walked top to bottom — so a
 * row carries what a rep decides the next dial on: the city, whether research
 * came back, when the window opens or shuts, and how the last call ended.
 * Only rows the rep already holds are ever selected this way; the pool is
 * still counted, never listed.
 */
const QUEUE_SELECT = {
  id: true,
  businessName: true,
  tradeKey: true,
  city: true,
  province: true,
  country: true,
  assignedRepId: true,
  assignedAt: true,
  claimExpiresAt: true,
  doNotContactAt: true,
  doNotContactReason: true,
  phoneE164: true,
  lastCrawledAt: true,
  // The retry pool's state on the row — lib/sales/retryRules.js retryStateOf
  // reads exactly these — so a row can say "Retry 2 of 4 — next at 14:30".
  attemptCount: true,
  nextAttemptAt: true,
  lastOutcome: true,
  retryBlock: true,
  exhaustedAt: true,
  recycledAt: true,
  _count: { select: { capabilities: true, opportunities: true } },
  leads: {
    where: { timeZone: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 1,
    select: { timeZone: true },
  },
};

/** Cheap, per-rep: the zone the rep's browser reported with the request. */
function repZoneFrom(value, now) {
  return usableTimeZone(value, now);
}

/**
 * Fire-and-forget: ask the pipeline to research what was just claimed, ahead
 * of the rest of the pool. Never awaited on the response path and never a
 * reason the claim fails — a rep with a hundred unresearched rows still has
 * a hundred rows.
 */
function queueResearchFor(prospectIds) {
  const fn = pipelineProgress.ensureResearchQueued;
  if (typeof fn !== "function" || !Array.isArray(prospectIds) || prospectIds.length === 0) return;
  Promise.resolve()
    .then(() => fn({ db, prospectIds, priority: "claimed" }))
    .catch((err) => {
      console.error("[sales/queue] ensureResearchQueued failed:", err?.message || err);
    });
}

async function queueBody(rep, { tradeKey = null, prospectId = null, timeZone = null, language = null, batch = null } = {}) {
  const now = new Date();
  // The rep's zone and language, for every time this response prints. Both
  // come from the browser with the request — the zone the way the batch
  // claim reads it, the language the way the portal renders it — because
  // neither is on the gate's row: SalesRep has no zone column at all, and
  // its language column is a stated preference that may be null.
  const zone = repZoneFrom(timeZone, now);
  const lang = repLanguageOrNull(language) || "en";
  // The platform console's calling-window overrides, read once for the whole
  // response so the list grouping, the current row's decision and what the
  // browser re-asks with all see the same rows. lib/sales/windowPolicy.js.
  const policyContext = await loadWindowPolicyContext({ now });
  // The retry rule table for this response — the platform's overrides over
  // the code defaults, read once so every row's "Retry N of M" agrees.
  const retryRules = await loadRetryRules({ db });

  // Everything the rep holds, whatever trade the picker is on. The list used
  // to be narrowed to the picked trade, so a rep who claimed painters and
  // then took a hundred roofers watched the painters vanish — "sometimes the
  // leads briefly disappear", the owner said, and they had not gone anywhere.
  // The trade picker decides what "Claim the next 100" pulls from; it never
  // hides what is already held. Each row carries its own tradeLabel.
  const claimedRows = await db.prospect.findMany({
    where: queueWhere(rep.id, { now }),
    orderBy: [{ assignedAt: "asc" }],
    select: QUEUE_SELECT,
  });

  // ── The day's order, and what each row needs beside its name ────────────
  //
  // A batch is written with ONE assignedAt, so `assignedAt asc` alone leaves a
  // hundred rows in whatever order the database felt like. The claim log
  // carries the dial order (callable soonest, then researched first, then the
  // pool's own order — lib/sales/queueBatch.js); rows are sorted by
  // (claimedAt, position) from it, and a row with no log entry (claimed
  // before the log existed) keeps its assignedAt place. That is the order
  // INSIDE a window group; the groups are decided just below.
  const ids = claimedRows.map((p) => p.id);
  const [openClaims, researching, lastAttempts] = ids.length
    ? await Promise.all([
        db.salesQueueClaim.findMany({
          where: { salesRepId: rep.id, prospectId: { in: ids }, releasedAt: null },
          orderBy: [{ claimedAt: "asc" }, { position: "asc" }],
          select: { prospectId: true, claimedAt: true, position: true, batchId: true },
        }),
        // "Researching…" is a real state, not the absence of research: a task
        // queued or in hand for the row. Read from the pipeline's own table so
        // the screen never says "researching" about a row nothing will touch.
        db.salesPipelineTask.findMany({
          where: { prospectId: { in: ids }, status: { in: ["queued", "claimed"] } },
          select: { prospectId: true },
          distinct: ["prospectId"],
        }),
        db.salesCallAttempt.findMany({
          where: { prospectId: { in: ids }, salesRepId: rep.id },
          orderBy: { dialledAt: "desc" },
          distinct: ["prospectId"],
          select: { prospectId: true, disposition: true, dialledAt: true },
        }),
      ])
    : [[], [], []];
  const rank = new Map();
  openClaims.forEach((c, i) => {
    if (!rank.has(c.prospectId)) rank.set(c.prospectId, i);
  });
  const researchingIds = new Set(researching.map((r) => r.prospectId));
  const lastById = new Map(lastAttempts.map((a) => [a.prospectId, a]));
  const inClaimOrder = [...claimedRows].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return (a.assignedAt?.getTime?.() || 0) - (b.assignedAt?.getTime?.() || 0);
  });

  // ── Grouped by when each row can be rung, in the rep's clock ─────────────
  //
  // lib/sales/queueWindows.js. The claim order above is the order INSIDE a
  // group; the groups themselves are "callable now" (shuts soonest first),
  // then one per opening instant, then what cannot be rung before the shift
  // ends. The shift is the same one the batch claim judged against —
  // SHIFT_HOURS from the rep's first Available today — so a row the claim
  // took as "opens later in the shift" lands in an "Opens at" group here and
  // never in "Not callable today".
  const shiftStart = await shiftStartFor({ db, salesRepId: rep.id, timeZone: zone, now });
  const shiftEnd = shiftEndFrom({ shiftStart, now });
  const grouped = groupByWindow(
    inClaimOrder.map((p) => ({ id: p.id, country: p.country, province: p.province, timeZone: p.leads?.[0]?.timeZone || null })),
    { repZone: zone, shiftEnd, now, language: lang, policyContext },
  );
  // ── Then the retry pool re-orders those groups ─────────────────────────
  //
  // lib/sales/retryPool.js: a due retry goes to the FRONT of "Callable now"
  // (its header says why it outranks a fresh row); a retry whose instant is
  // still ahead is held in an "opens at" group keyed by that instant, so the
  // list and the autodialler both wait for it rather than ringing a business
  // fifteen minutes after it said busy; an exhausted row is "later", with
  // its reason, until the lease lapses and the pool forgets it.
  const retries = Object.fromEntries(
    inClaimOrder.map((p) => [p.id, retryViewFor(p, { repZone: zone, language: lang, now, rules: retryRules })]),
  );
  const windows = regroupForRetry(grouped, retries, { shiftEnd, now });
  const byId = new Map(inClaimOrder.map((p) => [p.id, p]));
  const claimed = windows.order.map((id) => byId.get(id)).filter(Boolean);
  const rowExtras = new Map(
    claimed.map((p) => {
      const last = lastById.get(p.id) || null;
      return [
        p.id,
        {
          city: p.city || null,
          province: p.province || null,
          // "fr" on a Quebec row, else null: the card draws a Français chip
          // from it, so a rep sees why this row reached them and not a
          // colleague. Decided by the same function the claim used.
          language: requiredLanguageFor(p),
          researched: isResearched(p),
          researching: !isResearched(p) && researchingIds.has(p.id),
          // windowFor()'s answer for this row: the decision, the prospect's
          // zone as a chip, and the opening/closing instant both as an ISO
          // instant (for the dialler's clock) and on the rep's wall clock
          // (for the row). Every value here is derived from
          // salesCallReadiness — nothing is re-decided.
          window: windows.byId[p.id] || null,
          lastOutcome: last
            ? { disposition: last.disposition || null, at: last.dialledAt?.toISOString?.() || null }
            : null,
          // "Retry 2 of 4 — next at 14:30", "Exhausted after 4 attempts":
          // every value the row prints is the server's, on the rep's clock.
          retry: retries[p.id] || null,
        },
      ];
    }),
  );

  // Per-trade counts, so the rep can pick a queue and see there is something in
  // it. Counts only — a count is not a list, and nothing here lets a rep read a
  // prospect they have not claimed.
  const trades = await Promise.all(
    discoveryTradeKeys().map(async (key) => {
      const [mine, available] = await Promise.all([
        db.prospect.count({ where: { ...queueWhere(rep.id, { now }), tradeKey: key } }),
        // THIS rep's pool, not the pool: a Quebec row an anglophone rep
        // cannot be handed is not "available" to them, and a count that
        // said 900 beside a button that claimed 12 would be the dead
        // control in numbers. The campaigns console counts without a rep.
        db.prospect.count({ where: claimCandidateWhere({ tradeKey: key, now, rep }) }),
      ]);
      return { key, label: DISCOVERY_TRADES[key].label, claimed: mine, available };
    }),
  );

  const availableToClaim =
    tradeKey && DISCOVERY_TRADES[tradeKey]
      ? (trades.find((t) => t.key === tradeKey)?.available ?? null)
      : null;

  const queue = buildQueue({ prospects: claimed, repId: rep.id, now, availableToClaim, tradeKey });
  queue.items = queue.items.map((item) => ({ ...item, ...(rowExtras.get(item.id) || {}) }));
  // The groups, with their ids, so the screen draws a header per group and
  // the dialler walks the same order the list shows. `shiftEnd` is said so a
  // rep can read why a row is "not callable today".
  queue.windows = {
    repZone: zone,
    language: lang,
    shiftStart: (shiftStart || now).toISOString(),
    shiftEnd: shiftEnd.toISOString(),
    shiftHours: SHIFT_HOURS,
    groups: windows.groups,
  };

  // One at a time. The rep asks for a specific prospect or gets the top of
  // their own queue; either way the row is re-read through queueWhere, so a
  // prospect id belonging to another rep resolves to nothing rather than to a
  // 403 that confirms it exists.
  const currentId =
    prospectId && claimed.some((p) => p.id === prospectId) ? prospectId : (claimed[0]?.id ?? null);

  let current = null;
  if (currentId) {
    const full = await db.prospect.findFirst({
      where: { id: currentId, ...queueWhere(rep.id, { now }) },
      include: {
        capabilities: true,
        technologies: true,
        inferences: true,
        opportunities: { include: { capability: { select: { code: true, name: true } } } },
        scores: { orderBy: { computedAt: "desc" }, take: 1 },
        evidence: { orderBy: { observedAt: "desc" }, take: 400 },
        territory: { select: { id: true, name: true } },
        // The calling window is stated in the PROSPECT's local time, and the
        // only place anybody has ever written one down is SalesLead.timeZone —
        // set by the rep who had them on the phone, from the texting screen.
        // Read across every rep's lead rather than this rep's: a time zone is a
        // fact about the business, not about who owns the row, and a split
        // state such as Florida cannot be resolved without one.
        leads: {
          where: { timeZone: { not: null } },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { timeZone: true },
        },
      },
    });

    if (full) {
      const [rules, signatures, suppression, contactRows, ours, myLead, history, briefTask, converted, checkIns, openTriage] = await Promise.all([
        db.confidenceRule.findMany(),
        db.technologySignature.findMany({ select: { code: true, name: true } }),
        // ── The list, read for the one prospect that gets a dial control ──
        //
        // A rep who marks do-not-contact writes BOTH the row flag and a
        // SalesSuppression, so the flag alone covered anything a REP had done.
        // A contractor who texts STOP writes only the suppression, and this
        // screen never read it — so somebody who said stop by text still saw a
        // live Call button and a live handset `tel:` link.
        //
        // The API route refuses the browser call, but the handset link is an
        // <a href="tel:"> that reaches no server at all. A gate that lives only
        // in the route cannot cover it: the refusal has to be decided where the
        // control is drawn, which is here.
        //
        // Fails CLOSED. If the list cannot be read we do not know whether they
        // said stop, and "we could not check" is not permission to ring.
        full?.phoneE164
          ? checkSuppression(db, { channel: "phone", phone: full.phoneE164 }).catch(() => ({
              suppressed: true,
              reason: "The do-not-contact list could not be read, so no dial control is offered.",
            }))
          : Promise.resolve(null),
        // Extra numbers a rep was given on the phone. Read here rather than
        // behind a second fetch for the same reason the suppression verdict is:
        // this is the screen where the Call button is drawn, and a picker that
        // arrived a beat later would let a rep press the listing number while
        // the cell they were told to use was still loading.
        loadContactNumbers({ prospectId: full.id }),
        ownNumbers().catch(() => []),
        // The rep's OWN lead for this business, when they have carried it
        // across. This is what "update and make changes to the lead" edits —
        // see the note beside `lead` in the payload below for why a rep
        // corrects their lead rather than the discovered row.
        db.salesLead.findFirst({
          where: { prospectId: full.id, salesRepId: rep.id },
          select: {
            id: true, businessName: true, contactName: true, email: true, phone: true,
            timeZone: true, country: true, province: true, status: true, notes: true,
          },
        }),
        // ── The console's "Call history" card ───────────────────────────
        // This rep's attempts on this business, newest first, capped: the
        // card shows five and links to the lead page for the rest. Scoped
        // to the rep the way `lastOutcome` on the rows is — another rep's
        // calls on a row they later released are theirs to read, not ours.
        db.salesCallAttempt
          .findMany({
            where: { prospectId: full.id, salesRepId: rep.id },
            orderBy: { dialledAt: "desc" },
            take: 5,
            select: {
              id: true, direction: true, dialledAt: true, answeredAt: true, endedAt: true,
              talkSeconds: true, disposition: true, callbackAt: true, dialChannel: true,
            },
          })
          .catch(() => []),
        // ── The research brief's phrasing, if the pipeline wrote one ──
        // The brief itself is composed from the rows below on every read
        // (composeBrief) so it cannot disagree with them; only the model's
        // sentences are cached, on the task that produced them. The newest
        // finished task wins. None → the card says "no description yet",
        // never a sentence somebody has to disown on the phone.
        db.salesPipelineTask
          .findFirst({
            where: { prospectId: full.id, kind: "GENERATE_RESEARCH_BRIEF", status: "done" },
            orderBy: { claimedAt: "desc" },
            select: { payload: true },
          })
          .catch(() => null),
        // "Existing customer": a lead on this business that has converted
        // into a company on the platform. A count, never the company — the
        // console shows the rep a tag, not another tenant's record.
        db.salesLead
          .count({ where: { prospectId: full.id, convertedCompanyId: { not: null } } })
          .catch(() => 0),
        // Check-in drafts due for this business, by the number we hold.
        full.phoneE164
          ? openCheckIns({ salesRepId: rep.id, toE164: full.phoneE164 }).catch(() => [])
          : Promise.resolve([]),
        // Their latest text was a roadblock or a question and nobody has
        // written back: the Tasks tab's third list. Null when the read failed
        // — absence, not an empty list — so the tab can say it could not look.
        full.phoneE164
          ? openTriageThreads({ salesRepId: rep.id, e164: full.phoneE164 }).then((r) => r.items).catch(() => null)
          : Promise.resolve([]),
      ]);
      const signatureNames = Object.fromEntries(signatures.map((s) => [s.code, s.name]));

      // Which numbers may be rung, and which may be texted — they are not the
      // same list, because a landline takes a call and silently swallows a
      // text. Computed on both channels here so the screen never has to work
      // out reach for itself.
      const blocked = Boolean(full.doNotContactAt) || Boolean(suppression?.suppressed);
      const numberArgs = {
        target: { phoneE164: full.phoneE164 },
        rows: contactRows,
        ourNumbers: ours,
        blocked,
        blockedReason: suppression?.reason || null,
      };
      const voice = pickContactNumber({ ...numberArgs, channel: CHANNEL_VOICE });
      const text = pickContactNumber({ ...numberArgs, channel: CHANNEL_TEXT });
      const attempts24h = await attemptsLast24h(full.phoneE164 || voice.choices[0]?.e164 || null, { now }).catch(
        () => null,
      );

      current = {
        ...prospectView({
          // The listing number OR the best one a rep recorded. contactability()
          // asks "is there a number to ring", and once somebody has told us the
          // owner's cell the answer is yes even when discovery found nothing —
          // leaving it null would draw "no sales number yet" over a number the
          // rep wrote down ten seconds ago, which is the dead control inverted.
          //
          // It does NOT write back: Prospect.phoneE164 is the dedupe key every
          // discovery run matches on, and a call is not a reason to re-point it.
          prospect: { ...full, phoneE164: full.phoneE164 || voice.choices[0]?.e164 || null },
          capabilities: full.capabilities,
          technologies: full.technologies.map((t) => ({
            ...t,
            name: signatureNames[t.technologyCode] || t.technologyCode,
          })),
          inferences: full.inferences,
          opportunities: full.opportunities,
          evidence: full.evidence,
          scores: full.scores,
          rules,
          capabilityNames: Object.fromEntries(
            full.opportunities.map((o) => [o.capabilityCode, o.capability?.name || o.capabilityCode]),
          ),
          repId: rep.id,
          suppression,
          now,
        }),
        tradeLabel: full.tradeKey ? DISCOVERY_TRADES[full.tradeKey]?.label || full.tradeKey : null,
        territory: full.territory,
        websiteUrl: full.websiteUrl,
        phoneE164: full.phoneE164 || voice.choices[0]?.e164 || null,
        // ── The numbers, and the reasons some of them are not offered ──────
        //
        // `refused` travels with `choices` deliberately. A rep who was given a
        // number and cannot see it anywhere will type it into a note and phone
        // it off their own handset, which is a call nothing records and no
        // calling window governs — so a refused number is SHOWN, with why.
        numbers: {
          stored: contactRows.map((r) => ({
            id: r.id, e164: r.e164, kind: r.kind, label: r.label,
            canCall: r.canCall, canText: r.canText, preferred: r.preferred,
            note: r.note, createdAt: r.createdAt,
          })),
          voice: { choices: voice.choices, refused: voice.refused, reason: voice.code },
          text: { choices: text.choices, refused: text.refused, reason: text.code },
        },
        // The rep's own lead for this business, or null when they have not
        // carried it across yet. Null is a real state the screen acts on — it
        // offers to create one — rather than a gap it papers over.
        lead: myLead,
        // ── Whether this may be dialled, and where the screen re-asks ──────
        //
        // `compliance` is the answer at the moment this response was built, so
        // the API is honest to anything that reads it. `callingContext` is what
        // the SCREEN needs to ask the same question again a minute later,
        // because a decision computed at 19:59 and rendered until midnight is
        // exactly the dead control AGENTS.md forbids, wearing a live coat.
        //
        // attemptsLast24h IS passed now. Until 2026-09-11 this comment said
        // "nothing records a call attempt yet" — untrue since the dial route
        // began writing SalesCallAttempt and counting through
        // lib/sales/calls/store.js — and the console printed a stale amber
        // paragraph telling reps to count Oklahoma's cap by hand. The count
        // is for the number the dial would ring (the listing number or the
        // server's first choice), the same one the dial route counts, and it
        // rides in callingContext so the screen's thirty-second re-ask
        // passes it too. Null only when the store is absent.
        compliance: salesCallReadiness({
          prospect: full,
          timeZone: full.leads[0]?.timeZone || null,
          now,
          attemptsLast24h: attempts24h,
          windowPolicy: windowPolicyFor(full, policyContext),
        }),
        callingContext: {
          country: full.country,
          province: full.province,
          timeZone: full.leads[0]?.timeZone || null,
          attemptsLast24h: attempts24h,
          // The console's override for this state, RESOLVED here — the
          // registration hold included — and re-passed by the screen on
          // every re-ask. The browser never resolves it itself: it holds no
          // override rows and no certificate list, and a client-side copy of
          // the hold is the second copy this feature refuses to have.
          windowPolicy: publicWindowPolicy(windowPolicyFor(full, policyContext)),
        },
        // ── What the console's Company card reads, beyond prospectView ──
        brief: (() => {
          const cached = briefTask?.payload?.brief || null;
          const phrasing = cached?.phrasing && typeof cached.phrasing === "object" ? cached.phrasing : null;
          const brief = composeBrief({
            prospect: full,
            capabilities: full.capabilities,
            technologies: full.technologies,
            inferences: full.inferences,
            opportunities: full.opportunities,
            score: full.scores[0] || null,
            phrasing,
          });
          // The inferred owner, with the sentence it was read from. The
          // Contact card shows the name with its confidence word and, on
          // request, the quote — a rep who says "is that Dave?" should be
          // able to see the words that made us think so.
          const ownerRow = full.inferences.find((i) => i?.kind === "owner_name" && i?.value);
          const evidenceById = new Map(full.evidence.map((e) => [e.id, e]));
          const ownerQuote = ownerRow
            ? (Array.isArray(ownerRow.evidenceIds) ? ownerRow.evidenceIds : [])
                .map((id) => evidenceById.get(id))
                .map((e) => e?.rawValue || e?.normalizedValue || null)
                .find(Boolean) || null
            : null;
          return {
            owner: ownerRow ? { name: String(ownerRow.value).trim(), quote: ownerQuote, source: ownerRow.source || null } : null,
            // The model's sentence about THIS business, or null. `opening`
            // always has a value (a plain fallback built from rows), but the
            // card wants the DESCRIPTION, and a fallback is not one — so
            // only a phrased opening is offered as the description.
            description: brief.phrased && phrasing?.opening ? brief.opening : null,
            generatedAt: cached?.generatedAt || null,
            crawled: brief.crawled,
            talkingPoints: brief.talkingPoints,
          };
        })(),
        // The pool's state for the Dialer card — the same object the row
        // carries, read from the same columns.
        retry: retryViewFor(full, { repZone: zone, language: lang, now, rules: retryRules }),
        history: history.map((a) => ({
          id: a.id,
          direction: a.direction,
          dialledAt: a.dialledAt?.toISOString?.() || null,
          answered: Boolean(a.answeredAt),
          talkSeconds: Number.isFinite(a.talkSeconds) ? a.talkSeconds : null,
          disposition: a.disposition || null,
          callbackAt: a.callbackAt?.toISOString?.() || null,
          channel: a.dialChannel || null,
        })),
        existingCustomer: converted > 0,
        openTriage: openTriage
          ? openTriage.map((o) => ({
              e164: o.e164,
              kind: o.kind,
              reason: o.reason,
              body: o.body,
              sentAt: o.sentAt?.toISOString?.() || o.sentAt || null,
            }))
          : null,
        checkIns: checkIns.map((c) => ({
          id: c.id,
          scheduledFor: c.scheduledFor?.toISOString?.() || null,
          draftText: c.draftText,
          origin: c.origin,
        })),
      };
    }
  }

  const takenToday = await claimsTakenToday({ db, salesRepId: rep.id, timeZone: zone, now });

  return {
    rep: { id: rep.id, name: rep.name, email: rep.email },
    tradeKey: tradeKey || null,
    trades,
    queue,
    current,
    claimHours: CLAIM_HOURS,
    // The two ceilings, and where today stands against the daily one. Sent so
    // the button can say "Claim the next 100" with the server's number, and
    // so a rep at 150 reads why the button is gone rather than a dead one.
    batch: {
      max: QUEUE_BATCH_MAX,
      // The console tops up below this many open rows, at most this often.
      topUpBelow: QUEUE_TOP_UP_BELOW,
      topUpIntervalMs: QUEUE_TOP_UP_MIN_INTERVAL_MS,
      dailyCap: QUEUE_DAILY_CLAIM_CAP,
      takenToday,
      remainingToday: Math.max(0, QUEUE_DAILY_CLAIM_CAP - takenToday),
      timeZone: zone,
      // The result of the press that produced this response, when there was
      // one: how many were claimed, how many came researched, how many are
      // waiting on research, and the ids in dial order.
      result: batch,
    },
    // The screen re-evaluates the calling window on a timer, and it must not do
    // that against the rep's own machine clock: a laptop an hour fast would
    // open the window an hour early in a jurisdiction with a private right of
    // action. This is the clock the offset is taken from.
    serverNow: now.toISOString(),
  };
}

export async function GET(request) {
  const { rep, refusal } = await requireQueueRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const tradeKey = (url.searchParams.get("tradeKey") || "").trim().slice(0, 40);
  const prospectId = (url.searchParams.get("prospectId") || "").trim().slice(0, 40);
  const timeZone = (url.searchParams.get("timeZone") || "").trim().slice(0, 64);
  const language = (url.searchParams.get("language") || "").trim().slice(0, 8);

  return NextResponse.json(await queueBody(rep, { tradeKey, prospectId, timeZone, language }));
}

export async function POST(request) {
  const { rep, refusal } = await requireQueueRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return bad("Expected a JSON body.");

  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.includes(action)) {
    return bad(`Unknown action. This route does ${ACTIONS.join(", ")}.`);
  }

  const now = new Date();
  // The zone the rep's browser reported. It decides which calendar day a
  // claim is counted against and when "the end of the rep's day" is — see
  // lib/sales/queueBatch.js. Validated there; an unusable value is null.
  const timeZone = typeof body.timeZone === "string" ? body.timeZone.trim().slice(0, 64) : "";
  const language = typeof body.language === "string" ? body.language.trim().slice(0, 8) : "";

  if (action === "claim" || action === "claim_batch") {
    const tradeKey = typeof body.tradeKey === "string" ? body.tradeKey.trim() : "";
    if (!DISCOVERY_TRADES[tradeKey]) {
      return bad(
        "A queue is one trade. A rep who says the same script forty times gets better at it; one who " +
          "switches trade every call never does.",
      );
    }
  }

  if (action === "claim_batch") {
    // ── The day, in one press ──────────────────────────────────────────────
    //
    // Everything that decides WHICH rows — the trade, the research-first
    // order, the calling-window rule, both ceilings — is in claimBatch(), and
    // the trade sits inside claimCandidateWhere() inside the updateMany's
    // WHERE inside the transaction. The browser named a trade; the write is
    // what honoured it.
    const tradeKey = body.tradeKey.trim();
    // ── The rolling batch ──────────────────────────────────────────────
    // `auto: true` is the console topping itself up because the rep's open
    // rows ran low (a boolean from the browser, nothing else). Before the
    // claim it gives back the rep's untouched rows whose window is shut for
    // the rest of the shift, so dead rows are not carried across the day;
    // the count rides back as releasedClosed. Two tabs cannot double-claim:
    // the claim is one transaction whose updateMany carries the candidate
    // WHERE (unassigned or lapsed), and the winners are read back by rep
    // and instant — the second tab's press matches nothing already taken.
    // The daily cap is counted from the claim log inside claimBatch, so a
    // top-up at the cap is refused with daily_cap like any press.
    const auto = body.auto === true;
    // Read once for the release and the claim, so both judge a row by the
    // same override rows — see lib/sales/windowOverrides.js.
    const policyContext = await loadWindowPolicyContext({ now });
    let releasedClosed = 0;
    if (auto) {
      const zone = repZoneFrom(timeZone, now);
      const shiftStart = await shiftStartFor({ db, salesRepId: rep.id, timeZone: zone, now });
      const shiftEnd = shiftEndFrom({ shiftStart, now });
      releasedClosed = (await releaseClosedUntouched({ db, rep, shiftEnd, now, policyContext })).released;
    }
    const result = await claimBatch({ db, rep, tradeKey, timeZone, now, policyContext });
    result.auto = auto;
    result.releasedClosed = releasedClosed;
    if (result.nextOpensAt) {
      // On the rep's clock, in the rep's language, with the zone's acronym —
      // the same formatter every "opens at" on the list goes through.
      const zone = repZoneFrom(timeZone, now);
      const lang = repLanguageOrNull(language) || "en";
      result.nextOpensAtLocal = repClock(new Date(result.nextOpensAt), { repZone: zone, language: lang, now });
      result.nextOpensAtZone = zoneAcronym(zone, { at: now });
    }
    if (result.claimed > 0) queueResearchFor(result.claimedIds);
    return NextResponse.json(
      await queueBody(rep, {
        tradeKey,
        prospectId: result.claimedIds[0] || "",
        timeZone,
        language,
        batch: result,
      }),
    );
  }

  if (action === "claim") {
    const tradeKey = body.tradeKey.trim();

    // The same ceiling the batch is held to, from the same log. A rep at the
    // cap is told so rather than handed a dead button; the sentence is a key
    // so a Spanish console says it in Spanish.
    const takenToday = await claimsTakenToday({ db, salesRepId: rep.id, timeZone: usableTimeZone(timeZone, now), now });
    if (takenToday >= QUEUE_DAILY_CLAIM_CAP) {
      return NextResponse.json({
        claimed: null,
        reason: "daily_cap",
        reasonKey: "app.salesQueue.batchReason.dailyCap",
        reasonParams: { cap: QUEUE_DAILY_CLAIM_CAP },
        message: `You have claimed ${QUEUE_DAILY_CLAIM_CAP} today, which is the daily ceiling. Tomorrow's day starts fresh.`,
      });
    }

    for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt++) {
      // One clock per attempt, used by BOTH the read and the write below. A
      // second `new Date()` in the update would move the lapse boundary between
      // the two queries, so a claim that expired in that gap could be taken by
      // the read and refused by the write — or worse, the other way round.
      const at = new Date();
      // `rep` carries the language rule: a Quebec row is not a candidate
      // for a rep without French — lib/sales/leadLanguage.js.
      const candidate = await db.prospect.findFirst({
        where: claimCandidateWhere({ tradeKey, now: at, rep }),
        // Oldest first, so the pool drains rather than the same rows being
        // handed out. NOT by lead score: nothing in this build writes a
        // ProspectScore, and ordering by a column that is always null is a
        // ranking that only looks like one.
        orderBy: [{ createdAt: "asc" }],
        select: { id: true },
      });
      if (!candidate) {
        return NextResponse.json({
          claimed: null,
          reason: "pool_empty",
          message:
            "Nothing is free to claim in this trade. Discovery has to run again before there is.",
        });
      }

      // The whole availability condition is still in the WHERE. If another rep
      // claimed this row between the read and the write, count is 0 and we go
      // round again rather than overwriting their claim.
      const claimed = await db.prospect.updateMany({
        where: { id: candidate.id, ...claimCandidateWhere({ tradeKey, now: at, rep }) },
        data: {
          assignedRepId: rep.id,
          assignedAt: at,
          claimExpiresAt: claimExpiryFrom(at),
        },
      });
      if (claimed.count === 1) {
        // Logged after the lease is won, never before: a log row for a claim
        // that lost the race would count against the day's cap for nothing.
        await logSingleClaim({ db, rep, prospectId: candidate.id, timeZone, now: at });
        queueResearchFor([candidate.id]);
        return NextResponse.json(
          await queueBody(rep, { tradeKey, prospectId: candidate.id, timeZone, language }),
        );
      }
    }

    return NextResponse.json({
      claimed: null,
      reason: "contended",
      message: "Another rep claimed the next few prospects while you were pressing the button. Try again.",
    });
  }

  if (action === "release_rest") {
    // ── Everything untouched, back in one press ────────────────────────────
    //
    // Every row this rep holds on an unworked lease with no call attempt of
    // theirs since the claim. A row they dialled is kept, a row they worked is
    // out of scope. The same function the hourly cron calls for a rep whose
    // day has ended, so the two cannot disagree about what "untouched" means.
    const result = await releaseUntouched({ db, rep, reason: "rest", now });
    return NextResponse.json(
      await queueBody(rep, {
        tradeKey: body.tradeKey || "",
        timeZone,
        language,
        batch: { released: result.released, kept: result.kept },
      }),
    );
  }

  const prospectId = typeof body.prospectId === "string" ? body.prospectId.trim() : "";
  if (!prospectId) return bad("Which prospect?");

  // Every remaining action is scoped to a row this rep holds. `assignedRepId`
  // is in the WHERE rather than checked after a read: one query that can only
  // match a row satisfying both halves is the shape every other sales route
  // uses, and the reason none of them has a scoping bug. A prospect held by
  // somebody else matches nothing and comes back 404, which is also what it
  // should say — a 403 confirms the row exists.
  const mine = { id: prospectId, assignedRepId: rep.id };

  if (action === "release") {
    const done = await db.prospect.updateMany({
      where: mine,
      data: { assignedRepId: null, assignedAt: null, claimExpiresAt: null },
    });
    if (done.count === 0) return notFound();
    // The log closes with "rep" so the row sorts last for this rep for seven
    // days — put back by hand is the strongest "not this one" a rep can say.
    await closeClaim({ db, rep, prospectId, outcome: "released", now });
    return NextResponse.json(await queueBody(rep, { tradeKey: body.tradeKey || "", timeZone, language }));
  }

  if (action === "worked") {
    // claimExpiresAt null is the schema's own way of saying "this one has
    // actually been worked — a real conversation is not a lease". It stops
    // lapsing, and it leaves the rep's active queue.
    const done = await db.prospect.updateMany({ where: mine, data: { claimExpiresAt: null } });
    if (done.count === 0) return notFound();
    await closeClaim({ db, rep, prospectId, outcome: "worked", now });
    return NextResponse.json(await queueBody(rep, { tradeKey: body.tradeKey || "", timeZone, language }));
  }

  // do_not_contact
  //
  // ══ What this writes, and the list it deliberately does NOT ══════════════
  //
  // A row-level fact: Prospect.doNotContactAt on the one prospect this rep
  // holds. It does not write SalesSuppression, and that is queueGate.js's
  // rule, not an omission — "a rep marking one prospect do-not-contact is a
  // fact about that prospect, not an entry on the platform list", and
  // scripts/check-sales-auth.mjs holds this route to REP_QUEUE_WRITES to keep
  // it that way.
  //
  // The platform list is written by the CALL path instead. lib/sales/calls/
  // gate.js argues why the seam falls there: the rep on the phone is the one
  // who HEARS "take me off your list", so the `do_not_call` disposition writes
  // both — the row flag and a SalesSuppression on the number, in one
  // transaction, narrowed to the phone channel.
  //
  // The two are a real pair and the screen now says so. Until 2026-09-03 this
  // control was labelled "Why should nobody contact them again?" and promised
  // "Only a superadmin can lift it" — both untrue of what it writes. It binds
  // one ROW, so the same business re-ingested from a second register is a new
  // row and is callable, which multi-source campaigns made the ordinary case
  // rather than the edge one. And nothing lifts this column at all: the
  // superadmin-with-a-written-reason rule belongs to `unsuppress`, on the list
  // this action never touches.
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, MAX_REASON) : "";
  if (!reason) {
    return bad(
      "Say why. A do-not-contact with no reason cannot be reviewed later, and this one is permanent.",
    );
  }
  // Never overwritten once set, and the WHERE is what enforces it rather than
  // a comment: a second request must not move the date and lose when the
  // business actually asked. lib/sales/calls/store.js states the same rule and
  // reads first for it; here the condition can ride along in the update, which
  // is also the only form that is safe against two tabs.
  const done = await db.prospect.updateMany({
    where: { ...mine, doNotContactAt: null },
    data: { doNotContactAt: now, doNotContactReason: reason },
  });
  if (done.count === 0) {
    // Zero means one of two things and they are not the same answer. Already
    // recorded is a SUCCESS — the rep asked for a state the row is already in,
    // and 404 would read as "that didn't work", which invites a second press
    // and a support ticket. Not this rep's row is the 404.
    const already = await db.prospect.findFirst({
      where: { ...mine, doNotContactAt: { not: null } },
      select: { id: true },
    });
    if (!already) return notFound();
  }
  return NextResponse.json(await queueBody(rep, { tradeKey: body.tradeKey || "", timeZone, language }));
}

function bad(error) {
  return NextResponse.json({ error }, { status: 400 });
}

function notFound() {
  return NextResponse.json(
    { error: "That prospect is not yours to work. Claims are one rep at a time." },
    { status: 404 },
  );
}
