// app/api/cron/voice-resync/route.js
//
// Push the current instructions to every agent still running an old copy.
//
// ══ The hole this closes ═══════════════════════════════════════════════════
//
// An agent was only ever re-provisioned when somebody saved Settings > Voice.
// That was fine while the prompt changed only because THEY changed it, and
// wrong the moment we started improving the prompt in code.
//
// It was found the hard way. Four prompt fixes shipped in one afternoon — the
// agent was told to stop claiming bookings it had not made, to ask for an
// email, to call save_caller on every call — and the owner's next four test
// calls behaved exactly as before, because the agent had last been provisioned
// at 19:45 and every commit landed after it. Every contractor's receptionist
// runs whatever we wrote on the day they last pressed Save, and most of them
// will never press it again.
//
// ══ Why a hash and not a timestamp ═════════════════════════════════════════
//
// A deploy timestamp would re-push every agent on every deploy, including the
// deploys that touched nothing about the prompt — hundreds of provider writes
// to change nothing. The fingerprint covers the prompt, the greeting and the
// tools, so a run is silent unless something a caller would actually notice has
// changed. See instructionsHash in lib/voice/provision.js.
//
// ══ Bounded on purpose ═════════════════════════════════════════════════════
//
// MAX_PER_RUN caps the provider writes one run can make. A prompt change is
// company-wide by definition, so without a cap the first run after a deploy
// would try to rewrite every agent at once and rate-limit itself into a
// half-finished state that is hard to reason about. It runs hourly and catches
// up; a company that waits an extra hour for a better prompt has lost nothing.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { getAppOrigin } from "@/lib/appUrl";
import { voiceConfigured } from "@/lib/voice/retell";
import { buildAgentConfig, provisionAgent, instructionsHash } from "@/lib/voice/provision";
import { recordError } from "@/lib/platform/errorLog";

const MAX_PER_RUN = 25;
export const AREA = "voice_resync";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  // No key, nothing to push. Not an error — it is the normal state of a
  // deployment that has not bought voice.
  if (!voiceConfigured()) {
    return NextResponse.json({ ok: true, skipped: "not_configured" });
  }

  // ── The origin has to be the STABLE one ─────────────────────────────────
  //
  // buildAgentConfig bakes the origin into every tool URL, so a run against a
  // preview deployment would point every contractor's agent at a preview host
  // that stops existing. getAppOrigin with no request returns the configured
  // NEXT_PUBLIC_APP_URL and nothing else, which is exactly the guarantee needed
  // here — and if it is unset we refuse rather than guess.
  const origin = getAppOrigin();
  if (!origin || !/^https:\/\//.test(origin)) {
    await recordError({
      area: AREA,
      code: "no_stable_origin",
      message: "voice-resync has no stable NEXT_PUBLIC_APP_URL to build tool URLs from",
    }).catch(() => {});
    return NextResponse.json({ ok: false, reason: "no_stable_origin" }, { status: 200 });
  }

  // Only agents that actually exist at the provider and are switched on. A
  // company that has never provisioned has nothing to drift from, and one that
  // has switched the receptionist off should not have it rewritten underneath
  // them.
  const agents = await db.voiceAgent.findMany({
    where: { enabled: true, providerAgentId: { not: null } },
    select: { companyId: true, provisionedHash: true },
  });

  let checked = 0;
  let resynced = 0;
  let failed = 0;
  const drifted = [];

  for (const agent of agents) {
    if (resynced >= MAX_PER_RUN) break;
    checked += 1;

    let want;
    try {
      want = await buildAgentConfig(agent.companyId, origin);
    } catch {
      // A company whose config cannot even be built is a data problem, not a
      // sync problem. Skipped rather than counted as failed — provisioning it
      // would fail for the same reason and take a provider write to find out.
      continue;
    }

    const hash = instructionsHash(want.llmPayload);
    // Null means "pushed before the fingerprint existed", which is drift until
    // proven otherwise: it is the state every agent was in when this shipped.
    if (agent.provisionedHash === hash) continue;

    drifted.push(agent.companyId);
    try {
      const res = await provisionAgent(agent.companyId, origin);
      if (res?.ok) resynced += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      await recordError({
        area: AREA,
        code: "resync_failed",
        message: `Could not resync voice agent for ${agent.companyId}: ${err?.message}`,
      }).catch(() => {});
    }
  }

  // 200 even with failures: the cron itself worked, and a red cron over one
  // company's bad config would hide the runs that are fine. The count is the
  // signal, and recordError already carries the detail.
  return NextResponse.json({
    ok: true,
    checked,
    drifted: drifted.length,
    resynced,
    failed,
    capped: drifted.length > MAX_PER_RUN,
  });
}
