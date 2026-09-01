// scripts/check-designer-reach.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-designer-reach.mjs
//
// Guards the reachability work on top of the already-ported canvas editor
// (see scripts/check-designer.mjs for the port itself): a real /app page
// mounts it, a real Prisma model saves per-ratio layouts independently, and
// "download all" really does produce five differently-named files. All three
// were the literal gap the coordinator's brief opened with — "no /app page
// mounts DesignerLoader" — and a check that only re-read the source for
// comforting strings would prove nothing a reviewer couldn't already see.
//
// ══ What is executed, and what is read ═════════════════════════════════════
//
// Section 3 (per-ratio persistence) runs the REAL route handlers —
// app/api/marketing/designer/designs/route.js and its children — against an
// in-memory Prisma stand-in, the same technique
// scripts/check-feature-flags.mjs uses and for the same reason: "two designs
// never share a layout row" is a claim about behaviour, and reading the
// upsert's `where` clause only proves the code SAYS the right key, not that
// two consecutive saves for different ratios actually land in different
// rows. Sections 1, 2 and 4 are structural (a component imports what it
// should, a registry entry has the fields it claims) and are read, the same
// way scripts/check-designer.mjs reads DesignerLoader.js's own shape rather
// than executing next/dynamic.
//
// Comments are stripped before any regex that greps source — AGENTS.md's own
// note about a prior agent's two false passes from checks reading their own
// explanatory prose applies here too: this file's module docs above use the
// words "ssr: false" and "DesignerLoader" in prose, and so do the files it
// inspects.
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));

