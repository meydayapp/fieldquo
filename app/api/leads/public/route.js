// app/api/leads/public/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { createScoredLead } from "@/lib/leads/createLead";

import { recordConsent } from "@/lib/voice/outbound";
import { DISCLOSURE } from "@/lib/voice/disclosure";
import { onLeadCreated } from "@/lib/voice/triggers";
// Public — the embeddable "request a quote" form submits here.
// companySlug identifies which company's form this is, since the form is embedded
// on THEIR website, not accessed through FieldQuo's own auth.
export async function POST(request) {
  // Throttled before the body is even read: every accepted submission books a
  // consent row, may queue an outbound call and sends branded mail, so a loop
  // against this URL spends the tenant's credits and their domain reputation.
  const limited = rateLimit(request, "leads-public");
  if (limited) return limited;

  // A truncated body from a dropped mobile connection must not become a
  // bodyless 500 — this is the public enquiry form, and a 500 here silently
  // loses the lead the whole page exists to capture. Clean 400 instead.
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "We couldn't read that request. Please try again." },
      { status: 400 },
    );
  }
  const { companySlug, name, email, phone, categoryId, message, source } = body;

  if (!companySlug || !name) {
    return NextResponse.json(
      { error: "companySlug and name are required" },
      { status: 400 },
    );
  }
  if (!email && !phone) {
    return NextResponse.json(
      { error: "Provide at least an email or phone number" },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({ where: { slug: companySlug } });
  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lead = await createScoredLead({
    companyId: company.id,
    name,
    email,
    phone,
    categoryId,
    message,
    source: source || "embed_form",
  });

  // A lead IS a request to be contacted — that's what a lead is. Recording it
  // as consent is what lets the phone agent ring them back; without a row it
  // won't dial, however obviously they wanted a call.
  //
  // Best-effort: never fail an enquiry over it. No consent just means a human
  // picks up the phone instead, which is the safe direction.
  if (phone) {
    await recordConsent({
      companyId: company.id,
      phone,
      source: "self_quote",
      disclosure: DISCLOSURE.lead,
      leadId: lead.id,
    }).catch((err) => console.error("[leads/public] consent not recorded:", err));
  }

  // "Someone will call you shortly" — the call the form promised, queued. Fires
  // only if the company opted into outbound calls; the lead's own consent (just
  // recorded above) is checked at dial time. Best-effort — never fails the
  // enquiry the person just submitted.
  await onLeadCreated(lead.id).catch((err) =>
    console.error("[leads/public] couldn't queue follow-up call:", err?.message),
  );

  return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
}
