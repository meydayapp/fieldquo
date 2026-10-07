"use client";

// app/welcome/WelcomeFlow.js
//
// The welcome questions' screens (2026-09-29). One screen per URL, rendered
// by app/welcome/[step]/page.js with every answer already stored — so a
// screen reopened after a sign-out is filled in. Each Continue is ONE PATCH
// to /api/signup/personalize: the server validates, writes, recomputes where
// the owner is (Company.onboardingStep) and says which URL comes next. The
// browser never decides that a question is answered.
//
// The last screen (setup) is the progress screen: the trade's services, the
// checklists and plans, the templates — each ticked only when the server's
// stream says so (lib/signup/creatingProgress.js), with the services it
// actually created named as chips.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import MarketingHeader from "@/app/components/marketing/MarketingHeader";
import AuthShell from "@/app/components/auth/AuthShell";
import WelcomeAside from "@/app/components/auth/WelcomeAside";
import SignupCreating from "@/app/components/auth/SignupCreating";
import { ChoiceChips } from "@/app/components/auth/SignupPreviews";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import IndustrySelect from "@/app/welcome/IndustrySelect";
import { fieldClass, FIELD_LABEL, FIELD_ERROR, PRIMARY_BUTTON } from "@/app/components/auth/fieldStyles";
import { useTranslation } from "@/app/hooks/useTranslation";
import { formatPhoneInput, isValidPhone } from "@/lib/validation";
import { trackSignupStep } from "@/lib/analytics/track";
import { isInternalPath } from "@/lib/appUrl";
import { initialStages, runSignupCreation, CREATING_TIMEOUTS } from "@/lib/signup/creatingProgress";
import {
  WELCOME_STEPS,
  WELCOME_TEAM_BANDS,
  WELCOME_YEARS_BANDS,
  WELCOME_REVENUE_BANDS,
  WELCOME_PRIORITIES,
  WELCOME_FOCUS,
  WELCOME_SOURCES,
  focusOptionsFor,
  previousWelcomeStep,
  revenueBandLabel,
  welcomePath,
} from "@/lib/signup/welcome";

import { WELCOME_NEXT_KEY, WELCOME_LINK_KEY } from "@/app/welcome/storageKeys";
import { visitorError } from "@/lib/signup/visitorErrors";
import { pendingAddToQuotePath } from "@/lib/quotes/addToQuoteLink";
import { pendingPriceRequestPath } from "@/lib/subRequests/model";

/** The analytics beacon a screen sends when shown — lib/analytics/product/events.js SIGNUP_STEP_BAR. */
export const WELCOME_BEACON = Object.freeze(Object.fromEntries(WELCOME_STEPS.map((s) => [s, `w_${s}`])));

function afterSetupUrl() {
  try {
    const next = sessionStorage.getItem(WELCOME_NEXT_KEY);
    if (isInternalPath(next)) return next;
  } catch {
    // Blocked storage: the cookie below, else the dashboard.
  }
  // A signup that began on "add this price to your own quote" but outlived
  // its tab (email verified elsewhere, back tomorrow) still lands on that
  // quote — lib/quotes/addToQuoteLink.js.
  try {
    const pending = pendingAddToQuotePath(document.cookie);
    if (isInternalPath(pending)) return pending;
    // …and one that began on a general contractor's price request lands back
    // on the request, signed in, to price it (lib/subRequests/model.js).
    const request = pendingPriceRequestPath(document.cookie);
    if (isInternalPath(request)) return request;
  } catch {
    // Blocked cookies: the dashboard.
  }
  return "/app";
}

