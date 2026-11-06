// scripts/check-voice-city-numbers.mjs
//
// "I typed Ottawa and I'm only shown Gatineau." Then, after the first fix:
// "I typed Ottawa and I'm shown Brockville — that's an hour's drive."
//
// ══ What this file reproduces ══════════════════════════════════════════════
//
// The fixture below is not invented. It is the shape of live Twilio inventory
// as measured on 2026-11-05, and the one property that matters is the one that
// is easiest to leave out of a mock:
//
//   the OTTAWAHULL rate centre has NO latitude, longitude or postal code.
//
// So `nearLatLong` cannot return it however wide the radius, which is why a
// point search could never show an Ottawa contractor an Ottawa number, and why
// every "widen the radius" fix found a further-away city instead of the right
// one. The fake Twilio here honours that: a row with no coordinates is invisible
// to a point search, exactly as the real one is.
//
// ══ Why this is executed rather than read ══════════════════════════════════
//
// The previous two attempts at this bug both passed a static check. A grep can
// see that the code widens the radius and prefers the right province; only
// running it can show that doing both still returns Brockville.
import { register } from "node:module";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

// ── The inventory, as Twilio really returns it ────────────────────────────
//
// lat/lng null is the whole point for Ottawahull. Gatineau sits 7 km from the
// point and fills a page on its own, which is what drowned Ottawa out.
const OTTAWA = { lat: 45.4215, lng: -75.6972 };
const row = (number, locality, region, lat, lng) => ({
  phoneNumber: number,
  friendlyName: number,
  locality,
  region,
  lat,
  lng,
  beta: false,
  capabilities: { voice: true, SMS: true },
});
const INVENTORY = {
  CA: [
    // 28 real Ottawa numbers that no point search can see.
    ...Array.from({ length: 28 }, (_, i) => row(`+1343700${String(1000 + i).slice(-4)}`, "Ottawahull", "ON", null, null)),
    // The Quebec inventory across the river — close, plentiful, wrong province.
    ...Array.from({ length: 30 }, (_, i) => row(`+1873800${String(1000 + i).slice(-4)}`, "Gatineau", "QC", 45.4833, -75.65)),
    // Right area code, right province, an hour away.
    ...Array.from({ length: 10 }, (_, i) => row(`+1343503${String(1000 + i).slice(-4)}`, "Brockville", "ON", 44.5895, -75.6843)),
    ...Array.from({ length: 10 }, (_, i) => row(`+1343504${String(1000 + i).slice(-4)}`, "Smiths Falls", "ON", 44.9043, -76.0211)),
  ],
  US: [
    // Two Phoenixes. Only one of them is in Arizona, and Twilio will happily
    // return the other for an unguarded name search.
    ...Array.from({ length: 6 }, (_, i) => row(`+1541555${String(1000 + i).slice(-4)}`, "Phoenix", "OR", 42.2, -122.8)),
  ],
};

