// scripts/check-sales-text-them.mjs
//
// "Text me instead" — the owner's report (2026-09-18): a company asked the
// rep to text, and the rep "found it a bit hard to send a new text — maybe
// it's not linked". This executes the path that was built for that:
//
//   1. startTextThread with a leadId hint — the number on the lead opens
//      the thread; a number the lead does not carry is RECORDED on it
//      through the numbers route's own write; a test line or a test
//      account's number is never written; another rep's claim refuses with
//      their name; somebody else's lead is 404; the do-not-contact list is
//      asked before anything is written.
//   2. The reply route's first-contact rule is "a lead behind the number",
//      not "the signup link".
//   3. The Text them control stands beside every Call button — the idle
//      panel, the live call, the write-up, the no-dial states, the ring
//      dialog and live strip — and the outcome "They asked to be texted
//      instead" opens the composer on save.
//   4. The area code SUGGESTS a zone and never decides one.
//
// Run: npm run check:sales-text-them
//   (node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs …)
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
let fail = 0;
function ok(name, condition, detail = "") {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? `  — got: ${JSON.stringify(detail)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}`);

const { startTextThread, judgeNewTextNumber, numberIsOnLead, START_REFUSALS } = await import("@/lib/sales/messages/startThread");
const { recordContactNumber, RECORD_REFUSALS } = await import("@/lib/sales/contact/record");
const { suggestZoneForNumber } = await import("@/lib/sales/areaCodeZone");
const { resolveLeadTimeZone } = await import("@/lib/sales/leadTimeZone");

// ── A scriptable client: the tables startTextThread and the write touch ──
//
// Every table answers from the `state` object, and every write is recorded
// in `writes`, so an assertion can say "nothing was written" and mean it.
function makeClient(state) {
  const writes = [];
  const client = {
    writes,
    platformSetting: {
      findUnique: async ({ where }) => (where.key === "sales.testLines" ? { value: state.testLines || [] } : null),
    },
    salesSuppression: {
      findMany: async () => state.suppressions || [],
    },
    salesLead: {
      findMany: async () => state.leads || [],
      findFirst: async ({ where }) =>
        (state.leads || []).find((l) => l.id === where.id && l.salesRepId === where.salesRepId) || null,
      create: async ({ data }) => {
        writes.push(["salesLead.create", data]);
        return { id: "lead-new", ...data };
      },
    },
    salesRep: {
      findUnique: async ({ where }) => (state.reps || []).find((r) => r.id === where.id) || null,
    },
    prospect: {
      findFirst: async () => state.prospect || null,
    },
    salesContactNumber: {
      findMany: async () => state.numbers || [],
      create: async ({ data }) => {
        writes.push(["salesContactNumber.create", data]);
        return { id: "cn-new" };
      },
      updateMany: async (args) => {
        writes.push(["salesContactNumber.updateMany", args]);
        return { count: 1 };
      },
    },
  };
  return client;
}
const rep = { id: "rep-a", name: "Daniel", testAccount: false };
const LEAD = { id: "lead-1", phone: "+18192387263", salesRepId: "rep-a", prospectId: null, prospect: null, businessName: "Easy Roofers Inc." };

