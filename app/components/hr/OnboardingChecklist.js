"use client";

// app/components/hr/OnboardingChecklist.js
//
// A person's checklist, from either side.
//
//   mode="self"     — /app/me/onboarding: big tap targets, each row opens
//                     the thing it asks for (a document → My documents, a
//                     policy → My policies, a tax form → the form). A task
//                     is ticked here; the other three tick themselves when
//                     the evidence lands (lib/onboarding/run.js).
//   mode="manager"  — the person's file: the same rows with who-did-what,
//                     a Start button when there is no run, and the manager
//                     ticks tasks on the person's behalf ("PPE issued").
//                     A document or form row carries an Upload button: the
//                     manager hands the file in FOR the person (the paper
//                     TD1, the photocopied licence), it is filed as an
//                     ordinary document — same upload, same Documents card —
//                     and the row ticks from it and shows it. A policy row
//                     has no button: only the person can sign it.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, CheckCircle2, Circle, FileBadge, ScrollText, FileSpreadsheet, ChevronRight, Upload } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import { fetchJson, errorText } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { uploadFile } from "@/lib/media/uploadClient";
import { hrDocumentOpenPath } from "@/lib/hr/documents";
import ListState from "@/app/components/ListState";

const ICONS = { document: FileBadge, policy: ScrollText, form: FileSpreadsheet };

// A hand-in is a PDF or a photo of the page — not a video, which the shared
// CLIENT_MEDIA_ACCEPT would offer. The server refuses the same (lib/onboarding
// /run.js checkHandIn).
const HAND_IN_ACCEPT = "application/pdf,image/*";

function selfHref(item) {
  if (item.kind === "document") return "/app/me/documents";
  if (item.kind === "policy") return "/app/me/policies";
  if (item.kind === "form") return `/app/me/tax-forms?kind=${encodeURIComponent(item.formKind)}`;
  return null;
}

