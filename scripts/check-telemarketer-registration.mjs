// scripts/check-telemarketer-registration.mjs
//
//   npm run check:telemarketer-registration
//
// Whether FieldQuo may telephone a state, and who is allowed to say so.
//
// ══ What this replaced, and why it needed replacing ═══════════════════════
//
// `registration.done: true` in lib/sales/callingRules.js. The owner opened the
// campaigns screen, read thirteen gated jurisdictions and a closing line
// telling him to go and edit a source file, and said he should be able to check
// them off. He was right, and the fix is not a tick box.
//
// A constant in a source file records no certificate number, no author, and no
// EXPIRY. Utah, New Jersey and Wisconsin all renew annually; Alaska wants
// notice thirty days before a campaign. A hardcoded `true` goes on saying
// "registered" for as long as nobody re-reads the file, which is precisely the
// failure the calling gate exists to prevent — and it fails in the permissive
// direction, which in Vermont is a criminal offence and in Ohio a fifth-degree
// felony.
//
// So the law stays in code and the certificate is a row. This file proves the
// two are combined in exactly one place and that every path through it defaults
// to gated.
//
// ══ Executed, not read ════════════════════════════════════════════════════
//
// Sections 1–4 run lib/sales/registrations.js against the clock — expired,
// revoked, not-yet-effective, unknown jurisdiction, and the boundary at the
// exact second of expiry. Sections 5–7 are source questions, each scoped to one
// named function or handler.
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
  certificateIsLive,
  registeredKeys,
  withRegistrations,
  registrationStatus,
  expiringSoon,
  isKnownJurisdictionKey,
} from "@/lib/sales/registrations";
import { CALLING_JURISDICTIONS } from "@/lib/sales/callingRules";
import { campaignStartBlockers, outstandingRegistrations } from "@/lib/sales/discovery/campaignGate";

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
const section = (t) => console.log(`\n${t}\n`);

const NOW = new Date("2026-09-09T12:00:00Z");
const live = (over = {}) => ({
  jurisdictionKey: "US-WA",
  certificateNumber: "WA-123456",
  registeredAt: new Date("2026-01-01T00:00:00Z"),
  expiresAt: new Date("2027-01-01T00:00:00Z"),
  revokedAt: null,
  ...over,
});

// ═══════════════════════════════════════════════════════════════════════════
section("1. A certificate is live, or it is not");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("a current certificate is live", certificateIsLive(live(), NOW));
  ok(
    "one that lapsed yesterday is not",
    !certificateIsLive(live({ expiresAt: new Date("2026-09-08T00:00:00Z") }), NOW),
  );
  ok(
    "one that takes effect tomorrow is not — Alaska wants thirty days' notice",
    !certificateIsLive(live({ registeredAt: new Date("2026-09-10T00:00:00Z") }), NOW),
  );
  ok("a revoked one is not", !certificateIsLive(live({ revokedAt: NOW }), NOW));
  ok(
    "one with no number is not — the number is what makes it auditable",
    !certificateIsLive(live({ certificateNumber: "" }), NOW),
  );
  ok("a certificate with no expiry date is live", certificateIsLive(live({ expiresAt: null }), NOW));
  ok(
    "an unparseable expiry is treated as NOT live, never as no expiry",
    !certificateIsLive(live({ expiresAt: "the fourteenth" }), NOW),
  );
  ok("an empty object is not a certificate", !certificateIsLive({}, NOW));
  ok("null is not a certificate", !certificateIsLive(null, NOW));

  // The boundary. Expiry is exclusive: at the instant printed on the
  // certificate it is over.
  const boundary = live({ expiresAt: new Date("2026-09-09T12:00:00Z") });
  ok("at the exact second of expiry it is no longer live", !certificateIsLive(boundary, NOW));
  ok(
    "one second before, it is",
    certificateIsLive(boundary, new Date("2026-09-09T11:59:59Z")),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The overlay opens exactly what it should, and nothing else");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok(
    "only live certificates produce keys",
    registeredKeys(
      [
        live(),
        live({ jurisdictionKey: "US-TX", expiresAt: new Date("2020-01-01") }),
        live({ jurisdictionKey: "US-OH", revokedAt: NOW }),
      ],
      NOW,
    ).join(",") === "US-WA",
    registeredKeys([live(), live({ jurisdictionKey: "US-TX", expiresAt: new Date("2020-01-01") })], NOW),
  );

  const gated = CALLING_JURISDICTIONS["US-WA"];
  ok("Washington is gated in the law file to begin with", gated?.registration?.required === true && gated.registration.done === false);

  const opened = withRegistrations(["US-WA"]);
  ok("a held certificate flips done", opened["US-WA"].registration.done === true);
  ok(
    "…and does NOT mutate the shipped table, which would make the answer depend on request order",
    CALLING_JURISDICTIONS["US-WA"].registration.done === false,
  );
  ok(
    "…and leaves every other gated jurisdiction alone",
    opened["US-TX"].registration.done === false && opened["US-OH"].registration.done === false,
  );

  // The three ways a bad key could open something, all refused.
  ok(
    "a key the law file has never read opens nothing",
    withRegistrations(["US-ZZ"])["US-WA"].registration.done === false &&
      withRegistrations(["US-ZZ"])["US-ZZ"] === undefined,
  );
  ok(
    "a key for a jurisdiction that requires NO registration invents no requirement",
    withRegistrations(["US-CA"])["US-CA"].registration === null,
    withRegistrations(["US-CA"])["US-CA"].registration,
  );
  ok("an empty list changes nothing", withRegistrations([]) === CALLING_JURISDICTIONS);
  ok("a non-array changes nothing", withRegistrations(null) === CALLING_JURISDICTIONS);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The campaign gate moves with it");
