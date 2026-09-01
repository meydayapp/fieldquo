// app/app/settings/company/page.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Trash2, Globe, Info } from "lucide-react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import MiniMap from "@/app/components/MiniMap";
import BusinessHoursModal from "@/app/components/settings/BusinessHoursModal";
import { SettingsDrillLink } from "@/app/components/settings/SettingsDrillDown";
import OpeningHoursEditor from "@/app/components/settings/OpeningHoursEditor";
import PaymentScheduleEditor from "./PaymentScheduleEditor";
import { INDUSTRIES } from "@/app/data/industries";
import {
  CURRENCIES,
  COUNTRIES,
  currencyForCountry,
  currencyMeta,
} from "@/lib/currency";
import { taxRegistrationFor } from "@/lib/compliance/taxRegistration";
import { isVatJurisdiction } from "@/lib/tax/jurisdictions";
import { reportResponseError } from "@/lib/clientErrors";
import {
  contractTemplateList,
  unfilledPlaceholders,
  templateApplied,
  toggleTemplate,
} from "@/lib/documents/contractTerms";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import {
  ReadOnlyNotice,
  ReadOnlyField,
} from "@/app/components/settings/PermissionNotice";
import { groupHours, hasBusinessHours } from "@/lib/company/businessHours";

function industryLabel(slug) {
  return INDUSTRIES.find((i) => i.slug === slug)?.label || slug;
}

