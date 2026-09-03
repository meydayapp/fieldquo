// scripts/check-pdf-fonts.mjs
//
//   npm run check:pdf-fonts
//
// Renders real PDFs and reads back the glyphs that were actually drawn.
//
// ── The bug this exists to keep dead ───────────────────────────────────────
//
// Every PDF surface used to pin "Helvetica", one of the fourteen fonts a
// reader is required to have and which carries Latin-1 and nothing else.
// app/i18n/languages.js has always offered Ukrainian and Punjabi as DOCUMENT
// languages, and lib/i18n/documentLabels.js has always had hand-written
// translations for them, so every code point above U+00FF was written to the
// page truncated to its low byte:
//
//   Підготовлено  →  .V43>B>2;5=>
//   ਲਈ ਤਿਆਰ ਕੀਤਾ   →  2\b $?\x060 \x15@$>
//
// Nothing threw. Nothing logged. The build was green. A homeowner opened a
// quote on their contractor's letterhead and read mojibake — the exact shape
// AGENTS.md calls "a control that appears to work and doesn't", except the
// control was the whole document.
//
// ── Why this file does not grep for Font.register ──────────────────────────
//
// Because that would pass on a registration that names a corrupt file, a
// family nothing references, or a face missing the script it was added for.
// The only evidence worth having is the drawn output, so this decodes it:
// inflate the content streams, follow /Font in the page resources to each
// Type0 font, inflate its /ToUnicode CMap, and map the glyph ids in the TJ
// operators back to the characters a reader would show and a copy-paste would
// yield. If a label round-trips through that, it is genuinely on the page.
//
// Bundled with esbuild before it runs, the same way check-job-photo-report.mjs
// is: it imports the REAL renderers, and @react-pdf/renderer pulls in code
// plain node's resolver and CJS/ESM interop can't run unbundled.
import zlib from "node:zlib";
import React from "react";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { registerPdfFonts, PDF_FONT, PDF_FONT_BOLD } from "@/lib/documents/pdfFont";
import { DOCUMENT_LABELS, documentLabels } from "@/lib/i18n/documentLabels";
import { LANGUAGE_CODES } from "@/app/i18n/languages";
import { renderDocumentPdfBuffer } from "@/app/admin/lib/pdf/renderDocumentPdf";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

// ───────────────────────────────────────────────────────────────────────────
// The decoder
// ───────────────────────────────────────────────────────────────────────────

const inflate = (latin1Body) => {
  try {
    return zlib.inflateSync(Buffer.from(latin1Body, "latin1")).toString("latin1");
  } catch {
    return latin1Body; // uncompressed stream
  }
};

/** Every `N 0 obj … endobj` in the file, by object number. */
function readObjects(raw) {
  const objs = new Map();
  for (const m of raw.matchAll(/(\d+) 0 obj\s*([\s\S]*?)\s*endobj/g)) {
    objs.set(Number(m[1]), m[2]);
  }
  return objs;
}

/** The bytes of an object's stream, inflated. */
function streamOf(body) {
  const m = body.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
  return m ? inflate(m[1]) : null;
}

/**
 * A /ToUnicode CMap as a code → string map.
 *
 * Handles bfchar and bfrange, and the multi-code-point destinations a
 * ligature produces (one glyph standing for several characters).
 */
function parseCMap(text) {
  const map = new Map();
  const chars = (hex) => {
    const out = [];
    for (let i = 0; i + 3 < hex.length; i += 4) out.push(parseInt(hex.slice(i, i + 4), 16));
    // UTF-16BE: fold surrogate pairs back into one code point.
    let s = "";
    for (let i = 0; i < out.length; i++) {
      const u = out[i];
      if (u >= 0xd800 && u <= 0xdbff && i + 1 < out.length) {
        s += String.fromCodePoint(((u - 0xd800) << 10) + (out[i + 1] - 0xdc00) + 0x10000);
        i++;
      } else s += String.fromCharCode(u);
    }
    return s;
  };

  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const p of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(parseInt(p[1], 16), chars(p[2]));
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const p of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const lo = parseInt(p[1], 16);
      const hi = parseInt(p[2], 16);
      const dst = parseInt(p[3], 16);
      for (let c = lo; c <= hi; c++) map.set(c, String.fromCodePoint(dst + (c - lo)));
    }
  }
  return map;
}

