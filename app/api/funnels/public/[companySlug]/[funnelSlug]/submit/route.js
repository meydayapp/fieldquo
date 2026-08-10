// app/api/funnels/public/[companySlug]/[funnelSlug]/submit/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { normaliseMediaList } from "@/lib/media/validate";
import { createScoredLead } from "@/lib/leads/createLead";
import { buildLeadFromFunnel } from "@/lib/funnels/ingest";
import { recordConsent } from "@/lib/voice/outbound";
import { DISCLOSURE } from "@/lib/voice/disclosure";

// Public — a completed funnel run becomes a scored LeadRequest in the normal
// pipeline, plus a FunnelResponse for the funnel's own analytics. Same shape and
// gates as /api/self-quote: no prices in, a lead out, consent recorded on phone.
export async function POST(request, { params }) {
  // Same throttle as the other public lead intakes. Note the bucket is the
  // route, not the funnel — a flood is a flood whichever funnel slug it names,
  // and per-slug buckets would just be a free multiplier for the attacker.
  const limited = rateLimit(request, "funnel-submit");
  if (limited) return limited;

  const { companySlug, funnelSlug } = await params;
  const body = await request.json().catch(() => ({}));

  const company = await findBookingCompany(companySlug, { id: true });
  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const funnel = await db.funnel.findFirst({
    where: { companyId: company.id, slug: funnelSlug, status: "published" },
    select: { id: true, steps: true, channel: true, slug: true },
  });
  if (!funnel)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const leadInput = buildLeadFromFunnel(funnel, body);
  if (!leadInput.email && !leadInput.phone) {
    return NextResponse.json(
      { error: "An email or phone is required." },
      { status: 400 },
    );
  }

  const media = normaliseMediaList(body.media);
  const lead = await createScoredLead({
    companyId: company.id,
    ...leadInput,
    clientPhotos: media,
  });

  await db.funnelResponse.create({
    data: {
      funnelId: funnel.id,
      answers: body.answers && typeof body.answers === "object" ? body.answers : {},
      leadId: lead.id,
      completedAt: new Date(),
    },
  });

  // Same as every inbound form: a submitted contact request IS consent to reply.
  if (leadInput.phone) {
    await recordConsent({
      companyId: company.id,
      phone: leadInput.phone,
      source: "funnel",
      disclosure: DISCLOSURE.lead,
      leadId: lead.id,
    }).catch((err) => console.error("[funnel] consent not recorded:", err?.message));
  }

  return NextResponse.json({ success: true, leadId: lead.id }, { status: 201 });
}
