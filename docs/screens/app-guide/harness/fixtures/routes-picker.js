// docs/screens/app-guide/harness/fixtures/routes-picker.js
//
// The "Add service" control at the foot of a quote (2026-09-25,
// docs/screens/service-picker/). Three company shapes, by slug prefix:
//
//   picker-3types-*   the cabinet shop with three quote types switched on
//                     (refinishing, refacing, countertops) and no service
//                     linked to them — three offerings, so the inline
//                     buttons (INLINE_PICKER_MAX is 4);
//   picker-15types-*  a handyman company with fifteen quote types — the
//                     owner's screenshot: handyman, locksmith, installation,
//                     doors & windows, smart home, caulking, baby proofing,
//                     carpentry, drywall, electrical, plumbing, appliances,
//                     garage doors, gutters, decks — and the handyman trade's
//                     seeded services, loaded through the seeder's own pure
//                     half (seedText / seedTemplateFor, as routes-templates.js
//                     does for electrical), linked to handyman and to every
//                     quote type the seed tags them with;
//   picker-md5-*      the cabinet shop with EVERY fixture quote type switched
//                     on, plus two templated services and one plain one —
//                     the frames that add each quote type through the foot
//                     and save, so the PATCH body can be compared, md5 for
//                     md5, with the same press on origin/main's cards.
//   picker-plumber-*  one trade — plumbing — and the plumbing seed with its
//                     seedKeys: the dialog's headings are the seed's own
//                     categories (2026-09-28), no trade heading above them.
//
// "-classic" in a slug answers the classic layout; everything else the
// document layout. Every save a picker frame makes is recorded on
// window.__pickerSaves (the body, as posted) for the md5 runner.
import { COMPANY, day, iso } from "./company.js";
import { SERVICE_CATEGORIES, PRODUCTS_FIXTURE, systemCategory } from "./routes-settings-a.js";
import { serviceSeedsForCompanyTrade, seedableServices, seedText, seedTemplateFor, seedCategoryKeys, seedServiceByKey } from "@/lib/services/seeds";
import { seedCategoryName } from "@/lib/services/confirmServices";
import { SERVICE_SEEDS } from "@/app/data/serviceSeeds";
import { productSeedCategory } from "@/lib/quotes/servicePicker";
import { suggestedIn } from "@/lib/pricing/benchmarkFx";

const slugOf = (ctx) => ctx.screen?.slug || "";
const isPicker = (ctx) => slugOf(ctx).startsWith("picker-");
const shape = (ctx) =>
  slugOf(ctx).startsWith("picker-3types")
    ? "3types"
    : slugOf(ctx).startsWith("picker-15types") || slugOf(ctx).startsWith("picker-invoice")
      ? "15types"
      : slugOf(ctx).startsWith("picker-md5")
        ? "md5"
        : slugOf(ctx).startsWith("picker-plumber")
          ? "plumber"
          : null;

// ── Three quote types, nothing linked ──────────────────────────────────────
const THREE = SERVICE_CATEGORIES.map((c) => ({ ...c, enabled: ["cabinet_refinishing", "cabinet_refacing", "countertop"].includes(c.key) }));

