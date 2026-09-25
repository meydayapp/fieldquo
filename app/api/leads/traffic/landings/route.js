// app/api/leads/traffic/landings/route.js
//
// The company's own pages an ad can point at, for the ad-link builder
// (app/components/settings/TrackingLinkBuilder.js): the instant estimate,
// each PUBLISHED lead funnel, the booking page and its direct per-service
// links, and the website while it is published.
//
// Offered only where a visit there is counted (FunnelVisit, lib/tracking/):
// a page the report cannot see would be a link that appears to track and
// does not. That is why the self-quote form (/quote/*) and the embeds are
// absent — nothing counts a landing on them — and why a draft funnel or an
// unpublished website is left out rather than listed and 404ing.
//
// Paths and slugs only; the browser prefixes its own origin for the pages
// the app serves (the same way the funnel builder and the instant-quote card
// always have), and the website's full address comes from lib/site/subdomain
// siteUrl, since it lives on its own host. Nothing here is a price, a
// contact detail or anything not already public.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { siteUrl } from "@/lib/site/subdomain";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // The report's own rung: the links exist to fill the report this member
  // can read.
  const { response: denied } = await levelOrRefusal(member, "requests", "view_only", "see requests");
  if (denied) return denied;
  const companyId = member.companyId;

  const [company, funnels, eventTypes, site] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { slug: true, bookingSlug: true } }),
    db.funnel.findMany({
      where: { companyId, status: "published" },
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    db.eventType.findMany({
      where: { companyId, active: true },
      select: { name: true, slug: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
    db.companySite.findFirst({ where: { companyId, published: true }, select: { subdomain: true } }),
  ]);
  if (!company?.slug) return NextResponse.json({ landings: [] });

  const bookingSlug = company.bookingSlug || company.slug;
  const enc = encodeURIComponent;
  const landings = [
    { key: "instant_quote", kind: "instant_quote", path: `/instant-quote/${enc(company.slug)}` },
    ...funnels
      .filter((f) => f.slug)
      .map((f) => ({ key: `funnel:${f.id}`, kind: "funnel", name: f.name, path: `/f/${enc(company.slug)}/${enc(f.slug)}` })),
    // The booking page answers with nothing to book when there is no active
    // appointment type, so it is only offered when there is one.
    ...(eventTypes.length ? [{ key: "booking", kind: "booking", path: `/book/${enc(bookingSlug)}` }] : []),
    ...eventTypes
      .filter((e) => e.slug)
      .map((e) => ({ key: `booking:${e.slug}`, kind: "booking_type", name: e.name, path: `/book/${enc(bookingSlug)}/${enc(e.slug)}` })),
    ...(site?.subdomain ? [{ key: "website", kind: "website", url: `${siteUrl(site.subdomain)}/` }] : []),
  ];
  return NextResponse.json({ landings });
}
