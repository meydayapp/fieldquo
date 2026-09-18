// scripts/check-sales-intro-email.mjs
//
//   npm run check:sales-intro-email
//
// The "we tried calling you" email, executed.
//
//   §1  the template renders in all three languages with every merge field
//       filled — no "{x}" survives, eight points exactly, every link in both
//       the HTML and the text part, the Ref: line a reply files by
//   §2  no English leaks into the French or Spanish body
//   §3  every text/background pair is measured at 4.5:1 or better — the
//       pairs the template itself declares, not pairs guessed from markup
//   §4  the link tokens: seal/open round-trips, a flipped byte is refused, a
//       swapped kind is refused, an expired token is refused, a token opened
//       with a different key is refused, and nothing in a token is readable
//   §5  the 14-day guard and the next-business-hour rule
//   §6  the trigger table: which outcomes open the pop-up, and CallPanel /
//       UnloggedCalls open it from those and nothing else
//   §7  the requests: single use per kind, unhandled counts, a later dial
//       counts as handled, the public page's copy is complete per language
//   §8  the fences: the tables on REP_OUTREACH_WRITES, no /api/sales route
//       stamps a request, the portal keys exist in all nine languages
//
// Run with the db stub so introSend/introRequests can be imported without a
// database; the request functions take an injected client and are driven
// with a hand-rolled fake below.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

// The at-rest key the link tokens seal with — set before the modules load.
process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

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
}
const section = (h) => console.log(`\n${h}\n`);

const {
  INTRO_COPY,
  INTRO_EMAIL_LANGUAGES,
  INTRO_POINT_COUNT,
  INTRO_TRADE_PHRASES,
  buildIntroEmail,
  firstNameOf,
  introEmailPalette,
  introEmailSubject,
  introTradePhrase,
} = await import("@/lib/sales/outreach/introEmail");
const {
  INTRO_EMAIL_ASK_CODES,
  INTRO_LINK_DAYS,
  INTRO_LINK_KINDS,
  INTRO_REPEAT_DAYS,
  asksIntroEmail,
  introLinkExpiry,
  introLinkUrl,
  nextBusinessHour,
  openIntroLink,
  recentIntroSend,
  sealIntroLink,
} = await import("@/lib/sales/outreach/introLink");
const { INTRO_LINK_COPY, introLinkCopy, fillIntroCopy } = await import("@/lib/sales/outreach/introLinkCopy");
const { DISPOSITIONS, AUTO_LOGGED_CODES } = await import("@/lib/sales/calls/dispositions");
const { OFFERED_CODES } = await import("@/lib/sales/calls/outcomeChoices");
const { DISCOVERY_TRADES } = await import("@/lib/sales/discovery/trades");
const { REP_OUTREACH_WRITES } = await import("@/lib/sales/outreachGate");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
const { candidateAddresses } = await import("@/lib/sales/outreach/introSend");
const { actIntroLink, introRequestsForRep, markIntroHandled, resolveIntroLink } = await import("@/lib/sales/outreach/introRequests");
const { allowedRecipients } = await import("@/lib/sales/emailRecipients");

// ═══════════════════════════════════════════════════════════════════════════
section("1. The template renders, in three languages, with every field filled");
// ═══════════════════════════════════════════════════════════════════════════

const REP = { name: "Emilio Boves", email: "emilio@fieldquo.com", phone: "+1 613 555 0100" };
const LINKS = {
  signupLink: "https://app.fieldquo.com/signup?sales=EB1&link=abc",
  callbackUrl: "https://app.fieldquo.com/i/CALLBACKTOKEN",
  demoUrl: "https://app.fieldquo.com/i/DEMOTOKEN",
  unsubscribeUrl: "https://app.fieldquo.com/i/UNSUBTOKEN",
  screenshotUrl: "https://app.fieldquo.com/product/email/quote-phone.en.png",
  mailingAddress: "100 Rue Principale, Gatineau QC J8X 1A1",
  replyToken: "fqs0123456789abcdef0123456789abcdef",
};

ok("three languages, and they are en fr es", JSON.stringify(INTRO_EMAIL_LANGUAGES) === '["en","fr","es"]');
ok("INTRO_POINT_COUNT is eight", INTRO_POINT_COUNT === 8);

