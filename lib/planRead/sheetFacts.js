// lib/planRead/sheetFacts.js
//
// What one drawing sheet SAYS, read from its vector text in code: sheet
// number and title, the scale in the title block, every dimension string
// with where it sits, room labels, finish-schedule rows and paint codes.
//
// ══ Input ══════════════════════════════════════════════════════════════════
//
// pdf.js text items for one page, as unpdf's extractTextItems() returns
// them: { str, x, y, width, height, fontSize } in PDF points, origin
// bottom-left. The server runs unpdf over the stored PDF
// (lib/planRead/ingest.js); scripts/check-plan-deep-read.mjs runs it over a
// PDF it writes itself. Both land here, so the fixture tests the same code
// that reads a customer's drawings.
//
// ══ Vector or scanned ══════════════════════════════════════════════════════
//
// A scanned sheet is a picture inside a PDF: it has no text items, or a
// handful from a stamp. Such a sheet gets `vector: false`, and every
// quantity anything later derives from it is marked "estimated — verify"
// (lib/planRead/projectModel.js) because the dimension text came from a
// model reading pixels, not from the architect's file.
//
// No imports beyond ./dimensions — runs in the browser and in Node.

import { findDimensions, findDimensionPairs, parseScale, dimensionKind } from "./dimensions";

/** Fewer real characters than this on a page and it is a scan. */
export const VECTOR_MIN_CHARS = 40;
const VECTOR_MIN_ITEMS = 4;
export const MAX_DIMS_PER_SHEET = 400;
const MAX_LABELS = 80;
const MAX_SCHEDULE_ROWS = 80;
const MAX_NOTES = 40;
const SAMPLE_CHARS = 3500;

const DISCIPLINES = {
  A: "architectural",
  ID: "interior",
  I: "interior",
  S: "structural",
  M: "mechanical",
  E: "electrical",
  P: "plumbing",
  C: "civil",
  L: "landscape",
  G: "general",
  T: "title",
  FP: "fire",
};

const SHEET_NO = /^(ID|FP|[A-Z])[-.\s]?(\d{1,3}(?:\.\d{1,2})?[A-Z]?)$/;
const TITLE_WORDS =
  /\b(PLAN|PLANS|ELEVATION|ELEVATIONS|SECTION|SECTIONS|DETAIL|DETAILS|SCHEDULE|SCHEDULES|REFLECTED CEILING|SITE|ROOF|COVER|LEGEND|NOTES|FINISH(?:ES)?)\b/;
const LABEL_STOP =
  /\b(PLAN|ELEVATION|SECTION|DETAIL|SCHEDULE|SCALE|NOTE|NOTES|SHEET|DRAWN|CHECKED|DATE|REVISION|PROJECT|NORTH|LEGEND|KEY|TYP|TYPICAL|SIM|SIMILAR|SEE|REF|DWG|NO|NTS|ISSUED|FOR|CONSTRUCTION|PERMIT|ARCHITECT|ENGINEER|SEAL|COPYRIGHT|GRID)\b/;
const FINISH_HINT = /\b(PAINT|PAINTED|STAIN|STAINED|PRIMER|PRIME|FINISH|EGGSHELL|SEMI-?GLOSS|SATIN|FLAT|GLOSS|ENAMEL|SEALER|CLEAR COAT|VARNISH|EPOXY|ELASTOMERIC|COATING|GYP\.? BD|GWB|DRYWALL|PLASTER|SIDING|SOFFIT|FASCIA|TRIM|WAINSCOT|MOULDING|MOLDING|CEDAR|BRICK|MASONRY|CMU|STUCCO)\b/i;
const FINISH_CODE = /\b((?:PT|P|ST|STN|EP|WC|PNT)-?\d{1,3}[A-Z]?)\b/;

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Text items → lines, top of the sheet first, left to right within a line.
 * Two items share a line when their baselines are within ~40% of a font
 * height; the gap between them decides whether a space goes in.
 */
