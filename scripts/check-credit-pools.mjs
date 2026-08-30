// scripts/check-credit-pools.mjs
//
// Two wallets, and the rule that keeps money from crossing between them.
//
// ══ Why there are two ══════════════════════════════════════════════════════
//
// Retell and OpenAI do not charge alike, and the difference is structural
// rather than a matter of rates:
//
//   voice  per MINUTE of talk, PLUS a number rental that arrives every month
//          whether the phone rings or not. Crew texting is the same shape — a
//          carrier fee per message on a line that also rents monthly. The bill
//          has a floor you cannot get under while you hold the line.
//   ai     per TOKEN, and for pictures per image-token, which moves with
//          resolution and quality. Nothing recurs. Generate nothing in March,
//          owe nothing for March.
//
// One shared balance — which is what shipped first — put that recurring floor
// underneath a usage-only product. A contractor who topped up to make adverts
// would watch the credit drain into a rental for a receptionist they never
// asked for, and every line of the statement would be accurate while the
// product was wrong.
//
// They are also wanted by different people. Somebody who wants AI adverts and
// photo review very often does not want a robot answering their phone.
//
// ══ Derived, never passed ══════════════════════════════════════════════════
//
// The obvious design is a `pool` argument, and it is the wrong one: an argument
// can be forgotten, and a forgotten argument here bills a picture to the phone
// balance — money moving between wallets with nobody's fingerprints on it. The
// pool is a pure function of what was bought, and the tests below exist to keep
// it that way.
import { poolForKind, POOLS, balanceFor, aiBalanceFor } from "@/lib/voice/credits";
import { SPEND_KINDS, priceSpend } from "@/lib/voice/spendGate";
import { readFileSync } from "node:fs";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

section("1. Every kind knows its wallet");

for (const k of ["call", "number_setup", "number_rent", "crew_text", "crew_line_setup", "crew_line_rent", "topup", "trial", "adjustment"]) {
  ok(poolForKind(k) === POOLS.VOICE, `${k} is a phone-and-crew spend`, poolForKind(k));
}
for (const k of ["image_generation", "image_vision", "ai_topup", "ai_adjustment", "ai_bundle"]) {
  ok(poolForKind(k) === POOLS.AI, `${k} is an OpenAI spend`, poolForKind(k));
}
// An unknown kind must not land in the AI wallet by default: the voice ledger
// is the one with the audited history, and a stray row there is visible on a
// statement people already read.
ok(poolForKind("who_knows") === POOLS.VOICE, "an unknown kind falls to voice rather than inventing a wallet");
ok(poolForKind(null) === POOLS.VOICE && poolForKind(undefined) === POOLS.VOICE, "so do null and undefined");
ok(poolForKind(123) === POOLS.VOICE, "…and a non-string");

section("2. A balance is scoped to ONE wallet");

// Stubbed ledger. The point is to prove the WHERE clause carries the pool —
// which no amount of reading the aggregate call can establish, because the bug
// it prevents is a missing filter, and a missing filter reads like clean code.
const seen = [];
const stub = (rows) => ({
  voiceCreditEntry: {
    aggregate: async ({ where }) => {
      seen.push(where);
      const sum = rows
        .filter((r) => r.companyId === where.companyId && r.pool === where.pool)
        .reduce((a, r) => a + r.cents, 0);
      return { _sum: { cents: sum } };
    },
  },
});
const LEDGER = [
  { companyId: "c1", pool: "voice", cents: 5000 },
  { companyId: "c1", pool: "ai", cents: 300 },
  { companyId: "c2", pool: "ai", cents: 9999 },
];

const voice = await balanceFor("c1", stub(LEDGER));
const ai = await aiBalanceFor("c1", stub(LEDGER));
ok(voice === 5000, "the voice balance is the voice rows only", voice);
ok(ai === 300, "the AI balance is the AI rows only", ai);
ok(voice !== ai, "…and the two are genuinely different numbers");
ok(seen.every((w) => "pool" in w), "every balance query filters by wallet — a missing filter is the whole bug", seen);
ok((await balanceFor("c1", stub(LEDGER))) === 5000, "the DEFAULT is voice, so every caller written before there were two still asks its own question");
// Tenancy is not weakened by adding a second wallet.
ok((await aiBalanceFor("c2", stub(LEDGER))) === 9999 && (await aiBalanceFor("c3", stub(LEDGER))) === 0,
  "…and it is still scoped to one company");
ok((await balanceFor(null, stub(LEDGER))) === 0, "no company, no balance");

section("3. A spend is checked against its OWN wallet");

const gate = readFileSync("lib/voice/spendGate.js", "utf8");
ok(/balanceFor\(companyId, prisma, poolForKind\(kind\)\)/.test(gate),
  "checkSpend reads the wallet the KIND belongs to, not the voice one");
// Counted, not pattern-matched. The first version of this assertion used a
// negative lookahead for `balanceFor(companyId, prisma)` NOT followed by a
// comma — which never fires, because the two-argument call appears as an object
// property and therefore always HAS a comma after it. Mutation testing caught
// that: reverting one of the two call sites to the voice default passed
// cleanly. Every call site must carry the pool, so count them.
const reads = (gate.match(/balanceFor\(companyId, prisma/g) || []).length;
const scoped = (gate.match(/balanceFor\(companyId, prisma, poolForKind\(kind\)\)/g) || []).length;
ok(reads > 0 && reads === scoped,
  "…and EVERY read in the gate carries the wallet — one that forgets spends the phone balance on pictures",
  { reads, scoped });

section("4. A refund goes back where the money came from");

ok(/forKind = null/.test(gate), "refundReservation is told which kind it is refunding");
ok(/poolForKind\(forKind\) === POOLS\.AI \? "ai_adjustment" : "adjustment"/.test(gate),
  "…and credits the matching wallet — otherwise a refund is a transfer between wallets in disguise");

section("5. Nothing may choose a wallet by hand");

const credits = readFileSync("lib/voice/credits.js", "utf8");
ok(/pool: poolForKind\(kind\)/.test(credits), "writeEntry derives the pool");
// One writer, one derivation. A second place that sets `pool` is a second place
// that can set it wrongly.
ok((credits.match(/pool: /g) || []).length === 1, "…and it is the ONLY place a row's pool is set", (credits.match(/pool: /g) || []).length);
ok(!/pool\s*[,)]/.test(credits.replace(/pool = POOLS\.VOICE/, "").replace(/pool: poolForKind\(kind\)/, "")),
  "no writer takes a pool as an argument — an argument can be forgotten, a derivation cannot");

section("6. The image kinds are still priced and still fail closed");

ok(SPEND_KINDS.image_generation && SPEND_KINDS.image_vision, "both AI kinds are known to the gate");
ok(priceSpend("image_generation") > 0 && priceSpend("image_vision") > 0, "…and both are priced");
ok(poolForKind("image_generation") !== poolForKind("call"),
  "an advert and a phone call do not share a balance — the whole point");

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
