// scripts/check-platform-email-layout.mjs
//
//   npm run check:platform-email-layout
//
// lib/email/platformLayout.js — the one FieldQuo→contractor envelope — and
// the four letters that moved onto it on 2026-10-11. Executed, not grepped:
//
//   1. The move changed nothing but the envelope: every case in
//      scripts/fixtures/legacyLifecycleEmailCases.mjs is built with today's
//      code and the md5 of its TEXT part compared with the record taken from
//      3c5cab740, before the move (legacyLifecycleEmailBaseline.json). The
//      trial reminder had no text part then, so its subject, heading, company
//      line, paragraphs and button are compared instead.
//   2. The footer is enforced by kind: a commercial letter refuses to build
//      without the mailing address or the unsubscribe URL; a transactional
//      one refuses an unsubscribe or preferences link; RFC 8058 headers on
//      commercial letters with a one-click URL, never on transactional ones.
//   3. Images: only FieldQuo's own host — a hotlink, an http URL, another
//      Cloudinary cloud are dropped; the logo and hero files exist at the
//      sizes the HTML declares.
//   4. Every colour pair at 4.5:1 or better, both schemes.
//   5. Every language renders the chrome with no {placeholder} left.
//   6. Mutation-tested: the guards above are broken one at a time in a copy
//      and the check must fail on each (the file is restored from a cp
//      backup, never from git).
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-platform-email-layout.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  renderPlatformEmail,
  platformTextFooter,
  layoutFooterInputs,
  heroSrcAllowed,
  listUnsubscribeHeaders,
  PLATFORM_LAYOUT_PAIRS,
  EMAIL_LOGO_PATH,
  LAYOUT_KINDS,
} from "@/lib/email/platformLayout";
import { contrastRatio } from "@/lib/brand/colour";
import { LIFECYCLE_LANGUAGES } from "@/lib/i18n/lifecycleEmailCopy";
import { buildOnboardingNextStepsEmail } from "@/lib/email/onboardingNextStepsEmail";
import { buildTrialReminderEmail } from "@/lib/email/trialReminderEmail";
import { buildSignupEarlyNudgeEmail } from "@/lib/email/signupEarlyNudgeEmail";
import { buildSignupRecoveryEmail } from "@/lib/email/signupRecoveryEmail";
import { HERO_IMAGES } from "@/lib/lifecycle/emails";
import { NEXT_STEPS_CASES, TRIAL_REMINDER_CASES, EARLY_NUDGE_CASES, RECOVERY_CASES } from "./fixtures/legacyLifecycleEmailCases.mjs";

let pass = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) pass++;
  else fails.push(label);
};
const throws = (fn) => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};
const md5 = (s) => createHash("md5").update(String(s)).digest("hex");
const ORIGIN = "https://www.fieldquo.com";
const ADDRESS = "FieldQuo, 123 Example St, Toronto ON M5V 1A1, Canada";

// ── 1. The md5 proof ───────────────────────────────────────────────────────
const baseline = JSON.parse(readFileSync(new URL("./fixtures/legacyLifecycleEmailBaseline.json", import.meta.url), "utf8"));
let compared = 0;
const cmp = (name, key, value) => {
  compared++;
  ok(baseline[name]?.[key] === value, `md5 of ${key} unchanged by the layout move — ${name}`);
};
for (const c of NEXT_STEPS_CASES) {
  const e = buildOnboardingNextStepsEmail(c.args);
  cmp(c.name, "text", md5(e.text));
  cmp(c.name, "subject", md5(e.subject));
}
for (const c of EARLY_NUDGE_CASES) {
  const e = buildSignupEarlyNudgeEmail(c.args);
  cmp(c.name, "text", md5(e.text));
  cmp(c.name, "subject", md5(e.subject));
}
for (const c of RECOVERY_CASES) {
  const e = buildSignupRecoveryEmail(c.args);
  cmp(c.name, "text", md5(e.text));
  cmp(c.name, "subject", md5(e.subject));
}
for (const c of TRIAL_REMINDER_CASES) {
  const e = buildTrialReminderEmail(c.args);
  const parts = { heading: e.parts.heading, sub: e.parts.sub, paragraphs: e.parts.paragraphs, cta: e.parts.cta ? { url: e.parts.cta.url, label: e.parts.cta.label } : null };
  cmp(c.name, "parts", md5(JSON.stringify(parts)));
  cmp(c.name, "subject", md5(e.subject));
  ok(typeof e.text === "string" && e.text.includes(e.parts.heading) && e.text.includes(e.parts.cta.url), `the trial reminder now has a text part with its heading and link — ${c.name}`);
}
ok(compared === Object.values(baseline).reduce((n, v) => n + Object.keys(v).length, 0), `every recorded md5 was compared (${compared})`);

