// scripts/check-white-label-meta.mjs
//
//   npm run check:white-label-meta
//
// The <head> of every client-facing page is the contractor's, not FieldQuo's:
// the tab title, the favicon, the description and the link preview a
// homeowner sees when a contractor texts or emails a link. And a demo
// company's client pages leave out the seed's fictional How-to-pay box and
// 555 / example.com contact details, while a real company's payload does not
// change by a byte. See lib/whiteLabel/pageMetadata.js and
// lib/demo/clientFacing.js.
//
// ══ How ═══════════════════════════════════════════════════════════════════
//
// EXECUTED, not grepped. Every client page's generateMetadata runs against a
// fixture database (Northline Painting, with a logo and without; a client
// named Jane Q. Homeowner at 42 Elm Street owing $4,250.75), and its result
// is then run through Next's OWN metadata resolver — accumulateMetadata from
// node_modules/next — with the real root layout's metadata and the root
// file icons above it, exactly the merge Next performs on a request. So the
// assertion is about the head Next would emit, including what the root
// layout would have leaked in, and not about the object the page returned.
//
// A control proves the resolver is live: a page that sets no icons DOES get
// the root's FieldQuo icon through it, and a root favicon.ico IS forced into
// even a page that sets its own. Without those two, "no FieldQuo icon" could
// pass because the simulation never added one.
//
// Client components are stubbed at resolve time (a page's "use client"
// imports render nothing here; their names are kept so imports link), the
// database is an in-script fixture, and three heavy loaders whose own
// queries are covered elsewhere are replaced by fixture functions.
//
// ══ The route list is DERIVED ═════════════════════════════════════════════
//
// Every page.js under a client-facing top-level directory is checked; a page
// added there tomorrow fails here until it either runs these assertions or is
// named in EXEMPT with a reason. That is the property that rots.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";
import { register, createRequire } from "node:module";
import { createHash } from "node:crypto";

const ROOT = resolvePath(dirname(new URL(import.meta.url).pathname), "..");
const require = createRequire(import.meta.url);

let pass = 0;
const failures = [];
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); return true; }
  failures.push(name);
  console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)?.slice(0, 600)}` : ""}`);
  return false;
};
const section = (t) => console.log(`\n${t}`);

// ═══════════════════════════════════════════════════════════════════════════
// Harness
// ═══════════════════════════════════════════════════════════════════════════

globalThis.__WLM = { rows: {}, headers: { host: "fieldquo.com", "accept-language": "en" } };

const STUBS = {
  "@/lib/db": "export const db = globalThis.__WLM.db; export default db;",
  "next/headers":
    "export async function headers(){ return new Headers(globalThis.__WLM.headers); }" +
    "export async function cookies(){ return { get(){ return undefined; }, getAll(){ return []; }, has(){ return false; } }; }",
  "next/navigation":
    "export function notFound(){ const e = new Error('NEXT_NOT_FOUND'); e.digest='NEXT_NOT_FOUND'; throw e; }" +
    "export function redirect(u){ const e = new Error('NEXT_REDIRECT ' + u); throw e; }" +
    "export const permanentRedirect = redirect; export function useRouter(){ return {}; }" +
    "export function usePathname(){ return '/'; } export function useSearchParams(){ return new URLSearchParams(); }",
  "next/font/google":
    "const f = () => ({ variable: '', className: '' }); export const Geist = f; export const Geist_Mono = f;",
  "@/lib/currentMember": "export async function getCurrentMember(){ throw new Error('no session in check'); }",
  // Re-pricing a measurement is check:public-estimate's business; here only
  // the shape the page's head reads matters.
  "@/lib/estimate/report/load": "export const loadEstimateReportByToken = (...a) => globalThis.__WLM.estimateReport(...a);",
  "@/lib/estimate/report/presentation": "export async function loadEstimatePresentation(){ return null; }",
  "@/lib/links/load":
    "export const loadLinkPageData = (...a) => globalThis.__WLM.linkPage(...a); export async function loadLinkPageDataForCompany(){ return null; }",
  "@/lib/reviews/cardData": "export const loadCardData = (...a) => globalThis.__WLM.card(...a);",
  "@/lib/analytics/product/server": "export async function recordCardTap(){}",
};

