"use client";

// app/components/subcontractors/SubcontractorForm.js
//
// Create or edit one subcontractor — the COMPANY, not a person on the roster.
//
// The two expiry dates follow lib/fleet/payload.js's rule: a blank box is
// "not recorded", never a default. They are typed here when the GC has the
// certificate in hand; filing the certificate itself (SubcontractorDocuments)
// writes the same columns from the paper, so either path keeps the panel
// honest.

import { useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/10 min-h-[44px]";

function dateInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function formValuesFrom(sub) {
  return {
    name: sub?.name || "",
    trade: sub?.trade || "",
    contactName: sub?.contactName || "",
    email: sub?.email || "",
    phone: sub?.phone || "",
    insuranceExpiresAt: dateInputValue(sub?.insuranceExpiresAt),
    clearanceExpiresAt: dateInputValue(sub?.clearanceExpiresAt),
    taxFormRequired: sub?.taxFormRequired ?? true,
    notes: sub?.notes || "",
  };
}

/**
 * @param mode      "create" | "edit"
 * @param sub       the row being edited (edit mode)
 * @param onSaved   handed the response body ({ subcontractor, ... })
 */
export default function SubcontractorForm({ mode, sub, onSaved, onCancel }) {
  const { t } = useTranslation();
  const [values, setValues] = useState(() => formValuesFrom(sub));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const creating = mode === "create";

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!values.name.trim()) {
      setError(t("app.subcontractors.nameRequired", "Give the company a name."));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(creating ? "/api/subcontractors" : `/api/subcontractors/${sub.id}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.subcontractors.saveFailed", "Couldn't save that."));
        setError(message || t("app.subcontractors.saveFailed", "Couldn't save that."));
        return;
      }
      onSaved?.(await res.json());
    } finally {
      setSaving(false);
    }
  }

  const field = (key, label, extra = {}) => (
    <label className="block text-xs text-muted-foreground">
      {label}
      <input
        className={`${inputClass} mt-1`}
        value={values[key]}
        onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        {...extra}
      />
    </label>
  );

  return (
    <form onSubmit={submit} className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {creating ? t("app.subcontractors.newTitle", "New subcontractor") : t("app.subcontractors.editTitle", "Edit subcontractor")}
        </h3>
        {onCancel && (
          <button type="button" onClick={onCancel} aria-label={t("app.subcontractors.cancel", "Cancel")} className="p-2 -m-2 text-muted-foreground min-h-[44px] min-w-[44px]">
            <X size={16} />
          </button>
        )}
      </div>

      {field("name", t("app.subcontractors.companyName", "Company name"), { required: true })}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("trade", t("app.subcontractors.trade", "Trade"), { placeholder: t("app.subcontractors.tradePlaceholder", "electrical, roofing, drywall…") })}
        {field("contactName", t("app.subcontractors.contactName", "Contact person"))}
        {field("email", t("app.subcontractors.email", "Email"), { type: "email", inputMode: "email" })}
        {field("phone", t("app.subcontractors.phone", "Phone"), { type: "tel", inputMode: "tel" })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("insuranceExpiresAt", t("app.subcontractors.insuranceExpires", "Insurance (COI) expires"), { type: "date" })}
        {field("clearanceExpiresAt", t("app.subcontractors.clearanceExpires", "WSIB / WCB clearance expires"), { type: "date" })}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("app.subcontractors.expiryHint", "Leave a date blank if you don't have the certificate — blank means not recorded, not expired. Filing the certificate under Documents sets the date too.")}
      </p>

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          className="mt-1"
          checked={values.taxFormRequired}
          onChange={(e) => setValues({ ...values, taxFormRequired: e.target.checked })}
        />
        <span>
          {t("app.subcontractors.taxFormRequired", "Goes on the year-end contractor form (T5018 / 1099-NEC)")}
          <span className="block text-xs text-muted-foreground">
            {t("app.subcontractors.taxFormHint", "Usually yes for a construction sub. Untick for an incorporated materials supplier your accountant says doesn't get one.")}
          </span>
        </span>
      </label>

      <label className="block text-xs text-muted-foreground">
        {t("app.subcontractors.notes", "Notes")}
        <textarea
          className={`${inputClass} mt-1 min-h-[80px]`}
          value={values.notes}
          onChange={(e) => setValues({ ...values, notes: e.target.value })}
        />
      </label>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
        >
          {saving ? t("app.subcontractors.saving", "Saving…") : creating ? t("app.subcontractors.create", "Add subcontractor") : t("app.subcontractors.save", "Save")}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="min-h-[44px] rounded-lg border border-border px-4 text-sm font-semibold text-foreground">
            {t("app.subcontractors.cancel", "Cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
