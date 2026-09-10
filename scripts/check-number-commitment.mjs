// scripts/check-number-commitment.mjs
//
//   npm run check:number-commitment
//
// A contractor was given a sales rep's phone number, for free, and it repointed
// that number's texts into their inbox.
//
// ══ What actually happened ════════════════════════════════════════════════
//
// 2026-09-10. Easy Roofers Inc. turned on crew texting and the screen said
// "Tu equipo escribe a este número +17166383616". That number had been assigned
// to Daniel, a FieldQuo sales rep, at 04:47 the same morning. The company had
// bought no number and had a US$0.00 balance. At 00:08 the claim wrote a
// CrewInboxNumber row with source "dedicated", set rentPaidThroughAt a month
// out, charged nothing, and pointed the number's SMS webhook at
// /api/crew/inbound. Both rows are still in the database with the same Twilio
// SID, PN6c40deb26a8bcb8186ced5ff3b592761, which is how it was found.
//
// ══ Why the existing checks passed ════════════════════════════════════════
//
// claimCrewLine had two guards and BOTH were working:
//
//   1. "Does FieldQuo's Twilio account own this number?" Yes — it is FieldQuo's
//      own rep line. That guard exists to stop a contractor naming a STRANGER's
//      number, and it did exactly that.
//   2. "Is another company holding this as a CREW line?" No — it was a SALES
//      line, in a different table.
//
// The hole is the shape of the question. "Not somebody else's crew line" is not
// "not in use", and every number FieldQuo owns for any other purpose lived in
// the gap: every rep's line, every contractor's receptionist number. This is the
// AGENTS.md failure class about a gate that reads as one and isn't, except the
// gate here was real — it just guarded a narrower door than anyone thought.
//
// ══ Executed ══════════════════════════════════════════════════════════════
//
// commitmentOf() is pure, so section 1 replays the incident from the rows that
// are in production, plus the cases that must still be ALLOWED — the shared
// test line, a released number, an expired loan, your own line. A gate that
// refuses everything is not a fix.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Nine mutations, all caught, each restored from a `cp` backup named by the
// file's full path. Two escaped on the first pass and both are worth recording:
//
//   · Deleting the released-number half of the platform rule changed nothing,
//     because the fixture said `active: false` AND `releasedAt`, so the OTHER
//     half answered it. A row that satisfies two conditions tests neither.
//     There are now two rows, each answerable by only one half.
//   · The ordering assertion survived a mutation that moved the gate — because
//     the mutation moved it to a line that was still before the write. The
//     mutation was wrong, not the check; moved genuinely after the upsert, it
//     fails.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { commitmentOf, COMMITMENT_REASONS } from "@/lib/voice/numberCommitment";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`); }
  return Boolean(cond);
}
const section = (t) => console.log(`\n${t}\n`);

function decomment(src) {
  let out = ""; let i = 0; let state = "code";
  while (i < src.length) {
    const c = src[i]; const d = src[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && d === "*") { state = "block"; out += "  "; i += 2; continue; }
      out += c; i++; continue;
    }
    if (state === "line") {
      if (c === "\n") { state = "code"; out += "\n"; i++; continue; }
      out += " "; i++; continue;
    }
    if (c === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
    out += c === "\n" ? "\n" : " "; i++;
  }
  return out;
}

const REP_LINE = "+17166383616";
const SHARED = "+15550000000";
const TENANT = "easyroofers";

// ═══════════════════════════════════════════════════════════════════════════
section("1. The incident, replayed from the rows that are in production");
// ═══════════════════════════════════════════════════════════════════════════

