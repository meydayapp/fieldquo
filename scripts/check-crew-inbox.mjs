// Executes the crew inbox's public-endpoint edges: who a message is allowed to
// write for, what we will fetch with our credentials attached, and what the
// setup screen is allowed to claim.
//
// The pure decision cores are covered elsewhere — check:attribution runs
// lib/crew/attribution.js and check:inbox runs lib/crew/inboxLogic.js. This is
// the layer those two don't touch: the wire.
//
// Why it exists: this feature shipped with a switch that saved a column while
// its webhook could never fire, and nothing anywhere would have caught that,
// because the only tests were of the logic that never got a chance to run.
import { readFileSync } from "node:fs";
import { tenantKeyFromInbound, collectMediaUrls, isTwilioMediaUrl, pointFromInbound, MAX_MEDIA } from "@/lib/crew/inboundParse";
import { crewInboxCapability, SMS_CAPABLE_PROVIDERS } from "@/lib/crew/capability";
import { crewPanelBlocks } from "@/lib/crew/panelBlocks";
import { auditCrewLines } from "@/lib/crew/lineAudit";
import { dayBoundsIn } from "@/lib/crew/inbox";
import { attributeMessage } from "@/lib/crew/attribution";
import { decideAction } from "@/lib/crew/inboxLogic";
import {
  costForMessage,
  segmentsFor,
  crewSpendVerdict,
  crewChargeNote,
  CREW_SMS_CENTS,
  CREW_MMS_CENTS,
  CREW_OVERDRAFT_FLOOR_CENTS,
  SMS_SEGMENT_CHARS,
} from "@/lib/crew/messaging";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import {
  canSetUpCrewTexting,
  crewMessageScope,
  seesAllCrewMessages,
  CREW_SETUP_DENIAL,
} from "@/lib/crew/access";

let pass = 0, fail = 0;
const ok = (n, c, got) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};

const TWILIO_MEDIA = "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM1/Media/ME1";

// ══ Tenant resolution ══════════════════════════════════════════════════════
//
// The company comes from the number that was TEXTED and from nothing else. A
// shared line resolved by SENDER was considered and rejected: Worker.phone has
// no unique constraint (a subcontractor is on two rosters with one cell), and
// `From` is asserted by the originating carrier, not proved by the signature.

console.log("\nTenant resolution — the `To`, and only the `To`");
ok("an E.164 To resolves", tenantKeyFromInbound({ To: "+15145551234" }) === "+15145551234");
ok("a formatted To normalises", tenantKeyFromInbound({ To: "(514) 555-1234" }) === "+15145551234");
ok("a missing To resolves to nothing", tenantKeyFromInbound({}) === null);
ok("an unknown/garbage To resolves to nothing", tenantKeyFromInbound({ To: "not a number" }) === null);
ok("an empty To resolves to nothing", tenantKeyFromInbound({ To: "" }) === null);

console.log("\nA spoofed From cannot name a tenant");
const spoof = {
  From: "+15145559999",
  Body: "companyId=cmsl36it7000004juyw4qyn0u",
  CompanyId: "cmsl36it7000004juyw4qyn0u",
  AccountSid: "AC_other",
  To: "+15145551234",
};
ok("the key is the To, whatever else the body claims", tenantKeyFromInbound(spoof) === "+15145551234");
ok(
  "changing From does not change the key",
  tenantKeyFromInbound({ ...spoof, From: "+14385550000" }) === tenantKeyFromInbound(spoof),
);
ok(
  "changing the body does not change the key",
  tenantKeyFromInbound({ ...spoof, Body: "file this to anyone" }) === tenantKeyFromInbound(spoof),
);
ok(
  "a From with no To yields no tenant at all",
  tenantKeyFromInbound({ From: "+15145559999", Body: "hi" }) === null,
);

// ══ Media ══════════════════════════════════════════════════════════════════
//
// These URLs are fetched WITH the Twilio account credentials in an
// Authorization header. A host check here is a credential check.

console.log("\nMedia: 0, 1 and 10 attachments");
ok("no media", collectMediaUrls({ NumMedia: "0" }).urls.length === 0);
ok("no NumMedia at all", collectMediaUrls({}).urls.length === 0);
const one = collectMediaUrls({ NumMedia: "1", MediaUrl0: TWILIO_MEDIA });
ok("one attachment", one.urls.length === 1 && one.urls[0] === TWILIO_MEDIA);
const ten = { NumMedia: "10" };
for (let i = 0; i < 10; i++) ten[`MediaUrl${i}`] = `${TWILIO_MEDIA}${i}`;
ok("ten attachments all survive", collectMediaUrls(ten).urls.length === 10);

console.log("\nMedia: a payload that lies about how many");
const lying = { NumMedia: "100000", MediaUrl0: TWILIO_MEDIA };
ok("the loop is bounded by MAX_MEDIA, not by the payload", collectMediaUrls(lying).urls.length <= MAX_MEDIA);
ok("...and only real entries are kept", collectMediaUrls(lying).urls.length === 1);
ok("NumMedia 'abc' -> none", collectMediaUrls({ NumMedia: "abc", MediaUrl0: TWILIO_MEDIA }).urls.length === 0);
ok("NumMedia '-5' -> none", collectMediaUrls({ NumMedia: "-5", MediaUrl0: TWILIO_MEDIA }).urls.length === 0);
ok("NumMedia '2.9' truncates", collectMediaUrls({ NumMedia: "2.9", MediaUrl0: TWILIO_MEDIA, MediaUrl1: TWILIO_MEDIA }).urls.length === 2);
ok("a gap in the numbering doesn't crash", collectMediaUrls({ NumMedia: "3", MediaUrl1: TWILIO_MEDIA }).urls.length === 1);

console.log("\nMedia: hostile MediaUrl values (a leak of our Twilio credentials)");
const hostile = [
  ["a plain other host", "https://evil.example.com/x.jpg"],
  ["userinfo pretending to be Twilio", "https://api.twilio.com@evil.example.com/x.jpg"],
  ["a suffix host", "https://api.twilio.com.evil.example.com/x.jpg"],
  ["a prefix host", "https://evil-api.twilio.com/x.jpg"],
  ["a glued host", "https://apievil.twilio.com/x.jpg"],
  ["plain http", "http://api.twilio.com/x.jpg"],
  ["a file url", "file:///etc/passwd"],
  ["a data uri", "data:image/png;base64,AAAA"],
  ["a javascript uri", "javascript:alert(1)"],
  ["link-local metadata", "http://169.254.169.254/latest/meta-data/"],
  ["localhost", "https://localhost/x.jpg"],
  ["no scheme", "api.twilio.com/x.jpg"],
  ["empty", ""],
  ["null", null],
  ["an object", { toString: () => TWILIO_MEDIA }],
];
for (const [label, url] of hostile) {
  ok(`refuses ${label}`, isTwilioMediaUrl(url) === false, url);
}
ok(
  "a hostile url is refused inside a real payload",
  collectMediaUrls({ NumMedia: "2", MediaUrl0: TWILIO_MEDIA, MediaUrl1: "https://evil.example.com/x" }).urls.length === 1,
);
ok(
  "...and is reported rather than dropped silently",
  collectMediaUrls({ NumMedia: "2", MediaUrl0: TWILIO_MEDIA, MediaUrl1: "https://evil.example.com/x" }).rejected.length === 1,
);

