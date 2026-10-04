// app/api/ai-employee/sources/route.js
//
// The resource material — the policy, the troubleshooting guide, the manual.
//
//   GET  → every source, with its status and why a failed one failed
//   POST → multipart upload, or { title, kind, text } pasted straight in
//
// ══ Why this does not go through /api/upload ═══════════════════════════════
//
// That route puts a FILE on Cloudinary and hands back a URL, which is exactly
// right for a logo and exactly wrong here: what this feature needs is the TEXT,
// read once, stored, and handed to a model. A Cloudinary URL would be a second
// place the same document lives, a second thing to keep in sync with a delete,
// and a file we would then have to fetch back and parse on every reply.
//
// The formats FieldQuo can honestly read are the ones whose bytes are their
// text — lib/aiEmployee/sources.js draws that line and says why.
//
// ══ …and, since 2026-10-04, the REFERENCE LIBRARY ═════════════════════════
//
// A PDF manual or an .xlsx code list is the one case where a stored file IS
// the right shape: it is read page by page, it has pages to cite, and
// "Extract error codes" and "Read scanned pages with AI" come back to it. So
// it does NOT come through this route's body (Vercel refuses a body over
// ~4.5 MB, and a manual is often bigger): the browser uploads it straight to
// private storage (lib/media/uploadClient.js, purpose "reference") and then
// POSTs { file: { url, … }, title, kind, tags } here. This route reads it
// back through a five-minute signed link, extracts every page with the
// drawing read's own reader (lib/aiEmployee/reference.js →
// lib/planRead/ingest.js), and writes the source and its pages together.
// A page it could not read is stored UNREAD and counted on the screen.
export const runtime = "nodejs";
// A 400-page manual is read page by page in this request.
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { cloudinary } from "@/lib/cloudinary";
import {
  MAX_SOURCE_BYTES,
  SOURCE_KINDS,
  classifySourceFile,
  estimateTokens,
  extractText,
} from "@/lib/aiEmployee/sources";
import {
  referenceKindFor,
  isOwnReferenceUrl,
  readReferenceFile,
  cleanTags,
  sha256,
  ocrEstimateCents,
  codeExtractEstimateCents,
  codeTableCandidates,
  REFERENCE_FOLDER,
} from "@/lib/aiEmployee/reference";
import { unreadOf } from "@/lib/aiEmployee/referencePages";
import { fetchOwnPrivateFile } from "@/lib/planRead/ingest";
import { PLAN_DOCUMENT_MAX_BYTES } from "@/lib/media/validate";

async function admin(request, { allowSupportToLook = false } = {}) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  try {
  // Read-only support may look. Only the GET passes the flag, so support
  // reads the uploaded material and can add or remove none of it —
  // non-negotiable #3, the console views everything and edits nothing.
  if (allowSupportToLook && member.impersonation) return { member };
    requirePermission(member.role, "user:manage");
  } catch {
    return {
      response: NextResponse.json(
        { error: "Only an owner or admin can manage the AI employee's material." },
        { status: 403 },
      ),
    };
  }
  return { member };
}

/** Never returns extractedText, the pages or the stored URL. A settings list
 *  does not need the document, and shipping a whole manual into a browser
 *  to render a row is waste. `extras` carries what only the list knows: the
 *  prices of the two paid actions, computed here so the button shows the
 *  same number the server will hold itself to. */
function publicSource(row, extras = {}) {
  const unread = unreadOf(row);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    originalFilename: row.originalFilename,
    bytes: row.bytes,
    tokenCount: row.tokenCount,
    status: row.status,
    // An i18n KEY, translated by the screen — see the schema note.
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    // The reference library (null on a text source).
    stored: Boolean(row.storageKey),
    // The hash of the company's own file — the browser checks a re-picked
    // PDF against it before rendering a single page for "Read scanned pages".
    fileHash: row.fileHash || null,
    pageCount: row.pageCount ?? null,
    pagesRead: row.pagesRead ?? null,
    unreadPages: unread,
    tags: { trade: row.trade || null, brand: row.brand || null, modelPattern: row.modelPattern || null, category: row.category || null },
    ocrEstimateCents: unread.length ? ocrEstimateCents(unread.length) : 0,
    codeExtractEstimateCents: extras.codeExtractEstimateCents ?? 0,
    codeCount: extras.codeCount ?? 0,
  };
}

/** The columns publicSource reads — the list never selects the text. */
const LIST_SELECT = {
  id: true, kind: true, title: true, originalFilename: true, bytes: true, tokenCount: true, status: true,
  failureReason: true, createdAt: true, storageKey: true, fileHash: true, pageCount: true, pagesRead: true, unreadPages: true,
  trade: true, brand: true, modelPattern: true, category: true,
};

