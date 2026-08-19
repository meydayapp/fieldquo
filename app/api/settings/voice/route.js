// app/api/settings/voice/route.js
//
// The AI receptionist, from the company's side.
//
//   GET   everything the settings screen needs in one call
//   PUT   the agent's persona and whether it's on
//
// Owners and admins only. This decides what a stranger hears when they ring the
// business — an employee with quote access has no business changing it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { voiceConfigured } from "@/lib/voice/retell";
import { provisionAgent } from "@/lib/voice/provision";
import { getAppOrigin } from "@/lib/appUrl";
import { activeNumber, heldNumber, publicNumberFor, formatNumber, NUMBER_SOURCES, forwardingCodes } from "@/lib/voice/numbers";
import {
  balanceFor,
  minutesFor,
  ratePerMinute,
  monthlyCentsFor,
  NUMBER_TYPES,
  TOPUP_OPTIONS,
  isLowBalance,
  FREE_TRIAL_MINUTES,
  recentEntries,
  trialGranted,
} from "@/lib/voice/credits";
import {
  spendVerdict,
  checkSpend,
  rentStatus,
  RENT_GRACE_DAYS,
} from "@/lib/voice/spendGate";

async function requireAdmin(request) {
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) return refusal;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return { error: "Only an owner or admin can change the receptionist.", status: 403 };
  }
  return { member };
}

