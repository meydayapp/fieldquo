// lib/marketing/ratios.js
//
// One advert, every shape a social network asks for.
//
// ══ The problem this exists to solve ═══════════════════════════════════════
//
// The editor's own changeSize() sets the workspace rectangle's width and height
// and does nothing else. No object moves, nothing rescales. Shrink a 1200x630
// Facebook banner to a 1080x1080 square and the headline that sat at x=900 is
// simply outside the picture — still in the document, clipped out of the frame.
//
// So a contractor who lays out one advert and then asks for it as a Story gets
// a broken Story, silently. That is the dead-control failure in its most
// annoying form: the control works, the output is wrong, and nobody is told.
//
// ══ Uniform scale, not stretch ═════════════════════════════════════════════
//
// Every object is scaled by ONE factor, not by width and height separately.
// Stretching 1:1 artwork into 9:16 would distort a logo and squash a face, and
// a contractor putting their own van on Instagram will notice that instantly
// even if they cannot say why. A uniform scale keeps everything the right shape
// and leaves empty room, which a person can fill; a stretch produces something
// subtly wrong that no amount of nudging fixes.
//
// `min` rather than `max`: fitting INSIDE the new frame means nothing is pushed
// out of it. Filling the frame would guarantee the opposite.
//
// ══ Why this is a STARTING layout, not a finished one ══════════════════════
//
// Nothing here is clever enough to be trusted blind. It preserves relative
// composition — what was centred stays centred, what was a third of the way
// across stays a third of the way across — which is a good square-to-portrait
// answer and a mediocre landscape-to-portrait one. The point is that every
// ratio opens as a sensible arrangement a human then adjusts, and that each
// ratio's adjustments are SAVED SEPARATELY, so fixing the Story does not
// disturb the square.
//
// Pure. No fabric, no DOM, no imports — it transforms a plain object, so
// scripts/check-ad-ratios.mjs can execute every case against hostile input.

/**
 * The frames a contractor actually posts into.
 *
 * `file` is the suffix on the downloaded file, because a folder of five images
 * called design-1.png through design-5.png is a folder nobody can use. The
 * whole point of exporting a set is that each one arrives knowing where it goes.
 */
export const AD_RATIOS = [
  { key: "instagram_post", label: "Instagram post", file: "instagram-post", width: 1080, height: 1080 },
  { key: "instagram_story", label: "Instagram story", file: "instagram-story", width: 1080, height: 1920 },
  { key: "tiktok", label: "TikTok", file: "tiktok", width: 1080, height: 1920 },
  { key: "facebook_feed", label: "Facebook feed", file: "facebook-feed", width: 1200, height: 630 },
  { key: "youtube_thumb", label: "YouTube thumbnail", file: "youtube-thumbnail", width: 1280, height: 720 },
];

/** The frame a new advert opens on. Square travels furthest with least damage. */
export const DEFAULT_RATIO = "instagram_post";

export function ratio(key) {
  return AD_RATIOS.find((r) => r.key === key) || null;
}

/**
 * The workspace rectangle — the editor tags it `name: "clip"` and treats it as
 * both the page bounds and the export clip. It is not artwork and must never be
 * moved by a reflow: it IS the new frame.
 */
const isWorkspace = (o) => o?.name === "clip";

/**
 * Re-lay-out a fabric document for a different frame.
 *
 * @param doc   a parsed fabric toJSON() document — `{ objects: [...] }`
 * @param from  { width, height } the frame it was laid out in
 * @param to    { width, height } the frame wanted
 * @returns a NEW document. The input is never mutated: the caller still holds
 *          the layout for the ratio being copied FROM, and mutating it in place
 *          would quietly rewrite the design the contractor is looking at.
 */
