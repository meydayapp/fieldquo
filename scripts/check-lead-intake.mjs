// scripts/check-lead-intake.mjs
//
//   npm run check:lead-intake
//
// What a homeowner types, and whether it survives the trip to the lead board.
//
// ══ The failure this exists to stop coming back ════════════════════════════
//
// LeadRequest.intake is a Json column. It has no schema, so every one of the
// eleven inbound paths was free to invent its own layout, and they did:
//
//   self-quote          { ...answers, address, city, province, country }
//   kitchen designer    { address }
//   Meta lead ads       { address, city, province, country, ...answers }
//   instant quote       nothing at all — the address went into the `message`
//                       prose, and the room dimensions, door counts and
//                       finishes went to the draft quote and nowhere else
//   phone receptionist  nothing at all — "Address: 12 Main St" in the prose
//
// convertLead reads exactly ONE of those layouts to seed a converted client's
// address, city, province and country, which is what the tax resolver runs on.
// So an instant-quote lead — the one that arrives with a measured roof, a
// budget and photos — became a client with no address and no jurisdiction: the
// identical defect the self-quote path had already been fixed for once, back
// again through a different door, because each caller hand-built its own blob.
//
// The fix is a shared shape (lib/leads/intakeShape.js). This file is what makes
// the shape binding: it scans every createScoredLead call site the way
// check-conversation-review.mjs scans every quote.create, and it EXECUTES the
// conversion against a stubbed database rather than reading the source and
// hoping. The address-through-conversion pin is mutation tested — the guard is
// deliberately broken and this file has to fail.
//
// ══ And the smaller lie on the screen ══════════════════════════════════════
//
// "Not stated" is a claim about a household: they saw the question and skipped
// it. On a channel that never puts the question — the instant quote has no
// timeline field, the kitchen designer and the portal ask neither — it is not
// true. Asserted here, in all nine languages.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import {
  buildLeadIntake,
  leadAddressFromIntake,
  leadAddressLine,
  leadIntakeDetails,
  formatIntakeValue,
  humaniseKey,
  LEAD_ADDRESS_KEYS,
} from "../lib/leads/intakeShape.js";
import { buildLeadFromFunnel } from "../lib/funnels/ingest.js";
import { normaliseLeadRow } from "../lib/leads/importMap.js";
import { NOT_ASKED_BY_SOURCE, wasAsked } from "../lib/leads/qualifiers.js";
import { UNASKABLE_BY_SOURCE } from "../lib/leads/createLead.js";
import { scoreLead } from "../lib/leads/score.js";
import { convertLeadToQuote } from "../lib/leads/convertLead.js";
import { rows, writes, resetDbStub } from "./fixtures/dbStub.mjs";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
/** Source with comments removed — a comment DESCRIBING a shape is not the shape. */
const code = (p) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

let checks = 0;
let failures = 0;
/** ok(condition, label) — throws if called label-first, so a swapped call can't pass forever. */
const ok = (cond, label, detail) => {
  if (typeof cond === "string") throw new TypeError(`ok() called label-first: ${JSON.stringify(cond)}`);
  if (typeof label !== "string") throw new TypeError("ok() needs a string label second");
  checks++;
  if (!cond) failures++;
  console.log(
    (cond ? "  ok   " : "  FAIL ") + label + (cond || detail === undefined ? "" : `  — ${JSON.stringify(detail).slice(0, 300)}`),
  );
};
const section = (t) => console.log(`\n${t}\n`);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The shape, against the input a public form actually sends");
// ═══════════════════════════════════════════════════════════════════════════

ok(
  JSON.stringify(LEAD_ADDRESS_KEYS) === JSON.stringify(["address", "city", "province", "country"]),
  "the reserved keys are exactly the four columns a Client has",
  LEAD_ADDRESS_KEYS,
);

ok(buildLeadIntake() === null, "nothing in, null out — never an empty object stamped on the row");
ok(buildLeadIntake({}) === null, "an empty argument is still null");
ok(buildLeadIntake({ details: {} }) === null, "empty details are still null");
ok(
  buildLeadIntake({ address: "   " }) === null,
  "whitespace is not an address",
);

