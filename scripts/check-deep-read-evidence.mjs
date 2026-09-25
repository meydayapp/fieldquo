// scripts/check-deep-read-evidence.mjs
//
// The paid deep read's trade evidence and photo-vs-trade warning (owner,
// 2026-09-22), EXECUTED against a stubbed model:
//
//   npm run check:deep-read-evidence
//
// What it proves, in the order the owner asked for it:
//
//   1. Each trade's schema — every family lints under the strict subset,
//      alone and in every combination a quote can ask for, carries no money
//      field, and a quote asks ONLY for its own trades' families.
//   2. Each trade's evidence, through the SHIPPED runVisionPass against a fake
//      vendor: conversions done in code (pickup beds → cu yd → m³, feet →
//      metres), fees derived from item categories, hostile values dropped.
//   3. The mismatch rule — a roof on a stairs quote warns; a roof on a gutter
//      quote does not; ambiguous photos never warn; one wrong photo among
//      right ones is named; a generalist quote never warns; no trade → no
//      verdict.
//   4. No overwrite — the measured figure comes back unchanged beside the
//      estimate, inputs are frozen and survive, and the ROUTE, executed,
//      writes the pass and nothing else.
//   5. Cost unchanged — one vendor call per read, at detail "high", with the
//      same VISION_PASS_CENTS reserved once.
//   6. Nine languages — every label the panel can ask for exists in all nine.
//
// The vendor stub goes in at the module resolver (the same seam
// check-ai-structured-output.mjs uses), so the function under test is the
// shipped complete(), not a copy.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let fail = 0;
let passed = 0;
const ok = (cond, msg, detail) => {
  console.log((cond ? "  ok   " : "  FAIL ") + msg + (cond || detail === undefined ? "" : `  — got ${JSON.stringify(detail)}`));
  if (cond) passed++;
  else fail++;
};
const section = (t) => console.log(`\n${t}\n`);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// ── The fake vendor ─────────────────────────────────────────────────────────
const stub = { next: null, lastRequest: null, calls: 0 };
const hooksPath = path.join(os.tmpdir(), `fieldquo-deepread-vendor-${process.pid}.mjs`);
fs.writeFileSync(
  hooksPath,
  `export async function resolve(spec, ctx, next) {
  if (spec === "openai") return { url: "fieldquo-openai-stub:", shortCircuit: true, format: "module" };
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url === "fieldquo-openai-stub:") {
    return {
      format: "module",
      shortCircuit: true,
      source: \`
        const bus = globalThis.__fieldquoVendorStub;
        export default class OpenAI {
          constructor() {
            this.chat = { completions: { create: async (req) => bus.handle(req) } };
            this.images = { generate: async () => ({}), edit: async () => ({}) };
          }
        }
        export const toFile = async (b) => b;
      \`,
    };
  }
  return next(url, ctx);
}
`,
);
globalThis.__fieldquoVendorStub = {
  handle(req) {
    stub.lastRequest = req;
    stub.calls += 1;
    if (typeof stub.next === "function") return stub.next(req);
    throw new Error("vendor stub had no scripted reply");
  },
};
const { register } = await import("node:module");
register(pathToFileURL(hooksPath).href, import.meta.url);
process.on("exit", () => {
  try {
    fs.unlinkSync(hooksPath);
  } catch {}
});

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-not-a-real-key";
const reply = (obj, { finish = "stop" } = {}) => ({
  choices: [{ finish_reason: finish, message: { content: JSON.stringify(obj), refusal: null } }],
  usage: { prompt_tokens: 100, completion_tokens: 20 },
});

const E = await import("@/lib/ai/deepReadEvidence");
const { assertStrictSchema, validateAgainstSchema } = await import("@/lib/ai/jsonSchema");
const { runVisionPass } = await import("@/lib/ai/visionPass");
const { withChecks } = await import("@/lib/ai/deepReadView");
const { tradeKeys } = await import("@/lib/trades/catalog");
const { VISION_PASS_CENTS, VISION_MAX_PHOTOS } = await import("@/lib/ai/imageEconomics");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages.js");

const deepFreeze = (o) => {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};
const photo = (n) => ({ kind: "photo", url: `https://res.cloudinary.com/demo/image/upload/v1/p${n}.jpg` });
const quoteFor = (keys, { photos = 2, takeoff = null, intakeValues = null } = {}) => ({
  clientPhotos: Array.from({ length: photos }, (_, i) => photo(i + 1)),
  scopeGroups: keys.map((key) => ({ label: key, category: { key, label: key, companySettings: [] }, takeoff, intakeValues })),
});

/* ═══════════════════════════════════════════════════════════════════════════ */
section("1. Each trade's schema");

