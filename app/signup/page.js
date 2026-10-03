// app/signup/page.js
//
// ══ One screen (2026-09-29) ════════════════════════════════════════════════
//
// The owner approved a Jobber-shaped signup: this page asks for a work email,
// a password and an unticked "Send me product news and offers", and its one
// button — "Start my free trial" — creates the login AND the company. Every
// question about the business comes afterwards, one screen at a time, at
// /welcome/<step> (app/welcome, lib/signup/welcome.js), where a person who
// signs out or comes back next week lands on the question they stopped at.
//
// It replaces, in place and with no flag, the seven-step funnel that asked
// for eleven fields before anything existed. What that page did beyond the
// form is kept here unchanged, because those are other people's doors:
//
//   · a ?resume= link is routed before anything renders (lib/signup/
//     resumeRoute.js) — now to the next unanswered welcome question;
//   · a company created before 2026-09-24 that never finished Stripe
//     checkout still finishes it here, on the plan step (finishCheckout);
//   · a login that already has a business is told so, not offered another
//     (one business per login — the route refuses too);
//   · a login with NO company (the old funnel's abandoned state) gets the
//     same "Start my free trial" press, without a second password;
//   · ?ref= / ?sales= / utm_* / ?link= / ?next= / ?tier= ride along to
//     POST /api/companies exactly as before.
//
// Old deep links: the steps were never URLs, only a step name in this tab's
// draft; a draft naming an old step is ignored and the visitor lands here
// (signed out) or on their next welcome question (signed in).
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { signUp, signOut } from "@/lib/auth-client";
import { TRIAL_PRICE, TRIAL_DAYS, TRIAL_CARD_REQUIRED, trialLabel } from "@/lib/pricing";
import { billingBasis } from "@/lib/signup/funnel";
import { annualPriceOf, annualSaving, chargeFor } from "@/lib/billing/interval";
import { currencyLabel } from "@/lib/pricing/ladder";
import { yearTabSaving } from "@/lib/pricing/planOffer";
import { offerMoney } from "@/app/components/billing/PlanOfferPrice";
import PricingCard from "@/app/components/marketing/PricingCard";
import MarketingHeader from "@/app/components/marketing/MarketingHeader";
import AuthShell from "@/app/components/auth/AuthShell";
import WelcomeAside from "@/app/components/auth/WelcomeAside";
import { fieldClass, FIELD_LABEL, FIELD_ERROR, PRIMARY_BUTTON } from "@/app/components/auth/fieldStyles";
import { isValidEmail } from "@/lib/validation";
import { COUNTRIES } from "@/lib/currency";
import { isInternalPath } from "@/lib/appUrl";
import { useTranslation } from "@/app/hooks/useTranslation";
import { CAPTURE_ENDPOINT } from "@/lib/signup/leadCapture";
import { RESUME_ACTIONS, safeResumeTarget } from "@/lib/signup/resumeRoute";
import { WELCOME_NEXT_KEY, WELCOME_LINK_KEY } from "@/app/welcome/storageKeys";
import { isNetworkFailure, visitorError } from "@/lib/signup/visitorErrors";

// "1 month free" / "3 months free". The banner hardcoded the plural and read
// "1 months free" for the whole life of the current one-month offer. Same
// shape as MONTHS_FREE on app/refer/[code]/page.js. Takes `t` because the
// two forms are catalogue keys now; one/other is the split the offer needs
// (it is one month), not a full CLDR plural.
function monthsFree(t, n) {
  const count = Number(n) || 0;
  return t(
    count === 1 ? "app.signup.monthsFree.one" : "app.signup.monthsFree.other",
    count === 1 ? "{n} month free" : "{n} months free",
    { n: count },
  );
}

// "3 days" / "1 day". Used only by the resumed-payment line, which quotes what
// is left of a free month that started when the company was created — so it
// has to be able to say one day without saying "1 days". The nouns are the
// same keys the shell's subtitle already uses for the same number.
function dayCount(t, n) {
  const count = Number(n) || 0;
  return `${count} ${t(count === 1 ? "app.signup.finish.day" : "app.signup.finish.days")}`;
}

// The offer line, translated. trialLabel() is the one place the amount is
// written, and it stays that way: only the FREE wording is a catalogue key,
// because a paid first month is a number and a noun the helper already
// formats. When the amount is zero the English helper output is the fallback,
// so this can never say something trialLabel() would not.
function trialText(t, amount = TRIAL_PRICE) {
  return amount > 0 ? trialLabel(amount) : t("app.signup.trialFree", trialLabel(amount));
}

// `t()` leaves a {placeholder} in place when no value is given for it, which
// is what lets a sentence carry ONE bold span without being split into keys
// at the word boundary — the translator owns the whole sentence, and the bold
// lands wherever their word order puts the name. Returns [before, after].
function around(sentence, placeholder) {
  const at = sentence.indexOf(placeholder);
  if (at < 0) return [sentence, ""];
  return [sentence.slice(0, at), sentence.slice(at + placeholder.length)];
}


// Prices on this page are whole dollars in a stated currency, and the currency
// is written with the ladder's own label (CA$ / US$) rather than a bare "$" —
// this product sells in two dollars and a bare sign in front of one of them is
// the ambiguity the address rule exists to remove.
//
// A FIXED locale, not the reader's: this page renders on the server too, and a
// number grouped one way in Node and another in the browser is a hydration
// mismatch. (The funnel's copy is translated through app.signup.* keys; the
// number formatting deliberately is not, for that reason.)
function money(value) {
  return Number(value || 0).toLocaleString("en-CA", {
    maximumFractionDigits: 0,
  });
}

// "Save CA$198 a year — two months free." The months are COMPUTED from the
// saving over the monthly rate, never assumed: the ladder's default is two
// months, but Plan.priceAnnual is a column an operator edits per rung, and a
// tier given a different deal must not go on saying "two". Whole months are
// said in words a contractor can check in his head; anything fractional is
// left as the money alone, because "1.7 months free" is a number nobody can.
function savingSentence(t, { amount, months }) {
  const whole = Math.abs(months - Math.round(months)) < 0.005 ? Math.round(months) : null;
  if (whole === 2) return t("app.signup.plan.save", "Save {amount} a year — two months free.", { amount });
  if (whole === 1) return t("app.signup.plan.saveOneMonth", "Save {amount} a year — one month free.", { amount });
  if (whole !== null && whole > 2)
    return t("app.signup.plan.saveMonths", "Save {amount} a year — {n} months free.", { amount, n: whole });
  return t("app.signup.plan.saveOnly", "Save {amount} a year.", { amount });
}

// The charge, in words, for the summary and the button: "CA$990 a year",
// "CA$99/mo" — or, while a promotion applies to the chosen card, its
// discounted first charge to the cent ("CA$712.80 for year one", "CA$59.40/mo
// for 3 months"), from the server's offer. One helper because the sentence
// above the button and the button itself must never say two different prices.
function chargeWords(t, charge, promoOffer, symbol, money) {
  if (promoOffer) {
    const amount = offerMoney(symbol)(promoOffer.charge);
    return promoOffer.interval === "year"
      ? t("app.signup.plan.yearOne", "{amount} for year one", { amount })
      : promoOffer.promoMonths === 1
        ? t("app.signup.plan.perMonthForOne", "{amount}/mo for the first month", { amount })
        : t("app.signup.plan.perMonthFor", "{amount}/mo for {months} months", { amount, months: promoOffer.promoMonths });
  }
  const amount = `${symbol}${money(charge.amount)}`;
  return charge.interval === "year"
    ? t("app.signup.plan.aYear", "{amount} a year", { amount })
    : t("app.signup.plan.perMonth", "{amount}/mo", { amount });
}

