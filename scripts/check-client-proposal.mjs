// scripts/check-client-proposal.mjs
//
// The client proposal — the mini-site a quote link opens (app/q/[token]),
// the company content behind it, the document library and waivers
// (client mockup §1–§3, 2026-09-21) — held to the rules that matter:
//
//   1. A section with nothing behind it is omitted, whatever the switches
//      say; a quote can switch a section off; null follows the company.
//   2. No day plan is invented: no hours → null, no crew size → null; with
//      both, the parts are spread across days honestly.
//   3. A waiver signature is REFUSED when any acknowledgement is unticked,
//      and the hash changes when the text is edited afterwards.
//   4. An expired document is hidden from clients, and the client
//      projection carries no id and no expiry date.
//   5. Contrast ≥ 4.5:1 for every text/background pairing the page uses,
//      across hostile brand colours (white, black, yellow, mid grey…).
//   6. Nothing client-facing says "FieldQuo".
//   7. The gallery is one: every reader goes through lib/company/gallery.js.
//
// By EXECUTING the pure modules against fixtures (lib/proposal/sections.js,
// lib/company/documents.js, lib/waivers/signing.js, lib/company/gallery.js's
// sanitisers, lib/documents/theme.js), then reading source for the wiring
// that cannot be executed without a database.
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-client-proposal.mjs

import { readFileSync } from "node:fs";
import {
  PROPOSAL_SECTION_KEYS,
  resolveProposalSections,
  renderedSectionKeys,
  sanitisePresentation,
  sanitiseCompanySections,
  dayPlan,
  paintSpec,
} from "@/lib/proposal/sections";
import {
  isExpired,
  clientVisibleDocuments,
  presentDocument,
  sanitiseWaiverBody,
  waiverIsSignable,
} from "@/lib/company/documents";
import { buildWaiverSignature, verifyWaiverSignature, hashWaiver, coveredAcknowledgements, newWaiverToken } from "@/lib/waivers/signing";
import { sanitiseGalleryPair, sitePairsOf, galleryAsEmailPairs, galleryAsSitePairs } from "@/lib/company/gallery";
import { documentTheme, fillPair, washPair, ruleColor } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";
import { CLIENT_DOC_COPY } from "@/lib/i18n/clientDocCopy";
import { SETUP_STEPS } from "@/lib/setupSteps";
import { workFromGroups } from "@/lib/proposal/load";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ok   ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);
const section = (title) => console.log(`\n${title}\n`);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

// ═══════════════════════════════════════════════════════════════════════════
section("1. Sections: omitted when empty, off per quote, null follows the company");

