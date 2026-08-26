// scripts/check-voice-number-repair.mjs
//
// A stuck phone number used to produce one sentence, asserted without checking:
// "already yours and already being charged for". If the number 404s at the
// provider, both halves are false — the contractor has no phone AND no bill,
// and the same sentence tells them not to buy a working one.
//
// verdictFor is pure, so the decision table is EXECUTED across every
// combination rather than reasoned about. The two properties that matter most
// are the ones a reader can't check by eye:
//
//   1. "we are being charged" is never claimed without confirming the number
//      exists at the provider
//   2. a receptionist the CONTRACTOR switched off is never "repaired" back on

import { readFileSync } from "node:fs";
import { verdictFor, NUMBER_VERDICTS, statusNeedsCorrection } from "../lib/voice/diagnose.js";

let fail = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fail++; console.log(`FAIL  ${name}${extra ? " — " + extra : ""}`); }
  else console.log(`pass  ${name}`);
};

const AGENT = "agent_abc";
const base = {
  status: "provisioning",
  existsAtProvider: true,
  boundAgent: AGENT,
  wantAgent: AGENT,
  agentEnabled: true,
  hasCredit: true,
};
const v = (over) => verdictFor({ ...base, ...over });

// ── The four repairable faults ────────────────────────────────────────────
ok("no number at the provider is a ghost", v({ existsAtProvider: false }) === "ghost");
ok("no agent was ever created", v({ wantAgent: null }) === "no_agent");
ok("the attach never took", v({ boundAgent: null }) === "unbound");
ok("bound to the WRONG agent is also unbound", v({ boundAgent: "agent_other" }) === "unbound");
ok("working, column behind", v({}) === "status_stale");
ok("working and column right", v({ status: "active" }) === "ok");

// ── The two that are not faults ───────────────────────────────────────────
ok("the contractor turned voice off", v({ agentEnabled: false, boundAgent: null }) === "voice_off");
ok("out of credit", v({ hasCredit: false, boundAgent: null }) === "no_credit");
ok("a port in flight is slow, not stuck", v({ status: "porting", existsAtProvider: false }) === "porting");

// ── Absence of evidence is its own answer ─────────────────────────────────
//
// The whole point. A provider we could not reach must NOT fall through to the
// worst case, because the repair for a ghost releases the row.
ok("unreachable provider is not a ghost", v({ existsAtProvider: null }) === "provider_unreachable");
ok("unreachable outranks every other unknown",
   v({ existsAtProvider: null, wantAgent: null, boundAgent: null, agentEnabled: false }) === "provider_unreachable");

// ── Property 1: no billing claim without confirming the number exists ─────
for (const status of ["provisioning", "active", "failed", "released", null])
  for (const existsAtProvider of [true, false, null])
    for (const boundAgent of [AGENT, "agent_other", null])
      for (const wantAgent of [AGENT, null])
        for (const agentEnabled of [true, false])
          for (const hasCredit of [true, false]) {
            const verdict = verdictFor({ status, existsAtProvider, boundAgent, wantAgent, agentEnabled, hasCredit });
            const meta = NUMBER_VERDICTS[verdict];
            if (!meta) { fail++; console.log(`FAIL  unknown verdict ${verdict}`); continue; }
            // `porting` is the one billing:true that can be reached without a
            // provider read — a port in flight is a number we are already
            // paying for by definition, and portRequestedAt is the evidence.
            if (meta.billing && existsAtProvider !== true && verdict !== "porting") {
              fail++;
              console.log(`FAIL  ${verdict} claims billing without confirming the number exists`);
            }
            if (meta.repairable && existsAtProvider === null) {
              fail++;
              console.log(`FAIL  ${verdict} offers a repair on no evidence`);
            }
          }
ok("no verdict claims billing on an unconfirmed number", true);
ok("no verdict offers a repair when the provider was unreachable", true);

// ── Property 2: a deliberate switch-off is never repaired ─────────────────
//
// voice_off and unbound look IDENTICAL at the provider — no agent attached.
// Only the company's own `enabled` flag separates them, and getting this
// backwards turns a contractor's phone back on and bills them for calls they
// chose not to take.
ok("voice_off is not repairable", NUMBER_VERDICTS.voice_off.repairable === false);
ok("no_credit is not repairable", NUMBER_VERDICTS.no_credit.repairable === false);
ok("voice_off is the company's decision, not our fault",
   NUMBER_VERDICTS.voice_off.side === "company");
ok("disabled beats unbound when both apply",
   v({ agentEnabled: false, boundAgent: null }) === "voice_off");
