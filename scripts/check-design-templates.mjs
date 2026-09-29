// scripts/check-design-templates.mjs
//
//   npm run check:design-templates
//
// The owner's 2026-09-29 designer batch, executed rather than read:
//
//   1. The catalogue — every template, every slide, has exactly the three
//      publishing formats (4:5, 9:16, 1.91:1) and never a square; the five
//      sections are all there; every copy key exists in every language.
//   2. Contrast — every text object of every template, measured against the
//      role it sits on, at 4.5:1 across hostile brand colours.
//   3. Filling — no role, copy key or token survives; missing company facts
//      become placeholders, never guesses; real reviews and photos replace
//      theirs; a before/after pair only from a tagged pair.
//   4. Placeholders block publishing — driven through the real Meta and
//      TikTok publish routes.
//   5. Company scoping — "Your templates" is one company's, archive is not a
//      delete, the catalogue cannot be archived by anyone.
//   6. Per-destination sizing — the rule, and the route refusing the wrong
//      format before anything is uploaded or posted.
//   7. Carousels — Instagram CAROUSEL containers, Facebook attached_media,
//      TikTok photo_images, signed slide receipts, the media route serving
//      image i.
//   8. Unchanged for what existed — an existing 1:1 design's Facebook /
//      Instagram publish body is byte-for-byte the old one (md5), and a
//      design with no extra slides fingerprints exactly as before.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { register } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const md5 = (v) => createHash("md5").update(typeof v === "string" ? v : JSON.stringify(v)).digest("hex");

