// app/api/settings/business-number/route.js
//
// "Bring your number" — Settings → Business number.
//
//   GET                                      the request, its status (synced with
//                                            Twilio when stale), and the costs
//   POST { action: "check", number }        what kind of line it is → which path
//   POST { action: "hosted", form }         start Hosted SMS (landline/toll-free)
//   POST { action: "verify_call", extension } Twilio rings the number; returns the code
//   POST { action: "forwarding", forwardTo, ringSeconds, fallback }
//   POST { action: "cancel" }
//
// The port itself is multipart (it carries the bill) and lives beside this at
// ./port/route.js.
//
// Owner/admin only ("user:manage", the same gate as Settings → Phone): every
// action here either moves the company's business line or spends its balance.
// The company is the session's, never the body's — see lib/businessNumber/store.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { getAppOrigin } from "@/lib/appUrl";
import { balanceFor } from "@/lib/voice/credits";
import { activeNumber } from "@/lib/voice/numbers";
import { twilioConfigured } from "@/lib/sms/twilioClient";
import { readUsA2pStatus } from "@/lib/sms/usA2pStatus";
import {
  checkNumber,
  startHosted,
  startVerificationCall,
  setForwarding,
  cancelRequest,
  loadForCompany,
} from "@/lib/businessNumber/store";
import { monthlyEstimate, EXAMPLE_VOLUMES, PORT_FEE_NOTE, BUSINESS_CALL_CENTS_PER_MINUTE } from "@/lib/businessNumber/costs";
import { portSecretsConfigured } from "@/lib/businessNumber/secrets";
import { TIMELINES } from "@/lib/businessNumber/state";
import { phoneGateResponse } from "@/lib/trial/phoneGate";

async function gate(request, { read = false } = {}) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  // The console may LOOK (non-negotiable #3: view everything) — and only look:
  // the GET below skips the Twilio sync for it, because a sync writes the
  // row, and every POST still demands user:manage, which a support session
  // never passes (getCurrentMember refuses its writes regardless).
  if (read && member.impersonation) return { member };
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return { response: NextResponse.json({ error: "Only an owner or admin can do this." }, { status: 403 }) };
  }
  return { member };
}

/** The company's own SMS volume over the last 30 days, to price the estimate from. */
async function lastMonthTexts(companyId) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const where = (direction) => ({
    direction,
    sentAt: { gte: since },
    thread: { companyId, channel: { platform: "sms" } },
  });
  const [inbound, outbound] = await Promise.all([
    db.message.count({ where: where("in") }),
    db.message.count({ where: where("out") }),
  ]);
  return { inbound, outbound };
}

