// Harness stub for @/lib/fetchJson: serves the Review folder fixture by URL
// and applies decisions in memory so a keypress is visible in a screenshot.
// Row shapes are exactly what app/api/platform/sales/review/route.js returns;
// the names are real Quebec licence-holders read off the production folder.
const GENERAL = ["1.2 — Entrepreneur en petits bâtiments", "2.5 — Entrepreneur en excavation et terrassement", "2.7 — Entrepreneur en travaux d'emplacement", "3.2 — Entrepreneur en petits ouvrages de béton", "4.2 — Entrepreneur en travaux de maçonnerie non structurale, marbre et céramique", "5.2 — Entrepreneur en ouvrages métalliques", "6.2 — Entrepreneur en travaux de bois et plastique", "7 — Entrepreneur en isolation, étanchéité, couvertures et revêtements extérieurs", "8 — Entrepreneur en portes et fenêtres", "9 — Entrepreneur en travaux de finition", "11.2 — Entrepreneur en équipements et produits spéciaux", "12 — Entrepreneur en armoires et comptoirs usinés", "13.5 — Entrepreneur en installations spéciales ou préfabriquées", "17.2 — Entrepreneur en intercommunication, téléphonie et surveillance"];
const RBQ = "RBQ — Quebec contractor licences";
const REG = "Holds a contractor licence (Quebec RBQ).";
const camp = { id: "c1", name: "Quebec — rbq part 1" };
const row = (id, businessName, city, phone, licence, suggestions, extra = {}) => ({
  id, businessName, tradingNames: [], city, province: "QC", phoneE164: phone, websiteUrl: null, hasWebsite: null,
  sourceProvider: "rbq", sourceLabel: RBQ, register: "Quebec RBQ", licenceNumber: licence, categories: GENERAL,
  classificationReason: REG, status: "discovered", classification: "contractor", tradeKey: null, tradeLabel: null,
  reasons: ["no_trade"], deferred: false, campaign: camp, suggestions, retailWord: null, duplicateOf: null, ...extra,
});
const S = (tradeKey, label, source, basis) => ({ tradeKey, label, source, basis });

let rows = [
  row("p1", "Toitures Phénix inc.", "Laval", "+14505550137", "5782-8402-01", [S("roofing", "Roofing", "name", "name: 'toitur'")]),
  row("p1b", "Toitures Dupont inc.", "Terrebonne", "+14505550152", "5782-8411-01", [S("roofing", "Roofing", "name", "name: 'toitur'")]),
  row("p1c", "Toiture & Rénovation D'Aoust inc.", "Mirabel", "+14505550177", "5782-8419-01", [S("roofing", "Roofing", "name", "name: 'toitur'"), S("remodeling", "Remodelling", "name", "name: 'renov'")]),
  row("p2", "Électro-Plomberie J.-P. inc.", "Gatineau", "+18195550142", "5782-8485-01", [S("electrical", "Electrical", "name", "name: 'electro'"), S("plumbing", "Plumbing", "name", "name: 'plomb'")]),
  row("p3", "9410-5111 Québec inc.", "Montréal", "+15145550118", "5782-8584-01", [S("electrical", "Electrical", "licence", "licence: only 16 électricité")], { categories: ["16 — Entrepreneur en électricité"], tradingNames: ["Les Installations Électriques Mercier"] }),
  row("p4", "Les Paysagistes Cinquino Compagnie Ltée", "Saint-Léonard", "+15145550190", "5782-8527-01", [S("landscaping", "Landscaping", "name", "name: 'paysag'")], { websiteUrl: "https://cinquino.example", hasWebsite: true }),
  row("p5", "Plomberie Charbonneau inc.", "Montréal", "+15145550171", "5782-8576-01", [S("plumbing", "Plumbing", "site", "site: plomberiecharbonneau.example"), S("hvac", "Heating and cooling", "name", "name: 'chauffage'")], { businessName: "Plomberie & Chauffage Charbonneau inc.", websiteUrl: "https://plomberiecharbonneau.example", hasWebsite: true }),
  row("p6", "Peinture Dépôt Rive-Sud", "Longueuil", "+14505550164", "5782-8611-01", [], { retailWord: "depot" }),
  row("p7", "Construction 2Much inc.", "Montréal", "+15145550101", "5782-8485-02", []),
  row("p8", "Gestion Immobilière Arpin inc.", "Saint-Thomas", "+14505550128", "5782-8527-02", [], {
    status: "needs_review", classification: "needs_review", classificationReason: "The source lists this as a shop as well as a trade — it may be a contractor with a showroom.",
    sourceProvider: "overture", sourceLabel: "Overture Maps — places", register: null, licenceNumber: null, categories: ["contractor", "home_improvement_store"], reasons: ["unclear", "duplicate"], campaign: { id: "c2", name: "Quebec — overture" },
    duplicateOf: { id: "p99", businessName: "Les Entreprises Arpin inc.", city: "Saint-Thomas", status: "discovered", tradeKey: "general_contracting" },
  }),
];
let total = 46485;