export function reflow(doc, from, to) {
  const objects = Array.isArray(doc?.objects) ? doc.objects : [];
  const fw = Number(from?.width) || 0;
  const fh = Number(from?.height) || 0;
  const tw = Number(to?.width) || 0;
  const th = Number(to?.height) || 0;
  // A frame with no size is not a frame. Returning the document untouched is
  // the honest answer — better a layout that did not change than one scaled by
  // NaN, which fabric renders as nothing at all and reads as "my advert
  // vanished".
  if (!fw || !fh || !tw || !th) return { ...doc, objects: objects.map((o) => ({ ...o })) };

  const scale = Math.min(tw / fw, th / fh);

  const next = objects.map((o) => {
    const obj = { ...o };
    if (isWorkspace(obj)) {
      // The frame itself takes the new size exactly, and is centred on the
      // origin the same way the editor centres it when a canvas is created.
      obj.width = tw;
      obj.height = th;
      obj.scaleX = 1;
      obj.scaleY = 1;
      return obj;
    }

    // Position is mapped through the CENTRE of each object, not its top-left
    // corner. Scaling a corner drifts everything toward the origin — the
    // further from top-left a thing sits, the further it slides — which pulls a
    // composition apart at exactly the ratios that change most.
    const w = (Number(obj.width) || 0) * (Number(obj.scaleX) || 1);
    const h = (Number(obj.height) || 0) * (Number(obj.scaleY) || 1);
    const cx = (Number(obj.left) || 0) + w / 2;
    const cy = (Number(obj.top) || 0) + h / 2;

    // Where it sat in the old frame, as a fraction. Preserved, so a headline a
    // third of the way down stays a third of the way down.
    const rx = cx / fw;
    const ry = cy / fh;

    obj.scaleX = (Number(obj.scaleX) || 1) * scale;
    obj.scaleY = (Number(obj.scaleY) || 1) * scale;
    const nw = w * scale;
    const nh = h * scale;
    obj.left = rx * tw - nw / 2;
    obj.top = ry * th - nh / 2;

    // Stroke width is NOT a scaled dimension in fabric — it is drawn in
    // absolute pixels unless strokeUniform is set. Left alone, a 2px outline on
    // a shape scaled to a third becomes proportionally three times heavier, and
    // the design looks crude at the smallest ratio for no visible reason.
    if (Number(obj.strokeWidth) > 0) obj.strokeWidth = Number(obj.strokeWidth) * scale;

    // Text is sized by fontSize, and fabric applies scaleX/scaleY ON TOP of it.
    // Scaling both would compound and the copy would come out squared. fontSize
    // is left exactly as it is and the scale factor carries the change.
    return obj;
  });

  return { ...doc, objects: next };
}

/**
 * Is every piece of artwork still inside the frame?
 *
 * Reflow is a starting point, not a guarantee — a wide object reflowed into a
 * narrow frame can still hang over an edge. This answers it honestly so the
 * screen can warn rather than let somebody download five files and find out on
 * Instagram.
 */
export function overflowing(doc, frame) {
  const w = Number(frame?.width) || 0;
  const h = Number(frame?.height) || 0;
  if (!w || !h) return [];
  return (Array.isArray(doc?.objects) ? doc.objects : [])
    .filter((o) => !isWorkspace(o))
    .filter((o) => {
      const ow = (Number(o.width) || 0) * (Number(o.scaleX) || 1);
      const oh = (Number(o.height) || 0) * (Number(o.scaleY) || 1);
      const l = Number(o.left) || 0;
      const t = Number(o.top) || 0;
      // A pixel of rounding is not an overflow. Half a logo is.
      return l < -1 || t < -1 || l + ow > w + 1 || t + oh > h + 1;
    })
    .map((o) => o.name || o.type || "object");
}

/** `paint-co-spring-promo-instagram-story.png` — a name that says where it goes. */
export function assetFilename(campaignName, ratioKey, ext = "png") {
  const r = ratio(ratioKey);
  const base = String(campaignName || "advert")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "advert";
  return `${base}-${r?.file || ratioKey || "custom"}.${ext}`;
}
