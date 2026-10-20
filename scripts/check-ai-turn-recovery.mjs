// scripts/check-ai-turn-recovery.mjs
//
// The AI employee's turn survives the webhook being killed — and never
// answers the same homeowner twice.
//
//   npm run check:ai-turn
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The bug it pins was invisible to every other check in the repo, and the
// reason is worth writing down: check-whatsapp.mjs and check-messaging.mjs
// each stop at the edge of this path. One drives shouldReply with a hand-built
// fixture; the other executes the webhook but asserts respond.js by regex.
// Neither crosses webhook → employee → send in one run, so "the turn was
// awaited inside a request that gets killed, and nothing ever asked again"
// could not be seen by either.
//
// So this executes the REAL sweeper route against the real failure: a Message
// row left with aiPending true because the function died mid-turn.
//
// Run:
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs \
//        scripts/check-ai-turn-recovery.mjs
import { rows, writes, resetDbStub } from "./fixtures/dbStub.mjs";
import { owesAiTurn, aiTurnCutoff, AI_TURN_GRACE_MS } from "@/lib/messaging/aiTurn";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}
const section = (t) => console.log(`\n${t}\n`);

process.env.CRON_SECRET = process.env.CRON_SECRET || "test-cron-secret";
const cronRequest = () =>
  new Request("https://example.com/api/cron/messaging-ai", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });

// ── 1. The predicate both call sites share ────────────────────────────────
//
// The flag and the hook must agree by construction. Two copies is a row the
// sweeper spins on forever, or one it never looks at.
section("owesAiTurn — one definition, both call sites");

ok("an inbound live message owes a turn", owesAiTurn({ direction: "in" }) === true);
ok("an outbound message does not", owesAiTurn({ direction: "out" }) === false);
ok(
  "an IMPORTED inbound message does not — history is not somebody asking now",
  owesAiTurn({ direction: "in", imported: true }) === false,
);
ok(
  "noAutoReply is honoured",
  owesAiTurn({ direction: "in", noAutoReply: true }) === false,
);
ok("undefined does not throw", owesAiTurn(undefined) === false);

const ingestSrc = read("lib/messaging/ingest.js");
ok(
  "the ingest writes the flag from owesAiTurn, not a copied condition",
  /aiPending:\s*owesAiTurn\(event\)/.test(ingestSrc),
);
ok(
  "the ingest's AI hook uses the SAME predicate",
  /if \(created && owesAiTurn\(event\)\)/.test(ingestSrc),
);
ok(
  "the flag is cleared once the inline turn returns",
  /aiPending: false/.test(ingestSrc),
);

ok(
  "the grace period is longer than the burst hold the turn can sit in",
  AI_TURN_GRACE_MS > 6000,
  `${AI_TURN_GRACE_MS}ms`,
);

// ── 2. The sweeper, executed ──────────────────────────────────────────────
section("the sweeper, against a turn that was killed");

const { GET } = await import("@/app/api/cron/messaging-ai/route");

const HOUR = 3600 * 1000;
function seed({ aiPending, ageMs = 10 * 60 * 1000, withReply = false, id = "msg_1" }) {
  resetDbStub();
  rows.messagingChannel.push({ id: "chan_1", companyId: "co_1", platform: "instagram" });
  rows.messageThread.push({ id: "thread_1", companyId: "co_1", channelId: "chan_1" });
  rows.message.push({
    id,
    threadId: "thread_1",
    direction: "in",
    aiPending,
    imported: false,
    createdAt: new Date(Date.now() - ageMs),
    sentAt: new Date(Date.now() - ageMs),
  });
  if (withReply) {
    rows.aiEmployeeReply.push({ id: "reply_1", threadId: "thread_1", messageId: id });
  }
}

// A message whose webhook died: the flag is still set and the grace has passed.
seed({ aiPending: true });
let res = await GET(cronRequest());
let body = await res.json();
ok("an interrupted turn is found", body.due === 1, JSON.stringify(body));
ok("…and is recovered", body.recovered === 1, JSON.stringify(body));
ok(
  "…and the flag is cleared, so it is not swept again",
  rows.message[0].aiPending === false,
);

