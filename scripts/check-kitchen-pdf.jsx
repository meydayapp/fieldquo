// scripts/check-kitchen-pdf.jsx
//
//   npm run check:pdf
//
// Renders a real PDF and reads back what's actually on the page.
//
// A PDF that "builds" tells you almost nothing — @react-pdf will happily
// produce a valid, well-formed, entirely blank document. So this decodes the
// content streams and asserts on the drawing operators and the text runs:
// dimensions present, appliances labelled, all three elevations titled.
//
// It caught the thing worth catching: an earlier pass rendered every line and
// curve correctly and drew NO TEXT AT ALL. The plan looked fine as a shape and
// was useless as a drawing — no dimensions, no labels, no scale.
//
// .jsx because esbuild refuses to parse JSX out of a .js file, and a renderer
// that can't be exercised outside the app is one nobody exercises.
import React from "react";
import zlib from "node:zlib";
import { Document, Page, View, Text, renderToBuffer, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "@/lib/documents/pdfFont";

registerPdfFonts();
import { PlanPdf, ElevationPdf } from "../lib/kitchen/PlanPdf.jsx";

let fail = 0;
const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fail++; };

const design = {
  room: { width: 180, depth: 144, ceiling: 96 },
  finish: {
    cabinetColor: "#F1ECE3", doorStyle: "shaker", islandColor: "#6E7358",
    countertopColor: "#F4F2EE", countertopVeined: true,
    floorColor: "#D8B98A", floorPlank: true, wallColor: "#F5F3EE",
    backsplashColor: "#F2F1ED", backsplashTile: true,
  },
  elements: [
    { id: "fr", kind: "fridge", wall: "A", pos: 0, width: 36, depth: 30, config: {} },
    { id: "c1", kind: "base", wall: "A", pos: 36, width: 36, depth: 24, config: { doors: 2 } },
    { id: "st", kind: "stove", wall: "A", pos: 72, width: 36, depth: 26, config: {} },
    { id: "u1", kind: "wall", wall: "A", pos: 36, width: 36, depth: 12, config: { doors: 2 } },
    { id: "hv", kind: "hoodVent", wall: "A", pos: 72, width: 36, depth: 20, config: {} },
    { id: "sk", kind: "sinkBase", wall: "B", pos: 24, width: 33, depth: 24, config: { doors: 2 } },
    { id: "dw", kind: "dishwasher", wall: "B", pos: 57, width: 24, depth: 24, config: {} },
    { id: "dr", kind: "door", wall: "D", pos: 14, width: 32, depth: 5, config: {} },
    { id: "is", kind: "island", pos: 54, y: 56, width: 60, depth: 36, config: { doors: 3 } },
  ],
};

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10 },
  row: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
});

const Doc = () =>
  React.createElement(
    Document, null,
    React.createElement(
      Page, { size: "LETTER", style: s.page },
      React.createElement(PlanPdf, {
        design, width: 500, title: "Kitchen plan",
        subtitle: "12' × 15' room with 3' × 5' island",
      }),
      React.createElement(
        View, { style: s.row },
        ["A", "B", "D"].map((id) =>
          React.createElement(ElevationPdf, { key: id, design, wallId: id, width: 160 }),
        ),
      ),
    ),
  );

/** Decode the content streams and pull out operators + text runs. */
function readPdf(buf) {
  const streams = [...buf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)endstream/g)];
  let content = "";
  for (const [, body] of streams) {
    const bytes = Buffer.from(body, "latin1");
    try { content += zlib.inflateSync(bytes).toString("latin1"); }
    catch { content += body; }
  }
  const runs = [];
  for (const [, block] of content.matchAll(/BT([\s\S]*?)ET/g)) {
    const t = [...block.matchAll(/<([0-9A-Fa-f]+)>/g)]
      .map(([, h]) => Buffer.from(h, "hex").toString("latin1"))
      .join("");
    if (t.trim()) runs.push(t.trim());
  }
  const count = (op) => (content.match(new RegExp(`\\b${op}\\b`, "g")) || []).length;
  return { runs, lines: count("l"), curves: count("c"), fills: count("f"), strokes: count("S") };
}

(async () => {
  const buf = await renderToBuffer(React.createElement(Doc));
  ok(buf.subarray(0, 4).toString() === "%PDF", `a real PDF came out (${(buf.length / 1024).toFixed(1)} KB)`);

  const { runs, lines, curves, fills, strokes } = readPdf(buf);
  ok(lines > 200 && strokes > 200, `the drawing is actually drawn: ${lines} lines, ${curves} curves, ${fills} fills, ${strokes} strokes`);

  // The one that matters. A blank-but-valid PDF passes every other check.
  ok(runs.length > 15, `${runs.length} text runs on the page — a plan with no text is a shape, not a drawing`);

  const has = (t) => runs.some((r) => r.includes(t));
  ok(has("KITCHEN PLAN"), "the title is printed");
  ok(has(`15'-0"`) && has(`12'-0"`), "both room dimensions are printed");
  ok(has(`5'-0"`) && has(`3'-0"`), "both island dimensions are printed");
  ok(has("FRIDGE") && has("RANGE") && has("DW"), "appliances are labelled");
  ok(has("SCALE") && has("8'"), "the scale bar is printed with its ticks");
  ok(has("COOKTOP WALL"), "elevations are titled by what's ON them, not 'Wall A'");
  ok(has("SINK WALL"), "…and the sink wall too");
  ok(runs.filter((r) => /WALL/.test(r)).length >= 3, "all three elevations made it onto the page");

  // An empty design must still produce a page rather than throwing mid-render.
  const Blank = () =>
    React.createElement(Document, null,
      React.createElement(Page, { size: "LETTER", style: s.page },
        React.createElement(PlanPdf, { design: null, width: 400, title: "Empty" })));
  const blank = await renderToBuffer(React.createElement(Blank));
  ok(blank.subarray(0, 4).toString() === "%PDF", "a null design still renders a page rather than throwing");

  console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