{
  // The homeowner typed their address instead of picking a suggestion. There
  // is no province, and there must not BE one — a null beside a real address
  // is an absence a later reader mistakes for an answer.
  const typed = buildLeadIntake({ address: "12 Main St", city: "", province: null, country: undefined });
  ok(JSON.stringify(typed) === JSON.stringify({ address: "12 Main St" }), "a typed address stores the address ALONE", typed);
  ok(!("province" in typed), "…and does not carry `province: null` for a later reader to misread");
}

{
  const picked = buildLeadIntake({
    address: "917 Littlerock St, Ottawa, ON K1A 0B1, Canada",
    city: "Ottawa",
    province: "ON",
    country: "CA",
    details: { doorCount: 37, drawerCount: 12, finish: "Satin white" },
  });
  ok(picked.address.startsWith("917 Littlerock"), "a Places pick keeps the formatted address");
  ok(picked.city === "Ottawa" && picked.province === "ON" && picked.country === "CA", "…and all three structured parts", picked);
  ok(picked.doorCount === 37, "…alongside the answers they typed");
}

{
  // Precedence: the real address wins, and a channel's own similarly-named
  // answer survives when there is no real one.
  const both = buildLeadIntake({ address: "REAL", details: { address: "FROM A QUESTION", roof: "shingle" } });
  ok(both.address === "REAL", "an explicit address beats a details key of the same name", both);
  const only = buildLeadIntake({ details: { address: "FROM A QUESTION" } });
  ok(only.address === "FROM A QUESTION", "…and a funnel question worded \"address\" still reaches the reserved key", only);
}

{
  const kept = buildLeadIntake({ details: { longCarry: false, stairsFlights: 0, notes: "", items: [] } });
  ok(kept !== null && kept.longCarry === false, "a ticked-then-unticked box is stored — it is a real No", kept);
  ok(kept.stairsFlights === 0, "zero is a number somebody chose, not an absence");
  ok(!("notes" in kept) && !("items" in kept), "an empty string and an empty array are absences, and are dropped", kept);
}

ok(
  buildLeadIntake({ details: [1, 2, 3] }) === null,
  "an ARRAY posted where an object was expected produces nothing, not indexed keys",
);
ok(buildLeadIntake({ details: "nope" }) === null, "so does a string");

// ═══════════════════════════════════════════════════════════════════════════
section("2. Reading it back");
// ═══════════════════════════════════════════════════════════════════════════

{
  const empty = leadAddressFromIntake(null);
  ok(
    empty.address === null && empty.city === null && empty.province === null && empty.country === null,
    "a lead with no intake reads back four nulls, never undefined — the columns must be written explicitly",
    empty,
  );
  ok(leadAddressFromIntake("[]").address === null, "a garbage intake reads back nulls rather than throwing");
  ok(leadAddressFromIntake({ address: 42 }).address === null, "a non-string address is not an address");
}

{
  // Google's formatted_address already carries the city and the province. The
  // naive join printed them twice on every lead that came from a Places pick.
  const google = { address: "917 Littlerock St, Ottawa, ON K1A 0B1, Canada", city: "Ottawa", province: "ON" };
  ok(
    leadAddressLine(google) === google.address,
    "a formatted address is not padded with the city and province it already contains",
    leadAddressLine(google),
  );
  const typed = { address: "12 Main St", city: "Gatineau", province: "QC" };
  ok(
    leadAddressLine(typed) === "12 Main St, Gatineau, QC",
    "a typed street line DOES get the jurisdiction appended",
    leadAddressLine(typed),
  );
  ok(leadAddressLine(null) === null, "no address, no line — not an empty comma");
  ok(leadAddressLine({ city: "Ottawa" }) === "Ottawa", "city alone is still worth a line");
  // "ON" must not match inside "Ontario Street", or a real province is dropped.
  ok(
    leadAddressLine({ address: "44 Ontario Street", province: "ON" }) === "44 Ontario Street, ON",
    "the substring match is on whole words — \"ON\" is not already in \"Ontario Street\"",
    leadAddressLine({ address: "44 Ontario Street", province: "ON" }),
  );
}