console.log("\nMedia: the hosts Twilio really uses are allowed");
ok("api.twilio.com", isTwilioMediaUrl(TWILIO_MEDIA));
ok("a regional api host", isTwilioMediaUrl("https://api.us1.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1"));
ok("the MMS content service", isTwilioMediaUrl("https://mcs.us1.twilio.com/Services/S1/Media/ME1"));

console.log("\nCoordinates: absent is absent, not zero");
ok("no coordinates -> null", pointFromInbound({}) === null);
ok("a partial pair -> null", pointFromInbound({ Latitude: "45.5" }) === null);
ok("non-numeric -> null", pointFromInbound({ Latitude: "x", Longitude: "y" }) === null);
ok("out of range -> null", pointFromInbound({ Latitude: "999", Longitude: "0" }) === null);
const pt = pointFromInbound({ Latitude: "45.5019", Longitude: "-73.5674" });
ok("a real pair survives", pt?.lat === 45.5019 && pt?.lng === -73.5674);

// ══ Capability ═════════════════════════════════════════════════════════════
//
// The verdict the setup screen renders AND the inbound webhook enforces. If
// these two could disagree we would be back where we started.

console.log("\nCapability: refused when the deployment can't verify a signature");
const goodLine = {
  provider: "twilio",
  connectedAt: new Date("2026-08-01"),
  webhookUrl: "https://app.fieldquo.com/api/crew/inbound",
  expiresAt: null,
};
const noToken = crewInboxCapability({ line: goodLine, signatureConfigured: false });
ok("not ready", noToken.ready === false);
// The env var is named to FIELDQUO, on /platform/crew-lines, and never to a
// contractor. The tenant-facing half of this exact verdict used to say
// "TWILIO_AUTH_TOKEN isn't set" on /app/crew-inbox — at a painter, about a
// Vercel project he has no login for.
ok("...and tells FieldQuo which env var is missing", /TWILIO_AUTH_TOKEN/.test(noToken.opsMessage), noToken.opsMessage);
ok("...while the contractor is told it's ours to fix", /FieldQuo/.test(noToken.message) && !/TWILIO/.test(noToken.message), noToken.message);
ok("...reason not_configured", noToken.reason === "not_configured");
ok(
  "an otherwise perfect line is still refused without the token",
  crewInboxCapability({
    line: goodLine,
    signatureConfigured: false,
    expectedWebhookUrl: goodLine.webhookUrl,
  }).ready === false,
);

console.log("\nCapability: the states a contractor can actually be in");
ok("no line -> no_line", crewInboxCapability({ line: null }).reason === "no_line");
ok(
  "a Retell voice number -> provider_no_sms",
  crewInboxCapability({ line: { ...goodLine, provider: "retell" } }).reason === "provider_no_sms",
);
ok(
  "an expired loan -> expired",
  crewInboxCapability({ line: { ...goodLine, expiresAt: new Date("2020-01-01") } }).reason === "expired",
);
ok(
  "claimed but never wired -> not_connected",
  crewInboxCapability({ line: { ...goodLine, connectedAt: null } }).reason === "not_connected",
);
ok(
  "wired at another deployment -> webhook_elsewhere",
  crewInboxCapability({ line: goodLine, expectedWebhookUrl: "https://preview.fieldquo.com/api/crew/inbound" })
    .reason === "webhook_elsewhere",
);
ok(
  "everything right -> ready",
  crewInboxCapability({ line: goodLine, expectedWebhookUrl: goodLine.webhookUrl }).ready === true,
);
ok("only Twilio is ever SMS-capable", SMS_CAPABLE_PROVIDERS.has("twilio") && !SMS_CAPABLE_PROVIDERS.has("retell"));

// ══ The day boundary ═══════════════════════════════════════════════════════
//
// Read in the COMPANY's zone. The version that used the server's midnight lost
// every evening photo on a UTC host, which is every Vercel host.

console.log("\nToday, in the company's timezone");
const evening = new Date("2026-08-25T03:30:00Z"); // 23:30 on the 24th in Montreal
const mtl = dayBoundsIn(evening, "America/Toronto");
ok("the day starts at local midnight", mtl.start.toISOString() === "2026-08-24T04:00:00.000Z", mtl.start.toISOString());
ok("...and ends at the next local midnight", mtl.end.toISOString() === "2026-08-25T04:00:00.000Z", mtl.end.toISOString());
const eveningVisit = new Date("2026-08-24T22:00:00Z"); // 18:00 local, same working day
ok(
  "an evening visit falls INSIDE the crew's own day",
  eveningVisit >= mtl.start && eveningVisit < mtl.end,
);
ok(
  "...which the server's UTC midnight would have excluded",
  eveningVisit < new Date("2026-08-25T00:00:00Z"),
);

console.log("\nDST days are 23 or 25 hours, not 24");
const spring = dayBoundsIn(new Date("2026-03-08T12:00:00Z"), "America/Toronto");
ok("spring forward is 23 hours", (spring.end - spring.start) / 3600000 === 23, (spring.end - spring.start) / 3600000);
const fall = dayBoundsIn(new Date("2026-11-01T12:00:00Z"), "America/Toronto");
ok("fall back is 25 hours", (fall.end - fall.start) / 3600000 === 25, (fall.end - fall.start) / 3600000);
let survived = true;
try { dayBoundsIn(new Date(), "Not/AZone"); } catch { survived = false; }
ok("a nonsense zone falls back rather than throwing", survived);

// ══ It refuses to guess ════════════════════════════════════════════════════

console.log("\nMore than one job today -> ask, never pick");
const OAK = { jobId: "oak", jobTitle: "Repaint", clientName: "Sam Rivera", address: "123 Oak St" };
const MAPLE = { jobId: "maple", jobTitle: "Deck", clientName: "Priya Shah", address: "45 Maple Ave" };
const bare = attributeMessage({ candidates: [OAK, MAPLE], text: "" });
ok("no job is chosen", bare.jobId === null, bare);
ok("...it asks", bare.needsConfirmation === true && bare.method === "ask");
ok("...between exactly the two", bare.candidates.length === 2);
const decided = decideAction({ inbound: { hasMedia: true, mediaCount: 1 }, candidates: [OAK, MAPLE] });
ok("the action is 'ask', not 'file'", decided.action === "ask", decided.action);
ok(
  "three jobs and an ambiguous note still asks",
  decideAction({
    inbound: { text: "done for today", hasMedia: true, mediaCount: 1 },
    candidates: [OAK, MAPLE, { jobId: "l", clientName: "Chris Bond", address: "9 Rue Principale" }],
  }).action === "ask",
);

