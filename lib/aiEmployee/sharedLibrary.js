// lib/aiEmployee/sharedLibrary.js
//
// FieldQuo's consolidated manual library (owner, 2026-10-04): manufacturer
// manuals every company's AI team may read as READ-ONLY defaults, after the
// company's own uploads.
//
// ══ How a manual gets in — and the only two ways ═══════════════════════════
//
//   1. FieldQuo uploads it on /platform/manuals (a platform admin). The file
//      is stored privately in FieldQuo's own folder (SHARED_LIBRARY_SCOPE),
//      read page by page by the same reader the company library uses
//      (lib/aiEmployee/reference.js readReferenceFile), and goes live.
//   2. A company ticks "share this manufacturer's manual" on one of ITS
//      manuals, confirming it is the manufacturer's own unmodified document.
//      The page TEXT is copied into the library as "pending"; nothing reaches
//      any other company until a platform admin approves it. The company's
//      file stays in the company's private folder — it is never copied.
//
// Nothing else. A company's private upload — a manual nobody ticked, a
// policy, a troubleshooting guide, an SOP — never becomes a SharedManual:
// canShare() refuses every kind but "manual", every source without a file
// hash, every unread file, and every untagged one (a manual nobody can say
// the brand of is a manual nobody can retrieve for the right furnace).
//
// ══ Deduplicated by the file's SHA-256 ═════════════════════════════════════
//
// SharedManual.fileHash is unique. A second company sharing the same PDF,
// or FieldQuo uploading one a company already shared, finds the existing row
// rather than storing a second copy. And retrieval skips a library manual
// whose hash matches one of the company's OWN uploads — their copy wins and
// the same pages are never sent twice.
//
// ══ Isolation ══════════════════════════════════════════════════════════════
//
// The library reads (liveSharedManuals, sharedPagesFor) touch only
// SharedManual / SharedManualPage rows with status "live" — never
// AiEmployeeSource or AiEmployeeSourcePage, which are the per-company
// tables. So a company's private material cannot reach another tenant
// through this file by construction: the only door from a company's table
// into the library is shareSource(), which needs that company's own session
// and its own tick. scripts/check-reference-library.mjs executes both.

import { cleanTags } from "./reference";

/** The pseudo-company folder FieldQuo's own uploads go to
 *  (fieldquo/companies/<this>/reference/…) — no cuid can be this string. */
export const SHARED_LIBRARY_SCOPE = "fieldquo-library";

export const SHARED_STATUSES = Object.freeze(["pending", "live", "retired", "withdrawn", "failed"]);

/** What a platform admin may move a manual to, from where. */
const MOVES = Object.freeze({
  pending: ["live", "retired"],
  live: ["retired"],
  retired: ["live"],
  withdrawn: [],
  failed: [],
});

export function canMove(from, to) {
  return (MOVES[from] || []).includes(to);
}

/** How a library manual is labelled in a prompt, so the model can cite it. */
export const LIBRARY_LABEL = "FieldQuo manual library";

/** Max library manuals one reply reads pages from. */
export const SHARED_PER_REPLY = 3;

/**
 * May this company source be shared? Pure.
 * @returns {{ ok: true } | { ok: false, reason }}
 */
export function canShare(source) {
  if (!source) return { ok: false, reason: "not_found" };
  if (source.kind !== "manual") return { ok: false, reason: "not_a_manual" };
  if (!source.fileHash || !source.storageKey) return { ok: false, reason: "no_file" };
  if (!(Number(source.pageCount) > 0)) return { ok: false, reason: "not_a_pdf" };
  if (source.status !== "ready" && source.status !== "partial") return { ok: false, reason: "not_read" };
  if (!String(source.brand || "").trim()) return { ok: false, reason: "no_brand" };
  return { ok: true };
}

/**
 * Share one of a company's manuals with the library. Read under the
 * company; writes the library row (or finds it by hash) and copies the
 * page text, pending review. Never touches another company's rows.
 */
export async function shareSource({ prisma, companyId, sourceId, confirmed = false, now = new Date() }) {
  if (confirmed !== true) return { ok: false, status: 400, reason: "not_confirmed" };
  const source = await prisma.aiEmployeeSource.findFirst({
    where: { id: sourceId, companyId },
    select: {
      id: true, kind: true, title: true, status: true, fileHash: true, storageKey: true, pageCount: true, pagesRead: true,
      unreadPages: true, brand: true, modelPattern: true, category: true, trade: true, originalFilename: true, bytes: true,
      sharedManualId: true, sharedAt: true,
    },
  });
  const verdict = canShare(source);
  if (!verdict.ok) return { ok: false, status: verdict.reason === "not_found" ? 404 : 400, reason: verdict.reason };
  if (source.sharedAt && source.sharedManualId) return { ok: true, already: true, manualId: source.sharedManualId };

  const existing = await prisma.sharedManual.findUnique({ where: { fileHash: source.fileHash }, select: { id: true, status: true, origin: true, sharedByCompanyId: true } });
  let manualId = existing?.id || null;
  if (existing) {
    // The same PDF is already in the library. A share this company withdrew
    // earlier comes back to review; anything else is left exactly as it is.
    if (existing.status === "withdrawn" && existing.sharedByCompanyId === companyId) {
      await prisma.sharedManual.update({ where: { id: existing.id }, data: { status: "pending" } });
    }
  } else {
    const pages = await prisma.aiEmployeeSourcePage.findMany({
      where: { companyId, sourceId: source.id },
      orderBy: { page: "asc" },
      select: { page: true, text: true, method: true },
    });
    const tags = cleanTags(source);
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.sharedManual.create({
        data: {
          fileHash: source.fileHash,
          title: String(source.title || "Manual").slice(0, 200),
          ...tags,
          originalFilename: source.originalFilename || null,
          bytes: Number(source.bytes) || 0,
          storageKey: null,
          origin: "company_share",
          sharedByCompanyId: companyId,
          sharedFromSourceId: source.id,
          status: "pending",
          pageCount: source.pageCount,
          pagesRead: source.pagesRead,
          unreadPages: source.unreadPages ?? null,
        },
        select: { id: true },
      });
      if (pages.length) {
        await tx.sharedManualPage.createMany({ data: pages.map((p) => ({ manualId: row.id, page: p.page, text: p.text, method: p.method })) });
      }
      return row;
    }, { timeout: 60_000 });
    manualId = created.id;
  }
  await prisma.aiEmployeeSource.updateMany({ where: { id: source.id, companyId }, data: { sharedManualId: manualId, sharedAt: now } });
  return { ok: true, manualId, deduplicated: Boolean(existing) };
}

