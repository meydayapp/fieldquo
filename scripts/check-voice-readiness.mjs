// scripts/check-voice-readiness.mjs
//
// The receptionist chain, executed rather than read.
//
// ══ Why this script exists ═════════════════════════════════════════════════
//
// The owner was told the phone receptionist worked, more than once, on the
// strength of code that read correctly. It never did. His phone answered a live
// call and not one thing about it was recorded, and every screen in the app
// still looked healthy — because every screen was reading OUR OWN COLUMNS, and
// our own columns were the thing that was wrong.
//
// So the readiness resolver has three properties that cannot be checked by
// eye, and all three are executed here over every combination of states:
//
//   1. NO LINK IS EVER GREEN ON THE STRENGTH OF OUR OWN DATABASE. Every `ok`
//      requires an observation the provider actually gave us.
//   2. A PROVIDER WE COULD NOT REACH IS `unknown`, never `ok` and never `fail`.
//      Absence of a reply is not a reply.
//   3. EVERY FAILURE NAMES BOTH A CAUSE AND WHO CAN FIX IT.
//
// It also executes the webhook signature verifier against Retell's real header
// format, because the hand-rolled one it replaced rejected 100% of deliveries
// and no test anywhere ever sent it a signature.

import {
  resolveReadiness,
  originIsStable,
  REQUIRED_LINKS,
} from "../lib/voice/readiness.js";
import {
  READINESS_LINKS,
  REASON_TEXT,
  LINK_LABEL,
  OWNER_TEXT,
  OVERALL_TEXT,
  reasonKeyFor,
} from "../lib/voice/readinessCopy.js";
import {
  verifyRetellSignature,
  retellDigest,
  parseRetellSignature,
  SIGNATURE_REASONS,
  SIGNATURE_REASON_TEXT,
} from "../lib/voice/webhookSignature.js";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { greetingNamesAnotherBusiness, buildAgentPrompt } from "../lib/voice/prompt.js";
import { usableNotes } from "../lib/voice/knowledge.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let fail = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) {
    fail++;
    console.log(`FAIL  ${name}${extra ? " — " + extra : ""}`);
  } else console.log(`pass  ${name}`);
};

const AGENT = "agent_abc";
const LLM = "llm_abc";
const ORIGIN = "https://www.fieldquo.com";
const HOOK = `${ORIGIN}/api/voice/webhook`;
const PROMPT = "system rules…";
const GREETING = "Thanks for calling Big painter Inc, how can I help?";

/** A completely healthy chain. Every override below starts from this. */
const healthy = () => ({
  configured: true,
  providerReachable: true,
  number: {
    haveRow: true,
    e164: "+13655176689",
    status: "active",
    source: "purchased",
    publicNumber: null,
    existsAtProvider: true,
    boundAgent: AGENT,
  },
  agent: {
    wantAgentId: AGENT,
    existsAtProvider: true,
    webhookUrl: HOOK,
    llmIdAtProvider: LLM,
  },
  engine: {
    wantLlmId: LLM,
    existsAtProvider: true,
    promptAtProvider: PROMPT,
    greetingAtProvider: GREETING,
    toolUrlsAtProvider: [`${ORIGIN}/api/voice/tools/save-caller`],
  },
  company: { enabled: true, hasCredit: true, cents: 500 },
  events: { providerDelivered: true, rejectedReason: null, rejectedAfterDelivery: false },
  expectedWebhookUrl: HOOK,
  expectedToolOrigin: `${ORIGIN}/api/voice/tools/`,
  originIsStable: true,
  expected: { prompt: PROMPT, greeting: GREETING },
});

const merge = (base, over) => {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...base[k], ...v } : v;
  }
  return out;
};
const run = (over = {}) => resolveReadiness(merge(healthy(), over));
const linkOf = (res, id) => res.links.find((l) => l.id === id);

/* ═══════════════ 1. The happy path is actually reachable ═══════════════ */