// ── Fifteen quote types, the handyman seed ─────────────────────────────────
const FIFTEEN_KEYS = [
  ["handyman", "Handyman", "Hammer"],
  ["locksmith", "Locksmith Services", "Lock"],
  ["installation_services", "Installation Services", "Wrench"],
  ["doors_windows", "Doors & Windows", "DoorClosed"],
  ["smart_home", "Smart Home & Audio-Video", "Zap"],
  ["caulking_sealants", "Caulking & Sealants", "Droplet"],
  ["baby_proofing", "Baby Proofing", "Home"],
  ["carpentry", "Carpentry", "Hammer"],
  ["drywall_install", "Drywall Installation", "Square"],
  ["electrical", "Electrical", "Zap"],
  ["plumbing", "Plumbing", "Droplets"],
  ["appliance_repair", "Appliance Repair", "Wrench"],
  ["garage_door", "Garage Doors", "DoorClosed"],
  ["gutter_services", "Gutter Services", "Home"],
  ["deck_patio", "Decks & Patios", "Layers"],
];
const FIFTEEN = FIFTEEN_KEYS.map(([key, label, icon], i) => systemCategory(key, label, icon, 20 + i, true));
const idByKey = Object.fromEntries(FIFTEEN.map((c) => [c.key, c.id]));
const HANDYMAN_SEEDED = seedableServices(serviceSeedsForCompanyTrade("handyman")).map((row, i) => {
  const { name, description, translations } = seedText(row, "en");
  const hasTemplate = Array.isArray(row.templateLines) && row.templateLines.length > 0;
  const tpl = hasTemplate ? seedTemplateFor(row, { language: "en", currency: "CAD" }) : null;
  const keys = ["handyman", ...seedCategoryKeys(row, "handyman")].filter((k) => idByKey[k]);
  const price = suggestedIn(row.benchmark?.median, "CAD");
  return {
    id: `pr_hm_${i}`,
    companyId: COMPANY.id,
    seedKey: row.seedKey,
    name,
    description: description || null,
    translations: Object.keys(translations).length ? translations : null,
    type: "service",
    unitPrice: price || null,
    costPrice: null,
    unit: row.unit || null,
    active: true,
    templateEnabled: true,
    templateLines: tpl ? tpl.templateLines : null,
    defaultDiscount: tpl ? tpl.defaultDiscount : null,
    estimateTypes: tpl ? tpl.estimateTypes : [],
    imageUrl: null,
    categories: [...new Set(keys)].map((k) => ({ id: idByKey[k], label: FIFTEEN.find((c) => c.key === k).label })),
    createdAt: iso(day(-2)),
  };
});
// One archived row — never offered.
HANDYMAN_SEEDED.push({ ...HANDYMAN_SEEDED[0], id: "pr_hm_archived", name: "Archived — old rate", active: false });

// What GET /api/products attaches to a seeded row since 2026-09-28 — the
// heading the Add service dialog files it under — by the route's own call.
const SEED_DEPS = { seedServiceByKey, seedCategoryName, SERVICE_SEEDS };
const withSeedCategory = (rows) =>
  rows.map((p) => {
    const seedCategory = productSeedCategory(p, SEED_DEPS);
    return seedCategory ? { ...p, seedCategory } : p;
  });

// ── One trade, the plumbing seed (2026-09-28) ──────────────────────────────
// A plumber with plumbing alone switched on and the plumbing seed installed
// (each row keeps its seedKey, as lib/products/seedServices.js writes it), plus
// one service the company wrote itself — the dialog's headings are the
// seed's own categories, "Other" last, and no trade heading above them.
const PLUMBING_CAT = systemCategory("plumbing", "Plumbing", "Droplets", 40, true);
const PLUMBER = [PLUMBING_CAT, ...SERVICE_CATEGORIES.map((c) => ({ ...c, enabled: false }))];
const PLUMBING_SEEDED = [
  ...seedableServices(serviceSeedsForCompanyTrade("plumbing")).map((row, i) => {
    const { name, description, translations } = seedText(row, "en");
    return {
      id: `pr_pl_${i}`,
      companyId: COMPANY.id,
      seedKey: row.seedKey,
      name,
      description: description || null,
      translations: Object.keys(translations).length ? translations : null,
      type: "service",
      unitPrice: suggestedIn(row.benchmark?.median, "CAD") || null,
      costPrice: null,
      unit: row.unit || null,
      active: true,
      templateEnabled: true,
      templateLines: null,
      estimateTypes: [],
      imageUrl: null,
      categories: [{ id: PLUMBING_CAT.id, label: PLUMBING_CAT.label }],
      createdAt: iso(day(-2)),
    };
  }),
  {
    id: "pr_pl_own", companyId: COMPANY.id, seedKey: null, name: "Emergency call-out — after hours", description: null, translations: null,
    type: "service", unitPrice: 195, costPrice: null, unit: "flat", active: true, templateEnabled: true, templateLines: null, estimateTypes: [],
    imageUrl: null, categories: [{ id: PLUMBING_CAT.id, label: PLUMBING_CAT.label }], createdAt: iso(day(-1)),
  },
];

