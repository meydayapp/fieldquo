// scripts/check-appointment-time.mjs
//
//   npm run check:appointment-time
//
// 6pm means 6pm where the company is.
//
// ══ The bug ════════════════════════════════════════════════════════════════
//
// 20 October 2026, the owner: "when I scheduled the appointment with Cathy I
// had set it for tomorrow at 6pm but when it saved it said 2pm and I had to
// reschedule it. It's not the first time."
//
// Four hours is Toronto's offset, and that is the whole story.
// `<input type="datetime-local">` yields "2026-10-21T18:00" with no zone; the
// calendar screen posted it verbatim; POST /api/appointments did
// `new Date(scheduledAt)`. The ECMAScript rule for a date-time with no offset
// is "local time" — of the PROCESS — and the process is Vercel's, which runs
// in UTC. So 18:00 was stored as 18:00Z and drawn back in Toronto as 2:00 PM.
//
// The sibling screens (the quote's SiteVisitPanel, the job's visit form, the
// calendar's Move dialog) all called `.toISOString()` in the browser first,
// which is why RESCHEDULING corrected the time that creating it got wrong —
// and why this looked like a save bug rather than a timezone one.
//
// ══ What this executes ═════════════════════════════════════════════════════
//
// The parser, against the zones and the DST edges that matter — and the real
// POST /api/appointments against the scripted db, which is the only thing
// that proves the row lands on the right instant.
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/route-stub-loader.mjs \
//        scripts/check-appointment-time.mjs

import { readFileSync } from "node:fs";
import { POST } from "@/app/api/appointments/route";
import { rows, writes, resetDbStub } from "@/lib/db";
import { session } from "@/lib/apiMember";
import { instantFromWallClock } from "@/lib/booking/timezone";

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
const read = (p) => readFileSync(p, "utf8");

/** The wall-clock time an instant shows as, in a zone. */
const shownAt = (date, timeZone) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);

// ───────────────────────────────────────────────────────────────────────────
section("1. The parser");

{
  const TO = "America/Toronto";
  const six = instantFromWallClock("2026-10-21T18:00", TO);
  ok("6pm typed in Toronto is 22:00Z", six.toISOString() === "2026-10-21T22:00:00.000Z", six.toISOString());
  ok("…and reads back as 18:00 in Toronto", shownAt(six, TO) === "18:00", shownAt(six, TO));

  // The exact bug: what the old code did with the same string.
  const old = new Date("2026-10-21T18:00Z");
  ok("the old reading showed 14:00 — the four hours the owner saw", shownAt(old, TO) === "14:00", shownAt(old, TO));

  // DST: the offset is not a constant, which is why this is resolved per day
  // rather than subtracted.
  const summer = instantFromWallClock("2026-07-15T18:00", TO);
  const winter = instantFromWallClock("2026-12-15T18:00", TO);
  ok("July 6pm is 22:00Z (EDT)", summer.toISOString() === "2026-07-15T22:00:00.000Z", summer.toISOString());
  ok("December 6pm is 23:00Z (EST) — not the same offset", winter.toISOString() === "2026-12-15T23:00:00.000Z", winter.toISOString());
  ok("…and both show as 18:00 at home", shownAt(summer, TO) === "18:00" && shownAt(winter, TO) === "18:00");

  // Other companies, other zones — including one east of UTC, where the old
  // behaviour pushed times the other way.
  const vcr = instantFromWallClock("2026-10-21T18:00", "America/Vancouver");
  ok("Vancouver 6pm is 01:00Z next day", vcr.toISOString() === "2026-10-22T01:00:00.000Z", vcr.toISOString());
  const lon = instantFromWallClock("2026-12-21T09:00", "Europe/London");
  ok("London 9am in December is 09:00Z", lon.toISOString() === "2026-12-21T09:00:00.000Z", lon.toISOString());
  const syd = instantFromWallClock("2026-10-21T09:00", "Australia/Sydney");
  ok("Sydney 9am is the PREVIOUS day in UTC", syd.toISOString() === "2026-10-20T22:00:00.000Z", syd.toISOString());

  // A caller that already answered the question is not second-guessed.
  const explicit = instantFromWallClock("2026-10-21T22:00:00.000Z", TO);
  ok("an instant with a zone is left exactly alone", explicit.toISOString() === "2026-10-21T22:00:00.000Z", explicit.toISOString());
  const offset = instantFromWallClock("2026-10-21T18:00:00-04:00", TO);
  ok("…and so is one carrying an offset", offset.toISOString() === "2026-10-21T22:00:00.000Z", offset.toISOString());

  // Seconds, a space separator, and the honest fallbacks.
  ok("seconds are accepted", instantFromWallClock("2026-10-21T18:00:30", TO).toISOString() === "2026-10-21T22:00:30.000Z");
  ok("a company with no timezone keeps the old reading rather than guessing", instantFromWallClock("2026-10-21T18:00", null).toISOString() === new Date("2026-10-21T18:00").toISOString());
  ok("a Date passes through", instantFromWallClock(new Date("2026-10-21T22:00:00Z"), TO).toISOString() === "2026-10-21T22:00:00.000Z");
  ok("rubbish is an Invalid Date, for the caller to refuse", Number.isNaN(instantFromWallClock("not a time", TO).getTime()));
  ok("…and so is nothing at all", Number.isNaN(instantFromWallClock(undefined, TO).getTime()));
}

