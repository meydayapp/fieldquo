// scripts/check-plan-offer-routes.mjs
//
// The two staff routes behind maintenance plans, EXECUTED — status codes,
// tenant scope, and what is written — against the scripted db stub:
//
//   app/api/quotes/[id]/plan-offers        attach / list / remove on a quote
//   app/api/settings/plan-templates(/[id]) the company's templates
//
//   npm run check:plan-offer-routes
//
// The one property this exists to prove beyond the pure half
// (check-plan-templates.mjs): a staff member's browser posting a price, a
// discount or a name alongside the template id changes NOTHING — the offer is
// frozen from the template row the server read under the company's own where.

import { rows, writes, resetDbStub } from "./fixtures/dbStub.mjs";
import { session } from "./fixtures/apiMemberStub.mjs";
import * as offersRoute from "../app/api/quotes/[id]/plan-offers/route.js";
import * as templatesRoute from "../app/api/settings/plan-templates/route.js";
import * as templateRoute from "../app/api/settings/plan-templates/[id]/route.js";

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}

const OWNER = { id: "mem_owner", userId: "u_owner", companyId: "co_1", role: "owner", permissions: null };
const CREW = { id: "mem_crew", userId: "u_crew", companyId: "co_1", role: "employee", permissions: { quotes: "view_only", showPricing: false } };
const ESTIMATOR_RO = { id: "mem_est", userId: "u_est", companyId: "co_1", role: "employee", permissions: { quotes: "view_only", showPricing: true } };
const STRANGER = { id: "mem_other", userId: "u_other", companyId: "co_2", role: "owner", permissions: null };

const TEMPLATE = (id, patch = {}) => ({
  id, companyId: "co_1", seedKey: null, active: true, sortOrder: 0, categoryId: null,
  name: { en: "Quarterly Deep Clean", fr: "Grand ménage trimestriel" }, description: { en: "4 deep cleans" },
  includedProductIds: [], frequency: "quarterly", visitCount: 4, pricePerVisit: "165.00", discountPct: "10.000",
  createdAt: new Date("2026-09-01"), ...patch,
});
const QUOTE = (id, patch = {}) => ({
  id, companyId: "co_1", status: "sent", language: "fr", taxEnabled: true, subtotal: "1000", discount: "0", tax: "130",
  client: { language: "fr" }, company: { defaultLanguage: "en" }, ...patch,
});

function reset() {
  resetDbStub();
  rows.member = [OWNER, CREW, ESTIMATOR_RO, STRANGER];
  rows.servicePlanTemplate = [
    TEMPLATE("tpl_1"),
    TEMPLATE("tpl_unpriced", { pricePerVisit: null }),
    TEMPLATE("tpl_retired", { active: false }),
    TEMPLATE("tpl_theirs", { companyId: "co_2" }),
  ];
  rows.quote = [QUOTE("q_sent"), QUOTE("q_accepted", { status: "accepted" }), QUOTE("q_theirs", { companyId: "co_2" })];
  rows.quotePlanOffer = [];
  rows.product = [{ id: "p_mine", companyId: "co_1", name: "Routine clean", translations: null }, { id: "p_theirs", companyId: "co_2", name: "Theirs", translations: null }];
  rows.company = [{ id: "co_1", defaultLanguage: "en", currency: "CAD" }];
  rows.companyServiceCategory = [];
  session.member = OWNER;
}

