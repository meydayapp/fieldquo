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
import { dayBoundsIn } from "@/lib/crew/inbox";
import { attributeMessage } from "@/lib/crew/attribution";
import { decideAction } from "@/lib/crew/inboxLogic";
import {
  costForMessage,
  segmentsFor,
  crewSpendVerdict,
  CREW_SMS_CENTS,
  CREW_MMS_CENTS,
  CREW_OVERDRAFT_FLOOR_CENTS,
} from "@/lib/crew/messaging";

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
ok("...and says which env var is missing", /TWILIO_AUTH_TOKEN/.test(noToken.message), noToken.message);
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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
