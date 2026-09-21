// scripts/check-prep-guide.mjs
//
//   npm run check:prep-guide
//
// The client preparation guide, executed rather than read.
//
// Bundled with esbuild (see package.json) the way check:pdf-fonts is, because
// the renderer is JSX in a .js file and the point is to run the REAL renderer,
// the real email builder, the real cron handler and the real job-page routes
// — with only the seams that leave the building swapped for fixtures:
// @/lib/db (in-memory), @/lib/apiMember (one owner), @/lib/email/resend
// (records), @/lib/cloudinary (records), @/lib/platform/errorLog (records).
//
// What it holds:
//   1. every ServiceCategory.key resolves to a guide with ≥4 checklist items,
//      a warning, day-of text and after-care, in en, fr and es, key-for-key;
//      the frame copy exists in every offered document language;
//   2. the schedule rule: N days before, 0 = the morning of, never after the
//      start day, never with no date or no email, honouring "don't send";
//   3. the cron sends at N days and never twice; the send claims the stamp
//      before mailing and releases it when the mail fails;
//   4. a company copy is used when present and the built-in is untouched;
//      "reset" deletes the copy; a partial copy inherits the rest;
//   5. technical documents ride as attachments under the cap and as links
//      always; the sent guide is filed on the job as kind prep_guide;
//   6. every text/background pairing the email and PDF use measures ≥ 4.5:1
//      across the hostile brand set;
//   7. the job page's controls — status, Send now, Don't send, Allow —
//      executed against the real route handlers.

import { LANGUAGES } from "@/app/i18n/languages";
import { tradeKeys } from "@/lib/trades/catalog";
import { GUIDE_FAMILY, GUIDE_TABLES, GUIDE_LANGUAGES, builtInGuide, guideLanguage } from "@/lib/prepGuide/content";
import { PREP_GUIDE_COPY, prepGuideCopy } from "@/lib/prepGuide/copy";
import { resolvePrepGuide, withPrepGuideCopy, sanitisePrepGuideCopy } from "@/lib/prepGuide/resolve";
import { prepGuideDecision, prepGuideDueAt, clampLeadDays, candidateStartWindow } from "@/lib/prepGuide/schedule";
import { buildPrepGuide, loadPrepGuideJob } from "@/lib/prepGuide/build";
import { buildPrepGuideEmail } from "@/lib/prepGuide/email";
import { renderPrepGuidePdf } from "@/lib/prepGuide/renderPdf";
import { sendPrepGuide, planAttachments, ATTACHMENT_CAP_BYTES } from "@/lib/prepGuide/send";
import { documentTheme, fillPair, washPair } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";
import { DOCUMENT_KINDS } from "@/lib/jobs/documents";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { GET as cronGet } from "@/app/api/cron/prep-guides/route";
import { GET as jobGet, POST as jobPost, PATCH as jobPatch } from "@/app/api/jobs/[id]/prep-guide/route";
import { GET as settingsGet, PATCH as settingsPatch } from "@/app/api/settings/prep-guide/route";
import { rows, writes, reset, db } from "./fixtures/prepGuide/db.mjs";
import { sent, state as mailState, sendEmail as sendEmailFixture } from "./fixtures/prepGuide/resend.mjs";
import { uploads } from "./fixtures/prepGuide/cloudinary.mjs";
import { errors } from "./fixtures/prepGuide/errorLog.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// Bundled to CJS by esbuild, so import.meta.url is not available; the check
// runs from the repo root, as every npm script does.
const repo = (p) => join(process.cwd(), p);

