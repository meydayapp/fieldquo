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
import { sanitiseFunnelSteps } from "@/app/data/funnelBlocks";
import { confirmedFunnelEstimates } from "../../../funnelEstimate";

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

  const company = await findBookingCompany(companySlug, {
    id: true,
    currency: true,
    defaultLanguage: true,
  });
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

  // ── The estimate, priced again from the company's own rows ────────────────
  //
  // Nothing about a price is read from the body. The browser posted which SIZE
  // BAND was tapped; the measurement behind it, the rates, and the arithmetic
  // all come from the server, exactly as they did when the number first went on
  // screen. So the figure recorded on the lead is the figure the visitor saw,
  // and neither of them came from the browser.
  //
  // This is also the only place a "show the range after they submit" trade
  // unlocks: a lead now exists, which is the condition the owner set.
  const cleanSteps = sanitiseFunnelSteps(funnel.steps);
  const estimates = await confirmedFunnelEstimates({
    companyId: company.id,
    steps: cleanSteps,
    answers: body.answers && typeof body.answers === "object" ? body.answers : {},
    language: company.defaultLanguage || "en",
    currency: company.currency,
  });

  const media = normaliseMediaList(body.media);
  const lead = await createScoredLead({
    companyId: company.id,
    ...leadInput,
    // What was quoted at them, on the lead the contractor opens. Appended
    // rather than merged into buildLeadFromFunnel because that helper is pure
    // and knows nothing about rates — pricing needs the database.
    message: [leadInput.message, ...estimates.notes].filter(Boolean).join("\n") || null,
    intake: Object.keys(estimates.intake).length
      ? { ...(leadInput.intake || {}), ...estimates.intake }
      : leadInput.intake,
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

  return NextResponse.json(
    // `estimates` is keyed by step id and is empty unless the funnel has an
    // estimate step the visitor answered. A details-first step reveals its
    // number from here, which is why the reveal cannot happen without a lead.
    { success: true, leadId: lead.id, estimates: estimates.byStep },
    { status: 201 },
  );
}
