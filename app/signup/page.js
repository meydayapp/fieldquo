// app/signup/page.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { calculatePricing , TRIAL_PRICE, trialLabel } from "@/lib/pricing";
import { INDUSTRIES } from "@/app/data/industries";
import { categoryKeysForIndustries } from "@/app/data/industryCategories";
import PricingCard from "@/app/components/marketing/PricingCard";
import MarketingHeader from "@/app/components/marketing/MarketingHeader";

// add to imports at top of app/signup/page.js
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { formatPhoneInput, isValidPhone, isValidEmail } from "@/lib/validation";
import { LANGUAGES } from "@/app/i18n/languages";
import { COUNTRIES } from "@/lib/currency";
import { isInternalPath } from "@/lib/appUrl";

// "1 month free" / "3 months free". The banner hardcoded the plural and read
// "1 months free" for the whole life of the current one-month offer. Same
// shape as MONTHS_FREE on app/refer/[code]/page.js.
function monthsFree(n) {
  const count = Number(n) || 0;
  return `${count} ${count === 1 ? "month" : "months"} free`;
}

// The company half of the form. Rendered by two steps — "account" (new login +
// first business) and "business" (an existing login adding another) — as one
// component rather than two copies, because the copy is the one that rots.
//
// Module scope on purpose: declared inside SignupPage it would be a new
// component type on every render, remounting AddressAutocomplete and losing
// focus mid-keystroke.
function CompanyFields({ form, setForm, fieldErrors }) {
  return (
    <>
      <div>
        <label className="text-sm font-medium text-foreground">
          Company name
        </label>
        <input
          value={form.companyName}
          onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
            fieldErrors.companyName ? "border-red-400" : "border-border"
          }`}
        />
        {fieldErrors.companyName && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {fieldErrors.companyName}
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-foreground">Phone</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: formatPhoneInput(e.target.value) })
          }
          placeholder="555-123-4567"
          className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
            fieldErrors.phone ? "border-red-400" : "border-border"
          }`}
        />
        {fieldErrors.phone && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {fieldErrors.phone}
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-foreground">Address</label>
        <AddressAutocomplete
          value={form.address}
          onChange={(val) => setForm((f) => ({ ...f, address: val }))}
          onPlaceSelected={({ address, city, province }) =>
            setForm((f) => ({ ...f, address, city, province }))
          }
          placeholder="Start typing your address..."
          className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
            fieldErrors.address ? "border-red-400" : "border-border"
          }`}
        />
        {fieldErrors.address && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {fieldErrors.address}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-foreground">City</label>
          <input
            value={form.city}
            readOnly
            placeholder="Auto-filled from address"
            className="w-full mt-1 border border-border bg-muted rounded-lg px-4 py-2.5 text-sm text-muted-foreground"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Province</label>
          <input
            value={form.province}
            readOnly
            placeholder="Auto-filled from address"
            className="w-full mt-1 border border-border bg-muted rounded-lg px-4 py-2.5 text-sm text-muted-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-foreground">Country</label>
          <select
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            className="w-full mt-1 border border-border rounded-lg px-4 py-2.5 text-sm bg-background"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          {/* Sets the billing currency — a company only serving its home
              country is never asked to pick one. */}
          <p className="text-xs text-muted-foreground mt-1">
            Sets your billing currency.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Language</label>
          <select
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
            className="w-full mt-1 border border-border rounded-lg px-4 py-2.5 text-sm bg-background"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Your default in the app.
          </p>
        </div>
      </div>
    </>
  );
}

export default function SignupPage() {
  const [step, setStep] = useState("plan");

  // Referral code from /refer/<code>, which links here as ?ref=<code>.
  //
  // Read from window.location rather than useSearchParams() to avoid needing a
  // Suspense boundary around this whole page — see the note in
  // app/app/layout.js about prerender failures from client-only hooks.
  //
  // Held in state and posted with the company, NOT stored in a cookie: a stale
  // referral cookie from a link someone clicked last month shouldn't silently
  // attach itself to an unrelated signup.
  const [referralCode, setReferralCode] = useState("");
  // Where to return after checkout, when signup began from a flow like "add this
  // quote to your project" (?next=/q/<token>). Internal paths only.
  const [nextPath, setNextPath] = useState("");
  const [referrer, setReferrer] = useState(null);
  // Set when someone opens a signup link while already signed in to a company.
  // Referral offers are for businesses new to FieldQuo, so they can't redeem —
  // and being told that here beats filling in the whole form first.
  const [alreadyOnFieldquo, setAlreadyOnFieldquo] = useState(null);

  useEffect(() => {
    // A logged-in session means an existing account. business-info is
    // company-scoped and 401s when there's no session, so a 200 is the signal.
    fetch("/api/settings/business-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.name && setAlreadyOnFieldquo(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("next");
    if (isInternalPath(raw)) setNextPath(raw);
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (!code) return;
    setReferralCode(code);

    // Confirm the code is real before promising anything. A typo'd link
    // should not produce a banner claiming free months that the API then
    // silently declines to grant.
    fetch(`/api/public/refer/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.valid && setReferrer(d))
      .catch(() => {});
  }, []);

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  const [isCustom, setIsCustom] = useState(false);
  const [customCount, setCustomCount] = useState(25);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    companyName: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    // The company's own language becomes their default interface language and
    // the fallback for client documents. Country drives the billing currency
    // (derived, not asked) — see lib/currency.js currencyForCountry.
    language: "en",
    country: "CA",
  });

  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  // When on, the services step shows only the quote types preset from the
  // chosen industries; toggled off to browse/add from the full catalog.
  const [showAllServices, setShowAllServices] = useState(false);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // add this state alongside your other useState calls
  const [fieldErrors, setFieldErrors] = useState({});

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const employeeCount = isCustom ? customCount : selectedPlan?.maxUsers || 1;

  const pricing = isCustom
    ? calculatePricing(customCount)
    : {
        trialTotal: TRIAL_PRICE,
        monthlyTotal: Number(selectedPlan?.priceMonthly || 0),
        contactSalesRequired: false,
      };

  const selectedPlanName = isCustom
    ? `Custom — ${customCount} employees`
    : selectedPlan?.name || "Selected plan";

  const hasSelection = isCustom || Boolean(selectedPlanId);

  useEffect(() => {
    // ?plan=<id> is what the pricing page's "Start Free Trial" buttons carry.
    // It was never read, so choosing a tier on /pricing landed here with
    // nothing selected and the Continue button disabled.
    //
    // Applied inside this .then rather than in a separate effect keyed on
    // `plans`, so it runs exactly once at load: an effect would re-assert the
    // query's plan every time the list changed and fight anyone clicking a
    // different card. Unknown ids are ignored rather than errored — a stale
    // link should still let you pick.
    const wantedPlanId = new URLSearchParams(window.location.search).get("plan");

    fetch("/api/marketing/plans")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setPlans(list);
        if (wantedPlanId && list.some((p) => p.id === wantedPlanId)) {
          setSelectedPlanId(wantedPlanId);
        }
      })
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));

    fetch("/api/service-categories/public")
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, []);

  function selectPlan(plan) {
    setSelectedPlanId(plan.id);
    setIsCustom(false);
    setError("");
  }

  function selectCustom() {
    setIsCustom(true);
    setSelectedPlanId(null);
    setError("");
  }

  function handleContinueFromPlan() {
    setError("");
    if (!hasSelection) {
      setError("Please select a plan first.");
      return;
    }
    if (isCustom && pricing.contactSalesRequired) {
      setError("For more than 40 employees, please contact sales.");
      return;
    }
    // Already signed in? Skip account CREATION — they have an account. They do
    // not have the new company's details, and the account step was the only
    // place that collected them, so skipping straight to "industry" posted an
    // empty company name and dead-ended on a 400 with no field to correct.
    // Hence a trimmed step that asks for the business and nothing else.
    setStep(alreadyOnFieldquo ? "business" : "account");
  }

  // Company details for someone who already has a login. Same fields and same
  // rules as the company half of the account step — kept as one validator so
  // the two paths can't drift into disagreeing about what's required.
  function validateBusiness() {
    const errors = {};
    if (!form.companyName.trim()) errors.companyName = "Company name is required";
    if (form.phone && !isValidPhone(form.phone))
      errors.phone = "Format: 555-123-4567";
    if (!form.address.trim())
      errors.address = "Start typing and select your address";
    return errors;
  }

  function handleBusinessSubmit(e) {
    e.preventDefault();
    setError("");

    const errors = validateBusiness();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setStep("industry");
  }

  // replace handleAccountSubmit entirely
  async function handleAccountSubmit(e) {
    e.preventDefault();
    setError("");

    // Company rules come from the shared validator; the rest are the personal
    // fields only this step collects.
    const errors = validateBusiness();
    if (!form.firstName.trim()) errors.firstName = "First name is required";
    if (!form.lastName.trim()) errors.lastName = "Last name is required";
    if (!isValidEmail(form.email)) errors.email = "Enter a valid email address";
    if (!form.password || form.password.length < 8)
      errors.password = "At least 8 characters";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);

    await fetch("/api/auth/precheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email }),
    });
    try {
      const result = await signUp.email({
        email: form.email,
        password: form.password,
        name: `${form.firstName} ${form.lastName}`.trim(),
      });

      if (result?.error) {
        // Surface Better Auth's own message on the specific field when possible,
        // otherwise fall back to the general error banner.
        const message = result.error.message || "Could not create your account";
        if (message.toLowerCase().includes("email")) {
          setFieldErrors({ email: message });
        } else {
          setError(message);
        }
        return;
      }

      setStep("industry");
    } catch (err) {
      setError(err?.message || "Could not create your account");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleIndustry(slug) {
    setSelectedIndustries((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  function toggleCategory(id) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  async function handleFinish() {
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.companyName,
          phone: form.phone,
          address: form.address,
          city: form.city,
          province: form.province,
          country: form.country,
          language: form.language,
          industries: selectedIndustries,
          planId: isCustom ? null : selectedPlanId,
          employeeCount,
          serviceCategoryIds: selectedCategoryIds,
          referralCode: referralCode || undefined,
          next: nextPath || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not finish setting up your company");
        return;
      }

      if (!data.checkoutUrl) {
        setError("Company was created, but no checkout URL was returned.");
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err?.message || "Could not finish setting up your company");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <MarketingHeader />
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-muted px-4 py-12">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Start your free trial
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {/* Off the trialLabel helper, never a hardcoded number — this line
                had drifted to "$1" while the system actually charges $0. */}
            {trialLabel()}
          </p>
        </div>

        {/* Already signed in. Redirect would be wrong — they may genuinely be
            setting up a second business — but they need to know the referral
            can't apply, and the useful thing to offer is their OWN link. */}
        {alreadyOnFieldquo && (
          <div className="max-w-md mx-auto mb-6 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl px-4 py-3 text-sm text-blue-900 dark:text-blue-200">
            <p>
              You&apos;re signed in as <strong>{alreadyOnFieldquo.name}</strong>.
              {" "}Carrying on here sets up an <strong>additional business</strong>
              {" "}on your existing login — it won&apos;t create a second account
              or change the business you already have.
              {referrer
                ? " Referral offers are for businesses new to FieldQuo, so this link won't apply to your account."
                : ""}
            </p>
            <p className="mt-2">
              <a href="/app" className="underline font-semibold">
                Go to your dashboard
              </a>
              {referrer && (
                <>
                  {" · "}
                  <a
                    href="/app/settings/refer"
                    className="underline font-semibold"
                  >
                    Share your own referral link
                  </a>
                </>
              )}
            </p>
          </div>
        )}

        {/* Only shown once the code has been confirmed real. Carried through
            every step so someone who reaches the payment screen still sees
            what they were promised on the landing page. */}
        {referrer && !alreadyOnFieldquo && (
          <div className="max-w-md mx-auto mb-6 bg-brand-accent/10 border border-brand-accent/40 rounded-xl px-4 py-3 text-center">
            <p className="text-sm text-[#2d2520]">
              <strong>{referrer.referrerName}</strong> referred you —{" "}
              <strong>{monthsFree(referrer.months)}</strong> added to your trial.
            </p>
          </div>
        )}
        {error && (
          <div className="max-w-md mx-auto mb-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}
        {step === "plan" && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-foreground">
                Choose your plan
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                {alreadyOnFieldquo
                  ? "Select the number of employees you need — you're signed in, so we'll go straight to the new business's details."
                  : "Select the number of employees you need — you'll create your account next."}
              </p>
            </div>

            {plansLoading ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                Loading plans...
              </div>
            ) : plans.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                No plans are available right now. Please{" "}
                <Link href="/contact" className="underline">
                  contact us
                </Link>{" "}
                to get started.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((plan) => (
                  <PricingCard
                    key={plan.id}
                    plan={plan}
                    selected={!isCustom && selectedPlanId === plan.id}
                    onSelect={() => selectPlan(plan)}
                  />
                ))}

                <div
                  className={`text-left border rounded-2xl p-6 flex flex-col relative bg-card transition-all duration-150 ease-out hover:scale-[1.03] hover:shadow-lg ${
                    isCustom
                      ? "border-inverted ring-2 ring-ring scale-[1.02] bg-muted"
                      : "border-border hover:border-border"
                  }`}
                >
                  <button
                    type="button"
                    onClick={selectCustom}
                    className="text-left"
                  >
                    <h3 className="text-lg font-semibold text-foreground">
                      Custom
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tell us how many employees you need, and we'll calculate
                      your rate.
                    </p>
                  </button>

                  {isCustom && (
                    <div className="mt-4">
                      <label className="text-sm font-medium text-foreground">
                        Number of employees
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={customCount}
                        onChange={(e) =>
                          setCustomCount(Number(e.target.value || 1))
                        }
                        className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm"
                      />
                      {pricing.contactSalesRequired ? (
                        <p className="mt-4 text-sm text-foreground">
                          For more than 40 employees, pricing is custom —{" "}
                          <Link
                            href="/contact"
                            className="underline font-medium"
                          >
                            contact us
                          </Link>
                          .
                        </p>
                      ) : (
                        <p className="mt-4 text-sm text-foreground">
                          {trialLabel(pricing.trialTotal)}, then{" "}
                          <span className="font-semibold">
                            ${pricing.monthlyTotal}/mo
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="max-w-md mx-auto mt-8 bg-card border border-border rounded-xl p-5">
              <div className="text-sm text-muted-foreground">
                Selected plan:{" "}
                <span className="font-semibold text-foreground">
                  {hasSelection ? selectedPlanName : "None yet"}
                </span>
              </div>

              {hasSelection && !pricing.contactSalesRequired && (
                <div className="text-sm text-muted-foreground mt-1">
                  {trialLabel(pricing.trialTotal)}, then{" "}
                  <span className="font-semibold text-foreground">
                    ${pricing.monthlyTotal}/mo
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleContinueFromPlan}
                disabled={
                  !hasSelection || (isCustom && pricing.contactSalesRequired)
                }
                className="w-full mt-4 bg-inverted text-inverted-foreground py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        )}
        {step === "account" && (
          <form
            onSubmit={handleAccountSubmit}
            className="max-w-lg mx-auto bg-card border border-border rounded-xl p-6 space-y-4"
          >
            <div className="bg-muted rounded-lg px-4 py-3 text-sm text-foreground">
              <strong>{selectedPlanName}</strong>
              <br />
              {trialLabel(pricing.trialTotal)}, then ${pricing.monthlyTotal}/mo
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">
                  First name
                </label>
                <input
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                    fieldErrors.firstName ? "border-red-400" : "border-border"
                  }`}
                />
                {fieldErrors.firstName && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {fieldErrors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Last name
                </label>
                <input
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                  className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                    fieldErrors.lastName ? "border-red-400" : "border-border"
                  }`}
                />
                {fieldErrors.lastName && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {fieldErrors.lastName}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@company.com"
                className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                  fieldErrors.email ? "border-red-400" : "border-border"
                }`}
              />
              {fieldErrors.email && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <CompanyFields
              form={form}
              setForm={setForm}
              fieldErrors={fieldErrors}
            />

            <div>
              <label className="text-sm font-medium text-foreground">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                  fieldErrors.password ? "border-red-400" : "border-border"
                }`}
              />
              {fieldErrors.password && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? "Creating your account..." : "Continue"}
            </button>

            <button
              type="button"
              onClick={() => setStep("plan")}
              className="w-full text-sm text-muted-foreground"
            >
              ← Back to plans
            </button>
          </form>
        )}
        {/* The signed-in path. Everything the account step collects about the
            BUSINESS, nothing it collects about the person — they already have a
            login, and /api/companies needs a name or it 400s. */}
        {step === "business" && (
          <form
            onSubmit={handleBusinessSubmit}
            className="max-w-lg mx-auto bg-card border border-border rounded-xl p-6 space-y-4"
          >
            <div className="bg-muted rounded-lg px-4 py-3 text-sm text-foreground">
              <strong>{selectedPlanName}</strong>
              <br />
              {trialLabel(pricing.trialTotal)}, then ${pricing.monthlyTotal}/mo
            </div>

            <div>
              <h2 className="font-semibold text-foreground">
                Your new business
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                This is the business your clients will see on quotes and
                invoices. It's separate from{" "}
                <strong>{alreadyOnFieldquo?.name}</strong> — nothing there
                changes.
              </p>
            </div>

            <CompanyFields
              form={form}
              setForm={setForm}
              fieldErrors={fieldErrors}
            />

            <button
              type="submit"
              className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold"
            >
              Continue
            </button>

            <button
              type="button"
              onClick={() => setStep("plan")}
              className="w-full text-sm text-muted-foreground"
            >
              ← Back to plans
            </button>
          </form>
        )}
        {step === "industry" && (
          <div className="max-w-md mx-auto">
            <h2 className="font-semibold text-foreground mb-1">
              What trades does your company work in?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select all that apply — this narrows down which quote types you'll
              see.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {INDUSTRIES.map((ind) => (
                <button
                  type="button"
                  key={ind.slug}
                  onClick={() => toggleIndustry(ind.slug)}
                  className={`text-left border rounded-lg px-4 py-3 text-sm ${
                    selectedIndustries.includes(ind.slug)
                      ? "border-inverted bg-muted font-medium"
                      : "border-border bg-card"
                  }`}
                >
                  {ind.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                // Preset the services step from the chosen industries — the
                // point of asking for industry at all. Maps preset category
                // keys -> the catalog ids we already loaded, and pre-checks
                // them so a painter arrives with refinishing/refacing/
                // painting already selected instead of a blank list.
                const presetKeys = categoryKeysForIndustries(
                  selectedIndustries,
                );
                const presetIds = categories
                  .filter((c) => presetKeys.includes(c.key))
                  .map((c) => c.id);
                setSelectedCategoryIds(presetIds);
                setShowAllServices(presetIds.length === 0);
                setStep("services");
              }}
              disabled={selectedIndustries.length === 0}
              className="w-full mt-6 bg-inverted text-inverted-foreground py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
            >
              Continue
            </button>

            <button
              type="button"
              onClick={() => setStep(alreadyOnFieldquo ? "business" : "account")}
              className="w-full mt-2 text-sm text-muted-foreground"
            >
              ← Back
            </button>
          </div>
        )}
        {step === "services" && (
          <div className="max-w-md mx-auto">
            <h2 className="font-semibold text-foreground mb-1">
              Which services do you offer?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {showAllServices
                ? "Browsing every quote type — turn on the ones you offer. You can change this anytime."
                : "We've preselected the usual quote types for your trade. Adjust as needed — you can change this anytime."}
            </p>
            {(() => {
              const presetKeys = categoryKeysForIndustries(selectedIndustries);
              const visible =
                showAllServices || presetKeys.length === 0
                  ? categories
                  : categories.filter((c) => presetKeys.includes(c.key));
              return (
                <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                  {visible.map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`text-left border rounded-lg px-4 py-3 text-sm ${
                        selectedCategoryIds.includes(cat.id)
                          ? "border-inverted bg-muted font-medium"
                          : "border-border bg-card"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                  {categories.length === 0 && (
                    <p className="col-span-2 text-sm text-muted-foreground">
                      Loading services...
                    </p>
                  )}
                </div>
              );
            })()}

            {categoryKeysForIndustries(selectedIndustries).length > 0 && (
              <button
                type="button"
                onClick={() => setShowAllServices((v) => !v)}
                className="w-full mt-3 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {showAllServices
                  ? "← Show just my trade's quote types"
                  : "+ Add a quote type from another trade"}
              </button>
            )}

            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting || selectedCategoryIds.length === 0}
              className="w-full mt-6 bg-inverted text-inverted-foreground py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
            >
              {submitting ? "Setting up..." : "Continue to Payment"}
            </button>

            <button
              type="button"
              onClick={() => setStep("industry")}
              className="w-full mt-2 text-sm text-muted-foreground"
            >
              ← Back
            </button>
          </div>
        )}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Log in
          </Link>
        </p>
      </div>
      </div>
    </>
  );
}
