#!/usr/bin/env node
//
// scripts/check-sales-services.mjs
//
//   npm run check:sales-services
//
// The services a prospect's site lists, and the rule that nothing on the
// rep's screen names a service the evidence does not. Executed rather than
// read: every source (a JSON-LD catalogue, a WordPress REST answer, a
// sitemap, a Next.js payload, a menu) is a fixture that goes through the
// real extractor, the site-inference validator is fed a model reply that
// invents a service and is asserted to drop it, the JavaScript-shell rule
// is asserted to withhold every verdict, and the presenter, the brief and
// the call script are asserted to render the list — with the source of each
// name — rather than the JSON it is stored as.
//
// ══ Mutation-tested rules ═════════════════════════════════════════════════
//
// Two rules carry the owner's concern ("making false claims which then
// create a false interpretation of what they have"), so each is broken on
// purpose in a copy and the check asserts it notices:
//
//   · validateSiteInferences drops a service name not in the material
//   · detectCapabilities refuses every absence on a JavaScript shell
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { pathToFileURL } from "node:url";

let fail = 0;
let pass = 0;
const ok = (message, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${message}`);
  } else {
    fail++;
    console.log(`  FAIL ${message}${got === undefined ? "" : `  — got ${JSON.stringify(got)?.slice(0, 700)}`}`);
  }
  return Boolean(cond);
};
const section = (title) => console.log(`\n${title}\n`);

const services = await import("@/lib/sales/intel/servicesOffered");
const schemaFacts = await import("@/lib/sales/intel/schemaFacts");
const siteInference = await import("@/lib/sales/intel/siteInference");
const inferenceKinds = await import("@/lib/sales/inferenceKinds");
const capabilityDetect = await import("@/lib/sales/intel/capabilityDetect");
const technology = await import("@/lib/sales/intel/technology");
const prospectView = await import("@/lib/sales/prospectView");
const brief = await import("@/lib/sales/intel/brief");
const callScript = await import("@/lib/sales/intel/callScript");
const html = await import("@/lib/sales/crawl/html");
const evidenceMod = await import("@/lib/sales/crawl/evidence");
const structured = await import("@/lib/sales/crawl/structured");
const sitemapMod = await import("@/lib/sales/crawl/sitemap");
const { handleAnalyzeCapabilities } = await import("@/lib/sales/pipeline/handlers/analyzeCapabilities");

// ════════════════════════════════════════════════════════════════════════════
section("1. Each source, through the real extractor, becomes cited rows");

const AT = "2026-09-14T10:00:00.000Z";
const rowsOf = (pages, structuredSources = null) =>
  evidenceMod.crawlEvidence(pages, structuredSources).map((r, i) => ({ ...r, id: `e${i}`, observedAt: AT }));

// A JSON-LD site: the business, its catalogue, a stray Offer.
const LD_HOME = `<html><head><title>Roy Plumbing</title>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Plumber",
  name: "Roy Plumbing",
  telephone: "+1 716 555 0100",
  hasOfferCatalog: { "@type": "OfferCatalog", name: "Services", itemListElement: [
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "Drain Cleaning" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "Water Heater Installation" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "Contact Us" } },
  ] },
})}</script></head><body><nav><a href="/">Home</a><a href="/about">About</a><a href="/sump-pumps">Sump Pumps</a><a href="/contact">Contact</a></nav>
<h1>Plumbers in Buffalo</h1><h2>Sewer Line Repair</h2><h2>Why choose Roy Plumbing</h2><p>${"We fix pipes. ".repeat(30)}</p></body></html>`;
{
  const page = html.extractPage({ html: LD_HOME, finalUrl: "https://roy.example/", status: 200 });
  page.navLinks = (await import("@/lib/sales/crawl/url")).serviceMenu({ links: page.links, baseHost: "roy.example" });
  const rows = rowsOf([page]);
  const found = services.servicesFrom({ evidence: rows });
  const names = found.services.map((s) => `${s.name}|${s.source}`);
  ok("the JSON-LD catalogue's services are read, by name, source schema", names.includes("Drain Cleaning|schema") && names.includes("Water Heater Installation|schema"), names);
  ok("…a chrome label inside the catalogue is refused", !names.some((n) => /Contact Us/.test(n)));
  ok("the menu's service link is read, source menu", names.includes("Sump Pumps|menu"), names);
  ok("…and About / Contact are not services", !names.some((n) => /About|Contact/.test(n)));
  ok("a trade-shaped h2 is read, source page_heading", names.includes("Sewer Line Repair|page_heading"), names);
  ok("…a sentence-shaped h2 is not", !names.some((n) => /Why choose/.test(n)));
  ok("each name cites the row it came from", found.services.every((s) => s.evidenceId && rows.some((r) => r.id === s.evidenceId)));
  ok("…with the page it was seen on", found.services.every((s) => s.sourceUrl === "https://roy.example/"));
  ok("a keyword maps a name to the trade vocabulary, and a name without one stays unmapped", found.services.find((s) => s.name === "Water Heater Installation").tradeKey === "plumbing" && found.services.find((s) => s.name === "Drain Cleaning").tradeKey === null);
  ok("schema outranks the menu, the menu outranks a heading", found.services.findIndex((s) => s.source === "schema") < found.services.findIndex((s) => s.source === "menu") && found.services.findIndex((s) => s.source === "menu") < found.services.findIndex((s) => s.source === "page_heading"));
}

// A WordPress REST answer and a services post type.
{
  const wp = [
    { url: "https://roy.example/wp-json/wp/v2/pages?per_page=50&_fields=id,link,title,excerpt", status: 200, error: null, type: "page", pages: structured.parseWpPages(JSON.stringify([
      { id: 1, link: "https://roy.example/services/backflow-testing/", title: { rendered: "Backflow Testing" }, excerpt: { rendered: "" } },
      { id: 2, link: "https://roy.example/privacy-policy/", title: { rendered: "Privacy Policy" }, excerpt: { rendered: "" } },
      { id: 3, link: "https://roy.example/our-story/", title: { rendered: "Our Story" }, excerpt: { rendered: "" } },
      { id: 4, link: "https://roy.example/faq/", title: { rendered: "Why plumbing costs what it costs" }, excerpt: { rendered: "" } },
    ]), { baseHost: "roy.example" }).pages },
    { url: "https://roy.example/wp-json/wp/v2/services?per_page=50&_fields=id,link,title,excerpt", status: 200, error: null, type: "services", pages: structured.parseWpPages(JSON.stringify([
      { id: 9, link: "https://roy.example/service/gas-lines/", title: { rendered: "Gas Lines" }, excerpt: { rendered: "" } },
    ]), { baseHost: "roy.example" }).pages },
  ];
  const rows = rowsOf([], { sitemaps: [], sitemapPages: [], wp });
  ok("wp_page rows are written for every REST page, under 1 KB each", rows.filter((r) => r.type === "wp_page").length === 5 && rows.filter((r) => r.type === "wp_page").every((r) => r.rawValue.length <= 1024));
  const names = services.servicesFrom({ evidence: rows }).services.map((s) => `${s.name}|${s.source}`);
  ok("a page under /services/ is a service", names.includes("Backflow Testing|wp"), names);
  ok("every item of a services post type is a service, whatever its path", names.includes("Gas Lines|wp"), names);
  ok("Privacy Policy, Our Story and a sentence-titled page are not", names.length === 2, names);
}

// A sitemap.
{
  const xml = `<urlset><url><loc>https://roy.example/</loc></url><url><loc>https://roy.example/services/leak-detection/</loc></url><url><loc>https://roy.example/epoxy-flooring/</loc></url>
