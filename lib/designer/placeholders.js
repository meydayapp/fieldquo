// lib/designer/placeholders.js
//
// "This part of the design is not real yet."
//
// A template carries things only the company can supply: a customer's review,
// a warranty length, a licence number, a before photo. Filling those with
// convincing sample text would put an invented review or statistic in front
// of the public under a real company's name — so they are left as obviously
// bracketed placeholders, and the object carrying one is NAMED so it can be
// found again: `fq-ph:<kind>`. fabric's `name` already round-trips through
// every save (lib/designer/constants.js JSON_KEYS), so this needs no new
// serialised property.
//
// The name changes to `fq-filled:<kind>` the moment somebody types into that
// text (useCanvasEvents.js, "text:changed"). A photo placeholder is a group
// the person deletes or replaces; while it exists, it counts.
//
// Both publish routes (Meta and TikTok) call placeholdersIn() on the layouts
// they are about to post and refuse while any remain — the server half of the
// rule. The editor shows the same count before anyone presses Publish.
//
// Pure: no fabric, no DOM — scripts/check-design-templates.mjs executes it.

export const PLACEHOLDER_PREFIX = "fq-ph:";
export const FILLED_PREFIX = "fq-filled:";

/** The kinds a template uses. Anything else after the prefix still counts. */
export const PLACEHOLDER_KINDS = ["review", "stat", "photo", "text", "contact"];

export function isPlaceholderName(name) {
  return typeof name === "string" && name.startsWith(PLACEHOLDER_PREFIX);
}

export function placeholderKind(name) {
  if (!isPlaceholderName(name)) return null;
  const kind = name.slice(PLACEHOLDER_PREFIX.length).split(":")[0];
  return kind || "text";
}

/** The name an object takes once a person has replaced its placeholder text. */
export function filledName(name) {
  if (!isPlaceholderName(name)) return name;
  return `${FILLED_PREFIX}${name.slice(PLACEHOLDER_PREFIX.length)}`;
}

function walk(objects, out) {
  for (const o of Array.isArray(objects) ? objects : []) {
    if (!o || typeof o !== "object") continue;
    if (isPlaceholderName(o.name)) {
      out.push(placeholderKind(o.name));
      // A placeholder group (a photo slot) counts once, not once per child.
      continue;
    }
    if (Array.isArray(o.objects)) walk(o.objects, out);
  }
}

/**
 * Every placeholder still on these layouts.
 *
 * @param {Array<{json: object}>|object} layouts  layout rows, or one fabric doc
 * @returns {{count: number, kinds: Record<string, number>}}
 */
export function placeholdersIn(layouts) {
  const docs = Array.isArray(layouts) ? layouts.map((l) => l?.json ?? l) : [layouts];
  const found = [];
  for (const doc of docs) walk(doc?.objects, found);
  const kinds = {};
  for (const k of found) kinds[k] = (kinds[k] || 0) + 1;
  return { count: found.length, kinds };
}
