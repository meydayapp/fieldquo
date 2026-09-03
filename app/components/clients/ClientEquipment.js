"use client";

// app/components/clients/ClientEquipment.js
//
// The kit installed at this customer's property, and the warranty on it.
//
// ══ What this panel is for ═════════════════════════════════════════════════
//
// "Installed 2019, covered to 2029, serviced three times" is the sentence that
// turns a cold call into a renewal. Everything on this panel exists to make
// that sentence writable by whoever was standing in the basement, and readable
// by whoever picks up the phone eight years later.
//
// ══ The rendering rule ═════════════════════════════════════════════════════
//
// A blank warranty date renders as "Warranty not recorded", in the neutral
// grey, with an "Add the dates" affordance. NEVER as "out of warranty". The
// state is computed on the server (lib/equipment/warranty.js) and arrives on
// the row, so this file never has to decide what a null means — which is
// deliberate, because that decision made in two places is how one of them
// eventually answers "expired".
//
// ══ Mobile ════════════════════════════════════════════════════════════════
//
// Single column, full-width controls, 44px tap targets, no horizontal scroll
// and no table — this is filled in standing in somebody's utility room on a
// phone. Note honestly: `npm run check:mobile` currently walks only /platform,
// /sales and /app/clock, so this file is NOT covered by it. It is built to the
// same rules that check enforces, and the gap is named rather than implied.

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Wrench,
  ShieldCheck,
  Trash2,
  Pencil,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import ExpiryBadge from "@/app/components/ExpiryBadge";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/10";

/** yyyy-mm-dd for a <input type="date">, or "" when there is no date. */
function dateInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function formatDate(value, locale) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale || undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const EMPTY_FORM = {
  name: "",
  manufacturer: "",
  modelNumber: "",
  serialNumber: "",
  siteAddress: "",
  installedAt: "",
  warrantyEndsAt: "",
  warrantyProvider: "",
  warrantyNotes: "",
  notes: "",
  installedByJobId: "",
};

