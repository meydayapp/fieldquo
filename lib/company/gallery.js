// lib/company/gallery.js
//
// The company's ONE before/after gallery (CompanyGalleryPair), and the
// additive merge of the two stores that preceded it.
//
// ── Why one gallery ─────────────────────────────────────────────────────────
//
// Until 2026-09-21 a before/after pair could live in two places: the
// website's `beforeafter` block (CompanySite.blocks / pages[].blocks,
// content.pairs, written by PairPhotos and the section editor) and
// Company.quoteEmailBeforeAfter (Settings › Quote Email, max four, for the
// covering email). A contractor who uploaded pairs for the website found
// the quote email empty, and vice versa. The owner's decision on the client
// proposal mockup (§2) was one gallery, migrated from both. This file is
// that gallery: the website block, the quote email and the proposal page
// all read `loadCompanyGallery()`, and every editor writes through
// `replaceCompanyGallery()`.
//
// ── The merge is additive and runs once ─────────────────────────────────────
//
// On the first read for a company (`Company.galleryMergedAt` null) the two
// older stores are COPIED in — nothing is deleted from either column, so a
// rollback loses nothing — deduplicated on (beforeUrl, afterUrl), and the
// marker is stamped. It runs once because a pair the owner then removes
// from the gallery must stay removed: with no marker, an empty gallery
// would re-import the old stores forever.
//
// ── Shapes ──────────────────────────────────────────────────────────────────
//
// The gallery row: { id, beforeUrl, afterUrl, beforePublicId, afterPublicId,
// caption, sortOrder, source }. Two projections for the two older readers:
//   galleryAsEmailPairs → the quoteEmailBeforeAfter shape
//                         ({ id, beforeUrl, afterUrl, caption }),
//   galleryAsSitePairs  → the website block shape ({ before, after, caption }).

import { db as realDb } from "@/lib/db";
import { sanitiseBeforeAfter } from "@/lib/quotes/emailSections";

const HTTP_URL = /^https?:\/\//i;
const str = (v) => (typeof v === "string" ? v.trim() : "");
const pairKey = (b, a) => `${b}\n${a}`;

/** The gallery's own pair shape, cleaned. Both images or nothing. */
export function sanitiseGalleryPair(raw) {
  if (!raw || typeof raw !== "object") return null;
  const beforeUrl = str(raw.beforeUrl ?? raw.before).slice(0, 1000);
  const afterUrl = str(raw.afterUrl ?? raw.after).slice(0, 1000);
  if (!HTTP_URL.test(beforeUrl) || !HTTP_URL.test(afterUrl)) return null;
  if (beforeUrl === afterUrl) return null;
  return {
    beforeUrl,
    afterUrl,
    beforePublicId: str(raw.beforePublicId).slice(0, 300) || null,
    afterPublicId: str(raw.afterPublicId).slice(0, 300) || null,
    caption: str(raw.caption).slice(0, 200) || null,
  };
}

/** Pairs from a website's block lists (blocks + every page's blocks). */
export function sitePairsOf(site) {
  const lists = [
    ...(Array.isArray(site?.blocks) ? site.blocks : []),
    ...(Array.isArray(site?.pages) ? site.pages.flatMap((p) => (Array.isArray(p?.blocks) ? p.blocks : [])) : []),
  ];
  return lists
    .filter((b) => b?.type === "beforeafter")
    .flatMap((b) => (Array.isArray(b.content?.pairs) ? b.content.pairs : []))
    .map(sanitiseGalleryPair)
    .filter(Boolean);
}

/**
 * Copy the two older stores into the gallery, once. Returns the number of
 * rows written. Safe to call on every read: it is a no-op after the stamp.
 */
export async function ensureGalleryMerged(companyId, { db = realDb } = {}) {
  if (!companyId) return 0;
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { galleryMergedAt: true, quoteEmailBeforeAfter: true, site: { select: { blocks: true, pages: true } } },
  });
  if (!company || company.galleryMergedAt) return 0;

  const existing = await db.companyGalleryPair.findMany({
    where: { companyId },
    select: { beforeUrl: true, afterUrl: true },
  });
  const seen = new Set(existing.map((r) => pairKey(r.beforeUrl, r.afterUrl)));

  const rows = [];
  let order = existing.length;
  const add = (pair, source) => {
    if (!pair) return;
    const key = pairKey(pair.beforeUrl, pair.afterUrl);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ companyId, ...pair, sortOrder: order++, source });
  };
  for (const p of sanitiseBeforeAfter(company.quoteEmailBeforeAfter)) add(sanitiseGalleryPair(p), "quote_email");
  for (const p of sitePairsOf(company.site)) add(p, "website");

  if (rows.length) await db.companyGalleryPair.createMany({ data: rows });
  await db.company.update({ where: { id: companyId }, data: { galleryMergedAt: new Date() } });
  return rows.length;
}

/** The live gallery, in order. Runs the one-time merge first. */
export async function loadCompanyGallery(companyId, { db = realDb, max = 60 } = {}) {
  if (!companyId) return [];
  await ensureGalleryMerged(companyId, { db });
  return db.companyGalleryPair.findMany({
    where: { companyId, removedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, beforeUrl: true, afterUrl: true, beforePublicId: true, afterPublicId: true,
      caption: true, sortOrder: true, source: true,
    },
    take: max,
  });
}

/**
 * Set the gallery to exactly `pairs`, in that order.
 *
 * A pair no longer in the list is soft-removed (removedAt), never deleted;
 * a pair already present keeps its row (and its id) and is re-ordered; a
 * removed pair that comes back is un-removed. Returns the live rows.
 */
