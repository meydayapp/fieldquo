// app/api/platform/voice-webhooks/route.js
//
//   GET   — which agents are posting call events somewhere real, and which are not
//   POST  — repoint the broken ones at this deployment
//
// ══ Why this route exists ══════════════════════════════════════════════════
//
// /platform reported "calls billed by the hourly reconciler because Retell's
// webhook never delivered them" and gave nobody a way to act on it. The cause
// is documented in lib/voice/readiness.js: an agent provisioned from a preview
// URL or a laptop keeps that origin's webhook_url forever, so the phone answers
// and the events go nowhere. This is the audit and the fix.
//
// ══ Superadmin, and read-only on tenant data ═══════════════════════════════
//
// Non-negotiable #3 — the platform console views everything and edits nothing
// on a company's data — is not violated here, and the distinction is worth
// stating rather than assuming. Nothing on a Company, a Quote, a Job or a
// VoiceAgent row is written. What changes is a field on FieldQuo's OWN object
// at FieldQuo's OWN provider account, pointing it back at FieldQuo's own
// server. The contractor's data is untouched; only where OUR events are
// delivered changes.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { voiceConfigured, getAgent, updateAgent } from "@/lib/voice/retell";
import { originIsStable } from "@/lib/voice/readiness";
import {
  expectedWebhookUrl,
  webhookVerdict,
  mayRepair,
  summarise,
} from "@/lib/voice/webhookAudit";

const DAYS = 7;

/** Every company with an agent to check, plus how badly it is already hurting. */
async function agentsToCheck() {
  const agents = await db.voiceAgent.findMany({
    where: { providerAgentId: { not: null } },
    select: {
      companyId: true,
      providerAgentId: true,
      outboundProviderAgentId: true,
      company: { select: { name: true } },
    },
  });

  // Recovered calls are the SYMPTOM, counted per company so the screen can lead
  // with the ones actually losing events rather than an alphabetical list.
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const recovered = await db.voiceCall.groupBy({
    by: ["companyId"],
    where: { recoveredAt: { not: null, gte: since } },
    _count: { _all: true },
  });
  const byCompany = new Map(recovered.map((r) => [r.companyId, r._count._all]));

  return agents.map((a) => ({ ...a, recoveredCalls: byCompany.get(a.companyId) || 0 }));
}

/** Read one agent back off the provider and judge it. Never throws. */
async function inspect(agentId, expected) {
  if (!agentId) return null;
  try {
    const res = await getAgent(agentId);
    const holds = res?.webhook_url ?? null;
    return { agentId, holds, ...webhookVerdict(holds, expected) };
  } catch (err) {
    // A failed READ is "unknown", never "wrong". Repairing on the strength of a
    // timeout would rewrite a healthy agent because the network hiccupped.
    return { agentId, holds: null, state: "unknown", reason: "unreadable", message: err?.message || null };
  }
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!voiceConfigured()) {
    // Not an error: it is the normal state of a deployment with no key, and it
    // is a different sentence from "every agent is fine".
    return NextResponse.json({ configured: false, reason: "not_configured", rows: [] });
  }

  const origin = new URL(request.url).origin;
  const expected = expectedWebhookUrl(origin);
  const stable = originIsStable(origin);
  const repair = mayRepair({ originStable: stable, expected });

  const rows = [];
  for (const a of await agentsToCheck()) {
    const inbound = await inspect(a.providerAgentId, expected);
    const outbound = await inspect(a.outboundProviderAgentId, expected);
    rows.push({
      companyId: a.companyId,
      companyName: a.company?.name || null,
      recoveredCalls: a.recoveredCalls,
      agents: [inbound, outbound].filter(Boolean),
    });
  }

  const verdicts = rows.flatMap((r) => r.agents);
  return NextResponse.json({
    configured: true,
    // What this deployment WOULD write, shown whether or not it may — a
    // superadmin reading this from a preview needs to see the URL that made
    // the tool refuse, or the refusal is unexplainable.
    expected,
    originStable: stable,
    canRepair: repair.allowed,
    repairRefusedBecause: repair.allowed ? null : repair.reason,
    summary: summarise(verdicts),
    // Worst first: the companies actually losing call events lead.
    rows: rows.sort(
      (x, y) =>
        y.recoveredCalls - x.recoveredCalls ||
        y.agents.filter((g) => g.state === "wrong").length -
          x.agents.filter((g) => g.state === "wrong").length,
    ),
  });
}

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!voiceConfigured()) {
    return NextResponse.json(
      { error: "The phone provider isn't configured on this deployment.", reason: "not_configured" },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const expected = expectedWebhookUrl(origin);
  const gate = mayRepair({ originStable: originIsStable(origin), expected });
  if (!gate.allowed) {
    // ── The refusal that makes this tool safe ────────────────────────────
    //
    // Repairing from a preview or a laptop would point EVERY live agent at an
    // address that stops existing the moment that deployment is torn down —
    // the exact fault this route exists to repair, inflicted on every tenant
    // at once and by the tool meant to fix it.
    return NextResponse.json(
      {
        error:
          "Run this from the live site. Repairing from a preview deployment or a laptop would point every agent at an address that stops existing.",
        reason: gate.reason,
        wouldHaveWritten: expected,
      },
      { status: 409 },
    );
  }

  const results = [];
  for (const a of await agentsToCheck()) {
    for (const agentId of [a.providerAgentId, a.outboundProviderAgentId]) {
      const seen = await inspect(agentId, expected);
      if (!seen) continue;
      // Only the broken ones. An agent already pointing at the right place is
      // left alone rather than rewritten to the same value, so the count this
      // returns is a count of things that actually changed.
      if (seen.state !== "wrong") {
        results.push({ companyId: a.companyId, agentId, changed: false, state: seen.state });
        continue;
      }
      try {
        await updateAgent(agentId, { webhook_url: expected });
        // Read back rather than trusting the 200. A success status from
        // somebody else's service is not evidence of a state — the same rule
        // lib/voice/numberRelease.js follows before it will call a number
        // released.
        const after = await inspect(agentId, expected);
        results.push({
          companyId: a.companyId,
          agentId,
          changed: after?.state === "ok",
          was: seen.holds,
          now: after?.holds ?? null,
          state: after?.state ?? "unknown",
        });
      } catch (err) {
        results.push({
          companyId: a.companyId,
          agentId,
          changed: false,
          state: "failed",
          message: err?.message || null,
        });
      }
    }
  }

  return NextResponse.json({
    expected,
    repaired: results.filter((r) => r.changed).length,
    alreadyOk: results.filter((r) => !r.changed && r.state === "ok").length,
    failed: results.filter((r) => r.state === "failed" || r.state === "unknown").length,
    results,
  });
}
