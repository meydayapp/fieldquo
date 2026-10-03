// app/components/jobs/JobClientPo.js
//
// The client's PO number on the job page (Job.clientPoNumber).
//
// The job is where a PO usually lands: a property manager approves the quote,
// then their purchasing issues the PO. So this is editable at any time by
// anyone who can edit the job, and a change is copied onto the job's DRAFT
// invoices by PATCH /api/jobs/[id] (sent invoices keep theirs — they change by
// amendment only). The work order prints it.
//
// Read-only line for everyone else; nothing at all when there is no PO and
// the reader could not add one — an empty "PO #" row is not information.
"use client";

import { useState } from "react";
import { Hash, Pencil } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import ClientPoField from "@/app/components/documents/ClientPoField";
import { reportResponseError } from "@/lib/clientErrors";
import { jsonBody } from "@/lib/jsonBody";

export default function JobClientPo({ job, canEdit, onSaved }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(job?.clientPoNumber || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const current = job?.clientPoNumber || "";

  if (!job) return null;
  if (!current && !canEdit) return null;

  async function save(e) {
    e?.preventDefault?.();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ clientPoNumber: value }, "job PO number"),
      });
      if (!res.ok) {
        await reportResponseError(res, setError, t("app.clientPo.saveError"));
        return;
      }
      setEditing(false);
      await onSaved?.();
    } catch (err) {
      setError(err?.message || t("app.clientPo.saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={save} className="mt-4 pt-3 border-t border-border space-y-2" data-job-client-po-editor>
        <ClientPoField kind="job" value={value} onChange={setValue} client={job.client} framed={false} />
        <p className="text-xs text-muted-foreground">{t("app.clientPo.draftsFollow")}</p>
        {error ? <p className="text-xs text-red-700 dark:text-red-300">{error}</p> : null}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
          >
            {saving ? t("app.action.saving") : t("app.action.save")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setEditing(false);
              setValue(current);
              setError("");
            }}
            className="text-sm text-muted-foreground px-3 py-2"
          >
            {t("app.action.cancel")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-4 pt-3 border-t border-border flex items-start gap-3 text-sm" data-job-client-po>
      <Hash size={16} className="text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{t("app.clientPo.label")}</div>
        <div className="text-foreground font-medium break-words">
          {current || <span className="text-muted-foreground font-normal">{t("app.clientPo.none")}</span>}
        </div>
        {!current && job.client?.requiresPo ? (
          <div className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
            {t("app.clientPo.requiredHint", { client: job.client?.name || "" })}
          </div>
        ) : null}
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={() => {
            setValue(current);
            setEditing(true);
          }}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-foreground underline underline-offset-2"
        >
          <Pencil size={12} /> {t("app.action.edit")}
        </button>
      )}
    </div>
  );
}