// Running again must find nothing: the state IS the dedupe.
res = await GET(cronRequest());
body = await res.json();
ok("a second tick finds nothing left to do", body.due === 0, JSON.stringify(body));

// ── 3. Guard 1: the grace period ──────────────────────────────────────────
section("a turn that is still running is never raced");

seed({ aiPending: true, ageMs: 5 * 1000 });
res = await GET(cronRequest());
body = await res.json();
ok(
  "a message written 5s ago is NOT swept — the webhook may still be in its burst hold",
  body.due === 0,
  JSON.stringify(body),
);
ok("…and its flag is untouched", rows.message[0].aiPending === true);

ok(
  "the cutoff is in the past by the grace period",
  Date.now() - aiTurnCutoff().getTime() >= AI_TURN_GRACE_MS,
);

// ── 4. Guard 2: the claim ─────────────────────────────────────────────────
section("two overlapping ticks cannot both take one row");

seed({ aiPending: true });
// Both ticks read the same due row, then both try to claim it. The stub
// APPLIES updateMany (see its comment), so the second genuinely finds nothing.
const [a, b] = await Promise.all([GET(cronRequest()), GET(cronRequest())]);
const bodies = [await a.json(), await b.json()];
const totalRecovered = bodies.reduce((n, x) => n + x.recovered, 0);
ok(
  "exactly one tick recovers the message",
  totalRecovered === 1,
  JSON.stringify(bodies),
);
const claims = writes.filter(
  (w) => w.model === "message" && w.action === "updateMany" && w.data?.aiPending === false,
);
ok(
  "the claim is conditional on the flag still being true",
  claims.length > 0 && claims.every((c) => c.where?.aiPending === true),
  JSON.stringify(claims.map((c) => c.where)),
);

// ── 5. Guard 3: killed between the send and the flag ──────────────────────
//
// The one case grace and claim cannot see. respond.js creates the reply row
// BEFORE calling send(), so a row for this message means the turn already got
// far enough to have sent.
section("a turn that already ran is never repeated");

seed({ aiPending: true, withReply: true });
res = await GET(cronRequest());
body = await res.json();
ok("the row is still picked up", body.due === 1, JSON.stringify(body));
ok(
  "…but refused, because a reply row for this message already exists",
  body.recovered === 0 && body.skipped === 1,
  JSON.stringify(body),
);
ok("…and the flag is cleared so it stops being selected", rows.message[0].aiPending === false);

const respondSrc = read("lib/aiEmployee/respond.js");
const replyCreate = respondSrc.indexOf("recordReply(prisma");
const sendCall = respondSrc.indexOf("await send(text,");
ok(
  "that guard is only sound because respond.js records the reply BEFORE it sends",
  replyCreate !== -1 && sendCall !== -1 && replyCreate < sendCall,
  `record@${replyCreate} send@${sendCall}`,
);

// ── 6. The route is authenticated and registered ──────────────────────────
section("wiring");

const unauth = await GET(new Request("https://example.com/api/cron/messaging-ai"));
ok("an unauthenticated request is refused", unauth.status === 401, `status ${unauth.status}`);

const vercel = JSON.parse(read("vercel.json"));
const entry = vercel.crons.find((c) => c.path === "/api/cron/messaging-ai");
ok("the sweeper is registered in vercel.json", Boolean(entry));
ok("…on every minute, like the media fetcher", entry?.schedule === "* * * * *", entry?.schedule);

const routeSrc = read("app/api/cron/messaging-ai/route.js");
ok("the sweeper sets its own maxDuration — it runs model calls", /maxDuration\s*=\s*\d+/.test(routeSrc));

for (const p of [
  "app/api/meta/messaging/webhook/route.js",
  "app/api/meta/whatsapp/webhook/route.js",
]) {
  ok(`${p.split("/").slice(3, 5).join("/")} webhook declares maxDuration`, /export const maxDuration\s*=\s*\d+/.test(read(p)));
}

console.log(`\n${checks} checks, ${failures} failure(s).`);
if (failures) process.exitCode = 1;
