// scripts/check-site-seo.mjs
//
//   npm run check:site-seo
//
// The fieldquo.com site-audit work (heycatch audit, 2026-10-15), executed:
//
//   robots.txt   per host — FieldQuo's site disallows the back office, staff
//                consoles, APIs and every token page and names its sitemap; a
//                contractor's host gets no FieldQuo name and no FieldQuo
//                sitemap; a preview is not indexed. No marketing page is
//                disallowed.
//   sitemap      FieldQuo's marketing pages only — never a token page, a
//                client page, a contractor site or the back office.
//   llms.txt     names no price.
//   JSON-LD      Organization without sameAs (no profiles exist), the founder
//                as a Person; Product offers equal to the CAD figures /pricing
//                prints; FAQPage text equal to the FAQ the homepage renders.
//   FAQ          every answer is in the server HTML.
//   counter      the usage proof renders nothing below its threshold.
//   stories      every testimonial prints its material connection.
//   pricing      the "Most popular" rung is a real rung; the title carries the
//                category keyword and the yearly price, said as yearly.
//   founder      the block renders the owner's text, the photo and LinkedIn
//                when set; the footer links to it.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { db } from "@/lib/db";
import { robotsTxt, robotsSiteFor, TOKEN_AND_CLIENT_PATHS, FIELDQUO_PRIVATE_PATHS } from "@/lib/seo/robots";
import { sitemapPaths, sitemapXml, MARKETING_PAGES } from "@/lib/seo/sitemap";
import { llmsTxt } from "@/lib/seo/llmsTxt";
import { organizationLd, pricingProductLd, faqPageLd, ldJson } from "@/lib/seo/structuredData";
import { usageProof, USAGE_COUNT_THRESHOLD, runningCompanyWhere } from "@/lib/marketing/usageCount";
import { POPULAR_TIER_KEY } from "@/lib/pricing/popularTier";
import { SEAT_LADDER, defaultAnnualPrice } from "@/lib/pricing/ladder";
import { withOffers } from "@/lib/billing/promotions";
import { FOUNDER } from "@/lib/marketing/founder";
import { COMPARE_PAGES } from "@/app/(marketing)/compare/compareCopy";
import { COMPETITORS } from "@/lib/marketing/competitors";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import { MESSAGES } from "@/app/i18n/messages";
import { LANGUAGE_CODES } from "@/app/i18n/languages";
import HomePage from "@/app/(marketing)/page";
import { generateMetadata as pricingMetadata, titlePrice } from "@/app/(marketing)/pricing/page";
import PricingPage from "@/app/(marketing)/pricing/page";
import AboutContent from "@/app/(marketing)/about/AboutContent";
import CustomerStory, { CUSTOMER_STORIES } from "@/app/components/marketing/home/CustomerStory";
import ResultsResearch from "@/app/components/marketing/home/ResultsResearch";
import { FEATURED_COMPARISONS } from "@/lib/marketing/featuredComparisons";

let pass = 0;
const failures = [];
function ok(name, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
    return true;
  }
  failures.push(`${name}${detail ? `  ${detail}` : ""}`);
  console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
  return false;
}
const section = (t) => console.log(`\n${t}`);
const read = (p) => readFileSync(p, "utf8");
const render = (el, language = "en") => renderToStaticMarkup(createElement(LanguageProvider, { initialLanguage: language }, el));
const decode = (s) =>
  String(s)
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const ORIGIN = "https://www.fieldquo.com";
// Every catalogue language for presence; rendering only in the OFFERED ones —
// LanguageProvider falls back to English for a catalogue-only code (zh).
const LANGS = Object.keys(MESSAGES);
const OFFERED = LANGUAGE_CODES;