function reportCompanyDetails() {
  try {
    const token = sessionStorage.getItem(WELCOME_LINK_KEY);
    if (!token) return;
    fetch("/api/signup/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, step: "company" }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Blocked storage or fetch: the panel is quieter, the signup unaffected.
  }
}

/** A refused answer's sentence, by the code lib/signup/welcome.js returns. Exported for the check. */
export function errorText(t, code) {
  switch (code) {
    case "firstName":
      return t("app.welcome.error.firstName", "Add your first name");
    case "lastName":
      return t("app.welcome.error.lastName", "Add your last name");
    case "phone":
      return t("app.welcome.error.phone", "Format: 555-123-4567");
    case "markup":
      return t("app.welcome.error.markup", "Names can't contain < or >");
    case "companyName":
      return t("app.welcome.error.companyName", "Add your company name");
    case "address":
      return t("app.welcome.error.address", "Start typing and select your address from the list");
    case "industry":
      return t("app.welcome.error.industry", "Pick your industry from the list");
    case "website":
      return t("app.welcome.error.website", "That doesn't look like a website — try yourcompany.com, or leave it empty");
    case "teamSize":
      return t("app.welcome.error.teamSize", "Pick how many people work at your company");
    case "years":
      return t("app.welcome.error.years", "Pick how long you've been in business");
    case "revenue":
      return t("app.welcome.error.revenue", "Pick one — “I'd prefer not to say” is fine");
    case "priority":
      return t("app.welcome.error.priority", "Pick the one that fits best");
    case "focus":
      return t("app.welcome.error.focus", "Pick at least one");
    case "source":
      return t("app.welcome.error.source", "Pick how you heard about us");
    default:
      return t("app.welcome.error.generic", "We couldn't save that — try again.");
  }
}

/** The question counter above each screen: "Question 3 of 7". */
function QuestionRail({ step, steps = WELCOME_STEPS }) {
  const { t } = useTranslation();
  // The list in force — two questions for a contractor from a sub's quote
  // (lib/signup/welcome.js GC_WELCOME_STEPS), so the counter never promises
  // seven when two are asked.
  const questions = steps.filter((s) => s !== "setup");
  const n = questions.indexOf(step) + 1;
  if (n <= 0) return null;
  const pct = Math.round((n / questions.length) * 100);
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground tabular-nums">
        {t("app.welcome.rail", "Question {n} of {total}", { n, total: questions.length })}
      </p>
      <div
        className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-inverted" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BackButton({ step, steps, onBack }) {
  const { t } = useTranslation();
  if (!previousWelcomeStep(step, { steps })) return null;
  return (
    <button type="button" onClick={onBack} className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground">
      ← {t("app.welcome.back", "Back")}
    </button>
  );
}

/** Multi-select chips for the focus screen. */
function MultiChips({ options, value, onChange, name }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={name}>
      {options.map((o) => {
        const on = value.includes(o.key);
        return (
          <button
            type="button"
            key={o.key}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.key) : [...value, o.key])}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              on ? "border-inverted bg-inverted text-inverted-foreground font-medium" : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {on ? <Check size={14} className="mr-1 inline -mt-0.5" aria-hidden="true" /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── The setup screen ─────────────────────────────────────────────────────── */

function SetupScreen({ prefill, steps }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [creating, setCreating] = useState(null);
  const ref = useRef({ stages: null, started: false });
  const trades = prefill.trade ? [{ id: prefill.trade.id, label: prefill.trade.label }] : [];

  async function run() {
    const start = ref.current.stages || initialStages(trades);
    setCreating({ stages: start, problem: null, running: true, slowNavigation: false });
    const appUrl = afterSetupUrl();
    const result = await runSignupCreation({
      stages: start,
      // The "company" stage here is the answers themselves being confirmed
      // complete — PATCH { step: "finish" } — not a second company.
      postCompany: (signal) =>
        fetch("/api/signup/personalize", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: "finish" }),
          signal,
        }),
      openSetup: (signal) => fetch("/api/signup/setup", { method: "POST", signal }),
      fallbackAppUrl: appUrl,
      onStages: (stages) => setCreating((c) => (c ? { ...c, stages } : c)),
    });
    ref.current.stages = result.stages;
    if (result.outcome === "done") {
      trackSignupStep("w_ready");
      setCreating((c) => ({ ...c, stages: result.stages, running: false }));
      window.location.href = appUrl;
      setTimeout(() => setCreating((c) => (c ? { ...c, slowNavigation: true } : c)), CREATING_TIMEOUTS.navigateSlowMs);
      return;
    }
    setCreating((c) => ({ ...c, stages: result.stages, problem: result, running: false }));
  }

  useEffect(() => {
    // Once per visit — React's development double-mount must not start two
    // runs (the server would answer the second "busy" anyway).
    if (ref.current.started) return;
    ref.current.started = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Go to my dashboard anyway": a stage failed, every question is answered,
  // and the owner chooses to carry on — stamped by the server, so the /app
  // gate lets them in rather than sending them back here.
  async function carryOn() {
    setCreating((c) => (c ? { ...c, running: true } : c));
    const res = await fetch("/api/signup/personalize", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "done" }),
    }).catch(() => null);
    if (res?.ok || res?.status === 409) {
      window.location.href = afterSetupUrl();
      return;
    }
    const v = visitorError({ status: res ? res.status : 0, fallback: { key: "app.welcome.error.generic", text: "We couldn't save that — try again." } });
    setCreating((c) => (c ? { ...c, running: false, problem: { ...c.problem, message: t(v.key, v.text), translated: true } } : c));
  }

  if (!creating) return null;
  return (
    <SignupCreating
      variant="welcome"
      stages={creating.stages}
      companyName={prefill.company.name}
      problem={creating.problem}
      running={creating.running}
      slowNavigation={creating.slowNavigation}
      appUrl={afterSetupUrl()}
      onRetry={run}
      onBack={() => router.push(welcomePath(previousWelcomeStep("setup", { steps }) || "source"))}
      onContinue={carryOn}
    />
  );
}