<url><loc>https://roy.example/team/</loc></url><url><loc>https://roy.example/blog/2024/05/pipes/</loc></url><url><loc>https://roy.example/reviews/</loc></url><url><loc>https://roy.example/gallery/kitchen/</loc></url><url><loc>https://roy.example/services/</loc></url></urlset>`;
  const parsed = sitemapMod.parseSitemap(xml);
  const pages = sitemapMod.sitemapPages(parsed.urls, { baseHost: "roy.example" }).map((p) => ({ ...p, sourceUrl: "https://roy.example/sitemap.xml" }));
  const rows = rowsOf([], { sitemaps: [{ url: "https://roy.example/sitemap.xml", status: 200, error: null, kind: "urlset", urls: parsed.urls.length }], sitemapPages: pages, wp: [] });
  ok("sitemap_url rows carry the path as the key and the URL as the value", rows.filter((r) => r.type === "sitemap_url").every((r) => r.normalizedValue.startsWith("/") && r.rawValue.startsWith("https://")));
  const named = services.servicesFrom({ evidence: rows }).services.map((s) => `${s.name}|${s.source}`);
  ok("/services/leak-detection is a service, named from its slug", named.includes("Leak Detection|sitemap"), named);
  ok("/epoxy-flooring is one — a trade word in the last segment", named.includes("Epoxy Flooring|sitemap"), named);
  ok("/team, /reviews, /services itself, a gallery album and a post are not", named.length === 2, named);
  ok("the structured_source row records the file and its status", rows.some((r) => r.type === "structured_source" && r.normalizedValue === "sitemap:http_200"));
}

