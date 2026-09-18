// scripts/build-intro-screenshots.mjs
//
//   node scripts/build-intro-screenshots.mjs
//
// The intro email's per-trade pictures, from the harness frames to the
// files the email hotlinks.
//
// Input:  docs/screens/intro-email/<lang>/intro-<trade>.png — the quote
//         builder's card for the trade, shot at 1200 wide by
//         docs/screens/app-guide/harness/shoot.mjs (TakeoffFrame.jsx).
// Output: public/product/email/quote-<trade>.<lang>.png — the card cropped
//         to the part that says what the trade is (the still and the
//         measurement for roofing, the traced driveway for paving, the top
//         of the form for the rest), scaled to 640 wide, palette PNG, so a
//         phone on a driveway loads it in one round trip.
//
// The generic quote-on-a-phone (quote-phone.<lang>.png) is produced from
// the client-quote frame the same way the phone shots were: see
// lib/sales/outreach/introScreenshots.js for what stands in for what.
//
// Per-trade crop heights, in source pixels from the top of the card. Set
// by looking at the frames, because the cards differ: the roofing card's
// still and verdict sit in the first 700px, the paving designer is a tall
// canvas, a form card is done by 900px.
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IN = join(ROOT, "docs/screens/intro-email");
const OUT = join(ROOT, "public/product/email");
const LANGS = ["en", "fr", "es"];
const WIDTH_OUT = 640;

/** { top, left, width, height } in the 1200-wide frame, per trade; DEFAULT otherwise. */
const CROP = {
  DEFAULT: { left: 24, top: 24, width: 1152, height: 900 },
  roofing_service: { left: 24, top: 24, width: 1152, height: 700 },
  gutter_services: { left: 24, top: 24, width: 1152, height: 760 },
  paving: { left: 24, top: 24, width: 1152, height: 940 },
  landscaping_design: { left: 24, top: 24, width: 1152, height: 900 },
  lawn_care: { left: 24, top: 24, width: 1152, height: 900 },
  lawn_mowing: { left: 24, top: 24, width: 1152, height: 900 },
  irrigation: { left: 24, top: 24, width: 1152, height: 900 },
};

mkdirSync(OUT, { recursive: true });
let made = 0;
const missing = [];
for (const lang of LANGS) {
  const dir = join(IN, lang);
  if (!existsSync(dir)) {
    missing.push(`${lang}: no frames directory`);
    continue;
  }
  for (const file of readdirSync(dir).filter((f) => f.startsWith("intro-") && f.endsWith(".png"))) {
    const trade = file.slice("intro-".length, -".png".length);
    const crop = CROP[trade] || CROP.DEFAULT;
    const src = join(dir, file);
    const meta = await sharp(src).metadata();
    const height = Math.min(crop.height, (meta.height || crop.height) - crop.top);
    // The card is shorter than the crop for a plain form (siding is done
    // in 270px): trim the page background below it, then take the card.
    // Two passes: sharp orders trim before extract inside one pipeline.
    const region = await sharp(src)
      .extract({ left: crop.left, top: crop.top, width: Math.min(crop.width, (meta.width || crop.width) - crop.left), height })
      .toBuffer();
    const trimmed = await sharp(region).trim({ threshold: 12 }).toBuffer();
    await sharp(trimmed)
      .resize({ width: WIDTH_OUT })
      .png({ compressionLevel: 9, palette: true, quality: 90 })
      .toFile(join(OUT, `quote-${trade}.${lang}.png`));
    made++;
  }
}
console.log(`${made} email frames written to public/product/email/`);
if (missing.length) {
  for (const m of missing) console.log(`  missing: ${m}`);
  process.exit(1);
}
