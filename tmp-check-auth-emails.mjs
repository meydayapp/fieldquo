import { resetPasswordEmail, verifyEmail, authEmailCopy, AUTH_EMAIL_LANGUAGES } from "@/lib/email/authEmails";

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
const ok = (m) => console.log("ok  ", m);

// 1. six languages, every key present in every one
const EXPECT = ["en","fr","es","uk","pa","tl"];
if (JSON.stringify(AUTH_EMAIL_LANGUAGES) !== JSON.stringify(EXPECT)) fail("languages " + AUTH_EMAIL_LANGUAGES);
else ok("six languages: " + AUTH_EMAIL_LANGUAGES.join(", "));

const enKeys = Object.keys(authEmailCopy("en")).sort();
for (const l of EXPECT) {
  const k = Object.keys(authEmailCopy(l)).sort();
  if (JSON.stringify(k) !== JSON.stringify(enKeys)) fail(`key parity ${l}`);
}
ok("key parity across all six");

// unknown language falls back
if (authEmailCopy("zz").resetSubject !== authEmailCopy("en").resetSubject) fail("fallback");
if (authEmailCopy(null).resetSubject !== authEmailCopy("en").resetSubject) fail("null fallback");
if (authEmailCopy("FR").resetSubject !== authEmailCopy("fr").resetSubject) fail("case fallback");
ok("unknown / null / uppercase language falls back sanely");

// 2. every language renders both emails, no undefined, no [object Object]
for (const l of EXPECT) {
  for (const fn of [resetPasswordEmail, verifyEmail]) {
    const m = fn({ url: "https://app.fieldquo.com/reset?token=abc", userName: "Dev", language: l, company: { name: "Northline" }, expiresMinutes: 60 });
    for (const part of ["subject","html","text"]) {
      if (typeof m[part] !== "string" || !m[part]) fail(`${l} ${fn.name} ${part} empty`);
      if (/undefined|NaN|\[object Object\]/.test(m[part])) fail(`${l} ${fn.name} ${part} placeholder leak`);
    }
    if (!m.text.includes("https://app.fieldquo.com/reset?token=abc")) fail(`${l} ${fn.name} text has no link`);
    if (!m.html.includes("https://app.fieldquo.com/reset?token=abc")) fail(`${l} ${fn.name} html has no link`);
  }
}
ok("all 12 renders: subject/html/text non-empty, link present, no placeholder leaks");

// 3. reset email carries the not-you sentence in every language
for (const l of EXPECT) {
  const m = resetPasswordEmail({ url: "https://x.test/a", language: l });
  if (!m.html.includes(authEmailCopy(l).resetNotYou.slice(0, 20).replace(/&/g,"&amp;"))) fail(`${l} missing not-you`);
  if (!m.text.includes(authEmailCopy(l).resetNotYou)) fail(`${l} text missing not-you`);
}
ok("reset not-you sentence present in html + text, all six");

// 4. expiry
const hr = resetPasswordEmail({ url: "https://x.test/a", expiresMinutes: 60 });
if (!hr.text.includes("expires in 1 hour")) fail("60min should read as 1 hour: " + hr.text);
const day = resetPasswordEmail({ url: "https://x.test/a", expiresMinutes: 1440 });
if (!day.text.includes("expires in 24 hours")) fail("1440 -> 24 hours");
const mins = resetPasswordEmail({ url: "https://x.test/a", expiresMinutes: 15 });
if (!mins.text.includes("expires in 15 minutes")) fail("15 minutes");
const none = resetPasswordEmail({ url: "https://x.test/a" });
if (/expire/i.test(none.text)) fail("invented an expiry with none supplied");
for (const bad of [0, -5, NaN, "soon", null, undefined, Infinity]) {
  const m = resetPasswordEmail({ url: "https://x.test/a", expiresMinutes: bad });
  if (/expire|NaN/i.test(m.text)) fail("bad expiry leaked: " + JSON.stringify(bad));
}
ok("expiry: 60->1 hour, 1440->24 hours, 15->minutes, absent/garbage -> sentence omitted");
// uk plurals
const ukOne = resetPasswordEmail({ url: "https://x.test/a", language: "uk", expiresMinutes: 60 }).text;
const ukFew = resetPasswordEmail({ url: "https://x.test/a", language: "uk", expiresMinutes: 1440 }).text;
const ukMany = resetPasswordEmail({ url: "https://x.test/a", language: "uk", expiresMinutes: 300 }).text;
if (!ukOne.includes("1 годину") || !ukFew.includes("24 години") || !ukMany.includes("5 годин")) fail("uk plurals: " + [ukOne,ukFew,ukMany].join(" | "));
ok("uk plurals: 1 годину / 24 години / 5 годин");

