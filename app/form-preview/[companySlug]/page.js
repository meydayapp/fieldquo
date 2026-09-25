// app/form-preview/[companySlug]/page.js
//
// The live preview behind Settings › Instant quotes › "How the form looks":
// the REAL public form, mounted the way the embed mounts it, in whatever look
// the owner is trying out — before they save it.
//
// ── Why a page of its own ──────────────────────────────────────────────────
//
// The settings screen sits inside the /app shell and is 768px wide; the
// form's own breakpoints are viewport breakpoints, so rendering the flow
// inline there would show a two-column desktop form squeezed into a column,
// never the phone layout a homeowner will actually hold. An iframe at 390px
// is a real phone viewport, and this is what it loads.
//
// ── Why the look may come from the URL HERE and nowhere else ───────────────
//
// The public pages and the embed read the look from the company row on the
// server, precisely so that nobody framing them can change it. This page is
// different in one way that matters: it is only ever served to a signed-in
// member of the company it previews (the same check /q/<token> makes before
// showing a draft to the office), so the only person who can put a look on
// this URL is the person who is allowed to set it. It is also noindex, and a
// stranger gets the not-found page rather than a hint that it exists.
//
// The draft look still goes through the same normaliser the settings route
// applies, so what the preview draws is what the save would store.
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { canPreviewCompanyDocument } from "@/lib/quotes/previewAccess";
import { normaliseFormAppearance } from "@/lib/estimate/formAppearance";
import InstantQuoteFlow from "@/app/instant-quote/[companySlug]/InstantQuoteFlow";
import SelfQuoteFlow from "@/app/quote/[companySlug]/SelfQuoteFlow";

export const metadata = {
  title: " ",
  robots: { index: false, follow: false },
};

function parseDraft(raw) {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function FormPreviewPage({ params, searchParams }) {
  const { companySlug } = await params;
  const query = await searchParams;

  const company = await findBookingCompany(companySlug, { id: true, brandColor: true });
  if (!company) notFound();
  if (!(await canPreviewCompanyDocument({ headers: await headers() }, company.id))) notFound();

  const { appearance } = normaliseFormAppearance(parseDraft(query?.a));
  const look = { appearance, brandColor: company.brandColor || null };
  const widget = query?.widget === "quote" ? "quote" : "instant-quote";

  // `embedded`, as the iframe on the company's site would mount it: no
  // logo strip (the settings card already says whose form it is) and no
  // claim on the viewport height.
  return widget === "quote" ? (
    <SelfQuoteFlow companySlug={companySlug} embedded look={look} />
  ) : (
    <InstantQuoteFlow companySlug={companySlug} embedded look={look} />
  );
}