export async function GET(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const [agent, number, cents, entries, company, queuedCalls, trialUsed] = await Promise.all([
    db.voiceAgent.findUnique({ where: { companyId: member.companyId } }),
    // heldNumber, not activeNumber. The screen has to show a row stuck on the
    // old `provisioning` default: that number was bought, it exists at the
    // provider, and the company is being charged for it. Showing nothing is
    // what made the contractor press "Set it up" a second time.
    heldNumber(member.companyId),
    balanceFor(member.companyId),
    recentEntries(member.companyId, 20),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { outboundCallsEnabled: true, crewInboxEnabled: true },
    }),
    db.voiceCallTask.count({ where: { companyId: member.companyId, status: "queued" } }),
    trialGranted(member.companyId),
  ]);

  const type = number?.numberType || "local";
  const publicNum = publicNumberFor(number);

  // ── Why the switches can't be turned on, decided HERE ────────────────────
  //
  // The same call to checkSpend the PUT gate makes, so the reason shown beside a
  // disabled button is the reason the route would actually give. The page used
  // to re-derive this from `number.status` and a raw balance comparison, which
  // drifted two ways at once: it used the local per-minute rate on a toll-free
  // line, and it rendered "set up a number and add credit" to a company that was
  // looking at their own number on the same screen.
  //
  // A disabled control with no reason is the dead-control class in AGENTS.md.
  // This is the reason, in the company's own words, computed where the gate is.
  const callAfford = number
    ? await checkSpend({ companyId: member.companyId, kind: "call", numberType: type })
    : null;
  const readiness = !number
    ? { ready: false, reason: "no_number", message: "Set up a number above first — there's nothing for it to answer on." }
    : number.status === "porting"
      ? {
          ready: false,
          reason: "porting",
          message: number.portExpectedAt
            ? `Your number is still being moved over from your old provider — expected around ${new Date(number.portExpectedAt).toLocaleDateString("en-CA", { day: "numeric", month: "long" })}. Nothing can answer on it until it lands.`
            : "Your number is still being moved over from your old provider. Nothing can answer on it until it lands.",
        }
      : number.status !== "active"
        ? {
            ready: false,
            reason: "number_not_active",
            message: "Your number hasn't finished activating. Get in touch — this one needs a person.",
          }
        : callAfford?.allowed
          ? { ready: true, reason: "ok", message: null }
          : callAfford?.reason === "feature_unavailable"
            ? {
                ready: false,
                reason: "feature_unavailable",
                message: "The phone receptionist isn't available on this account. Get in touch and we'll look at it.",
              }
            : {
                ready: false,
                reason: "insufficient_balance",
                message: `Add credit first — a call costs ${ratePerMinute(type)}¢ a minute and your balance is $${(cents / 100).toFixed(2)}. It would pick up and fail.`,
              };

  return NextResponse.json({
    // Said out loud rather than failing mysteriously. Locally there's no key,
    // and "not set up yet" is a state the screen has to render, not an error.
    configured: voiceConfigured(),
    agent: agent
      ? {
          enabled: agent.enabled,
          name: agent.name,
          greeting: agent.greeting,
          instructions: agent.instructions,
          transferTo: agent.transferTo,
          provisioned: Boolean(agent.providerAgentId),
        }
      : null,
    number: number
      ? {
          e164: number.e164,
          display: formatNumber(publicNum),
          publicNumber: publicNum,
          source: number.source,
          status: number.status,
          numberType: type,
          monthlyCents: number.monthlyCents,
          portExpectedAt: number.portExpectedAt,
          // What the rental is doing right now — when it next comes out, and
          // whether the balance covers it. Derived by the gate so "past due"
          // means the same thing here, in the warning email and in the cron.
          rent: rentStatus(number, cents),
          // Only for a forwarded setup — the codes are useless otherwise, and
          // showing them next to a number they bought from us invites someone
          // to forward their new number to itself.
          forwarding: number.source === "forwarded" ? forwardingCodes(number.e164) : null,
        }
      : null,
    credit: {
      cents,
      minutes: minutesFor(cents, type),
      low: isLowBalance(cents),
      centsPerMinute: ratePerMinute(type),
      entries: entries.map((e) => ({
        cents: e.cents,
        kind: e.kind,
        note: e.note,
        at: e.createdAt,
      })),
    },
    pricing: {
      topups: TOPUP_OPTIONS,
      // Each type carries its own affordability verdict, priced HERE from our
      // own rows. The browser never posts an amount and never decides whether
      // one is affordable — it renders the answer it was given, so the button it
      // shows and the gate the route enforces cannot disagree.
      numberTypes: Object.values(NUMBER_TYPES).map((t) => ({
        ...t,
        perMinuteCents: ratePerMinute(t.key),
        monthlyCents: monthlyCentsFor(t.key),
        afford: spendVerdict({ kind: "number_setup", numberType: t.key, balanceCents: cents }),
      })),
      freeTrialMinutes: FREE_TRIAL_MINUTES,
      // Whether the gift is still available. Once per company, forever — so a
      // second number after a release gets none, and the screen shouldn't offer
      // what the ledger will refuse.
      freeTrialAvailable: !trialUsed,
      graceDays: RENT_GRACE_DAYS,
    },
    sources: NUMBER_SOURCES,
    // Whether the two call switches can be turned on, and — when they can't —
    // the sentence to print underneath them. See above.
    readiness,
    // Calls WE place, not just ones we answer. The queued count is read from the
    // same column the cron drains, so "3 waiting" can't drift from what will
    // actually go out.
    outbound: {
      enabled: Boolean(company?.outboundCallsEnabled),
      queued: queuedCalls,
    },
    crewInbox: {
      enabled: Boolean(company?.crewInboxEnabled),
      // ── The number crew must text, which is NOT always the one on the van ──
      //
      // `/api/crew/inbound` resolves the company from the `To` of the SMS, and
      // it matches on VoicePhoneNumber.e164 — OURS. On a forwarded setup the
      // number the company advertises is theirs, sitting at their own carrier,
      // and carrier call-forwarding forwards CALLS only: a text to it never
      // reaches us and never will.
      //
      // So the screen has to name the right number explicitly. Telling a crew
      // "text the office" is the version of this that silently loses photos.
      textTo: number?.status === "active" ? number.e164 : null,
      textToDiffersFromPublic: Boolean(
        number?.status === "active" && publicNum && publicNum !== number.e164,
      ),
    },
  });
}