// ═══════════════════════════════════════════════════════════════════════════
section("1. startTextThread with a leadId hint");
// ═══════════════════════════════════════════════════════════════════════════
{
  const client = makeClient({ leads: [LEAD] });
  const r = await startTextThread(client, { rep, raw: "819 238 7263", leadId: "lead-1" });
  ok("the lead's own number opens the thread on that lead, nothing written", r.ok && r.leadId === "lead-1" && r.recorded === false && client.writes.length === 0, r);
}
{
  const client = makeClient({ leads: [LEAD] });
  const r = await startTextThread(client, { rep, raw: "+1 819 345 9008", leadId: "lead-1" });
  const w = client.writes.find((x) => x[0] === "salesContactNumber.create");
  ok("a number the lead does not carry is RECORDED on it, textable, by this rep", r.ok && r.leadId === "lead-1" && r.recorded === true && w && w[1].e164 === "+18193459008" && w[1].salesLeadId === "lead-1" && w[1].canText === true && w[1].addedBySalesRepId === "rep-a" && w[1].kind === "mobile", { r, w });
  ok("…and no second lead is made for it", !client.writes.some((x) => x[0] === "salesLead.create"));
}
{
  const client = makeClient({ leads: [LEAD], testLines: ["+16135550199"] });
  const r = await startTextThread(client, { rep, raw: "613-555-0199", leadId: "lead-1" });
  ok("a TEST LINE typed over a lead opens the thread on the lead and is never written onto the record", r.ok && r.leadId === "lead-1" && r.recorded === false && r.unsaved === "test_line" && client.writes.length === 0, { r, writes: client.writes });
}
{
  const client = makeClient({ leads: [LEAD] });
  const r = await startTextThread(client, { rep: { ...rep, testAccount: true }, raw: "613-555-0100", leadId: "lead-1" });
  ok("a TEST ACCOUNT's typed number likewise stays off the record", r.ok && r.unsaved === "test_account" && client.writes.length === 0, r);
}
{
  const other = { id: "lead-9", phone: "+16135550100", salesRepId: "rep-b", businessName: "Other Co", salesRep: { name: "Priya N." } };
  const client = makeClient({ leads: [LEAD, other] });
  const r = await startTextThread(client, { rep, raw: "613-555-0100", leadId: "lead-1" });
  ok("a number another rep holds a lead on is refused with their name, before anything is written", !r.ok && r.status === 409 && r.code === "held_by_other" && /Priya N\./.test(r.error) && client.writes.length === 0, r);
}
{
  const client = makeClient({ leads: [LEAD] });
  const r = await startTextThread(client, { rep: { id: "rep-b", name: "B" }, raw: "819 238 7263", leadId: "lead-1" });
  ok("a leadId that is not the rep's is 404 — not a fall-through that makes them a lead", !r.ok && r.status === 404 && r.code === "not_your_lead" && client.writes.length === 0, r);
}
{
  const client = makeClient({ leads: [LEAD], suppressions: [{ id: "s1", kind: "phone", value: "+18193459008", rawValue: "+18193459008", channels: ["sms", "email", "phone"], source: "sms_stop", reason: "Replied STOP", evidenceUrl: null, requestedAt: new Date(), retainUntil: null, removedAt: null, removedByAdminId: null }] });
  const r = await startTextThread(client, { rep, raw: "819 345 9008", leadId: "lead-1" });
  ok("the do-not-contact list is asked FIRST: a STOP number is refused and nothing is written, hint or no hint", !r.ok && r.status === 409 && r.code === "suppressed" && client.writes.length === 0, r);
}
{
  const dnc = { ...LEAD, prospectId: "p1", prospect: { id: "p1", phoneE164: "+18192387263", doNotContactAt: new Date() } };
  const client = makeClient({ leads: [dnc] });
  const r = await startTextThread(client, { rep, raw: "819 345 9008", leadId: "lead-1" });
  ok("a do-not-contact business acquires no new number", !r.ok && r.code === "do_not_contact" && r.error === RECORD_REFUSALS.do_not_contact && client.writes.length === 0, r);
}
{
  const client = makeClient({ leads: [LEAD] });
  const r = await startTextThread(client, { rep, raw: "+1 514 555 0134" });
  ok("no hint, a number nobody holds: a lead with only the number is made (the New message path, unchanged)", r.ok && r.created === true && client.writes.some((x) => x[0] === "salesLead.create" && x[1].phone === "+15145550134"), r);
}
ok("numberIsOnLead compares normalised: '(819) 238-7263' on a lead stored as +18192387263", numberIsOnLead({ phone: "+18192387263" }, [], "+18192387263") && numberIsOnLead({ phone: "(819) 238-7263" }, [], "+18192387263") && !numberIsOnLead({ phone: "+18192387263" }, [], "+18193459008") && numberIsOnLead({ phone: null }, [{ e164: "+18193459008" }], "+18193459008"));
ok("the Caribbean and the UK are still refused before any lookup", judgeNewTextNumber("+1 876 555 0100").code === "outside_us_ca" && judgeNewTextNumber("+44 7700 900123").code === "outside_nanp");
ok("START_REFUSALS carries the reply route's no-lead sentence and the 404", /Save it as a lead first/.test(START_REFUSALS.no_lead) && START_REFUSALS.not_your_lead === "That record is not yours to work.");

