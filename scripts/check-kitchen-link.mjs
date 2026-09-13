// scripts/check-kitchen-link.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-kitchen-link.mjs
//
// ── What this is guarding ───────────────────────────────────────────────────
//
// /quote/<slug>/kitchen — the public "design your own kitchen" page — existed,
// worked, and was handed out by nothing. A company that switched "Kitchen
// Design & New Installs" on had a page a stranger could draw a kitchen on and
// no screen in /app that told them its address. Three surfaces now offer it,
// and each must offer it under EXACTLY the condition the page renders on
// (companyOffersKitchenDesign: the kitchen_design service is enabled) — a link
// that 404s on a bio page is the failure the bio-link module exists to stop.
//
//   1. the bio-link page (lib/links/candidates.js) — executed here
//   2. Share your links (app/app/settings/lead-form) — source-checked
//   3. the self-quote form's kitchen step (SelfQuoteFlow) — source-checked
//
// And the slug: the page used to resolve Company.slug alone while every other
// public link is built from bookingSlug, so the link this hands out would
// have 404'd for a company whose two slugs differ.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { linkCandidates } from "@/lib/links/candidates";
import { linkLabels } from "@/lib/links/labels";
import { KITCHEN_DESIGN_KEY } from "@/lib/kitchen/key";
import { CLIENT_DOC_COPY } from "@/lib/i18n/clientDocCopy";
import { LANGUAGES } from "@/app/i18n/languages";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}
function section(title) {
  console.log(`\n${title}\n`);
}

const company = { slug: "acme", bookingSlug: "acme-kitchens", name: "Acme", defaultLanguage: "fr" };
const base = { company, site: null, activeEventTypes: 0, enabledEstimators: 0, funnels: [] };

section("The bio-link row exists only when the service is on");
const on = linkCandidates({ ...base, offersKitchenDesign: true });
const off = linkCandidates({ ...base, offersKitchenDesign: false });
const unsaid = linkCandidates({ ...base });
const kitchenOn = on.find((r) => r.key === "kitchen");
ok("service on → a kitchen row", Boolean(kitchenOn));
ok("service off → no kitchen row", !off.some((r) => r.key === "kitchen"));
ok("flag absent → no kitchen row (absence is not 'on')", !unsaid.some((r) => r.key === "kitchen"));
ok("a truthy non-boolean ('yes', 1) is not 'on' either", !linkCandidates({ ...base, offersKitchenDesign: "yes" }).some((r) => r.key === "kitchen") && !linkCandidates({ ...base, offersKitchenDesign: 1 }).some((r) => r.key === "kitchen"));
ok("the row's URL is the public designer, built from bookingSlug like every other row", kitchenOn?.url === "/quote/acme-kitchens/kitchen");
ok("the row sits under 'Get a price' with the quote form, on by default", kitchenOn?.group === "price" && kitchenOn?.defaultOn === true && kitchenOn?.kind === "internal");
ok("the label is in the company's language (fr)", kitchenOn?.label === "Concevez votre cuisine");
ok("every other row is unchanged by the flag", on.filter((r) => r.key !== "kitchen").length === off.length);
ok("the kitchen row comes after the quote form and before booking", on.findIndex((r) => r.key === "kitchen") > on.findIndex((r) => r.key === "quote"));
ok("no slug → no rows at all, kitchen included", !linkCandidates({ ...base, company: { ...company, slug: "", bookingSlug: "" }, offersKitchenDesign: true }).some((r) => r.key === "kitchen"));

section("Labels in every offered language");
for (const { code } of LANGUAGES) {
  const label = linkLabels(code).kitchenDesign;
  ok(`${code}: kitchenDesign label present`, typeof label === "string" && label.length > 0);
}
ok("the self-quote form's kitchen link copy exists in every offered language",
  LANGUAGES.every(({ code }) => typeof CLIENT_DOC_COPY[code]?.selfQuote?.designKitchen === "string" && CLIENT_DOC_COPY[code].selfQuote.designKitchen.length > 0));

section("The gate is the service, everywhere, spelled once");
ok("KITCHEN_DESIGN_KEY is the service key", KITCHEN_DESIGN_KEY === "kitchen_design");
const keyModule = read("lib/kitchen/key.js");
ok("lib/kitchen/key.js has no imports, so a client component can read it without lib/db", !/^import /m.test(keyModule));
const access = read("lib/kitchen/access.js");
ok("lib/kitchen/access.js re-exports the same constant rather than restating it", /export \{ KITCHEN_DESIGN_KEY \} from "\.\/key"/.test(access) && !/KITCHEN_DESIGN_KEY = "kitchen_design"/.test(access));
const load = read("lib/links/load.js");
ok("the bio-link loader derives the row from the enabled service keys", /offersKitchenDesign: categoryKeys\.includes\(KITCHEN_DESIGN_KEY\)/.test(load));
ok("…read once and shared with the painting-scope rule (no second query for a stranger on a phone)", /priceableEstimators\(company, categoryKeys\)/.test(load) && (load.match(/companyEnabledCategoryKeys\(/g) || []).length === 1);
const icons = read("app/components/links/linkIcons.js");
ok("the row has an icon of its own", /kitchen: Ruler/.test(icons));

section("Share your links");
const leadForm = read("app/app/settings/lead-form/page.js");
ok("reads the services list and looks for the kitchen_design service being enabled", /\/api\/settings\/service-categories/.test(leadForm) && /c\.key === KITCHEN_DESIGN_KEY && c\.enabled === true/.test(leadForm));
ok("the card renders only behind that flag", /\{kitchenOffered && \(/.test(leadForm));
ok("the URL is built from the same slug the other three cards use", /const kitchenUrl = `\$\{origin\}\/quote\/\$\{slug\}\/kitchen`/.test(leadForm));
ok("no embed snippet is promised for it (there is no embed widget)", !/embed=\{embed\("kitchen"\)\}/.test(leadForm));
ok("imports the key from the client-safe module, not lib/kitchen/access", /from "@\/lib\/kitchen\/key"/.test(leadForm) && !/lib\/kitchen\/access/.test(leadForm));

section("The self-quote form's kitchen step");
const flow = read("app/quote/[companySlug]/SelfQuoteFlow.js");
ok("offers the designer only on the Kitchen Design service", /service\.key === KITCHEN_DESIGN_KEY && \(/.test(flow));
ok("…linking to the public page under the slug the form was opened with", /href=\{`\/quote\/\$\{encodeURIComponent\(companySlug\)\}\/kitchen`\}/.test(flow));
ok("…in the document's language via clientDocCopy", /copy\.designKitchen/.test(flow));

section("The public page resolves the slug like its siblings");
const page = read("app/quote/[companySlug]/kitchen/page.js");
const api = read("app/api/self-quote/kitchen/route.js");
ok("the page uses findBookingCompany (bookingSlug first, then slug)", /findBookingCompany\(companySlug/.test(page) && !/db\.company\.findUnique/.test(page));
ok("the page still refuses a company without the service", /companyOffersKitchenDesign\(company\.id\)/.test(page));
ok("the POST uses the same resolver", /findBookingCompany\(String\(companySlug\)/.test(api));
ok("…and still refuses without the service", /e\.category\?\.key === KITCHEN_DESIGN_KEY/.test(api));

console.log(`\n${checks} checks, ${failures} failure(s).${failures ? "" : " The kitchen designer is reachable, and only where it works."}\n`);
if (failures) process.exitCode = 1;