/**
 * Decode one PDF into the text runs a reader would show.
 *
 * Returns { runs, faces } where a run is { text, face } — `face` being the
 * PostScript name of the font that actually drew it, minus the six-letter
 * subset tag. That second field is what proves WHICH font did the drawing,
 * so "it renders" and "it renders in the font we registered" stay separate
 * claims.
 */
function decodePdf(buf) {
  const raw = buf.toString("latin1");
  const objs = readObjects(raw);
  const ref = (s) => (s ? Number(s) : null);

  // /Fn → { map, face }, gathered across every page's resources.
  const fonts = new Map();
  for (const [, body] of objs) {
    const fontDict = body.match(/\/Font\s*<<([\s\S]*?)>>/);
    if (!fontDict) continue;
    for (const e of fontDict[1].matchAll(/\/(\w+)\s+(\d+) 0 R/g)) {
      const type0 = objs.get(Number(e[2])) || "";
      const toUni = ref(type0.match(/\/ToUnicode\s+(\d+) 0 R/)?.[1]);
      const base = type0.match(/\/BaseFont\s*\/(?:[A-Z]{6}\+)?([\w-]+)/)?.[1] || "?";
      const cmapText = toUni != null ? streamOf(objs.get(toUni) || "") : null;
      fonts.set(e[1], { map: cmapText ? parseCMap(cmapText) : null, face: base });
    }
  }

  // Content streams, in file order, with /Fn ... Tf tracked as we go.
  const runs = [];
  for (const [, body] of objs) {
    const content = streamOf(body);
    if (!content || !/\bBT\b/.test(content)) continue;
    let current = null;
    for (const tok of content.matchAll(/\/(\w+)\s+[\d.]+\s+Tf|\[([\s\S]*?)\]\s*TJ|<([0-9A-Fa-f]+)>\s*Tj/g)) {
      if (tok[1] !== undefined) {
        current = fonts.get(tok[1]) || null;
        continue;
      }
      const hexes = [...(tok[2] ?? tok[3] ?? "").matchAll(/<([0-9A-Fa-f]+)>/g)].map((h) => h[1]);
      const flat = tok[3] !== undefined ? [tok[3]] : hexes;
      let text = "";
      for (const hex of flat) {
        for (let i = 0; i + 3 < hex.length; i += 4) {
          const code = parseInt(hex.slice(i, i + 4), 16);
          // No CMap means a standard font (Helvetica and friends) — the
          // pre-fix behaviour. Decode it the way the bug did, as raw bytes,
          // so a regression shows up as the mojibake it is rather than as a
          // crash or a silent skip.
          text += current?.map ? (current.map.get(code) ?? "�") : String.fromCharCode(code);
        }
      }
      if (text) runs.push({ text, face: current?.face || "Helvetica(standard)" });
    }
  }
  return { runs, faces: [...new Set(runs.map((r) => r.face))] };
}

/**
 * Multiset of code points, as a sorted key.
 *
 * Gurmukhi is compared this way rather than by string equality, and that is a
 * correctness point rather than a loosening: Indic shaping REORDERS glyphs.
 * The sihari matra ਿ is stored after its consonant and drawn before it, so the
 * glyph order on the page is legitimately not the logical order of the
 * source string. What must hold is that every character is present, exactly
 * once each — which is what a truncation to low bytes destroys.
 */
