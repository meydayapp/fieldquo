// lib/estimate/materialLabel.js
//
// An instant-estimate option KEY back to its name — the pure half of
// loadMaterialLabels() (lib/estimate/instantQuoteServer.js), which does the
// database reads around it. Split out because instantQuoteServer imports the
// Prisma client, and the roofing showcase (app/(marketing)/industries/[slug]/
// showcase/roofingRun.js) runs in the browser: it has to name the sample
// lead's option with the same function the GET /api/leads/[id] route names a
// real one with, not a hand-typed "Architectural shingles".

/** Pure: the option's label in `config`, or null. */
export function materialLabelFromConfig(config, key) {
  if (!key || !config || typeof config !== "object" || !Array.isArray(config.materials)) return null;
  const m = config.materials.find((x) => x && typeof x === "object" && x.key === key);
  return typeof m?.label === "string" && m.label.trim() ? m.label.trim() : null;
}

/** Where loadMaterialLabels files one option: the same key can be two trades'. */
export function materialLabelSlot(trade, key) {
  return `${trade || "*"}|${key}`;
}