{
  const intake = {
    address: "12 Main St", city: "Ottawa", province: "ON", country: "CA",
    doorCount: 37, longCarry: false, jobType: "full_load",
  };
  const keys = leadIntakeDetails(intake).map(([k]) => k);
  ok(
    !keys.some((k) => LEAD_ADDRESS_KEYS.includes(k)),
    "\"What they told us\" never lists city/province/country as things they told us",
    keys,
  );
  ok(keys.includes("doorCount") && keys.includes("jobType"), "…and does list the answers", keys);
  ok(!keys.includes("longCarry"), "an unticked optional box is not four rows of \"No\"", keys);
}

{
  // Every value shape the product actually stores, none of which may render as
  // "[object Object]" at an estimator.
  ok(formatIntakeValue([{ key: "sofa", quantity: 2 }, { key: "mattress", quantity: 1 }]) === "2 × sofa, 1 × mattress",
    "the junk-removal item list reads as items",
    formatIntakeValue([{ key: "sofa", quantity: 2 }]));
  ok(formatIntakeValue(["Kitchen", "Bathroom"]) === "Kitchen, Bathroom", "a multi-select reads as a list");
  ok(formatIntakeValue(true) === "Yes" && formatIntakeValue(false) === "No", "booleans read as words");
  ok(formatIntakeValue({ a: 1, b: null }) === "a: 1", "an unknown object renders its own pairs and skips the empties");
  const all = [{ key: "x", quantity: 1 }, ["a"], { z: 2 }, true, 5, "s"];
  ok(all.every((v) => !String(formatIntakeValue(v)).includes("[object")), "nothing renders as [object Object]");
  ok(humaniseKey("doorCount") === "door count" && humaniseKey("job_type") === "job type", "keys humanise the same way everywhere");
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Every caller of createScoredLead, found rather than listed");
// ═══════════════════════════════════════════════════════════════════════════

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

const SOURCES = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "lib"))];

/**
 * Channels that genuinely have no address to pass, with the reason. An entry
 * here is a claim, and the claim is re-checked below: the file must not read an
 * address off its own input.
 */
const NO_ADDRESS = {
  // The embeddable form on a contractor's own website. Its body is
  // { companySlug, name, email, phone, categoryId, message } and there is no
  // address field in it — an absence, not a loss.
  "app/api/leads/public/route.js": "the embed form has no address field",
};

/**
 * Callers whose intake is built by a helper rather than inline. Listed with the
 * file that builds it, and that file is checked instead.
 */
const DELEGATES = {
  "app/api/funnels/public/[companySlug]/[funnelSlug]/submit/route.js": "lib/funnels/ingest.js",
};

/**
 * lib/meta/leadsImport.js builds its own blob from Meta's field_data, and it
 * was already writing the four reserved keys under exactly these names before
 * the shared shape existed. Pinned by its MAPPING rather than by a
 * buildLeadIntake call, so a rename on either side is caught.
 */
const META = "lib/meta/leadsImport.js";