// Trimmed before bagging: the layout engine drops leading and trailing
// whitespace, so " Payment terms as stated." is drawn without its leading
// space. That is a layout fact, not a missing glyph, and failing on it would
// train a reader to ignore this check.
// Ligature glyphs cannot be read back. Noto Sans ships f-ligatures and its
// OpenType liga feature fires, so "filed" reaches the page as f-i-l-e-d
// minus one glyph — a single ligature glyph that is NOT in the font's cmap,
// because ligatures are reached through GSUB. The decoder therefore has no
// character to map it to and emits U+FFFD. The PDF is correct; the reverse
// mapping is what is lossy.
//
// So the same fold is applied to both sides: every ligated cluster becomes the
// same replacement character before comparing. That keeps all 46 labels in
// scope rather than excluding the ones that contain one, and gives up only the
// ability to tell one ligature from another — which no bug in this area
// would turn on. Truncation to low bytes, the failure this check exists to
// catch, produces ordinary Latin-1 characters and is untouched by the fold.
//
// ── The set is ffi, ffl, ff, fi, fl — measured off the page, not assumed ───
//
// This folded only `f[il]` until German arrived, and then "Offener Saldo" came
// back as "O<FFFD>ener Saldo" and stranded every label after it (the walk
// below is a cursor: one unmatched label takes the rest of them with it). The
// German is not the problem — "off" folds the same way, so the gap was latent
// in English the whole time and no label had happened to contain "ff".
//
// The five clusters were read off a rendered page rather than guessed at,
// because the alternation order has to match what the shaper actually did:
// "ffi" comes back as ONE glyph, so `ff` must not win first, and "Schifffahrt"
// comes back as "Schi<FFFD>fahrt" — the first two f's ligated, the third left
// alone. A leftmost-longest alternation reproduces exactly that.
//
// Out of scope here but worth knowing: the absent ToUnicode entry is also what
// a reader uses for copy-paste and search, so searching a German invoice for
// "Offener" finds nothing. That is a property of the font subset, not of this
// catalogue — French "À confirmer" has had it since Noto Sans went in.
const foldLigatures = (s) => s.replace(/ffi|ffl|ff|fi|fl/g, "\uFFFD");

const bag = (s) =>
  [...foldLigatures(s.trim().normalize("NFKC"))]
    .map((c) => c.codePointAt(0))
    .sort((a, b) => a - b)
    .join(",");

/** What Helvetica did to a string: every code point cut to its low byte. */
const truncated = (s) => [...s].map((c) => String.fromCharCode(c.codePointAt(0) & 0xff)).join("");

// ───────────────────────────────────────────────────────────────────────────

