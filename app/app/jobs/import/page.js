// app/app/jobs/import/page.js
//
// Past jobs — data entry for work that was won, done and paid before the
// company used FieldQuo, so the year's overview is whole.
//
// The owner's ask (2026-09-08): "For importing older jobs that have already
// been paid — is there an option so that we don't send email to those
// clients? More like data entry." So the one promise this screen makes, in
// its own words at the top, is that nothing goes to the client. The server
// keeps it — lib/jobs/importPastJob.js imports no sender, and every cron and
// send button skips the rows this creates — and this page only ever talks to
// /api/jobs/import.
//
// Two ways in: one job at a time, or a CSV reviewed row by row before
// anything is written (the shape app/app/settings/expense-tracking/import
// uses, for the reason AGENTS.md gives: N rows are never written straight
// from a file). The CSV is parsed in the browser only to SHOW the review;
// the server re-validates every row against its own data before writing.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Download, FileWarning, Loader2, Upload } from "lucide-react";
import BackToHome from "@/app/components/BackToHome";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchArray } from "@/lib/loadState";
import {
  PAST_JOB_COLUMNS,
  PAST_JOB_PAYMENT_METHODS,
  MAX_PAST_JOB_ROWS,
  parsePastJobsCsv,
} from "@/lib/jobs/pastJobImport";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";
const labelClass = "text-sm font-medium text-foreground block mb-1";

const EMPTY_FORM = {
  clientId: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  clientAddress: "",
  service: "",
  description: "",
  startDate: "",
  endDate: "",
  amount: "",
  taxApplied: null, // null = the company default, learned from the preview route
  paidDate: "",
  paymentMethod: "e_transfer",
  labourCost: "",
  materialsCost: "",
  quoteNumber: "",
  invoiceNumber: "",
};

/** The per-field refusal codes the server returns, as sentences. */
function useErrorText() {
  const { t } = useTranslation();
  return useCallback(
    (code) => {
      switch (code) {
        case "required":
          return t("app.pastJobs.err.required", "Required.");
        case "bad_email":
          return t("app.pastJobs.err.badEmail", "That doesn't look like an email address.");
        case "bad_date":
          return t("app.pastJobs.err.badDate", "Use a real date, written YYYY-MM-DD.");
        case "end_before_start":
          return t("app.pastJobs.err.endBeforeStart", "The job can't end before it starts.");
        case "bad_amount":
          return t("app.pastJobs.err.badAmount", "That isn't a number.");
        case "not_positive":
          return t("app.pastJobs.err.notPositive", "The amount has to be more than zero.");
        case "negative_amount":
          return t("app.pastJobs.err.negativeAmount", "A cost can't be negative.");
        case "bad_yes_no":
          return t("app.pastJobs.err.badYesNo", "Write yes or no, or leave it blank for the company default.");
        case "future":
          return t("app.pastJobs.err.futurePaid", "A past job can't be paid in the future.");
        case "before_start":
          return t("app.pastJobs.err.paidBeforeStart", "Paid before the job started — this screen records jobs paid in full after the work.");
        case "unknown_method":
          return t("app.pastJobs.err.unknownMethod", "Use cash, cheque, e_transfer or card_elsewhere.");
        case "live_format":
          return t("app.pastJobs.err.liveFormat", "That looks like a number FieldQuo will allocate this year. Leave it blank, or use your own old reference.");
        case "taken":
          return t("app.pastJobs.err.taken", "That number is already in use.");
        case "unknown_service":
          return t("app.pastJobs.err.unknownService", "No service on file with that name. Use one of your services, or leave it blank.");
        case "client_not_found":
          return t("app.pastJobs.err.clientNotFound", "That client wasn't found.");
        default:
          return t("app.pastJobs.err.generic", "This row can't be entered as a past job.");
      }
    },
    [t],
  );
}

