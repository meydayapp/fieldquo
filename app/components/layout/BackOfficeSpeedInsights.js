"use client";

// Vercel Speed Insights for the contractor back office — and nowhere else.
//
// Mounted once, from app/app/layout.js, so it only ever loads under /app/*.
// Deliberately NOT in the root layout: FieldQuo is white-label, and a
// homeowner on /quote, /book, /q, /portal, /site or a contractor's subdomain
// must not load a script the contractor didn't choose. Scoping the mount to
// the /app layout makes that boundary structural rather than a rule someone
// has to remember.
//
// A client component of its own (rather than <SpeedInsights> inline in the
// layout) because beforeSend is a function, and a server component cannot
// pass a function to a client component.
//
// The script and its beacon are same-origin (/_vercel/speed-insights/*), so
// no third-party host is contacted in production.

import { SpeedInsights } from "@vercel/speed-insights/next";

// The free allowance is 10,000 data points per 30 days, team-wide, and one
// page load reports up to ~5 of them (TTFB, FCP, LCP, CLS, INP). At 100% that
// is roughly 2,000 back-office page loads a month — a handful of busy crews
// would exhaust it in days, after which collection stops and the dashboard
// shows nothing for the rest of the cycle. 0.1 stretches the same allowance
// to ~20,000 page loads while still sampling enough of them for the
// percentiles to mean something. Raise it only after checking usage in the
// Vercel dashboard.
const SAMPLE_RATE = 0.1;

// Strip the query string and fragment before anything leaves the browser.
// /app URLs carry ids and search text there (?clientId=…, ?q=<a client's
// name>), and a performance tool has no need for either — the path (and the
// route the package derives from it) is what the measurements are grouped by.
function stripQuery(event) {
  const url = String(event.url || "");
  const cut = url.search(/[?#]/);
  return cut === -1 ? event : { ...event, url: url.slice(0, cut) };
}

export default function BackOfficeSpeedInsights() {
  return <SpeedInsights sampleRate={SAMPLE_RATE} beforeSend={stripQuery} />;
}