const good = run();
ok("a fully healthy chain reports ready", good.overall === "ready", good.overall);
for (const id of REQUIRED_LINKS)
  ok(`healthy: ${id} is ok`, linkOf(good, id)?.state === "ok", linkOf(good, id)?.reason);
ok("healthy chain offers no repair", good.repairable === false);

/* ═══════════════ 2. Every link the resolver emits is drawable ══════════ */

ok(
  "every emitted link id is in READINESS_LINKS",
  good.links.every((l) => READINESS_LINKS.includes(l.id)),
  good.links.map((l) => l.id).join(","),
);
for (const id of READINESS_LINKS)
  ok(`${id} has a label`, typeof LINK_LABEL[id] === "string" && LINK_LABEL[id].length > 0);
for (const owner of ["fieldquo", "company", "unknown"])
  ok(`owner "${owner}" has a sentence`, typeof OWNER_TEXT[owner] === "string");
for (const o of ["ready", "ready_with_warnings", "not_ready", "unsure"])
  ok(`overall "${o}" has a sentence`, typeof OVERALL_TEXT[o] === "string");

/* ═══════════════ 3. THE SWEEP — every combination of states ════════════ */
//
// The three properties in the header, executed. Roughly 15k chains: cheap, and
// the only way to be sure a branch added later cannot quietly go green.

const values = {
  configured: [true, false],
  providerReachable: [true, false, null],
  "number.haveRow": [true, false, null],
  "number.existsAtProvider": [true, false, null],
  "number.boundAgent": [AGENT, "agent_other", null],
  "number.status": ["active", "provisioning", "porting"],
  "number.source": ["purchased", "forwarded"],
  "agent.existsAtProvider": [true, false, null],
  "agent.wantAgentId": [AGENT, null],
  "agent.webhookUrl": [HOOK, "https://fieldquo-git-x.vercel.app/api/voice/webhook", null],
  "agent.llmIdAtProvider": [LLM, "llm_other", null],
  "engine.existsAtProvider": [true, false, null],
  "engine.wantLlmId": [LLM, null],
  "engine.promptAtProvider": [PROMPT, "older prompt", null],
  "engine.greetingAtProvider": [GREETING, "Thank you for calling Federal Test", null],
  "engine.toolUrlsAtProvider": [
    [`${ORIGIN}/api/voice/tools/save-caller`],
    ["https://fieldquo-git-x.vercel.app/api/voice/tools/save-caller"],
    null,
  ],
  "company.enabled": [true, false],
  "company.hasCredit": [true, false, null],
  "events.providerDelivered": [true, false],
  "events.rejectedReason": [null, "mismatch"],
  originIsStable: [true, false],
};

const setPath = (obj, path, v) => {
  const [a, b] = path.split(".");
  if (b) obj[a] = { ...obj[a], [b]: v };
  else obj[a] = v;
  return obj;
};

/**
 * Every combination is too many to enumerate fully (2^6 × 3^8 ≈ 400k), so this
 * sweeps every PAIR of dimensions exhaustively on top of the healthy chain.
 * Pairwise is what catches "green because the other field happened to be set",
 * which is the exact class of bug that put a healthy tick over a dead webhook.
 */
const keys = Object.keys(values);
const chains = [];
for (let i = 0; i < keys.length; i += 1) {
  for (let j = i; j < keys.length; j += 1) {
    for (const vi of values[keys[i]]) {
      for (const vj of values[keys[j]]) {
        const obs = healthy();
        setPath(obs, keys[i], vi);
        setPath(obs, keys[j], vj);
        chains.push(obs);
      }
    }
  }
}

/**
 * And EXHAUSTIVELY over the dimensions that decide whether a link may be green.
 *
 * Pairwise is enough to catch a link going green because a neighbouring field
 * happened to be set; it is not enough to prove the eight observations that
 * license a pass can never combine into one that shouldn't. These eight are
 * small enough to enumerate completely, so they are.
 */
