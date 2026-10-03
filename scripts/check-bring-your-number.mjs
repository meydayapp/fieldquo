// scripts/check-bring-your-number.mjs
//
//   npm run check:bring-your-number
//
// "Bring your number" (lib/businessNumber/), executed — never read.
//
// Everything that talks to Twilio is swapped for a fake through the store's
// `deps` seam, and `@/lib/db` for the scriptable stub, so nothing here reaches
// live Twilio or the database. What is asserted, in the brief's order:
//
//   1. Type routing — mobile / landline / VoIP / toll-free (and unknown,
//      a foreign number, junk) go down the path Twilio actually accepts.
//   2. The Hosted SMS state machine — every Twilio status, and that no
//      provider word alone can make a number `active`.
//   3. The port state machine — US statuses, the Canadian filing log, terminal
//      states, and the PIN: encrypted, bound to its row, absent from every log.
//   4. An inbound text on a business number → the thread → linking and lead
//      capture; the shared line does neither.
//   5. The call button's caller ID is the BUSINESS number; inbound passes the
//      caller through.
//   6. Demo companies never order, host or port.
//   7. Tenant isolation — every request read/write is scoped to the session's
//      company; the platform console writes no customer row.
//   Plus: costs, the conversation's call lines, bubble contrast in both themes.

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

process.env.PORT_SECRETS_KEY = randomBytes(32).toString("base64");
process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "AC00000000000000000000000000000000";

const { classifyNumber, kindFromLookup, pathsForKind, HOSTED_REFUSES, simulatedClassification } = await import("@/lib/businessNumber/lineType");
const state = await import("@/lib/businessNumber/state");
const { sealPortSecret, openPortSecret, redactPortDetail, lastFour } = await import("@/lib/businessNumber/secrets");
const store = await import("@/lib/businessNumber/store");
const twiml = await import("@/lib/businessNumber/twiml");
const costs = await import("@/lib/businessNumber/costs");
const { matchPhone } = await import("@/lib/businessNumber/conversation");
const { loaText } = await import("@/lib/businessNumber/loa");
const { handleInboundClientSms } = await import("@/lib/aiEmployee/smsChannel");
const { deterministicContacts, CAPTURE_PLATFORMS } = await import("@/lib/leads/conversationLead");
const { activityLabel, ACTIVITY_TYPES } = await import("@/lib/messaging/activity");
const { commitmentOf } = await import("@/lib/voice/numberCommitment");
const { contrastRatio } = await import("@/lib/brand/colour");
const { SPEND_KINDS } = await import("@/lib/voice/spendGate");
const { poolForKind } = await import("@/lib/voice/credits");