// ── 2. The footer, by kind ─────────────────────────────────────────────────
const commercial = { kind: "tips", origin: ORIGIN, mailingAddress: ADDRESS, unsubscribeUrl: `${ORIGIN}/email-preferences/t?c=tips`, preferencesUrl: `${ORIGIN}/email-preferences/t`, oneClickUrl: `${ORIGIN}/api/email-preferences/t/unsubscribe?c=tips` };
ok(throws(() => renderPlatformEmail({ ...commercial, mailingAddress: "" })), "a tips email with no mailing address refuses to build");
ok(throws(() => renderPlatformEmail({ ...commercial, mailingAddress: "   " })), "…nor with a blank one");
ok(throws(() => renderPlatformEmail({ ...commercial, unsubscribeUrl: null })), "a tips email with no unsubscribe URL refuses to build");
ok(throws(() => renderPlatformEmail({ kind: "transactional", origin: ORIGIN, unsubscribeUrl: "https://x" })), "a transactional email refuses an unsubscribe link");
ok(throws(() => renderPlatformEmail({ kind: "transactional", origin: ORIGIN, preferencesUrl: "https://x" })), "…and a preferences link");
ok(throws(() => renderPlatformEmail({ kind: "newsletter", origin: ORIGIN })), "an unknown kind refuses");
ok(throws(() => renderPlatformEmail({ kind: "transactional", origin: "" })), "no origin refuses (the header links must be absolute)");
ok(LAYOUT_KINDS.join(",") === "transactional,tips,updates,offers,commercial", "the kinds are the five the header lists");
{
  const r = renderPlatformEmail({ ...commercial, heading: "<b>Hi</b> & bye", preheader: "Preview line", bodyHtml: "<p>x</p>", cta: { url: `${ORIGIN}/app?a=1&b=2`, label: "Go" } });
  ok(r.headers["List-Unsubscribe"] === `<${commercial.oneClickUrl}>` && r.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click", "RFC 8058 headers point at the one-click endpoint");
  ok(r.html.includes(commercial.unsubscribeUrl.replace(/&/g, "&amp;")) && r.html.includes(">Unsubscribe<"), "the visible Unsubscribe link is in the footer");
  ok(r.html.includes(">Manage email preferences<") && r.html.includes(commercial.preferencesUrl), "…and Manage email preferences");
  ok(r.html.includes(ADDRESS), "…and the mailing address");
  ok(r.html.includes("Setup tips from FieldQuo"), "…and the tips label");
  ok(/display:none[^>]*>Preview line/.test(r.html), "the preheader is in a hidden block");
  ok(r.html.includes("&lt;b&gt;Hi&lt;/b&gt; &amp; bye") && !r.html.includes("<b>Hi</b>"), "a hostile heading is escaped");
  ok(r.html.includes(`href="${ORIGIN}/app?a=1&amp;b=2"`), "the button's URL is attribute-escaped");
  ok((r.html.match(/border-radius:999px/g) || []).length === 2, "ONE pill button (cell + link)");
  ok(r.html.includes(`src="${ORIGIN}${EMAIL_LOGO_PATH}"`), "the logo is an absolute URL on www.fieldquo.com");
  ok(r.html.includes(`${ORIGIN}/help/en`) && r.html.includes(`${ORIGIN}/app`), "Help and Your account link to real pages");
  ok(/prefers-color-scheme: dark/.test(r.html) && /name="color-scheme" content="light dark"/.test(r.html), "dark-mode styles and the color-scheme meta");
  ok(/@media \(max-width: 620px\)/.test(r.html) && /max-width:600px/.test(r.html), "a 600px column that tightens on a phone");
}
{
  const r = renderPlatformEmail({ ...commercial, oneClickUrl: null });
  ok(Object.keys(r.headers).length === 0, "no one-click URL → no List-Unsubscribe header (never pointed at a page a POST cannot reach)");
  const tr = renderPlatformEmail({ kind: "transactional", origin: ORIGIN, mailingAddress: ADDRESS });
  ok(Object.keys(tr.headers).length === 0 && !/Unsubscribe|Manage email preferences/.test(tr.html), "transactional: no headers, no unsubscribe, no preferences link");
  ok(tr.html.includes("A service email about your FieldQuo account"), "transactional: says what it is");
  const lead = renderPlatformEmail({ ...commercial, accountLink: false });
  ok(!lead.html.includes(">Your account<") && lead.html.includes(">Help<"), "a person with no account gets Help only");
}
{
  const lines = platformTextFooter({ language: "fr", kind: "tips", mailingAddress: ADDRESS, unsubscribeUrl: "https://u", preferencesUrl: "https://p" });
  ok(lines.includes(ADDRESS) && lines.some((l) => l === "Se désabonner : https://u") && lines.some((l) => /^Gérer mes préférences de courriel : https:\/\/p$/.test(l)), "the text footer prints the same footer, in French typography");
  ok(throws(() => platformTextFooter({ kind: "tips", unsubscribeUrl: "https://u" })), "the text footer refuses a commercial letter with no address too");
}
ok(JSON.stringify(listUnsubscribeHeaders("")) === "{}", "listUnsubscribeHeaders('') is empty");
ok(layoutFooterInputs({ kind: "transactional", mailingAddress: "" }).address === "", "transactional with no address builds (address printed only when set)");

// ── 3. Images ──────────────────────────────────────────────────────────────
ok(heroSrcAllowed("https://www.fieldquo.com/email/hero-quote.en.jpg"), "a www.fieldquo.com image is allowed");
ok(!heroSrcAllowed("http://www.fieldquo.com/x.jpg"), "http is refused");
ok(!heroSrcAllowed("https://images.unsplash.com/photo.jpg"), "a third-party host is refused (no hotlinking)");
ok(!heroSrcAllowed("https://www.fieldquo.com.evil.com/x.jpg"), "a look-alike host is refused");
ok(!heroSrcAllowed("https://user:pw@www.fieldquo.com/x.jpg"), "credentials in the URL are refused");
ok(heroSrcAllowed("https://res.cloudinary.com/fqcloud/image/upload/x.jpg", { cloudName: "fqcloud" }), "our own Cloudinary cloud is allowed");
ok(!heroSrcAllowed("https://res.cloudinary.com/othercloud/image/upload/x.jpg", { cloudName: "fqcloud" }), "another Cloudinary cloud is refused");
ok(!heroSrcAllowed("https://res.cloudinary.com/fqcloud/x.jpg", { cloudName: "" }), "no cloud configured → no Cloudinary image");
ok(!heroSrcAllowed("javascript:alert(1)") && !heroSrcAllowed("") && !heroSrcAllowed(null), "junk is refused");
{
  const r = renderPlatformEmail({ ...commercial, hero: { src: "https://images.unsplash.com/x.jpg", alt: "x", width: 1200, height: 600 } });
  ok(!r.html.includes("unsplash"), "a refused hero is dropped, not rendered");
  const ok2 = renderPlatformEmail({ ...commercial, hero: { src: `${ORIGIN}/email/hero-quote.en.jpg`, alt: "The quote builder", width: 1200, height: 937 } });
  ok(/<img class="fq-hero" src="https:\/\/www\.fieldquo\.com\/email\/hero-quote\.en\.jpg" width="600" height="469"/.test(ok2.html), "an allowed hero renders at 600px with its aspect (retina source)");
}
function jpegSize(path) {
  const b = readFileSync(path);
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}
{
  const logo = jpegSize(new URL(`../public${EMAIL_LOGO_PATH}`, import.meta.url));
  ok(logo && logo.width === 400 && logo.height === 120, "the logo file exists at 400×120 (2× the 140×42 it is shown at… within rounding)");
  for (const [feature, h] of Object.entries(HERO_IMAGES)) {
    for (const lang of h.languages) {
      const size = jpegSize(new URL(`../public/email/hero-${feature}.${lang}.jpg`, import.meta.url));
      ok(size && size.width === h.width && size.height === h.height, `hero ${feature}.${lang} exists at ${h.width}×${h.height}`);
    }
  }
}

// ── 4. Contrast ────────────────────────────────────────────────────────────
for (const pair of PLATFORM_LAYOUT_PAIRS) {
  const r = contrastRatio(pair.fg, pair.bg);
  ok(r >= 4.5, `${pair.name}: ${r.toFixed(2)}:1 ≥ 4.5`);
}

// ── 5. Languages ───────────────────────────────────────────────────────────
for (const lang of LIFECYCLE_LANGUAGES) {
  for (const kind of ["transactional", "tips"]) {
    const r = renderPlatformEmail(kind === "tips" ? { ...commercial, language: lang } : { kind, origin: ORIGIN, language: lang, mailingAddress: ADDRESS });
    ok(!/\{[a-z]+\}|undefined|null</i.test(r.html), `${lang}/${kind}: no unfilled placeholder or undefined`);
    ok(r.html.includes(`<html lang="${lang}">`), `${lang}/${kind}: html lang`);
  }
}

// ── The moved letters keep their classification ────────────────────────────
{
  const ns = buildOnboardingNextStepsEmail({ ...NEXT_STEPS_CASES[0].args, mailingAddress: ADDRESS });
  ok(!/unsubscribe|no-contact|Manage email preferences/i.test(ns.html), "next-steps letter: transactional — no unsubscribe, no preferences link");
  ok(ns.html.includes(ADDRESS) && ns.html.includes("A service email about your FieldQuo account"), "next-steps letter: the transactional footer");
  const tr = buildTrialReminderEmail({ ...TRIAL_REMINDER_CASES[0].args, mailingAddress: ADDRESS });
  ok(!/unsubscribe|Manage email preferences/i.test(tr.html) && tr.html.includes(ADDRESS), "trial reminder: transactional footer, no unsubscribe");
  const en = buildSignupEarlyNudgeEmail({ ...EARLY_NUDGE_CASES[0].args, oneClickUrl: `${ORIGIN}/api/no-contact/tok123` });
  ok(en.headers["List-Unsubscribe"] === `<${ORIGIN}/api/no-contact/tok123>`, "early nudge: List-Unsubscribe → POST /api/no-contact/<token>");
  ok(en.html.includes(`${ORIGIN}/no-contact/tok123`) && !en.html.includes("Manage email preferences"), "early nudge: the visible opt-out is the /no-contact page; no preferences link (no account to hold one)");
  ok(!en.html.includes(">Your account<"), "early nudge to a lead: no 'Your account' link");
  const rc = buildSignupRecoveryEmail({ ...RECOVERY_CASES[0].args, oneClickUrl: `${ORIGIN}/api/no-contact/tok456` });
  ok(rc.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click" && rc.html.includes(ADDRESS), "recovery note: RFC 8058 headers and the address");
  ok(throws(() => buildSignupRecoveryEmail({ ...RECOVERY_CASES[0].args, mailingAddress: "" })), "recovery note: no address → refuses");
  ok(throws(() => buildSignupEarlyNudgeEmail({ ...EARLY_NUDGE_CASES[0].args, optOutUrl: "" })), "early nudge: no opt-out → refuses");
}

// ── The cron wiring of the moved letters ───────────────────────────────────
{
  const sr = readFileSync(new URL("../app/api/cron/signup-recovery/route.js", import.meta.url), "utf8");
  ok((sr.match(/headers: email\.headers/g) || []).length === 2, "signup-recovery sends both letters' headers");
  ok((sr.match(/oneClickUrl: `\$\{origin\}\/api\/no-contact\/\$\{token\}`/g) || []).length === 2, "…pointed at /api/no-contact/<token>");
  const trc = readFileSync(new URL("../app/api/cron/trial-reminders/route.js", import.meta.url), "utf8");
  ok(/subject, html, text \}\)/.test(trc), "trial-reminders sends the new text part");
}