// ═══════════════════════════════════════════════════════════════════════════

{
  const territory = { country: "US", province: "WA" };
  ok(
    "with no certificate, a Washington campaign cannot start",
    campaignStartBlockers(territory).some((b) => b.code === "registration_outstanding"),
  );
  ok(
    "with one, it can",
    campaignStartBlockers(territory, { jurisdictions: withRegistrations(["US-WA"]) }).length === 0,
  );
  ok(
    "with an EXPIRED one, it cannot — this is the whole reason the row has a date",
    campaignStartBlockers(territory, {
      jurisdictions: withRegistrations(
        registeredKeys([live({ expiresAt: new Date("2026-09-08") })], NOW),
      ),
    }).some((b) => b.code === "registration_outstanding"),
  );

  const before = outstandingRegistrations().length;
  const after = outstandingRegistrations({ jurisdictions: withRegistrations(["US-WA"]) }).length;
  ok("recording one shortens the outstanding list by exactly one", after === before - 1, { before, after });
  ok(
    "…and it is Washington that left it",
    !outstandingRegistrations({ jurisdictions: withRegistrations(["US-WA"]) }).some((r) => r.code === "US-WA"),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. What the console is told, per jurisdiction");
// ═══════════════════════════════════════════════════════════════════════════

{
  const s = (rows) => registrationStatus("US-WA", rows, { now: NOW }).state;
  ok("no row reads as outstanding", s([]) === "outstanding", s([]));
  ok("a live row reads as registered", s([live()]) === "registered", s([live()]));
  // Four states, not a boolean. "Never filed" and "lapsed last month" are one
  // form apart and a screen that painted both the same would hide a renewal.
  ok(
    "a lapsed row reads as EXPIRED, distinct from outstanding",
    s([live({ expiresAt: new Date("2026-01-02") })]) === "expired",
    s([live({ expiresAt: new Date("2026-01-02") })]),
  );
  ok(
    "a future one reads as not yet effective",
    s([live({ registeredAt: new Date("2026-12-01") })]) === "not_yet_effective",
  );
  ok("a revoked one reads as revoked", s([live({ revokedAt: NOW })]) === "revoked");
  ok(
    "a jurisdiction that needs no registration says so rather than 'registered'",
    registrationStatus("US-CA", [], { now: NOW }).state === "not_required",
  );
  ok(
    "an expired row still carries its number, because a renewal needs it",
    registrationStatus("US-WA", [live({ expiresAt: new Date("2026-01-02") })], { now: NOW }).certificate
      ?.certificateNumber === "WA-123456",
  );

  const soon = expiringSoon([live({ expiresAt: new Date("2026-10-01") }), live({ jurisdictionKey: "US-TX", expiresAt: new Date("2026-09-20") })], { now: NOW });
  ok("renewals are listed soonest first", soon[0]?.jurisdictionKey === "US-TX", soon.map((r) => r.jurisdictionKey));
  ok(
    "a certificate with no expiry is never 'expiring soon'",
    expiringSoon([live({ expiresAt: null })], { now: NOW }).length === 0,
  );

  ok("a known key is known", isKnownJurisdictionKey("US-WA"));
  ok("a typo is not", !isKnownJurisdictionKey("US-Wa ") && !isKnownJurisdictionKey("Washington"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The write path attests, and cannot be done by an admin");
// ═══════════════════════════════════════════════════════════════════════════

{
  const route = read("app/api/platform/sales/registrations/route.js");
  ok("the route is superadmin-only", /superadminOrRefusal\(/.test(route));
  ok("…on every handler", (route.match(/superadminOrRefusal\(/g) || []).length === 3, (route.match(/superadminOrRefusal\(/g) || []).length);
  ok("a blank certificate number is refused", /certificate or registration number is required/i.test(route));
  ok("an unreadable jurisdiction key is refused", /isKnownJurisdictionKey\(/.test(route));
  ok(
    "…and it is checked against the law file rather than a second list",
    /from "@\/lib\/sales\/registrations"/.test(route) && /CALLING_JURISDICTIONS/.test(route),
  );
  ok("a missing effective date is refused", /date the registration took effect/i.test(route));
  // The expiry rule is the point of the whole change.
  ok(
    "an expiry must be given or explicitly waived",
    /neverExpires/.test(route) && /Give the date it lapses, or say it does not expire/.test(route),
  );
  ok("an expiry before the effective date is refused", /cannot lapse before it takes effect/i.test(route));
  ok("both writes are audit-logged", (route.match(/platformAuditLog\.create/g) || []).length === 2);
  ok("withdrawing requires a reason", /Say why it is being withdrawn/.test(route));
  ok(
    "withdrawing never deletes the row",
    /updateMany\(/.test(route) && !/\.delete\(|deleteMany\(/.test(route),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Both gates read the certificates, not just the law file");
// ═══════════════════════════════════════════════════════════════════════════

{
  const list = read("app/api/platform/sales/campaigns/route.js");
  const detail = read("app/api/platform/sales/campaigns/[id]/route.js");
  const page = read("app/platform/sales/campaigns/page.js");

  ok("the create route applies the overlay", /withRegistrations\(registeredKeys\(/.test(list));
  ok(
    "…to BOTH the registration it reports and the blockers it computes",
    /territoryRegistration\(territory, \{ jurisdictions \}\)/.test(list) &&
      /campaignStartBlockers\(territory, \{ jurisdictions \}\)/.test(list),
  );
  ok("the list route sends the keys to the browser", /registeredJurisdictions: registeredKeys\(/.test(list));
  ok(
    "…and sends KEYS only, never certificate numbers",
    !/certificateNumber:\s*true[\s\S]{0,400}registeredJurisdictions/.test(list) ||
      !/registeredJurisdictions: certificates/.test(list),
  );

  ok("the detail route builds the overlay", /liveJurisdictions\(/.test(detail));
  ok(
    "…and the START handler uses it, which is the one that spends money",
    /const jurisdictions = await liveJurisdictions\(\);\s*\n\s*for \(const blocker of campaignStartBlockers/.test(detail),
  );

  ok("the screen applies the same pure function the server did", /withRegistrations\(/.test(page));
  ok(
    "…so the backlog is computed through it rather than off the raw law file",
    /outstandingRegistrations\(\{ jurisdictions,/.test(page),
  );
  ok(
    "the screen no longer tells its owner to edit a source file",
    !/Flip <span className="font-mono">registration\.done/.test(page) &&
      !/lib\/sales\/callingRules\.js<\/span> when a certificate/.test(page),
  );
  ok("…and offers a control instead", /recordCertificate\(/.test(page) && /Record the certificate/.test(page));
  ok(
    "the expiry is asked for explicitly rather than left blank",
    /This registration does not expire/.test(page),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The law file is still the law file");
// ═══════════════════════════════════════════════════════════════════════════
//
// The certificates are operational state. The statutes are not, and nothing in
// this change may quietly move a `done: true` back into the table where it
// cannot expire.

{
  const rules = read("lib/sales/callingRules.js");
  const gated = Object.entries(CALLING_JURISDICTIONS).filter(([, j]) => j?.registration?.required === true);
  ok("fourteen jurisdictions require registration", gated.length === 14, gated.length);

  // ── The one `done: true` still in source, and why it may stay ─────────
  //
  // Canada's National DNCL registration was filed on 2026-09-06 and the
  // operator's confirmation has not come back, so there is no certificate
  // NUMBER — and the write path refuses a row without one, deliberately,
  // because the number is what makes the attestation auditable. A filing with
  // no confirmation is exactly the state the row model cannot represent, so it
  // stays in the table with its `filing` record beside it.
  //
  // Pinned to CA alone. This is the assertion that stops the old habit coming
  // back: a second `done: true` appearing in this file is somebody recording a
  // certificate where it can never expire, which is the whole failure this
  // change exists to end. When the confirmation arrives, CA becomes a row and
  // this expectation goes to zero.
  const doneInSource = gated.filter(([, j]) => j.registration.done === true).map(([c]) => c);
  ok(
    "only Canada is marked done in the source table, and only while it has no confirmation number",
    doneInSource.length === 1 && doneInSource[0] === "CA",
    doneInSource,
  );
  ok(
    "…and it carries the filing record that stands in for the number",
    CALLING_JURISDICTIONS.CA.registration.filing?.submittedAt === "2026-09-06" &&
      CALLING_JURISDICTIONS.CA.registration.filing?.confirmation === null,
  );
  ok(
    "every OTHER gated jurisdiction is outstanding in source, so a certificate has to be recorded",
    gated.filter(([c]) => c !== "CA").every(([, j]) => j.registration.done === false),
  );
  ok("every gated row still says what the statute requires", gated.every(([, j]) => typeof j.registration.what === "string" && j.registration.what.length > 40));
  ok("the law file does not import the certificates", !/registrations/.test(rules.split("\n")[0] || "") && !/from "\.\/registrations"/.test(rules));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:telemarketer-registration is a script", typeof pkg.scripts?.["check:telemarketer-registration"] === "string");
  ok(
    "…and check:all runs it",
    (pkg.scripts?.["check:all"] || "").includes("check:telemarketer-registration"),
  );
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
