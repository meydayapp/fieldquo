// lib/planRead/sheetNames.js
//
// What a drawing sheet may be CALLED — by the chat model asking to re-open it
// ("openSheets"), by the estimator telling it which pages to look at, and on
// the screen.
//
// ══ Why this is more than `sheetNumber === name` ════════════════════════════
//
// The owner's live test (St Paul's, 2026-10-05): every one of the set's 13
// sheets had been stored with the sheet number "A-3" — the PAPER SIZE, read
// by the title-block parser before f5e19e42 fixed it, and stored at upload,
// never re-read. The model asked for "A-3 p5", the owner said "pages 5, 6 and
// 7"; the old lookup matched only a whole sheet number or a key, so the first
// opened nothing and an earlier "A-3" opened p1, the floor plan, for an
// elevation question. Two paid turns answered "please open the elevation
// sheets first".
//
// So a sheet answers to: its key ("p5"), its page ("5", "page 5", "sheet 5"),
// its sheet number ONLY when no other sheet in the read shares it, a key
// inside a longer name ("A-3 p5"), and the words of one of its titles ("west
// elevation") when exactly one sheet's titles hold them all. And the chat is
// TOLD those names (sheetDirectoryText) instead of guessing them.
//
// Pure.

const norm = (s) => String(s ?? "").toUpperCase().replace(/[\s._\-–—/]+/g, "");
const STOP = new Set(["SHEET", "SHEETS", "PAGE", "PAGES", "DRAWING", "DRAWINGS", "THE", "AND", "FOR", "OPEN", "SHOW", "PLEASE", "NUMBER", "FROM", "WITH"]);

/**
 * Every sheet with the names it answers to. A sheet number shared by two or
 * more sheets names none of them.
 *
 * @param sheets  the read's stored sheets ({ key, page, sheetNumber, title, titles })
 * @returns {{ key, page, number: string|null, titles: string[] }[]}
 */
export function sheetDirectory(sheets) {
  const list = (Array.isArray(sheets) ? sheets : []).filter((s) => s && typeof s.key === "string");
  const seen = new Map();
  for (const s of list) {
    const n = norm(s.sheetNumber);
    if (n) seen.set(n, (seen.get(n) || 0) + 1);
  }
  return list.map((s) => {
    const n = norm(s.sheetNumber);
    const titles = (Array.isArray(s.titles) && s.titles.length ? s.titles : s.title ? [s.title] : [])
      .map((t) => String(t || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 4);
    return { key: s.key, page: Number(s.page) || null, number: n && seen.get(n) === 1 ? String(s.sheetNumber) : null, titles };
  });
}

/** "P-47" when the sheet has a number of its own, "Page 5" otherwise. */
export function sheetDisplayName(entry) {
  return entry?.number || (entry?.page ? `Page ${entry.page}` : entry?.key || "");
}

/** One line per sheet for the chat's context: every name it may use. */
export function sheetDirectoryText(directory) {
  return (directory || [])
    .map((d) => [d.key, d.page ? `page ${d.page}` : null, d.number, d.titles.length ? d.titles.join(" / ") : null].filter(Boolean).join(" — "))
    .join("\n");
}

const PAGE = /^(?:(?:pages?|pg\.?|p\.|sheets?|drawings?|no\.?)\s*)?(\d{1,4})$/i;

/**
 * The sheet one name means, or null when it means none — or more than one.
 * @param directory  sheetDirectory()
 */
export function findSheet(directory, name) {
  const text = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!text || !Array.isArray(directory) || !directory.length) return null;
  const whole = norm(text);
  const byKey = (k) => directory.find((d) => d.key.toLowerCase() === String(k).toLowerCase()) || null;
  const byNumber = (n) => directory.find((d) => d.number && norm(d.number) === n) || null;
  const byPage = (p) => directory.find((d) => d.page === Number(p)) || null;

  // The key as the keys are written ("p5"), then the sheet's own number, then
  // a key written another way.
  if (/^p\d{1,4}$/.test(text) && byKey(text)) return byKey(text);
  if (byNumber(whole)) return byNumber(whole);
  if (byKey(whole)) return byKey(whole);
  // "5", "page 5", "sheet 5", "pg. 5".
  const page = PAGE.exec(text);
  if (page && byPage(page[1])) return byPage(page[1]);
  // A key or a unique number inside a longer name: "A-3 p5", "sheet P-47 (west)".
  for (const tok of text.split(/[\s,;()·|]+/).filter(Boolean)) {
    if (/^p\d{1,4}$/i.test(tok) && byKey(tok.toLowerCase())) return byKey(tok.toLowerCase());
  }
  for (const tok of text.split(/[\s,;()·|]+/).filter(Boolean)) {
    const hit = byNumber(norm(tok));
    if (hit) return hit;
  }
  // A title's words: every meaningful word of the name in ONE sheet's titles.
  const words = text.toUpperCase().split(/[^A-Z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
  if (words.length) {
    const hits = directory.filter((d) => {
      const hay = ` ${d.titles.join(" ").toUpperCase().replace(/[^A-Z0-9]+/g, " ")} `;
      return words.every((w) => hay.includes(` ${w} `) || hay.includes(` ${w}S `) || (w.endsWith("S") && hay.includes(` ${w.slice(0, -1)} `)));
    });
    if (hits.length === 1) return hits[0];
  }
  return null;
}

/** The sheets a list of names means, each once, at most `max`. */
export function findSheets(directory, names, max = 2) {
  const out = [];
  // "pages 5, 6 and 7" is three names; "Scheme C4 - Elevations Sheet 1" is
  // one, so a name is split only when the whole of it does not name a sheet.
  const parts = (Array.isArray(names) ? names : []).flatMap((n) =>
    findSheet(directory, n) ? [n] : String(n ?? "").split(/\s*(?:,|;|&|\band\b)\s*/i).filter(Boolean),
  );
  for (const n of parts) {
    const hit = findSheet(directory, n);
    if (hit && !out.some((o) => o.key === hit.key)) out.push(hit);
    if (out.length >= max) break;
  }
  return out;
}