export function itemsToLines(items) {
  const list = (Array.isArray(items) ? items : [])
    .filter((it) => it && typeof it.str === "string" && it.str.trim() && Number.isFinite(it.x) && Number.isFinite(it.y))
    .map((it) => ({ ...it, fontSize: Number(it.fontSize) > 0 ? Number(it.fontSize) : Number(it.height) || 8 }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of list) {
    const tol = Math.max(1.5, it.fontSize * 0.4);
    let line = null;
    for (let i = lines.length - 1; i >= 0 && i >= lines.length - 6; i--) {
      if (Math.abs(lines[i].y - it.y) <= tol) {
        line = lines[i];
        break;
      }
    }
    if (!line) {
      line = { y: it.y, items: [], fontSize: it.fontSize };
      lines.push(line);
    }
    line.items.push(it);
    line.fontSize = Math.max(line.fontSize, it.fontSize);
  }
  return lines.map((l) => {
    const sorted = l.items.sort((a, b) => a.x - b.x);
    let text = "";
    let lastEnd = null;
    let gapBreak = false;
    for (const it of sorted) {
      const gap = lastEnd === null ? 0 : it.x - lastEnd;
      // A wide gap is two separate labels that happen to share a baseline —
      // a room name in one room and a dimension in the next. Kept on one
      // line (it is one line of the sheet) but marked so a label reader
      // does not glue them into one name.
      if (lastEnd !== null && gap > it.fontSize * 6) gapBreak = true;
      text += lastEnd === null ? it.str : gap > it.fontSize * 0.15 ? ` ${it.str}` : it.str;
      lastEnd = it.x + (Number(it.width) || it.str.length * it.fontSize * 0.5);
    }
    return {
      text: text.replace(/\s+/g, " ").trim(),
      x: sorted[0].x,
      y: l.y,
      fontSize: l.fontSize,
      items: sorted,
      gapBreak,
    };
  });
}

function sheetNumberOf(items, pageWidth, pageHeight) {
  const cands = [];
  for (const it of items) {
    const t = String(it.str || "").trim().toUpperCase();
    const m = SHEET_NO.exec(t);
    if (!m) continue;
    // Bottom-right is where a title block puts the sheet number; size wins
    // over position because a title block prints it largest on the sheet.
    const right = pageWidth > 0 ? it.x / pageWidth : 0.5;
    const bottom = pageHeight > 0 ? 1 - it.y / pageHeight : 0.5;
    cands.push({ text: `${m[1]}-${m[2]}`, letter: m[1], score: (Number(it.fontSize) || 0) * 2 + right * 10 + bottom * 10 });
  }
  cands.sort((a, b) => b.score - a.score);
  return cands[0] || null;
}

/**
 * Everything one page states. Pure.
 *
 * @param {object[]} items  pdf.js text items for the page
 * @param {{ page: number, pageWidth?: number, pageHeight?: number }} meta
 */
export function sheetFacts(items, { page, pageWidth = 0, pageHeight = 0 } = {}) {
  const lines = itemsToLines(items);
  const chars = lines.reduce((n, l) => n + l.text.replace(/\s/g, "").length, 0);
  // A real sheet carries thousands of characters; a scan carries none, or a
  // date stamp. Both bars, so one long stamp is not a vector sheet.
  const vector = chars >= VECTOR_MIN_CHARS && lines.reduce((n, l) => n + l.items.length, 0) >= VECTOR_MIN_ITEMS;
  const key = `p${page}`;

  // Scale first: whether bare numbers can be millimetres depends on it.
  const scales = [];
  for (const l of lines) {
    const sc = parseScale(l.text);
    if (sc && !scales.some((s) => s.text === sc.text)) scales.push(sc);
  }
  const primary = scales.find((s) => !s.nts) || scales[0] || null;
  const metric = primary?.system === "metric";

  const dims = [];
  const pairs = [];
  for (const l of lines) {
    // A scale line is not a dimension: 1/4" = 1'-0" would read as two.
    if (parseScale(l.text) && !l.gapBreak) continue;
    const kind = dimensionKind(l.text);
    const found = findDimensions(l.text, { metric: false });
    // Bare millimetres only when the whole ITEM is the number — see
    // findDimensions — so a metric sheet's items are tried one by one too.
    const bare = metric && !found.length
      ? l.items.flatMap((it) => findDimensions(it.str, { metric: true }))
      : [];
    const startIndex = dims.length;
    for (const d of [...found, ...bare]) {
      if (dims.length >= MAX_DIMS_PER_SHEET) break;
      dims.push({
        id: `${key}.d${dims.length + 1}`,
        raw: d.raw,
        feet: d.feet,
        metres: d.metres,
        system: d.system,
        unitAssumed: d.unitAssumed,
        kind,
        // Where it sits, 0–1 from the top-left — the measure tool marks it.
        x: pageWidth > 0 ? Math.round((l.x / pageWidth) * 1000) / 1000 : null,
        y: pageHeight > 0 ? Math.round((1 - l.y / pageHeight) * 1000) / 1000 : null,
        line: clip(l.text, 120),
      });
    }
    const here = dims.slice(startIndex);
    for (const [a, b] of findDimensionPairs(l.text)) {
      const da = here.find((d) => d.raw === a.raw);
      const db = here.find((d) => d.raw === b.raw && d !== da);
      if (da && db) pairs.push([da.id, db.id]);
    }
  }

  const num = sheetNumberOf(lines.flatMap((l) => l.items), pageWidth, pageHeight);
  const titleLines = lines
    .filter((l) => TITLE_WORDS.test(l.text.toUpperCase()) && l.text === l.text.toUpperCase() && l.text.length <= 60)
    .sort((a, b) => b.fontSize - a.fontSize);
  const titles = [];
  for (const l of titleLines) if (!titles.includes(l.text) && titles.length < 12) titles.push(l.text);

  const labels = [];
  for (const l of lines) {
    for (const t of l.gapBreak ? l.items.map((i) => i.str.trim()) : [l.text]) {
      if (labels.length >= MAX_LABELS) break;
      const up = t.toUpperCase();
      if (t !== up) continue;
      if (!/^[A-Z][A-Z &'/.-]{2,38}(?:\s\d{1,4}[A-Z]?)?$/.test(t)) continue;
      if (LABEL_STOP.test(up) || TITLE_WORDS.test(up)) continue;
      if (!/[A-Z]{3,}/.test(up)) continue;
      if (!labels.includes(t)) labels.push(t);
    }
  }

  const schedule = [];
  const scheduleAt = lines.findIndex((l) => /FINISH SCHEDULE|ROOM FINISH|PAINT SCHEDULE|FINISH LEGEND|COLOU?R SCHEDULE/i.test(l.text));
  if (scheduleAt >= 0) {
    for (const l of lines.slice(scheduleAt, scheduleAt + MAX_SCHEDULE_ROWS)) schedule.push(clip(l.text, 160));
  }

  const finishCodes = [];
  const notes = [];
  for (const l of lines) {
    const code = FINISH_CODE.exec(l.text);
    if (code && FINISH_HINT.test(l.text) && finishCodes.length < 40 && !finishCodes.some((c) => c.text === l.text)) {
      finishCodes.push({ code: code[1], text: clip(l.text, 160) });
    }
    if (FINISH_HINT.test(l.text) && l.text.length > 12 && notes.length < MAX_NOTES && !notes.includes(l.text)) {
      notes.push(clip(l.text, 200));
    }
  }

  let textSample = "";
  for (const l of lines) {
    if (textSample.length + l.text.length + 1 > SAMPLE_CHARS) break;
    textSample += `${l.text}\n`;
  }

  return {
    key,
    page,
    vector,
    chars,
    sheetNumber: num?.text || null,
    discipline: num ? DISCIPLINES[num.letter] || null : null,
    title: titles[0] || null,
    titles,
    scale: primary,
    scales: scales.slice(0, 6),
    dims,
    pairs: pairs.slice(0, 120),
    labels,
    schedule,
    finishCodes,
    notes,
    textSample: textSample.trim(),
  };
}

/** The sheet's name as people say it: "A-201 North elevation". */
export function sheetName(facts) {
  if (!facts) return "";
  const n = facts.sheetNumber || `Page ${facts.page}`;
  return facts.title ? `${n} ${facts.title}` : n;
}