// A Next.js payload: the copy is recovered, and only trade-shaped short
// lines of it become services.
{
  const payload = JSON.stringify({ props: { pageProps: { blocks: [{ heading: "Sewer Line Replacement" }, { heading: "Call us today for a free quote on your project" }, { body: "Serving Buffalo and the Southtowns since two thousand and four" }] } } });
  const page = html.extractPage({ html: `<script src="/_next/static/chunks/main.js"></script><script id="__NEXT_DATA__" type="application/json">${payload}</script><div id="__next"></div>`, finalUrl: "https://roy.example/", status: 200 });
  const rows = rowsOf([page]);
  ok("a rendered_text row is written for the payload's copy", rows.some((r) => r.type === "rendered_text" && /Sewer Line Replacement/.test(r.rawValue)));
  const named = services.servicesFrom({ evidence: rows }).services.map((s) => `${s.name}|${s.source}`);
  ok("a trade-shaped payload line is a service, source rendered_text", named.includes("Sewer Line Replacement|rendered_text"), named);
  ok("…the sentence and the prose are not", named.length === 1, named);
}

// Latest crawl only, and the cap.
{
  const old = { id: "o1", type: "nav_link", rawValue: "Old Service", normalizedValue: "/old", sourceUrl: "https://roy.example/", observedAt: "2026-08-01T00:00:00.000Z" };
  const now = { id: "n1", type: "nav_link", rawValue: "New Service", normalizedValue: "/new", sourceUrl: "https://roy.example/", observedAt: AT };
  const named = services.servicesFrom({ evidence: [old, now] }).services.map((s) => s.name);
  ok("only the latest crawl's menu counts — a service dropped since last month is not on offer", JSON.stringify(named) === JSON.stringify(["New Service"]), named);
  const many = Array.from({ length: 60 }, (_, i) => ({ id: `m${i}`, type: "nav_link", rawValue: `Service ${i}`, normalizedValue: `/s${i}`, sourceUrl: "https://roy.example/", observedAt: AT }));
  ok("the list is capped at MAX_SERVICES", services.servicesFrom({ evidence: many }).services.length === services.MAX_SERVICES);
  ok("a duplicate name across sources is one entry, the first source winning", services.servicesFrom({ evidence: [
    { id: "a", type: "sitemap_url", rawValue: "https://roy.example/services/drain-cleaning", normalizedValue: "/services/drain-cleaning", sourceUrl: "https://roy.example/sitemap.xml", observedAt: AT },
    { id: "b", type: "nav_link", rawValue: "Drain  Cleaning", normalizedValue: "/drains", sourceUrl: "https://roy.example/", observedAt: AT },
  ] }).services.map((s) => `${s.name}|${s.source}`).join() === "Drain Cleaning|menu");
  ok("hostile rows yield nothing and no throw", services.servicesFrom({ evidence: [null, 1, { type: "wp_page", rawValue: "{not json" }, { type: "schema_org", rawValue: "[" }, { type: "sitemap_url", normalizedValue: "javascript:alert(1)" }] }).services.length === 0);
  ok("the stored value round-trips", services.parseServicesValue(services.servicesValue([{ name: "A", source: "menu", sourceUrl: "https://x/", tradeKey: null, confidence: 0.8 }]))[0].name === "A" && inferenceKinds.servicesNamesFromValue(services.servicesValue([{ name: "A", source: "menu" }, { name: "B", source: "wp" }])).join() === "A,B");
  ok("…and anything else parses to an empty list", services.parseServicesValue("SMALL_BUSINESS").length === 0 && inferenceKinds.servicesNamesFromValue(null).length === 0);
}

// ════════════════════════════════════════════════════════════════════════════
section("2. The model may name only what the evidence names");