/**
 * Stop sharing. While the library copy is still pending review it is
 * withdrawn; once FieldQuo has made it live it stays (it is the
 * manufacturer's document, not the company's), and the company's own
 * source simply stops being marked as shared.
 */
export async function withdrawShare({ prisma, companyId, sourceId }) {
  const source = await prisma.aiEmployeeSource.findFirst({ where: { id: sourceId, companyId }, select: { id: true, sharedManualId: true, sharedAt: true } });
  if (!source) return { ok: false, status: 404, reason: "not_found" };
  if (!source.sharedAt) return { ok: true, already: true };
  let manualStatus = null;
  if (source.sharedManualId) {
    const res = await prisma.sharedManual.updateMany({
      where: { id: source.sharedManualId, origin: "company_share", sharedByCompanyId: companyId, status: "pending" },
      data: { status: "withdrawn" },
    });
    const now = await prisma.sharedManual.findUnique({ where: { id: source.sharedManualId }, select: { status: true } });
    manualStatus = res?.count ? "withdrawn" : now?.status || null;
  }
  await prisma.aiEmployeeSource.updateMany({ where: { id: source.id, companyId }, data: { sharedAt: null } });
  return { ok: true, manualStatus };
}

/**
 * The live library manuals as retrieval sources — metadata only, never a
 * page — minus any whose file this company uploaded itself.
 */
export async function liveSharedManuals(prisma, { ownHashes = [] } = {}) {
  if (!prisma?.sharedManual?.findMany) return [];
  try {
    const rows = await prisma.sharedManual.findMany({
      where: { status: "live", brand: { not: null }, ...(ownHashes.length ? { fileHash: { notIn: ownHashes } } : {}) },
      select: { id: true, title: true, brand: true, modelPattern: true, category: true, trade: true, pageCount: true },
      take: 2000,
    });
    return rows.map(asSource);
  } catch (err) {
    console.error("[aiEmployee] shared library read failed:", err?.message);
    return [];
  }
}

/** A library row in the shape selectChunks reads, marked as the library's. */
export function asSource(row) {
  return {
    id: `shared:${row.id}`,
    sharedId: row.id,
    shared: true,
    title: `${row.title} (${LIBRARY_LABEL})`,
    kind: "manual",
    brand: row.brand || null,
    modelPattern: row.modelPattern || null,
    category: row.category || null,
    trade: row.trade || null,
    pageCount: row.pageCount ?? null,
  };
}

/**
 * The pages worth reading from the library for this message: only manuals
 * the plan SIGNALLED (tagged for this client's equipment or named in the
 * message — never a scan of the whole library), at most SHARED_PER_REPLY,
 * and only pages containing the message's words.
 */
export async function sharedPagesFor(prisma, { manuals = [], plan = null, perRead = 24 } = {}) {
  const out = new Map();
  if (!prisma?.sharedManualPage?.findMany || !plan) return out;
  const wanted = new Set(plan.signalled || []);
  const ids = manuals.filter((m) => wanted.has(m.id)).slice(0, SHARED_PER_REPLY).map((m) => m.sharedId);
  if (!ids.length) return out;
  try {
    const where = plan.firstPagesOnly
      ? { manualId: { in: ids }, page: { lte: 2 }, text: { not: null } }
      : { manualId: { in: ids }, text: { not: null }, OR: (plan.terms || []).map((t) => ({ text: { contains: t, mode: "insensitive" } })) };
    if (!plan.firstPagesOnly && !(plan.terms || []).length) return out;
    const rows = await prisma.sharedManualPage.findMany({
      where,
      orderBy: [{ manualId: "asc" }, { page: "asc" }],
      take: plan.firstPagesOnly ? 4 : perRead,
      select: { manualId: true, page: true, text: true },
    });
    for (const r of rows) {
      const key = `shared:${r.manualId}`;
      if (!out.has(key)) out.set(key, []);
      out.get(key).push({ page: r.page, text: r.text });
    }
  } catch (err) {
    console.error("[aiEmployee] shared pages read failed:", err?.message);
  }
  return out;
}

/** One library row as /platform/manuals lists it. */
export function platformView(row, extras = {}) {
  return {
    id: row.id,
    title: row.title,
    tags: { brand: row.brand || null, modelPattern: row.modelPattern || null, category: row.category || null, trade: row.trade || null },
    origin: row.origin,
    status: row.status,
    pageCount: row.pageCount ?? null,
    pagesRead: row.pagesRead ?? null,
    bytes: row.bytes || 0,
    originalFilename: row.originalFilename || null,
    sharedByCompanyId: row.sharedByCompanyId || null,
    sharedByCompanyName: extras.companyName || null,
    usedByCompanies: extras.usedBy ?? null,
    failureReason: row.failureReason || null,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt || null,
  };
}