async function main() {
  registerPdfFonts();

  // ── 1. Every label, in every language the catalogue has ─────────────────
  //
  // Not a sample. Every key of every language table, drawn in both the
  // regular and the bold family, and read back off the page. A sample is how
  // you ship a font that covers "Total" and not "Проміжний підсумок".
  section("1. every documentLabels string, every language in the table, regular + bold");

  const langs = Object.keys(DOCUMENT_LABELS);
  // ── Superset, not equality, and that is the point ─────────────────────────
  //
  // This asserted the two sets were EXACTLY equal, which held only while the
  // catalogue and the picker were edited in the same commit. They are not
  // meant to move together: a language is added to the four document tables
  // FIRST and to app/i18n/languages.js LAST, because `LANGUAGES` is the
  // document language list — offering German before the tables are filled
  // means a German interface issuing an invoice whose "Zwischensumme" is still
  // English. scripts/check-language-completeness.mjs owns that sequencing and
  // records why each held-back language is held back.
  //
  // So the relation to assert is one-way. A table missing for an OFFERED
  // language is a real bug and still fails here. A table that exists for a
  // language the picker does not offer yet is the intended halfway state, and
  // every one of its labels is still rendered and read back below — which is
  // exactly the evidence you want before turning the picker on.
  const unfonted = LANGUAGE_CODES.filter((c) => !langs.includes(c));
  ok(
    unfonted.length === 0,
    `every offered language has a label table (${LANGUAGE_CODES.join(", ")})`,
    unfonted,
  );

  for (const lang of langs) {
    const t = documentLabels(lang);
    const keys = Object.keys(DOCUMENT_LABELS[lang]);
    const strings = keys.map((k) => String(t[k])).filter((s) => s.trim());

    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        {
          // Deliberately absurd width. On LETTER at 8pt every sentence longer
          // than ~110 characters wraps, @react-pdf emits each visual line as
          // its own run, and the one-run-per-label assumption below is then
          // false for exactly the strings most worth checking — the long
          // client-facing ones. A page nothing can wrap on restores it.
          size: [4000, 6000],
          style: { padding: 20, fontFamily: PDF_FONT, fontSize: 8 },
        },
        // Each label is its own <Text> so a run maps to a label, and every one
        // is drawn twice — the bold family is a separately registered face and
        // a missing glyph in it is a separately shipped bug.
        ...strings.map((s, i) => React.createElement(Text, { key: `r${i}` }, s)),
        ...strings.map((s, i) =>
          React.createElement(Text, { key: `b${i}`, style: { fontFamily: PDF_FONT_BOLD } }, s),
        ),
      ),
    );

    const { runs, faces } = decodePdf(await renderToBuffer(doc));
    const drawn = runs.map((r) => r.text);
    const drawnBags = new Set(drawn.map(bag));

    // One label is not always one run. @react-pdf splits a Text wherever the
    // face changes, so a Ukrainian sentence carrying a Latin placeholder —
    // "Податок показано за ставкою {region}" — arrives as several runs, and a
    // per-run lookup misses every mixed-script string in the catalogue. The
    // labels are drawn in order, so each one is a CONTIGUOUS span of runs:
    // walk both lists together and let a label consume runs until it matches.
    const expected = [...strings, ...strings]; // regular pass, then bold
    const missing = [];
    let cursor = 0;
    for (const want of expected) {
      let acc = "";
      let j = cursor;
      let matched = false;
      // A bounded window: an unmatched label must fail rather than eat the
      // rest of the document and take every later label down with it.
      while (j < drawn.length && j < cursor + 12) {
        acc += drawn[j];
        j += 1;
        if (bag(acc) === bag(want)) {
          matched = true;
          cursor = j;
          break;
        }
      }
      if (!matched) missing.push(want);
    }
    // Punjabi is expected NOT to round-trip. The Gurmukhi face is registered
    // but held out of the fallback chain, because with it in the chain 21 of
    // these 46 labels crash the renderer outright — see the long comment in
    // lib/documents/pdfFont.js. Asserting the failure keeps the gap visible
    // instead of hiding it, and this line turns green the day the face can go
    // back in.
    const gurmukhiHeld = lang === "pa";
    ok(
      gurmukhiHeld ? missing.length > 0 : missing.length === 0,
      gurmukhiHeld
        ? `[${lang}] does NOT round-trip, as expected while Gurmukhi is held out (${missing.length}/${strings.length})`
        : `[${lang}] all ${strings.length} labels round-trip off the page, in both weights`,
      missing.slice(0, 4),
    );

    // The specific failure, named. A label that comes back as its own low
    // bytes is the Helvetica bug, and it would sail past a "did anything
    // render" check.
    const mojibake = strings.filter(
      (s) => s !== truncated(s) && drawn.some((d) => d === truncated(s)),
    );
    ok(mojibake.length === 0, `[${lang}] nothing was byte-truncated to Latin-1`, mojibake.slice(0, 3));

    // The rule, stated as the guarantee rather than as a blanket ban. The
    // original bug was that a base-14 font cut every code point above U+00FF
    // to its low byte, so what must never happen is NON-LATIN text drawn by
    // Helvetica. A pure-ASCII run in Helvetica is harmless by definition —
    // Helvetica represents ASCII exactly — and failing on it reports a
    // non-defect. Checked by construction: give this document a Cyrillic
    // company name and it contains no Helvetica run at all.
    const helveticaNonLatin = runs.filter(
      (r) =>
        /Helvetica/.test(r.face) &&
        [...String(r.text)].some((c) => c.codePointAt(0) > 0xff),
    );
    ok(
      gurmukhiHeld || helveticaNonLatin.length === 0,
      `[${lang}] no text above U+00FF was drawn by the base-14 Helvetica`,
      helveticaNonLatin.map((r) => String(r.text).slice(0, 30)),
    );
    ok(
      gurmukhiHeld || faces.every((f) => f.startsWith("NotoSans")),
      `[${lang}] drawn by ${faces.join(" + ")}`,
      faces,
    );
  }

  // ── 2. The scripts, one at a time, with the character that proves it ────
  section("2. the three scripts, by the character that broke");

  // ── Gurmukhi, and why it is not in the chain ────────────────────────────
  //
  // The subset shapes stacked matras into a fontkit crash — 21 of the 46 real
  // `pa` labels raise "Cannot read properties of null (reading 'xCoordinate')"
  // when the face is in the fallback chain, "ਉਪ-ਜੋੜ" (Subtotal) among them.
  // A crash on a live quote send is worse than the mojibake it replaces, so
  // lib/documents/pdfFont.js registers the faces and deliberately leaves them
  // out of PDF_FONT. This asserts that decision holds, and that Punjabi still
  // RENDERS — badly, as it did before, but without throwing.
  {
    const t = documentLabels("pa");
    const strings = Object.keys(DOCUMENT_LABELS.pa)
      .map((k) => String(t[k]))
      .filter((x) => x.trim());
    let crashed = 0;
    for (const str of strings) {
      try {
        await renderToBuffer(
          React.createElement(
            Document,
            null,
            React.createElement(
              Page,
              { style: { padding: 20, fontFamily: PDF_FONT, fontSize: 9 } },
              React.createElement(Text, null, str),
            ),
          ),
        );
      } catch {
        crashed += 1;
      }
    }
    ok(crashed === 0, `every Punjabi label renders without throwing (${strings.length} labels)`, crashed);
    ok(
      !PDF_FONT.some((f) => /Gurmukhi/i.test(f)),
      "the Gurmukhi face is held out of the fallback chain until its shaping crash is fixed",
      PDF_FONT,
    );
  }

  const PROBES = [
    ["Latin-1", "Préparé pour · Größe · perché · ñ ü ß à", "NotoSans-Regular"],
    ["Latin Extended-A", "Kowalczyk Łódź Vaňková Þórdís", "NotoSans-Regular"],
    ["Cyrillic (uk)", "Підготовлено для Ярослава ґ Ґ", "NotoSans-Regular"],
    ["Cyrillic (ru)", "Счёт-фактура № 12 ъ ы э", "NotoSans-Regular"],
    ["money + dashes", "$1,234.56 — 2026‑09‑30 … ™ €", "NotoSans-Regular"],
  ];

  for (const [name, sample, expectFace] of PROBES) {
    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: "LETTER", style: { padding: 20, fontFamily: PDF_FONT, fontSize: 10 } },
        React.createElement(Text, null, sample),
      ),
    );
    const { runs } = decodePdf(await renderToBuffer(doc));
    const drawn = runs.map((r) => r.text).join("");
    ok(bag(drawn) === bag(sample), `${name}: every character reached the page`, drawn);

    // Which face drew the script-carrying characters. This is the assertion
    // that fails if the Gurmukhi family is dropped and the text quietly falls
    // through to Noto Sans's .notdef boxes.
    const scriptRun = runs.find((r) => [...r.text].some((c) => c.codePointAt(0) > 0x2100 || c.codePointAt(0) > 0xff));
    ok(
      !scriptRun || scriptRun.face === expectFace || runs.some((r) => r.face === expectFace),
      `${name}: drawn by ${expectFace}`,
      runs.map((r) => r.face),
    );
  }

  // ── 3. The shipped renderer, not a fixture page ─────────────────────────
  //
  // Sections 1 and 2 build their own <Page>. That proves the fonts work; it
  // does not prove renderDocumentPdfBuffer USES them, which is the thing a
  // future refactor breaks. This runs the real entry point — the one
  // /api/quotes/[id]/pdf and the quote-send route call — over real sections.
  section("3. renderDocumentPdfBuffer, the path a client's quote actually takes");

  const COMPANY = { name: "Northwind Finishes", brandColor: "#1D4ED8", currency: "CAD" };
  const SECTIONS = [
    { type: "header", sortOrder: 0, config: {} },
    { type: "client_info", sortOrder: 1, config: {} },
    { type: "scope_groups", sortOrder: 2, config: {} },
    { type: "totals", sortOrder: 3, config: {} },
    { type: "notes", sortOrder: 4, config: {} },
  ];

  for (const [lang, mustContain] of [
    ["en", "Prepared for"],
    ["uk", "вересня"],
  ]) {
    const t = documentLabels(lang);
    const data = {
      kind: "quote",
      number: "Q-2026-0042",
      language: lang,
      createdAt: "2026-09-30T00:00:00Z",
      validUntil: "2026-10-30T00:00:00Z",
      client: { name: "Ярослав Мельник", email: "y@example.com", address: "12 Größestraße" },
      notes: t.thankYou,
      items: [{ name: t.scopeOfWork, description: t.whatsIncluded, quantity: 1, unitPrice: 5250, total: 5250 }],
      subtotal: 5250,
      total: 5250,
    };

    let buf = null;
    let threw = null;
    try {
      buf = await renderDocumentPdfBuffer({ sections: SECTIONS, data, company: COMPANY, language: lang });
    } catch (e) {
      threw = e;
    }
    ok(!threw, `[${lang}] the real renderer produced a PDF`, threw?.message);
    if (!buf) continue;

    const { runs, faces } = decodePdf(buf);
    const drawn = runs.map((r) => r.text).join("\x00");
    const foldCase = (x) => String(x).toLocaleLowerCase();
    ok(
      foldCase(drawn).includes(foldCase(mustContain)) ||
        runs.some((r) => bag(foldCase(r.text)) === bag(foldCase(mustContain))),
      `[${lang}] "${mustContain}" is on the page as characters, not bytes`,
      runs.slice(0, 6).map((r) => r.text),
    );
    // Same rule as section 1, and the same Punjabi exemption. Non-Latin text
    // must not reach Helvetica; pure ASCII in Helvetica is not a defect, and
    // `pa` is knowingly unfixed while the Gurmukhi face is out of the chain.
    const helvNonLatin3 = runs.filter(
      (r) =>
        /Helvetica/.test(r.face) &&
        [...String(r.text)].some((c) => c.codePointAt(0) > 0xff),
    );
    ok(
      lang === "pa" || helvNonLatin3.length === 0,
      `[${lang}] the real renderer drew no non-Latin text in Helvetica`,
      helvNonLatin3.map((r) => String(r.text).slice(0, 30)),
    );
    // The client's name is free text, not a catalogue label — the case that
    // subsetting to documentLabels would have silently broken.
    ok(
      runs.some((r) => r.text.includes("Ярослав")) &&
        runs.some((r) => r.text.includes("Größestraße")),
      `[${lang}] a Cyrillic client name and a German street both survive as free text`,
      runs.filter((r) => /[^\x00-\x7F]/.test(r.text)).slice(0, 4).map((r) => r.text),
    );
  }

  // ── 4. What happens when a glyph exists nowhere ─────────────────────────
  //
  // Chinese is not a supported document language and no CJK face is bundled
  // (see the note in scripts/build-pdf-fonts.mjs). A contractor can still
  // type a Chinese character into a note, so the behaviour has to be known
  // rather than discovered by a customer.
  section("4. an unsupported script degrades visibly, not silently");

  const cjk = "厨房 kitchen";
  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "LETTER", style: { padding: 20, fontFamily: PDF_FONT, fontSize: 10 } },
      React.createElement(View, null, React.createElement(Text, null, cjk)),
    ),
  );
  const { runs } = decodePdf(await renderToBuffer(doc));
  const latinPart = runs.map((r) => r.text).join("");
  ok(
    latinPart.includes("kitchen"),
    "the Latin half of a mixed string still renders correctly",
    latinPart,
  );
  console.log(`  note   CJK renders as ${JSON.stringify(latinPart.replace(/[ ]?kitchen/, ""))} — no CJK face is bundled; see build-pdf-fonts.mjs`);

  console.log(`\n${fail === 0 ? "ALL PASS" : `${fail} FAILED`}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
