// lib/ai/imageStyles.js
//
// The look of a generated marketing image, as a closed set of presets.
//
// The designer used to hand the model the contractor's sentence verbatim, so
// "a freshly painted living room" came back in whatever style the model felt
// like — a watercolour one day, a render the next. A contractor's ad wants a
// photograph unless they say otherwise. The owner, 2026-09-19: "the preset
// for the image generation in the designer should be photorealistic by
// default unless it is different." So: a style clause is prepended on the
// server from this table, the browser sends only the key, and an unknown key
// falls back to the default rather than to "no style".
//
// Pure. The sidebar lists STYLE_KEYS; the route calls styledPrompt().

export const DEFAULT_IMAGE_STYLE = "photorealistic";

export const IMAGE_STYLES = Object.freeze({
  photorealistic: Object.freeze({
    clause:
      "Photorealistic photograph, natural light, real materials and textures, shot on a full-frame camera with a 35mm lens, no text, no logos, no watermark.",
  }),
  illustration: Object.freeze({
    clause: "Clean editorial illustration, flat colour with subtle shading, no text, no logos.",
  }),
  flat: Object.freeze({
    clause: "Flat vector graphic, simple shapes, two or three colours, no gradients, no text, no logos.",
  }),
  watercolour: Object.freeze({
    clause: "Loose watercolour painting on textured paper, soft edges, no text, no logos.",
  }),
  lineart: Object.freeze({
    clause: "Minimal black line art on a white background, single line weight, no shading, no text, no logos.",
  }),
});

export const STYLE_KEYS = Object.freeze(Object.keys(IMAGE_STYLES));

/** The key the route will use for whatever the browser sent. */
export function imageStyleKey(value) {
  const k = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(IMAGE_STYLES, k) ? k : DEFAULT_IMAGE_STYLE;
}

/** The prompt the model receives: the style clause, then the person's words. */
export function styledPrompt(prompt, style) {
  const words = String(prompt || "").trim();
  if (!words) return "";
  return `${IMAGE_STYLES[imageStyleKey(style)].clause} ${words}`;
}
