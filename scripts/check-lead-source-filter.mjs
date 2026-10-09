// scripts/check-lead-source-filter.mjs
//
//   npm run check:lead-source-filter
//
// The Leads board's "Agency" badge and source filter (owner, 2026-10-09),
// EXECUTED:
//
//   1. lib/agency/channels.js's board helpers against hostile input — every
//      channel lands in exactly one bucket, an unknown or prototype-shaped
//      word lands in Other, a phone call is Phone, a WhatsApp ad is a Meta ad;
//      a hostile agency key name is cleaned (bidi overrides, zero-width,
//      control characters, markup, 300 characters).
//   2. The shipped GET /api/leads, run against a database stub that honours
//      select/include (scripts/fixtures/prismaShapeStub.mjs): every fixture
//      lead comes back with the bucket channelOf places it in — the agency
//      API's own rule, reading the conversation the lead STARTED on — and an
//      agency lead carries the badge with the key's name, or none for a lead
//      from before the name was recorded.
//   3. The page: the filter is applied with the shared predicate, offers
//      every bucket, labels each in every locale; the badge renders the
//      server's answer with the app's accent tokens, MEASURED in both themes.
//   4. Mutation pass: each change below must fail this check (cp backups).
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/role-access-stub-loader.mjs scripts/check-lead-source-filter.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tables, resetShapeStub } from "./fixtures/prismaShapeStub.mjs";
import { session } from "./fixtures/apiMemberStub.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MUTANT = process.argv.includes("--mutant");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