let fail = 0;
let checks = 0;
const ok = (cond, msg, detail) => {
  checks++;
  console.log((cond ? "  ok   " : "  FAIL ") + msg + (cond || detail === undefined ? "" : `  — ${detail}`));
  if (!cond) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, "");
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. The designer page mounts DesignerLoader, behind ssr:false, all the way
      down — not just "some file somewhere imports next/dynamic"
   ═══════════════════════════════════════════════════════════════════════════

   The page itself can't import DesignerLoader/fabric directly and still
   build: a dynamic import("fabric") inside an ordinary (SSR'd) page failed
   the real `next build` with "Can't resolve 'jsdom'" — fabric's UMD wrapper
   has a Node branch this repo deliberately doesn't install jsdom for. So the
   chain is page -> CampaignEditorLoader (ssr:false) -> CampaignEditor
   (imports "fabric" and DesignerLoader) -> DesignerLoader (its own,
   independent ssr:false, checked already by check-designer.mjs section 8).
   Each link is asserted here; skipping any one of them is exactly the kind
   of "looked right, still 500s in production" gap AGENTS.md warns about. */

section("1. The editor page reaches DesignerLoader through an unbroken ssr:false chain");

const PAGE = "app/app/marketing/designer/[id]/page.js";
const LOADER = "app/components/designer/CampaignEditorLoader.js";
const CAMPAIGN_EDITOR = "app/components/designer/CampaignEditor.js";
const DESIGNER_LOADER = "app/components/designer/DesignerLoader.js";

for (const f of [PAGE, LOADER, CAMPAIGN_EDITOR, DESIGNER_LOADER]) {
  ok(exists(f), `${f} exists`);
}

if (exists(PAGE)) {
  const pageCode = stripComments(read(PAGE));
  ok(
    /from\s+["']@\/app\/components\/designer\/CampaignEditorLoader["']/.test(pageCode),
    "the page imports CampaignEditorLoader",
  );
  ok(
    !/from\s+["']fabric["']/.test(pageCode) && !/import\(\s*["']fabric["']\s*\)/.test(pageCode),
    "the page itself never touches \"fabric\" — static or dynamic — since it is server-rendered",
  );
}

if (exists(LOADER)) {
  const loaderSrc = read(LOADER);
  const loaderCode = stripComments(loaderSrc);
  ok(loaderSrc.trim().startsWith('"use client";'), "CampaignEditorLoader.js opens with \"use client\"");
  ok(/from\s+["']next\/dynamic["']/.test(loaderCode), "CampaignEditorLoader.js imports next/dynamic");
  ok(/ssr:\s*false/.test(loaderCode), "…and passes { ssr: false }");
  ok(
    /import\(\s*["']@\/app\/components\/designer\/CampaignEditor["']\s*\)/.test(loaderCode),
    "…dynamically importing CampaignEditor specifically",
  );
}

if (exists(CAMPAIGN_EDITOR)) {
  const ceSrc = read(CAMPAIGN_EDITOR);
  const ceCode = stripComments(ceSrc);
  ok(ceSrc.trim().startsWith('"use client";'), "CampaignEditor.js opens with \"use client\" (it imports fabric)");
  ok(/from\s+["']fabric["']/.test(ceCode), "CampaignEditor.js imports fabric — the reason it needs the ssr:false wrapper at all");
  ok(
    /from\s+["']@\/app\/components\/designer\/DesignerLoader["']/.test(ceCode),
    "CampaignEditor.js imports DesignerLoader — the documented entry point (DesignerLoader.js's own module doc: " +
      "\"pages should import THIS module, never Editor.js directly\") — not Editor.js straight",
  );
  ok(!/from\s+["']@\/app\/components\/designer\/Editor["']/.test(ceCode), "…and does NOT import Editor.js directly");
  ok(/<DesignerLoader\b/.test(ceCode), "…and actually renders <DesignerLoader> — the import isn't dead");
  ok(/onEditorReady=\{/.test(ceCode), "…wired to onEditorReady, so this component can drive the canvas from outside its tree");
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. Editor.js's onEditorReady is additive — every existing caller (Editor()
      with no third prop) is unaffected
   ═══════════════════════════════════════════════════════════════════════════ */

section("2. Editor.js's onEditorReady prop is additive, not a breaking change");

const editorSrc = read("app/components/designer/Editor.js");
const editorCode = stripComments(editorSrc);
ok(
  /export function Editor\(\{\s*initialData,\s*saveCallback,\s*onEditorReady\s*\}\)/.test(editorCode),
  "Editor() destructures onEditorReady alongside the two existing props, not in place of either",
);
ok(
  /useEffect\(\(\)\s*=>\s*\{\s*onEditorReady\?\.\(editor\);/.test(editorCode),
  "…and calls it optionally (onEditorReady?.()) — a caller that never passes it sees no behaviour change",
);

/* ═══════════════════════════════════════════════════════════════════════════
   3. Per-ratio persistence, executed — two saves to two ratios of the SAME
      design land in two different rows, and a re-save replaces only its own
   ═══════════════════════════════════════════════════════════════════════════ */

section("3. Per-ratio layouts persist independently — executed against the real route handlers");

process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.code !== "MODULE_TYPELESS_PACKAGE_JSON") console.warn(w);
});

// A tiny in-memory stand-in for exactly the Prisma calls the three designer
// routes make — not a generic ORM. Three plain arrays; each route's own
// where/select/include shapes are handled explicitly rather than guessed at,
// so a route that started asking the fake db something new would show up as
// an obvious "not implemented" rather than a silently wrong answer.
function makeStore() {
  const campaigns = [];
  const designs = [];
  const layouts = [];
  let seq = 1;
  const nextId = (p) => `${p}${seq++}`;

  function shapeLayout(l, select) {
    if (!select) return { ...l };
    const out = {};
    for (const k of Object.keys(select)) out[k] = l[k];
    return out;
  }
  function shapeDesign(d, select) {
    if (!select) return { ...d };
    const out = {};
    for (const k of Object.keys(select)) {
      if (k === "layouts") {
        out.layouts = layouts
          .filter((l) => l.designId === d.id)
          .map((l) => shapeLayout(l, select.layouts?.select));
      } else {
        out[k] = d[k];
      }
    }
    return out;
  }
  function attachRelations(d, include) {
    if (!d) return d;
    const out = { ...d };
    if (include?.layouts) out.layouts = layouts.filter((l) => l.designId === d.id).map((l) => ({ ...l }));
    if (include?.campaign) {
      const c = campaigns.find((x) => x.id === d.campaignId);
      out.campaign = c ? { id: c.id, name: c.name } : null;
    }
    return out;
  }

  const db = {
    marketingCampaign: {
      async findFirst({ where }) {
        return campaigns.find((c) => c.id === where.id && c.companyId === where.companyId) || null;
      },
    },
    marketingDesign: {
      async findMany({ where, select }) {
        return designs
          .filter(
            (d) =>
              d.companyId === where.companyId &&
              (!where.campaignId || d.campaignId === where.campaignId),
          )
          .map((d) => shapeDesign(d, select));
      },
      async findUnique({ where, include }) {
        const d = designs.find((x) => x.id === where.id);
        if (!d) return null;
        return include ? attachRelations(d, include) : { ...d };
      },
      async create({ data, select }) {
        const row = { id: nextId("d"), createdAt: new Date(), updatedAt: new Date(), ...data };
        designs.push(row);
        return shapeDesign(row, select);
      },
      async update({ where, data, include }) {
        const row = designs.find((x) => x.id === where.id);
        if (!row) throw new Error("marketingDesign.update: not found");
        Object.assign(row, data, { updatedAt: new Date() });
        return include ? attachRelations(row, include) : { ...row };
      },
      async delete({ where }) {
        const idx = designs.findIndex((x) => x.id === where.id);
        if (idx === -1) throw new Error("marketingDesign.delete: not found");
        const [row] = designs.splice(idx, 1);
        for (let i = layouts.length - 1; i >= 0; i--) {
          if (layouts[i].designId === where.id) layouts.splice(i, 1);
        }
        return row;
      },
    },
    marketingDesignLayout: {
      async upsert({ where, create, update }) {
        const key = where.designId_ratioKey;
        let row = layouts.find((l) => l.designId === key.designId && l.ratioKey === key.ratioKey);
        if (row) {
          Object.assign(row, update, { updatedAt: new Date() });
        } else {
          row = { id: nextId("l"), createdAt: new Date(), updatedAt: new Date(), ...create };
          layouts.push(row);
        }
        return { ...row };
      },
    },
  };

  return { db, campaigns, designs, layouts };
}

const store = makeStore();
globalThis.__FQ_DB = store.db;
globalThis.__FQ_MEMBER = async () => ({ id: "m1", companyId: "co1", role: "owner" });

// Same stubbing technique as scripts/check-feature-flags.mjs, and the same
// three specifiers — "@/lib/db" for the fake store above, "@/lib/
// currentMember" so lib/apiMember.js's memberOrRefusal() can run without
// Better Auth or a real Prisma pool, "next/server" so NextResponse.json
// doesn't need the actual Next server runtime.
const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "next/server": "fq-stub:next",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    return {
      format: "module", shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });",
    };
  }
  if (url === "fq-stub:member") {
    return {
      format: "module", shortCircuit: true,
      source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);",
    };
  }
  if (url === "fq-stub:next") {
    return {
      format: "module", shortCircuit: true,
      source:
        "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };",
    };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const designsRoute = await import("@/app/api/marketing/designer/designs/route.js");
const designRoute = await import("@/app/api/marketing/designer/designs/[id]/route.js");
const layoutRoute = await import("@/app/api/marketing/designer/designs/[id]/layouts/[ratio]/route.js");

const req = (url, method = "GET", body) => ({
  url,
  method,
  headers: new Map(),
  json: async () => body,
});

// Seed one campaign this "company" owns, and one this company does NOT.
store.campaigns.push({ id: "camp1", companyId: "co1", name: "Spring Promo" });
store.campaigns.push({ id: "camp-foreign", companyId: "co2", name: "Someone Else's Campaign" });

// A minimal but real fabric-shaped document — enough for overflowing()/
// reflow() to walk, matching what the editor's canvas.toJSON(JSON_KEYS)
// actually produces.
const docA = { objects: [{ name: "clip", type: "rect", width: 1080, height: 1080, left: 0, top: 0 }] };
const docB = { objects: [{ name: "clip", type: "rect", width: 1080, height: 1920, left: 0, top: 0 }] };

const createRes = await designsRoute.POST(
  req("http://x/api/marketing/designer/designs", "POST", { name: "Spring launch", campaignId: "camp1" }),
);
ok(createRes.status === 201, "creating a design with an OWNED campaignId succeeds", createRes.body);
const designId = createRes.body?.id;

const foreignRes = await designsRoute.POST(
  req("http://x/api/marketing/designer/designs", "POST", { name: "Hijack", campaignId: "camp-foreign" }),
);
ok(
  foreignRes.status === 400,
  "creating a design against a campaignId belonging to ANOTHER company is refused",
  JSON.stringify(foreignRes.body),
);
ok(
  store.designs.filter((d) => d.campaignId === "camp-foreign").length === 0,
  "…and no row was written for it",
);

const putA = await layoutRoute.PUT(
  req(`http://x/x`, "PUT", { json: JSON.stringify(docA), width: 1080, height: 1080 }),
  { params: Promise.resolve({ id: designId, ratio: "instagram_post" }) },
);
ok(putA.status === 200, "saving the instagram_post ratio succeeds", putA.body);

const putB = await layoutRoute.PUT(
  req(`http://x/x`, "PUT", { json: JSON.stringify(docB), width: 1080, height: 1920 }),
  { params: Promise.resolve({ id: designId, ratio: "instagram_story" }) },
);
ok(putB.status === 200, "saving the instagram_story ratio of the SAME design succeeds", putB.body);

ok(
  store.layouts.filter((l) => l.designId === designId).length === 2,
  "…and TWO separate rows now exist for this one design — one save did not overwrite the other",
  store.layouts.length,
);
const rowA = store.layouts.find((l) => l.designId === designId && l.ratioKey === "instagram_post");
const rowB = store.layouts.find((l) => l.designId === designId && l.ratioKey === "instagram_story");
ok(rowA.width === 1080 && rowA.height === 1080, "the instagram_post row kept its own 1080x1080");
ok(rowB.width === 1080 && rowB.height === 1920, "the instagram_story row kept its own 1080x1920 — not clobbered by the post save");
ok(rowA.json.objects[0].height === 1080, "…and the post row's OWN json is still the post's own document");
ok(rowB.json.objects[0].height === 1920, "…and the story row's OWN json is still the story's own document — the two never merged");

// Mutation check: does a SECOND save to the ratio ALREADY saved really
// replace it (upsert), rather than silently accumulating a duplicate row?
const docA2 = { objects: [{ name: "clip", type: "rect", width: 1080, height: 1080, left: 0, top: 0 }, { name: "headline", type: "textbox", width: 200, height: 40, left: 10, top: 10 }] };
const putA2 = await layoutRoute.PUT(
  req(`http://x/x`, "PUT", { json: JSON.stringify(docA2), width: 1080, height: 1080 }),
  { params: Promise.resolve({ id: designId, ratio: "instagram_post" }) },
);
ok(putA2.status === 200, "re-saving the SAME ratio again succeeds");
ok(
  store.layouts.filter((l) => l.designId === designId && l.ratioKey === "instagram_post").length === 1,
  "…and REPLACES the row rather than adding a second one for the same ratio",
);
ok(
  store.layouts.find((l) => l.designId === designId && l.ratioKey === "instagram_post").json.objects.length === 2,
  "…with the new content actually landing",
);
ok(
  store.layouts.find((l) => l.designId === designId && l.ratioKey === "instagram_story").json.objects.length === 1,
  "…and the untouched instagram_story row is completely unaffected by that re-save",
);

// A design created for THIS company's campaign, saving a layout under a
// design id that does not exist / belongs to nobody must be refused, not
// silently create an orphan row.
const putGhost = await layoutRoute.PUT(
  req(`http://x/x`, "PUT", { json: JSON.stringify(docA), width: 1080, height: 1080 }),
  { params: Promise.resolve({ id: "does-not-exist", ratio: "instagram_post" }) },
);
ok(putGhost.status === 404, "saving a layout against a design id that doesn't exist is refused (404)");

const putBadRatio = await layoutRoute.PUT(
  req(`http://x/x`, "PUT", { json: JSON.stringify(docA), width: 1080, height: 1080 }),
  { params: Promise.resolve({ id: designId, ratio: "square_but_not_really" }) },
);
ok(putBadRatio.status === 400, "an unknown ratio key is refused (400) rather than silently written");

const putBadJson = await layoutRoute.PUT(
  req(`http://x/x`, "PUT", { json: "{not json", width: 100, height: 100 }),
  { params: Promise.resolve({ id: designId, ratio: "tiktok" }) },
);
ok(putBadJson.status === 400, "malformed json is refused (400)");

const putBadSize = await layoutRoute.PUT(
  req(`http://x/x`, "PUT", { json: JSON.stringify(docA), width: 0, height: -5 }),
  { params: Promise.resolve({ id: designId, ratio: "tiktok" }) },
);
ok(putBadSize.status === 400, "a zero/negative width or height is refused (400)");

const getRes = await designRoute.GET(
  req(`http://x/x`),
  { params: Promise.resolve({ id: designId }) },
);
ok(getRes.status === 200, "loading the design back succeeds");
ok(
  (getRes.body?.layouts || []).length === 2,
  "…and returns both ratios' layouts, not just the one most recently saved",
  getRes.body?.layouts?.length,
);
ok(getRes.body?.campaign?.name === "Spring Promo", "…and the campaign name comes along for assetFilename()");

// Cross-tenant read: a design that exists, loaded by a caller from a
// DIFFERENT company, must 404 — not leak the other company's layouts.
globalThis.__FQ_MEMBER = async () => ({ id: "m2", companyId: "co2", role: "owner" });
const crossTenant = await designRoute.GET(req(`http://x/x`), { params: Promise.resolve({ id: designId }) });
ok(crossTenant.status === 404, "a design belonging to another company 404s rather than leaking its layouts");
globalThis.__FQ_MEMBER = async () => ({ id: "m1", companyId: "co1", role: "owner" });

const delRes = await designRoute.DELETE(req(`http://x/x`), { params: Promise.resolve({ id: designId }) });
ok(delRes.status === 200, "deleting the design succeeds");
ok(
  store.layouts.filter((l) => l.designId === designId).length === 0,
  "…and both of its layouts are gone with it (cascade) — no orphan rows left behind",
);

/* ═══════════════════════════════════════════════════════════════════════════
   4. Download-all: five ratios in, five distinctly-named files out
   ═══════════════════════════════════════════════════════════════════════════ */

section("4. Download all — one distinctly-named file per ratio, named for the social network it goes to");

const { AD_RATIOS, assetFilename } = await import("@/lib/marketing/ratios");

ok(AD_RATIOS.length === 5, "sanity: five ratios are actually defined", AD_RATIOS.length);

const names = AD_RATIOS.map((r) => assetFilename("Spring Promo", r.key));
ok(new Set(names).size === names.length, "assetFilename() produces a DISTINCT name for every ratio", names.join(" | "));
ok(
  names.every((n) => n.startsWith("spring-promo-")),
  "…every filename is stamped with the campaign name, not a generic \"design\"",
);
ok(
  AD_RATIOS.every((r) => names.some((n) => n.includes(r.file))),
  "…and every ratio's own network-shaped suffix (instagram-story, tiktok, …) appears in exactly one filename",
);
// The literal failure lib/marketing/ratios.js's own header names: "design-1.png
// through design-5.png is a folder nobody can use."
ok(
  !names.some((n) => /^design-\d+\.png$/.test(n)),
  "…none of them are the numbered-nonsense shape the feature exists to avoid",
);

if (exists(CAMPAIGN_EDITOR)) {
  const ceCode = stripComments(read(CAMPAIGN_EDITOR));
  ok(
    /for \(const r of AD_RATIOS\)/.test(ceCode),
    "handleDownloadAll iterates ALL of AD_RATIOS, not a hardcoded subset",
  );
  ok(
    /downloadFile\(\s*dataUrl,\s*"png",\s*assetFilename\(/.test(ceCode),
    "…and every exported file is named through assetFilename(), not a random id",
  );
  ok(
    !/downloadFile\(\s*dataUrl,\s*"png"\s*\)/.test(ceCode),
    "…there is no leftover call that drops the filename argument (which would fall back to a random uuid — see lib/designer/utils.js)",
  );
  ok(
    /reflow\(\s*liveDoc,\s*liveFrame,/.test(ceCode),
    "an unvisited ratio is derived via reflow() at download time, not skipped or left blank",
  );
  ok(
    /overflowing\(/.test(ceCode) || /warnings\[/.test(ceCode),
    "overflow is surfaced somewhere in this component (per-tab warning state), not silently dropped",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. The feature is registered and gated
   ═══════════════════════════════════════════════════════════════════════════ */

section("5. marketing_designer is registered, ON, and claims its own page/API surface");

const { FEATURES, featureEntry } = await import("@/lib/features/registry");
const entry = featureEntry("marketing_designer");

ok(Boolean(entry), "marketing_designer is a known registry key");
if (entry) {
  ok(entry.defaultState === "on", "defaultState is \"on\" — the coordinator's brief: this is now shipped, not scaffolding", entry.defaultState);
  ok(entry.routePrefixes.includes("/app/marketing/designer"), "routePrefixes claims the designer page tree");
  ok(entry.navKeys.includes("app.nav.marketingDesigner"), "navKeys names the new nav row");
  ok(
    entry.apiPrefixes.includes("/api/marketing/designer/designs"),
    "apiPrefixes claims the new design CRUD routes, not just the two AI routes",
  );
  ok(entry.apiPrefixes.includes("/api/designer/generate") && entry.apiPrefixes.includes("/api/designer/remove-bg"),
    "…and still claims both AI-costing routes from the original scope");
}

ok(exists("app/app/marketing/designer/layout.js"), "a layout.js exists at the gated route prefix");
if (exists("app/app/marketing/designer/layout.js")) {
  const layoutSrc = read("app/app/marketing/designer/layout.js");
  ok(
    /<FeatureGate[^>]*feature=["']marketing_designer["']/.test(layoutSrc),
    "…and it mounts <FeatureGate feature=\"marketing_designer\">",
  );
  ok(
    !layoutSrc.includes('"use client"') && !layoutSrc.includes("'use client'"),
    "…as a SERVER component (a client layout can't read the database — see FeatureGate.js's own doc)",
  );
}

// Nav row wired into the sidebar and permission grid, not just declared.
const adminSrc = read("app/components/layout/AdminSidebar.js");
ok(
  /key:\s*"app\.nav\.marketingDesigner"/.test(adminSrc) && /href:\s*"\/app\/marketing\/designer"/.test(adminSrc),
  "AdminSidebar.js renders a real row pointing at /app/marketing/designer",
);
const navPermSrc = read("lib/permissions/nav.js");
ok(
  /"app\.nav\.marketingDesigner":\s*\{\s*role:/.test(navPermSrc),
  "lib/permissions/nav.js has a requirement for the new row — not left to default-show",
);

const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");
ok(Boolean(APP_MESSAGES.en["app.nav.marketingDesigner"]), "the nav label is translated into English");
ok(Boolean(APP_MESSAGES.fr["app.nav.marketingDesigner"]), "…and French (the app catalogue's other real language)");

/* ═══════════════════════════════════════════════════════════════════════════
   6. Social publish — the container-then-publish state machine, the caption
      and image gates, and an honest refusal when nothing is connected
   ═══════════════════════════════════════════════════════════════════════════

   lib/social/metaSpecs.js and lib/social/publishDesign.js are pure/injectable
   by design (see their own headers) specifically so this section can EXECUTE
   the real decision logic — not read comments describing it — against every
   status Meta's container API can return, including the ones a live account
   may never hit in manual testing: a container that never leaves IN_PROGRESS,
   one that EXPIRED, a rate-limited account, and a request with no connection
   at all. publishDesign.js's client is injected, so this drives the whole
   flow with a fake in milliseconds and no network call. */

console.log("\n── Social publish: caption, image and rate-limit gates ─────────\n");

const {
  validateCaption,
  validateImageForInstagram,
  interpretRateLimit,
  nextContainerAction,
  isValidFacebookScheduleTime,
  QUOTA_TOTAL_FALLBACK,
} = await import("../lib/social/metaSpecs.js");

// Caption — the boundary Instagram itself enforces (2200/30/20), plus the
// inputs a form actually produces: empty, exactly at each limit, one over.
ok(!validateCaption("").ok, "an empty caption is refused");
ok(!validateCaption(undefined).ok, "a non-string caption does not throw and is refused");
ok(validateCaption("x".repeat(2200)).ok, "exactly 2200 characters is accepted — the limit is inclusive");
ok(!validateCaption("x".repeat(2201)).ok, "2201 characters is refused, one over the real Instagram limit");
// Emoji and other astral characters are single Instagram "characters" but
// TWO UTF-16 code units — a caption near the limit built from them is where
// a .length-based count would silently under- or over-count.
ok(
  validateCaption("😀".repeat(2200)).ok,
  "2200 EMOJI (each 2 UTF-16 units) still reads as 2200 characters, not 4400 — counted by code point, not .length",
);
{
  const many = Array.from({ length: 30 }, (_, i) => `#tag${i}`).join(" ");
  ok(validateCaption(many).ok, "exactly 30 hashtags is accepted");
  ok(!validateCaption(`${many} #one_more`).ok, "31 hashtags is refused");
}
{
  const many = Array.from({ length: 20 }, (_, i) => `@user${i}`).join(" ");
  ok(validateCaption(many).ok, "exactly 20 @ mentions is accepted");
  ok(!validateCaption(`${many} @oneMore`).ok, "21 @ mentions is refused");
}

// Image — instagram_post-shaped dimensions pass; a hostile size/format
// mismatch (this codebase's own AD_RATIOS.instagram_story crop) fails.
ok(validateImageForInstagram({ width: 1080, height: 1080 }).ok, "a 1:1 image passes");
ok(!validateImageForInstagram({ width: 1080, height: 1920 }).ok, "a 9:16 image (a Story crop) fails the feed endpoint's gate");
ok(
  !validateImageForInstagram({ width: 1080, height: 1080, fileSizeBytes: 9 * 1024 * 1024 }).ok,
  "a compliant shape at 9MB still fails — over Instagram's 8MB cap",
);

// Rate limit — the live endpoint's shape, its absence, and the exact
// boundary between "one left" and "none left".
ok(interpretRateLimit(null).ok === true, "no live reading (not connected / call failed) does not itself block a publish attempt");
ok(interpretRateLimit(null).verified === false, "…but is marked unverified, so the UI can't claim a confident number it doesn't have");
ok(interpretRateLimit(null).total === QUOTA_TOTAL_FALLBACK, "…and falls back to Meta's documented default, not zero or Infinity");
ok(
  interpretRateLimit({ quota_usage: 49, config: { quota_total: 50, quota_duration: 86400 } }).ok,
  "49 of 50 used — one remaining — still allows a publish attempt",
);
ok(
  !interpretRateLimit({ quota_usage: 50, config: { quota_total: 50, quota_duration: 86400 } }).ok,
  "50 of 50 used — exactly at the cap — refuses, it does not wait for a 51st to fail server-side",
);
ok(
  !interpretRateLimit({ quota_usage: 61, config: { quota_total: 50, quota_duration: 86400 } }).ok,
  "usage past the total (a quota that changed mid-window) still refuses rather than going negative",
);
ok(
  interpretRateLimit({ quota_usage: "nope", config: {} }).verified === false,
  "a malformed quota response is treated as unverified, not trusted at face value",
);

// The container state machine — every status Meta's docs name, plus the
// bound that turns "never resolves" into a named failure instead of a hang.
ok(nextContainerAction("FINISHED", 0).action === "publish", "FINISHED means publish");
// This assertion's NAME was right and its expectation was wrong — it read
// `=== "publish"`, which is precisely re-publishing, and it passed. A check
// whose label describes correct behaviour while its assertion locks in the
// bug is worse than no check: it is a green tick standing guard over the
// defect. Publishing is irreversible and outward-facing, so the correct
// answer is to record the success and make no second call.
ok(
  nextContainerAction("PUBLISHED", 0).action === "already_published",
  "PUBLISHED (a retried request) is treated as done, not re-published",
);
ok(
  !/"?already_published"?/.test(String(nextContainerAction("FINISHED", 0).action)),
  "...and FINISHED is still a real publish, not swallowed by that branch",
);
ok(nextContainerAction("IN_PROGRESS", 0).action === "poll", "IN_PROGRESS means poll again");
ok(nextContainerAction("ERROR", 0).action === "fail", "ERROR fails outright — no amount of polling fixes it");
ok(nextContainerAction("EXPIRED", 0).action === "recreate", "EXPIRED asks for a FRESH container, not a retry of the dead id");
ok(nextContainerAction("SOMETHING_MADE_UP", 0).action === "fail", "a status Meta has never documented fails safe rather than looping forever");
{
  // A container that never leaves IN_PROGRESS — the exact case named in the
  // task brief. Confirms the poll loop is bounded, not just documented as
  // such.
  let attempt = 0;
  let decision;
  const seen = [];
  do {
    decision = nextContainerAction("IN_PROGRESS", attempt);
    seen.push(decision.action);
    attempt += 1;
  } while (decision.action === "poll" && attempt < 1000);
  ok(decision.action === "fail", "an IN_PROGRESS container that never resolves eventually fails rather than polling forever", seen.length);
  ok(attempt < 50, "…and gives up within a small, bounded number of attempts, not hundreds", attempt);
}

// Facebook's native scheduling window — 10 minutes to 75 days, per
// developers.facebook.com/docs/graph-api/reference/page/feed/.
const NOW = new Date("2026-08-31T12:00:00Z");
ok(!isValidFacebookScheduleTime(new Date(NOW.getTime() + 5 * 60 * 1000), NOW), "5 minutes out is refused — under Meta's 10-minute floor");
ok(isValidFacebookScheduleTime(new Date(NOW.getTime() + 10 * 60 * 1000), NOW), "exactly 10 minutes out is accepted");
ok(isValidFacebookScheduleTime(new Date(NOW.getTime() + 75 * 24 * 60 * 60 * 1000), NOW), "exactly 75 days out is accepted");
ok(!isValidFacebookScheduleTime(new Date(NOW.getTime() + 76 * 24 * 60 * 60 * 1000), NOW), "76 days out is refused — over Meta's ceiling");
ok(!isValidFacebookScheduleTime("not a date", NOW), "garbage input is refused, not coerced into some date");
ok(!isValidFacebookScheduleTime(undefined, NOW), "no time at all is refused");

console.log("\n── Social publish: the orchestration, against a FAKE Meta client ─\n");

const { publishToInstagram, publishToFacebook, PublishRefusal } = await import(
  "../lib/social/publishDesign.js"
);

const CONNECTED = {
  connected: true,
  pageId: "page_1",
  pageName: "Test Co",
  pageAccessToken: "token",
  instagramUserId: "ig_1",
  instagramUsername: "testco",
};
const NOT_CONNECTED = { connected: false, reason: "not_built" };
const NO_SLEEP = async () => {};

async function expectRefusal(promise, code) {
  try {
    await promise;
    return { threw: false };
  } catch (err) {
    return { threw: true, isRefusal: err instanceof PublishRefusal, code: err.code };
  }
}

{
  const r = await expectRefusal(
    publishToInstagram({ connection: NOT_CONNECTED, imageUrl: "https://x/y.jpg", caption: "hi", width: 1080, height: 1080, client: {} }),
    "not_connected",
  );
  ok(r.threw && r.isRefusal && r.code === "not_connected", "publishToInstagram refuses immediately when nothing is connected — no client call attempted");
}
{
  const r = await expectRefusal(
    publishToFacebook({ connection: NOT_CONNECTED, imageUrl: "https://x/y.jpg", caption: "hi", client: {} }),
    "not_connected",
  );
  ok(r.threw && r.isRefusal && r.code === "not_connected", "publishToFacebook refuses the same way");
}
{
  const noIgAccount = { ...CONNECTED, instagramUserId: null };
  const r = await expectRefusal(
    publishToInstagram({ connection: noIgAccount, imageUrl: "https://x/y.jpg", caption: "hi", width: 1080, height: 1080, client: {} }),
    "no_instagram_account",
  );
  ok(r.threw && r.code === "no_instagram_account", "a Page with no linked Instagram account is refused by name, not a generic error");
}
{
  const r = await expectRefusal(
    publishToInstagram({ connection: CONNECTED, imageUrl: "https://x/y.jpg", caption: "x".repeat(2201), width: 1080, height: 1080, client: {} }),
    "invalid_caption",
  );
  ok(r.threw && r.code === "invalid_caption", "an over-length caption is refused before any Meta call is made");
}
{
  const r = await expectRefusal(
    publishToInstagram({ connection: CONNECTED, imageUrl: "https://x/y.jpg", caption: "hi", width: 1080, height: 1920, client: {} }),
    "invalid_image",
  );
  ok(r.threw && r.code === "invalid_image", "a non-compliant crop is refused before any Meta call is made");
}
{
  // Rate-limited — the quota check runs BEFORE a container is ever created,
  // so a maxed-out account never wastes one.
  let containerCalled = false;
  const client = {
    getInstagramPublishingLimit: async () => ({ quota_usage: 50, config: { quota_total: 50, quota_duration: 86400 } }),
    createInstagramContainer: async () => {
      containerCalled = true;
      return "container_1";
    },
  };
  const r = await expectRefusal(
    publishToInstagram({ connection: CONNECTED, imageUrl: "https://x/y.jpg", caption: "hi", width: 1080, height: 1080, client, sleep: NO_SLEEP }),
    "rate_limited",
  );
  ok(r.threw && r.code === "rate_limited", "a maxed-out account is refused with a named rate_limited code");
  ok(!containerCalled, "…and no container is created for a publish that was never going to succeed");
}
{
  // A container that NEVER leaves IN_PROGRESS — this is the exact "a
  // container that never becomes ready" case from the task brief, exercised
  // end to end through the real orchestration, not just nextContainerAction()
  // in isolation.
  let polls = 0;
  const client = {
    getInstagramPublishingLimit: async () => ({ quota_usage: 0, config: { quota_total: 50, quota_duration: 86400 } }),
    createInstagramContainer: async () => "container_stuck",
    getInstagramContainerStatus: async () => {
      polls += 1;
      return "IN_PROGRESS";
    },
  };
  const r = await expectRefusal(
    publishToInstagram({ connection: CONNECTED, imageUrl: "https://x/y.jpg", caption: "hi", width: 1080, height: 1080, client, sleep: NO_SLEEP }),
    "timed_out",
  );
  ok(r.threw && r.code === "timed_out", "a container stuck in IN_PROGRESS forever eventually fails with timed_out, not a hang");
  ok(polls > 0 && polls < 50, "…after a bounded number of polls, not an unbounded loop", polls);
}
{
  // EXPIRED — asks the CALLER to recreate, and never calls publish against
  // the dead container id.
  let publishCalled = false;
  const client = {
    getInstagramPublishingLimit: async () => ({ quota_usage: 0, config: { quota_total: 50, quota_duration: 86400 } }),
    createInstagramContainer: async () => "container_expired",
    getInstagramContainerStatus: async () => "EXPIRED",
    publishInstagramContainer: async () => {
      publishCalled = true;
      return "should_not_happen";
    },
  };
  const r = await expectRefusal(
    publishToInstagram({ connection: CONNECTED, imageUrl: "https://x/y.jpg", caption: "hi", width: 1080, height: 1080, client, sleep: NO_SLEEP }),
    "container_expired",
  );
  ok(r.threw && r.code === "container_expired", "an EXPIRED container is refused with a code the caller can act on (try again)");
  ok(!publishCalled, "…and media_publish is never called against a container Meta already discarded");
}
{
  // The happy path — proves the state machine actually reaches "published"
  // when Meta's own responses say it's ready, not just that failures fail.
  let statusCalls = 0;
  const client = {
    getInstagramPublishingLimit: async () => ({ quota_usage: 0, config: { quota_total: 50, quota_duration: 86400 } }),
    createInstagramContainer: async () => "container_ok",
    getInstagramContainerStatus: async () => {
      statusCalls += 1;
      return statusCalls < 3 ? "IN_PROGRESS" : "FINISHED";
    },
    publishInstagramContainer: async ({ containerId }) => `post_${containerId}`,
  };
  const result = await publishToInstagram({
    connection: CONNECTED,
    imageUrl: "https://x/y.jpg",
    caption: "A real caption",
    width: 1080,
    height: 1080,
    client,
    sleep: NO_SLEEP,
  });
  ok(result.status === "published" && result.postId === "post_container_ok", "IN_PROGRESS → IN_PROGRESS → FINISHED → publish resolves with the real post id", result);
}
{
  // Facebook — a single call, no container, and native scheduling is a
  // pass-through parameter checked BEFORE the call, not after a rejection.
  const r = await expectRefusal(
    publishToFacebook({
      connection: CONNECTED,
      imageUrl: "https://x/y.jpg",
      caption: "hi",
      scheduledPublishTime: new Date(Date.now() + 60 * 1000), // 1 minute — under the 10-minute floor
      client: { publishFacebookPhoto: async () => "should_not_happen" },
    }),
    "invalid_schedule",
  );
  ok(r.threw && r.code === "invalid_schedule", "a schedule time under Meta's 10-minute floor is refused before the API is ever called");
}
{
  const client = { publishFacebookPhoto: async () => "fb_post_1" };
  const result = await publishToFacebook({ connection: CONNECTED, imageUrl: "https://x/y.jpg", caption: "hi", client });
  ok(result.status === "published" && result.postId === "fb_post_1", "an immediate Facebook publish resolves with the real post id");
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. The publish route and UI never fake success when nothing is connected
   ═══════════════════════════════════════════════════════════════════════════

   Structural, like sections 1/2/4/5 above — the behavioural half of this is
   already proven by section 6 executing the real orchestration. What's left
   to check by reading is the WIRING: that the route re-verifies the
   connection itself rather than trusting the browser, that it does so
   BEFORE spending an upload on an attempt that can't succeed, and that the
   Publish button in the editor opens a real dialog rather than being hidden
   or silently disabled — AGENTS.md's "a Coming soon panel is honest; a dead
   button is not" applied to the one control in this codebase an accidental
   click can't undo. */

console.log("\n── Publish route & UI: no fake success when nothing is connected ─\n");

const publishRouteSrc = read("app/api/marketing/designer/designs/[id]/publish/route.js");
const publishRouteStripped = stripComments(publishRouteSrc);
ok(
  /getMetaConnection\(member\.companyId\)/.test(publishRouteStripped),
  "the POST route re-checks the connection itself — it does not trust anything the browser sent",
);
{
  const notConnectedIdx = publishRouteStripped.indexOf('"not_connected"');
  const uploadIdx = publishRouteStripped.indexOf("uploadBuffer(");
  ok(
    notConnectedIdx > -1 && uploadIdx > -1 && notConnectedIdx < uploadIdx,
    "the not-connected refusal happens BEFORE the image is ever uploaded — no wasted Cloudinary storage on an attempt that can't succeed",
  );
}
ok(
  /db\.socialPublish\.create/.test(publishRouteStripped) && /db\.socialPublish\.update/.test(publishRouteStripped),
  "every attempt is recorded (created pending, then updated to its real outcome) — not a fire-and-forget call with nothing to show for a failure",
);

const campaignEditorSrc = read("app/components/designer/CampaignEditor.js");
ok(
  /<PublishModal/.test(campaignEditorSrc) && /setPublishOpen\(true\)/.test(campaignEditorSrc),
  "CampaignEditor.js renders a real Publish button wired to a real modal, not a stub",
);
ok(
  !/disabled\s*=\s*\{?\s*true\s*\}?/.test(campaignEditorSrc.match(/publishOpen[\s\S]{0,400}/)?.[0] || ""),
  "the Publish button itself is not hardcoded disabled — the honesty about not being connected lives in the modal, not a dead control",
);

const publishModalSrc = read("app/components/designer/PublishModal.js");
const publishModalStripped = stripComments(publishModalSrc);
ok(
  /notConnectedTitle/.test(publishModalStripped) && /notConnectedBody/.test(publishModalStripped),
  "PublishModal.js has a real not-connected panel — the honest 'Coming soon' half of this control",
);
ok(
  !/status:\s*["']published["']/.test(publishModalStripped),
  "the modal never hardcodes a published result itself — every result string comes back from the real API response",
);

console.log(`\n${checks} checks, ${fail} failure(s).`);
process.exit(fail ? 1 : 0);