// 5. hostile input — injection via name and company
const nasty = resetPasswordEmail({
  url: "https://x.test/a",
  userName: `</p><script>alert(1)</script>`,
  company: { name: `Acme" onmouseover="evil()` },
});
if (/<script>/.test(nasty.html)) fail("script tag survived escaping");
if (/onmouseover="evil/.test(nasty.html)) fail("attribute break survived");
ok("hostile name + company are escaped in html");

// url with a quote cannot break out of href
const q = resetPasswordEmail({ url: `https://x.test/a"><script>alert(1)</script>` });
if (/<script>/.test(q.html)) fail("url injection");
ok("hostile url cannot break out of href");

// javascript: url refused, not rendered as a dead button
for (const bad of ["javascript:alert(1)", "data:text/html,x", "", null, undefined, "   "]) {
  let threw = false;
  try { resetPasswordEmail({ url: bad }); } catch { threw = true; }
  if (!threw) fail("unsafe/absent url did not throw: " + JSON.stringify(bad));
}
ok("javascript:/data:/empty url throws instead of emitting a dead button");

// 6. no token beyond the link itself
const t = resetPasswordEmail({ url: "https://app.fieldquo.com/reset-password?token=SECRETTOKEN123", language: "fr" });
const occurrences = (s) => (s.match(/SECRETTOKEN123/g) || []).length;
if (occurrences(t.subject) !== 0) fail("token in subject");
if (occurrences(t.text) !== 1) fail("token appears " + occurrences(t.text) + " times in text");
if (occurrences(t.html) !== 2) fail("token appears " + occurrences(t.html) + " times in html (href + visible link = 2)");
ok("token appears only as the link: 0 in subject, 1 in text, 2 in html (href + printed fallback)");

// 7. no FieldQuo-vs-brand confusion: company brandColor is never used as a colour
const branded = resetPasswordEmail({ url: "https://x.test/a", company: { name: "Sunny", brandColor: "#f5e642", logoUrl: "https://cdn.test/logo.png" } });
if (branded.html.includes("f5e642") || branded.html.includes("cdn.test")) fail("brand colour or logo leaked into an auth email");
if (!branded.text.includes("Sunny")) fail("company name should appear as plain context");
ok("brand colour and logo never rendered; company name appears as plain text only");

// 8. string company accepted as well as a row
if (resetPasswordEmail({ url: "https://x.test/a", company: "Northline" }).text !== resetPasswordEmail({ url: "https://x.test/a", company: { name: "Northline" } }).text) fail("string vs row company differ");
ok("company accepted as a string or a Company row");

// 9. no args at all must not crash silently into a bad email
let threw = false;
try { verifyEmail(); } catch { threw = true; }
if (!threw) fail("verifyEmail() with no args should throw");
ok("no-arg call throws");

console.log("\n--- en reset, text part ---\n");
console.log(resetPasswordEmail({ url: "https://app.fieldquo.com/reset-password?token=abc123", userName: "Marc", company: { name: "Northline Refinishing" }, expiresMinutes: 60 }).text);
console.log("\n--- fr verify, text part ---\n");
console.log(verifyEmail({ url: "https://app.fieldquo.com/verify?token=abc123", userName: "Marc", language: "fr", company: "Northline Refinishing", expiresMinutes: 1440 }).text);