// ══ What it costs, and who is refused ══════════════════════════════════════

console.log("\nPricing: a photo is not a text");
ok("one SMS segment", costForMessage({ segments: 1 }) === CREW_SMS_CENTS);
ok("three segments cost three", costForMessage({ segments: 3 }) === CREW_SMS_CENTS * 3);
ok("a photo costs the MMS rate", costForMessage({ hasMedia: true }) === CREW_MMS_CENTS);
ok("a photo is billed once however much text rides along", costForMessage({ hasMedia: true, segments: 5 }) === CREW_MMS_CENTS);
ok("MMS costs more than SMS, or the rate card is a lie", CREW_MMS_CENTS > CREW_SMS_CENTS);

console.log("\nPricing refuses nonsense rather than inventing a charge");
ok("Infinity segments -> no charge", costForMessage({ segments: Infinity }) === 0);
ok("1e400 parses to Infinity and is refused", costForMessage({ segments: Number("1e400") }) === 0);
ok("NaN -> no charge", costForMessage({ segments: NaN }) === 0);
ok("zero -> no charge", costForMessage({ segments: 0 }) === 0);
ok("negative -> no charge", costForMessage({ segments: -3 }) === 0);
ok("a forged 10,000 segments is capped", costForMessage({ segments: 10000 }) === CREW_SMS_CENTS * 10);
ok("every price is a finite integer", Number.isInteger(costForMessage({ segments: 4 })));

console.log("\nSegment counting");
ok("empty body is not a message", segmentsFor("") === 0);
ok("a short text is one segment", segmentsFor("ok") === 1);
ok("160 ASCII chars is one", segmentsFor("x".repeat(160)) === 1);
ok("161 ASCII chars is two", segmentsFor("x".repeat(161)) === 2);
ok("an emoji drops it to the UCS-2 sizes", segmentsFor("x".repeat(71) + "\u{1F44D}") === 2);

console.log("\nNo credit: receive and file, withhold the reply");
const broke = crewSpendVerdict({ balanceCents: 0, replyCents: CREW_SMS_CENTS });
ok("the reply is refused", broke.canReply === false);
ok("...but the line stays up, so the photo still arrives", broke.canReceive === true);
const under = crewSpendVerdict({ balanceCents: -50 });
ok("a small overdraft still receives", under.canReceive === true);
ok("...and still refuses to reply", under.canReply === false);
const floored = crewSpendVerdict({ balanceCents: -CREW_OVERDRAFT_FLOOR_CENTS });
ok("at the floor the line is cut", floored.canReceive === false);
ok("past the floor the line is cut", crewSpendVerdict({ balanceCents: -99999 }).canReceive === false);
ok("the floor is a real limit, not zero", CREW_OVERDRAFT_FLOOR_CENTS > 0);
const funded = crewSpendVerdict({ balanceCents: 5000 });
ok("a funded company replies", funded.canReply === true && funded.canReceive === true);
ok("...and isn't nagged", funded.low === false);
ok("a nearly-empty balance is flagged low", crewSpendVerdict({ balanceCents: CREW_MMS_CENTS }).low === true);
ok("a garbage balance reads as zero, not as credit", crewSpendVerdict({ balanceCents: "abc" }).canReply === false);

console.log("\nMetering is idempotent by construction");
const msgSrc = readFileSync(new URL("../lib/crew/messaging.js", import.meta.url), "utf8");
ok("inbound is keyed on the stored message id", msgSrc.includes("`crew_in:${messageId}`"));
ok("outbound is keyed on the provider's SID", msgSrc.includes("`crew_out:${sid}`"));
ok("both go through the shared ledger writer", msgSrc.includes("debitCredit"));
ok("...and no parallel balance is invented", !/creditBalance|balanceColumn/.test(msgSrc));
ok("one ledger kind for crew texting", (msgSrc.match(/kind: "crew_text"/g) || []).length === 2);

const routeSrcSpend = readFileSync(new URL("../app/api/crew/inbound/route.js", import.meta.url), "utf8");
ok(
  "the reply is only charged after a real send returns a SID",
  /sent\?\.success && sent\.sid/.test(routeSrcSpend),
);
ok(
  "...so nothing is billed on an unverifiable TwiML delivery",
  !/twiml\(reply\)/.test(routeSrcSpend),
);
ok("the provider is cut off past the floor", routeSrcSpend.includes("disconnectForNonPayment"));

