// app/components/settings/OpeningHoursEditor.js
//
// When the business is OPEN — the hours a member of the public reads.
//
// ── Not the same thing as BusinessHoursModal ────────────────────────────────
//
// That modal edits AvailabilitySchedule, which hangs off a USER and answers
// "when can this person be booked". This edits Company.businessHours, which
// answers "when is the company open". They are allowed to disagree, and they
// constantly do: an estimator takes Friday off and the office is still open.
//
// The two were previously both labelled "Business Hours" on this page, which
// is how a company ends up publishing an estimator's holiday as a closure.
//
// ── Why this is worth the form ──────────────────────────────────────────────
//
// These hours become `openingHoursSpecification` in the website's structured
// data, which is what puts "Open ⋅ Closes 5 PM" in a Google result. That box
// is read by people who never load the site — for most contractors it is the
// single highest-leverage field on this page.
//
// ── The day names are Intl's, not the catalogue's ───────────────────────────
//
// This table read "Sunday / Monday / Tuesday" under a heading that said
// "Horario de apertura", because it imported DAY_LABELS — which is the
// schema.org `dayOfWeek` table and is English by design, since
// https://schema.org/Monday is that URL in every language. Seven more
// catalogue keys would have been the wrong fix: a weekday is not product copy,
// every runtime ships CLDR's, and a hand-written table is seven strings to
// forget the next time a language is added. lib/format/dayNames.js is the one
// helper; the tenant website already used it under its old name, and
// lib/format/localeDate.js is the app-facing wrapper every back-office screen
// with a weekday in it now shares — this one included, so there is one
// capitalisation rule and one locale map rather than two.
"use client";

import { useState } from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import { DEFAULT_HOURS, normaliseHours } from "@/lib/company/businessHours";
import { weekdayName } from "@/lib/format/localeDate";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";

const inputClass =
  "border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground disabled:opacity-50";

export default function OpeningHoursEditor({ value, weekStartsOn = 0, onSaved }) {
  const { t, language } = useTranslation();
  const dayLabel = (index) => weekdayName(index, language);
  // normaliseHours guarantees seven well-formed rows whatever came out of the
  // Json column, so nothing below needs a length or shape check.
  //
  // The null case is handled separately and on purpose: normaliseHours treats
  // an unstated day as CLOSED, which is right for reading but wrong as an
  // opening form. A company that has said nothing gets DEFAULT_HOURS to edit —
  // offered here, visibly, rather than arriving by omission somewhere in the
  // data layer.
  const [rows, setRows] = useState(() =>
    value ? normaliseHours(value) : DEFAULT_HOURS.map((d) => ({ ...d })),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Rotates the VIEW only. Each row keeps its own `day`, so the array that
  // gets saved is always in Sunday-first order regardless of what the company
  // prefers to look at.
  const start = ((Number(weekStartsOn) % 7) + 7) % 7;
  const display = Array.from({ length: 7 }, (_, i) => rows[(start + i) % 7]);

  function update(day, patch) {
    setSaved(false);
    setRows((prev) => prev.map((r) => (r.day === day ? { ...r, ...patch } : r)));
  }

  /** Copy the first day shown to every other OPEN day. */
  function copyDown() {
    const source = display[0];
    setSaved(false);
    setRows((prev) =>
      prev.map((r) =>
        // Deliberately doesn't reopen closed days. Someone pressing this wants
        // to fix five identical weekdays, not to declare themselves open on
        // Sunday.
        r.day === source.day || r.closed
          ? r
          : { ...r, open: source.open, close: source.close },
      ),
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/business-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessHours: rows }),
      });
      if (!res.ok) {
        setError(
          await reportResponseError(res, t("app.companySettings.hours.saveFailed")),
        );
        return;
      }
      const updated = await res.json();
      // Trust the SERVER's normalised copy, not the local one: a close time
      // earlier than its open is silently turned into a closed day on the way
      // in, and the form must show what was actually stored rather than what
      // was typed.
      const stored = normaliseHours(updated?.businessHours);
      setRows(stored);
      setSaved(true);
      onSaved?.(stored);
    } catch (err) {
      setError(err?.message || t("app.companySettings.hours.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const allClosed = rows.every((r) => r.closed);

  return (
    <div>
      <div className="border border-border rounded-xl divide-y divide-border">
        {display.map((row) => (
          <div
            key={row.day}
            className="flex items-center gap-3 px-3 sm:px-4 py-2.5 flex-wrap"
          >
            <label className="flex items-center gap-2 w-32 shrink-0">
              <input
                type="checkbox"
                checked={!row.closed}
                onChange={(e) => update(row.day, { closed: !e.target.checked })}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">{dayLabel(row.day)}</span>
            </label>

            {row.closed ? (
              <span className="text-sm text-muted-foreground">
                {t("app.companySettings.hours.closed")}
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={row.open}
                  onChange={(e) => update(row.day, { open: e.target.value })}
                  className={inputClass}
                />
                <span className="text-sm text-muted-foreground">
                  {t("app.companySettings.hours.to")}
                </span>
                <input
                  type="time"
                  value={row.close}
                  onChange={(e) => update(row.day, { close: e.target.value })}
                  className={inputClass}
                />
                {/* Flagged here rather than only on save, because the server
                    turns this into a closed day and a company that didn't see
                    it coming reads that as the form losing their input. */}
                {row.close <= row.open && (
                  <span className="text-xs text-destructive">
                    {t("app.companySettings.hours.closeBeforeOpen")}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center flex-wrap gap-3 mt-3">
        <button
          type="button"
          onClick={copyDown}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Copy size={14} />{" "}
          {t("app.companySettings.hours.applyToAll", {
            day: dayLabel(display[0].day),
          })}
        </button>

        <button
          type="button"
          onClick={() => {
            setSaved(false);
            setRows(DEFAULT_HOURS.map((d) => ({ ...d })));
          }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("app.companySettings.hours.reset")}
        </button>

        <div className="ml-auto flex items-center gap-3">
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
              <Check size={15} /> {t("app.companySettings.hours.saved")}
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving
              ? t("app.companySettings.hours.saving")
              : t("app.companySettings.hours.save")}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive mt-2">{error}</p>}

      {allClosed && (
        <p className="text-xs text-muted-foreground mt-2">
          {t("app.companySettings.hours.allClosed")}
        </p>
      )}
    </div>
  );
}
