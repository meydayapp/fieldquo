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
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { voiceConfigured } from "@/lib/voice/retell";
import { provisionAgent } from "@/lib/voice/provision";
import { getAppOrigin } from "@/lib/appUrl";
import { activeNumber, publicNumberFor, formatNumber, NUMBER_SOURCES, forwardingCodes } from "@/lib/voice/numbers";
import {
  balanceFor,
  minutesFor,
  ratePerMinute,
  monthlyCentsFor,
  NUMBER_TYPES,
  TOPUP_OPTIONS,
  LOW_BALANCE_CENTS,
  FREE_TRIAL_MINUTES,
  recentEntries,
} from "@/lib/voice/credits";

async function requireAdmin(request) {
  const member = await getCurrentMember(request);
  if (!member) return { error: "Unauthorized", status: 401 };
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

  const [agent, number, cents, entries, company, queuedCalls] = await Promise.all([
    db.voiceAgent.findUnique({ where: { companyId: member.companyId } }),
    activeNumber(member.companyId),
    balanceFor(member.companyId),
    recentEntries(member.companyId, 20),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { outboundCallsEnabled: true, crewInboxEnabled: true },
    }),
    db.voiceCallTask.count({ where: { companyId: member.companyId, status: "queued" } }),
  ]);

  const type = number?.numberType || "local";
  const publicNum = publicNumberFor(number);

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
          // Only for a forwarded setup — the codes are useless otherwise, and
          // showing them next to a number they bought from us invites someone
          // to forward their new number to itself.
          forwarding: number.source === "forwarded" ? forwardingCodes(number.e164) : null,
        }
      : null,
    credit: {
      cents,
      minutes: minutesFor(cents, type),
      low: cents < LOW_BALANCE_CENTS,
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
      numberTypes: Object.values(NUMBER_TYPES).map((t) => ({
        ...t,
        perMinuteCents: ratePerMinute(t.key),
        monthlyCents: monthlyCentsFor(t.key),
      })),
      freeTrialMinutes: FREE_TRIAL_MINUTES,
    },
    sources: NUMBER_SOURCES,
    // Calls WE place, not just ones we answer. The queued count is read from the
    // same column the cron drains, so "3 waiting" can't drift from what will
    // actually go out.
    outbound: {
      enabled: Boolean(company?.outboundCallsEnabled),
      queued: queuedCalls,
    },
    crewInbox: {
      enabled: Boolean(company?.crewInboxEnabled),
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
      const [number, cents] = await Promise.all([
        activeNumber(member.companyId),
        balanceFor(member.companyId),
      ]);
      if (!number || number.status !== "active") {
        return NextResponse.json(
          { error: "Set up a phone number first — there's nothing for it to answer on." },
          { status: 409 },
        );
      }
      if (cents < ratePerMinute(number.numberType)) {
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
      const [number, cents] = await Promise.all([
        activeNumber(member.companyId),
        balanceFor(member.companyId),
      ]);
      if (!number || number.status !== "active") {
        return NextResponse.json(
          { error: "Set up a phone number first — there's nothing to call from." },
          { status: 409 },
        );
      }
      if (cents < ratePerMinute(number.numberType)) {
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
  if (typeof body.crewInboxEnabled === "boolean") {
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