let pass = 0;
const fails = [];
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    if (!MUTANT) console.log(`  ✓ ${name}`);
  } else {
    fails.push(`${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
    if (!MUTANT) console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (s) => !MUTANT && console.log(`\n${s}`);

const ch = await import("@/lib/agency/channels");
const { PERMISSION_PRESETS } = await import("@/lib/permissions");
const { contrastRatio } = await import("@/lib/brand/colour");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");

// ── 1. The helpers ─────────────────────────────────────────────────────────
section("1. Buckets — every channel in exactly one, hostile words in Other");
{
  const expect = {
    agency_funnel: "agency", facebook_ad: "meta", instagram_ad: "meta", whatsapp_ad: "meta",
    google_ads: "google", website: "website", referral: "referral", organic: "other",
  };
  for (const c of ch.CHANNELS) ok(`${c} → ${expect[c]}`, ch.sourceFilterOf(c, null) === expect[c], ch.sourceFilterOf(c, null));
  ok("every channelOf channel is mapped (none falls through by omission)", ch.CHANNELS.every((c) => expect[c] !== undefined));
  ok("every bucket the board offers is reachable", ch.LEAD_SOURCE_FILTERS.every((b) => [...Object.values(expect), "phone"].includes(b)));
  ok("organic + phone_agent → Phone", ch.sourceFilterOf("organic", "phone_agent") === "phone");
  ok("organic + phone_agent_recovered → Phone", ch.sourceFilterOf("organic", "phone_agent_recovered") === "phone");
  ok("a phone source on a PAID channel stays paid (the ad brought the call)", ch.sourceFilterOf("google_ads", "phone_agent") === "google");
  for (const bad of ["__proto__", "constructor", "toString", "hasOwnProperty", "", "FACEBOOK_AD", null, undefined, 42, {}, []]) {
    ok(`hostile channel ${JSON.stringify(bad)} → Other`, ch.sourceFilterOf(bad, "manual") === "other");
  }
  ok("a phone-ish source that is not the phone line → Other", ch.sourceFilterOf("organic", "Phone_Agent") === "other" && ch.sourceFilterOf("organic", "sms") === "other");
  ok("filter '' passes everything", ch.LEAD_SOURCE_FILTERS.every((b) => ch.passesSourceFilter(b, "")));
  ok("an unknown filter passes everything (never an empty board by typo)", ch.passesSourceFilter("meta", "facebook") && ch.passesSourceFilter("meta", "__proto__"));
  ok("a filter passes its own bucket and no other", ch.LEAD_SOURCE_FILTERS.every((f) => ch.LEAD_SOURCE_FILTERS.every((b) => ch.passesSourceFilter(b, f) === (b === f))));
  ok("…so the buckets PARTITION the board: each lead passes exactly one filter",
    ch.LEAD_SOURCE_FILTERS.every((b) => ch.LEAD_SOURCE_FILTERS.filter((f) => ch.passesSourceFilter(b, f)).length === 1));
}

section("1b. The agency badge — the key's name, cleaned; nothing invented");
{
  const lead = (intake, source = "agency_funnel") => ({ source, intake });
  ok("no badge on a lead the agency did not send", ch.agencyBadgeOf(lead({ agencyKey: { name: "X" } }, "self_quote")) === null);
  ok("no badge on junk", ch.agencyBadgeOf(null) === null && ch.agencyBadgeOf("agency_funnel") === null && ch.agencyBadgeOf([]) === null);
  ok("named badge from the stamp", ch.agencyBadgeOf(lead({ agencyKey: { id: "k1", name: "Forward Media Marketing" } }))?.name === "Forward Media Marketing");
  ok("an older lead: badge, no name", JSON.stringify(ch.agencyBadgeOf(lead({ capturedBy: "agency_funnel" }))) === '{"name":null}');
  ok("a null intake: badge, no name", ch.agencyBadgeOf(lead(null))?.name === null);
  ok("an array intake: badge, no name", ch.agencyBadgeOf(lead([{ agencyKey: { name: "X" } }]))?.name === null);
  ok("a stamp that is a string: no name", ch.agencyBadgeOf(lead({ agencyKey: "Forward" }))?.name === null);
  ok("a name that is not a string: no name", ch.agencyBadgeOf(lead({ agencyKey: { name: { toString: () => "x" } } }))?.name === null);
  const evil = ch.cleanAgencyKeyName("\u202Eevil\u200B <script>alert(1)</script>\u0007\n Media");
  ok("bidi override, zero-width, control chars and angle brackets removed", !/[\u202A-\u202E\u200B-\u200F\u0000-\u001f<>]/.test(evil), evil);
  ok("…the words survive", /evil/.test(evil) && /Media/.test(evil) && /script/.test(evil));
  ok("whitespace collapsed and trimmed", ch.cleanAgencyKeyName("  Forward   Media  ") === "Forward Media");
  ok("at most 80 characters", ch.cleanAgencyKeyName("x".repeat(300)).length === 80);
  ok("an all-junk name is no name", ch.cleanAgencyKeyName("\u202E\u200B\u0000 ") === null && ch.cleanAgencyKeyName("") === null);
  ok("NFC: a decomposed é is stored composed", ch.cleanAgencyKeyName("Média") === "Média");
  const stamp = ch.agencyKeyStamp({ id: "k_1", name: "Pulse", secret: "fqa_secret", keyHash: "abc", scopes: ["marketing:read"] });
  ok("the stamp carries id and name only — never the secret, hash or scopes", JSON.stringify(stamp) === '{"id":"k_1","name":"Pulse"}', stamp);
  ok("a hostile id is dropped", ch.agencyKeyStamp({ id: "../../x'; drop", name: "Pulse" })?.id === null);
  ok("no key, no stamp", ch.agencyKeyStamp(null) === null && ch.agencyKeyStamp({}) === null);
}

section("1c. The conversation a lead came from is the EARLIEST one");
{
  const late = { id: "t2", firstInboundAt: new Date("2026-09-02") };
  const early = { id: "t1", firstInboundAt: new Date("2026-09-01") };
  ok("earliest wins whatever the order", ch.originThreadOf([late, early])?.id === "t1" && ch.originThreadOf([early, late])?.id === "t1");
  ok("createdAt when firstInboundAt is missing", ch.originThreadOf([{ id: "a", createdAt: new Date("2026-09-03") }, { id: "b", createdAt: new Date("2026-08-01") }])?.id === "b");
  ok("junk in the list is ignored; none → null", ch.originThreadOf([null, 1, "x"]) === null && ch.originThreadOf(undefined) === null);
  ok("an invalid date sorts first rather than throwing", Boolean(ch.originThreadOf([{ id: "a", firstInboundAt: "nonsense" }, early])));
  // The thread view leadFacts.js used to build inline, rebuilt from the same
  // three facts — the two must agree on every shape, or the board and the
  // agency API would place one lead in two places.
  const inline = (thread, platform) => {
    const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
    const q = obj(obj(thread.leadCapture)?.qualification);
    return { platform: platform || null, origin: q?.origin === "ad" ? "ad" : obj(thread.adReferral) ? "ad" : null };
  };
  const shapes = [
    {}, { adReferral: { adId: "1" } }, { adReferral: [] }, { adReferral: "x" }, { leadCapture: { qualification: { origin: "ad" } } },
    { leadCapture: { qualification: { origin: "organic" } } }, { leadCapture: "junk" }, { leadCapture: { qualification: [] } },
  ];
  ok("threadViewOf agrees with the old inline view on every shape",
    shapes.every((t) => ["instagram", "whatsapp", null].every((p) => {
      const a = ch.threadViewOf(t, p);
      const b = inline(t, p);
      return a.platform === b.platform && a.origin === b.origin;
    })));
  ok("…and channelOf reads both the same", shapes.every((t) => ch.channelOf({ source: "meta_messenger" }, ch.threadViewOf(t, "instagram")) === ch.channelOf({ source: "meta_messenger" }, { ...inline(t, "instagram"), adReferral: t.adReferral })));
  ok("lib/agency/leadFacts.js builds its thread view with threadViewOf (one copy)",
    /threadViewOf\(thread, platformOf\.get\(thread\.channelId\)\)/.test(decomment(read("lib/agency/leadFacts.js"))) &&
    !/origin: q\?\.origin === "ad"/.test(decomment(read("lib/agency/leadFacts.js"))));
}

// ── 2. GET /api/leads, executed ────────────────────────────────────────────
section("2. GET /api/leads places every fixture lead (shipped route, executed)");
const CO = "co1";
const t = (iso) => new Date(iso);
const EST = {
  id: "m_est", userId: "u_est", companyId: CO, role: "employee", active: true,
  // An Estimator with the pricing toggle off, so the money half of the route
  // (the price book) stays out of a check about channels.
  permissions: { ...PERMISSION_PRESETS.estimator.values, showPricing: false },
};
function lead(id, source, extra = {}) {
  return {
    id, companyId: CO, name: `Lead ${id}`, email: null, phone: null, message: null, status: "new", source,
    createdAt: t("2026-09-20T12:00:00Z"), updatedAt: t("2026-09-20T12:00:00Z"), intake: null, attribution: null,
    metaLeadId: null, metaCampaignId: null, metaCampaignName: null, temperature: null, score: null, quoteId: null,
    category: null, assignedTo: null, quote: null, conversationEvidence: null, ...extra,
  };
}
const LEADS = [
  lead("agency_named", "agency_funnel", { intake: { capturedBy: "agency_funnel", agencyKey: { id: "k1", name: "Forward Media Marketing" } }, attribution: { source: "agency_funnel", clickNetwork: "facebook", fbc: "fb.1.1.IwAR0abcdefgh" } }),
  lead("agency_old", "agency_funnel", { intake: { capturedBy: "agency_funnel" } }),
  lead("agency_evil", "agency_funnel", { intake: { agencyKey: { id: "k2", name: `\u202E${"x".repeat(200)}<b>` } } }),
  lead("meta_form", "meta_lead_form", { metaLeadId: "ml_1" }),
  lead("ig_ad", "meta_instagram"),
  lead("wa_ad", "meta_whatsapp"),
  lead("fb_organic", "meta_messenger"),
  lead("two_threads", "meta_instagram"),
  lead("gclid", "self_quote", { attribution: { gclid: "Cj0KCQ_abc", source: "google" } }),
  lead("web", "self_quote"),
  lead("funnel_web", "funnel:facebook"),
  lead("referral", "referral"),
  lead("phone", "phone_agent"),
  lead("phone_rec", "phone_agent_recovered"),
  lead("manual", "manual"),
  lead("unknown", "x<y>"),
  lead("nosource", null),
  lead("attr_array", "self_quote", { attribution: [{ gclid: "x" }] }),
  lead("attr_string", "self_quote", { attribution: "gclid=abc" }),
  { ...lead("other_company", "agency_funnel", { intake: { agencyKey: { name: "Leak" } } }), companyId: "co2" },
];
const EXPECT = {
  agency_named: "agency", agency_old: "agency", agency_evil: "agency", meta_form: "meta", ig_ad: "meta", wa_ad: "meta",
  fb_organic: "other", two_threads: "meta", gclid: "google", web: "website", funnel_web: "website", referral: "referral",
  phone: "phone", phone_rec: "phone", manual: "other", unknown: "other", nosource: "other", attr_array: "website", attr_string: "website",
};
function seed() {
  resetShapeStub();
  tables.company = [{ id: CO, name: "Tremblay Painting", currency: "USD" }];
  tables.member = [EST];
  tables.leadRequest = LEADS.map((l) => ({ ...l }));
  tables.messagingChannel = [
    { id: "ch_ig", companyId: CO, platform: "instagram" },
    { id: "ch_wa", companyId: CO, platform: "whatsapp" },
    { id: "ch_fb", companyId: CO, platform: "facebook" },
  ];
  tables.messageThread = [
    { id: "th_ig", companyId: CO, leadId: "ig_ad", channelId: "ch_ig", createdAt: t("2026-09-19T10:00:00Z"), firstInboundAt: t("2026-09-19T10:00:00Z"), adReferral: { adId: "123", at: "2026-09-19T10:00:00Z" }, leadCapture: null },
    { id: "th_wa", companyId: CO, leadId: "wa_ad", channelId: "ch_wa", createdAt: t("2026-09-19T10:00:00Z"), firstInboundAt: t("2026-09-19T10:00:00Z"), adReferral: null, leadCapture: { qualification: { origin: "ad" } } },
    { id: "th_fb", companyId: CO, leadId: "fb_organic", channelId: "ch_fb", createdAt: t("2026-09-19T10:00:00Z"), firstInboundAt: t("2026-09-19T10:00:00Z"), adReferral: null, leadCapture: { qualification: { origin: "organic" } } },
    // Listed LATEST first: a route that took the first row it met, rather than
    // the conversation the lead began on, would read this lead as organic.
    { id: "th_late", companyId: CO, leadId: "two_threads", channelId: "ch_ig", createdAt: t("2026-09-25T10:00:00Z"), firstInboundAt: t("2026-09-25T10:00:00Z"), adReferral: null, leadCapture: { qualification: { origin: "organic" } } },
    { id: "th_early", companyId: CO, leadId: "two_threads", channelId: "ch_ig", createdAt: t("2026-09-18T10:00:00Z"), firstInboundAt: t("2026-09-18T10:00:00Z"), adReferral: { adId: "9" }, leadCapture: null },
  ];
  tables.callConsent = [];
  tables.task = [];
  tables.quote = [];
  tables.client = [];
}
seed();
session.member = { id: EST.id, userId: EST.userId, companyId: CO, role: EST.role };
let body = null;
try {
  const { GET } = await import("@/app/api/leads/route.js");
  const res = await GET(new Request("https://app.fieldquo.com/api/leads?sort=recent"));
  body = await res.json();
  ok("200 with a list", res.status === 200 && Array.isArray(body), res.status);
} catch (err) {
  ok("GET /api/leads runs against the stub", false, String(err?.stack || err).slice(0, 400));
}
const byId = new Map((Array.isArray(body) ? body : []).map((l) => [l.id, l]));
for (const [id, bucket] of Object.entries(EXPECT)) {
  ok(`${id} → ${bucket}`, byId.get(id)?.sourceFilter === bucket, byId.get(id) && { channel: byId.get(id).channel, sourceFilter: byId.get(id).sourceFilter });
}
ok("another company's lead is not on the board", !byId.has("other_company"));
ok("the named agency lead carries the key's name", byId.get("agency_named")?.agency?.name === "Forward Media Marketing", byId.get("agency_named")?.agency);
ok("the older agency lead: badge, no name", byId.get("agency_old")?.agency && byId.get("agency_old").agency.name === null, byId.get("agency_old")?.agency);
ok("a hostile name arrives cleaned and capped", byId.get("agency_evil")?.agency?.name?.length === 80 && !/[\u202E<>]/.test(byId.get("agency_evil").agency.name));
ok("no badge on any lead the agency did not send", [...byId.values()].filter((l) => l.source !== "agency_funnel").every((l) => l.agency === null));
ok("channel is channelOf's word (meta_form → facebook_ad, wa_ad → whatsapp_ad)", byId.get("meta_form")?.channel === "facebook_ad" && byId.get("wa_ad")?.channel === "whatsapp_ad");
ok("the badge rides through redactLead untouched (it is not contact data)", "agency" in (byId.get("agency_named") || {}));

// ── 3. The page ────────────────────────────────────────────────────────────
section("3. The board: the shared predicate, every bucket labelled, the badge measured");
{
  const page = decomment(read("app/app/leads/page.js"));
  ok("filters with passesSourceFilter(l.sourceFilter, sourceFilter)", /passesSourceFilter\(l\.sourceFilter, sourceFilter\)/.test(page));
  ok("…inside the memo the board renders from", /const shown = useMemo\([\s\S]{0,200}passesSourceFilter/.test(page));
  ok("the select lists LEAD_SOURCE_FILTERS after an All option", /<option value="">\{t\("app\.agencyMetrics\.source\.all"\)\}<\/option>[\s\S]{0,80}LEAD_SOURCE_FILTERS\.map/.test(page));
  const labels = Object.fromEntries([...page.matchAll(/^\s+(\w+): "(app\.[\w.]+)",$/gm)].filter(([, k]) => ch.LEAD_SOURCE_FILTERS.includes(k)).map(([, k, v]) => [k, v]));
  ok("every bucket has a label key", ch.LEAD_SOURCE_FILTERS.every((b) => labels[b]), labels);
  const missing = [];
  for (const [code, dict] of Object.entries(APP_MESSAGES)) {
    for (const key of [...Object.values(labels), "app.agencyMetrics.source.all", "app.leads.sourceFilter.label", "app.leads.agencyBadge.label", "app.leads.agencyBadge.from", "app.leads.source.agency_funnel"]) {
      if (!(key in dict)) missing.push(`${code}:${key}`);
    }
  }
  ok("…in every app locale, with the badge's two strings", missing.length === 0, missing);
  ok("the {name} placeholder survives in every locale", Object.values(APP_MESSAGES).every((d) => /\{name\}/.test(d["app.leads.agencyBadge.from"] || "")));
  ok("the card renders the SERVER's badge (lead.agency), not a re-derivation", /\{lead\.agency && <AgencyBadge agency=\{lead\.agency\}/.test(page));
  ok("the badge uses the app's accent tokens", /data-agency-badge[\s\S]{0,200}bg-accent text-accent-foreground/.test(page));
  ok("the name is printed as text (no dangerouslySetInnerHTML anywhere near it)", !/dangerouslySetInnerHTML/.test(page.slice(page.indexOf("function AgencyBadge"), page.indexOf("function LeadCard"))));

  // Measured, not assumed — app/globals.css, both themes.
  const css = read("app/globals.css");
  const tokens = (selector) => {
    const start = css.indexOf(selector);
    const body = css.slice(css.indexOf("{", start), css.indexOf("\n}", start));
    return Object.fromEntries([...body.matchAll(/(--[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
  };
  for (const [theme, sel] of [["light", ":root {"], ["dark", ".dark {"]]) {
    const tk = tokens(sel);
    const r = contrastRatio(tk["--accent-foreground"], tk["--accent"]);
    ok(`${theme}: badge text on badge fill ${r.toFixed(2)}:1 ≥ 4.5`, r >= 4.5, { fg: tk["--accent-foreground"], bg: tk["--accent"] });
  }
}

section("3b. The route places leads with the agency API's rule, not a copy");
{
  const route = decomment(read("app/api/leads/route.js"));
  ok("imports channelOf from lib/agency/channels.js", /import \{[^}]*channelOf[^}]*\} from "@\/lib\/agency\/channels"/.test(route));
  ok("defines no channel rule of its own (no gclid / clickNetwork logic)", !/gclid|clickNetwork|utmMedium/.test(route));
  ok("reads the conversation the lead began on (originThreadOf)", /originThreadOf\(threadsByLead\.get\(l\.id\)\)/.test(route));
}

// ── 4. Mutation pass ───────────────────────────────────────────────────────
if (!MUTANT && fails.length) console.log("\nMutation pass skipped: the baseline fails.");
if (!MUTANT && !fails.length) {
  console.log("\nMutation pass — each change must fail this check");
  const MUTATIONS = [
    ["lib/agency/channels.js", "phone not split from organic", 'if (bucket === "other" && typeof source === "string" && PHONE_SOURCES.includes(source)) return "phone";', ""],
    ["lib/agency/channels.js", "a WhatsApp ad filed under Other", '  whatsapp_ad: "meta",', '  whatsapp_ad: "other",'],
    ["lib/agency/channels.js", "the filter lets everything through", "  return bucket === filter;", "  return true;"],
    ["lib/agency/channels.js", "bidi overrides kept in the name", "\\u202a-\\u202e", "\\u202f-\\u202f"],
    ["lib/agency/channels.js", "a badge on every lead", 'lead.source !== "agency_funnel") return null;', "false) return null;"],
    ["lib/agency/channels.js", "prototype lookup on the bucket map", "Object.prototype.hasOwnProperty.call(BUCKET_OF_CHANNEL, channel) ? BUCKET_OF_CHANNEL[channel] : \"other\"", "BUCKET_OF_CHANNEL[channel] || \"other\""],
    ["app/api/leads/route.js", "the latest conversation instead of the first", "const origin = originThreadOf(threadsByLead.get(l.id)) || threadForLead.get(l.id) || null;", "const origin = threadForLead.get(l.id) || null;"],
    ["app/api/leads/route.js", "the badge dropped", "agency: agencyBadgeOf(l) };", "agency: null };"],
    ["app/app/leads/page.js", "the board ignores the filter", "passesSourceFilter(l.sourceFilter, sourceFilter)", "true"],
  ];
  const backupDir = join(ROOT, ".mutation-backup-lead-source-filter");
  mkdirSync(backupDir, { recursive: true });
  const escaped = [];
  try {
    for (const [file, label, from, to] of MUTATIONS) {
      const path = join(ROOT, file);
      const backup = join(backupDir, file.replace(/\//g, "__"));
      copyFileSync(path, backup);
      const original = readFileSync(path, "utf8");
      if (!original.includes(from)) {
        escaped.push(`${label} — mutation target not found`);
        continue;
      }
      writeFileSync(path, original.replace(from, to));
      let survived = false;
      try {
        execFileSync(process.execPath, ["--import", "./scripts/alias-loader.mjs", "--import", "./scripts/role-access-stub-loader.mjs", "scripts/check-lead-source-filter.mjs", "--mutant"], { cwd: ROOT, stdio: "pipe" });
        survived = true;
      } catch {
        survived = false;
      } finally {
        copyFileSync(backup, path);
      }
      if (survived) escaped.push(`${label} — NOT caught`);
      else console.log(`  ✓ caught: ${label}`);
    }
  } finally {
    rmSync(backupDir, { recursive: true, force: true });
  }
  ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
}

if (!MUTANT) console.log(fails.length ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n  ${fails.join("\n  ")}` : `\nPASSED — ${pass}/${pass} assertions`);
process.exit(fails.length ? 1 : 0);
