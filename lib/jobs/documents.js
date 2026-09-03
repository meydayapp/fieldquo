// lib/jobs/documents.js
//
// The rules for a job's document store. No database, no Cloudinary.
//
// ══ Not lib/documents/, which is a different thing ═════════════════════════
//
// lib/documents/ RENDERS documents — it builds the PDF of a quote and the
// branding around it. docs/construction/AUDIT-existing.md §2 records that this
// name has misled everyone who went looking for a file store, so: this file is
// the store's rules, that directory is the renderer's, and neither imports the
// other.
//
// ══ A revision SUPERSEDES; nothing is ever overwritten ═════════════════════
//
// JobDocument.supersedesId exists so "which plan were we working from in
// March" stays answerable. Uploading revision B of a drawing writes a NEW row
// pointing at A; A keeps its own url, name and date forever. Replacing A's url
// in place would destroy exactly the question the column was added to answer,
// and would do it silently — the classic "destructive operation labelled as
// cosmetic" this codebase is swept for.
//
// The consequence for every reader: the list a person sees is the CURRENT
// revisions (the heads of each chain), with the history reachable behind them.
// A flat list of every row would show three copies of the same drawing and no
// way to tell which one the crew should build from.
//
// ══ No imports, on purpose ═════════════════════════════════════════════════
//
// scripts/check-daily-log.mjs executes this exact file.

/**
 * The kinds, in the order they are offered.
 *
 * Ordered by how often a contractor reaches for one, not alphabetically —
 * "plan" is the first thing anyone opens on a job and "other" is the honest
 * bottom of the list rather than a category anybody picks first.
 */
export const DOCUMENT_KINDS = [
  "plan",
  "permit",
  "contract",
  "warranty",
  "photo",
  "invoice",
  "other",
];

const KIND_SET = new Set(DOCUMENT_KINDS);

/**
 * The two kinds a crew member must not be handed.
 *
 * ── Why THESE two, and why this dial ──────────────────────────────────────
 *
 * The brief for this work put it plainly: "a crew member on a job may need the
 * plan; they must not get the contract." A signed contract and an invoice are
 * both, in substance, the price — the same thing non-negotiable #4 refuses to
 * publish and the same thing the Crew preset already withholds everywhere else
 * (lib/permissions.js: `showPricing: false`, `invoices: "none"`).
 *
 * So this reuses the existing showPricing axis rather than inventing a
 * document-level permission nobody has heard of. A new dial would be a second
 * answer to a question the product has already answered, and the copy is the
 * one that rots (AGENTS.md failure class #4).
 *
 * A permit, a warranty and a plan are all things the person doing the work
 * needs in their hand, and none of them is a price.
 */
export const MONEY_KINDS = new Set(["contract", "invoice"]);

/**
 * @throws a 400-carrying Error rather than defaulting to "other".
 *
 * Deliberately not `KIND_SET.has(raw) ? raw : "other"`. A typo'd kind filed
 * silently as "other" is a document that will never be found again by the
 * person who filed it, and the schema's `@default("other")` is there for rows
 * created without a kind at all — not for rows created with a wrong one.
 */
export function normaliseKind(raw) {
  if (raw === undefined || raw === null || raw === "") return "other";
  if (typeof raw === "string" && KIND_SET.has(raw)) return raw;
  const err = new Error(
    `"${String(raw).slice(0, 40)}" isn't a document type. Pick one of: ${DOCUMENT_KINDS.join(", ")}.`,
  );
  err.status = 400;
  err.code = "bad_document_kind";
  throw err;
}

/** May this member be handed a document of this kind? */
export function canSeeKind(kind, { canSeeMoney }) {
  return canSeeMoney || !MONEY_KINDS.has(kind);
}

/**
 * Split a list into what this member may see, and how many were removed.
 *
 * Returns a COUNT of what was withheld rather than silently shortening the
 * list, following the same rule the job page's Absent component already
 * follows: "hidden by your access level" and "there is nothing here" are
 * different statements, and showing the second when the first is true tells a
 * crew member to go and chase a contract that was filed weeks ago.
 *
 * The count is not a leak. It says a document exists in a category the member
 * already knows exists; it carries no name, no date, no url and no amount.
 */
