// scripts/check-sales-lead-dial.mjs
//
//   npm run check:sales-lead-dial
//
// Can a rep ring the leads they typed in themselves?
//
// ══ The hole this exists to stop coming back ══════════════════════════════
//
// For months the answer was no, and nothing said so. The server accepted a
// lead as a call target the whole time — app/api/sales/calls's targetFor()
// reads `leadId`, SalesCallAttempt.leadId is a column, dispositions write back
// to the lead — and 359 check scripts passed, because every one of them was
// asking whether the CODE was correct. None asked whether a rep could reach
// it. The owner opened /sales, found four leads with phone numbers on them and
// nothing to press, and said so.
//
// So this file asks the reachability question in three places:
//
//   1. The lead screen renders the dial region and hands it a LEAD, not a
//      prospect. A screen that imported the component and never passed a
//      target would render "nothing to dial" forever and look built.
//   2. The panel sends the right id. `prospectId: null` beside a real leadId
//      still puts a prospectId key on the wire, and targetFor checks
//      `if (prospectId)` first.
//   3. The gate is not bypassed on the way. The lead screen must reach its
//      answer through salesCallReadiness → dialHref → dialSpace, the same
//      three steps in the same order as the queue, or a lead becomes the
//      surface where a call gets placed outside the calling window.
//
// ══ And the second hole: a lead nobody could ever locate ══════════════════
//
// Calling hours belong to the jurisdiction, and 16 CFR 310.6(b)(7) exempts
// business calls from the federal rule — so a lead with no country and no
// province is `unknown` forever. Before SalesLead.country/.province existed,
// EVERY hand-typed lead was in that state permanently: the screen would have
// shown a refusal it offered no way to clear, which is a dead end wearing a
// control's clothes. Section 2 executes leadDial.js against that shape.
//
// ══ Execution first ═══════════════════════════════════════════════════════
//
// Sections 1–3 run the shipped functions against hostile input. Sections 4–6
// are source questions, each scoped to one named function or one JSX element,
// because a whole-file match passes over a deleted guard whenever the
// paragraph explaining it is still there.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Each guarantee was broken on disk in turn, the break confirmed by re-reading
// the file, this script confirmed to FAIL, and the file restored from a `cp`
// backup — never `git checkout`, which restores the commit rather than the
// working copy.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  leadPhoneE164,
  leadContactability,
  leadCallingContext,
  leadDialView,
} from "@/lib/sales/leadDial";
import { dialSpace, DIAL_READY, DIAL_NO_NUMBER, DIAL_UNCONFIRMED } from "@/lib/sales/dialSpace";
import { salesCallReadiness, dialHref, CALL_UNKNOWN } from "@/lib/sales/callingRules";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
  return Boolean(cond);
}
const section = (title) => console.log(`\n${title}\n`);