const FAMILY_FIELDS = {
  junk: ["pickupBedsLow", "pickupBedsHigh", "volumeBasis", "items", "confidence"],
  roofing: ["pitch", "pitchBasis", "layers", "layersBasis", "damage", "confidence"],
  painting: ["condition", "peeling", "currentColour", "colourChange", "confidence"],
  cabinets: ["doorsSeen", "drawersSeen", "countBasis", "doorStyle", "finish", "condition", "confidence"],
  flooring: ["currentMaterial", "transitionsSeen", "transitionsBasis", "condition", "confidence"],
  stairs: ["treadsSeen", "risersSeen", "countBasis", "shape", "confidence"],
  gutters: ["runFtLow", "runFtHigh", "lengthBasis", "downspoutsSeen", "storeys", "issues", "confidence"],
};
ok(JSON.stringify(Object.keys(FAMILY_FIELDS)) === JSON.stringify(E.FAMILY_KEYS), "the seven families the owner named, no more and no fewer", E.FAMILY_KEYS);
for (const [f, fields] of Object.entries(FAMILY_FIELDS)) {
  const s = E.deepReadSchema([f]);
  ok(assertStrictSchema(s).ok, `${f}: its schema passes the strict-subset lint`, assertStrictSchema(s).errors);
  ok(JSON.stringify(Object.keys(s.properties.evidence.properties[f].properties)) === JSON.stringify(fields), `${f}: fields are ${fields.join(", ")}`);
  ok(s.properties.evidence.properties[f].properties.confidence.enum.join() === "low,medium,high", `${f}: carries a confidence`);
}
// Every combination a quote can ask for (MAX_FAMILIES at a time) still lints.
let combos = 0;
const fams = E.FAMILY_KEYS;
for (let a = 0; a < fams.length; a++)
  for (let b = a + 1; b < fams.length; b++)
    for (let c = b + 1; c < fams.length; c++) {
      combos++;
      const r = assertStrictSchema(E.deepReadSchema([fams[a], fams[b], fams[c]]));
      if (!r.ok) ok(false, `combination ${fams[a]}+${fams[b]}+${fams[c]} lints`, r.errors);
    }
ok(combos === 35, "all 35 three-family combinations lint (any failure is printed above)");
ok(assertStrictSchema(E.deepReadSchema([])).ok && !E.deepReadSchema([]).properties.evidence, "a quote with no evidence family asks for notes + photos only");
const MONEY = /(price|total|amount|cost|subtotal|deposit|dollars|cents|margin|\$)/i;
ok(!MONEY.test(JSON.stringify(E.deepReadSchema(E.FAMILY_KEYS))), "no schema field or description names money — the model never prices anything", JSON.stringify(E.deepReadSchema(E.FAMILY_KEYS)).match(MONEY)?.[0]);
ok(E.deepReadSchema([]).properties.photos.items.properties.trades.items.enum.length === tradeKeys().length, "the per-photo trade vocabulary IS the catalogue (every key, nothing else)");