// ───────────────────────────────────────────────────────────────────────────
section("2. The route, executed — the row that would have been wrong");

const OWNER = { id: "mem_owner", userId: "u_owner", companyId: "co_1", role: "owner", permissions: null };

function seed(timezone = "America/Toronto") {
  resetDbStub();
  rows.member = [OWNER];
  rows.company = [{ id: "co_1", timezone, name: "TrueFinish", currency: "CAD", defaultLanguage: "en", arrivalWindowMinutes: 0 }];
  rows.client = [{ id: "c_1", companyId: "co_1", name: "Cathy Monagham Jardine", email: null, phone: "613 555 0100" }];
  session.member = OWNER;
}

const post = (body) =>
  POST(
    new Request("https://app.fieldquo.com/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

{
  seed();
  // Exactly what the calendar screen used to send.
  const res = await post({ clientId: "c_1", scheduledAt: "2026-10-21T18:00" });
  ok("the appointment is created", res.status < 400, res.status);
  const write = writes.find((w) => w.model === "appointment" && w.action === "create");
  const stored = write?.data?.scheduledAt;
  ok("it is stored as 22:00Z", stored instanceof Date && stored.toISOString() === "2026-10-21T22:00:00.000Z", String(stored));
  ok("…so the calendar draws 18:00, not 14:00", shownAt(stored, "America/Toronto") === "18:00", shownAt(stored, "America/Toronto"));
}

{
  seed();
  // And what the screens that were always right send.
  const res = await post({ clientId: "c_1", scheduledAt: "2026-10-21T22:00:00.000Z" });
  ok("an ISO instant still lands untouched", res.status < 400);
  const stored = writes.find((w) => w.model === "appointment" && w.action === "create")?.data?.scheduledAt;
  ok("…on the same instant, so the two doors agree", stored?.toISOString() === "2026-10-21T22:00:00.000Z", String(stored));
}

{
  seed("America/Vancouver");
  await post({ clientId: "c_1", scheduledAt: "2026-10-21T18:00" });
  const stored = writes.find((w) => w.model === "appointment" && w.action === "create")?.data?.scheduledAt;
  ok("a company in Vancouver gets Vancouver's 6pm", stored?.toISOString() === "2026-10-22T01:00:00.000Z", String(stored));
}

{
  seed();
  const bad = await post({ clientId: "c_1", scheduledAt: "whenever" });
  ok("an unreadable time is still refused, not stored", bad.status === 400, bad.status);
}

// ───────────────────────────────────────────────────────────────────────────
section("3. Nobody is left posting a naive time");

{
  const page = read("app/app/appointments/page.js");
  ok("the calendar screen sends an instant", /scheduledAt: form\.scheduledAt \? new Date\(form\.scheduledAt\)\.toISOString\(\)/.test(page));
  const panel = read("app/app/invoices/[id]/JobPanel.js");
  ok("the invoice's job panel sends an instant", /scheduledAt: scheduledAt \? new Date\(scheduledAt\)\.toISOString\(\)/.test(panel));

  // The server is the real guard: the callers above can regress, and did.
  for (const [name, file] of [
    ["POST /api/appointments", "app/api/appointments/route.js"],
    ["PATCH /api/appointments/[id]", "app/api/appointments/[id]/route.js"],
    ["POST /api/jobs/[id]/visits", "app/api/jobs/[id]/visits/route.js"],
  ]) {
    const src = read(file);
    ok(`${name} resolves it in the company's zone`, /instantFromWallClock\(/.test(src));
    ok(`${name} no longer bare-parses scheduledAt`, !/new Date\((body\.)?scheduledAt\)/.test(src), file);
  }
  ok("wired into check:all", /npm run check:appointment-time/.test(JSON.parse(read("package.json")).scripts["check:all"]));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
