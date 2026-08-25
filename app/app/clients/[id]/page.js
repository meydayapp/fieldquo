// app/app/clients/[id]/page.js
"use client";

import { useState, useEffect } from "react";
import LanguagePicker from "@/app/components/LanguagePicker";
import CountrySelect from "@/app/components/CountrySelect";
import { LANGUAGES } from "@/app/i18n/languages";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  X,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  FileText,
  Receipt,
  Briefcase,
  Plus,
  Languages,
} from "lucide-react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { formatPhoneInput } from "@/lib/validation";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { formatAddress } from "@/lib/format/address";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

function money(n) {
  return `$${Number(n || 0).toLocaleString()}`;
}

export default function ClientDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Shown as "Company default (X)" in the picker so null reads as a real choice.
  const [companyLanguage, setCompanyLanguage] = useState("en");

  async function load() {
    try {
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) {
        // A genuine 404 is a legitimate empty state — the not-found panel below
        // already says so, so don't also toast. Anything else (403, 500, …) is
        // a real failure that must not masquerade as "no such client".
        if (res.status !== 404) reportResponseError(res);
        setClient(null);
        return;
      }
      setClient(await res.json());
    } catch {
      // Network rejection: surface it instead of silently showing not-found.
      setClient(null);
      showError(t("app.clientDetail.loadError", "Couldn't load this client."));
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetch("/api/settings/business-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.defaultLanguage && setCompanyLanguage(d.defaultLanguage))
      .catch(() => {});
  }, []);

  function openEdit() {
    setForm({
      type: client.type || "individual",
      name: client.name || "",
      contactName: client.contactName || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      city: client.city || "",
      province: client.province || "",
      // "" when the row predates the column. Shown as "Not set" rather than
      // filled in with a guess — see CountrySelect.
      country: client.country || "",
      notes: client.notes || "",
      // Null means "follow the company default" — see LanguagePicker. Without
      // this field the API accepted a language the UI could never change, so a
      // client created in the wrong language was stuck there forever.
      language: client.language || null,
    });
    setEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("app.clientDetail.saveError"));
      setEditing(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-56 bg-accent rounded" />
        <div className="h-32 bg-accent rounded-xl" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <p className="text-sm text-muted-foreground">{t("app.clientDetail.notFound")}</p>
        <Link href="/app/clients" className="text-sm text-foreground underline">
          {t("app.clientNew.back")}
        </Link>
      </div>
    );
  }

  const isCompany = client.type === "company";
  const quotes = client.quotes || [];
  const invoices = client.invoices || [];
  const jobs = client.jobs || [];

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/app/clients"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft size={14} /> {t("app.clientNew.back")}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {isCompany ? <Building2 size={22} /> : <User size={22} />}
              {client.name}
            </h1>
            <span
              className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                isCompany
                  ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isCompany ? t("app.clientNew.company") : t("app.clientNew.homeowner")}
            </span>
          </div>
          <button
            onClick={openEdit}
            className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold hover:bg-muted"
          >
            <Pencil size={14} /> {t("app.action.edit")}
          </button>
        </div>
      </div>

      {/* Contact info */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-2.5">
        {isCompany && client.contactName && (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <User size={14} className="text-muted-foreground shrink-0" />
            {client.contactName}{" "}
            <span className="text-muted-foreground">· {t("app.clientDetail.contactSuffix")}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Phone size={14} className="text-muted-foreground shrink-0" />
            {client.phone}
          </div>
        )}
        {client.email && (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Mail size={14} className="text-muted-foreground shrink-0" />
            {client.email}
          </div>
        )}
        {client.address && (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <MapPin size={14} className="text-muted-foreground shrink-0" />
            {formatAddress(client)}
            {isCompany && (
              <span className="text-muted-foreground">· {t("app.clientDetail.office")}</span>
            )}
          </div>
        )}
        {isCompany && (
          <p className="text-xs text-muted-foreground pt-1">
            {t("app.clientDetail.jobSitesVary")}
          </p>
        )}
        {/* Visible without opening Edit: which language this client's documents
            and emails go out in. Says "company default" when unset rather than
            naming a language they didn't choose. */}
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Languages size={14} className="text-muted-foreground shrink-0" />
          {client.language
            ? LANGUAGES.find((l) => l.code === client.language)?.nativeName ||
              client.language
            : t("app.clientDetail.companyDefaultLang", {
                lang:
                  LANGUAGES.find((l) => l.code === companyLanguage)?.nativeName ||
                  companyLanguage,
              })}
          <span className="text-muted-foreground">· {t("app.clientDetail.docsEmails")}</span>
        </div>
        {client.notes && (
          <p className="text-sm text-muted-foreground pt-2 border-t border-border">
            {client.notes}
          </p>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/app/quotes/new?clientId=${client.id}`}
          className="flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold"
        >
          <Plus size={14} /> {t("app.clientDetail.newQuote")}
        </Link>
        <Link
          href={`/app/jobs/new?clientId=${client.id}`}
          className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold hover:bg-muted"
        >
          <Plus size={14} /> {t("app.clientDetail.newJob")}
        </Link>
      </div>

      {/* Related records */}
      <RelatedList
        icon={FileText}
        title={t("app.nav.quotes")}
        items={quotes}
        empty={t("app.clientDetail.noQuotes")}
        render={(q) => (
          <Link
            key={q.id}
            href={`/app/quotes/${q.id}`}
            className="flex items-center justify-between px-5 py-3 hover:bg-muted"
          >
            <span className="text-sm text-foreground">
              {q.quoteNumber || t("app.clientDetail.quoteFallback")}
            </span>
            <span className="text-sm font-medium text-foreground">
              {money(q.total)}
            </span>
          </Link>
        )}
      />

      <RelatedList
        icon={Briefcase}
        title={t("app.nav.jobs")}
        items={jobs}
        empty={t("app.clientDetail.noJobs")}
        render={(j) => (
          <Link
            key={j.id}
            href={`/app/jobs/${j.id}`}
            className="flex items-center justify-between px-5 py-3 hover:bg-muted"
          >
            <span className="text-sm text-foreground">{j.title}</span>
            <span className="text-xs text-muted-foreground capitalize">
              {j.status}
            </span>
          </Link>
        )}
      />

      <RelatedList
        icon={Receipt}
        title={t("app.nav.invoices")}
        items={invoices}
        empty={t("app.clientDetail.noInvoices")}
        render={(inv) => (
          <Link
            key={inv.id}
            href={`/app/invoices/${inv.id}`}
            className="flex items-center justify-between px-5 py-3 hover:bg-muted"
          >
            <span className="text-sm text-foreground">
              {inv.invoiceNumber || t("app.clientDetail.invoiceFallback")}
            </span>
            <span className="text-sm font-medium text-foreground">
              {money(inv.total)}
            </span>
          </Link>
        )}
      />

      {/* Edit modal */}
      {editing && form && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setEditing(false)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {t("app.clientDetail.edit")}
              </h2>
              <button onClick={() => setEditing(false)}>
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-3 py-2 mb-3">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: "individual" })}
                  className={`border rounded-lg px-3 py-2 text-sm ${
                    form.type !== "company"
                      ? "border-inverted bg-muted font-medium"
                      : "border-border"
                  }`}
                >
                  {t("app.clientNew.homeowner")}
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: "company" })}
                  className={`border rounded-lg px-3 py-2 text-sm ${
                    form.type === "company"
                      ? "border-inverted bg-muted font-medium"
                      : "border-border"
                  }`}
                >
                  {t("app.clientNew.company")}
                </button>
              </div>

              <input
                required
                placeholder={
                  form.type === "company" ? t("app.clientNew.companyName") : t("app.field.name")
                }
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
              {form.type === "company" && (
                <input
                  placeholder={t("app.clientNew.contactPerson")}
                  value={form.contactName}
                  onChange={(e) =>
                    setForm({ ...form, contactName: e.target.value })
                  }
                  className={inputClass}
                />
              )}
              <input
                type="email"
                placeholder={t("app.field.email")}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
              <input
                placeholder="555-123-4567"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: formatPhoneInput(e.target.value) })
                }
                className={inputClass}
              />
              <AddressAutocomplete
                value={form.address}
                onChange={(v) => setForm({ ...form, address: v })}
                onPlaceSelected={({ address, city, province, country }) =>
                  setForm((prev) => ({
                    ...prev,
                    address,
                    city: city || prev.city,
                    province: province || prev.province,
                    // Already ISO alpha-2 from Google. This is how the
                    // country fills itself in for existing clients, which is
                    // why nothing backfilled the column.
                    country: country || prev.country,
                  }))
                }
                placeholder={
                  form.type === "company"
                    ? t("app.clientNew.businessAddress")
                    : t("app.field.address")
                }
                className={inputClass}
              />
              {/* Fills itself in when the address is picked from the
                  autocomplete; editable here for the addresses typed by hand,
                  and for the clients created before the column existed. */}
              <CountrySelect
                id="client-country"
                value={form.country}
                onChange={(v) => setForm({ ...form, country: v })}
                className={inputClass}
              />

              <textarea
                rows={2}
                placeholder={t("app.field.notes")}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputClass}
              />

              {/* Their language drives every document and email they receive —
                  see lib/i18n/clientLanguage.js. Editable here, not only at
                  creation, because the wrong choice used to be permanent. */}
              <LanguagePicker
                value={form.language}
                onChange={(v) => setForm({ ...form, language: v })}
                companyDefault={companyLanguage}
                hint={t("app.clientDetail.langHint")}
              />

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {saving ? t("app.action.saving") : t("app.clientDetail.saveChanges")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RelatedList({ icon: Icon, title, items, empty, render }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
        <Icon size={15} className="text-muted-foreground" />
        <h2 className="font-semibold text-foreground text-sm">{title}</h2>
        <span className="text-xs text-muted-foreground">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground text-center">{empty}</p>
      ) : (
        <div className="divide-y divide-border">{items.map(render)}</div>
      )}
    </div>
  );
}
