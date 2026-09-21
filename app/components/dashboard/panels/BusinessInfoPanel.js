// app/components/dashboard/panels/BusinessInfoPanel.js
//
// "Complete your business address and phone", in the home page's dialog.
// The fields are app/components/settings/CompanyDetailsFields.js — the same
// component Settings > Company renders in its "Company details" card — so
// this file owns only what the card's page owns around them: the read, a
// form holding those fields, and a save.
//
// The save is a PARTIAL PATCH, of exactly the eleven fields the component
// edits (COMPANY_DETAILS_FIELDS). The settings page sends its whole form
// because it edits forty fields; sending forty from here, read minutes ago,
// would clobber anything changed on that page in another tab — the same
// cross-page clobber that page's payload() comment describes fixing. The
// route accepts either shape (app/api/settings/business-info: every field
// is `!== undefined && { … }`).
"use client";

import { useEffect, useState } from "react";
import CompanyDetailsFields, {
  COMPANY_DETAILS_FIELDS,
} from "@/app/components/settings/CompanyDetailsFields";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { reportResponseError } from "@/lib/clientErrors";

export default function BusinessInfoPanel({ onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(null);
  const [slug, setSlug] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  // A failed load must not become a form — the same rule Settings > Company
  // keeps, for the same reason: a blank form over a failed GET, saved, is
  // the company's address deleted.
  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/settings/business-info")
      .then((data) => {
        if (cancelled) return;
        setSlug(data?.slug || "");
        setForm({
          name: data?.name || "",
          phone: data?.phone || "",
          email: data?.email || "",
          website: data?.website || "",
          address: data?.address || "",
          city: data?.city || "",
          province: data?.province || "",
          postalCode: data?.postalCode || "",
          country: data?.country || "CA",
          latitude: data?.latitude ?? null,
          longitude: data?.longitude ?? null,
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

  // The same place-pick the settings page makes: the typed parts win where
  // Google returned nothing, and the coordinates come from the pick.
  function handlePlaceSelected({ address, city, province, postalCode, country, lat, lng }) {
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

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {};
      for (const field of COMPANY_DETAILS_FIELDS) body[field] = form[field];
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
        <div className="h-40 bg-accent rounded-xl" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <CompanyDetailsFields
        form={form}
        set={set}
        onPlaceSelected={handlePlaceSelected}
        slug={slug}
      />
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
