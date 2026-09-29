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

// Every back-office page load, not a sample. The project is on Speed
// Insights Plus (the owner's choice, 2026-09-28: $10/month plus $0.65 per
// 10,000 data points, no free allowance), and the point of turning it on was
// to find which /app pages are slow — at FieldQuo's traffic a 10% sample
// leaves most routes with too few loads for a P75 to mean anything. One hard
// navigation reports 3–6 data points; ~100 back-office sessions a day is
// ~15,000 a month, about $1. Lower this if the usage page says otherwise.
const SAMPLE_RATE = 1;

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