function useColumnHelp() {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      clientName: t("app.pastJobs.col.clientName", "Who the job was for. Matched to an existing client by name; a new client is created otherwise. Nothing is sent to them."),
      clientEmail: t("app.pastJobs.col.clientEmail", "Optional. Saved on a new client; used to tell two clients with the same name apart."),
      clientPhone: t("app.pastJobs.col.clientPhone", "Optional. Saved on a new client."),
      clientAddress: t("app.pastJobs.col.clientAddress", "Optional. Saved on a new client."),
      service: t("app.pastJobs.col.service", "Optional. One of your services, by name."),
      description: t("app.pastJobs.col.description", "What was done — becomes the one line on the quote and invoice."),
      startDate: t("app.pastJobs.col.startDate", "When the work started, YYYY-MM-DD."),
      endDate: t("app.pastJobs.col.endDate", "Optional. When the work ended, YYYY-MM-DD. Blank means the same day it started."),
      amount: t("app.pastJobs.col.amount", "What you charged, before tax."),
      taxApplied: t("app.pastJobs.col.taxApplied", "yes or no. Blank uses your company default. Tax is worked out from your rate on the job date."),
      paidDate: t("app.pastJobs.col.paidDate", "When it was paid in full, YYYY-MM-DD. Not in the future, not before the job started."),
      paymentMethod: t("app.pastJobs.col.paymentMethod", "cash, cheque, e_transfer or card_elsewhere."),
      labourCost: t("app.pastJobs.col.labourCost", "Optional. What the labour cost you — recorded as an expense on the job."),
      materialsCost: t("app.pastJobs.col.materialsCost", "Optional. What the materials cost you — recorded as an expense on the job."),
      quoteNumber: t("app.pastJobs.col.quoteNumber", "Optional. Your old quote reference. Blank gets a past-job number like Q-2024-H0001."),
      invoiceNumber: t("app.pastJobs.col.invoiceNumber", "Optional. Your old invoice number. Blank gets a past-job number like INV-2024-H0001. Re-uploading a row with the same number never enters it twice."),
    }),
    [t],
  );
}

function usePaymentMethodLabels() {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      cash: t("app.pastJobs.method.cash", "Cash"),
      cheque: t("app.pastJobs.method.cheque", "Cheque"),
      e_transfer: t("app.pastJobs.method.eTransfer", "E-Transfer"),
      card_elsewhere: t("app.pastJobs.method.cardElsewhere", "Card (taken elsewhere)"),
    }),
    [t],
  );
}

// ─────────────────────────────────────────────────────────────────────────
// One past job
// ─────────────────────────────────────────────────────────────────────────

