// app/api/marketing-spend/google-ads-import/route.js
//
// Import a downloaded Google Ads report (CSV, Excel CSV or .xlsx) as
// MarketingSpend rows — the half of the Google Ads integration that works
// TODAY, with no Google approval of anything (docs/GOOGLE-ADS-INTEGRATION.md).
//
// One route, two modes, and the FILE is sent both times:
//
//   mode=preview  parse, plan against this company's rows, write nothing
//   mode=commit   parse the same file again, plan again against what is on
//                 file NOW, and write
//
// The commit never takes rows back from the browser. The preview it showed is
// the browser's copy; what gets written is what the server reads out of the
// file at the moment of writing — the same rule non-negotiable #5 sets for
// add-on prices, applied to a back-office import: amounts come from the
// source, not from a payload a tab could have edited. Re-running it is safe
// by construction: every row is keyed by (source, campaign, day), so a second
// commit of the same file UPDATES the rows the first one wrote.
//
// Same gate as logging spend by hand (user:manage).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import {
  decodeReportBytes,
  csvTextToMatrix,
  xlsxCell,
  parseGoogleAdsReport,
  MAX_REPORT_BYTES,
} from "@/lib/googleAds/reportParse";
import { buildGoogleSpendPlan, planWindow, GOOGLE_PLATFORM } from "@/lib/googleAds/spendPlan";
import { writeGoogleSpendPlan } from "@/lib/googleAds/writePlan";

const SOURCE = "google_ads_csv";
const PREVIEW_ROWS = 300;

// Each file-level refusal, in a sentence the dialog prints as-is (the dialog
// also has a translated line per code; this English is for the API reader).
const FILE_ERRORS = {
  empty_file: "That file is empty.",
  unparseable: "That file couldn't be read as a spreadsheet or CSV.",
  is_xlsx: "That file is an Excel workbook saved with a .csv name. Upload it as .xlsx.",
  no_header: "No Campaign and Cost columns were found in the first 15 rows. Download the Campaigns report from Google Ads with the Cost column showing.",
  headers_only: "The report has a header row but no campaign rows.",
  only_empty_rows: "Every campaign row in the report has no cost, clicks or impressions.",
  not_daily: "This report is split by week or month. Download it split by Day (Segment → Time → Day) so each day's spend lands on its own date.",
  ambiguous_dates: "The Day column's dates could be day-first or month-first and no row decides which. Download the report again with dates as YYYY-MM-DD.",
  no_day_no_range: "The report has no Day column and no date range above the header, so there's no date to put the spend on.",
  too_many_rows: "That report has more rows than one import takes. Download a shorter date range.",
  too_large: "That file is larger than 5 MB. Download a shorter date range.",
};

function refuse(code, status = 400, extra = {}) {
  return NextResponse.json({ error: FILE_ERRORS[code] || code, code, ...extra }, { status });
}

