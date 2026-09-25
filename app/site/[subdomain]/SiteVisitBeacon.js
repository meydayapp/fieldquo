// app/site/[subdomain]/SiteVisitBeacon.js
//
// Counts a visit to the company's website in its own Leads › Visits &
// unfinished report, with the ad parameters it arrived on — the same
// FunnelVisit the instant estimate and the lead funnels open
// (app/components/public/useAdTracking.js). Renders nothing, loads no pixel,
// sets no cookie: the visit token and this tab's list of visit tokens live in
// sessionStorage (lib/tracking/touches.js), so the booking page or quote
// form the visitor opens next on this site is credited to the same ad.
//
// Mounted by the page only for a PUBLISHED site seen by the public — never
// the draft preview a company member opens from the editor, which would
// otherwise count the owner checking their own page.
"use client";

import { useAdTracking } from "@/app/components/public/useAdTracking";

export default function SiteVisitBeacon({ subdomain, language = null }) {
  useAdTracking({ ready: Boolean(subdomain), companySlug: subdomain, surface: "website", language });
  return null;
}
