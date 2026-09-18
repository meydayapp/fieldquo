"use client";

// app/components/jobs/InstalledEquipment.js
//
// The CLIENT's equipment at the address this job is at, and the door for
// writing down what this job put in.
//
// ══ Beside "Company equipment used", not inside it ═════════════════════════
//
// EquipmentUseLog next door logs the company's OWN kit — the compressor, the
// van in the register — for job costing. The owner opened it looking for the
// furnace he had just installed and its warranty. That is ClientEquipment
// (/app/equipment, the client page), and it belongs on the job too: the crew
// who put it in are the ones who know the serial number and the day, and the
// warranty callback a year later starts from this page. Two panels, two
// tables, titled so they cannot be confused. See lib/equipment/installed.js.
//
// ══ What a 403 means here ══════════════════════════════════════════════════
//
// The crew preset sits at clientsProperties: name_address_only, and the
// route refuses it. This panel then draws NOTHING — not an empty list, which
// on the job page would read as "there is nothing in this house". A crew
// member gets the address; the installed base is the owner's.
//
// ══ The warranty date ══════════════════════════════════════════════════════
//
// The form asks for a LENGTH — one, two, five, ten years, a date, or "don't
// know" — and counts it from the install date it also asks for, which starts
// as the job's completion date. "Don't know" is sent as a blank and rendered
// as unknown; the state on every row arrives computed from the server, so
// this file never decides what a blank means. lib/equipment/warranty.js.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Plus, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchList, LOAD_ERROR_KEYS } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import ExpiryBadge from "@/app/components/ExpiryBadge";
import {
  WARRANTY_LENGTH_OPTIONS,
  warrantyEndFrom,
  defaultInstalledAt,
  dateInputValue,
} from "@/lib/equipment/installed";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/10";

const LENGTH_LABELS = {
  unknown: ["app.installed.length.unknown", "Don't know"],
  "1y": ["app.installed.length.1y", "1 year"],
  "2y": ["app.installed.length.2y", "2 years"],
  "5y": ["app.installed.length.5y", "5 years"],
  "10y": ["app.installed.length.10y", "10 years"],
  custom: ["app.installed.length.custom", "A date of my own"],
};

function formatDate(value, locale) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale || undefined, { year: "numeric", month: "short", day: "numeric" });
}

function emptyForm(job) {
  return {
    name: "",
    manufacturer: "",
    modelNumber: "",
    serialNumber: "",
    installedAt: defaultInstalledAt(job),
    length: "unknown",
    customEndsAt: "",
    warrantyProvider: "",
    notes: "",
  };
}

/**
 * @param job        the job page's own row — clientId, siteAddress,
 *                   completedAt, endDate, callbackReason, warrantyEquipment
 * @param onJobChanged  called after the job's own warranty link is written,
 *                   so the page above re-reads its banner
 */