/* ── The questions ────────────────────────────────────────────────────────── */

// `steps`: the screens in force (the server chose them — app/welcome/[step]/
// page.js). `gcSender`: the subcontractor whose quote this signup began from,
// when it did ("" when the quote names none); null otherwise.
export default function WelcomeFlow({ step, prefill, groups = null, steps = WELCOME_STEPS, gcSender = null }) {
  const { t, language } = useTranslation();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // The last answer that failed to reach the server, for the Retry beside
  // the sentence (lib/signup/visitorErrors.js: never an engine's own words).
  const [retryAnswers, setRetryAnswers] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [trialDate, setTrialDate] = useState("");

  const p = prefill || { user: {}, company: {}, trade: null };
  const [profile, setProfile] = useState({
    firstName: p.user.firstName || "",
    lastName: p.user.lastName || "",
    phone: p.user.phone || "",
  });
  const [business, setBusiness] = useState({
    companyName: p.company.name || "",
    address: p.company.address || "",
    city: p.company.city || "",
    province: p.company.province || "",
    postalCode: p.company.postalCode || "",
    // The country the selected place stated — never typed, never guessed.
    // Cleared when the address text is edited, so a changed address has to
    // be picked from the list again.
    country: p.company.country || "",
    industry: p.company.industry || "",
    website: p.company.website || "",
  });
  const [teamSizeBand, setTeamSizeBand] = useState(p.company.teamSizeBand || null);
  const [yearsBand, setYearsBand] = useState(p.company.yearsInBusinessBand || null);
  const [revenueBand, setRevenueBand] = useState(p.company.revenueBand || null);
  const [priority, setPriority] = useState(p.company.signupPriority || null);
  const [focus, setFocus] = useState(Array.isArray(p.company.signupFocus) ? p.company.signupFocus : []);
  const [source, setSource] = useState(p.company.signupSource || "");

  // The funnel beacon for the screen shown (lib/analytics/product/events.js).
  useEffect(() => {
    if (WELCOME_BEACON[step]) trackSignupStep(WELCOME_BEACON[step]);
  }, [step]);

  // After mount: the date is formatted in the reader's language, which the
  // server render may not know — printing it only in the browser avoids a
  // hydration mismatch.
  useEffect(() => {
    if (!p.company.trialEndsAt) return;
    try {
      setTrialDate(new Date(p.company.trialEndsAt).toLocaleDateString(language || "en", { month: "long", day: "numeric" }));
    } catch {
      setTrialDate("");
    }
  }, [p.company.trialEndsAt, language]);

  function failed(v, answers) {
    setError(t(v.key, v.text));
    setRetryAnswers(v.retry ? { answers } : null);
  }

  async function save(answers) {
    setError("");
    setRetryAnswers(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const res = await fetch("/api/signup/personalize", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, answers }),
      });
      let jsonOk = true;
      const data = await res.json().catch(() => {
        jsonOk = false;
        return null;
      });
      if (res.ok && data?.nextUrl) {
        // "Company details" on the rep's panel, when a rep texted the link
        // this signup came from (lib/sales/signupProgress.js). Fire-and-forget.
        if (step === "business") reportCompanyDetails();
        router.push(data.nextUrl);
        return;
      }
      if (res.status === 409 && typeof data?.nextUrl === "string") {
        router.push(data.nextUrl);
        return;
      }
      if (res.status === 400 && data?.field) {
        setFieldErrors({ [data.field]: errorText(t, data.code) });
        return;
      }
      failed(visitorError({ status: res.status, jsonOk, fallback: { key: "app.welcome.error.generic", text: "We couldn't save that — try again." } }), answers);
    } catch (err) {
      failed(visitorError({ err, fallback: { key: "app.welcome.error.generic", text: "We couldn't save that — try again." } }), answers);
    } finally {
      setSaving(false);
    }
  }

  function back() {
    const prev = previousWelcomeStep(step, { steps });
    if (prev) router.push(welcomePath(prev));
  }

  if (step === "setup") {
    return (
      <>
        <MarketingHeader />
        <AuthShell eyebrow={t("app.welcome.setup.eyebrow", "Almost there")} title={t("app.welcome.setup.title", "Setting up your account")}>
          <SetupScreen prefill={p} steps={steps} />
        </AuthShell>
      </>
    );
  }

  const tradeLabel = p.trade?.label || "";
  const firstName = profile.firstName || p.user.firstName || "";
  const symbol = p.company.currencySymbol || "";
  const priorityDef = WELCOME_PRIORITIES.find((x) => x.key === priority) || null;

  let eyebrow = null;
  let title = "";
  let subtitle = null;
  let body = null;

  const submitLabel = saving ? t("app.welcome.saving", "Saving…") : t("app.welcome.continue", "Continue");

  if (step === "profile") {
    eyebrow = (
      <span className="inline-flex items-center gap-1.5">
        <Check size={14} aria-hidden="true" />
        {t("app.welcome.profile.eyebrow", "Your free trial is now active")}
      </span>
    );
    title = t("app.welcome.profile.title", "Tell us about you");
    subtitle = (
      <>
        {t(
          "app.welcome.profile.subtitle",
          "We'll use your name and number to set up your account and make sure you get support when you need it.",
        )}
        {trialDate ? ` ${t("app.welcome.profile.trialUntil", "Your trial is free until {date}.", { date: trialDate })}` : ""}
      </>
    );
    body = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const errs = {};
          if (!profile.firstName.trim()) errs.firstName = errorText(t, "firstName");
          if (!profile.lastName.trim()) errs.lastName = errorText(t, "lastName");
          if (!isValidPhone(profile.phone)) errs.phone = errorText(t, "phone");
          if (Object.keys(errs).length) return setFieldErrors(errs);
          save(profile);
        }}
        className="bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8 space-y-5"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="welcome-firstName" className={FIELD_LABEL}>
              {t("app.welcome.profile.firstName", "First name")}
            </label>
            <input
              id="welcome-firstName"
              autoComplete="given-name"
              value={profile.firstName}
              onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
              className={fieldClass(Boolean(fieldErrors.firstName))}
            />
            {fieldErrors.firstName && <p className={FIELD_ERROR}>{fieldErrors.firstName}</p>}
          </div>
          <div>
            <label htmlFor="welcome-lastName" className={FIELD_LABEL}>
              {t("app.welcome.profile.lastName", "Last name")}
            </label>
            <input
              id="welcome-lastName"
              autoComplete="family-name"
              value={profile.lastName}
              onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
              className={fieldClass(Boolean(fieldErrors.lastName))}
            />
            {fieldErrors.lastName && <p className={FIELD_ERROR}>{fieldErrors.lastName}</p>}
          </div>
        </div>
        <div>
          <label htmlFor="welcome-phone" className={FIELD_LABEL}>
            {t("app.welcome.profile.phone", "Phone number")}
          </label>
          <input
            id="welcome-phone"
            type="tel"
            autoComplete="tel"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: formatPhoneInput(e.target.value) })}
            placeholder="555-123-4567"
            className={fieldClass(Boolean(fieldErrors.phone))}
          />
          {fieldErrors.phone && <p className={FIELD_ERROR}>{fieldErrors.phone}</p>}
        </div>
        <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
          {submitLabel}
        </button>
      </form>
    );
  } else if (step === "business") {
    title = t("app.welcome.business.title", "Tell us about your business");
    subtitle = t("app.welcome.business.subtitle", "This is what your clients will see on your quotes and invoices.");
    body = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const errs = {};
          if (!business.companyName.trim()) errs.companyName = errorText(t, "companyName");
          if (!business.address.trim() || !business.country) errs.address = errorText(t, "address");
          if (!business.industry) errs.industry = errorText(t, "industry");
          if (Object.keys(errs).length) return setFieldErrors(errs);
          let timezone = null;
          try {
            timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
          } catch {
            timezone = null;
          }
          save({ ...business, timezone });
        }}
        className="bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8 space-y-5"
      >
        <div>
          <label htmlFor="welcome-companyName" className={FIELD_LABEL}>
            {t("app.welcome.business.companyName", "Company name")}
          </label>
          <input
            id="welcome-companyName"
            autoComplete="organization"
            value={business.companyName}
            onChange={(e) => setBusiness({ ...business, companyName: e.target.value })}
            className={fieldClass(Boolean(fieldErrors.companyName))}
          />
          {fieldErrors.companyName && <p className={FIELD_ERROR}>{fieldErrors.companyName}</p>}
        </div>
        <div>
          <label className={FIELD_LABEL}>{t("app.welcome.business.address", "Company address")}</label>
          <AddressAutocomplete
            value={business.address}
            onChange={(val) => setBusiness((b) => ({ ...b, address: val, country: val === b.address ? b.country : "" }))}
            // address-jurisdiction: keeps city, province AND country. The
            // country is the one Google's place states (ISO alpha-2) — it
            // sets the company's currency and default tax jurisdiction, so it
            // comes only from a place the person selected, never a default.
            onPlaceSelected={({ address, city, province, postalCode, country }) =>
              setBusiness((b) => ({
                ...b,
                address,
                city: city || "",
                province: province || "",
                postalCode: postalCode || "",
                country: country || "",
              }))
            }
            placeholder={t("app.welcome.business.addressPlaceholder", "Start typing your address…")}
            className={fieldClass(Boolean(fieldErrors.address))}
          />
          {fieldErrors.address && <p className={FIELD_ERROR}>{fieldErrors.address}</p>}
        </div>
        <div>
          <label htmlFor="welcome-industry" className={FIELD_LABEL}>
            {t("app.welcome.business.industry", "Industry")}
          </label>
          <div className="mt-1">
            <IndustrySelect
              groups={groups || []}
              value={business.industry}
              onChange={(v) => setBusiness((b) => ({ ...b, industry: v }))}
              invalid={Boolean(fieldErrors.industry)}
            />
          </div>
          {fieldErrors.industry && <p className={FIELD_ERROR}>{fieldErrors.industry}</p>}
        </div>
        <div>
          <label htmlFor="welcome-website" className={FIELD_LABEL}>
            {t("app.welcome.business.website", "Website")}{" "}
            <span className="font-normal text-muted-foreground">{t("app.welcome.optional", "(optional)")}</span>
          </label>
          <input
            id="welcome-website"
            type="text"
            inputMode="url"
            autoComplete="url"
            value={business.website}
            onChange={(e) => setBusiness({ ...business, website: e.target.value })}
            placeholder="yourcompany.com"
            className={fieldClass(Boolean(fieldErrors.website))}
          />
          {fieldErrors.website && <p className={FIELD_ERROR}>{fieldErrors.website}</p>}
        </div>
        <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
          {submitLabel}
        </button>
        <BackButton step={step} steps={steps} onBack={back} />
      </form>
    );
  } else if (step === "size") {
    title = tradeLabel
      ? t("app.welcome.size.title", "Your {trade} business at a glance", { trade: tradeLabel })
      : t("app.welcome.size.titlePlain", "Your business at a glance");
    body = (
      <div className="bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <p className={`${FIELD_LABEL} mb-2`}>
            {t("app.welcome.size.teamQuestion", "How many people work at your company (including you)?")}
          </p>
          <ChoiceChips
            options={WELCOME_TEAM_BANDS}
            value={teamSizeBand}
            onChange={setTeamSizeBand}
            name={t("app.welcome.size.teamQuestion", "How many people work at your company (including you)?")}
          />
          {fieldErrors.teamSizeBand && <p className={FIELD_ERROR}>{fieldErrors.teamSizeBand}</p>}
        </div>
        <div>
          <p className={`${FIELD_LABEL} mb-2`}>
            {t("app.welcome.size.yearsQuestion", "How many years have you been in business?")}
          </p>
          <ChoiceChips
            options={WELCOME_YEARS_BANDS.map((b) => ({ ...b, labelKey: `app.welcome.size.years.${b.key}`, label: YEARS_SHORT[b.key] }))}
            value={yearsBand}
            onChange={setYearsBand}
            name={t("app.welcome.size.yearsQuestion", "How many years have you been in business?")}
          />
          {fieldErrors.yearsInBusinessBand && <p className={FIELD_ERROR}>{fieldErrors.yearsInBusinessBand}</p>}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            const errs = {};
            if (!teamSizeBand) errs.teamSizeBand = errorText(t, "teamSize");
            if (!yearsBand) errs.yearsInBusinessBand = errorText(t, "years");
            if (Object.keys(errs).length) return setFieldErrors(errs);
            save({ teamSizeBand, yearsInBusinessBand: yearsBand });
          }}
          className={PRIMARY_BUTTON}
        >
          {submitLabel}
        </button>
        <BackButton step={step} steps={steps} onBack={back} />
      </div>
    );
  } else if (step === "revenue") {
    title = t("app.welcome.revenue.title", "Let's fine-tune your FieldQuo experience");
    body = (
      <div className="bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <p className={`${FIELD_LABEL} mb-1`}>
            {t("app.welcome.revenue.question", "What's your estimated revenue this year?")}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            {t("app.welcome.revenue.private", "Only FieldQuo sees this — never your clients or your team.")}
          </p>
          <ChoiceChips
            options={WELCOME_REVENUE_BANDS.map((b) => ({
              key: b.key,
              label: revenueBandLabel(b, symbol, t("app.welcome.revenue.preferNot", "I'd prefer not to say")),
            }))}
            value={revenueBand}
            onChange={setRevenueBand}
            name={t("app.welcome.revenue.question", "What's your estimated revenue this year?")}
          />
          {fieldErrors.revenueBand && <p className={FIELD_ERROR}>{fieldErrors.revenueBand}</p>}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            if (!revenueBand) return setFieldErrors({ revenueBand: errorText(t, "revenue") });
            save({ revenueBand });
          }}
          className={PRIMARY_BUTTON}
        >
          {submitLabel}
        </button>
        <BackButton step={step} steps={steps} onBack={back} />
      </div>
    );
  } else if (step === "priority") {
    title = firstName
      ? t("app.welcome.priority.title", "{name}, let's get FieldQuo working for you", { name: firstName })
      : t("app.welcome.priority.titlePlain", "Let's get FieldQuo working for you");
    subtitle = t("app.welcome.priority.subtitle", "What matters most to you right now? Pick one.");
    body = (
      <div className="space-y-3">
        <div role="radiogroup" aria-label={subtitle} className="grid gap-3 sm:grid-cols-2">
          {WELCOME_PRIORITIES.map((x) => {
            const on = priority === x.key;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={on}
                key={x.key}
                onClick={() => setPriority(x.key)}
                className={`text-left rounded-xl border p-5 text-sm transition-colors ${
                  on ? "border-inverted bg-muted font-semibold" : "border-border bg-card hover:bg-muted"
                }`}
              >
                {t(`app.welcome.priority.${x.key}.card`, PRIORITY_CARD[x.key])}
              </button>
            );
          })}
        </div>
        {fieldErrors.signupPriority && <p className={FIELD_ERROR}>{fieldErrors.signupPriority}</p>}
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            if (!priority) return setFieldErrors({ signupPriority: errorText(t, "priority") });
            save({ signupPriority: priority });
          }}
          className={`${PRIMARY_BUTTON} mt-3`}
        >
          {submitLabel}
        </button>
        <BackButton step={step} steps={steps} onBack={back} />
      </div>
    );
  } else if (step === "focus") {
    const key = priorityDef?.key || "exploring";
    title = t(`app.welcome.focus.${key}.title`, FOCUS_HEADING[key].title);
    subtitle = t(`app.welcome.focus.${key}.subtitle`, FOCUS_HEADING[key].subtitle);
    body = (
      <div className="bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8 space-y-6">
        <div>
          <p className={`${FIELD_LABEL} mb-3`}>{t("app.welcome.focus.question", "Tell us what you'd like to focus on")}</p>
          <MultiChips
            options={focusOptionsFor(key).map((f) => ({ key: f, label: t(`app.welcome.focus.option.${f}`, WELCOME_FOCUS[f]) }))}
            value={focus}
            onChange={setFocus}
            name={t("app.welcome.focus.question", "Tell us what you'd like to focus on")}
          />
          {fieldErrors.signupFocus && <p className={FIELD_ERROR}>{fieldErrors.signupFocus}</p>}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            const offered = focusOptionsFor(key);
            const picked = focus.filter((f) => offered.includes(f));
            if (!picked.length) return setFieldErrors({ signupFocus: errorText(t, "focus") });
            save({ signupFocus: picked });
          }}
          className={PRIMARY_BUTTON}
        >
          {submitLabel}
        </button>
        <BackButton step={step} steps={steps} onBack={back} />
      </div>
    );
  } else if (step === "source") {
    title = t("app.welcome.source.title", "How did you hear about FieldQuo?");
    subtitle = t("app.welcome.source.subtitle", "Last question — then we'll set up your account.");
    body = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!source) return setFieldErrors({ signupSource: errorText(t, "source") });
          save({ signupSource: source });
        }}
        className="bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8 space-y-5"
      >
        <div>
          <label htmlFor="welcome-source" className={FIELD_LABEL}>
            {t("app.welcome.source.label", "Where did you first hear about us?")}
          </label>
          <select
            id="welcome-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={fieldClass(Boolean(fieldErrors.signupSource))}
          >
            <option value="">{t("app.welcome.source.choose", "Choose one…")}</option>
            {WELCOME_SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`app.welcome.source.option.${s}`, SOURCE_LABEL[s])}
              </option>
            ))}
          </select>
          {fieldErrors.signupSource && <p className={FIELD_ERROR}>{fieldErrors.signupSource}</p>}
        </div>
        <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
          {saving ? t("app.welcome.saving", "Saving…") : t("app.welcome.source.submit", "Get started")}
        </button>
        <BackButton step={step} steps={steps} onBack={back} />
      </form>
    );
  }

  return (
    <>
      <MarketingHeader />
      <AuthShell
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        rail={
          <>
            {/* Why there are only two questions, and where they go after:
                straight back to the sub's price (lib/signup/gcWelcome.js). */}
            {gcSender !== null && (
              <p className="mb-3 text-sm text-foreground" data-welcome-gc-note>
                {gcSender
                  ? t("app.welcome.gc.note", { company: gcSender })
                  : t("app.welcome.gc.noteNoName")}
              </p>
            )}
            <QuestionRail step={step} steps={steps} />
          </>
        }
        aside={<WelcomeAside step={step} />}
      >
        {error && (
          <div role="alert" className="mb-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3" data-visitor-error>
            <p>{error}</p>
            {retryAnswers ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => save(retryAnswers.answers)}
                className="mt-2 font-semibold underline underline-offset-2 disabled:opacity-60"
                data-visitor-retry
              >
                {t("app.signup.error.retry", "Try again")}
              </button>
            ) : null}
          </div>
        )}
        {body}
      </AuthShell>
    </>
  );
}