{
  const inputs = siteInference.siteInferenceInputs({
    prospect: { businessName: "Roy Plumbing", tradeKey: "plumbing", city: "Buffalo", province: "NY" },
    pages: [{ url: "https://roy.example/", text: "Roy Plumbing fixes drains and installs water heaters across Buffalo. Call for sump pump service." }],
    services: ["Drain Cleaning", "Water Heater Installation"],
  });
  const prompt = siteInference.siteInferencePrompt(inputs);
  ok("the prompt carries the evidence-cited list under SERVICES THEY LIST", /SERVICES THEY LIST/.test(prompt) && /Drain Cleaning, Water Heater Installation/.test(prompt));
  ok("…and tells the model not to add a service that is not in the evidence", /do not add a service that is not in the evidence/.test(prompt));
  ok("…and the services_offered rule says an unlisted name is thrown away", /services_offered: .*thrown away/.test(prompt));
  ok("the services list is in the hash, so a newly read menu re-reads", siteInference.siteInferenceInputHash(inputs) !== siteInference.siteInferenceInputHash(siteInference.siteInferenceInputs({ prospect: { businessName: "Roy Plumbing" }, pages: inputs.pages, services: [] })));
  ok("the kind list has eleven entries and services_offered is the eleventh, with a label", inferenceKinds.SITE_INFERENCE_KINDS.length === 11 && inferenceKinds.SITE_INFERENCE_KINDS[10] === "services_offered" && inferenceKinds.SITE_INFERENCE_LABELS.services_offered === "Services offered");
  ok("the schema's kind enum is the closed list", JSON.stringify(siteInference.siteInferenceSchema().properties.inferences.items.properties.kind.enum) === JSON.stringify([...inferenceKinds.SITE_INFERENCE_KINDS]));
  ok("the prompt version moved to 2", siteInference.SITE_INFERENCE_VERSION === "2");

  const sources = siteInference.siteInferenceSources(inputs);
  ok("the list line is material a quote can be checked against", sources.some((s) => s.url === "services" && s.text === "Drain Cleaning, Water Heater Installation"));

  const reply = {
    inferences: [
      // Two names from the list, one from the page text, one invented.
      { kind: "services_offered", value: "Drain cleaning, water heater installation, sump pump service, siding", quote: "Drain Cleaning, Water Heater Installation", sourceUrl: "services", confidence: "high" },
      { kind: "emphasis", value: "drains and water heaters", quote: "fixes drains and installs water heaters", sourceUrl: "https://roy.example/", confidence: "medium" },
    ],
  };
  const { kept, dropped } = siteInference.validateSiteInferences(reply, sources);
  const svc = kept.find((k) => k.kind === "services_offered");
  ok("the names in the evidence are kept, case-insensitively", svc && /Drain cleaning/.test(svc.value) && /water heater installation/.test(svc.value), svc);
  ok("…a name from the page text is kept too", svc && /sump pump service/.test(svc.value), svc);
  ok("…and the invented one is DROPPED from the value", svc && !/siding/.test(svc.value), svc);
  ok("…with the dropped name reported", svc && JSON.stringify(svc.droppedNames) === JSON.stringify(["siding"]), svc);
  ok("the other kind is untouched", kept.some((k) => k.kind === "emphasis") && dropped.length === 0, { kept, dropped });

  const invented = siteInference.validateSiteInferences({ inferences: [{ kind: "services_offered", value: "Roofing, siding, gutters", quote: "Drain Cleaning, Water Heater Installation", sourceUrl: "services", confidence: "high" }] }, sources);
  ok("a value with NO name in the evidence is dropped whole, with its reason", invented.kept.length === 0 && invented.dropped[0]?.reason === "service_not_in_evidence" && JSON.stringify(invented.dropped[0].names) === JSON.stringify(["Roofing", "siding", "gutters"]), invented);
  ok("…and the reason is on the closed list", Boolean(siteInference.DROP_REASONS.service_not_in_evidence));
  const accents = siteInference.servicesInMaterial(["Réparation de toiture", "PEINTURE"], [{ url: "x", text: "Reparation de Toiture et peinture intérieure" }]);
  ok("the substring check folds accents and case", accents.kept.length === 2 && accents.dropped.length === 0, accents);
  ok("splitServiceNames handles commas, semicolons, ampersands and 'and'", JSON.stringify(siteInference.splitServiceNames("Drains; water heaters & sump pumps, and gas lines")) === JSON.stringify(["Drains", "water heaters", "sump pumps", "gas lines"]));

  // Mutation: remove the fence and the invented name survives.
  const src = readFileSync("lib/sales/intel/siteInference.js", "utf8");
  const mutated = src.replace("const checked = servicesInMaterial(names, sources);", "const checked = { kept: names, dropped: [] };");
  ok("the fence is where the check thinks it is", mutated !== src);
  const tmp = "lib/sales/intel/.siteInference.mutant.js";
  writeFileSync(tmp, mutated);
  try {
    const mutant = await import(pathToFileURL(tmp).href);
    const r = mutant.validateSiteInferences(reply, sources);
    ok("MUTATION: without the fence the invented service would reach the row — so the fence is load-bearing", /siding/.test(r.kept.find((k) => k.kind === "services_offered")?.value || ""), r.kept);
  } finally {
    unlinkSync(tmp);
  }
}