export default function InstalledEquipment({ job, onJobChanged }) {
  const { t, language } = useTranslation();
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [linking, setLinking] = useState(false);

  const jobId = job?.id;

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList(`/api/jobs/${jobId}/equipment`);
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    if (jobId) load();
  }, [jobId, load]);

  // Refused outright: this member may not read client equipment. Nothing is
  // drawn — see the header. Every OTHER failure shows the shared panel.
  if (errorKey === LOAD_ERROR_KEYS.forbidden) return null;

  const warrantyEnd = form
    ? warrantyEndFrom({ installedAt: form.installedAt, length: form.length, customEndsAt: form.customEndsAt })
    : null;

  async function submit(e) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) {
      setFormError(t("app.equipment.nameRequired", "Give it a name."));
      return;
    }
    if (warrantyEnd?.error) {
      setFormError(warrantyEnd.error);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          manufacturer: form.manufacturer,
          modelNumber: form.modelNumber,
          serialNumber: form.serialNumber,
          installedAt: form.installedAt,
          // A blank is sent as a blank and stored as null — "unknown". The
          // date is derived HERE from the length the person chose and the
          // install date they typed, and sent as a date, so the API keeps
          // its one rule (a present-and-blank field is null) and never has
          // to learn what "5y" means.
          warrantyEndsAt: dateInputValue(warrantyEnd?.warrantyEndsAt),
          warrantyProvider: form.warrantyProvider,
          notes: form.notes,
        }),
      });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.equipment.saveFailed", "Couldn't save that."));
        setFormError(message || t("app.equipment.saveFailed", "Couldn't save that."));
        return;
      }
      setAdding(false);
      setForm(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function linkWarranty(equipmentId) {
    setLinking(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warrantyEquipmentId: equipmentId || null }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.installed.linkFailed", "Couldn't link that."));
        return;
      }
      await load();
      await onJobChanged?.();
    } finally {
      setLinking(false);
    }
  }

  const here = data?.here || [];
  const elsewhere = data?.elsewhere || [];
  const all = [...here, ...elsewhere];
  const canWrite = !!data?.canWrite;
  const canLinkWarranty = !!data?.canLinkWarranty;
  const linkedId = data?.warrantyEquipmentId || null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <ShieldCheck size={15} />
          {t("app.installed.title", "Installed at this site")}
          {data && <span className="text-xs font-normal text-muted-foreground">({here.length})</span>}
        </h3>
        {canWrite && !adding && (
          <button
            type="button"
            onClick={() => {
              setForm(emptyForm(job));
              setFormError("");
              setAdding(true);
            }}
            className="text-xs font-semibold text-foreground flex items-center gap-1 min-h-[36px]"
          >
            <Plus size={13} />
            {t("app.installed.record", "Record what we installed")}
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t(
          "app.installed.intro",
          "The client's own equipment — furnace, water heater, unit — and what it's covered by. Not the company's kit; that's logged above.",
        )}
      </p>

      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={!!data && all.length === 0 && !adding}
        onRetry={load}
        empty={
          <p className="text-xs text-muted-foreground">
            {t("app.installed.empty", "Nothing recorded at this address yet.")}
          </p>
        }
      >
        {here.length > 0 && (
          <ul className="space-y-2">
            {here.map((row) => (
              <Row key={row.id} row={row} language={language} clientId={data.clientId} linked={row.id === linkedId} />
            ))}
          </ul>
        )}
        {elsewhere.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              {t("app.installed.elsewhere", "At this client's other addresses")}
            </p>
            <ul className="space-y-2">
              {elsewhere.map((row) => (
                <Row key={row.id} row={row} language={language} clientId={data.clientId} linked={row.id === linkedId} showSite />
              ))}
            </ul>
          </div>
        )}
      </ListState>

      {/* A warranty callback says WHICH piece it is about. Offered only when
          the server said the job may carry one (a warranty callback), and only
          with rows to choose from; the link is written on the job, so the
          banner at the top of the page picks it up on the next read. */}
      {canLinkWarranty && all.length > 0 && (
        <label className="block mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
          {t("app.installed.whichForCallback", "Which equipment is this warranty callback about?")}
          <select
            className={`${inputClass} mt-1`}
            value={linkedId || ""}
            disabled={linking}
            onChange={(e) => linkWarranty(e.target.value)}
          >
            <option value="">{t("app.installed.notChosen", "Not chosen")}</option>
            {all.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
                {row.serialNumber ? ` · ${row.serialNumber}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      {adding && form && (
        <form onSubmit={submit} className="mt-3 pt-3 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              {t("app.installed.record", "Record what we installed")}
            </h4>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setForm(null);
              }}
              aria-label={t("app.action.cancel", "Cancel")}
              className="p-2 -m-2 text-muted-foreground"
            >
              <X size={16} />
            </button>
          </div>

          <input
            required
            className={inputClass}
            placeholder={t("app.equipment.namePlaceholder", "Furnace, panel, water heater…")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              className={inputClass}
              placeholder={t("app.equipment.manufacturer", "Manufacturer")}
              value={form.manufacturer}
              onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder={t("app.equipment.modelNumber", "Model number")}
              value={form.modelNumber}
              onChange={(e) => setForm({ ...form, modelNumber: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder={t("app.equipment.serialNumber", "Serial number")}
              value={form.serialNumber}
              onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs text-muted-foreground">
              {t("app.equipment.installedAt", "Installed")}
              <input
                type="date"
                className={`${inputClass} mt-1`}
                value={form.installedAt}
                onChange={(e) => setForm({ ...form, installedAt: e.target.value })}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              {t("app.installed.warrantyLength", "Warranty runs for")}
              <select
                className={`${inputClass} mt-1`}
                value={form.length}
                onChange={(e) => setForm({ ...form, length: e.target.value })}
              >
                {WARRANTY_LENGTH_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {t(LENGTH_LABELS[o.key][0], LENGTH_LABELS[o.key][1])}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {form.length === "custom" && (
            <label className="block text-xs text-muted-foreground">
              {t("app.equipment.warrantyEndsAt", "Warranty covers until")}
              <input
                type="date"
                className={`${inputClass} mt-1`}
                value={form.customEndsAt}
                onChange={(e) => setForm({ ...form, customEndsAt: e.target.value })}
              />
            </label>
          )}
          {/* The date the choice means, said before it is saved. */}
          <p className="text-xs text-muted-foreground">
            {warrantyEnd?.error
              ? warrantyEnd.error
              : warrantyEnd?.warrantyEndsAt
                ? t("app.installed.coveredUntilPreview", "Covered until {date}", {
                    date: formatDate(warrantyEnd.warrantyEndsAt, language),
                  })
                : t(
                    "app.equipment.warrantyBlankHint",
                    "Leave the warranty date blank if you don't know it. It'll show as \"not recorded\" — never as out of warranty.",
                  )}
          </p>

          <input
            className={inputClass}
            placeholder={t("app.equipment.warrantyProvider", "Who's covering it")}
            value={form.warrantyProvider}
            onChange={(e) => setForm({ ...form, warrantyProvider: e.target.value })}
          />
          <textarea
            rows={2}
            className={inputClass}
            placeholder={t("app.equipment.notes", "Notes — access, quirks, what to bring")}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          {formError && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-inverted text-inverted-foreground py-3 rounded-lg text-sm font-semibold disabled:opacity-60 min-h-[44px]"
          >
            {saving ? t("app.action.saving", "Saving…") : t("app.action.save", "Save")}
          </button>
        </form>
      )}
    </div>
  );
}

function Row({ row, language, clientId, linked, showSite = false }) {
  const { t } = useTranslation();
  const warranty = row.warranty || { state: "unknown", endsAt: null };
  const covered = formatDate(warranty.endsAt, language);
  const line =
    warranty.state === "unknown"
      ? t("app.equipment.warrantyUnknown", "Warranty not recorded")
      : warranty.state === "expired"
        ? t("app.equipment.warrantyEnded", "Cover ended {date}", { date: covered })
        : t("app.equipment.warrantyUntil", "Covered until {date}", { date: covered });
  const badge =
    warranty.state === "unknown"
      ? t("app.equipment.badgeUnknown", "Warranty unknown")
      : warranty.state === "expired"
        ? t("app.equipment.badgeExpired", "Out of warranty")
        : warranty.state === "due_soon"
          ? t("app.equipment.badgeSoon", "Warranty ending")
          : t("app.equipment.badgeOk", "In warranty");

  return (
    <li className="flex items-start justify-between gap-3 text-sm">
      <span className="min-w-0">
        <Link href={`/app/clients/${clientId}`} className="block font-medium text-foreground truncate underline-offset-2 hover:underline">
          {row.name}
        </Link>
        <span className="block text-xs text-muted-foreground truncate">
          {[row.manufacturer, row.modelNumber, row.serialNumber].filter(Boolean).join(" · ") ||
            t("app.equipment.noDetails", "No make or model recorded")}
          {showSite && row.siteAddress ? ` — ${row.siteAddress}` : ""}
        </span>
        <span className="block text-xs text-muted-foreground">
          {line}
          {row.installedAt && ` · ${t("app.installed.installedOn", "installed {date}", { date: formatDate(row.installedAt, language) })}`}
          {linked && ` · ${t("app.installed.thisCallback", "this callback")}`}
        </span>
      </span>
      <ExpiryBadge state={warranty.state} label={badge} className="shrink-0" />
    </li>
  );
}