async function readMatrix(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_REPORT_BYTES) return { error: "too_large" };
  const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (isZip) {
    try {
      const readXlsxFile = (await import("read-excel-file/node")).default;
      const sheets = await readXlsxFile(Buffer.from(bytes));
      // Google's .xlsx has one sheet; a hand-saved workbook may have more.
      // The first sheet that parses as a report is the report.
      const list = Array.isArray(sheets) ? sheets : [];
      for (const s of list) {
        const matrix = (s?.data || []).map((row) => (row || []).map(xlsxCell));
        if (parseGoogleAdsReport(matrix).error !== "no_header") return { matrix };
      }
      return { matrix: list[0] ? (list[0].data || []).map((row) => (row || []).map(xlsxCell)) : [] };
    } catch {
      return { error: "unparseable" };
    }
  }
  const decoded = decodeReportBytes(bytes);
  if (decoded.error) return { error: decoded.error };
  return { matrix: csvTextToMatrix(decoded.text) };
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can import marketing spend" },
      { status: err.status || 403 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "Attach the report file." }, { status: 400 });
  }
  const mode = form.get("mode") === "commit" ? "commit" : "preview";
  const statedCurrency = typeof form.get("currency") === "string" ? form.get("currency") : null;
  // Default ON: a row that looks like spend already on file is skipped unless
  // the person unticks the box on the preview.
  const skipPossibleDuplicates = form.get("skipDuplicates") !== "0";

  const { matrix, error: readError } = await readMatrix(file);
  if (readError) return refuse(readError);

  const report = parseGoogleAdsReport(matrix, { statedCurrency });
  if (report.error) return refuse(report.error, 400, { nonDaySegment: report.nonDaySegment || null });

  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { currency: true } });
  const companyCurrency = company?.currency || null;

  if (report.needsCurrency) {
    // Absent is not "the company's currency". Asked, never assumed.
    return NextResponse.json({ needsCurrency: true, companyCurrency, code: "needs_currency" }, { status: 422 });
  }

  const period = planWindow(report.rows);
  const existingSpend = period
    ? await db.marketingSpend.findMany({
        where: { companyId: member.companyId, platform: GOOGLE_PLATFORM, date: period },
        select: { id: true, source: true, externalId: true, platform: true, date: true, campaignName: true, campaignId: true },
      })
    : [];

  const plan = buildGoogleSpendPlan({
    rows: report.rows,
    existingSpend,
    companyCurrency,
    source: SOURCE,
    skipPossibleDuplicates,
  });

  const fileSummary = {
    granularity: report.granularity,
    range: report.range,
    currencies: report.currencies,
    decimal: report.decimal,
    skippedTotals: report.skippedTotals,
    skippedEmpty: report.skippedEmpty,
    mergedRows: report.mergedRows,
    rowErrors: report.rowErrors.slice(0, 50),
    rowErrorCount: report.rowErrors.length,
  };

  if (mode === "preview") {
    const updates = new Set(plan.toUpdate.map((u) => u.data.externalId));
    const dupes = new Set(plan.possibleDuplicates.map((d) => d.externalId));
    const rows = report.rows.slice(0, PREVIEW_ROWS).map((r) => ({
      date: r.date,
      rangeEnd: r.rangeEnd,
      campaignName: r.campaignName,
      amount: r.amount,
      currency: r.currency,
      clicks: r.clicks,
      impressions: r.impressions,
      conversions: r.conversions,
      status: updates.has(r.externalKey) ? "update" : dupes.has(r.externalKey) ? "duplicate" : "new",
    }));
    return NextResponse.json({
      mode,
      companyCurrency,
      file: fileSummary,
      summary: plan.summary,
      currencyMismatch: plan.currencyMismatch,
      possibleDuplicates: plan.possibleDuplicates.slice(0, 50),
      rows,
      rowsShown: rows.length,
      rowsTotal: report.rows.length,
    });
  }

  // ── commit ───────────────────────────────────────────────────────────────
  // The same writer the API sync uses (lib/googleAds/writePlan.js): creates
  // are upserts on (company, source, externalId), updates are scoped to this
  // company AND this source — never a manual, Meta or API row.
  await writeGoogleSpendPlan(db, member.companyId, SOURCE, plan);

  await recordActivity(member, {
    action: "marketing_spend.google_ads_imported",
    entityType: "settings",
    entityId: member.companyId,
    summary: `Imported a Google Ads report: ${plan.summary.created} new, ${plan.summary.updated} updated, ${plan.summary.skipped} skipped as possible duplicates`,
    metadata: { fileName: typeof file.name === "string" ? file.name.slice(0, 200) : null, ...plan.summary },
  });

  return NextResponse.json({
    mode,
    companyCurrency,
    file: fileSummary,
    summary: plan.summary,
    currencyMismatch: plan.currencyMismatch,
    possibleDuplicates: plan.possibleDuplicates.slice(0, 50),
  });
}