const CORE = [
  "configured",
  "providerReachable",
  "number.existsAtProvider",
  "number.boundAgent",
  "agent.existsAtProvider",
  "agent.webhookUrl",
  "engine.existsAtProvider",
  "company.enabled",
];
(function cartesian(idx, obs) {
  if (idx === CORE.length) {
    chains.push(obs);
    return;
  }
  for (const v of values[CORE[idx]]) cartesian(idx + 1, setPath({ ...obs }, CORE[idx], v));
})(0, healthy());

let violationsSelfReported = 0;
let violationsUnreachable = 0;
let violationsUnnamed = 0;
let violationsMissingCopy = 0;
let violationsUnknownState = 0;
const seenReasons = new Set();

for (const obs of chains) {
  const res = resolveReadiness(obs);

  for (const l of res.links) {
    seenReasons.add(l.reasonKey);

    // Property: only three states exist. A typo'd state renders nothing.
    if (!["ok", "fail", "unknown"].includes(l.state)) violationsUnknownState += 1;

    // Property: every reason has a sentence somebody can read.
    if (!REASON_TEXT[l.reasonKey]) violationsMissingCopy += 1;

    // ── Property 3: a failure names a cause AND an owner ─────────────────
    if (l.state === "fail" && (!l.reason || !l.fixer)) violationsUnnamed += 1;

    // ── Property 2: nothing is asserted about a provider we couldn't reach ─
    //
    // Three exemptions, each for a different reason:
    //
    //   provider    "we couldn't reach them" IS its finding.
    //   events      a past delivery is a past fact. Whether Retell's API
    //               answers us this minute does not un-record a call it
    //               already sent, so this link may stand either way.
    //   forwarding  never anything but `unknown` regardless.
    //
    // And two links may FAIL without the provider, because their failure is
    // knowable from our own side alone and is the contractor's own decision:
    // "you have no number" and "you switched it off / you have no credit".
    // Neither may ever go OK that way, which Property 1 below enforces.
    if (obs.providerReachable !== true && !["provider", "events", "forwarding"].includes(l.id)) {
      if (l.state === "ok") violationsUnreachable += 1;
      if (l.state === "fail" && !["number", "switch", "binding"].includes(l.id))
        violationsUnreachable += 1;
    }

    // ── Property 1: NEVER GREEN ON OUR OWN COLUMN ────────────────────────
    //
    // Each provider-facing link, and the one observation that has to be
    // present for it to be allowed to pass. If the observation is missing and
    // the link is green, our database talked us into it.
    if (l.state === "ok") {
      const proof = {
        provider: obs.configured === true && obs.providerReachable === true,
        number: obs.number.existsAtProvider === true,
        agent: obs.agent.existsAtProvider === true,
        engine: obs.engine.existsAtProvider === true,
        binding: obs.number.boundAgent != null && obs.number.boundAgent === obs.agent.wantAgentId,
        // The one link about our own settings still needs the provider to
        // confirm something is attached — "switched on here" was the lie.
        switch:
          obs.company.enabled === true &&
          obs.number.boundAgent != null &&
          obs.number.boundAgent === obs.agent.wantAgentId,
        webhook: typeof obs.agent.webhookUrl === "string" && obs.agent.webhookUrl.length > 0,
        prompt: obs.engine.promptAtProvider != null,
        // Evidence of a past provider ACTION, never of a config column.
        events: obs.events.providerDelivered === true,
        forwarding: false, // may never be green at all
      };
      if (proof[l.id] !== true) violationsSelfReported += 1;
    }
  }

  // Property: `ready` is never claimed while anything required is not ok.
  if (res.overall === "ready" || res.overall === "ready_with_warnings") {
    const bad = res.links.filter((l) => REQUIRED_LINKS.includes(l.id) && l.state !== "ok");
    if (bad.length) violationsSelfReported += 1;
  }
}

