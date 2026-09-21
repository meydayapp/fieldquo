// app/api/platform/signups/route.js
//
// GET — the people who started a FieldQuo signup and never finished it.
//
// ══ Why this is its own endpoint and not a filter on /api/platform/companies ═
//
// It is also a filter there (`?status=incomplete`), because somebody searching
// the company list needs to see the state on the row. This endpoint exists for
// the other job: these are the warmest leads FieldQuo has — somebody wanted the
// product enough to type their business into it — and calling them needs
// something the company list does not carry. Who to ask for. What number to
// ring. Whether a recovery email has already gone out, so a rep does not open
// with news the person already has. Whether they are on FieldQuo's own
// do-not-contact list, which is the one fact that must be on the screen BEFORE
// the phone is picked up rather than discoverable on another one.
//
// ══ Why it does not create a SalesLead ═════════════════════════════════════
//
// SalesLead is the natural shape and was the first thing tried. It cannot hold
// these, for a reason that is structural rather than stylistic:
// `SalesLead.salesRepId` is required, with no unassigned state, and none of
// these signups is attributed to a rep — they arrived self-serve. Filing them
// would mean choosing a rep, and SalesLead feeds commission
// (lib/sales/commission.js) and carries `convertedCompanyId @unique`, so an
// invented attribution is an invented commission on a sale nobody made. That
// is padding absent data with a default, on the one field where the default
// costs money.
//
// The honest fix — making salesRepId nullable and giving reps an unassigned
// queue to claim from — is a product decision about how FieldQuo's sales team
// works, not something to slip in unasked. Flagged for the owner. Until then
// this list stands on its own and nobody owns a row.
//
// ══ Read-only ══════════════════════════════════════════════════════════════
//
// No POST, no PATCH, no DELETE, and none should be added. Non-negotiable #3:
// the platform console views everything on a company's data and edits nothing.
// The one write in this whole feature is the cron's own `signupNudgeSentAt`
// stamp, which is FieldQuo's record of what FieldQuo sent.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { checkSuppression } from "@/lib/sales/suppression";
import {
  NUDGE_DELAY_HOURS,
  NUDGE_WINDOW_DAYS,
  incompleteSignupWhere,
  nudgeRecipient,
  decideSignupNudge,
} from "@/lib/signup/abandoned";
import { PROMOTE_AFTER_MS, STEP_LABELS, emailKeyOf, tradeKeyForIndustries } from "@/lib/signup/leads";
import { EARLY_NUDGE_DELAY_MINUTES, EARLY_TOUCH, RECOVERY_TOUCH } from "@/lib/signup/earlyNudge";
import { discoveryTradeKeys, discoveryTradeLabel, isDiscoveryTradeKey } from "@/lib/sales/discovery/trades";
import { INDUSTRIES } from "@/app/data/industries";

/**
 * The trade a row is about, derived from the person's OWN words and never
 * guessed: the Prospect's tradeKey when one is on the floor (an operator may
 * have set it), else the first industry slug that maps to a discovery trade
 * (lib/signup/leads.js tradeKeyForIndustries — the same mapping the
 * promotion writes). `raw` is what they ticked, as labels, so a row whose
 * words mapped to nothing still shows them beside the "Set trade" select.
 */