// Which families a quote asks for.
ok(JSON.stringify(E.familiesForTrades(["stairs"])) === '["stairs"]', "stairs → stairs");
ok(JSON.stringify(E.familiesForTrades(["interior_painting", "exterior_painting"])) === '["painting"]', "interior + exterior painting share one painting family");
ok(JSON.stringify(E.familiesForTrades(["plumbing", "electrical"])) === "[]", "trades with no family ask for none");
ok(E.familiesForTrades(["junk_removal", "roofing_service", "stairs", "gutter_services", "flooring"]).length === E.MAX_FAMILIES, "capped at MAX_FAMILIES — five trades still one bounded call");
ok(JSON.stringify(E.familiesForTrades(null)) === "[]" && JSON.stringify(E.familiesForTrades("stairs")) === "[]", "hostile input → no families, no throw");
for (const f of E.FAMILY_KEYS) {
  for (const k of E.EVIDENCE_FAMILIES[f].trades) ok(tradeKeys().includes(k), `${f}: trade key ${k} is a real catalogue key`);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
section("2. Each trade's evidence, through the shipped runVisionPass");

async function deepRead(keys, evidence, photos = [], opts = {}) {
  stub.calls = 0;
  stub.next = () => reply({ notes: ["Check the sill."], photos, ...(evidence ? { evidence } : {}) });
  const out = await runVisionPass({ quote: quoteFor(keys, opts), onUsage: async () => {} });
  return { out, req: stub.lastRequest, calls: stub.calls };
}
const reqSchema = (req) => req?.response_format?.json_schema?.schema;

{
  const { out, req, calls } = await deepRead(["junk_removal"], {
    junk: { pickupBedsLow: 3, pickupBedsHigh: 2, volumeBasis: "Pile beside a car, about two beds.", items: ["mattresses", "e_waste", "appliances_refrigerant", "hazardous_suspect", "mattresses"], confidence: "medium" },
  });
  ok(calls === 1, "junk: ONE vendor call", calls);
  ok(JSON.stringify(Object.keys(reqSchema(req).properties.evidence.properties)) === '["junk"]', "junk: the request asked for the junk family only");
  const j = out.evidence.junk;
  ok(j.volume.pickupBeds.low === 2 && j.volume.pickupBeds.high === 3, "junk: a reversed range is put in order (3,2 → 2–3 beds)", j.volume.pickupBeds);
  ok(j.volume.cubicYards.low === 5 && j.volume.cubicYards.high === 7.5, "junk: cubic yards are computed in code at PICKUP_BED_CU_YD (2–3 beds → 5–7.5 cu yd)", j.volume.cubicYards);
  ok(j.volume.cubicMetres.low === 4 && j.volume.cubicMetres.high === 5.5, "junk: and metres from yards (5–7.5 cu yd → 4–5.5 m³, to the half)", j.volume.cubicMetres);
  ok(j.volume.estimate === true && j.volume.basis === "Pile beside a car, about two beds.", "junk: the volume is marked an estimate and carries how it was judged");
  ok(JSON.stringify(j.items) === '["mattresses","e_waste","appliances_refrigerant","hazardous_suspect"]', "junk: a category named twice is kept once", j.items);
  ok(JSON.stringify(j.surcharges) === '["mattress","ewaste","refrigerant","hazard"]', "junk: fees DERIVED in code from the categories — mattress, e-waste, refrigerant, hazard", j.surcharges);
  ok(j.confidence === "medium", "junk: confidence kept");
}
{
  // Schema-VALID but hostile: numbers the schema can't bound (minimum and
  // maximum are outside the strict subset), a blank basis.
  const { out } = await deepRead(["junk_removal"], { junk: { pickupBedsLow: -1, pickupBedsHigh: 9999, volumeBasis: "   ", items: [], confidence: "low" } });
  ok(out.evidence.junk.volume === null, "junk: a negative and an absurd size are no size at all — never clamped into a plausible-looking one", out.evidence.junk.volume);
  const half = (await deepRead(["junk_removal"], { junk: { pickupBedsLow: null, pickupBedsHigh: 0.2, volumeBasis: null, items: [], confidence: "low" } })).out.evidence.junk.volume;
  ok(half.pickupBeds.low === 0.5 && half.pickupBeds.high === 0.5 && half.basis === null, "junk: one end given stands in for both; a sliver rounds up to half a bed, never to zero", half);
}
{
  // Schema-INVALID answers never reach the sanitiser: provider.js refuses
  // them and runVisionPass returns null, which is the route's refund branch.
  for (const [label, ev] of [
    ["an item outside the vocabulary", { junk: { pickupBedsLow: 1, pickupBedsHigh: 2, volumeBasis: null, items: ["not_a_category"], confidence: "low" } }],
    ["a string where the item list goes", { junk: { pickupBedsLow: 1, pickupBedsHigh: 2, volumeBasis: null, items: "furniture", confidence: "low" } }],
    ["an unknown confidence", { junk: { pickupBedsLow: 1, pickupBedsHigh: 2, volumeBasis: null, items: [], confidence: "certain" } }],
    ["a missing field", { junk: { pickupBedsLow: 1, volumeBasis: null, items: [], confidence: "low" } }],
  ]) {
    const { out } = await deepRead(["junk_removal"], ev);
    ok(out === null, `a reply with ${label} is refused whole (null → refund), never half-kept`, out);
  }
  // …and the sanitiser holds the same line on its own, for a vendor that
  // does not enforce the schema (lib/ai/jsonSchema.js's reason for existing).
  const direct = E.sanitiseEvidence(
    {
      junk: { pickupBedsLow: "3", pickupBedsHigh: NaN, volumeBasis: 42, items: "furniture", confidence: "certain" },
      roofing: { pitch: "45 degrees", layers: 2, damage: ["hail_or_impact", "hail_or_impact", "made_up"], confidence: "high" },
      cabinets: { doorsSeen: 3.5, drawersSeen: "12", doorStyle: "Brand X", finish: null, condition: "fine", confidence: "high" },
    },
    ["junk", "roofing", "cabinets"],
  );
  ok(direct.junk.volume === null && direct.junk.items.length === 0 && direct.junk.confidence === "low", "sanitiser: string / NaN sizes, a non-array list and an unknown confidence → nothing, empty, low", direct.junk);
  ok(direct.roofing.pitch === "unclear" && direct.roofing.layers === "unclear", "sanitiser: values outside the vocabulary become 'unclear', never printed raw", direct.roofing);
  ok(JSON.stringify(direct.roofing.damage) === '["hail_or_impact"]', "sanitiser: unknown and repeated list values dropped", direct.roofing.damage);
  ok(direct.cabinets.doorsSeen === null && direct.cabinets.drawersSeen === null, "sanitiser: a fractional or string 'count' is not a count", direct.cabinets);
  ok(direct.cabinets.doorStyle === "unclear" && direct.cabinets.condition === "unclear", "sanitiser: a brand where a style goes is 'unclear'", direct.cabinets);
  const unasked = E.sanitiseEvidence({ roofing: { pitch: "steep" }, stairs: { treadsSeen: 12 } }, ["stairs"]);
  ok(!unasked.roofing && unasked.stairs.treadsSeen === 12, "sanitiser: a family the quote did not ask for is dropped", unasked);
  ok(JSON.stringify(E.sanitiseEvidence(null, ["stairs"])) === "{}" && JSON.stringify(E.sanitiseEvidence({ stairs: "x" }, ["stairs"])) === "{}", "sanitiser: null / non-object evidence → nothing, no throw");
}
{
  const { out } = await deepRead(["roofing_service"], {
    roofing: { pitch: "steep", pitchBasis: "Can't be walked from the photo angle.", layers: "more_than_one_suspected", layersBasis: "Doubled edge at the rake.", damage: ["none_visible", "granule_loss", "curling_or_cupping"], confidence: "high" },
  });
  const r = out.evidence.roofing;
  ok(r.pitch === "steep" && r.layers === "more_than_one_suspected", "roofing: pitch and layers kept");
  ok(JSON.stringify(r.damage) === '["granule_loss","curling_or_cupping"]', "roofing: 'none visible' beside real damage is dropped — the finding wins", r.damage);
  ok(r.pitchBasis === "Can't be walked from the photo angle." && r.layersBasis === "Doubled edge at the rake.", "roofing: each judgement keeps how it was made");
}
{
  const { out } = await deepRead(["exterior_painting"], {
    painting: { condition: "worn", peeling: "widespread", currentColour: "  dark   navy  ", colourChange: "extra_coat_or_primer_likely", confidence: "medium" },
  });
  const p = out.evidence.painting;
  ok(p.condition === "worn" && p.peeling === "widespread" && p.colourChange === "extra_coat_or_primer_likely", "painting: condition, peeling, colour change kept");
  ok(p.currentColour === "dark navy", "painting: the colour words are trimmed", p.currentColour);
}
{
  const { out } = await deepRead(["cabinet_refinishing"], {
    cabinets: { doorsSeen: 18, drawersSeen: 500, countBasis: "Uppers and lowers in photos 1–2.", doorStyle: "shaker", finish: "stained_or_natural_wood", condition: "worn", confidence: "high" },
  });
  const c = out.evidence.cabinets;
  ok(c.doorsSeen === 18 && c.drawersSeen === null, "cabinets: a whole count is kept; an implausible 500 drawer fronts is dropped, not clamped", c);
  ok(c.doorStyle === "shaker" && c.finish === "stained_or_natural_wood", "cabinets: style and finish kept");
}
{
  const { out } = await deepRead(["flooring_install"], {
    flooring: { currentMaterial: "carpet", transitionsSeen: 0, transitionsBasis: "No doorway visible.", condition: "worn", confidence: "medium" },
  });
  ok(out.evidence.flooring.currentMaterial === "carpet" && out.evidence.flooring.transitionsSeen === 0, "flooring: material kept, and 0 transitions is a real count, not absence", out.evidence.flooring);
}
{
  const { out } = await deepRead(["stairs"], {
    stairs: { treadsSeen: 13, risersSeen: -2, countBasis: "Counted from the bottom in photo 1.", shape: "l_shaped", confidence: "high" },
  });
  ok(out.evidence.stairs.treadsSeen === 13 && out.evidence.stairs.risersSeen === null, "stairs: a negative count is dropped", out.evidence.stairs);
  ok(out.evidence.stairs.shape === "l_shaped", "stairs: shape kept");
}
{
  const { out } = await deepRead(["gutter_services"], {
    gutters: { runFtLow: 38, runFtHigh: 52, lengthBasis: "Two garage doors wide along the front.", downspoutsSeen: 3, storeys: "two", issues: ["clogged"], confidence: "medium" },
  });
  const g = out.evidence.gutters;
  ok(g.length.feet.low === 40 && g.length.feet.high === 50, "gutters: feet rounded to 5 in code", g.length.feet);
  ok(g.length.metres.low === 12 && g.length.metres.high === 16, "gutters: metres computed in code (38–52 ft → 12–16 m)", g.length.metres);
  ok(g.length.estimate === true && g.downspoutsSeen === 3 && g.storeys === "two", "gutters: length is an estimate; downspouts and storeys kept");
}
{
  // A family volunteered for a trade the quote doesn't carry is not kept.
  const { out, req } = await deepRead(["stairs"], {
    stairs: { treadsSeen: 12, risersSeen: 13, countBasis: null, shape: "straight", confidence: "high" },
    roofing: { pitch: "steep", pitchBasis: null, layers: "one", layersBasis: null, damage: [], confidence: "high" },
  });
  ok(out === null, "a reply volunteering a family the quote did not ask for is refused (additionalProperties) — it never reaches the stored read", out?.evidence);
  ok(req && !reqSchema(req).properties.evidence.properties.roofing, "…and was never in the schema sent");
}
{
  const { out, req } = await deepRead(["plumbing"], null);
  ok(out && JSON.stringify(out.evidence) === "{}" && !reqSchema(req).properties.evidence, "a trade with no family: no evidence asked, none stored, notes still returned", out);
  ok(!("evidenceFor" in JSON.parse(req.messages.find((m) => m.role === "user")?.content?.find?.((c) => c.type === "text")?.text ?? req.messages.at(-1).content.find((c) => c.type === "text").text)), "…and the payload carries no evidenceFor key");
}
{
  // The schema is enforced: a reply missing `photos` is refused, and refused means refund.
  stub.next = () => reply({ notes: [] });
  const out = await runVisionPass({ quote: quoteFor(["stairs"]), onUsage: async () => {} });
  ok(out === null, "a reply missing the required per-photo reading returns null — the route refunds, never charges for half a read", out);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
section("3. The mismatch rule");

const P = (photo, trades, confidence = "high", shows = null) => ({ photo, trades, confidence, shows });
const verdict = (documentTrades, photos) => E.deepReadMismatch({ documentTrades, photos });

{
  const m = verdict(["stairs"], [P(1, ["roofing_service"], "high", "Asphalt shingle roof from the street")]);
  ok(m.verdict === "mismatch", "a picture of a roof on a quote for stairs → mismatch (the owner's example)", m);
  ok(m.photos.length === 1 && m.photos[0].photo === 1 && m.photos[0].trades[0] === "roofing_service", "…naming the photo and what it looks like");
  ok(JSON.stringify(m.quoteTrades) === '["stairs"]', "…and what the quote is for");
}
ok(verdict(["gutter_services"], [P(1, ["roofing_service"])]).verdict === "match", "a roof on a gutter quote → match (a gutter hangs off the roof edge)");
ok(verdict(["stairs"], [P(1, ["flooring"])]).verdict === "match", "a floor photo on a stairs quote → match (flooring covers stairs)");
ok(verdict(["stairs"], [P(1, ["cabinet_refinishing"])]).verdict === "mismatch", "a kitchen-cabinet photo on a stairs quote → mismatch (same industry, different job)");
ok(verdict(["interior_painting", "exterior_painting"], [P(1, ["siding"])]).verdict === "match", "siding on an exterior painting quote → match");
ok(verdict(["junk_removal"], [P(1, ["junk_removal", "demolition"])]).verdict === "match", "a debris pile read as junk + demolition → match");

// Ambiguous photos never warn.
ok(verdict(["stairs"], [P(1, ["roofing_service"], "low")]).verdict === "unclear", "a low-confidence roof reading on a stairs quote → unclear, NOT a warning");
ok(verdict(["stairs"], [P(1, [], "high")]).verdict === "unclear", "a photo the model could not place (no trades) → unclear");
ok(verdict(["stairs"], [P(1, [], "low"), P(2, ["lawn_care"], "low")]).verdict === "unclear", "all photos ambiguous → unclear");
{
  const m = verdict(["stairs"], [P(1, ["stairs"]), P(2, ["roofing_service"], "low"), P(3, ["stairs"], "medium")]);
  ok(m.verdict === "match" && m.unclear === 1 && m.judged === 2, "one blurry photo among good ones is counted unclear and does not warn", m);
}
{
  const m = verdict(["stairs"], [P(1, ["stairs"]), P(2, ["roofing_service"]), P(3, ["stairs"]), P(4, ["lawn_mowing"], "medium")]);
  ok(m.verdict === "mismatch" && m.photos.map((p) => p.photo).join() === "2,4", "one wrong photo among right ones is named by number (2 and 4 of 4)", m.photos);
}
ok(verdict(["remodeling"], [P(1, ["roofing_service"])]).verdict === "match", "a generalist document (renovation) never warns — its photos can show any room");
ok(verdict(["stairs"], [P(1, ["handyman"])]).verdict === "match", "a photo read as generalist work never warns");
ok(verdict([], [P(1, ["roofing_service"])]).verdict === "unknown", "a document with no trade → unknown (no statement either way)");
ok(verdict(["not_a_trade"], [P(1, ["roofing_service"])]).verdict === "unknown", "a custom/unknown category key → unknown");
ok(verdict(["stairs"], undefined).verdict === "unknown", "a pass from before photos were read one by one → unknown, never a warning");
ok(verdict(["stairs", "roofing_service"], [P(1, ["roofing_service"]), P(2, ["stairs"])]).verdict === "match", "a two-trade quote whose photos cover both → match");

// Every catalogue key has a place in the rule.
const unplaced = tradeKeys().filter((k) => !E.WORK_AREAS[k] && !E.GENERALIST_TRADES.has(k));
ok(unplaced.length === 0, "every catalogue trade has work areas or is a generalist — a new trade can't silently never match", unplaced);
ok(tradeKeys().every((k) => !(E.WORK_AREAS[k] && E.GENERALIST_TRADES.has(k))), "…and none is both");
ok(Object.keys(E.WORK_AREAS).every((k) => tradeKeys().includes(k)), "WORK_AREAS names no key the catalogue doesn't ship");

// Photo sanitising: numbers must name a photo that was sent.
{
  const s = E.sanitisePhotos(
    [P(2, ["stairs"]), P(0, ["stairs"]), P(9, ["stairs"]), P(2, ["roofing_service"]), P(1, ["stairs", "nope", "stairs"], "sure"), "junk", null, { photo: 1.5, trades: [] }],
    3,
  );
  ok(s.map((p) => p.photo).join() === "1,2", "photo numbers outside 1..photosRead, fractional, and repeated are dropped (first reading wins)", s);
  ok(JSON.stringify(s[0].trades) === '["stairs"]' && s[0].confidence === "low", "unknown trades are dropped; an unknown confidence reads as low (so it can never raise a warning)", s[0]);
}
{
  // Through the shipped function, end to end: model says photo 2 is a roof.
  const { out } = await deepRead(["stairs"], { stairs: { treadsSeen: 12, risersSeen: 13, countBasis: null, shape: "straight", confidence: "high" } }, [P(1, ["stairs"], "high", "Oak staircase"), P(2, ["roofing_service"], "high", "Roof from the driveway")]);
  const [viewed] = withChecks([out], quoteFor(["stairs"]).scopeGroups);
  ok(viewed.check.mismatch.verdict === "mismatch" && viewed.check.mismatch.photos[0].photo === 2, "end to end: the stored read + the quote's current trade → a mismatch on photo 2", viewed.check.mismatch);
  const [fixed] = withChecks([out], quoteFor(["stairs", "roofing_service"]).scopeGroups);
  ok(fixed.check.mismatch.verdict === "match", "…and adding roofing to the quote clears it — the verdict is computed on read, never stored");
  ok(!("check" in out) && !("mismatch" in out), "the read itself stores no verdict");
}

/* ═══════════════════════════════════════════════════════════════════════════ */
section("4. No overwrite of a measured quantity");

{
  const groups = deepFreeze([
    { category: { key: "stairs" }, takeoff: { sections: [{ treads: 14, risers: 15 }] }, intakeValues: { treads: 14 } },
  ]);
  const evidence = deepFreeze({ stairs: { treadsSeen: 12, risersSeen: 16, countBasis: null, shape: "straight", confidence: "high" } });
  let rows;
  let threw = null;
  try {
    rows = E.measuredBeside({ evidence, scopeGroups: groups });
  } catch (err) {
    threw = err;
  }
  ok(threw === null, "measuredBeside never writes to the scope groups or the evidence (both deep-frozen; a write would throw)", threw?.message);
  const treads = rows.find((r) => r.field === "treads");
  const risers = rows.find((r) => r.field === "risers");
  ok(treads.measured.value === 14 && treads.measured.kept === true, "the measured 14 treads come back unchanged and marked kept", treads);
  ok(treads.estimate.low === 12 && treads.estimate.seen === true, "…the photo's 12 visible sit BESIDE it as a seen count");
  ok(treads.differs === false, "seeing fewer than measured is normal (out of frame) — no flag");
  ok(risers.differs === true, "seeing MORE risers (16) than measured (15) is the finding — flagged, still not written");
  ok(groups[0].takeoff.sections[0].treads === 14 && groups[0].intakeValues.treads === 14, "the takeoff and intake still say 14");
}
{
  const groups = deepFreeze([{ category: { key: "gutter_services" }, takeoff: { gutterFt: 120, downspoutsInstalled: 4 }, intakeValues: null }]);
  const evidence = deepFreeze({ gutters: { length: { feet: { low: 40, high: 50 }, metres: { low: 12, high: 15 }, basis: null, estimate: true }, downspoutsSeen: 2, storeys: "one", issues: [], confidence: "medium" } });
  const rows = E.measuredBeside({ evidence, scopeGroups: groups });
  const len = rows.find((r) => r.field === "length");
  ok(len.measured.value === 120 && len.differs === true, "a measured 120 ft run against a 40–50 ft photo estimate is flagged — and 120 is what comes back", len);
}
{
  const groups = deepFreeze([{ category: { key: "roofing_service" }, takeoff: { pitchRise: 6, layers: 1 }, intakeValues: null }]);
  const rows = E.measuredBeside({ evidence: { roofing: { pitch: "steep", layers: "more_than_one_suspected", damage: [], confidence: "high" } }, scopeGroups: groups });
  ok(rows.find((r) => r.field === "pitch").differs === false, "6/12 measured vs 'steep' — one band apart, within a photo's resolution, not flagged");
  ok(rows.find((r) => r.field === "layers").differs === true, "1 layer measured vs 'more than one suspected' — flagged");
}
{
  const groups = deepFreeze([{ category: { key: "cabinet_refacing" }, takeoff: null, intakeValues: { doorCount: "22", drawerCount: 0 } }]);
  const rows = E.measuredBeside({ evidence: { cabinets: { doorsSeen: 18, drawersSeen: 4 } }, scopeGroups: groups });
  ok(rows.length === 1 && rows[0].field === "doors" && rows[0].measured.value === 22, "intake counts are read as measured; a measured 0 drawers is no measurement, so no row is invented", rows);
}
ok(E.measuredBeside({ evidence: null, scopeGroups: null }).length === 0, "no evidence, no groups → no rows, no throw");

// The route, read in its own POST body: one write, to aiVisionPasses only.
{
  const src = read("app/api/quotes/[id]/vision/route.js");
  const post = src.slice(src.indexOf("export async function POST("));
  const updates = [...post.matchAll(/db\.(\w+)\.(update|updateMany|upsert|create|createMany|delete|deleteMany)\(/g)];
  ok(updates.length === 1 && updates[0][1] === "quote" && updates[0][2] === "update", "quote route POST: exactly one database write, a quote.update", updates.map((m) => m[0]));
  const dataAt = post.indexOf("data: { aiVisionPasses: passes }");
  ok(dataAt > -1, "…and its data is `{ aiVisionPasses: passes }` and nothing else");
  // Scoped to the call itself — from `db.quote.update(` to its closing `});`
  // — not a window of characters that could run into the next statement.
  const callAt = post.indexOf("db.quote.update(");
  const call = post.slice(callAt, post.indexOf("});", callAt) + 3);
  ok(callAt > -1 && call.length > 20 && !/scopeGroup|lineItems|takeoff|intakeValues|total/.test(call), "…no scope group, line, takeoff, intake value or total in that call", call);
  const inv = read("app/api/invoices/[id]/deep-read/route.js");
  const ipost = inv.slice(inv.indexOf("export async function POST("));
  const iupd = [...ipost.matchAll(/db\.(\w+)\.(update|updateMany|upsert|create|createMany|delete|deleteMany)\(/g)];
  ok(iupd.length === 1 && /data: \{ aiVisionPasses: passes \}/.test(ipost), "invoice route POST: exactly one write, `{ aiVisionPasses: passes }`", iupd.map((m) => m[0]));
  for (const rel of ["lib/ai/deepReadEvidence.js", "lib/ai/visionPass.js", "lib/ai/deepReadView.js"]) {
    ok(!/\.(update|updateMany|upsert|create|createMany|delete|deleteMany)\(/.test(read(rel).replace(/\/\/.*$/gm, "")), `${rel}: makes no database write`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
section("5. Cost unchanged");

{
  const { calls, req } = await deepRead(["junk_removal", "roofing_service", "stairs", "gutter_services"], null, [], { photos: 12 });
  // The reply has no evidence, so it fails validation — the point here is the REQUEST.
  ok(calls === 1, "one vendor call per deep read, even for a four-trade quote", calls);
  const images = (req.messages.at(-1).content || []).filter((c) => c.type === "image_url");
  ok(images.length === VISION_MAX_PHOTOS, `…sending at most VISION_MAX_PHOTOS (${VISION_MAX_PHOTOS}) of 12 photos`, images.length);
  ok(images.every((c) => c.image_url.detail === "high"), "…at detail 'high', the capped ceiling — never 'original'");
  ok(Object.keys(reqSchema(req).properties.evidence.properties).length === E.MAX_FAMILIES, "…with at most MAX_FAMILIES evidence blocks in its schema");
}
ok(VISION_PASS_CENTS === 25, "VISION_PASS_CENTS is unchanged at 25", VISION_PASS_CENTS);
{
  const src = read("app/api/quotes/[id]/vision/route.js");
  const post = src.slice(src.indexOf("export async function POST("));
  ok((post.match(/reserveSpend\(/g) || []).length === 1 && /kind: "image_vision"/.test(post), "the quote route reserves once, as kind image_vision (priced at VISION_PASS_CENTS)");
  ok((post.match(/runVisionPass\(/g) || []).length === 1, "…and calls the read once");
  const inv = read("app/api/invoices/[id]/deep-read/route.js");
  const ipost = inv.slice(inv.indexOf("export async function POST("));
  ok((ipost.match(/reserveSpend\(/g) || []).length === 1 && (ipost.match(/runVisionPass\(/g) || []).length === 1, "the invoice route: one reservation, one read");
  const view = read("lib/ai/deepReadView.js");
  ok(!/complete\(|runToolLoop\(|provider/.test(view.replace(/\/\/.*$/gm, "")), "the mismatch check and the measured rows call no model — computed in code on every read");
}
{
  const before = JSON.stringify({ type: "object", properties: { notes: { type: "array", description: "Short lines about things an estimator may have missed. Empty is a real answer.", items: { type: "string" } } }, required: ["notes"], additionalProperties: false }).length;
  const base = JSON.stringify(E.deepReadSchema([])).length;
  const one = JSON.stringify(E.deepReadSchema(["stairs"])).length;
  const three = JSON.stringify(E.deepReadSchema(["junk", "roofing", "gutters"])).length;
  console.log(`       (schema size: was ${before} chars; now ${base} base, ${one} with one family, ${three} at the three-family cap)`);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
section("6. Nine languages, and nothing raw on screen");

const LANGS = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];
const ui = read("app/components/ai/DeepReadFindings.js");
const literalKeys = [...new Set([...ui.matchAll(/"(app\.deepRead\.[\w.]+)"/g)].map((m) => m[1]))];
const needed = new Set(literalKeys);
const groups = { junk: E.JUNK_ITEMS, fee: [...new Set(Object.values(E.JUNK_SURCHARGE_FOR))], pitch: E.ROOF_PITCH, layers: E.ROOF_LAYERS, roofDamage: E.ROOF_DAMAGE, condition: E.CONDITION, peeling: E.PEELING, colour: E.COLOUR_CHANGE, doorStyle: E.DOOR_STYLE, finish: E.CABINET_FINISH, floor: E.FLOOR_MATERIAL, shape: E.STAIR_SHAPE, storeys: E.STOREYS, gutter: E.GUTTER_ISSUES };
for (const [g, values] of Object.entries(groups)) for (const v of values) if (v !== "unclear") needed.add(`app.deepRead.v.${g}.${v}`);
for (const f of E.FAMILY_KEYS) needed.add(`app.deepRead.family.${f}`);
for (const c of E.CONFIDENCE) needed.add(`app.deepRead.confidence.${c}`);
for (const m of ui.matchAll(/`app\.deepRead\.f\.\$\{r(?:ow)?\.field\}`/g)) void m;
for (const f of ["volume", "items", "fees", "pitch", "layers", "damage", "condition", "peeling", "currentColour", "colourChange", "doors", "drawers", "doorStyle", "finish", "material", "transitions", "treads", "risers", "shape", "length", "downspouts", "storeys", "issues"]) needed.add(`app.deepRead.f.${f}`);
// Every field name the component passes to add() must be one of those.
for (const m of ui.matchAll(/add\(\s*"(\w+)"/g)) ok(needed.has(`app.deepRead.f.${m[1]}`), `field "${m[1]}" has a label key`);
// …and every field measuredBeside can emit.
for (const f of ["treads", "risers", "doors", "drawers", "length", "downspouts", "pitch", "layers"]) ok(needed.has(`app.deepRead.f.${f}`), `measured row "${f}" has a label key`);
// …and every group the component looks values up in is a vocabulary checked above.
for (const m of ui.matchAll(/enum[VL]\("(\w+)"/g)) ok(Object.hasOwn(groups, m[1]), `the component's "${m[1]}" group is a known vocabulary`);
const missing = [];
for (const lang of LANGS) for (const k of needed) if (typeof APP_MESSAGES[lang]?.[k] !== "string" || !APP_MESSAGES[lang][k].trim()) missing.push(`${lang}:${k}`);
ok(missing.length === 0, `all ${needed.size} deep-read labels exist in all nine app languages`, missing.slice(0, 10));
const placeholderDrift = [];
for (const k of needed) {
  const want = [...(APP_MESSAGES.en[k] || "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
  for (const lang of LANGS) {
    const got = [...(APP_MESSAGES[lang][k] || "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    if (got !== want) placeholderDrift.push(`${lang}:${k}`);
  }
}
ok(placeholderDrift.length === 0, "every translation keeps English's {placeholders}", placeholderDrift);

// Wired where the owner said: the quote review, the invoice twin, and the estimate-review queue.
ok(/<DeepReadFindings pass=\{p\} tradeNames=\{visionTradeNames\} docKind="quote" \/>/.test(read("app/components/quotes/SuggestAddOns.js")), "the quote's review panel renders the findings for every pass");
ok(/<DeepReadFindings pass=\{p\} tradeNames=\{visionTradeNames\} docKind="invoice" \/>/.test(read("app/components/invoices/InvoiceReviewPanel.js")), "the invoice's panel renders them too");
ok(/<DeepReadMismatch mismatch=\{q\.photoCheck\}/.test(read("app/app/estimate-reviews/page.js")) && /photoCheck: checks\[i\]/.test(read("app/api/quotes/estimate-reviews/route.js")), "the estimate-review queue shows the warning, computed by its route");
ok(!/approve-estimate/.test(ui) && !/disabled/.test(ui), "the warning has no control and disables nothing — it never blocks");
ok(!/\/(quote|q|portal|book|site|embed)\//.test(ui), "the findings component is not referenced from a client-facing path");
{
  const clientFacing = ["app/quote", "app/q", "app/portal", "app/book", "app/site", "app/embed"].filter((d) => fs.existsSync(path.join(ROOT, d)));
  const hits = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else if (/\.(js|jsx)$/.test(e.name) && /DeepReadFindings|deepReadEvidence|aiVisionPasses/.test(fs.readFileSync(path.join(ROOT, rel), "utf8"))) hits.push(rel);
    }
  };
  for (const d of clientFacing) walk(d);
  ok(hits.length === 0, "no client-facing page reads the deep read or its evidence", hits);
}

// A pass with evidence round-trips through JSON (it is stored in a Json column).
{
  const { out } = await deepRead(["junk_removal"], { junk: { pickupBedsLow: 1, pickupBedsHigh: 1.5, volumeBasis: "x", items: ["tires"], confidence: "low" } }, [P(1, ["junk_removal"])]);
  const stored = JSON.parse(JSON.stringify({ at: "2026-09-25T10:00:00Z", ...out, costCents: 25 }));
  ok(validateAgainstSchema !== undefined && JSON.stringify(stored.evidence) === JSON.stringify(out.evidence), "a read survives the Json column unchanged");
}

console.log(`\n${passed} passed, ${fail} failed`);
if (fail) process.exit(1);