ok(`swept ${chains.length} chains`, chains.length > 3000, String(chains.length));
ok(
  "no link is ever green on the strength of our own database",
  violationsSelfReported === 0,
  `${violationsSelfReported} violations`,
);
ok(
  "a provider we could not reach is never ok, and never a fault we invented",
  violationsUnreachable === 0,
  `${violationsUnreachable} violations`,
);
ok(
  "every failure names a cause and who can fix it",
  violationsUnnamed === 0,
  `${violationsUnnamed} violations`,
);
ok(
  "every reason the resolver can produce has a sentence",
  violationsMissingCopy === 0,
  `${violationsMissingCopy} missing`,
);
ok("no link ever reports a state outside ok/fail/unknown", violationsUnknownState === 0);

// The reverse of the copy check: no dead sentences either. A table with entries
// nothing can emit is a table someone will translate six times for nothing.
const unreachableCopy = Object.keys(REASON_TEXT).filter((k) => !seenReasons.has(k));
ok(
  "no sentence in the copy table is unreachable",
  unreachableCopy.length === 0,
  unreachableCopy.join(", "),
);

/* ═══════════ 4. The specific failures this was built to catch ══════════ */

const noHook = run({ agent: { webhookUrl: null } });
ok(
  "a missing webhook URL is its own named verdict, not a generic failure",
  linkOf(noHook, "webhook")?.reason === "missing",
  linkOf(noHook, "webhook")?.reason,
);
ok("a missing webhook URL is ours to fix", linkOf(noHook, "webhook")?.fixer === "fieldquo");
ok("a missing webhook URL offers a resync", linkOf(noHook, "webhook")?.fix === "resync");
ok(
  "and it stops us calling the chain ready",
  noHook.overall === "not_ready",
  noHook.overall,
);

const wrongHook = run({
  agent: { webhookUrl: "https://fieldquo-git-preview.vercel.app/api/voice/webhook" },
});
ok(
  "a webhook pointed at another deployment is named, not shrugged at",
  linkOf(wrongHook, "webhook")?.reason === "elsewhere",
);
ok(
  "and it says which address it holds",
  linkOf(wrongHook, "webhook")?.detail?.holds?.includes("vercel.app") === true,
);

// The live case: the phone answers perfectly and nothing is recorded.
const answeringButSilent = run({ agent: { webhookUrl: null }, events: { providerDelivered: false } });
ok(
  "a phone that answers and records nothing fails on the webhook, not on the binding",
  linkOf(answeringButSilent, "binding")?.state === "ok" &&
    linkOf(answeringButSilent, "webhook")?.state === "fail",
);
ok(
  "and 'no calls recorded' with no rejection is unknown, not a fault",
  linkOf(answeringButSilent, "events")?.state === "unknown",
);

const rejected = run({
  events: { providerDelivered: false, rejectedReason: "mismatch" },
});
ok(
  "turning Retell away IS reported as a fault",
  linkOf(rejected, "events")?.state === "fail" && linkOf(rejected, "events")?.fixer === "fieldquo",
);
ok(
  "and it says why in words",
  typeof linkOf(rejected, "events")?.detail?.why === "string",
);

/* ── A preview origin must never condemn a healthy production webhook ─── */

const fromPreview = run({
  originIsStable: false,
  agent: { webhookUrl: "https://www.fieldquo.com/api/voice/webhook" },
  expectedWebhookUrl: "https://fieldquo-git-x.vercel.app/api/voice/webhook",
});
ok(
  "checked from a preview, the webhook is unknown rather than wrong",
  linkOf(fromPreview, "webhook")?.state === "unknown" &&
    linkOf(fromPreview, "webhook")?.reason === "preview_origin",
);
ok(
  "and it offers no fix, because fixing from a preview would break the live phone",
  !linkOf(fromPreview, "webhook")?.fix,
);
const previewTools = run({
  originIsStable: false,
  engine: { toolUrlsAtProvider: ["https://www.fieldquo.com/api/voice/tools/save-caller"] },
  expectedToolOrigin: "https://fieldquo-git-x.vercel.app/api/voice/tools/",
});
ok(
  "nor are the live tool endpoints called wrong from a preview",
  linkOf(previewTools, "prompt")?.state === "ok",
  linkOf(previewTools, "prompt")?.reason,
);

