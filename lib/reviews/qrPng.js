// lib/reviews/qrPng.js
//
// The QR as a PNG, for the two places an SVG will not do: an email (mail
// clients render <img> PNGs and nothing else reliably) and a download the
// contractor drops into a print shop's order form. sharp rasterises the SVG
// lib/reviews/qr.js produced; nothing is drawn twice.

import { qrSvg } from "./qr";

export async function qrPng(text, { size = 512, margin = 4 } = {}) {
  const sharp = (await import("sharp")).default;
  const svg = qrSvg(text, { size, margin });
  return sharp(Buffer.from(svg), { density: 300 }).resize(size, size, { kernel: "nearest" }).png().toBuffer();
}
