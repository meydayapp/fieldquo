// app/api/voice/calls/recover/route.js
//
// "Recover missed calls" — the same sweep the cron runs, on demand, for one
// company.
//
// ══ Why a button as well as a cron ═════════════════════════════════════════
//
// The cron at /api/cron/voice-reconcile runs at :35 past the hour and covers
// three days. That is the right cadence for a meter, and the wrong one for a
// person: the owner rang his own line last night, opened /app/receptionist this
// morning, and found nothing. "It'll turn up within the hour" is not an answer
// when the honest one is "we lost it, here it is". So there is a control that
// makes it happen now.
//
// It is deliberately NOT a second implementation. This calls
// reconcileVoiceCalls with the same defaults, scoped to the caller's company —
// a separate recovery job asking Retell the same question could disagree with
// the reconciler about what happened, and two answers about billing is worse
// than a slow one.
//
// ══ What is different from the cron ════════════════════════════════════════
//
//   scope   one company. The console must never let one tenant's action write
//           into another's account, so `onlyCompanyId` filters the calls this
//           run touches.
//   leads   ON. Reading a transcript back into a LeadRequest costs a model call
//           against this company's own AI allowance, so it happens when someone
//           asks and never on a schedule they didn't see.
//   window  seven days by default, thirty at most.
//
// ══ How far back ═══════════════════════════════════════════════════════════
//
// Seven days rather than the cron's three: a person pressing this has noticed
// something missing, and the thing they noticed is usually older than the
// window that failed to catch it. Thirty is the ceiling, and it is a real one —
// a first run on a fresh deployment must not be able to sweep a year of history
// inside one HTTP request. Anything wider is a data-repair job somebody should
// be watching, and it has a home: the cron accepts `?days=` up to the same 30.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { reconcileVoiceCalls } from "@/lib/voice/reconcileCalls";
import { voiceConfigured } from "@/lib/voice/retell";
import { recoverLeadFromCall } from "@/lib/ai/callLeadRecovery";
import { isAiConfigured } from "@/lib/ai/provider";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;

/** Model calls one press may make. See `maxLeads` in reconcileCalls. */
const MAX_LEADS_PER_RUN = 25;

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same gate as the voice settings screen. This spends money in two currencies
  // — it can land real charges on the prepaid balance, and it reads transcripts
  // against the company's AI allowance — so it is not a control every member
  // should be able to press.
  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  if (!voiceConfigured()) {
    // 503 and a reason, not an empty result. "0 calls recovered" when we never
    // asked the provider is the same lie the broken webhook told.
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const days = Number(body?.days);
  const lookbackMs =
    (Number.isFinite(days) && days > 0 ? Math.min(MAX_DAYS, days) : DEFAULT_DAYS) * DAY;

  // ── Whether leads can be recovered at all, decided before the sweep ──────
  //
  // Reported back either way. A run that recovered four calls and skipped the
  // leads because this deployment has no OpenAI key must say so — a contractor
  // who sees "4 calls recovered, no leads" and is not told why concludes the
  // calls were empty, and stops looking.
  const aiAvailable = isAiConfigured();
  let quota = null;
  if (aiAvailable) {
    quota = await checkAiQuota(member.companyId);
  }
  const canReadTranscripts = aiAvailable && quota?.allowed !== false;

  let result;
  try {
    result = await reconcileVoiceCalls({
      onlyCompanyId: member.companyId,
      lookbackMs,
      maxLeads: MAX_LEADS_PER_RUN,
      ...(canReadTranscripts
        ? {
            recoverLead: (args) =>
              recoverLeadFromCall({
                ...args,
                onUsage: (u) =>
                  recordAiUsage({
                    companyId: member.companyId,
                    feature: "call_lead_recovery",
                    userId: member.userId,
                    ...u,
                  }),
              }),
          }
        : {}),
    });
  } catch (err) {
    console.error("[voice/recover]", err);
    // 502 rather than 500: the failure is almost always the provider or the
    // model, and nothing was half-written — every charge and every lead in
    // reconcileVoiceCalls is written one at a time and swallows its own
    // failures, so anything reaching here happened between them.
    return NextResponse.json({ error: "Couldn't reach the phone provider." }, { status: 502 });
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    // Only the numbers that mean something to a contractor. `otherCompany` is
    // deliberately absent: how many calls other tenants took in the same window
    // is not this company's business.
    recovered: result.rescued,
    calls: result.seen - result.otherCompany,
    alreadyHad: result.alreadyBilled,
    leadsRecovered: result.leadsRecovered,
    unknownDuration: result.unknownDuration,
    partial: Boolean(result.partial),
    // Why no leads came back, when none did. Three different situations and
    // three different answers: no key on this deployment, the allowance is
    // spent, or the transcripts genuinely had nobody in them.
    leadsSkipped: canReadTranscripts
      ? null
      : aiAvailable
        ? "quota_exceeded"
        : "ai_unavailable",
  });
}