const base = {
  page: 0, pageSize: 50,
  filter: { campaignId: null, source: "rbq", province: "QC", reason: null, q: null, website: null, retail: null },
  reasons: [
    { key: "no_trade", label: "No trade", note: "" },
    { key: "unclear", label: "Unclear contractor / shop", note: "" },
    { key: "duplicate", label: "Possible duplicate", note: "" },
  ],
  trades: ["cabinets","carpentry","countertops","demolition","drywall","electrical","excavation","fencing","flooring","general_contracting","gutters","hvac","insulation","landscaping","masonry_concrete","painting","paving","plumbing","pool_spa","remodeling","roofing","siding","tiling"].map((k) => ({ key: k, label: ({ hvac: "Heating and cooling", masonry_concrete: "Masonry and concrete", pool_spa: "Pools and spas", general_contracting: "General contracting", remodeling: "Remodelling" })[k] || k[0].toUpperCase() + k.slice(1) })),
  sources: [{ key: "us_ca_cslb", label: "California CSLB", count: 119454 }, { key: "overture", label: "Overture", count: 82167 }, { key: "rbq", label: RBQ, count: 49131 }, { key: "us_or_ccb", label: "Oregon CCB", count: 5281 }],
  provinces: [{ key: "CA", count: 119454 }, { key: "QC", count: 51193 }, { key: "NY", count: 31022 }, { key: "FL", count: 24011 }, { key: "OR", count: 5281 }],
  campaigns: [{ id: "c1", name: "Quebec — rbq part 1", count: 42821 }, { id: "c3", name: "California — us_ca_cslb part 1", count: 25374 }, { id: "c2", name: "Quebec — overture", count: 2396 }],
};

export async function fetchJson(url, init = {}) {
  const u = String(url);
  if (u.startsWith("/api/platform/sales/review/bulk")) {
    const body = JSON.parse(init.body || "{}");
    return { ok: true, count: body.expectedCount, byStatus: { discovered: body.expectedCount }, campaigns: 1, sample: rows.slice(0, 3).map((r) => r.businessName), tradeLabel: "Roofing", research: "Not queued here. The backlog cron researches rows with a website, trade first; a claim queues the rest." };
  }
  if (u.startsWith("/api/platform/sales/review/reclassify")) {
    return { dryRun: true, byProvider: { rbq: { found: 39655, withTrade: 0, withoutTrade: 37010, skipped: 2645 } }, planned: 37010, updated: 0, campaigns: 2 };
  }
  if (u.startsWith("/api/platform/sales/review") && init.method === "POST") {
    const body = JSON.parse(init.body || "{}");
    if (body.decision !== "skip") { rows = rows.filter((r) => r.id !== body.prospectId); total -= 1; }
    return { ok: true, decision: body.decision, bucket: "banked", counters: {}, research: { queued: 1 } };
  }
  if (u.startsWith("/api/platform/sales/review")) {
    const params = new URLSearchParams(u.split("?")[1] || "");
    const q = (params.get("q") || "").toLowerCase();
    const retail = params.get("retail") === "yes";
    let out = q ? rows.filter((r) => r.businessName.toLowerCase().includes(q)) : rows;
    if (retail) out = rows.filter((r) => r.retailWord);
    return { ...base, total: retail ? 1093 : q ? 583 : total, rows: out, filter: { ...base.filter, q: q || null, retail: retail ? "yes" : null } };
  }
  throw new Error("harness: no fixture for " + u);
}
export default fetchJson;
