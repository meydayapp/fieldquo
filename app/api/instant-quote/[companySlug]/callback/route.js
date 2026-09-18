// app/api/instant-quote/[companySlug]/callback/route.js
//
// Public. "This doesn't look right → Request a call back" under a measured
// instant estimate. The homeowner gives a name, a phone number, a preferred
// time and (optionally) what looks wrong; the company is told the way every
// inbound form tells it — a LeadRequest through createScoredLead, which is
// the one hook that notifies (lib/leads/createLead.js) — and the lead is
// flagged with callbackRequestedAt so the board and the quote say "book the
// on-site visit", not "ring about the price".
//
// Two shapes of arrival:
//
//   · AFTER the estimate was submitted: `quoteId` names the draft the
//     instant-quote request created, which already has its lead linked by
//     quoteId (one lead per quote — the column is unique). That lead is
//     flagged rather than a second one created, and the draft's own
//     estimateData records the request so the estimator sees it beside the
//     measurement (app/app/quotes/[id]). The notification fires again on
//     purpose: a homeowner disputing the figure is a new event for the
//     board, not a footnote on yesterday's.
//   · BEFORE (a range shown as they typed, no submit yet): a fresh lead,
//     with the address and the trade in its message so it can be worked.
//
// The instant estimate itself is untouched either way — the homeowner may
// still submit it, and a draft already created stays created.
//
// Nothing here prices anything; the `measurementSummary` the browser sends is
// a short string for the reviewer ("Lawn 1,500 sq ft (minimum band)"),
// length-capped and stored as what the homeowner saw, never as a fact.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { createScoredLead } from "@/lib/leads/createLead";
import { notifyEvent } from "@/lib/notifications/notify";
import { buildLeadIntake } from "@/lib/leads/intakeShape";
import { lawnEstimateCopy } from "@/lib/i18n/lawnEstimateCopy";
import { cleanCallbackRequest } from "@/lib/leads/callbackRequest";
import { recordConsent, DISCLOSURE } from "@/lib/voice/outbound";
import { isSupported } from "@/app/i18n/languages";

export async function POST(request, { params }) {
  const limited = rateLimit(request, "instant-quote-callback");
  if (limited) return limited;

  const { companySlug } = await params;
  const company = await db.company.findUnique({
    where: { slug: companySlug },
    select: { id: true, defaultLanguage: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "We couldn't read that request. Please try again." }, { status: 400 });
  }

  const language = isSupported(body.language) ? body.language : company.defaultLanguage || "en";
  const t = lawnEstimateCopy(language);

  const cleaned = cleanCallbackRequest(body);
  // A call back needs a number. A form posted around the browser check gets
  // the same sentence the form shows.
  if (!cleaned.ok) return NextResponse.json({ error: t.cbPhoneRequired }, { status: 400 });
  const { name, phone, preferredTime, note, address, summary, quoteId, details, message } = cleaned.request;

  const now = new Date();
  // ── The draft this is about, if there is one ──────────────────────────
  //
  // Scoped to the company in the WHERE: a quote id from another tenant
  // resolves to nothing and this becomes a fresh lead, never a write onto
  // someone else's draft.
  const quote = quoteId
    ? await db.quote.findFirst({
        where: { id: quoteId, companyId: company.id },
        select: { id: true, estimateData: true, reviewNotes: true, lead: { select: { id: true, intake: true, name: true } } },
      })
    : null;

  let lead;
  if (quote?.lead) {
    const existing = quote.lead;
    const intake = { ...((existing.intake && typeof existing.intake === "object") ? existing.intake : {}), ...details };
    lead = await db.leadRequest.update({
      where: { id: existing.id },
      data: {
        callbackRequestedAt: now,
        intake,
        // The number they gave for the call, if the lead had none.
        ...(phone && { phone }),
      },
      select: { id: true, name: true, temperature: true },
    });
    // Same event the board already listens for — see the header.
    notifyEvent({
      companyId: company.id,
      type: "lead.created",
      entityId: lead.id,
      params: { leadName: lead.name || name, temperature: lead.temperature || "" },
      actorUserId: null,
    }).catch(() => {});
  } else {
    lead = await createScoredLead({
      companyId: company.id,
      name: name || "Instant-estimate call back",
      phone,
      message,
      source: "instant_quote",
      intake: buildLeadIntake({ address, details }),
      language,
    });
    await db.leadRequest.update({ where: { id: lead.id }, data: { callbackRequestedAt: now } }).catch(() => {});
  }

  // On the draft too, beside the measurement the estimator is reviewing:
  // the reviewer's screen is the quote, and a flag that lives only on the
  // lead is a flag the reviewer never sees.
  if (quote) {
    const estimateData = quote.estimateData && typeof quote.estimateData === "object" ? quote.estimateData : {};
    const line = `Homeowner says the measurement doesn't look right — call back requested (${preferredTime})${note ? `: ${note}` : ""}. Book an on-site visit.`;
    await db.quote
      .update({
        where: { id: quote.id },
        data: {
          estimateData: {
            ...estimateData,
            callback: { requestedAt: now.toISOString(), preferredTime, note: note || null, phone, name: name || null, shown: summary || null },
          },
          reviewNotes: [quote.reviewNotes, line].filter(Boolean).join("\n"),
        },
      })
      .catch((err) => console.error("[instant-quote/callback] quote not flagged:", err?.message));
  }

  // They asked to be rung. Consent, recorded like every other inbound form.
  await recordConsent({
    companyId: company.id,
    phone,
    source: "self_quote",
    disclosure: DISCLOSURE.self_quote,
    ...(quote ? { quoteId: quote.id } : { leadId: lead.id }),
  }).catch((err) => console.error("[instant-quote/callback] consent failed:", err?.message));

  return NextResponse.json({ ok: true, leadId: lead.id, message: t.cbDone }, { status: 201 });
}