// ═══════════════════════════════════════════════════════════════════════════
section("2. The shared write — the numbers route's rules, executed");
// ═══════════════════════════════════════════════════════════════════════════
{
  const client = makeClient({ numbers: [{ id: "cn-1", e164: "+18193459008" }] });
  const r = await recordContactNumber({ owner: { prospectId: null, salesLeadId: "lead-1", doNotContactAt: null }, rep, e164: "819-345-9008", kind: "mobile", label: "x", canText: true, client });
  ok("the same number twice UPDATES the row it already has, and says so", r.ok && r.updated === true && r.id === "cn-1" && client.writes[0][0] === "salesContactNumber.updateMany", r);
  const bad = await recordContactNumber({ owner: { prospectId: null, salesLeadId: "lead-1" }, rep, e164: "not a number", client });
  ok("a number that will not normalise is refused rather than stored", !bad.ok && bad.code === "unreadable" && client.writes.length === 1, bad);
  const nobody = await recordContactNumber({ owner: { prospectId: null, salesLeadId: "lead-1" }, rep, e164: "+18195550106", canCall: undefined, canText: null, client });
  const w = client.writes.find((x) => x[0] === "salesContactNumber.create");
  ok("canCall / canText stay three-valued: unanswered is null, not false", nobody.ok && w && w[1].canCall === null && w[1].canText === null, w);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The reply route: a lead behind the number, not the link");
// ═══════════════════════════════════════════════════════════════════════════
{
  const route = read("app/api/sales/messages/route.js");
  // Comments blanked: the handler QUOTES the old sentence to say why it went.
  const post = route.slice(route.indexOf("export async function POST")).replace(/^\s*\/\/.*$/gm, "");
  ok("the refusal fires only with an empty thread AND no lead", /if \(!existing\.length && !lead\) \{/.test(post));
  ok("…after the lead lookup, with START_REFUSALS.no_lead, code no_lead, 409", post.indexOf("const lead =") < post.indexOf("if (!existing.length && !lead)") && /error: START_REFUSALS\.no_lead,\s*code: "no_lead",/.test(post));
  ok("…and the old refusal — the signup link on a first contact — is gone from the handler", !/not texted this number before/.test(post) && !/carries your signup link/.test(post));
  ok("the thread GET says whose a lead-less number is (holder), and hands the zone list + suggestion beside a time_zone_unknown blocker", /holder,/.test(route) && /resolveNumberHolder\(db, \{ e164: withE164, salesRepId: rep\.id \}\)/.test(route) && /timeZones: zoneBlocker && lead \? SALES_SMS_TIME_ZONES : null/.test(route) && /suggestZoneForNumber\(withE164\)/.test(route));
  ok("…the suggestion is withheld for a split state (candidates) — the rep picks from the two", /!zoneBlocker\.candidates\?\.length \? suggestZoneForNumber/.test(route));
  ok("the canned list carries \"as discussed\" for the first-message pick", /id: "discussed",/.test(route) && /thanks for taking my call\. As discussed, /.test(route));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Text them beside every Call button, and the outcome");
// ═══════════════════════════════════════════════════════════════════════════
{
  const control = read("app/components/sales/TextThem.js");
  ok("the control makes the lead from a prospect through POST /api/sales/leads, then opens through /api/sales/messages/start with the leadId", /fetchJson\("\/api\/sales\/leads", \{\s*method: "POST"/.test(control) && /fetchJson\("\/api\/sales\/messages\/start", \{\s*method: "POST"/.test(control) && /phone: e164, \.\.\.\(id \? \{ leadId: id \} : \{\}\)/.test(control));
  ok("…and lands on the thread with the blank composer (?compose=own)", /sp\.set\("thread", e164\)/.test(control) && /if \(compose\) sp\.set\("compose", compose\)/.test(control) && /compose = "own"/.test(control));
  ok("…printing the server's refusal under the button, never swallowing it", /setError\(err\?\.message \|\| t\("app\.salesText\.newOpenFailed"\)\)/.test(control) && /data-text-them-error/.test(control));
  ok("…and sends nothing itself", !/\/api\/sales\/messages"/.test(control) && !/\/api\/sales\/sms/.test(control));

  const panel = read("app/components/sales/CallPanel.js");
  const places = (panel.match(/<TextThemButton/g) || []).length;
  ok("CallPanel draws it in three states — idle under Call, on the live call, after the call beside the write-up", places === 3 && /data-call-button[\s\S]{0,1600}?<TextThemButton/.test(panel) && /<TransferControl[^>]*tone="call" \/>\s*(\{\/\*[\s\S]*?\*\/\}\s*)?<TextThemButton/.test(panel) && /<OutcomeForm[^>]*onLater=\{pending\.override \? null : later\}[\s\S]{0,700}?\{inline \? \(\s*<TextThemButton/.test(panel), places);
  ok("…on the number the Call button rings, with the lead when there is one, else the prospect", /e164=\{phoneE164\}\s*leadId=\{leadId \|\| null\}\s*prospectId=\{leadId \? null : prospectId \|\| null\}/.test(panel));
  const region = read("app/components/sales/DialRegion.js");
  ok("DialRegion draws it when there is no Call button (a closed calling window is not a closed texting window), never on a do-not-contact", /playbookWithoutDial && target\.phoneE164 && space\.state !== DIAL_NO_NUMBER \? \(\s*<TextThemButton/.test(region) && /space\.state !== DIAL_DO_NOT_CONTACT/.test(region.slice(region.indexOf("const playbookWithoutDial"), region.indexOf("const playbookWithoutDial") + 400)));
  const dock = read("app/components/sales/IncomingCallDock.js");
  ok("the ring dialog and the live strip carry \"They'd rather text\" on the ringing number, with the server's ids", /<TextThemButton\s*e164=\{incoming\.from\}\s*leadId=\{who\.text\?\.leadId \|\| null\}\s*prospectId=\{who\.text\?\.prospectId \|\| null\}\s*variant="link"\s*label=\{t\("app\.salesDial\.callerTextThem"\)\}/.test(dock) && (dock.match(/\{callerLinks\}/g) || []).length === 2);
  const caller = read("app/api/sales/calls/caller/route.js");
  ok("…and the caller route hands those ids only for the rep's own record, nothing for a number somebody else holds", /const text = holder\?\.mine\s*\?/.test(caller) && /: holder\s*\? null/.test(caller) && /save, text \}\)/.test(caller));
  ok("the outcome \"They asked to be texted instead\" opens the composer after the save (asserted in check-sales-call-panel)", /if \(fold\.code === "text_instead"\) \{/.test(panel));
  const page = read("app/sales/messages/page.js");
  ok("the thread page reads ?compose= for the first pick and opens write-your-own on it", /composeParam === "own" \|\| composeParam === "discussed" \? composeParam : "signup"/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The area code suggests; the rule still never guesses");
// ═══════════════════════════════════════════════════════════════════════════
ok("+1 819 345 9008 suggests America/Toronto", suggestZoneForNumber("+18193459008")?.timeZone === "America/Toronto");
ok("807 (Kenora is Central, Thunder Bay Eastern) suggests nothing", suggestZoneForNumber("+18075550100")?.timeZone === null);
ok("a UK number suggests nothing", suggestZoneForNumber("+447700900123") === null);
ok("resolveLeadTimeZone still consults no area code — a lead with only a number is unknown", resolveLeadTimeZone({ phone: "+18193459008", country: "CA" }).timeZone === null && !/areaCode|nanp/i.test(read("lib/sales/leadTimeZone.js")));
ok("…and a lead with a single-zone province derives without asking (Alliance Appliance, NY, no stated zone)", resolveLeadTimeZone({ timeZone: null, country: "US", province: "NY", phone: "+18454149461" }).timeZone === "America/New_York");
ok("the signup panel and the thread both pre-fill the suggestion and say where it came from", /next\.suggestedTimeZone\?\.timeZone/.test(read("app/sales/leads/SignupLinkSms.js")) && /app\.salesText\.zoneSuggested/.test(read("app/sales/leads/SignupLinkSms.js")) && /app\.salesText\.zoneSuggested/.test(read("app/sales/messages/page.js")));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
