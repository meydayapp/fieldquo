// app/estimate-report/[token]/page.js
//
// The instant-estimate report a homeowner opens from their email — the
// branded page behind the "View online" link on the PDF, and where the form
// sends them on submit. Laid out as the company's proposal with the range
// where the prices would be (see ReportView.js).
//
// Public, like /q/<token>: no session, no app shell, nothing suggesting the
// reader has an account anywhere. Everything on it comes from
// lib/estimate/report/load.js, which resolves the share token the same way
// the quote page does, re-prices the saved measurement, and 404s any token
// that is not an instant estimate. The layout is server-rendered — a stranger
// on a phone in a driveway gets the whole document before any script runs;
// only the call-back form is a client component.

export const dynamic = "force-dynamic";

import { cache } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { loadEstimateReportByToken } from "@/lib/estimate/report/load";
import { loadEstimatePresentation } from "@/lib/estimate/report/presentation";
import ReportView from "./ReportView";

// generateMetadata and the page both need the report; React's cache() makes
// that one load (one re-pricing, one company read) per request.
const load = cache(async (token) =>
  loadEstimateReportByToken(token, { request: { headers: await headers() } }),
);

export async function generateMetadata({ params }) {
  const { token } = await params;
  const loaded = await load(token);
  return {
    // The company's name in the tab — the white-label rule for every
    // client-facing surface. A bare space for an unknown token: the
    // not-found page carries its own wording.
    title: loaded ? `${loaded.report.title.text} · ${loaded.company.name}` : " ",
    robots: { index: false, follow: false },
  };
}

export default async function EstimateReportPage({ params }) {
  const { token } = await params;
  const loaded = await load(token);
  if (!loaded) notFound();
  // The company's proposal sections and the trade's process steps — the
  // "same presentation" half. Only this page reads them; the PDF and the
  // email are built without (lib/estimate/report/presentation.js).
  const presentation = await loadEstimatePresentation({ quote: loaded.quote, language: loaded.report.language });
  return <ReportView report={loaded.report} company={loaded.company} token={token} presentation={presentation} />;
}
