// app/api/settings/testimonials/import/route.js
//
// Bulk import: a paste, or the text of a CSV file.
//
// ── The browser sends text and nothing else ────────────────────────────────
//
// It does not parse, does not decide the format, and does not send parsed
// rows. Papa Parse runs here. A client that chooses the format can choose
// wrong — a review reading "Fast, tidy, fair" parsed as CSV becomes three
// columns of nonsense — and the server would have no way to tell that from a
// genuine spreadsheet. One decision, made once, on the side that is
// accountable for what gets stored.
//
// ── Imported rows arrive unapproved ────────────────────────────────────────
//
// A hundred rows land from a file nobody has read line by line. Publishing
// them on the strength of an upload is how a one-star review, or a test row
// left in a spreadsheet, ends up on a contractor's homepage. Approval is a
// separate, visible act on the screen that lists them.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { recordActivity } from "@/lib/activity/log";
import {
  looksTabular,
  parseBlocks,
  parseTabularRows,
  totalSkipped,
  MAX_ROWS,
} from "@/lib/reviews/testimonials";
import { refuseUnlessAdmin } from "@/lib/reviews/testimonialAccess";

// A generous ceiling on the raw paste, checked before parsing so a pathological
// upload is refused rather than parsed. MAX_ROWS reviews at Google's own 4096
// character cap, plus slack for the names and separators.
const MAX_TEXT = MAX_ROWS * 4200;

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const refusal = refuseUnlessAdmin(member);
  if (refusal) return refusal;

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text : "";

  if (!text.trim()) {
    return NextResponse.json({ error: "Nothing to import — paste some reviews first." }, { status: 400 });
  }
  if (text.length > MAX_TEXT) {
    return NextResponse.json(
      { error: "That's too much at once. Import it in a few smaller batches." },
      { status: 400 },
    );
  }

  const tabular = looksTabular(text);
  const parsed = tabular
    ? parseTabularRows(
        Papa.parse(text.trim(), { header: true, skipEmptyLines: "greedy" }).data,
      )
    : parseBlocks(text);

  if (!parsed.rows.length) {
    // Refused with the reason rather than a cheerful "imported 0". The two
    // realistic causes are a paste with no blank lines between reviews and a
    // spreadsheet whose columns weren't recognised, and the contractor can
    // only fix either one if told which happened.
    return NextResponse.json(
      {
        error: tabular
          ? "That looks like a spreadsheet, but no rows had both a name and a review in them."
          : "Couldn't find any reviews in that. Put the name on its own line, what they said underneath, and a blank line between each one.",
      },
      { status: 400 },
    );
  }

  // Sequential rather than a transaction: a bad row in a hundred should not
  // discard the ninety-nine good ones, and the operation is safe to repeat by
  // construction — every write is an upsert on the content identity, so
  // running the same import twice lands in exactly the state one run does.
  let imported = 0;
  let updated = 0;

  for (const row of parsed.rows) {
    const existing = await db.testimonial.findUnique({
      where: {
        companyId_externalId: { companyId: member.companyId, externalId: row.externalId },
      },
      select: { id: true },
    });

    await db.testimonial.upsert({
      where: {
        companyId_externalId: { companyId: member.companyId, externalId: row.externalId },
      },
      create: {
        companyId: member.companyId,
        authorName: row.authorName,
        quote: row.quote,
        authorTitle: row.authorTitle,
        companyLabel: row.companyLabel,
        source: tabular ? "csv" : "manual",
        externalId: row.externalId,
        approved: false,
      },
      // The words and the author are the identity, so an update can only ever
      // be the trimmings. Deliberately NOT touching `approved`: re-importing a
      // list must not un-publish reviews the contractor already approved, and
      // must not publish ones they deliberately left off.
      update: {
        authorTitle: row.authorTitle,
        companyLabel: row.companyLabel,
      },
    });

    if (existing) updated++;
    else imported++;
  }

  await recordActivity(member, {
    action: "settings.testimonial.imported",
    entityType: "company",
    entityId: member.companyId,
    summary: `Imported ${imported} review${imported === 1 ? "" : "s"}`,
    metadata: { imported, updated, skipped: parsed.skipped, format: tabular ? "csv" : "blocks" },
  });

  return NextResponse.json({
    imported,
    updated,
    skipped: totalSkipped(parsed.skipped),
    skippedDetail: parsed.skipped,
  });
}