// esbuild bundles this to CommonJS, which has no top-level await.
async function main() {
console.log("\nfieldquo.com — robots, sitemap, structured data and the audit's page changes\n");

// ═══════════════════════════════════════════════════════════════════════════
section("1. robots.txt answers each host for itself");
// ═══════════════════════════════════════════════════════════════════════════
const ours = robotsTxt({ host: "www.fieldquo.com", origin: ORIGIN });
const disallows = (txt) => [...txt.matchAll(/^Disallow:\s*(\S*)$/gm)].map((m) => m[1]);
// Named here as well as read from the module, so trimming the module list
  // cannot quietly shrink what this asserts.
  for (const p of ["/app", "/platform", "/sales", "/api/", "/site/", "/q/", "/portal/", "/book/", "/visit/", "/embed/", "/w/", "/design/", "/estimate-report/", ...TOKEN_AND_CLIENT_PATHS]) {
  ok(`fieldquo.com disallows ${p}`, disallows(ours).includes(p));
}
ok("fieldquo.com names its sitemap", ours.includes(`Sitemap: ${ORIGIN}/sitemap.xml`));
ok("fieldquo.com does not disallow everything", !disallows(ours).includes("/"));
const blocked = sitemapPaths().filter((path) => disallows(ours).some((d) => d && (path === d || path.startsWith(d.endsWith("/") ? d : `${d}/`) || path === d.replace(/\/$/, ""))));
ok("no sitemap page is disallowed", blocked.length === 0, blocked.join(", "));
for (const host of ["sunset.fieldquo.com", "truefinish.fieldquo.com:443", "www.sunsetspace.ca", "sunset.localhost:3000"]) {
  const txt = robotsTxt({ host, origin: ORIGIN });
  ok(`${host}: no FieldQuo name, no FieldQuo sitemap`, !/fieldquo/i.test(txt) && !/Sitemap:/i.test(txt), txt);
  ok(`${host}: token pages disallowed, the site itself allowed`, TOKEN_AND_CLIENT_PATHS.every((p) => disallows(txt).includes(p)) && !disallows(txt).includes("/"));
  ok(`${host}: the contractor's own /book and /quote pages stay crawlable`, !disallows(txt).includes("/book") && !disallows(txt).includes("/quote/") && !disallows(txt).includes("/quote"));
}
ok("a Vercel preview is not indexed at all", /^Disallow: \/$/m.test(robotsTxt({ host: "fieldquo-abc-team.vercel.app", origin: ORIGIN })));
ok("the help centre names its own sitemap", robotsTxt({ host: "help.fieldquo.com", origin: ORIGIN }).includes("Sitemap: https://help.fieldquo.com/sitemap.xml"));
ok("hosts are classified as expected", robotsSiteFor("fieldquo.com") === "fieldquo" && robotsSiteFor("localhost:3000") === "fieldquo" && robotsSiteFor("sunset.fieldquo.com") === "tenant");
const mw = read("middleware.js");
ok("middleware's catch-all still skips extension paths (so /robots.txt reaches the host-aware route)", /\.\*\\\\\.\[a-zA-Z0-9\]\+\$/.test(mw));
ok("middleware still rewrites /sitemap.xml on tenant and help hosts", /"\/sitemap\.xml"/.test(mw));

// ═══════════════════════════════════════════════════════════════════════════
section("2. The sitemap is FieldQuo's marketing site and nothing else");
// ═══════════════════════════════════════════════════════════════════════════
const paths = sitemapPaths();
ok("home, pricing, features, compare, about are listed", ["/", "/pricing", "/features", "/compare", "/about"].every((p) => paths.includes(p)));
ok("every industry, comparison, feature and product page is listed", paths.some((p) => p.startsWith("/industries/")) && COMPARE_PAGES.every((c) => paths.includes(`/compare/${c.slug}`)) && paths.some((p) => p.startsWith("/features/")) && paths.some((p) => p.startsWith("/product/")));
const forbidden = [...TOKEN_AND_CLIENT_PATHS, ...FIELDQUO_PRIVATE_PATHS, "/help", "/q", "/portal", "/site", "/book"];
const leaked = paths.filter((p) => forbidden.some((f) => p === f.replace(/\/$/, "") || p.startsWith(f.endsWith("/") ? f : `${f}/`)));
ok("no token, client, contractor or back-office page is listed", leaked.length === 0, leaked.join(", "));
ok("no URL is listed twice", new Set(paths).size === paths.length);
const xml = sitemapXml(ORIGIN);
ok("every <loc> is absolute on FieldQuo's origin", [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].every((m) => m[1].startsWith(`${ORIGIN}/`)));
ok("the single marketing pages are all real routes", MARKETING_PAGES.every((p) => p === "/" || read(`app/(marketing)${p}/page.js`).length > 0));

// ═══════════════════════════════════════════════════════════════════════════
section("3. llms.txt");
// ═══════════════════════════════════════════════════════════════════════════
const llms = llmsTxt(ORIGIN);
ok("llms.txt names no price (prices live in the database)", !/\$\s*\d|\d+\s*(CAD|USD)/.test(llms), llms.match(/\$\s*\d[^\n]*/)?.[0]);
ok("llms.txt links pricing, features, compare and about", ["/pricing", "/features", "/compare", "/about"].every((p) => llms.includes(`${ORIGIN}${p}`)));
ok("llms.txt is only served on FieldQuo's host", /site !== "fieldquo" && site !== "preview"/.test(read("app/llms.txt/route.js")));

// ═══════════════════════════════════════════════════════════════════════════
section("4. Organization JSON-LD");
// ═══════════════════════════════════════════════════════════════════════════
const org = organizationLd(ORIGIN);
ok("Organization: FieldQuo, url, logo", org["@type"] === "Organization" && org.name === "FieldQuo" && org.url === `${ORIGIN}/` && org.logo.startsWith(ORIGIN));
ok("no sameAs on the company (no real profiles exist yet)", !("sameAs" in org));
ok("the founder is a Person with his LinkedIn as HIS sameAs", org.founder?.["@type"] === "Person" && org.founder.name === "Emilio Boves" && org.founder.sameAs?.[0] === FOUNDER.linkedinUrl);
ok("the founder's image is an absolute URL to the committed photo", org.founder?.image === `${ORIGIN}/founder/emilio-boves.jpg` && read("public/founder/emilio-boves.jpg").length > 1000);
ok("ldJson escapes < so no string can close the script", !ldJson({ a: "</script><script>" }).includes("</script>"));
ok("the marketing layout prints it, and only the marketing layout", /organizationLd\(siteOrigin\(\)\)/.test(read("app/(marketing)/layout.js")) && !/organizationLd/.test(read("app/layout.js")));

// ═══════════════════════════════════════════════════════════════════════════
section("5. /pricing: Product JSON-LD equals the cards, title, Most popular");
// ═══════════════════════════════════════════════════════════════════════════
const now = new Date("2026-10-15T12:00:00Z");
const rows = [];
for (const currency of ["CAD", "USD"]) {
  for (const t of SEAT_LADDER) {
    rows.push({
      id: `${t.tierKey}-${currency}`,
      name: t.label,
      tierKey: t.tierKey,
      currency,
      priceMonthly: t.price,
      priceAnnual: defaultAnnualPrice(t.price),
      seats: t.seats,
      crewSeats: t.crewSeats,
      maxUsers: t.seats + t.crewSeats,
      isPublic: true,
      sortOrder: t.sortOrder,
      aiCopilotEnabled: true,
    });
  }
}
db.plan = { findMany: async () => rows };
db.platformPromotion = { findMany: async () => [] };
const product = pricingProductLd({ origin: ORIGIN, plans: withOffers(rows.filter((r) => r.currency === "CAD"), { promotions: [], now }) });
const solo = SEAT_LADDER[0];
ok("every offer is in CAD", product.offers.every((o) => o.priceCurrency === "CAD"));
ok(`Solo monthly is ${solo.price}.00 CAD a month`, product.offers.some((o) => o.name.startsWith("Solo") && o.price === `${solo.price}.00` && o.priceSpecification.billingDuration === "P1M"));
ok(`Solo 1-year is ${defaultAnnualPrice(solo.price).toFixed(2)} CAD a year`, product.offers.some((o) => o.name.startsWith("Solo") && o.price === defaultAnnualPrice(solo.price).toFixed(2) && o.priceSpecification.billingDuration === "P1Y"));
ok("two offers per rung", product.offers.length === SEAT_LADDER.length * 2);
const pricingHtml = render(await PricingPage());
const ld = [...pricingHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const pageProduct = ld.find((d) => d["@type"] === "Product");
ok("/pricing prints the Product JSON-LD", Boolean(pageProduct));
const printed = decode(pricingHtml);
const yearSolo = pageProduct?.offers.find((o) => o.name.startsWith("Solo") && o.priceSpecification.billingDuration === "P1Y");
ok("the JSON-LD's Solo year-per-month is a figure the cards print", yearSolo && printed.includes(Number(yearSolo.priceSpecification.description.split(" ")[0]).toFixed(2).replace(/\.00$/, "")), yearSolo?.priceSpecification?.description);
ok("the popular rung is a real rung", SEAT_LADDER.some((t) => t.tierKey === POPULAR_TIER_KEY));
ok("exactly one card is marked popular, and it is that rung", (pricingHtml.match(/data-plan-popular="/g) || []).length === 1 && pricingHtml.includes(`data-plan-popular="${POPULAR_TIER_KEY}"`));
ok('the card says "Most popular" and "Most shops start here."', printed.includes("Most popular") && printed.includes("Most shops start here."));
ok("/pricing links the per-competitor pages", COMPARE_PAGES.filter((c) => ["jobber", "housecall_pro"].includes(c.competitorId)).every((c) => pricingHtml.includes(`href="/compare/${c.slug}"`)));
const meta = await pricingMetadata();
ok("the title carries the category and the yearly price, said as yearly", meta.title === `Field service software from ${titlePrice(82.5)}/mo billed yearly | FieldQuo`, meta.title);
ok("…and is at most 65 characters", meta.title.length <= 65, String(meta.title.length));
ok("titlePrice writes cents only when there are cents", titlePrice(82.5) === "$82.50" && titlePrice(99) === "$99");
db.plan = { findMany: async () => { throw new Error("db down"); } };
ok("with no database the title names no price", !/\$/.test((await pricingMetadata()).title));
db.plan = { findMany: async () => rows };

// ═══════════════════════════════════════════════════════════════════════════
section("6. Homepage: FAQ in the HTML, FAQPage JSON-LD equal to it, counter, stories");
// ═══════════════════════════════════════════════════════════════════════════
let companyCount = 3;
db.company = { count: async () => companyCount };
const home = render(await HomePage());
const faqLd = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).find((d) => d["@type"] === "FAQPage");
ok("the homepage prints FAQPage JSON-LD", Boolean(faqLd));
// Script bodies removed first: the JSON-LD itself contains every answer, and
// matching against it would prove nothing about what a reader sees.
const homeText = decode(home.replace(/<script[\s\S]*?<\/script>/g, ""));
const answers = (faqLd?.mainEntity || []).map((q) => q.acceptedAnswer.text);
ok("it has every FAQ question, including who FieldQuo is not for", (faqLd?.mainEntity || []).length >= 8 && faqLd.mainEntity.some((q) => /not built for/.test(q.name)));
const missing = answers.filter((a) => !homeText.includes(a));
ok("every structured answer is in the server HTML, word for word", answers.length > 0 && missing.length === 0, missing[0]);
ok("closed answers are hidden, not unmounted", (home.match(/id="faq-answer-[^"]+"[^>]*hidden=""/g) || []).length === answers.length - 1);
ok("the hero eyebrow names trades and crew size", homeText.includes(MESSAGES.en["home.hero.eyebrow"]));
ok(`below ${USAGE_COUNT_THRESHOLD} companies, no usage count renders at all`, !home.includes("data-usage-count") && !/contractors ran their business/.test(homeText));
ok("the usage proof is null below the threshold and on a bad read", usageProof(USAGE_COUNT_THRESHOLD - 1) === null && usageProof(NaN) === null && usageProof(-5) === null && usageProof(undefined) === null);
ok("…and the count at or above it", usageProof(USAGE_COUNT_THRESHOLD)?.count === USAGE_COUNT_THRESHOLD);
const shown = render(createElement(ResultsResearch, { usage: { count: 1234 } }));
ok("at the threshold the count renders, from the database's number", shown.includes("data-usage-count") && decode(shown).includes("1,234 contractors ran their business on FieldQuo in the last 30 days"));
const where = runningCompanyWhere(now);
ok("demo and test companies are never counted", where.isDemo === false && where.isTestCompany === false);
ok("no home.* sentence types a customer count", !Object.entries(MESSAGES.en).some(([k, v]) => k.startsWith("home.") && /\b150\b/.test(String(v))));
ok("testimonials sit between the five-apps section and the plans", home.indexOf("data-customer-stories") > home.indexOf(MESSAGES.en["home.why.title"].slice(0, 20)) && home.indexOf("data-customer-stories") < home.indexOf("data-home-plan"));
for (const story of CUSTOMER_STORIES) {
  ok(`${story.company}: approved, dated, connection stated`, Boolean(story.approvedBy && story.approvedOn && story.originalLanguage && "connection" in story));
  ok(`${story.company}: the material connection prints beside the quote`, !story.connection || home.includes(`data-story-connection="${story.connection}"`));
}
for (const lang of OFFERED) {
  const html = render(createElement(CustomerStory), lang);
  ok(`${lang}: the quotes stay in the words approved (lang="en"), the disclosure is translated`, CUSTOMER_STORIES.every((s) => html.includes(`lang="${s.originalLanguage}"`)) && CUSTOMER_STORIES.every((s) => !s.connection || decode(html).includes(MESSAGES[lang][`home.stories.connection.${s.connection}`])));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. /about: the founder block; the footer links to it");
// ═══════════════════════════════════════════════════════════════════════════
for (const lang of OFFERED) {
  const html = render(createElement(AboutContent), lang);
  const text = decode(html);
  const m = MESSAGES[lang];
  ok(`${lang}: heading and the four paragraphs`, ["about.founder.heading", "about.founder.p1", "about.founder.p2", "about.founder.p3", "about.founder.p4"].every((k) => m[k] && text.includes(m[k])));
  ok(`${lang}: LinkedIn opens in a new tab, noopener noreferrer, labelled`, html.includes(`href="${FOUNDER.linkedinUrl}"`) && /rel="noopener noreferrer"/.test(html) && /target="_blank"/.test(html) && html.includes(`aria-label="${m["about.founder.linkedinLabel"].replace("{name}", FOUNDER.name).replace(/'/g, "&#x27;")}"`));
  ok(`${lang}: the photo renders with its translated alt and fixed size`, html.includes(`alt="${m["about.founder.photoAlt"].replace("{name}", FOUNDER.name).replace(/'/g, "&#x27;")}"`) && html.includes(`width="${FOUNDER.photoWidth}"`) && html.includes(`height="${FOUNDER.photoHeight}"`));
}
ok('the block is anchored at id="founder"', render(createElement(AboutContent)).includes('id="founder"'));
ok("no email slot renders while none is set", FOUNDER.email !== null || !render(createElement(AboutContent)).includes("mailto:"));
const footer = read("app/components/marketing/MarketingFooter.js");
ok("the footer links to the founder block", /href:\s*"\/about#founder"/.test(footer));
ok("the footer reads the featured comparisons", /FEATURED_COMPARISONS\.map/.test(footer) && /FEATURED_COMPARISONS\.map/.test(read("app/(marketing)/pricing/PricingPlans.js")));
for (const c of FEATURED_COMPARISONS) {
  const page = COMPARE_PAGES.find((p) => p.slug === c.slug);
  ok(`featured comparison ${c.slug} is a real page with the right name`, Boolean(page) && COMPETITORS.find((x) => x.id === page.competitorId)?.name === c.name);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Every new sentence exists in every marketing language");
// ═══════════════════════════════════════════════════════════════════════════
const NEW_KEYS = Object.keys(MESSAGES.en).filter((k) =>
  /^(home\.hero\.eyebrow|home\.results\.fact\.usage|home\.faq\.notFor\.|home\.stories\.|about\.|footer\.links\.(founder|allComparisons)|pricing\.(popularNote|vsLinks)|compare\.(switch|faq)\.)/.test(k),
);
ok("the new keys were found", NEW_KEYS.length >= 35, String(NEW_KEYS.length));
for (const lang of LANGS) {
  const gaps = NEW_KEYS.filter((k) => !MESSAGES[lang][k]);
  ok(`${lang}: all ${NEW_KEYS.length} present`, gaps.length === 0, gaps.join(", "));
  const placeholderDrift = NEW_KEYS.filter((k) => {
    const want = (String(MESSAGES.en[k]).match(/\{\w+\}/g) || []).sort().join();
    const got = (String(MESSAGES[lang][k] || "").match(/\{\w+\}/g) || []).sort().join();
    return want !== got;
  });
  ok(`${lang}: placeholders match English`, placeholderDrift.length === 0, placeholderDrift.join(", "));
}
for (const extra of ["ko", "pt", "ru"]) {
  const homeSrc = read(`app/i18n/homePage/${extra}.js`);
  const compareSrc = read(`app/i18n/comparePages/${extra}.js`);
  ok(`${extra} (catalogue files not yet wired into messages.js) carries the new keys too`, NEW_KEYS.every((k) => homeSrc.includes(`"${k}"`) || compareSrc.includes(`"${k}"`)));
}

console.log("");
if (failures.length) {
  console.log(`FAILED — ${failures.length} problem(s), ${pass} passed\n`);
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log(`ALL PASS — ${pass} checks\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
