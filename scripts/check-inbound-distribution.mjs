// scripts/check-inbound-distribution.mjs
//
//   npm run check:inbound-distribution
//
// A contractor rings the number a rep called them from. Who picks up?
//
// ══ What this was built after ═════════════════════════════════════════════
//
// Nothing picked up. `inboundPlan` could forward a call to exactly one
// destination — FIELDQUO_SALES_TRANSFER_TO, an environment variable — so with
// it unset a callback was answered, told there was nobody free, and hung up on
// after eleven seconds. The rep who had rung that contractor was signed in at
// the time, with a registered Twilio Device and an available presence row.
//
// The owner tested it with his own phone and said he had handed over two
// contact-centre codebases and got back the outbound half. He was right:
// inbound distribution is the core of both references and it did not exist.
//
// ══ Executed, every branch ════════════════════════════════════════════════
//
// ringPlan is pure over rows the caller has already read, which is the whole
// reason it is shaped that way — every case below runs the real function.
// Section 4 renders actual TwiML through Twilio's own library, because the
// ordering guarantee is only true if it survives into the XML.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// The staleness window, the owner-first rule and the target cap were each
// broken on disk in turn, confirmed to fail here, and restored from a `cp`
// backup — never `git checkout`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import twilio from "twilio";

import {
  ringPlan,
  reachable,
  noAnswerSay,
  RING_SECONDS,
  MAX_RING_TARGETS,
} from "@/lib/sales/calls/inboundDistribution";
import { PRESENCE_STALE_MINUTES } from "@/lib/sales/calls/agentState";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`); }
}
const section = (t) => console.log(`\n${t}\n`);

const NOW = new Date("2026-09-10T12:00:00Z");
const fresh = (id, mins = 0) => ({ salesRepId: id, state: "available", lastSeenAt: new Date(NOW - mins * 60000) });

// ═══════════════════════════════════════════════════════════════════════════
section("1. Presence is a claim, and a stale claim is not one");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("a fresh available rep is reachable", reachable(fresh("r1"), NOW));
  ok(`…${PRESENCE_STALE_MINUTES - 1} minutes idle still is`, reachable(fresh("r1", PRESENCE_STALE_MINUTES - 1), NOW));
  // The one that matters: a rep marked available whose browser died would eat
  // twenty seconds of a contractor's patience and then report "no answer",
  // and the fallback that should have caught it never runs.
  ok(`…${PRESENCE_STALE_MINUTES + 1} minutes is stale`, !reachable(fresh("r1", PRESENCE_STALE_MINUTES + 1), NOW));
  ok("on_call is not available", !reachable({ salesRepId: "r1", state: "on_call", lastSeenAt: NOW }, NOW));
  ok("paused is not available", !reachable({ salesRepId: "r1", state: "paused", lastSeenAt: NOW }, NOW));
  ok("never seen is not available", !reachable({ salesRepId: "r1", state: "available", lastSeenAt: null }, NOW));
  ok("an unreadable timestamp is not available", !reachable({ salesRepId: "r1", state: "available", lastSeenAt: "soon" }, NOW));
  ok("an empty row is not available", !reachable({}, NOW));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The order, which is the whole design");
// ═══════════════════════════════════════════════════════════════════════════

{
  const assigned = ringPlan({ assignedRepId: "daniel", presence: [fresh("daniel"), fresh("other")], now: NOW });
  ok("the number's owner is rung first", assigned.targets[0]?.salesRepId === "daniel", assigned.targets);
  ok("…as a browser client, not a phone", assigned.targets[0]?.kind === "client");
  ok("…using the identity the Device registered with", assigned.targets[0]?.value === "sales_rep:daniel");

  // Rung whatever presence says: their browser decides whether to show a
  // second call, and "the person you were speaking to is ringing back" is
  // worth interrupting for.
  const busy = ringPlan({ assignedRepId: "daniel", presence: [{ salesRepId: "daniel", state: "on_call", lastSeenAt: NOW }], now: NOW });
  ok("the owner is rung even mid-call", busy.targets[0]?.salesRepId === "daniel", busy.targets);

  const callback = ringPlan({ presence: [fresh("a"), fresh("b")], lastCalledBy: "b", now: NOW });
  ok("on a shared line, whoever rang this contractor last is preferred", callback.targets[0]?.salesRepId === "b", callback.targets.map((x) => x.salesRepId));

  // Longest idle first, so one rep does not take every call.
  const shared = ringPlan({ presence: [fresh("a", 2), fresh("b", 9)], now: NOW });
  ok("otherwise the longest-idle rep goes first", shared.targets[0]?.salesRepId === "b", shared.targets.map((x) => x.salesRepId));

  const staleOnly = ringPlan({ presence: [fresh("a", 60)], transferTo: "+15551234567", now: NOW });
  ok("a stale rep is skipped rather than rung", !staleOnly.targets.some((x) => x.salesRepId === "a"), staleOnly.targets);
  ok("…and the transfer number catches the call", staleOnly.targets[0]?.kind === "number");
  ok("the transfer number is always last", ringPlan({ presence: [fresh("a")], transferTo: "+15551234567", now: NOW }).targets.at(-1).kind === "number");
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Bounds, and the shapes of nothing");
// ═══════════════════════════════════════════════════════════════════════════

{
  const many = ringPlan({ presence: [fresh("a", 1), fresh("b", 2), fresh("c", 3), fresh("d", 4)], transferTo: "+15551234567", now: NOW });
  ok(`never more than ${MAX_RING_TARGETS} targets`, many.targets.length === MAX_RING_TARGETS, many.targets.length);
  ok("no rep is rung twice", new Set(many.targets.map((x) => x.salesRepId)).size === many.targets.length);
  ok("the owner is not duplicated by the available sweep", ringPlan({ assignedRepId: "a", presence: [fresh("a")], now: NOW }).targets.length === 1);

  // Two different kinds of nothing, because they have different fixes.
  ok("nobody free and no transfer number gives no targets", ringPlan({ presence: [fresh("a", 60)], now: NOW }).targets.length === 0);
  ok("…and says the reps are there but not free", ringPlan({ presence: [fresh("a", 60)], now: NOW }).reason === "nobody_free");
  ok("no reps at all reads differently", ringPlan({ now: NOW }).reason === "nobody_signed_in");
  ok("ring time is bounded", RING_SECONDS > 5 && RING_SECONDS <= 30, RING_SECONDS);
  ok("a bad rep id produces no target rather than a mangled identity", ringPlan({ assignedRepId: "not a cuid!", now: NOW }).targets.length === 0);

  ok("the no-answer line names the rep when we know them", noAnswerSay({ repName: "Daniel" }).includes("Daniel"));
  ok("…and never prints undefined", !noAnswerSay({}).includes("undefined"));
  ok("…and always offers a way to leave a message", /leave your name/i.test(noAnswerSay({})));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. It survives into the TwiML, which is the only thing Twilio reads");
// ═══════════════════════════════════════════════════════════════════════════

{
  const plan = ringPlan({ assignedRepId: "daniel", presence: [fresh("daniel"), fresh("other", 5)], transferTo: "+15551234567", now: NOW });
  const twiml = new twilio.twiml.VoiceResponse();
  const dial = twiml.dial({ callerId: "+16135550142", timeout: plan.ringSeconds, answerOnBridge: true });
  for (const target of plan.targets) {
    if (target.kind === "client") dial.client(target.value);
    else dial.number(target.value);
  }
  const xml = twiml.toString();

  // ONE <Dial> with several children, not several <Dial>s. Twilio rings the
  // children in sequence and the first to answer wins; a second <Dial> verb
  // only runs after the first gives up entirely, which is a different and much
  // slower behaviour.
  ok("one Dial verb, not several", (xml.match(/<Dial/g) || []).length === 1, xml);
  ok("the owner is the first child", xml.indexOf("sales_rep:daniel") < xml.indexOf("sales_rep:other"), xml);
  ok("the phone number comes after every client", xml.lastIndexOf("+15551234567") > xml.lastIndexOf("sales_rep:"), xml);
  ok("the ring timeout is on the Dial", new RegExp(`timeout="${plan.ringSeconds}"`).test(xml), xml);
  // answerOnBridge, so the caller hears ringing rather than silence and is not
  // billed for the leg before somebody picks up.
  ok("answerOnBridge is set", /answerOnBridge="true"/.test(xml), xml);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The route uses it, and never dials into an empty plan");
// ═══════════════════════════════════════════════════════════════════════════

{
  const route = read("app/api/rep-dial/inbound/route.js");
  ok("the inbound route builds a ring plan", /ringPlan\(\{/.test(route));
  ok("…from the number's own assignment", /assignedRepId: numberRung\.assignedRepId/.test(route));
  ok("…and from live presence", /presence,/.test(route));
  // The bug this prevents: an empty <Dial> rings for twenty seconds and hangs
  // up without a word.
  ok("a connect decision with nobody to ring falls through to speech", /ring\.targets\.length === 0/.test(route));
  ok("…and that speech offers a voicemail", /noAnswerSay\(/.test(route) && /record: plan\.action === INBOUND_CONNECT/.test(route));
  ok("every target is dialled, in order", /for \(const target of ring\.targets\)/.test(route));
  ok("a client target uses dial.client", /dial\.client\(target\.value\)/.test(route));

  const store = read("lib/sales/calls/store.js");
  ok(
    "the number lookup selects its assignment, or the owner is never found",
    /assignedRepId: true/.test(store.slice(store.indexOf("export async function salesVoiceNumber"), store.indexOf("export async function salesCallerNumbers"))),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:inbound-distribution is a script", typeof pkg.scripts?.["check:inbound-distribution"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:inbound-distribution"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