ok("disabled beats unbound even when bound to the wrong agent",
   v({ agentEnabled: false, boundAgent: "agent_other" }) === "voice_off");

// ── Only FieldQuo's own faults are worth paging FieldQuo about ───────────
const ours = Object.entries(NUMBER_VERDICTS).filter(([, m]) => m.side === "fieldquo").map(([k]) => k);
ok("the faults we own are exactly the ones we can act on or must fix by hand",
   JSON.stringify(ours.sort()) === JSON.stringify(["ghost", "no_agent", "not_configured", "status_stale", "unbound"]),
   JSON.stringify(ours.sort()));
ok("every repairable verdict is one of ours",
   Object.values(NUMBER_VERDICTS).every((m) => !m.repairable || m.side === "fieldquo"));

// ── Hostile input ─────────────────────────────────────────────────────────
for (const junk of [undefined, null, "", 0, {}, "__proto__", "constructor"]) {
  const verdict = verdictFor({ ...base, status: junk, existsAtProvider: junk === null ? null : true });
  ok(`junk status resolves to a known verdict: ${JSON.stringify(junk)}`,
     Object.prototype.hasOwnProperty.call(NUMBER_VERDICTS, verdict), verdict);
}
ok("verdictFor with no arguments at all does not throw",
   (() => { try { return typeof verdictFor({}) === "string"; } catch { return false; } })());
ok("an empty call cannot claim the number exists", verdictFor({}) === "provider_unreachable");

// ── The deadlock, pinned ──────────────────────────────────────────────────
//
// Reported in the wild: the settings page said "nothing is answering because
// the receptionist is switched off — turn it on below" directly above three
// cards saying "your number hasn't finished activating, email us", with the
// switch itself locked behind the second message. There was no way out from
// inside the app.
//
// Cause: a number both STALE and SWITCHED OFF reports `voice_off`, which is
// correctly not repairable — and the stale column, which every other card gates
// on, therefore never got corrected. Two different writes had been folded into
// one. Correcting our record is bookkeeping; switching someone's phone on is
// their decision.
{
  const stale = { status: "provisioning", existsAtProvider: true };
  ok("a provisioning row with a live number is stale", statusNeedsCorrection(stale) === true);
  ok("stale is independent of the verdict — voice_off is still stale",
     v({ agentEnabled: false, boundAgent: null }) === "voice_off" &&
     statusNeedsCorrection(stale) === true);
  ok("stale is independent of credit",
     statusNeedsCorrection({ status: "failed", existsAtProvider: true }) === true);
  ok("an active row is not stale",
     statusNeedsCorrection({ status: "active", existsAtProvider: true }) === false);
  ok("a port in flight is not stale — it is its own state",
     statusNeedsCorrection({ status: "porting", existsAtProvider: true }) === false);
  // The correction is only ever licensed by CONFIRMED existence. A provider we
  // could not reach must not mark a row active and unlock every card on the
  // page for a number that may not exist.
  for (const unseen of [false, null, undefined])
    ok(`unconfirmed existence licenses no correction: ${String(unseen)}`,
       statusNeedsCorrection({ status: "provisioning", existsAtProvider: unseen }) === false);
}

// ── The correction never moves the contractor's switch ────────────────────
{
  const src = readFileSync("lib/voice/diagnose.js", "utf8");
  const heal = src.slice(src.indexOf("export async function diagnoseAndHeal"));
  const body = heal.slice(0, heal.indexOf("\n}"));
  ok("healing writes only the status", /data: \{ status: "active" \}/.test(body));
  ok("healing never touches enabled", !/enabled/.test(body));
  ok("healing only ever writes active, never back the other way",
     (body.match(/status: "/g) || []).length === 1);

  // Both screens must reconcile, or the page contradicts itself again — one
  // card healed and the rest still reading the stale column.
  const settings = readFileSync("app/api/settings/voice/route.js", "utf8");
  ok("the settings route reconciles before anything gates on the status",
     settings.indexOf("diagnoseAndHeal") < settings.indexOf("const readiness"),
     "reconcile must come first");
  ok("the repair route reconciles too", /diagnoseAndHeal/.test(
     readFileSync("app/api/settings/voice/number/repair/route.js", "utf8")));

  // And it must not cost a provider round-trip on every settings load.
  ok("a healthy number makes no provider call",
     /number\.status !== "active" && number\.status !== "porting"/.test(settings));
}

console.log(fail === 0 ? "\nALL PASS — a stuck number is diagnosed, not guessed at" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
