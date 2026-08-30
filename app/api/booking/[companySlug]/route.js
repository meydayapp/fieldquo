// app/api/booking/[companySlug]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { effectiveBookingFeeCents } from "@/lib/booking/fee";
import { categoryLabel } from "@/lib/i18n/translateContent";

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
        location: true,
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

  // Resolve the EFFECTIVE fee per event type server-side (the browser never
  // computes money) via the shared helper the confirm route also uses.
  const eventTypes = (company.eventTypes || []).map((et) => {
    const { feeCents, feeStandardCents } = effectiveBookingFeeCents(company, et);
    return {
      id: et.id,
      name: et.name,
      slug: et.slug,
      durationMinutes: et.durationMinutes,
      location: et.location,
      feeCents,
      feeStandardCents,
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
  const { stripeChargesEnabled, serviceCategories, ...pub } = company;
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

  return NextResponse.json({ ...pub, eventTypes, services });
}