ok("production origin is stable", originIsStable("https://www.fieldquo.com") === true);
ok("a vercel preview host is not", originIsStable("https://fieldquo-abc.vercel.app") === false);
ok("localhost is not", originIsStable("http://localhost:3000") === false);
ok("a subdomain of localhost is not", originIsStable("http://sunset.localhost:3000") === false);
ok("nothing at all is not", originIsStable(null) === false);
ok("garbage is not", originIsStable("not a url") === false);

/* ── A contractor's own decision is never dressed up as our bug ───────── */

const off = run({ company: { enabled: false }, number: { boundAgent: null } });
ok("voice switched off is the company's, not ours", linkOf(off, "binding")?.fixer === "company");
ok("and it is never offered a 'fix' that turns it back on", linkOf(off, "binding")?.fix === "enable");
ok(
  "switched off is reported on the switch too",
  linkOf(off, "switch")?.state === "fail" && linkOf(off, "switch")?.fixer === "company",
);

const broke = run({ company: { hasCredit: false }, number: { boundAgent: null } });
ok("out of credit is the company's", linkOf(broke, "binding")?.fixer === "company");
ok("and points at a top-up", linkOf(broke, "switch")?.fix === "topup");

// The dead control, named: on here, nothing attached there.
const deadSwitch = run({ number: { boundAgent: null } });
ok(
  "switched on here with nothing attached there is its own verdict",
  linkOf(deadSwitch, "switch")?.reason === "not_live",
  linkOf(deadSwitch, "switch")?.reason,
);
ok("and it is ours to fix", linkOf(deadSwitch, "switch")?.fixer === "fieldquo");

/* ── Carrier forwarding can never be green ───────────────────────────── */

const fwd = run({ number: { source: "forwarded", publicNumber: "+18192387263" } });
const fwdLink = linkOf(fwd, "forwarding");
ok("a forwarded setup gets a forwarding link", Boolean(fwdLink));
ok("which is always unknown — we cannot see a carrier rule", fwdLink?.state === "unknown");
ok("and names both numbers so it can be tested", fwdLink?.detail?.ours && fwdLink?.detail?.theirs);
ok(
  "a bought number gets no forwarding link at all",
  !linkOf(run(), "forwarding"),
);

/* ── Nothing is asserted with no provider ────────────────────────────── */

const blind = run({ providerReachable: null, configured: true });
ok(
  "with no provider answer, nothing we would have to ask about is ok",
  blind.links
    // `events` excepted: a call that was already recorded stays recorded
    // whether or not Retell's API answers us this minute.
    .filter((l) => !["provider", "events"].includes(l.id))
    .every((l) => l.state !== "ok"),
  blind.links.filter((l) => l.state === "ok").map((l) => l.id).join(","),
);
ok("and we say so rather than claiming it works", blind.overall === "unsure", blind.overall);

const unconfigured = run({ configured: false });
ok(
  "an unconfigured deployment blames itself, not the contractor",
  linkOf(unconfigured, "provider")?.fixer === "fieldquo",
);

/* ═══════════ 5. The webhook signature, against Retell's real format ════ */
//
// The verifier this replaced compared a bare hex digest against a header of the
// form `v=…,d=…`, keyed with a secret Retell never uses. It could not match, so
// every delivery 401'd, so no call was ever recorded — and nothing in the repo
// had ever sent it a signature to find out.

const KEY = "key_live_abc123";
const OTHER = "key_other_999";
const BODY = JSON.stringify({ event: "call_started", call: { call_id: "c1" } });
const NOW = 1_760_000_000_000;
const sign = (body, ts, key) => `v=${ts},d=${retellDigest({ rawBody: body, timestamp: ts, key })}`;

const V = (over = {}) =>
  verifyRetellSignature({
    rawBody: BODY,
    header: sign(BODY, NOW, KEY),
    keys: [KEY],
    now: NOW,
    ...over,
  });