/**
 * The row material is filed under. A company may have several employees now
 * (one per role); the material is the COMPANY'S — its policy applies to the
 * closer and the receptionist alike — so lib/aiEmployee/respond.js reads it
 * under companyId, and the employeeId here is bookkeeping: the oldest row,
 * created as the default receptionist if the company has none yet.
 */
async function employeeFor(companyId) {
  const existing = await db.aiEmployee.findFirst({ where: { companyId }, orderBy: { createdAt: "asc" } });
  return existing || db.aiEmployee.create({ data: { companyId, role: "receptionist" } });
}

export async function GET(request) {
  const { member, response } = await admin(request, { allowSupportToLook: true });
  if (response) return response;

  // Not for a read-only support session: looking must not create the row.
  if (member.impersonationMode !== "read_only") await employeeFor(member.companyId);
  const rows = await db.aiEmployeeSource.findMany({
    // Company-wide — see employeeFor. It still runs above so a first read
    // creates the default row the POST will file under.
    where: { companyId: member.companyId },
    orderBy: { createdAt: "desc" },
    select: LIST_SELECT,
  });

  // The extraction price is computed from the SAME candidate pages the
  // extraction will read (lib/aiEmployee/errorCodes.js codeTableCandidates),
  // so the button and the charge cannot disagree. PDFs only.
  const pdfIds = rows.filter((r) => Number(r.pageCount) > 0).map((r) => r.id);
  const [pages, counts] = await Promise.all([
    pdfIds.length
      ? db.aiEmployeeSourcePage.findMany({
          where: { companyId: member.companyId, sourceId: { in: pdfIds }, text: { not: null } },
          select: { sourceId: true, page: true, text: true },
        })
      : [],
    pdfIds.length
      ? db.referenceCode.groupBy({ by: ["sourceId"], where: { companyId: member.companyId, sourceId: { in: pdfIds }, rejectedAt: null }, _count: { _all: true } })
      : [],
  ]);
  const bySource = new Map();
  for (const p of pages) {
    if (!bySource.has(p.sourceId)) bySource.set(p.sourceId, []);
    bySource.get(p.sourceId).push(p);
  }
  const codeCount = new Map(counts.map((c) => [c.sourceId, c._count?._all || 0]));

  return NextResponse.json({
    sources: rows.map((r) =>
      publicSource(r, {
        codeExtractEstimateCents: bySource.has(r.id) ? codeExtractEstimateCents(codeTableCandidates(bySource.get(r.id))) : 0,
        codeCount: codeCount.get(r.id) || 0,
      }),
    ),
  });
}

/**
 * A reference-library file the browser already put in private storage:
 * read it back, extract it, write the source and its pages together.
 */
