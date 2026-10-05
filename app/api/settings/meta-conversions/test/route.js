// app/api/settings/meta-conversions/test/route.js
//
// "Send a test event" on Settings → Meta Ads → Send lead results to Meta.
//
// POST { testEventCode } — the code Meta shows on Events Manager → the
// dataset → Test events. One event is sent to the company's chosen dataset
// with that code, so it appears on Meta's Test events tab and NOT in the
// dataset's real numbers. It proves the dataset id and the pasted token work
// together before anything real is sent — the difference between a switch
// that looks on and one that is.
//
// The test event names no person: its only identifier is a hash of the
// company's own id (external_id), because Meta requires at least one customer
// parameter and a homeowner's details have no business in a test.
//
// Owner/admin, terms accepted, never in a support session.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { sendConversionEvents } from "@/lib/meta/client";
import { getCapiSettings, datasetToken, recordCapiSync } from "@/lib/meta/capi/settings";
import { testEvent, cleanTestEventCode } from "@/lib/meta/capi/testEvent";
import { serialiseEvents } from "@/lib/meta/capi/events";
import { db } from "@/lib/db";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "Support sessions are read-only." }, { status: 403 });
  }
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const code = cleanTestEventCode(body?.testEventCode);
  if (!code) return NextResponse.json({ error: "test_code_invalid" }, { status: 400 });

  const settings = await getCapiSettings(member.companyId);
  if (!settings?.termsAcceptedAt) return NextResponse.json({ error: "terms_required" }, { status: 409 });
  if (!settings?.datasetId) return NextResponse.json({ error: "no_dataset" }, { status: 409 });
  let token;
  try {
    token = datasetToken(settings);
  } catch {
    token = null;
  }
  if (!token) return NextResponse.json({ error: "no_token" }, { status: 409 });

  const result = await sendConversionEvents({
    accessToken: token,
    datasetId: settings.datasetId,
    events: [testEvent({ companyId: member.companyId })],
    testEventCode: code,
    serialise: serialiseEvents,
  }).catch((err) => ({ ok: false, kind: "network", message: err?.message }));

  await recordCapiSync(db, member.companyId, { error: result.ok ? null : result.kind || "error" });
  if (!result.ok) {
    // The KIND for the screen's translated sentence, and Meta's own words
    // beside it — the person pressing this is setting up Meta and reads
    // Meta's error in Meta's terms on Meta's screen anyway.
    return NextResponse.json({ ok: false, kind: result.kind || "unknown_error", message: String(result.message || "").slice(0, 300) }, { status: 502 });
  }
  return NextResponse.json({ ok: true, eventsReceived: result.data?.events_received ?? null });
}
