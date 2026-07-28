// app/signup/page.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { calculatePricing } from "@/lib/pricing";
import { INDUSTRIES } from "@/app/data/industries";
import { categoryKeysForIndustries } from "@/app/data/industryCategories";
import PricingCard from "@/app/components/marketing/PricingCard";

// add to imports at top of app/signup/page.js
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { formatPhoneInput, isValidPhone, isValidEmail } from "@/lib/validation";

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
  const [referrer, setReferrer] = useState(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (!code) return;
    setReferralCode(code);

    // Confirm the code is real before promising anything. A typo'd link
    // should not produce a banner claiming three free months that the API
    // then silently declines to grant.
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
        trialTotal: 1,
        monthlyTotal: Number(selectedPlan?.priceMonthly || 0),
        contactSalesRequired: false,
      };

  const selectedPlanName = isCustom
    ? `Custom — ${customCount} employees`
    : selectedPlan?.name || "Selected plan";

  const hasSelection = isCustom || Boolean(selectedPlanId);

  useEffect(() => {
    fetch("/api/marketing/plans")
      .then((r) => r.json())
      .then((data) => setPlans(Array.isArray(data) ? data : []))
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
    setStep("account");
  }

  // replace handleAccountSubmit entirely
  async function handleAccountSubmit(e) {
    e.preventDefault();
    setError("");

    const errors = {};
    if (!form.firstName.trim()) errors.firstName = "First name is required";
    if (!form.lastName.trim()) errors.lastName = "Last name is required";
    if (!form.companyName.trim())
      errors.companyName = "Company name is required";
    if (!isValidEmail(form.email)) errors.email = "Enter a valid email address";
    if (form.phone && !isValidPhone(form.phone))
      errors.phone = "Format: 555-123-4567";
    if (!form.password || form.password.length < 8)
      errors.password = "At least 8 characters";
    if (!form.address.trim())
      errors.address = "Start typing and select your address";

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
          industries: selectedIndustries,
          planId: isCustom ? null : selectedPlanId,
          employeeCount,
          serviceCategoryIds: selectedCategoryIds,
          referralCode: referralCode || undefined,
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight text-gray-900"
          >
            FieldQuo
          </Link>
          <p className="text-sm text-gray-500 mt-2">
            Start your free trial — $1 for the first month
          </p>
        </div>

        {/* Only shown once the code has been confirmed real. Carried through
            every step so someone who reaches the payment screen still sees
            what they were promised on the landing page. */}
        {referrer && (
          <div className="max-w-md mx-auto mb-6 bg-[#faf6ee] border border-[#bd9d60]/40 rounded-xl px-4 py-3 text-center">
            <p className="text-sm text-[#2d2520]">
              <strong>{referrer.referrerName}</strong> referred you —{" "}
              <strong>{referrer.months} months free</strong> added to your trial.
            </p>
          </div>
        )}
        {error && (
          <div className="max-w-md mx-auto mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}
        {step === "plan" && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Choose your plan
              </h1>
              <p className="text-sm text-gray-500 mt-2">
                Select the number of employees you need — you'll create your
                account next.
              </p>
            </div>

            {plansLoading ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
                Loading plans...
              </div>
            ) : plans.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
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
                  className={`text-left border rounded-2xl p-6 flex flex-col relative bg-white transition-all duration-150 ease-out hover:scale-[1.03] hover:shadow-lg ${
                    isCustom
                      ? "border-gray-900 ring-2 ring-gray-900 scale-[1.02] bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={selectCustom}
                    className="text-left"
                  >
                    <h3 className="text-lg font-semibold text-gray-900">
                      Custom
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Tell us how many employees you need, and we'll calculate
                      your rate.
                    </p>
                  </button>

                  {isCustom && (
                    <div className="mt-4">
                      <label className="text-sm font-medium text-gray-700">
                        Number of employees
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={customCount}
                        onChange={(e) =>
                          setCustomCount(Number(e.target.value || 1))
                        }
                        className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                      {pricing.contactSalesRequired ? (
                        <p className="mt-4 text-sm text-gray-700">
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
                        <p className="mt-4 text-sm text-gray-700">
                          ${pricing.trialTotal} first month, then{" "}
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

            <div className="max-w-md mx-auto mt-8 bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-sm text-gray-600">
                Selected plan:{" "}
                <span className="font-semibold text-gray-900">
                  {hasSelection ? selectedPlanName : "None yet"}
                </span>
              </div>

              {hasSelection && !pricing.contactSalesRequired && (
                <div className="text-sm text-gray-600 mt-1">
                  ${pricing.trialTotal} first month, then{" "}
                  <span className="font-semibold text-gray-900">
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
                className="w-full mt-4 bg-gray-900 text-white py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        )}
        {step === "account" && (
          <form
            onSubmit={handleAccountSubmit}
            className="max-w-lg mx-auto bg-white border border-gray-200 rounded-xl p-6 space-y-4"
          >
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700">
              <strong>{selectedPlanName}</strong>
              <br />${pricing.trialTotal} first month, then $
              {pricing.monthlyTotal}/mo
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  First name
                </label>
                <input
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                    fieldErrors.firstName ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {fieldErrors.firstName && (
                  <p className="text-xs text-red-600 mt-1">
                    {fieldErrors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Last name
                </label>
                <input
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                  className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                    fieldErrors.lastName ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {fieldErrors.lastName && (
                  <p className="text-xs text-red-600 mt-1">
                    {fieldErrors.lastName}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Company name
              </label>
              <input
                value={form.companyName}
                onChange={(e) =>
                  setForm({ ...form, companyName: e.target.value })
                }
                className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                  fieldErrors.companyName ? "border-red-400" : "border-gray-300"
                }`}
              />
              {fieldErrors.companyName && (
                <p className="text-xs text-red-600 mt-1">
                  {fieldErrors.companyName}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@company.com"
                  className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                    fieldErrors.email ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-600 mt-1">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      phone: formatPhoneInput(e.target.value),
                    })
                  }
                  placeholder="555-123-4567"
                  className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                    fieldErrors.phone ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-red-600 mt-1">
                    {fieldErrors.phone}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Address
              </label>
              <AddressAutocomplete
                value={form.address}
                onChange={(val) => setForm((f) => ({ ...f, address: val }))}
                onPlaceSelected={({ address, city, province }) =>
                  setForm((f) => ({ ...f, address, city, province }))
                }
                placeholder="Start typing your address..."
                className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                  fieldErrors.address ? "border-red-400" : "border-gray-300"
                }`}
              />
              {fieldErrors.address && (
                <p className="text-xs text-red-600 mt-1">
                  {fieldErrors.address}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  City
                </label>
                <input
                  value={form.city}
                  readOnly
                  placeholder="Auto-filled from address"
                  className="w-full mt-1 border border-gray-200 bg-gray-50 rounded-lg px-4 py-2.5 text-sm text-gray-600"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Province
                </label>
                <input
                  value={form.province}
                  readOnly
                  placeholder="Auto-filled from address"
                  className="w-full mt-1 border border-gray-200 bg-gray-50 rounded-lg px-4 py-2.5 text-sm text-gray-600"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                  fieldErrors.password ? "border-red-400" : "border-gray-300"
                }`}
              />
              {fieldErrors.password && (
                <p className="text-xs text-red-600 mt-1">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? "Creating your account..." : "Continue"}
            </button>

            <button
              type="button"
              onClick={() => setStep("plan")}
              className="w-full text-sm text-gray-500"
            >
              ← Back to plans
            </button>
          </form>
        )}
        // replace the industry step's button grid and Continue condition
        {step === "industry" && (
          <div className="max-w-md mx-auto">
            <h2 className="font-semibold text-gray-900 mb-1">
              What trades does your company work in?
            </h2>
            <p className="text-sm text-gray-500 mb-4">
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
                      ? "border-gray-900 bg-gray-50 font-medium"
                      : "border-gray-200 bg-white"
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
              className="w-full mt-6 bg-gray-900 text-white py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
            >
              Continue
            </button>

            <button
              type="button"
              onClick={() => setStep("account")}
              className="w-full mt-2 text-sm text-gray-500"
            >
              ← Back
            </button>
          </div>
        )}
        {step === "services" && (
          <div className="max-w-md mx-auto">
            <h2 className="font-semibold text-gray-900 mb-1">
              Which services do you offer?
            </h2>
            <p className="text-sm text-gray-500 mb-4">
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
                          ? "border-gray-900 bg-gray-50 font-medium"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                  {categories.length === 0 && (
                    <p className="col-span-2 text-sm text-gray-500">
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
                className="w-full mt-3 text-sm font-medium text-gray-600 hover:text-gray-900"
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
              className="w-full mt-6 bg-gray-900 text-white py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
            >
              {submitting ? "Setting up..." : "Continue to Payment"}
            </button>

            <button
              type="button"
              onClick={() => setStep("industry")}
              className="w-full mt-2 text-sm text-gray-500"
            >
              ← Back
            </button>
          </div>
        )}
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-gray-900 underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
