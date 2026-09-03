// app/api/platform/sales-agent/route.js
//
// FieldQuo's own phone agent: what it knows, whether it is live, and what it
// has been told on the phone.
//
// ── Writing is correct here, unlike most of /platform ──────────────────────
//
// The non-negotiable is that the platform console views everything and edits
// NOTHING on a COMPANY's data. None of this is a company's data: the agent, its
// tone notes, its on/off switch and its call log belong to FieldQuo, exactly
// like the feature registry next door and the demo calendar. If this route were
// read-only the switch would be a label and the provision button a lie.
//
// What it must never do — and does not — is write to a tenant table. It touches
// PlatformVoiceAgent, and the attach only ever names a number listed in
// FIELDQUO_SALES_NUMBER; a number a company holds is refused rather than
// detached, so a typo here cannot silence a contractor's phone.
//
// ── Superadmin only ────────────────────────────────────────────────────────
//
// Behind the platform-token check in middleware.js and checked again here —
// hiding a screen is not access control. Tighter than a plain admin read
// deliberately: this returns FieldQuo's exact plan prices, the full internal
// feature list including previews, and the transcripts of sales calls.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { getAppOrigin } from "@/lib/appUrl";
// Kept out of this file deliberately: it reads VoicePhoneNumber, and
// check-sales-agent asserts this route names no tenant model at all.
import { salesNumberCandidates } from "@/lib/platform/salesNumberCandidates";
import {
  buildSalesAgentConfig,
  checkSalesReadiness,
  provisionSalesAgent,
  saveSalesAgentSettings,
  syncSalesNumberAttachment,
  SALES_CONTACT_URL,
} from "@/lib/platform/salesAgent";
import { recentSalesCalls } from "@/lib/platform/salesCall";
import { READINESS_LINKS } from "@/lib/voice/readinessCopy";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function requireSuperadmin(request) {
  const me = await getCurrentPlatformAdmin(request);
  if (!me) return { error: bad("Unauthorized", 401) };
  if (me.role !== "superadmin") return { error: bad("Forbidden", 403) };
  return { me };
}

export async function GET(request) {
  const { error } = await requireSuperadmin(request);
  if (error) return error;

  const origin = getAppOrigin(request);

  // Sequential rather than parallel: checkSalesReadiness builds the config
  // itself to compare against what Retell holds, and running both at once would
  // read the Plan rows twice for one page.
  const config = await buildSalesAgentConfig({ origin });
  const [readiness, calls] = await Promise.all([
    checkSalesReadiness(origin),
    recentSalesCalls(50),
  ]);

  // Only when there is nothing set. On a healthy screen this is a provider
  // round-trip that could tell nobody anything.
  const candidates = readiness.number ? null : await salesNumberCandidates();

  return NextResponse.json({
    readiness,
    candidates,
    linkOrder: READINESS_LINKS,
    knowledge: config.knowledge,
    // The literal strings, not a summary of them. The question this screen
    // answers is "what does it know?", and a paraphrase would be another copy.
    prompt: config.prompt,
    greeting: config.greeting,
    notes: config.notes,
    enabled: Boolean(config.row?.enabled),
    tools: config.llmPayload.general_tools.map((t) => ({ name: t.name, type: t.type })),
    agentPayload: config.agentPayload,
    contactUrl: SALES_CONTACT_URL,
    calls: calls.map((c) => ({
      id: c.id,
      providerCallId: c.providerCallId,
      direction: c.direction,
      fromE164: c.fromE164,
      toE164: c.toE164,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      durationSec: c.durationSec,
      disposition: c.disposition,
      summary: c.summary,
      recordingUrl: c.recordingUrl,
      transcript: c.transcript,
    })),
  });
}

/**
 * Three actions, all of them FieldQuo's own.
 *
 *   save       the on/off switch and the tone notes
 *   provision  push the derived prompt and tools to the provider
 *   attach     make the number match the switch, without a full push
 *
 * `save` re-attaches on its own, because a switch that changes a column and
 * leaves the agent answering is the dead control this whole area exists to
 * stop. Attachment IS the on/off switch at the provider.
 */
export async function POST(request) {
  const { error } = await requireSuperadmin(request);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return bad("Bad payload");
  }

  const action = body?.action;
  const origin = getAppOrigin(request);

  if (action === "save") {
    await saveSalesAgentSettings({ enabled: body.enabled, notes: body.notes });
    // The notes are part of the prompt, so saving them has to reach the
    // provider or the screen says one thing and the phone says another — the
    // same reason lib/voice/provision.js pushes on every save rather than only
    // on create. Skipped only when nothing has ever been provisioned.
    const result = await provisionSalesAgent(origin);
    return NextResponse.json({ ok: true, provision: result });
  }

  if (action === "provision") {
    const result = await provisionSalesAgent(origin);
    return result.ok
      ? NextResponse.json({ ok: true, ...result })
      : bad(`Couldn't push to the provider: ${result.reason}`, 502);
  }

  if (action === "attach") {
    const result = await syncSalesNumberAttachment();
    return result.ok
      ? NextResponse.json({ ok: true, ...result })
      : bad(`Couldn't set the number: ${result.reason || "see the results"}`, 502);
  }

  return bad("Unknown action");
}
