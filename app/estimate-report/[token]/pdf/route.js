// app/estimate-report/[token]/pdf/route.js
//
// The report as a PDF, for the "PDF" link on the online report. Public and
// token-gated exactly like the page: the share token is the credential, and
// an unknown token — or a quote that is not an instant estimate — is a 404
// with no body that could tell a guesser anything.
//
// Rendered on demand rather than archived: the report re-prices the saved
// measurement on every read (lib/estimate/report/load.js), so a stored copy
// would be the one that stops matching the page.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { loadEstimateReportByToken } from "@/lib/estimate/report/load";
import { renderEstimateReportPdf } from "@/lib/estimate/report/pdf";

export async function GET(request, { params }) {
  // A PDF render costs real CPU; a loop on a public URL must not.
  const limited = rateLimit(request, "estimate-report-pdf");
  if (limited) return limited;

  const { token } = await params;
  const loaded = await loadEstimateReportByToken(token, { request });
  if (!loaded) return new NextResponse(null, { status: 404 });

  const pdf = await renderEstimateReportPdf({ report: loaded.report, company: loaded.company });
  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${loaded.report.email.filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
