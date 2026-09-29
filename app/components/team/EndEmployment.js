"use client";

// app/components/team/EndEmployment.js
//
// Ending somebody's employment, and switching them back on — one set of
// controls for the three places that offer it: each row on Workers, the "On
// the payroll, no login" rows on Manage Team, and the cancel-invitation
// dialog. One copy, because the copy nobody looks at is the one that rots.
//
// ══ Why a dialog and not a button ════════════════════════════════════════
//
// The owner took a worker off the team and couldn't find how to take him off
// payroll; when he did find the Active checkbox, it could only say THAT the
// man had gone. "There should be fire / dismissed, and a proper explanation
// from HR." So ending employment asks four things — what happened (no
// default), the last day worked, an explanation for the HR file, and whether
// they'd be taken back — and POST /api/workers/[id]/separation records all of
// it with the payroll flip in one transaction.
//
// Re-activating is the existing PATCH { active: true }, behind a confirm; the
// server writes the "re-activated by / on" note into the HR file.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson, errorText } from "@/lib/fetchJson";
import {
  SEPARATION_TYPES,
  separationTypeKey,
  parseSeparation,
  EXPLANATION_MIN,
  EXPLANATION_MAX,
  LAST_DAY_MAX_AHEAD_DAYS,
} from "@/lib/team/separation";

/** Today in the browser's own calendar — the day the manager is standing in,
 *  which is what "last day worked: today" means to them. */
function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A blank form. `type` and `rehire` start unanswered on purpose. */
export function emptySeparation() {
  return { type: "", lastDay: localToday(), explanation: "", rehire: "" };
}

/** The request body for POST /api/workers/[id]/separation. */
export function separationPayload(form) {
  return {
    type: form.type,
    lastDay: form.lastDay,
    explanation: form.explanation,
    rehireEligible:
      form.rehire === "yes" ? true : form.rehire === "no" ? false : null,
  };
}

/** The reader's-language sentence for a parse field (lib/team/separation.js). */
export function separationErrorText(t, field) {
  if (!field) return "";
  return t(`app.separation.err.${field}`, {
    days: LAST_DAY_MAX_AHEAD_DAYS,
    min: EXPLANATION_MIN,
    max: EXPLANATION_MAX,
  });
}

/**
 * The same parse the server runs, run first in the browser so the reader
 * gets their own language and no round trip. The server still decides.
 * @returns the failing field, or null
 */
export function separationFormError(form, { hiredOn = null } = {}) {
  const parsed = parseSeparation(separationPayload(form), { hiredOn });
  return parsed.error ? parsed.field : null;
}

const INPUT =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px]";

/** The four questions. Controlled: `value` is emptySeparation()'s shape. */
export function SeparationFields({ value, onChange }) {
  const { t } = useTranslation();
  const set = (patch) => onChange({ ...value, ...patch });
  const future = value.lastDay && value.lastDay > localToday();
  return (
    <div className="space-y-3" data-separation-fields>
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          {t("app.separation.typeLabel")}
        </span>
        <select
          required
          value={value.type}
          onChange={(e) => set({ type: e.target.value })}
          className={INPUT}
          data-separation-type
        >
          <option value="" disabled>
            {t("app.separation.typeChoose")}
          </option>
          {SEPARATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(separationTypeKey(type))}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          {t("app.separation.lastDay")}
        </span>
        <input
          type="date"
          required
          value={value.lastDay}
          onChange={(e) => set({ lastDay: e.target.value })}
          className={INPUT}
        />
        {/* Said out loud because the obvious reading of a future last day is
            "they stay on payroll until then" — and they don't. */}
        {future && (
          <span className="mt-1 block text-[11px] text-amber-700 dark:text-amber-300">
            {t("app.separation.lastDayFutureHint")}
          </span>
        )}
      </label>
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          {t("app.separation.explanation")}
        </span>
        <textarea
          required
          rows={4}
          maxLength={EXPLANATION_MAX}
          value={value.explanation}
          onChange={(e) => set({ explanation: e.target.value })}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          data-separation-explanation
        />
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {t("app.separation.explanationHint")}
        </span>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          {t("app.separation.rehire")}
        </span>
        <select
          value={value.rehire}
          onChange={(e) => set({ rehire: e.target.value })}
          className={INPUT}
        >
          <option value="">{t("app.separation.rehireUnset")}</option>
          <option value="yes">{t("app.separation.rehireYes")}</option>
          <option value="no">{t("app.separation.rehireNo")}</option>
        </select>
      </label>
    </div>
  );
}

/**
 * POST the separation. Throws with a reader's-language message: a field the
 * server refused maps to the same sentence the browser check would have said.
 */
export async function submitSeparation(t, workerId, form) {
  try {
    return await fetchJson(`/api/workers/${workerId}/separation`, {
      method: "POST",
      body: separationPayload(form),
    });
  } catch (err) {
    const field = err?.data?.field;
    throw new Error(field ? separationErrorText(t, field) : errorText(t, err));
  }
}

function Modal({ children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto">
      <div className="fq-dialog-card bg-card rounded-t-2xl sm:rounded-xl w-full sm:max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

/**
 * End a worker's employment. For a worker who is already inactive with no
 * reason on file (switched off with the old checkbox), the same form records
 * how it ended — the title and the sentence say which is happening.
 *
 * @param worker  { id, name, active, hiredOn }
 * @param onDone  called after the server confirmed, with its response
 */
export function EndEmploymentDialog({ worker, onClose, onDone }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptySeparation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recordOnly = worker.active === false;

  async function submit(e) {
    e.preventDefault();
    const field = separationFormError(form, { hiredOn: worker.hiredOn });
    if (field) {
      setError(separationErrorText(t, field));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await submitSeparation(t, worker.id, form);
      await onDone?.(data);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal>
      <form onSubmit={submit} className="space-y-4" data-end-employment-dialog>
        <h2 className="font-semibold text-foreground">
          {t(
            recordOnly ? "app.separation.dialogTitleRecord" : "app.separation.dialogTitle",
            { name: worker.name },
          )}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(recordOnly ? "app.separation.dialogBodyRecord" : "app.separation.dialogBody")}
        </p>
        <SeparationFields value={form} onChange={setForm} />
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 border border-border text-foreground py-2.5 rounded-lg text-sm font-semibold min-h-[44px]"
          >
            {t("app.action.cancel")}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2 min-h-[44px]"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy
              ? t("app.separation.saving")
              : t(recordOnly ? "app.separation.recordWhy" : "app.separation.endEmployment")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Switch an inactive worker back on — the existing PATCH, behind a confirm. */
export function ReactivateDialog({ worker, onClose, onDone }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const data = await fetchJson(`/api/workers/${worker.id}`, {
        method: "PATCH",
        body: { active: true },
      });
      await onDone?.(data);
    } catch (err) {
      setError(errorText(t, err));
      setBusy(false);
    }
  }

  return (
    <Modal>
      <h2 className="font-semibold text-foreground">
        {t("app.separation.reactivateTitle", { name: worker.name })}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("app.separation.reactivateBody")}
      </p>
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="flex-1 border border-border text-foreground py-2.5 rounded-lg text-sm font-semibold min-h-[44px]"
        >
          {t("app.action.cancel")}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="flex-1 bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2 min-h-[44px]"
          data-reactivate-confirm
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {t("app.separation.reactivate")}
        </button>
      </div>
    </Modal>
  );
}
