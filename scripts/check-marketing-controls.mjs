// scripts/check-marketing-controls.mjs
//
//   npm run check:marketing-controls
//
// Four controls in the marketing / website / funnel area that the help-centre
// writers found by reading the code, each of which appeared to work and did
// not:
//
//   1. The website had no Unpublish. DELETE /api/settings/website existed with
//      no caller, and the cancel flow told people to "unpublish the site
//      first". The builder now calls it, behind a confirm, and the route still
//      only clears `published` — content survives.
//   2. The website's three routes disagreed about who may edit it (user:manage
//      on the parent, owner/admin on languages/ and photos/) while the sidebar
//      showed the row to a supervisor. One rule now: lib/site/access.js.
//   3. Funnel pixel ids were saved and served and never injected. They are
//      injected only when set and well-formed, and a Lead event fires once the
//      submit route has accepted the contact.
//   4. No screen ever wrote a campaign's status ("active" was never written),
//      DELETE had no caller and would have cascaded the doorstep record, and
//      Budget reached nothing. Activate / Pause / Archive / Restore exist on
//      the list and the detail, DELETE is gone, and Budget sits beside Spent
//      on the Spend page.
//
// Every module is EXECUTED against fixtures — the pixel snippets, the status
// table, the budget rollup, the access predicate — and the wiring is read out
// of the source files so a refactor that leaves the module intact and drops
// the call fails here too.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-marketing-controls.mjs

import { readFileSync } from "node:fs";

import { isWebsiteAdmin } from "@/lib/site/access";
import { SETTINGS_ROW_CAPABILITY } from "@/lib/permissions/settingsAccess";
import { validPixelIds, pixelScripts, fireLeadEvents } from "@/lib/funnels/pixels";
import { campaignActions, canSetStatus, isArchived, SETTABLE_STATUSES, STATUS_LABEL_KEY } from "@/lib/marketing/campaignStatus";
import { campaignBudgets, channelsWithBudgets, CAMPAIGN_TYPE_TO_PLATFORM } from "@/lib/analytics/campaignBudgets";
import { siteGaps } from "@/lib/site/gaps";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
const read = (p) => readFileSync(p, "utf8");
const LANGS = Object.keys(APP_MESSAGES);

