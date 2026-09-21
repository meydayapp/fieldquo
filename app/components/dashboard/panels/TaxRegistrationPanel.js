// app/components/dashboard/panels/TaxRegistrationPanel.js
//
// "Add your tax registration number", in the home page's dialog. The fields
// are app/components/settings/TaxRegistrationFields.js — the same component
// Settings > Company renders in its tax card — including the "I don't have
// one" statement, which is the step's other way off the list and belongs
// beside the field it is about (lib/onboarding.js says why it is not a
// dismiss button on the card).
//
// A partial PATCH of the three fields the component edits, for the reason
// BusinessInfoPanel gives. `country` is read so the field is labelled the
// way the company's country labels it, and never written from here.
"use client";

import { useEffect, useState } from "react";
import TaxRegistrationFields, {
  TAX_REGISTRATION_FIELDS,
} from "@/app/components/settings/TaxRegistrationFields";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { reportResponseError } from "@/lib/clientErrors";

export default function TaxRegistrationPanel({ onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/settings/business-info")
      .then((data) => {
        if (cancelled) return;
        setForm({
          country: data?.country || "",
          taxIdName: data?.taxIdName || "",
          taxIdNumber: data?.taxIdNumber || "",
          taxRegistrationDismissed: Boolean(data?.taxRegistrationDismissedAt),
        });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || t("app.error.network"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {};
      for (const field of TAX_REGISTRATION_FIELDS) body[field] = form[field];
      const res = await fetch("/api/settings/business-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        await reportResponseError(res);
        return;
      }
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
        {loadError}
      </div>
    );
  }

  if (!form) {
    return (
      <div className="animate-pulse space-y-4" aria-busy="true">
        <div className="h-6 w-40 bg-accent rounded" />
        <div className="h-24 bg-accent rounded-xl" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <TaxRegistrationFields form={form} set={set} />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="bg-inverted text-inverted-foreground px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60 min-h-11"
        >
          {saving ? t("app.action.saving") : t("app.action.save")}
        </button>
      </div>
    </form>
  );
}