const HOOKS = `
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const STUBS = ${JSON.stringify(STUBS)};
const stubUrl = (src) => "data:text/javascript," + encodeURIComponent(src);
const USE_CLIENT = /^\\s*(?:(?:\\/\\/[^\\n]*\\n|\\/\\*[\\s\\S]*?\\*\\/)\\s*)*["']use client["']/;
export async function resolve(specifier, context, nextResolve) {
  if (Object.prototype.hasOwnProperty.call(STUBS, specifier)) return { url: stubUrl(STUBS[specifier]), shortCircuit: true };
  // next/server, next/og, next/link…: "exports"-map entries the bundler
  // understands and bare node does not; the files behind them load fine.
  if (/^next\\/[a-z-]+$/.test(specifier)) return nextResolve(specifier + ".js", context);
  if (/\\.css$/.test(specifier)) return { url: stubUrl(""), shortCircuit: true };
  const r = await nextResolve(specifier, context);
  if (r.url.startsWith("file:") && /\\/(app|lib)\\//.test(r.url) && !r.url.includes("/node_modules/") && /\\.js$/.test(r.url)) {
    const src = readFileSync(fileURLToPath(r.url), "utf8");
    if (USE_CLIENT.test(src)) {
      const names = new Set();
      for (const m of src.matchAll(/export\\s+(?:async\\s+)?(?:function\\*?|const|let|var|class)\\s+([A-Za-z_$][\\w$]*)/g)) names.add(m[1]);
      for (const m of src.matchAll(/export\\s*\\{([^}]*)\\}/g))
        for (const part of m[1].split(",")) { const n = part.trim().split(/\\s+as\\s+/).pop(); if (n && n !== "default") names.add(n); }
      const body = [...names].map((n) => "export const " + n + " = () => null;").join("\\n") + "\\nexport default function ClientStub(){ return null; }";
      return { url: stubUrl(body), shortCircuit: true };
    }
  }
  return r;
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

// The fixture database: any model, findUnique / findFirst / findMany, a
// `where` of equalities, { not }, and OR — the shapes these pages use. A row
// is returned whole (nested relations included), the way a check needs it.
function matches(row, where = {}) {
  return Object.entries(where || {}).every(([k, v]) => {
    if (k === "OR") return v.some((w) => matches(row, w));
    if (k === "AND") return v.every((w) => matches(row, w));
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      if ("not" in v) return v.not === null ? row[k] != null : row[k] !== v.not;
      if ("equals" in v) return row[k] === v.equals;
      if ("in" in v) return v.in.includes(row[k]);
      return matches(row[k] || {}, v);
    }
    return row[k] === v;
  });
}
const reads = [];
globalThis.__WLM.db = new Proxy({}, {
  get(_t, model) {
    if (model === "then") return undefined;
    if (model === "$transaction") return async (a) => (Array.isArray(a) ? Promise.all(a) : a(globalThis.__WLM.db));
    const list = () => globalThis.__WLM.rows[model] || [];
    return {
      findUnique: async (args = {}) => { reads.push({ model, args }); return list().find((r) => matches(r, args.where)) || null; },
      findFirst: async (args = {}) => { reads.push({ model, args }); return list().find((r) => matches(r, args.where)) || null; },
      findMany: async (args = {}) => { reads.push({ model, args }); return list().filter((r) => matches(r, args.where)); },
      count: async (args = {}) => list().filter((r) => matches(r, args.where)).length,
      aggregate: async () => ({ _max: {}, _sum: {}, _count: {} }),
      groupBy: async () => [],
      update: async () => { throw new Error(`check-white-label-meta: write to ${model}`); },
      updateMany: async () => { throw new Error(`check-white-label-meta: write to ${model}`); },
      create: async () => { throw new Error(`check-white-label-meta: write to ${model}`); },
      upsert: async () => { throw new Error(`check-white-label-meta: write to ${model}`); },
      delete: async () => { throw new Error(`check-white-label-meta: write to ${model}`); },
      deleteMany: async () => { throw new Error(`check-white-label-meta: write to ${model}`); },
    };
  },
});

// Next's resolver requires "server-only", which throws outside a
// react-server build. It is a marker, not behaviour; answer it with nothing.
{
  const Module = require("node:module");
  const load = Module._load;
  Module._load = function (request, ...rest) {
    if (request === "server-only") return {};
    return load.call(this, request, ...rest);
  };
}
const { accumulateMetadata } = require("next/dist/lib/metadata/resolve-metadata.js");

const imp = (rel) => import(pathToFileURL(join(ROOT, rel)).href);

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const NAME = "Northline Painting";
const LOGO = "https://res.cloudinary.com/fq-demo/image/upload/v1712345678/logos/northline.png";
const companyRow = (over = {}) => ({
  id: "co_northline",
  name: NAME,
  slug: "northline-painting",
  bookingSlug: "northline",
  logoUrl: LOGO,
  brandColor: "#f5d90a", // contractor yellow — the hostile one
  defaultLanguage: "en",
  country: "CA",
  isDemo: false,
  ...over,
});
// What must never reach a head: a link preview is fetched by a third party.
const CLIENT = {
  name: "Jane Q. Homeowner",
  email: "jane.homeowner@gmail.com",
  phone: "+1 416 867 5309",
  address: "42 Elm Street",
  city: "Guelph",
  language: "fr",
};
const PII = ["Jane", "Homeowner", "jane.homeowner", "867 5309", "42 Elm", "Elm Street", "4250", "4,250", "4 250"];
const FIELDQUO = [/fieldquo/i, /\/favicon\.ico/, /\/icon\.png/, /\/apple-icon\.png/, /\/social-card/, /manifest\.webmanifest/, /all-in-one system for contractors/i];

const T = {
  quote: "tok_quote_sent_000000000001",
  draft: "tok_quote_draft_00000000002",
  portal: "tok_portal_00000000000000003",
  co: "tok_change_order_000000004",
  survey: "tok_survey_00000000000000005",
  visit: "tok_visit_manage_0000000006",
  waiver: "tok_waiver_0000000000000007",
  unsub: "tok_unsub_000000000000000008",
  plan: "tok_plan_0000000000000000009",
  estimate: "tok_estimate_00000000000010",
};

function seed(company) {
  globalThis.__WLM.rows = {
    company: [company],
    quote: [
      {
        shareToken: T.quote, status: "sent", quoteNumber: "Q-0123", language: "fr", total: 4250.75,
        autoEstimated: true, quoteType: "roofing", estimateData: { trade: "roofing" }, createdVia: "instant_quote",
        client: CLIENT, company,
      },
      { shareToken: T.draft, status: "draft", quoteNumber: "Q-0124", language: "en", client: CLIENT, company },
    ],
    client: [{ id: "cl_jane", portalToken: T.portal, ...CLIENT, company }],
    invoice: [
      { id: "inv_sent", clientId: "cl_jane", sentAt: new Date("2026-09-01"), status: "sent", invoiceNumber: "INV-0042", language: "es", total: 4250.75 },
      { id: "inv_draft", clientId: "cl_jane", sentAt: null, status: "draft", invoiceNumber: "INV-0043", language: "en" },
    ],
    changeOrder: [{ shareToken: T.co, job: { company, client: CLIENT } }],
    satisfactionResponse: [{ token: T.survey, company }],
    booking: [{ manageToken: T.visit, clientName: CLIENT.name, address: CLIENT.address, eventType: { company } }],
    documentSignature: [{ token: T.waiver, company }],
    marketingSubscriber: [{ unsubscribeToken: T.unsub, email: CLIENT.email, company }],
    servicePlan: [{ authToken: T.plan, company }],
    companySite: [
      {
        subdomain: "northline", published: true, seoTitle: null, seoDescription: null, languages: ["en"],
        translations: null, clientPortalEnabled: true, blocks: [], pages: null,
        company: { ...company, city: "Guelph", province: "ON" },
      },
    ],
  };
  globalThis.__WLM.estimateReport = async (token) =>
    token === T.estimate ? { company, quote: {}, report: { language: "en", title: { text: "Your free roofing estimate" } } } : null;
  globalThis.__WLM.linkPage = async (slug) =>
    slug === "northline" ? { company, config: { published: true, headline: "", bio: "" }, candidates: [] } : null;
  globalThis.__WLM.card = async (slug) => (slug === "northline" ? { company, language: "en" } : null);
}

// ═══════════════════════════════════════════════════════════════════════════
// The root layout and its file icons — what Next merges ABOVE every page
// ═══════════════════════════════════════════════════════════════════════════

const { metadata: ROOT_METADATA } = await imp("app/layout.js");

// The static-file items Next derives for the root segment, from the files
// actually present: favicon.ico (special-cased, forced first), icon.*,
// apple-icon.*, manifest.
function rootStaticFiles({ withFavicon = existsSync(join(ROOT, "app/favicon.ico")) } = {}) {
  const icon = [];
  if (withFavicon) icon.push({ url: "/favicon.ico", type: "image/x-icon", sizes: "16x16 32x32" });
  if (existsSync(join(ROOT, "app/icon.png"))) icon.push({ url: "/icon.png?a1b2c3", type: "image/png", sizes: "256x256" });
  const apple = existsSync(join(ROOT, "app/apple-icon.png"))
    ? [{ url: "/apple-icon.png?d4e5f6", type: "image/png", sizes: "180x180" }]
    : undefined;
  return {
    icon: icon.length ? icon : undefined,
    apple,
    openGraph: undefined,
    twitter: undefined,
    manifest: existsSync(join(ROOT, "app/manifest.js")) ? "/manifest.webmanifest" : undefined,
  };
}

async function resolveHead(pageMetadata, { pathname = "/q/x", withFavicon } = {}) {
  return accumulateMetadata(
    "/page",
    [
      [ROOT_METADATA, rootStaticFiles({ withFavicon })],
      [pageMetadata, null],
    ],
    pathname,
    { trailingSlash: false, isStaticMetadataRouteFile: false },
  );
}

const iconUrls = (head) =>
  [...(head.icons?.icon || []), ...(head.icons?.apple || []), ...(head.icons?.shortcut || [])].map((i) => String(i.url));

// ═══════════════════════════════════════════════════════════════════════════
section("0. Root icons and the resolver itself");
// ═══════════════════════════════════════════════════════════════════════════

ok("app/favicon.ico is gone — Next forces a root favicon.ico into EVERY route's head",
  !existsSync(join(ROOT, "app/favicon.ico")));
ok("…and lives on at public/favicon.ico, still served at /favicon.ico for FieldQuo's own pages",
  existsSync(join(ROOT, "public/favicon.ico")));
{
  const control = await resolveHead({ title: "Pricing" }, { pathname: "/pricing" });
  ok("control: a page that sets no icons DOES get the root FieldQuo icon through the resolver",
    iconUrls(control).some((u) => u.startsWith("/icon.png")), iconUrls(control));
  const forced = await resolveHead({ icons: { icon: "/x.png" } }, { withFavicon: true });
  ok("control: a root favicon.ico is forced in even over a page's own icons (why it moved)",
    iconUrls(forced).includes("/favicon.ico"), iconUrls(forced));
  ok("control: the root description is FieldQuo's, so inheriting it would be a leak",
    /all-in-one system/i.test(String(ROOT_METADATA.description)));
}

// ═══════════════════════════════════════════════════════════════════════════
// The client routes
// ═══════════════════════════════════════════════════════════════════════════

const CLIENT_DIRS = [
  "q", "quote", "book", "portal", "site", "embed", "c", "co", "estimate-report", "f",
  "instant-quote", "l", "survey", "unsubscribe", "visit", "w", "design", "plan",
];
// Client-facing paths that are deliberately NOT the contractor's head.
const EXEMPT = {
  "app/q/[token]/add/page.js":
    "the business-client 'add this price to your own quote' page — FieldQuo's face by design (its header says so); the quote itself stays the sender's",
};

// Each entry: the params that name the fixture company, the params that name
// nothing, and what the tab title must carry beyond the company's name.
const ROUTES = {
  "app/q/[token]/page.js": { params: { token: T.quote }, unknown: { token: "nope" }, titleHas: ["Q-0123"], shareLacks: ["Q-0123"] },
  "app/portal/[token]/page.js": { params: { token: T.portal }, unknown: { token: "nope" } },
  "app/portal/[token]/invoices/[id]/page.js": { params: { token: T.portal, id: "inv_sent" }, unknown: { token: "nope", id: "inv_sent" }, titleHas: ["INV-0042"], shareLacks: ["INV-0042"] },
  "app/portal/[token]/demo-pay/page.js": { params: { token: T.portal }, unknown: { token: "nope" } },
  "app/portal/[token]/pay-over-time/page.js": { params: { token: T.portal }, unknown: { token: "nope" } },
  "app/quote/[companySlug]/page.js": { params: { companySlug: "northline" }, unknown: { companySlug: "nope" } },
  "app/quote/[companySlug]/kitchen/page.js": { params: { companySlug: "northline" }, unknown: { companySlug: "nope" } },
  "app/book/[companySlug]/page.js": { params: { companySlug: "northline" }, unknown: { companySlug: "nope" } },
  "app/book/[companySlug]/[eventSlug]/page.js": { params: { companySlug: "northline", eventSlug: "estimate" }, unknown: { companySlug: "nope", eventSlug: "x" } },
  "app/embed/[companySlug]/[widget]/page.js": { params: { companySlug: "northline", widget: "book" }, unknown: { companySlug: "nope", widget: "book" } },
  "app/embed/[companySlug]/funnel/[funnelSlug]/page.js": { params: { companySlug: "northline", funnelSlug: "roof" }, unknown: { companySlug: "nope", funnelSlug: "x" } },
  "app/f/[companySlug]/[funnelSlug]/page.js": { params: { companySlug: "northline", funnelSlug: "roof" }, unknown: { companySlug: "nope", funnelSlug: "x" } },
  "app/instant-quote/[companySlug]/page.js": { params: { companySlug: "northline" }, unknown: { companySlug: "nope" } },
  "app/site/[subdomain]/page.js": { params: { subdomain: "northline" }, unknown: { subdomain: "nope" } },
  "app/site/[subdomain]/[...path]/page.js": { params: { subdomain: "northline", path: ["about"] }, unknown: { subdomain: "nope", path: ["about"] } },
  "app/c/[slug]/page.js": { params: { slug: "northline" }, unknown: { slug: "nope" } },
  "app/l/[slug]/page.js": { params: { slug: "northline" }, unknown: { slug: "nope" } },
  "app/co/[token]/page.js": { params: { token: T.co }, unknown: { token: "nope" } },
  "app/estimate-report/[token]/page.js": { params: { token: T.estimate }, unknown: { token: "nope" } },
  "app/estimate-report/[token]/book/page.js": { params: { token: T.quote }, unknown: { token: "nope" } },
  "app/survey/[token]/page.js": { params: { token: T.survey }, unknown: { token: "nope" } },
  "app/unsubscribe/[token]/page.js": { params: { token: T.unsub }, unknown: { token: "nope" } },
  "app/visit/[token]/page.js": { params: { token: T.visit }, unknown: { token: "nope-but-sixteen-chars" } },
  "app/w/[token]/page.js": { params: { token: T.waiver }, unknown: { token: "nope" } },
  "app/design/[token]/page.js": { params: { token: T.quote }, unknown: { token: "nope" } },
  "app/plan/[token]/page.js": { params: { token: T.plan }, unknown: { token: "nope" } },
};

// The pages a company WANTS found (an ad's landing page, its own website).
// Every other client page — a token, an embed, a booking link — is noindex.
const INDEXED = new Set([
  "app/quote/[companySlug]/page.js",
  "app/quote/[companySlug]/kitchen/page.js",
  "app/instant-quote/[companySlug]/page.js",
  "app/site/[subdomain]/page.js",
  "app/site/[subdomain]/[...path]/page.js",
]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. Every client-facing page is accounted for");
// ═══════════════════════════════════════════════════════════════════════════

const found = CLIENT_DIRS.flatMap((d) => walk(join(ROOT, "app", d)))
  .map((f) => f.slice(ROOT.length + 1))
  .filter((f) => f.endsWith("/page.js"));
for (const f of found) {
  ok(`${f} is checked below or exempt with a reason`, f in ROUTES || f in EXEMPT);
}
for (const f of Object.keys(ROUTES)) ok(`${f} exists`, existsSync(join(ROOT, f)));

// ═══════════════════════════════════════════════════════════════════════════
section("2. Each page's head, as Next would emit it — with a logo, without one, and for nobody");
// ═══════════════════════════════════════════════════════════════════════════

const { documentLabels } = await imp("lib/i18n/documentLabels.js");

for (const [file, spec] of Object.entries(ROUTES)) {
  console.log(`\n  ${file}`);
  const src = readFileSync(join(ROOT, file), "utf8");
  ok("exports generateMetadata (a static `metadata` cannot name the company)", /export\s+async\s+function\s+generateMetadata/.test(src));
  ok("builds it with lib/whiteLabel/pageMetadata", /@\/lib\/whiteLabel\/pageMetadata/.test(src) || /generateMetadata as parentMetadata/.test(src));

  let mod;
  try {
    mod = await imp(file);
  } catch (err) {
    ok("the page module loads in the harness", false, err?.message);
    continue;
  }

  for (const variant of ["logo", "no-logo"]) {
    seed(companyRow(variant === "logo" ? {} : { logoUrl: null }));
    let meta;
    try {
      meta = await mod.generateMetadata({ params: Promise.resolve(spec.params), searchParams: Promise.resolve({}) });
    } catch (err) {
      ok(`[${variant}] generateMetadata runs`, false, err?.message);
      continue;
    }
    const head = await resolveHead(meta, { pathname: "/" + file.replace(/^app\//, "").replace(/\/page\.js$/, "") });
    const json = JSON.stringify(head);
    const title = String(head.title?.absolute ?? head.title ?? "");
    ok(`[${variant}] the tab title carries the company's name`, title.includes(NAME), title);
    for (const s of spec.titleHas || []) ok(`[${variant}] …and the document number ${s}`, title.includes(s), title);
    ok(`[${variant}] the description is the company's, never the root's`, String(head.description || "").length > 0 && !/all-in-one/i.test(head.description), head.description);
    ok(`[${variant}] og:site_name / og:title name the company`, String(head.openGraph?.siteName) === NAME && String(head.openGraph?.title?.absolute ?? head.openGraph?.title).length > 0, head.openGraph);
    for (const s of spec.shareLacks || []) {
      ok(`[${variant}] the share title leaves out ${s}`, !String(head.openGraph?.title?.absolute ?? "").includes(s) && !String(head.twitter?.title?.absolute ?? "").includes(s), head.openGraph?.title);
    }
    const leaked = FIELDQUO.filter((re) => re.test(json)).map(String);
    ok(`[${variant}] no FieldQuo name, icon, card, manifest or description anywhere in the head`, leaked.length === 0, leaked);
    ok(`[${variant}] no manifest (Android would install it named FieldQuo)`, head.manifest == null, head.manifest);
    if (!INDEXED.has(file)) {
      ok(`[${variant}] a token page stays out of search indexes (robots noindex)`, /noindex/.test(String(head.robots?.basic || "")), head.robots);
    }
    const pii = PII.filter((p) => json.includes(p));
    ok(`[${variant}] no client name, contact, address or amount anywhere in the head`, pii.length === 0, pii);
    const icons = iconUrls(head);
    ok(`[${variant}] has a tab icon and an apple-touch-icon`, (head.icons?.icon || []).length > 0 && (head.icons?.apple || []).length > 0, head.icons);
    const images = (head.openGraph?.images || []).map((i) => String(i.url));
    if (variant === "logo") {
      ok("[logo] every icon is the logo, squared on white by Cloudinary", icons.every((u) => u.startsWith("https://res.cloudinary.com/fq-demo/image/upload/") && /c_pad,b_white/.test(u)), icons);
      ok("[logo] the share image is the logo", images.length === 1 && images[0].includes("/logos/northline.png"), images);
    } else {
      ok("[no-logo] every icon is the generated initial on the brand colour", icons.every((u) => u.startsWith("/api/brand-icon?") && /[?&]l=N(&|$)/.test(u)), icons);
      ok("[no-logo] no share image at all — never FieldQuo's, never an invented one", images.length === 0, images);
    }
  }

  // Nobody: an unknown token / slug. A plain head, not ours and not theirs.
  seed(companyRow());
  try {
    const meta = await mod.generateMetadata({ params: Promise.resolve(spec.unknown), searchParams: Promise.resolve({}) });
    const head = await resolveHead(meta);
    const json = JSON.stringify(head);
    ok("[unknown] names no company", !json.includes(NAME));
    ok("[unknown] no FieldQuo icon, description or manifest", FIELDQUO.every((re) => !re.test(json)), FIELDQUO.filter((re) => re.test(json)).map(String));
  } catch (err) {
    ok("[unknown] generateMetadata runs for an unknown token", false, err?.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Gates: the head names no more than the page would");
// ═══════════════════════════════════════════════════════════════════════════
{
  seed(companyRow());
  const q = await imp("app/q/[token]/page.js");
  const draft = await resolveHead(await q.generateMetadata({ params: Promise.resolve({ token: T.draft }) }));
  ok("a DRAFT quote's link (404 to the world) names no company in its preview", !JSON.stringify(draft).includes(NAME), draft.title);
  const sent = await resolveHead(await q.generateMetadata({ params: Promise.resolve({ token: T.quote }) }));
  const fr = documentLabels("fr").quote;
  ok(`the quote label is in the QUOTE's language (fr: "${fr}"), not the reader's`, String(sent.title.absolute).startsWith(`${fr} Q-0123`), sent.title);

  const inv = await imp("app/portal/[token]/invoices/[id]/page.js");
  const d = await resolveHead(await inv.generateMetadata({ params: Promise.resolve({ token: T.portal, id: "inv_draft" }) }));
  ok("an unissued invoice's number stays out of the tab", !String(d.title.absolute).includes("INV-0043"), d.title);
  const s = await resolveHead(await inv.generateMetadata({ params: Promise.resolve({ token: T.portal, id: "inv_sent" }) }));
  ok(`the invoice label is in the INVOICE's language (es: "${documentLabels("es").invoice}")`, String(s.title.absolute).startsWith(documentLabels("es").invoice), s.title);

  // A database failure is a plain head, never a crashed page.
  const saved = globalThis.__WLM.rows;
  globalThis.__WLM.rows = new Proxy({}, { get() { throw new Error("P1001 simulated"); } });
  const portal = await imp("app/portal/[token]/page.js");
  let threw = null;
  let blip = null;
  try { blip = await resolveHead(await portal.generateMetadata({ params: Promise.resolve({ token: T.portal }) })); } catch (e) { threw = e.message; }
  ok("a database blip in generateMetadata gives a neutral head, not an error page", !threw && blip && !JSON.stringify(blip).includes(NAME), threw);
  globalThis.__WLM.rows = saved;
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Not-found pages under client routes carry no FieldQuo head");
// ═══════════════════════════════════════════════════════════════════════════
{
  const nf = CLIENT_DIRS.flatMap((d) => walk(join(ROOT, "app", d))).filter((f) => f.endsWith("/not-found.js"));
  ok("there are client not-found pages to check", nf.length >= 6, nf.length);
  for (const f of nf) {
    const rel = f.slice(ROOT.length + 1);
    const mod = await imp(rel);
    ok(`${rel} exports metadata`, Boolean(mod.metadata));
    const head = await resolveHead(mod.metadata || {});
    const json = JSON.stringify(head);
    ok(`${rel}: no FieldQuo title, icon, description or manifest`, FIELDQUO.every((re) => !re.test(json)), FIELDQUO.filter((re) => re.test(json)).map(String));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The generated icon: contrast measured, inputs narrowed, a real PNG");
// ═══════════════════════════════════════════════════════════════════════════
{
  const { brandIconSpec, brandInitial, generatedIconUrl, brandIconUrl, logoSquareUrl } = await imp("lib/whiteLabel/pageMetadata.js");
  const { contrastRatio } = await imp("lib/brand/colour.js");
  const HOSTILE = [
    "#ffff00", "#ffffff", "#fefefe", "#000000", "#808080", "#777777", "#767676", "#7f7f7f",
    "#00ff00", "#32cd32", "#f5821f", "#ff5a00", "#06356b", "#87ceeb", "#ffd700", "#f5d90a",
    "#ff0000", "#0000ff", "#ff69b4", "#999999", "#aaaaaa", "#5a5a5a", "#fff", "#abc",
    null, "", "not-a-colour", "#12345", "javascript:alert(1)", "#gggggg",
  ];
  for (const c of HOSTILE) {
    const url = generatedIconUrl({ name: "Northline", brandColor: c }, 192);
    const q = new URL(url, "https://x.test").searchParams;
    const spec = brandIconSpec({ colour: q.get("c"), letter: q.get("l"), size: q.get("s") });
    const r = contrastRatio(spec.fg, spec.bg);
    ok(`brand ${JSON.stringify(c)} → ${spec.fg} on ${spec.bg} is ${r.toFixed(2)}:1 (≥ 4.5)`, r >= 4.5, { c, spec });
  }
  // The route's own input is a URL anyone can edit.
  for (const bad of [{ colour: "zzzzzz" }, { colour: "<svg>" }, { letter: "<" }, { letter: "AB" }, { size: "99999" }, { size: "-1" }, {}]) {
    const spec = brandIconSpec(bad);
    ok(`hand-edited ${JSON.stringify(bad)} is narrowed (size from the list, letter A–Z/0–9 or none, ≥ 4.5:1)`,
      [32, 180, 192].includes(spec.size) && /^[A-Z0-9]?$/.test(spec.letter) && contrastRatio(spec.fg, spec.bg) >= 4.5, spec);
  }
  const INITIALS = [["Northline Painting", "N"], ["élan Rénovations", "E"], ["123 Roofing", "1"], ["  the best co", "T"], ["Київ Ремонт", ""], ["ਪੰਜਾਬ ਪੇਂਟਰ", ""], ["🏠 Homes", "H"], ["", ""], [null, ""], ["<script>", "S"]];
  for (const [name, want] of INITIALS) ok(`initial of ${JSON.stringify(name)} is ${JSON.stringify(want)} (a letter the bundled Latin font can draw, or none)`, brandInitial(name) === want, brandInitial(name));
  ok("a non-Cloudinary logo is not squared (unknown aspect) — the generated icon is used instead",
    logoSquareUrl("https://example-cdn.test/logo.png", 32) === null && brandIconUrl({ name: "N", logoUrl: "https://example-cdn.test/logo.png" }, 32).startsWith("/api/brand-icon?"));
  ok("a Cloudinary video URL is not treated as a logo", logoSquareUrl("https://res.cloudinary.com/x/video/upload/v1/a.mp4", 32) === null);

  const routeSrc = readFileSync(join(ROOT, "app/api/brand-icon/route.js"), "utf8");
  ok("the icon route reads no database row (it can't be used to probe a company)", !/@\/lib\/db/.test(routeSrc) && !/prisma/i.test(routeSrc));
  try {
    const { GET } = await imp("app/api/brand-icon/route.js");
    const res = await GET(new Request("https://fieldquo.com/api/brand-icon?c=f5d90a&l=N&s=180"));
    const buf = Buffer.from(await res.arrayBuffer());
    ok("the route answers 200 with a PNG", res.status === 200 && buf.subarray(1, 4).toString() === "PNG", { status: res.status, type: res.headers.get("content-type") });
    ok("…180×180, as asked", buf.readUInt32BE(16) === 180 && buf.readUInt32BE(20) === 180, [buf.readUInt32BE(16), buf.readUInt32BE(20)]);
    ok("…cached as immutable (same URL, same bytes, forever)", /immutable/.test(res.headers.get("cache-control") || ""), res.headers.get("cache-control"));
  } catch (err) {
    ok("the icon route renders in node", false, err?.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Demo companies: no How-to-pay box, no fictional contacts — real companies byte-identical");
// ═══════════════════════════════════════════════════════════════════════════
{
  const { demoSafeContact, demoSafeHowToPay, isFictionalPhone, isFictionalAddress } = await imp("lib/demo/clientFacing.js");
  for (const p of ["+1 514 555 0180", "514-555-0147", "(450) 555-0199", "5550100"]) ok(`${p} is fictional`, isFictionalPhone(p));
  for (const p of ["+1 416 867 5309", "+1 514 555 0200", "555-1234", "", null]) ok(`${JSON.stringify(p)} is not fictional`, !isFictionalPhone(p));
  for (const a of ["pay@demo-ana.example.com", "https://demo2.example.com", "x@example.org", "http://shop.example.net/path", "a@b.test"]) ok(`${a} is fictional`, isFictionalAddress(a));
  for (const a of ["owner@northline.ca", "https://northlinepainting.com", "examples.com", "https://myexample.com", "", null]) ok(`${JSON.stringify(a)} is not fictional`, !isFictionalAddress(a));
  const real = { name: NAME, phone: "+1 514 555 0180", email: "pay@x.example.com" };
  ok("a REAL company's contact object comes back as the same object, untouched (even if it looks fictional)", demoSafeContact(real, false) === real);
  const block = { title: "How to pay", methods: [{ method: "e_transfer" }] };
  ok("a REAL company's How-to-pay block comes back as the same object", demoSafeHowToPay(block, false) === block);
  ok("a demo's How-to-pay block is null", demoSafeHowToPay(block, true) === null);
  const demo = demoSafeContact({ name: "Ana Cabinets", phone: "+1 514 555 0180", email: "hello@demo-ana.example.com", website: "https://demo-ana.example.com", logoUrl: "x" }, true);
  ok("a demo's 555 phone, example.com email and website are dropped; everything else kept",
    demo.phone === null && demo.email === null && demo.website === null && demo.name === "Ana Cabinets" && demo.logoUrl === "x", demo);
  const demoReal = demoSafeContact({ name: "Ana", phone: "+1 514 867 5309", email: "rep@fieldquo-demo.ca" }, true);
  ok("a demo with a REAL number keeps it (a rep may take a call on it)", demoReal.phone === "+1 514 867 5309" && demoReal.email === "rep@fieldquo-demo.ca", demoReal);

  // The portal route, executed: the payload the portal and invoice pages render.
  const PORTAL_SELECTS_DEMO = /isDemo:\s*true/.test(readFileSync(join(ROOT, "app/api/portal/[token]/route.js"), "utf8"));
  ok("the portal route reads isDemo from the company row itself", PORTAL_SELECTS_DEMO);
  const portalCompany = (isDemo) => ({
    name: isDemo ? "Ana Cabinets (demo)" : NAME, logoUrl: null, brandColor: "#06356b", currency: "CAD",
    phone: "+1 514 555 0180", email: "hello@demo-ana.example.com", defaultLanguage: "en", timezone: "America/Toronto",
    country: "CA", province: "QC", address: "1 Rue Demo", isDemo,
    paymentMethods: ["e_transfer"], paymentMethodDetails: { e_transfer: { address: "pay@demo-ana.example.com", autoDeposit: true } },
    stripeAccountId: null, stripeChargesEnabled: false,
  });
  const portalRun = async (isDemo) => {
    const invoice = { id: "inv_1", invoiceNumber: "INV-1", total: 100, amountPaid: 0, subtotal: 100, tax: 0, discount: 0, lineItems: [], sentAt: new Date("2026-09-01"), status: "sent", createdAt: new Date("2026-09-01"), language: "en", taxEnabled: false, version: 1, parentInvoiceId: null, howToPay: null };
    globalThis.__WLM.rows = {
      client: [{
        id: "cl_1", portalToken: "tok_portal_demo_check_0001", name: "Jane", language: "en", country: "CA", province: "QC", companyId: "co_1",
        company: portalCompany(isDemo), quotes: [], jobs: [], servicePlans: [],
        invoices: [{ ...invoice }],
      }],
      // The family lookup (lib/invoices/family.js) re-reads the invoice by id.
      invoice: [{ ...invoice }],
    };
    const { GET } = await imp("app/api/portal/[token]/route.js");
    const res = await GET(new Request("https://fieldquo.com/api/portal/x"), { params: Promise.resolve({ token: "tok_portal_demo_check_0001" }) });
    return { status: res.status, body: await res.json() };
  };
  try {
    const realRun = await portalRun(false);
    const demoRun = await portalRun(true);
    ok("portal route executes for a real and a demo company", realRun.status === 200 && demoRun.status === 200, [realRun.status, demoRun.status, realRun.body?.error]);
    ok("REAL company: the invoice still carries its How-to-pay block", Boolean(realRun.body.invoices?.[0]?.howToPay?.methods?.length), realRun.body.invoices?.[0]?.howToPay);
    ok("REAL company: phone and email reach the page as stored", realRun.body.company?.phone === "+1 514 555 0180" && realRun.body.company?.email === "hello@demo-ana.example.com", realRun.body.company);
    ok("DEMO company: no How-to-pay box on the invoice", demoRun.body.invoices?.[0]?.howToPay === null, demoRun.body.invoices?.[0]?.howToPay);
    ok("DEMO company: the Pay button still offers the demo payment", demoRun.body.demoPayments === true && demoRun.body.onlinePayments === true);
    ok("DEMO company: the fictional phone and email are not on the page", demoRun.body.company?.phone === null && demoRun.body.company?.email === null, demoRun.body.company);
    ok("isDemo itself never leaves the route", !("isDemo" in (realRun.body.company || {})) && !("isDemo" in (demoRun.body.company || {})));
    ok("pay@….example.com appears nowhere in a demo's portal payload", !JSON.stringify(demoRun.body).includes("example.com"));
    // A real company's payload is the demo helpers' identity branch: the
    // same objects handed back (asserted above), so the response is what the
    // route built before they existed. The cross-version md5 against the
    // pre-change route was taken once, by hand, when this landed; this pins
    // that the payload is at least stable run to run.
    const md5 = (x) => createHash("md5").update(JSON.stringify(x)).digest("hex");
    const first = md5(realRun.body);
    const again = md5((await portalRun(false)).body);
    ok(`REAL company portal payload is deterministic (md5 ${first})`, first === again);
  } catch (err) {
    ok("portal route executes in the harness", false, err?.stack?.split("\n").slice(0, 3).join(" | "));
  }

  // The public quote route's present(): the select reads isDemo, and both
  // decisions use it; the PortalInvoice/QuoteApproval components carry no
  // demo branch (check:demo-live-recipients holds that for PortalInvoice).
  const qsrc = readFileSync(join(ROOT, "app/api/public/quotes/[token]/route.js"), "utf8");
  ok("public quote route: isDemo is selected from the company row", /isDemo:\s*true/.test(qsrc));
  ok("public quote route: isDemo is peeled off the company object before it is returned", /isDemo:\s*_isDemo/.test(qsrc));
  ok("public quote route: the deposit How-to-pay goes through demoSafeHowToPay", /howToPay:\s*demoSafeHowToPay\(/.test(qsrc));
  ok("public quote route: the company object goes through demoSafeContact", /company:\s*demoSafeContact\(companyPublic,\s*isDemo\)/.test(qsrc));
  // …and executed, for the deposit block under a quote's payment schedule.
  const quoteRun = async (isDemo) => {
    const company = {
      ...portalCompany(isDemo), website: isDemo ? "https://demo-ana.example.com" : "https://northline.ca",
      paymentTerms: "50% deposit, 50% on completion", taxRate: 13, taxMode: "manual", autoApplyLocalTax: false, vatRegistered: false,
    };
    globalThis.__WLM.rows = {
      quote: [{
        id: "q_1", companyId: "co_1", shareToken: "tok_quote_demo_check_0001", status: "sent", quoteNumber: "Q-0123", language: "en",
        total: 100, subtotal: 100, tax: 0, taxEnabled: false, discount: 0, createdAt: new Date("2026-09-01"), notes: "", processNotes: "",
        lineItems: [], scopeGroups: [], addOns: [], siteAddress: null, client: { name: "Jane", email: "j@x.ca", address: "1 Elm", language: "en" }, company,
      }],
      company: [{ id: "co_1", ...company }],
    };
    const { GET } = await imp("app/api/public/quotes/[token]/route.js");
    const res = await GET(new Request("https://fieldquo.com/x"), { params: Promise.resolve({ token: "tok_quote_demo_check_0001" }) });
    return { status: res.status, body: await res.json() };
  };
  try {
    const realQ = await quoteRun(false);
    const demoQ = await quoteRun(true);
    ok("public quote route executes for a real and a demo company", realQ.status === 200 && demoQ.status === 200, [realQ.status, demoQ.status]);
    ok("REAL company quote: the deposit How-to-pay block is there", Boolean(realQ.body.howToPay?.methods?.length), realQ.body.howToPay);
    ok("REAL company quote: phone and website as stored", realQ.body.company?.phone === "+1 514 555 0180" && realQ.body.company?.website === "https://northline.ca", realQ.body.company);
    ok("DEMO company quote: no How-to-pay block", demoQ.body.howToPay === null, demoQ.body.howToPay);
    ok("DEMO company quote: no 555 phone, no example.com email or website", demoQ.body.company?.phone === null && demoQ.body.company?.email === null && demoQ.body.company?.website === null, demoQ.body.company);
    ok("isDemo never leaves the quote route", !("isDemo" in (realQ.body.company || {})) && !("isDemo" in (demoQ.body.company || {})));
  } catch (err) {
    ok("public quote route executes in the harness", false, err?.stack?.split("\n").slice(0, 3).join(" | "));
  }
  for (const f of ["app/q/[token]/QuoteApproval.js", "app/portal/[token]/invoices/[id]/PortalInvoice.js", "app/components/public/HowToPayBlock.js"]) {
    ok(`${f} has no demo branch of its own — the server decides`, !/isDemo|demoSafe/.test(readFileSync(join(ROOT, f), "utf8")));
  }
}

console.log(failures.length ? `\n✗ ${failures.length} failed, ${pass} passed` : `\nALL PASS — ${pass} assertions`);
process.exit(failures.length ? 1 : 0);