// ── No commitment | 1-year commitment ─────────────────────────────────────
//
// The cadence used to be two radio rows inside the summary panel, under the
// cards — so the cards above it went on printing the monthly price after the
// year was chosen, which the owner read as the price not updating. It IS the
// price not updating: the choice has to sit above the cards it reprices.
//
// The yearly tab is DISABLED, never hidden, when it cannot be bought — a
// selected plan with no annual price, or a ladder with none at all — and the
// sentence beside it says why. Hiding it would make the same plan look
// monthly-only on one visit and not the next.
function BillingIntervalTabs({ t, value, onChange, yearDisabled, percent, upTo }) {
  const base = "px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2";
  const on = "bg-inverted text-inverted-foreground";
  const off = "text-foreground hover:bg-muted";
  return (
    <div
      role="tablist"
      aria-label={t("app.signup.plan.billingQuestion", "How would you like to be billed?")}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "month"}
        onClick={() => onChange("month")}
        className={`${base} ${value === "month" ? on : off}`}
      >
        {t("app.signup.plan.noCommitment", "No commitment")}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "year"}
        aria-disabled={yearDisabled}
        disabled={yearDisabled}
        onClick={() => onChange("year")}
        className={`${base} ${value === "year" ? on : off} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {t("app.signup.plan.yearCommitment", "1-year commitment")}
        {/* Red, as asked. Shown only for a real saving — a "Save 0%" pill
            is a badge with nothing behind it. */}
        {percent > 0 && !yearDisabled && (
          <span className="bg-red-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full leading-none">
            {upTo
              ? t("app.signup.plan.saveUpToPercent", "Save up to {percent}%", { percent })
              : t("app.signup.plan.savePercent", "Save {percent}%", { percent })}
          </span>
        )}
      </button>
    </div>
  );
}
// company. The PASSWORD is deliberately never written to it.
/**
 * Tell the rep's panel where this signup is. Fire-and-forget on purpose:
 * the page must never wait on it, and a failure is not the visitor's
 * problem. `keepalive` so a report fired just before a navigation still
 * leaves. lib/sales/signupProgress.js says what the server does with it.
 */
function reportSignupStep(token, step) {
  try {
    fetch("/api/signup/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, step }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // A runtime without fetch keepalive, or a blocked request. Nothing to do.
  }
}

/**
 * Which plan row should be selected, given what the link asked for and which
 * rows this visitor's currency actually offers.
 *
 * ══ A tier is portable; a plan id is not ═══════════════════════════════════
 *
 * Every rung of the ladder exists twice in the Plan table, once per currency,
 * carrying the same number. So `?plan=<id>` names a row AND a currency, and the
 * pricing page had to pick one of the two to build each link — which meant half
 * the buttons on the public page handed a US visitor the CAD row, on a funnel
 * whose entire design is that the ADDRESS decides the currency.
 *
 * `?tier=<tierKey>` is what those buttons carry now, and it says nothing about
 * money. `?plan=<id>` is still honoured because links carrying it are already
 * in the wild — but it is read as a wish for that row's TIER, resolved through
 * `all` (which holds both currencies) and then re-found in `visible` (which
 * holds only the one this visitor will be billed in). A stale CAD link
 * therefore lands an American on the US row of the same rung, rather than on a
 * selection with no card next to it and a 400 four steps later.
 *
 * ══ Why it is safe to run this on every change ═════════════════════════════
 *
 * The first rule is that a selection already on screen wins. So the query's
 * wish only applies while nothing valid is selected, which is why this can be a
 * live effect rather than a once-at-load assignment — it re-resolves when the
 * address changes the currency, and it never fights somebody clicking a card.
 *
 * @param all       every plan the API returned, both currencies
 * @param visible   the rows this step is actually rendering
 * @param wantedTier   ?tier=<tierKey>, or null
 * @param wantedPlanId ?plan=<id> from an older link, or null
 * @param current   what is selected now (from state, or restored from a draft)
 */
export function resolvePlanSelection({
  all = [],
  visible = [],
  wantedTier = null,
  wantedPlanId = null,
  current = null,
} = {}) {
  const rows = Array.isArray(all) ? all : [];
  const shown = Array.isArray(visible) ? visible : [];

  // Still buyable exactly as it stands. Leave it alone.
  if (current && shown.some((p) => p.id === current)) return current;

  const tierOf = (id) => (id ? rows.find((p) => p.id === id)?.tierKey || null : null);
  const inCurrency = (tierKey) =>
    tierKey ? shown.find((p) => p.tierKey === tierKey) : null;

  // In order of how directly each states a tier: the query's tier, the tier
  // behind an old link's row, then the tier behind whatever the draft carried
  // across a change of address.
  const wished =
    inCurrency(wantedTier) ||
    inCurrency(tierOf(wantedPlanId)) ||
    inCurrency(tierOf(current));
  if (wished) return wished.id;

  // A legacy per-headcount row has no tier to translate through. It is a single
  // row rather than a currency pair, so an id that is genuinely on the page
  // still counts — that is what keeps an old link to one of them working.
  if (wantedPlanId && shown.some((p) => p.id === wantedPlanId)) return wantedPlanId;

  // Nothing matched: a withdrawn plan, or a tier this currency doesn't carry.
  // Null rather than the nearest thing — picking a rung for somebody is picking
  // what they pay, and the step is perfectly able to ask.
  return null;
}

// The link codes this tab carries between visits: sessionStorage, never a
// cookie — a rep's code surviving into next week's unrelated signup on a
// shared van laptop is the failure this avoids. The email is kept so a
// refresh does not empty the box; the PASSWORD never is.
const DRAFT_KEY = "fieldquo:signup-draft";

// Better Auth enforces 8–128 characters on the server — its own defaults, since
// lib/auth.js sets neither minPasswordLength nor maxPasswordLength.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

// What AccountFields translates with when nobody hands it a `t`: the English
// fallback, verbatim — scripts/check-auth-pages.mjs calls it as a plain
// function, outside React, and compares the labels against the English.
const englishOnly = (key, fallbackOrValues) => (typeof fallbackOrValues === "string" ? fallbackOrValues : key);

/** The account screen's rules. Exported for the check. */
export function validateAccountFields(form, t = englishOnly) {
  const errors = {};
  if (!isValidEmail(form.email)) errors.email = t("app.signup.error.email", "Enter a valid email address");
  if (!form.password || form.password.length < PASSWORD_MIN)
    errors.password = t("app.signup.error.passwordMin", `At least ${PASSWORD_MIN} characters`, { n: PASSWORD_MIN });
  else if (form.password.length > PASSWORD_MAX)
    errors.password = t("app.signup.error.passwordMax", `At most ${PASSWORD_MAX} characters`, { n: PASSWORD_MAX });
  return errors;
}

/**
 * The account screen's fields: work email, password, and the unticked
 * "Send me product news and offers". Module scope and presentational, so
 * scripts/check-auth-pages.mjs can execute it and prove each field is still
 * bound to its key of `form`.
 */
export function AccountFields({ form, setForm, fieldErrors, existingLogin = null, t = englishOnly }) {
  return (
    <>
      <div>
        <label htmlFor="signup-email" className={FIELD_LABEL}>
          {t("app.signup.field.workEmail", "Work email")}
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="you@company.com"
          className={fieldClass(Boolean(fieldErrors.email))}
        />
        {existingLogin && existingLogin === form.email.trim().toLowerCase() ? (
          // A login already on this address is the wrong door, not a failure:
          // sign in (the address travels, never a secret) or reset.
          <div
            className="mt-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
            data-signup-login-exists
          >
            <p className="break-words">{t("app.signup.error.loginExists")}</p>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <Link href={`/login?email=${encodeURIComponent(existingLogin)}`} className="font-medium underline underline-offset-2">
                {t("app.signup.error.loginExistsSignIn")}
              </Link>
              <Link href={`/forgot-password?email=${encodeURIComponent(existingLogin)}`} className="underline underline-offset-2">
                {t("app.signup.error.loginExistsReset")}
              </Link>
            </p>
          </div>
        ) : (
          fieldErrors.email && <p className={FIELD_ERROR}>{fieldErrors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="signup-password" className={FIELD_LABEL}>
          {t("app.signup.field.password", "Password")}
        </label>
        <input
          id="signup-password"
          type="password"
          // new-password: this field CREATES one, so a password manager offers
          // to generate and store it rather than filling the last one it saw.
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className={fieldClass(Boolean(fieldErrors.password))}
        />
        {fieldErrors.password && <p className={FIELD_ERROR}>{fieldErrors.password}</p>}
      </div>

      {/* Unticked, and nothing is recorded unless it is ticked: the moment
          and the sentence go on the User (POST /api/companies). */}
      <label className="flex items-start gap-3 text-sm text-foreground">
        <input
          id="signup-consent"
          type="checkbox"
          checked={form.consent === true}
          onChange={(e) => setForm({ ...form, consent: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-border"
        />
        <span>{t("app.signup.consent", "Send me product news and offers")}</span>
      </label>
    </>
  );
}

export default function SignupPage() {
  const { t, setPageLanguage, language } = useTranslation();

  // Codes on the link that sent them here. Read from window.location rather
  // than useSearchParams() to avoid a Suspense boundary around the page.
  // ?ref= is a promo or referral code (validated below before any banner is
  // shown); ?sales= a FieldQuo rep's code, never validated here (a public
  // "is this rep real" answer would enumerate the roster); utm_* the advert;
  // ?link= a rep's texted-link token; ?next= where a signup that began from
  // "add this quote to your project" returns to. All posted with the company.
  const [referralCode, setReferralCode] = useState("");
  const [salesCode, setSalesCode] = useState("");
  const [utm, setUtm] = useState(null);
  const [signupLinkToken, setSignupLinkToken] = useState("");
  const [nextPath, setNextPath] = useState("");
  const [referrer, setReferrer] = useState(null);

  // The signed-in states, each its own screen (see the header).
  const [alreadyOnFieldquo, setAlreadyOnFieldquo] = useState(null);
  const [accountReady, setAccountReady] = useState(null);
  const [finishCheckout, setFinishCheckout] = useState(null);
  const [resumeElsewhere, setResumeElsewhere] = useState(null);
  // Nothing renders until the entry check has answered — guessing "signed
  // out" and correcting would flash a password box at somebody signed in.
  const [entryChecked, setEntryChecked] = useState(false);

  const [form, setForm] = useState({ email: "", password: "", consent: false });
  const [fieldErrors, setFieldErrors] = useState({});
  const [existingLogin, setExistingLogin] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let held = false;
    (async () => {
      try {
        // ── A resume link is routed before anything else is asked ─────────
        const resumeToken = new URLSearchParams(window.location.search).get("resume");
        if (resumeToken) {
          const found = await fetch(`${CAPTURE_ENDPOINT}?token=${encodeURIComponent(resumeToken)}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
          if (cancelled) return;
          if (found?.prefill?.language) setPageLanguage(found.prefill.language);
          const route = found?.route;
          const to = safeResumeTarget(route?.to);
          if ((route?.action === RESUME_ACTIONS.APP || route?.action === RESUME_ACTIONS.SIGN_IN) && to) {
            held = true;
            window.location.replace(to);
            return;
          }
          if (route?.action === RESUME_ACTIONS.SWITCH && to) {
            held = true;
            setResumeElsewhere({ email: found.prefill.email, other: route.sessionEmail || "", to });
            return;
          }
          if (found?.prefill?.email) setForm((f) => (f.email ? f : { ...f, email: found.prefill.email }));
          if (found?.prefill?.accountExists && found.prefill.email) {
            setExistingLogin(String(found.prefill.email).trim().toLowerCase());
          }
        }

        // ── A company created and never paid for (before 2026-09-24) ──────
        const resume = await fetch("/api/signup/resume")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (resume?.resume && resume.company) {
          if (!cancelled) setFinishCheckout(resume.company);
          return;
        }

        // ── An owner part-way through the welcome questions ───────────────
        //
        // Their company exists (this page created it); the next unanswered
        // question is where they belong, not here.
        const welcome = await fetch("/api/signup/personalize")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (welcome?.onFlow && !welcome.personalized && isInternalPath(welcome.resumeUrl)) {
          held = true;
          window.location.replace(welcome.resumeUrl);
          return;
        }

        // business-info is COMPANY-scoped: 200 means a company exists, 401
        // specifically that no company could be resolved. Any other status is
        // a fault and must not be read as "you have no company".
        const res = await fetch("/api/settings/business-info");
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (!cancelled) setAlreadyOnFieldquo(data || {});
          return;
        }
        if (res.status !== 401) return;

        // A session with no company: the old funnel's abandoned login, or a
        // "Start my free trial" whose company POST never landed.
        const session = await fetch("/api/auth/get-session")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (!cancelled && session?.user?.id) setAccountReady(session.user);
      } catch {
        // Offline or blocked: the signed-out screen, which asks for everything.
      } finally {
        if (!cancelled && !held) setEntryChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Once, on arrival. setPageLanguage is the provider's stable callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const raw = q.get("next");
    if (isInternalPath(raw)) setNextPath(raw);
    if (q.get("ref")) setReferralCode(q.get("ref"));
    if (q.get("sales")) setSalesCode(q.get("sales"));
    if (q.get("link")) setSignupLinkToken(q.get("link"));
    const tags = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
      const v = q.get(k);
      if (v && v.trim()) tags[k] = v.trim().slice(0, 100);
    }
    if (Object.keys(tags).length) setUtm(tags);
    // The draft: the codes the query string does NOT carry this time (a
    // visitor who followed the Terms link and came back to a bare /signup
    // keeps the referral they arrived on — the query still wins when present).
    try {
      const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
      if (draft && typeof draft === "object") {
        if (draft.referralCode && !q.get("ref")) setReferralCode(draft.referralCode);
        if (draft.salesCode && !q.get("sales")) setSalesCode(draft.salesCode);
        if (draft.utm && !q.get("utm_source") && !q.get("utm_medium")) setUtm(draft.utm);
        if (draft.signupLinkToken && !q.get("link")) setSignupLinkToken(draft.signupLinkToken);
        if (draft.nextPath && !raw && isInternalPath(draft.nextPath)) setNextPath(draft.nextPath);
        if (typeof draft.email === "string") setForm((f) => (f.email ? f : { ...f, email: draft.email }));
      }
    } catch {
      // A corrupt or blocked store: start clean.
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ email: form.email, referralCode, salesCode, utm, signupLinkToken, nextPath }),
      );
    } catch {
      // Private mode or a full quota: a worse experience, not a broken one.
    }
  }, [form.email, referralCode, salesCode, utm, signupLinkToken, nextPath]);

  // "Opened" — the first thing a rep on the phone wants to see.
  useEffect(() => {
    if (signupLinkToken) reportSignupStep(signupLinkToken, "opened");
  }, [signupLinkToken]);

  // Confirm a referral code is real before promising anything.
  useEffect(() => {
    if (!referralCode) return;
    let cancelled = false;
    fetch(`/api/public/refer/${encodeURIComponent(referralCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && d?.valid && setReferrer(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [referralCode]);

  // Re-run the rules over errors already on screen, so a fixed password
  // stops being red before the next press.
  useEffect(() => {
    setFieldErrors((shown) => {
      const keys = Object.keys(shown);
      if (!keys.length) return shown;
      const fresh = validateAccountFields(form, t);
      const narrowed = {};
      let changed = false;
      for (const key of keys) {
        if (fresh[key]) narrowed[key] = fresh[key];
        if (fresh[key] !== shown[key]) changed = true;
      }
      return changed ? narrowed : shown;
    });
  }, [form, t]);

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [refusedPlan, setRefusedPlan] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const wantedRef = useRef({ tier: null, planId: null });
  const [billingInterval, setBillingInterval] = useState("year");

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  // There is no self-serve headcount price any more — see lib/pricing.js.
  // The four tiers (lib/pricing/ladder.js) are the whole menu, so "what does
  // this cost" is always just the selected Plan row's own price.
  const pricing = {
    trialTotal: TRIAL_PRICE,
    monthlyTotal: Number(selectedPlan?.priceMonthly || 0),
  };

  const selectedPlanName = selectedPlan?.name || "Selected plan";

  const hasSelection = Boolean(selectedPlanId);

  // ── What is actually left of the free month, for a resumed payment ──────
  //
  // Company.trialEndsAt is stamped at creation and may well be in the past by
  // the time somebody comes back to pay. /api/platform/billing/checkout reads
  // the same column and only sends trial days to Stripe while it is in the
  // future, so this is not a second opinion about the offer — it is the same
  // one, said out loud on the screen that takes the card.
  const resumeTrialDaysLeft = finishCheckout?.trialEndsAt
    ? Math.ceil(
        (new Date(finishCheckout.trialEndsAt).getTime() - Date.now()) /
          (24 * 60 * 60 * 1000),
      )
    : null;
  const resumeTrialLive = resumeTrialDaysLeft != null && resumeTrialDaysLeft > 0;

  // ── Where they are, and therefore what money they see ───────────────────
  //
  // Read from the company that was created and never paid for — its own
  // stored address and country, the only thing that decides the currency.
  const basis = billingBasis(finishCheckout || {});
  const planCurrency = basis.planCurrency;
  const symbol = currencyLabel(planCurrency);
  const currencyName =
    planCurrency === "CAD"
      ? "Canadian dollars"
      : planCurrency === "USD"
        ? "US dollars"
        : planCurrency === "AUD"
          ? "Australian dollars"
          : null;
  const countryName =
    COUNTRIES.find((c) => c.code === basis.country)?.name || basis.country;

  // Only this currency's rungs. The ladder rows carry the SAME NUMBER in each
  // currency rather than a conversion, so showing both would put "Solo $129"
  // next to "Solo $129" where the choice is not a currency — it is a Canadian
  // volunteering to pay about 38% more (lib/pricing/ladder.js refuses to make
  // that selectable, and this is the screen that would have anyway).
  //
  // Legacy per-headcount rows have no tierKey. They still exist, still carry
  // live subscriptions and are still sellable, so they are the FALLBACK rather
  // than being deleted from the page: a deployment where the ladder has not
  // been seeded shows what it has instead of an empty grid.
  const forCurrency = plans.filter(
    (p) => !planCurrency || !p.currency || p.currency === planCurrency,
  );
  // An unlisted plan the link asked for is shown beside the ladder. A bespoke
  // rate has no tierKey by design (it is not a rung anyone else can climb to);
  // a custom SIZE ("custom-20", from the pricing page's fifth card) has one,
  // so it can be resolved by currency like a rung — and is excluded from the
  // ladder rows here so it renders once, after them, not twice.
  const unlistedRows = forCurrency.filter((p) => p.unlisted);
  const ladderRows = forCurrency.filter((p) => p.tierKey && !p.unlisted);
  const visiblePlans = [
    ...(ladderRows.length > 0 ? ladderRows : forCurrency.filter((p) => !p.unlisted)),
    ...unlistedRows,
  ];

  // Annual is offered per PLAN, because Plan.priceAnnual is nullable and null
  // means "this tier has no annual option" — including every bespoke Custom
  // row, which is created without one.
  const annualPrice = annualPriceOf(selectedPlan);
  const annualAvailable = annualPrice !== null;
  // The cadence the cards are priced in, and — once a plan is chosen — the
  // one posted. Never `billingInterval` straight from state: a plan with no
  // annual price must not be bought on a cadence it does not have, and the
  // screen shows this same value, so the button and the charge cannot
  // diverge. Before a choice the tabs follow the ladder: the year when any
  // card sells one.
  const anyYearOffer = visiblePlans.some((p) => annualPriceOf(p) !== null);
  const effectiveInterval = (hasSelection ? annualAvailable : anyYearOffer) ? billingInterval : "month";
  const charge = chargeFor(selectedPlan, effectiveInterval);
  // The selected card's offer on that cadence, resolved on the server with
  // any running promotion (/api/marketing/plans → lib/billing/promotions.js).
  // Only what is SAID comes from it: the post carries the plan and cadence,
  // and the checkout reprices from the database (non-negotiable #5).
  const selectedOffer = selectedPlan?.offers?.[effectiveInterval] || null;
  const promoOffer = selectedOffer?.available && selectedOffer.promo ? selectedOffer : null;
  const centsMoney = offerMoney(symbol);
  // Two months on the ladder's default. Shown only when the number is real
  // and positive, so nothing claims a saving that isn't there.
  const yearlySaving = annualSaving(selectedPlan);
  // The pill on the yearly tab. The selected plan's own percentage once one
  // is chosen; before that, the best on offer across the ladder — "up to"
  // when the rungs disagree, which they can, because priceAnnual is per row.
  // From the server's offers, so a running sale's "Save 40%" and the standing
  // offer's "Save 17%" are the percentages the cards themselves print.
  const anyAnnual = anyYearOffer;
  const selectedYear = selectedPlan?.offers?.year;
  const ladderSaving = yearTabSaving(visiblePlans.map((p) => p.offers));
  const pillPercent = selectedYear?.available ? selectedYear.percent : ladderSaving.percent;
  const pillUpTo = !selectedYear?.available && ladderSaving.upTo;
  // Disabled, not hidden — see BillingIntervalTabs.
  const yearTabDisabled = hasSelection ? !annualAvailable : !anyAnnual;
  const savingLine = annualAvailable
    ? yearlySaving > 0
      ? savingSentence(t, {
          amount: `${symbol}${money(yearlySaving)}`,
          months: pricing.monthlyTotal > 0 ? yearlySaving / pricing.monthlyTotal : 0,
        })
      : t(
          "app.signup.plan.sameRate",
          "Same rate as monthly — the year is the commitment, not a discount.",
        )
    : "";


  useEffect(() => {
    // ── What the link asked for ─────────────────────────────────────────────
    //
    // ?tier=<tierKey> is what the /pricing cards carry. ?plan=<id> is the older
    // form and is still read, because those links are in the wild — but it is
    // treated as a wish for that row's TIER rather than for the row itself, so
    // a CAD link doesn't put an American on the CAD plan. Both are stashed
    // rather than applied here: the currency that decides which row answers the
    // wish comes from an address collected three steps later, so the resolution
    // has to be a live effect. See resolvePlanSelection above.
    const query = new URLSearchParams(window.location.search);
    wantedRef.current = { tier: query.get("tier"), planId: query.get("plan") };

    // The wished-for plan id rides along so an UNLISTED plan (private, sent by
    // link — a bespoke rate or the owner's live test) comes back for this
    // visitor; the pricing page never asks and never sees it.
    // A custom size (?tier=custom-20) rides along the same way: the route
    // finds-or-creates that size's rows and returns them unlisted, one per
    // currency, for the address step to choose between.
    fetch(
      wantedRef.current.planId
        ? `/api/marketing/plans?plan=${encodeURIComponent(wantedRef.current.planId)}`
        : /^custom-\d+$/.test(wantedRef.current.tier || "")
          ? `/api/marketing/plans?tier=${encodeURIComponent(wantedRef.current.tier)}`
          : "/api/marketing/plans",
    )
      .then((r) => r.json())
      .then((data) => {
        // The endpoint now returns { plans, unavailable } so the page can tell
        // "no plans configured" apart from "plans exist but none can be
        // bought" — they are the same empty array and completely different
        // situations. The array form is still accepted so a cached older
        // response doesn't blank the step.
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.plans)
            ? data.plans
            : [];
        // No selection is made here any more. Both the query's wish and the
        // draft's leftover are resolved by the effect below, which is the only
        // place that knows the billing currency — and a withdrawn plan is
        // dropped there by the same rule that drops a wrong-currency one.
        setPlans(list);
        setRefusedPlan(data?.refused && typeof data.refused === "object" ? data.refused : null);
      })
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));

  }, []);

  // ── One place decides what is selected ──────────────────────────────────
  //
  // This used to only NULL a selection that had fallen out of the visible list
  // — the CAD row of a tier, held in a draft by somebody who has since told us
  // they're in Texas. Nulling was right as far as it went and threw away the
  // one thing worth keeping: which rung they had picked. Now the same event
  // re-resolves it, so changing the address moves the selection across to the
  // other currency's row of the same tier instead of clearing the step.
  //
  useEffect(() => {
    if (plansLoading) return;
    const next = resolvePlanSelection({
      all: plans,
      visible: visiblePlans,
      wantedTier: wantedRef.current.tier,
      wantedPlanId: wantedRef.current.planId,
      current: selectedPlanId,
    });
    if (next !== selectedPlanId) setSelectedPlanId(next);
    // Depending on the id list rather than the array, which is rebuilt every
    // render and would make this an infinite loop.
  }, [
    plansLoading,
    plans,
    selectedPlanId,
    visiblePlans.map((p) => p.id).join(","),
  ]);

  function selectPlan(plan) {
    setSelectedPlanId(plan.id);
    setError("");
  }


  function selectPlan(plan) {
    setSelectedPlanId(plan.id);
    setError("");
  }

  // Through better-auth's own client, so the header stops showing an avatar.
  // The tab's draft goes with the session: "Not you?" means the next person
  // at this keyboard must not find the last one's address typed in.
  async function handleSignOut(to = "/login") {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          try {
            sessionStorage.removeItem(DRAFT_KEY);
          } catch {
            // Nothing to remove.
          }
          window.location.href = to;
        },
      },
    });
  }

  /**
   * The press that makes the trial real: POST /api/companies with no name and
   * no address (the welcome questions ask for those), then the first welcome
   * question. A 409 means this login already has a business — the /app gate
   * knows where it belongs.
   */
  // ── A failed request, said in the visitor's language ─────────────────────
  //
  // Never an Error's own message: Safari's "Load failed" reached the owner on
  // a preview (lib/signup/visitorErrors.js). The sentence is a catalogue key,
  // and a Retry runs the same press again.
  const [retry, setRetry] = useState(null);
  function showVisitorError(v, again) {
    setError(t(v.key, v.text));
    setRetry(() => (v.retry && typeof again === "function" ? again : null));
  }
  function clearError() {
    setError("");
    setRetry(null);
  }

  async function createCompany() {
    clearError();
    let thrown = null;
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        marketingConsent: form.consent === true,
        referralCode: referralCode || undefined,
        salesCode: salesCode || undefined,
        utm: utm || undefined,
        signupLinkToken: signupLinkToken || undefined,
        next: nextPath || undefined,
        wantedTier: wantedRef.current.tier || undefined,
        wantedPlanId: wantedRef.current.planId || undefined,
      }),
    }).catch((err) => {
      thrown = err;
      return null;
    });
    let jsonOk = true;
    let data = null;
    if (res) {
      const text = await res.text().catch(() => "");
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        jsonOk = false;
      }
    }
    if (res?.ok && isInternalPath(data?.welcomeUrl)) {
      try {
        sessionStorage.removeItem(DRAFT_KEY);
        if (nextPath) sessionStorage.setItem(WELCOME_NEXT_KEY, nextPath);
        if (signupLinkToken) sessionStorage.setItem(WELCOME_LINK_KEY, signupLinkToken);
      } catch {
        // Storage blocked: the dashboard is where they land after setup.
      }
      window.location.href = data.welcomeUrl;
      return true;
    }
    if (res?.status === 409 && data?.code === "already_has_company") {
      window.location.href = "/app";
      return true;
    }
    showVisitorError(
      visitorError({
        err: thrown,
        status: res ? res.status : 0,
        jsonOk,
        fallback: { key: "app.signup.error.finishCompany", text: "Could not finish setting up your company" },
      }),
      handleStartSignedIn,
    );
    return false;
  }

  async function handleAccountSubmit(e) {
    e?.preventDefault?.();
    clearError();
    const errors = validateAccountFields(form, t);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSubmitting(true);
    try {
      await fetch("/api/auth/precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      }).catch(() => null);
      // No name yet: the welcome "about you" question asks for it, and Better
      // Auth's `name` is a plain string that may be empty until then.
      const result = await signUp.email({ email: form.email, password: form.password, name: "" });
      if (result?.error) {
        if (result.error.code === "USER_ALREADY_EXISTS" || /already exists/i.test(result.error.message || "")) {
          setExistingLogin(form.email.trim().toLowerCase());
          setFieldErrors({ email: t("app.signup.error.loginExists") });
          return;
        }
        // Better Auth's own words are English and sometimes an engine's
        // ("Load failed"); only its CODE is read, and the sentence is ours.
        const code = String(result.error.code || "");
        if (!isNetworkFailure(result.error) && /EMAIL/.test(code)) {
          setFieldErrors({ email: t("app.signup.error.email", "Enter a valid email address") });
          return;
        }
        if (!isNetworkFailure(result.error) && /PASSWORD/.test(code)) {
          setFieldErrors({ password: t("app.signup.error.passwordMin", `At least ${PASSWORD_MIN} characters`, { n: PASSWORD_MIN }) });
          return;
        }
        showVisitorError(
          visitorError({
            err: result.error,
            status: result.error.status,
            fallback: { key: "app.signup.error.createAccount", text: "Could not create your account" },
          }),
          () => handleAccountSubmit(),
        );
        return;
      }

      // "Company details" on the rep's panel is reported by the welcome
      // business screen, when there ARE details (app/welcome/WelcomeFlow.js).
      const ok = await createCompany();
      // The login exists even when the company POST failed: this page's
      // signed-in screen offers the same press again, never a second password.
      if (!ok) setAccountReady({ email: form.email });
    } catch (err) {
      showVisitorError(
        visitorError({ err, fallback: { key: "app.signup.error.createAccount", text: "Could not create your account" } }),
        () => handleAccountSubmit(),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStartSignedIn() {
    setSubmitting(true);
    try {

      await createCompany();
    } finally {
      setSubmitting(false);
    }
  }

  // ── The resumed payment's one press (a company from before 2026-09-24) ──
  //
  // Opens checkout for the company they already have, through the route
  // Account & Billing uses, sending the plan and the cadence — never a price.
  async function handleFinish() {
    clearError();
    if (!hasSelection) {
      setError(t("app.signup.error.selectPlan", "Please select a plan first."));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/platform/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlanId, interval: effectiveInterval }),
      });
      let jsonOk = true;
      const data = await res.json().catch(() => {
        jsonOk = false;
        return null;
      });
      if (!res.ok || !data?.checkoutUrl) {
        showVisitorError(
          visitorError({
            status: res.status,
            jsonOk,
            fallback: {
              key: "app.signup.error.checkout",
              text: "We couldn't open checkout. Try again, or get in touch and we'll finish it with you.",
            },
          }),
          handleFinish,
        );
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      showVisitorError(
        visitorError({ err, fallback: { key: "app.signup.error.checkoutShort", text: "We couldn't open checkout." } }),
        handleFinish,
      );
    } finally {
      setSubmitting(false);
    }
  }

  const trialLine = TRIAL_CARD_REQUIRED
    ? t("app.signup.trialDays", "Free for {days} days.", { days: TRIAL_DAYS })
    : t("app.signup.trialDaysNoCard", "Free for {days} days — no card needed.", { days: TRIAL_DAYS });

  return (
    <>
      <MarketingHeader />
      <AuthShell
        eyebrow={
          entryChecked && alreadyOnFieldquo
            ? t("app.signup.eyebrowExisting", "Add a business")
            : entryChecked && finishCheckout
              ? t("app.signup.finish.eyebrow", "Finish setting up")
              : t("app.signup.eyebrowTrial", "Free trial")
        }
        title={finishCheckout ? t("app.signup.finish.title", "One step left") : t("app.signup.title", "Start your free trial")}
        subtitle={
          finishCheckout
            ? resumeTrialLive
              ? t(
                  "app.signup.finish.subtitleTrial",
                  "{company} is set up — it just needs a card before you can use it. Your free trial has {days} left, so nothing is charged today.",
                  {
                    company: finishCheckout.name,
                    days: `${resumeTrialDaysLeft} ${t(resumeTrialDaysLeft === 1 ? "app.signup.finish.day" : "app.signup.finish.days")}`,
                  },
                )
              : t("app.signup.finish.subtitle", "{company} is set up — it just needs a card before you can use it.", {
                  company: finishCheckout.name,
                })
            : trialLine
        }
        aside={finishCheckout ? null : <WelcomeAside step="account" />}
      >
        {alreadyOnFieldquo && (
          <div className="max-w-md mx-auto bg-card border border-border rounded-2xl px-6 py-8 text-center">
            <h1 className="text-xl font-bold text-foreground">{t("app.signup.alreadyIn", "You already have a business here")}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {alreadyOnFieldquo.name
                ? t(
                    "app.signup.alreadyInBody",
                    "You're signed in as {name}. FieldQuo gives one business to a login, so there is nothing to set up on this page.",
                    { name: alreadyOnFieldquo.name },
                  )
                : t(
                    "app.signup.alreadyInBodyPlain",
                    "FieldQuo gives one business to a login, and this login has one — so there is nothing to set up on this page.",
                  )}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <a href="/app" className="bg-inverted text-inverted-foreground rounded-full px-6 py-3 text-sm font-semibold">
                {t("app.signup.goToDashboard", "Go to your dashboard")}
              </a>
              <a href="/app/settings/team" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                {t("app.signup.inviteInstead", "Add someone to your team instead")}
              </a>
              {referrer && (
                <a href="/app/settings/refer" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  {t("app.signup.yourOwnReferral", "Referral offers are for businesses new to FieldQuo — here is your own link")}
                </a>
              )}
            </div>
          </div>
        )}

        {finishCheckout && (
          <div className="max-w-md mx-auto mb-6 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            <p>
              {t(
                "app.signup.finish.banner",
                "{company} was set up, but checkout was never finished — so there's no card on the account and nothing to open yet. Choose a plan below and you're in.",
                { company: finishCheckout.name },
              )}
            </p>
            <button type="button" onClick={() => handleSignOut("/login")} className="mt-2 text-sm font-semibold underline underline-offset-2">
              {t("app.signup.finish.signOut", "Sign out of this account")}
            </button>
          </div>
        )}

        {refusedPlan?.reason === "retired" && finishCheckout && (
          <div className="max-w-md mx-auto mb-6 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            <p>{t("app.signup.plan.retired", "That plan is no longer offered — here are the current ones.")}</p>
          </div>
        )}

        {/* Only when the link carries a month: since 2026-10-03 a link
            shared by a company still on the free trial signs you up but
            promises nothing (months 0 from /api/public/refer — lib/referrals),
            and "0 months free" is not a banner. The month lands when the
            plan is chosen, which is what the sentence now says. */}
        {referrer && Number(referrer.months) > 0 && !alreadyOnFieldquo && (
          <div className="mb-6 bg-brand-accent/10 border border-brand-accent/40 rounded-xl px-4 py-3 text-center">
            {(() => {
              const sentence = t("app.signup.referred", "{name} referred you — {months} when you choose a plan.");
              const [a, rest] = around(sentence, "{name}");
              const [b, c] = around(rest, "{months}");
              return (
                <p className="text-sm text-foreground">
                  {a}
                  <strong>{referrer.referrerName}</strong>
                  {b}
                  <strong>{monthsFree(t, referrer.months)}</strong>
                  {c}
                </p>
              );
            })()}
          </div>
        )}

        {error && (
          <div role="alert" className="mb-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3" data-visitor-error>
            <p>{error}</p>
            {retry ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => retry()}
                className="mt-2 font-semibold underline underline-offset-2 disabled:opacity-60"
                data-visitor-retry
              >
                {t("app.signup.error.retry", "Try again")}
              </button>
            ) : null}
          </div>
        )}

        {resumeElsewhere && (
          <div className="max-w-md mx-auto bg-card border border-border rounded-2xl px-6 py-8 text-center" data-signup-resume-switch>
            <h1 className="text-xl font-bold text-foreground break-words">
              {t("app.signup.resumeSwitch.title", { email: resumeElsewhere.email })}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground break-words">
              {t("app.signup.resumeSwitch.body", { other: resumeElsewhere.other })}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleSignOut(resumeElsewhere.to)}
                className="bg-inverted text-inverted-foreground rounded-full px-6 py-3 text-sm font-semibold break-words"
              >
                {t("app.auth.switch.continueAs", { email: resumeElsewhere.email })}
              </button>
              <a href="/app" className="text-sm font-medium text-muted-foreground hover:text-foreground break-words">
                {t("app.auth.switch.stayAs", { other: resumeElsewhere.other })}
              </a>
            </div>
          </div>
        )}

        {!entryChecked && !alreadyOnFieldquo && !resumeElsewhere && (
          <div className="bg-card border border-border rounded-xl shadow-sm p-8 text-center text-sm text-muted-foreground">
            {t("app.signup.gettingReady", "Getting things ready...")}
          </div>
        )}

        {/* ── Signed in, no business: the same press, no second password ── */}
        {entryChecked && accountReady && !alreadyOnFieldquo && !finishCheckout && (
          <div className="bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8 space-y-4" data-signup-signed-in>
            <p className="text-sm text-foreground">
              {(() => {
                const [before, after] = around(
                  t("app.signup.signedInNoBusiness", "You're signed in as {email}. Start your free trial and we'll set up your business next."),
                  "{email}",
                );
                return (
                  <>
                    {before}
                    <strong className="break-all">{accountReady.email}</strong>
                    {after}
                  </>
                );
              })()}
            </p>
            <label className="flex items-start gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.consent === true}
                onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-border"
              />
              <span>{t("app.signup.consent", "Send me product news and offers")}</span>
            </label>
            <button type="button" disabled={submitting} onClick={handleStartSignedIn} className={PRIMARY_BUTTON}>
              {submitting ? t("app.signup.settingUp", "Setting up...") : `${t("app.signup.startTrial", "Start my free trial")} →`}
            </button>
            <button
              type="button"
              onClick={() => handleSignOut(window.location.pathname + window.location.search)}
              className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
              data-resumed-sign-out
            >
              {t("app.signup.resumed.signOut", "Not you? Sign out")}
            </button>
            <p className="text-xs text-muted-foreground">
              {t(
                "app.signup.resumed.invited",
                "Joining a business someone invited you to? Ask them to resend the invitation instead — this page sets up a new business of your own.",
              )}
            </p>
          </div>
        )}

        {entryChecked && !accountReady && !alreadyOnFieldquo && !finishCheckout && !resumeElsewhere && (
          <form onSubmit={handleAccountSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8 space-y-5">
            <AccountFields form={form} setForm={setForm} fieldErrors={fieldErrors} existingLogin={existingLogin} t={t} />
            <p className="text-xs text-muted-foreground">
              {(() => {
                const sentence = t("app.signup.terms", "By starting your trial you agree to the {terms} and the {privacy}.");
                const [a, rest] = around(sentence, "{terms}");
                const [b, c] = around(rest, "{privacy}");
                return (
                  <>
                    {a}
                    <Link href="/terms" className="underline underline-offset-2">
                      {t("app.signup.termsLink", "Terms of Service")}
                    </Link>
                    {b}
                    <Link href="/privacy" className="underline underline-offset-2">
                      {t("app.signup.privacyLink", "Privacy Policy")}
                    </Link>
                    {c}
                  </>
                );
              })()}
            </p>
            <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
              {submitting ? t("app.signup.creatingAccount", "Creating your account...") : `${t("app.signup.startTrial", "Start my free trial")} →`}
            </button>
          </form>
        )}

        {entryChecked && finishCheckout && (
          <div>
            {/* h2, not a second h1. The shell above already carries the
                page's heading, and two h1s is one page claiming to be two. */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                {t("app.signup.plan.title", "Choose your plan")}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                {t("app.signup.plan.body", "Last step — then we'll take you to checkout.")}
                {currencyName
                  ? ` ${t("app.signup.plan.pricesIn", "Prices in {currency}.", { currency: currencyName })}`
                  : ""}
              </p>
            </div>

            {/* ── Nobody has said where they are ───────────────────────────
                Ask. The alternative is picking a currency for them, and here
                the padding is a price: the two ladders carry the same NUMBER,
                so guessing CAD for an American is a ~38% error in his favour
                and guessing USD for a Canadian is a ~27% error in ours. */}
            {!basis.country ? (
              <div className="max-w-md mx-auto bg-card border border-border rounded-xl p-6 text-center">
                <h2 className="font-semibold text-foreground">
                  {t("app.signup.plan.whereTitle", "Where is your business?")}
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {t(
                    "app.signup.plan.whereBody",
                    "We price in Canadian and US dollars, and the address you gave us doesn't say which country you're in — so we'd be guessing at your price. Add it and these plans will fill in.",
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => (window.location.href = "/contact")}
                  className="mt-4 bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold"
                >
                  {t("app.signup.plan.addAddress", "Add your business address")}
                </button>
              </div>
            ) : !planCurrency ? (
              /* They DID say, and it's somewhere the ladder has no prices for.
                 A different sentence from the one above — telling someone who
                 picked Ireland from a list that we can't find their address is
                 the product failing to read its own form. */
              <div className="max-w-md mx-auto bg-card border border-border rounded-xl p-6 text-center">
                <h2 className="font-semibold text-foreground">
                  {t("app.signup.plan.noPricingTitle", "We don't have pricing for {country} yet", { country: countryName })}
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {t(
                    "app.signup.plan.noPricingBody",
                    "FieldQuo bills in Canadian and US dollars today. Get in touch and we'll set your business up by hand — everything you've entered here is kept in this tab in the meantime.",
                  )}
                </p>
                <Link
                  href="/contact"
                  className="inline-block mt-4 bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold"
                >
                  {t("app.signup.contactUs", "Contact us")}
                </Link>
                <p className="text-xs text-muted-foreground mt-3">
                  {t("app.signup.plan.notRight", "Not right?")}{" "}
                  <button
                    type="button"
                    onClick={() => (window.location.href = "/contact")}
                    className="underline"
                  >
                    {t("app.signup.plan.changeCountry", "Change your country")}
                  </button>
                </p>
              </div>
            ) : plansLoading ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                {t("app.signup.plan.loading", "Loading plans...")}
              </div>
            ) : visiblePlans.length === 0 ? (
              (() => {
                const [before, after] = around(
                  t(
                    "app.signup.plan.none",
                    "No plans are available right now. Please {link} to get started.",
                  ),
                  "{link}",
                );
                return (
                  <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                    {before}
                    <Link href="/contact" className="underline">
                      {t("app.signup.plan.noneLink", "contact us")}
                    </Link>
                    {after}
                  </div>
                );
              })()
            ) : (
              <>
              <div className="mb-6 flex flex-col items-center gap-3 text-center">
                <BillingIntervalTabs
                  t={t}
                  value={effectiveInterval}
                  onChange={setBillingInterval}
                  yearDisabled={yearTabDisabled}
                  percent={pillPercent}
                  upTo={pillUpTo}
                />
                {/* ── What the tab means, in one sentence ──────────────────
                    The year: the total, the monthly equivalent and the
                    saving, in the owner's own shape. The reason to commit IS
                    the saving, so it is said in money and in months rather
                    than a percentage — "two months free" is checkable in the
                    head against the monthly price; "17% off" is a number
                    somebody has to trust. */}
                <p className="text-sm text-muted-foreground max-w-lg">
                  {hasSelection && !annualAvailable ? (
                    <>
                      {t(
                        "app.signup.plan.monthlyLine",
                        "{price} a month, cancel any time.",
                        { price: `${symbol}${money(pricing.monthlyTotal)}` },
                      )}{" "}
                      {t("app.signup.plan.planMonthlyOnly", "{plan} is billed monthly only — there is no annual option on it.", {
                        plan: selectedPlanName,
                      })}
                    </>
                  ) : !anyAnnual ? (
                    t("app.signup.plan.ladderMonthlyOnly", "These plans are billed monthly only.")
                  ) : effectiveInterval === "year" ? (
                    hasSelection ? (
                      promoOffer ? (
                        // A sale on the year: its first-year charge, the
                        // month that makes, and what it renews at — the
                        // server's figures, to the cent.
                        <>
                          {t(
                            "app.signup.plan.yearlyPromoLine",
                            "{year} for year one — that's {month} a month — then {renewal} a year.",
                            {
                              year: centsMoney(promoOffer.charge),
                              month: centsMoney(promoOffer.perMonth),
                              renewal: centsMoney(promoOffer.renewal),
                            },
                          )}{" "}
                          <span className="font-medium text-green-700 dark:text-green-400">
                            {t("pricing.offer.youSaveYearOne", "You save {amount} in year one", {
                              amount: centsMoney(promoOffer.saves),
                            })}
                          </span>
                        </>
                      ) : (
                      <>
                        {t(
                          "app.signup.plan.yearlyLine",
                          "{year} a year — that's {month} a month.",
                          {
                            year: `${symbol}${money(annualPrice)}`,
                            month: `${symbol}${money(annualPrice / 12)}`,
                          },
                        )}{" "}
                        <span className="font-medium text-green-700 dark:text-green-400">{savingLine}</span>
                      </>
                      )
                    ) : (
                      t(
                        "app.signup.plan.yearlyPick",
                        "Prices below are per month, paid annually — pick a plan to see the year's total.",
                      )
                    )
                  ) : hasSelection ? (
                    t(
                      "app.signup.plan.monthlyLine",
                      "{price} a month, cancel any time.",
                      { price: `${symbol}${money(pricing.monthlyTotal)}` },
                    )
                  ) : (
                    t("app.signup.plan.monthlyPick", "Prices below are per month, cancel any time.")
                  )}
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {visiblePlans.map((plan) => (
                  <PricingCard
                    key={plan.id}
                    plan={plan}
                    selected={selectedPlanId === plan.id}
                    onSelect={() => selectPlan(plan)}
                    interval={effectiveInterval}
                    symbol={symbol}
                  />
                ))}

                {/* ── The fifth card points at the stepper ───────────────────
                    This used to be a "Custom" card: type a headcount, get a
                    price at $45/licence (calculatePricing). The owner retired
                    that pricing model 2026-08-31, and on 2026-09-18 asked for
                    a self-serve size above Scale: seats past ten at the
                    ladder's own per-seat step, crew = seats + 5, never more
                    than a hundred people (lib/pricing/ladder.js customTier).
                    The stepper that builds it lives on /pricing; its buy
                    button comes back here as ?tier=custom-N, which the plan
                    feed above turns into a real row in this currency. So this
                    card names the option and sends them to the stepper,
                    rather than duplicating the control — and it is not shown
                    while a custom size is already on the page. A hundred
                    people is still a conversation, and /contact stays for it. */}
                {!visiblePlans.some((p) => /^custom-\d+$/.test(p.tierKey || "")) && (
                  <div className="text-left border border-dashed border-border rounded-2xl p-6 flex flex-col justify-center bg-card">
                    <h3 className="text-lg font-semibold text-foreground">
                      {t("app.signup.plan.moreTitle", "Need more than Scale?")}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t(
                        "app.signup.plan.moreBody",
                        "Scale covers up to 10 seats and 15 crew. Need more? Build a custom plan — every seat you add brings a crew member with it, up to 100 people.",
                      )}
                    </p>
                    <Link
                      href="/pricing#custom"
                      className="mt-4 text-sm font-semibold underline underline-offset-2 self-start"
                    >
                      {t("app.signup.plan.buildCustom", "Build a custom plan")}
                    </Link>
                    <Link
                      href="/contact"
                      className="mt-2 text-xs text-muted-foreground underline underline-offset-2 self-start"
                    >
                      {t("app.signup.contactUs", "Contact us")}
                    </Link>
                  </div>
                )}
              </div>
              </>
            )}

            {planCurrency && (
              <div className="max-w-md mx-auto mt-8 bg-card border border-border rounded-xl p-5">
                <div className="text-sm text-muted-foreground">
                  {t("app.signup.plan.selected", "Selected plan:")}{" "}
                  <span className="font-semibold text-foreground">
                    {hasSelection ? selectedPlanName : t("app.signup.plan.noneYet", "None yet")}
                  </span>
                </div>

                {/* The cadence is chosen by the tabs above the cards — see
                    BillingIntervalTabs. It used to be two radio rows here,
                    below the cards it should have been repricing. */}

                {hasSelection && charge && (
                  <div className="text-sm text-muted-foreground mt-4">
                    {/* trialLabel() states the offer a NEW signup gets. A
                        company resuming an abandoned checkout may have spent
                        that month already — see the subtitle above — and
                        /api/platform/billing/checkout will not send Stripe any
                        trial days once trialEndsAt has passed. Saying "first
                        month free" over a charge that lands today is the exact
                        shape of promise this codebase forbids. */}
                    {(() => {
                      // One translated sentence with the charge in bold —
                      // split on {charge} so the bold lands where the
                      // language puts it, not where English does.
                      const sentence = finishCheckout
                        ? resumeTrialLive
                          ? t(
                              "app.signup.plan.chargeResume",
                              "Free for another {days}, then {charge}.",
                              { days: dayCount(t, resumeTrialDaysLeft) },
                            )
                          : t("app.signup.plan.chargeToday", "Billed from today: {charge}.")
                        : t("app.signup.plan.chargeTrial", "{trial}, then {charge}.", {
                            trial: trialText(t, pricing.trialTotal),
                          });
                      const [before, after] = around(sentence, "{charge}");
                      return (
                        <>
                          {before}
                          <span className="font-semibold text-foreground">{chargeWords(t, charge, promoOffer, symbol, money)}</span>
                          {after}
                        </>
                      );
                    })()}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={submitting || !hasSelection || !charge}
                  className={`${PRIMARY_BUTTON} mt-4 disabled:opacity-40`}
                >
                  {/* The button says what the click commits to, in the
                      cadence chosen — "then CA$990 a year" is a different
                      promise from "then CA$99/mo" and the label is the last
                      thing read before the card form. Never "today" while the
                      free month is live: nothing is charged today. */}
                  {submitting
                    ? t("app.signup.settingUp", "Setting up...")
                    : !charge
                      ? t("app.signup.continueToPayment", "Continue to Payment")
                      : (() => {
                          const chargeText = chargeWords(t, charge, promoOffer, symbol, money);
                          if (finishCheckout && !resumeTrialLive)
                            return t("app.signup.plan.startToday", "Start — {charge}, billed from today", {
                              charge: chargeText,
                            });
                          if (finishCheckout)
                            return t("app.signup.plan.startResume", "Start — free for another {days}, then {charge}", {
                              days: dayCount(t, resumeTrialDaysLeft),
                              charge: chargeText,
                            });
                          // trialLabel() owns the amount when the first
                          // month is not free (lib/pricing.js) — this label
                          // may never promise a free month the helper doesn't.
                          return pricing.trialTotal > 0
                            ? t("app.signup.plan.startTrialPaid", "Start — {trial}, then {charge}", {
                                trial: trialText(t, pricing.trialTotal),
                                charge: chargeText,
                              })
                            : t("app.signup.plan.startTrial", "Start — 14 days free, then {charge}", {
                                charge: chargeText,
                              });
                        })()}
                </button>

              </div>
            )}
          </div>
        )}


        {!finishCheckout && !alreadyOnFieldquo && (
          <p className="text-sm text-muted-foreground mt-6">
            {t("app.signup.alreadyAccount", "Already have an account?")}{" "}
            <Link href="/login" className="font-medium text-foreground underline">
              {t("app.signup.logIn", "Log in")}
            </Link>
          </p>
        )}
      </AuthShell>
    </>
  );
}