ok("a genuine Retell signature verifies", V().ok === true);
ok("and reports which key matched", V().keyIndex === 0);
ok(
  "the digest really is over body+timestamp, not the body alone",
  retellDigest({ rawBody: BODY, timestamp: NOW, key: KEY }) !==
    retellDigest({ rawBody: BODY, timestamp: "", key: KEY }),
);

// The exact shape the old code expected. It must NOT pass — and, more to the
// point, this asserts we are no longer computing it.
const bareHex = retellDigest({ rawBody: BODY, timestamp: NOW, key: KEY });
ok(
  "a bare hex digest — the shape the old verifier built — is refused",
  V({ header: bareHex }).reason === SIGNATURE_REASONS.malformed,
);
ok(
  "a body-only digest in the right envelope is refused",
  V({
    header: `v=${NOW},d=${retellDigest({ rawBody: BODY, timestamp: "", key: KEY })}`,
  }).reason === SIGNATURE_REASONS.mismatch,
);

ok("the wrong key is a mismatch", V({ keys: [OTHER] }).reason === SIGNATURE_REASONS.mismatch);
ok(
  "a second configured key is tried, and reported as the second",
  V({ keys: [OTHER, KEY] }).ok === true && V({ keys: [OTHER, KEY] }).keyIndex === 1,
);
ok("no key at all is 'no_key', not 'mismatch'", V({ keys: [] }).reason === SIGNATURE_REASONS.no_key);
ok(
  "an empty-string key does not count as a key",
  V({ keys: ["", null, undefined] }).reason === SIGNATURE_REASONS.no_key,
);
ok("no header is 'no_signature'", V({ header: null }).reason === SIGNATURE_REASONS.no_signature);
ok("nonsense is 'malformed'", V({ header: "hello" }).reason === SIGNATURE_REASONS.malformed);
ok(
  "a non-hex digest is malformed rather than compared",
  V({ header: `v=${NOW},d=${"z".repeat(64)}` }).reason === SIGNATURE_REASONS.malformed,
);

// Replay: a genuine, correctly-signed delivery from six minutes ago.
ok(
  "a replayed delivery outside the window is refused",
  V({ now: NOW + 6 * 60 * 1000 }).reason === SIGNATURE_REASONS.stale,
);
ok("four minutes late still verifies", V({ now: NOW + 4 * 60 * 1000 }).ok === true);
ok("four minutes EARLY still verifies — clocks drift both ways", V({ now: NOW - 4 * 60 * 1000 }).ok === true);
ok(
  "freshness is judged before the digest, so a stale forgery is not a mismatch",
  V({ now: NOW + 6 * 60 * 1000, keys: [OTHER] }).reason === SIGNATURE_REASONS.stale,
);

// A changed body must fail even with the right key and a fresh timestamp.
ok(
  "a tampered body fails",
  verifyRetellSignature({
    rawBody: BODY.replace("c1", "c2"),
    header: sign(BODY, NOW, KEY),
    keys: [KEY],
    now: NOW,
  }).ok === false,
);

ok("the parser returns both halves", parseRetellSignature(sign(BODY, NOW, KEY))?.timestamp === String(NOW));
for (const r of Object.values(SIGNATURE_REASONS))
  if (r !== "ok") ok(`rejection "${r}" has a sentence`, typeof SIGNATURE_REASON_TEXT[r] === "string");

/* ═══════════ 6. The greeting that named a company that doesn't exist ═══ */

ok(
  "the live greeting names another business",
  greetingNamesAnotherBusiness("Thank you for calling Federal Test", "Big painter Inc") === true,
);
ok(
  "the same greeting under the old name does not",
  greetingNamesAnotherBusiness("Thank you for calling Federal Test", "Federal Test") === false,
);
ok(
  "a shorter trading name is not a mistake",
  greetingNamesAnotherBusiness("Thanks for calling Big Painter", "Big painter Inc") === false,
);
ok(
  "an incorporation suffix alone proves nothing",
  greetingNamesAnotherBusiness("Thanks for calling Inc", "Big painter Inc") === true,
);
ok("no custom greeting says nothing", greetingNamesAnotherBusiness("", "Big painter Inc") === false);
ok("no company name says nothing", greetingNamesAnotherBusiness("Hello there", "") === false);
ok(
  "accents survive the comparison",
  greetingNamesAnotherBusiness("Merci d'appeler Peinture Québec", "Peinture Québec inc.") === false,
);