function tradeOf({ prospectTradeKey = null, slugs = [] } = {}) {
  const list = Array.isArray(slugs) ? slugs : [];
  const key = isDiscoveryTradeKey(prospectTradeKey) ? prospectTradeKey : tradeKeyForIndustries(list);
  return {
    key,
    label: key ? discoveryTradeLabel(key) : null,
    source: isDiscoveryTradeKey(prospectTradeKey) ? "prospect" : key ? "industries" : null,
    raw: list.map((slug) => INDUSTRIES.find((i) => i.slug === slug)?.label || slug),
  };
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  // Demos are excluded here rather than by incompleteSignupWhere(), the same
  // split lib/platform/trialCounting.js keeps: the fragment states one rule and
  // every caller spreads its own NOT_DEMO beside it.
  const rows = await db.company.findMany({
    where: { isDemo: false, ...incompleteSignupWhere() },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      province: true,
      country: true,
      industries: true,
      defaultLanguage: true,
      createdAt: true,
      trialEndsAt: true,
      signupNudgeSentAt: true,
      isDemo: true,
      subscription: { select: { id: true } },
      referredByCode: true,
      salesAttribution: { select: { salesRepId: true } },
      // The lead behind the company: where they got to and when they were
      // last seen, which is the "last seen" the screen sorts on.
      signupLead: { select: { id: true, stepReached: true, lastSeenAt: true, trades: true } },
      _count: { select: { members: true, quotes: true, clients: true } },
      // Who to ask for. The Company row carries the address the signup was made
      // with; the owner's own name is on the User behind the Member, and it is
      // the thing a rep actually opens a call with.
      members: {
        where: { role: "owner" },
        select: { user: { select: { name: true, email: true } } },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();

  // One suppression read per distinct address, not per row — four of the live
  // rows share one inbox.
  const addresses = [...new Set(rows.map((c) => nudgeRecipient(c.email)).filter(Boolean))];
  const suppressed = new Map();
  for (const email of addresses) {
    const verdict = await checkSuppression(db, { channel: "email", email });
    suppressed.set(email, verdict);
  }

  // The signup row on the sales floor for each company, and who holds it —
  // lib/signup/salesFloor.js. What the owner reads as "hot lead assigned to
  // Rachel" / "unassigned" beside each unfinished signup.
  const floor = await db.prospect.findMany({
    where: { companyId: { in: rows.map((c) => c.id) }, signupKind: { not: null } },
    select: { id: true, companyId: true, signupKind: true, hot: true, tradeKey: true, assignedRepId: true, assignedAt: true, claimExpiresAt: true },
  });
  // Every rep, once: the names behind the holders AND the picker on the
  // screen (active, not ended, not a test account — the review folder's own
  // list, lib/signup/salesFloor.js's assign refuses anyone else).
  const allReps = await db.salesRep.findMany({
    where: { OR: [{ active: true, endedAt: null }, { id: { in: [...new Set(floor.map((p) => p.assignedRepId).filter(Boolean))] } }] },
    select: { id: true, name: true, sellsIn: true, language: true, active: true, endedAt: true, testAccount: true },
    orderBy: { name: "asc" },
  });
  const repName = new Map(allReps.map((r) => [r.id, r.name]));
  const reps = allReps.filter((r) => r.active && !r.endedAt && !r.testAccount).map((r) => ({ id: r.id, name: r.name, sellsIn: r.sellsIn, language: r.language }));
  const floorByCompany = new Map();
  for (const p of floor) {
    const live = p.assignedRepId && (!p.claimExpiresAt || p.claimExpiresAt > now);
    floorByCompany.set(p.companyId, {
      prospectId: p.id,
      kind: p.signupKind,
      hot: p.hot,
      tradeKey: p.tradeKey,
      assignedTo: live ? { id: p.assignedRepId, name: repName.get(p.assignedRepId) || "a rep", at: p.assignedAt } : null,
    });
  }

  // ── Which follow-ups have gone out, per person ─────────────────────────
  //
  // The SignupNudge log (lib/signup/earlyNudge.js): the five-minute touch and
  // the 24-hour note, keyed on the address. Company.signupNudgeSentAt is
  // still read for the 24-hour note sent before the log existed.
  const startedRows = await db.signupLead.findMany({
    where: { completedCompanyId: null },
    orderBy: { lastSeenAt: "desc" },
    take: 200,
    select: {
      id: true, email: true, firstName: true, lastName: true, companyName: true, phoneE164: true, city: true, province: true, country: true,
      trades: true, language: true, stepReached: true, startedAt: true, lastSeenAt: true, promotedAt: true, promotedLeadId: true, skipReason: true, salesCode: true,
      referredRep: { select: { id: true, name: true } },
      prospect: { select: { id: true, hot: true, signupKind: true, tradeKey: true, assignedRepId: true, assignedAt: true, claimExpiresAt: true, doNotContactAt: true } },
    },
  });
  const emailKeys = [...new Set([...rows.map((c) => emailKeyOf(c.email)), ...startedRows.map((r) => emailKeyOf(r.email))].filter(Boolean))];
  const nudgeRows = emailKeys.length
    ? await db.signupNudge.findMany({ where: { emailKey: { in: emailKeys }, sentAt: { not: null } }, select: { emailKey: true, touch: true, sentAt: true } })
    : [];
  const nudgesFor = (email, legacyRecoveryAt = null) => {
    const key = emailKeyOf(email);
    const mine = nudgeRows.filter((n) => n.emailKey === key);
    return {
      early: mine.find((n) => n.touch === EARLY_TOUCH)?.sentAt || null,
      recovery: mine.find((n) => n.touch === RECOVERY_TOUCH)?.sentAt || legacyRecoveryAt || null,
    };
  };

  const signups = rows.map((c) => {
    const to = nudgeRecipient(c.email);
    const verdict = to ? suppressed.get(to) : null;
    const lead = floorByCompany.get(c.id) || null;
    const referredRepId = c.salesAttribution?.salesRepId || null;
    // The SAME predicate the cron uses, so the screen cannot print a different
    // answer from the one the send path will reach — the failure
    // lib/platform/trialCounting.js exists because of, where a banner and a
    // tile disagreed about the same population.
    const decision = decideSignupNudge({
      company: { ...c, memberCount: c._count.members },
      suppressed: Boolean(verdict?.suppressed),
      heldByRep: Boolean(lead?.assignedTo),
      now,
    });

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      ownerName: c.members[0]?.user?.name || null,
      ownerEmail: c.members[0]?.user?.email || null,
      where: [c.city, c.province, c.country].filter(Boolean).join(", "),
      industries: c.industries,
      language: c.defaultLanguage,
      createdAt: c.createdAt,
      trialEndsAt: c.trialEndsAt,
      members: c._count.members,
      quotes: c._count.quotes,
      clients: c._count.clients,
      nudgeSentAt: c.signupNudgeSentAt,
      // Both halves. "Suppressed" alone would not tell a rep WHY the phone is
      // off-limits, and the reason is what they would otherwise ring support to
      // find out.
      doNotContact: Boolean(verdict?.suppressed),
      doNotContactReason: verdict?.suppressed ? verdict.reason : null,
      nudgeState: decision.reason,
      // The sales-floor row: kind (new / stalled), whether it is hot, and
      // which rep holds it — null when none was written (a referred signup,
      // or one older than the floor).
      lead,
      // Where the person got to and when they were last seen — off the lead
      // behind the company, else the company's own creation.
      stepReached: c.signupLead?.stepReached || "checkout",
      stepLabel: STEP_LABELS[c.signupLead?.stepReached] || "Checkout",
      lastSeenAt: c.signupLead?.lastSeenAt && c.signupLead.lastSeenAt > c.createdAt ? c.signupLead.lastSeenAt : c.createdAt,
      trade: tradeOf({ prospectTradeKey: lead?.tradeKey || null, slugs: c.industries?.length ? c.industries : c.signupLead?.trades || [] }),
      // A rep's own signup (their link attributed it): shown as theirs,
      // never offered to anyone else.
      referredTo: referredRepId ? { id: referredRepId, name: repName.get(referredRepId) || "a rep" } : c.referredByCode ? { id: null, name: null, code: c.referredByCode } : null,
      nudges: nudgesFor(c.email, c.signupNudgeSentAt),
    };
  });

  // ── Started, never finished ─────────────────────────────────────────────
  //
  // The SignupLead rows (lib/signup/leads.js): what people typed into the
  // first step and where each one now stands on the floor. Newest first,
  // bounded — this is a list a person reads, not an export.
  const holderIds = [...new Set(startedRows.map((r) => r.prospect?.assignedRepId).filter(Boolean).filter((id) => !repName.has(id)))];
  if (holderIds.length) {
    for (const r of await db.salesRep.findMany({ where: { id: { in: holderIds } }, select: { id: true, name: true } })) repName.set(r.id, r.name);
  }
  const started = startedRows.map((r) => {
    const p = r.prospect || null;
    const live = p?.assignedRepId && (!p.claimExpiresAt || p.claimExpiresAt > now);
    let state;
    if (r.promotedLeadId && r.referredRep) state = { code: "rep_lead", rep: r.referredRep };
    else if (p && live) state = { code: "assigned", rep: { id: p.assignedRepId, name: repName.get(p.assignedRepId) || "a rep", at: p.assignedAt }, hot: p.hot };
    else if (p) state = { code: "unassigned", hot: p.hot };
    else if (r.skipReason) state = { code: "skipped", reason: r.skipReason };
    else if (!r.phoneE164) state = { code: "no_phone" };
    else state = { code: "waiting", quietMinutes: Math.floor((now.getTime() - new Date(r.lastSeenAt).getTime()) / 60000), promoteAfterMinutes: PROMOTE_AFTER_MS / 60000 };
    return {
      id: r.id,
      email: r.email,
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
      companyName: r.companyName,
      phone: r.phoneE164,
      where: [r.city, r.province, r.country].filter(Boolean).join(", "),
      trades: r.trades,
      language: r.language,
      stepReached: r.stepReached,
      stepLabel: STEP_LABELS[r.stepReached] || r.stepReached,
      startedAt: r.startedAt,
      lastSeenAt: r.lastSeenAt,
      referredBy: r.referredRep || (r.salesCode ? { id: null, name: null, code: r.salesCode } : null),
      prospectId: p?.id || null,
      state,
      trade: tradeOf({ prospectTradeKey: p?.tradeKey || null, slugs: r.trades }),
      nudges: nudgesFor(r.email),
    };
  });

  return NextResponse.json({
    signups,
    started,
    // The picker on the screen, and the trades a row's words may be set to.
    reps,
    trades: discoveryTradeKeys().map((key) => ({ key, label: discoveryTradeLabel(key) })),
    // Printed on the screen so the delay is stated where somebody reads it
    // rather than only in a source comment.
    policy: { delayHours: NUDGE_DELAY_HOURS, windowDays: NUDGE_WINDOW_DAYS, earlyMinutes: EARLY_NUDGE_DELAY_MINUTES },
  });
}