const FULL = { about: true, beforeAfter: 3, documents: 2, testimonials: 4, services: 5 };
{
  const r = resolveProposalSections({ company: {}, quote: null, content: FULL });
  ok("every section with content and no settings renders", PROPOSAL_SECTION_KEYS.every((k) => r[k].rendered));
  const empty = resolveProposalSections({ company: {}, quote: { presentation: { sections: { about: true } } }, content: {} });
  ok("nothing behind any section → none rendered, even switched on", renderedSectionKeys(empty).length === 0);
  ok("…and the reason is visible: on but no content", empty.about.on === true && empty.about.hasContent === false);
  const off = resolveProposalSections({ company: { proposalSections: { services: false } }, quote: null, content: FULL });
  ok("a company default of off leaves the section out", !off.services.rendered && off.services.inherited);
  const override = resolveProposalSections({ company: { proposalSections: { services: false } }, quote: { presentation: { sections: { services: true } } }, content: FULL });
  ok("a quote override of on beats the company off", override.services.rendered && !override.services.inherited);
  const back = resolveProposalSections({ company: { proposalSections: { services: false } }, quote: { presentation: { sections: { services: null } } }, content: FULL });
  ok("null on the quote follows the company (off)", !back.services.rendered && back.services.inherited);
  const garbage = resolveProposalSections({ company: { proposalSections: { services: "no", about: 0 } }, quote: { presentation: { sections: { about: "false" } } }, content: FULL });
  ok("a string \"no\" / \"false\" is not a switch — both sections stay on", garbage.services.rendered && garbage.about.rendered);
  ok("the rendered keys keep the page order", JSON.stringify(renderedSectionKeys(resolveProposalSections({ content: FULL }))) === JSON.stringify(PROPOSAL_SECTION_KEYS));
}
{
  const p = sanitisePresentation({ sections: { about: false, bogus: true }, documentIds: ["a", "a", 7, " b "], crewSize: "3" });
  ok("sanitisePresentation: known keys only, tri-state", p.sections.about === false && !("bogus" in p.sections) && p.sections.services === null);
  ok("…documentIds deduped and trimmed, non-strings dropped", JSON.stringify(p.documentIds) === JSON.stringify(["a", "b"]));
  ok("…crewSize \"3\" (a string) is not a crew", p.crewSize === null);
  ok("…crewSize 200 is not a crew either", sanitisePresentation({ crewSize: 200 }).crewSize === null);
  ok("…crewSize 4 is", sanitisePresentation({ crewSize: 4 }).crewSize === 4);
  ok("…null / garbage presentation → all null, documentIds null", sanitisePresentation(null).documentIds === null && sanitisePresentation("x").crewSize === null);
  ok("sanitiseCompanySections drops non-booleans and returns null when empty", sanitiseCompanySections({ about: "yes" }) === null && sanitiseCompanySections({ about: false }).about === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The day plan is derived or absent — never invented");
{
  ok("no hours → null", dayPlan({ parts: [], totalHours: 0, crewSize: 2 }) === null);
  ok("no crew size → null even with hours", dayPlan({ parts: [{ name: "Walls", hours: 12 }], crewSize: null }) === null);
  ok("crew size 0 / \"2\" → null", dayPlan({ totalHours: 10, crewSize: 0 }) === null && dayPlan({ totalHours: 10, crewSize: "2" }) === null);
  const plan = dayPlan({ parts: [{ name: "Living room", hours: 9 }, { name: "Hall", hours: 4 }, { name: "Bedroom", hours: 6 }], crewSize: 2 });
  ok("19 h for a crew of 2 = 16 h day 1 + 3 h day 2", plan && plan.length === 2 && plan[0].hours === 16 && plan[1].hours === 3);
  ok("day 1 names the rooms it touches; day 2 only the bedroom", plan && plan[0].labels.join(",") === "Living room,Hall,Bedroom" && plan[1].labels.join(",") === "Bedroom");
  ok("the last day at 3 of 16 h is a half day", plan && plan[1].halfDay === true && plan[0].halfDay === false);
  const total = dayPlan({ totalHours: 20, crewSize: 1 });
  ok("a total with no parts spreads into unnamed days", total && total.length === 3 && total.every((d) => d.labels.length === 0));
  ok("parts with garbage hours are skipped, not counted", dayPlan({ parts: [{ name: "x", hours: "many" }, { name: "y", hours: -2 }], totalHours: 0, crewSize: 1 }) === null);
  ok("a plan of more than 30 days is refused", dayPlan({ totalHours: 400, crewSize: 1 }) === null);
  ok("paintSpec: nothing → null", paintSpec(null) === null && paintSpec({ areas: [], purchase: [] }) === null);
  const spec = paintSpec({ purchase: [{ label: "Regal Select" }, { label: "Regal Select" }, { label: "" }], areas: [{ lines: [{ coats: 2 }, { coats: 2 }, { coats: "x" }] }] });
  ok("paintSpec: products deduped, coats collected", spec && spec.products.join() === "Regal Select" && spec.coats.join() === "2");
  const work = workFromGroups([{ categoryKey: "interior_painting", takeoff: { model: "area_substrate", areas: [] }, rateOverrides: null }, { categoryKey: null, takeoff: {} }]);
  ok("workFromGroups on an empty takeoff reports 0 hours, no parts, no crew", work.totalHours === 0 && work.parts.length === 0 && work.crewSizeFromTakeoff === null);
  const ins = workFromGroups([{ categoryKey: "insulation", takeoff: { crewSize: 3 }, rateOverrides: null }]);
  ok("a takeoff's own crewSize is read (insulation)", ins.crewSizeFromTakeoff === 3);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Documents: expiry hides, the client sees no id and no date");
{
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
  const docs = [
    { id: "d1", type: "insurance", title: "COI", fileUrl: "https://res.cloudinary.com/x/a.pdf", showOnQuotes: true, expiresAt: yesterday },
    { id: "d2", type: "licence", title: "Licence", fileUrl: "https://res.cloudinary.com/x/b.pdf", showOnQuotes: true, expiresAt: tomorrow },
    { id: "d3", type: "warranty", title: "Warranty", fileUrl: "https://res.cloudinary.com/x/c.pdf", showOnQuotes: true, expiresAt: null },
    { id: "d4", type: "waiver", title: "Release", fileUrl: null, showOnQuotes: true, body: { sections: [{ heading: "a", text: "b" }], acknowledgements: ["x"] } },
    { id: "d5", type: "other", title: "Hidden", fileUrl: "https://res.cloudinary.com/x/d.pdf", showOnQuotes: false },
    { id: "d6", type: "other", title: "Evil", fileUrl: "javascript:alert(1)", showOnQuotes: true },
    { id: "d7", type: "other", title: "Archived", fileUrl: "https://res.cloudinary.com/x/e.pdf", showOnQuotes: true, archivedAt: yesterday },
  ];
  const visible = clientVisibleDocuments(docs);
  ok("expired yesterday → hidden; expires tomorrow → shown; no expiry → shown", visible.map((d) => d.id).join() === "d2,d3");
  ok("a waiver, an off switch, a javascript: URL and an archived row are all out", !visible.some((d) => ["d4", "d5", "d6", "d7"].includes(d.id)));
  ok("isExpired treats a malformed date as not expired", !isExpired({ expiresAt: "not a date" }));
  ok("a quote's own selection is a SUBSET: an expired id in it stays hidden", clientVisibleDocuments(docs, { ids: ["d1", "d3"] }).map((d) => d.id).join() === "d3");
  const shown = presentDocument(docs[1]);
  ok("the client projection carries no id, no expiresAt, no publicId", !("id" in shown) && !("expiresAt" in shown) && !("filePublicId" in shown) && shown.url.startsWith("https://"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Waivers: every box or no signature; the hash binds the text");
{
  ok("a body with no text is not a waiver", sanitiseWaiverBody({ sections: [{ heading: "h", text: "  " }], acknowledgements: ["a"] }) === null);
  const body = sanitiseWaiverBody({
    sections: [{ heading: "Furniture", text: "We cover it." }, { text: "Hidden defects may show." }, 7],
    acknowledgements: ["I understand A", " I understand A ", "I understand B", "C", "D", "E", "F", "G"],
  });
  ok("sections without text dropped; acknowledgements trimmed, deduped, capped at five", body.sections.length === 2 && body.acknowledgements.length === 5 && body.acknowledgements[0] === "I understand A");
  ok("waiverIsSignable needs at least one line", waiverIsSignable(body) && !waiverIsSignable({ sections: [{ text: "t" }], acknowledgements: [] }));

  const document = { id: "w1", title: "Release", body };
  const base = { document, name: "Libby Angelos", signatureDataUrl: "data:image/png;base64,AAA", consent: true, ip: "1.2.3.4", userAgent: "ua", now: "2026-09-21T16:05:00.000Z" };
  ok("4 of 5 ticked → REFUSED", buildWaiverSignature({ ...base, ticked: [0, 1, 2, 3] }) === null);
  ok("the same box five times → REFUSED", buildWaiverSignature({ ...base, ticked: [0, 0, 0, 0, 0] }) === null);
  ok("an index out of range does not count", buildWaiverSignature({ ...base, ticked: [0, 1, 2, 3, 9] }) === null);
  ok("a text that matches no line does not count", buildWaiverSignature({ ...base, ticked: [0, 1, 2, 3, "I never agreed"] }) === null);
  const signed = buildWaiverSignature({ ...base, ticked: [4, 3, 2, 1, 0] });
  ok("all five (any order) → signed, with every line and its tick time", signed && signed.acknowledgements.length === 5 && signed.acknowledgements.every((a) => a.tickedAt === base.now));
  ok("…texts are accepted in place of indexes", Boolean(buildWaiverSignature({ ...base, ticked: body.acknowledgements })));
  ok("…the signature carries name, mark, consent, IP, UA and the waiver hash", signed && signed.signature.name === "Libby Angelos" && signed.signature.ip === "1.2.3.4" && signed.signature.documentHash === signed.documentHash);
  ok("all five but no consent → REFUSED", buildWaiverSignature({ ...base, ticked: [0, 1, 2, 3, 4], consent: false }) === null);
  ok("all five but no drawn mark → REFUSED", buildWaiverSignature({ ...base, ticked: [0, 1, 2, 3, 4], signatureDataUrl: "not-a-data-url" }) === null);
  ok("a waiver with no acknowledgement lines cannot be signed by omission", buildWaiverSignature({ ...base, document: { title: "x", body: { sections: [{ text: "t" }], acknowledgements: [] } }, ticked: [] }) === null);
  ok("the stored signature verifies against the same text", verifyWaiverSignature(document, signed));
  const edited = { ...document, body: { ...body, sections: [{ heading: "Furniture", text: "We cover it. Probably." }, body.sections[1]] } };
  ok("…and FAILS once the text is edited", !verifyWaiverSignature(edited, signed));
  const editedLine = { ...document, body: { ...body, acknowledgements: [...body.acknowledgements.slice(0, 4), "Z"] } };
  ok("…and fails once an acknowledgement line is edited", !verifyWaiverSignature(editedLine, signed) && hashWaiver(document) !== hashWaiver(editedLine));
  ok("coveredAcknowledgements of garbage is []", coveredAcknowledgements(["a"], "a").length === 0 && coveredAcknowledgements(["a"], null).length === 0);
  const tok = newWaiverToken();
  ok("a public token is wv_ + 24 url-safe chars, and never repeats", /^wv_[A-Za-z0-9]{24}$/.test(tok) && tok !== newWaiverToken());
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Contrast ≥ 4.5:1 across hostile brand colours");
{
  const BRANDS = ["#ffffff", "#000000", "#ffff00", "#c0c0c0", "#808080", "#ff5a00", "#1f3a5f", "#00ff00", "#f4f4f4", "#7f7f00", "not-a-colour", null];
  const PAPER = "#ffffff";
  const composite = (hex, alpha, over = PAPER) => {
    const c = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [r1, g1, b1] = c(hex);
    const [r2, g2, b2] = c(over);
    const mix = (a, b) => Math.round(a * alpha + b * (1 - alpha));
    return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  for (const brand of BRANDS) {
    const theme = documentTheme({ brandColor: brand });
    const fill = fillPair(theme);
    const wash = washPair(theme);
    const rule = ruleColor(theme);
    const label = brand || "null";
    ok(`${label}: fill text on the fill (header total band, TOC active, day bubbles)`, contrastRatio(fill.fg, fill.bg) >= 4.5, contrastRatio(fill.fg, fill.bg).toFixed(2));
    ok(`${label}: accentText on paper (kickers, View document)`, contrastRatio(theme.accentText, PAPER) >= 4.5, contrastRatio(theme.accentText, PAPER).toFixed(2));
    ok(`${label}: wash ink on the wash (scope headings, waiver Sign panel)`, contrastRatio(wash.ink, wash.bg) >= 4.5);
    ok(`${label}: wash accent on the wash (document card icon)`, contrastRatio(wash.accent, wash.bg) >= 4.5);
    ok(`${label}: wash muted on the wash (acknowledged count)`, contrastRatio(wash.muted, wash.bg) >= 4.5);
    ok(`${label}: inkMuted on paper (TOC inactive, waiver intro)`, contrastRatio(theme.inkMuted, PAPER) >= 4.5);
    ok(`${label}: the rule is visible against paper`, contrastRatio(rule, PAPER) >= 1.6);
    ok(`${label}: warning text on paper (tick the remaining…)`, contrastRatio(theme.warning, PAPER) >= 4.5);
    ok(`${label}: positive text on the positive wash (waiver signed)`, contrastRatio(theme.positive, theme.positiveWash) >= 4.5);
  }
  ok("Accept green: white on #15803d", contrastRatio("#ffffff", "#15803d") >= 4.5);
  ok("the locked Accept / Sign: white on #4b5563", contrastRatio("#ffffff", "#4b5563") >= 4.5);
  ok("body ink #2d2520 at /85, /80 and /70 over white all clear 4.5", [0.85, 0.8, 0.7].every((a) => contrastRatio(composite("#2d2520", a), PAPER) >= 4.5));
  ok("…and /60 does NOT, which is why the page never uses it", contrastRatio(composite("#2d2520", 0.6), PAPER) < 4.5);
  const alphas = ["app/q/[token]/QuoteApproval.js", "app/components/public/proposal/ProposalSections.js", "app/estimate-report/[token]/ReportView.js"]
    .flatMap((f) => [...strip(read(f)).matchAll(/text-\[#2d2520\]\/(\d+)/g)].map((m) => Number(m[1])));
  ok("the page uses no muted ink lighter than /70", alphas.length > 0 && alphas.every((a) => a >= 70), alphas.filter((a) => a < 70).join(","));
  ok("the BEFORE/AFTER tags: white on #20242b at 80% over a mid photo", contrastRatio("#ffffff", composite("#20242b", 0.8, "#888888")) >= 4.5);
  ok("the star on paper (#b45309)", contrastRatio("#b45309", PAPER) >= 4.5);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Nothing client-facing says FieldQuo");
{
  const files = [
    "app/q/[token]/QuoteApproval.js",
    "app/components/public/proposal/ProposalSections.js",
    "app/estimate-report/[token]/ReportView.js",
    "app/components/public/WaiverSign.js",
    "app/w/[token]/WaiverPage.js",
    "app/w/[token]/page.js",
    "lib/waivers/pdf.js",
    "lib/waivers/service.js",
  ];
  for (const f of files) {
    const code = strip(read(f));
    ok(`${f}: no "FieldQuo" in code or JSX`, !/fieldquo/i.test(code.replace(/@\/lib\/|@\/app\//g, "").replace(/fieldquo\/companies/g, "")), (code.match(/fieldquo/gi) || []).join(","));
  }
  for (const [lang, block] of Object.entries(CLIENT_DOC_COPY)) {
    const text = JSON.stringify(Object.fromEntries(Object.entries(block).filter(([k]) => k.startsWith("waiver") || k === "proposal" || k === "portalDocumentsHeading")), (k, v) => (typeof v === "function" ? v("X", "Y") : v));
    ok(`${lang}: proposal + waiver copy never names FieldQuo`, !/fieldquo/i.test(text));
    ok(`${lang}: the 25 proposal strings and 18 waiver strings exist`, Object.keys(block.proposal || {}).length === 25 && Object.keys(block).filter((k) => k.startsWith("waiver") || k === "signWaiver").length === 18);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. One gallery");
{
  ok("sanitiseGalleryPair: both images or nothing; the same image twice is nothing", sanitiseGalleryPair({ beforeUrl: "https://a/1.jpg" }) === null && sanitiseGalleryPair({ before: "https://a/1.jpg", after: "https://a/1.jpg" }) === null);
  ok("…javascript: is refused", sanitiseGalleryPair({ beforeUrl: "javascript:x", afterUrl: "https://a/2.jpg" }) === null);
  ok("…the website shape (before/after) and the email shape (beforeUrl/afterUrl) both parse", sanitiseGalleryPair({ before: "https://a/1.jpg", after: "https://a/2.jpg" })?.afterUrl === "https://a/2.jpg" && sanitiseGalleryPair({ beforeUrl: "https://a/1.jpg", afterUrl: "https://a/2.jpg", caption: " x " })?.caption === "x");
  const site = { blocks: [{ type: "beforeafter", content: { pairs: [{ before: "https://a/1.jpg", after: "https://a/2.jpg" }] } }], pages: [{ blocks: [{ type: "beforeafter", content: { pairs: [{ before: "https://a/3.jpg", after: "https://a/4.jpg" }, { before: "x" }] } }] }] };
  ok("sitePairsOf reads blocks AND every page's blocks, dropping half pairs", sitePairsOf(site).length === 2);
  const rows = [{ id: "g1", beforeUrl: "https://a/1.jpg", afterUrl: "https://a/2.jpg", caption: null }];
  ok("the two projections carry the same two URLs", galleryAsEmailPairs(rows)[0].beforeUrl === galleryAsSitePairs(rows)[0].before && galleryAsSitePairs(rows)[0].caption === "");

  const readers = {
    "app/site/[subdomain]/page.js": /loadCompanyGallery\(site\.companyId\)/,
    "app/api/settings/website/photos/route.js": /replaceCompanyGallery\(member\.companyId, pairs/,
    "app/api/settings/website/route.js": /loadCompanyGallery\(member\.companyId\)/,
    "app/api/settings/quote-email/route.js": /replaceCompanyGallery\(member\.companyId/,
    "app/api/quotes/[id]/send/route.js": /withCompanyGallery\(/,
    "app/api/quotes/[id]/email-sections/route.js": /withCompanyGallery\(/,
    "lib/proposal/load.js": /loadCompanyGallery\(companyId/,
    "lib/setupStepsSnapshot.js": /loadCompanyGallery\(companyId\)/,
  };
  for (const [f, re] of Object.entries(readers)) ok(`${f} reads/writes the one gallery`, re.test(strip(read(f))));
  const gallery = strip(read("lib/company/gallery.js"));
  ok("the merge is stamped once and is additive (createMany, never delete)", /galleryMergedAt: new Date\(\)/.test(gallery) && /createMany/.test(gallery) && !/\.delete\(|deleteMany\(/.test(gallery));
  ok("removing a pair sets removedAt rather than deleting", /removedAt: new Date\(\)/.test(gallery));
  ok("the website section editor no longer edits the block's own pairs", /block\.type === "beforeafter" \?/.test(strip(read("app/app/settings/website/SectionEditor.js"))));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Wiring the fixtures cannot execute");
{
  const route = strip(read("app/api/public/quotes/[token]/route.js"));
  ok("the public route strips the section defaults and story columns from `company`", /proposalSections: _proposalSections/.test(route) && /story: _story/.test(route));
  // Since 2026-09-25 the projection is one function both proposal pages
  // call (lib/proposal/load.js#projectProposal) — the instant-estimate
  // presentation publishes the company through the same one.
  const loadSrc = strip(read("lib/proposal/load.js"));
  ok("…publishes only rendered sections' content", /\.\.\.projectProposal\(\{ content, sections \}\)/.test(route) && /about: on\("about"\) \? content\?\.about \|\| null : null/.test(loadSrc) && /gallery: on\("beforeAfter"\) \? content\?\.gallery \|\| \[\] : \[\]/.test(loadSrc));
  ok("…refuses an acceptance while a waiver is pending, with needsWaiver", /pendingWaiversForQuote\(/.test(route) && /needsWaiver: true/.test(route) && route.indexOf("pendingWaiversForQuote(") < route.indexOf("buildSignatureRecord({"));
  ok("…files signed waivers on the job the acceptance created", /fileSignedWaiversForJob\(\{ quoteId: updated\.id, jobId: job\.id \}\)/.test(route));
  const svc = strip(read("lib/waivers/service.js"));
  ok("signWaiver refuses on a null record and commits the signature before any email", /if \(!record\)/.test(svc) && svc.indexOf("db.documentSignature.update({") < svc.indexOf("afterSigned({"));
  ok("…files the PDF as a JobDocument of kind waiver", /kind: "waiver"/.test(svc) && /source: "waiver_signed"/.test(svc));
  ok("the DocumentSignature token is the credential of /w/[token], and the page 404s on an unknown one", /findUnique\(\{ where: \{ token \}, select: \{ id: true \} \}\)/.test(strip(read("app/w/[token]/page.js"))) && /notFound\(\)/.test(read("app/w/[token]/page.js")));
  const page = strip(read("app/q/[token]/QuoteApproval.js"));
  // The company sections are drawn by the component the quote shares with
  // the instant-estimate presentation (app/components/public/proposal/).
  const sections = strip(read("app/components/public/proposal/ProposalSections.js"));
  ok("the page draws a section only when the server listed it", /<CompanySections proposal=\{proposal\} sectionKeys=\{sectionKeys\}/.test(page) && /sectionKeys\.includes\(key\)/.test(sections) && /on\("about"\)/.test(sections) && /on\("documents"\)/.test(sections));
  ok("…the Accept buttons are disabled with the reason while a waiver is pending", /disabled=\{waiverBlocks\}/.test(page) && /copy\.waiverRequiredBeforeApprove/.test(page));
  ok("…the day plan prints only from the server's derived days", /plan\?\.days\?\.length > 0/.test(page) && !/Day 1|Prep, repairs/.test(page));
  ok("…the scope paragraph prints once (Scope of work), not in the price card too", /scopeOfWork\(quote\.scopeGroups\)/.test(page) && !/\{g\.description\}/.test(page));
  ok("…extras still post addOnIds only", /addOnIds: decision === "accepted" \? picked : \[\]/.test(page) && !/amount:/.test(page.match(/body: jsonBody\(\{[\s\S]*?\}, "approval"\)/)?.[0] || ""));
  ok("View document opens the file URL in a new tab, never an id", /href=\{d\.url\}/.test(sections) && /target="_blank"/.test(sections));
  const sign = strip(read("app/components/public/WaiverSign.js"));
  ok("WaiverSign posts acknowledgement indexes and the signature, nothing else", /acknowledgements: \[\.\.\.ticked\]/.test(sign) && /signature: \{ name: name\.trim\(\), dataUrl, consent \}/.test(sign));
  ok("…and locks Sign until every box is ticked", /const allTicked = lines\.length > 0 && remaining === 0/.test(sign) && /disabled=\{!canSign \|\| busy\}/.test(sign));

  const keys = SETUP_STEPS.map((s) => s.key);
  ok("the four set-up rows exist, after the payment schedule", ["story", "gallery", "documents", "google_reviews"].every((k) => keys.includes(k)) && keys.indexOf("story") === keys.indexOf("payment_schedule") + 1);
  const panels = strip(read("app/components/dashboard/stepPanels.js"));
  ok("…each opens in the StepDialog around the settings editor", /story: \{/.test(panels) && /gallery: \{/.test(panels) && /documents: \{/.test(panels) && /google_reviews: \{/.test(panels) && /StoryEditor compact/.test(panels) && /GalleryEditor compact/.test(panels) && /CompanyDocumentsEditor compact/.test(panels));
  const settings = strip(read("app/app/settings/presentation/page.js"));
  ok("Settings › Presentation renders the same three editors under the anchors the rows link to", /id="story"/.test(settings) && /id="gallery"/.test(settings) && /id="documents"/.test(settings) && /<StoryEditor \/>/.test(settings) && /<GalleryEditor \/>/.test(settings) && /<CompanyDocumentsEditor \/>/.test(settings));
  const pres = strip(read("app/api/quotes/[id]/presentation/route.js"));
  ok("the quote's Presentation API accepts true/false/null per section and refuses anything else", /v !== true && v !== false && v !== null/.test(pres));
  ok("the quote's presentation column is written AND read", /presentation: saved/.test(pres) && /quote\.presentation/.test(route));
  const pkg = JSON.parse(read("package.json"));
  ok("check:client-proposal is wired into check:all", typeof pkg.scripts["check:client-proposal"] === "string" && pkg.scripts["check:all"].includes("check:client-proposal"));
  const portal = strip(read("app/api/portal/[token]/route.js"));
  ok("the portal lists signed waivers with the filed URL and pending ones with the sign link", /signToken: r\.status === "signed" \? null : r\.token/.test(portal) && /urlById\.get\(r\.jobDocumentId\)/.test(portal));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
