// scripts/check-gallery-draft.mjs
//
//   npm run check:gallery-draft
//
// The owner, 2026-09-25, in the home page's "Upload before & after photos"
// dialog: "I cannot delete the new pair and I think I'm stuck like that." A
// before uploaded with no after had no remove control — it lived in browser
// state, and closing the dialog silently threw it away.
//
// Holds shut:
//   1. a half pair is stored as the ONE gallery draft (Company.galleryDraftPair),
//      never as a gallery row — the table every client-facing reader reads;
//   2. the draft can be finished later and discarded (confirmed), and every
//      saved pair keeps its remove control;
//   3. completing a pair clears the draft only once the pair is stored;
//   4. no client-facing surface reads the draft.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitiseGalleryDraft, sanitiseGalleryPair, saveGalleryDraft, loadGalleryDraft } from "@/lib/company/gallery";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra)?.slice(0, 300));
  }
}

const B = "https://res.cloudinary.com/x/before.jpg";
const A = "https://res.cloudinary.com/x/after.jpg";

// ── 1. The draft's own sanitiser: one side is enough, nothing is not ───────
ok("a before alone is a draft", sanitiseGalleryDraft({ beforeUrl: B, beforePublicId: "p1" })?.beforeUrl === B);
ok("…and it is NOT a gallery pair (the client-facing table refuses half pairs)", sanitiseGalleryPair({ beforeUrl: B }) === null);
ok("an after alone is a draft too", sanitiseGalleryDraft({ afterUrl: A })?.afterUrl === A && sanitiseGalleryDraft({ afterUrl: A }).beforeUrl === null);
ok("nothing, junk, or a non-http URL is no draft",
  [null, undefined, "x", {}, { beforeUrl: "javascript:alert(1)" }, { beforeUrl: "  " }, { afterUrl: 42 }].every((d) => sanitiseGalleryDraft(d) === null));
ok("a public id without its URL is dropped", sanitiseGalleryDraft({ afterUrl: A, beforePublicId: "orphan" }).beforePublicId === null);
ok("overlong values are clipped", sanitiseGalleryDraft({ beforeUrl: B + "a".repeat(2000) }).beforeUrl.length === 1000);

// ── Save / load through a stub db ──────────────────────────────────────────
const store = { galleryDraftPair: null };
const db = {
  company: {
    async findUnique() { return { galleryDraftPair: store.galleryDraftPair }; },
    async update({ data }) { store.galleryDraftPair = data.galleryDraftPair; return {}; },
  },
};
const saved = await saveGalleryDraft("c1", { beforeUrl: B, beforePublicId: "p1" }, { db, now: new Date("2026-09-25T12:00:00Z") });
ok("saving a half pair stores it, stamped", saved.beforeUrl === B && store.galleryDraftPair?.updatedAt === "2026-09-25T12:00:00.000Z");
ok("…and loading it back gives the same half pair (finish it later)", (await loadGalleryDraft("c1", { db }))?.beforeUrl === B);
await saveGalleryDraft("c1", null, { db });
ok("saving null clears it (Discard) — to SQL NULL, not a JSON null", store.galleryDraftPair !== null && typeof store.galleryDraftPair === "object" && (await loadGalleryDraft("c1", { db })) === null);

// ── Static: the pieces are wired ────────────────────────────────────────────
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (p) => read(p).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

const route = code("app/api/settings/gallery/route.js");
ok("GET answers the draft beside the pairs", /loadGalleryDraft\(member\.companyId\)/.test(route) && /NextResponse\.json\(\{ pairs, draft \}\)/.test(route));
ok("PUT takes `draft` alone or with pairs, pairs written FIRST", /hasDraft/.test(route) && route.indexOf("replaceCompanyGallery(") < route.indexOf("saveGalleryDraft("));
ok("PUT keeps the owner/admin gate", /requirePermission\(member\.role, "user:manage"\)/.test(route));

const pair = code("app/components/settings/PairPhotoFields.js");
ok("NewPair stores the half pair as soon as a photo lands", /await putDraft\(draftOf\(b, a\)\)/.test(pair));
ok("NewPair has a Discard control, confirmed, that clears the stored draft", /window\.confirm\(t\("app\.gallery\.draftDiscardConfirm"/.test(pair) && /onClick=\{discard\}/.test(pair) && /putDraft\(null\)/.test(pair));
ok("the draft is labelled a draft, in words", /app\.gallery\.draftLabel/.test(pair) && /app\.gallery\.draftHint/.test(pair));
ok("the draft is cleared only after onComplete reports the pair stored", /if \(!done\) return;[\s\S]{0,200}putDraft\(null\)/.test(pair));
ok("a stored complete draft whose save failed can be retried", /app\.gallery\.draftSave/.test(pair) && /finish\(before, after\)/.test(pair));
ok("the Discard control is a 44px touch target", /onClick=\{discard\}[\s\S]{0,400}min-h-11/.test(pair));

const editor = code("app/components/settings/GalleryEditor.js");
ok("the gallery editor hands NewPair the draft it loaded", /initialDraft=\{draft\}/.test(editor) && /setDraft\(d\.draft \|\| null\)/.test(editor));
ok("…completes the pair and clears the draft in ONE request", /save\(\[\.\.\.pairs, pair\], \{ draft: null \}\)/.test(editor) && /\.\.\.extra/.test(editor));
ok("…and its save reports success, so a failed save keeps the draft", /return true;[\s\S]{0,120}return false;/.test(editor));
ok("every saved pair keeps a remove control, 44px", /save\(pairs\.filter\(\(_, j\) => j !== i\)\)/.test(editor) && /min-h-11 min-w-11/.test(editor));

const quoteEmail = code("app/app/settings/quote-email/page.js");
ok("Settings › Quote Email: save() reports success to NewPair", /return true;/.test(quoteEmail) && /return save\(\{ beforeAfter: \{ items \} \}\)/.test(quoteEmail));

const sitePairs = code("app/app/settings/website/PairPhotos.js");
ok("the website pairer can start over while waiting for the after", /picking === "after" && \(/.test(sitePairs) && /app\.pairPhotos\.startOver/.test(sitePairs));

// ── 4. Nobody client-facing reads the draft ─────────────────────────────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}
const readers = [...walk("app"), ...walk("lib")].filter((f) => code(f).includes("galleryDraftPair"));
ok("only lib/company/gallery.js touches Company.galleryDraftPair", readers.length === 1 && readers[0] === path.join("lib", "company", "gallery.js"), readers);
const galleryLib = read("lib/company/gallery.js");
ok("loadCompanyGallery (what every client surface reads) never selects the draft",
  !/galleryDraftPair/.test(galleryLib.slice(galleryLib.indexOf("export async function loadCompanyGallery"), galleryLib.indexOf("export async function replaceCompanyGallery"))));

console.log(`\ncheck-gallery-draft: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