async function addReferenceFile({ member, employee, body }) {
  const file = body?.file && typeof body.file === "object" ? body.file : {};
  const url = typeof file.url === "string" ? file.url : "";
  const filename = typeof file.filename === "string" ? file.filename.slice(0, 200) : null;
  const mimeType = typeof file.mimeType === "string" ? file.mimeType.slice(0, 120) : null;
  const kindOfFile = referenceKindFor(mimeType, filename || url);
  // The tenant fence for a URL a browser relayed: this company's private
  // reference folder, or nothing.
  if (!kindOfFile || !isOwnReferenceUrl(url, { companyId: member.companyId })) {
    return NextResponse.json({ error: "That file hasn't been uploaded yet. Pick it again — files are stored through FieldQuo's own uploader." }, { status: 400 });
  }
  const title = (String(body?.title || "").trim() || filename || "Manual").slice(0, 200);
  const kind = SOURCE_KINDS.includes(body?.kind) ? body.kind : kindOfFile === "pdf" ? "manual" : "other";
  const tags = cleanTags(body?.tags || {});
  const base = {
    companyId: member.companyId,
    employeeId: employee.id,
    kind,
    title,
    originalFilename: filename,
    mimeType,
    bytes: Math.max(0, Math.min(2_000_000_000, Math.round(Number(file.bytes) || 0))),
    storageKey: url,
    ...tags,
  };

  const configured = Boolean(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  const fetched = await fetchOwnPrivateFile(url, {
    companyId: member.companyId,
    folder: REFERENCE_FOLDER,
    maxBytes: PLAN_DOCUMENT_MAX_BYTES,
    sign: configured ? (publicId, format, options) => cloudinary.utils.private_download_url(publicId, format, options) : null,
  });
  if (!fetched.ok) {
    // RECORDED, like every refusal on this screen: the upload arrived and
    // could not be read back, and the row says so.
    const row = await db.aiEmployeeSource.create({
      data: { ...base, status: "failed", failureReason: fetched.reason === "too_large" ? "app.aiEmployee.source.failed.fileTooLarge" : "app.aiEmployee.source.failed.storage" },
      select: LIST_SELECT,
    });
    return NextResponse.json({ source: publicSource(row) }, { status: 201 });
  }

  const read = await readReferenceFile(fetched.buffer, kindOfFile);
  const fileHash = sha256(fetched.buffer);
  if (!read.ok) {
    const row = await db.aiEmployeeSource.create({
      data: { ...base, fileHash, status: "failed", failureReason: read.reason },
      select: LIST_SELECT,
    });
    return NextResponse.json({ source: publicSource(row) }, { status: 201 });
  }

  if (read.kind !== "pdf") {
    const row = await db.aiEmployeeSource.create({
      data: { ...base, fileHash, status: "ready", extractedText: read.text, tokenCount: read.tokenCount },
      select: LIST_SELECT,
    });
    return NextResponse.json({ source: publicSource(row) }, { status: 201 });
  }

  const { summary } = read;
  const textChars = read.pages.reduce((n, p) => n + (p.text ? p.text.length : 0), 0);
  // The source and every page in ONE transaction: a manual is never
  // half-written, and never "ready" with no pages behind it.
  const row = await db.$transaction(async (tx) => {
    const created = await tx.aiEmployeeSource.create({
      data: {
        ...base,
        fileHash,
        status: summary.status,
        failureReason: summary.failureReason,
        pageCount: summary.pageCount,
        pagesRead: summary.pagesRead,
        unreadPages: summary.unreadPages,
        // The same chars/4 estimate a text source carries (sources.js
        // estimateTokens) — of the pages that were READ, so a scan adds none.
        tokenCount: Math.ceil(textChars / 4),
      },
      select: LIST_SELECT,
    });
    await tx.aiEmployeeSourcePage.createMany({
      data: read.pages.map((p) => ({ companyId: member.companyId, sourceId: created.id, page: p.page, text: p.text, method: p.method })),
    });
    return created;
  }, { timeout: 60_000 });
  return NextResponse.json({ source: publicSource(row), skippedPages: summary.skippedPages }, { status: 201 });
}

export async function POST(request) {
  const { member, response } = await admin(request);
  if (response) return response;

  const employee = await employeeFor(member.companyId);
  const contentType = request.headers.get("content-type") || "";

  let title;
  let kind;
  let filename = null;
  let mimeType = null;
  let bytes = 0;
  let raw = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    filename = typeof file.name === "string" ? file.name : null;
    mimeType = typeof file.type === "string" ? file.type : null;
    bytes = Number(file.size) || 0;
    title = String(form.get("title") || "").trim() || filename || "Untitled";
    kind = String(form.get("kind") || "other");

    // ── The refusal is RECORDED, not thrown away ────────────────────────
    //
    // A contractor who uploads a 40-page PDF manual needs to see that it
    // arrived and was not read. A 400 and a toast is a file that vanished,
    // which reads as a bug and gets uploaded again.
    const verdict = classifySourceFile({ filename, mimeType, bytes });
    if (!verdict.ok) {
      const row = await db.aiEmployeeSource.create({
        data: {
          companyId: member.companyId,
          employeeId: employee.id,
          kind: SOURCE_KINDS.includes(kind) ? kind : "other",
          title,
          originalFilename: filename,
          mimeType,
          bytes,
          status: "failed",
          failureReason: verdict.reason,
        },
      });
      return NextResponse.json({ source: publicSource(row) }, { status: 201 });
    }

    raw = new Uint8Array(await file.arrayBuffer());
  } else {
    const body = await request.json().catch(() => ({}));
    // A file the browser put in private storage — the reference library.
    if (body?.file) return addReferenceFile({ member, employee, body });
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "Paste something first." }, { status: 400 });
    }
    if (text.length > MAX_SOURCE_BYTES) {
      return NextResponse.json(
        { error: "That's longer than one source can hold. Split it in two." },
        { status: 400 },
      );
    }
    title = String(body.title || "").trim() || "Pasted note";
    kind = String(body.kind || "other");
    bytes = Buffer.byteLength(text, "utf8");
    raw = text;
  }

  const extracted = extractText(raw);
  const row = await db.aiEmployeeSource.create({
    data: {
      companyId: member.companyId,
      employeeId: employee.id,
      kind: SOURCE_KINDS.includes(kind) ? kind : "other",
      title: title.slice(0, 200),
      originalFilename: filename,
      mimeType,
      bytes,
      status: extracted.ok ? "ready" : "failed",
      failureReason: extracted.ok ? null : extracted.reason,
      // Null when it failed. Never a placeholder and never the filename — a
      // source with no text contributes nothing to a prompt, and that is the
      // honest state for the screen to show.
      extractedText: extracted.ok ? extracted.text : null,
      tokenCount: extracted.ok ? estimateTokens(extracted.text) : 0,
    },
  });

  return NextResponse.json({ source: publicSource(row) }, { status: 201 });
}
