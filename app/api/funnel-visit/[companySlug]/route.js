// app/api/funnel-visit/[companySlug]/route.js
//
// Public — the step beacon for a company's lead funnels and its instant
// estimate. One row per visit (FunnelVisit), opened on the first post and
// moved forward by the ones after it; the company's report in /app counts
// those rows. See lib/tracking/funnelSteps.js for the step order and
// lib/tracking/partial.js for the contact details kept on a visit that never
// submits.
//
// ══ What it trusts ═════════════════════════════════════════════════════════
//
//   · the company from the slug, the funnel from the published row — never
//     a draft, the same as the funnel's own public GET;
//   · the STEP by name only, ranked here against the server's copy of the
//     order; a posted rank does not exist;
//   · the visit by the token this route issued (32 random characters),
//     scoped to the company and surface, so one visitor cannot move another's
//     row;
//   · contact details only with `notice: true` — the page renders the "we
//     save what you type" sentence before it will send them.
//
// It never returns anything but the token: no counts, no company data, no
// price. A failure answers { ok: false } with 200 on purpose — a beacon the
// page cannot do anything about must not become an error in a driveway.
//
// ══ The booking page and the website (25 September 2026) ═══════════════════
//
// Two more surfaces, opened the same way. The booking page is resolved as
// the booking page resolves itself (findBookingCompany); the website by its
// SUBDOMAIN, and only while it is published — the draft preview never posts,
// and a post naming an unpublished site files nothing. Neither keeps contact
// details: a partial lead is only ever kept under the "we save what you
// type" sentence, and neither page renders it, so a capture posted for them
// is ignored rather than stored.
//
// `touches` — the tokens of the visits this tab opened earlier — lets a
// page reached from the company's own site inherit the landing that brought
// the visitor (lib/tracking/visits.js, "First touch"). They are resolved
// against this company's rows only.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { SURFACES, stepRank } from "@/lib/tracking/funnelSteps";
import { normalisePartialContact } from "@/lib/tracking/partial";
import { advanceVisit, findVisit, openVisit } from "@/lib/tracking/visits";
import { instantQuoteLanguage } from "@/lib/i18n/instantQuoteCopy";

const TRADE = /^[a-z0-9_]{1,40}$/;

export async function POST(request, { params }) {
  // Generous next to the submit routes' ten: one visit posts a handful of
  // beacons (open, each step, a debounced contact capture). The limit is for
  // a loop, not a visitor tapping through a ten-step funnel twice.
  const limited = rateLimit(request, "funnel-visit", { limit: 120, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  const { companySlug } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false }, { status: 400 });

  const surface = SURFACES.includes(body.surface) ? body.surface : null;
  if (!surface) return NextResponse.json({ ok: false }, { status: 400 });

  // Resolved exactly as each page resolves it: the instant estimate by the
  // company's slug only (lib/estimate/instantQuoteServer.js), a funnel by
  // booking slug then slug (its own public routes). A different rule here
  // could file a visit under a different company than the page showed.
  let company = null;
  if (surface === "instant_quote") {
    company = await db.company.findUnique({ where: { slug: String(companySlug || "") }, select: { id: true } });
  } else if (surface === "website") {
    // The site page resolves by subdomain (app/site/[subdomain]/page.js
    // loadSite), lower-cased; a draft is a 404 to the public there and here.
    const site = await db.companySite.findUnique({
      where: { subdomain: String(companySlug || "").toLowerCase().slice(0, 63) },
      select: { companyId: true, published: true },
    });
    company = site?.published ? { id: site.companyId } : null;
  } else {
    company = await findBookingCompany(companySlug, { id: true });
  }
  if (!company) return NextResponse.json({ ok: false }, { status: 404 });

  let funnel = null;
  if (surface === "funnel") {
    const slug = typeof body.funnelSlug === "string" ? body.funnelSlug.slice(0, 120) : "";
    funnel = slug
      ? await db.funnel.findFirst({
          where: { companyId: company.id, slug, status: "published" },
          select: { id: true, steps: true },
        })
      : null;
    if (!funnel) return NextResponse.json({ ok: false }, { status: 404 });
  }

  const rank = stepRank(surface, body.step, funnel?.steps || []);
  const step = rank == null ? null : { key: body.step, rank };
  const trade = surface === "instant_quote" && typeof body.trade === "string" && TRADE.test(body.trade) ? body.trade : null;

  let contact = null;
  if (body.contact && (surface === "funnel" || surface === "instant_quote")) {
    const parsed = normalisePartialContact(body.contact);
    // A capture that fails the rules is ignored rather than refused: the
    // visitor is mid-typing, and "not an email yet" is the normal state.
    if (!parsed.error) contact = parsed.contact;
  }

  try {
    const existing = body.token
      ? await findVisit({ companyId: company.id, surface, token: body.token })
      : null;

    if (!existing) {
      const token = await openVisit({
        companyId: company.id,
        surface,
        funnelId: funnel?.id || null,
        language: instantQuoteLanguage(body.language) || (typeof body.language === "string" && /^[a-z]{2}$/.test(body.language) ? body.language : null),
        landing: body.landing && typeof body.landing === "object" ? body.landing : {},
        touches: body.touches,
        step,
      });
      // A contact capture on the very first post (a funnel that opens on its
      // form) is kept by moving the fresh row on at once.
      if (contact || trade) {
        const fresh = await findVisit({ companyId: company.id, surface, token });
        if (fresh) await advanceVisit(fresh, { trade, contact });
      }
      return NextResponse.json({ ok: true, token });
    }

    await advanceVisit(existing, { step, trade, contact });
    return NextResponse.json({ ok: true, token: existing.token });
  } catch (err) {
    console.error("[funnel-visit] not recorded:", err?.message);
    return NextResponse.json({ ok: false });
  }
}
