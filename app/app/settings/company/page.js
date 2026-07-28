// app/app/settings/company/page.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Trash2, Globe, Info } from "lucide-react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import MiniMap from "@/app/components/MiniMap";
import BusinessHoursModal from "@/app/components/settings/BusinessHoursModal";
import { INDUSTRIES } from "@/app/data/industries";
import { reportResponseError } from "@/lib/clientErrors";

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

export default function CompanySettingsPage() {
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

  const timezones = getTimezones();

  useEffect(() => {
    fetch("/api/availability")
      .then((r) => r.json())
      .then((data) => setHours(Array.isArray(data) ? data : []))
      .catch(() => setHours([]));
  }, []);

  useEffect(() => {
    fetch("/api/settings/business-info")
      .then((r) => r.json())
      .then((data) => {
        setSlug(data?.slug || "");
        setForm({
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
          autoApplyLocalTax: data?.autoApplyLocalTax ?? true,
          timezone: data?.timezone || "America/Toronto",
          dateFormat: data?.dateFormat || "MM/DD/YYYY",
          weekStartsOn: data?.weekStartsOn ?? 0,
          sitePublished: !!data?.sitePublished,
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
    if (res.ok) setTaxRates((prev) => prev.filter((r) => r.id !== id)); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  if (loading || !form) {
    return (
      <div className="p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-56 bg-accent rounded" />
        <div className="h-64 bg-accent rounded-xl" />
        <div className="h-48 bg-accent rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Company Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your business details, hours, taxes, and regional preferences.
        </p>
      </div>

      {/* Industry & quote types — read-only reflection of what was picked at
          signup (industries) and what's currently enabled in Settings >
          Services (quote types). Edit quote types there; the picks feed
          directly into what's offered when building a new quote and which
          Products & Services can be linked to which quote type. */}
      <SectionCard
        title="Industry & Quote Types"
        description="What you told us your business does, and which quote types that unlocked."
      >
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Industries
          </h3>
          {industries.length === 0 ? (
            <p className="text-sm text-muted-foreground">None selected.</p>
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
              Enabled quote types
            </h3>
            <Link
              href="/app/settings/services"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Manage
            </Link>
          </div>
          {quoteTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None turned on yet — go to Settings → Services.
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
                    <span className="text-amber-600 dark:text-amber-400"> · custom</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Company details */}
      <SectionCard title="Company Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Company name
            </label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Phone number
            </label>
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Email address
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
              Website URL
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
              {slug ? `${slug}.fieldquo.com` : "Your subdomain"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Reserved for you. Website hosting isn&apos;t available yet —
              we&apos;ll let you know when this address goes live.
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            Street address
          </label>
          <AddressAutocomplete
            value={form.address}
            onChange={(v) => set("address", v)}
            onPlaceSelected={handlePlaceSelected}
            placeholder="Start typing your street address..."
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              City
            </label>
            <input
              className={inputClass}
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Province
            </label>
            <input
              className={inputClass}
              value={form.province}
              onChange={(e) => set("province", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Postal code
            </label>
            <input
              className={inputClass}
              value={form.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Country
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

      {/* Business hours */}
      <SectionCard
        title="Business Hours"
        description="Sets your default availability for online booking, team members, and request forms."
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Manage your weekly open/closed hours for each day.
          </p>
          <button
            onClick={() => setHoursModalOpen(true)}
            className="border border-border text-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-muted shrink-0"
          >
            Edit
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
                  <dt className="text-sm text-foreground">{label}</dt>
                  <dd
                    className={`text-sm tabular-nums ${
                      day ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {day
                      ? `${formatTime(day.startTime)} – ${formatTime(day.endTime)}`
                      : "Closed"}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}

        {hours?.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            No hours set yet — every day is treated as closed for online
            booking. Choose Edit to set them.
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
      <SectionCard title="Tax Settings">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Tax ID name
            </label>
            <input
              className={inputClass}
              placeholder="e.g. GST"
              value={form.taxIdName}
              onChange={(e) => set("taxIdName", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Tax ID number
            </label>
            <input
              className={inputClass}
              value={form.taxIdNumber}
              onChange={(e) => set("taxIdNumber", e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Tax ID name and number will appear on invoices.
        </p>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Tax Rates</h3>
            <button
              onClick={() => setShowNewRate((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground"
            >
              <Plus size={14} /> Create tax rate
            </button>
          </div>

          {taxRates.length === 0 && !showNewRate && (
            <p className="text-sm text-muted-foreground">
              No tax rates yet — create one or more to apply them to quotes and
              invoices.
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
                    <span className="text-muted-foreground">— {Number(r.rate)}%</span>
                    {r.isDefault && (
                      <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteTaxRate(r.id)}
                    className="text-muted-foreground hover:text-red-500"
                    aria-label={`Delete ${r.name}`}
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
                placeholder="Name (e.g. GST)"
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
                placeholder="Rate %"
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
                Default
              </label>
              <button
                type="submit"
                className="bg-inverted text-inverted-foreground px-3 py-1.5 rounded-lg text-sm font-semibold"
              >
                Add
              </button>
            </form>
          )}
        </div>

        <label className="flex items-start gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.autoApplyLocalTax}
            onChange={(e) => set("autoApplyLocalTax", e.target.checked)}
          />
          <span>
            Automatically apply the local tax rate of the client, instead of
            manually picking one of the rates above on every quote/invoice.
            {/* Honoured by the quote builder via lib/tax/resolveTaxRate.js.
                It only ever selects between the rates listed above — nothing
                is invented, and an unmatched province falls back to your
                default. */}
            <span className="block text-xs text-muted-foreground mt-1">
              Matches the client&apos;s province against the rates above. If
              there&apos;s no match, your default rate is used and the quote
              says so.
            </span>
          </span>
        </label>
      </SectionCard>

      {/* Regional settings */}
      <SectionCard title="Regional Settings">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Country
            </label>
            <input
              className={inputClass}
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Info size={11} /> Filled in automatically from your address
              above.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Time zone
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
              Date format
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
              Used on your screens. Client documents follow the client&apos;s
              language.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              First day of the week
            </label>
            <select
              className={inputClass}
              value={form.weekStartsOn}
              onChange={(e) => set("weekStartsOn", Number(e.target.value))}
            >
              {WEEK_START_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
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
        {saved && <span className="text-sm text-green-600 dark:text-green-400">Saved</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-inverted text-inverted-foreground px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Saving..." : "Update Settings"}
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