/** Blank out comments, preserving offsets, so a rule cannot match prose. */
function decomment(src) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && d === "*") { state = "block"; out += "  "; i += 2; continue; }
      if (c === '"' || c === "'" || c === "`") { state = c; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (state === "line") { out += c === "\n" ? "\n" : " "; if (c === "\n") state = "code"; i++; continue; }
    if (state === "block") {
      if (c === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
      out += c === "\n" ? "\n" : " "; i++; continue;
    }
    if (c === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
    if (c === state) state = "code";
    out += c;
    i++;
  }
  return out;
}

/** The body of one JSX element, from `<Name` to its matching `/>` or `</Name>`. */
function element(src, name) {
  const at = src.indexOf(`<${name}`);
  if (at < 0) return "";
  // Self-closing form first: the shortest balanced slice ending in `/>`.
  const selfClose = src.indexOf("/>", at);
  const openEnd = src.indexOf(`</${name}>`, at);
  if (selfClose >= 0 && (openEnd < 0 || selfClose < openEnd)) return src.slice(at, selfClose + 2);
  if (openEnd >= 0) return src.slice(at, openEnd + name.length + 3);
  return "";
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. A lead's number, as typed");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok(
    "a hyphenated number normalises to E.164",
    leadPhoneE164({ phone: "613-555-0142" }) === "+16135550142",
    leadPhoneE164({ phone: "613-555-0142" }),
  );
  ok(
    "…and so does a bracketed one with spaces",
    leadPhoneE164({ phone: "(613) 555 0142" }) === "+16135550142",
    leadPhoneE164({ phone: "(613) 555 0142" }),
  );
  ok(
    "prose in the phone field is not a number",
    leadPhoneE164({ phone: "call the shop" }) === null,
    leadPhoneE164({ phone: "call the shop" }),
  );
  ok(
    "an empty phone falls back to the discovered business's number",
    leadPhoneE164({ phone: null, prospect: { phoneE164: "+15145550188" } }) === "+15145550188",
  );
  ok(
    "and with neither, null — never an invented one",
    leadPhoneE164({}) === null,
    leadPhoneE164({}),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Who may be rung, and where they are");
// ═══════════════════════════════════════════════════════════════════════════

{
  const dnc = leadContactability({
    phone: "+16135550142",
    prospect: { doNotContactAt: new Date("2026-01-02"), doNotContactReason: "asked on the phone" },
  });
  ok("do-not-contact on the business blocks the lead", dnc.callable === false, dnc);
  ok("…and says it is a do-not-contact, not a missing number", dnc.code === "do_not_contact", dnc.code);

  const opted = leadContactability(
    { phone: "+16135550142" },
    { optedOut: { optedOut: true, reason: "They texted STOP." } },
  );
  ok("an opt-out blocks it too", opted.callable === false && opted.code === "opted_out", opted.code);

  // Order matters: a record that is BOTH flagged and opted out reports the
  // flag, because that is the fact a rep must not act against.
  const both = leadContactability(
    { phone: "+16135550142", prospect: { doNotContactAt: new Date("2026-01-02") } },
    { optedOut: { optedOut: true, reason: "x" } },
  );
  ok("do-not-contact outranks an opt-out", both.code === "do_not_contact", both.code);

  const unusable = leadContactability({ phone: "call the shop" });
  ok("an unusable phone string is 'no phone'", unusable.code === "no_phone", unusable.code);
  ok(
    "…and quotes back what was actually typed, so the rep can fix it",
    unusable.text.includes("call the shop"),
    unusable.text,
  );

  ok(
    "a plain lead with a good number is callable",
    leadContactability({ phone: "613-555-0142" }).callable === true,
  );

  // The location, and its precedence.
  const ctx = leadCallingContext({
    country: "CA",
    province: "ON",
    prospect: { country: "US", province: "TX" },
  });
  ok("the rep's own answer beats the discovered one", ctx.country === "CA" && ctx.province === "ON", ctx);
  ok("…and says which record it came from", ctx.source === "lead", ctx.source);

  const inherited = leadCallingContext({ prospect: { country: "US", province: "TX" } });
  ok("with nothing typed, the discovered pair is used", inherited.province === "TX", inherited);
  ok("…and is labelled as inherited", inherited.source === "prospect", inherited.source);

  const nowhere = leadCallingContext({});
  ok(
    "a lead nobody has located has NO location invented for it",
    nowhere.country === null && nowhere.province === null && nowhere.source === null,
    nowhere,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. End to end: the three steps, in order, on a lead");
// ═══════════════════════════════════════════════════════════════════════════

{
  /** The exact chain the lead screen runs. */
  function spaceFor(lead, { optedOut = null, now = new Date("2026-09-09T15:00:00Z") } = {}) {
    const view = leadDialView(lead, { optedOut });
    const compliance = salesCallReadiness({
      prospect: { country: view.callingContext.country, province: view.callingContext.province },
      timeZone: view.callingContext.timeZone,
      now,
    });
    return {
      view,
      compliance,
      space: dialSpace({
        prospect: { contact: view.contact },
        compliance,
        href: dialHref(compliance, view.phoneE164),
      }),
    };
  }

  // The state EVERY hand-typed lead was stuck in before the location columns.
  const unlocated = spaceFor({ phone: "613-555-0142" });
  ok(
    "a lead with no state is 'unknown', not 'allowed'",
    unlocated.compliance.decision === CALL_UNKNOWN,
    unlocated.compliance.decision,
  );
  ok(
    "…so no dial control is offered",
    unlocated.space.state === DIAL_UNCONFIRMED && unlocated.space.href === null,
    unlocated.space.state,
  );
  ok(
    "…and the reason names the missing location, which the rep can fix",
    (unlocated.space.reasons || []).some((r) => r.code === "location_unknown"),
    (unlocated.space.reasons || []).map((r) => r.code),
  );

  // Located, inside Ontario's hours — 15:00 UTC is 11:00 in Toronto.
  const located = spaceFor({
    phone: "613-555-0142",
    country: "CA",
    province: "ON",
    timeZone: "America/Toronto",
  });
  ok(
    "the same lead, once located and in hours, gets a dial",
    located.space.state === DIAL_READY && typeof located.space.href === "string",
    located.space.state,
  );
  ok(
    "…and the href is the number that was typed",
    located.space.href === "tel:+16135550142",
    located.space.href,
  );

  // Out of hours on the same located lead — 05:00 UTC is 01:00 in Toronto.
  const night = spaceFor(
    { phone: "613-555-0142", country: "CA", province: "ON", timeZone: "America/Toronto" },
    { now: new Date("2026-09-09T05:00:00Z") },
  );
  ok(
    "at one in the morning their time there is no dial control",
    night.space.state !== DIAL_READY && night.space.href === null,
    night.space.state,
  );

  // Located, in hours, and flagged: the flag wins over the clock.
  const flagged = spaceFor({
    phone: "613-555-0142",
    country: "CA",
    province: "ON",
    timeZone: "America/Toronto",
    prospect: { doNotContactAt: new Date("2026-01-02") },
  });
  ok(
    "do-not-contact beats a clear calling window",
    flagged.space.state !== DIAL_READY && flagged.space.href === null,
    flagged.space.state,
  );

  const noNumber = spaceFor({ phone: null, country: "CA", province: "ON" });
  ok(
    "a located lead with no number says so, rather than going quiet",
    noNumber.space.state === DIAL_NO_NUMBER,
    noNumber.space.state,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The lead screen actually renders it, and hands it a lead");
// ═══════════════════════════════════════════════════════════════════════════

{
  const src = decomment(read("app/sales/leads/[id]/page.js"));
  ok("the lead screen renders DialRegion", /<DialRegion/.test(src));

  const region = element(src, "DialRegion");
  ok("…and it was found as an element, not just as an import", region.length > 40, region.length);
  ok(
    "…and the target it is handed is a leadId",
    /leadId:\s*lead\.id/.test(region),
    region.slice(0, 400),
  );
  ok(
    "…and NOT a prospectId, which would log the call against the wrong row",
    !/prospectId/.test(region),
  );

  // The three steps, in the order the queue runs them.
  ok("the screen asks salesCallReadiness for the decision", /salesCallReadiness\(/.test(src));
  ok("…passes it to dialHref, the only producer of a tel: target", /dialHref\(/.test(src));
  ok("…and re-gates it through dialSpace", /dialSpace\(/.test(src));
  ok(
    "no tel: string is built on this screen",
    !/["'`]tel:/.test(src),
  );

  // The way out of the "we cannot confirm" state has to be on the screen that
  // shows it, or the refusal is a dead end.
  ok(
    "the screen can write the location back",
    /patch\(\{[\s\S]{0,200}province:/.test(src),
  );
  ok(
    "…and offers the closed zone list rather than free text",
    /SALES_SMS_TIME_ZONES/.test(src),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The panel sends exactly one id");
// ═══════════════════════════════════════════════════════════════════════════

{
  const src = decomment(read("app/components/sales/CallPanel.js"));
  const at = src.indexOf("async function place(");
  ok("place() was found", at > 0, at);
  const place = src.slice(at, src.indexOf("\n  }", at));

  ok(
    "the dial body spreads only the id that is set",
    /\.\.\.\(prospectId \? \{ prospectId \} : \{ leadId \}\)/.test(place),
    place.slice(0, 500),
  );
  ok(
    "…so a null prospectId is never sent beside a real leadId",
    !/prospectId,\s*\n?\s*leadId/.test(place) && !/prospectId: null/.test(place),
  );
  ok("the panel still posts before anything rings", /fetchJson\("\/api\/sales\/calls"/.test(place));

  // The playbook is prospect-only, and a lead must be TOLD that rather than
  // shown an empty space where a script would be.
  ok(
    "a lead with no prospect gets a stated reason for having no script",
    /playbookUnavailable/.test(src) && /unavailable=\{playbookUnavailable\}/.test(src),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. One dial region, not two");
// ═══════════════════════════════════════════════════════════════════════════

{
  const shared = decomment(read("app/components/sales/DialRegion.js"));
  const queue = decomment(read("app/sales/queue/page.js"));
  const lead = decomment(read("app/sales/leads/[id]/page.js"));

  ok("both screens import the shared region", /DialRegion/.test(queue) && /DialRegion/.test(lead));
  ok(
    "the queue no longer renders CallPanel directly",
    !/<CallPanel/.test(queue),
  );
  ok(
    "only the shared region renders CallPanel",
    /<CallPanel/.test(shared) && !/<CallPanel/.test(lead),
  );
  ok(
    "the shared region re-reads dialSpace's states rather than testing truthiness",
    /DIAL_READY/.test(shared) && /DIAL_DO_NOT_CONTACT/.test(shared),
  );
  ok(
    "…and only renders the panel on DIAL_READY with an href",
    /space\.state === DIAL_READY && space\.href/.test(shared),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The server reads the lead's own location");
// ═══════════════════════════════════════════════════════════════════════════

{
  const src = decomment(read("app/api/sales/calls/route.js"));
  const at = src.indexOf("async function targetFor(");
  ok("targetFor() was found", at > 0, at);
  const fn = src.slice(at, src.indexOf("\nexport async function GET", at));

  ok(
    "the lead branch selects the lead's own country and province",
    /country: true,[\s\S]{0,80}province: true,[\s\S]{0,200}prospectId: true/.test(fn),
  );
  ok(
    "…and prefers them over the discovered business's",
    /country: lead\.country \|\| lead\.prospect\?\.country/.test(fn) &&
      /province: lead\.province \|\| lead\.prospect\?\.province/.test(fn),
  );
  ok(
    "the lead's typed phone is normalised before the gate sees it",
    /normalisePhone\(lead\.phone\)/.test(fn),
  );
  ok(
    "no country is inferred from an area code anywhere in the route",
    !/areaCode/i.test(src),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The API returns the dial view on read AND on write");
// ═══════════════════════════════════════════════════════════════════════════

{
  const src = decomment(read("app/api/sales/leads/[id]/route.js"));
  const gets = src.split("export async function PATCH")[0];
  const patches = src.split("export async function PATCH")[1] || "";

  ok("GET returns the dial view", /call: leadDialView\(/.test(gets));
  ok("GET carries the server's clock", /serverNow:/.test(gets));
  ok(
    "PATCH returns the RECOMPUTED dial view, so saving a location clears the refusal",
    /call: lead \? leadDialView\(/.test(patches),
  );
  ok(
    "the location is normalised through the calling rules' own functions",
    /normaliseCountry\(/.test(patches) && /normaliseSubdivision\(/.test(patches),
  );
  ok(
    "an unrecognised state is refused, not silently stored as null",
    /status: 400/.test(patches.slice(patches.indexOf("normaliseSubdivision"))),
  );
  ok(
    "the time zone comes from the same closed list the texting window uses",
    /isSalesSmsTimeZone\(/.test(patches),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok(
    "check:sales-lead-dial is a script",
    typeof pkg.scripts?.["check:sales-lead-dial"] === "string",
  );
  ok(
    "…and check:all runs it, so it cannot quietly stop being run",
    (pkg.scripts?.["check:all"] || "").includes("check:sales-lead-dial"),
  );
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