export async function PUT(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json().catch(() => ({}));
  const data = {};

  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 80) || "Receptionist";
  if (typeof body.greeting === "string") data.greeting = body.greeting.trim().slice(0, 300) || null;
  if (typeof body.instructions === "string")
    data.instructions = body.instructions.trim().slice(0, 4000) || null;
  if (typeof body.transferTo === "string") data.transferTo = body.transferTo.trim().slice(0, 40) || null;

  if (typeof body.enabled === "boolean") {
    // ── Turning it ON is gated ──────────────────────────────────────────
    //
    // A switch that flips to "on" and then doesn't answer is the worst kind of
    // broken: the company believes their calls are covered and finds out from a
    // customer who rang and got nothing.
    if (body.enabled) {
      const number = await activeNumber(member.companyId);
      if (!number || number.status !== "active") {
        return NextResponse.json(
          { error: "Set up a phone number first — there's nothing for it to answer on." },
          { status: 409 },
        );
      }
      // Through the gate rather than a hand-rolled comparison. The old inline
      // check used the LOCAL per-minute rate on a toll-free number, so a company
      // with 35¢ could switch on a line whose first minute costs 40¢.
      const afford = await checkSpend({
        companyId: member.companyId,
        kind: "call",
        numberType: number.numberType,
      });
      if (!afford.allowed) {
        return NextResponse.json(
          { error: "Add some credit first, or it won't be able to take a call." },
          { status: 409 },
        );
      }
    }
    data.enabled = body.enabled;
  }

  // ── Outbound calls — a separate switch, on the Company ──────────────────
  //
  // Kept apart from the receptionist toggle because they're different consent
  // stories: answering a call the customer placed is nothing like placing one
  // they didn't. Turning it ON needs the same number-and-credit floor as the
  // receptionist — a switch that promises calls it can't make is the dead
  // control this codebase keeps deleting.
  if (typeof body.outboundCallsEnabled === "boolean") {
    if (body.outboundCallsEnabled) {
      const number = await activeNumber(member.companyId);
      if (!number || number.status !== "active") {
        return NextResponse.json(
          { error: "Set up a phone number first — there's nothing to call from." },
          { status: 409 },
        );
      }
      const afford = await checkSpend({
        companyId: member.companyId,
        kind: "call",
        numberType: number.numberType,
      });
      if (!afford.allowed) {
        return NextResponse.json(
          { error: "Add some credit first, or no call can be placed." },
          { status: 409 },
        );
      }
    }
    await db.company.update({
      where: { id: member.companyId },
      data: { outboundCallsEnabled: body.outboundCallsEnabled },
    });
    await recordActivity(member, {
      action: body.outboundCallsEnabled ? "voice.outbound.enabled" : "voice.outbound.disabled",
      entityType: "settings",
      summary: body.outboundCallsEnabled
        ? "Turned on automatic calls to confirm approved quotes"
        : "Turned off automatic outbound calls",
    });
  }

  // ── Crew inbox — crew text photos/updates in, they file to the job ──────
  //
  // Inbound only, and gated on a LIVE number. /api/crew/inbound resolves the
  // company by the texted number with `status: "active"`, so switching this on
  // without one sets a flag no message can ever reach — the switch reads "on"
  // and every crew photo goes nowhere. Same floor as the two call switches, for
  // the same reason.
  //
  // Note what this switch does NOT do: nothing is sent to anybody when it is
  // enabled. There is no invitation, no announcement, no outbound message of any
  // kind. The company has to tell their crew the number themselves. The screen
  // says so, because "turn on the crew inbox" reads like it does the inviting.
  if (typeof body.crewInboxEnabled === "boolean") {
    if (body.crewInboxEnabled) {
      const number = await activeNumber(member.companyId);
      if (!number || number.status !== "active") {
        return NextResponse.json(
          { error: "Set up a number first — the crew inbox is texts sent to it, and there's nothing for them to text yet." },
          { status: 409 },
        );
      }
    }
    await db.company.update({
      where: { id: member.companyId },
      data: { crewInboxEnabled: body.crewInboxEnabled },
    });
    await recordActivity(member, {
      action: body.crewInboxEnabled ? "crew_inbox.enabled" : "crew_inbox.disabled",
      entityType: "settings",
      summary: body.crewInboxEnabled
        ? "Turned on the crew photo/update inbox"
        : "Turned off the crew inbox",
    });
  }

  const agent = await db.voiceAgent.upsert({
    where: { companyId: member.companyId },
    create: { companyId: member.companyId, ...data },
    update: data,
  });

  // ── Push to the provider ────────────────────────────────────────────────
  //
  // On EVERY save, not just the first. The agent at Retell is a cache of what's
  // in our database; not pushing leaves a settings screen that says one thing
  // and a phone that says another, which is worse than the save failing because
  // nobody knows.
  //
  // Best-effort: the local save has already happened and must stand. A failed
  // push is logged and the response says so, rather than rolling back an edit
  // the company can see they made.
  let pushed = { ok: false, reason: "not_attempted" };
  if (voiceConfigured()) {
    pushed = await provisionAgent(member.companyId, getAppOrigin(request));
  }

  if (typeof body.enabled === "boolean") {
    await recordActivity(member, {
      action: body.enabled ? "voice.enabled" : "voice.disabled",
      entityType: "settings",
      summary: body.enabled ? "Turned the phone receptionist on" : "Turned the phone receptionist off",
    });
  }

  return NextResponse.json({
    ok: true,
    enabled: agent.enabled,
    // Surfaced rather than swallowed. "Saved, but the phone hasn't picked it up
    // yet" is a state the company needs to know about.
    live: pushed.ok,
    liveError: pushed.ok ? null : pushed.reason,
  });
}