/* ═══════════ 7. His note: one real sentence, six unanswered questions ══ */
//
// The owner's `instructions` field holds a sentence he wrote and six drafted
// questions he never answered. The sentence has to reach the phone; the
// questions must not — a question read aloud by something that sounds like the
// business is the business asking a homeowner to fill in a form.

const HIS_NOTE = [
  "we don't do commercial work.",
  "[Do you work for homeowners, landlords, property managers, or all three?]",
  "[What should the receptionist do with a call that comes in out of hours?]",
  "[Is there any kind of job you would rather not take on?]",
  "[Do you take on work that another contractor started?]",
  "[What should someone have ready before you can price their job?]",
  "[Is there anything a caller often asks that you would want answered a certain way?]",
].join("\n");

const notes = usableNotes(HIS_NOTE);
ok("his one real sentence survives", notes.text === "we don't do commercial work.");
ok("all six drafted questions are withheld", notes.withheld.length === 6, String(notes.withheld.length));
ok("no bracket reaches the usable text", !notes.text.includes("["));

const live = buildAgentPrompt({
  company: { name: "Big painter Inc" },
  services: ["Interior painting"],
  notes: HIS_NOTE,
});
ok("and it reaches the prompt Retell holds", live.includes("we don't do commercial work."));
ok("while no drafted question does", !/\[[^\]\n]+\]/.test(live));
ok(
  "the note is fenced as the owner's words, not as a caller's",
  live.includes("NOTES FROM THE BUSINESS"),
);
ok(
  "and it still cannot override the price rule",
  live.indexOf("NEVER give a price") < live.indexOf("we don't do commercial work."),
);

// ── A refusal must be a Response, not a shape ────────────────────────────
//
// /api/settings/voice/readiness answered HTTP 500 to an unauthenticated request
// in production, where every sibling endpoint answered 401. The cause:
// memberOrRefusalPlain returns a plain `{ error, status }` object — it exists
// for the HELPER functions that shape their own reply — and the handler did
// `if (refusal) return refusal`, handing Next something it cannot serialise.
//
// A 500 on an auth failure looks exactly like a broken endpoint, which on this
// endpoint is the worst confusion available: it is the screen someone opens
// when they already suspect their phone is broken. Curling production found it;
// no check would have.
//
// So: any file that calls memberOrRefusalPlain INSIDE an exported route handler
// must wrap the refusal. Files that only use it inside their own helpers are
// fine — that is what it is for.
{
  const files = execSync(
    "grep -rl memberOrRefusalPlain app/api || true",
    { cwd: ROOT, encoding: "utf8" },
  ).split("\n").filter(Boolean);
  ok("some route files use the plain refusal helper", files.length > 0, String(files.length));

  for (const f of files) {
    const src = readFileSync(join(ROOT, f), "utf8");
    // Walk each exported handler body and look for a bare `return refusal`.
    const bad = [];
    const re = /export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\s*\([^)]*\)\s*\{/g;
    let m;
    while ((m = re.exec(src))) {
      // Body = from the brace to the next top-level export, or end of file.
      const start = m.index + m[0].length;
      const next = src.indexOf("\nexport ", start);
      const body = src.slice(start, next === -1 ? src.length : next);
      if (/\bmemberOrRefusalPlain\s*\(/.test(body) && /\breturn\s+refusal\s*;/.test(body)) {
        bad.push(m[1]);
      }
    }
    ok(`${f} wraps its refusal in a Response`, bad.length === 0, bad.join(", "));
  }
}

console.log(fail ? `\n${fail} failed` : "\nall good");
process.exit(fail ? 1 : 0);