let checks = 0;
let fail = 0;
const ok = (cond, msg, detail) => {
  checks++;
  if (!cond) {
    fail++;
    console.log(`  FAIL ${msg}${detail === undefined ? "" : `  — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
  } else {
    console.log(`  ok   ${msg}`);
  }
};
const section = (t) => console.log(`\n${t}\n`);

// ── Stubs for the route sections (same technique as check-designer-reach) ──
const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "next/server": "fq-stub:next",
  "@/lib/signup/planGate": "fq-stub:plangate",
  "@/lib/cloudinary": "fq-stub:cloudinary",
  "@/lib/social/metaConnection": "fq-stub:metaconn",
  "@/lib/activity/log": "fq-stub:activity",
  "@/lib/tiktok/connection": "fq-stub:tiktokconn",
  "@/lib/tiktok/client": "fq-stub:tiktokclient",
};
const DELEGATES = {
  "fq-stub:db": "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });",
  "fq-stub:member": "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);",
  "fq-stub:next": "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };",
  "fq-stub:plangate": "export const planOrRefusal = async () => ({ response: null });",
  "fq-stub:cloudinary": "export const uploadBuffer = (...a) => globalThis.__FQ_UPLOAD(...a);",
  "fq-stub:metaconn": "export const getMetaConnection = (...a) => globalThis.__FQ_META_CONN(...a);",
  "fq-stub:activity": "export const recordActivity = async () => {};",
  "fq-stub:tiktokconn": "export const getLiveTikTokConnection = async () => ({ displayName: 'x' }); export const getTikTokAccess = (...a) => globalThis.__FQ_TT_ACCESS(...a);",
  "fq-stub:tiktokclient": "export const queryCreatorInfo = (...a) => globalThis.__FQ_TT_CREATOR(...a); export const initPhotoPost = (...a) => globalThis.__FQ_TT_INIT(...a);",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (DELEGATES[url]) return { format: "module", shortCircuit: true, source: DELEGATES[url] };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const { TEMPLATE_CATALOG, TEMPLATE_CATEGORIES, buildTemplateSlides } = await import("@/lib/designer/templateCatalog");
const { TEMPLATE_COPY, TEMPLATE_LANGUAGES } = await import("@/lib/designer/templateCopy");
const fill = await import("@/lib/designer/templateFill");
const { placeholdersIn, filledName, isPlaceholderName } = await import("@/lib/designer/placeholders");
const { TEMPLATE_FORMATS, destinationRatio, planMetaRequests, isAllowedPublishRatio, matchesRatio, visibleRatios } = await import(
  "@/lib/marketing/destinations"
);
const { groupSlides, slideCount } = await import("@/lib/marketing/slides");
const { designFingerprint } = await import("@/lib/marketing/approvalFingerprint");
const { signSlideAsset, verifySlideAsset } = await import("@/lib/marketing/slideAssets");
const { metaPublishBody } = await import("@/lib/social/publishBody");
const { publishToInstagram, publishToFacebook } = await import("@/lib/social/publishDesign");
const { contrastRatio } = await import("@/lib/brand/colour");
const { buildPhotoPostBody, buildPhotoDraftBody } = await import("@/lib/tiktok/specs");
const { makeMediaToken, verifyMediaToken } = await import("@/lib/tiktok/signing");
const { resolveMediaRequest } = await import("@/lib/tiktok/media");

const ALL_OBJECTS = (doc) => {
  const out = [];
  const walk = (list) => {
    for (const o of list || []) {
      out.push(o);
      if (Array.isArray(o.objects)) walk(o.objects);
    }
  };
  walk(doc?.objects);
  return out;
};

// ═════════════════════════════════════════════════════════════════════════
section("1. The catalogue: every template, every slide, the three formats — never 1:1");
// ═════════════════════════════════════════════════════════════════════════
ok(TEMPLATE_CATALOG.length >= 25, `at least ~25 templates (${TEMPLATE_CATALOG.length})`);
ok(new Set(TEMPLATE_CATALOG.map((t) => t.key)).size === TEMPLATE_CATALOG.length, "every template key is unique (the seed upserts on it)");
ok(JSON.stringify(TEMPLATE_FORMATS) === JSON.stringify(["instagram_portrait", "tiktok", "facebook_feed"]), "the formats are 4:5, 9:16, 1.91:1");
const perCategory = Object.fromEntries(TEMPLATE_CATEGORIES.map((c) => [c, TEMPLATE_CATALOG.filter((t) => t.category === c).length]));
ok(perCategory.before_after >= 5, "before/after: at least 5", perCategory);
ok(perCategory.win_work >= 7, "win work: at least 7", perCategory);
ok(perCategory.trust >= 6, "trust: at least 6", perCategory);
ok(perCategory.tips >= 5, "tips: at least 5", perCategory);
ok(perCategory.people >= 5, "people: at least 5", perCategory);
ok(TEMPLATE_CATALOG.every((t) => TEMPLATE_CATEGORIES.includes(t.category)), "every template sits in one of the five sidebar categories");

const BUILT = new Map();
for (const t of TEMPLATE_CATALOG) {
  const slides = buildTemplateSlides(t);
  BUILT.set(t.key, slides);
  const everyFormat = slides.every((s) => TEMPLATE_FORMATS.every((k) => s[k]?.json?.objects?.length > 1));
  const noSquare = slides.every((s) => !s.instagram_post && Object.keys(s).length === 3);
  const sized = slides.every((s) =>
    Object.entries(s).every(([k, l]) => {
      const clip = l.json.objects[0];
      return clip.name === "clip" && clip.width === l.width && clip.height === l.height && matchesRatio(k, l.width, l.height);
    }),
  );
  ok(everyFormat && noSquare && sized, `${t.key}: ${slides.length} slide(s), each 4:5 + 9:16 + 1.91:1 at true size, no square`);
}
const carousels = TEMPLATE_CATALOG.filter((t) => t.slides.length > 1);
ok(carousels.length >= 2 && carousels.every((t) => t.slides.length >= 2 && t.slides.length <= 10), "carousel templates exist and have 2–10 slides", carousels.map((t) => t.key));

// Every copy key a template names exists in every language.
{
  const used = new Set();
  for (const slides of BUILT.values()) {
    for (const s of slides) for (const l of Object.values(s)) for (const o of ALL_OBJECTS(l.json)) {
      if (typeof o.fqText === "string" && o.fqText.startsWith("§")) used.add(o.fqText.slice(1));
    }
  }
  for (const k of ["phone", "website", "town", "areas", "services", "number", "review", "reviewer", "name"]) used.add(`ph.${k}`);
  for (const k of ["spring", "summer", "fall", "winter"]) used.add(k);
  const missing = [];
  for (const lang of TEMPLATE_LANGUAGES) for (const k of used) if (!TEMPLATE_COPY[lang]?.[k]) missing.push(`${lang}:${k}`);
  ok(missing.length === 0, `every template copy key (${used.size}) exists in all ${TEMPLATE_LANGUAGES.length} languages`, missing.slice(0, 10));
  ok(TEMPLATE_LANGUAGES.length === 9, "…and those are the app's nine languages");
}

// No photo, stock or hotlinked asset ships inside a template: images only
// ever arrive from the company's own rows at fill time.
{
  const images = [];
  for (const [key, slides] of BUILT) for (const s of slides) for (const l of Object.values(s)) for (const o of ALL_OBJECTS(l.json)) if (o.type === "image") images.push(key);
  ok(images.length === 0, "no template carries an image of its own — photo slots are placeholders until filled", images);
}

// ═════════════════════════════════════════════════════════════════════════
section("2. Contrast: every text, on what it sits on, at 4.5:1 for hostile brands");
// ═════════════════════════════════════════════════════════════════════════
const HOSTILE = ["#ffff00", "#ffffff", "#000000", "#808080", "#06356b", "#ff6600", "#00ff00", "#7f7f00", "#e6e6e6"];
{
  const failures = [];
  let measured = 0;
  for (const brand of HOSTILE) {
    const pal = fill.templatePalette({ brandColor: brand });
    for (const [key, slides] of BUILT) for (const s of slides) for (const [fmt, l] of Object.entries(s)) for (const o of ALL_OBJECTS(l.json)) {
      let fg = null;
      let on = null;
      if (o.type === "textbox") {
        fg = o.fill;
        on = o.fqOn;
      } else if (o.fqSlot?.role === "logo") {
        fg = o.fqSlot.color;
        on = o.fqSlot.on;
      } else continue;
      if (typeof fg !== "string" || !fg.startsWith("@") || !on) {
        failures.push(`${key}/${fmt}/${o.name}: no measurable pair (${fg} on ${on})`);
        continue;
      }
      const a = pal[fg.slice(1)];
      const b = fill.measurableBackground(pal, on);
      const r = contrastRatio(a, b);
      measured++;
      if (!(r >= 4.5)) failures.push(`${brand} ${key}/${fmt}/${o.name}: ${fg}=${a} on ${on}=${b} → ${r?.toFixed?.(2)}`);
    }
  }
  ok(failures.length === 0, `${measured} text/background pairs measured across ${HOSTILE.length} brand colours, all ≥ 4.5:1`, failures.slice(0, 8));
  ok(contrastRatio("#ffffff", fill.SCRIM_WORST_CASE) >= 4.5, "white on the scrim's worst case (a white photo under 55% black) is ≥ 4.5:1");
}

// ═════════════════════════════════════════════════════════════════════════
section("3. Filling: the company's own facts, or an obvious placeholder");
// ═════════════════════════════════════════════════════════════════════════
const FULL_COMPANY = {
  name: "Maple Painting Co.",
  phone: "613-555-0100",
  website: "https://maplepainting.ca/",
  city: "Ottawa",
  brandColor: "#ffff00",
  country: "CA",
  defaultLanguage: "fr",
};
const REAL_REVIEW = fill.pickReview({ testimonials: [{ quote: "Neat, on time, and the price was the price.", authorName: "Sam R.", rating: 5 }] });
const PHOTOS = fill.assignPhotos([
  { url: "https://res.cloudinary.com/demo/image/upload/v1/a-start.jpg", stage: "start", createdAt: "2026-09-01" },
  { url: "https://res.cloudinary.com/demo/image/upload/v1/b-prog.jpg", stage: "progress", createdAt: "2026-09-02" },
  { url: "https://res.cloudinary.com/demo/image/upload/v1/c-prog.jpg", stage: "progress", createdAt: "2026-09-03" },
  { url: "https://res.cloudinary.com/demo/image/upload/v1/d-finish.jpg", stage: "finish", createdAt: "2026-09-04" },
  { url: "https://res.cloudinary.com/demo/image/upload/v1/e-finish.jpg", stage: "finish", createdAt: "2026-09-05" },
  { url: "https://res.cloudinary.com/demo/image/upload/v1/f-issue.jpg", stage: "issue", createdAt: "2026-09-06" },
]);
ok(PHOTOS.before?.includes("a-start") && PHOTOS.after?.includes("e-finish"), "before = earliest start, after = latest finish", PHOTOS);
ok(!Object.values(PHOTOS).some((u) => u.includes("issue")), "an issue photo is never used");
const NO_PAIR = fill.assignPhotos([{ url: "https://res.cloudinary.com/demo/image/upload/v1/x.jpg", stage: "finish", createdAt: "2026-09-01" }]);
ok(!NO_PAIR.before && !NO_PAIR.after && NO_PAIR.hero, "one finish photo fills the hero slot but never a BEFORE/AFTER pair");
ok(fill.pickReview({ testimonials: [{ quote: "x".repeat(400), authorName: "Long" }] }) === null, "a review too long for a card is skipped, never trimmed");
ok(fill.pickReview({ testimonials: [{ quote: "Great", authorName: "" }] }) === null, "a review with no name is not printed as if it had one");
{
  const g = fill.pickReview({ googleReviews: [{ comment: "Loved it", reviewerName: "Ana", starRating: 4 }] });
  ok(g?.via === "Google" && g.rating === 4, "a Google review the company chose to show is marked as Google's, with its own rating");
}
ok(fill.seasonKey(new Date("2026-09-29"), "CA") === "fall" && fill.seasonKey(new Date("2026-09-29"), "AU") === "spring", "the season follows the company's hemisphere");

const leftovers = /"@(brand|onBrand|paper|ink|muted|accent|wash|onWash|mutedOnWash|accentOnWash|dark|onDark|mutedOnDark|accentOnDark|scrim|onScrim|line|phFill|phInk)"|§|\{(company|phone|website|town|areas|services|season|n)\}|"fq[A-Z]/;
for (const lang of TEMPLATE_LANGUAGES) {
  const pal = fill.templatePalette(FULL_COMPANY);
  const bare = { language: lang, palette: pal, tokens: fill.companyTokens({ company: { name: "X" } }), review: null, photos: {}, logoUrl: null };
  const full = {
    language: lang,
    palette: pal,
    tokens: fill.companyTokens({ company: FULL_COMPANY, services: ["Painting", "Drywall"], areas: "Ottawa, Kanata" }),
    review: REAL_REVIEW,
    photos: { ...PHOTOS, team: PHOTOS.hero },
    logoUrl: "https://res.cloudinary.com/demo/image/upload/v1/logo.png",
  };
  let unresolved = 0;
  let fullPh = { review: 0, photo: 0, contact: 0 };
  let barePh = { review: 0, photo: 0, contact: 0 };
  for (const slides of BUILT.values()) {
    const f1 = fill.fillTemplateSlides(slides, full);
    const f0 = fill.fillTemplateSlides(slides, bare);
    if (leftovers.test(JSON.stringify(f1)) || leftovers.test(JSON.stringify(f0))) unresolved++;
    const p1 = placeholdersIn(f1.flatMap((s) => Object.values(s)));
    const p0 = placeholdersIn(f0.flatMap((s) => Object.values(s)));
    for (const k of Object.keys(fullPh)) {
      fullPh[k] += p1.kinds[k] || 0;
      barePh[k] += p0.kinds[k] || 0;
    }
  }
  ok(unresolved === 0, `${lang}: no colour role, copy key, token or template-only property survives filling`);
  ok(fullPh.review === 0 && fullPh.photo === 0 && fullPh.contact === 0, `${lang}: a company with a real review, photos, phone and website has none of those as placeholders`, fullPh);
  ok(barePh.review > 0 && barePh.photo > 0 && barePh.contact > 0, `${lang}: a company with none of them gets obvious placeholders, never invented values`, barePh);
}
{
  const slides = BUILT.get("trust-review-card");
  const filled = fill.fillTemplateSlides(slides, {
    language: "en",
    palette: fill.templatePalette(FULL_COMPANY),
    tokens: fill.companyTokens({ company: FULL_COMPANY }),
    review: REAL_REVIEW,
    photos: {},
    logoUrl: null,
  });
  const texts = ALL_OBJECTS(filled[0].instagram_portrait.json).filter((o) => o.type === "textbox").map((o) => o.text);
  ok(texts.includes(REAL_REVIEW.text), "the review card prints the real review's words, unaltered");
  ok(texts.includes("★★★★★"), "…with that review's own 5 stars");
  const bare = fill.fillTemplateSlides(slides, { language: "en", palette: fill.templatePalette({}), tokens: fill.companyTokens({ company: { name: "X" } }), review: null, photos: {} });
  const phNames = ALL_OBJECTS(bare[0].instagram_portrait.json).filter((o) => isPlaceholderName(o.name)).map((o) => o.name);
  ok(phNames.some((n) => n.startsWith("fq-ph:review")) && phNames.length >= 3, "no review → the quote, name AND stars are all review placeholders", phNames);
}
{
  const filled = fill.fillTemplateSlides(BUILT.get("ba-diagonal"), { language: "en", palette: fill.templatePalette({}), tokens: fill.companyTokens({ company: FULL_COMPANY }), review: null, photos: PHOTOS });
  const before = ALL_OBJECTS(filled[0].tiktok.json).find((o) => o.name === "template-photo:before");
  ok(before?.type === "image" && before.clipPath?.type === "polygon" && before.crossOrigin === "anonymous", "the diagonal BEFORE photo is clipped along the split and untainted");
  ok(/w_1080,h_1920,c_fill/.test(before?.src || ""), "…and asks Cloudinary for exactly the slot's size", before?.src);
}

// ═════════════════════════════════════════════════════════════════════════
section("4. Placeholder mechanics");
// ═════════════════════════════════════════════════════════════════════════
{
  const doc = { objects: [{ name: "clip" }, { name: "fq-ph:photo:before", type: "group", objects: [{ name: "x" }, { name: "fq-ph:text" }] }, { name: "fq-ph:review:quote" }, { name: "fq-filled:stat" }] };
  const r = placeholdersIn(doc);
  ok(r.count === 2 && r.kinds.photo === 1 && r.kinds.review === 1, "a photo slot counts once, a filled one not at all", r);
  ok(filledName("fq-ph:review:quote") === "fq-filled:review:quote" && !isPlaceholderName(filledName("fq-ph:stat")), "typing into a placeholder renames it out of the count");
  ok(placeholdersIn([{ json: null }, null, { json: { objects: "nope" } }]).count === 0, "hostile input counts nothing and does not throw");
  const events = read("app/components/designer/hooks/useCanvasEvents.js");
  ok(/canvas\.on\("text:changed"[\s\S]{0,200}filledName\(/.test(events) && /canvas\.off\("text:changed"\)/.test(events), "the editor renames a placeholder the moment it is typed into (and unhooks it)");
}

// ═════════════════════════════════════════════════════════════════════════
section("5. The route stubs");
// ═════════════════════════════════════════════════════════════════════════
const store = {
  companies: [
    { id: "co1", name: "Maple Painting Co.", phone: "613-555-0100", website: null, city: "Ottawa", brandColor: "#ffff00", logoUrl: null, defaultLanguage: "en", country: "CA", serviceRadiusKm: null, servicePostalPrefixes: [], latitude: null, longitude: null },
    { id: "co2", name: "Other Co", brandColor: "#000000", defaultLanguage: "fr", servicePostalPrefixes: [] },
  ],
  templates: [],
  designs: [],
  layouts: [],
  slideLayouts: [],
  socialPublishes: [],
  tiktokPublishes: [],
};
let seq = 0;
const id = (p) => `${p}${++seq}`;
const matches = (row, where = {}) =>
  Object.entries(where).every(([k, v]) => {
    if (k === "OR") return v.some((w) => matches(row, w));
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      if ("gt" in v) return row[k] > v.gt;
      return false;
    }
    return (row[k] ?? null) === v;
  });
const pick = (row, select) => (select ? Object.fromEntries(Object.keys(select).filter((k) => typeof select[k] !== "object").map((k) => [k, row[k] ?? null])) : { ...row });
const withRelations = (d, spec = {}) => {
  const out = { ...d };
  if (spec.layouts) out.layouts = store.layouts.filter((l) => l.designId === d.id).map((l) => ({ ...l }));
  if (spec.slideLayouts) out.slideLayouts = store.slideLayouts.filter((l) => l.designId === d.id).map((l) => ({ ...l }));
  if (spec.campaign) out.campaign = { id: "camp1", name: "Camp" };
  if (spec.approvedBy) out.approvedBy = null;
  return out;
};
globalThis.__FQ_DB = {
  company: { findUnique: async ({ where }) => store.companies.find((c) => c.id === where.id) || null },
  companyServiceCategory: { findMany: async () => [] },
  testimonial: { findMany: async () => [] },
  googleReview: { findMany: async () => [] },
  job: { findMany: async () => [] },
  jobPhoto: { findMany: async () => [] },
  designTemplate: {
    findMany: async ({ where, select }) => store.templates.filter((t) => matches(t, where)).map((t) => pick(t, select)),
    findFirst: async ({ where, select }) => {
      const t = store.templates.find((x) => matches(x, where));
      return t ? pick(t, select) : null;
    },
    create: async ({ data, select }) => {
      if (store.templates.some((t) => t.name === data.name)) throw new Error("unique name");
      const row = { id: id("t"), key: null, companyId: null, archivedAt: null, category: null, displayName: null, thumbnailUrl: null, createdAt: new Date(), ...data };
      store.templates.push(row);
      return pick(row, select);
    },
    updateMany: async ({ where, data }) => {
      const hit = store.templates.filter((t) => matches(t, where));
      hit.forEach((t) => Object.assign(t, data));
      return { count: hit.length };
    },
  },
  marketingDesign: {
    findUnique: async ({ where, include, select }) => {
      const d = store.designs.find((x) => x.id === where.id);
      return d ? withRelations(d, include || select) : null;
    },
    findFirst: async ({ where, select }) => {
      const d = store.designs.find((x) => matches(x, where));
      return d ? withRelations(d, select) : null;
    },
  },
  socialPublish: {
    create: async ({ data }) => {
      const row = { id: id("sp"), ...data };
      store.socialPublishes.push(row);
      return { ...row };
    },
    update: async ({ where, data }) => Object.assign(store.socialPublishes.find((r) => r.id === where.id), data),
    findMany: async ({ where }) => store.socialPublishes.filter((r) => r.designId === where.designId),
  },
  tikTokPublish: {
    create: async ({ data }) => {
      const row = { id: id("tt"), ...data };
      store.tiktokPublishes.push(row);
      return { ...row };
    },
    update: async ({ where, data }) => Object.assign(store.tiktokPublishes.find((r) => r.id === where.id), data),
    findMany: async () => [],
  },
};
let member = { id: "m1", companyId: "co1", role: "owner" };
globalThis.__FQ_MEMBER = async () => member;
let uploads = 0;
let uploadAnswer = { secure_url: "https://res.cloudinary.com/demo/image/upload/v1/fieldquo/companies/co1/social/p.jpg", width: 1080, height: 1350, bytes: 200000 };
globalThis.__FQ_UPLOAD = async () => {
  uploads++;
  return { ...uploadAnswer };
};
globalThis.__FQ_META_CONN = async () => ({ connected: true, mock: true, pageId: "p1", pageName: "Maple", pageAccessToken: "tok", instagramUserId: "ig1", instagramUsername: "maple" });
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "check-only-secret";

const req = (url, method = "GET", body) => ({ url, method, headers: new Map(), json: async () => body });
const P = (params) => ({ params: Promise.resolve(params) });
ok(true, "stubs installed (db, member, Next, Cloudinary, Meta connection, TikTok)");

// ═════════════════════════════════════════════════════════════════════════
section("6. Company scoping: Your templates / FieldQuo templates, archive not delete");
// ═════════════════════════════════════════════════════════════════════════
{
  const templatesRoute = await import("@/app/api/designer/templates/route.js");
  const templateRoute = await import("@/app/api/designer/templates/[id]/route.js");
  const fillRoute = await import("@/app/api/designer/templates/[id]/fill/route.js");
  const slides = BUILT.get("win-free-estimate");
  store.templates.push(
    { id: "cat1", key: "win-free-estimate", name: "catalog:win-free-estimate", companyId: null, archivedAt: null, category: "win_work", slides, json: slides[0].instagram_portrait.json, width: 1080, height: 1350, createdAt: new Date(1) },
    { id: "own2", key: null, name: "company-template:x2", displayName: "Other's promo", companyId: "co2", archivedAt: null, slides: [{ instagram_portrait: { json: { objects: [] }, width: 1080, height: 1350 } }], json: { objects: [] }, width: 1080, height: 1350, createdAt: new Date(2) },
  );
  store.designs.push({ id: "dA", companyId: "co1", name: "Kitchen", caption: "", hashtags: [] }, { id: "dB", companyId: "co2", name: "Theirs", caption: "", hashtags: [] });
  store.layouts.push({ designId: "dA", ratioKey: "instagram_portrait", json: { objects: [{ name: "clip", width: 1080, height: 1350 }] }, width: 1080, height: 1350 });
  store.slideLayouts.push({ designId: "dA", position: 1, ratioKey: "instagram_portrait", json: { objects: [{ name: "clip" }] }, width: 1080, height: 1350 });

  const saved = await templatesRoute.POST(req("http://x", "POST", { designId: "dA", name: "  Spring promo  " }));
  ok(saved.status === 201 && saved.body.own === true && saved.body.name === "Spring promo", "Save as template: the company's own template, under the name typed", saved.body);
  const row = store.templates.find((t) => t.id === saved.body.id);
  ok(row?.companyId === "co1" && row.name.startsWith("company-template:") && row.displayName === "Spring promo", "…scoped to this company, with an internal unique handle and its own display name");
  ok(Array.isArray(row?.slides) && row.slides.length === 2, "…carrying every slide of the design (slide 1 and the carousel's slide 2)");
  const twice = await templatesRoute.POST(req("http://x", "POST", { designId: "dA", name: "Spring promo" }));
  ok(twice.status === 201, "two templates may share a display name — `name` stays unique underneath");
  const foreignSave = await templatesRoute.POST(req("http://x", "POST", { designId: "dB", name: "Stolen" }));
  ok(foreignSave.status === 404, "saving ANOTHER company's design as a template is refused");
  member = { id: "m9", companyId: "co1", role: "crew" };
  const crewSave = await templatesRoute.POST(req("http://x", "POST", { designId: "dA", name: "Crew" }));
  ok(crewSave.status === 403, "…and so is a role that cannot manage marketing", crewSave.status);
  member = { id: "m1", companyId: "co1", role: "owner" };

  const list = await templatesRoute.GET(req("http://x"));
  const ownIds = list.body.own.map((t) => t.id);
  ok(ownIds.includes(saved.body.id) && !ownIds.includes("own2"), "GET: Your templates are this company's only — never another's");
  ok(list.body.catalog.map((t) => t.id).includes("cat1") && !list.body.catalog.some((t) => t.companyId), "…and the FieldQuo catalogue is the shared shelf");
  const preview = JSON.stringify(list.body.catalog[0].preview.json);
  ok(!/"@brand"|§/.test(preview) && preview.includes("Maple Painting Co."), "…whose preview is already in this company's colours and name");

  const foreignDel = await templateRoute.DELETE(req("http://x", "DELETE"), P({ id: "own2" }));
  ok(foreignDel.status === 404 && store.templates.find((t) => t.id === "own2").archivedAt === null, "archiving another company's template: 404, untouched");
  const catDel = await templateRoute.DELETE(req("http://x", "DELETE"), P({ id: "cat1" }));
  ok(catDel.status === 404 && store.templates.find((t) => t.id === "cat1").archivedAt === null, "the FieldQuo catalogue cannot be archived by a company");
  const before = store.templates.length;
  const del = await templateRoute.DELETE(req("http://x", "DELETE"), P({ id: saved.body.id }));
  ok(del.status === 200 && store.templates.length === before && store.templates.find((t) => t.id === saved.body.id).archivedAt instanceof Date, "delete = archive: the row stays, archivedAt is set");
  const after = await templatesRoute.GET(req("http://x"));
  ok(!after.body.own.some((t) => t.id === saved.body.id), "…and it is gone from the gallery");

  const filled = await fillRoute.POST(req("http://x", "POST", {}), P({ id: "cat1" }));
  ok(filled.status === 200 && filled.body.slides[0].instagram_portrait && !/"@brand"|§/.test(JSON.stringify(filled.body.slides)), "fill: every format, resolved for this company");
  const foreignFill = await fillRoute.POST(req("http://x", "POST", {}), P({ id: "own2" }));
  ok(foreignFill.status === 404, "…and another company's template cannot be filled (or read) by this one");

  const src = read("app/components/designer/TemplateSidebar.js");
  ok(src.indexOf("app.designerTemplates.yours") > 0 && src.indexOf("app.designerTemplates.yours") < src.indexOf("app.designerTemplates.fieldquo"), "the sidebar shows Your templates ABOVE FieldQuo templates");
  const seed = read("prisma/seed-design-templates.js");
  ok(/where: \{ key: t\.key \}/.test(seed) && !/deleteMany|\.delete\(/.test(seed), "the seed upserts on the stable key and never deletes");
}

// ═════════════════════════════════════════════════════════════════════════
section("7. Per-destination sizing: the rule, and the routes refusing the wrong format");
// ═════════════════════════════════════════════════════════════════════════
ok(destinationRatio("instagram") === "instagram_portrait" && destinationRatio("facebook") === "instagram_portrait", "Instagram feed and Facebook feed: 4:5");
ok(destinationRatio("facebook", { facebookStyle: "link" }) === "facebook_feed", "Facebook link-style: 1.91:1");
ok(destinationRatio("tiktok") === "tiktok" && destinationRatio("reels") === "instagram_story" && destinationRatio("stories") === "instagram_story", "TikTok, Reels, Stories: 9:16");
ok(!visibleRatios([]).some((r) => r.key === "instagram_post") && visibleRatios(["instagram_post"]).some((r) => r.key === "instagram_post"), "a new design is never offered 1:1; an existing square design still opens on it");
ok(!isAllowedPublishRatio("instagram", "instagram_story", []) && !isAllowedPublishRatio("facebook", "tiktok", []) && !isAllowedPublishRatio("instagram", "instagram_post", ["instagram_portrait"]), "the server refuses a 9:16 on a feed, and a square for a non-square design");
ok(isAllowedPublishRatio("facebook", "facebook_feed", []) && isAllowedPublishRatio("instagram", "instagram_post", ["instagram_post"]), "…and allows link-style Facebook, and the square for a square design");
ok(JSON.stringify(planMetaRequests({ platforms: ["facebook", "instagram"], savedKeys: [], facebookStyle: "link" })) === JSON.stringify([{ ratioKey: "facebook_feed", platforms: ["facebook"] }, { ratioKey: "instagram_portrait", platforms: ["instagram"] }]), "a link-style Facebook post splits into its own request with its own image");
ok(matchesRatio("instagram_portrait", 1080, 1350) && !matchesRatio("instagram_portrait", 1080, 1080) && !matchesRatio("nope", 1, 1), "matchesRatio measures proportions, not trust");

const publishRoute = await import("@/app/api/marketing/designer/designs/[id]/publish/route.js");
const approve = (d) => {
  d.approvedAt = new Date();
  d.approvedFingerprint = designFingerprint({
    layouts: store.layouts.filter((l) => l.designId === d.id),
    slideLayouts: store.slideLayouts.filter((l) => l.designId === d.id),
    caption: d.caption,
    hashtags: d.hashtags,
  });
};
const IMG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64")}`;
const post = (designId, body) => publishRoute.POST(req("http://x", "POST", body), P({ id: designId }));
{
  const d = { id: "dP", companyId: "co1", name: "Portrait", caption: "Hello", hashtags: [] };
  store.designs.push(d);
  store.layouts.push({ designId: "dP", ratioKey: "instagram_portrait", json: { objects: [{ name: "clip" }] }, width: 1080, height: 1350 });
  approve(d);
  uploads = 0;
  const story = await post("dP", { ratioKey: "instagram_story", platforms: ["instagram"], imageBase64: IMG });
  ok(story.status === 400 && story.body.error === "wrong_format" && uploads === 0, "a 9:16 sent to the Instagram feed: refused before anything is uploaded", story.body);
  const sq = await post("dP", { ratioKey: "instagram_post", platforms: ["facebook"], imageBase64: IMG });
  ok(sq.status === 400 && sq.body.error === "wrong_format", "a square sent for a 4:5 design: refused");
  uploadAnswer = { ...uploadAnswer, width: 1080, height: 1080 };
  const lying = await post("dP", { ratioKey: "instagram_portrait", platforms: ["facebook"], imageBase64: IMG });
  ok(lying.status === 400 && lying.body.error === "wrong_format", "pixels that are not 4:5 under a 4:5 label: refused on Cloudinary's measurement");
  uploadAnswer = { ...uploadAnswer, width: 1080, height: 1350 };
  const right = await post("dP", { ratioKey: "instagram_portrait", platforms: ["facebook"], imageBase64: IMG });
  ok(right.status === 200 && right.body.results.facebook.status === "published", "the right format posts", right.body);
}

// ═════════════════════════════════════════════════════════════════════════
section("8. Placeholders block publishing — Meta and TikTok routes");
// ═════════════════════════════════════════════════════════════════════════
{
  const d = { id: "dT", companyId: "co1", name: "From template", caption: "Hi", hashtags: [] };
  store.designs.push(d);
  const layout = { designId: "dT", ratioKey: "instagram_portrait", json: { objects: [{ name: "clip" }, { name: "fq-ph:review:quote", type: "textbox", text: "[Paste a real review]" }] }, width: 1080, height: 1350 };
  store.layouts.push(layout);
  approve(d);
  uploads = 0;
  const blocked = await post("dT", { ratioKey: "instagram_portrait", platforms: ["facebook", "instagram"], imageBase64: IMG });
  ok(blocked.status === 409 && blocked.body.error === "placeholders_remaining" && blocked.body.placeholders.kinds.review === 1, "Meta: a placeholder review blocks the post", blocked.body);
  ok(uploads === 0 && !store.socialPublishes.some((r) => r.designId === "dT"), "…before any upload or publish row");
  const get = await publishRoute.GET(req("http://x"), P({ id: "dT" }));
  ok(get.body.placeholders?.count === 1, "…and the dialog is told up front (GET)");

  const tiktokRoute = await import("@/app/api/marketing/designer/designs/[id]/tiktok/route.js");
  process.env.TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || "k";
  process.env.TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || "s";
  process.env.META_TOKEN_ENCRYPTION_KEY = process.env.META_TOKEN_ENCRYPTION_KEY || Buffer.alloc(32, 7).toString("base64");
  store.layouts.push({ ...layout, ratioKey: "tiktok", width: 1080, height: 1920 });
  approve(d);
  const tt = await tiktokRoute.POST(req("http://x", "POST", { consent: true, imageBase64: IMG, privacyLevel: "SELF_ONLY" }), P({ id: "dT" }));
  ok(tt.status === 409 && tt.body.code === "placeholders_remaining", "TikTok: the same placeholder blocks the post", tt.body);

  // Typed into → renamed → allowed.
  layout.json = { objects: [{ name: "clip" }, { name: filledName("fq-ph:review:quote"), type: "textbox", text: "Great job" }] };
  store.layouts.find((l) => l.designId === "dT" && l.ratioKey === "tiktok").json = layout.json;
  approve(d);
  const cleared = await post("dT", { ratioKey: "instagram_portrait", platforms: ["facebook"], imageBase64: IMG });
  ok(cleared.status === 200, "once the placeholder is replaced, the same post goes through", cleared.body);
}

// ═════════════════════════════════════════════════════════════════════════
section("9. Carousels: payload shapes on every platform");
// ═════════════════════════════════════════════════════════════════════════
{
  // Instagram — item containers, then ONE carousel container with the caption.
  const calls = [];
  const client = {
    getInstagramPublishingLimit: async () => ({ quota_usage: 1, config: { quota_total: 50 } }),
    createInstagramCarouselItem: async (a) => (calls.push(["item", a.imageUrl]), `item-${calls.length}`),
    createInstagramCarouselContainer: async (a) => (calls.push(["carousel", a.childIds, a.caption]), "ctr"),
    createInstagramContainer: async () => (calls.push(["single"]), "single"),
    getInstagramContainerStatus: async () => "FINISHED",
    publishInstagramContainer: async ({ containerId }) => (calls.push(["publish", containerId]), "post1"),
  };
  const carousel = [1, 2, 3].map((i) => ({ imageUrl: `https://res.cloudinary.com/demo/image/upload/s${i}.jpg`, width: 1080, height: 1350, fileSizeBytes: 1000 }));
  const conn = { connected: true, instagramUserId: "ig1", pageAccessToken: "t", pageId: "p1" };
  const r = await publishToInstagram({ connection: conn, caption: "Look", carousel, client, sleep: async () => {} });
  ok(r.status === "published" && calls.filter((c) => c[0] === "item").length === 3 && !calls.some((c) => c[0] === "single"), "Instagram: one item container per slide, no single-image container");
  const ctr = calls.find((c) => c[0] === "carousel");
  ok(JSON.stringify(ctr?.[1]) === JSON.stringify(["item-1", "item-2", "item-3"]) && ctr[2] === "Look", "…then ONE CAROUSEL container with the children in order and the caption");
  ok(calls.at(-1)[0] === "publish" && calls.at(-1)[1] === "ctr", "…and it is the carousel container that is published");
  let refused = null;
  try {
    await publishToInstagram({ connection: conn, caption: "x", carousel: [...carousel, { ...carousel[0], width: 1080, height: 1920 }], client, sleep: async () => {} });
  } catch (e) {
    refused = e.code;
  }
  ok(refused === "invalid_image", "…and a carousel with one 9:16 slide is refused before Meta is called");

  // Facebook — unpublished photos (temporary when scheduled), then one feed post.
  const fb = [];
  const fbClient = {
    uploadFacebookUnpublishedPhoto: async (a) => (fb.push(["photo", a.temporary]), `ph${fb.length}`),
    publishFacebookMultiPhoto: async (a) => (fb.push(["feed", a.mediaIds, a.scheduledPublishTime]), "feedpost"),
    publishFacebookPhoto: async () => (fb.push(["single"]), "x"),
  };
  const when = new Date(Date.now() + 2 * 3600 * 1000);
  const fr = await publishToFacebook({ connection: conn, caption: "c", carousel, scheduledPublishTime: when, client: fbClient });
  ok(fr.status === "scheduled" && fb.filter((c) => c[0] === "photo" && c[1] === true).length === 3, "Facebook: every photo uploaded unpublished, temporary=true for a scheduled post");
  ok(JSON.stringify(fb.find((c) => c[0] === "feed")[1]) === JSON.stringify(["ph1", "ph2", "ph3"]) && !fb.some((c) => c[0] === "single"), "…then one feed post attaching them in order");

  // The real Graph client's parameters, over a stubbed fetch.
  const graph = await import("@/lib/social/metaGraphClient");
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen.push({ url: new URL(url), method: init?.method });
    return { ok: true, json: async () => ({ id: "x1", post_id: "x1" }) };
  };
  await graph.createInstagramCarouselItem({ igUserId: "ig1", accessToken: "t", imageUrl: "https://i/1.jpg" });
  await graph.createInstagramCarouselContainer({ igUserId: "ig1", accessToken: "t", childIds: ["a", "b"], caption: "Hi" });
  await graph.uploadFacebookUnpublishedPhoto({ pageId: "p1", pageAccessToken: "t", imageUrl: "https://i/1.jpg", temporary: true });
  await graph.publishFacebookMultiPhoto({ pageId: "p1", pageAccessToken: "t", mediaIds: ["m1", "m2"], caption: "Hi", scheduledPublishTime: when });
  globalThis.fetch = realFetch;
  const q = (i, k) => seen[i].url.searchParams.get(k);
  ok(seen[0].url.pathname.endsWith("/ig1/media") && q(0, "is_carousel_item") === "true" && q(0, "caption") === null, "Graph: a carousel item is is_carousel_item=true with no caption");
  ok(q(1, "media_type") === "CAROUSEL" && q(1, "children") === "a,b" && q(1, "caption") === "Hi", "Graph: the container is media_type=CAROUSEL, children comma-separated, caption on it");
  ok(seen[2].url.pathname.endsWith("/p1/photos") && q(2, "published") === "false" && q(2, "temporary") === "true", "Graph: a Page photo for a scheduled multi-photo post is published=false&temporary=true");
  ok(seen[3].url.pathname.endsWith("/p1/feed") && q(3, "attached_media[0]") === '{"media_fbid":"m1"}' && q(3, "attached_media[1]") === '{"media_fbid":"m2"}', "Graph: the feed post attaches attached_media[i]={\"media_fbid\":…}");
  ok(q(3, "published") === "false" && q(3, "unpublished_content_type") === "SCHEDULED" && Number(q(3, "scheduled_publish_time")) > 0, "Graph: …scheduled with published=false, scheduled_publish_time, unpublished_content_type=SCHEDULED");

  // TikTok — photo mode with several photo_images; one photo unchanged.
  const oneOld = { media_type: "PHOTO", post_mode: "DIRECT_POST", post_info: { description: "d", privacy_level: "SELF_ONLY", disable_comment: true, brand_content_toggle: false, brand_organic_toggle: false }, source_info: { source: "PULL_FROM_URL", photo_images: ["u0"], photo_cover_index: 0 } };
  ok(md5(buildPhotoPostBody({ privacyLevel: "SELF_ONLY", description: "d", photoUrl: "u0" })) === md5(oneOld), "TikTok: a single photo's body is byte-for-byte the old one");
  const multi = buildPhotoPostBody({ privacyLevel: "SELF_ONLY", description: "d", photoUrl: "u0", photoUrls: ["u0", "u1", "u2"] });
  ok(JSON.stringify(multi.source_info.photo_images) === '["u0","u1","u2"]' && multi.source_info.photo_cover_index === 0 && multi.media_type === "PHOTO", "TikTok: a carousel is ONE photo post with photo_images in slide order, the first as cover");
  ok(buildPhotoDraftBody({ description: "d", photoUrl: "u0", photoUrls: ["u0", "u1"] }).source_info.photo_images.length === 2, "…drafts too");

  // The media URL: a token names image i of its own row, nothing else.
  const rootKey = Buffer.alloc(32, 9);
  const now = 1_800_000_000;
  const t1 = makeMediaToken({ rootKey, publishId: "tt1", companyId: "co1", nowSeconds: now, index: 1 });
  const t0 = makeMediaToken({ rootKey, publishId: "tt1", companyId: "co1", nowSeconds: now });
  ok(verifyMediaToken(t1, { rootKey, nowSeconds: now }).index === 1 && verifyMediaToken(t0, { rootKey, nowSeconds: now }).index === undefined, "a slide token carries its index inside the signature; a single token has none");
  const row = { companyId: "co1", status: "processing", imageUrl: "https://res.cloudinary.com/demo/image/upload/a.jpg", imageUrls: ["https://res.cloudinary.com/demo/image/upload/a.jpg", "https://res.cloudinary.com/demo/image/upload/b.jpg"] };
  const serve = (seg) => resolveMediaRequest({ segment: seg, rootKey, nowSeconds: now, verificationFile: null, loadRow: async () => row });
  ok((await serve(t1))?.imageUrl.endsWith("b.jpg") && (await serve(t0))?.imageUrl.endsWith("a.jpg"), "the media route serves imageUrls[i] for slide i, imageUrl for a single photo");
  const t5 = makeMediaToken({ rootKey, publishId: "tt1", companyId: "co1", nowSeconds: now, index: 5 });
  ok((await serve(t5)) === null, "…and nothing for an index the row does not have");
  const [pl, sig] = t1.split(".");
  const forged = `${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(pl, "base64url").toString()), i: 0 })).toString("base64url")}.${sig}`;
  ok(!verifyMediaToken(forged, { rootKey, nowSeconds: now }).ok, "…and slide 2's URL cannot be edited into slide 1's");

  // Signed slide receipts.
  const secret = "s3cret";
  const receipt = signSlideAsset({ companyId: "co1", designId: "dC", url: "https://res.cloudinary.com/demo/image/upload/x.jpg", width: 1080, height: 1350, bytes: 9, ratioKey: "instagram_portrait", nowSeconds: now, secret });
  ok(verifySlideAsset(receipt, { companyId: "co1", designId: "dC", nowSeconds: now, secret })?.width === 1080, "a slide receipt verifies for its own company and design");
  ok(!verifySlideAsset(receipt, { companyId: "co2", designId: "dC", nowSeconds: now, secret }) && !verifySlideAsset(receipt, { companyId: "co1", designId: "dX", nowSeconds: now, secret }), "…not for another company or another design");
  ok(!verifySlideAsset(receipt, { companyId: "co1", designId: "dC", nowSeconds: now + 3601, secret }) && !verifySlideAsset(`${receipt}x`, { companyId: "co1", designId: "dC", nowSeconds: now, secret }), "…not expired, not tampered");

  // Through the publish route: whole carousel or nothing, rows carry every URL.
  const d = { id: "dC", companyId: "co1", name: "Carousel", caption: "Swipe", hashtags: [] };
  store.designs.push(d);
  store.layouts.push({ designId: "dC", ratioKey: "instagram_portrait", json: { objects: [{ name: "clip" }] }, width: 1080, height: 1350 });
  store.slideLayouts.push(
    { designId: "dC", position: 1, ratioKey: "instagram_portrait", json: { objects: [{ name: "clip" }, { name: "s2" }] }, width: 1080, height: 1350 },
    { designId: "dC", position: 2, ratioKey: "instagram_portrait", json: { objects: [{ name: "clip" }, { name: "s3" }] }, width: 1080, height: 1350 },
  );
  approve(d);
  const mint = (n, ratioKey = "instagram_portrait", h = 1350) => signSlideAsset({ companyId: "co1", designId: "dC", url: `https://res.cloudinary.com/demo/image/upload/c${n}.jpg`, width: 1080, height: h, bytes: 5000, ratioKey });
  const short = await post("dC", { ratioKey: "instagram_portrait", platforms: ["facebook"], slideTokens: [mint(1), mint(2)] });
  ok(short.status === 400 && short.body.error === "slides_mismatch", "a carousel missing a slide is refused");
  const single = await post("dC", { ratioKey: "instagram_portrait", platforms: ["facebook"], imageBase64: IMG });
  ok(single.status === 400 && single.body.error === "slides_mismatch", "…and so is posting a 3-slide design as one image");
  const wrongShape = await post("dC", { ratioKey: "instagram_portrait", platforms: ["facebook"], slideTokens: [mint(1), mint(2), mint(3, "tiktok", 1920)] });
  ok(wrongShape.status === 400 && wrongShape.body.error === "wrong_format", "…and a slide in another format is refused");
  uploads = 0;
  const good = await post("dC", { ratioKey: "instagram_portrait", platforms: ["facebook"], slideTokens: [mint(1), mint(2), mint(3)] });
  const fbRow = store.socialPublishes.filter((r) => r.designId === "dC").at(-1);
  ok(good.status === 200 && good.body.results.facebook.status === "published" && uploads === 0, "all three receipts: posted, with no second upload", good.body);
  ok(fbRow?.imageUrls?.length === 3 && fbRow.imageUrl.endsWith("c1.jpg"), "…and the row keeps every slide's URL in order (what a scheduled fire reads back)");
  const cron = read("app/api/cron/social-scheduled-publish/route.js");
  ok(/row\.imageUrls\.length > 1/.test(cron) && /carousel,\s*client/.test(cron), "the scheduled-publish cron posts a carousel row as a carousel");
}

// ═════════════════════════════════════════════════════════════════════════
section("10. Unchanged for what existed: the 1:1 publish body (md5) and fingerprints");
// ═════════════════════════════════════════════════════════════════════════
{
  // The body the old dialog built for an existing square design: its
  // starting shape was the square (the removed defaultPublishShape()), and it
  // wrote the keys in exactly this order.
  const oldBody = (platforms, scheduledFor, simulateFailure) =>
    JSON.stringify({ ratioKey: "instagram_post", platforms, caption: "Fresh paint", imageBase64: IMG, scheduledFor, simulateFailure });
  const legacyKeys = [
    ["instagram_post"],
    ["instagram_post", "instagram_story", "tiktok", "facebook_feed", "youtube_thumb"],
  ];
  for (const savedKeys of legacyKeys) {
    for (const [platforms, when, sim] of [
      [["facebook", "instagram"], undefined, undefined],
      [["facebook"], undefined, undefined],
      [["instagram"], "2026-10-01T10:00:00.000Z", undefined],
      [["facebook", "instagram"], undefined, "rate_limited"],
    ]) {
      const plan = planMetaRequests({ platforms, savedKeys, facebookStyle: "feed" });
      const next = plan.map((p) => JSON.stringify(metaPublishBody({ ratioKey: p.ratioKey, platforms: p.platforms, caption: "Fresh paint", imageBase64: IMG, slideTokens: undefined, scheduledFor: when, simulateFailure: sim })));
      ok(plan.length === 1 && md5(next[0]) === md5(oldBody(platforms, when, sim)), `existing 1:1 design [${savedKeys.join(",")}] → ${platforms.join("+")}${when ? " scheduled" : ""}${sim ? " (demo failure)" : ""}: ONE request, md5 identical`, `${md5(next[0] || "")} vs ${md5(oldBody(platforms, when, sim))}`);
    }
  }
  // The old fingerprint algorithm, reproduced: a design with no extra slides
  // must fingerprint identically, or every live approval would go stale.
  const canonical = (v) => (Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v);
  const layouts = [{ ratioKey: "instagram_post", json: { b: 1, a: [2, 1] }, width: 1080, height: 1080 }, { ratioKey: "facebook_feed", json: { objects: [] }, width: 1200, height: 630 }];
  const oldFp = createHash("sha256").update(JSON.stringify({ layouts: layouts.map((l) => ({ ratioKey: l.ratioKey, width: l.width, height: l.height, json: canonical(l.json) })).sort((a, b) => (a.ratioKey < b.ratioKey ? -1 : 1)), caption: "c", hashtags: ["#x"] })).digest("hex");
  ok(designFingerprint({ layouts, caption: "c", hashtags: ["#x"] }) === oldFp && designFingerprint({ layouts, slideLayouts: [], caption: "c", hashtags: ["#x"] }) === oldFp, "a design with no extra slides fingerprints exactly as before carousels");
  ok(designFingerprint({ layouts, slideLayouts: [{ position: 1, ratioKey: "instagram_post", json: {}, width: 1, height: 1 }], caption: "c", hashtags: ["#x"] }) !== oldFp, "…and adding a slide changes it (the approval goes stale, truthfully)");
  ok(slideCount([]) === 1 && slideCount([{ position: 1 }, { position: 1 }, { position: 2 }]) === 3, "slideCount counts distinct extra positions");
  ok(groupSlides([{ ratioKey: "a", json: 1 }], [{ position: 3, ratioKey: "a", json: 3 }, { position: 1, ratioKey: "a", json: 2 }]).map((s) => s.a.json).join() === "1,2,3", "groupSlides orders slides and closes a gap");
  const modal = read("app/components/designer/PublishModal.js");
  ok(/metaPublishBody\(/.test(modal) && !modal.includes("const SHAPES = ["), "the dialog builds its body with metaPublishBody() and has no shape picker");
}

console.log(`\n${checks} checks, ${fail} failure(s).`);
process.exit(fail ? 1 : 0);