// ── 6. Mutations ───────────────────────────────────────────────────────────
const MUTATIONS = [
  { file: "lib/email/platformLayout.js", label: "a transactional email may carry an unsubscribe link", from: "    if (unsubscribeUrl || preferencesUrl) {", to: "    if (false) {" },
  { file: "lib/email/platformLayout.js", label: "the preheader is no longer hidden", from: "display:none;font-size:1px;", to: "font-size:1px;" },
  { file: "lib/email/platformLayout.js", label: "heroes from any host", from: "  if (u.hostname === \"www.fieldquo.com\" || u.hostname === \"fieldquo.com\") return true;", to: "  return true;" },
  { file: "lib/email/platformLayout.js", label: "the footer grey drops below 4.5:1", from: 'const FAINT = "#595f6b";', to: 'const FAINT = "#9ca3af";' },
  { file: "lib/email/onboardingNextStepsEmail.js", label: "the next-steps letter's wording drifts", from: "      ...(r.unlock ? [`   ${r.unlock}`] : []),", to: "      ...(r.unlock ? [`  ${r.unlock}`] : []),"},
];
if (process.argv.includes("--no-mutate")) {
  // a subprocess run on a mutated tree
} else {
  const dir = mkdtempSync(join(tmpdir(), "fq-layout-mut-"));
  for (const [i, m] of MUTATIONS.entries()) {
    const path = new URL(`../${m.file}`, import.meta.url);
    const src = readFileSync(path, "utf8");
    if (!src.includes(m.from)) {
      ok(false, `mutation anchor still exists — ${m.label}`);
      continue;
    }
    const backup = join(dir, `${i}.bak`);
    copyFileSync(path, backup);
    try {
      writeFileSync(path, src.replace(m.from, m.to));
      const run = spawnSync(process.execPath, ["--import", "./scripts/alias-loader.mjs", "scripts/check-platform-email-layout.mjs", "--no-mutate"], { encoding: "utf8" });
      ok(run.status !== 0, `caught: ${m.label}`);
    } finally {
      copyFileSync(backup, path);
    }
  }
}

for (const f of fails) console.log(`  FAIL ${f}`);
console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