function SingleJobForm({ clients, categories, defaultTaxApplied }) {
  const { t } = useTranslation();
  const money = useCompanyMoney();
  const errorText = useErrorText();
  const methodLabels = usePaymentMethodLabels();
  const [form, setForm] = useState(EMPTY_FORM);
  const [newClient, setNewClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [result, setResult] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const taxApplied = form.taxApplied === null ? Boolean(defaultTaxApplied) : form.taxApplied;

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});
    setResult(null);
    try {
      const row = {
        ...form,
        clientId: newClient ? "" : form.clientId,
        clientName: newClient ? form.clientName : "",
        clientEmail: newClient ? form.clientEmail : "",
        clientPhone: newClient ? form.clientPhone : "",
        clientAddress: newClient ? form.clientAddress : "",
        taxApplied: taxApplied ? "yes" : "no",
      };
      const res = await fetch("/api/jobs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: [row] }),
      });
      if (!res.ok) {
        let data = null;
        try {
          data = await res.clone().json();
        } catch {
          data = null;
        }
        if (Array.isArray(data?.rows) && data.rows[0]?.errors?.length) {
          const next = {};
          for (const err of data.rows[0].errors) next[err.field] = errorText(err.code);
          setFieldErrors(next);
          setError(t("app.pastJobs.fixFields", "Check the fields marked below."));
        } else {
          await reportResponseError(res, setError);
        }
        return;
      }
      const data = await res.json();
      const outcome = data.results?.[0];
      if (outcome?.status === "created") {
        setResult(outcome);
        setForm(EMPTY_FORM);
      } else if (outcome?.status === "skipped") {
        setError(t("app.pastJobs.alreadyOnFile", "This job is already on file — nothing was entered twice."));
      } else {
        if (outcome?.field) setFieldErrors({ [outcome.field]: errorText(outcome.error) });
        setError(errorText(outcome?.error));
      }
    } catch {
      setError(t("app.load.network"));
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (key) => fieldErrors[key] && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors[key]}</p>;

  return (
    <form onSubmit={submit} className="bg-card border border-border rounded-xl p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t("app.pastJobs.oneTitle", "Enter one past job")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.pastJobs.oneSubtitle", "A quote, a completed job and a paid invoice are created together, dated as you type them. No message goes to the client.")}
        </p>
      </div>

      {result && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-4 py-3 text-sm text-green-800 dark:text-green-300 space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} />
            {t("app.pastJobs.entered", "Entered {title} — {total} paid {date}.", { title: result.jobTitle, total: money(result.total), date: result.paidDate })}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/app/jobs/${result.jobId}`} className="underline">{t("app.pastJobs.openJob", "Open the job")}</Link>
            <Link href={`/app/invoices/${result.invoiceId}`} className="underline">{result.invoiceNumber}</Link>
            <Link href={`/app/quotes/${result.quoteId}`} className="underline">{result.quoteNumber}</Link>
            {result.clientCreated && <span>{t("app.pastJobs.clientCreated", "New client added: {name}", { name: result.clientName })}</span>}
          </div>
        </div>
      )}

      {/* Client */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className={labelClass}>{t("app.pastJobs.client", "Client")}</label>
          <button type="button" onClick={() => setNewClient((v) => !v)} className="text-xs underline text-muted-foreground">
            {newClient ? t("app.pastJobs.pickExisting", "Pick an existing client") : t("app.pastJobs.newClient", "New client")}
          </button>
        </div>
        {newClient ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <input className={inputClass} placeholder={t("app.pastJobs.clientNamePh", "Name")} value={form.clientName} onChange={set("clientName")} />
              {fieldError("clientName")}
            </div>
            <div>
              <input className={inputClass} placeholder={t("app.pastJobs.clientEmailPh", "Email (optional)")} value={form.clientEmail} onChange={set("clientEmail")} />
              {fieldError("clientEmail")}
            </div>
            <input className={inputClass} placeholder={t("app.pastJobs.clientPhonePh", "Phone (optional)")} value={form.clientPhone} onChange={set("clientPhone")} />
            <input className={inputClass} placeholder={t("app.pastJobs.clientAddressPh", "Address (optional)")} value={form.clientAddress} onChange={set("clientAddress")} />
          </div>
        ) : (
          <div>
            <select className={inputClass} value={form.clientId} onChange={set("clientId")}>
              <option value="">{t("app.pastJobs.chooseClient", "Choose a client…")}</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.email ? ` — ${c.email}` : ""}
                </option>
              ))}
            </select>
            {clients === null && <p className="text-xs text-muted-foreground mt-1">{t("app.state.loading", "Loading…")}</p>}
            {fieldError("clientName")}
            {fieldError("clientId")}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("app.pastJobs.service", "Service")}</label>
          <select className={inputClass} value={form.service} onChange={set("service")}>
            <option value="">{t("app.pastJobs.noService", "Not specified")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          {fieldError("service")}
        </div>
        <div>
          <label className={labelClass}>{t("app.pastJobs.paymentMethod", "Paid by")}</label>
          <select className={inputClass} value={form.paymentMethod} onChange={set("paymentMethod")}>
            {PAST_JOB_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{methodLabels[m]}</option>
            ))}
          </select>
          {fieldError("paymentMethod")}
        </div>
      </div>

      <div>
        <label className={labelClass}>{t("app.pastJobs.description", "What was done")}</label>
        <input className={inputClass} value={form.description} onChange={set("description")} placeholder={t("app.pastJobs.descriptionPh", "e.g. Repaint living room and hallway")} />
        {fieldError("description")}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("app.pastJobs.startDate", "Job started")}</label>
          <input type="date" className={inputClass} value={form.startDate} onChange={set("startDate")} />
          {fieldError("startDate")}
        </div>
        <div>
          <label className={labelClass}>{t("app.pastJobs.endDate", "Job ended")}</label>
          <input type="date" className={inputClass} value={form.endDate} onChange={set("endDate")} />
          {fieldError("endDate")}
        </div>
        <div>
          <label className={labelClass}>{t("app.pastJobs.paidDate", "Paid on")}</label>
          <input type="date" className={inputClass} value={form.paidDate} onChange={set("paidDate")} />
          {fieldError("paidDate")}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("app.pastJobs.amount", "Amount charged, before tax")}</label>
          <input inputMode="decimal" className={inputClass} value={form.amount} onChange={set("amount")} placeholder="2400.00" />
          {fieldError("amount")}
        </div>
        <div>
          <label className={labelClass}>{t("app.pastJobs.labourCost", "Labour cost (optional)")}</label>
          <input inputMode="decimal" className={inputClass} value={form.labourCost} onChange={set("labourCost")} />
          {fieldError("labourCost")}
        </div>
        <div>
          <label className={labelClass}>{t("app.pastJobs.materialsCost", "Materials cost (optional)")}</label>
          <input inputMode="decimal" className={inputClass} value={form.materialsCost} onChange={set("materialsCost")} />
          {fieldError("materialsCost")}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={taxApplied} onChange={(e) => setForm((f) => ({ ...f, taxApplied: e.target.checked }))} />
        {t("app.pastJobs.taxApplied", "Tax was charged on this job")}
        <span className="text-xs text-muted-foreground">
          {t("app.pastJobs.taxHint", "Worked out from your tax rate on the job date.")}
        </span>
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("app.pastJobs.quoteNumber", "Your quote reference (optional)")}</label>
          <input className={inputClass} value={form.quoteNumber} onChange={set("quoteNumber")} />
          {fieldError("quoteNumber")}
        </div>
        <div>
          <label className={labelClass}>{t("app.pastJobs.invoiceNumber", "Your invoice number (optional)")}</label>
          <input className={inputClass} value={form.invoiceNumber} onChange={set("invoiceNumber")} />
          {fieldError("invoiceNumber")}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {t("app.pastJobs.enterButton", "Enter this past job")}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Many at once — CSV, reviewed before anything is written
// ─────────────────────────────────────────────────────────────────────────

function CsvSection() {
  const { t } = useTranslation();
  const money = useCompanyMoney();
  const errorText = useErrorText();
  const help = useColumnHelp();
  const inputRef = useRef(null);
  const [showColumns, setShowColumns] = useState(false);
  const [file, setFile] = useState(null); // { filename, rows }
  const [parseError, setParseError] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState(null);

  const handleFile = useCallback(
    async (f) => {
      setParseError("");
      setPreview(null);
      setCommitResult(null);
      setError("");
      if (!f) return;
      const parsed = parsePastJobsCsv(await f.text());
      if (parsed.error === "unparseable") return setParseError(t("app.pastJobs.csv.unparseable", "This doesn't look like a CSV file."));
      if (parsed.error === "empty_file") return setParseError(t("app.pastJobs.csv.empty", "This file is empty."));
      if (parsed.error === "headers_only") return setParseError(t("app.pastJobs.csv.headersOnly", "This file has headers but no rows."));
      if (parsed.error === "missing_columns") {
        return setParseError(
          t("app.pastJobs.csv.missingColumns", "Missing required columns: {columns}. Download the template to see the expected headers.", {
            columns: parsed.missingHeaders.join(", "),
          }),
        );
      }
      setFile({ filename: f.name, rows: parsed.rows });
      setLoading(true);
      try {
        const res = await fetch("/api/jobs/import/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: parsed.rows }),
        });
        if (!res.ok) {
          await reportResponseError(res, setError);
          return;
        }
        setPreview(await res.json());
      } catch {
        setError(t("app.load.network"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  async function commit() {
    if (!preview || !file) return;
    setCommitting(true);
    setError("");
    try {
      const rows = preview.rows.filter((r) => r.status === "ok").map((r) => file.rows[r.index]);
      const res = await fetch("/api/jobs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok && res.status !== 207) {
        await reportResponseError(res, setError);
        return;
      }
      setCommitResult(await res.json());
    } catch {
      setError(t("app.load.network"));
    } finally {
      setCommitting(false);
    }
  }

  const okCount = preview?.summary?.ok ?? 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("app.pastJobs.csvTitle", "Or upload a year at once")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.pastJobs.csvSubtitle", "One row per job, up to {max} rows. Every row is checked and shown to you before anything is saved; a row already on file is never entered twice.", { max: MAX_PAST_JOB_ROWS })}
          </p>
        </div>
        <a href="/api/jobs/import/template" className="inline-flex items-center gap-1.5 border border-border px-3 py-2 rounded-full text-sm font-semibold text-foreground">
          <Download size={14} /> {t("app.pastJobs.template", "Download the template")}
        </a>
      </div>

      <button type="button" onClick={() => setShowColumns((v) => !v)} className="text-sm underline text-muted-foreground">
        {showColumns ? t("app.pastJobs.hideColumns", "Hide the column guide") : t("app.pastJobs.showColumns", "What each column means")}
      </button>
      {showColumns && (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="min-w-full text-xs">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">{t("app.pastJobs.colHeader", "Column")}</th>
                <th className="px-3 py-2 text-left">{t("app.pastJobs.colRequired", "Required")}</th>
                <th className="px-3 py-2 text-left">{t("app.pastJobs.colMeaning", "Meaning")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PAST_JOB_COLUMNS.map((c) => (
                <tr key={c.key}>
                  <td className="px-3 py-2 font-mono text-foreground whitespace-nowrap">{c.header}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.required ? t("app.pastJobs.yes", "yes") : ""}</td>
                  <td className="px-3 py-2 text-muted-foreground">{help[c.key]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 text-center">
        <Upload size={24} className="text-muted-foreground" />
        <button type="button" onClick={() => inputRef.current?.click()} className="bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold">
          {t("app.pastJobs.chooseFile", "Choose a CSV file")}
        </button>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        {file && <p className="text-xs text-muted-foreground">{file.filename}</p>}
      </div>

      {parseError && (
        <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
          <FileWarning size={16} className="mt-0.5 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">{t("app.pastJobs.checking", "Checking every row…")}</p>}

      {commitResult ? (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-4 py-3 text-sm text-green-800 dark:text-green-300 space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} />
            {t("app.pastJobs.csv.done", "Entered {n} past jobs.", { n: commitResult.imported })}
          </div>
          {commitResult.skipped > 0 && <p>{t("app.pastJobs.csv.skipped", "{n} were already on file and were left alone.", { n: commitResult.skipped })}</p>}
          {commitResult.failed > 0 && (
            <p className="text-red-700 dark:text-red-300">
              {t("app.pastJobs.csv.failed", "{n} could not be written. Upload the file again — the ones that landed will be skipped.", { n: commitResult.failed })}
            </p>
          )}
          <Link href="/app/jobs" className="underline">{t("app.jobs.title")}</Link>
        </div>
      ) : (
        preview && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="font-semibold text-foreground">{preview.summary.ok}</div>
                <div className="text-xs text-muted-foreground">{t("app.pastJobs.sum.ready", "ready to enter")}</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="font-semibold text-foreground">{preview.summary.duplicates}</div>
                <div className="text-xs text-muted-foreground">{t("app.pastJobs.sum.duplicates", "already on file")}</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="font-semibold text-foreground">{preview.summary.errors}</div>
                <div className="text-xs text-muted-foreground">{t("app.pastJobs.sum.errors", "need fixing")}</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="font-semibold text-foreground">{preview.summary.newClients}</div>
                <div className="text-xs text-muted-foreground">{t("app.pastJobs.sum.newClients", "new clients")}</div>
              </div>
            </div>
            {preview.summary.truncated && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t("app.pastJobs.csv.truncated", "Only the first {max} rows were read. Put the rest in a second file.", { max: MAX_PAST_JOB_ROWS })}
              </p>
            )}
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="min-w-full text-xs">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">{t("app.pastJobs.client", "Client")}</th>
                    <th className="px-3 py-2 text-left">{t("app.pastJobs.description", "What was done")}</th>
                    <th className="px-3 py-2 text-left">{t("app.pastJobs.startDate", "Job started")}</th>
                    <th className="px-3 py-2 text-right">{t("app.pastJobs.amountShort", "Before tax")}</th>
                    <th className="px-3 py-2 text-left">{t("app.pastJobs.paidDate", "Paid on")}</th>
                    <th className="px-3 py-2 text-left">{t("app.pastJobs.status", "Status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.rows.map((r) => (
                    <tr key={r.index} className={r.status === "ok" ? "" : "opacity-70"}>
                      <td className="px-3 py-2 text-muted-foreground">{r.index + 1}</td>
                      <td className="px-3 py-2 text-foreground whitespace-nowrap">
                        {r.client?.name || file?.rows[r.index]?.clientName || ""}
                        {r.client && !r.client.existing && (
                          <span className="ml-1 text-muted-foreground">({t("app.pastJobs.newBadge", "new")})</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-foreground max-w-[260px] truncate" title={r.value?.description || ""}>{r.value?.description || file?.rows[r.index]?.description || ""}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.value?.startDate || file?.rows[r.index]?.startDate || ""}</td>
                      <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{r.value?.amount != null ? money(r.value.amount) : file?.rows[r.index]?.amount || ""}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.value?.paidDate || file?.rows[r.index]?.paidDate || ""}</td>
                      <td className="px-3 py-2">
                        {r.status === "ok" && <span className="text-green-700 dark:text-green-400">{t("app.pastJobs.rowOk", "Ready")}</span>}
                        {r.status === "duplicate" && <span className="text-amber-700 dark:text-amber-400">{t("app.pastJobs.rowDuplicate", "Already on file")}</span>}
                        {r.status === "error" && (
                          <ul className="text-red-600 dark:text-red-400 space-y-0.5">
                            {r.errors.map((e, i) => (
                              <li key={i}>
                                <span className="font-mono">{PAST_JOB_COLUMNS.find((c) => c.key === e.field)?.header || e.field}</span>: {errorText(e.code)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {preview.summary.errors > 0
                  ? t("app.pastJobs.csv.fixFirst", "Rows that need fixing are left out. Fix them in the file and upload again to enter them.")
                  : t("app.pastJobs.csv.nothingSent", "Nothing is sent to any client.")}
              </p>
              <button type="button" onClick={commit} disabled={committing || okCount === 0} className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40">
                {committing && <Loader2 size={14} className="animate-spin" />}
                {t("app.pastJobs.csv.commit", "Enter {n} past jobs", { n: okCount })}
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

export default function PastJobsPage() {
  const { t } = useTranslation();
  const [clients, setClients] = useState(null);
  const [categories, setCategories] = useState([]);
  const [defaultTaxApplied, setDefaultTaxApplied] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [clientsResult, categoriesResult] = await Promise.all([
        fetchArray("/api/clients"),
        fetchArray("/api/settings/service-categories"),
      ]);
      if (cancelled) return;
      setClients(clientsResult.ok ? clientsResult.data : []);
      setCategories(categoriesResult.ok ? categoriesResult.data.filter((c) => c.enabled) : []);
      // The company default for "tax applied", from the same server rule the
      // import uses (an empty preview answers with the default and nothing else).
      try {
        const res = await fetch("/api/jobs/import/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: [] }),
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && typeof data?.summary?.defaultTaxApplied === "boolean") setDefaultTaxApplied(data.summary.defaultTaxApplied);
        }
      } catch {
        // The checkbox keeps its "yes" default — the same default the
        // Quote and Invoice columns carry — and the person can untick it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <BackToHome />
      <div>
        <Link href="/app/jobs" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft size={14} /> {t("app.jobs.title")}
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{t("app.pastJobs.title", "Past jobs")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.pastJobs.subtitle", "Record jobs you did and were paid for before using FieldQuo, so the year's numbers are whole. This is data entry: nothing is emailed, texted or called to the client, now or later.")}
        </p>
      </div>

      <SingleJobForm clients={clients} categories={categories} defaultTaxApplied={defaultTaxApplied} />
      <CsvSection />
    </div>
  );
}
