// app/api/export/accounting/route.js
//
// The bookkeeping export, as a download. One ZIP, four CSVs, one date range.
//
// lib/export/accountingExport.js is the whole of the thinking here — what a
// document is, which version of it counts, what the file cannot contain. This
// route is the plumbing around it: who may ask, what rows the module needs to
// answer honestly, and what a browser gets back. Read that file's header
// before changing anything below; three of the decisions here exist only
// because it makes them.
//
// ══ The gate, and why it is the price book's and not payroll's ═════════════
//
// Copied from app/api/products/export/route.js: memberOrRefusal, then
// requireToggle(full, "showPricing"), because this file is money and
// showPricing is the switch whose whole promise is "money is removed from what
// this person can read". Plus requireLevel(full, "invoices", "view_only"),
// because it is specifically every invoice in the company — an Estimator holds
// invoices:view_only and legitimately reads them; a member set to
// invoices:"none" does not, and the price-book gate alone would let them.
//
// Deliberately NOT the payroll export's gate. That one asks the `payroll`
// axis, which is the right question about somebody's pay and the wrong one
// about the company's revenue. Same shape, different axis.
//
// This file is at least as sensitive as the price book and worse in one
// respect: the price book names services, this names CLIENTS — every customer,
// what they were charged and what they have paid. Non-negotiable #4 exists to
// keep a rate card away from a competitor; a client list with amounts attached
// is the same exposure with the customer's name on it.
//
// A read-only support session is refused, and that is not an oversight.
// loadEnforceableMember returns null for an impersonated member (there is no
// Member row), hasToggle(null) is false, and the refusal stands. Non-negotiable
// #3 says the console views everything, and the console has its own read paths;
// what it must never do is generate a customer's year-end as a file.
//
// ══ Why a ZIP and not four downloads ═══════════════════════════════════════
//
// The four files are one document set, not four exports that happen to share a
// range. The summary is the sheet that states the range, the currency and the
// six things the data does not contain; the other three are the data it is
// describing. Four separate downloads let the three data files travel to an
// accountant without the sheet that says "this cannot produce a sales-tax
// return" — which is exactly the misreading the module was written to prevent.
// One archive keeps the caveat attached to the numbers.
//
// It also settles a smaller thing: four downloads means four requests, and
// four requests means four chances for the invoice query below to be run
// against a database that changed in between.
//
// The archive is built here, by hand, because there is no zip dependency in
// package.json and adding one for ~70 lines of a format that has not changed
// since 1993 is a worse trade. `unzip -t` on the real bytes is part of
// scripts/check-accounting-route.mjs, so this is asserted rather than assumed.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { deflateRawSync } from "node:zlib";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireToggle,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";
import { buildAccountingExport } from "@/lib/export/accountingExport";

// ── The range ──────────────────────────────────────────────────────────────

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A YYYY-MM-DD query parameter as a UTC instant, or null.
 *
 * UTC because the module decides range membership on UTC calendar days and
 * says so; parsing "2026-01-01" in the server's local zone would put the
 * boundary an hour or five off the boundary the file is grouped by, and the
 * last day of a month would sometimes be missing from its own export.
 *
 * The round-trip check catches "2026-02-31" and friends. V8 already rejects an
 * out-of-range day in an ISO string, but that is a parser behaviour rather
 * than a promise, and a date this file silently rolls into the next month is a
 * range nobody asked for.
 */
