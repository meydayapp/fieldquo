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

console.log(`\n${checks} checks, ${fail} failure(s).`);
process.exit(fail ? 1 : 0);