// Comment bodies blanked so a header that DESCRIBES the old bug cannot satisfy
// a scan looking for the fix.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, "");
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n1. Website: one access rule, and it is owner/admin\n");
{
  for (const role of ["owner", "admin"]) ok(`${role} may change the website`, isWebsiteAdmin(role) === true);
  for (const role of ["supervisor", "employee", "viewer", "", undefined, null])
    ok(`${JSON.stringify(role)} may not`, isWebsiteAdmin(role) === false);
  ok("the sidebar row says the same thing", SETTINGS_ROW_CAPABILITY["app.settings.website"] === "owner-admin",
    SETTINGS_ROW_CAPABILITY["app.settings.website"]);
  for (const file of [
    "app/api/settings/website/route.js",
    "app/api/settings/website/languages/route.js",
    "app/api/settings/website/photos/route.js",
  ]) {
    const src = stripComments(read(file));
    ok(`${file} gates on isWebsiteAdmin`, /isWebsiteAdmin\(member\.role\)/.test(src));
    ok(`…and not on user:manage`, !/requirePermission\([^)]*"user:manage"/.test(src));
    ok(`…and carries no local isAdmin copy`, !/function isAdmin\(/.test(src));
  }
  const check = read("scripts/check-settings-access.mjs");
  ok("check:settings-access asserts the new expression on all three routes",
    (check.match(/isWebsiteAdmin\(member\.role\)/g) || []).length === 3);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n2. Website: Unpublish exists, confirms, and deletes nothing\n");
{
  const builder = stripComments(read("app/app/settings/website/Builder.js"));
  const del = builder.match(/fetchJson\("\/api\/settings\/website",\s*\{\s*method:\s*"DELETE"\s*\}\)/);
  ok("Builder.js calls DELETE /api/settings/website", Boolean(del));
  ok("…from a function the confirm dialog reaches", /onClick=\{unpublish\}/.test(builder));
  ok("…and the button only shows for a published site", /site\?\.published && \([\s\S]{0,200}setConfirmUnpublish\(true\)/.test(builder));
  ok("…behind a dialog that says nothing is deleted", /app\.siteBuilder\.unpublishKept/.test(builder));
  const route = stripComments(read("app/api/settings/website/route.js"));
  const body = route.slice(route.indexOf("export async function DELETE"));
  ok("the route's DELETE clears `published` only", /published:\s*false/.test(body) && !/\.delete\(|deleteMany\(/.test(body));
  ok("…and is closed to impersonation (no read carve-out)", !/read:\s*true/.test(body));
  const site = read("app/site/[subdomain]/page.js");
  ok("the public page already answers an unpublished site", /[Uu]npublished/.test(site));
  for (const key of [
    "app.siteBuilder.unpublish", "app.siteBuilder.unpublished", "app.siteBuilder.unpublishTitle",
    "app.siteBuilder.unpublishBody", "app.siteBuilder.unpublishKept", "app.siteBuilder.unpublishRepublish",
    "app.siteBuilder.keepItLive", "app.siteBuilder.unpublishConfirm",
  ]) {
    ok(`${key} in ${LANGS.length} languages`, LANGS.every((l) => typeof APP_MESSAGES[l][key] === "string"));
  }
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n3. Funnel pixels: injected when set, nothing when not, Lead on completion\n");
{
  const none = pixelScripts({ meta: null, tiktok: null, ga4: null });
  ok("no ids → no scripts", Array.isArray(none) && none.length === 0, none);
  ok("undefined pixels → no scripts", pixelScripts(undefined).length === 0);

  const all = pixelScripts({ meta: "123456789012345", ga4: "G-ABC123XYZ", tiktok: "CABC123DEF456GH" });
  ok("all three set → four tags (Meta, GA4 src + init, TikTok)", all.length === 4, all.map((t) => t.key));
  ok("Meta tag inits the id and tracks PageView",
    all.some((t) => t.key === "meta-base" && t.inline.includes("fbq('init','123456789012345')") && t.inline.includes("'PageView'")));
  ok("GA4 loads gtag.js for the id and configs it",
    all.some((t) => t.key === "ga4-src" && t.src === "https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ") &&
    all.some((t) => t.key === "ga4-init" && t.inline.includes("gtag('config','G-ABC123XYZ')")));
  ok("TikTok loads the id and records a page",
    all.some((t) => t.key === "tiktok-base" && t.inline.includes("ttq.load('CABC123DEF456GH')") && t.inline.includes("ttq.page()")));

  const one = pixelScripts({ meta: "123456789012345" });
  ok("one id → only that platform", one.length === 1 && one[0].key === "meta-base", one.map((t) => t.key));

  // Hostile ids: the field is free text on write.
  const hostile = validPixelIds({
    meta: "1234'); alert(1); ('",
    ga4: "G-<script>",
    tiktok: "abc def",
  });
  ok("a Meta id with quotes is dropped", hostile.meta === null, hostile);
  ok("a GA4 id with markup is dropped", hostile.ga4 === null, hostile);
  ok("a TikTok id with a space is dropped", hostile.tiktok === null, hostile);
  ok("…so hostile ids inject nothing", pixelScripts({ meta: "1');x('", ga4: "G-<b>", tiktok: "a b" }).length === 0);
  ok("a lower-case GA4 id is upper-cased, not dropped", validPixelIds({ ga4: "g-abc123xyz" }).ga4 === "G-ABC123XYZ");
  ok("a Meta id that is too short is dropped", validPixelIds({ meta: "1234" }).meta === null);
  for (const tag of all) {
    if (tag.inline) ok(`${tag.key}: the inline code carries no </script>`, !/<\/script/i.test(tag.inline));
  }

  // Completion: the event fires on whichever globals the platforms defined.
  const calls = [];
  const win = {
    fbq: (...a) => calls.push(["fbq", ...a]),
    gtag: (...a) => calls.push(["gtag", ...a]),
    ttq: { track: (...a) => calls.push(["ttq", ...a]) },
  };
  const fired = fireLeadEvents({ meta: "123456789012345", ga4: "G-ABC123XYZ", tiktok: "CABC123DEF456GH" }, win);
  ok("completion fires Meta Lead, GA4 generate_lead, TikTok SubmitForm",
    fired.join(",") === "meta:Lead,ga4:generate_lead,tiktok:SubmitForm", fired);
  ok("…as real calls on the platform globals",
    calls.some((c) => c[0] === "fbq" && c[1] === "track" && c[2] === "Lead") &&
    calls.some((c) => c[0] === "gtag" && c[1] === "event" && c[2] === "generate_lead") &&
    calls.some((c) => c[0] === "ttq" && c[1] === "SubmitForm"));
  ok("…with no visitor details in any payload",
    calls.every((c) => !JSON.stringify(c.slice(1)).match(/@|phone|email|name/i)));
  ok("no ids → nothing fires even when the globals exist", fireLeadEvents({}, win).length === 0);
  ok("ids set but scripts never loaded → nothing fires, nothing throws", fireLeadEvents({ meta: "123456789012345" }, {}).length === 0);
  const throwing = { fbq: () => { throw new Error("boom"); } };
  ok("a platform script that throws is swallowed", fireLeadEvents({ meta: "123456789012345" }, throwing).length === 0);

  const runner = stripComments(read("app/f/[companySlug]/[funnelSlug]/FunnelRunner.js"));
  ok("FunnelRunner injects pixelScripts(...) into document.head",
    /pixelScripts\(pixels\)/.test(runner) && /document\.head\.appendChild/.test(runner));
  ok("…guarded against a second injection", /data-fq-pixel/.test(runner));
  const submit = runner.slice(runner.indexOf("async function submit"));
  const okIdx = submit.indexOf("if (!res.ok) throw");
  const fireIdx = submit.indexOf("fireLeadEvents(pixels)");
  ok("…and fires the Lead event only after the submit route accepted", okIdx > 0 && fireIdx > okIdx);
  const api = read("app/api/funnels/public/[companySlug]/[funnelSlug]/route.js");
  ok("the public API still serves the ids under funnel.pixels", /pixels:\s*\{[\s\S]*meta:[\s\S]*tiktok:[\s\S]*ga4:/.test(api));
  const builder = read("app/app/funnels/[id]/page.js");
  ok("the builder's pixel panel says what the ids do and that no consent banner is added",
    /app\.funnels\.pixelsNote/.test(builder));
  ok("…in every language", LANGS.every((l) => typeof APP_MESSAGES[l]["app.funnels.pixelsNote"] === "string"));
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n4. Campaign status: a person writes it, and DELETE is gone\n");
{
  const p = (status, type = "pamphlet") => ({ id: "c1", status, type });
  const acts = (c) => campaignActions(c).map((a) => `${a.action}→${a.to}`).join(" ");
  ok("draft pamphlet: Activate, Archive", acts(p("draft")) === "activate→active archive→archived", acts(p("draft")));
  ok("active pamphlet: Pause, Archive", acts(p("active")) === "pause→paused archive→archived", acts(p("active")));
  ok("paused pamphlet: Resume, Archive", acts(p("paused")) === "resume→active archive→archived", acts(p("paused")));
  ok("completed: Archive only", acts(p("completed")) === "archive→archived", acts(p("completed")));
  ok("partial: Archive only", acts(p("partial", "email")) === "archive→archived");
  ok("archived: Restore only (to draft)", acts(p("archived")) === "restore→draft", acts(p("archived")));
  ok("draft EMAIL: Archive only — sending is the act", acts(p("draft", "email")) === "archive→archived", acts(p("draft", "email")));
  ok("meta_ads and other get Activate like a pamphlet",
    acts(p("draft", "meta_ads")).startsWith("activate") && acts(p("draft", "other")).startsWith("activate"));
  ok("null campaign → no actions, no throw", campaignActions(null).length === 0);

  ok("a browser may not set completed", !canSetStatus(p("draft"), "completed") && !SETTABLE_STATUSES.includes("completed"));
  ok("…or partial", !canSetStatus(p("active"), "partial"));
  ok("…or make an email campaign active", !canSetStatus(p("draft", "email"), "active"));
  ok("…or skip draft → paused", !canSetStatus(p("draft"), "paused"));
  ok("draft → active is allowed", canSetStatus(p("draft"), "active"));
  ok("anything → archived is allowed", ["draft", "active", "paused", "completed", "partial"].every((s) => canSetStatus(p(s), "archived")));
  ok("archived → draft is the restore", canSetStatus(p("archived"), "draft") && !canSetStatus(p("archived"), "active"));
  ok("a garbage status is refused", !canSetStatus(p("draft"), "deleted") && !canSetStatus(p("draft"), ""));
  ok("isArchived reads the status", isArchived(p("archived")) && !isArchived(p("draft")) && !isArchived(null));

  const schema = read("prisma/schema.prisma");
  const enumBody = schema.slice(schema.indexOf("enum MarketingCampaignStatus {"));
  const closing = enumBody.indexOf("\n}");
  const members = enumBody.slice(0, closing).split("\n").slice(1).map((l) => l.trim()).filter((l) => l && !l.startsWith("///"));
  ok("the enum carries paused and archived", members.includes("paused") && members.includes("archived"), members);
  ok("every enum member has a chip label key", members.every((m) => STATUS_LABEL_KEY[m]), members);
  ok("…in every language", members.every((m) => LANGS.every((l) => typeof APP_MESSAGES[l][STATUS_LABEL_KEY[m]] === "string")));
  for (const a of ["activate", "resume", "pause", "archive", "restore"]) {
    ok(`app.marketing.action.${a} in every language`, LANGS.every((l) => typeof APP_MESSAGES[l][`app.marketing.action.${a}`] === "string"));
  }

  const route = stripComments(read("app/api/marketing/campaigns/[id]/route.js"));
  ok("PATCH checks the transition against the same table", /canSetStatus\(existing,\s*status\)/.test(route));
  ok("the DELETE handler is gone", !/export async function DELETE/.test(route));
  ok("…and nothing deletes a campaign row", !/marketingCampaign\.delete/.test(route));
  const sendRoute = stripComments(read("app/api/marketing/campaigns/[id]/send/route.js"));
  ok("the send route is still the only writer of completed/partial",
    /status:\s*"completed"/.test(sendRoute) && /status:\s*"partial"/.test(sendRoute) &&
    !/"completed"|"partial"/.test(route.replace(/canSetStatus[\s\S]*?\)/, "")));

  const list = stripComments(read("app/app/marketing/page.js"));
  const detail = stripComments(read("app/app/marketing/[id]/page.js"));
  const comp = stripComments(read("app/components/marketing/CampaignStatus.js"));
  ok("the list renders the shared actions", /<CampaignStatusActions/.test(list));
  ok("…and so does the detail, for pamphlet and email alike", (detail.match(/<CampaignStatusActions/g) || []).length === 2);
  ok("the shared row PATCHes the status only", /method:\s*"PATCH"[\s\S]{0,120}JSON\.stringify\(\{\s*status:\s*a\.to\s*\}\)/.test(comp));
  ok("…and archive asks first", /confirmArchive/.test(comp) && /app\.marketing\.archiveConfirm/.test(comp));
  ok("the chip reads the catalogue label, not the raw enum",
    /STATUS_LABEL_KEY\[c\.status\]/.test(list) && /STATUS_LABEL_KEY\[status\]/.test(detail) && !/\{c\.status\}\s*<\/span>/.test(list));
  ok("the list hides archived campaigns behind a toggle", /showArchived \|\| !isArchived\(c\)/.test(list) && /app\.marketing\.showArchived/.test(list));
  ok("nothing in the app calls DELETE on a campaign",
    !/api\/marketing\/campaigns\/\$\{[^}]+\}`,\s*\{\s*method:\s*"DELETE"/.test(list + detail + comp + read("app/components/marketing/EmailCampaignDetail.js")));
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n5. Budget reaches the Spend page, labelled, and touches no total\n");
{
  const rows = [
    { id: "a", name: "Spring flyers", type: "pamphlet", status: "active", budget: "1200.00" },
    { id: "b", name: "Meta spring", type: "meta_ads", status: "draft", budget: 1500 },
    { id: "c", name: "Newsletter", type: "email", status: "completed", budget: 50 },
    { id: "d", name: "Old flyers", type: "pamphlet", status: "archived", budget: 999 },
    { id: "e", name: "No budget", type: "pamphlet", status: "active", budget: null },
    { id: "f", name: "Bad budget", type: "other", status: "active", budget: "abc" },
    { id: "g", name: "Negative", type: "other", status: "active", budget: -5 },
  ];
  const b = campaignBudgets(rows);
  ok("pamphlet → pamphlet channel", b.byPlatform.pamphlet?.budgeted === 1200, b.byPlatform);
  ok("meta_ads → facebook channel", b.byPlatform.facebook?.budgeted === 1500, b.byPlatform);
  ok("email → other (the platform enum has no email)", b.byPlatform.other?.budgeted === 50 && CAMPAIGN_TYPE_TO_PLATFORM.email === "other");
  ok("archived campaigns are excluded", !b.campaigns.some((c) => c.id === "d"));
  ok("null, non-numeric and negative budgets are excluded", !b.campaigns.some((c) => ["e", "f", "g"].includes(c.id)));
  ok("the total is the live budgets only", b.total === 2750, b.total);
  ok("Decimal-as-string budgets are numbers on the way out", b.campaigns.find((c) => c.id === "a").budget === 1200);
  ok("empty input → empty, no throw", campaignBudgets(undefined).total === 0 && campaignBudgets([]).campaigns.length === 0);

  const channels = [
    { platform: "pamphlet", spend: 340, leads: 4, costPerLead: 85, approximate: false, convertedFrom: [] },
    { platform: "google", spend: 200, leads: 0, costPerLead: null, approximate: false, convertedFrom: [] },
  ];
  const merged = channelsWithBudgets(channels, b);
  const pam = merged.find((c) => c.platform === "pamphlet");
  ok("a channel with spend gains its budget", pam.budgeted === 1200 && pam.budgetedCampaigns === 1, pam);
  ok("…and keeps its spend, leads and rate untouched", pam.spend === 340 && pam.leads === 4 && pam.costPerLead === 85);
  ok("a channel with spend and no budget reads null, not 0", merged.find((c) => c.platform === "google").budgeted === null);
  const fb = merged.find((c) => c.platform === "facebook");
  ok("a budget with no spend yet gets its own row, flagged", fb && fb.budgetOnly === true && fb.spend === 0 && fb.budgeted === 1500, fb);
  ok("budget-only rows carry null rates, never 0", fb.costPerLead === null && fb.costPerConversion === null);
  ok("no channels at all → just the budget rows", channelsWithBudgets(undefined, b).length === 3);
  ok("no budgets → channels unchanged apart from budgeted: null",
    channelsWithBudgets(channels, campaignBudgets([])).every((c) => c.budgeted === null && !c.budgetOnly));

  const summary = stripComments(read("app/api/marketing-spend/summary/route.js"));
  ok("the summary route lays budgets over the channels", /channelsWithBudgets\(rollup\.channels,\s*budgets\)/.test(summary));
  ok("…returns them under `budgets` and `totals.budgeted`", /budgets,/.test(summary) && /budgeted:\s*budgets\.total/.test(summary));
  ok("…and leaves totals.spend and the blended cost per lead alone",
    /totalSpend:\s*rollup\.totals\.spend/.test(summary) && /\.\.\.rollup\.totals/.test(summary));
  ok("…excluding archived at the query too", /status:\s*\{\s*not:\s*"archived"\s*\}/.test(summary));
  const spend = stripComments(read("app/app/marketing/spend/page.js"));
  ok("the Spend page shows Budgeted beside Spent", /app\.marketingSpend\.colBudgeted/.test(spend) && /app\.marketingSpend\.colSpent/.test(spend));
  ok("…with the note that says which is which", /app\.marketingSpend\.budgetNote/.test(spend));
  for (const key of ["app.marketingSpend.colSpent", "app.marketingSpend.colBudgeted", "app.marketingSpend.nothingLoggedYet", "app.marketingSpend.budgetNote"]) {
    ok(`${key} in every language`, LANGS.every((l) => typeof APP_MESSAGES[l][key] === "string"));
  }
  const listPage = read("app/app/marketing/page.js");
  ok("the campaign form still asks for the budget (it is read now, so it stays)", /budget/.test(listPage) && /app\.marketing\.budgetPlaceholder/.test(listPage));
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n6. The builder's server-written labels reach the catalogue\n");
{
  const gaps = siteGaps({ photos: ["a", "b"], company: {}, services: [], testimonials: [], hasHours: false });
  ok("every gap names its question, detail and action keys",
    gaps.every((g) => g.questionKey && g.detailKey && (!g.action || g.action.labelKey)), gaps.map((g) => g.key));
  ok("…and every key exists in every language",
    gaps.every((g) => [g.questionKey, g.detailKey, g.action?.labelKey].filter(Boolean)
      .every((k) => LANGS.every((l) => typeof APP_MESSAGES[l][k] === "string"))));
  ok("the photo count travels as a param", gaps.find((g) => g.key === "pairs")?.params?.count === 2);
  ok("the English stays on the row as the fallback", gaps.every((g) => typeof g.question === "string" && g.question.length > 0));
  const single = siteGaps({ photos: ["a"], company: {}, services: [], testimonials: [], hasHours: true });
  ok("the one-photo gap is keyed too", single.some((g) => g.key === "pairs-need-more" && g.questionKey === "app.siteGaps.pairs-need-more.question"));

  const { COMPOSITION_KEYS } = await import("@/lib/site/composition");
  const { SITE_STYLE_KEYS } = await import("@/lib/site/siteStyles");
  const { BLOCK_TYPES } = await import("@/app/data/siteBlocks");
  ok("every layout chip has a label in every language",
    COMPOSITION_KEYS.every((k) => LANGS.every((l) => typeof APP_MESSAGES[l][`app.siteComposition.${k}`] === "string")), COMPOSITION_KEYS);
  ok("every style chip has a label and a hint in every language",
    SITE_STYLE_KEYS.every((k) => LANGS.every((l) =>
      typeof APP_MESSAGES[l][`app.siteStyle.${k}.label`] === "string" && typeof APP_MESSAGES[l][`app.siteStyle.${k}.hint`] === "string")), SITE_STYLE_KEYS);
  ok("every block type has a name in every language",
    Object.keys(BLOCK_TYPES).every((k) => LANGS.every((l) => typeof APP_MESSAGES[l][`app.siteBlock.${k}`] === "string")), Object.keys(BLOCK_TYPES));

  const builder = stripComments(read("app/app/settings/website/Builder.js"));
  ok("the builder translates the chips through those keys",
    /t\(`app\.siteComposition\.\$\{c\.key\}`/.test(builder) && /t\(`app\.siteStyle\.\$\{s\.key\}\.label`/.test(builder) && /t\(`app\.siteStyle\.\$\{s\.key\}\.hint`/.test(builder));
  ok("…and the gaps through theirs", /t\(gap\.questionKey/.test(builder) && /t\(gap\.detailKey/.test(builder) && /gap\.action\.labelKey/.test(builder));
  ok("the section editor translates the block name", /t\(`app\.siteBlock\.\$\{block\.type\}`/.test(read("app/app/settings/website/SectionEditor.js")));

  // The wording alignment the writer flagged.
  ok("fr: the sidebar and the page title agree on Entonnoirs",
    APP_MESSAGES.fr["app.nav.funnels"] === "Entonnoirs" && APP_MESSAGES.fr["app.funnels.title"] === "Entonnoirs");
  ok("de: the sidebar and the page title agree", APP_MESSAGES.de["app.nav.funnels"] === APP_MESSAGES.de["app.funnels.title"]);
  for (const l of LANGS) {
    const link = APP_MESSAGES[l]["app.funnels.instantQuotesLink"];
    const expected = `${APP_MESSAGES[l]["app.nav.settings"]} → ${APP_MESSAGES[l]["app.settings.instantQuotes"]}`;
    ok(`${l}: "Settings → Instant quotes" names the real rows (${expected})`, link === expected, link);
    const gated = APP_MESSAGES[l]["app.funnels.gatedService"];
    ok(`${l}: …and the gated-service sentence uses the same words`, typeof gated === "string" && gated.includes(expected), gated);
  }
  const funnelBuilder = stripComments(read("app/app/funnels/[id]/page.js"));
  for (const key of ["app.funnels.saved", "app.funnels.publish", "app.funnels.unpublish", "app.funnels.copyLink", "app.funnels.open",
    "app.funnels.performance", "app.funnels.stat.starts", "app.funnels.stat.leads", "app.funnels.stat.conversion", "app.funnels.steps", "app.funnels.cantGoLive"]) {
    ok(`funnel builder asks for ${key}`, funnelBuilder.includes(`"${key}"`));
    ok(`…defined in every language`, LANGS.every((l) => typeof APP_MESSAGES[l][key] === "string"));
  }
  const email = stripComments(read("app/components/marketing/EmailCampaignDetail.js"));
  ok("EmailCampaignDetail has no bare English button left",
    !/>\s*Send Campaign\s*</.test(email) && !/"Yes, send now"\s*\}/.test(email.replace(/t\([^)]*\)/g, "")) && /app\.mkEmail\.sendCampaign/.test(email));
  for (const key of ["sendError", "noTemplate", "editTemplate", "loadingSubscribers", "subscribedCount", "manageList", "sentOn", "partial", "sending", "resumeSend", "confirm", "sendNow", "pickTemplateFirst", "noRecipients", "sendCampaign"]) {
    ok(`app.mkEmail.${key} in every language`, LANGS.every((l) => typeof APP_MESSAGES[l][`app.mkEmail.${key}`] === "string"));
  }
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n7. The competitor ledger no longer denies purchase orders\n");
{
  const { FIELDQUO_CAPABILITIES, FIELDQUO_LACKS, claims } = await import("@/lib/marketing/competitors");
  ok("purchase_orders is has: true", FIELDQUO_CAPABILITIES.purchase_orders.has === true);
  ok("…with evidence naming the models and the screen",
    /PurchaseOrder/.test(FIELDQUO_CAPABILITIES.purchase_orders.evidence) && /app\/app\/purchasing/.test(FIELDQUO_CAPABILITIES.purchase_orders.evidence));
  ok("…so it is no longer in FIELDQUO_LACKS", !FIELDQUO_LACKS.includes("purchase_orders"));
  ok("…and Projul is no longer conceded it", !claims("projul").theyHaveWeDont.some((e) => e.capability === "purchase_orders"));
}

// ══════════════════════════════════════════════════════════════════════════
console.log("");
if (fails.length) {
  console.log(`FAILED — ${fails.length} of ${pass + fails.length}\n`);
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`PASSED — ${pass}/${pass} assertions`);