const CALLERS = [];
for (const file of SOURCES) {
  const rel = path.relative(ROOT, file);
  if (rel === "lib/leads/createLead.js") continue; // the definition, not a call
  const src = code(rel);
  // The CREATOR only. Several routes import rescoreLead from the same module
  // to re-run the score after a rep edits a qualifier; they create nothing.
  if (!/import\s*\{[^}]*\bcreateScoredLead\b[^}]*\}\s*from\s*"@\/lib\/leads\/createLead"/.test(src)) continue;
  // createLead.js's export is aliased in one place (callLeadRecovery injects it
  // for its own check), so both spellings count as a call site.
  let idx = -1;
  const found = [];
  const RE = /create(?:Scored)?Lead\(\{/g;
  let m;
  while ((m = RE.exec(src)) !== null) found.push(m.index);
  if (!found.length) {
    ok(false, `${rel} imports createScoredLead and calls it in a shape this scan can read`, src.slice(0, 200));
    continue;
  }
  for (const at of found) CALLERS.push({ rel, block: src.slice(at, at + 2000) });
  void idx;
}

ok(CALLERS.length >= 11, "every inbound lead path in the repo was found", CALLERS.map((c) => c.rel));

const FILES = new Set(CALLERS.map((c) => c.rel));
for (const rel of Object.keys(NO_ADDRESS)) {
  ok(FILES.has(rel), `the "no address" exemption names a real caller: ${rel}`);
}
for (const rel of Object.keys(DELEGATES)) ok(FILES.has(rel), `the delegation exemption names a real caller: ${rel}`);
ok(FILES.has(META), "the Meta importer is still a caller");

for (const c of CALLERS) {
  if (NO_ADDRESS[c.rel]) {
    // The exemption has to stay true. If this route ever starts reading an
    // address, the exemption is stale and the check says so rather than
    // silently permitting a fourth layout.
    const src = code(c.rel);
    ok(
      !/\baddress\b/.test(src),
      `${c.rel} really has no address to pass (${NO_ADDRESS[c.rel]})`,
    );
    continue;
  }
  if (c.rel === META) {
    const src = code(META);
    ok(/street_address:\s*"address"/.test(src), `${META} maps street_address onto the reserved key`);
    ok(/\bcity:\s*"city"/.test(src) && /\bstate:\s*"province"/.test(src) && /\bcountry:\s*"country"/.test(src),
      `${META} maps the other three onto the reserved keys`);
    continue;
  }
  const builder = DELEGATES[c.rel];
  if (builder) {
    ok(/buildLeadIntake\(/.test(code(builder)), `${c.rel} delegates its intake to ${builder}, which uses the shared shape`);
    // …and the caller must not then re-merge it by hand, which is how the
    // funnel route used to bypass the shape it had just been given.
    ok(/intake:\s*buildLeadIntake\(/.test(c.block), `${c.rel} merges the estimate notes THROUGH the shape, not by spread`, c.block.slice(0, 200));
    continue;
  }
  // Either inline at the call, or a `const intake = buildLeadIntake(…)` passed
  // as shorthand — the self-quote route builds it a few lines earlier so the
  // email can be built from the same values. Both are the shape; a literal is
  // not.
  const inline = /intake:\s*buildLeadIntake\(/.test(c.block);
  const shorthand = /(?:^|[\s,{])intake,/.test(c.block) && /const\s+intake\s*=\s*buildLeadIntake\(/.test(code(c.rel));
  ok(inline || shorthand, `${c.rel} builds its intake with buildLeadIntake`, c.block.slice(0, 300));
  ok(
    /from "@\/lib\/leads\/intakeShape"/.test(code(c.rel)),
    `${c.rel} imports the shape rather than re-deriving it`,
  );
}

// The other half: nothing anywhere hand-builds an intake with an address in it.
{
  const offenders = [];
  for (const file of SOURCES) {
    const rel = path.relative(ROOT, file);
    if (rel === "lib/leads/intakeShape.js" || rel === META) continue;
    const src = code(rel);
    // `intake: { …address… }` — an object literal carrying the reserved key.
    if (/intake:\s*\{[^}]*\baddress\b/.test(src)) offenders.push(rel);
    // `...(x ? { intake: { address } } : {})` — the kitchen route's old spelling.
    if (/intake:\s*\{\s*address\s*\}/.test(src)) offenders.push(rel);
  }
  ok(offenders.length === 0, "no route hand-builds an intake blob containing an address", offenders);
}

// And the readers. convertLead is the one that matters, but a second reader
// that went by key would drift the same way.
{
  const cl = code("lib/leads/convertLead.js");
  ok(/leadAddressFromIntake\(lead\.intake\)/.test(cl), "convertLead reads the address through the shared reader");
  ok(!/intake\.address/.test(cl), "…and no longer by key");
  const page = code("app/app/leads/page.js");
  ok(/leadAddressLine\(/.test(page) && /leadIntakeDetails\(/.test(page), "the leads screen reads through it too");
  ok(!/intake\?\.address|intake\.address/.test(page), "…and not by key");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The conversion, EXECUTED — an instant-quote lead becomes a client with an address");
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The intake an instant-quote submission produces, built the way the route
 * builds it. Google's geocoder returns a formatted string and no components,
 * so a roof-address trade has no city/province — the Places-picked site address
 * (every other trade) does, and that is the case worth pinning.
 */
const INSTANT_QUOTE_INTAKE = buildLeadIntake({
  address: "917 Littlerock St, Ottawa, ON K1A 0B1, Canada",
  city: "Ottawa",
  province: "ON",
  country: "CA",
  details: { doorCount: 37, drawerCount: 12, material: "satin_lacquer" },
});

async function convertOnce(intake, { email = "homeowner@example.com" } = {}) {
  resetDbStub();
  rows.company = [{ id: "co1", defaultLanguage: "en" }];
  const lead = {
    id: "lead1",
    companyId: "co1",
    name: "Dana Whitfield",
    email,
    phone: "+16135550142",
    categoryId: null,
    message: "917 Littlerock St, Ottawa, ON K1A 0B1, Canada\n\nInstant estimate — cabinet_refinishing",
    budgetBand: "5k_15k",
    timeline: null,
    clientPhotos: [],
    intake,
    language: "en",
    quoteId: null,
  };
  rows.leadRequest = [lead];
  await convertLeadToQuote({ lead, member: { userId: "u1" }, company: { id: "co1", defaultLanguage: "en" } });
  return writes.find((w) => w.model === "client" && w.action === "create")?.data || null;
}

{
  const client = await convertOnce(INSTANT_QUOTE_INTAKE);
  ok(Boolean(client), "converting the lead created a client");
  ok(
    client.address === "917 Littlerock St, Ottawa, ON K1A 0B1, Canada",
    "THE REGRESSION: the client gets the address the homeowner gave the instant quote",
    client,
  );
  ok(client.city === "Ottawa" && client.province === "ON", "…with the city and province Google returned", client);
  ok(client.country === "CA", "…and a normalised country, so the tax resolver has a jurisdiction", client);
}

{
  // The honest half. A roof-address trade, or anyone who typed their address:
  // an address and nothing else, and no invented province.
  const client = await convertOnce(buildLeadIntake({ address: "12 Main St" }), { email: "b@example.com" });
  ok(client.address === "12 Main St", "a typed address still reaches the client");
  ok(
    client.city === null && client.province === null && client.country === null,
    "…and nothing is invented around it — a guessed province is a wrong tax rate",
    client,
  );
}

{
  // A country that is not ISO alpha-2 must not sit in the column looking
  // authoritative. This is the reason the normalisation lives on the read side.
  const client = await convertOnce(
    buildLeadIntake({ address: "5 Rue Principale", country: "Canada" }),
    { email: "c@example.com" },
  );
  ok(client.country === null, "a country that isn't a code is dropped, not stored", client);
}

{
  // A phone lead: the receptionist heard an address and nothing else.
  const client = await convertOnce(buildLeadIntake({ address: "88 Elm Ave" }), { email: "d@example.com" });
  ok(client.address === "88 Elm Ave", "a phone lead's spoken address converts too");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. \"Not stated\" is not said about a question nobody asked");
// ═══════════════════════════════════════════════════════════════════════════

ok(wasAsked("self_quote", "budget"), "the self-quote form DOES ask about budget — a skip there is a real skip");
ok(wasAsked("self_quote", "timeline"), "…and about timing");
ok(!wasAsked("instant_quote", "timeline"), "the instant quote does not ask when they want it done");
ok(wasAsked("instant_quote", "budget"), "…but it does ask the budget, as a tap on the company's own bands");
ok(!wasAsked("phone_agent", "budget"), "the receptionist may not discuss money");
ok(!wasAsked("self_quote_kitchen", "budget") && !wasAsked("self_quote_kitchen", "timeline"), "the kitchen designer asks neither");
ok(!wasAsked("client_portal", "timeline"), "the portal asks neither");
ok(wasAsked("funnel:facebook", "timeline"), "a funnel's questions are the contractor's own — we cannot claim they were not asked");
ok(wasAsked("imported", "budget"), "…nor can we, of a CSV somebody exported");
ok(wasAsked(undefined, "budget"), "an unknown source claims nothing");

// The relationship that must hold between the two maps, or the screen and the
// scorer end up describing different worlds.
for (const [source, fields] of Object.entries(UNASKABLE_BY_SOURCE)) {
  for (const f of fields) {
    ok(
      (NOT_ASKED_BY_SOURCE[source] || []).includes(f),
      `the scorer withholding "${f}" for ${source} is also declared unasked on the screen`,
      NOT_ASKED_BY_SOURCE[source],
    );
  }
}

{
  const page = code("app/app/leads/page.js");
  ok(/wasAsked\(lead\.source, "timeline"\)/.test(page), "the timeline selector asks which question this channel put");
  ok(/wasAsked\(lead\.source, "budget"\)/.test(page), "…and so does the budget selector");
  ok((page.match(/app\.leads\.notAsked/g) || []).length === 2, "both of them can say \"Nobody asked\"");
}

{
  const locales = Object.keys(APP_MESSAGES);
  ok(locales.length === 9, "there are nine language blocks", locales);
  const missing = locales.filter((l) => !APP_MESSAGES[l]["app.leads.notAsked"]);
  ok(missing.length === 0, "app.leads.notAsked is translated in every one of them", missing);
  const same = locales.filter((l) => APP_MESSAGES[l]["app.leads.notAsked"] === APP_MESSAGES[l]["app.leads.notStated"]);
  ok(same.length === 0, "…and says something DIFFERENT from \"Not stated\" in each — they are different facts", same);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The score — does a timeline reaching the lead change anything");
// ═══════════════════════════════════════════════════════════════════════════

// A real instant-quote lead: a name, an email, a phone, three photos, and the
// second-highest budget band the company offers.
const INSTANT_LEAD = {
  budgetBand: "5k_15k",
  phone: "+16135550142",
  email: "homeowner@example.com",
  clientPhotos: ["https://res.cloudinary.com/x/a.jpg", "https://res.cloudinary.com/x/b.jpg"],
  message: "Instant estimate — cabinet_refinishing",
  intake: INSTANT_QUOTE_INTAKE,
};

const withoutTimeline = scoreLead(INSTANT_LEAD);
const withAsap = scoreLead({ ...INSTANT_LEAD, timeline: "asap" });
const withExploring = scoreLead({ ...INSTANT_LEAD, timeline: "exploring" });

console.log(
  `      instant-quote lead, no timeline: ${withoutTimeline.score} (${withoutTimeline.temperature})\n` +
  `      …the same lead with "ASAP":       ${withAsap.score} (${withAsap.temperature})\n` +
  `      …the same lead "just exploring":  ${withExploring.score} (${withExploring.temperature})`,
);

ok(withAsap.score > withoutTimeline.score, "a timeline that reaches the lead DOES move the score", {
  without: withoutTimeline.score, with: withAsap.score,
});
ok(withAsap.score - withoutTimeline.score === 35, "…by the full 35 points, the largest single weight in the model");
ok(
  withoutTimeline.temperature !== withAsap.temperature,
  "…enough to change the word the contractor sorts on",
  { without: withoutTimeline.temperature, with: withAsap.temperature },
);
ok(
  withAsap.reasons.some((r) => /ASAP/.test(r.label)),
  "…and it says why, so a rep can overrule it",
);
ok(
  !withoutTimeline.reasons.some((r) => /timeline|ASAP|exploring/i.test(r.label)),
  "no timeline produces NO timeline reason — never an invented \"not stated\" line",
  withoutTimeline.reasons,
);

// The other end of the same wiring: the phone maps urgency onto timeline, and
// the receptionist's leads are scored without the question it cannot ask.
{
  const voice = code("app/api/voice/tools/[tool]/route.js");
  ok(/timeline:\s*URGENCY_TIMELINE\[urgency\]/.test(voice), "the phone still maps urgency onto the timeline the scorer reads");
  const recovered = scoreLead(INSTANT_LEAD, { unasked: UNASKABLE_BY_SOURCE.phone_agent_recovered });
  ok(recovered.score > withoutTimeline.score, "a RECOVERED phone lead is scored without the budget question it could not ask", {
    web: withoutTimeline.score, recovered: recovered.score,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The other two paths that carry an address");
// ═══════════════════════════════════════════════════════════════════════════

{
  // A funnel whose contractor wrote an address question.
  const funnel = {
    channel: "facebook",
    steps: [
      { id: "s1", kind: "question_single", question: "address", answers: [{ value: "12 Main St", label: "12 Main St" }] },
      { id: "s2", kind: "question_single", maps: "timeline", question: "When?", answers: [{ value: "asap", label: "ASAP" }] },
    ],
  };
  const built = buildLeadFromFunnel(funnel, { answers: { s1: "12 Main St", s2: "asap" }, name: "Kim", phone: "6135550142" });
  ok(built.intake.address === "12 Main St", "a funnel's address answer lands on the reserved key", built.intake);
  ok(built.timeline === "asap", "…and its tagged timeline still reaches the scorer");
  const bare = buildLeadFromFunnel({ steps: [] }, { name: "Kim", phone: "6135550142" });
  ok(bare.intake === null, "a funnel with no answers produces no intake object at all", bare.intake);
}

{
  // The CSV importer, which used to read every column except the one with the
  // job's location in it.
  const row = normaliseLeadRow({ Name: "Pat", Email: "p@x.com", "Job Address": "44 Oak Rd", Budget: "$12,000", When: "asap" });
  ok(row.address === "44 Oak Rd", "the importer picks up an address column", row);
  ok(!("city" in row), "…and does NOT guess a city or a province out of a spreadsheet", Object.keys(row));
  const none = normaliseLeadRow({ name: "Pat" });
  ok(buildLeadIntake({ address: none.address }) === null, "a CSV with no address column produces no intake");
  ok(/intake:\s*buildLeadIntake\(/.test(code("app/api/leads/import/route.js")), "and the import route passes it");
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Mutation — break the pin and this file has to fail");
// ═══════════════════════════════════════════════════════════════════════════

const SELF = fileURLToPath(import.meta.url);
const LOADER = path.join(ROOT, "scripts/alias-loader.mjs");
const DB_LOADER = path.join(ROOT, "scripts/db-stub-loader.mjs");

if (!process.argv.includes("--no-mutate")) {
  const MUTATIONS = [
    [
      "lib/leads/intakeShape.js",
      "the jurisdiction never makes it into the blob",
      (s) => s.replace("    if (isEmpty(v)) continue;\n    out[key] = trimmed(v);", "    if (isEmpty(v)) continue;\n    void key;"),
    ],
    [
      "lib/leads/convertLead.js",
      "the conversion goes back to reading the address by key",
      (s) => s.replace(
        "const { address, city, province, country } = leadAddressFromIntake(lead.intake);",
        "const { address, city, province, country } = { address: null, city: null, province: null, country: null };",
      ),
    ],
    [
      "app/api/instant-quote/[companySlug]/request/route.js",
      "the instant quote stops passing an intake at all",
      (s) => s.replace("    intake: buildLeadIntake({", "    unusedIntake: ({"),
    ],
    [
      "lib/leads/qualifiers.js",
      "every source claims to have asked everything",
      (s) => s.replace("  instant_quote: [\"timeline\"],", ""),
    ],
  ];

  for (const [rel, label, mutate] of MUTATIONS) {
    const file = path.join(ROOT, rel);
    const ORIGINAL = fs.readFileSync(file, "utf8");
    const mutated = mutate(ORIGINAL);
    if (mutated === ORIGINAL) {
      ok(false, `mutation applies: ${label}`, "the source moved under it — rewrite the mutation, do not delete it");
      continue;
    }
    fs.writeFileSync(file, mutated);
    let caught = false;
    try {
      execFileSync(process.execPath, ["--import", LOADER, "--import", DB_LOADER, SELF, "--no-mutate"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      caught = true;
    } finally {
      fs.writeFileSync(file, ORIGINAL);
    }
    ok(caught, `mutation caught: ${label}`);
  }
}

console.log(`\ncheck-lead-intake: ${checks - failures}/${checks} passed`);
if (failures) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
