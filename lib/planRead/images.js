// lib/planRead/images.js
//
// The pictures of one drawing sheet a model is shown: the whole sheet, then
// four overlapping quarters.
//
// Why quarters: a vision model fits a high-detail image inside 2048 px and
// then shrinks its SHORT side to 768 px. A 36 × 24 in sheet rendered at 3200
// px wide arrives at roughly 1150 × 770 — a 1/8"-scale dimension string is a
// smudge at that size. Each quarter of the same sheet arrives at the same
// pixel budget, so the text is about twice as legible, for four more images'
// worth of tokens on a cheap model. The quarters are Cloudinary CROPS of the
// one rendered page (c_crop), not four more uploads.
//
// Pure string surgery — runs anywhere.

const OVERLAP = 0.08;

function insertTransform(url, transform) {
  if (typeof url !== "string") return null;
  const marker = "/image/upload/";
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return `${url.slice(0, i + marker.length)}${transform}/${url.slice(i + marker.length)}`;
}

/** The whole sheet, capped for the vendor. */
export function sheetOverviewUrl(page) {
  return insertTransform(page?.url, "c_limit,w_2400,q_auto:good,f_jpg");
}

/** Four overlapping quarters, cropped from the rendered page by pixels. */
export function sheetTileUrls(page) {
  const w = Number(page?.width);
  const h = Number(page?.height);
  if (!(w > 0) || !(h > 0) || !page?.url) return [];
  const tw = Math.round(w * (0.5 + OVERLAP));
  const th = Math.round(h * (0.5 + OVERLAP));
  const out = [];
  for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const x = fx ? w - tw : 0;
    const y = fy ? h - th : 0;
    const url = insertTransform(page.url, `c_crop,x_${x},y_${y},w_${tw},h_${th}/c_limit,w_2048,q_auto:good,f_jpg`);
    if (url) out.push(url);
  }
  return out;
}

/** Everything a sheet pass sends, overview first. */
export function sheetImageUrls(page) {
  const overview = sheetOverviewUrl(page);
  return [overview, ...sheetTileUrls(page)].filter(Boolean);
}
