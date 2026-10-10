// scripts/check-portal-account-links.mjs
//
// The client-portal account links (owner, 2026-10-10), executed against
// hostile input rather than read:
//
//   1. The quote email carries "Your account with {company}" in every client
//      language, in the HTML and the text part, escaped, measured, white-label
//      — and without a portal link the email is byte-for-byte what it was.
//   2. The quote send route mints the client's token past every refusal and
//      never fails the send over it.
//   3. The standalone Client login (POST /api/portal-login { companySlug })
//      is EXECUTED: the company comes from the slug, never the body; the
//      answer is the same bytes for a match, a stranger and a rate-limited
//      address; the send happens after the response; the per-address bucket
//      is one per company across both doors.
//   4. The login page resolves its company from the slug on the server, is
//      noindex, branded, and never names FieldQuo.
//   5. Bulk eligibility is correct on hostile fixtures — no email, opted out,
//      do-not-contact, closed and cancelled jobs, declined and draft quotes,
//      archived and imported history, a recent link, another company's
//      client — and stays correct when every list query LEAKS.
//   6. Nothing sends without confirm: the tool is a dry run by default, the
//      route answers GET with a dry run, and POST sends only on confirm: true
//      with the count that was shown. Executed, with the send recorded.
//   7. The screens, the History kind, the settings link and the wiring.
//
// Run:
//   node --import ./scripts/alias-loader.mjs --import ./scripts/portal-links-stub-loader.mjs \
//     scripts/check-portal-account-links.mjs
//
// The stub loader points @/lib/email/resend at a recorder: this check cannot
// send an email.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

process.env.NEXT_PUBLIC_APP_URL = "https://www.fieldquo.test";

const stub = await import("./fixtures/portalLinksStub.mjs");
const { buildQuoteEmail } = await import("@/lib/email/quoteEmail");
const { emailCopy, EMAIL_COPY, SUPPORTED_EMAIL_LANGUAGES } = await import("@/lib/i18n/emailCopy");
const { escapeHtml } = await import("@/lib/email/documentEmailLayout");
const { QUOTE_EMAIL_COMPANY_SELECT, QUOTE_EMAIL_QUOTE_SELECT } = await import("@/lib/quotes/emailSections");
const { documentTheme } = await import("@/lib/documents/theme");
const { contrastRatio } = await import("@/lib/brand/colour");
const { clientDocCopy } = await import("@/lib/i18n/clientDocCopy");
const { SITE_COPY } = await import("@/lib/site/siteCopy");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
const bulk = await import("@/lib/portal/bulkLinks");
const { SENT_EMAIL_KINDS, kindCategory, mayListKind } = await import("@/lib/email/sentEmailHistory");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

let passed = 0;
let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`FAIL ${name}${detail !== "" ? ` — ${detail}` : ""}`);
  }
}
const md5 = (e) => crypto.createHash("md5").update(`${e.subject}\0${e.html}\0${e.text}`).digest("hex");