function parseDay(value) {
  if (typeof value !== "string" || !DAY.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

// Five years. Not a performance limit — a sanity one. Every real use of this
// screen is a month, a quarter or a year; a request for 1970-to-2099 is a typo
// or a script, and answering it means holding every invoice the company has
// ever raised in memory to build a file nobody reads. Refused with the number
// in the message, so the person who meant it can split it in two.
const MAX_DAYS = 1830;
const MIN_DAY = "2000-01-01";
const DAY_MS = 86400000;

/**
 * @returns {{ from: Date, to: Date, fromKey: string, toKey: string }} or
 *          {{ error: string }} — a sentence, never a 500 and never a quietly
 *          empty file. An empty CSV for a range that could not be understood
 *          looks exactly like an empty CSV for a quiet month, and a bookkeeper
 *          would file the second one.
 */
function resolveRange(searchParams, now = new Date()) {
  const rawFrom = searchParams.get("from");
  const rawTo = searchParams.get("to");
  if (!rawFrom || !rawTo) {
    return { error: "Give a start and an end date, as from=YYYY-MM-DD&to=YYYY-MM-DD." };
  }

  const from = parseDay(rawFrom);
  const to = parseDay(rawTo);
  if (!from || !to) {
    return {
      error: `Those dates don't read as YYYY-MM-DD: from=${rawFrom}, to=${rawTo}.`,
    };
  }

  const fromKey = rawFrom;
  const toKey = rawTo;
  if (fromKey > toKey) {
    return {
      error: `That range runs backwards — ${fromKey} is after ${toKey}. Swap them.`,
    };
  }
  if (fromKey < MIN_DAY) {
    return {
      error: `${fromKey} is before ${MIN_DAY}. FieldQuo has no records that old.`,
    };
  }
  // A year of slack on the far end, so "this year" works in December and a
  // clock skew never refuses a legitimate range. Beyond that it is a typo.
  const horizon = new Date(now.getTime() + 366 * DAY_MS).toISOString().slice(0, 10);
  if (toKey > horizon) {
    return { error: `${toKey} is too far in the future to export.` };
  }
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
  if (days > MAX_DAYS) {
    return {
      error: `That range is ${days} days. Export at most ${MAX_DAYS} days (about five years) at a time.`,
    };
  }

  // Inclusive at both ends, matching the module: a bookkeeper's "1 to 31
  // January" contains both. The end is the last millisecond of `to` so a row
  // timestamped at 23:59 on the closing day is inside its own range.
  return {
    from,
    to: new Date(to.getTime() + DAY_MS - 1),
    fromKey,
    toKey,
  };
}

// ── The archive ────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

/** MS-DOS packed time and date, which is the only clock a ZIP entry has. */
function dosStamp(d) {
  const year = Math.max(1980, d.getUTCFullYear());
  return {
    time:
      (d.getUTCHours() << 11) |
      (d.getUTCMinutes() << 5) |
      Math.floor(d.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

/**
 * A single-disk, no-comment ZIP of `entries` ([{ name, data: Buffer }]).
 *
 * Deflate, falling back to stored when deflate would be larger — which happens
 * on the summary sheet of an empty month and would otherwise make the file
 * bigger than its contents for no reason.
 *
 * Bit 11 of the general-purpose flags is set: it declares the entry names as
 * UTF-8, which matters the moment a company's own name reaches a filename.
 */
function zipArchive(entries, when = new Date()) {
  const { time, date } = dosStamp(when);
  const parts = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const crc = crc32(data);
    const deflated = deflateRawSync(data);
    const method = deflated.length < data.length ? 8 : 0;
    const payload = method === 8 ? deflated : data;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, payload);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(method, 10);
    dir.writeUInt16LE(time, 12);
    dir.writeUInt16LE(date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(payload.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt16LE(0, 30);
    dir.writeUInt16LE(0, 32);
    dir.writeUInt16LE(0, 34);
    dir.writeUInt16LE(0, 36);
    dir.writeUInt32LE(0, 38);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);

    offset += local.length + name.length + payload.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, centralBuf, end]);
}

/**
 * A CSV as bytes, with a UTF-8 byte-order mark.
 *
 * The payroll export solves the same problem with `charset=utf-8` on the
 * Content-Type; inside a ZIP there is no per-entry header to carry that, and
 * Excel on Windows falls back to the system code page. A client called Émile
 * Côté then arrives as Ã‰mile CÃ´tÃ© in the file their accountant reads. Every
 * spreadsheet that opens CSV strips the mark; nothing downstream sees it.
 */
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function csvBytes(csv) {
  return Buffer.concat([UTF8_BOM, Buffer.from(csv, "utf8")]);
}

// ── The handler ────────────────────────────────────────────────────────────

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireToggle(full, "showPricing", "export the company's books");
    requireLevel(full, "invoices", "view_only", "export the company's books");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const range = resolveRange(new URL(request.url).searchParams);
  if (range.error) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }
  const { from, to, fromKey, toKey } = range;

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { name: true, currency: true },
  });

  // ── Invoices: families, not rows ────────────────────────────────────────
  //
  // Amending a sent invoice writes a NEW Invoice row with the SAME
  // invoiceNumber, parentInvoiceId set and version + 1
  // (app/api/invoices/[id]/route.js). There is deliberately NO
  // `parentInvoiceId: null` filter anywhere below — the module groups families
  // itself and reports the LATEST version's money at the ROOT's date, and it
  // can only do that if it is handed the children.
  //
  // Filtering to roots would export January's invoice 1042 at the total it had
  // before March corrected it. Filtering to a flat date window without
  // expanding to families is the other half of the same bug: a v1 inside the
  // range whose v2 is outside would be reported at superseded money, and a v2
  // inside the range whose v1 is outside would be dated from the amendment.
  //
  // So it is two queries. The first finds every row whose own date lands in
  // the range — using the module's date rule, sentAt then createdAt, so the
  // candidate set matches what the module will actually look at. The second
  // pulls in every sibling of every family those rows belong to, in or out of
  // range. The module then decides membership from the root, and a family
  // whose root falls outside is dropped rather than double-counted.
  const dated = { gte: from, lte: to };
  const candidates = await db.invoice.findMany({
    where: {
      companyId: member.companyId,
      OR: [
        { sentAt: dated },
        { AND: [{ sentAt: null }, { createdAt: dated }] },
      ],
    },
    select: { id: true, parentInvoiceId: true },
  });

  const rootIds = [
    ...new Set(candidates.map((row) => row.parentInvoiceId || row.id)),
  ];

  const invoices = rootIds.length
    ? await db.invoice.findMany({
        where: {
          companyId: member.companyId,
          OR: [{ id: { in: rootIds } }, { parentInvoiceId: { in: rootIds } }],
        },
        include: { client: { select: { name: true } } },
        orderBy: [{ invoiceNumber: "asc" }, { version: "asc" }],
      })
    : [];

  // Payment carries no companyId of its own; the invoice it hangs off is the
  // tenant boundary, and `invoice: { companyId }` is what scopes this.
  //
  // The nested invoice is included so a payment whose invoice is NOT in this
  // range can still name it. Without it the module warns "orphan payment" and
  // prints an internal id where the bookkeeper expects an invoice number —
  // which is every January payment against a December invoice.
  const payments = await db.payment.findMany({
    where: { invoice: { companyId: member.companyId }, date: dated },
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          client: { select: { name: true } },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  const expenses = await db.expense.findMany({
    where: { companyId: member.companyId, date: dated },
    orderBy: { date: "asc" },
  });

  let result;
  try {
    result = buildAccountingExport({
      from: fromKey,
      to: toKey,
      invoices,
      payments,
      expenses,
      // Never `|| "CAD"`. Company.currency is nullable and the module throws
      // when it is absent, on purpose — a currency guessed on an accounting
      // export is a wrong number in somebody's books. The throw is turned into
      // the refusal below rather than defaulted away.
      currency: company?.currency,
      companyName: company?.name || "",
    });
  } catch (err) {
    // 409, not 400 and not 500. The request was fine; the company's record is
    // not, and the fix is on Settings → Company Settings rather than in the
    // query string. The module's own sentence is what the caller reads — it is
    // the authority on what it will not produce, and restating it here would
    // be the copy that rots.
    //
    // Logged as well as returned: the range is validated above, so a currency
    // is the only thing left that can reach here, and anything else arriving
    // is a bug that must not vanish into a tidy refusal.
    console.error("[accounting-export] refused:", err?.message);
    return NextResponse.json(
      { error: err?.message || "That export could not be built." },
      { status: 409 },
    );
  }

  const stamp = `${fromKey}-to-${toKey}`;
  const archive = zipArchive(
    result.files.map((file) => ({ name: file.name, data: csvBytes(file.csv) })),
  );

  const counts = Object.fromEntries(
    result.files.map((file) => [file.kind, file.rowCount]),
  );

  await recordActivity(member, {
    action: "accounting.exported",
    entityType: "export",
    summary: `Exported the books for ${fromKey} to ${toKey} (${counts.invoices} invoices, ${counts.payments} payments, ${counts.expenses} expenses)`,
    metadata: {
      from: fromKey,
      to: toKey,
      currency: result.currency,
      counts,
      warnings: result.warnings.length,
    },
  });

  return new NextResponse(archive, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="bookkeeping-${stamp}.zip"`,
      // Client names and every invoice total. Not a thing to leave in a shared
      // browser cache or on a proxy.
      "Cache-Control": "private, no-store",
    },
  });
}
