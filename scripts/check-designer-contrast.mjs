// scripts/check-designer-contrast.mjs
//
//   node scripts/check-designer-contrast.mjs
//
// Measures the kitchen designer's palette against every brand colour a
// contractor plausibly picks, in both light and dark, and fails if any pairing
// drops below 4.5:1.
//
// Measured rather than eyeballed because the naive rule — "is the brand dark?
// then use white" — fails on exactly the mid-tones contractors choose, and a
// dimension label nobody can read makes a technical drawing worthless while
// still looking fine in a screenshot.
//
// Note what passing looks like: navy stays navy on paper and becomes a LIGHTER
// NAVY on the dark panel, rather than being thrown away for white. Keeping the
// company's colour is the point of a white-label product; the contrast floor is
// the constraint, not the goal.
//
// ── Running it ─────────────────────────────────────────────────────────────
//
// Through scripts/alias-loader.mjs, so it imports the SHIPPED designerTheme
// rather than a copy with its specifiers rewritten. `npm run check:contrast`
// wires that up.

import { designerTheme, _contrast as contrast } from "@/lib/kitchen/designerTheme";

// The colours contractors actually pick, including the ones that break naive rules.
const BRANDS = {
  "yellow": "#FFD400", "white": "#FFFFFF", "black": "#000000", "mid grey": "#808080",
  "TrueFinish gold": "#BD9D60", "navy": "#0B2E59", "safety orange": "#FF6B00",
  "lime": "#B4FF00", "pale beige": "#EDE8DD", "deep red": "#8B0000",
  "teal": "#008080", "hot pink": "#FF1493", "brown": "#6B4423", "sky": "#87CEEB",
};

let fail = 0;
for (const mode of [false, true]) {
  console.log(`\n${mode ? "DARK" : "LIGHT"} — accent vs card, 4.5:1 required\n`);
  for (const [name, hex] of Object.entries(BRANDS)) {
    const t = designerTheme({ brandColor: hex }, mode);
    const acc = contrast(t.gold, t.card);
    const txt = contrast(t.text, t.card);
    const mut = contrast(t.textMuted, t.card);
    const bad = acc < 4.5 || txt < 4.5 || mut < 3;
    if (bad) fail++;
    console.log(
      `  ${bad ? "✗" : "✓"} ${name.padEnd(16)} accent ${acc.toFixed(2).padStart(5)}  ` +
      `text ${txt.toFixed(2).padStart(5)}  muted ${mut.toFixed(2).padStart(5)}   ${t.gold}`,
    );
  }
}
// Garbage in must not produce NaN out.
for (const junk of [null, undefined, "", "not a colour", "#12", "#GGGGGG", 42, {}]) {
  const t = designerTheme({ brandColor: junk }, true);
  const c = contrast(t.gold, t.card);
  if (!Number.isFinite(c)) { console.log(`  ✗ junk ${JSON.stringify(junk)} → NaN contrast`); fail++; }
}
console.log(`\n${fail === 0 ? "ALL PASS — every brand colour readable in both modes" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