export async function replaceCompanyGallery(companyId, pairs, { db = realDb, source = "manual" } = {}) {
  await ensureGalleryMerged(companyId, { db });
  const clean = (Array.isArray(pairs) ? pairs : []).map(sanitiseGalleryPair).filter(Boolean).slice(0, 60);

  const all = await db.companyGalleryPair.findMany({
    where: { companyId },
    select: { id: true, beforeUrl: true, afterUrl: true, removedAt: true },
  });
  const byKey = new Map(all.map((r) => [pairKey(r.beforeUrl, r.afterUrl), r]));
  const keep = new Set();
  const ops = [];
  clean.forEach((pair, i) => {
    const key = pairKey(pair.beforeUrl, pair.afterUrl);
    if (keep.has(key)) return;
    keep.add(key);
    const row = byKey.get(key);
    if (row) {
      ops.push(db.companyGalleryPair.update({
        where: { id: row.id },
        data: { caption: pair.caption, beforePublicId: pair.beforePublicId, afterPublicId: pair.afterPublicId, sortOrder: i, removedAt: null },
      }));
    } else {
      ops.push(db.companyGalleryPair.create({ data: { companyId, ...pair, sortOrder: i, source } }));
    }
  });
  for (const row of all) {
    if (!row.removedAt && !keep.has(pairKey(row.beforeUrl, row.afterUrl))) {
      ops.push(db.companyGalleryPair.update({ where: { id: row.id }, data: { removedAt: new Date() } }));
    }
  }
  if (ops.length) await db.$transaction(ops);
  return loadCompanyGallery(companyId, { db });
}

// ── The unfinished pair ─────────────────────────────────────────────────────
//
// Until 2026-09-25 the "new pair" slot held its first photo in browser state
// only, with no way to remove it: the owner uploaded a before, had no after
// to hand, and wrote "I cannot delete the new pair and I think I'm stuck like
// that." Closing the dialog silently threw the photo away, which is the same
// failure from the other side.
//
// The draft is now stored — one per company, in Company.galleryDraftPair —
// so it can be finished later from any device, and removed on purpose. It is
// deliberately NOT a CompanyGalleryPair row: that table is what the website,
// the quote email and the proposal read, and a half pair (the same picture
// under two labels, or a "before" with nothing after it) must never reach a
// client. sanitiseGalleryPair keeps refusing half pairs for that table.

/** A draft: at least one side, each side a real URL; null otherwise. */
export function sanitiseGalleryDraft(raw) {
  if (!raw || typeof raw !== "object") return null;
  const beforeUrl = str(raw.beforeUrl).slice(0, 1000);
  const afterUrl = str(raw.afterUrl).slice(0, 1000);
  const before = HTTP_URL.test(beforeUrl) ? beforeUrl : "";
  const after = HTTP_URL.test(afterUrl) ? afterUrl : "";
  if (!before && !after) return null;
  return {
    beforeUrl: before || null,
    beforePublicId: before ? str(raw.beforePublicId).slice(0, 300) || null : null,
    afterUrl: after || null,
    afterPublicId: after ? str(raw.afterPublicId).slice(0, 300) || null : null,
    caption: str(raw.caption).slice(0, 200) || null,
  };
}

export async function loadGalleryDraft(companyId, { db = realDb } = {}) {
  if (!companyId) return null;
  const row = await db.company.findUnique({ where: { id: companyId }, select: { galleryDraftPair: true } });
  return sanitiseGalleryDraft(row?.galleryDraftPair);
}

/** Store the draft, or clear it with null. Returns what is stored now. */
export async function saveGalleryDraft(companyId, draft, { db = realDb, now = new Date() } = {}) {
  const clean = sanitiseGalleryDraft(draft);
  await db.company.update({
    where: { id: companyId },
    // Prisma needs DbNull to set a Json? column to SQL NULL; plain null is
    // rejected on Json fields. Imported lazily so this file stays loadable
    // by the plain-node check scripts, which stub the db.
    data: { galleryDraftPair: clean ? { ...clean, updatedAt: now.toISOString() } : await dbNull() },
  });
  return clean;
}

async function dbNull() {
  const { Prisma } = await import("@prisma/client");
  return Prisma.DbNull;
}

/** The quoteEmailBeforeAfter shape — what lib/quotes/emailSections.js sanitises. */
export function galleryAsEmailPairs(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    id: r.id,
    beforeUrl: r.beforeUrl,
    afterUrl: r.afterUrl,
    ...(r.beforePublicId ? { beforePublicId: r.beforePublicId } : {}),
    ...(r.afterPublicId ? { afterPublicId: r.afterPublicId } : {}),
    ...(r.caption ? { caption: r.caption } : {}),
  }));
}

/** The website block's shape. */
export function galleryAsSitePairs(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    before: r.beforeUrl,
    after: r.afterUrl,
    caption: r.caption || "",
  }));
}

/**
 * A Company row with `quoteEmailBeforeAfter` replaced by the gallery, so
 * every existing reader of that column (the send route, the email-sections
 * route, the settings page) reads the one gallery without changing shape.
 * The column itself is untouched.
 */
export async function withCompanyGallery(company, companyId, { db = realDb } = {}) {
  const rows = await loadCompanyGallery(companyId, { db });
  return { ...(company || {}), quoteEmailBeforeAfter: galleryAsEmailPairs(rows) };
}
