// app/api/self-quote/[companySlug]/route.js
//
// What the public self-quote form needs to render: who the company is, and
// which services they'll actually take a request for.
//
// ── Only their enabled services ─────────────────────────────────────────────
//
// Driven off CompanyServiceCategory.enabled, the same source the internal
// quote builder uses. A painter's public form offers painting, not the full
// sixty-category catalogue — and a visitor can't request work the company
// doesn't do, which is the point.
//
// ── Fields, but fewer of them ───────────────────────────────────────────────
//
// The internal builder asks everything the pricing formula needs. A stranger
// on a phone will abandon that. So this returns at most the first three number
// or select fields per category: enough that the contractor arrives at the
// callback already knowing roughly the size of the job, not so many that
// nobody finishes the form.
//
// ── No prices, ever ─────────────────────────────────────────────────────────
//
// This deliberately returns no rates. The form produces a LEAD, not a quote.
// Publishing a company's rate card on an unauthenticated endpoint would hand
// it to every competitor in the city, and a self-serve number a contractor
// hasn't seen is a figure they may have to honour.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { canBookVisit } from "@/lib/booking/canBookVisit";
import { publicIntakeFields } from "@/app/data/quoteIntakeFields";
import { sendLanguagesFor } from "@/lib/company/sendLanguages";

export async function GET(request, { params }) {
  const { companySlug } = await params;

  const company = await findBookingCompany(companySlug, {
    id: true,
    name: true,
    logoUrl: true,
    brandColor: true,
    phone: true,
    email: true,
    currency: true,
    defaultLanguage: true,
    sendLanguages: true,
    // Enough to answer "can they book a home visit?" — the confirmation offers
    // one, and an offer that lands on an empty calendar is a dead control.
    bookingModes: true,
    bookingSlug: true,
    slug: true,
    eventTypes: { where: { active: true }, select: { id: true } },
  });

  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const enabled = await db.companyServiceCategory.findMany({
    where: { companyId: company.id, enabled: true },
    select: {
      category: { select: { id: true, key: true, label: true, icon: true } },
    },
  });

  const services = enabled
    .map(({ category }) => {
      if (!category) return null;
      // The POST that reads the answers back applies the same rule from the
      // same helper — see publicIntakeFields in app/data/quoteIntakeFields.js.
      return { ...category, fields: publicIntakeFields(category.key) };
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));

  // companyId is deliberately absent — the POST identifies the company by slug
  // like every other public route, so there's no reason to hand out the id.
  return NextResponse.json({
    company: {
      name: company.name,
      logoUrl: company.logoUrl,
      brandColor: company.brandColor,
      phone: company.phone,
      email: company.email,
      currency: company.currency || "USD",
    },
    // Which languages the homeowner may have this written in. FIRST is the
    // primary — the company's own default — because the form defaults to it
    // and "primary" has to be a property of the list rather than a second
    // field the client could forget to read.
    //
    // Empty sendLanguages means the company has never said which languages it
    // sends in, and the honest reading of that is "the default only", not "all
    // six". Offering a language a contractor never claimed would have the
    // homeowner reasonably expect a reply in it.
    languages: sendLanguagesFor(company),
    services,
    // ── The in-person visit ────────────────────────────────────────────────
    //
    // Booking already exists as a whole flow (/book/<slug>), with a calendar,
    // travel-time-aware availability, arrival windows, visit fees and a
    // confirmation email. The self-quote's job is to hand a homeowner to it
    // with what they already typed, not to grow a second, worse calendar.
    //
    // `slug` is what BookingFlow should be pointed at — a company that set a
    // custom bookingSlug is reachable at BOTH, but the one they chose is the
    // one to use (see findBookingCompany).
    booking: canBookVisit(company)
      ? { canBookVisit: true, slug: company.bookingSlug || company.slug }
      : { canBookVisit: false },
  });
}
