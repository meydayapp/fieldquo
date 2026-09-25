// lib/services/templateImport.js
//
// A captured estimate-template set (docs/research/*-estimate-templates-*.json
// — the shape a competitor's estimate templates were read in) turned into
// seed-row templates in the contract lib/services/seeds.js documents, so the
// same loader that seeds a trade can load a capture onto a demo company
// without a seed file being edited.
//
// Pure: no database. The capture's descriptions are its own words and are
// NOT copied into a line — a capture is the shape and the figures (the split
// into labour and materials, the quantities, unit prices, unit costs, tax
// flags and discounts); the text a company reads is written by hand in the
// seeds. Here the line NAME is kept (it is a product or task name, not prose)
// and the description is left for the seed authors, so nothing a competitor
// wrote lands on a screen.

const KIND = { labor: "labour", labour: "labour", materials: "material", material: "material" };
const DISCOUNT_KIND = { "fixed discount": "fixed", fixed: "fixed", "percent discount": "percent", percent: "percent" };

const slug = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

/**
 * @param capture  the parsed JSON: { categories: [{ name, templates: [{ template_name,
 *                 option_name, description, total, labor[], materials[], discounts[] }] }] }
 * @returns [{ seedKey, templateCategory, name: { en }, description: { en }, unit,
 *            benchmark, templateLines, defaultDiscount, capturedTotal }] — one
 *            per captured template, in capture order. `benchmark` is a point
 *            at the template's pre-discount subtotal, so the seeded headline
 *            price is the template's own list price.
 */
export function templatesFromCapture(capture, { trade = "electrical", keyPrefix = null, asOf = "2026-09-24" } = {}) {
  const out = [];
  const prefix = keyPrefix || `fq.${trade}.capture`;
  for (const cat of capture?.categories || []) {
    const templateCategory = String(cat?.name || "").toLowerCase();
    for (const t of cat?.templates || []) {
      const lines = [];
      for (const [group, kind] of [["labor", "labour"], ["materials", "material"]]) {
        for (const l of t?.[group] || []) {
          lines.push({
            kind: KIND[group] || kind,
            name: l.name,
            description: "",
            qty: Number(l.qty) > 0 ? Number(l.qty) : 1,
            unit: kind === "material" ? "each" : "flat",
            unitPrice: Number(l.unit_price),
            unitCost: Number(l.unit_cost),
            ...(typeof l.taxable === "boolean" ? { taxable: l.taxable } : {}),
          });
        }
      }
      const d = (t?.discounts || [])[0];
      const defaultDiscount = d
        ? { name: d.name, kind: DISCOUNT_KIND[String(d.kind).toLowerCase()] || "fixed", amount: Number(d.amount) }
        : null;
      const subtotal = Math.round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100) / 100;
      out.push({
        seedKey: `${prefix}.${slug(t.option_name || t.template_name)}`,
        templateCategory,
        name: { en: t.option_name || t.template_name },
        description: { en: "" },
        unit: "flat",
        benchmark: { low: null, median: subtotal, high: null, currency: "USD", source: "benchmark", asOf },
        durationMinutes: null,
        bookable: false,
        templateLines: lines,
        defaultDiscount,
        capturedTotal: Number(t.total),
      });
    }
  }
  return out;
}