// ── Every fixture quote type, and three services to add ────────────────────
const ALL = SERVICE_CATEGORIES.map((c) => ({ ...c, enabled: true }));
const cat = (key) => {
  const c = ALL.find((x) => x.key === key);
  return { id: c.id, label: c.label };
};
export const MD5_PRODUCTS = [
  ...PRODUCTS_FIXTURE,
  {
    id: "pr_tpl_stairs", name: "Stair refinish — sand and stain", description: "Treads sanded to bare wood, stained and sealed.", type: "service", active: true,
    unitPrice: 95, unit: "tread", templateEnabled: true, estimateTypes: [], categories: [cat("stairs")], translations: null,
    templateLines: [
      { kind: "labour", name: "Tread sanding and stain", description: "Per tread.", qty: 1, unit: "each", unitPrice: 95, unitCost: 48, taxable: true, measurementKey: "treads" },
      { kind: "material", name: "Stain and polyurethane", description: "Oil-based stain, two coats of poly.", qty: 1, unit: "flat", unitPrice: 140, unitCost: 105, taxable: true },
      { kind: "other", name: "Dust containment", description: "Plastic sheeting and HEPA vacuum.", qty: 1, unit: "flat", unitPrice: 120, unitCost: 60, taxable: true },
    ],
  },
  {
    id: "pr_tpl_cab", name: "Cabinet spray — per door", description: "Doors sprayed off-site.", type: "service", active: true,
    unitPrice: 165, unit: "door", templateEnabled: true, estimateTypes: [], categories: [cat("cabinet_refinishing")], translations: null,
    templateLines: [
      { kind: "labour", name: "Door spraying", qty: 1, unit: "each", unitPrice: 165, unitCost: 80, taxable: true, measurementKey: "doorCount" },
      { kind: "other", name: "Masking and protection", qty: 1, unit: "flat", unitPrice: 180, unitCost: 90, taxable: true },
    ],
  },
];

// The service a picker frame adds when it is not adding a quote type.
export const MD5_TEMPLATE_ADDS = [
  ["stairs", "pr_tpl_stairs"],
  ["cabinet_refinishing", "pr_tpl_cab"],
];
export const MD5_TYPE_KEYS = ALL.map((c) => c.key);

const record = (ctx) => {
  try {
    window.__pickerSaves = window.__pickerSaves || [];
    window.__pickerSaves.push({ method: ctx.method, body: typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body });
  } catch {
    // A body that is not JSON is recorded as it came.
    window.__pickerSaves.push({ method: ctx.method, raw: String(ctx.body) });
  }
};

export const ROUTES_PICKER = [
  // No required custom field on these quotes: the fixture's own would stop
  // the md5 frames' Save before it posts ("Fix the custom fields below
  // first"), which is the custom-fields check working, not this control.
  { path: "/api/custom-fields/values", method: "GET", reply: (ctx) => (isPicker(ctx) ? [] : ctx.next()) },
  { path: "/api/custom-fields", method: "GET", reply: (ctx) => (isPicker(ctx) ? [] : ctx.next()) },
  {
    path: "/api/settings/business-info",
    method: "GET",
    reply: (ctx) => (isPicker(ctx) ? { ...COMPANY, quoteBuilderLayout: /-classic/.test(slugOf(ctx)) ? "classic" : "document" } : ctx.next()),
  },
  {
    path: "/api/settings/service-categories",
    method: "GET",
    reply: (ctx) => {
      const s = shape(ctx);
      if (s === "3types") return THREE;
      if (s === "15types") return [...FIFTEEN, ...SERVICE_CATEGORIES.map((c) => ({ ...c, enabled: false }))];
      if (s === "md5") return ALL;
      if (s === "plumber") return PLUMBER;
      return ctx.next();
    },
  },
  {
    path: "/api/products",
    method: "GET",
    reply: (ctx) => {
      const s = shape(ctx);
      if (s === "3types") return PRODUCTS_FIXTURE;
      if (s === "15types") return withSeedCategory(HANDYMAN_SEEDED);
      if (s === "md5") return MD5_PRODUCTS;
      if (s === "plumber") return withSeedCategory(PLUMBING_SEEDED);
      return ctx.next();
    },
  },
  {
    path: /^\/api\/quotes\/(q_\d+)$/,
    method: "PATCH",
    reply: (ctx) => {
      if (!isPicker(ctx)) return ctx.next();
      record(ctx);
      return { id: ctx.params[1], updatedAt: iso(day(0)) };
    },
  },
  {
    path: "/api/quotes",
    method: "POST",
    reply: (ctx) => {
      if (!isPicker(ctx)) return ctx.next();
      record(ctx);
      return { id: "q_new", quoteNumber: "Q-1050" };
    },
  },
];
