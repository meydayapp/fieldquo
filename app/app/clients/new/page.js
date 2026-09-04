// app/app/clients/new/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import LanguagePicker from "@/app/components/LanguagePicker";
import CountrySelect from "@/app/components/CountrySelect";
import { formatPhoneInput } from "@/lib/validation";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

export default function NewClientPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    type: "individual",
    name: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    // Empty = not set, which is a real answer the tax lookup understands. The
    // company's own country is deliberately NOT used as a seed — see
    // CountrySelect.
    country: "",
    notes: "",
    // Null = follow the company default. See LanguagePicker for why this
    // isn't pre-filled with the company's current language.
    language: null,
  });

  // The company's own default, shown in the picker's inherit option so the
  // operator can see what "default" actually means without leaving the page.
  const [companyLanguage, setCompanyLanguage] = useState("en");

  useEffect(() => {
    fetch("/api/settings/business-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.defaultLanguage && setCompanyLanguage(d.defaultLanguage))
      .catch(() => {});
  }, []);

  const isCompany = form.type === "company";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError(t("app.clientNew.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      // fetchJson, not fetch + res.json(): the POST route answers a P2022 with
      // a sentence naming the missing column, and a 500 anywhere else answers
      // with Next's HTML error page. Parsing that page threw the browser's own
      // JSON complaint on screen — in Safari, "The string did not match the
      // expected pattern", on a form with no regex in it.
      const data = await fetchJson("/api/clients", { method: "POST", body: form });
      // The clients list links each row to /app/clients/[id]; go straight there.
      router.push(`/app/clients/${data.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/app/clients"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft size={14} /> {t("app.clientNew.back")}
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{t("app.clients.new")}</h1>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-xl p-5 space-y-4"
      >
        {/* Client type — drives whether this is a homeowner (jobs at their own
            address) or a company/contractor (jobs at varying sites, set per
            job). */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-2">
            {t("app.clientNew.type")}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => set("type", "individual")}
              className={`text-left border rounded-lg px-4 py-3 ${
                !isCompany
                  ? "border-inverted bg-muted"
                  : "border-border"
              }`}
            >
              <div className="text-sm font-medium text-foreground">
                {t("app.clientNew.homeowner")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t("app.clientNew.homeownerHint")}
              </div>
            </button>
            <button
              type="button"
              onClick={() => set("type", "company")}
              className={`text-left border rounded-lg px-4 py-3 ${
                isCompany ? "border-inverted bg-muted" : "border-border"
              }`}
            >
              <div className="text-sm font-medium text-foreground">
                {t("app.clientNew.company")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t("app.clientNew.companyHint")}
              </div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {isCompany ? t("app.clientNew.companyName") : t("app.field.name")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              required
              className={inputClass}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          {isCompany && (
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                {t("app.clientNew.contactPerson")}
              </label>
              <input
                className={inputClass}
                placeholder={t("app.clientNew.contactPlaceholder")}
                value={form.contactName}
                onChange={(e) => set("contactName", e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.field.phone")}
            </label>
            <input
              className={inputClass}
              placeholder="555-123-4567"
              value={form.phone}
              onChange={(e) => set("phone", formatPhoneInput(e.target.value))}
            />
          </div>
          <div className={isCompany ? "" : "sm:col-span-2"}>
            <label className="text-sm font-medium text-foreground block mb-1">
              {t("app.field.email")}
            </label>
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            {isCompany ? t("app.clientNew.businessAddress") : t("app.field.address")}
          </label>
          <AddressAutocomplete
            value={form.address}
            onChange={(v) => set("address", v)}
            onPlaceSelected={({ address, city, province, postalCode, country }) =>
              setForm((prev) => ({
                ...prev,
                address,
                city: city || prev.city,
                province: province || prev.province,
                postalCode: postalCode || prev.postalCode,
                // Google returns short_name here, which is already the
                // ISO alpha-2 the tax lookup wants. It always did; there was
                // simply nowhere to put it until Client.country existed.
                country: country || prev.country,
              }))
            }
            placeholder={t("app.clientNew.addressPlaceholder")}
            className={inputClass}
          />
          {isCompany && (
            <p className="text-xs text-muted-foreground mt-1">
              {t("app.clientNew.businessAddressHint")}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        {/* The province above is only half an address as far as tax goes:
            "ON" could be Ontario or a typo for anywhere. This is what lets
            lib/tax/jurisdictions.js return a rate instead of a shrug. */}
        <CountrySelect
          id="client-country"
          value={form.country}
          onChange={(v) => set("country", v)}
          className={inputClass}
        />

        <LanguagePicker
          value={form.language}
          onChange={(v) => set("language", v)}
          companyDefault={companyLanguage}
        />

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            {t("app.field.notes")}
          </label>
          <textarea
            rows={3}
            className={inputClass}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/app/clients"
            className="text-sm font-medium text-muted-foreground px-4 py-2.5"
          >
            {t("app.action.cancel")}
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-inverted text-inverted-foreground px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
          >
            {saving ? t("app.clientNew.creating") : t("app.clientNew.create")}
          </button>
        </div>
      </form>
    </div>
  );
}