let checks = 0;
let failures = 0;
function ok(name, pass, detail) {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${!pass && detail !== undefined ? `  — ${JSON.stringify(detail)}` : ""}`);
}
const section = (s) => console.log(`\n${s}\n`);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ═══════════════════════════════════════════════════════════════════════════
section("1. Type routing");

const lk = (type, countryCode = "CA", carrierName = "Bell Mobility") => ({ countryCode, valid: true, lineTypeIntelligence: { type, carrierName } });
const mobile = classifyNumber({ e164: "+16135550142", lookup: lk("mobile") });
ok("a Bell cell → port only", mobile.ok && mobile.kind === "mobile" && mobile.paths.join() === "port", mobile);
ok("…and keeps the carrier name for the badge", mobile.carrierName === "Bell Mobility");
const land = classifyNumber({ e164: "+16135550143", lookup: lk("landline", "CA", "Bell Canada") });
ok("a landline → hosted SMS only", land.kind === "landline" && land.paths.join() === "hosted_sms");
const tf = classifyNumber({ e164: "+18885550100", lookup: lk("tollFree", "US", "Twilio") });
ok("a toll-free number → hosted SMS only", tf.kind === "toll_free" && tf.paths.join() === "hosted_sms");
for (const v of ["fixedVoip", "nonFixedVoip"]) {
  const r = classifyNumber({ e164: "+12125550199", lookup: lk(v, "US", "Vonage") });
  ok(`${v} → port, because Twilio refuses to host VoIP`, r.kind === "voip" && r.paths.join() === "port" && r.reasonKey === "voip_ports", r);
}
ok("HOSTED_REFUSES names mobile and VoIP — Twilio's own rule", Boolean(HOSTED_REFUSES.mobile && HOSTED_REFUSES.voip));
const unknown = classifyNumber({ e164: "+16135550144", lookup: lk("pager") });
ok("a pager / unknown type offers both paths, never a guess", unknown.kind === "unknown" && unknown.paths.length === 2);
const noLookupTf = classifyNumber({ e164: "+18335550100", lookup: null });
ok("no Lookup answer: an 833 number is still toll-free by its prefix", noLookupTf.kind === "toll_free");
const gb = classifyNumber({ e164: "+447700900123", lookup: { countryCode: "GB", valid: true, lineTypeIntelligence: { type: "mobile" } } });
ok("a UK number is 'not available yet', not a form", !gb.ok && gb.reasonKey === "country");
const jm = classifyNumber({ e164: "+18765550100", lookup: { countryCode: "JM", valid: true, lineTypeIntelligence: { type: "mobile" } } });
ok("a +1 Jamaican number is refused on Lookup's country, not waved through as NANP", !jm.ok && jm.reasonKey === "country");
ok("junk is refused", !classifyNumber({ e164: "hello" }).ok && !classifyNumber({}).ok);
ok("a number Lookup says is not in service is refused", !classifyNumber({ e164: "+16135550145", lookup: { countryCode: "CA", valid: false } }).ok);
ok("kindFromLookup maps every vocabulary word it can route", ["mobile", "landline", "fixedVoip", "nonFixedVoip", "tollFree"].map(kindFromLookup).join() === "mobile,landline,voip,voip,toll_free");
ok("pathsForKind of nonsense is empty", pathsForKind("satellite").length === 0);
const demoV = simulatedClassification("+16135550142");
ok("a demo classification is marked simulated", demoV.simulated === true && demoV.kind === "mobile");

// ═══════════════════════════════════════════════════════════════════════════
section("2. The Hosted SMS state machine");

const H = state.mapHostedStatus;
const expectHosted = {
  "twilio-processing": "submitted",
  received: "pending_verification",
  "pending-verification": "pending_verification",
  verified: "awaiting_signature",
  "pending-loa": "awaiting_signature",
  "carrier-processing": "carrier_processing",
  testing: "carrier_processing",
  completed: "carrier_processing",
  "action-required": "action_required",
  failed: "failed",
};
for (const [tw, ours] of Object.entries(expectHosted)) ok(`hosted ${tw} → ${ours}`, H(tw).status === ours, H(tw));
ok("completed is flagged completed (activation's cue) — but NOT active", H("completed").completed === true && H("completed").status !== "active");
ok("no Twilio word maps straight to active", Object.keys(expectHosted).every((s) => H(s).status !== "active"));
ok("an unknown status changes nothing", H("brand-new-status").status === null);
ok("pending-verification records that the call was placed", H("pending-verification").callPlaced === true && H("received").callPlaced === false);
ok("failure keeps Twilio's reason", H("failed", "Number is currently SMS enabled").reason.includes("SMS enabled"));
ok("'already SMS enabled' is recognised", state.alreadyTextEnabled("The number is currently SMS enabled with another provider"));
ok("…and 'messaging-enabled'", state.alreadyTextEnabled("Phone number is already messaging-enabled"));
ok("…but not every failure", !state.alreadyTextEnabled("Address could not be validated"));
ok("the advice says what to do", /de-provision/i.test(state.ALREADY_TEXT_ENABLED_ADVICE) && /start again/i.test(state.ALREADY_TEXT_ENABLED_ADVICE));
ok("sync can never reach active", !state.canTransition("carrier_processing", "active"));
ok("activation can", state.canTransition("carrier_processing", "active", { via: "activate" }));
ok("nothing leaves active by sync", !state.canTransition("active", "carrier_processing"));
ok("nothing leaves failed by sync", !state.canTransition("failed", "submitted"));
ok("restart goes failed → draft only", state.canTransition("failed", "draft", { via: "restart" }) && !state.canTransition("active", "draft", { via: "restart" }));
ok("cancel needs the cancel path", !state.canTransition("submitted", "cancelled") && state.canTransition("submitted", "cancelled", { via: "cancel" }));
ok("next step: start the ownership call", state.nextStepFor({ path: "hosted_sms", status: "pending_verification" }) === "start_call");
ok("next step: answer it once placed", state.nextStepFor({ path: "hosted_sms", status: "pending_verification", callPlaced: true }) === "answer_call");
ok("next step: sign the email", state.nextStepFor({ path: "hosted_sms", status: "awaiting_signature" }) === "sign_email");

// ═══════════════════════════════════════════════════════════════════════════
section("3. The port state machine, and the PIN");

const P = state.mapPortStatus;
for (const [tw, ours] of Object.entries({
  "In review": "submitted",
  "Waiting for Signature": "awaiting_signature",
  "In progress": "carrier_processing",
  "Action Required": "action_required",
  Completed: "carrier_processing",
  Expired: "failed",
  Canceled: "failed",
})) ok(`port "${tw}" → ${ours}`, P(tw).status === ours, P(tw));
ok("port Completed is completed, not active", P("Completed").completed && P("Completed").status !== "active");
ok("port statuses tolerate case and separators", P("waiting_for_signature").status === "awaiting_signature");
const now = new Date("2026-10-03T12:00:00Z");
ok("Canada, nothing filed → awaiting FieldQuo's filing", state.mapCanadianFiling([]).status === "awaiting_filing");
ok("Canada, filed → carrier processing", state.mapCanadianFiling([{ action: "filed", createdAt: now }]).status === "carrier_processing");
const rej = state.mapCanadianFiling([{ action: "filed", createdAt: now }, { action: "rejected", note: "Name mismatch", createdAt: new Date(now.getTime() + 1000) }]);
ok("Canada, rejected → action required with the carrier's reason", rej.status === "action_required" && rej.reason === "Name mismatch");
ok("Canada, confirmed date is carried", String(state.mapCanadianFiling([{ action: "confirmed", portDate: "2026-10-10", createdAt: now }]).portDate) === "2026-10-10");
ok("Canada completes ONLY when the number lands in our Twilio account", state.mapCanadianFiling([], { landed: true }).completed && !state.mapCanadianFiling([{ action: "filed", createdAt: now }]).completed);
ok("secrets purge at every terminal state and only there", ["active", "failed", "cancelled"].every(state.secretsShouldBePurged) && !state.secretsShouldBePurged("carrier_processing"));
ok("a mobile port's next step names the carrier's 90-minute text", state.nextStepFor({ path: "port", status: "carrier_processing", lineType: "mobile" }) === "approve_carrier_text");

const PIN = "4417";
const ACCT = "88812345678";
const sealed = sealPortSecret("row_A", PIN);
ok("a sealed PIN does not contain the PIN", !sealed.includes(PIN) && !Buffer.from(sealed, "base64").toString("latin1").includes(PIN));
ok("…opens on its own row", openPortSecret("row_A", sealed) === PIN);
let crossRow = null;
try {
  openPortSecret("row_B", sealed);
  crossRow = "opened";
} catch {
  crossRow = "refused";
}
ok("…and refuses on another row (AAD = row id)", crossRow === "refused");
const red = redactPortDetail({ pin: PIN, accountNumber: ACCT, e164: "+16135550142", note: `Carrier said PIN ${PIN} for account ${ACCT} is wrong` }, [PIN, ACCT]);
ok("redaction drops secret fields by name", red.pin === "[redacted]" && red.accountNumber === "[redacted]");
ok("…and masks a secret quoted inside a provider message", !JSON.stringify(red).includes(PIN) && !JSON.stringify(red).includes(ACCT));
ok("…and leaves the number alone", red.e164 === "+16135550142");
ok("lastFour shows only four", lastFour(ACCT) === "••••5678");

// ═══════════════════════════════════════════════════════════════════════════
section("Store flows against a fake database and a fake Twilio");

function fakeDb(seed = {}) {
  const rows = { brought: seed.brought ? [{ ...seed.brought }] : [], companies: seed.companies || [{ id: "co_1", smsFromNumber: null }], filings: seed.filings || [] };
  const wheres = [];
  const matchBrought = (r, where = {}) => {
    if (where.companyId !== undefined) {
      if (typeof where.companyId === "object" && where.companyId.not !== undefined) {
        if (r.companyId === where.companyId.not) return false;
      } else if (r.companyId !== where.companyId) return false;
    }
    if (where.e164 !== undefined && r.e164 !== where.e164) return false;
    if (where.status?.in && !where.status.in.includes(r.status)) return false;
    if (typeof where.status === "string" && r.status !== where.status) return false;
    if (where.simulated !== undefined && r.simulated !== where.simulated) return false;
    return true;
  };
  return {
    rows,
    wheres,
    broughtNumber: {
      findUnique: async ({ where }) => (wheres.push(["bn.findUnique", where]), rows.brought.find((r) => r.companyId === where.companyId) || null),
      findFirst: async ({ where }) => (wheres.push(["bn.findFirst", where]), rows.brought.find((r) => matchBrought(r, where)) || null),
      create: async ({ data }) => {
        const r = { id: `bn_${rows.brought.length + 1}`, ringSeconds: 20, fallback: "receptionist", ...data };
        rows.brought.push(r);
        return { ...r };
      },
      update: async ({ where, data }) => {
        wheres.push(["bn.update", where]);
        const r = rows.brought.find((x) => x.companyId === where.companyId);
        if (!r) throw new Error("update of a row that does not exist");
        Object.assign(r, data);
        return { ...r };
      },
    },
    company: {
      findFirst: async ({ where }) => rows.companies.find((c) => c.smsFromNumber === where.smsFromNumber && c.id !== where.id?.not) || null,
      findUnique: async ({ where }) => rows.companies.find((c) => c.id === where.id) || null,
      update: async ({ where, data }) => Object.assign(rows.companies.find((c) => c.id === where.id), data),
    },
    portFiling: { findMany: async ({ where }) => rows.filings.filter((f) => f.broughtNumberId === where.broughtNumberId) },
  };
}

function fakeProvider() {
  const calls = [];
  const rec = (name, ret) => async (...args) => {
    calls.push([name, ...args]);
    return typeof ret === "function" ? ret(...args) : ret;
  };
  return {
    calls,
    twilioConfigured: () => true,
    lookupLineType: rec("lookupLineType", lk("mobile")),
    createAddress: rec("createAddress", { sid: "AD1" }),
    createHostedOrder: rec("createHostedOrder", { sid: "HR1", status: "twilio-processing", incomingPhoneNumberSid: "PN1" }),
    fetchHostedOrder: rec("fetchHostedOrder", { sid: "HR1", status: "completed", incomingPhoneNumberSid: "PN1" }),
    startVerificationCall: rec("startVerificationCall", { sid: "HR1", status: "pending-verification", verificationCode: "123456" }),
    createAuthorizationDocument: rec("createAuthorizationDocument", { sid: "PX1" }),
    cancelHostedOrder: rec("cancelHostedOrder", true),
    uploadUtilityBill: rec("uploadUtilityBill", { sid: "RD1" }),
    createPortIn: rec("createPortIn", { sid: "KW1", status: "Waiting for Signature", signatureRequestUrl: "https://sign.example" }),
    fetchPortIn: rec("fetchPortIn", { sid: "KW1", status: "Completed" }),
    cancelPortIn: rec("cancelPortIn", true),
    findOwnedNumber: rec("findOwnedNumber", { sid: "PN9" }),
    wireNumber: rec("wireNumber", true),
  };
}

function depsFor(db, provider, { demo = false, balance = 1000 } = {}) {
  const logs = [];
  const debits = [];
  return {
    logs,
    debits,
    deps: {
      prisma: db,
      provider,
      isDemo: async () => demo,
      balance: async () => balance,
      debit: async (d) => (debits.push(d), { id: "entry" }),
      commitment: async () => null,
      now: () => new Date("2026-10-03T12:00:00Z"),
      log: async (e) => logs.push(e),
    },
  };
}

const bill = { bytes: new Uint8Array(Buffer.from("%PDF-1.4 a bill")), filename: "bell.pdf", contentType: "application/pdf" };
const portForm = {
  holderName: "Maria Lopez",
  customerType: "Business",
  email: "maria@example.com",
  accountNumber: ACCT,
  pin: PIN,
  address: { street: "12 Rue Principale", city: "Gatineau", region: "QC", postalCode: "J8X 1A1" },
  acks: ["approve_text_90_min", "timeline", "leaves_sim"],
  signature: { name: "Maria Lopez", agreed: true },
};

// 3a — a Canadian port: kept, sealed, no provider call, nothing secret logged.
{
  const db = fakeDb();
  const prov = fakeProvider();
  const { deps, logs } = depsFor(db, prov);
  const checked = await store.checkNumber({ companyId: "co_1", input: "(613) 555-0142" }, deps);
  ok("check: a real company's number is looked up", checked.ok && prov.calls.some((c) => c[0] === "lookupLineType"));
  ok("check: a draft row, path port, for a cell", db.rows.brought[0]?.status === "draft" && db.rows.brought[0]?.path === "port");
  const r = await store.startPort({ companyId: "co_1", form: portForm, bill, ip: "1.2.3.4" }, deps);
  const row = db.rows.brought[0];
  ok("CA port: waits for FieldQuo to file it (no API exists)", r.ok && row.status === "awaiting_filing" && row.submitChannel === "twilio_form", r);
  ok("CA port: Twilio's port API is never called for Canada", !prov.calls.some((c) => c[0] === "createPortIn" || c[0] === "uploadUtilityBill"));
  ok("CA port: PIN and account number stored sealed, not plain", row.pinEnc && row.accountNumberEnc && !row.pinEnc.includes(PIN) && !row.accountNumberEnc.includes(ACCT));
  ok("CA port: they open on this row", openPortSecret(row.id, row.pinEnc) === PIN && openPortSecret(row.id, row.accountNumberEnc) === ACCT);
  ok("CA port: the bill is sealed too", row.billEnc && Buffer.from(openPortSecret(row.id, row.billEnc), "base64").toString().startsWith("%PDF"));
  ok("CA port: the screen sees last four, never the number", r.number.accountNumberHint === "••••5678" && !JSON.stringify(r.number).includes(ACCT) && !JSON.stringify(r.number).includes(PIN));
  ok("CA port: the typed signature is recorded", row.loaSignedName === "Maria Lopez" && row.loaSignedIp === "1.2.3.4");
  ok("CA port: nothing secret in any log", !JSON.stringify(logs).includes(PIN) && !JSON.stringify(logs).includes(ACCT));
  ok("the LOA text names the number, the holder and the address", (() => {
    const t = loaText(row);
    return t.includes("+16135550142") && t.includes("Maria Lopez") && t.includes("Gatineau") && t.includes("Signed electronically");
  })());
  const cancelled = await store.cancelRequest({ companyId: "co_1" }, deps);
  ok("cancel purges every secret", cancelled.ok && row.status === "cancelled" && !row.pinEnc && !row.accountNumberEnc && !row.billEnc && row.secretsPurgedAt);
}

// 3b — a US port: through the API, nothing secret stored at all, errors masked.
{
  const db = fakeDb({ brought: { id: "bn_us", companyId: "co_1", e164: "+12125550101", country: "US", lineType: "mobile", path: "port", status: "draft", simulated: false } });
  const prov = fakeProvider();
  const { deps } = depsFor(db, prov);
  const r = await store.startPort({ companyId: "co_1", form: { ...portForm, address: { ...portForm.address, region: "NY", postalCode: "10001", city: "New York" } }, bill }, deps);
  const row = db.rows.brought[0];
  const portCall = prov.calls.find((c) => c[0] === "createPortIn");
  ok("US port: the bill is uploaded as a utility-bill document", prov.calls.some((c) => c[0] === "uploadUtilityBill"));
  ok("US port: Twilio's Port In API is called with the PIN and the document", portCall && portCall[1].phone_numbers[0].pin === PIN && portCall[1].documents[0] === "RD1");
  ok("US port: the LOA goes to Twilio's e-signature (the signer's email)", portCall[1].losing_carrier_information.authorized_representative_email === "maria@example.com");
  ok("US port: status from Twilio — awaiting signature", r.ok && row.status === "awaiting_signature");
  ok("US port: NO secret is stored once Twilio holds it", !row.pinEnc && !row.accountNumberEnc && !row.billEnc);

  const db2 = fakeDb({ brought: { id: "bn_us2", companyId: "co_1", e164: "+12125550102", country: "US", lineType: "mobile", path: "port", status: "draft", simulated: false } });
  const prov2 = fakeProvider();
  prov2.createPortIn = async () => {
    throw new Error(`Invalid PIN ${PIN} for account ${ACCT}`);
  };
  const d2 = depsFor(db2, prov2);
  const failed = await store.startPort({ companyId: "co_1", form: portForm, bill }, d2.deps);
  ok("US port refused: the refusal shown to the company has the PIN masked", !failed.ok && !failed.reason.includes(PIN) && !failed.reason.includes(ACCT), failed.reason);
  ok("…and so does the error log", d2.logs.length > 0 && !JSON.stringify(d2.logs).includes(PIN) && !JSON.stringify(d2.logs).includes(ACCT));
}

// 3c — refusals before anything is filed.
{
  const db = fakeDb({ brought: { id: "bn_x", companyId: "co_1", e164: "+16135550142", country: "CA", lineType: "mobile", path: "port", status: "draft", simulated: false } });
  const prov = fakeProvider();
  const { deps } = depsFor(db, prov);
  const noAck = await store.startPort({ companyId: "co_1", form: { ...portForm, acks: ["timeline"] }, bill }, deps);
  ok("a port without all three warnings acknowledged is refused", !noAck.ok && noAck.problems.includes("acks"));
  const noPin = await store.startPort({ companyId: "co_1", form: { ...portForm, pin: "" }, bill }, deps);
  ok("a mobile port without a PIN is refused", !noPin.ok && noPin.problems.includes("pin"));
  const bigBill = await store.startPort({ companyId: "co_1", form: portForm, bill: { ...bill, bytes: new Uint8Array(store.BILL_MAX_BYTES + 1) } }, deps);
  ok("a bill over 4 MB is refused", !bigBill.ok && bigBill.problems.includes("bill_size"));
  const exe = await store.startPort({ companyId: "co_1", form: portForm, bill: { ...bill, contentType: "application/x-msdownload" } }, deps);
  ok("a bill that is not a PDF/PNG/JPEG is refused", !exe.ok && exe.problems.includes("bill_type"));
  const poor = depsFor(db, prov, { balance: 100 });
  const short = await store.startPort({ companyId: "co_1", form: portForm, bill }, poor.deps);
  ok("not enough balance for the first month → 402, nothing filed", !short.ok && short.status === 402 && db.rows.brought[0].status === "draft");
  const key = process.env.PORT_SECRETS_KEY;
  delete process.env.PORT_SECRETS_KEY;
  const noKey = await store.startPort({ companyId: "co_1", form: portForm, bill }, deps);
  process.env.PORT_SECRETS_KEY = key;
  ok("no PORT_SECRETS_KEY → refused before a PIN is accepted", !noKey.ok && noKey.reasonKey === "no_secret_key");
}

// 2b — hosted, end to end, and activation.
{
  const db = fakeDb({ brought: { id: "bn_h", companyId: "co_1", e164: "+16135550143", country: "CA", lineType: "landline", path: "hosted_sms", status: "draft", simulated: false } });
  const prov = fakeProvider();
  const { deps, debits } = depsFor(db, prov);
  const r = await store.startHosted(
    { companyId: "co_1", origin: "https://www.fieldquo.com", form: { holderName: "Dave", email: "dave@example.com", contactPhone: "613-555-0199", address: { street: "1 Main", city: "Ottawa", region: "ON", postalCode: "K1A 0A1" } } },
    deps,
  );
  const order = prov.calls.find((c) => c[0] === "createHostedOrder");
  ok("hosted: the order points texts at /api/sms/inbound", order && order[1].smsUrl === "https://www.fieldquo.com/api/sms/inbound");
  ok("hosted: the owner's address is a Twilio Address first", prov.calls[0][0] === "createAddress" && order[1].addressSid === "AD1");
  ok("hosted: status follows Twilio (twilio-processing → submitted)", r.ok && db.rows.brought[0].status === "submitted");
  db.rows.brought[0].status = "pending_verification";
  const v = await store.startVerificationCall({ companyId: "co_1" }, deps);
  ok("hosted: the ownership call returns Twilio's code for the screen", v.ok && v.code === "123456");
  ok("…and the code is never stored", !JSON.stringify(db.rows.brought[0]).includes("123456"));

  const synced = await store.syncRequest(db.rows.brought[0], { origin: "https://www.fieldquo.com" }, deps);
  const wire = prov.calls.find((c) => c[0] === "wireNumber");
  ok("hosted completed → activated", synced.activated === true && db.rows.brought[0].status === "active");
  ok("hosted: wired for texts only — calls stay with the carrier", wire && wire[2].smsUrl.endsWith("/api/sms/inbound") && !wire[2].voiceUrl, wire);
  ok("hosted: becomes the company's sending number", db.rows.companies[0].smsFromNumber === "+16135550143");
  ok("hosted: the first month is debited as brought_number_rent, once, with a ref", debits.length === 1 && debits[0].kind === "brought_number_rent" && debits[0].cents === costs.BROUGHT_NUMBER_MONTHLY_CENTS && debits[0].ref);
  const again = await store.activate(db.rows.brought[0], { origin: "x" }, deps);
  ok("activating twice charges nothing more", again.ok && debits.length === 1);
}

// Port activation wires calls; an existing different sending number is never overwritten.
{
  const db = fakeDb({
    brought: { id: "bn_p", companyId: "co_1", e164: "+12125550101", country: "US", lineType: "mobile", path: "port", status: "carrier_processing", submitChannel: "twilio_api", providerOrderSid: "KW1", simulated: false },
    companies: [{ id: "co_1", smsFromNumber: "+15555550000" }],
  });
  const prov = fakeProvider();
  const { deps } = depsFor(db, prov);
  await store.syncRequest(db.rows.brought[0], { origin: "https://www.fieldquo.com" }, deps);
  const wire = prov.calls.find((c) => c[0] === "wireNumber");
  ok("port completed: calls are pointed at the business-number voice route", wire && wire[2].voiceUrl === "https://www.fieldquo.com/api/business-number/voice" && wire[2].voiceStatusUrl.endsWith("/api/business-number/call-status"));
  ok("an existing sending number is not silently replaced", db.rows.companies[0].smsFromNumber === "+15555550000" && /not made your sending number/.test(db.rows.brought[0].failureReason));
}

// Rent — monthly, idempotent, never releases the number.
{
  const db = fakeDb({ brought: { id: "bn_r", companyId: "co_1", e164: "+16135550143", status: "active", simulated: false, rentPaidThroughAt: new Date("2026-10-01T00:00:00Z") } });
  const { deps, debits } = depsFor(db, fakeProvider(), { balance: -500 });
  const r = await store.billRent(db.rows.brought[0], deps);
  ok("rent due → charged even into a negative balance (never strand the number)", r.charged && debits[0].kind === "brought_number_rent");
  ok("…and paid-through moves forward a period", new Date(db.rows.brought[0].rentPaidThroughAt) > new Date("2026-10-30T00:00:00Z"));
  const r2 = await store.billRent(db.rows.brought[0], deps);
  ok("…so the same day charges nothing twice", !r2.charged && debits.length === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Inbound text → thread → linking and lead capture");

{
  const events = [];
  const links = [];
  const meters = [];
  const fakeIngest = async (e) => (events.push(e), { handled: true, created: true, threadId: "th_1", ai: { replied: true } });
  const prisma = { messagingChannel: { findUnique: async () => ({ id: "ch_1", companyId: "co_1", platform: "sms", externalId: "sms:co_1" }) }, $queryRaw: async () => [] };
  await handleInboundClientSms(
    { from: "+16135550177", body: "Hi, can you quote a deck stain?", messageSid: "SM1", companies: [{ id: "co_1", name: "Acme" }], dedicated: true },
    { db: prisma, ingest: fakeIngest, link: async (_p, a) => links.push(a), meter: async (m) => meters.push(m) },
  );
  ok("a text to the business number is filed on the company's SMS channel", events.length === 1 && events[0].platform === "sms" && events[0].pageExternalId === "sms:co_1");
  ok("…flagged businessLine, so lead capture runs (social-leads rules)", events[0].businessLine === true);
  ok("…linked to the client / lead / job by phone", links.length === 1 && links[0].phone === "+16135550177" && links[0].companyId === "co_1");
  ok("…and metered once, on Twilio's MessageSid", meters.length === 1 && meters[0].messageSid === "SM1" && meters[0].direction === "in");

  const ev2 = [];
  const l2 = [];
  const prisma2 = { messagingChannel: { findUnique: async ({ where }) => ({ id: `ch_${where.platform_externalId.externalId}`, companyId: where.platform_externalId.externalId.split(":")[1], platform: "sms", externalId: where.platform_externalId.externalId }) }, $queryRaw: async () => [], message: { count: async () => 1 } };
  await handleInboundClientSms(
    { from: "+16135550177", body: "STOP? no — just a question", messageSid: "SM2", companies: [{ id: "co_1" }, { id: "co_2" }], dedicated: false },
    { db: prisma2, ingest: async (e) => (ev2.push(e), { handled: true, created: true, threadId: "t" }), link: async (_p, a) => l2.push(a), meter: async () => {} },
  );
  ok("the SHARED line: no lead capture, no linking — unchanged behaviour", ev2.length === 2 && ev2.every((e) => !e.businessLine && e.noAutoReply) && l2.length === 0);
}
ok("the Meta capture list itself is unchanged", CAPTURE_PLATFORMS.join() === "facebook,instagram,whatsapp");
const det = deterministicContacts({ messages: [{ direction: "in", body: "deck stain please" }], platform: "sms", participantExternalId: "+16135550177" });
ok("a texter's own number is the lead's phone, from the carrier", det.phone?.value === "+16135550177" && det.phone.method === "sms_number");
ok("one client on that phone → linked to the client", matchPhone({ phone: "+16135550177", clients: [{ id: "c1", phone: "(613) 555-0177" }] }).kind === "client");
ok("two clients on one phone → ambiguous, linked to neither", matchPhone({ phone: "+16135550177", clients: [{ id: "c1", phone: "6135550177" }, { id: "c2", phone: "613.555.0177" }] }).kind === "ambiguous");
ok("no client, one open lead → the lead", matchPhone({ phone: "+16135550177", leads: [{ id: "l1", phone: "+1 613 555 0177" }] }).kind === "lead");
ok("a stranger → nothing (capture decides whether they are a lead)", matchPhone({ phone: "+16135550177", clients: [{ id: "c1", phone: "6135550100" }] }).kind === "none");
const ingestSrc = strip(read("lib/messaging/ingest.js"));
ok("ingest captures sms ONLY with the businessLine flag", /channel\.platform === "sms" && event\.businessLine === true/.test(ingestSrc));
const capSrc = strip(read("lib/leads/conversationLead.js"));
ok("capture refuses plain sms without the flag", /businessLine === true && platform === "sms"/.test(capSrc));
const ownSendSrc = strip(read("lib/messaging/ownSend.js"));
ok("a reply leaves from the company's own number when it has one", /clientSmsFrom\(company\) \|\| \(await systemSmsNumber\(\)\)/.test(ownSendSrc));

// ═══════════════════════════════════════════════════════════════════════════
section("5. Caller ID: the business number out, the caller's number in");

const BIZ = "+16135550142";
const CLIENT = "+16135550177";
const CELL = "+16135550100";
const connect = twiml.bridgeConnectTwiml({ digits: "1", clientE164: CLIENT, businessE164: BIZ, doneUrl: "https://x/done" });
ok("bridge leg two dials the client", connect.includes(`<Number>${CLIENT}</Number>`));
ok("…showing the BUSINESS number as caller ID", connect.includes(`callerId="${BIZ}"`));
ok("…and never the member's cell", !connect.includes(CELL));
ok("no '1' pressed → nothing is dialled", !twiml.bridgeConnectTwiml({ digits: "", clientE164: CLIENT, businessE164: BIZ, doneUrl: "x" }).includes("<Number>"));
ok("bridgeConnectTwiml has no other caller-ID input", !/callerId[^:]*:\s*(?!businessE164)/.test(strip(read("lib/businessNumber/twiml.js")).split("export function bridgeConnectTwiml")[1].split("export function")[0].replace(/callerId: businessE164/, "")));
const placeSrc = strip(read("app/api/calls/bridge/route.js"));
ok("leg one is placed FROM the business number", /from: line\.e164/.test(placeSrc) && /to: memberPhone/.test(placeSrc));
const prompt = twiml.bridgePromptTwiml({ clientLabel: "Maria", connectUrl: "https://x/c" });
ok("leg one asks for a key press first (a voicemail never gets the client)", /<Gather[^>]*numDigits="1"/.test(prompt) && prompt.includes("Maria"));
const ring = twiml.inboundRingTwiml({ from: CLIENT, forwardTo: [CELL, "+16135550101", "+16135550102", "+16135550103"], ringSeconds: 20, afterUrl: "https://x/after" });
ok("inbound: the caller's own number passes through", ring.includes(`callerId="${CLIENT}"`));
ok("inbound: up to three phones ring together", (ring.match(/<Number>/g) || []).length === 3);
ok("inbound: nobody to ring → straight to the fallback", twiml.inboundRingTwiml({ from: CLIENT, forwardTo: [], afterUrl: "https://x/after" }).includes("<Redirect"));
const recep = twiml.afterRingTwiml({ dialStatus: "no-answer", from: CLIENT, receptionistE164: "+16135550199", fallback: "receptionist", voicemailUrl: "v", doneUrl: "d" });
ok("no answer → the existing receptionist number, caller ID passed through", recep.outcome === "receptionist" && recep.twiml.includes("+16135550199") && recep.twiml.includes(`callerId="${CLIENT}"`));
const vm = twiml.afterRingTwiml({ dialStatus: "busy", from: CLIENT, receptionistE164: null, companyName: "Acme", voicemailUrl: "v", doneUrl: "d" });
ok("no receptionist → voicemail with the company's name, recorded", vm.outcome === "voicemail" && vm.twiml.includes("<Record") && vm.twiml.includes("Acme"));
ok("answered → hang up, nothing more", twiml.afterRingTwiml({ dialStatus: "completed", from: CLIENT }).outcome === "answered");
ok("forward list drops junk, duplicates and the business number itself", twiml.cleanForwardList(["x", CELL, CELL, BIZ], { businessE164: BIZ }).join() === CELL);
const bv = (o) => twiml.bridgeVerdict({ numberActive: true, path: "port", memberPhone: CELL, clientPhone: CLIENT, doNotCall: false, withinHours: true, ...o });
ok("bridge allowed with a ported live number, both phones, in hours", bv({}).allowed);
ok("…refused on a hosted number (calls stay with the carrier)", bv({ path: "hosted_sms" }).reasonKey === "no_number");
ok("…refused outside calling hours", bv({ withinHours: false }).reasonKey === "outside_hours");
ok("…refused for a do-not-call", bv({ doNotCall: true }).reasonKey === "do_not_call");
ok("…refused with no member phone", bv({ memberPhone: null }).reasonKey === "no_member_phone");
ok("bridged calls are not recorded (so no disclosure is owed)", !/record/i.test(strip(read("lib/businessNumber/twiml.js")).split("export function bridgeConnectTwiml")[1].split("export function")[0]));

// ═══════════════════════════════════════════════════════════════════════════
section("6. Demo companies never order, host or port");

{
  const db = fakeDb();
  const prov = fakeProvider();
  prov.twilioConfigured = () => false; // a demo must work with no Twilio at all
  const { deps, debits } = depsFor(db, prov, { demo: true });
  const c = await store.checkNumber({ companyId: "co_1", input: "613-555-0142" }, deps);
  ok("demo check: no Lookup is made (and no credentials needed)", c.ok && prov.calls.length === 0 && db.rows.brought[0].simulated === true);
  const p = await store.startPort({ companyId: "co_1", form: portForm, bill }, deps);
  ok("demo port: nothing is filed", p.ok && p.simulated && prov.calls.length === 0);
  ok("demo port: nothing secret is kept", !db.rows.brought[0].pinEnc && !db.rows.brought[0].accountNumberEnc && !db.rows.brought[0].billEnc);
  const s = await store.syncRequest(db.rows.brought[0], { origin: "x" }, deps);
  ok("demo: sync never reaches a provider", !s.changed && prov.calls.length === 0);
  const a = await store.activate(db.rows.brought[0], { origin: "x" }, deps);
  ok("demo: never activated, never the sending number, never charged", !a.ok && db.rows.companies[0].smsFromNumber === null && debits.length === 0);

  const db2 = fakeDb({ brought: { id: "bn_d", companyId: "co_1", e164: "+16135550143", country: "CA", lineType: "landline", path: "hosted_sms", status: "draft", simulated: true } });
  const prov2 = fakeProvider();
  const d2 = depsFor(db2, prov2, { demo: true });
  const h = await store.startHosted({ companyId: "co_1", origin: "x", form: { holderName: "D", email: "d@x.co", contactPhone: "6135550199", address: { street: "1", city: "O", region: "ON", postalCode: "K1A" } } }, d2.deps);
  ok("demo hosted: no Address, no order", h.ok && h.simulated && prov2.calls.length === 0);
}
const bridgeSrc = strip(read("app/api/calls/bridge/route.js"));
ok("the call button refuses a demo before placing a call", bridgeSrc.indexOf("isDemoCompany(") > -1 && bridgeSrc.indexOf("isDemoCompany(") < bridgeSrc.indexOf("placeBridgeCall({"));
ok("live brought numbers exclude simulated rows everywhere calls resolve", /simulated: false/.test(strip(read("lib/businessNumber/store.js")).split("export async function broughtNumberByE164")[1]));

// ═══════════════════════════════════════════════════════════════════════════
section("7. Tenant isolation");

{
  const db = fakeDb({
    brought: { id: "bn_t", companyId: "co_1", e164: "+16135550142", country: "CA", lineType: "mobile", path: "port", status: "carrier_processing", simulated: false },
    companies: [{ id: "co_1", smsFromNumber: null }, { id: "co_2", smsFromNumber: null }],
  });
  const prov = fakeProvider();
  const { deps } = depsFor(db, prov);
  const other = await store.checkNumber({ companyId: "co_2", input: "613-555-0142" }, deps);
  ok("another company cannot bring in a number already in flight here", !other.ok && other.reasonKey === "taken");
  ok("…and is not told whose it is", !JSON.stringify(other).includes("co_1"));
  const cancelOther = await store.cancelRequest({ companyId: "co_2" }, deps);
  ok("co_2 cancelling cancels nothing of co_1's", !cancelOther.ok && db.rows.brought[0].status === "carrier_processing");
  const fwdOther = await store.setForwarding({ companyId: "co_2", forwardTo: ["+16135550100"] }, deps);
  ok("co_2 cannot set co_1's forwarding", !fwdOther.ok && !db.rows.brought[0].forwardTo);
  ok("every request read/write in the store is keyed by companyId", db.wheres.filter(([op]) => op !== "bn.findFirst").every(([, w]) => w && w.companyId));
}
const storeSrc = strip(read("lib/businessNumber/store.js"));
ok("no store entry point takes a row id from a request", !/where:\s*\{\s*id:\s*(body|form|input)/.test(storeSrc));
const bridgeLib = strip(read("lib/businessNumber/bridge.js"));
ok("the call button reads the phone from a record scoped to the company", (bridgeLib.match(/where: \{ id, companyId \}/g) || []).length === 3);
const recSrc = strip(read("app/api/business-number/recording/[sid]/route.js"));
ok("a voicemail is served only when THIS company's conversation carries it", /thread: \{ companyId: member\.companyId \}/.test(recSrc));
const platformSrc = strip(read("app/api/platform/business-numbers/route.js"));
ok("the platform console writes no customer row (non-negotiable #3)", !/broughtNumber\.(update|create|upsert|delete)/.test(platformSrc) && !/company\.(update|create)/.test(platformSrc));
ok("…its only write is FieldQuo's own PortFiling log", /portFiling\.create/.test(platformSrc));
ok("…opening a package needs the superadmin-only permission and is audited", /porting:handle/.test(platformSrc) && /port_package_opened/.test(platformSrc));
const perms = read("lib/platform/permissions.js");
ok("porting:handle is superadmin-only", /SUPERADMIN_ONLY_PERMISSIONS = \[\s*"porting:handle"/.test(perms));
const voiceSrc = strip(read("app/api/business-number/voice/route.js"));
ok("an inbound call resolves its company from the dialled number, signature first", voiceSrc.indexOf("verifyTwilioWebhook") < voiceSrc.indexOf("broughtNumberByE164"));
const legSrc = strip(read("app/api/business-number/bridge/route.js"));
ok("bridge leg routes require the call to come FROM that company's live number", /check\.line\.e164 !== \(params\.From/.test(legSrc));

// ═══════════════════════════════════════════════════════════════════════════
section("Costs, the ledger, and the conversation lines");

const est = costs.monthlyEstimate({ path: "port", textsIn: 150, textsOut: 150, callMinutes: 300 });
ok("port estimate: $4 + 300 texts × 2¢ + 300 min × 5¢ = $25.00", est.totalCents === 400 + 600 + 1500, est);
const hEst = costs.monthlyEstimate({ path: "hosted_sms", textsIn: 150, textsOut: 150, callMinutes: 300 });
ok("hosted estimate ignores call minutes (calls never touch FieldQuo)", hEst.totalCents === 1000 && hEst.callCents === 0);
ok("the rental is the crew line's price — one commodity, one number", costs.BROUGHT_NUMBER_MONTHLY_CENTS === 400);
ok("a call rounds up to the minute", costs.callCents(61) === 2 * costs.BUSINESS_CALL_CENTS_PER_MINUTE && costs.callCents(0) === 0);
ok("a long text is billed per segment", costs.textCents({ body: "x".repeat(200) }) === 2 * costs.TEXT_CENTS);
ok("a photo is the photo price", costs.textCents({ hasMedia: true }) === costs.PHOTO_CENTS);
ok("estimate refuses junk volumes", costs.monthlyEstimate({ path: "port", textsIn: "lots", callMinutes: -5 }).totalCents === 400);
for (const k of ["brought_number_rent", "brought_text", "brought_call"]) {
  ok(`${k} is a declared spend kind on the phone wallet`, Boolean(SPEND_KINDS[k]) && poolForKind(k) === "voice");
}
ok("'call' is an activity type", ACTIVITY_TYPES.includes("call"));
ok("an inbound answered call reads with its duration", activityLabel({ type: "call", direction: "in", outcome: "answered", durationSec: 247 })?.params.duration === "4:07");
ok("a voicemail line has its key", activityLabel({ type: "call", direction: "in", outcome: "voicemail", durationSec: 30 })?.key === "app.messages.activity.call.in.voicemail");
ok("an outbound call names who placed it", activityLabel({ type: "call", direction: "out", outcome: "answered", by: "Dave", durationSec: 60 })?.params.name === "Dave");
ok("…and says nothing rather than invent a caller", activityLabel({ type: "call", direction: "out", outcome: "answered" }) === null);
ok("an unknown outcome is silent", activityLabel({ type: "call", direction: "in", outcome: "exploded" }) === null);
ok("a brought number in flight blocks it being claimed as a crew line", commitmentOf({ e164: BIZ, broughtRow: { companyId: "co_1" }, forCompanyId: "co_1" })?.kind === "brought");
const ncSrc = read("lib/voice/numberCommitment.js");
const listed = (ncSrc.match(/status: \{ in: \[([^\]]+)\] \}/) || [])[1] || "";
ok("numberCommitment's in-flight list is state.js IN_FLIGHT, exactly", JSON.stringify(listed.split(",").map((s) => s.trim().replace(/"/g, "")).sort()) === JSON.stringify([...state.IN_FLIGHT].sort()), listed);

// ═══════════════════════════════════════════════════════════════════════════
section("The inbox's bubbles: contrast measured in both themes");

const css = read("app/globals.css");
const token = (scope, name) => {
  const block = scope === "dark" ? css.split(".dark {")[1] : css.split(".dark {")[0];
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block);
  return m ? m[1] : null;
};
for (const theme of ["light", "dark"]) {
  const ours = contrastRatio(token(theme, "primary-foreground"), token(theme, "primary"));
  const theirs = contrastRatio(token(theme, "foreground"), token(theme, "muted"));
  ok(`${theme}: our bubble text on navy ≥ 4.5:1 (${ours.toFixed(2)})`, ours >= 4.5);
  ok(`${theme}: their bubble text on the muted wash ≥ 4.5:1 (${theirs.toFixed(2)})`, theirs >= 4.5);
}
const threadSrc = strip(read("app/components/chat/Thread.js"));
ok("bubbles: ours is bg-primary / text-primary-foreground — the measured pair", /"bg-primary text-primary-foreground"/.test(threadSrc));
ok("bubbles: a note is never drawn as our bubble", /variant === "bubbles" && m\.kind !== "note"/.test(threadSrc));
ok("the client inbox asks for bubbles; the kit's default stays rows", /variant="bubbles"/.test(read("app/app/messages/page.js")) && /variant = "rows"/.test(threadSrc));

// ═══════════════════════════════════════════════════════════════════════════
section("Wiring");

const pkg = JSON.parse(read("package.json"));
ok("check:bring-your-number is a script", Boolean(pkg.scripts["check:bring-your-number"]));
ok("…and check:all runs it", /npm run check:bring-your-number/.test(pkg.scripts["check:all"]));
ok("the cron is scheduled", /\/api\/cron\/business-numbers/.test(read("vercel.json")));

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