async function main() {
let pass = 0;
const failures = [];
const ok = (label, cond, detail) => (cond ? pass++ : failures.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`));
const section = (t) => console.log(`\n${t}`);

const DAY = 86400000;
const english = /\b(the|and|with|your|we)\b/i;

// ── 1. Content ─────────────────────────────────────────────────────────────
section("1. Every trade has a guide in three languages");
const keys = tradeKeys();
ok("the catalogue has trades", keys.length >= 60, keys.length);
for (const key of keys) {
  ok(`${key} maps to a guide`, Boolean(GUIDE_FAMILY[key]) && Boolean(GUIDE_TABLES.en[GUIDE_FAMILY[key]]), GUIDE_FAMILY[key]);
}
for (const lang of GUIDE_LANGUAGES) {
  const table = GUIDE_TABLES[lang];
  ok(`${lang} covers every guide en has`, Object.keys(GUIDE_TABLES.en).every((g) => table[g]), Object.keys(GUIDE_TABLES.en).filter((g) => !table[g]).join(","));
  ok(`${lang} has no guide en lacks`, Object.keys(table).every((g) => GUIDE_TABLES.en[g]));
  for (const key of keys) {
    const g = builtInGuide(key, lang);
    ok(`${key}/${lang}: ≥4 checklist items`, g.checklist.length >= 4, g.checklist.length);
    ok(`${key}/${lang}: warning, day-of and after-care present`, Boolean(g.warning) && g.dayOf.length >= 1 && Boolean(g.afterCare));
    ok(`${key}/${lang}: every item is a full sentence`, g.checklist.every((i) => typeof i === "string" && i.trim().length >= 25));
    ok(`${key}/${lang}: same item count as English`, g.checklist.length === builtInGuide(key, "en").checklist.length);
    if (lang !== "en") {
      const text = [...g.checklist, g.warning, ...g.dayOf, g.afterCare].join(" ");
      ok(`${key}/${lang}: no English function words`, !english.test(text), text.match(english)?.[0]);
    }
    ok(`${key}/${lang}: nothing asserts a day count or cure hours`, !/\b\d+\s*(days?|hours?|jours?|heures?|días?|horas?)\b/i.test([...g.checklist, g.warning, ...g.dayOf, g.afterCare].join(" ").replace(/24\s*(hours|heures|horas)/gi, "")));
  }
}
// The three the owner named, checked by content rather than by count.
const cab = builtInGuide("cabinet_refinishing", "en");
ok("cabinets: TrueFinish's list — counters, dining table, wall art, appliances, interiors, floor", /countertops/.test(cab.checklist[0]) && /dining table/.test(cab.checklist[1]) && /wall art/.test(cab.checklist[2]) && /Stove and refrigerator/.test(cab.checklist[3]) && /interiors/i.test(cab.checklist[4]) && /vacuumed/.test(cab.checklist[5]));
ok("cabinets: the interior-painting warning", /interior cabinet painting/.test(cab.warning));
const roof = builtInGuide("roofing_service", "en");
ok("roofing: driveway, attic and pets", roof.checklist.some((i) => /driveway/.test(i)) && roof.checklist.some((i) => /attic/.test(i)) && roof.checklist.some((i) => /^Pets/.test(i)));
const paint = builtInGuide("interior_painting", "en");
ok("painting: furniture and wall art", paint.checklist.some((i) => /furniture/.test(i)) && paint.checklist.some((i) => /wall art/.test(i)));
ok("generic guide for a custom category", builtInGuide("custom_abc", "en").guideKey === "generic" && builtInGuide("custom_abc", "fr").checklist.length >= 4);
ok("guideLanguage: fr-CA → fr, uk → en", guideLanguage("fr-CA") === "fr" && guideLanguage("uk") === "en" && guideLanguage("ES") === "es");

section("1b. Frame copy in every offered document language");
const frameKeys = Object.keys(PREP_GUIDE_COPY.en);
for (const { code } of LANGUAGES) {
  ok(`frame copy has ${code}`, Boolean(PREP_GUIDE_COPY[code]));
  const here = Object.keys(PREP_GUIDE_COPY[code] || {});
  ok(`${code} frame is key-for-key with English`, frameKeys.every((k) => here.includes(k)) && here.length === frameKeys.length, frameKeys.filter((k) => !here.includes(k)).join(","));
  const c = prepGuideCopy(code);
  ok(`${code} subject carries company, job and date`, /Acme/.test(c.subject("Acme", "Job X", "D1")) && /Job X/.test(c.subject("Acme", "Job X", "D1")) && /D1/.test(c.subject("Acme", "Job X", "D1")));
}
ok("prepGuideCopy falls back to English for an unknown code", prepGuideCopy("xx").title === PREP_GUIDE_COPY.en.title);

section("1c. The app catalogue and the document kind");
ok("prep_guide is a document kind", DOCUMENT_KINDS.includes("prep_guide"));
for (const lang of Object.keys(APP_MESSAGES)) {
  ok(`${lang} labels the prep_guide kind and source`, Boolean(APP_MESSAGES[lang]["app.jobDocuments.kind.prep_guide"]) && Boolean(APP_MESSAGES[lang]["app.jobDocuments.source.prepGuide"]));
  ok(`${lang} has the job-page sentences`, ["app.prepGuide.job.scheduled", "app.prepGuide.job.noStartDate", "app.prepGuide.job.noEmail", "app.prepGuide.job.sent", "app.prepGuide.job.suppressed"].every((k) => APP_MESSAGES[lang][k]));
}

// ── 2. The schedule rule ───────────────────────────────────────────────────
section("2. The schedule rule");
const now = new Date("2026-10-09T13:00:00Z");
const start = (days) => new Date(Date.UTC(2026, 9, 9 + days));
const client = { email: "m@x.com" };
const co = (n) => ({ prepGuideLeadDays: n });
const job = (o) => ({ status: "scheduled", ...o });
ok("clampLeadDays: default 3, floor 0, ceiling 30, rounds", clampLeadDays(undefined) === 3 && clampLeadDays(-4) === 0 && clampLeadDays(99) === 30 && clampLeadDays("2.6") === 3 && clampLeadDays("x") === 3);
ok("due exactly N days before, at UTC midnight", prepGuideDueAt({ startDate: start(3) }, co(3)).getTime() === start(0).getTime());
ok("N=3, start in 3 days → due", prepGuideDecision({ job: job({ startDate: start(3) }), company: co(3), client, now }).reason === "due");
ok("N=3, start in 4 days → not yet", prepGuideDecision({ job: job({ startDate: start(4) }), company: co(3), client, now }).reason === "not_yet");
ok("N=3, start in 1 day (booked late) → due", prepGuideDecision({ job: job({ startDate: start(1) }), company: co(3), client, now }).send === true);
ok("N=0, start today → due (the morning of)", prepGuideDecision({ job: job({ startDate: start(0) }), company: co(0), client, now }).send === true);
ok("N=0, start tomorrow → not yet", prepGuideDecision({ job: job({ startDate: start(1) }), company: co(0), client, now }).reason === "not_yet");
ok("start yesterday → started, never sent late", prepGuideDecision({ job: job({ startDate: start(-1) }), company: co(3), client, now }).reason === "started");
ok("no start date → no_start_date", prepGuideDecision({ job: job({ startDate: null }), company: co(3), client, now }).reason === "no_start_date");
ok("no client email → no_client_email", prepGuideDecision({ job: job({ startDate: start(3) }), company: co(3), client: { email: "  " }, now }).reason === "no_client_email");
ok("suppressed wins", prepGuideDecision({ job: job({ startDate: start(3), prepGuideSuppressedAt: now }), company: co(3), client, now }).reason === "suppressed");
ok("already sent wins", prepGuideDecision({ job: job({ startDate: start(3), prepGuideSentAt: now }), company: co(3), client, now }).reason === "already_sent");
ok("cancelled / archived / historical refuse", ["cancelled", "archived", "historical"].every((r, i) => prepGuideDecision({ job: job({ startDate: start(3), ...[{ status: "cancelled" }, { archivedAt: now }, { historicalImportedAt: now }][i] }), company: co(3), client, now }).reason === r));
ok("N=30 (max) with a start 30 days out → due", prepGuideDecision({ job: job({ startDate: start(30) }), company: co(30), client, now }).send === true);
const win = candidateStartWindow(now);
ok("candidate window starts yesterday and reaches past the longest lead", win.gte.getTime() === start(-1).getTime() && win.lte.getTime() >= start(31).getTime());

// ── 3. Resolve: company copy vs original ───────────────────────────────────
section("3. Company copy, original untouched, reset");
const before = JSON.stringify(builtInGuide("interior_painting", "en"));
const r0 = resolvePrepGuide("interior_painting", null, "en");
ok("no copy → built-in, not customised", r0.customised === false && r0.checklist.length === builtInGuide("interior_painting", "en").checklist.length);
const copyRow = { prepGuide: { en: { checklist: ["Move the piano — it weighs a ton", "Feed the cat"], warning: "", dayOf: [], afterCare: "", notes: "Park on Elm" } } };
const r1 = resolvePrepGuide("interior_painting", copyRow, "en");
ok("copy used when present", r1.customised && r1.checklist.length === 2 && r1.checklist[0].startsWith("Move the piano") && r1.notes === "Park on Elm");
ok("partial copy inherits the sections it left blank", r1.warning === r0.warning && r1.afterCare === r0.afterCare && r1.dayOf.length === r0.dayOf.length);
ok("a French client of the same company still gets the built-in French", resolvePrepGuide("interior_painting", copyRow, "fr").customised === false);
r1.checklist.push("mutated");
r1.original.checklist.push("mutated");
ok("the built-in is untouched after use and after mutation of the result", JSON.stringify(builtInGuide("interior_painting", "en")) === before);
ok("reset deletes the language and nulls an empty map", withPrepGuideCopy({ en: { checklist: ["x"] } }, "en", null) === null);
ok("reset of one language keeps the other", JSON.stringify(withPrepGuideCopy({ en: { checklist: ["x"] }, fr: { checklist: ["y"] } }, "en", null)) === JSON.stringify({ fr: { checklist: ["y"] } }));
ok("hostile copy: non-strings dropped, lengths capped, empty → null", sanitisePrepGuideCopy({ checklist: [1, null, "ok", "  "], warning: "w".repeat(5000) })?.checklist.length === 1 && sanitisePrepGuideCopy({ checklist: [1, null, "ok"] , warning: "w".repeat(5000) }).warning.length === 1200 && sanitisePrepGuideCopy({ checklist: [], warning: " " }) === null && sanitisePrepGuideCopy("nope") === null);
ok("withPrepGuideCopy ignores a prototype key as a language", withPrepGuideCopy(null, "__proto__", { checklist: ["a"] })?.en?.checklist?.[0] === "a");

// ── 4. Contrast ────────────────────────────────────────────────────────────
section("4. Contrast across hostile brand colours");
const HOSTILE = ["#ffff00", "#ffffff", "#000000", "#808080", "#dc2626", "#84cc16", "#06356b", "#f97316", "#e5e7eb", "#1f2937"];
for (const brand of HOSTILE) {
  const t = documentTheme({ brandColor: brand });
  const fill = fillPair(t);
  const wash = washPair(t);
  ok(`${brand}: step bubbles (fill)`, contrastRatio(fill.fg, fill.bg) >= 4.5, contrastRatio(fill.fg, fill.bg).toFixed(2));
  ok(`${brand}: warning box ink on wash`, contrastRatio(wash.ink, wash.bg) >= 4.5, contrastRatio(wash.ink, wash.bg).toFixed(2));
  ok(`${brand}: muted on wash`, contrastRatio(wash.muted, wash.bg) >= 4.5);
  ok(`${brand}: accent text on paper (headings, links)`, contrastRatio(t.accentText, t.paper) >= 4.5);
  ok(`${brand}: accent on wash (email chip label)`, contrastRatio(wash.accent, wash.bg) >= 4.5);
  ok(`${brand}: body ink / muted on paper`, contrastRatio(t.ink, t.paper) >= 4.5 && contrastRatio(t.inkMuted, t.paper) >= 4.5);
}

// ── 5. The send, executed with fixtures ────────────────────────────────────
section("5. Build, render, email, send, file");
function seed({ startOffset = 3, leadDays = 3, email = "marie@example.com", language = "fr", docs = true, sentAt = null, suppressedAt = null } = {}) {
  reset();
  sent.length = 0;
  uploads.length = 0;
  errors.length = 0;
  mailState.fail = false;
  mailState.skip = false;
  rows.company.push({ id: "co1", name: "Northline Refinishing", email: "hi@northline.ca", phone: "613 555 0100", website: "northline.ca", logoUrl: null, brandColor: "#06356b", defaultLanguage: "en", currency: "CAD", prepGuideLeadDays: leadDays, emailDomainStatus: null, emailDomain: null, emailFromLocal: null, taxIdName: null, taxIdNumber: null });
  rows.client.push({ id: "cl1", name: "Marie Tremblay", email, language });
  rows.serviceCategory.push({ id: "cat_cab", key: "cabinet_refinishing", label: "Cabinet Refinishing", labelTranslations: { fr: "Refinition d'armoires" }, companySettings: [{ companyId: "co1", prepGuide: null, includedItems: null, processSteps: null, scopeDescription: null, accentColor: null }] });
  rows.serviceCategory.push({ id: "cat_top", key: "countertop", label: "Countertop Installation", labelTranslations: {}, companySettings: [] });
  rows.member.push({ id: "m1", userId: "u1", companyId: "co1", role: "owner", permissions: null });
  rows.user.push({ id: "u1", name: "Owner", email: "owner@example.com" });
  if (docs) {
    rows.serviceDocument.push({ id: "sd1", companyId: "co1", categoryId: null, title: "Care card", url: "https://res.cloudinary.com/democloud/raw/upload/v1/care.pdf", sizeBytes: 50_000, mimeType: "application/pdf", language: null, sortOrder: 0, createdAt: new Date() });
    rows.serviceDocument.push({ id: "sd2", companyId: "co1", categoryId: "cat_cab", title: "Renner Italia technical data sheet", url: "https://res.cloudinary.com/democloud/raw/upload/v1/renner.pdf", sizeBytes: 30 * 1024 * 1024, mimeType: "application/pdf", language: null, sortOrder: 1, createdAt: new Date() });
    rows.serviceDocument.push({ id: "sd3", companyId: "co1", categoryId: null, title: "English-only sheet", url: "https://res.cloudinary.com/democloud/raw/upload/v1/en.pdf", sizeBytes: 1000, mimeType: "application/pdf", language: "en", sortOrder: 2, createdAt: new Date() });
    rows.serviceDocument.push({ id: "sd4", companyId: "co1", categoryId: "cat_other", title: "Other trade's sheet", url: "https://res.cloudinary.com/democloud/raw/upload/v1/other.pdf", sizeBytes: 1000, mimeType: "application/pdf", language: null, sortOrder: 3, createdAt: new Date() });
    rows.serviceDocument.push({ id: "sd5", companyId: "co1", categoryId: null, title: "Off-cloud link", url: "https://evil.example.com/x.pdf", sizeBytes: 1000, mimeType: "application/pdf", language: null, sortOrder: 4, createdAt: new Date() });
  }
  const today = new Date();
  const startDate = startOffset === null ? null : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + startOffset));
  rows.job.push({ id: "job1", companyId: "co1", clientId: "cl1", title: "Kitchen refinish — Tremblay", status: "scheduled", startDate, endDate: null, archivedAt: null, historicalImportedAt: null, prepGuideSentAt: sentAt, prepGuideSuppressedAt: suppressedAt, siteAddress: "12 Elm St", quote: { id: "q1", quoteNumber: "Q-1", language, quoteType: null, scopeGroups: [{ id: "g1", label: null, categoryId: "cat_cab", sortOrder: 0 }, { id: "g2", label: null, categoryId: "cat_top", sortOrder: 1 }, { id: "g3", label: null, categoryId: "cat_cab", sortOrder: 2 }] } });
}
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (!/res\.cloudinary\.com/.test(String(url))) throw new Error("fixture: unexpected fetch " + url);
  const size = rows.serviceDocument.find((d) => d.url === String(url))?.sizeBytes || 1000;
  return { ok: true, arrayBuffer: async () => new Uint8Array(Math.min(size, 200_000)).buffer };
};


seed();
const loaded = await loadPrepGuideJob(db, { jobId: "job1", companyId: "co1" });
const data = buildPrepGuide(loaded, { cloudName: "democloud" });
ok("language: the quote's French wins", data.language === "fr" && data.bodyLanguage === "fr");
ok("one section per DISTINCT trade, in quote order", data.sections.length === 2 && data.sections[0].categoryKey === "cabinet_refinishing" && data.sections[1].categoryKey === "countertop");
ok("section label is the translated category label", data.sections[0].label === "Refinition d'armoires");
ok("process steps are read from serviceContent, numbered", data.sections[0].steps.length >= 5 && data.sections[0].steps[0].num === 1 && /confinement/i.test(data.sections[0].steps[0].title + data.sections[0].steps[0].body));
ok("documents: company-level + this trade's; not another trade's, not English-only on a French guide, not off-cloud", data.documents.map((d) => d.id).join(",") === "sd1,sd2");
ok("start date formatted in the client's language", /octobre|novembre|décembre|janvier|février|mars|avril|mai|juin|juillet|août|septembre/.test(data.startDateText));
const pdf = await renderPrepGuidePdf(data);
ok("PDF renders", pdf.length > 10_000 && pdf.slice(0, 4).toString() === "%PDF");
const mail = buildPrepGuideEmail(data);
ok("subject: '{Company}: comment vous préparer pour {job} le {date}'", mail.subject.startsWith("Northline Refinishing : comment vous préparer pour Kitchen refinish — Tremblay le "));
ok("email carries the first four items, the warning, both document links, and no 'FieldQuo'", (mail.html.match(/border-radius:2px;margin:3px 8px 0 0/g) || []).length === 4 && /Important/.test(mail.html) && /care\.pdf/.test(mail.html) && /renner\.pdf/.test(mail.html) && !/fieldquo/i.test(mail.html) && !/fieldquo/i.test(mail.text));
ok("email plain text lists every item with a tick box", (mail.text.match(/^\[ \] /gm) || []).length === data.sections.reduce((n, s) => n + s.guide.checklist.length, 0));
ok("planAttachments: under the cap in order, unknown sizes link only", JSON.stringify(planAttachments([{ sizeBytes: 1000 }, { sizeBytes: null }, { sizeBytes: ATTACHMENT_CAP_BYTES }, { sizeBytes: 2000 }], 500)) === "[0,3]");

// Send through the orchestrator with the fixture db and the real defaults.
const calls = [];
const originalUpdateMany = db.job.updateMany;
db.job.updateMany = async (a) => { calls.push("claim"); return originalUpdateMany(a); };
const origSend = sendEmailFixture;
const result = await sendPrepGuide({ jobId: "job1", companyId: "co1" }, { db, send: async (p) => { calls.push("send"); return origSend(p); }, cloudName: "democloud" });
ok("sent", result.sent === true && result.to === "marie@example.com" && result.language === "fr", JSON.stringify(result));
ok("the stamp is claimed BEFORE the mail goes", calls[0] === "claim" && calls.indexOf("send") > calls.indexOf("claim"));
const s1 = sent[0];
ok("from the company, to the client, reply-to the company", /Northline Refinishing/.test(s1.from) && s1.to === "marie@example.com" && s1.replyTo === "hi@northline.ca" && s1.companyId === "co1");
ok("guide PDF attached plus the documents under the cap (30 MB sheet linked only)", s1.attachments.length === 2 && s1.attachments[0].filename === "Guide-de-preparation.pdf" && s1.attachments[1].filename === "Care-card.pdf" && result.attached === 1);
ok("filed on the job as kind prep_guide, source prep_guide, PDF", writes.some((w) => w.model === "jobDocument" && w.data.kind === "prep_guide" && w.data.source === "prep_guide" && w.data.mimeType === "application/pdf" && w.data.jobId === "job1"));
ok("uploaded to the company's prep-guides folder", uploads[0]?.folder === "fieldquo/co1/prep-guides");
ok("activity written on the job, keyed for the reader's language", writes.some((w) => w.model === "activityLog" && w.data.action === "job.prep_guide_sent" && w.data.entityType === "job" && w.data.metadata?.i18n?.key === "app.activity.event.prepGuideSentScheduled"));
ok("job stamped", rows.job[0].prepGuideSentAt instanceof Date);
const again = await sendPrepGuide({ jobId: "job1", companyId: "co1" }, { db, cloudName: "democloud" });
ok("never twice: a second scheduled send is refused", again.sent === false && again.reason === "already_sent" && sent.length === 1);
const forced = await sendPrepGuide({ jobId: "job1", companyId: "co1", member: { id: "m1", userId: "u1", companyId: "co1", role: "owner" }, force: true }, { db, cloudName: "democloud" });
ok("a person's 'Send again' sends and supersedes the filed copy", forced.sent && sent.length === 2 && writes.filter((w) => w.model === "jobDocument").length === 2 && writes.filter((w) => w.model === "jobDocument")[1].data.supersedesId === writes.filter((w) => w.model === "jobDocument")[0].data.id);

seed();
mailState.fail = true;
const failed = await sendPrepGuide({ jobId: "job1", companyId: "co1" }, { db, cloudName: "democloud" });
ok("a failed send releases the claim and logs", failed.sent === false && failed.reason === "send_failed" && rows.job[0].prepGuideSentAt === null && errors.some((e) => e.code === "send_failed"));
ok("nothing filed on a failed send", !writes.some((w) => w.model === "jobDocument"));
seed();
mailState.skip = true;
const skipped = await sendPrepGuide({ jobId: "job1", companyId: "co1" }, { db, cloudName: "democloud" });
ok("unconfigured email releases the claim", skipped.reason === "email_unconfigured" && rows.job[0].prepGuideSentAt === null);

seed({ email: "" });
ok("no client email → refused even by a person", (await sendPrepGuide({ jobId: "job1", companyId: "co1", force: true }, { db })).reason === "no_client_email" && sent.length === 0);
seed({ startOffset: null });
ok("no start date → refused even by a person", (await sendPrepGuide({ jobId: "job1", companyId: "co1", force: true }, { db })).reason === "no_start_date");
seed({ startOffset: -2 });
ok("start date passed → refused", (await sendPrepGuide({ jobId: "job1", companyId: "co1", force: true }, { db })).reason === "started");
seed({ startOffset: 10 });
ok("not yet due → the cron path refuses, a person may send early", (await sendPrepGuide({ jobId: "job1", companyId: "co1" }, { db })).reason === "not_yet" && (await sendPrepGuide({ jobId: "job1", companyId: "co1", force: true }, { db, cloudName: "democloud" })).sent === true);

// A company copy in the client's language is what gets sent.
seed({ language: "en" });
rows.serviceCategory[0].companySettings[0].prepGuide = { en: { checklist: ["Move the piano — it weighs a ton", "Feed the cat — she bites", "Hide the good silver — the crew are honest but curious", "Clear the counters — everything"], warning: "", dayOf: [], afterCare: "", notes: "Park on Elm Street." } };
const custom = buildPrepGuide(await loadPrepGuideJob(db, { jobId: "job1", companyId: "co1" }), { cloudName: "democloud" });
ok("the company copy is what the client gets", custom.sections[0].guide.customised && custom.sections[0].guide.checklist[0].startsWith("Move the piano") && custom.sections[0].guide.notes === "Park on Elm Street.");
ok("…and the other trade on the same job keeps its built-in", custom.sections[1].guide.customised === false);
ok("…and the built-in for cabinets is still TrueFinish's", builtInGuide("cabinet_refinishing", "en").checklist[0].startsWith("Clear all countertops completely"));
const customMail = buildPrepGuideEmail(custom);
ok("the email shows the company's own first item", /Move the piano/.test(customMail.html));

// ── 6. The cron, executed ──────────────────────────────────────────────────
section("6. The cron: sends at N days, never twice, lead 0 honoured, skips named");
process.env.CRON_SECRET = "s3cret";
const cronReq = (auth = "Bearer s3cret") => new Request("http://local/api/cron/prep-guides", { headers: { authorization: auth } });
seed({ startOffset: 3, leadDays: 3 });
ok("cron refuses without the secret", (await cronGet(cronReq("Bearer nope"))).status === 401);
let res = await (await cronGet(cronReq())).json();
ok("N=3, start in 3 days: the cron sends", res.sent === 1 && sent.length === 1, JSON.stringify(res));
res = await (await cronGet(cronReq())).json();
ok("the next run sends nothing (stamped)", res.sent === 0 && sent.length === 1 && res.candidates === 0);
seed({ startOffset: 5, leadDays: 3 });
res = await (await cronGet(cronReq())).json();
ok("N=3, start in 5 days: not yet", res.sent === 0 && res.skipped.not_yet === 1);
seed({ startOffset: 0, leadDays: 0 });
res = await (await cronGet(cronReq())).json();
ok("N=0, start today: sent the morning of", res.sent === 1);
seed({ startOffset: 0, leadDays: 3 });
res = await (await cronGet(cronReq())).json();
ok("N=3, start today (booked late): sent", res.sent === 1);
seed({ startOffset: -1, leadDays: 3 });
res = await (await cronGet(cronReq())).json();
ok("start yesterday: never sent late", res.sent === 0 && res.skipped.started === 1);
seed({ startOffset: 3, leadDays: 3, email: "" });
res = await (await cronGet(cronReq())).json();
ok("no client email: skipped and named", res.sent === 0 && res.skipped.no_client_email === 1);
seed({ startOffset: null, leadDays: 3 });
res = await (await cronGet(cronReq())).json();
ok("no start date: never a candidate", res.sent === 0 && res.candidates === 0);
seed({ startOffset: 3, leadDays: 3, suppressedAt: new Date() });
res = await (await cronGet(cronReq())).json();
ok("'don't send for this job' is honoured", res.sent === 0 && sent.length === 0);
seed({ startOffset: 3, leadDays: 3 });
rows.job[0].status = "cancelled";
res = await (await cronGet(cronReq())).json();
ok("a cancelled job is not a candidate", res.candidates === 0);
seed({ startOffset: 3, leadDays: 3 });
rows.job[0].historicalImportedAt = new Date();
res = await (await cronGet(cronReq())).json();
ok("a past job entered after the fact is not a candidate", res.candidates === 0);
ok("vercel.json schedules the cron daily in the morning (13:00 UTC)", JSON.parse(readFileSync(repo("vercel.json"), "utf8")).crons.some((c) => c.path === "/api/cron/prep-guides" && c.schedule === "0 13 * * *"));

// ── 7. The job page's controls, against the real routes ────────────────────
section("7. Job-page controls against the real routes");
const params = { params: Promise.resolve({ id: "job1" }) };
const jreq = (method, body) => new Request("http://local/api/jobs/job1/prep-guide", { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
seed({ startOffset: 10, leadDays: 3, language: "en" });
let status = await (await jobGet(jreq("GET"), params)).json();
ok("GET: scheduled, with the due date and the reason", status.willSend === false && status.reason === "not_yet" && status.dueAt && status.leadDays === 3 && status.hasClientEmail === true && status.canSend === true);
ok("GET: names the trades and the language", status.trades.join(",") === "Cabinet Refinishing,Countertop Installation" && status.language === "en");
let r = await jobPatch(jreq("PATCH", { suppressed: true }), params);
status = await r.json();
ok("PATCH suppressed:true → 'don't send' stamped, reason suppressed, activity written", r.status === 200 && status.suppressedAt && status.reason === "suppressed" && writes.some((w) => w.model === "activityLog" && w.data.action === "job.prep_guide_suppressed"));
res = await (await cronGet(cronReq())).json();
ok("…and the cron then skips it", res.sent === 0);
r = await jobPatch(jreq("PATCH", { suppressed: false }), params);
status = await r.json();
ok("PATCH suppressed:false → allowed again", status.suppressedAt === null && status.reason === "not_yet");
ok("PATCH refuses a non-boolean", (await jobPatch(jreq("PATCH", { suppressed: "yes" }), params)).status === 400);
r = await jobPost(jreq("POST"), params);
status = await r.json();
ok("POST 'Send now' sends early, stamps, files, returns the new status", r.status === 200 && status.sentAt && status.result?.sent === true && sent.length === 1 && status.document?.url);
ok("POST activity is attributed to the person", writes.some((w) => w.model === "activityLog" && w.data.action === "job.prep_guide_sent" && w.data.actorUserId === "u1" && w.data.metadata?.i18n?.key === "app.activity.event.prepGuideSent"));
r = await jobPost(jreq("POST"), params);
ok("POST again = 'Send again': a second copy goes, superseding the first", r.status === 200 && sent.length === 2);
seed({ startOffset: 3, email: "" });
r = await jobPost(jreq("POST"), params);
ok("POST with no client email → 409 with a sentence", r.status === 409 && /email address/.test((await r.json()).error));
seed({ startOffset: null });
r = await jobPost(jreq("POST"), params);
ok("POST with no start date → 409 with a sentence", r.status === 409 && /start date/.test((await r.json()).error));
status = await (await jobGet(jreq("GET"), params)).json();
ok("GET with no start date says why", status.reason === "no_start_date");
seed({ startOffset: 3 });
mailState.fail = true;
r = await jobPost(jreq("POST"), params);
ok("POST when the mail fails → 503, stamp released", r.status === 503 && rows.job[0].prepGuideSentAt === null);
seed();
rows.job[0].companyId = "co2";
ok("GET for another company's job → 404", (await jobGet(jreq("GET"), params)).status === 404);

section("7b. The lead-day setting, against the real route");
seed();
const sreq = (method, body) => new Request("http://local/api/settings/prep-guide", { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
ok("GET returns the company's days (3 by default)", (await (await settingsGet(sreq("GET"))).json()).leadDays === 3);
ok("PATCH 0 is stored as 0, not defaulted to 3", (await (await settingsPatch(sreq("PATCH", { leadDays: 0 }))).json()).leadDays === 0 && rows.company[0].prepGuideLeadDays === 0);
ok("PATCH clamps 99 to 30 and -2 to 0", (await (await settingsPatch(sreq("PATCH", { leadDays: 99 }))).json()).leadDays === 30 && (await (await settingsPatch(sreq("PATCH", { leadDays: -2 }))).json()).leadDays === 0);
ok("PATCH refuses a non-number", (await settingsPatch(sreq("PATCH", { leadDays: "soon" }))).status === 400);
ok("PATCH writes activity", writes.some((w) => w.model === "activityLog" && w.data.action === "settings.prep_guide.updated"));
rows.company[0].prepGuideLeadDays = 1;
seed({ startOffset: 1, leadDays: 1 });
res = await (await cronGet(cronReq())).json();
ok("the setting is honoured by the cron (N=1, start tomorrow → sent)", res.sent === 1);

globalThis.fetch = realFetch;

// ── Source assertions for the wiring that cannot be executed here ─────────
section("8. Wiring");
const read = (p) => readFileSync(repo(p), "utf8");
ok("the job page renders the card", /PrepGuideCard/.test(read("app/app/jobs/[id]/JobDetail.js")));
ok("the card's buttons call the real routes", /prep-guide`, \{ method: "POST" \}/.test(read("app/components/jobs/PrepGuideCard.js")) && /method: "PATCH", body: \{ suppressed \}/.test(read("app/components/jobs/PrepGuideCard.js")));
ok("the settings page stages copies per language and sends only what was touched", /prepGuideCopies/.test(read("app/app/settings/services/ServicesEditor.js")) && /prepGuideCopies: c\.prepGuideCopies/.test(read("app/app/settings/services/ServicesEditor.js")));
ok("the service-categories PATCH merges copies per language", /withPrepGuideCopy\(next, lang, copy\)/.test(read("app/api/settings/service-categories/route.js")));
ok("JobDocuments names the prep_guide source", /doc\.source === "prep_guide"/.test(read("app/components/jobs/JobDocuments.js")));
ok("check:all runs this check", /check:prep-guide/.test(read("package.json").match(/"check:all": "([^"]+)"/)[1]));

console.log(`\n${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
