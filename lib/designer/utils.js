// lib/designer/utils.js
//
// Ported from nextjs-canva-clone's `features/editor/utils.ts`, split so this
// half never imports fabric. createFilter() is the only function in the
// original file that touched `fabric.Image.filters.*`; everything else here
// is plain object/string manipulation. Keeping it fabric-free means
// scripts/check-designer.mjs can execute these functions for real, under
// bare Node, instead of only grepping the source text — see createFilter's
// new home in lib/designer/filters.js for why that split matters for SSR too.

/**
 * Normalises legacy `type: "text"` objects (fabric's old, deprecated type)
 * to `type: "textbox"` (what addText() actually creates) inside a parsed
 * canvas.toJSON() tree, walking into nested groups.
 *
 * BUG FIX: the source clone wrote
 *   item.type === "text" && (item.type === "textbox");
 * — a comparison, not an assignment. `(item.type === "textbox")` evaluates
 * to a boolean that is immediately discarded; `item.type` is never touched.
 * The right-hand side needed to be `(item.type = "textbox")`, an assignment
 * inside parens (parens make the intent-to-assign explicit and silence the
 * "did you mean ===" lint warning). Without this fix, a JSON export saved
 * from an old fabric document that still has "text" objects re-imports with
 * the same stale type forever — the normalisation this function exists for
 * never happened.
 */
export function transformText(objects) {
  if (!objects) return;

  objects.forEach((item) => {
    if (item.objects) {
      transformText(item.objects);
    } else if (item.type === "text") {
      item.type = "textbox";
    }
  });
}

/**
 * Triggers a browser download of a data: URL. Only ever called from inside a
 * click handler in the client-only editor tree, so touching `document` here
 * is safe — but see the "use client" note on every caller.
 */
export function downloadFile(file, type) {
  const anchorElement = document.createElement("a");

  anchorElement.href = file;
  // uuidv4() (an extra dependency) swapped for the platform's own
  // crypto.randomUUID() — same shape of output, one fewer package to audit.
  anchorElement.download = `${crypto.randomUUID()}.${type}`;
  document.body.appendChild(anchorElement);
  anchorElement.click();
  anchorElement.remove();
}

export function isTextType(type) {
  return type === "text" || type === "i-text" || type === "textbox";
}

/**
 * react-color's onChange hands back `{ r, g, b, a }`; fabric wants a CSS
 * rgba() string. `"transparent"` is handled explicitly because react-color's
 * CirclePicker passes it through as the literal string `colors` includes,
 * not as an RGBColor object.
 */
export function rgbaObjectToString(rgba) {
  if (rgba === "transparent") {
    return `rgba(0,0,0,0)`;
  }

  const alpha = rgba.a === undefined ? 1 : rgba.a;

  return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${alpha})`;
}
