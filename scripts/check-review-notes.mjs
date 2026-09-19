// scripts/check-review-notes.mjs
//
//   npm run check:review-notes
//
// "Add to notes for review" under the deep photo read, EXECUTED end to end
// short of the browser: the route the button now posts to, run against the
// scripted db and a scripted session, and the pure append rule it uses.
//
// The button used to append to a textarea two screens up that only renders
// once it has text, made no request, and lost the text on reload unless the
// builder's Save was pressed after it — "does nothing", as reported. It now
// saves through POST /api/quotes/[id]/review-notes and says so beside itself.
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/route-stub-loader.mjs scripts/check-review-notes.mjs

import { readFileSync } from "node:fs";
import { POST, appendReviewNote } from "@/app/api/quotes/[id]/review-notes/route";
import { rows, writes, resetDbStub } from "@/lib/db";
import { session } from "@/lib/apiMember";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (s) => console.log(`\n${s}\n`);

const OWNER = { id: "mem_owner", userId: "u_owner", companyId: "co_1", role: "owner", permissions: null };
const call = (id, body) =>
  POST(new Request(`https://app.fieldquo.com/api/quotes/${id}/review-notes`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }), {
    params: Promise.resolve({ id }),
  });

section("The append rule");

ok("a blank note takes the text as-is", appendReviewNote("", "Deep photo read, 19 Sept:\n— Check the hinges") === "Deep photo read, 19 Sept:\n— Check the hinges");
ok("an existing note keeps its text, with the new one under a blank line", appendReviewNote("Caller asked for glass inserts\n", "— Check the hinges") === "Caller asked for glass inserts\n\n— Check the hinges");
ok("nothing to add changes nothing", appendReviewNote("kept", "   ") === "kept");
ok("null current is an empty note, not the string 'null'", appendReviewNote(null, "x") === "x");

section("The route, executed");

{
  resetDbStub();
  rows.member = [OWNER];
  rows.quote = [{ id: "q_1", companyId: "co_1", reviewNotes: "Phone: wants it before Christmas", updatedAt: new Date("2026-09-19T10:00:00Z") }];
  session.member = OWNER;

  const res = await call("q_1", { append: "Deep photo read, 19 Sept:\n— Peeling on two uppers" });
  const body = await res.json();
  ok("appends and answers 200", res.status === 200, { status: res.status, body });
  ok("the stored note is the old text plus the finding, under a blank line", body.reviewNotes === "Phone: wants it before Christmas\n\nDeep photo read, 19 Sept:\n— Peeling on two uppers", body.reviewNotes);
  const write = writes.find((w) => w.model === "quote" && w.action === "update");
  ok("…written to Quote.reviewNotes — the INTERNAL column — and nothing else", write && Object.keys(write.data).join(",") === "reviewNotes", write?.data);
  ok("…and hands back updatedAt for the builder's stale-write guard", "updatedAt" in body);

  const again = await call("q_1", { append: "— Second read" });
  const b2 = await again.json();
  ok("a second press appends under the first; nothing is replaced", b2.reviewNotes.endsWith("— Peeling on two uppers\n\n— Second read"), b2.reviewNotes);
}

{
  resetDbStub();
  rows.member = [OWNER];
  rows.quote = [{ id: "q_1", companyId: "co_1", reviewNotes: null }];
  session.member = OWNER;
  const empty = await call("q_1", { append: "   " });
  ok("nothing to add is a 400, not a silent no-op", empty.status === 400, empty.status);
  const other = await call("q_other_company", { append: "x" });
  ok("a quote outside the caller's company is not found", other.status === 404, other.status);
  ok("…and nothing was written", !writes.some((w) => w.action === "update"));
}

{
  resetDbStub();
  session.member = null;
  const res = await call("q_1", { append: "x" });
  ok("no session is refused before anything is read", res.status === 401, res.status);
}

section("The button says what happened, where it was pressed");

const panel = readFileSync("app/components/quotes/SuggestAddOns.js", "utf8");
const builder = readFileSync("app/components/quotes/builder/QuoteBuilder.js", "utf8");
ok("the builder posts the text to the append route", /fetchJson\(`\/api\/quotes\/\$\{quoteId\}\/review-notes`, \{\s*method: "POST"/.test(builder));
ok("…adopts the merged note the server returns and carries its updatedAt forward", /setReviewNotes\(typeof saved\?\.reviewNotes === "string" \? saved\.reviewNotes : text\)/.test(builder) && /if \(saved\?\.updatedAt\) setVersion\(saved\.updatedAt\)/.test(builder));
ok("…and scrolls the box it wrote into view", /reviewNotesRef\.current\?\.scrollIntoView/.test(builder) && /ref=\{reviewNotesRef\}/.test(builder));
ok("the panel shows 'Adding…', then the answer beside the button", /app\.deepRead\.addingToNotes/.test(panel) && /data-deep-read-added/.test(panel) && /app\.deepRead\.addedToNotes/.test(panel));
ok("…and a failure is a sentence, not a silent nothing", /app\.deepRead\.addToNotesFailed/.test(panel) && /result\.ok === false/.test(panel));
for (const key of ["app.deepRead.addingToNotes", "app.deepRead.addedToNotes", "app.deepRead.addToNotesFailed"]) {
  const missing = Object.keys(APP_MESSAGES).filter((l) => !APP_MESSAGES[l][key]);
  ok(`${key} in every app language`, missing.length === 0, missing);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
