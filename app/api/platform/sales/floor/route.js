// app/api/platform/sales/floor/route.js
//
// The sales floor, live: who is on a call, who is writing one up, who is
// paused and for how long — and what the day's calls actually came to.
//
// ══ Read-only here; the actions are their own route ═══════════════════════
//
// Since 2026-09-21 the board has controls — Listen, Whisper, Barge, Take on
// a live row (app/api/platform/sales/supervision) — but THIS route still
// only reads: it says what each rep's live call is and whether supervision
// is switched on. Superadmin-only, as it always was.
//
// Behind the platform-token check in middleware.js and checked again here,
// because hiding a screen is not access control. Tighter than a plain admin
// read for the same reason /api/platform/sales/performance is: this returns
// every rep's activity, their pause reasons and what they said happened on
// each call. `admin.role !== "superadmin"` is tested directly rather than
// through a permission key, following the precedent
// app/api/platform/sales/reps/route.js sets and explains — PLATFORM_PERMISSIONS
// has no sales permission, and adding one would imply the map has a scoping
// concept it does not have.
//
// ══ The team-lead version exists now, and it is the agency's ═══════════════
//
// This header said, until 2026-09-16, that `SalesRep.managerId` had no
// writer and so a team-scoped board would show an empty team and call it a
// floor. The column's first writer is lib/sales/agency.js: a call-centre
// agency adds its own reps with itself as their manager, and
// /api/sales/agency/floor draws THIS board narrowed to that team through
// lib/sales/team.js's visibleRepIds(). The reads live in
// lib/sales/calls/floorBoard.js so the two routes cannot drift; this one
// asks with no scope and adds FieldQuo's own inbound line and number pool,
// which are nobody else's business.
//
// ══ Nothing here is invented when the tables are absent ═══════════════════
//
// The store is probed, not asserted. Without SalesCallAttempt and
// SalesRepActivity this returns `store.ready: false` and the screen says what
// is missing — a floor board full of zeroes reads as a very quiet Tuesday.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { getAppOrigin } from "@/lib/appUrl";
import { db } from "@/lib/db";
import { inboundCalls, salesCallerNumberRows } from "@/lib/sales/calls/store";
import { callerNumberFor } from "@/lib/sales/calls/browserDial";
import { inboundOutcome } from "@/lib/sales/calls/missed";
import {
  inboundWebhookUrl,
  salesVoiceInboundState,
} from "@/lib/sales/calls/inboundRouting";
import { readSalesNumberConfig } from "@/lib/sales/calls/numberConfig";
import { floorBoard } from "@/lib/sales/calls/floorBoard";
import { TEAM_LEAD_CANNOT_SEE } from "@/lib/sales/team";
import { dialModeState } from "@/lib/sales/calls/dialMode";
import { inboundHandling } from "@/lib/sales/calls/inboundMatch";
import { salesAgentRow } from "@/lib/platform/salesAgent";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmins can see the sales floor" },
      { status: 403 },
    );
  }

  const now = new Date();
  // withCosts: this is the one caller that may see what FieldQuo pays for
  // the day's calls — lib/sales/calls/floorBoard.js.
  const board = await floorBoard({ repIds: null, now, withCosts: true });
  const { store, period, reps, states, pauseReasons, campaigns, anyLive, notTracked, serverNow, dialler, table, cost, settings, supervision } = board;
  const { from } = period;

  if (!store.ready) {
    return NextResponse.json({
      store,
      period,
      reps,
      states,
      pauseReasons,
      campaigns: null,
      inbound: null,
      salesVoice: null,
      inboundCalls: null,
      dialMode: dialModeState(),
      notTracked,
      teamLeadCannotSee: TEAM_LEAD_CANNOT_SEE,
      serverNow,
    });
  }

  // Read apart from the board, and by DIRECTION rather than by rep,
  // because an inbound call that matched nobody carries a null salesRepId and
  // the `salesRepId: { in: repIds }` query cannot see it. A stranger ringing
  // FieldQuo's sales line is exactly the row worth noticing, and it would have
  // been the row that silently never appeared.
  //
  // `undefined` on failure rather than [], so the screen can tell "nobody rang
  // today" from "we could not look" — the two are the same empty array and
  // different facts.
  const origin = getAppOrigin(request);
  const [agent, inbound, numberRows, numberConfig] = await Promise.all([
    salesAgentRow().catch(() => null),
    inboundCalls({ from, to: now }).catch(() => undefined),
    salesCallerNumberRows().catch(() => undefined),
    // The numbers' configuration AT TWILIO, cached for ten minutes: the
    // board polls every fifteen seconds and the carrier's number list does
    // not change between polls. Only the count of misconfigured numbers
    // reaches this screen; the table is on /platform/crew-lines.
    cachedNumberConfig(origin, now).catch(() => null),
  ]);
  // inboundCalls() lives in store.js, which the call-outcome work is editing
  // concurrently, so the two columns the outcome needs are read beside it
  // rather than added to its select. One query for the page's hundred rows.
  const voiceNumbers = numberRows === undefined ? undefined : numberRows.map((r) => r.e164);
  // ── The line each rep presents, said per rep ─────────────────────────
  //
  // The same chooser the dial runs (browserDial.js chooseCallerIdFor), so
  // the board says what the next dial will do. A rep with no line of their
  // own and no agency line is shown as having NONE — their dial is refused
  // rather than made from another rep's number — and the owner assigns one
  // on /platform/crew-lines. Null when the numbers could not be read, which
  // is "unknown" and not "none".
  const agencyOf = new Map(reps.map((r) => [r.id, r.agency?.id || null]));
  const repLine = (repId) => {
    if (numberRows === undefined) return null;
    const agency = agencyOf.get(repId);
    const chosen = callerNumberFor({ salesRepId: repId, callerNumbers: numberRows, agencyRepIds: agency ? [agency] : [] });
    return { e164: chosen.e164, rule: chosen.rule };
  };
  const outcomeCols = new Map();
  if (Array.isArray(inbound) && inbound.length) {
    const extra = await db.salesCallAttempt
      .findMany({
        where: { id: { in: inbound.map((r) => r.id) } },
        select: { id: true, answeredAt: true, missedAt: true },
      })
      .catch(() => []);
    for (const row of extra) outcomeCols.set(row.id, row);
  }

  return NextResponse.json({
    store,
    period,
    reps: reps.map((r) => ({ ...r, callerNumber: repLine(r.id) })),
    states,
    pauseReasons,
    campaigns,
    inbound: inboundHandling({
      agentEnabled: Boolean(agent?.enabled),
      canTransfer: Boolean(process.env.FIELDQUO_SALES_TRANSFER_TO),
      anyRepLive: anyLive,
    }),
    // The OTHER inbound path, and deliberately a separate answer: `inbound`
    // above is FIELDQUO_SALES_NUMBER, the one line the Retell agent answers.
    // This is the pool of local numbers reps dial from, which has no agent on
    // it. One sentence covering both would be wrong about both.
    salesVoice: salesVoiceInboundState({
      numbers: voiceNumbers ?? [],
      lookupFailed: voiceNumbers === undefined,
      transferConfigured: Boolean(process.env.FIELDQUO_SALES_TRANSFER_TO),
      anyLive,
      webhookUrl: inboundWebhookUrl(origin),
      misconfigured: numberConfig && !numberConfig.twilioError ? numberConfig.counts.misconfigured : null,
      configUnknown: !numberConfig || Boolean(numberConfig.twilioError),
    }),
    // The per-number table left this screen on 2026-09-17; the link is to
    // where it went. Said as a path rather than rebuilt here.
    numberConfigHref: "/platform/crew-lines#sales-number-configuration",
    // The dialler's numbers, the day's four buckets over everyone and
    // today's cost, with their definitions. lib/sales/calls/reporting.js,
    // dialTable.js, costs.js.
    dialler,
    table,
    cost,
    settings,
    // Live-call supervision: on or off (lib/sales/calls/supervision.js).
    // The buttons on each live row read this; off means they are not drawn
    // and the reason is printed instead.
    supervision: supervision || null,
    inboundCalls:
      inbound === undefined
        ? null
        : inbound.map((row) => ({
            id: row.id,
            at: row.dialledAt,
            fromE164: row.toE164,
            rangE164: row.fromE164,
            // Who it was filed for. Null is a real answer and renders as one:
            // a call from a number nobody has ever dialled from this line.
            repName: row.salesRep?.name || null,
            businessName: row.prospect?.businessName || null,
            matchedBy: row.matchedBy,
            disposition: row.disposition,
            providerStatus: row.providerStatus,
            // "answered" | "voicemail" | "missed" | "open" — the one word the
            // floor needs. lib/sales/calls/missed.js.
            outcome: inboundOutcome({ ...row, ...(outcomeCols.get(row.id) || {}), direction: "in" }),
            missedAt: outcomeCols.get(row.id)?.missedAt || null,
            talkSeconds: row.talkSeconds,
            // Null means no recording stage ran. Zero seconds means one did
            // and nobody spoke — somebody who heard the beep and thought
            // better of it, which is warmer than a missed call and colder than
            // a message. The two must not be collapsed on the way to a screen.
            voicemailUrl: row.voicemailUrl || null,
            voicemailSeconds: Number.isFinite(row.voicemailSeconds) ? row.voicemailSeconds : null,
          })),
    dialMode: dialModeState(),
    notTracked,
    teamLeadCannotSee: TEAM_LEAD_CANNOT_SEE,
    serverNow,
  });
}

// ── The Twilio number list, cached per instance ───────────────────────────
//
// Ten minutes. A misconfigured number stays misconfigured for longer than
// that, and the crew-lines page reads it fresh on every load for anyone who
// has just fixed one and wants to see the tick.
const NUMBER_CONFIG_TTL_MS = 10 * 60 * 1000;
let numberConfigCache = { origin: null, at: 0, value: null };
async function cachedNumberConfig(origin, now) {
  if (numberConfigCache.value && numberConfigCache.origin === origin && now.getTime() - numberConfigCache.at < NUMBER_CONFIG_TTL_MS) {
    return numberConfigCache.value;
  }
  const value = await readSalesNumberConfig({ origin });
  // A failed ask is not cached: the next poll tries again.
  if (!value.twilioError) numberConfigCache = { origin, at: now.getTime(), value };
  return value;
}
