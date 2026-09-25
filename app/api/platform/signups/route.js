// app/api/platform/signups/route.js
//
// GET — the people who started a FieldQuo signup and never finished it, and
// — in a section of their own — the companies that finished on the card-free
// trial and have not chosen a plan yet.
//
// ══ 2026-09-25: a finished trial is not an unfinished signup ═════════════
//
// Since 38d3308d signup ends at Services with no card, so a new company has
// no Subscription row until the owner picks a plan from the banner. This
// endpoint's query was "no Subscription row", so every new company landed in
// the incomplete list as "got as far as Checkout" and, an hour in, as
// "Stalled — unassigned" (jaspedo, 2026-09-25). The list now asks
// lib/signup/abandoned.js: `signups` is incompleteSignupWhere (no row AND no
// trial date), and the finished card-free trials come back as `trials`, a
// separate array the page renders under "New companies on free trial" with
// what they are — "Signed up · free trial, N days left · no plan chosen yet".
// They stay on this page rather than moving wholly to /platform/companies
// because the welcome call is placed from here ("Assign for callback" works
// on them exactly as before); the page links to the companies list filtered
// to the same population.
//
// ══ Removed rows ═══════════════════════════════════════════════════════════
//
// Every row carries `dismissed` (lib/signup/dismissal.js): null, or when and
// by whom the owner removed it. Removed rows are RETURNED, flagged, so the
// page can offer "Show removed (N)" and "Restore" — the write is
// ./dismiss/route.js, superadmin only.
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
// The writes this screen triggers live in their own files (./assign, ./dismiss)
// and touch only FieldQuo's own rows — a Prospect, a claim, a SignupDismissal,
// an audit line — never a Company or a SignupLead.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { checkSuppression } from "@/lib/sales/suppression";
import {
  NUDGE_DELAY_HOURS,
  NUDGE_WINDOW_DAYS,
  cardFreeTrialWhere,
  incompleteSignupWhere,
  nudgeRecipient,
  decideSignupNudge,
} from "@/lib/signup/abandoned";
import { DISMISSAL_SELECT, isDismissed } from "@/lib/signup/dismissal";
import { trialAccessFor } from "@/lib/billing/access";
import { PROMOTE_AFTER_MS, STEP_LABELS, emailKeyOf, tradeKeyForIndustries, unfinishedSignupLeadWhere } from "@/lib/signup/leads";
import { EARLY_NUDGE_DELAY_MINUTES, EARLY_TOUCH, RECOVERY_TOUCH } from "@/lib/signup/earlyNudge";
import { discoveryTradeKeys, discoveryTradeLabel, isDiscoveryTradeKey } from "@/lib/sales/discovery/trades";
import { INDUSTRIES } from "@/app/data/industries";
import { dncSentence, loadSignupHistories, signupHolderOf, signupSuppressions } from "@/lib/signup/assignment";

/**
 * The floor row's columns every signup row reads: who holds it and since
 * when (the holder line), the Prospect's own do-not-contact flag, and the
 * address and number the list is asked about.
 */
const FLOOR_SELECT = {
  id: true, hot: true, signupKind: true, tradeKey: true, assignedRepId: true, assignedAt: true, claimExpiresAt: true,
  doNotContactAt: true, doNotContactReason: true, mergedIntoId: true, email: true, phoneE164: true,
};

/**
 * What the owner may press on a row, decided here beside the holder so the
 * screen draws only what the server would do. The routes re-check all of it.
 */