{
  // PlatformSmsNumber: purpose "sales", active, assigned to a rep, never released.
  const verdict = commitmentOf({
    e164: REP_LINE,
    sharedE164: SHARED,
    platformRow: { active: true, releasedAt: null, purpose: "sales", assignedRepId: "rep_daniel" },
    forCompanyId: TENANT,
  });
  ok("a tenant cannot claim a rep's line", verdict?.kind === "platform", verdict);
  ok("…and is told something it can act on", /Buy a crew number/.test(verdict.reason), verdict.reason);
  // Saying "that belongs to a FieldQuo salesperson" tells a customer a true
  // thing about somebody else's account.
  ok("…without naming who has it", !/rep|sales|Daniel/i.test(verdict.reason), verdict.reason);

  // assignedRepId is deliberately NOT part of the test: an UNASSIGNED sales
  // number is still FieldQuo's inventory, and giving it away means the next rep
  // to be handed it inherits a customer's crew inbox.
  const unassigned = commitmentOf({
    e164: REP_LINE,
    platformRow: { active: true, releasedAt: null, purpose: "sales", assignedRepId: null },
    forCompanyId: TENANT,
  });
  ok("an UNASSIGNED platform number is refused too", unassigned?.kind === "platform", unassigned);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. And the things that must still be allowed");
// ═══════════════════════════════════════════════════════════════════════════
//
// A gate that refuses everything is not a fix. The shared test line is LENT on
// purpose, and it is itself a PlatformSmsNumber — so it would be refused by its
// own gate if it were not checked first.

{
  ok(
    "the shared test line is still claimable",
    commitmentOf({
      e164: SHARED,
      sharedE164: SHARED,
      platformRow: { active: true, releasedAt: null, purpose: "crew_shared" },
      forCompanyId: TENANT,
    }) === null,
  );
  // `active: true` on purpose. The first version of this fixture said
  // active:false AND releasedAt, so the `active !== false` half of the rule
  // answered it and deleting the releasedAt half changed nothing — the
  // assertion passed with the release check gone. Each half is now tested by a
  // row that only it can answer.
  ok(
    "a RELEASED platform number is free again",
    commitmentOf({
      e164: REP_LINE,
      platformRow: { active: true, releasedAt: "2026-09-01T00:00:00Z" },
      forCompanyId: TENANT,
    }) === null,
  );
  ok(
    "…and an INACTIVE one is too",
    commitmentOf({
      e164: REP_LINE,
      platformRow: { active: false, releasedAt: null },
      forCompanyId: TENANT,
    }) === null,
  );
  // Otherwise the shared line is claimed once and gone forever.
  ok(
    "an EXPIRED loan is free again",
    commitmentOf({
      e164: SHARED,
      sharedE164: SHARED,
      crewRow: { companyId: "someone_else", expiresAt: "2020-01-01T00:00:00Z" },
      forCompanyId: TENANT,
      now: new Date("2026-09-10T00:00:00Z"),
    }) === null,
  );
  // Reconnecting your own line is the ordinary path through claimCrewLine.
  const self = commitmentOf({ e164: REP_LINE, crewRow: { companyId: TENANT, expiresAt: null }, forCompanyId: TENANT });
  ok("your own line reads as `self`, not a refusal", self?.kind === "self" && self.sameCompany === true, self);
  ok("a number nobody holds is free", commitmentOf({ e164: REP_LINE, forCompanyId: TENANT }) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The other doors the same gap left open");
// ═══════════════════════════════════════════════════════════════════════════

{
  const live = commitmentOf({ e164: REP_LINE, crewRow: { companyId: "other", expiresAt: null }, forCompanyId: TENANT });
  ok("another company's live crew line is refused", live?.kind === "crew", live);

  const theirVoice = commitmentOf({ e164: REP_LINE, voiceRow: { companyId: "other", status: "active" }, forCompanyId: TENANT });
  ok("another company's receptionist number is refused", theirVoice?.kind === "voice", theirVoice);

  // Refused even for the same company: Twilio keeps voice and SMS webhooks
  // apart so this would technically work, and the result is one number whose
  // crew messages and customer texts land in two inboxes with no way to tell
  // them apart from outside.
  const ownVoice = commitmentOf({ e164: REP_LINE, voiceRow: { companyId: TENANT, status: "active" }, forCompanyId: TENANT });
  ok("…and so is your OWN receptionist number", ownVoice?.kind === "voice", ownVoice);
  ok("…saying why rather than just no", /same place/.test(ownVoice.reason), ownVoice.reason);

  const released = commitmentOf({ e164: REP_LINE, voiceRow: { companyId: "other", status: "released" }, forCompanyId: TENANT });
  ok("a released receptionist number is free", released === null);

  ok("no number at all is refused", commitmentOf({ e164: null })?.kind === "invalid");
  ok("no arguments at all is refused", commitmentOf()?.kind === "invalid");
  ok("every reason is a sentence a contractor can act on", Object.values(COMMITMENT_REASONS).every((r) => r.length > 30 && /[.]$/.test(r.trim())));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The gate runs BEFORE anything is written or repointed");
// ═══════════════════════════════════════════════════════════════════════════
//
// A check that runs after the webhook moves has already done the damage: the
// rep's texts are in somebody else's inbox by then.

{
  const src = decomment(read("lib/crew/line.js"));
  const claim = src.slice(src.indexOf("export async function claimCrewLine"), src.indexOf("export async function purchaseCrewLine"));
  ok("claimCrewLine was found", claim.length > 500, claim.length);
  ok("it asks whether the number is committed", /numberCommitment\(normalised/.test(claim));
  ok("…passing who is asking", /forCompanyId: companyId/.test(claim));
  ok("…and which line is the shared one", /sharedE164: sharedTestLineE164\(\)/.test(claim));
  ok("…and refuses on anything but `self`", /committed\.kind !== "self"/.test(claim));

  const gateAt = claim.indexOf("numberCommitment(");
  const upsertAt = claim.indexOf("crewInboxNumber.upsert");
  ok("the gate is before the row is written", gateAt > -1 && upsertAt > -1 && gateAt < upsertAt, [gateAt, upsertAt]);
  const webhookAt = claim.search(/webhookUrl|setSmsWebhook|update\(\{[\s\S]{0,80}smsUrl/);
  ok("…and before the webhook is repointed", webhookAt === -1 || gateAt < webhookAt, [gateAt, webhookAt]);

  // It must not have been "fixed" by widening the ownership check instead —
  // that is the guard that was already correct and is not the problem.
  ok("the provider-ownership check is still there", /twilioNumberState\(normalised\)/.test(claim));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:number-commitment is a script", typeof pkg.scripts?.["check:number-commitment"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:number-commitment"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
