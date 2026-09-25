// app/api/booking/[companySlug]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { effectiveBookingFeeCents, bookingModePresets } from "@/lib/booking/fee";
import { categoryLabel } from "@/lib/i18n/translateContent";
import { offeredModes } from "@/lib/booking/bookingModes";
import { loadPhraseTranslations } from "@/lib/i18n/phrases";

// Public — company branding + bookable event types for the public booking page
export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const company = await findBookingCompany(_params.companySlug, {
    id: true,
    name: true,
    logoUrl: true,
    brandColor: true,
    phone: true,
    email: true,
    currency: true,
    // A visit fee can only be charged if the company can actually take card
    // payments (Stripe Connect done). Without it, a paid event type falls back
    // to a free booking — never a fee the visitor is shown but can't be charged.
    stripeChargesEnabled: true,
    // Which ways a client may meet them. Public on purpose — the visitor has to
    // choose one before booking.
    bookingModes: true,
    // Each mode's preset — length and fee — resolved below into `modes` so
    // the page can say "Phone call · 20 min · Free" beside "On-site visit ·
    // 60 min · $49". Resolved server-side by lib/booking/fee.js; the raw
    // columns are destructured OUT of the public payload below.
    defaultVisitMinutes: true,
    callMinutes: true,
    videoMinutes: true,
    callFeeCents: true,
    videoFeeCents: true,
    // For the service labels below: a French shop's booking page must not offer
    // "Cabinet Refinishing".
    defaultLanguage: true,
    // ── What the company actually does, so a visitor can say which ────────
    //
    // The booking form asked for a name, an email and a phone and nothing about
    // the WORK, so a contractor opened their calendar to a name and a time. A
    // visitor picking from the company's own enabled services is the cheapest
    // possible fix, and the server refuses any key that is not in this list —
    // so this is also what makes that refusal meaningful.
    //
    // Labels and keys ONLY. No rates, no price book, nothing derived from one:
    // non-negotiable #4, and a service list with money on it is a rate card
    // published to every competitor in the city.
    serviceCategories: {
      where: { enabled: true },
      select: { category: { select: { key: true, label: true, labelTranslations: true } } },
      take: 40,
    },
    eventTypes: {
      where: { active: true },
      select: {
        id: true,
        name: true,
        slug: true,
        durationMinutes: true,
        feeCents: true,
        promoFeeCents: true,
        promoActive: true,
      },
    },
  });

  if (!company) {
    return NextResponse.json(
      { error: "Booking page not found" },
      { status: 404 },
    );
  }

  // ── Each name in every language it has a draft in ─────────────────────
  //
  // The page is read in the VISITOR's language, which only the browser knows
  // (the pills, ?lang=, what they chose here before) — so the drafts stored
  // on save ride along as { fr: "…", es: "…" } and BookingFlow picks the one
  // it is showing, else the name as typed. Nothing is translated here; a
  // language with no draft is simply absent (lib/i18n/phrases.js).
  const nameDrafts = await loadPhraseTranslations(
    db,
    company.id,
    "eventTypeName",
    (company.eventTypes || []).map((et) => et.name),
  );

  // Resolve the EFFECTIVE fee per event type server-side (the browser never
  // computes money) via the shared helper the confirm route also uses.
  const eventTypes = (company.eventTypes || []).map((et) => {
    const { feeCents, feeStandardCents } = effectiveBookingFeeCents(company, et);
    return {
      id: et.id,
      name: et.name,
      nameTranslations: nameDrafts[et.name] || {},
      slug: et.slug,
      durationMinutes: et.durationMinutes,
      // EventType.location is deliberately NOT here. It was the free-text
      // "Phone or on-site visit" label the seeded consultation carried, and
      // the page printed it next to the clock as if it told the visitor
      // something. The mode's own words come from lib/booking/bookingModes.js
      // in the visitor's language; nothing public reads this column now.
      feeCents,
      feeStandardCents,
      // Each offered mode's preset for THIS event — { minutes, feeCents,
      // feeStandardCents } — the event's own length and fee for a visit, the
      // company's for a call and a video call. Decided here by the same
      // functions the confirm route reserves and charges with, so what the
      // chips say is what is booked and what is paid. `feeCents` above is
      // the visit's, kept for older readers of this payload.
      modes: bookingModePresets({ company, eventType: et }),
    };
  });

  // Don't leak stripeChargesEnabled / raw fee columns to the public page.
  // ── serviceCategories is destructured OUT, not merely re-shaped ────────
  //
  // The comment here used to claim `pub` did not spread it. It did: `pub` is
  // the rest of `company`, and the raw rows were in the select — so the
  // response carried BOTH the clean `services` array and up to forty
  // `{ category: { key, label, labelTranslations } }` rows, translations in six
  // languages included. No prices in it, so the payload check was right to
  // pass, and it was still forty rows of join shape sent to a homeowner
  // standing in a driveway on one bar of signal.
  //
  // A comment asserting the opposite of the code is worse than no comment: the
  // next person reads it instead of the line.
  const { stripeChargesEnabled, serviceCategories, defaultVisitMinutes, callMinutes, videoMinutes, callFeeCents, videoFeeCents, ...pub } = company;
  // Flattened to { key, label } and nothing else, because every field that
  // leaves this endpoint is one somebody has to
  // check for prices.
  const services = (serviceCategories || [])
    .map((row) => row?.category)
    .filter((c) => c?.key && c?.label)
    .map((c) => ({
      key: c.key,
      // The company's own language for its own trade, the same resolver the
      // agent and the website use — a French shop's booking page should not
      // offer "Cabinet Refinishing".
      label: categoryLabel(c, company.defaultLanguage || "en"),
    }));

  // Normalised, never raw: an empty array is the schema's "not stated" and the
  // page must read it as visit-only, the same way the confirm route does.
  return NextResponse.json({ ...pub, bookingModes: offeredModes(company), eventTypes, services });
}