// ── 1. The quote email's account line ────────────────────────────────────
{
  const companyRow = (o = {}) => {
    const base = {};
    for (const f of Object.keys(QUOTE_EMAIL_COMPANY_SELECT)) base[f] = null;
    return { name: "Northline Painting", brandColor: "#06356b", phone: "613-555-0100", currency: "CAD", defaultProcessNotes: null, ...base, quoteEmailIncludeReferences: false, quoteEmailIncludeBeforeAfter: false, ...o };
  };
  const quoteRow = (o = {}) => {
    const base = {};
    for (const f of Object.keys(QUOTE_EMAIL_QUOTE_SELECT)) base[f] = null;
    return { id: "q1", quoteNumber: "Q-1042", total: 14250, validUntil: new Date("2026-09-30T00:00:00Z"), processNotes: "We keep the driveway clear.", lineItems: null, ...base, ...o };
  };
  // A neutral host: the paste-this fallback prints the quote URL as visible
  // text, and the white-label assertion below is about the email's words.
  const url = "https://app.example.test/q/tok_abcdefghijklmnopqrstuvwxyz";
  const portal = "https://app.example.test/portal/ptok_ABCdef-123_xyz";

  for (const language of SUPPORTED_EMAIL_LANGUAGES) {
    const words = emailCopy(language).accountLine("Northline Painting");
    ok(`${language}: accountLine exists and names the company`, typeof words === "string" && words.includes("Northline Painting") && words.length > 25);
    ok(`${language}: accountLine is its own language, not English`, language === "en" || EMAIL_COPY[language].accountLine("X") !== EMAIL_COPY.en.accountLine("X"));
    ok(`${language}: accountLine is in the language's own table (no English fallback)`, typeof EMAIL_COPY[language].accountLine === "function");
    for (const kind of ["quote", "follow_up"]) {
      for (const type of ["individual", "company"]) {
        const tag = `${language}/${kind}/${type}`;
        const base = { quote: quoteRow(), company: companyRow(), url, language, kind, client: { name: "Jane Fournier", type } };
        const none = buildQuoteEmail(base);
        const withLink = buildQuoteEmail({ ...base, portalUrl: portal });
        ok(`${tag}: the line, linking the portal, once`, withLink.html.split(`href="${portal}"`).length === 2 && withLink.html.includes(escapeHtml(words)));
        ok(`${tag}: the text part carries the sentence and the link`, withLink.text.includes(portal) && withLink.text.includes(words.replace(/\s*→\s*$/, "")));
        ok(`${tag}: the subject never changes`, withLink.subject === none.subject);
        // Order: the approve button, the business line (if any), the paste
        // fallback, THEN the account line, and all of it above the scope.
        const iBtn = withLink.html.indexOf(`href="${url}"`);
        const iPaste = withLink.html.indexOf(escapeHtml(emailCopy(language).orPaste));
        const iAcct = withLink.html.indexOf(`href="${portal}"`);
        const iAdd = withLink.html.indexOf(`href="${url}/add"`);
        ok(`${tag}: under the first button and after the paste-this fallback`, iBtn > -1 && iBtn < iPaste && iPaste < iAcct);
        if (type === "company") ok(`${tag}: business — the add-to-your-quote line stays above it`, iAdd > -1 && iAdd < iAcct);
        else ok(`${tag}: homeowner — no add line`, iAdd === -1);
        ok(`${tag}: not repeated at the bottom`, withLink.html.lastIndexOf(`href="${portal}"`) === iAcct);
        // Cut the one block and the email without the line comes back.
        const block = new RegExp(`\\n\\s*<p style="[^"]*">\\s*<a href="${portal.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"[^>]*>[^<]*</a>\\s*</p>`);
        ok(`${tag}: cut the line and the HTML is byte-for-byte the email without it`, withLink.html.replace(block, "") === none.html);
        ok(`${tag}: text differs only by the two account lines`, withLink.text.split("\n").filter((l) => l !== portal && l !== words.replace(/\s*→\s*$/, "")).join("\n") === none.text);
      }
    }
  }

  // No link → byte-identical, however "no link" is spelled.
  const base = { quote: quoteRow(), company: companyRow(), url, language: "en", kind: "quote", client: { name: "Jane" } };
  const baseline = md5(buildQuoteEmail(base));
  for (const spelling of [undefined, null, "", "   ", "javascript:alert(1)", "/portal/relative", 42, { href: portal }]) {
    ok(`no usable portal link (${JSON.stringify(spelling)}) → byte-identical email`, md5(buildQuoteEmail({ ...base, portalUrl: spelling })) === baseline);
  }
  // An address with no client record must never break the email.
  let threw = null;
  try {
    const e = buildQuoteEmail({ ...base, client: null, portalUrl: null });
    ok("no client record: builds, no account line", !e.html.includes("/portal/") && e.subject.length > 0);
  } catch (err) {
    threw = err;
  }
  ok("no client record: never throws", threw === null, threw?.message);

  // Hostile company name and link: escaped in HTML, white-label.
  const hostile = buildQuoteEmail({ ...base, company: companyRow({ name: `Bob's <b>Paint</b> & "Co" ` }), portalUrl: `${portal}?a=1&b="2"` });
  ok("hostile company name escaped in the account line", !hostile.html.includes("<b>Paint</b>") && hostile.html.includes("&lt;b&gt;Paint&lt;/b&gt;"));
  ok("hostile link attribute escaped", !hostile.html.includes('b="2"'));
  ok("company name trimmed in the account line", hostile.text.includes(`"Co": see your quotes`));
  const visible = buildQuoteEmail({ ...base, portalUrl: portal }).html.replace(/\s(?:src|href)="[^"]*"/gi, "");
  ok("the quote email's visible text never says FieldQuo", !/fieldquo/i.test(visible) && !/fieldquo/i.test(buildQuoteEmail({ ...base, portalUrl: portal }).subject));

  // The line is inkMuted on paper — measured on the brands contractors pick.
  for (const hex of ["#ffffff", "#ffff00", "#fefcdd", "#000000", "#808080", "#B8860B", "#39ff14", "not-a-colour", null]) {
    const t = documentTheme({ brandColor: hex });
    const html = buildQuoteEmail({ ...base, company: companyRow({ brandColor: hex }), portalUrl: portal }).html;
    const m = html.match(new RegExp(`href="${portal.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}" style="color:([^;]+);`));
    ok(`account line colour is theme inkMuted for ${hex}`, m && m[1] === t.inkMuted, m?.[1]);
    ok(`account line clears 4.5:1 on paper for ${hex}`, contrastRatio(t.inkMuted, t.paper) >= 4.5, contrastRatio(t.inkMuted, t.paper).toFixed(2));
  }
}