// Index matches AvailabilitySchedule.dayOfWeek (0 = Sunday), the same
// convention BusinessHoursModal uses.
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// startTime/endTime are stored as plain "HH:MM" strings, so format them for
// display without dragging a date library in.
function formatTime(value) {
  const [h, m] = String(value ?? "").split(":");
  const hour = Number(h);
  if (!Number.isFinite(hour)) return value || "";
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m ?? "00"} ${suffix}`;
}

const DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];
const WEEK_START_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
];

// Falls back to a short curated list if the runtime doesn't support the
// Intl.supportedValuesOf API (older Node / some edge runtimes).
function getTimezones() {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    // fall through
  }
  return [
    "America/Toronto",
    "America/Vancouver",
    "America/Winnipeg",
    "America/Edmonton",
    "America/Halifax",
    "America/St_Johns",
    "UTC",
  ];
}

// Currently unused: both switches on this page (the public site and the
// directory listing) were removed because nothing read what they saved.
// Kept rather than deleted — the website builder brings the first one back,
// and re-deriving this is pointless churn.
// eslint-disable-next-line no-unused-vars
function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 disabled:opacity-50 ${
        checked ? "bg-inverted" : "bg-accent"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-card transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SectionCard({ title, description, children }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

// ── Read-only, not hidden ──────────────────────────────────────────────────
//
// Half of this page is genuinely useful to anyone in the company. When is the
// office open. What number does a client see on a quote. What timezone is the
// schedule in. What tax rates land on the documents they build. Hiding it would
// mean telling a painter to phone the owner to find out when the office shuts.
//
// The other half is the owner's: the tax registration number, the automatic-tax
// switch, the anonymised-benchmark opt-in, the company's own address as a
// billing fact. Those aren't rendered at all — read-only is a decision about
// what to SHOW, not a licence to show everything as long as it can't be typed
// into.
//
// What this deliberately is NOT is the same form with `disabled` on every
// input. That is what the owner found and correctly called the worst of both:
// twenty-odd checkboxes and selects that accept a click, change on screen, and
// then meet a Save button that 403s. A definition list can't lie about that.
//
// Written as a separate component rather than as `readOnly` threaded through
// forty inputs, because the two renderings differ in WHAT they show, not just
// in whether it's editable — and a shared component with a boolean would have
// hidden that.
function CompanyReadOnly({
  t,
  form,
  slug,
  industries,
  quoteTypes,
  taxRates,
  hours,
}) {
  const currency = currencyMeta(
    form.servesAbroad ? form.currency : currencyForCountry(form.country),
  );
  const country =
    COUNTRIES.find((c) => c.code === form.country)?.name || form.country;
  // Never DEFAULT_HOURS. A company that has said nothing about its hours must
  // read as "not set", not as an invented Mon–Fri — the same rule the editor
  // and the public site follow.
  const openingRuns = hasBusinessHours(form.businessHours)
    ? groupHours(form.businessHours, { weekStartsOn: form.weekStartsOn })
    : null;

  const address = [form.address, form.city, form.province, form.postalCode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.settings.company")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setCompany.subtitle")}
        </p>
      </div>

      <ReadOnlyNotice
        capability="user:manage"
        what={t("app.setCompany.readOnlyWhat")}
      />

      <SectionCard title={t("app.setCompany.detailsTitle")}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadOnlyField
            label={t("app.setCompany.companyName")}
            value={form.name}
          />
          <ReadOnlyField
            label={t("app.setCompany.phoneNumber")}
            value={form.phone}
          />
          <ReadOnlyField
            label={t("app.setCompany.emailAddress")}
            value={form.email}
          />
          <ReadOnlyField
            label={t("app.setCompany.websiteUrl")}
            value={form.website}
          />
          <div className="sm:col-span-2">
            <ReadOnlyField
              label={t("app.setCompany.streetAddress")}
              value={address}
            />
          </div>
        </dl>
        {slug && (
          <div className="flex items-start gap-2.5 bg-muted border border-border rounded-lg px-4 py-3">
            <Globe
              size={16}
              className="text-muted-foreground mt-0.5 shrink-0"
            />
            <div className="text-sm font-medium text-foreground">
              {slug}.fieldquo.com
            </div>
          </div>
        )}
      </SectionCard>

      {/* The one the owner named: opening hours as text, not as checkboxes. */}
      <SectionCard
        title={t("app.setCompany.openingHoursTitle")}
        description={t("app.setCompany.openingHoursDesc")}
      >
        {openingRuns ? (
          <dl className="border border-border rounded-xl divide-y divide-border">
            {openingRuns.map((run) => (
              <div
                key={run.days.join("-")}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <dt className="text-sm text-foreground">{run.label}</dt>
                <dd
                  className={`text-sm tabular-nums ${
                    run.closed
                      ? "text-muted-foreground"
                      : "text-foreground font-medium"
                  }`}
                >
                  {run.closed ? t("app.setCompany.closed") : run.hours}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("app.setCompany.openingHoursNotSet")}
          </p>
        )}
      </SectionCard>

      {/* Booking availability. Already a read-only table for everyone; what goes
          is the Edit button, which opened a modal that saves per-USER booking
          hours — a control that would have half-worked (it edits their own
          schedule) on a screen about the company. Availability is the honest
          place for that, and it stays in the sidebar. */}
      <SectionCard
        title={t("app.setCompany.bookingTitle")}
        description={t("app.setCompany.bookingDesc")}
      >
        {hours === null ? (
          <div className="h-40 bg-muted rounded-xl animate-pulse" />
        ) : (
          <dl className="border border-border rounded-xl divide-y divide-border">
            {WEEKDAYS.map((label, dayOfWeek) => {
              const day = hours.find((h) => h.dayOfWeek === dayOfWeek);
              return (
                <div
                  key={dayOfWeek}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <dt className="text-sm text-foreground">
                    {t(`app.setCompany.day${dayOfWeek}`, label)}
                  </dt>
                  <dd
                    className={`text-sm tabular-nums ${
                      day
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {day
                      ? `${formatTime(day.startTime)} – ${formatTime(day.endTime)}`
                      : t("app.setCompany.closed")}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </SectionCard>

      {/* Tax RATES only — the percentages that land on a quote they build.
          The registration number and the auto-apply switch are the owner's
          filing decisions and aren't shown. */}
      <SectionCard title={t("app.setCompany.taxTitle")}>
        {taxRates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("app.setCompany.noTaxRates")}
          </p>
        ) : (
          <div className="border border-border rounded-lg divide-y divide-border">
            {taxRates.map((r) => (
              <div key={r.id} className="px-3 py-2 text-sm text-foreground">
                {r.name}{" "}
                <span className="text-muted-foreground">
                  — {Number(r.rate)}%
                </span>
                {r.isDefault && (
                  <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {t("app.setCompany.default")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title={t("app.setCompany.regionalTitle")}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadOnlyField label={t("app.setCompany.country")} value={country} />
          <ReadOnlyField
            label={t("app.setCompany.billingCurrency")}
            value={`${currency.code} — ${currency.label} (${currency.symbol})`}
          />
          <ReadOnlyField
            label={t("app.setCompany.timeZone")}
            value={form.timezone}
          />
          <ReadOnlyField
            label={t("app.setCompany.dateFormat")}
            value={form.dateFormat}
          />
          <ReadOnlyField
            label={t("app.setCompany.weekStart")}
            value={t(
              `app.setCompany.day${form.weekStartsOn}`,
              WEEKDAYS[form.weekStartsOn],
            )}
          />
        </dl>
      </SectionCard>

      <SectionCard
        title={t("app.setCompany.industryTitle")}
        description={t("app.setCompany.industryDesc")}
      >
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {t("app.setCompany.industries")}
          </h3>
          {industries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("app.setCompany.noneSelected")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {industries.map((s) => (
                <span
                  key={s}
                  className="text-xs bg-muted text-foreground px-2.5 py-1 rounded-full"
                >
                  {industryLabel(s)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {t("app.setCompany.enabledQuoteTypes")}
          </h3>
          {quoteTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("app.setCompany.noQuoteTypes")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {quoteTypes.map((c) => (
                <span
                  key={c.id}
                  className="text-xs bg-muted text-foreground px-2.5 py-1 rounded-full"
                >
                  {c.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Scope of work and payment terms, for someone who cannot change them.
          These two print on EVERY quote this company sends, so an estimator
          without user:manage needs to be able to read what their own documents
          say — they are the one standing in front of the client being asked
          about it. Leaving them out of this view meant the only way to see the
          terms you were sending was to send one. */}
      <SectionCard
        title="Scope of work and terms"
        description="Copied onto every new quote, then editable on the quote itself."
      >
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Default scope of work
          </dt>
          {form.defaultProcessNotes ? (
            <>
              <dd className="mt-1 whitespace-pre-wrap rounded border border-border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed text-foreground">
                {form.defaultProcessNotes}
              </dd>
              {unfilledPlaceholders(form.defaultProcessNotes).length > 0 && (
                <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {/* Worth saying to someone who cannot fix it: they are the
                      person who will be asked about it on a doorstep. */}
                  {unfilledPlaceholders(form.defaultProcessNotes).length} thing
                  {unfilledPlaceholders(form.defaultProcessNotes).length === 1
                    ? ""
                    : "s"}{" "}
                  in here still to decide, and they print on the quote exactly
                  as they appear. Ask an owner or admin to finish them:{" "}
                  <span className="font-mono">
                    {unfilledPlaceholders(form.defaultProcessNotes)
                      .slice(0, 6)
                      .join("  ")}
                  </span>
                </p>
              )}
            </>
          ) : (
            <dd className="mt-0.5 text-sm italic text-muted-foreground">
              Not set — quotes carry no default scope of work
            </dd>
          )}
        </div>
        <dl>
          <ReadOnlyField
            label="Payment terms"
            value={form.paymentTerms}
            empty="Not set — the payment section does not appear on quotes"
          />
        </dl>
      </SectionCard>
    </div>
  );
}

export default function CompanySettingsPage() {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  const canEdit = access.canChange("user:manage");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [slug, setSlug] = useState("");
  const [form, setForm] = useState(null);

  const [industries, setIndustries] = useState([]);
  const [quoteTypes, setQuoteTypes] = useState([]);

  const [taxRates, setTaxRates] = useState([]);
  const [showNewRate, setShowNewRate] = useState(false);
  const [newRate, setNewRate] = useState({
    name: "",
    rate: "",
    isDefault: false,
  });

  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  // Saved weekly availability, shown read-only in the Business Hours card.
  // null = still loading, [] = loaded but nothing set yet.
  const [hours, setHours] = useState(null);

  // Whether a structured payment schedule is active — decides whether the
  // free-text "Payment terms" field below is editable or generated. null
  // while still loading, so the field doesn't flash editable-then-locked.
  const [scheduleActive, setScheduleActive] = useState(null);

  const timezones = getTimezones();

  useEffect(() => {
    fetch("/api/availability")
      .then((r) => r.json())
      .then((data) => setHours(Array.isArray(data) ? data : []))
      .catch(() => setHours([]));
  }, []);

  useEffect(() => {
    fetch("/api/settings/payment-schedule")
      .then((r) => r.json())
      .then((d) => setScheduleActive((d?.stages || []).length > 0))
      .catch(() => setScheduleActive(false));
  }, []);

  useEffect(() => {
    fetch("/api/settings/business-info")
      .then((r) => r.json())
      .then((data) => {
        setSlug(data?.slug || "");
        setForm({
          // Both of these print on every quote and neither had an editor
          // anywhere in /app, so both were null on every company.
          defaultProcessNotes: data?.defaultProcessNotes || "",
          paymentTerms: data?.paymentTerms || "",
          name: data?.name || "",
          phone: data?.phone || "",
          website: data?.website || "",
          email: data?.email || "",
          address: data?.address || "",
          city: data?.city || "",
          province: data?.province || "",
          postalCode: data?.postalCode || "",
          country: data?.country || "CA",
          latitude: data?.latitude ?? null,
          longitude: data?.longitude ?? null,
          discoverable: !!data?.discoverable,
          taxIdName: data?.taxIdName || "",
          taxIdNumber: data?.taxIdNumber || "",
          taxRegistrationDismissed: Boolean(data?.taxRegistrationDismissedAt),
          autoApplyLocalTax: data?.autoApplyLocalTax ?? true,
          // NOT `?? false`. Three states — see the schema comment on
          // Company.vatRegistered. Collapsing null into false here would make
          // the form claim the company had said it is under the registration
          // threshold, and the very next save would write that claim to the
          // database as though someone had answered.
          vatRegistered: data?.vatRegistered ?? null,
          timezone: data?.timezone || "America/Toronto",
          dateFormat: data?.dateFormat || "MM/DD/YYYY",
          weekStartsOn: data?.weekStartsOn ?? 0,
          currency: data?.currency || "CAD",
          servesAbroad: !!data?.servesAbroad,
          // Left as null when never set, NOT defaulted to a schedule. A
          // company that has said nothing about its hours must not have a
          // guess published on its website and in its search listing.
          businessHours: data?.businessHours ?? null,
          sitePublished: !!data?.sitePublished,
          // Opt-in to the anonymized industry benchmark. Written here and read
          // by the benchmark page, which was a dead CTA linking to a page that
          // never toggled it.
          shareAnonymizedPricing: !!data?.shareAnonymizedPricing,
        });
        setTaxRates(Array.isArray(data?.taxRates) ? data.taxRates : []);
        setIndustries(Array.isArray(data?.industries) ? data.industries : []);
      })
      .finally(() => setLoading(false));

    // Same source as the quote builder (quotes/new/page.js) and Products &
    // Services — whatever's enabled here is what shows up when creating a
    // quote, so this is a direct reflection of what was picked at signup
    // (plus anything changed since) rather than a separate copy of it.
    fetch("/api/settings/service-categories")
      .then((r) => r.json())
      .then((data) =>
        setQuoteTypes(Array.isArray(data) ? data.filter((c) => c.enabled) : []),
      );
  }, []);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // What the registration is CALLED where this company works, and why a client
  // wants to see it. Reads the country already in the form, so switching the
  // country field relabels the number field immediately — the label and the
  // jurisdiction can't drift apart. Null-safe: an unknown or not-yet-loaded
  // country gets the generic profile, which asserts nothing about anybody's law.
  const taxReg = taxRegistrationFor(form?.country);

  // Does this company operate under VAT? Same live read of the form as
  // `taxReg` above, so changing the country shows or hides the VAT question in
  // the same keystroke that relabels the tax-number field.
  const isVatCountry = isVatJurisdiction(form?.country);

  function handlePlaceSelected({
    address,
    city,
    province,
    postalCode,
    country,
    lat,
    lng,
  }) {
    setForm((prev) => ({
      ...prev,
      address,
      city: city || prev.city,
      province: province || prev.province,
      postalCode: postalCode || prev.postalCode,
      country: country || prev.country,
      latitude: lat,
      longitude: lng,
    }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/business-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        // Was silent: a failed request did nothing visible at all.
        await reportResponseError(res);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTaxRate(e) {
    e.preventDefault();
    if (!newRate.name || !newRate.rate) return;
    const res = await fetch("/api/settings/tax-rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newRate.name,
        rate: Number(newRate.rate),
        isDefault: newRate.isDefault,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setTaxRates((prev) => [
        ...prev.map((r) =>
          created.isDefault ? { ...r, isDefault: false } : r,
        ),
        created,
      ]);
      setNewRate({ name: "", rate: "", isDefault: false });
      setShowNewRate(false);
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  async function handleDeleteTaxRate(id) {
    const res = await fetch(`/api/settings/tax-rate/${id}`, {
      method: "DELETE",
    });
    if (res.ok) setTaxRates((prev) => prev.filter((r) => r.id !== id));
    else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  if (loading || !form) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-56 bg-accent rounded" />
        <div className="h-64 bg-accent rounded-xl" />
        <div className="h-48 bg-accent rounded-xl" />
      </div>
    );
  }

  // After the loading branch, so the read-only view always has real data to
  // render rather than a half-populated form. Both fetches above are GETs the
  // server already allows any member — this decides what to DO with them, not
  // whether they were permitted.
  if (!canEdit) {
    return (
      <CompanyReadOnly
        t={t}
        form={form}
        slug={slug}
        industries={industries}
        quoteTypes={quoteTypes}
        taxRates={taxRates}
        hours={hours}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.settings.company")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setCompany.subtitle")}
        </p>
      </div>

      {/* Scope of work and terms.
          Company.defaultProcessNotes is copied onto every new quote as
          Quote.processNotes and printed on the document — and until now
          nothing in /app could set it, so it was null everywhere. Same for
          paymentTerms, which PaymentTermsSection renders and which no screen
          could fill in either. Both are editable here.

          The templates are starters, not defaults: nothing is written to the
          company unless someone presses Save, and every figure a contractor
          has to own is left in [brackets] so an unedited template is visibly
          unfinished rather than quietly promising a warranty nobody agreed to. */}
      <SectionCard
        title="Scope of work and terms"
        description="Copied onto every new quote, then editable on the quote itself. A quote that says what will happen — how deep the excavation goes, who hauls the old surface away, what changes cost — is the one that reads like somebody who has done the job before."
      >
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Start from a trade template:
            </span>
            {contractTemplateList().map((tpl) => {
              // Each button is a TOGGLE, not an add. It used to append on every
              // press, so pressing Painting twice put the painting terms into
              // every quote twice with nothing on screen saying so — and with a
              // 14-row textarea, the second copy was below the fold.
              //
              // Still never overwrites: adding a second trade appends, because a
              // company that paints and roofs wants both. What changed is that
              // the button knows whether its own block is already in there, says
              // so, and can take back exactly what it put in.
              const applied = templateApplied(form.defaultProcessNotes, tpl.body);
              return (
                <button
                  key={tpl.key}
                  type="button"
                  aria-pressed={applied}
                  onClick={() =>
                    setForm({
                      ...form,
                      defaultProcessNotes: toggleTemplate(
                        form.defaultProcessNotes,
                        tpl.body,
                      ),
                    })
                  }
                  title={
                    applied
                      ? `Remove the ${tpl.label} terms`
                      : `Add the ${tpl.label} terms`
                  }
                  className={
                    applied
                      ? "rounded-full border border-foreground/50 bg-foreground/10 px-3 py-1 text-xs font-medium text-foreground"
                      : "rounded-full border border-border px-3 py-1 text-xs hover:border-foreground/40"
                  }
                >
                  {applied ? `✓ ${tpl.label}` : tpl.label}
                </button>
              );
            })}
          </div>
          <textarea
            rows={14}
            value={form.defaultProcessNotes || ""}
            onChange={(e) =>
              setForm({ ...form, defaultProcessNotes: e.target.value })
            }
            placeholder="What happens, in what order, and what is not included. Pick a trade template above to start from one."
            className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed"
          />
          {unfilledPlaceholders(form.defaultProcessNotes).length > 0 && (
            <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {unfilledPlaceholders(form.defaultProcessNotes).length} thing
              {unfilledPlaceholders(form.defaultProcessNotes).length === 1
                ? ""
                : "s"}{" "}
              still to decide, and they will print on the quote exactly as they
              appear here:{" "}
              <span className="font-mono">
                {unfilledPlaceholders(form.defaultProcessNotes)
                  .slice(0, 6)
                  .join("  ")}
              </span>
            </p>
          )}
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Payment terms</label>
          <input
            value={form.paymentTerms || ""}
            onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
            disabled={Boolean(scheduleActive)}
            placeholder="e.g. 50% deposit, balance on completion — or Net 30"
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {scheduleActive
              ? t(
                  "app.paymentSchedule.generatedNote",
                  "The payment terms below are generated from this schedule, so the document a client sees always matches what actually bills. Turn the schedule off to edit that text by hand again.",
                )
              : "Read straight onto the document. A schedule it can parse renders as cards; anything else prints as you wrote it. Left blank, the section does not appear at all rather than inventing a schedule for you."}
          </p>
        </div>
      </SectionCard>

      {/* The rule-based half: real invoices, raised automatically off the
          job's own dates — not just a sentence printed on a document. See
          app/api/settings/payment-schedule/route.js and
          lib/paymentSchedule/run.js. Saving here also rewrites the free-text
          field above, which is why that field locks once this is active —
          one schedule, not two that can disagree. */}
      <SectionCard
        title={t("app.paymentSchedule.title", "Payment schedule")}
        description={t(
          "app.paymentSchedule.desc",
          "Split what's owed across stages tied to the job itself — a deposit when the invoice goes out, the rest at job start, halfway, or completion. Off by default; turn it on by adding a stage below.",
        )}
      >
        <PaymentScheduleEditor
          canEdit={canEdit}
          onSaved={(d) => {
            setScheduleActive((d.stages || []).length > 0);
            setForm((f) => ({ ...f, paymentTerms: d.generatedText || f.paymentTerms }));
          }}
          onCleared={() => setScheduleActive(false)}
        />
      </SectionCard>

      {/* Industry & quote types — read-only reflection of what was picked at
          signup (industries) and what's currently enabled in Settings >
          Services (quote types). Edit quote types there; the picks feed
          directly into what's offered when building a new quote and which
          Products & Services can be linked to which quote type. */}
      <SectionCard
        title={t("app.setCompany.industryTitle")}
        description={t("app.setCompany.industryDesc")}
      >
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {t("app.setCompany.industries")}
          </h3>
          {industries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("app.setCompany.noneSelected")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {industries.map((slug) => (
                <span
                  key={slug}
                  className="text-xs bg-muted text-foreground px-2.5 py-1 rounded-full"
                >
                  {industryLabel(slug)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t("app.setCompany.enabledQuoteTypes")}
            </h3>
            {/* A drill-down, not a sibling link: Services is a sidebar
                destination of its own, so it only earns a "Back to Company
                Settings" bar on the visits that started here. */}
            <SettingsDrillLink
              href="/app/settings/services"
              fromLabel={t("app.settings.company")}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {t("app.setCompany.manage")}
            </SettingsDrillLink>
          </div>
          {quoteTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("app.setCompany.noQuoteTypes")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {quoteTypes.map((c) => (
                <span
                  key={c.id}
                  className="text-xs bg-muted text-foreground px-2.5 py-1 rounded-full"
                >
                  {c.label}
                  {!c.isSystem && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {t("app.setCompany.custom")}
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Company details */}
      <SectionCard title={t("app.setCompany.detailsTitle")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.setCompany.companyName")}
            </label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.setCompany.phoneNumber")}
            </label>
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.setCompany.emailAddress")}
            </label>
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.setCompany.websiteUrl")}
            </label>
            <input
              className={inputClass}
              placeholder="https://yourcompany.com"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
            />
          </div>
        </div>

        {/* Auto-hosted subdomain.
            The toggle is GONE, not disabled-looking-enabled. There is no
            /site route, no page renderer and no hostname handling in
            middleware — nothing is served at this address by anything.
            Leaving a switch here let a company turn it on, see "Currently
            published", and believe they had a website. The platform console
            then repeated the claim back to FieldQuo staff.
            Restore the toggle in the same commit that makes the address
            resolve, not before. */}
        <div className="flex items-start gap-2.5 bg-muted border border-border rounded-lg px-4 py-3">
          <Globe size={16} className="text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-medium text-foreground">
              {slug
                ? `${slug}.fieldquo.com`
                : t("app.setCompany.yourSubdomain")}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {t("app.setCompany.subdomainHint")}{" "}
              <Link href="/app/settings/website" className="underline">
                {t("app.settings.website")}
              </Link>
              .
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            {t("app.setCompany.streetAddress")}
          </label>
          <AddressAutocomplete
            value={form.address}
            onChange={(v) => set("address", v)}
            onPlaceSelected={handlePlaceSelected}
            placeholder={t("app.setCompany.addressPlaceholder")}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.field.city")}
            </label>
            <input
              className={inputClass}
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.field.province")}
            </label>
            <input
              className={inputClass}
              value={form.province}
              onChange={(e) => set("province", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.setCompany.postalCode")}
            </label>
            <input
              className={inputClass}
              value={form.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.setCompany.country")}
            </label>
            <input
              className={inputClass}
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </div>
        </div>

        <MiniMap lat={form.latitude} lng={form.longitude} />
      </SectionCard>

      {/* Opening hours — the PUBLIC ones.

          Distinct from the card below, which edits AvailabilitySchedule (a
          per-user booking calendar). Both were previously titled "Business
          Hours", which is how an estimator's day off ends up published as a
          company closure. */}
      <SectionCard
        title={t("app.setCompany.openingHoursTitle")}
        description={t("app.setCompany.openingHoursDesc")}
      >
        <OpeningHoursEditor
          value={form.businessHours}
          weekStartsOn={form.weekStartsOn}
          onSaved={(saved) => set("businessHours", saved)}
        />
      </SectionCard>

      {/* Booking availability — per-user, drives the booking calendar. */}
      <SectionCard
        title={t("app.setCompany.bookingTitle")}
        description={t("app.setCompany.bookingDesc")}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {t("app.setCompany.bookingManage")}
          </p>
          <button
            onClick={() => setHoursModalOpen(true)}
            className="border border-border text-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-muted shrink-0"
          >
            {t("app.action.edit")}
          </button>
        </div>

        {hours === null ? (
          <div className="mt-4 h-40 bg-muted rounded-xl animate-pulse" />
        ) : (
          <dl className="mt-4 border border-border rounded-xl divide-y divide-border">
            {WEEKDAYS.map((label, dayOfWeek) => {
              const day = hours.find((h) => h.dayOfWeek === dayOfWeek);
              return (
                <div
                  key={dayOfWeek}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <dt className="text-sm text-foreground">
                    {t(`app.setCompany.day${dayOfWeek}`, label)}
                  </dt>
                  <dd
                    className={`text-sm tabular-nums ${
                      day
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {day
                      ? `${formatTime(day.startTime)} – ${formatTime(day.endTime)}`
                      : t("app.setCompany.closed")}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}

        {hours?.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("app.setCompany.noHoursSet")}
          </p>
        )}
      </SectionCard>

      {/* Discoverability.
          Removed rather than disabled. `discoverable` was written by this
          toggle and read by nothing anywhere in the codebase — there is no
          directory, no feed, no listing. The copy went further than most dead
          controls by promising the one thing a contractor most wants: that
          turning it on helps clients find them. Nothing happened either way.
          Bring it back with the listing it refers to. */}

      {/* Tax settings */}
      <SectionCard title={t("app.setCompany.taxTitle")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.setCompany.taxIdName")}
            </label>
            <input
              className={inputClass}
              placeholder={t("app.setCompany.taxIdNamePlaceholder")}
              value={form.taxIdName}
              onChange={(e) => set("taxIdName", e.target.value)}
            />
          </div>
          <div>
            {/* Labelled the way the contractor's own country labels it —
                "GST/HST number", "VAT number", "ABN" — rather than "Tax ID
                number", which is what a database calls it. No format
                validation, deliberately: see lib/compliance/taxRegistration.js
                for why rejecting a valid number is the expensive mistake. */}
            <label className="text-sm font-medium text-foreground block mb-1">
              {t(taxReg.nameKey)}
            </label>
            <input
              className={inputClass}
              value={form.taxIdNumber}
              onChange={(e) => set("taxIdNumber", e.target.value)}
            />
          </div>
        </div>
        <div className="-mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">{t(taxReg.whyKey)}</p>
          <p className="text-xs text-muted-foreground">
            {t("app.setCompany.taxIdHint")}{" "}
            {t("app.setCompany.taxRegDisclaimer")}
          </p>

          {/* ── "I don't have one" ────────────────────────────────────────
              A fact about the business, recorded next to the field it is
              about — not a dismiss button on the onboarding card. Ticking it
              clears the onboarding step; untick it the day they register and
              the step comes back.

              Offered in every country, including the ones where the number is
              required, because "required" in every one of those rules means
              "required IF registered". A Canadian sole trader under the $30k
              threshold has no GST number to give, and hiding this from them
              would leave exactly the smallest businesses carrying an item
              they can never tick.

              Hidden once a number is entered: there is nothing to declare an
              absence of, and a ticked box beside a filled field is a
              contradiction the screen shouldn't be able to show. */}
          {!String(form.taxIdNumber || "").trim() && (
            <label className="flex items-start gap-2.5 text-xs text-muted-foreground pt-1">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={Boolean(form.taxRegistrationDismissed)}
                onChange={(e) =>
                  set("taxRegistrationDismissed", e.target.checked)
                }
              />
              <span>{t("app.setCompany.taxRegNotRegistered")}</span>
            </label>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t("app.setCompany.taxRates")}
            </h3>
            <button
              onClick={() => setShowNewRate((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground"
            >
              <Plus size={14} /> {t("app.setCompany.createTaxRate")}
            </button>
          </div>

          {taxRates.length === 0 && !showNewRate && (
            <p className="text-sm text-muted-foreground">
              {t("app.setCompany.noTaxRates")}
            </p>
          )}

          {taxRates.length > 0 && (
            <div className="border border-border rounded-lg divide-y divide-border mb-2">
              {taxRates.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <div className="text-sm text-foreground">
                    {r.name}{" "}
                    <span className="text-muted-foreground">
                      — {Number(r.rate)}%
                    </span>
                    {r.isDefault && (
                      <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        {t("app.setCompany.default")}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteTaxRate(r.id)}
                    className="text-muted-foreground hover:text-red-500"
                    aria-label={t("app.setCompany.deleteRate", {
                      name: r.name,
                    })}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showNewRate && (
            <form
              onSubmit={handleCreateTaxRate}
              className="flex flex-wrap items-center gap-2 bg-muted border border-border rounded-lg p-3"
            >
              <input
                required
                placeholder={t("app.setCompany.rateNamePlaceholder")}
                value={newRate.name}
                onChange={(e) =>
                  setNewRate({ ...newRate, name: e.target.value })
                }
                className="border border-border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[120px]"
              />
              <input
                required
                type="number"
                step="0.001"
                placeholder={t("app.setCompany.ratePlaceholder")}
                value={newRate.rate}
                onChange={(e) =>
                  setNewRate({ ...newRate, rate: e.target.value })
                }
                className="border border-border rounded-lg px-3 py-1.5 text-sm w-24"
              />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={newRate.isDefault}
                  onChange={(e) =>
                    setNewRate({ ...newRate, isDefault: e.target.checked })
                  }
                />
                {t("app.setCompany.default")}
              </label>
              <button
                type="submit"
                className="bg-inverted text-inverted-foreground px-3 py-1.5 rounded-lg text-sm font-semibold"
              >
                {t("app.action.add")}
              </button>
            </form>
          )}
        </div>

        {/* ── VAT registration ──────────────────────────────────────────
            Only for companies in a VAT country: a Canadian or US contractor
            has no use for the question and would just be another box to
            wonder about. It gates the European rates in
            lib/tax/jurisdictions.js — see the schema comment for why the
            unanswered state has to stay reachable. */}
        {isVatCountry && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {t("app.setCompany.vatRegisteredTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("app.setCompany.vatRegisteredHint")}
            </p>
            {[
              [true, "app.setCompany.vatRegisteredYes"],
              [false, "app.setCompany.vatRegisteredNo"],
              [null, "app.setCompany.vatRegisteredUnset"],
            ].map(([value, key]) => (
              <label
                key={String(value)}
                className="flex items-start gap-2.5 text-sm text-foreground"
              >
                <input
                  type="radio"
                  className="mt-0.5"
                  name="vat-registered"
                  checked={form.vatRegistered === value}
                  onChange={() => set("vatRegistered", value)}
                />
                <span>{t(key)}</span>
              </label>
            ))}
          </div>
        )}

        <label className="flex items-start gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.autoApplyLocalTax}
            onChange={(e) => set("autoApplyLocalTax", e.target.checked)}
          />
          <span>
            {t("app.setCompany.autoApplyTax")}
            {/* Honoured by the quote builder via lib/tax/resolveTaxRate.js.
                It only ever selects between the rates listed above — nothing
                is invented, and an unmatched province falls back to your
                default. */}
            <span className="block text-xs text-muted-foreground mt-1">
              {t("app.setCompany.autoApplyTaxHint")}
            </span>
          </span>
        </label>
      </SectionCard>

      <SectionCard
        title={t("app.setCompany.benchmarkTitle", "Industry benchmark")}
        description={t(
          "app.setCompany.benchmarkDesc",
          "Compare your pricing and conversion against similar trades — anonymously.",
        )}
      >
        <label className="flex items-start gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.shareAnonymizedPricing}
            onChange={(e) => set("shareAnonymizedPricing", e.target.checked)}
          />
          <span>
            {t(
              "app.setCompany.benchmarkLabel",
              "Share my anonymized figures to unlock benchmarks",
            )}
            <span className="block text-xs text-muted-foreground mt-1">
              {t(
                "app.setCompany.benchmarkHint",
                "Your numbers are pooled with other companies and never shown individually. You can turn this off any time.",
              )}
            </span>
          </span>
        </label>
      </SectionCard>

      {/* Regional settings */}
      <SectionCard title={t("app.setCompany.regionalTitle")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.setCompany.country")}
            </label>
            {/* ── A list, not a text box ──────────────────────────────────
                This was a free-text input, and the billing currency below is
                derived from it via currencyForCountry() — which looks the value
                up in COUNTRIES by ISO alpha-2 code. So "US" worked and "USA"
                silently fell through to the CAD default: the owner typed his
                country, watched the currency stay Canadian, and had no way to
                see why. An unmatched value didn't warn, it just quietly meant
                Canada.

                A select can only hold codes the map actually knows, so the
                derived currency below is now always a real answer. Anything
                already stored that isn't in the list (typed before this change,
                or a country Google returned that we don't bill in) is kept as an
                extra option rather than being silently reassigned on first
                save — that would rewrite a company's country because they
                opened a settings page. */}
            <select
              className={inputClass}
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
            >
              {!COUNTRIES.some((c) => c.code === form.country) &&
                form.country && (
                  <option value={form.country}>{form.country}</option>
                )}
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Info size={11} /> {t("app.setCompany.countryAuto")}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.setCompany.billingCurrency")}
            </label>
            {form.servesAbroad ? (
              // Bills abroad → let them choose the currency.
              <select
                className={inputClass}
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label} ({c.symbol})
                  </option>
                ))}
              </select>
            ) : (
              // Only serves its home country → currency is derived from country,
              // shown read-only. A Canadian shop is never asked to pick between
              // CAD/USD/EUR. Reflects the selected country live; the server
              // enforces the same on save.
              <div
                className={`${inputClass} flex items-center text-muted-foreground`}
              >
                {(() => {
                  const m = currencyMeta(currencyForCountry(form.country));
                  return `${m.code} — ${m.label} (${m.symbol})`;
                })()}
              </div>
            )}
            <label className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={!!form.servesAbroad}
                onChange={(e) => set("servesAbroad", e.target.checked)}
              />
              {t(
                "app.setCompany.servesAbroad",
                "I serve clients outside my country (bill in other currencies)",
              )}
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.setCompany.timeZone")}
            </label>
            <select
              className={inputClass}
              value={form.timezone}
              onChange={(e) => set("timezone", e.target.value)}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.setCompany.dateFormat")}
            </label>
            <select
              className={inputClass}
              value={form.dateFormat}
              onChange={(e) => set("dateFormat", e.target.value)}
            >
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            {/* Applies to YOUR screens only. Client-facing quotes, invoices
                and emails format dates in the client's own language — see
                lib/format/companyDate.js. */}
            <p className="text-xs text-muted-foreground mt-1">
              {t("app.setCompany.dateFormatHint")}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.setCompany.weekStart")}
            </label>
            <select
              className={inputClass}
              value={form.weekStartsOn}
              onChange={(e) => set("weekStartsOn", Number(e.target.value))}
            >
              {WEEK_START_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(`app.setCompany.day${o.value}`, o.label)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      {/* Save bar — deliberately not `fixed`, since its horizontal offset would
          need to account for both the AdminSidebar and SettingsSidebar widths,
          which vary with the AdminSidebar's collapsed state. Keeping it in
          normal flow avoids that fragility. */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        {saved && (
          <span className="text-sm text-green-600 dark:text-green-400">
            {t("app.action.saved")}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-inverted text-inverted-foreground px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {saving ? t("app.action.saving") : t("app.setCompany.updateSettings")}
        </button>
      </div>

      <BusinessHoursModal
        isOpen={hoursModalOpen}
        onClose={() => setHoursModalOpen(false)}
        // Without this the card kept showing stale hours after a save — the
        // modal fetched fresh data on open, so the values only *looked*
        // correct while editing.
        onSaved={(saved) => setHours(Array.isArray(saved) ? saved : [])}
      />
    </div>
  );
}