function actionsFor({ holder, dnc, dismissed, referred }) {
  const heldByRep = holder.kind === "rep";
  return {
    // A lease back to the platform. A worked row is moved, never released.
    takeBack: heldByRep && !holder.worked,
    reassign: heldByRep && !dnc.dnc && !dismissed,
    assign: !heldByRep && holder.kind !== "rep_own" && !referred && !dnc.dnc && !dismissed,
  };
}

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
  const COMPANY_SELECT = {
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
    ...DISMISSAL_SELECT,
  };
  const [incompleteRows, trialRows] = await Promise.all([
    db.company.findMany({
      where: { isDemo: false, ...incompleteSignupWhere() },
      select: COMPANY_SELECT,
      orderBy: { createdAt: "desc" },
    }),
    // Newest first and bounded, like the started list: this is the "who
    // signed up lately" section, and /platform/companies?status=card_free
    // is the full list.
    db.company.findMany({
      where: { isDemo: false, ...cardFreeTrialWhere() },
      select: COMPANY_SELECT,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  // Every company row, both sections, for the reads that are per address or
  // per company (suppression, floor rows, follow-ups).
  const rows = [...incompleteRows, ...trialRows];

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
    select: { ...FLOOR_SELECT, companyId: true },
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
  // "Unfinished" is signupLeadFinished's rule, not `completedCompanyId: null`:
  // a row the cron matched by phone or email to a company already on the
  // books is still somebody's live, unfinished signup. The owner's own test
  // signup vanished from this list on 2026-09-21 for exactly that reason,
  // while he was stuck on the page it belonged to.
  const startedRows = await db.signupLead.findMany({
    where: unfinishedSignupLeadWhere(),
    orderBy: { lastSeenAt: "desc" },
    take: 200,
    select: {
      id: true, email: true, firstName: true, lastName: true, companyName: true, phoneE164: true, city: true, province: true, country: true,
      trades: true, language: true, stepReached: true, startedAt: true, lastSeenAt: true, promotedAt: true, promotedLeadId: true, skipReason: true, salesCode: true,
      authUserId: true, completedCompanyId: true,
      referredRep: { select: { id: true, name: true } },
      prospect: { select: FLOOR_SELECT },
      ...DISMISSAL_SELECT,
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

  // Who removed a row, by address — PlatformAdmin carries an email, no name.
  const dismisserIds = [...new Set([...rows.map((c) => c.signupDismissal), ...startedRows.map((r) => r.signupDismissal)]
    .filter((d) => d && !d.restoredAt).map((d) => d.dismissedById).filter(Boolean))];
  const dismissers = dismisserIds.length
    ? new Map((await db.platformAdmin.findMany({ where: { id: { in: dismisserIds } }, select: { id: true, email: true } })).map((a) => [a.id, a.email]))
    : new Map();
  const dismissalOf = (row) =>
    isDismissed(row) ? { at: row.signupDismissal.dismissedAt, by: dismissers.get(row.signupDismissal.dismissedById) || null } : null;

  // ── Do not contact, who holds it, how it got there ─────────────────────
  //
  // The owner, 2026-09-24: a Do-Not-Contact row that still read "in the
  // review folder" (Luma Painting), and "I don't see to who has it or if it
  // was assigned". lib/signup/assignment.js answers all three, from ONE read
  // of the do-not-contact list for every address and number on the screen
  // (the Prospect's own flag included) and the claim log for the history.
  // The email-only verdict above stays what it was: it is the letters'
  // question ("may we email them"), and decideSignupNudge reads it.
  const holderIds = [...new Set(startedRows.map((r) => r.prospect?.assignedRepId).filter(Boolean).filter((id) => !repName.has(id)))];
  if (holderIds.length) {
    for (const r of await db.salesRep.findMany({ where: { id: { in: holderIds } }, select: { id: true, name: true } })) repName.set(r.id, r.name);
  }
  const floorRowByCompany = new Map(floor.map((p) => [p.companyId, p]));
  const dnc = await signupSuppressions({
    client: db,
    contacts: [
      ...rows.map((c) => {
        const p = floorRowByCompany.get(c.id) || null;
        return { key: `company:${c.id}`, emails: [c.email, c.members[0]?.user?.email, p?.email], phones: [c.phone, p?.phoneE164], prospect: p };
      }),
      ...startedRows.map((r) => ({ key: `lead:${r.id}`, emails: [r.email, r.prospect?.email], phones: [r.phoneE164, r.prospect?.phoneE164], prospect: r.prospect })),
    ],
  });
  const repOwnOf = (r) => (r.promotedLeadId && r.referredRep ? r.referredRep : null);
  const { histories } = await loadSignupHistories({
    client: db,
    prospects: [...floor, ...startedRows.map((r) => r.prospect).filter(Boolean)],
    referredById: new Map(startedRows.filter((r) => r.prospect && repOwnOf(r)).map((r) => [r.prospect.id, { rep: repOwnOf(r), at: r.promotedAt }])),
    repName,
    now,
  });
  const dncFields = (verdict) => ({
    doNotContact: Boolean(verdict?.dnc),
    // The reason alone, and the one sentence the screen prints in place of
    // any "waiting for a call" line — never "in the review folder".
    doNotContactReason: verdict?.dnc ? verdict.reason : null,
    doNotContactText: verdict?.dnc ? dncSentence(verdict) : null,
  });

  const companyRow = (c, { finished }) => {
    const to = nudgeRecipient(c.email);
    const verdict = to ? suppressed.get(to) : null;
    const lead = floorByCompany.get(c.id) || null;
    const referredRepId = c.salesAttribution?.salesRepId || null;
    const floorRow = floorRowByCompany.get(c.id) || null;
    const dncRow = dnc.get(`company:${c.id}`);
    const referredRep = referredRepId ? { id: referredRepId, name: repName.get(referredRepId) || "a rep" } : null;
    const holder = signupHolderOf({ prospect: floorRow, referredRep, dnc: dncRow, dismissed: isDismissed(c), repName, now });
    // The SAME predicate the cron uses, so the screen cannot print a different
    // answer from the one the send path will reach — the failure
    // lib/platform/trialCounting.js exists because of, where a banner and a
    // tile disagreed about the same population.
    const decision = decideSignupNudge({
      company: { ...c, memberCount: c._count.members },
      suppressed: Boolean(verdict?.suppressed),
      heldByRep: Boolean(lead?.assignedTo),
      dismissed: isDismissed(c),
      now,
    });
    // The card-free trial's own state, from the same function that decides
    // what the company can do (lib/billing/access.js) — so this row and the
    // banner the owner of that company is looking at say the same thing.
    const access = finished ? trialAccessFor(c, now) : null;

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
      // find out. Every channel and every address the row is known by — not
      // just the company email's letters verdict above.
      ...dncFields(dncRow),
      nudgeState: decision.reason,
      // Who holds it now, and how it got there (lib/signup/assignment.js).
      holder,
      history: floorRow ? histories.get(floorRow.id) || [] : referredRep ? [{ at: c.createdAt, type: "referred", repId: referredRep.id, text: `Came in on ${referredRep.name}'s link — theirs`, by: null }] : [],
      actions: actionsFor({ holder, dnc: dncRow, dismissed: isDismissed(c), referred: Boolean(referredRepId || c.referredByCode) }),
      // The sales-floor row: kind (new / stalled), whether it is hot, and
      // which rep holds it — null when none was written (a referred signup,
      // or one older than the floor).
      lead,
      // Where the person got to and when they were last seen — off the lead
      // behind the company, else the company's own creation. Only for an
      // UNFINISHED company: a finished trial got to the end, and "got as far
      // as Checkout" about it was the false sentence this change removes.
      // (An unfinished company with no lead keeps the "Checkout" fallback:
      // on the old flow a company was only ever created at the card step.)
      finished,
      stepReached: finished ? null : c.signupLead?.stepReached || "checkout",
      stepLabel: finished ? null : STEP_LABELS[c.signupLead?.stepReached] || "Checkout",
      trial: access
        ? { level: access.level, daysLeft: access.daysLeft, endsAt: access.trialEndsAt }
        : null,
      dismissed: dismissalOf(c),
      lastSeenAt: c.signupLead?.lastSeenAt && c.signupLead.lastSeenAt > c.createdAt ? c.signupLead.lastSeenAt : c.createdAt,
      trade: tradeOf({ prospectTradeKey: lead?.tradeKey || null, slugs: c.industries?.length ? c.industries : c.signupLead?.trades || [] }),
      // A rep's own signup (their link attributed it): shown as theirs,
      // never offered to anyone else.
      referredTo: referredRepId ? { id: referredRepId, name: repName.get(referredRepId) || "a rep" } : c.referredByCode ? { id: null, name: null, code: c.referredByCode } : null,
      nudges: nudgesFor(c.email, c.signupNudgeSentAt),
    };
  };
  const signups = incompleteRows.map((c) => companyRow(c, { finished: false }));
  const trials = trialRows.map((c) => companyRow(c, { finished: true }));

  // ── Started, never finished ─────────────────────────────────────────────
  //
  // The SignupLead rows (lib/signup/leads.js): what people typed into the
  // first step and where each one now stands on the floor. Newest first,
  // bounded — this is a list a person reads, not an export.
  // (The holders' names were read above, with the do-not-contact list.)
  const started = startedRows.map((r) => {
    const p = r.prospect || null;
    const dncRow = dnc.get(`lead:${r.id}`);
    const holder = signupHolderOf({ prospect: p, referredRep: repOwnOf(r), dnc: dncRow, dismissed: isDismissed(r), repName, now });
    const live = p?.assignedRepId && (!p.claimExpiresAt || p.claimExpiresAt > now);
    let state;
    if (r.promotedLeadId && r.referredRep) state = { code: "rep_lead", rep: r.referredRep };
    else if (p && live) state = { code: "assigned", rep: { id: p.assignedRepId, name: repName.get(p.assignedRepId) || "a rep", at: p.assignedAt }, hot: p.hot };
    else if (p) state = { code: "unassigned", hot: p.hot };
    else if (r.skipReason) state = { code: "skipped", reason: r.skipReason, matchedCompanyId: r.skipReason === "company_exists" ? r.completedCompanyId : null };
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
      // A login exists for this address (the capture arrived on its
      // session) and no company does — the state the signup page resumes
      // into. Shown so a rep ringing them knows they can just sign in.
      signedIn: Boolean(r.authUserId),
      referredBy: r.referredRep || (r.salesCode ? { id: null, name: null, code: r.salesCode } : null),
      prospectId: p?.id || null,
      state,
      trade: tradeOf({ prospectTradeKey: p?.tradeKey || null, slugs: r.trades }),
      nudges: nudgesFor(r.email),
      dismissed: dismissalOf(r),
      ...dncFields(dncRow),
      holder,
      history: p ? histories.get(p.id) || [] : [],
      actions: actionsFor({ holder, dnc: dncRow, dismissed: isDismissed(r), referred: Boolean(r.referredRep || r.salesCode) }),
    };
  });

  return NextResponse.json({
    signups,
    trials,
    started,
    // The picker on the screen, and the trades a row's words may be set to.
    reps,
    trades: discoveryTradeKeys().map((key) => ({ key, label: discoveryTradeLabel(key) })),
    // Printed on the screen so the delay is stated where somebody reads it
    // rather than only in a source comment.
    policy: { delayHours: NUDGE_DELAY_HOURS, windowDays: NUDGE_WINDOW_DAYS, earlyMinutes: EARLY_NUDGE_DELAY_MINUTES },
  });
}
