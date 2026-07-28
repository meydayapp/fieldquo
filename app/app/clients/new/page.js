// app/app/clients/new/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import LanguagePicker from "@/app/components/LanguagePicker";
import { formatPhoneInput } from "@/lib/validation";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

export default function NewClientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    type: "individual",
    name: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    province: "",
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
      setError("Client name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create client");
      // The clients list links each row to /app/clients/[id]; go straight there.
      router.push(`/app/clients/${data.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/app/clients"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft size={14} /> Back to Clients
        </Link>
        <h1 className="text-2xl font-bold text-foreground">New Client</h1>
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
            Client type
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
                Homeowner
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                An individual — jobs are at their address
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
                Company / Contractor
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                A business — job sites vary per job
              </div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {isCompany ? "Company name" : "Name"}{" "}
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
                Contact person
              </label>
              <input
                className={inputClass}
                placeholder="Who you deal with there"
                value={form.contactName}
                onChange={(e) => set("contactName", e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Phone
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
              Email
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
            {isCompany ? "Business address (optional)" : "Address"}
          </label>
          <AddressAutocomplete
            value={form.address}
            onChange={(v) => set("address", v)}
            onPlaceSelected={({ address, city, province }) =>
              setForm((prev) => ({
                ...prev,
                address,
                city: city || prev.city,
                province: province || prev.province,
              }))
            }
            placeholder="Start typing an address..."
            className={inputClass}
          />
          {isCompany && (
            <p className="text-xs text-muted-foreground mt-1">
              This is their office. Each job's actual site address is set on the
              quote or job itself.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        <LanguagePicker
          value={form.language}
          onChange={(v) => set("language", v)}
          companyDefault={companyLanguage}
        />

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">
            Notes
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
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-inverted text-inverted-foreground px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create Client"}
          </button>
        </div>
      </form>
    </div>
  );
}
