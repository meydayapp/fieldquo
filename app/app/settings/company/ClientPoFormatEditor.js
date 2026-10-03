// app/app/settings/company/ClientPoFormatEditor.js
//
// "PO references" — the shape of the reference the client-PO Generate button
// suggests (Company.clientPoPrefix / clientPoIncludeYear / clientPoDigits;
// lib/documents/clientPo.js). Prefix, the year or not, digits — with a live
// preview built by the SAME function the server generates with
// (formatGeneratedClientPo), so the preview cannot promise a shape the
// button will not produce. After a save the card shows the real next value
// the server counted.
//
// The client's own PO numbers are never touched by this, and neither is any
// reference already on a document.
"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import {
  CLIENT_PO_DIGITS_MAX,
  CLIENT_PO_DIGITS_MIN,
  CLIENT_PO_PREFIX_MAX,
  CLIENT_PO_FORMAT_DEFAULT,
  formatGeneratedClientPo,
  validateClientPoFormat,
} from "@/lib/documents/clientPo";

export default function ClientPoFormatEditor({ canEdit }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ ...CLIENT_PO_FORMAT_DEFAULT });
  const [saved, setSaved] = useState(null); // { format, next } as the server last answered
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/client-po-format")
      .then(async (res) => {
        if (!res.ok) throw new Error("load");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setSaved(data);
        setForm({ ...data.format });
      })
      // A refused or failed read says so — never an editable default the
      // company did not choose (AGENTS.md failure class 5).
      .catch(() => !cancelled && setLoadError("load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const year = new Date().getFullYear();
  const verdict = validateClientPoFormat(form, CLIENT_PO_FORMAT_DEFAULT);
  const preview = verdict.ok ? formatGeneratedClientPo(verdict.format, year, 1) : "";
  const dirty =
    saved && (form.prefix !== saved.format.prefix || form.includeYear !== saved.format.includeYear || Number(form.digits) !== saved.format.digits);

  async function save(e) {
    e.preventDefault();
    if (!verdict.ok) {
      setError(verdict.error);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/client-po-format", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verdict.format),
      });
      if (!res.ok) {
        await reportResponseError(res, setError, t("app.clientPoFormat.saveError"));
        return;
      }
      const data = await res.json();
      setSaved(data);
      setForm({ ...data.format });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      setError(err?.message || t("app.clientPoFormat.saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-24 bg-accent rounded-lg animate-pulse" />;
  if (loadError) return <p className="text-sm text-red-700 dark:text-red-300">{t("app.clientPoFormat.loadError")}</p>;

  const input = "border border-border rounded px-3 py-2 text-sm bg-background text-foreground disabled:opacity-60";
  return (
    <form onSubmit={save} className="space-y-3" data-client-po-format>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="block font-medium text-foreground mb-1">{t("app.clientPoFormat.prefix")}</span>
          <input
            type="text"
            value={form.prefix}
            maxLength={CLIENT_PO_PREFIX_MAX}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))}
            className={`${input} w-full`}
          />
        </label>
        <label className="block text-sm">
          <span className="block font-medium text-foreground mb-1">{t("app.clientPoFormat.digits")}</span>
          <input
            type="number"
            min={CLIENT_PO_DIGITS_MIN}
            max={CLIENT_PO_DIGITS_MAX}
            value={form.digits}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, digits: e.target.value === "" ? "" : Number(e.target.value) }))}
            className={`${input} w-full`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground sm:pt-6">
          <input
            type="checkbox"
            checked={Boolean(form.includeYear)}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, includeYear: e.target.checked }))}
          />
          {t("app.clientPoFormat.includeYear")}
        </label>
      </div>

      {/* The live preview — the same function the server generates with. */}
      <p className="text-sm text-muted-foreground" data-client-po-preview>
        {verdict.ok ? (
          <>
            {t("app.clientPoFormat.preview")}{" "}
            <strong className="text-foreground tabular-nums">{preview}</strong>
            {saved?.next && !dirty ? (
              <span className="block text-xs mt-0.5">{t("app.clientPoFormat.next", { next: saved.next })}</span>
            ) : null}
          </>
        ) : (
          <span className="text-red-700 dark:text-red-300">{verdict.error}</span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">{t("app.clientPoFormat.existingNote")}</p>

      {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      {canEdit && (
        <button
          type="submit"
          disabled={saving || !dirty || !verdict.ok}
          className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : justSaved ? <Check size={14} /> : null}
          {saving ? t("app.action.saving") : t("app.action.save")}
        </button>
      )}
    </form>
  );
}