export default function ClientEquipment({ clientId, jobs = [] }) {
  const { t, language } = useTranslation();
  const canEdit = useHasLevel("clientsProperties", "full_edit");
  const canDelete = useHasLevel("clientsProperties", "full_edit_delete");

  // null, never [] — an empty array is a claim that there are zero, and the
  // server has not said anything yet. See lib/loadState.js.
  const [equipment, setEquipment] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList(`/api/clients/${clientId}/equipment`);
    if (result.aborted) return;
    if (!result.ok) {
      // The list is left at null, not emptied: a refused read must not render
      // as "this client has no equipment".
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setEquipment(Array.isArray(result.data?.equipment) ? result.data.equipment : []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    if (clientId) load();
  }, [clientId, load]);

  function startAdd() {
    setEditingId("new");
    setForm({ ...EMPTY_FORM });
    setFormError("");
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      manufacturer: row.manufacturer || "",
      modelNumber: row.modelNumber || "",
      serialNumber: row.serialNumber || "",
      siteAddress: row.siteAddress || "",
      installedAt: dateInputValue(row.installedAt),
      warrantyEndsAt: dateInputValue(row.warrantyEndsAt),
      warrantyProvider: row.warrantyProvider || "",
      warrantyNotes: row.warrantyNotes || "",
      notes: row.notes || "",
      installedByJobId: row.installedByJobId || "",
    });
    setFormError("");
  }

  function closeForm() {
    setEditingId(null);
    setForm(null);
    setFormError("");
  }

  async function submit(e) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) {
      setFormError(t("app.equipment.nameRequired", "Give it a name."));
      return;
    }
    setSaving(true);
    try {
      const creating = editingId === "new";
      const url = creating
        ? `/api/clients/${clientId}/equipment`
        : `/api/clients/${clientId}/equipment/${editingId}`;
      const res = await fetch(url, {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        // Sent whole, blanks included: the API reads a present-and-blank field
        // as "clear this", which is what makes a mistyped warranty date
        // recoverable. See lib/equipment/payload.js.
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const message = await reportResponseError(
          res,
          t("app.equipment.saveFailed", "Couldn't save that."),
        );
        setFormError(message || t("app.equipment.saveFailed", "Couldn't save that."));
        return;
      }
      closeForm();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (
      !window.confirm(
        t(
          "app.equipment.confirmDelete",
          "Delete this equipment and its service history? That can't be undone.",
        ),
      )
    )
      return;
    const res = await fetch(`/api/clients/${clientId}/equipment/${row.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      await reportResponseError(res, t("app.equipment.deleteFailed", "Couldn't delete that."));
      return;
    }
    await load();
  }

  const count = equipment ? equipment.length : null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-border">
        <ShieldCheck size={15} className="text-muted-foreground" />
        <h2 className="font-semibold text-foreground text-sm">
          {t("app.equipment.title", "Equipment & warranties")}
        </h2>
        {/* No count at all while it is unknown — never a fabricated 0. */}
        {count !== null && (
          <span className="text-xs text-muted-foreground">({count})</span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={startAdd}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-foreground border border-border rounded-full px-3 py-2 min-h-[36px]"
          >
            <Plus size={14} /> {t("app.equipment.add", "Add")}
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5">
        <ListState
          loading={loading}
          errorKey={errorKey}
          isEmpty={!!equipment && equipment.length === 0 && editingId !== "new"}
          onRetry={load}
          empty={
            <p className="text-sm text-muted-foreground text-center py-6">
              {t(
                "app.equipment.empty",
                "Nothing recorded here yet. Add the furnace, the panel, the unit — whatever you'd want to know about on the next call.",
              )}
            </p>
          }
        >
          <div className="space-y-3">
            {(equipment || []).map((row) => (
              <EquipmentRow
                key={row.id}
                row={row}
                open={openId === row.id}
                onToggle={() => setOpenId(openId === row.id ? null : row.id)}
                onEdit={() => startEdit(row)}
                onDelete={() => remove(row)}
                onServiced={load}
                clientId={clientId}
                canEdit={canEdit}
                canDelete={canDelete}
                jobs={jobs}
                language={language}
              />
            ))}
          </div>
        </ListState>

        {editingId && form && (
          <form onSubmit={submit} className="mt-4 border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {editingId === "new"
                  ? t("app.equipment.addTitle", "Add equipment")
                  : t("app.equipment.editTitle", "Edit equipment")}
              </h3>
              <button
                type="button"
                onClick={closeForm}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <input
                className={inputClass}
                placeholder={t("app.equipment.siteAddress", "Where it is (if not the main address)")}
                value={form.siteAddress}
                onChange={(e) => setForm({ ...form, siteAddress: e.target.value })}
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
                {t("app.equipment.warrantyEndsAt", "Warranty covers until")}
                <input
                  type="date"
                  className={`${inputClass} mt-1`}
                  value={form.warrantyEndsAt}
                  onChange={(e) => setForm({ ...form, warrantyEndsAt: e.target.value })}
                />
              </label>
            </div>
            {/* Said out loud on the form, not only in the code: leaving this
                blank is a real answer, and the record will say so rather than
                claiming the warranty has run out. */}
            <p className="text-xs text-muted-foreground">
              {t(
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

            {jobs.length > 0 && (
              <label className="block text-xs text-muted-foreground">
                {t("app.equipment.installedByJob", "Installed on which job")}
                <select
                  className={`${inputClass} mt-1`}
                  value={form.installedByJobId}
                  onChange={(e) => setForm({ ...form, installedByJobId: e.target.value })}
                >
                  <option value="">{t("app.equipment.noJob", "Not linked to a job")}</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title || job.jobNumber || job.id}
                    </option>
                  ))}
                </select>
              </label>
            )}

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
    </div>
  );
}

function EquipmentRow({
  row,
  open,
  onToggle,
  onEdit,
  onDelete,
  onServiced,
  clientId,
  canEdit,
  canDelete,
  jobs,
  language,
}) {
  const { t } = useTranslation();
  const warranty = row.warranty || { state: "unknown", daysRemaining: null };
  const history = row.history || { count: 0, underWarranty: 0, lastServicedAt: null };

  const covered = formatDate(warranty.endsAt, language);
  const warrantyLine =
    warranty.state === "unknown"
      ? t("app.equipment.warrantyUnknown", "Warranty not recorded")
      : warranty.state === "expired"
        ? t("app.equipment.warrantyEnded", "Cover ended {date}", { date: covered })
        : t("app.equipment.warrantyUntil", "Covered until {date}", { date: covered });

  return (
    <div className="border border-border rounded-xl">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full text-left p-3 sm:p-4 flex items-start gap-3 min-h-[56px]"
      >
        <span className="mt-0.5 text-muted-foreground">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-sm text-foreground truncate">
            {row.name}
          </span>
          <span className="block text-xs text-muted-foreground truncate">
            {[row.manufacturer, row.modelNumber, row.serialNumber]
              .filter(Boolean)
              .join(" · ") || t("app.equipment.noDetails", "No make or model recorded")}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <ExpiryBadge
              state={warranty.state}
              label={
                warranty.state === "unknown"
                  ? t("app.equipment.badgeUnknown", "Warranty unknown")
                  : warranty.state === "expired"
                    ? t("app.equipment.badgeExpired", "Out of warranty")
                    : warranty.state === "due_soon"
                      ? t("app.equipment.badgeSoon", "Warranty ending")
                      : t("app.equipment.badgeOk", "In warranty")
              }
            />
            <span className="text-xs text-muted-foreground">{warrantyLine}</span>
          </span>
        </span>
      </button>

      {open && (
        <div className="px-3 sm:px-4 pb-4 space-y-4 border-t border-border pt-3">
          {row.siteAddress && (
            <p className="text-xs text-muted-foreground">{row.siteAddress}</p>
          )}
          {row.notes && <p className="text-sm text-foreground">{row.notes}</p>}

          <div>
            <p className="text-xs font-semibold text-foreground">
              {t("app.equipment.history", "Service history")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {history.count === 0
                ? t("app.equipment.noVisits", "No visits logged")
                : t("app.equipment.visitTally", "{count} visits · {covered} under warranty", {
                    count: history.count,
                    covered: history.underWarranty,
                  })}
            </p>
            {row.services?.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {row.services.map((s) => (
                  <li key={s.id} className="text-xs text-muted-foreground">
                    <span className="text-foreground">
                      {formatDate(s.servicedAt, language) ||
                        t("app.equipment.undated", "Undated")}
                    </span>{" "}
                    — {s.description}
                    {s.underWarranty && (
                      <span className="ml-1.5 text-emerald-700 dark:text-emerald-300 font-semibold">
                        {t("app.equipment.coveredTag", "covered")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canEdit && (
            <LogServiceForm
              clientId={clientId}
              equipmentId={row.id}
              jobs={jobs}
              onLogged={onServiced}
            />
          )}

          {(canEdit || canDelete) && (
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-full px-3 py-2 min-h-[36px]"
                >
                  <Pencil size={13} /> {t("app.action.edit", "Edit")}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-full px-3 py-2 min-h-[36px] text-red-700 dark:text-red-300"
                >
                  <Trash2 size={13} /> {t("app.action.delete", "Delete")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LogServiceForm({ clientId, equipmentId, jobs, onLogged }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [servicedAt, setServicedAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [underWarranty, setUnderWarranty] = useState(false);
  const [jobId, setJobId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!description.trim()) {
      setError(t("app.equipment.describeRequired", "Say what was done."));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/equipment/${equipmentId}/services`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: description.trim(),
            servicedAt,
            underWarranty,
            jobId: jobId || null,
          }),
        },
      );
      if (!res.ok) {
        const message = await reportResponseError(
          res,
          t("app.equipment.logFailed", "Couldn't log that visit."),
        );
        setError(message || t("app.equipment.logFailed", "Couldn't log that visit."));
        return;
      }
      setDescription("");
      setUnderWarranty(false);
      setJobId("");
      setOpen(false);
      await onLogged?.();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-full px-3 py-2 min-h-[36px]"
      >
        <Wrench size={13} /> {t("app.equipment.logVisit", "Log a service visit")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 border border-border rounded-xl p-3">
      <input
        className={inputClass}
        placeholder={t("app.equipment.whatWasDone", "What was done")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        type="date"
        className={inputClass}
        value={servicedAt}
        onChange={(e) => setServicedAt(e.target.value)}
      />
      {jobs.length > 0 && (
        <select
          className={inputClass}
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
        >
          <option value="">{t("app.equipment.noJob", "Not linked to a job")}</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title || job.jobNumber || job.id}
            </option>
          ))}
        </select>
      )}
      {/* The whole reason the service table exists. Asked explicitly rather
          than inferred from whether an invoice was raised — an unbilled visit
          and a covered one are not the same thing. */}
      <label className="flex items-center gap-2 text-sm text-foreground min-h-[44px]">
        <input
          type="checkbox"
          checked={underWarranty}
          onChange={(e) => setUnderWarranty(e.target.checked)}
          className="w-4 h-4"
        />
        {t("app.equipment.wasCovered", "This visit was covered by the warranty")}
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 min-h-[44px]"
        >
          {saving ? t("app.action.saving", "Saving…") : t("app.equipment.logIt", "Log it")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 rounded-lg border border-border text-sm font-semibold min-h-[44px]"
        >
          {t("app.action.cancel", "Cancel")}
        </button>
      </div>
    </form>
  );
}
