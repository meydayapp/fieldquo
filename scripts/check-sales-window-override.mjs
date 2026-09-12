// scripts/check-sales-window-override.mjs
//
//   npm run check:sales-window-override
//
// The platform console's per-jurisdiction calling-window override, executed.
//
// ══ What it proves ════════════════════════════════════════════════════════
//
//   1. The resolver (lib/sales/windowPolicy.js) answers enforce / warn / off
//      for a state with no registration duty, and enforce for everything it
//      does not recognise — no row, an unknown region, an unread state, a
//      mode string it has never heard of, an overrides list that is not a
//      list.
//   2. A registration-gated state stays at enforce under EVERY mode, and the
//      hold lifts only when a certificate is live — from the certificate
//      overlay or from the law file's own `done` flag — never from the mode.
//      The owner's instruction: "don't feed it to the companies until I check
//      off the registration."
//   3. The evaluator (salesCallReadiness) honours the resolved policy: the
//      same instant, the same count of attempts, refused under enforce,
//      allowed-with-a-warning under warn, allowed-with-a-caveat under off;
//      and `inWindow` says the clock's truth whatever the decision. The
//      registration warning, a prohibition and an unread state are untouched
//      by any mode.
//   4. The texting window (withinSalesSmsHours) reads the same policy.
//   5. Source: every gate reaches the resolver, the browser re-passes the
//      server's answer, the rep's screen has words for it in nine languages,
//      the console page and route exist, the write is superadmin-only, and
//      nothing deletes a row.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  WINDOW_MODES,
  effectiveWindowPolicy,
  isWindowMode,
  overrideKey,
  publicWindowPolicy,
  registrationGated,
  windowPolicyFor,
} from "@/lib/sales/windowPolicy";
import {
  CALLING_JURISDICTIONS,
  CALL_ALLOWED,
  CALL_REFUSED,
  CALL_UNKNOWN,
  dialHref,
  salesCallReadiness,
} from "@/lib/sales/callingRules";
import { withinSalesSmsHours, salesSmsWindowState } from "@/lib/sales/smsWindow";
import { salesSmsReadiness } from "@/lib/sales/salesSmsRules";
import { windowFor } from "@/lib/sales/queueWindows";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { AUDIT_ACTIONS } from "@/lib/platform/auditActions";

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
    console.log(`  FAIL ${name}${got !== undefined ? `  — got ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

const row = (region, mode, extra = {}) => ({ country: "US", region, mode, note: "pilot", ...extra });

// ── 1. The resolver ────────────────────────────────────────────────────────
section("1. The resolver: enforce / warn / off for a state with no registration duty");

ok("Oklahoma requires no registration in the law file", CALLING_JURISDICTIONS["US-OK"].registration === null);
ok("Florida requires no registration in the law file", CALLING_JURISDICTIONS["US-FL"].registration === null);

for (const mode of WINDOW_MODES) {
  const p = effectiveWindowPolicy({ country: "US", region: "OK", overrides: [row("OK", mode)] });
  ok(`OK with a "${mode}" row resolves to ${mode}`, p.mode === mode && p.requestedMode === mode, p);
  ok(`…and is not held`, p.heldByRegistration === false && p.registrationGated === false);
  ok(`…and reports its source as override`, p.source === "override" && p.key === "US-OK");
}
ok("the note travels with the policy", effectiveWindowPolicy({ country: "US", region: "OK", overrides: [row("OK", "warn")] }).note === "pilot");
ok("a blank note is null, not an empty string",
  effectiveWindowPolicy({ country: "US", region: "OK", overrides: [row("OK", "warn", { note: "  " })] }).note === null);

ok("no rows at all → enforce", effectiveWindowPolicy({ country: "US", region: "OK", overrides: [] }).mode === "enforce");
ok("null overrides → enforce", effectiveWindowPolicy({ country: "US", region: "OK", overrides: null }).mode === "enforce");
ok("an overrides value that is not a list or object → enforce",
  effectiveWindowPolicy({ country: "US", region: "OK", overrides: "off" }).mode === "enforce");
ok("a row for another state does not reach Oklahoma",
  effectiveWindowPolicy({ country: "US", region: "OK", overrides: [row("FL", "off")] }).mode === "enforce");
ok("a mode string the resolver does not know → enforce, with the row still reported",
  (() => {
    const p = effectiveWindowPolicy({ country: "US", region: "OK", overrides: [row("OK", "disabled")] });
    return p.mode === "enforce" && p.requestedMode === "enforce" && p.source === "override";
  })());
ok("an unknown region falls back to enforce even with an 'off' row for it",
  (() => {
    const p = effectiveWindowPolicy({ country: "US", region: "ZZ", overrides: [row("ZZ", "off")] });
    return p.mode === "enforce" && p.source === "default" && p.key === null;
  })());
ok("an unread state (Iowa) falls back to enforce even with an 'off' row for it",
  (() => {
    const p = effectiveWindowPolicy({ country: "US", region: "IA", overrides: [row("IA", "off")] });
    return p.mode === "enforce" && p.source === "default";
  })());
ok("no country → enforce", effectiveWindowPolicy({ region: "OK", overrides: [row("OK", "off")] }).mode === "enforce");
ok("Canada resolves at country level with an empty region",
  (() => {
    const p = effectiveWindowPolicy({ country: "CA", region: "QC", overrides: [{ country: "CA", region: "", mode: "warn", note: "x" }] });
    return p.key === "CA" && p.mode === "warn";
  })());
ok("the keyed-object shape resolves the same as the list shape",
  effectiveWindowPolicy({ country: "US", region: "OK", overrides: { "US-OK": row("OK", "off") } }).mode === "off");
ok("row spelling is folded through the law file's own key rule",
  overrideKey({ country: "United States", region: "Oklahoma" }) === "US-OK" &&
    overrideKey({ country: "ca", region: "" }) === "CA");
ok("windowPolicyFor() is the resolver over a prospect shape, not a second rule",
  windowPolicyFor({ country: "US", province: "OK" }, { overrides: [row("OK", "warn")] }).mode === "warn");
ok("isWindowMode knows exactly the three words",
  WINDOW_MODES.every(isWindowMode) && !isWindowMode("disabled") && !isWindowMode("") && !isWindowMode(null));
ok("publicWindowPolicy strips the admin id and keeps the mode",
  (() => {
    const p = publicWindowPolicy({ ...effectiveWindowPolicy({ country: "US", region: "OK", overrides: [row("OK", "warn")] }), setById: "adm_1" });
    return p.mode === "warn" && !("setById" in p) && p.note === "pilot";
  })());

// ── 2. The registration hold ───────────────────────────────────────────────
section("2. A registration-gated state stays gated under every mode");

const gatedKeys = Object.keys(CALLING_JURISDICTIONS).filter((k) => registrationGated(k));
ok("there are registration-gated jurisdictions to test against", gatedKeys.length >= 5, gatedKeys);
ok("Washington is one of them", gatedKeys.includes("US-WA"));
ok("Texas is one of them", gatedKeys.includes("US-TX"));
ok("Canada is NOT — its DNCL registration is filed in the law file", !gatedKeys.includes("CA"));

for (const key of gatedKeys) {
  const region = key.split("-")[1];
  for (const mode of WINDOW_MODES) {
    const p = effectiveWindowPolicy({ country: "US", region, overrides: [row(region, mode)] });
    ok(`${key} with a "${mode}" row binds at enforce`, p.mode === "enforce", p);
    if (CALLING_JURISDICTIONS[key].verified !== true) {
      // Vermont: gated AND unread. Nothing to hold, because there is no
      // window to relax — the evaluator refuses before the clock.
      ok(`${key} is unread, so the row is reported as default rather than held`, p.source === "default" && p.heldByRegistration === false);
      continue;
    }
    if (mode !== "enforce") {
      ok(`${key} reports the "${mode}" as HELD, not applied`, p.heldByRegistration === true && p.requestedMode === mode);
    } else {
      ok(`${key} at enforce is not "held" — there is nothing to hold`, p.heldByRegistration === false);
    }
    ok(`${key} says it is registration-gated`, p.registrationGated === true);
  }
}

ok("a live certificate lifts the hold — WA 'off' binds once WA is in registeredKeys",
  (() => {
    const p = effectiveWindowPolicy({ country: "US", region: "WA", overrides: [row("WA", "off")], registeredKeys: ["US-WA"] });
    return p.mode === "off" && p.heldByRegistration === false && p.registrationGated === false;
  })());
ok("…and a certificate for a different state does not",
  effectiveWindowPolicy({ country: "US", region: "WA", overrides: [row("WA", "off")], registeredKeys: ["US-TX"] }).mode === "enforce");
ok("the law file's own done flag lifts the hold (injected table)",
  (() => {
    const table = { ...CALLING_JURISDICTIONS, "US-WA": { ...CALLING_JURISDICTIONS["US-WA"], registration: { ...CALLING_JURISDICTIONS["US-WA"].registration, done: true } } };
    return effectiveWindowPolicy({ country: "US", region: "WA", overrides: [row("WA", "warn")], jurisdictions: table }).mode === "warn";
  })());
ok("no mode string can lift the hold — not 'registered', not 'force', not 'override'",
  ["registered", "force", "override", "OFF", "Off"].every(
    (m) => effectiveWindowPolicy({ country: "US", region: "WA", overrides: [row("WA", m)] }).mode === "enforce",
  ));

// ── 3. The evaluator ───────────────────────────────────────────────────────
section("3. salesCallReadiness honours the resolved policy");

// 21:00 Central on a Thursday — an hour past Oklahoma's 20:00 close.
const LATE = new Date("2026-09-04T02:00:00Z");
// Noon Central — inside.
const NOON = new Date("2026-09-03T17:00:00Z");
const ok_ = (extra = {}) =>
  salesCallReadiness({ prospect: { country: "US", province: "OK" }, timeZone: "America/Chicago", now: LATE, attemptsLast24h: 3, ...extra });
const policyOK = (mode) => effectiveWindowPolicy({ country: "US", region: "OK", overrides: [row("OK", mode)] });

ok("no policy → refused outside the window (today's behaviour)", ok_().decision === CALL_REFUSED);
ok("an enforce policy → refused, identical blockers",
  (() => {
    const a = ok_();
    const b = ok_({ windowPolicy: policyOK("enforce") });
    return b.decision === CALL_REFUSED && JSON.stringify(a.blockers) === JSON.stringify(b.blockers);
  })());
ok("enforce still says the window is shut", ok_({ windowPolicy: policyOK("enforce") }).inWindow === false);

const warn = ok_({ windowPolicy: policyOK("warn") });
ok("warn → allowed", warn.decision === CALL_ALLOWED, warn.decision);
ok("warn → no blockers", warn.blockers.length === 0, warn.blockers);
ok("warn → a warning names the window", warn.warnings.some((w) => w.code === "window_override_warn"));
ok("warn → a warning names the cap, since 3 of 3 are used", warn.warnings.some((w) => w.code === "cap_override_warn"));
ok("warn → the warnings carry catalogue keys the rep's screen resolves",
  warn.warnings.filter((w) => w.code.endsWith("_override_warn")).every((w) => w.titleKey && w.fixKey));
ok("warn → the warning carries the console's note", warn.warnings.some((w) => w.note === "pilot"));
ok("warn → inWindow is FALSE even though the decision is allowed", warn.inWindow === false);
ok("warn → windowOverride is echoed", warn.windowOverride?.mode === "warn");
ok("warn → nothing in unenforced (the caveat is off's)", !warn.unenforced.some((u) => u.code === "window_override_off"));
ok("warn → dialHref produces a target", dialHref(warn, "+14055550100") === "tel:+14055550100");
ok("warn inside the window → allowed with NO override warning",
  (() => {
    const r = ok_({ now: NOON, attemptsLast24h: 0, windowPolicy: policyOK("warn") });
    return r.decision === CALL_ALLOWED && r.warnings.length === 0 && r.inWindow === true;
  })());

const off = ok_({ windowPolicy: policyOK("off") });
ok("off → allowed", off.decision === CALL_ALLOWED, off.decision);
ok("off → no blockers, no warnings", off.blockers.length === 0 && off.warnings.length === 0);
ok("off → the caveat says the window is switched off", off.unenforced.some((u) => u.code === "window_override_off"));
ok("off → the caveat is said INSIDE the window too — never silent",
  ok_({ now: NOON, attemptsLast24h: 0, windowPolicy: policyOK("off") }).unenforced.some((u) => u.code === "window_override_off"));
ok("off → inWindow still tells the truth", off.inWindow === false);

ok("a policy object with an unknown mode is enforce at the evaluator too",
  ok_({ windowPolicy: { mode: "disabled" } }).decision === CALL_REFUSED);
ok("a policy string is ignored", ok_({ windowPolicy: "off" }).decision === CALL_REFUSED);

ok("the cap alone, inside the window: enforce refuses",
  ok_({ now: NOON, windowPolicy: policyOK("enforce") }).decision === CALL_REFUSED);
ok("the cap alone, inside the window: warn allows with the cap warning only",
  (() => {
    const r = ok_({ now: NOON, windowPolicy: policyOK("warn") });
    return r.decision === CALL_ALLOWED && r.warnings.map((w) => w.code).join() === "cap_override_warn";
  })());
ok("the cap alone, inside the window: off allows", ok_({ now: NOON, windowPolicy: policyOK("off") }).decision === CALL_ALLOWED);

ok("Florida's split-zone ambiguity under enforce is unknown, under warn allowed-with-warning, under off allowed",
  (() => {
    const at = new Date("2026-09-03T12:30:00Z"); // 08:30 Eastern, 07:30 Central
    const fl = (mode) =>
      salesCallReadiness({ prospect: { country: "US", province: "FL" }, now: at, windowPolicy: effectiveWindowPolicy({ country: "US", region: "FL", overrides: [row("FL", mode)] }) });
    return (
      fl("enforce").decision === CALL_UNKNOWN &&
      fl("warn").decision === CALL_ALLOWED && fl("warn").warnings.some((w) => w.code === "time_zone_ambiguous") &&
      fl("off").decision === CALL_ALLOWED
    );
  })());

ok("Arizona's prohibition still refuses under off — it is not a window",
  salesCallReadiness({ prospect: { country: "US", province: "AZ" }, timeZone: "America/Phoenix", now: NOON, windowPolicy: effectiveWindowPolicy({ country: "US", region: "AZ", overrides: [row("AZ", "off")] }) }).decision === CALL_REFUSED);
ok("an unread state is still unknown under off",
  salesCallReadiness({ prospect: { country: "US", province: "IA" }, now: NOON, windowPolicy: { mode: "off" } }).decision === CALL_UNKNOWN);
ok("Washington under a held 'off' at 21:00 Pacific is still REFUSED — the resolver's enforce reached the evaluator",
  (() => {
    const p = effectiveWindowPolicy({ country: "US", region: "WA", overrides: [row("WA", "off")] });
    const r = salesCallReadiness({ prospect: { country: "US", province: "WA" }, timeZone: "America/Los_Angeles", now: new Date("2026-09-04T04:00:00Z"), windowPolicy: p });
    return r.decision === CALL_REFUSED && r.warnings.some((w) => w.code === "registration_outstanding");
  })());
ok("Washington's registration warning stands under every mode, hold or no hold",
  WINDOW_MODES.every((mode) =>
    salesCallReadiness({ prospect: { country: "US", province: "WA" }, timeZone: "America/Los_Angeles", now: NOON, windowPolicy: { mode } })
      .warnings.some((w) => w.code === "registration_outstanding")));

ok("queueWindows.windowFor carries the override and inWindow for the row chip",
  (() => {
    const w = windowFor({ prospect: { country: "US", province: "OK" }, timeZone: "America/Chicago", now: LATE, policyContext: { overrides: [row("OK", "off")] } });
    const plain = windowFor({ prospect: { country: "US", province: "OK" }, timeZone: "America/Chicago", now: LATE });
    return w.callableNow === true && w.override === "off" && w.inWindow === false && plain.callableNow === false && plain.override === null;
  })());

// ── 4. The texting window ──────────────────────────────────────────────────
section("4. The texting window reads the same policy");

const ELEVEN_PM = new Date("2026-09-04T04:00:00Z"); // 23:00 Central
ok("23:00 local is refused with no policy", withinSalesSmsHours(ELEVEN_PM, "America/Chicago").allowed === false);
ok("23:00 local is refused under enforce", withinSalesSmsHours(ELEVEN_PM, "America/Chicago", { windowPolicy: policyOK("enforce") }).allowed === false);
ok("23:00 local is allowed under warn, with the refusal's sentence as the warning",
  (() => {
    const r = withinSalesSmsHours(ELEVEN_PM, "America/Chicago", { windowPolicy: policyOK("warn") });
    return r.allowed === true && r.override === "warn" && /Outside the texting window/.test(r.warning || "");
  })());
ok("23:00 local is allowed under off, with no warning text and override 'off'",
  (() => {
    const r = withinSalesSmsHours(ELEVEN_PM, "America/Chicago", { windowPolicy: policyOK("off") });
    return r.allowed === true && r.override === "off" && r.warning === null;
  })());
ok("an unknown zone under enforce still refuses", withinSalesSmsHours(ELEVEN_PM, null, { windowPolicy: policyOK("enforce") }).allowed === false);
ok("a held 'off' (Washington) still refuses the text at 23:00",
  withinSalesSmsHours(ELEVEN_PM, "America/Los_Angeles", { windowPolicy: effectiveWindowPolicy({ country: "US", region: "WA", overrides: [row("WA", "off")] }) }).allowed === false);
ok("the header tag reports the override without lying about the clock",
  (() => {
    const s = salesSmsWindowState(ELEVEN_PM, "America/Chicago", { windowPolicy: policyOK("warn") });
    return s.known && s.open === false && s.override === "warn";
  })());

const smsBase = {
  repName: "Rep",
  signupLink: "https://x/signup?sales=abc",
  fromNumber: "+16135550100",
  mailingAddress: "1 Main St",
  leadPhone: "+14055550100",
  leadTimeZone: "America/Chicago",
  suppression: { suppressed: false },
  now: ELEVEN_PM,
};
ok("salesSmsReadiness refuses at 23:00 with no policy",
  salesSmsReadiness(smsBase).blockers.some((b) => b.code === "outside_sms_window"));
ok("salesSmsReadiness sends under warn with the override warning",
  (() => {
    const r = salesSmsReadiness({ ...smsBase, windowPolicy: policyOK("warn") });
    return r.canSend === true && r.warnings.some((w) => w.code === "sms_window_override_warn" && /pilot/.test(w.fix)) && r.windowOverride === "warn";
  })());
ok("salesSmsReadiness sends under off with the off caveat",
  (() => {
    const r = salesSmsReadiness({ ...smsBase, windowPolicy: policyOK("off") });
    return r.canSend === true && r.warnings.some((w) => w.code === "sms_window_override_off");
  })());
ok("the CASL blockers are untouched by any mode — no mailing address still refuses under off",
  salesSmsReadiness({ ...smsBase, mailingAddress: "", windowPolicy: policyOK("off") }).canSend === false);

// ── 5. Source ──────────────────────────────────────────────────────────────
section("5. Every gate reaches the one resolver, and the screens have the words");

const queueRoute = read("app/api/sales/queue/route.js");
const callsRoute = read("app/api/sales/calls/route.js");
const leadRoute = read("app/api/sales/leads/[id]/route.js");
const salesSms = read("lib/sales/salesSms.js");
const queuePage = read("app/sales/queue/page.js");
const leadPage = read("app/sales/leads/[id]/page.js");
const dialRegion = read("app/components/sales/DialRegion.js");
const messagesPage = read("app/sales/messages/page.js");
const windowsRoute = read("app/api/platform/sales/windows/route.js");
const windowsPage = read("app/platform/sales/windows/page.js");
const sidebar = read("app/components/platform/PlatformSidebar.js");
const pkg = JSON.parse(read("package.json"));
const overrides = read("lib/sales/windowOverrides.js");

ok("the queue route loads the override context and hands the resolved policy to the evaluator",
  /loadWindowPolicyContext\(/.test(queueRoute) && /windowPolicy:\s*windowPolicyFor\(/.test(queueRoute));
ok("…and puts the resolved policy in callingContext for the browser", /windowPolicy:\s*publicWindowPolicy\(/.test(queueRoute));
ok("…and passes the context to the grouping, the claim and the release",
  /policyContext\s*\}\s*,?\s*\)/.test(queueRoute) && /claimBatch\(\{[^}]*policyContext/.test(queueRoute) && /releaseClosedUntouched\(\{[^}]*policyContext/.test(queueRoute));
ok("the dial refusal resolves the policy fresh at the moment of the dial",
  /windowPolicy:\s*await windowPolicyForProspect\(/.test(callsRoute));
ok("the lead route carries the resolved policy in the lead's callingContext",
  /windowPolicy:\s*publicWindowPolicy\(await windowPolicyForProspect\(/.test(leadRoute));
ok("the texting path resolves the policy beside the suppression read", /windowPolicyForProspect\(/.test(salesSms) && /windowPolicy,/.test(salesSms));
ok("the queue page re-asks with the server's policy, not its own",
  /windowPolicy:\s*ctx\.windowPolicy \|\| null/.test(queuePage) && !/effectiveWindowPolicy/.test(queuePage));
ok("the lead page re-asks with the server's policy, not its own",
  /windowPolicy:\s*call\.callingContext\.windowPolicy \|\| null/.test(leadPage) && !/effectiveWindowPolicy/.test(leadPage));
ok("the browser never loads override rows itself",
  !/windowOverrides/.test(queuePage) && !/windowOverrides/.test(leadPage) && !/windowOverrides/.test(dialRegion));
ok("the resolver is the only place the hold is decided — 'heldByRegistration' is computed in one file",
  (() => {
    const files = ["lib/sales/windowPolicy.js", "lib/sales/callingRules.js", "lib/sales/windowOverrides.js", "app/api/platform/sales/windows/route.js"];
    return files.filter((f) => /heldByRegistration:\s*(held|gated)/.test(read(f))).length === 1;
  })());
ok("a failed read of the override table enforces every window",
  /catch[\s\S]*overrides:\s*\[\],\s*registeredKeys:\s*\[\]/.test(overrides));

ok("DialRegion prints the override line instead of 'Open now' when the clock says shut",
  /inWindow === false/.test(dialRegion) && /app\.salesDial\.window\.overrideOff/.test(dialRegion) && /app\.salesDial\.window\.overrideWarn/.test(dialRegion));
ok("DialRegion renders the console's note on a warning", /note=\{w\.note \|\| null\}/.test(dialRegion));
ok("the queue row says 'warn only' / 'window off' rather than 'open'",
  /rowWindowOverrideWarn/.test(queuePage) && /rowWindowOverrideOff/.test(queuePage));
ok("the texting thread shows the override tag and the warning hint",
  /windowClosedOverrideWarn/.test(messagesPage) && /softWarning/.test(messagesPage));

const NEW_KEYS = [
  "app.salesDial.unenforced.windowOverrideOff.title",
  "app.salesDial.unenforced.windowOverrideOff.fix",
  "app.salesDial.warning.windowOverrideWarn.title",
  "app.salesDial.warning.capOverrideWarn.title",
  "app.salesDial.warning.overrideWarn.fix",
  "app.salesDial.override.noteLabel",
  "app.salesDial.window.overrideWarn",
  "app.salesDial.window.overrideOff",
  "app.salesQueue.rowWindowOverrideWarn",
  "app.salesQueue.rowWindowOverrideOff",
  "app.salesText.windowClosedOverrideWarn",
  "app.salesText.windowClosedOverrideOff",
];
const langs = Object.keys(APP_MESSAGES);
ok("the portal catalogue has nine languages", langs.length === 9, langs);
for (const key of NEW_KEYS) {
  const missing = langs.filter((l) => typeof APP_MESSAGES[l][key] !== "string" || !APP_MESSAGES[l][key].trim());
  ok(`${key} is in all nine languages`, missing.length === 0, missing);
}
ok("the evaluator's warning keys are the catalogue's keys",
  ["app.salesDial.warning.windowOverrideWarn.title", "app.salesDial.warning.capOverrideWarn.title", "app.salesDial.warning.overrideWarn.fix", "app.salesDial.unenforced.windowOverrideOff.title", "app.salesDial.unenforced.windowOverrideOff.fix"]
    .every((k) => read("lib/sales/callingRules.js").includes(`"${k}"`)));
ok("the translated warning keeps the {jurisdiction} placeholder in every language",
  langs.every((l) => APP_MESSAGES[l]["app.salesDial.warning.windowOverrideWarn.title"].includes("{jurisdiction}")));
ok("the translated cap warning keeps {cap} and {made} in every language",
  langs.every((l) => /\{cap\}/.test(APP_MESSAGES[l]["app.salesDial.warning.capOverrideWarn.title"]) && /\{made\}/.test(APP_MESSAGES[l]["app.salesDial.warning.capOverrideWarn.title"])));

ok("the console route reads for any platform admin", /getCurrentPlatformAdmin\(request\)/.test(windowsRoute.slice(windowsRoute.indexOf("export async function GET"))));
ok("the console route writes for a superadmin only", /superadminOrRefusal\(request\)/.test(windowsRoute.slice(windowsRoute.indexOf("export async function PUT"))));
ok("the console route has no DELETE — a row set back to enforce is the default", !/export async function DELETE/.test(windowsRoute));
ok("the console route refuses a key the law file has not read", /not a jurisdiction the calling rules have read/.test(windowsRoute));
ok("the console route requires a note to relax a window", /mode !== WINDOW_MODE_ENFORCE && !note/.test(windowsRoute));
ok("the console route reports the hold from the resolver rather than deciding it",
  /effectiveWindowPolicy\(/.test(windowsRoute) && !/registration\?\.required === true && !/.test(windowsRoute));
ok("the console route writes both audit actions and both are registered",
  /sales_window_override_relaxed/.test(windowsRoute) && /sales_window_override_enforced/.test(windowsRoute) &&
    AUDIT_ACTIONS.sales_window_override_relaxed?.tone === "danger" && AUDIT_ACTIONS.sales_window_override_enforced?.tone === "neutral");
ok("the console page lists every jurisdiction with a radio per row and a Save",
  /type="radio"/.test(windowsPage) && /Save/.test(windowsPage) && /\/api\/platform\/sales\/windows/.test(windowsPage));
ok("the console page says in words that the registration gate is never relaxed", /A registration gate is never relaxed by this screen/.test(windowsPage));
ok("the console page prints 'held' beside a held radio", /Held at enforce — registration outstanding/.test(windowsPage));
ok("the console page gates writes on superadmin", /PlatformWriteGate/.test(windowsPage) && /who="superadmin"/.test(windowsPage));
ok("the sidebar links the page", /\/platform\/sales\/windows/.test(sidebar));
ok("check:sales-window-override is a script", typeof pkg.scripts["check:sales-window-override"] === "string");
ok("…and check:all runs it", /check:sales-window-override/.test(pkg.scripts["check:all"] || ""));

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