const inboxMeter = readFileSync(new URL("../lib/crew/inbox.js", import.meta.url), "utf8");
ok("inbound is metered on what the CARRIER delivered", inboxMeter.includes("hasMedia: mediaUrls.length > 0"));
ok(
  "a ledger failure never costs the crew their photo",
  /chargeInboundCrewMessage\([\s\S]{0,600}?\.catch\(/.test(inboxMeter),
);

// ══ Structural: the route can't quietly start trusting the sender ══════════

console.log("\nThe inbound route's own shape");
const routeSrc = readFileSync(new URL("../app/api/crew/inbound/route.js", import.meta.url), "utf8");
ok("it derives the tenant through tenantKeyFromInbound", routeSrc.includes("tenantKeyFromInbound(params)"));
ok("it refuses when the auth token is unset", /if \(!token \|\| !signature/.test(routeSrc));
ok("it validates the Twilio signature", routeSrc.includes("twilio.validateRequest"));

const lookup = routeSrc.slice(
  routeSrc.indexOf("crewInboxNumber.findUnique"),
  routeSrc.indexOf("crewInboxNumber.findUnique") + 400,
);
ok("the tenant lookup is keyed on the texted number", /where:\s*\{\s*e164:\s*to\s*\}/.test(lookup), lookup.slice(0, 120));
ok("...and mentions no sender field", !/From|senderPhone/.test(lookup));
ok("it asks capability before filing anything", routeSrc.includes("crewInboxCapability"));

const inboxSrc = readFileSync(new URL("../lib/crew/inbox.js", import.meta.url), "utf8");
ok(
  "the sender is only ever matched WITHIN an already-resolved company",
  /db\.worker\.findMany\(\{\s*where:\s*\{\s*companyId,/.test(inboxSrc),
);
ok(
  "a filing that landed nothing is not recorded as filed",
  inboxSrc.includes("if (!filed)") && /return true;/.test(inboxSrc),
);
ok(
  "the pending question is time-bounded",
  inboxSrc.includes("ANSWER_WINDOW_MS") && /createdAt: \{ gte:/.test(inboxSrc),
);
ok("a superseded question is actually marked so", /status: "superseded"/.test(inboxSrc));

// ══ The panel renders each thing ONCE ══════════════════════════════════════
//
// The bug the owner found: the blocker sentence printed twice, verbatim. Two
// correct conditions in different halves of a 200-line component, coinciding
// only at runtime — invisible to a build, a lint and a reader. So the panel's
// choice of blocks is a pure function now (lib/crew/panelBlocks.js) and every
// state a contractor can be in is walked here.

console.log("\nThe setup panel shows each thing once, in every state");
const UNAVAILABLE = { ready: false, reason: "not_configured", messageKey: "app.crewSetup.ready.unavailable" };
const READY = { ready: true, reason: "ready", messageKey: "app.crewSetup.ready.ready" };
const NO_LINE = { ready: false, reason: "no_line", messageKey: "app.crewSetup.ready.noLine" };
const LIVE = { e164: "+15145551234", expiresAt: null };
const FUNDED = crewSpendVerdict({ balanceCents: 5000 });
const BROKE = crewSpendVerdict({ balanceCents: -CREW_OVERDRAFT_FLOOR_CENTS });

const PANEL_STATES = [
  ["deployment can't run it", { deployment: { available: false }, capability: UNAVAILABLE, spend: FUNDED, test: {} }],
  ["...even with a line and numbers and credit", {
    deployment: { available: false }, capability: UNAVAILABLE, line: LIVE,
    owned: [{ e164: "+15145551234" }, { e164: "+14385550000" }], spend: FUNDED, test: { to: "+15145559999" },
  }],
  ["no numbers to lend", { deployment: { available: true }, capability: NO_LINE, owned: [], spend: FUNDED, test: { to: "+1" } }],
  ["one number, claimable", { deployment: { available: true }, capability: NO_LINE, owned: [{ e164: "+15145551234" }], spend: FUNDED, test: { to: "+1" } }],
  ["several numbers to pick from", { deployment: { available: true }, capability: NO_LINE, owned: [{ e164: "+1" }, { e164: "+2" }], spend: FUNDED, test: { to: "+1" } }],
  ["live and healthy", { deployment: { available: true }, capability: READY, line: LIVE, provider: { sms: true, mms: true }, spend: FUNDED, test: { to: "+1" } }],
  ["live on a shared loan", { deployment: { available: true }, capability: READY, line: { ...LIVE, expiresAt: new Date() }, spend: FUNDED, test: { to: "+1" } }],
  ["live but SMS-only", { deployment: { available: true }, capability: READY, line: LIVE, provider: { sms: true, mms: false }, spend: FUNDED, test: { to: "+1" } }],
  ["no mobile on the staff profile", { deployment: { available: true }, capability: READY, line: LIVE, spend: FUNDED, test: { to: null } }],
  ["credit spent, line cut", { deployment: { available: true }, capability: { ready: false, reason: "not_connected" }, line: LIVE, spend: BROKE, test: { to: "+1" } }],
  ["nothing known at all", {}],
];

for (const [label, input] of PANEL_STATES) {
  const { blocks, actions } = crewPanelBlocks(input);
  const dupeBlock = blocks.find((b, i) => blocks.indexOf(b) !== i);
  const dupeAction = actions.find((a, i) => actions.indexOf(a) !== i);
  ok(`${label}: no block renders twice`, dupeBlock === undefined, dupeBlock);
  ok(`${label}: no action offered twice`, dupeAction === undefined, dupeAction);
  // The status sentence and the number are the two mutually exclusive halves of
  // the same slot. Both at once is the duplicate wearing a different hat.
  ok(
    `${label}: the capability sentence has exactly one home`,
    ["blocker", "status", "number"].filter((b) => blocks.includes(b)).length === 1,
    blocks,
  );
}

console.log("\nA deployment that can't run it says so, and offers nothing else");
const blocked = crewPanelBlocks({
  deployment: { available: false },
  capability: UNAVAILABLE,
  owned: [{ e164: "+15145551234" }],
  spend: FUNDED,
  test: { to: null },
});
ok("exactly one block", blocked.blocks.length === 1, blocked.blocks);
ok("...and it is the blocker", blocked.blocks[0] === "blocker");
ok("no claim button — it would be refused on press", !blocked.actions.includes("claim"));
ok("no actions at all", blocked.actions.length === 0, blocked.actions);
// The old copy promised a number added to our Twilio account "appears here to
// switch on". In this exact state it never would: the switch is gated on the
// deployment too. A promise a screen cannot keep is the dead control.
ok("...and no number list promising a switch that can't switch", !blocked.blocks.includes("noNumbers"));
ok(
  "...and no rate card advertising a meter that isn't running",
  !blocked.blocks.includes("credit"),
);

console.log("\nControls appear only when pressing them would do something");
ok(
  "no claim while the credit is spent",
  !crewPanelBlocks({
    deployment: { available: true }, capability: NO_LINE,
    owned: [{ e164: "+1" }], spend: BROKE,
  }).actions.includes("claim"),
);
// The positive half of the copy's promise: "it'll appear here once there is
// one". Executed rather than trusted — the old sentence said a number added to
// our Twilio account "appears here to switch on", and in the state the owner was
// actually in the switch was gated on the deployment as well, so it never would.
{
  const withOne = crewPanelBlocks({
    deployment: { available: true }, capability: NO_LINE,
    owned: [{ e164: "+15145551234" }], spend: FUNDED, test: { to: "+1" },
  });
  ok("a number the account holds really does become claimable", withOne.actions.includes("claim"));
  ok("...and the 'no numbers' sentence stops being shown", !withOne.blocks.includes("noNumbers"));
}
ok(
  "no claim when the account holds no number",
  !crewPanelBlocks({
    deployment: { available: true }, capability: NO_LINE, owned: [], spend: FUNDED,
  }).actions.includes("claim"),
);
ok(
  "no test text without a mobile to send it to",
  !crewPanelBlocks({
    deployment: { available: true }, capability: READY, line: LIVE, spend: FUNDED, test: { to: null },
  }).actions.includes("test"),
);
ok(
  "...and the prompt to add one is shown instead",
  crewPanelBlocks({
    deployment: { available: true }, capability: READY, line: LIVE, spend: FUNDED, test: { to: null },
  }).blocks.includes("addPhone"),
);
ok(
  "no turn-off button without a line to turn off",
  !crewPanelBlocks({ deployment: { available: true }, capability: NO_LINE }).actions.includes("off"),
);

// ══ No integration detail reaches a tenant ═════════════════════════════════
//
// The owner read `https://www.fieldquo.com/api/crew/inbound` off his own screen
// and clicked it. It is a POST-only webhook address — a browser renders nothing
// — and it was never his to configure: FieldQuo holds the Twilio account and
// lends the number, exactly as it holds the Retell account and provisions the
// voice line. Publishing it also invited someone to wire a private number
// straight at our endpoint, around the claim whose unique CrewInboxNumber.e164
// is the only guarantee a crew photo cannot land on a stranger's job.

console.log("\nThe tenant screen leaks no webhook, no env var, no provider URL");
const TENANT_FILES = [
  "../app/app/crew-inbox/page.js",
  "../app/api/crew/line/route.js",
  "../lib/crew/panelBlocks.js",
];
// Matched against CODE only. The files carry long comments explaining exactly
// which endpoint was removed and why, and a check that failed on the
// explanation would delete the reason along with the bug.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

for (const rel of TENANT_FILES) {
  const code = stripComments(readFileSync(new URL(rel, import.meta.url), "utf8"));
  const name = rel.split("/").slice(-2).join("/");
  ok(`${name}: no inbound webhook path`, !code.includes("api/crew/inbound"), name);
  ok(`${name}: no provider smsUrl`, !/smsUrl/.test(code), name);
  ok(`${name}: names no env var`, !/TWILIO_|process\.env/.test(code), name);
  ok(`${name}: no ops half of the verdict`, !/opsMessage/.test(code), name);
}

// The crew route has to COMPUTE the inbound URL — it is what crewInboxCapability
// compares a row against to catch drift. What it must never do is hand it to the
// browser. So the response literal is checked, not the whole file.
{
  const src = readFileSync(new URL("../app/api/crew/line/route.js", import.meta.url), "utf8");
  // The LAST return in GET, not the first: the first is the permission refusal
  // `NextResponse.json({ error }, ...)`, and slicing from there swept in the
  // `const webhookUrl = …` the drift comparison legitimately needs.
  const endOfGet = src.indexOf("export async function POST");
  const payload = src.slice(src.lastIndexOf("return NextResponse.json({", endOfGet), endOfGet);
  const code = stripComments(payload);
  ok("the tenant payload carries no webhook URL", !/webhookUrl/.test(code));
  ok("...no provider smsUrl", !/smsUrl/.test(code));
  ok("...and no ops half of the verdict", !/opsMessage/.test(code));
  // capability is destructured field by field rather than spread, so a field
  // added to the verdict later cannot ride into the tenant payload by accident.
  ok("...and the verdict is copied field by field, never spread", !/\.\.\.capability/.test(code));
}

console.log("\n...and the strings it prints don't either");
for (const [lang, catalogue] of Object.entries(APP_MESSAGES)) {
  const leaks = Object.entries(catalogue)
    .filter(([k]) => k.startsWith("app.crewSetup.") || k.startsWith("app.crewInbox."))
    .filter(([, v]) => /TWILIO|api\/crew|webhook|smsUrl|env var|deployment/i.test(String(v)))
    .map(([k]) => k);
  ok(`${lang}: no crew string names our infrastructure`, leaks.length === 0, leaks);
}

// The webhook URL still has to live SOMEWHERE — it is genuinely needed to wire
// a number by hand. It lives on the platform screen, and it must not be an
// anchor there either: it is POST-only, so a link renders a blank page and
// reads as broken. A copy control is the honest affordance.
console.log("\nThe platform screen carries it instead — copied, never linked");
const platformPage = readFileSync(new URL("../app/platform/crew-lines/page.js", import.meta.url), "utf8");
ok("the platform page prints the webhook URL", platformPage.includes("deployment.webhookUrl"));
ok(
  "...inside a <code>, not an <a href>",
  /<code[^>]*>\s*\{deployment\.webhookUrl\}/.test(platformPage),
);
ok(
  "...with no anchor wrapping it",
  !/<a[^>]*href=\{deployment\.webhookUrl\}/.test(platformPage) &&
    !/href=\{[^}]*webhookUrl/.test(platformPage),
);
ok("...and a copy button", /onClick=\{\(\) => copy\(deployment\.webhookUrl/.test(platformPage));
ok("...labelled as something to paste into Twilio", /Paste this into/.test(platformPage));
ok("...and said plainly not to be a page", /not a page/.test(platformPage));
// A dash with no explanation is what "Twilio delivers texts to: —" was. Absent
// has to be a sentence.
ok(
  "an unset webhook says what its absence means, rather than printing a dash",
  /no message webhook is set on this number/.test(platformPage),
);
ok("the platform route is superadmin-gated", readFileSync(new URL("../app/api/platform/crew-lines/route.js", import.meta.url), "utf8").includes("getCurrentPlatformAdmin"));

// ══ Webhook drift ══════════════════════════════════════════════════════════
//
// The failure this audit exists for: a number whose smsUrl points at a dead
// preview deployment keeps a green tick in our row and delivers a tenant's crew
// photos into a branch database. Invisible from the tenant, invisible from our
// row, visible only by asking Twilio and comparing.

console.log("\nThe platform audit sees drift our own row can't");
const HERE = "https://www.fieldquo.com/api/crew/inbound";
const THERE = "https://preview-abc.vercel.app/api/crew/inbound";
const connectedRow = {
  e164: "+15145551234", companyId: "c1", provider: "twilio", source: "shared_test",
  providerId: "PN1", webhookUrl: HERE, connectedAt: new Date("2026-08-01"), expiresAt: null,
  company: { name: "Big Painter Inc", crewInboxEnabled: true },
};

const healthy = auditCrewLines({
  numbers: [{ e164: "+15145551234", sid: "PN1", mms: true, smsUrl: HERE }],
  rows: [connectedRow],
  expectedWebhookUrl: HERE,
  signatureConfigured: true,
});
ok("a healthy line is not flagged", healthy.counts.drifting === 0, healthy.lines[0]);
ok("...and reads as claimed", healthy.counts.claimed === 1 && healthy.counts.free === 0);
ok("...and ready", healthy.lines[0].claim.ready === true);

const drifted = auditCrewLines({
  numbers: [{ e164: "+15145551234", sid: "PN1", mms: true, smsUrl: THERE }],
  rows: [connectedRow],
  expectedWebhookUrl: HERE,
  signatureConfigured: true,
});
ok("a number pointed at another deployment IS flagged", drifted.counts.drifting === 1);
// The point of the whole audit: our row is happy. It says connected, to the URL
// we expect, and crewInboxCapability calls it ready. Nothing built from our own
// record can see this, which is why the comparison is against TWILIO's answer.
ok("...even though our own row says connected", drifted.lines[0].claim.connectedAt !== null);
ok("...and our own verdict still reads ready", drifted.lines[0].claim.ready === true);
ok("...so the drift gets its own sentence", Boolean(drifted.lines[0].driftMessage));
ok("...naming where the texts are actually going", /preview-abc/.test(drifted.lines[0].driftMessage), drifted.lines[0].driftMessage);
ok("a healthy line has no drift sentence to print", healthy.lines[0].driftMessage === null);

const unpointed = auditCrewLines({
  numbers: [{ e164: "+15145551234", sid: "PN1", mms: true, smsUrl: null }],
  rows: [connectedRow],
  expectedWebhookUrl: HERE,
  signatureConfigured: true,
});
ok("a number with NO webhook at all is drift too", unpointed.counts.drifting === 1);
ok("...and says the texts are being dropped, not misrouted", /dropped silently/.test(unpointed.lines[0].driftMessage), unpointed.lines[0].driftMessage);
ok("...and is distinguishable from pointed-elsewhere", unpointed.lines[0].pointedSomewhere === false);

const orphaned = auditCrewLines({
  numbers: [],
  rows: [connectedRow],
  expectedWebhookUrl: HERE,
  signatureConfigured: true,
});
ok("a claimed number Twilio doesn't hold is an orphan", orphaned.counts.orphaned === 1);
ok("...and is not double-counted as drift", orphaned.counts.drifting === 0);
ok("...and still names the company holding it", orphaned.orphans[0].claim.companyName === "Big Painter Inc");

const free = auditCrewLines({
  numbers: [{ e164: "+14385550000", sid: "PN2", mms: false, smsUrl: null }],
  rows: [],
  expectedWebhookUrl: HERE,
  signatureConfigured: true,
});
ok("an unclaimed number is free to lend", free.counts.free === 1 && free.lines[0].claim === null);
ok("...and its lack of MMS is recorded as false, not as unknown", free.lines[0].mms === false);
ok("an orphan's unknown MMS stays null rather than becoming false", orphaned.orphans[0].mms === null);

console.log("\nThe audit survives shapes it will meet in production");
ok("no arguments at all", auditCrewLines().counts.held === 0);
ok("nulls where arrays belong", auditCrewLines({ numbers: null, rows: null }).counts.held === 0);
ok("a number row with no e164 is skipped", auditCrewLines({ numbers: [{ sid: "PN9" }, null] }).counts.held === 0);
ok(
  "no expected URL means nothing is called drift",
  auditCrewLines({
    numbers: [{ e164: "+1", smsUrl: THERE }],
    rows: [{ ...connectedRow, e164: "+1" }],
    expectedWebhookUrl: null,
  }).counts.drifting === 1,
);

// ══ The price on the screen is the price on the meter ══════════════════════
//
// "2¢ a text" was true of a short text and false of a long one. Twilio bills
// SMS per SEGMENT and costForMessage follows it, so a 200-character update
// costs 4¢ against a screen quoting 2¢ — the contractor finds out on the
// statement. The screen now states the unit, and it states it from the same
// constant segmentsFor measures with.

console.log("\nThe rate card states the unit the meter actually uses");
const en = APP_MESSAGES.en;
ok("the rate string mentions the segment length", /\{chars\}/.test(en["app.crewSetup.rates"]), en["app.crewSetup.rates"]);
ok("...and the per-text and per-photo prices", /\{sms\}/.test(en["app.crewSetup.rates"]) && /\{mms\}/.test(en["app.crewSetup.rates"]));
ok(
  "the credit screen says crew texting spends the same balance",
  /\{sms\}/.test(en["app.setVoice.crewRate"]) && /\{chars\}/.test(en["app.setVoice.crewRate"]),
  en["app.setVoice.crewRate"],
);
for (const lang of Object.keys(APP_MESSAGES)) {
  const v = APP_MESSAGES[lang]["app.crewSetup.rates"];
  ok(`${lang}: the rate string keeps all three placeholders`, /\{sms\}/.test(v) && /\{mms\}/.test(v) && /\{chars\}/.test(v), v);
}

console.log("\nThe stated segment length is the one the meter measures with");
ok("a text of exactly the stated length is one segment", segmentsFor("x".repeat(SMS_SEGMENT_CHARS)) === 1);
ok("...one character more is two", segmentsFor("x".repeat(SMS_SEGMENT_CHARS + 1)) === 2);
ok("...and costs twice the quoted rate", costForMessage({ segments: segmentsFor("x".repeat(SMS_SEGMENT_CHARS + 1)) }) === CREW_SMS_CENTS * 2);
ok("the quoted length is 160, the GSM-7 single-segment size", SMS_SEGMENT_CHARS === 160);

// Both routes that quote a price read it from the constants the webhook debits
// with. A rate card that can drift from the meter is worse than none.
const lineRoute = readFileSync(new URL("../app/api/crew/line/route.js", import.meta.url), "utf8");
ok("the crew route quotes SMS_SEGMENT_CHARS, not a literal", lineRoute.includes("smsSegmentChars: SMS_SEGMENT_CHARS"));
ok("...and the rates from the same module the webhook bills from", lineRoute.includes('from "@/lib/crew/messaging"'));
const voiceRoute = readFileSync(new URL("../app/api/settings/voice/route.js", import.meta.url), "utf8");
ok("the credit screen quotes them from that module too", voiceRoute.includes('from "@/lib/crew/messaging"'));
ok("...and sends the crew rate card with the balance", voiceRoute.includes("smsSegmentChars: SMS_SEGMENT_CHARS"));

// ══ A charge has to be findable, and it has to add up ══════════════════════
//
// Crew texts land in VoiceCreditEntry, which /app/settings/voice already prints
// as "Where the credit went" — so the record existed. What it said did not add
// up: a three-segment text was debited 6¢ under a note reading "Crew text
// received @ 2¢". A statement whose description contradicts its own amount is
// the short road from a support call to a card dispute.

console.log("\nA charge on the statement reconciles against its own amount");
const oneSeg = crewChargeNote({ direction: "in", segments: 1, party: "+15145551234" });
ok("a plain text names the price", oneSeg.includes(`${CREW_SMS_CENTS}¢`), oneSeg);
ok("...and does not clutter it with a ×1", !oneSeg.includes("1 ×"), oneSeg);
const threeSeg = crewChargeNote({ direction: "in", segments: 3, party: "+15145551234" });
ok("a split text shows the multiplier", threeSeg.includes(`3 × ${CREW_SMS_CENTS}¢`), threeSeg);
ok(
  "...and the multiplier equals what was actually debited",
  costForMessage({ segments: 3 }) === 3 * CREW_SMS_CENTS,
);
const photo = crewChargeNote({ direction: "in", hasMedia: true, party: "+15145551234" });
ok("a photo is priced at the MMS rate", photo.includes(`${CREW_MMS_CENTS}¢`), photo);
ok("...and is not described as a text", !/text received/i.test(photo), photo);
ok("a reply is distinguishable from an inbound", crewChargeNote({ direction: "out", segments: 1 }).includes("sent"));

console.log("\n...and can be matched to the message that caused it");
ok("the sender's last four digits are on the line", oneSeg.includes("1234"), oneSeg);
ok("...and the full number is not", !oneSeg.includes("5145551234") && !oneSeg.includes("+1"), oneSeg);
ok("no sender is simply omitted, not faked", !crewChargeNote({ direction: "in", segments: 1 }).includes("·"));
ok("a nonsense sender doesn't produce a nonsense tag", !crewChargeNote({ direction: "in", party: "not a phone" }).includes("·"));
ok("every note is a non-empty string", ["in", "out"].every((d) => crewChargeNote({ direction: d }).length > 8));
// A forged NumSegments must not invent a note that promises more than the cap
// actually charged.
ok(
  "a forged segment count is capped in the note as it is in the charge",
  crewChargeNote({ direction: "in", segments: 10000 }).includes(`10 × ${CREW_SMS_CENTS}¢`),
  crewChargeNote({ direction: "in", segments: 10000 }),
);

const msgSrc2 = readFileSync(new URL("../lib/crew/messaging.js", import.meta.url), "utf8");
ok("both charges write a note through the one builder", (msgSrc2.match(/crewChargeNote\(/g) || []).length >= 3);
ok("...and neither hand-rolls its own wording", !/note: `Crew /.test(msgSrc2));
const inboxSrc2 = readFileSync(new URL("../lib/crew/inbox.js", import.meta.url), "utf8");
ok("the sender travels to the meter so the note can name it", /from: fromE164 \|\| fromPhone/.test(inboxSrc2));
const inboundSrc2 = readFileSync(new URL("../app/api/crew/inbound/route.js", import.meta.url), "utf8");
ok("...and so does the reply's recipient", /to: from,/.test(inboundSrc2));

console.log("\nThe statement the contractor is pointed at really shows them");
const voicePage = readFileSync(new URL("../app/app/settings/voice/page.js", import.meta.url), "utf8");
ok("the credit card has the anchor the crew inbox links to", voicePage.includes('id="credit"'));
ok("...the statement prints each entry's note", voicePage.includes("{e.note || e.kind}"));
ok("...and its amount", voicePage.includes("money(Math.abs(e.cents))"));
ok("...and the crew rate is stated on it", voicePage.includes("app.setVoice.crewRate"));
const crewPage = readFileSync(new URL("../app/app/crew-inbox/page.js", import.meta.url), "utf8");
ok("the crew panel links to that anchor", crewPage.includes("/app/settings/voice#credit"));
ok("...and nothing filters crew rows out of the ledger read", !/kind: "call"/.test(readFileSync(new URL("../lib/voice/credits.js", import.meta.url), "utf8").slice(
  readFileSync(new URL("../lib/voice/credits.js", import.meta.url), "utf8").indexOf("export async function recentEntries"),
)));

// ══ The one thing the contractor IS told to do ═════════════════════════════
//
// "Add your own mobile to your staff profile so the inbox recognises your
// texts." True, necessary — and impossible. Worker.phone was writable exactly
// once, on the invite form; the Workers screen had no phone field and the PATCH
// route did not accept one. An owner whose record predated the field read an
// instruction with nowhere to carry it out.

console.log("\n'Add your mobile' is an instruction that can be carried out");
const workerRoute = readFileSync(new URL("../app/api/workers/[id]/route.js", import.meta.url), "utf8");
ok("the worker PATCH accepts a phone", /const \{[^}]*\bphone\b/.test(workerRoute));
ok("...and writes it", /phone: phoneValue/.test(workerRoute));
ok("...refusing a number that could never match", /toE164\(phone\)/.test(workerRoute));
ok("...and treating an empty one as cleared, not as a match on nothing", /phoneValue = null/.test(workerRoute));
const workersPage = readFileSync(new URL("../app/app/settings/team/workers/page.js", import.meta.url), "utf8");
ok("the Workers screen renders a mobile field", workersPage.includes("app.setWorkers.mobile"));
ok("...bound to the form", /form\.phone/.test(workersPage));
ok("...and sends it on save", /phone: form\.phone/.test(workersPage));
ok(
  "the crew inbox links to that screen rather than naming it in prose",
  crewPage.includes('href="/app/settings/team/workers"'),
);
ok("...and the matcher it feeds is the roster phone", /toE164\(w\.phone\) === fromE164/.test(inboxSrc2));


// ══ Who may SET UP crew texting, and whose messages each person reads ══════
//
// Both rules are executed against the REAL preset grids rather than a copy of
// them, because the whole failure being repaired is that a role check could not
// see the difference between two presets sharing one role.
//
// What was wrong:
//
//   * The gate was `requirePermission(role, "user:manage")`. Manager AND
//     Dispatcher both map to `supervisor`, and supervisor holds user:manage, so
//     the dispatcher the spec excludes was admitted.
//   * The refusal said "Only an owner or admin can set up crew texting" — false
//     in both directions at once. It excluded the manager the spec includes and
//     the dispatcher the code was letting through.
//   * GET /api/crew/messages listed the whole company's inbox to anyone signed
//     in, and PATCH would file any of those rows, so the lowest tier read and
//     re-filed every other crew member's photos.
//
// Mutation-verified when written: swapping `jobCosting` for `payments` in
// canSetUpCrewTexting still passes (the two presets differ on both), so the
// assertion below pins the toggle by NAME as well as by outcome; dropping the
// `hasToggle` half entirely fails the Dispatcher assertions, and dropping the
// `can(...)` half fails the Crew ones.

console.log("\nWho may set up crew texting");

const gridFor = (presetKey) => ({
  id: `m-${presetKey}`,
  userId: `u-${presetKey}`,
  role: PRESET_TO_ROLE[presetKey],
  permissions: PERMISSION_PRESETS[presetKey].values,
});
// owner and admin have no preset — the grid never applies to them.
const tierMember = (role) => ({ id: `m-${role}`, userId: `u-${role}`, role, permissions: null });

ok("a Manager can set up crew texting", canSetUpCrewTexting(gridFor("manager")));
ok("an owner can", canSetUpCrewTexting(tierMember("owner")));
ok("an admin can", canSetUpCrewTexting(tierMember("admin")));
ok("a Dispatcher CANNOT — same role as the Manager, different grid", !canSetUpCrewTexting(gridFor("dispatcher")));
ok("...and they really do share one role", PRESET_TO_ROLE.manager === PRESET_TO_ROLE.dispatcher);
ok("Crew cannot", !canSetUpCrewTexting(gridFor("worker")));
ok("an Estimator cannot", !canSetUpCrewTexting(gridFor("estimator")));
ok("the platform console's read-only viewer cannot", !canSetUpCrewTexting(tierMember("viewer")));
ok("nobody at all is not somebody", !canSetUpCrewTexting(null) && !canSetUpCrewTexting(undefined));

// The set, stated as a set: of the five presets an owner can hand out, exactly
// one passes. A sixth preset appearing on the manager side of the line has to
// be a deliberate edit here, not a silent widening.
const passingPresets = Object.keys(PERMISSION_PRESETS).filter((k) => canSetUpCrewTexting(gridFor(k)));
ok("exactly one preset passes, and it is Manager", passingPresets.length === 1 && passingPresets[0] === "manager", passingPresets);

// The discriminator, pinned by name. Outcome alone can't pin it: manager and
// dispatcher differ on `jobCosting` AND `payments`, so either would pass every
// assertion above while meaning something different on screen.
const mgr = PERMISSION_PRESETS.manager.values;
const dsp = PERMISSION_PRESETS.dispatcher.values;
ok("jobCosting is what separates them", mgr.jobCosting === true && dsp.jobCosting === false);
ok(
  "...and the predicate is the one reading it",
  /hasToggle\(member, "jobCosting"\)/.test(readFileSync(new URL("../lib/crew/access.js", import.meta.url), "utf8")),
);
// A Manager granted the toggle but demoted below user:manage is not a manager.
ok(
  "jobCosting alone is not enough — the authority half still holds",
  !canSetUpCrewTexting({ role: "employee", permissions: { ...mgr, jobCosting: true } }),
);
// And a supervisor whose grid predates the toggle falls back to the coarse
// role, the same as everywhere else in enforce.js. ROLE_LABELS.supervisor is
// "Manager", so the sentence below is true of them too.
ok("a supervisor with no grid stored falls back to the role", canSetUpCrewTexting(tierMember("supervisor")));

console.log("\nThe refusal names the set it actually enforces");
ok("it names the owner", /owner/i.test(CREW_SETUP_DENIAL));
ok("...the admin", /admin/i.test(CREW_SETUP_DENIAL));
ok("...and the manager, who the old sentence left out", /manager/i.test(CREW_SETUP_DENIAL));
ok("it does not name the dispatcher it now refuses", !/dispatcher/i.test(CREW_SETUP_DENIAL));
ok("the old, false sentence is gone from the route", !lineRoute.includes("Only an owner or admin can set up crew texting"));
ok("...and the route refuses with the shared constant", lineRoute.includes("CREW_SETUP_DENIAL"));
ok("...through the shared predicate, not a bare role check", lineRoute.includes("canSetUpCrewTexting("));
ok(
  "...with the grid loaded, since the session shape carries none",
  lineRoute.includes("loadEnforceableMember(db, member.id)"),
);
ok("no user:manage check survives in the route", !/requirePermission\(\s*member\.role/.test(lineRoute));
// Setup, buy/claim/test and release are one authority, not three.
ok("GET, POST and DELETE all pass through the one gate", (lineRoute.match(/await requireAdmin\(request/g) || []).length === 3);

// ══ "Only the messages pertinent to them" ══════════════════════════════════
//
// What a message is associated WITH, established from the schema rather than
// assumed: CrewInboundMessage.senderUserId, resolved from the sender's phone
// against the Worker roster. It is the only per-person handle there is —
// CrewInboxNumber is keyed `companyId @unique`, one line per COMPANY, so
// "the number assigned to them" is not a filter that exists.

console.log("\nA crew message is associated with a person, and that is what scopes it");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const inboundModel = schema.slice(schema.indexOf("model CrewInboundMessage {"));
ok("CrewInboundMessage carries a senderUserId", /senderUserId String\?/.test(inboundModel.slice(0, 2000)));
const numberModel = schema.slice(schema.indexOf("model CrewInboxNumber {"), schema.indexOf("model CrewInboundMessage {"));
ok("the crew LINE is per company, not per worker", /companyId String  @unique/.test(numberModel));
ok("...so there is no per-worker number to scope by", !/workerId|userId/.test(numberModel));

console.log("\nWhose messages each tier reads");
const scopeOf = (m) => crewMessageScope(m);
ok("Crew see only their own", scopeOf(gridFor("worker")).senderUserId === "u-worker", scopeOf(gridFor("worker")));
ok("an Estimator likewise — their schedule dial says 'their own' too", scopeOf(gridFor("estimator")).senderUserId === "u-estimator");
ok("a Dispatcher sees everyone's", seesAllCrewMessages(gridFor("dispatcher")), scopeOf(gridFor("dispatcher")));
ok("a Manager sees everyone's", seesAllCrewMessages(gridFor("manager")));
ok("an owner sees everyone's", seesAllCrewMessages(tierMember("owner")));
ok("an admin sees everyone's", seesAllCrewMessages(tierMember("admin")));
// Non-negotiable #3: the platform console views everything and edits nothing.
ok(
  "the platform console is never narrowed",
  seesAllCrewMessages({ id: null, userId: null, role: "viewer", permissions: null, impersonation: true }),
);
// The dial that decides it is the one already on the screen, not a new one.
ok(
  "the schedule dial is what moves the line",
  seesAllCrewMessages({ role: "employee", userId: "u1", permissions: { ...PERMISSION_PRESETS.worker.values, schedule: "edit_all" } }) &&
    !seesAllCrewMessages({ role: "supervisor", userId: "u1", permissions: { ...PERMISSION_PRESETS.manager.values, schedule: "view_own" } }),
);
// Absence of an identity is not an identity. `{ senderUserId: null }` is a
// POSITIVE match on every message from a number that isn't on the roster —
// exactly the unknown-sender queue a scoped member must not see.
const orphanScope = scopeOf({ role: "employee", userId: null, permissions: PERMISSION_PRESETS.worker.values });
ok("a scoped member with no userId matches nothing, not the unknown senders", orphanScope.senderUserId === "__none__", orphanScope);
ok("...and neither does nobody", scopeOf(null).senderUserId === "__none__");

console.log("\nThe read scope and the manual-file write are the same scope");
const messagesRoute = readFileSync(new URL("../app/api/crew/messages/route.js", import.meta.url), "utf8");
ok("the list applies it", /companyId: member\.companyId, \.\.\.scope/.test(messagesRoute));
ok("...and it is computed, not assumed", messagesRoute.includes("crewMessageScope(await graded(member))"));
ok("...off a loaded grid", messagesRoute.includes("loadEnforceableMember(db, member.id)"));
ok("the PATCH passes the same scope through", /scope: crewMessageScope\(await graded\(member\)\)/.test(messagesRoute));
const inboxSrc3 = readFileSync(new URL("../lib/crew/inbox.js", import.meta.url), "utf8");
ok(
  "...and fileHeldMessage narrows its lookup with it",
  /where: \{ id: messageId, companyId, \.\.\.scope \}/.test(inboxSrc3),
);
ok(
  "an out-of-scope id is 'no such message', not a 403 that confirms it exists",
  /if \(!msg\) return \{ ok: false, reason: "No such message\.", status: 404 \}/.test(inboxSrc3),
);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