export function visibleDocuments(documents, { canSeeMoney }) {
  const list = Array.isArray(documents) ? documents : [];
  const visible = list.filter((d) => canSeeKind(d?.kind, { canSeeMoney }));
  return { documents: visible, hiddenCount: list.length - visible.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// REVISION CHAINS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Group a flat list of rows into chains, newest first.
 *
 * A HEAD is a row nothing else supersedes. Walking `supersedesId` back from a
 * head gives that document's history, newest to oldest.
 *
 * @returns {{ id: string, current: object, history: object[] }[]}
 *
 * ── Why it tolerates a broken chain ───────────────────────────────────────
 *
 * `supersedesId` is `@unique`, so the database already prevents two rows
 * claiming to replace the same one. It does NOT prevent a row pointing at a
 * document the caller cannot see (a superseded CONTRACT, hidden from a crew
 * member by visibleDocuments above) or at one that no longer exists. Both are
 * normal, and both would hang a naive `while (next)` walk or drop the head
 * entirely. So the walk stops at the first link it cannot resolve and keeps
 * the head — a partial history is the truth for that reader, and losing the
 * current revision because its predecessor is invisible would be absurd.
 *
 * The `seen` set is belt-and-braces against a cycle. The unique constraint
 * makes one very hard to create and not impossible (A→B→A survives it), and an
 * infinite loop in a render path is a worse outcome than a truncated history.
 */
export function revisionChains(documents) {
  const list = (Array.isArray(documents) ? documents : []).filter(
    (d) => d && typeof d.id === "string",
  );
  const byId = new Map(list.map((d) => [d.id, d]));
  const superseded = new Set(
    list.map((d) => d.supersedesId).filter((v) => typeof v === "string"),
  );

  const chains = [];
  for (const doc of list) {
    if (superseded.has(doc.id)) continue; // not a head — it lives in a history

    const history = [];
    const seen = new Set([doc.id]);
    let cursor = doc.supersedesId;
    while (typeof cursor === "string" && !seen.has(cursor)) {
      const prev = byId.get(cursor);
      if (!prev) break; // hidden by access, or gone
      history.push(prev);
      seen.add(cursor);
      cursor = prev.supersedesId;
    }

    chains.push({ id: doc.id, current: doc, history });
  }
  return chains;
}

/**
 * How many revisions this document has had, counting the current one.
 *
 * 1 for a document uploaded once. Exported because "Rev 3" in a list is the
 * one number that tells a crew member the drawing in their hand may be old.
 */
export function revisionCount(chain) {
  return 1 + (Array.isArray(chain?.history) ? chain.history.length : 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// SIZE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bytes as a human string — or null when the provider did not say.
 *
 * NULL IS NOT ZERO, and this is the one place that decides it. The schema's
 * own comment on sizeBytes says it: "Null when it did not say — never zero,
 * which would read as an empty file." A row rendered as "0 bytes" tells
 * somebody the plan failed to upload, and the next thing they do is upload it
 * again — a second copy of a file that was fine, and a superseding chain that
 * now lies about a revision that never happened.
 *
 * Returning null (rather than "Unknown") keeps the decision at the renderer,
 * where the honest answer is usually to print nothing at all next to the name.
 */
export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return null;
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  // One decimal below 10 ("1.4 MB"), none above ("23 MB") — the extra digit
  // stops mattering exactly where the number gets long.
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/**
 * The bytes the browser reported for a file it just uploaded.
 *
 * ── Why the BROWSER is "the provider" here ────────────────────────────────
 *
 * /api/upload returns { url, publicId, kind, filename } and not the byte count
 * Cloudinary handed it, so the only number available at the moment a
 * JobDocument row is written is File.size from the picker. That is a real
 * measurement of the real file, and it is also client-supplied — which is fine
 * for a figure that is displayed and never computed with. Nothing prices,
 * bills, or quotas off this column.
 *
 * Anything unusable becomes NULL, never 0. sizeBytes' own schema comment says
 * why: "0 bytes" next to a plan tells somebody the upload failed, and the next
 * thing they do is upload it again — a second copy of a file that was fine.
 *
 * A literal 0 is also refused rather than stored: classifyMedia already rejects
 * an empty file (`size <= 0` — "That file appears to be empty"), so a 0 arriving
 * here did not come from a file that went through the uploader.
 */
export function normaliseSizeBytes(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  // Above Cloudinary's own video ceiling nothing legitimate reached us, so the
  // number is wrong rather than the file being large. Null, not a clamp — a
  // clamped size is a fabricated measurement.
  if (n > 100 * 1024 * 1024) return null;
  return n;
}

/**
 * Is this a URL that came out of THIS deployment's own uploader?
 *
 * A JobDocument.url is rendered as a link a member clicks, and a "contract"
 * row whose url points at somebody else's host is a phishing link filed inside
 * the contractor's own back office, wearing the contractor's own branding. So
 * the row is only written for a URL on the Cloudinary cloud this deployment
 * uploads to — which is to say, for a file that went through /api/upload, which
 * is authenticated, size-capped and type-checked (AGENTS.md: do not add a
 * second upload path).
 *
 * @param {string} url
 * @param {{cloudName?: string}} opts  CLOUDINARY_CLOUD_NAME, when configured.
 *
 * When `cloudName` is absent (a dev machine with no Cloudinary keys) the host
 * check still applies and the path check does not. Deliberately not "allow
 * everything when unconfigured": the weaker check is still a real one, and an
 * environment variable being unset must never widen what a route accepts to
 * "any URL at all".
 */
export function isUploadedUrl(url, { cloudName } = {}) {
  if (typeof url !== "string") return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname !== "res.cloudinary.com") return false;
  if (!cloudName) return true;
  return parsed.pathname.startsWith(`/${cloudName}/`);
}

/** A file name that is safe to show and can't be blank. */
export function normaliseName(raw, fallback = "Untitled") {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return fallback;
  return name.slice(0, 200);
}
