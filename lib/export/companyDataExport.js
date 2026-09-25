// lib/export/companyDataExport.js
//
// ══ The decision ═══════════════════════════════════════════════════════════
//
// Companies can import into FieldQuo but not export out of it. The owner, on
// 2026-09-24: "can import but not export… just hide them even for paying
// customers." That covers every BULK export of a company's records as a file
// — the price book, timesheets, a payroll run, the subcontractor year-end
// list, the bookkeeping ZIP.
//
// It does NOT cover a single document the company needs to operate: a quote
// or invoice PDF to send or print, a worker's payslip or tax slip, a job's
// work order or photo report, the calendar feed. Those stay, because without
// them the company cannot do the job the product exists for.
//
// ══ Why a guard and not a deletion ═════════════════════════════════════════
//
// The routes, their helpers and their checks are kept. The CSV escaping in
// lib/export/accountingExport.js is shared by analytics and payroll and is
// mutation-tested; the route bodies are the reasoned-out answer to "what does
// a bookkeeper need", which is expensive to rebuild if the decision ever
// changes. Hiding the buttons is not access control — a bookmarked URL or a
// curl would still get the file — so every bulk-export route calls
// companyDataExportRefusal() as the FIRST statement of its handler, before the
// session or the database is touched, and answers 403.
//
// ══ Why a mutable object and not an env var ════════════════════════════════
//
// An environment variable would be a way to turn exports back on from the
// Vercel dashboard without a code change or a review — which is exactly the
// decision the owner took away. The switch lives here, in reviewed code, and
// it is `false`. It is an object only so the check scripts that execute these
// handlers (scripts/check-payroll-export.mjs, check-accounting-route.mjs) can
// first assert the 403 and then open it in-process to keep proving the CSV
// bytes are right. Nothing in app/ or lib/ writes it, and
// scripts/check-accounting-route.mjs section 0 fails if anything starts to.
//
// Turning exports back on is a product decision: change `available` below
// and put the UI entry points back (see docs/ROADMAP.md, "Import, not
// export").

export const companyDataExport = { available: false };

export const EXPORT_UNAVAILABLE_MESSAGE = "Export isn't available";

/**
 * A 403 response when bulk export is off, or null when it is allowed.
 *
 * Takes the route's own NextResponse rather than importing next/server here,
 * so the check scripts that stub next/server see the refusal built with the
 * same stub as every other answer the route gives.
 *
 * @param {{ json: (body: unknown, init?: { status?: number }) => unknown }} NextResponse
 */
export function companyDataExportRefusal(NextResponse) {
  if (companyDataExport.available === true) return null;
  return NextResponse.json({ error: EXPORT_UNAVAILABLE_MESSAGE }, { status: 403 });
}