const miles = (a, b) => {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

globalThis.__FQ_TW_CALLS = [];
globalThis.__FQ_TW_CONFIGURED = true;
// A SAMPLE — the real endpoint returns an arbitrary 30 of a larger pool, which
// is why the discovery sweep gets three attempts rather than one. Round-robin
// by city rather than a random draw, so every city in range is represented the
// way a real page is, and so a failure here is reproducible rather than
// something that happens one run in four.
const roundRobin = (rows) => {
  const byCity = new Map();
  for (const r of rows) {
    const k = r.locality || "";
    if (!byCity.has(k)) byCity.set(k, []);
    byCity.get(k).push(r);
  }
  const out = [];
  const lists = [...byCity.values()];
  for (let i = 0; out.length < rows.length; i += 1) {
    for (const l of lists) if (l[i]) out.push(l[i]);
    if (lists.every((l) => i >= l.length)) break;
  }
  return out;
};
globalThis.__FQ_SHUFFLE = roundRobin;
globalThis.__FQ_TWILIO_LIST = async (iso, query) => {
  globalThis.__FQ_TW_CALLS.push({ iso, ...query });
  let rows = INVENTORY[iso] || [];
  if (query.areaCode) rows = rows.filter((r) => r.phoneNumber.slice(2, 5) === String(query.areaCode));
  if (query.inLocality) rows = rows.filter((r) => r.locality === query.inLocality);
  if (query.inRegion) rows = rows.filter((r) => r.region === query.inRegion);
  if (query.nearLatLong) {
    const [lat, lng] = String(query.nearLatLong).split(",").map(Number);
    // A row with no coordinates is not "far away" — it is unreachable. This is
    // the line that makes the fixture tell the truth about Ottawa.
    rows = rows.filter((r) => r.lat != null && r.lng != null && miles({ lat, lng }, r) <= Number(query.distance));
  }
  return globalThis.__FQ_SHUFFLE(rows).slice(0, Number(query.limit) || 6);
};

globalThis.__FQ_SETTINGS = new Map();

const SPECIFIERS = { "@/lib/db": "fq:db", "@/lib/sms/twilioClient": "fq:twilio" };
const SOURCES = {
  "fq:db":
    "export const db = { platformSetting: {\n" +
    "  findUnique: async ({ where }) => globalThis.__FQ_SETTINGS.get(where.key) || null,\n" +
    "  upsert: async ({ where, create, update }) => {\n" +
    "    const row = { key: where.key, value: (globalThis.__FQ_SETTINGS.get(where.key) ? update.value : create.value) };\n" +
    "    globalThis.__FQ_SETTINGS.set(where.key, row); return row;\n" +
    "  },\n" +
    "} };",
  "fq:twilio":
    "export const twilioConfigured = () => globalThis.__FQ_TW_CONFIGURED;\n" +
    "export const twilioRest = {\n" +
    "  availablePhoneNumbers: (iso) => ({ local: { list: (q) => globalThis.__FQ_TWILIO_LIST(iso, q) } }),\n" +
    "};",
};
const HOOKS = `
const STUBS = ${JSON.stringify(SPECIFIERS)};
const SOURCES = ${JSON.stringify(SOURCES)};
export async function resolve(s, c, n) { return STUBS[s] ? { url: STUBS[s], shortCircuit: true } : n(s, c); }
export async function load(u, c, n) { return SOURCES[u] ? { format: "module", shortCircuit: true, source: SOURCES[u] } : n(u, c); }
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const { findNumbersForCity, forgetLearnedNames } = await import("@/lib/voice/cityNumbers");
const { cityNameMatches, normaliseCityName } = await import("@/lib/voice/numberSearch");

const reset = () => {
  globalThis.__FQ_TW_CALLS = [];
  globalThis.__FQ_SETTINGS = new Map();
  globalThis.__FQ_TW_CONFIGURED = true;
  globalThis.__FQ_SHUFFLE = roundRobin;
  // Each scenario is a cold instance. Without this the warm copy learned in
  // section 4 would answer section 5 before it ever reached the sweep — and
  // the sweep is the thing section 5 exists to exercise.
  forgetLearnedNames();
};
const nearOttawa = (locality = "Ottawa") => ({
  ...OTTAWA,
  place: "Ottawa, ON, Canada",
  region: "ON",
  country: "CA",
  locality,
});
const cities = (r) => [...new Set(r.numbers.map((n) => n.locality))];

section("1. Twilio's name for a place is not the one anybody types");

ok(cityNameMatches("Ottawa", "Ottawahull"), "Ottawa reaches the Ottawa-Hull exchange");
ok(cityNameMatches("Houston", "Houston Suburban"), "Houston reaches Houston Suburban");
ok(cityNameMatches("Montreal", "Montréal"), "accents do not break the match");
ok(cityNameMatches("new york city", "New York City"), "case and spaces do not either");
ok(!cityNameMatches("Ottawa", "Gatineau"), "and it does not reach across the river");
ok(!cityNameMatches("Ottawa", "Brockville"), "nor an hour down the 401");
// Four letters minimum, or short names swallow each other.
ok(!cityNameMatches("Ely", "Elyria"), "a three-letter name matches nothing by prefix");
ok(!cityNameMatches("", "Ottawahull"), "and an empty box is not a match for everything");
ok(!cityNameMatches("Ottawa", ""), "nor is a number Twilio gave no city for");
ok(!cityNameMatches("Ottawa", null), "null locality is not a match", normaliseCityName(null));

section("2. Ottawa gets Ottawa numbers — not Gatineau, not Brockville");

{
  reset();
  const r = await findNumbersForCity({ typed: "Ottawa", near: nearOttawa() });
  ok(r.numbers.length > 0, "the search returns something at all", r.numbers.length);
  ok(cities(r).join() === "Ottawahull", "every number is in the Ottawa exchange", cities(r));
  ok(r.numbers.every((n) => n.areaCode === "343"), "and every one is a 343", [...new Set(r.numbers.map((n) => n.areaCode))]);
  ok(!cities(r).includes("Gatineau"), "no Quebec number is offered for an Ontario city");
  ok(!cities(r).includes("Brockville"), "and no Brockville number either");
  ok(r.via.startsWith("discovered:"), "the name was learned from Twilio, not typed here", r.via);
}

section("3. A point search could never have found it");

{
  reset();
  // Exactly what the old picker did: the widest radius, and nothing else.
  const { searchLocalNumbers } = await import("@/lib/voice/numberSearch");
  const point = await searchLocalNumbers({ country: "CA", near: { ...OTTAWA, distanceMiles: 150 }, limit: 30 });
  const found = [...new Set(point.numbers.map((n) => n.locality))];
  ok(!found.includes("Ottawahull"), "150 miles of point search still cannot see the Ottawa exchange", found);
  ok(found.includes("Gatineau") && found.includes("Brockville"), "while the wrong cities are all reachable", found);
}

section("4. The learned name is remembered, so it is right every time");

{
  reset();
  await findNumbersForCity({ typed: "Ottawa", near: nearOttawa() });
  const stored = globalThis.__FQ_SETTINGS.get("voice.localityAlias");
  ok(Boolean(stored), "the discovery is written down");
  ok(
    Object.values(stored?.value || {}).includes("Ottawahull"),
    "and what was written down is Twilio's own spelling",
    stored?.value,
  );

  const before = globalThis.__FQ_TW_CALLS.length;
  globalThis.__FQ_TW_CALLS = [];
  const second = await findNumbersForCity({ typed: "Ottawa", near: nearOttawa() });
  ok(second.via === "alias:Ottawahull", "the second search goes straight to it", second.via);
  ok(globalThis.__FQ_TW_CALLS.length === 1, "in a single Twilio call", globalThis.__FQ_TW_CALLS.length);
  ok(before > 1, "where the first one took several", before);
}

section("5. A sweep that comes up empty still finds it, because it gets three looks");

{
  reset();
  // The real endpoint returns an arbitrary 30 of the pool; Ottawahull was
  // present in 15 of 20 live sweeps. Here the first two samples hide it.
  let sweep = 0;
  globalThis.__FQ_SHUFFLE = (rows) => {
    if (rows.some((r) => r.locality === "Ottawahull") && rows.some((r) => r.locality !== "Ottawahull")) {
      sweep += 1;
      if (sweep <= 2) return roundRobin(rows.filter((r) => r.locality !== "Ottawahull"));
    }
    return roundRobin(rows);
  };
  const r = await findNumbersForCity({ typed: "Ottawa", near: nearOttawa() });
  ok(r.via.startsWith("discovered:"), "two unlucky samples do not lose the city", r.via);
  ok(cities(r).join() === "Ottawahull", "and the numbers are still Ottawa's", cities(r));
}

section("6. A suburb reaches its city's exchange");

{
  reset();
  // Google returns locality "Ottawa" for Kanata, Nepean and Barrhaven — the
  // typed word is only a sublocality. That is the whole mechanism.
  const r = await findNumbersForCity({ typed: "Kanata", near: { ...nearOttawa("Ottawa"), place: "Kanata, Ottawa, ON, Canada" } });
  ok(cities(r).join() === "Ottawahull", "Kanata gets Ottawa numbers", cities(r));

  reset();
  const orphan = await findNumbersForCity({ typed: "Kanata", near: { ...nearOttawa(null), place: "Kanata, ON, Canada" } });
  ok(orphan.numbers.length > 0, "and with no municipality from Google it still answers", orphan.via);
  ok(orphan.numbers.every((n) => n.region === "ON"), "in the right province at least", orphan.via);
}

section("7. The name alone is never enough — the province decides");

{
  reset();
  // "Phoenix" is an exact Twilio locality in OREGON. Unguarded, the name
  // search hands an Arizona contractor six Oregon numbers.
  const r = await findNumbersForCity({
    typed: "Phoenix",
    near: { lat: 33.4484, lng: -112.074, place: "Phoenix, AZ, USA", region: "AZ", country: "US", locality: "Phoenix" },
  });
  ok(r.numbers.length === 0, "an Arizona search returns no Oregon numbers", r.numbers.map((n) => `${n.locality} ${n.region}`));
  const asked = globalThis.__FQ_TW_CALLS.filter((c) => c.inLocality === "Phoenix");
  ok(asked.length > 0 && asked.every((c) => c.inRegion === "AZ"), "because every name search is pinned to the province", asked);
}

section("8. Nothing new can make the picker emptier than it was");

{
  reset();
  // A city with no name match anywhere: the old behaviour has to still be there.
  const r = await findNumbersForCity({
    typed: "Perth",
    near: { lat: 44.9, lng: -76.25, place: "Perth, ON, Canada", region: "ON", country: "CA", locality: "Perth" },
  });
  ok(r.numbers.length > 0, "a city Twilio has never heard of still gets numbers", r.via);
  ok(r.numbers.every((n) => n.region === "ON"), "all of them in its own province", cities(r));
  ok(r.via === "region" || r.via === "widest", "by the fallback that was there before", r.via);
}

section("9. No Twilio is not an empty inventory");

{
  reset();
  globalThis.__FQ_TW_CONFIGURED = false;
  const r = await findNumbersForCity({ typed: "Ottawa", near: nearOttawa() });
  ok(r.configured === false, "an unconfigured account says so", r);
  ok(globalThis.__FQ_TW_CALLS.length === 0, "and asks Twilio nothing", globalThis.__FQ_TW_CALLS.length);
}

console.log(fail ? `\n${fail} FAILED\n` : "\nall good\n");
process.exit(fail ? 1 : 0);
