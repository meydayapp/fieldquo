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

const ACTIONS = ["claim", "release", "worked", "do_not_contact"];
const MAX_REASON = 300;
/** Retries on a lost race before telling the rep the pool moved under them. */
const CLAIM_ATTEMPTS = 3;

/** The columns the queue list needs. Narrow, and the same for both handlers. */
const QUEUE_SELECT = {
  id: true,
  businessName: true,
  tradeKey: true,
  assignedRepId: true,
  assignedAt: true,
  claimExpiresAt: true,
  doNotContactAt: true,
  doNotContactReason: true,
  phoneE164: true,
};

async function queueBody(rep, { tradeKey = null, prospectId = null } = {}) {
  const now = new Date();

  const claimed = await db.prospect.findMany({
    where: {
      ...queueWhere(rep.id, { now }),
      ...(tradeKey && DISCOVERY_TRADES[tradeKey] ? { tradeKey } : {}),
    },
    orderBy: [{ assignedAt: "asc" }],
    select: QUEUE_SELECT,
  });

  // Per-trade counts, so the rep can pick a queue and see there is something in
  // it. Counts only — a count is not a list, and nothing here lets a rep read a
  // prospect they have not claimed.
  const trades = await Promise.all(
    discoveryTradeKeys().map(async (key) => {
      const [mine, available] = await Promise.all([
        db.prospect.count({ where: { ...queueWhere(rep.id, { now }), tradeKey: key } }),
        db.prospect.count({ where: claimCandidateWhere({ tradeKey: key, now }) }),
      ]);
      return { key, label: DISCOVERY_TRADES[key].label, claimed: mine, available };
    }),
  );

  const availableToClaim =
    tradeKey && DISCOVERY_TRADES[tradeKey]
      ? (trades.find((t) => t.key === tradeKey)?.available ?? null)
      : null;

  const queue = buildQueue({ prospects: claimed, repId: rep.id, now, availableToClaim, tradeKey });

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
      const [rules, signatures] = await Promise.all([
        db.confidenceRule.findMany(),
        db.technologySignature.findMany({ select: { code: true, name: true } }),
      ]);
      const signatureNames = Object.fromEntries(signatures.map((s) => [s.code, s.name]));

      current = {
        ...prospectView({
          prospect: full,
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
          now,
        }),
        tradeLabel: full.tradeKey ? DISCOVERY_TRADES[full.tradeKey]?.label || full.tradeKey : null,
        territory: full.territory,
        websiteUrl: full.websiteUrl,
        phoneE164: full.phoneE164,
        // ── Whether this may be dialled, and where the screen re-asks ──────
        //
        // `compliance` is the answer at the moment this response was built, so
        // the API is honest to anything that reads it. `callingContext` is what
        // the SCREEN needs to ask the same question again a minute later,
        // because a decision computed at 19:59 and rendered until midnight is
        // exactly the dead control AGENTS.md forbids, wearing a live coat.
        //
        // attemptsLast24h is deliberately not passed: nothing records a call
        // attempt yet, and salesCallReadiness reports that gap rather than
        // pretending the Oklahoma and Florida caps are being counted.
        compliance: salesCallReadiness({
          prospect: full,
          timeZone: full.leads[0]?.timeZone || null,
          now,
        }),
        callingContext: {
          country: full.country,
          province: full.province,
          timeZone: full.leads[0]?.timeZone || null,
        },
      };
    }
  }

  return {
    rep: { id: rep.id, name: rep.name, email: rep.email },
    tradeKey: tradeKey || null,
    trades,
    queue,
    current,
    claimHours: CLAIM_HOURS,
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

  return NextResponse.json(await queueBody(rep, { tradeKey, prospectId }));
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

  if (action === "claim") {
    const tradeKey = typeof body.tradeKey === "string" ? body.tradeKey.trim() : "";
    if (!DISCOVERY_TRADES[tradeKey]) {
      return bad(
        "A queue is one trade. A rep who says the same script forty times gets better at it; one who " +
          "switches trade every call never does.",
      );
    }

    for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt++) {
      // One clock per attempt, used by BOTH the read and the write below. A
      // second `new Date()` in the update would move the lapse boundary between
      // the two queries, so a claim that expired in that gap could be taken by
      // the read and refused by the write — or worse, the other way round.
      const at = new Date();
      const candidate = await db.prospect.findFirst({
        where: claimCandidateWhere({ tradeKey, now: at }),
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
        where: { id: candidate.id, ...claimCandidateWhere({ tradeKey, now: at }) },
        data: {
          assignedRepId: rep.id,
          assignedAt: at,
          claimExpiresAt: claimExpiryFrom(at),
        },
      });
      if (claimed.count === 1) {
        return NextResponse.json(
          await queueBody(rep, { tradeKey, prospectId: candidate.id }),
        );
      }
    }

    return NextResponse.json({
      claimed: null,
      reason: "contended",
      message: "Another rep claimed the next few prospects while you were pressing the button. Try again.",
    });
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
    return NextResponse.json(await queueBody(rep, { tradeKey: body.tradeKey || "" }));
  }

  if (action === "worked") {
    // claimExpiresAt null is the schema's own way of saying "this one has
    // actually been worked — a real conversation is not a lease". It stops
    // lapsing, and it leaves the rep's active queue.
    const done = await db.prospect.updateMany({ where: mine, data: { claimExpiresAt: null } });
    if (done.count === 0) return notFound();
    return NextResponse.json(await queueBody(rep, { tradeKey: body.tradeKey || "" }));
  }

  // do_not_contact
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, MAX_REASON) : "";
  if (!reason) {
    return bad(
      "Say why. A do-not-contact with no reason cannot be reviewed later, and this one is permanent.",
    );
  }
  const done = await db.prospect.updateMany({
    where: mine,
    // Never overwritten once set: a second "do not contact" must not move the
    // date and lose when the business actually asked.
    data: { doNotContactAt: now, doNotContactReason: reason },
  });
  if (done.count === 0) return notFound();
  return NextResponse.json(await queueBody(rep, { tradeKey: body.tradeKey || "" }));
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
