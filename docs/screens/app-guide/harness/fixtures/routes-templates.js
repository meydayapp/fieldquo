// docs/screens/app-guide/harness/fixtures/routes-templates.js
//
// The estimate-template screens (docs/screens/services-templates/): Settings
// › Services with a service's template unfolded, and the preset library on
// /app/analytics/benchmark — each on two company shapes:
//
//   *-cabinets     the harness's cabinet maker (the owner's own company shape:
//                  refinishing, refacing, countertops), two of its add-ons
//                  carrying a template;
//   *-electrical   an electrical company whose eleven services are the captured
//                  estimate templates (docs/research/hcp-estimate-templates-
//                  electrical.json) loaded through the SAME loader that seeds a
//                  trade — lib/services/templateImport.js → productDataForSeed —
//                  exactly as they were loaded onto the electrical demo
//                  company in the live database on 2026-09-24.
//
// Every other screen falls through to the group files.
import capture from "../../../../research/hcp-estimate-templates-electrical.json";
import { COMPANY, day, iso } from "./company.js";
import { SERVICE_CATEGORIES, PRODUCTS_FIXTURE, BUSINESS_INFO_FIXTURE, systemCategory } from "./routes-settings-a.js";
import { templatesFromCapture } from "@/lib/services/templateImport";
// The loader's pure half (lib/products/seedServices.js#productDataForSeed
// composes exactly these two plus the seed's median) — the seeder module
// itself imports the database, which a browser bundle cannot carry.
import { seedText, seedTemplateFor } from "@/lib/services/seeds";
import { suggestedIn } from "@/lib/pricing/benchmarkFx";

const isCabinets = (ctx) => /^(services-templates|benchmark-library)-cabinets/.test(ctx.screen?.slug || "");
const isElectrical = (ctx) => /^(services-templates|benchmark-library)-electrical/.test(ctx.screen?.slug || "");

// ── The cabinet maker: two add-ons with a template ─────────────────────────
const CABINET_PRODUCTS = PRODUCTS_FIXTURE.map((p) => {
  if (p.id === "pr_hinge") {
    return {
      ...p,
      imageUrl: null,
      templateLines: [
        { kind: "labour", name: "Hinge fitting — per door", description: "Old hinges out, new ones bored and fitted, door realigned.", qty: 1, unit: "each", unitPrice: 6.5, unitCost: 3.25, taxable: true },
        { kind: "material", name: "Blum Clip-top 110° soft-close hinge", description: "Two per door with mounting plates.", qty: 2, unit: "each", unitPrice: 4, unitCost: 2.9, taxable: true },
      ],
      defaultDiscount: { name: "Bundle discount", kind: "percent", amount: 5 },
    };
  }
  if (p.id === "pr_install") {
    return {
      ...p,
      imageUrl: null,
      templateLines: [
        { kind: "labour", name: "Installers — two, one day", description: "Levelling, scribing and fixing to the studs.", qty: 2, unit: "flat", unitPrice: 340, unitCost: 210, taxable: true },
        { kind: "material", name: "Fasteners, shims and filler strips", description: "Cabinet screws, shims, filler and scribe moulding.", qty: 1, unit: "flat", unitPrice: 45, unitCost: 34, taxable: true },
        { kind: "other", name: "Haul-away and site clean-up", description: "Packaging removed, work area left clean.", qty: 1, unit: "flat", unitPrice: 105, unitCost: 60, taxable: true },
      ],
      defaultDiscount: { name: "New customer discount", kind: "fixed", amount: 50 },
    };
  }
  return { ...p, templateLines: null, defaultDiscount: null, imageUrl: null };
});

// ── The electrical company: the eleven captured templates, through the loader ──
export const ELECTRICAL_CATEGORY = systemCategory("electrical", "Electrical", "Zap", 9, true);
const ELECTRICAL_PRODUCTS = templatesFromCapture(capture).map((row, i) => {
  const { name, description, translations } = seedText(row, "en");
  const { templateLines, defaultDiscount, imageUrl } = seedTemplateFor(row, { language: "en", currency: "CAD" });
  return {
    id: `pr_elec_${i}`,
    companyId: COMPANY.id,
    seedKey: row.seedKey,
    name,
    description: description || null,
    translations: Object.keys(translations).length ? translations : null,
    type: "service",
    unitPrice: suggestedIn(row.benchmark?.median, "CAD"),
    costPrice: null,
    unit: row.unit || null,
    active: true,
    templateLines,
    defaultDiscount,
    imageUrl,
    categories: [{ id: ELECTRICAL_CATEGORY.id, label: ELECTRICAL_CATEGORY.label }],
    createdAt: iso(day(-1)),
  };
});
const ELECTRICAL_CATEGORIES = [ELECTRICAL_CATEGORY, ...SERVICE_CATEGORIES.map((c) => ({ ...c, enabled: false }))];

export const ROUTES_TEMPLATES = [
  { path: "/api/products", method: "GET", reply: (ctx) => (isCabinets(ctx) ? CABINET_PRODUCTS : isElectrical(ctx) ? ELECTRICAL_PRODUCTS : ctx.next()) },
  { path: "/api/settings/service-categories", method: "GET", reply: (ctx) => (isElectrical(ctx) ? ELECTRICAL_CATEGORIES : ctx.next()) },
  {
    path: "/api/settings/business-info",
    method: "GET",
    reply: (ctx) =>
      isElectrical(ctx)
        ? { ...BUSINESS_INFO_FIXTURE, name: "Bright Line Electric", industries: ["electrical"], currency: "CAD" }
        : isCabinets(ctx)
          ? { ...BUSINESS_INFO_FIXTURE, currency: "CAD" }
          : ctx.next(),
  },
];
