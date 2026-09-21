// scripts/report-amd-accuracy.mjs
//
// How well Twilio's answering-machine detection agrees with the transcript,
// on the first calls after `sales.amd.enabled` is switched on.
//
// Reads the live database (through lib/db — the .env is production; this
// script only SELECTs) and prints, for the first N outbound browser dials
// that carry an AMD verdict AND a transcript:
//
//   - the AMD verdict per call, beside the transcript's own verdict
//     (lib/sales/calls/conversation.js conversationVerdict — twenty
//     contractor words is a conversation) and the clock's band;
//   - a 2×2: AMD said machine / human vs the transcript said conversation /
//     not — agreement, and each kind of disagreement with the call ids so
//     somebody can listen;
//   - `unknown` and `fax` counted apart, because neither is a wrong answer.
//
// The transcript is not ground truth either: a long greeting passes the
// word count, which is the case AMD exists to catch, so a disagreement
// where AMD says machine on a 20–60 s call is more likely AMD being right.
// The output says so beside the number rather than calling one side
// "accuracy". Write the figures into docs/SALES-OUTCOMES.md once fifty
// calls have run; until the setting is on there is nothing to measure and
// the script says that.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/report-amd-accuracy.mjs [limit]

import { db } from "@/lib/db";
import { conversationVerdict, pickupBand } from "@/lib/sales/calls/conversation";
import { isMachine } from "@/lib/sales/calls/amd";

const limit = Math.max(1, Math.min(500, Number(process.argv[2]) || 50));

const rows = await db.salesCallAttempt.findMany({
  where: { direction: "out", dialChannel: "browser", amdResult: { not: null } },
  orderBy: { amdAt: "asc" },
  take: limit,
  select: {
    id: true,
    providerCallSid: true,
    dialledAt: true,
    amdResult: true,
    amdMs: true,
    talkSeconds: true,
    answeredAt: true,
    endedAt: true,
    providerStatus: true,
    endReason: true,
    dialChannel: true,
    transcribedAt: true,
    transcript: true,
    disposition: true,
    dispositionAutoLogged: true,
  },
});

if (rows.length === 0) {
  console.log("No outbound browser dial carries an AMD verdict yet. `sales.amd.enabled` is off, or no call has been placed since it was switched on. Nothing to measure.");
  await db.$disconnect?.();
  process.exit(0);
}

const cells = { machine_conversation: [], machine_not: [], human_conversation: [], human_not: [], unknown: [], fax: [], untranscribed: [] };
for (const r of rows) {
  const amd = r.amdResult;
  if (amd === "fax") {
    cells.fax.push(r);
    continue;
  }
  if (amd === "unknown") {
    cells.unknown.push(r);
    continue;
  }
  const tv = conversationVerdict(r);
  if (tv === "unknown" || tv === "unmeasured") {
    cells.untranscribed.push(r);
    continue;
  }
  const conv = tv === "conversation";
  if (isMachine(amd)) (conv ? cells.machine_conversation : cells.machine_not).push(r);
  else (conv ? cells.human_conversation : cells.human_not).push(r);
}

const line = (r) => `    ${r.id}  ${r.providerCallSid || "-"}  ${r.dialledAt.toISOString()}  amd=${r.amdResult}${r.amdMs != null ? ` (${r.amdMs} ms)` : ""}  talk=${r.talkSeconds ?? "-"}s  band=${pickupBand(r) || "-"}  rep=${r.disposition || "-"}${r.dispositionAutoLogged ? "(auto)" : ""}`;

const compared = cells.machine_conversation.length + cells.machine_not.length + cells.human_conversation.length + cells.human_not.length;
const agree = cells.machine_not.length + cells.human_conversation.length;
console.log(`AMD verdicts read: ${rows.length} (first ${limit} by verdict time)`);
console.log(`Compared against a transcript: ${compared}; agree: ${agree}${compared ? ` (${Math.round((agree / compared) * 100)}%)` : ""}`);
console.log(`  AMD machine, transcript not a conversation (agree): ${cells.machine_not.length}`);
console.log(`  AMD human,   transcript conversation       (agree): ${cells.human_conversation.length}`);
console.log(`  AMD machine, transcript says conversation (disagree — a long greeting passes the word count; listen before calling AMD wrong): ${cells.machine_conversation.length}`);
for (const r of cells.machine_conversation) console.log(line(r));
console.log(`  AMD human,   transcript not a conversation (disagree — a brush-off, or AMD missed a machine): ${cells.human_not.length}`);
for (const r of cells.human_not) console.log(line(r));
console.log(`Not comparable: ${cells.unknown.length} unknown, ${cells.fax.length} fax, ${cells.untranscribed.length} without a transcript (outside the sample, or not yet)`);
console.log("\nWrite these figures into docs/SALES-OUTCOMES.md under 'AMD, measured' once fifty calls have run.");
await db.$disconnect?.();
