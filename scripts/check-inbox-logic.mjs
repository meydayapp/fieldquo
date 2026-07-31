// Executes lib/crew/inboxLogic.js — the file-vs-ask-vs-resolve decision.
import { parseSelection, decideAction } from "@/lib/crew/inboxLogic";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

const OAK = { jobId: "oak", jobTitle: "Repaint", clientName: "Sam Rivera", address: "123 Oak St", lat: 45.5019, lng: -73.5674 };
const MAPLE = { jobId: "maple", jobTitle: "Deck", clientName: "Priya Shah", address: "45 Maple Ave", lat: 45.4581, lng: -73.6392 };
const LAVAL = { jobId: "laval", jobTitle: "Fence", clientName: "Chris Bond", address: "9 Principale", lat: 45.6066, lng: -73.7124 };

console.log("\nparseSelection");
ok('"2" picks the second', parseSelection("2", [OAK, MAPLE, LAVAL])?.jobId === "maple");
ok('"#1" picks the first', parseSelection("#1", [OAK, MAPLE])?.jobId === "oak");
ok('out-of-range number -> null', parseSelection("9", [OAK, MAPLE]) === null);
ok('"0" -> null', parseSelection("0", [OAK, MAPLE]) === null);
ok('a surname picks it', parseSelection("the Shah one", [OAK, MAPLE, LAVAL])?.jobId === "maple");
ok('vague reply -> null (no guess)', parseSelection("that one", [OAK, MAPLE]) === null);
ok('empty -> null', parseSelection("", [OAK, MAPLE]) === null);
ok('no candidates -> null', parseSelection("2", []) === null);
ok('a name matching two -> null (not a pick)', parseSelection("Johnson", [
  { jobId: "a", clientName: "Johnson", jobTitle: "K", address: "1 St" },
  { jobId: "b", clientName: "Johnson", jobTitle: "B", address: "2 Ave" },
]) === null);

console.log("\nFresh message, one job -> files");
const one = decideAction({ inbound: { text: "framing done", hasMedia: true, mediaCount: 2 }, candidates: [OAK] });
ok("files", one.action === "file" && one.jobId === "oak");
ok("carries the media count in the payload", one.payload.mediaCount === 2);
ok("not marked as a resolved ask", one.resolvedAsk === false);

console.log("\nFresh message, 3 jobs, bare photo -> asks");
const ask = decideAction({ inbound: { hasMedia: true, mediaCount: 1 }, candidates: [OAK, MAPLE, LAVAL] });
ok("asks", ask.action === "ask");
ok("offers all three", ask.candidates.length === 3);
ok("holds the photo as payload", ask.payload.mediaCount === 1);

console.log("\nThe reply resolves the question — and files the ORIGINAL photo");
const pending = { candidates: [OAK, MAPLE, LAVAL], payload: { text: "", mediaCount: 1, point: null } };
const resolved = decideAction({ inbound: { text: "2", hasMedia: false }, pending, candidates: [OAK, MAPLE, LAVAL] });
ok("files on a valid selection", resolved.action === "file" && resolved.jobId === "maple");
ok("method is 'answered'", resolved.method === "answered");
ok("files the HELD photo, not the '2'", resolved.payload.mediaCount === 1 && resolved.resolvedAsk === true);

console.log("\nA reply we can't map -> re-ask, don't guess, don't drop the photo");
const reask = decideAction({ inbound: { text: "huh?", hasMedia: false }, pending, candidates: [OAK, MAPLE, LAVAL] });
ok("re-asks", reask.action === "reask");
ok("keeps the same options", reask.candidates.length === 3);
ok("still holding the photo", reask.payload.mediaCount === 1);

console.log("\nAn empty reply while pending -> ignore (nothing to act on)");
ok("empty text, pending -> ignore", decideAction({ inbound: { text: "", hasMedia: false }, pending, candidates: [] }).action === "ignore");

console.log("\nNew media WHILE a question is open -> handle the new one, abandon the stale ask");
const superseded = decideAction({
  inbound: { hasMedia: true, mediaCount: 1 },
  pending,
  candidates: [OAK], // now only one job -> the new photo files cleanly
});
ok("the new photo is handled fresh, not treated as an answer", superseded.action === "file" && superseded.jobId === "oak");
ok("it files the NEW photo, not the held one", superseded.resolvedAsk === false);

console.log("\nExplicit name in a fresh message beats the ask");
const named = decideAction({ inbound: { text: "gutters at the Shah place", hasMedia: true, mediaCount: 1 }, candidates: [OAK, MAPLE, LAVAL] });
ok("files to Maple by name", named.action === "file" && named.jobId === "maple" && named.method === "explicit");

console.log("\nNothing scheduled -> ignore, not ask");
ok("no candidates -> ignore", decideAction({ inbound: { hasMedia: true, mediaCount: 1 }, candidates: [] }).action === "ignore");

console.log("\nGarbage / empty inbound");
ok("no media, no text, no pending -> ignore", decideAction({ inbound: {}, candidates: [OAK] }).action === "ignore");
ok("undefined args -> ignore, no crash", decideAction().action === "ignore");

console.log("\nInvariants across a sweep");
const sweep = [
  decideAction({ inbound: { hasMedia: true }, candidates: [OAK] }),
  decideAction({ inbound: { hasMedia: true }, candidates: [OAK, MAPLE] }),
  decideAction({ inbound: { text: "2", hasMedia: false }, pending, candidates: [OAK, MAPLE, LAVAL] }),
  decideAction({ inbound: {}, candidates: [] }),
];
ok("file always has a jobId", sweep.every((r) => r.action !== "file" || r.jobId));
ok("ask/reask always has candidates", sweep.every((r) => !["ask", "reask"].includes(r.action) || r.candidates.length > 0));
ok("never file and ask at once", sweep.every((r) => !(r.action === "file" && r.candidates)));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
