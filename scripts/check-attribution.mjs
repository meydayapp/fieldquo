// Executes lib/crew/attribution.js against the cases that destroy trust.
import { attributeMessage } from "@/lib/crew/attribution";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

// Real Montreal-ish coordinates so GPS separation is meaningful.
const OAK = { jobId: "oak", jobTitle: "Repaint", clientName: "Sam Rivera", address: "123 Oak St", lat: 45.5019, lng: -73.5674 };
const MAPLE = { jobId: "maple", jobTitle: "Deck", clientName: "Priya Shah", address: "45 Maple Ave", lat: 45.4581, lng: -73.6392 };
const LAVAL = { jobId: "laval", jobTitle: "Fence", clientName: "Chris Bond", address: "9 Rue Principale", lat: 45.6066, lng: -73.7124 };
const JOHNSON_A = { jobId: "jA", jobTitle: "Kitchen", clientName: "Johnson", address: "10 First St", lat: 45.50, lng: -73.56 };
const JOHNSON_B = { jobId: "jB", jobTitle: "Bath", clientName: "Johnson", address: "88 Second Ave", lat: 45.46, lng: -73.63 };

console.log("\nNothing scheduled");
const none = attributeMessage({ candidates: [], text: "done for the day" });
ok("no candidates -> ask nobody, file nothing", none.jobId === null && none.method === "none");
ok("...and doesn't claim confirmation it can't offer", none.needsConfirmation === false);

console.log("\nOnly one job — nowhere else it could be");
const one = attributeMessage({ candidates: [OAK], text: "framing done" });
ok("single candidate -> high confidence", one.confidence === "high");
ok("...method only-one", one.method === "only-one");
ok("...auto-files (no confirmation)", one.needsConfirmation === false);
ok("...to the right job", one.jobId === "oak");

console.log("\nThe rotation case (the user's own): 3 sites today, bare photo");
const rot = attributeMessage({ candidates: [OAK, MAPLE, LAVAL], text: "" });
ok("bare photo across 3 jobs -> does NOT guess", rot.jobId === null, rot);
ok("...asks", rot.needsConfirmation === true && rot.method === "ask");
ok("...offers all three to choose", rot.candidates.length === 3);

console.log("\nExplicit name wins even with 3 scheduled");
const named = attributeMessage({ candidates: [OAK, MAPLE, LAVAL], text: "gutters done at the Shah place" });
ok("names Shah -> files to Maple", named.jobId === "maple" && named.confidence === "high", named);
ok("...method explicit", named.method === "explicit");

console.log("\nStreet number disambiguates same-name jobs");
const byNumber = attributeMessage({ candidates: [JOHNSON_A, JOHNSON_B], text: "photos from 88 second, cabinets in" });
ok('"88" picks the right Johnson', byNumber.jobId === "jB", byNumber);

console.log("\nTWO Johnsons, just the surname -> narrower question, NOT a guess");
const bothJohnson = attributeMessage({ candidates: [JOHNSON_A, JOHNSON_B], text: "update for Johnson" });
ok("ambiguous name -> asks", bothJohnson.needsConfirmation === true, bothJohnson);
ok("...narrowed to the two Johnsons only", bothJohnson.candidates.length === 2);
ok("...files nothing yet", bothJohnson.jobId === null);

console.log("\nGPS: photo on a site, well separated");
const onOak = attributeMessage({ candidates: [OAK, MAPLE, LAVAL], text: "", point: { lat: 45.5020, lng: -73.5676 } });
ok("on Oak's lot -> files to Oak", onOak.jobId === "oak" && onOak.method === "gps", onOak);
ok("...high confidence", onOak.confidence === "high");

console.log("\nGPS: two jobs too close to tell apart -> ask, don't coin-flip");
const CLOSE_A = { jobId: "a", clientName: "A", address: "1 St", lat: 45.5000, lng: -73.5600 };
const CLOSE_B = { jobId: "b", clientName: "B", address: "2 St", lat: 45.5003, lng: -73.5601 }; // ~35m apart
const tooClose = attributeMessage({ candidates: [CLOSE_A, CLOSE_B], text: "", point: { lat: 45.5001, lng: -73.56005 } });
ok("neighbouring jobs -> refuses to pick on GPS", tooClose.method !== "gps", tooClose);
ok("...asks instead", tooClose.needsConfirmation === true);

console.log("\nGPS off-site (photo taken at the shop, not a job) -> ask");
const offSite = attributeMessage({ candidates: [OAK, MAPLE], text: "", point: { lat: 45.55, lng: -73.70 } });
ok("far from every job -> not a GPS match", offSite.method !== "gps");
ok("...asks between the day's jobs", offSite.needsConfirmation === true);

console.log("\nExplicit text beats GPS (crew said where, trust them)");
// Standing on Oak's lot but the message says Maple — the person is telling us.
const conflict = attributeMessage({
  candidates: [OAK, MAPLE],
  text: "this is for the Shah job",
  point: { lat: 45.5020, lng: -73.5676 }, // on Oak
});
ok("explicit text wins over GPS", conflict.jobId === "maple" && conflict.method === "explicit", conflict);

console.log("\nHostile / malformed input");
ok("null everything -> no crash, files nothing", attributeMessage().jobId === null);
ok("candidate without jobId is dropped", attributeMessage({ candidates: [{ clientName: "x" }, OAK], text: "" }).jobId === "oak");
ok("garbage point ignored, falls to only-one", attributeMessage({ candidates: [OAK], point: { lat: "x", lng: null }, text: "" }).jobId === "oak");
ok("(0,0) null-island point ignored", attributeMessage({ candidates: [OAK, MAPLE], point: { lat: 0, lng: 0 }, text: "" }).method === "ask");
ok("emoji-only message doesn't match by accident", attributeMessage({ candidates: [OAK, MAPLE], text: "👍🔥" }).needsConfirmation === true);

console.log("\nEvery ask carries candidates; every high-confidence carries a jobId");
const cases = [
  attributeMessage({ candidates: [OAK, MAPLE, LAVAL], text: "" }),
  attributeMessage({ candidates: [OAK], text: "" }),
  attributeMessage({ candidates: [OAK, MAPLE], text: "Shah" }),
];
ok("ask => has candidates to show", cases.every((r) => !r.needsConfirmation || r.candidates.length > 0));
ok("high => has a jobId", cases.every((r) => r.confidence !== "high" || r.jobId));
ok("never both a jobId AND needsConfirmation", cases.every((r) => !(r.jobId && r.needsConfirmation)));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