export default function OnboardingChecklist({ mode = "self", workerId = null, onChanged }) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const base = mode === "self" ? "/api/hr/me/onboarding" : `/api/hr/workers/${workerId}/onboarding`;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList(base);
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  const run = mode === "self" ? data?.run : data?.runs?.[0] || null;

  async function tick(item, done) {
    setBusy(item.key);
    setError("");
    try {
      const url = mode === "self" ? `/api/hr/me/onboarding/items/${encodeURIComponent(item.key)}` : `/api/hr/onboarding/runs/${run.id}/items/${encodeURIComponent(item.key)}`;
      await fetchJson(url, { method: "PATCH", body: { done } });
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(null);
    }
  }

  // One hidden picker for every row; the row that opened it is remembered.
  const fileRef = useRef(null);
  const pendingItem = useRef(null);

  function pickFileFor(item) {
    pendingItem.current = item;
    setError("");
    fileRef.current?.click();
  }

  async function handIn(e) {
    const file = e.target.files?.[0];
    const item = pendingItem.current;
    e.target.value = "";
    if (!file || !item || !run) return;
    setBusy(item.key);
    setError("");
    try {
      let uploaded;
      try {
        uploaded = await uploadFile(file, { purpose: "hr" });
      } catch (err) {
        showError(err?.message || t("app.hr.docs.uploadError"));
        return;
      }
      await fetchJson(`/api/hr/onboarding/runs/${run.id}/items/${encodeURIComponent(item.key)}/document`, {
        method: "POST",
        body: {
          // A form keeps the checklist's wording as its title ("Fill in the
          // provincial TD1") so the Documents card says WHICH form it is; a
          // document keeps its file name, as the Documents card would.
          title: item.kind === "form" ? item.label : uploaded.filename || file.name,
          fileUrl: uploaded.url,
          sizeBytes: file.size,
          mimeType: file.type || null,
        },
      });
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(null);
      pendingItem.current = null;
    }
  }

  async function start() {
    setBusy("start");
    setError("");
    try {
      await fetchJson(base, { method: "POST", body: {} });
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(null);
    }
  }

  const p = run?.progress;

  return (
    <section className="bg-card border border-border rounded-xl p-5" data-hr-onboarding>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <ClipboardCheck size={16} /> {t("app.hr.onboarding.title")}
        </h2>
        {p && (
          <span className={`text-xs rounded-full px-2.5 py-1 border ${run.completedAt ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "border-border bg-muted text-muted-foreground"}`} data-hr-progress>
            {run.completedAt ? t("app.hr.onboarding.completedOn", { date: formatDate(run.completedAt) }) : t("app.hr.onboarding.progress", { done: p.done, total: p.total })}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-700 dark:text-red-300 mb-2">{error}</p>}

      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={data !== null && !run}
        onRetry={load}
        empty={
          mode === "self" ? (
            <p className="text-sm text-muted-foreground">{t("app.hr.onboarding.noneSelf")}</p>
          ) : (
            <div className="text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-3">
              <span>{t("app.hr.onboarding.noneManager")}</span>
              <button type="button" onClick={start} disabled={busy === "start"} className="bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold min-h-[44px] w-fit disabled:opacity-60" data-hr-start-onboarding>
                {t("app.hr.onboarding.start")}
              </button>
            </div>
          )
        }
      >
        {run && (
          <>
            {mode === "self" && !run.completedAt && (
              <p className="text-sm text-muted-foreground mb-3">{t("app.hr.onboarding.selfIntro", { company: data?.company?.name || "" })}</p>
            )}
            {mode === "manager" && <input ref={fileRef} type="file" accept={HAND_IN_ACCEPT} className="hidden" onChange={handIn} data-hr-item-file-input />}
            <ul className="divide-y divide-border" data-hr-items>
              {run.items.map((item) => {
                const done = item.status === "done";
                const Icon = ICONS[item.kind] || null;
                const href = mode === "self" && !done ? selfHref(item) : null;
                const meta = [
                  item.required === false ? t("app.hr.onboarding.optional") : null,
                  item.dueAt && !done ? (item.overdue ? t("app.hr.onboarding.overdueSince", { date: formatDate(item.dueAt) }) : t("app.hr.onboarding.dueBy", { date: formatDate(item.dueAt) })) : null,
                  done && item.doneAt ? t("app.hr.onboarding.doneOn", { date: formatDate(item.doneAt) }) + (item.doneByName ? ` · ${item.doneByName}` : "") : null,
                  item.kind === "policy" && item.policyTitle ? item.policyTitle : null,
                ].filter(Boolean);
                // Manager side: a document or form row takes a file. The
                // icon that used to sit here only decorated the row; it is
                // now the button's icon, so nothing looks clickable that
                // isn't.
                const canHandIn = mode === "manager" && (item.kind === "document" || item.kind === "form");
                const file = mode === "manager" && item.documentId ? data?.files?.[item.documentId] || null : null;
                const formPdf = mode === "manager" && item.kind === "form" && item.taxFormId ? `/api/hr/tax-forms/${encodeURIComponent(item.taxFormId)}/pdf` : null;
                const row = (
                  <div className="flex items-center gap-3 py-3 min-h-[56px]">
                    {done ? <CheckCircle2 size={22} className="text-emerald-600 shrink-0" /> : <Circle size={22} className="text-muted-foreground shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <span className={`block text-sm font-medium ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.label}</span>
                      <span className={`block text-xs ${item.overdue && !done ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>
                        {t(`app.hr.onboarding.kind.${item.kind}`)}
                        {meta.length ? ` · ${meta.join(" · ")}` : ""}
                      </span>
                      {file ? (
                        <span className="block text-xs text-muted-foreground mt-0.5" data-hr-item-file>
                          <a href={hrDocumentOpenPath(file.id)} target="_blank" rel="noopener noreferrer" className="text-foreground underline break-all">
                            {file.title}
                          </a>
                          {" · "}
                          {file.uploadedByName
                            ? t("app.hr.onboarding.filedBy", { name: file.uploadedByName, date: formatDate(file.createdAt) })
                            : t("app.hr.docs.filedOn", { date: formatDate(file.createdAt) })}
                        </span>
                      ) : null}
                      {formPdf ? (
                        <a href={formPdf} target="_blank" rel="noopener noreferrer" className="block text-xs text-foreground underline mt-0.5" data-hr-item-form>
                          {t("app.hr.onboarding.openForm")}
                        </a>
                      ) : null}
                    </div>
                    {canHandIn ? (
                      <button
                        type="button"
                        onClick={() => pickFileFor(item)}
                        disabled={busy === item.key}
                        aria-label={t("app.hr.onboarding.uploadFor", { label: item.label })}
                        className="inline-flex items-center gap-1.5 text-xs border border-border rounded-full px-3 py-1.5 min-h-[36px] shrink-0 disabled:opacity-60"
                        data-hr-item-upload
                      >
                        {Icon ? <Icon size={14} /> : <Upload size={14} />}
                        {busy === item.key ? t("app.hr.docs.uploading") : done ? t("app.hr.onboarding.replace") : t("app.hr.onboarding.upload")}
                      </button>
                    ) : mode === "self" && Icon && !done ? (
                      <Icon size={16} className="text-muted-foreground shrink-0" />
                    ) : null}
                    {href ? <ChevronRight size={18} className="text-muted-foreground shrink-0" /> : null}
                  </div>
                );
                return (
                  <li key={item.key} data-hr-item data-hr-item-status={item.status}>
                    {item.kind === "task" && !run.completedAt ? (
                      <button type="button" disabled={busy === item.key} onClick={() => tick(item, !done)} className="w-full text-left disabled:opacity-60" data-hr-task>
                        {row}
                      </button>
                    ) : href ? (
                      <Link href={href} className="block">
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
            {mode === "manager" && !run.completedAt && (
              <p className="text-xs text-muted-foreground mt-3">{t("app.hr.onboarding.managerHint")}</p>
            )}
          </>
        )}
      </ListState>
    </section>
  );
}