// ── 2. The send route mints the token, past every refusal ────────────────
{
  const route = read("app/api/quotes/[id]/send/route.js");
  const iTax = route.indexOf("if (refusal) return NextResponse.json(refusal, { status: 409 });");
  const iMint = route.indexOf("await ensurePortalToken(db, quote.clientId, member.companyId)");
  const iBuild = route.indexOf("buildQuoteEmail({");
  const iSend = route.indexOf("await sendEmail({");
  ok("quote send: mints the portal token after the tax refusal, before the email is built and sent", iTax > -1 && iTax < iMint && iMint < iBuild && iBuild < iSend);
  ok("quote send: the mint is scoped to the member's company", /ensurePortalToken\(db, quote\.clientId, member\.companyId\)/.test(route));
  ok("quote send: a failed mint never fails the send", /ensurePortalToken\(db, quote\.clientId, member\.companyId\)\.catch\(/.test(route) && /if \(quote\.clientId\)/.test(route));
  ok("quote send: passes portalUrl to the email", /portalUrl: clientPortalUrl,/.test(route));
  const preview = read("lib/email/documentEmailPreview.js");
  ok("the wording preview shows the line with a placeholder, never a minted token", /portalUrl: `\$\{origin\}\/portal\/preview`/.test(preview) && !/ensurePortalToken/.test(preview));
}

// ── 3. POST /api/portal-login, executed ──────────────────────────────────
{
  const { POST } = await import("../app/api/portal-login/route.js");
  let ipSeq = 0;
  const req = (body, { ip, host = "www.fieldquo.test" } = {}) =>
    new Request("https://www.fieldquo.test/api/portal-login", {
      method: "POST",
      headers: { "content-type": "application/json", host, "x-forwarded-for": ip || `10.0.0.${++ipSeq}` },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  // The per-address bucket lives in lib/rateLimit's memory for the life of
  // this process, so each scenario uses its own address.
  const seed = (email = "libby@example.com") => {
    stub.resetStub();
    stub.rows.company.push(
      { id: "co_A", name: "Alpha Painting", country: "CA", slug: "alpha-painting-x1", bookingSlug: null, email: "office@alpha.test", brandColor: "#ffff00", defaultLanguage: "en" },
      { id: "co_B", name: "Beta Roofing", country: "CA", slug: "beta-roofing-x2", bookingSlug: "beta", email: "office@beta.test", brandColor: "#123456", defaultLanguage: "en" },
      { id: "co_C", name: "Not Ready Co", country: null, slug: "not-ready", bookingSlug: null },
    );
    stub.rows.companySite.push({ id: "s1", companyId: "co_A", subdomain: "alpha", published: true, clientPortalEnabled: true });
    stub.rows.client.push(
      { id: "c_A1", companyId: "co_A", name: "Libby Angelos", email: email.replace(/^l/, "L").replace("example", "Example"), language: "fr", portalToken: null, createdAt: new Date(1) },
      { id: "c_B1", companyId: "co_B", name: "Libby Angelos", email, language: "en", portalToken: null, createdAt: new Date(2) },
    );
  };

  seed("libby1@example.com");
  const r1 = await POST(req({ companySlug: "alpha-painting-x1", email: "libby1@example.com" }));
  const body1 = await r1.text();
  ok("slug login: answers 200 with the neutral body", r1.status === 200 && body1 === JSON.stringify({ ok: true }), `${r1.status} ${body1}`);
  ok("slug login: nothing is sent before the response", stub.sent.length === 0 && stub.afterQueue.length === 1);
  await stub.drainAfter();
  ok("slug login: after the response, the slug's company's client gets one link", stub.sent.length === 1 && stub.sent[0].to === "Libby1@Example.com");
  ok("slug login: from that company, in the client's language", stub.sent[0].from.startsWith("Alpha Painting") && stub.sent[0].subject === clientDocCopy("fr").portal.loginEmailSubject("Alpha Painting"));
  ok("slug login: the link opens on the app origin, not a host the browser chose", stub.sent[0].text.includes("https://www.fieldquo.test/portal/"));
  ok("slug login: the other company's client is never touched", !stub.rows.client.find((c) => c.id === "c_B1").portalToken && !/Beta/.test(stub.sent[0].html));

  // The company is the slug's, whatever the body says.
  seed("libby2@example.com");
  await POST(req({ companySlug: "alpha-painting-x1", email: "libby2@example.com", companyId: "co_B", company: "co_B", subdomain: undefined }));
  await stub.drainAfter();
  ok("a companyId in the body is ignored — the slug decides", stub.sent.length === 1 && stub.sent[0].from.startsWith("Alpha") && !stub.rows.client.find((c) => c.id === "c_B1").portalToken);

  // bookingSlug wins, the same rule as the booking page and every embed.
  seed("libby3@example.com");
  await POST(req({ companySlug: "beta", email: "libby3@example.com" }));
  await stub.drainAfter();
  ok("bookingSlug resolves (findBookingCompany)", stub.sent.length === 1 && stub.sent[0].from.startsWith("Beta"));

  // Never reveals whether the email matched: same status, same bytes.
  seed();
  const miss = await POST(req({ companySlug: "alpha-painting-x1", email: "stranger@nowhere.test" }));
  const missBody = await miss.text();
  await stub.drainAfter();
  ok("a stranger's address: same status and the same bytes as a match", miss.status === r1.status && missBody === body1);
  ok("a stranger's address: nothing is sent", stub.sent.length === 0);

  // Per-address limit: 3 an hour per company, the 4th is the neutral body
  // and sends nothing — and the bucket is shared with the website door.
  seed("libby4@example.com");
  const bodies = [];
  for (let i = 0; i < 3; i++) {
    const r = await POST(req({ companySlug: "alpha-painting-x1", email: "libby4@example.com" }));
    bodies.push(await r.text());
  }
  const viaSite = await POST(req({ subdomain: "alpha", email: "libby4@example.com" }));
  const viaSiteBody = await viaSite.text();
  await stub.drainAfter();
  ok("per-address limit: 3 sends, then the 4th (through the OTHER door) is neutral and sends nothing", stub.sent.length === 3 && viaSite.status === 200 && viaSiteBody === body1, `${stub.sent.length}`);
  ok("rate-limited answer is the same bytes as a match", bodies.every((b) => b === body1));

  // Refusals are about the REQUEST, never the address.
  seed();
  const cases = [
    [{ companySlug: "no-such-company", email: "libby@example.com" }, 404, "unknown slug"],
    [{ companySlug: "not-ready", email: "libby@example.com" }, 404, "company not ready to face a client"],
    [{ companySlug: "../../etc", email: "libby@example.com" }, 404, "hostile slug"],
    [{ companySlug: "alpha-painting-x1", subdomain: "alpha", email: "libby@example.com" }, 404, "both doors at once"],
    [{ email: "libby@example.com" }, 404, "neither door"],
    [{ companyId: "co_A", email: "libby@example.com" }, 404, "a company id alone"],
    [{ companySlug: "alpha-painting-x1", email: "not-an-email" }, 400, "not an email"],
    [{ companySlug: { $ne: 1 }, email: "libby@example.com" }, 404, "object slug"],
  ];
  for (const [b, status, label] of cases) {
    const r = await POST(req(b));
    ok(`refused: ${label} → ${status}`, r.status === status, String(r.status));
  }
  await stub.drainAfter();
  ok("no refusal sent anything", stub.sent.length === 0);
  const unknown = await POST(req({ companySlug: "no-such-company", email: "a@b.co" }));
  const unknownMatch = await POST(req({ companySlug: "no-such-company", email: "libby@example.com" }));
  ok("an unknown slug answers the same whatever the address", unknown.status === unknownMatch.status && (await unknown.text()) === (await unknownMatch.text()));

  const route = read("app/api/portal-login/route.js");
  ok("route: never reads a company id from the body", !/body\??\.companyId/.test(route));
  ok("route: the slug resolves through findBookingCompany", /findBookingCompany\(slug, \{ id: true \}\)/.test(route));
}

// ── 4. The standalone login page ─────────────────────────────────────────
{
  const page = read("app/portal/login/[companySlug]/page.js");
  ok("page: company from the slug via findBookingCompany", /findBookingCompany\(slug, COMPANY_SELECT\)/.test(page));
  ok("page: params and searchParams awaited", /const \{ companySlug \} = await params;/.test(page) && /await searchParams/.test(page));
  ok("page: never indexed", /index: false, follow: false/.test(page) && /clientPageMetadata\(company/.test(page));
  ok("page: on a tenant host, only that tenant's own login", /subdomainFromHost\(/.test(page) && /site\.companyId !== company\.id/.test(page));
  ok("page: posts the slug, never an id", /companySlug=\{company\.bookingSlug \|\| company\.slug\}/.test(page) && !/companyId=\{/.test(page));
  ok("page: no FieldQuo in anything a visitor reads", !/FieldQuo/.test(page.replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "")));
  ok("page: measured colours only (theme + fillPair + a re-measured contact line)", /documentTheme\(company\)/.test(page) && /fillPair\(theme\)/.test(page) && /ensureContrast\(theme\.inkMuted, theme\.page, 4\.5\)/.test(page));
  const nf = read("app/portal/login/[companySlug]/not-found.js");
  ok("page: its own neutral not-found (no FieldQuo marketing 404)", /neutralClientMetadata/.test(nf) && !/FieldQuo/.test(nf.replace(/^\s*\/\/.*$/gm, "")));
  const form = read("app/site/[subdomain]/ClientLoginForm.js");
  ok("form: sends exactly one of slug or subdomain", /companySlug \? \{ companySlug, email \} : \{ subdomain, email \}/.test(form));
  for (const t of [documentTheme({ brandColor: "#ffff00" }), documentTheme({ brandColor: "#ffffff" }), documentTheme({ brandColor: "#808080" })]) {
    const { ensureContrast } = await import("@/lib/brand/colour");
    ok(`page contact line 4.5:1 on the page tint (${t.brand})`, contrastRatio(ensureContrast(t.inkMuted, t.page, 4.5), t.page) >= 4.5);
    ok(`page body text 4.5:1 on paper (${t.brand})`, contrastRatio(t.ink, t.paper) >= 4.5 && contrastRatio(t.inkMuted, t.paper) >= 4.5);
  }
  for (const code of SUPPORTED_EMAIL_LANGUAGES) {
    const c = SITE_COPY[code];
    ok(`page copy in ${code}`, Boolean(c && c.clientLoginHeading && c.clientLoginIntro && c.clientLoginSend && c.clientLoginSent));
  }
}

// ── 5. Eligibility on hostile fixtures ───────────────────────────────────
const NOW = new Date("2026-10-10T12:00:00Z");
const DAY = 86400000;
function seedClients() {
  stub.resetStub();
  stub.rows.company.push(
    { id: "co_A", name: "Alpha Painting", country: "CA", slug: "alpha", email: "office@alpha.test", brandColor: "#808080", defaultLanguage: "en", logoUrl: null, phone: "555-0100" },
    { id: "co_B", name: "Beta Roofing", country: "CA", slug: "beta", email: "office@beta.test", defaultLanguage: "en" },
  );
  const c = (id, o = {}) => stub.rows.client.push({ id, companyId: "co_A", name: id, email: `${id}@example.test`, language: null, doNotContactAt: null, portalToken: null, ...o });
  const job = (id, clientId, o = {}) => stub.rows.job.push({ id, companyId: "co_A", clientId, quoteId: null, title: `Job ${id}`, status: "scheduled", archivedAt: null, historicalImportedAt: null, ...o });
  const quote = (id, clientId, o = {}) => stub.rows.quote.push({ id, companyId: "co_A", clientId, quoteNumber: `Q-${id}`, status: "sent", archivedAt: null, historicalImportedAt: null, ...o });

  c("ok_job"); job("j1", "ok_job");
  c("ok_quote_sent", { language: "fr" }); quote("q1", "ok_quote_sent");
  c("ok_accepted_open_job"); quote("q2", "ok_accepted_open_job", { status: "accepted" }); job("j2", "ok_accepted_open_job", { quoteId: "q2", status: "unscheduled" });
  c("ok_in_progress"); job("j3", "ok_in_progress", { status: "in_progress" });
  c("no_email", { email: null }); job("j4", "no_email");
  c("blank_email", { email: "   " }); job("j5", "blank_email");
  c("bad_email", { email: "not-an-email" }); job("j6", "bad_email");
  c("dnc", { doNotContactAt: new Date(NOW - DAY) }); job("j7", "dnc");
  c("unsub", { email: "Unsub@Example.TEST" }); job("j8", "unsub");
  stub.rows.marketingSubscriber.push({ id: "m1", companyId: "co_A", email: "unsub@example.test", subscribed: false });
  // An unsubscribe at ANOTHER company does not opt them out of this one.
  c("unsub_elsewhere"); job("j9", "unsub_elsewhere");
  stub.rows.marketingSubscriber.push({ id: "m2", companyId: "co_B", email: "unsub_elsewhere@example.test", subscribed: false });
  c("closed_job"); job("j10", "closed_job", { status: "completed" });
  c("cancelled_job"); job("j11", "cancelled_job", { status: "cancelled" });
  c("declined_quote"); quote("q3", "declined_quote", { status: "declined" });
  c("draft_quote"); quote("q4", "draft_quote", { status: "draft" });
  c("accepted_done"); quote("q5", "accepted_done", { status: "accepted" }); job("j12", "accepted_done", { quoteId: "q5", status: "completed" });
  c("sent_cancelled"); quote("q6", "sent_cancelled", { status: "sent" }); job("j13", "sent_cancelled", { quoteId: "q6", status: "cancelled" });
  c("archived_job"); job("j14", "archived_job", { archivedAt: new Date(NOW - DAY) });
  c("archived_quote"); quote("q7", "archived_quote", { archivedAt: new Date(NOW - DAY) });
  c("historical"); job("j15", "historical", { historicalImportedAt: new Date(NOW - DAY), status: "scheduled" }); quote("q8", "historical", { status: "accepted", historicalImportedAt: new Date(NOW - DAY) });
  c("nothing");
  c("recent"); job("j16", "recent");
  stub.rows.sentEmail.push({ id: "se1", companyId: "co_A", clientId: "recent", kind: "portal_link", createdAt: new Date(NOW - 5 * DAY) });
  c("old_send"); job("j17", "old_send");
  stub.rows.sentEmail.push({ id: "se2", companyId: "co_A", clientId: "old_send", kind: "portal_link", createdAt: new Date(NOW - 40 * DAY) });
  c("recent_quote_email"); job("j18", "recent_quote_email");
  stub.rows.sentEmail.push({ id: "se3", companyId: "co_A", clientId: "recent_quote_email", kind: "quote", createdAt: new Date(NOW - 2 * DAY) });
  // A portal link recorded at ANOTHER company for an id that matches nothing here.
  stub.rows.sentEmail.push({ id: "se4", companyId: "co_B", clientId: "ok_job", kind: "portal_link", createdAt: new Date(NOW - DAY) });
  // Another company's client, with an open job and an email.
  stub.rows.client.push({ id: "b_client", companyId: "co_B", name: "Beta Client", email: "b@example.test", language: null, doNotContactAt: null, portalToken: null });
  stub.rows.job.push({ id: "jb", companyId: "co_B", clientId: "b_client", quoteId: null, title: "Beta job", status: "scheduled", archivedAt: null, historicalImportedAt: null });
}
const EXPECT_ELIGIBLE = ["ok_job", "ok_quote_sent", "ok_accepted_open_job", "ok_in_progress", "unsub_elsewhere", "old_send", "recent_quote_email"].sort();
const EXPECT_SKIP = {
  no_email: "no_email", blank_email: "no_email", bad_email: "no_email",
  dnc: "opted_out", unsub: "opted_out",
  closed_job: "inactive", cancelled_job: "inactive", declined_quote: "inactive", draft_quote: "inactive",
  accepted_done: "inactive", sent_cancelled: "inactive", archived_job: "inactive", archived_quote: "inactive",
  historical: "inactive", nothing: "inactive",
  recent: "recent",
};
for (const leakMode of [false, true]) {
  seedClients();
  stub.leak.on = leakMode;
  const mode = leakMode ? " (every list query leaking)" : "";
  const out = await bulk.eligiblePortalRecipients(stub.db, { companyId: "co_A", now: NOW });
  const ids = out.recipients.map((r) => r.id).sort();
  ok(`eligible set is exactly the open, reachable clients${mode}`, JSON.stringify(ids) === JSON.stringify(EXPECT_ELIGIBLE), ids.join(","));
  ok(`another company's client is never listed${mode}`, !ids.includes("b_client"));
  for (const [id, why] of Object.entries(EXPECT_SKIP)) {
    const row = stub.rows.client.find((c) => c.id === id);
    const unsubscribed = new Set(stub.rows.marketingSubscriber.filter((s) => s.companyId === "co_A" && !s.subscribed).map((s) => s.email.toLowerCase()));
    const recentlySent = new Set(stub.rows.sentEmail.filter((s) => s.companyId === "co_A" && s.kind === "portal_link" && +s.createdAt >= +NOW - 30 * DAY).map((s) => s.clientId));
    const shaped = {
      ...row,
      jobs: stub.rows.job.filter((j) => leakMode || j.clientId === id),
      quotes: stub.rows.quote.filter((q) => leakMode || q.clientId === id).map((q) => ({ ...q, jobs: stub.rows.job.filter((j) => leakMode || j.quoteId === q.id) })),
    };
    const v = bulk.classifyClient(shaped, { companyId: "co_A", unsubscribed, recentlySent });
    ok(`${id} → skipped as ${why}${mode}`, v.eligible === false && v.skip === why, JSON.stringify(v));
  }
  ok(`skipped counts add up${mode}`, out.skipped.no_email === 3 && out.skipped.opted_out === 2 && out.skipped.inactive === 10 && out.skipped.recent === 1, JSON.stringify(out.skipped));
  const why = out.recipients.find((r) => r.id === "ok_accepted_open_job").why;
  ok(`why names the open job and the accepted quote${mode}`, why.some((w) => w.kind === "job" && w.status === "unscheduled") && why.some((w) => w.kind === "quote" && w.status === "accepted"));
  ok(`classify refuses another company's client outright${mode}`, bulk.classifyClient({ id: "b_client", companyId: "co_B", email: "b@example.test", jobs: [{ id: "jb", companyId: "co_B", clientId: "b_client", status: "scheduled" }] }, { companyId: "co_A" }).skip === "other_company");
  ok(`the enums are the real ones${mode}`, JSON.stringify(bulk.ACTIVE_QUOTE_STATUSES) === '["sent","accepted"]' && JSON.stringify(bulk.CLOSED_JOB_STATUSES) === '["completed","cancelled"]');
}
{
  const schema = read("prisma/schema.prisma");
  const enumBody = (name) => (schema.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\}`)) || [])[1] || "";
  const values = (name) => enumBody(name).split("\n").map((l) => l.replace(/\/\/.*$/, "").trim()).filter(Boolean);
  ok("QuoteStatus has sent and accepted", ["sent", "accepted"].every((v) => values("QuoteStatus").includes(v)), values("QuoteStatus").join(","));
  ok("JobStatus has completed and cancelled (that spelling)", ["completed", "cancelled"].every((v) => values("JobStatus").includes(v)), values("JobStatus").join(","));
}

// ── 6. Nothing sends without confirm — the tool ──────────────────────────
{
  const company = { id: "co_A", name: "Alpha Painting", email: "office@alpha.test", brandColor: "#808080", defaultLanguage: "en" };
  const linkFor = (t) => `https://www.fieldquo.test/portal/${t}`;
  const args = { db: stub.db, companyId: "co_A", company, now: NOW, linkFor, send: stub.sendEmail, resolveSender: stub.resolveSender, pause: async () => {}, spacingMs: 0 };

  seedClients();
  const dry = await bulk.sendBulkPortalLinks({ db: stub.db, companyId: "co_A", company, now: NOW });
  ok("default is a dry run", dry.dryRun === true && dry.recipients.length === EXPECT_ELIGIBLE.length);
  ok("dry run: nothing sent, nothing written, no token minted", stub.sent.length === 0 && stub.writes.length === 0 && stub.rows.client.every((c) => !c.portalToken));
  ok("dry run: a rendered sample with the placeholder link", dry.sample && dry.sample.html.includes(escapeHtml(bulk.DRY_RUN_LINK)) && dry.sample.subject.includes("Alpha Painting"));
  ok("dry run sample: never says FieldQuo", !/fieldquo/i.test(dry.sample.html.replace(/\s(?:src|href)="[^"]*"/gi, "")) && !/fieldquo/i.test(dry.sample.subject));
  ok("dry run sample: office wording, not 'if you didn't ask'", !dry.sample.text.includes(clientDocCopy("en").portal.loginEmailIgnore));

  for (const [label, extra] of [
    ["dryRun:false without confirm", { dryRun: false }],
    ["confirm: \"true\" (a string)", { dryRun: false, confirm: "true" }],
    ["confirm: 1", { dryRun: false, confirm: 1 }],
    ["confirm without dryRun:false", { confirm: true }],
    ["confirm with a stale count", { dryRun: false, confirm: true, expected: EXPECT_ELIGIBLE.length + 1 }],
  ]) {
    seedClients();
    const r = await bulk.sendBulkPortalLinks({ ...args, ...extra });
    ok(`${label}: nothing sent, nothing written`, stub.sent.length === 0 && stub.writes.length === 0, JSON.stringify({ r: r.refused || r.dryRun, w: stub.writes.length }));
  }

  seedClients();
  const real = await bulk.sendBulkPortalLinks({ ...args, dryRun: false, confirm: true, expected: EXPECT_ELIGIBLE.length, sentByUserId: "u1", sentByName: "Owner" });
  ok("confirmed: one email per eligible client", real.sent === EXPECT_ELIGIBLE.length && stub.sent.length === EXPECT_ELIGIBLE.length, JSON.stringify(real));
  ok("confirmed: to the address on file", stub.sent.map((m) => m.to).sort().join() === EXPECT_ELIGIBLE.map((id) => `${id}@example.test`).sort().join());
  ok("confirmed: never to another company's client", !stub.sent.some((m) => m.to === "b@example.test"));
  ok("confirmed: from the company", stub.sent.every((m) => m.from.startsWith("Alpha Painting") && m.companyId === "co_A"));
  ok("confirmed: in the client's language", stub.sent.find((m) => m.to === "ok_quote_sent@example.test").subject === clientDocCopy("fr").portal.loginEmailSubject("Alpha Painting"));
  ok("confirmed: each link is that client's own token", stub.sent.every((m) => {
    const c = stub.rows.client.find((x) => `${x.id}@example.test` === m.to);
    return c?.portalToken && m.text.includes(`/portal/${c.portalToken}`);
  }));
  ok("confirmed: tokens minted only for the recipients", stub.rows.client.filter((c) => c.portalToken).map((c) => c.id).sort().join() === EXPECT_ELIGIBLE.join());
  const kept = stub.rows.sentEmail.filter((s) => s.kind === "portal_link" && s.companyId === "co_A" && +s.createdAt > +NOW - DAY);
  ok("confirmed: each send logged to SentEmail as portal_link, with its client", kept.length === EXPECT_ELIGIBLE.length && kept.every((s) => EXPECT_ELIGIBLE.includes(s.clientId) && s.sentByName === "Owner" && s.subject && s.html));
  const again = await bulk.sendBulkPortalLinks({ db: stub.db, companyId: "co_A", company, now: new Date() });
  ok("a second press finds nobody: whoever got it is inside the window", again.recipients.length === 0 && again.skipped.recent === EXPECT_ELIGIBLE.length + 1, JSON.stringify(again.skipped));

  seedClients();
  stub.sendBehaviour.mode = "skipped";
  const unconfigured = await bulk.sendBulkPortalLinks({ ...args, dryRun: false, confirm: true, expected: EXPECT_ELIGIBLE.length });
  ok("unconfigured mail stops at the first refusal and logs nothing", unconfigured.sent === 0 && unconfigured.attempted === 1 && stub.rows.sentEmail.filter((s) => +s.createdAt > +NOW).length === 0);

  seedClients();
  const capped = await bulk.sendBulkPortalLinks({ ...args, dryRun: false, confirm: true, expected: 2, batch: 2 });
  ok("one press sends at most the batch, and says how many remain", capped.sent === 2 && capped.remaining === EXPECT_ELIGIBLE.length - 2);
}

// ── 6b. The route, executed ──────────────────────────────────────────────
{
  const { GET, POST } = await import("../app/api/clients/portal-links/route.js");
  const reqGet = () => new Request("https://www.fieldquo.test/api/clients/portal-links", { method: "GET", headers: { host: "www.fieldquo.test" } });
  const reqPost = (body) =>
    new Request("https://www.fieldquo.test/api/clients/portal-links", { method: "POST", headers: { "content-type": "application/json", host: "www.fieldquo.test" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const owner = { id: "m1", userId: "u1", companyId: "co_A", role: "owner" };

  for (const role of ["employee", "supervisor"]) {
    seedClients();
    stub.session.member = { ...owner, role };
    const g = await GET(reqGet());
    const p = await POST(reqPost({ confirm: true, expected: EXPECT_ELIGIBLE.length }));
    ok(`${role}: refused the preview and the send`, g.status === 403 && p.status === 403 && stub.sent.length === 0);
  }
  seedClients();
  stub.session.member = { ...owner, role: "admin", impersonation: true, impersonationMode: "read_only" };
  const imp = await POST(reqPost({ confirm: true, expected: EXPECT_ELIGIBLE.length }));
  ok("a support session may not send", imp.status === 403 && stub.sent.length === 0);

  seedClients();
  stub.session.member = owner;
  const g = await GET(reqGet());
  const gb = await g.json();
  ok("GET is the dry run: count, reasons, a sample — nothing sent or written", g.status === 200 && gb.count === EXPECT_ELIGIBLE.length && gb.sample?.subject && gb.recipients.every((r) => r.why.length > 0) && stub.sent.length === 0 && stub.writes.length === 0);
  ok("GET never lists another company's client", !gb.recipients.some((r) => r.id === "b_client"));

  for (const [label, body] of [
    ["no body", undefined],
    ["empty object", {}],
    ["confirm false", { confirm: false, expected: EXPECT_ELIGIBLE.length }],
    ["confirm as a string", { confirm: "true", expected: EXPECT_ELIGIBLE.length }],
  ]) {
    seedClients();
    stub.session.member = owner;
    const r = await POST(reqPost(body));
    ok(`POST ${label}: 400, nothing sent`, r.status === 400 && stub.sent.length === 0 && stub.writes.length === 0, String(r.status));
  }
  seedClients();
  stub.session.member = owner;
  const noCount = await POST(reqPost({ confirm: true }));
  ok("POST confirm without the count shown: 409, nothing sent", noCount.status === 409 && stub.sent.length === 0);
  const stale = await POST(reqPost({ confirm: true, expected: 1 }));
  ok("POST confirm with a stale count: 409, nothing sent", stale.status === 409 && stub.sent.length === 0);

  seedClients();
  stub.session.member = owner;
  const sent = await POST(reqPost({ confirm: true, expected: EXPECT_ELIGIBLE.length }));
  const sb = await sent.json();
  ok("POST confirm with the count shown: sends to exactly the list", sent.status === 200 && sb.sent === EXPECT_ELIGIBLE.length && stub.sent.length === EXPECT_ELIGIBLE.length, JSON.stringify(sb));
  ok("POST: one activity row for the press", stub.activity.length === 1 && stub.activity[0].event.action === "client.portal_links_bulk_sent");

  seedClients();
  stub.session.member = { ...owner, companyId: "co_B" };
  const other = await POST(reqPost({ confirm: true, expected: 1 }));
  ok("another company's owner reaches only their own client", other.status === 200 && stub.sent.length === 1 && stub.sent[0].to === "b@example.test");
}

// ── 7. Screens, History, settings, wiring ────────────────────────────────
{
  const page = read("app/app/clients/page.js");
  ok("Clients page: the action is owner/admin only", /const canBulkPortal = perms\?\.role === "owner" \|\| perms\?\.role === "admin";/.test(page) && /\{canBulkPortal && \(/.test(page));
  const dialog = read("app/app/clients/PortalLinksDialog.js");
  ok("dialog: opens on the dry run (GET)", /fetchJson\("\/api\/clients\/portal-links"\)/.test(dialog));
  ok("dialog: the only POST is the confirm button's, with the count shown", (dialog.match(/method: "POST"/g) || []).length === 1 && /JSON\.stringify\(\{ confirm: true, expected: preview\.batch \}\)/.test(dialog));
  ok("dialog: the sample email is sandboxed", /sandbox=""/.test(dialog));

  ok("SentEmail: portal_link is a kind", SENT_EMAIL_KINDS.includes("portal_link") && kindCategory("portal_link") === "contacts");
  ok("SentEmail: a member without full client access never lists it", !mayListKind({ read: true, contacts: false, quotes: true, invoices: true, jobs: true }, "portal_link") && mayListKind({ read: true, contacts: true }, "portal_link"));
  const single = read("app/api/clients/[id]/portal-link/route.js");
  ok("the client page's single send is logged as portal_link too", /kind: "portal_link"/.test(single) && /recordSentEmail\(db,/.test(single));
  ok("timeline names the kind", /portal_link: "app\.conversation\.doc\.portalLinkSent"/.test(read("lib/conversations/clientTimeline.js")));

  const lead = read("app/app/settings/lead-form/page.js");
  ok("Settings › Share your links: the Client login link, built from the same slug", /const clientLoginUrl = `\$\{origin\}\/portal\/login\/\$\{slug\}`;/.test(lead) && /url=\{clientLoginUrl\}/.test(lead) && /copy\("link", url\)/.test(lead));

  const keys = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.portalLinks.") || k.startsWith("app.setLeadForm.clientLogin"));
  keys.push("app.emailHistory.kind.portal_link", "app.conversation.doc.portalLinkSent");
  ok("app keys found", keys.length >= 30, keys.length);
  for (const [code, table] of Object.entries(APP_MESSAGES)) {
    const missing = keys.filter((k) => typeof table[k] !== "string" || !table[k].trim());
    ok(`app locale ${code} has every portal-link key`, missing.length === 0, missing.join(","));
  }
  for (const k of keys.filter((k) => /\{(\w+)\}/.test(APP_MESSAGES.en[k]))) {
    const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const [code, table] of Object.entries(APP_MESSAGES)) {
      ok(`${code} ${k}: same placeholders as English`, holes(table[k]) === holes(APP_MESSAGES.en[k]), table[k]);
    }
  }

  const pkg = JSON.parse(read("package.json"));
  ok("package.json: check:portal-account-links exists and check:all runs it", Boolean(pkg.scripts["check:portal-account-links"]) && pkg.scripts["check:all"].includes("check:portal-account-links"));
  ok("the dry-run script only ever dry-runs", (() => {
    const s = read("scripts/portal-links-dry-run.mjs");
    return /dryRun: true/.test(s) && !/dryRun: false/.test(s) && !/confirm: true/.test(s) && !/sendEmail/.test(s);
  })());
}

console.log(`check-portal-account-links: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