// ════════════════════════════════════════════════════════════════════════════
section("3. A JavaScript shell withholds every verdict, and says why");

{
  const shell = { url: "https://roy.example/", finalUrl: "https://roy.example/", status: 200, text: "Loading…", links: ["https://roy.example/#main"], scripts: ["https://roy.example/_next/static/chunks/main-abc.js"], linkCount: 1 };
  const det = capabilityDetect.detectCapabilities({ crawl: [shell], technologies: [], prospect: { websiteUrl: "https://roy.example/" } });
  ok("the crawl is a js_shell", det.rendered === "js_shell" && det.eligibility.reason === "js_shell" && det.eligibility.shells === 1, det.eligibility);
  ok("WEBSITE is true — a modern site is not a missing one — citing the shell", det.capabilities.find((c) => c.code === "WEBSITE").value === true && det.capabilities.find((c) => c.code === "WEBSITE").evidence[0].normalizedValue === "WEBSITE:js_shell");
  const rest = det.capabilities.filter((c) => c.code !== "WEBSITE");
  ok("every other capability is null", rest.every((c) => c.value === null), rest.map((c) => `${c.code}=${c.value}`));
  ok("…each citing one crawl_quality row with the sentence", rest.every((c) => c.evidence.length === 1 && c.evidence[0].type === capabilityDetect.CRAWL_QUALITY_EVIDENCE && c.evidence[0].rawValue.startsWith("site is rendered by JavaScript; we could not read it") && c.evidence[0].sourceUrl === "https://roy.example/"));
  ok("a server-rendered Next.js page with a full body and forty links is NOT a shell", capabilityDetect.jsShell(technology.normalisePage({ ...shell, text: "x".repeat(2000), links: Array.from({ length: 40 }, (_, i) => `https://roy.example/p${i}`), linkCount: 40 })) === null);
  ok("a thin page with no framework marker is not a shell either", capabilityDetect.jsShell(technology.normalisePage({ url: "https://roy.example/", status: 200, text: "Hi", links: [], scripts: ["https://roy.example/jquery.js"], linkCount: 0 })) === null);
  ok("an empty-bodied 200 with a bundle IS a shell, though normalisePage marks it not-ok", capabilityDetect.jsShell(technology.normalisePage({ url: "https://roy.example/", status: 200, text: "", links: [], scripts: ["https://roy.example/_nuxt/entry.js"], linkCount: 0 }))?.marker === "nuxt");
  ok("a hydration attribute is a marker too", capabilityDetect.jsShell(technology.normalisePage({ url: "https://roy.example/", status: 200, text: "Hi", links: [], scripts: [], domAttrs: ["data-reactroot="], linkCount: 0 }))?.marker === "react");

  // Recovered copy: presence may be read, absence may not.
  const recovered = { ...shell, renderedText: "Call (716) 555-0100 today.\nMon-Fri 8:00am - 5:00pm\nEmail info@roy.example for a quote" };
  const det2 = capabilityDetect.detectCapabilities({ crawl: [recovered], technologies: [], prospect: {} });
  ok("recovered copy proves a phone, hours and an email", ["PHONE_CONTACT", "PUBLISHED_HOURS", "EMAIL_CONTACT"].every((code) => det2.capabilities.find((c) => c.code === code).value === true), det2.capabilities.map((c) => `${c.code}=${c.value}`));
  ok("…and still proves nothing absent", det2.capabilities.every((c) => c.value !== false) && det2.pagesRecovered === 1);

  // A shell beside two rendered pages still vetoes absence.
  const rendered = (url) => ({ url, finalUrl: url, status: 200, via: "sitemap", navMatch: "contact", text: "x".repeat(600), links: [`${url}#a`, `${url}#b`, `${url}#c`], linkCount: 3, forms: [{ action: "/send", method: "post", fields: [{ name: "email", type: "email" }, { name: "message", type: "textarea", tag: "textarea" }] }] });
  const det3 = capabilityDetect.detectCapabilities({ crawl: [shell, rendered("https://roy.example/contact/"), rendered("https://roy.example/about/")], technologies: [], prospect: {} });
  ok("with a shell in the crawl, two rendered pages prove presence (the form) and no absence", det3.capabilities.find((c) => c.code === "LEAD_CAPTURE_FORM").value === true && det3.capabilities.every((c) => c.value !== false));

  // Mutation: remove the shell gate and the absences come back.
  const src = readFileSync("lib/sales/intel/capabilityDetect.js", "utf8");
  const mutated = src.replace('if (shells.length > 0) return deny("js_shell");', "");
  ok("the gate is where the check thinks it is", mutated !== src);
  const tmp = "lib/sales/intel/.capabilityDetect.mutant.js";
  writeFileSync(tmp, mutated);
  try {
    const mutant = await import(pathToFileURL(tmp).href);
    const r = mutant.detectCapabilities({ crawl: [shell, rendered("https://roy.example/contact/"), rendered("https://roy.example/about/")], technologies: [], prospect: {} });
    ok("MUTATION: without the gate a shell beside two pages would write false — the gate is load-bearing", r.capabilities.some((c) => c.value === false), r.capabilities.map((c) => `${c.code}=${c.value}`));
  } finally {
    unlinkSync(tmp);
  }

  // Every verdict cites what it rests on.
  const full = capabilityDetect.detectCapabilities({ crawl: [rendered("https://roy.example/"), rendered("https://roy.example/contact/")], technologies: [], prospect: {} });
  ok("on a normal crawl every verdict — true, false or null — cites at least one row", full.capabilities.every((c) => c.evidence.length >= 1), full.capabilities.map((c) => `${c.code}=${c.value}:${c.evidence.length}`));
  ok("…every row with a sourceUrl", full.capabilities.every((c) => c.evidence.every((e) => e.sourceUrl)));
  ok("…and a false names the pages searched", /roy\.example\/contact/.test(full.capabilities.find((c) => c.code === "ONLINE_BOOKING").evidence[0].rawValue));
}