const rendered = {};
for (const language of INTRO_EMAIL_LANGUAGES) {
  const email = buildIntroEmail({ language, rep: REP, business: "Érable Design Cabinetry", contactName: "Sophie Dubois", tradeKey: "cabinets", ...LINKS });
  rendered[language] = email;
  ok(`${language}: renders`, Boolean(email.html && email.text && email.subject));
  ok(`${language}: language reported`, email.language === language);
  ok(`${language}: no merge field survives in the html`, !/\{(business|first|rep|trade)\}/.test(email.html), email.html.match(/\{\w+\}/g));
  ok(`${language}: no merge field survives in the text`, !/\{(business|first|rep|trade)\}/.test(email.text));
  ok(`${language}: no merge field survives in the subject`, !/\{\w+\}/.test(email.subject));
  ok(`${language}: exactly ${INTRO_POINT_COUNT} points`, INTRO_COPY[language].points.length === INTRO_POINT_COUNT, INTRO_COPY[language].points.length);
  const bullets = (email.text.match(/^- /gm) || []).length;
  ok(`${language}: the text part carries the ${INTRO_POINT_COUNT} points`, bullets === INTRO_POINT_COUNT, bullets);
  for (const [k, v] of Object.entries(LINKS)) {
    if (k === "mailingAddress" || k === "replyToken") continue;
    // Attribute-escaped in the html: `&` is `&amp;` inside an href.
    ok(`${language}: ${k} is in the html`, email.html.includes(v.replace(/&/g, "&amp;")));
    ok(`${language}: ${k} is in the text`, email.text.includes(v));
  }
  ok(`${language}: the Ref: line carries the reply token in both parts`, email.html.includes(LINKS.replyToken) && email.text.includes(LINKS.replyToken));
  ok(`${language}: the mailing address is in both parts`, email.html.includes("Gatineau") && email.text.includes("Gatineau"));
  ok(`${language}: the greeting uses the first name`, email.text.startsWith(INTRO_COPY[language].greetingNamed.replace("{first}", "Sophie")));
  ok(`${language}: the business is in the subject`, email.subject.includes("Érable Design Cabinetry"));
  ok(`${language}: the rep's number is in the sign-off`, email.text.includes(REP.phone) && email.html.includes(REP.phone));
  ok(`${language}: the screenshot has alt text`, /<img [^>]*alt="[^"]{10,}"/.test(email.html));
  ok(`${language}: the screenshot has an explicit width`, /<img [^>]*width="(300|520)"/.test(email.html));
  ok(`${language}: tables, not flex`, /<table role="presentation"/.test(email.html) && !/display:\s*flex/.test(email.html));
  ok(`${language}: the trade phrase landed`, email.text.includes(introTradePhrase("cabinets", language)));
  // The owner's AI paragraph: one paragraph, at most two sentences, after
  // the eight points and before the screenshot — in both parts.
  ok(`${language}: the AI paragraph is one paragraph of at most two sentences`, typeof INTRO_COPY[language].ai === "string" && (INTRO_COPY[language].ai.match(/[.!?](\s|$)/g) || []).length <= 2, INTRO_COPY[language].ai);
  ok(`${language}: the AI paragraph sits after the points and before the screenshot`, email.text.indexOf(INTRO_COPY[language].ai) > email.text.lastIndexOf("\n- ") && email.text.indexOf(INTRO_COPY[language].ai) < email.text.indexOf(LINKS.screenshotUrl) && email.html.includes(INTRO_COPY[language].ai.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")));
  ok(`${language}: html lang attribute matches`, email.html.includes(`<html lang="${language}">`));
}

// Without a first name, a phone, or a trade: nothing invented.
{
  const email = buildIntroEmail({ language: "en", rep: { name: "A B", email: "a@fieldquo.com", phone: null }, business: "Acme", contactName: null, tradeKey: null, ...LINKS });
  ok("no contact name → the plain greeting", email.text.startsWith("Hello,"));
  ok("no rep phone → no phone line", !/Cell:/.test(email.text));
  ok("no trade → the product's own phrase, not a guess", email.text.includes("home-service businesses"));
  ok("an unknown trade key → the same phrase", introTradePhrase("__proto__", "fr") === INTRO_TRADE_PHRASES.unknown.fr && introTradePhrase("constructor", "es") === INTRO_TRADE_PHRASES.unknown.es);
}
ok("every discovery trade has a phrase in every language", Object.keys(DISCOVERY_TRADES).every((k) => INTRO_EMAIL_LANGUAGES.every((l) => typeof INTRO_TRADE_PHRASES[k]?.[l] === "string" && INTRO_TRADE_PHRASES[k][l])), Object.keys(DISCOVERY_TRADES).filter((k) => !INTRO_TRADE_PHRASES[k]));
ok("an unknown language renders English, reported as en", buildIntroEmail({ language: "de", rep: REP, business: "Acme", ...LINKS }).language === "en");
ok("the subject helper matches the built subject", introEmailSubject("fr", "Érable Design Cabinetry") === rendered.fr.subject);

// Refusals, not degraded emails.
const refuses = (patch) => {
  try {
    buildIntroEmail({ language: "en", rep: REP, business: "Acme", ...LINKS, ...patch });
    return false;
  } catch {
    return true;
  }
};
ok("no mailing address → throws", refuses({ mailingAddress: "" }));
ok("a relative signup link → throws", refuses({ signupLink: "/signup" }));
ok("no reply token → throws", refuses({ replyToken: "" }));
ok("no rep email → throws", refuses({ rep: { name: "A", email: "" } }));
ok("no business → throws", refuses({ business: "  " }));

// Header injection in a merge field is stripped, never carried.
{
  const email = buildIntroEmail({ language: "en", rep: REP, business: "Acme\r\nBcc: victim@example.com", contactName: "<script>x</script> Dave", ...LINKS });
  ok("CR/LF in the business name never reaches the subject", !/[\r\n]/.test(email.subject) && !email.subject.includes("Bcc:\n"));
  ok("markup in the contact name is escaped in the html", !email.html.includes("<script>"));
}
ok("firstNameOf handles 'Dubois, Sophie'", firstNameOf("Dubois, Sophie") === "Sophie");
ok("firstNameOf drops an honorific", firstNameOf("Mr. Dave Martin") === "Dave");
ok("firstNameOf of nothing is empty", firstNameOf(null) === "" && firstNameOf("   ") === "");

// ═══════════════════════════════════════════════════════════════════════════
section("2. No English leaks into the French or Spanish body");
// ═══════════════════════════════════════════════════════════════════════════

// Words that appear in the English copy and would not appear in a French or
// Spanish sentence. Proper nouns and the merge values are excluded by
// construction (they are the same in every language).
const ENGLISH_MARKERS = [" the ", " and ", " your ", " you ", " from ", " with ", " quote", "invoice", "business", " free ", "month", " call ", "receiving", "Talk soon", "Unsubscribe:"];
// The opt-out word itself is quoted in every language on purpose — it is
// the token lib/sales/outreach.js detectOptOut listens for — so the quoted
// token is stripped before the scan, and the label beside it is what §2
// checks for translation.
const stripKnown = (text) => text.replace(/Érable Design Cabinetry|Sophie|Emilio Boves|FieldQuo|https?:\S+|emilio@fieldquo\.com|fqs[0-9a-f]+|«\s?unsubscribe\s?»/g, " ");
for (const language of ["fr", "es"]) {
  const body = stripKnown(rendered[language].text);
  const leaks = ENGLISH_MARKERS.filter((w) => body.toLowerCase().includes(w.toLowerCase()));
  ok(`${language}: no English marker in the text part`, leaks.length === 0, leaks);
  ok(`${language}: the subject is not the English one`, rendered[language].subject !== rendered.en.subject);
  ok(`${language}: every copy key differs from English`, Object.keys(INTRO_COPY.en).filter((k) => k !== "points" && k !== "reference" && INTRO_COPY[language][k] === INTRO_COPY.en[k]).length === 0);
}
ok("the three copy tables share one key set", INTRO_EMAIL_LANGUAGES.every((l) => JSON.stringify(Object.keys(INTRO_COPY[l]).sort()) === JSON.stringify(Object.keys(INTRO_COPY.en).sort())));
ok("French says vous, never tu", !/\b(tu|ton|ta|tes)\b/i.test(rendered.fr.text));
ok("French says soumission, not devis", rendered.fr.text.includes("soumission") && !/devis/i.test(rendered.fr.text));
ok("Spanish says usted's forms, never vosotros", !/vosotros|vuestr/i.test(rendered.es.text));

// ═══════════════════════════════════════════════════════════════════════════
section("3. Every text/background pair clears 4.5:1 — measured");
// ═══════════════════════════════════════════════════════════════════════════

const palette = introEmailPalette();
ok("the palette declares at least five pairs", palette.pairs.length >= 5, palette.pairs.length);
for (const pair of palette.pairs) {
  ok(`${pair.name}: ${pair.fg} on ${pair.bg} is ${pair.ratio.toFixed(2)}:1`, pair.ratio >= 4.5);
}
// Every foreground colour the html actually uses is one the palette measured.
{
  const used = [...new Set(rendered.en.html.match(/color:(#[0-9a-fA-F]{6})/g).map((m) => m.slice(6).toLowerCase()))];
  const measured = new Set(palette.pairs.map((p) => p.fg.toLowerCase()));
  const stray = used.filter((c) => !measured.has(c));
  ok("every `color:` in the html is a measured foreground", stray.length === 0, stray);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The link tokens");
// ═══════════════════════════════════════════════════════════════════════════

ok("three kinds: callback, demo, unsubscribe", JSON.stringify(INTRO_LINK_KINDS) === '["callback","demo","unsubscribe"]');
ok("links live thirty days", INTRO_LINK_DAYS === 30);
const now = new Date("2026-09-18T15:00:00Z");
const expiresAt = introLinkExpiry(now);
ok("expiry is thirty days from the send", expiresAt.getTime() - now.getTime() === 30 * 24 * 60 * 60 * 1000);
const claims = { introEmailId: "ie_1", leadId: "lead_1", salesRepId: "rep_1", kind: "callback", expiresAt };
const token = sealIntroLink(claims);
ok("a token is URL-safe", /^[A-Za-z0-9_-]+$/.test(token));
ok("a token is opaque — no id readable in it", !token.includes("lead_1") && !token.includes("rep_1") && !token.includes("ie_1") && !token.includes("callback"));
ok("a token does not reveal its ids under base64 either", !Buffer.from(token.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("latin1").includes("lead_1"));
const opened = openIntroLink(token, { now });
ok("seal/open round-trips", opened.ok && opened.introEmailId === "ie_1" && opened.leadId === "lead_1" && opened.salesRepId === "rep_1" && opened.kind === "callback", opened);
ok("the expiry travels", opened.ok && opened.expiresAt.getTime() === expiresAt.getTime());
ok("a fresh seal of the same claims is a different string (random IV)", sealIntroLink(claims) !== token);
{
  const bytes = Buffer.from(token.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  bytes[bytes.length - 3] ^= 0x01;
  const tampered = bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  ok("a flipped byte is refused as tampered", openIntroLink(tampered, { now }).reason === "tampered");
}
ok("an expired token is refused", openIntroLink(token, { now: new Date(expiresAt.getTime() + 1) }).reason === "expired");
ok("a token expiring this instant is refused", openIntroLink(token, { now: expiresAt }).reason === "expired");
ok("garbage is refused as malformed", openIntroLink("hello", { now }).reason === "malformed" && openIntroLink(null, { now }).reason === "malformed");
ok("a token with a space is refused as malformed", openIntroLink(`${token} `, { now }).reason === "malformed");
{
  const keep = process.env.META_TOKEN_ENCRYPTION_KEY;
  process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  ok("a token sealed under another key is refused as tampered", openIntroLink(token, { now }).reason === "tampered");
  process.env.META_TOKEN_ENCRYPTION_KEY = "";
  ok("no key → unconfigured, never open", openIntroLink(token, { now }).reason === "unconfigured");
  process.env.META_TOKEN_ENCRYPTION_KEY = keep;
}
ok("sealing an unknown kind throws", (() => { try { sealIntroLink({ ...claims, kind: "reset" }); return false; } catch { return true; } })());
ok("the demo kind opens as demo, not callback", openIntroLink(sealIntroLink({ ...claims, kind: "demo" }), { now }).kind === "demo");
ok("the url is /i/<token>", introLinkUrl("https://app.fieldquo.com/", token) === `https://app.fieldquo.com/i/${token}`);

// ═══════════════════════════════════════════════════════════════════════════
section("5. The 14-day guard and the next business hour");
// ═══════════════════════════════════════════════════════════════════════════

ok("the repeat window is fourteen days", INTRO_REPEAT_DAYS === 14);
const day = 24 * 60 * 60 * 1000;
ok("a send 13 days ago blocks", recentIntroSend([{ sentAt: new Date(now.getTime() - 13 * day) }], { now }) !== null);
ok("a send 15 days ago does not", recentIntroSend([{ sentAt: new Date(now.getTime() - 15 * day) }], { now }) === null);
ok("a send exactly 14 days ago does not", recentIntroSend([{ sentAt: new Date(now.getTime() - 14 * day) }], { now }) === null);
ok("the most recent of several is returned", recentIntroSend([{ sentAt: new Date(now.getTime() - 10 * day) }, { sentAt: new Date(now.getTime() - 2 * day) }], { now }).getTime() === now.getTime() - 2 * day);
ok("garbage rows are ignored", recentIntroSend([null, {}, { sentAt: "nope" }], { now }) === null && recentIntroSend("x", { now }) === null);

// Next business hour: Toronto, Friday 18 Sep 2026 15:00Z = 11:00 EDT → 12:00 EDT.
{
  const r = nextBusinessHour(new Date("2026-09-18T15:00:00Z"), "America/Toronto");
  ok("mid-morning Toronto → the next top of the hour", r.zone === "America/Toronto" && r.at.toISOString() === "2026-09-18T16:00:00.000Z", r);
  const evening = nextBusinessHour(new Date("2026-09-18T23:30:00Z"), "America/Toronto"); // 19:30 EDT Friday
  ok("Friday evening Toronto → Monday 09:00 local", evening.at.toISOString() === "2026-09-21T13:00:00.000Z", evening);
  const sat = nextBusinessHour(new Date("2026-09-19T14:00:00Z"), "America/Vancouver"); // Saturday
  ok("Saturday Vancouver → Monday 09:00 PDT", sat.at.toISOString() === "2026-09-21T16:00:00.000Z", sat);
  const late = nextBusinessHour(new Date("2026-09-18T20:30:00Z"), "America/Toronto"); // 16:30 EDT → 17:00 is closed → Monday
  ok("16:30 local → not 17:00, but Monday 09:00", late.at.toISOString() === "2026-09-21T13:00:00.000Z", late);
  const unknown = nextBusinessHour(new Date("2026-09-18T15:10:00Z"), null);
  ok("an unknown zone → an hour on, zone null, nothing padded", unknown.zone === null && unknown.at.toISOString() === "2026-09-18T17:00:00.000Z", unknown);
  const bad = nextBusinessHour(new Date("2026-09-18T15:10:00Z"), "Mars/Olympus");
  ok("an unreadable zone → the same honest answer", bad.zone === null && bad.at.toISOString() === "2026-09-18T17:00:00.000Z", bad);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The trigger table, and who opens the pop-up");
// ═══════════════════════════════════════════════════════════════════════════

ok("the table is no_answer and voicemail", JSON.stringify(INTRO_EMAIL_ASK_CODES) === '["no_answer","voicemail"]');
ok("both are real dispositions", INTRO_EMAIL_ASK_CODES.every((c) => DISPOSITIONS[c]));
ok("neither is a reached outcome", INTRO_EMAIL_ASK_CODES.every((c) => DISPOSITIONS[c].reached === false));
ok("text_instead does not ask", !asksIntroEmail("text_instead"));
ok("busy and hung_up do not ask", !asksIntroEmail("busy") && !asksIntroEmail("hung_up"));
ok("no reached_* outcome asks", Object.keys(DISPOSITIONS).filter((c) => DISPOSITIONS[c].reached).every((c) => !asksIntroEmail(c)));
ok("no_answer is line-written, voicemail is rep-chosen — both doors exist", AUTO_LOGGED_CODES.includes("no_answer") && OFFERED_CODES.includes("voicemail"));
// The full table, printed, so a reader sees which outcomes ask.
console.log("\n       outcome                  asks?");
for (const code of Object.keys(DISPOSITIONS)) console.log(`       ${code.padEnd(24)} ${asksIntroEmail(code) ? "YES" : "no"}`);
console.log("");

// 2026-09-18: the outcome flow and the intro-email pop-up moved from
// CallPanel to the shell-level CallSession, and IntroEmailPrompt is rendered
// by LiveCallStrip so it can open on any page. The table and the two
// openings did not change.
const session = decomment(read("app/components/sales/CallSession.js"));
const strip = decomment(read("app/components/sales/LiveCallStrip.js"));
ok("CallSession imports asksIntroEmail from the table", /asksIntroEmail[\s\S]*from "@\/lib\/sales\/outreach\/introLink"/.test(session));
ok("CallSession opens the pop-up from the auto-log reply (no_answer)", /if \(body\?\.ok && body\.code\) \{[\s\S]*?asksIntroEmail\(body\.code\)[\s\S]*?setIntroPrompt\(\{/.test(session));
ok("CallSession opens the pop-up after a saved outcome (voicemail)", /asksIntroEmail\(fold\.code\)[\s\S]*?setIntroPrompt\(\{/.test(session));
ok("CallSession opens it from exactly those two places", (session.match(/setIntroPrompt\(\{/g) || []).length === 2, (session.match(/setIntroPrompt\(\{/g) || []).length);
ok("CallSession never names a code itself", !/"no_answer"|"voicemail"/.test(session.replace(/app\.salesCall\.disposition\.\$\{[^}]*\}/g, "")));
ok("the pop-up holds onWorked until it closes", /p\?\.then\?\.\(\)/.test(session) && /then: \(\) => onWorked\(\)/.test(session));
ok("LiveCallStrip renders IntroEmailPrompt", /<IntroEmailPrompt target=\{introPrompt\}/.test(strip));
const unlogged = decomment(read("app/components/sales/UnloggedCalls.js"));
ok("UnloggedCalls asks the same table after a write-up", /asksIntroEmail\(fold\.code\)/.test(unlogged) && /<IntroEmailPrompt/.test(unlogged));
const prompt = decomment(read("app/components/sales/IntroEmailPrompt.js"));
ok("the pop-up is the shared AlertDialog", /import AlertDialog from "@\/app\/components\/AlertDialog"/.test(prompt));
ok("the pop-up never imports node:crypto through outreach.js", !/@\/lib\/sales\/outreach"|@\/lib\/sales\/outreach\/introEmail"/.test(prompt));
ok("the pop-up has Send and Not now", /data-intro-email-send/.test(prompt) && /data-intro-email-not-now/.test(prompt));
ok("the address is editable — a typed address", /data-intro-email-typed/.test(prompt));
ok("the pop-up prints a refusal in place of Send", /data-intro-email-refusal/.test(prompt));
ok("no address on record is a notice beside the typed field, not a dead end", /data-intro-email-notice/.test(prompt) && /notice: candidates\.length === 0/.test(decomment(read("lib/sales/outreach/introSend.js"))));

// ═══════════════════════════════════════════════════════════════════════════
section("7. The requests, executed against a fake client");
// ═══════════════════════════════════════════════════════════════════════════

function fakeClient() {
  const intro = new Map();
  const events = [];
  const attempts = [];
  const suppressions = [];
  const client = {
    intro,
    events,
    attempts,
    suppressions,
    salesIntroEmail: {
      findUnique: async ({ where }) => intro.get(where.id) || null,
      findMany: async ({ where }) => {
        return [...intro.values()].filter((r) => {
          if (where.salesRepId && r.salesRepId !== where.salesRepId) return false;
          if (where.handledAt === null && r.handledAt) return false;
          if (where.OR && !where.OR.some((o) => Object.keys(o).every((k) => r[k]))) return false;
          if (where.leadId && r.leadId !== where.leadId) return false;
          return true;
        });
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const r of intro.values()) {
          if (where.id && r.id !== where.id) continue;
          if (where.salesRepId && r.salesRepId !== where.salesRepId) continue;
          let match = true;
          for (const [k, v] of Object.entries(where)) {
            if (k === "id" || k === "salesRepId") continue;
            if (v === null && r[k] != null) match = false;
          }
          if (!match) continue;
          Object.assign(r, data);
          count++;
        }
        return { count };
      },
      update: async ({ where, data }) => Object.assign(intro.get(where.id), data),
    },
    salesEvent: { create: async ({ data }) => { const e = { id: `ev_${events.length + 1}`, ...data }; events.push(e); return e; } },
    salesCallAttempt: { findMany: async ({ where }) => attempts.filter((a) => a.salesRepId === where.salesRepId && a.direction === "out" && where.leadId.in.includes(a.leadId) && (!where.dialledAt || a.dialledAt > where.dialledAt.gt)) },
    platformSmsNumber: { findFirst: async ({ where }) => (where.assignedRepId === "rep_1" ? { e164: "+16135550100" } : null) },
    // suppress() opens a transaction and writes through it.
    $transaction: async (fn) => fn(client),
    salesSuppression: {
      findUnique: async ({ where }) => suppressions.find((s) => s.kind === where.kind_value.kind && s.value === where.kind_value.value) || null,
      upsert: async ({ where, create, update }) => {
        const hit = suppressions.find((s) => s.kind === where.kind_value.kind && s.value === where.kind_value.value);
        if (hit) return Object.assign(hit, update);
        const s = { id: `sup_${suppressions.length + 1}`, ...create };
        suppressions.push(s);
        return s;
      },
    },
    salesSuppressionEvent: { create: async ({ data }) => data },
  };
  return client;
}

const lead = { id: "lead_1", businessName: "Acme Roofing", contactName: "Dave Martin", phone: "+16135550199", email: "dave@acme.example", timeZone: "America/Toronto", country: "CA", province: "ON", prospect: { websiteUrl: "https://acme.example", country: "CA", province: "ON" } };
const row = { id: "ie_1", salesRepId: "rep_1", leadId: "lead_1", toAddress: "dave@acme.example", language: "fr", sentAt: now, expiresAt, callbackRequestedAt: null, callbackEventId: null, demoRequestedAt: null, handledAt: null, salesRep: { id: "rep_1", name: "Emilio" }, lead };

{
  const client = fakeClient();
  client.intro.set("ie_1", { ...row });
  const t = (kind) => sealIntroLink({ introEmailId: "ie_1", leadId: "lead_1", salesRepId: "rep_1", kind, expiresAt });
  const resolved = await resolveIntroLink(t("callback"), { client, now });
  ok("a good token resolves to its row", resolved.ok && resolved.row.id === "ie_1" && resolved.kind === "callback");
  const foreign = await resolveIntroLink(sealIntroLink({ introEmailId: "ie_1", leadId: "lead_2", salesRepId: "rep_1", kind: "callback", expiresAt }), { client, now });
  ok("a token whose lead disagrees with the row is refused (mismatch)", foreign.reason === "mismatch");
  const missing = await resolveIntroLink(sealIntroLink({ introEmailId: "ie_9", leadId: "lead_1", salesRepId: "rep_1", kind: "callback", expiresAt }), { client, now });
  ok("a token for no row is refused (unknown)", missing.reason === "unknown");

  const first = await actIntroLink(t("callback"), { client, now });
  ok("the first press stamps the request", first.ok && first.already === false && client.intro.get("ie_1").callbackRequestedAt === now);
  ok("…and writes a callback SalesEvent on the rep's calendar, linked to the lead", client.events.length === 1 && client.events[0].type === "callback" && client.events[0].leadId === "lead_1" && client.events[0].salesRepId === "rep_1");
  ok("…at the next business hour in the lead's zone (Friday 11:00 EDT → 12:00)", client.events[0].startAt.toISOString() === "2026-09-18T16:00:00.000Z", client.events[0].startAt);
  ok("…with the contact snapshotted", client.events[0].businessName === "Acme Roofing" && client.events[0].phone === "+16135550199");
  ok("…and the event id on the row", client.intro.get("ie_1").callbackEventId === "ev_1");
  ok("…answering in the email's language", first.language === "fr" && first.repName === "Emilio");
  const second = await actIntroLink(t("callback"), { client, now: new Date(now.getTime() + 60_000) });
  ok("a second press (replay) is 'already' and writes nothing", second.ok && second.already === true && client.events.length === 1 && client.intro.get("ie_1").callbackRequestedAt === now);
  const demo = await actIntroLink(t("demo"), { client, now });
  ok("the demo kind is its own single use", demo.ok && demo.already === false && client.intro.get("ie_1").demoRequestedAt === now);
  ok("a demo carries the rep's number for the page", demo.repPhone === "+16135550100");
  ok("a demo writes no calendar entry — no time was chosen", client.events.length === 1);
  const demoAgain = await actIntroLink(t("demo"), { client, now });
  ok("the demo replay is 'already'", demoAgain.already === true);

  const unsub = await actIntroLink(t("unsubscribe"), { client, now });
  ok("unsubscribe writes the suppression list for the address, email channel, source form", unsub.ok && client.suppressions.length === 1 && client.suppressions[0].value === "dave@acme.example" && client.suppressions[0].source === "form" && JSON.stringify(client.suppressions[0].channels) === '["email"]', client.suppressions[0]);
  const unsubAgain = await actIntroLink(t("unsubscribe"), { client, now });
  ok("a second unsubscribe is 'already' and adds no row", unsubAgain.already === true && client.suppressions.length === 1);

  // The counters.
  const counts = await introRequestsForRep({ salesRepId: "rep_1", client, now });
  ok("Today counts one call-back and one demo", counts.callbacks === 1 && counts.demos === 1 && counts.items.length === 2, counts);
  ok("another rep counts nothing", (await introRequestsForRep({ salesRepId: "rep_2", client, now })).items.length === 0);
  client.attempts.push({ salesRepId: "rep_1", leadId: "lead_1", direction: "out", dialledAt: new Date(now.getTime() + 3600_000) });
  const after = await introRequestsForRep({ salesRepId: "rep_1", client, now: new Date(now.getTime() + 7200_000) });
  ok("a later outbound dial to the lead counts as handled — both drop", after.callbacks === 0 && after.demos === 0, after);
  client.attempts.length = 0;
  const handled = await markIntroHandled({ salesRepId: "rep_2", introEmailId: "ie_1", client, now });
  ok("another rep cannot mark it handled", handled.ok && handled.changed === false && client.intro.get("ie_1").handledAt === null);
  const mine = await markIntroHandled({ salesRepId: "rep_1", introEmailId: "ie_1", client, now });
  ok("the owner can, once", mine.changed === true && (await markIntroHandled({ salesRepId: "rep_1", introEmailId: "ie_1", client, now })).changed === false);
  ok("handled rows leave the counters", (await introRequestsForRep({ salesRepId: "rep_1", client, now })).items.length === 0);

  // Expired by the row, whatever the token says.
  client.intro.set("ie_1", { ...row, expiresAt: new Date(now.getTime() - 1) });
  ok("a row past its expiry refuses even a token that has not expired", (await resolveIntroLink(t("callback"), { client, now })).reason === "expired");
}

// The public page's copy.
ok("the page copy has the three languages", JSON.stringify(Object.keys(INTRO_LINK_COPY)) === '["en","fr","es"]');
for (const l of ["fr", "es"]) {
  const flat = (o) => Object.values(o).flatMap((v) => (typeof v === "string" ? [v] : flat(v)));
  const same = flat(INTRO_LINK_COPY[l]).filter((v) => flat(INTRO_LINK_COPY.en).includes(v));
  ok(`${l}: the page copy differs from English throughout`, same.length === 0, same);
  ok(`${l}: the page copy has every key`, JSON.stringify(Object.keys(INTRO_LINK_COPY[l]).sort()) === JSON.stringify(Object.keys(INTRO_LINK_COPY.en).sort()));
  for (const k of INTRO_LINK_KINDS) ok(`${l}: title/ask/button/done/already exist for ${k}`, ["title", "ask", "button", "done", "already"].every((s) => typeof INTRO_LINK_COPY[l][s][k] === "string" && INTRO_LINK_COPY[l][s][k]));
}
ok("the done sentence names the rep", fillIntroCopy(introLinkCopy("en").done.callback, { rep: "Emilio" }).startsWith("Emilio will call you back"));
ok("an unknown language falls back to English", introLinkCopy("de") === INTRO_LINK_COPY.en);

// candidateAddresses: the closed set's order, deduplicated, lower-cased.
{
  const c = candidateAddresses({ email: "Dave@Acme.example", prospect: { email: "dave@acme.example" }, contactEmails: [{ email: "other@acme.example" }, { email: "bad" }] });
  ok("candidates: lead first, prospect deduplicated, contact rows after, junk dropped", JSON.stringify(c) === '[{"address":"dave@acme.example","source":"lead"},{"address":"other@acme.example","source":"contact"}]', c);
  ok("candidates: a prospect with no lead yet", JSON.stringify(candidateAddresses(null, { email: "p@x.example" })) === '[{"address":"p@x.example","source":"prospect"}]');
}
ok("the composer's closed set admits a saved contact address", allowedRecipients({ lead: { email: "a@x.example", contactEmails: [{ email: "b@x.example" }] }, rep: { workEmail: "r@fieldquo.com" } }).some(([a, m]) => a === "b@x.example" && m.label === "contact"));

// ═══════════════════════════════════════════════════════════════════════════
section("8. The fences");
// ═══════════════════════════════════════════════════════════════════════════

ok("salesIntroEmail and salesContactEmail are on REP_OUTREACH_WRITES", REP_OUTREACH_WRITES.includes("salesIntroEmail") && REP_OUTREACH_WRITES.includes("salesContactEmail"));
{
  // No route under /api/sales stamps a request. Only the public link route may.
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith("route.js") ? [p] : []; });
  const salesRoutes = walk(join(ROOT, "app/api/sales")).map((p) => p.slice(ROOT.length + 1));
  const stampers = salesRoutes.filter((f) => /callbackRequestedAt|demoRequestedAt/.test(decomment(read(f))));
  ok("no /api/sales route names callbackRequestedAt or demoRequestedAt", stampers.length === 0, stampers);
  const libStampers = ["lib/sales/outreach/introSend.js"].filter((f) => /callbackRequestedAt:|demoRequestedAt:/.test(decomment(read(f))));
  ok("the send path never stamps a request", libStampers.length === 0);
}
{
  const route = decomment(read("app/api/intro-link/[token]/route.js"));
  const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  ok("the public GET only reads (introLinkState), never acts", /introLinkState\(/.test(get) && !/actIntroLink\(/.test(get));
  ok("the public POST acts", /actIntroLink\(/.test(route.slice(route.indexOf("export async function POST"))));
  ok("the public page is noindex", /robots: \{ index: false/.test(read("app/i/[token]/page.js")));
  const form = decomment(read("app/i/[token]/IntroLinkForm.js"));
  ok("the page POSTs from one button", /method: "POST"/.test(form) && /data-intro-link-act/.test(form));
}
{
  const send = decomment(read("lib/sales/outreach/introSend.js"));
  ok("the send goes through deliverOutreach, not around it", /deliverOutreach\(\{/.test(send) && !/sendFromMailbox\(/.test(send));
  ok("the send re-judges readiness and the address in the request that sends", /outreachStatus\(rep\)[\s\S]*judgeAddress\(\{ lead, address/.test(send.slice(send.indexOf("export async function sendIntroEmail"))));
  ok("the row is written only after SMTP accepted", send.indexOf("salesIntroEmail.create") > send.indexOf("deliverOutreach({"));
  ok("nothing here deletes", !/\.delete\(/.test(send));
  ok("a typed address is saved through recordContactEmail before the send", send.indexOf("recordContactEmail(") < send.indexOf("deliverOutreach({"));
  const sender = decomment(read("lib/sales/outreachSender.js"));
  ok("deliverOutreach takes a builder and still runs the suppression and readiness checks before it", /build = null/.test(sender) && sender.indexOf("checkSuppression(") < sender.indexOf('typeof build === "function"') && sender.indexOf("outreachStatus(rep)") < sender.indexOf('typeof build === "function"'));
}
{
  // The portal keys, in all nine languages.
  const files = ["app/components/sales/IntroEmailPrompt.js", "app/sales/page.js", "app/sales/leads/[id]/page.js", "lib/sales/outreach/introRequests.js"];
  const keys = new Set();
  for (const f of files) for (const m of decomment(read(f)).matchAll(/["'`](app\.(?:salesIntro|notify\.intro)[\w.]+)["'`]/g)) keys.add(m[1]);
  // Dynamic keys the screens build from a closed set.
  for (const l of INTRO_EMAIL_LANGUAGES) keys.add(`app.salesIntro.language.${l}`);
  for (const s of ["lead", "prospect", "contact"]) keys.add(`app.salesIntro.source.${s}`);
  for (const k of ["callback", "demo"]) keys.add(`app.salesIntro.today.kind.${k}`);
  keys.add("app.salesInbox.recipient.contact");
  ok("the screens ask for keys", keys.size >= 30, keys.size);
  const langs = Object.keys(APP_MESSAGES);
  ok("nine languages", langs.length === 9, langs);
  const missing = [];
  for (const k of keys) for (const l of langs) if (APP_MESSAGES[l]?.[k] == null) missing.push(`${l}:${k}`);
  ok("every key exists in every language", missing.length === 0, missing.slice(0, 10));
  const untranslated = [];
  for (const k of keys) for (const l of langs) if (l !== "en" && typeof APP_MESSAGES[l]?.[k] === "string" && APP_MESSAGES[l][k] === APP_MESSAGES.en[k] && !/^\{business\}|^Open$|FieldQuo/.test(APP_MESSAGES.en[k])) untranslated.push(`${l}:${k}`);
  ok("no non-English value is the English one", untranslated.length === 0, untranslated.slice(0, 10));
  for (const l of langs) {
    const n = APP_MESSAGES[l]["app.salesIntro.today.callbacks"];
    ok(`${l}: the counters are counted nouns`, typeof n === "function" && typeof n({ value: 2 }) === "string" && n({ value: 2 }).length > 0);
  }
}
{
  const gate = decomment(read("scripts/check-sales-portal-i18n.mjs"));
  ok("the portal i18n check holds the pop-up to the nine languages", /IntroEmailPrompt\.js/.test(gate));
  const outreach = decomment(read("scripts/check-sales-outreach.mjs"));
  ok("the outreach write scan covers the intro routes and lib", /app\/api\/sales\/intro-email\/route\.js/.test(outreach) && /lib\/sales\/outreach\/introSend\.js/.test(outreach));
}
function statSyncSize(p) {
  return readFileSync(join(ROOT, p)).length;
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The picture is the prospect's trade");
// ═══════════════════════════════════════════════════════════════════════════

const { INTRO_FRAMES, INTRO_FRAME_FALLBACK, INTRO_SCREENSHOT_BY_TRADE, INTRO_TAKEOFF_FRAMES, catalogueKeyForDiscovery, introScreenshotFor } = await import("@/lib/sales/outreach/introScreenshots");
const { TRADE_CATALOG } = await import("@/lib/trades/catalog");
const { TAKEOFF_TRADES } = await import("@/lib/pricing/takeoffTrades");
const { LOT_MEASURE_TRADES } = await import("@/lib/measure/lotTakeoff");
{
  const catalogue = Object.keys(TRADE_CATALOG);
  const undecided = catalogue.filter((k) => !Object.hasOwn(INTRO_SCREENSHOT_BY_TRADE, k));
  ok("every catalogue trade is decided in the table — none defaulted by omission", undecided.length === 0, undecided);
  const unknown = Object.keys(INTRO_SCREENSHOT_BY_TRADE).filter((k) => !Object.hasOwn(TRADE_CATALOG, k));
  ok("the table names no trade the catalogue lacks", unknown.length === 0, unknown);
  ok("every trade with a takeoff card in the builder has its own frame", TAKEOFF_TRADES.every((k) => INTRO_TAKEOFF_FRAMES.includes(k)), TAKEOFF_TRADES.filter((k) => !INTRO_TAKEOFF_FRAMES.includes(k)));
  ok("every landscaping trade that draws on the still has its own frame", LOT_MEASURE_TRADES.every((k) => INTRO_TAKEOFF_FRAMES.includes(k)));
  ok("every discovery trade resolves to a catalogue key or the fallback", Object.keys(DISCOVERY_TRADES).every((k) => catalogueKeyForDiscovery(k) === null || Object.hasOwn(INTRO_SCREENSHOT_BY_TRADE, catalogueKeyForDiscovery(k))));
  const files = [];
  for (const frame of INTRO_FRAMES) for (const l of INTRO_EMAIL_LANGUAGES) {
    const p = `public/product/email/quote-${frame}.${l}.png`;
    let size = 0;
    try { size = statSyncSize(p); } catch { size = 0; }
    if (size < 4_000) files.push(p);
  }
  ok(`every frame the table can name is on disk in three languages (${INTRO_FRAMES.length} frames)`, files.length === 0, files.slice(0, 6));
  const roof = introScreenshotFor("roofing", "fr", "de toiture");
  ok("a roofing prospect gets the roofing card, in French, with the trade in the alt", roof.frame === "roofing_service" && roof.path === "/product/email/quote-roofing_service.fr.png" && /toiture/.test(roof.alt) && roof.kind === "takeoff", roof);
  ok("a paving prospect gets the traced driveway", introScreenshotFor("paving", "en").frame === "paving");
  ok("a cabinet prospect gets the quote on a phone — the owner's 'great' one", introScreenshotFor("cabinets", "en").frame === INTRO_FRAME_FALLBACK);
  ok("a plumbing prospect gets the quote, said as the quote in the alt", introScreenshotFor("plumbing", "es").kind === "quote" && /cotización/i.test(introScreenshotFor("plumbing", "es").alt));
  ok("a catalogue key is accepted directly", introScreenshotFor("gutter_services", "en").frame === "gutter_services");
  ok("no trade, or junk, is the fallback — never a throw", introScreenshotFor(null, "en").frame === INTRO_FRAME_FALLBACK && introScreenshotFor("__proto__", "en").frame === INTRO_FRAME_FALLBACK && introScreenshotFor("constructor", "fr").frame === INTRO_FRAME_FALLBACK);
  ok("an unknown language falls back to English paths", introScreenshotFor("roofing", "de").path.endsWith(".en.png"));
  // The rendered email carries the trade's frame and its alt, and the caption names the trade.
  const roofEmail = buildIntroEmail({ language: "en", rep: REP, business: "Acme Roofing", tradeKey: "roofing", ...LINKS, screenshotUrl: "https://app.fieldquo.com/product/email/quote-roofing_service.en.png", screenshotAlt: introScreenshotFor("roofing", "en", "roofing").alt });
  ok("a builder frame is shown at card width with the trade in its alt and caption", /width="520"/.test(roofEmail.html) && /alt="A roofing quote in FieldQuo/.test(roofEmail.html) && /A roofing quote being built in FieldQuo/.test(roofEmail.text));
  const phoneEmail = buildIntroEmail({ language: "en", rep: REP, business: "Acme", tradeKey: "cabinets", ...LINKS });
  ok("the phone frame is shown at phone width with the quote caption", /width="300"/.test(phoneEmail.html) && /on their phone/.test(phoneEmail.text));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
