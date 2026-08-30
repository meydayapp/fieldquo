// scripts/check-webhook-repair.mjs
//
// The diagnostic that had no remedy, and the remedy that must not become the
// disease.
//
// ══ What was wrong ═════════════════════════════════════════════════════════
//
// /platform reported, correctly, that calls were "billed by the hourly
// reconciler because Retell's webhook never delivered them" — derived from
// VoiceCall.recoveredAt, honest, and completely unactionable. No button, no
// setting, no plan. Half a control: it named a fault nobody could fix.
//
// The cause was already written down one file away. lib/voice/readiness.js's
// originIsStable() says provisionAgent derives webhook_url from the origin of
// whichever request triggered it — right for a preview deployment, which must
// wire to itself — and that a save made from a preview URL or a laptop
// "silently repoints the LIVE agent at an address that stops existing."
//
// ══ Why the repair is more dangerous than the fault ════════════════════════
//
// A repair run from a preview would write THAT preview's URL onto every live
// agent: the same fault, inflicted on every tenant at once, by the tool built
// to cure it. So the refusal is the feature. Section 2 is the section that
// matters.
import {
  expectedWebhookUrl,
  webhookVerdict,
  mayRepair,
  summarise,
} from "@/lib/voice/webhookAudit";
import { originIsStable } from "@/lib/voice/readiness";
import { readFileSync } from "node:fs";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const ROUTE = stripComments(readFileSync("app/api/platform/voice-webhooks/route.js", "utf8"));

const LIVE = "https://www.fieldquo.com";
const EXPECTED = expectedWebhookUrl(LIVE);

section("1. Telling a broken agent from an unreadable one");

ok(EXPECTED === `${LIVE}/api/voice/webhook`, "the expected URL is derived, not typed", EXPECTED);
ok(webhookVerdict(EXPECTED, EXPECTED).state === "ok", "an agent pointing at us is fine");
ok(
  webhookVerdict("https://fq-git-branch.vercel.app/api/voice/webhook", EXPECTED).state === "wrong",
  "an agent left on a preview deployment is WRONG — this is the real-world case",
);
ok(webhookVerdict(null, EXPECTED).reason === "never_set", "never written is distinguishable from pointing elsewhere");
ok(webhookVerdict("", EXPECTED).state === "wrong", "an empty string is wrong, not ok");
ok(webhookVerdict(42, EXPECTED).state === "wrong", "…and so is a non-string");
// The distinction that stops a timeout from rewriting healthy agents.
ok(
  webhookVerdict(EXPECTED, null).state === "unknown",
  "with no expected URL the answer is UNKNOWN, never 'wrong' — we cannot judge what we cannot compare",
);

section("2. Repairing from a preview is REFUSED — the whole safety property");

ok(mayRepair({ originStable: true, expected: EXPECTED }).allowed === true, "the live site may repair");
const previewGate = mayRepair({ originStable: false, expected: EXPECTED });
ok(previewGate.allowed === false, "a preview deployment may NOT");
ok(previewGate.reason === "unstable_origin", "…and says why, so a greyed-out button is explainable", previewGate.reason);
ok(mayRepair({ originStable: true, expected: null }).allowed === false, "no origin, no repair");

// Cross-checked against the ONE definition of stable, rather than a second
// copy that could drift from readiness.js's.
for (const bad of [
  "https://fieldquo-git-feature-x.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]) {
  ok(originIsStable(bad) === false, `${bad} is not somewhere Retell can be left pointed`);
  ok(
    mayRepair({ originStable: originIsStable(bad), expected: expectedWebhookUrl(bad) }).allowed === false,
    `…so a repair from it is refused`,
  );
}
ok(originIsStable(LIVE) === true, "the live origin is stable");

section("3. The route enforces it, not the screen");

ok(/const gate = mayRepair\(/.test(ROUTE), "POST asks the same gate the GET reports");
ok(/status: 409/.test(ROUTE), "…and refuses with a status, not a silent no-op");
ok(/wouldHaveWritten: expected/.test(ROUTE), "…naming the URL it would have written, or the refusal is unexplainable");
// Scoped to the POST handler and to the CALL, not the import. Comparing bare
// positions in the whole file put `updateAgent`'s import line at the top, ahead
// of everything — so the assertion failed against correct code. The third time
// this exact trap has been hit in this codebase; the fix is always the same,
// measure inside the body and match the call shape.
const POST_BODY = ROUTE.slice(ROUTE.indexOf("export async function POST"));
ok(
  POST_BODY.indexOf("mayRepair(") > -1 &&
    POST_BODY.indexOf("mayRepair(") < POST_BODY.indexOf("updateAgent("),
  "the gate runs BEFORE anything is written to a live agent",
  { gate: POST_BODY.indexOf("mayRepair("), write: POST_BODY.indexOf("updateAgent(") },
);
ok(
  POST_BODY.indexOf("status: 409") < POST_BODY.indexOf("updateAgent("),
  "…and the refusal returns before it, rather than after the damage",
);

section("4. It writes only what is broken, and verifies the write");

ok(/if \(seen\.state !== "wrong"\)/.test(ROUTE), "an agent already pointing at us is left alone");
// Trusting a 200 from somebody else's service is the failure this repo has
// been bitten by twice — see numberRelease.js and syncNumberAttachment.
ok(
  /const after = await inspect\(agentId, expected\)/.test(ROUTE),
  "after writing, the agent is READ BACK — a 200 from a vendor is not evidence of a state",
);
ok(/changed: after\?\.state === "ok"/.test(ROUTE), "…and 'repaired' counts only what actually changed");

section("5. Nothing on a tenant's own data is written");

// Non-negotiable #3: the platform console views everything and edits nothing.
// What changes here is a field on FieldQuo's own provider object, pointing at
// FieldQuo's own server. Assert no tenant model is written.
for (const m of ["company.update", "quote.update", "job.update", "voiceAgent.update", "voiceCall.update"]) {
  ok(!ROUTE.includes(m), `the route never calls ${m}`);
}
ok(/db\.voiceAgent\.findMany/.test(ROUTE), "…it only READS which agents exist");

section("6. Empty is not the same as healthy");

ok(summarise([{ state: "ok" }]).healthy === true, "one good agent and nothing else is healthy");
ok(summarise([{ state: "ok" }, { state: "wrong" }]).healthy === false, "one broken agent is not");
// The trap: a run where every provider read failed must not read as a clean
// bill of health, or an outage looks like success.
ok(summarise([{ state: "unknown" }]).healthy === false, "a run where nothing could be READ is not healthy either");
ok(summarise([]).healthy === false, "and no agents at all is not a pass");
ok(summarise().total === 0, "no argument does not throw");

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