// ════════════════════════════════════════════════════════════════════════════
section("4. The rep sees the list, its sources, and where each verdict was seen");

{
  const value = services.servicesValue([
    { name: "Drain Cleaning", source: "schema", sourceUrl: "https://roy.example/", tradeKey: null, confidence: 0.85 },
    { name: "Sump Pumps", source: "menu", sourceUrl: "https://roy.example/", tradeKey: "plumbing", confidence: 0.8 },
    { name: "Leak Detection", source: "sitemap", sourceUrl: "https://roy.example/services/leak-detection", tradeKey: null, confidence: 0.6 },
  ]);
  const inferences = [
    { kind: "services", value, evidenceIds: ["e1"], source: "derived", confidence: 0.85 },
    { kind: "trade", value: "plumbing", evidenceIds: ["e1"], source: "derived", confidence: 0.9 },
  ];
  const evidence = [
    { id: "e1", type: "schema_org", sourceUrl: "https://roy.example/", normalizedValue: "plumber", rawValue: "{}" },
    { id: "e2", type: "link", sourceUrl: "https://roy.example/contact/", normalizedValue: "ONLINE_BOOKING:booking_path", rawValue: "https://roy.example/book-online" },
    { id: "e3", type: "crawl_quality", sourceUrl: "https://roy.example/", normalizedValue: "ONLINE_PAYMENT:withheld:js_shell", rawValue: "site is rendered by JavaScript; we could not read it" },
    { id: "e4", type: "page_content", sourceUrl: "https://roy.example/", normalizedValue: "LIVE_CHAT:absent", rawValue: "no LIVE_CHAT signal on 2 rendered page(s): https://roy.example/, https://roy.example/contact/" },
    { id: "e5", type: "nav_link", sourceUrl: "https://roy.example/", normalizedValue: "/old-menu", rawValue: "Old Menu Item", observedAt: AT },
  ];
  const capabilities = [
    { code: "ONLINE_BOOKING", value: true, confidence: 0.65, evidenceIds: ["e2"] },
    { code: "ONLINE_PAYMENT", value: null, confidence: 0, evidenceIds: ["e3"] },
    { code: "LIVE_CHAT", value: false, confidence: 0.7, evidenceIds: ["e4"] },
  ];
  const view = prospectView.prospectView({ prospect: { id: "p1", businessName: "Roy Plumbing" }, capabilities, inferences, evidence });
  const fact = view.facts.find((f) => f.key === "servicesListed");
  ok("the services fact row is rendered, keyed, with the names as a param", fact && fact.textKey === "app.salesIntel.fact.servicesListed.value" && fact.params.count === 3 && fact.params.names === "Drain Cleaning, Sump Pumps, Leak Detection", fact);
  ok("…its English names the sources", /Lists 3 services on its site \(from its structured data, menu, sitemap\)/.test(fact.text), fact.text);
  ok("…its detail says where each name came from", /Drain Cleaning — structured data \(\/\); Sump Pumps — menu \(\/\); Leak Detection — sitemap \(\/services\/leak-detection\)/.test(fact.detail), fact.detail);
  ok("…and the menu fact is not ALSO shown", !view.facts.some((f) => f.key === "serviceMenu"));
  ok("the stored JSON string is nowhere on the screen — the names travel as data", !JSON.stringify(view).includes(JSON.stringify(value)) && !view.facts.some((f) => /^\[\{/.test(f.text)));
  ok("the services row is not in the inference list (it would refuse its own digits)", !view.inferences.some((i) => i.kind === "services") && view.inferences.some((i) => i.kind === "trade"));
  ok("without the row, the menu fact still shows", prospectView.prospectView({ prospect: { id: "p1" }, capabilities: [], inferences: [], evidence }).facts.some((f) => f.key === "serviceMenu"));

  const booking = view.capabilities.find((c) => c.code === "ONLINE_BOOKING");
  ok("a true verdict says where it was seen", booking.state === "has" && JSON.stringify(booking.seenOn) === JSON.stringify(["/contact"]) && /Seen on \/contact\./.test(booking.detail), booking);
  const payment = view.capabilities.find((c) => c.code === "ONLINE_PAYMENT");
  ok("a null withheld for js_shell says the site is drawn by JavaScript", payment.state === "unknown" && payment.withheld === "js_shell" && /drawn by JavaScript/.test(payment.detail), payment);
  const chat = view.capabilities.find((c) => c.code === "LIVE_CHAT");
  ok("a false names the pages searched", chat.state === "gap" && /We looked at the pages that rendered \(\/\) and this was not on any of them/.test(chat.detail), chat.detail);
  ok("the kind is spelled once, in inferenceKinds.js", inferenceKinds.SERVICES_INFERENCE_KIND === "services" && services.SERVICES_INFERENCE_KIND === "services");

  const b = brief.composeBrief({ prospect: { id: "p1", businessName: "Roy Plumbing" }, inferences });
  const line = b.known.find((k) => k.id === "services");
  ok("the brief carries one known line with the names, citing the row", line && line.detail === "Drain Cleaning, Sump Pumps, Leak Detection" && line.layer === "inference" && JSON.stringify(line.evidenceIds) === JSON.stringify(["e1"]), line);
  ok("…and no gap line when there is no row", !brief.composeBrief({ prospect: { id: "p1", businessName: "X" }, inferences: [] }).unknown.some((u) => u.id === "services"));

  const inputs = callScript.callScriptInputs({ prospect: { id: "p1", businessName: "Roy Plumbing" }, brief: b, inferences, pages: [], repName: "Ana" });
  ok("the call-script prompt gets the names, not the JSON", inputs.inferences.some((l) => l === "services they list: Drain Cleaning, Sump Pumps, Leak Detection") && !inputs.inferences.some((l) => /\[\{/.test(l)), inputs.inferences);

  const messages = readFileSync("app/i18n/appMessages.js", "utf8");
  for (const key of ["app.salesIntel.fact.servicesListed.label", "app.salesIntel.fact.servicesListed.value", "app.salesIntel.kind.services_offered"]) {
    const n = (messages.match(new RegExp(`^\\s*"${key.replace(/\./g, "\\.")}": "`, "gm")) || []).length;
    ok(`${key} is translated in all nine languages`, n === 9, n);
  }
  ok("…and the value key carries both params in every language", (messages.match(/"app\.salesIntel\.fact\.servicesListed\.value": "[^"]*\{count\}[^"]*\{names\}[^"]*"/g) || []).length === 9);
}

// ════════════════════════════════════════════════════════════════════════════
section("5. The handler writes the row, cited, and never from a listing");

{
  const evidenceRows = [
    { id: "x1", type: "nav_link", rawValue: "Sump Pumps", normalizedValue: "/sump-pumps", sourceUrl: "https://roy.example/", observedAt: AT },
    { id: "x2", type: "sitemap_url", rawValue: "https://roy.example/services/leak-detection", normalizedValue: "/services/leak-detection", sourceUrl: "https://roy.example/sitemap.xml", observedAt: AT },
  ];
  const stub = ({ listing = false } = {}) => {
    const written = { inferences: [], evidence: [] };
    const tx = {
      prospectEvidence: { deleteMany: async () => ({ count: 0 }), create: async ({ data }) => { written.evidence.push(data); return { id: `w${written.evidence.length}` }; } },
      prospectCapability: { upsert: async ({ create }) => create },
      prospectInference: { upsert: async ({ create }) => { written.inferences.push(create); return create; } },
      prospect: { updateMany: async () => ({ count: 0 }) },
    };
    const page = { url: "https://roy.example/", finalUrl: "https://roy.example/", status: 200, text: `${listing ? "Find a Provider List Your Business Member Login " : ""}${"Plumbers in Buffalo. ".repeat(40)}`, links: ["https://roy.example/a", "https://roy.example/b", "https://roy.example/c", ...(listing ? [{ href: "/find", url: "https://roy.example/find", text: "Find a Provider" }, { href: "/list", url: "https://roy.example/list", text: "List Your Business" }, { href: "/login", url: "https://roy.example/login", text: "Member Login" }] : [])], linkCount: 6 };
    return {
      written,
      prospect: { findUnique: async () => ({ id: "p1", websiteUrl: "https://roy.example/", businessName: "Roy Plumbing", tradingNames: [], hasWebsite: true }), count: async () => 0 },
      prospectTechnology: { findMany: async () => [] },
      prospectCapability: { findMany: async () => [] },
      prospectInference: { findUnique: async () => null, upsert: async ({ create }) => { written.inferences.push(create); return create; } },
      prospectEvidence: { findMany: async ({ where }) => (where?.type?.in?.includes("nav_link") ? evidenceRows : []) },
      __page: page,
      $transaction: async (fn) => fn(tx),
    };
  };
  const db = stub();
  const result = await handleAnalyzeCapabilities({ task: { prospectId: "p1" }, payload: { prospectId: "p1", pages: [db.__page] }, db });
  const row = db.written.inferences.find((i) => i.kind === "services");
  ok("ANALYZE_CAPABILITIES writes the services inference", result.done && row, { result, row });
  ok("…value is the cited list, evidenceIds the rows, modelVersion the detector", row && inferenceKinds.servicesNamesFromValue(row.value).join() === "Sump Pumps,Leak Detection" && JSON.stringify(row.evidenceIds) === JSON.stringify(["x1", "x2"]) && row.modelVersion === "services/1", row);
  ok("…and the note says so", /2 service\(s\) listed \(menu 1, sitemap 1\)/.test(result.note), result.note);

  const listingDb = stub({ listing: true });
  const r2 = await handleAnalyzeCapabilities({ task: { prospectId: "p1" }, payload: { prospectId: "p1", pages: [listingDb.__page] }, db: listingDb });
  ok("on a directory the menu is the directory's: no services row is written", /directory/.test(r2.note) && !listingDb.written.inferences.some((i) => i.kind === "services"), r2.note);

  const src = readFileSync("lib/sales/pipeline/handlers/analyzeCapabilities.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  ok("the write is gated on corroboration and not-a-listing", /allowed: identity\.corroborated && !listing/.test(src));
  ok("…and writes nothing when nothing was found (rule 5)", /if \(!found\.services\.length\) return \{ count: 0/.test(src));
  ok("the version bump is recorded on the crawl detector (3) and the capability detector (4)", evidenceMod.CRAWL_DETECTOR_VERSION === "3" && capabilityDetect.CAPABILITY_DETECTOR_VERSION === "4");
  ok("the content-hash version was NOT bumped", (await import("@/lib/sales/crawl/fingerprint")).CONTENT_HASH_VERSION === "crawl-v1");
  ok("schemaFacts is imported by the detector, so JSON-LD is read and not only regexed", /from "\.\/schemaFacts"/.test(readFileSync("lib/sales/intel/capabilityDetect.js", "utf8")) && schemaFacts.schemaFacts({ schema: ['{"@type":"Plumber","telephone":"1"}'] }).telephone[0] === "1");
  ok("the docs name the new evidence types", /sitemap_url/.test(readFileSync("docs/sales-intel/CRAWLING.md", "utf8")) && /rendered_text/.test(readFileSync("docs/sales-intel/CRAWLING.md", "utf8")));
  ok("package.json runs this check", /"check:sales-services"/.test(readFileSync("package.json", "utf8")));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