/** English fallbacks; the catalogue carries every language. */
const YEARS_SHORT = { "<1": "Less than 1", "1-2": "1–2", "3-5": "3–5", "6-10": "6–10", "10+": "10+" };

const PRIORITY_CARD = {
  professional: "I want my business to look as professional as my work",
  control: "I want to feel in control, not like my business is running me",
  win_more: "I want to win more jobs, without the time-consuming admin",
  exploring: "I'm not sure yet, just exploring",
};

const FOCUS_HEADING = {
  professional: {
    title: "Let's make every job look as good as your work",
    subtitle: "Pick what you'd like to polish first — we'll start you there.",
  },
  control: {
    title: "Let's put you back in charge of your day",
    subtitle: "Pick the parts of the business that take up most of your time.",
  },
  win_more: {
    title: "Let's fill your calendar with the right jobs",
    subtitle: "Pick where work slips away today, and we'll start there.",
  },
  exploring: {
    title: "Let's show you around",
    subtitle: "Pick anything you're curious about — you can change it later.",
  },
};

const SOURCE_LABEL = {
  search_engine: "Search engine (Google, Bing…)",
  social_media: "Social media (Facebook, Instagram…)",
  youtube: "YouTube",
  friend: "A friend or colleague",
  another_business: "Another business that uses FieldQuo",
  online_ad: "An online ad",
  review_site: "A review or comparison site",
  fieldquo_rep: "Someone from FieldQuo contacted me",
  event: "A trade show or event",
  other: "Somewhere else",
};

export const WELCOME_COPY = Object.freeze({ YEARS_SHORT, PRIORITY_CARD, FOCUS_HEADING, SOURCE_LABEL });