export async function GET(request) {
  const { member, response } = await gate(request, { read: true });
  if (response) return response;
  const companyId = member.companyId;
  const origin = getAppOrigin(request);

  const [number, balanceCents, texts, receptionist, agent, members, company] = await Promise.all([
    // A support session reads the row as it stands — no sync, which writes.
    loadForCompany({ companyId, origin, sync: !member.impersonation }),
    balanceFor(companyId),
    lastMonthTexts(companyId).catch(() => null),
    activeNumber(companyId).catch(() => null),
    db.voiceAgent.findUnique({ where: { companyId }, select: { enabled: true } }).catch(() => null),
    db.member.findMany({
      where: { companyId, active: true, phone: { not: null } },
      select: { id: true, phone: true, user: { select: { name: true } } },
      take: 50,
    }),
    db.company.findUnique({ where: { id: companyId }, select: { isDemo: true, smsFromNumber: true } }),
  ]);

  // ── US texting needs A2P 10DLC registration ─────────────────────────────
  //
  // A live US number texts US phones only once it sits in a Messaging Service
  // with a VERIFIED campaign (lib/sms/usA2pStatus.js — error 30034
  // otherwise). Read from Twilio, never assumed, and only for a live US
  // number: a Canadian line is not under that regime. `registered: null`
  // means Twilio could not be asked, and the screen says nothing rather than
  // guess either way.
  let usTexting = null;
  if (number?.status === "active" && number.country === "US" && !number.simulated) {
    const a2p = await readUsA2pStatus({ numbers: [{ e164: number.e164 }] }).catch(() => null);
    usTexting = a2p ? { registered: a2p.twilioError ? null : a2p.registered } : null;
  }

  // Real volumes when the company has texted at all; the example otherwise,
  // and the screen says which it is.
  const hasHistory = Boolean(texts && texts.inbound + texts.outbound > 0);
  const volumes = hasHistory
    ? { textsIn: texts.inbound, textsOut: texts.outbound, callMinutes: EXAMPLE_VOLUMES.callMinutes }
    : EXAMPLE_VOLUMES;

  return NextResponse.json({
    number,
    available: {
      // Each switch is the real precondition, so a disabled control on the
      // screen names the actual reason rather than failing on press.
      twilio: twilioConfigured() || Boolean(company?.isDemo),
      porting: portSecretsConfigured() || Boolean(company?.isDemo),
      demo: Boolean(company?.isDemo),
    },
    costs: {
      hosted: monthlyEstimate({ path: "hosted_sms", ...volumes }),
      port: monthlyEstimate({ path: "port", ...volumes }),
      basedOn: hasHistory ? "history" : "example",
      volumes,
      portFeeNote: PORT_FEE_NOTE,
      callCentsPerMinute: BUSINESS_CALL_CENTS_PER_MINUTE,
    },
    timelines: TIMELINES,
    balanceCents,
    receptionist: {
      // The fallback can only be the receptionist when there is one that
      // answers: a live number AND the agent switched on.
      available: Boolean(receptionist && agent?.enabled),
    },
    memberPhones: members.map((m) => ({ id: m.id, name: m.user?.name || null, phone: m.phone })),
    usTexting,
    sendingNumber: company?.smsFromNumber || null,
  });
}

export async function POST(request) {
  const { member, response } = await gate(request);
  if (response) return response;
  const companyId = member.companyId;
  const origin = getAppOrigin(request);
  const body = await request.json().catch(() => ({}));

  let result;
  switch (body?.action) {
    case "check":
      result = await checkNumber({ companyId, input: body.number });
      if (result.ok) {
        await recordActivity(member, {
          action: "business_number.checked",
          entityType: "settings",
          summary: `Checked ${result.verdict.e164} — ${result.verdict.kind}`,
          metadata: { e164: result.verdict.e164, kind: result.verdict.kind, country: result.verdict.country },
        });
      }
      break;
    case "hosted": {
      // A card-free trial verifies a mobile before this spends FieldQuo money
      // (lib/trial/phoneGate.js). Paid companies never reach a refusal here.
      const phoneGate = await phoneGateResponse(member, "business_number");
      if (phoneGate) return phoneGate;
      result = await startHosted({ companyId, form: body.form || {}, origin });
      if (result.ok) {
        await recordActivity(member, {
          action: "business_number.hosted_started",
          entityType: "settings",
          summary: `Started moving texts for ${result.number?.e164} to FieldQuo`,
          metadata: { e164: result.number?.e164, simulated: Boolean(result.simulated) },
        });
      }
      break;
    }
    case "verify_call":
      result = await startVerificationCall({ companyId, extension: body.extension || null });
      break;
    case "forwarding":
      result = await setForwarding({ companyId, forwardTo: body.forwardTo, ringSeconds: body.ringSeconds, fallback: body.fallback });
      break;
    case "cancel":
      result = await cancelRequest({ companyId });
      if (result.ok) {
        await recordActivity(member, {
          action: "business_number.cancelled",
          entityType: "settings",
          summary: `Cancelled bringing ${result.number?.e164} into FieldQuo`,
          metadata: { e164: result.number?.e164 },
        });
      }
      break;
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, reasonKey: result.reasonKey, ...(result.problems ? { problems: result.problems } : {}), ...(result.verdict ? { verdict: result.verdict } : {}), ...(result.needCents ? { needCents: result.needCents, balanceCents: result.balanceCents } : {}) },
      { status: result.status || 400 },
    );
  }
  return NextResponse.json(result);
}