const req = (method, body, url = "https://x.test/api") =>
  new Request(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const params = (id) => ({ params: Promise.resolve({ id }) });
async function call(handler, method, id, body, url) {
  const res = await handler(req(method, body, url), params(id));
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

console.log("\nQuote plan offers — attach, list, remove");

reset();
session.member = null;
ok("no session → 401", (await call(offersRoute.GET, "GET", "q_sent")).status === 401);

reset();
session.member = CREW;
ok("crew without showPricing → 403 (the panel hides itself)", (await call(offersRoute.GET, "GET", "q_sent")).status === 403);

reset();
session.member = ESTIMATOR_RO;
ok("view-only estimator can list", (await call(offersRoute.GET, "GET", "q_sent")).status === 200);
ok("  ^ but cannot attach", (await call(offersRoute.POST, "POST", "q_sent", { templateId: "tpl_1", mode: "optional" })).status === 403);

reset();
const tampered = await call(offersRoute.POST, "POST", "q_sent", {
  templateId: "tpl_1", mode: "optional",
  pricePerVisit: 0.01, discountPct: 99, name: "Hacked", serviceName: "Free", frequency: "annual", visitCount: 520, language: "tl", companyId: "co_2", quoteId: "q_theirs",
});
const created = rows.quotePlanOffer[0];
ok("attach → 201", tampered.status === 201, JSON.stringify(tampered.json)?.slice(0, 120));
ok("  ^ a posted price and discount are ignored — the template's are frozen", created && Number(created.pricePerVisit) === 165 && Number(created.discountPct) === 10, created && `${created.pricePerVisit} ${created.discountPct}`);
ok("  ^ a posted name, cadence and length are ignored", created?.name === "Grand ménage trimestriel" && created.frequency === "quarterly" && created.visitCount === 4);
ok("  ^ frozen in the QUOTE's language (fr), not a posted one", created?.language === "fr");
ok("  ^ under the caller's company and the URL's quote, whatever the body says", created?.companyId === "co_1" && created.quoteId === "q_sent");
ok("  ^ tax defaults to the rate this quote charges (13%)", Number(created?.taxRatePct) === 13);
ok("  ^ the response carries the plan engine's figures", tampered.json?.pricing?.perVisit?.subtotal === 148.5);

ok("the same template twice → 409", (await call(offersRoute.POST, "POST", "q_sent", { templateId: "tpl_1", mode: "included" })).status === 409);
ok("another company's template → 400, nothing written", (await call(offersRoute.POST, "POST", "q_sent", { templateId: "tpl_theirs", mode: "optional" })).status === 400 && rows.quotePlanOffer.length === 1);
ok("an unpriced template → 400", (await call(offersRoute.POST, "POST", "q_sent", { templateId: "tpl_unpriced", mode: "optional" })).status === 400);
ok("a retired template → 400", (await call(offersRoute.POST, "POST", "q_sent", { templateId: "tpl_retired", mode: "optional" })).status === 400);
ok("mode 'free' → 400", (await call(offersRoute.POST, "POST", "q_sent", { templateId: "tpl_unpriced", mode: "free" })).status === 400);
ok("an accepted quote → 409", (await call(offersRoute.POST, "POST", "q_accepted", { templateId: "tpl_1", mode: "optional" })).status === 409);
ok("another company's quote → 404", (await call(offersRoute.POST, "POST", "q_theirs", { templateId: "tpl_1", mode: "optional" })).status === 404);
rows.servicePlanTemplate.push(TEMPLATE("tpl_2", { name: { en: "Monthly" }, frequency: "monthly", visitCount: null }));
const noTax = await call(offersRoute.POST, "POST", "q_sent", { templateId: "tpl_2", mode: "included", taxRatePct: null });
const noTaxRow = rows.quotePlanOffer.find((o) => o.templateId === "tpl_2");
ok("an explicit 'no tax' is kept as null, not replaced by the quote's rate", noTax.status === 201 && noTaxRow?.taxRatePct === null);
ok("  ^ a template in English only offers its English name on a French quote", noTaxRow?.name === "Monthly" && noTaxRow.visitCount === null);
rows.quotePlanOffer.splice(rows.quotePlanOffer.indexOf(noTaxRow), 1);

const listed = await call(offersRoute.GET, "GET", "q_sent");
ok("list returns the offer and only this company's templates", listed.json.offers.length === 1 && listed.json.templates.every((t) => t.id !== "tpl_theirs" && t.id !== "tpl_retired"));
ok("  ^ with the quote's tax rate as the default", listed.json.defaultTaxRatePct === 13);

session.member = STRANGER;
ok("a stranger cannot see another company's quote plans", (await call(offersRoute.GET, "GET", "q_sent")).status === 404);
ok("  ^ nor remove them", (await call(offersRoute.DELETE, "DELETE", "q_sent", undefined, `https://x.test/api?offerId=${created.id}`)).status === 404 && rows.quotePlanOffer.length === 1);
session.member = OWNER;

rows.quotePlanOffer.push({ id: "off_sold", quoteId: "q_sent", companyId: "co_1", servicePlanId: "sp_1", templateId: "tpl_x", mode: "included" });
ok("an offer that already became a plan is never removed", (await call(offersRoute.DELETE, "DELETE", "q_sent", undefined, "https://x.test/api?offerId=off_sold")).status === 404 && rows.quotePlanOffer.some((o) => o.id === "off_sold"));
ok("removing an offer from a sent quote → 200", (await call(offersRoute.DELETE, "DELETE", "q_sent", undefined, `https://x.test/api?offerId=${created.id}`)).status === 200 && !rows.quotePlanOffer.some((o) => o.id === created.id));
rows.quotePlanOffer.push({ id: "off_acc", quoteId: "q_accepted", companyId: "co_1", servicePlanId: null, mode: "optional" });
ok("an accepted quote's offers are read-only → 409", (await call(offersRoute.DELETE, "DELETE", "q_accepted", undefined, "https://x.test/api?offerId=off_acc")).status === 409);

console.log("\nSettings → Maintenance plans");

reset();
session.member = CREW;
ok("crew without showPricing cannot read templates", (await call(templatesRoute.GET, "GET")).status === 403);
session.member = ESTIMATOR_RO;
ok("an estimator can read but not write (owner/admin only)", (await call(templatesRoute.GET, "GET")).status === 200 && (await call(templatesRoute.POST, "POST", undefined, { name: { en: "X" }, frequency: "monthly" })).status === 403);
session.member = OWNER;
const made = await call(templatesRoute.POST, "POST", undefined, {
  name: { en: "Monthly", fr: "Mensuel", zz: "nope" }, frequency: "monthly", visitCount: "", pricePerVisit: "145", discountPct: "15",
  includedProductIds: ["p_mine", "p_theirs"], companyId: "co_2", active: "yes",
});
const row = rows.servicePlanTemplate.find((t) => t.id === made.json?.id);
ok("create → 201 under the caller's company", made.status === 201 && row?.companyId === "co_1");
ok("  ^ another company's service id is dropped", JSON.stringify(row?.includedProductIds) === '["p_mine"]');
ok("  ^ an unknown language is dropped", row && !("zz" in row.name));
ok("  ^ blank visits = until cancelled; a truthy non-boolean `active` is not true", row?.visitCount === null && row?.active === false);
ok("hostile price → 400 with a sentence", (await call(templatesRoute.POST, "POST", undefined, { name: { en: "X" }, frequency: "monthly", pricePerVisit: "-5" })).status === 400);
ok("editing another company's template → 404", (await call(templateRoute.PATCH, "PATCH", "tpl_theirs", { active: false })).status === 404 && rows.servicePlanTemplate.find((t) => t.id === "tpl_theirs").active === true);
ok("retire an unpriced template (no re-validation needed)", (await call(templateRoute.PATCH, "PATCH", "tpl_unpriced", { active: false })).status === 200 && rows.servicePlanTemplate.find((t) => t.id === "tpl_unpriced").active === false);
const edit = await call(templateRoute.PATCH, "PATCH", "tpl_1", { pricePerVisit: "175" });
ok("a partial edit keeps the rest of the row", edit.status === 200 && edit.json.pricePerVisit === 175 && edit.json.frequency === "quarterly" && edit.json.name.fr === "Grand ménage trimestriel");
ok("no DELETE is exported for templates (retire, never delete)", !("DELETE" in templateRoute) && !("DELETE" in templatesRoute));
ok("no template write reached another company", !writes.some((w) => w.model === "servicePlanTemplate" && (w.data?.companyId === "co_2" || w.where?.id === "tpl_theirs")));

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
process.exit(0);
