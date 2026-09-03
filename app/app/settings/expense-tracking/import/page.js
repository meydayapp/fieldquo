// app/app/settings/expense-tracking/import/page.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Upload,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  FileWarning,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  parseCsvText,
  guessMapping,
  mappingProgress,
  detectDateFormat,
  detectSignConvention,
} from "@/lib/expenses/csvImport";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";

// ── Why parsing happens twice — once here, once on the server ─────────────
//
// This page parses the raw file client-side purely for the mapping screen:
// showing headers and a few sample rows costs nothing and nothing has been
// written yet. The moment a mapping is confirmed, the SERVER re-parses the
// same text with the same shared module (lib/expenses/csvImport.js) to build
// the review list — the browser's parse is never trusted as the record of
// what will be created. See app/api/expenses/import/preview/route.js.

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

const MAPPING_FIELDS = ["date", "description", "amount", "debit", "credit", "category"];

// ─────────────────────────────────────────────────────────────────────────
// Step 1: upload
// ─────────────────────────────────────────────────────────────────────────

function UploadStep({ onParsed }) {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = useCallback(
    async (file) => {
      setError("");
      if (!file) return;
      const text = await file.text();
      const parsed = parseCsvText(text);
      if (parsed.error === "unparseable") {
        setError(t("app.expImport.errorUnparseable", "This doesn't look like a CSV file. Export a plain .csv from your bank and try again."));
        return;
      }
      if (parsed.error === "empty_file") {
        setError(t("app.expImport.errorEmpty", "This file is empty — there's nothing to import."));
        return;
      }
      if (parsed.error === "headers_only") {
        setError(t("app.expImport.errorHeadersOnly", "This file has column headers but no data rows underneath them."));
        return;
      }
      onParsed({ filename: file.name, headers: parsed.headers, rows: parsed.rows });
    },
    [onParsed, t],
  );

  return (
    <div className="bg-card border border-border rounded-xl p-8">
      <div
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 text-center transition-colors ${
          dragOver ? "border-inverted bg-muted" : "border-border"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        <Upload size={28} className="text-muted-foreground" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
        >
          {t("app.expImport.chooseFile", "Choose a CSV file")}
        </button>
        <p className="text-sm text-muted-foreground">{t("app.expImport.dropHint", "or drag one in")}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 mt-4">
          <FileWarning size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Step 2: map columns, confirm date format + sign convention
// ─────────────────────────────────────────────────────────────────────────

function ColumnSelect({ columnIndex, mapping, onChange }) {
  const { t } = useTranslation();
  const current = MAPPING_FIELDS.find((f) => mapping[f] === columnIndex) || "";

  const options = [
    { value: "", label: t("app.expImport.colSkip", "Skip") },
    { value: "date", label: t("app.expImport.fieldDate", "Date") },
    { value: "description", label: t("app.expImport.fieldDescription", "Description") },
    { value: "amount", label: t("app.expImport.fieldAmount", "Amount") },
    { value: "debit", label: t("app.expImport.fieldDebit", "Debit (money out)") },
    { value: "credit", label: t("app.expImport.fieldCredit", "Credit (money in)") },
    { value: "category", label: t("app.expImport.fieldCategory", "Category") },
  ];

  return (
    <select
      className="w-full text-xs border border-border rounded px-2 py-1.5 bg-card"
      value={current}
      onChange={(e) => onChange(columnIndex, e.target.value || null)}
    >
      {options.map((o) => {
        // Mutually exclusive: a field already assigned to another column
        // can't be picked again, matching the reference implementation's
        // column-mapping UX. "amount" and "debit"/"credit" are mutually
        // exclusive AMOUNT SOURCES on top of that — picking one clears the
        // other, enforced in the parent's onChange.
        const takenElsewhere = o.value && mapping[o.value] !== null && mapping[o.value] !== columnIndex;
        return (
          <option key={o.value || "skip"} value={o.value} disabled={takenElsewhere}>
            {o.label}
          </option>
        );
      })}
    </select>
  );
}

function MapStep({ file, onCancel, onContinue }) {
  const { t } = useTranslation();
  const [mapping, setMapping] = useState(() => guessMapping(file.headers));
  const [defaultCategory, setDefaultCategory] = useState("Bank Import");
  const [dayFirstChoice, setDayFirstChoice] = useState(null); // resolves an "ambiguous" date format
  const [signMode, setSignMode] = useState(null);

  const setColumn = (columnIndex, field) => {
    setMapping((prev) => {
      const next = { ...prev };
      // Clear this column from whatever field it used to hold.
      for (const f of MAPPING_FIELDS) {
        if (next[f] === columnIndex) next[f] = null;
      }
      if (field) {
        next[field] = columnIndex;
        // amount vs debit/credit are mutually exclusive AMOUNT SOURCES.
        if (field === "amount") {
          next.debit = null;
          next.credit = null;
        } else if (field === "debit" || field === "credit") {
          next.amount = null;
        }
      }
      return next;
    });
  };

  const progress = mappingProgress(mapping);

  const dateSamples = useMemo(
    () => (mapping.date === null ? [] : file.rows.slice(0, 25).map((r) => r[mapping.date])),
    [file.rows, mapping.date],
  );
  const dateFormat = useMemo(() => {
    const detected = detectDateFormat(dateSamples);
    if (detected.status === "ambiguous" && dayFirstChoice !== null) {
      return { ...detected, status: "detected", kind: dayFirstChoice ? "dmy" : "mdy", dayFirst: dayFirstChoice };
    }
    return detected;
  }, [dateSamples, dayFirstChoice]);

  const amountSamples = useMemo(
    () => (mapping.amount === null ? [] : file.rows.slice(0, 25).map((r) => r[mapping.amount])),
    [file.rows, mapping.amount],
  );
  const signGuess = useMemo(() => detectSignConvention(amountSamples), [amountSamples]);
  const effectiveSignMode = mapping.amount !== null ? (signMode || signGuess.guess) : "negative_is_expense";

  const dateResolved = mapping.date !== null && dateFormat.status === "detected";
  const signResolved = mapping.amount === null || effectiveSignMode !== null;
  const canContinue = progress.complete && dateResolved && signResolved;

  const sampleRows = file.rows.slice(0, 5);

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t("app.expImport.mapTitle", "Map the columns")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.expImport.mapSubtitle", "Match each column to what it holds. Date, description, and an amount are required.")}
        </p>
      </div>

      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-muted">
            <tr>
              {file.headers.map((h, i) => (
                <th key={i} className="px-2 py-2 text-left align-top min-w-[140px]">
                  <div className="font-semibold text-foreground mb-1 truncate" title={h}>
                    {h || `(${i + 1})`}
                  </div>
                  <ColumnSelect columnIndex={i} mapping={mapping} onChange={setColumn} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sampleRows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                    {String(cell ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mapping.date !== null && (
        <div className="rounded-lg border border-border p-3 text-sm">
          {dateFormat.status === "detected" && (
            <p className="text-foreground">
              {t("app.expImport.dateStatusDetected", "Detected date format")}: <strong>{describeDateFormat(dateFormat)}</strong>
            </p>
          )}
          {dateFormat.status === "ambiguous" && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>{t("app.expImport.dateStatusAmbiguous", "This file's dates could be read either way — day first or month first. Pick which one this file uses.")}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDayFirstChoice(true)}
                  className={`flex-1 text-sm py-2 rounded-lg border ${dayFirstChoice === true ? "bg-inverted text-inverted-foreground border-inverted" : "border-border text-muted-foreground"}`}
                >
                  {t("app.expImport.dayFirst", "Day first — 13/01/2024 is 13 January")}
                </button>
                <button
                  type="button"
                  onClick={() => setDayFirstChoice(false)}
                  className={`flex-1 text-sm py-2 rounded-lg border ${dayFirstChoice === false ? "bg-inverted text-inverted-foreground border-inverted" : "border-border text-muted-foreground"}`}
                >
                  {t("app.expImport.monthFirst", "Month first — 01/13/2024 is January 13")}
                </button>
              </div>
            </div>
          )}
          {dateFormat.status === "unrecognised" && (
            <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
              <FileWarning size={16} className="mt-0.5 shrink-0" />
              <p>
                {t("app.expImport.dateStatusUnrecognised", "We couldn't recognise the dates in this column.")} {dateFormat.reason}
              </p>
            </div>
          )}
        </div>
      )}

      {mapping.amount !== null && (
        <div className="rounded-lg border border-border p-3 text-sm space-y-2">
          <p className="text-foreground">{t("app.expImport.signQuestion", "In this file, money going out (an expense) shows as:")}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSignMode("negative_is_expense")}
              className={`flex-1 text-sm py-2 rounded-lg border ${effectiveSignMode === "negative_is_expense" ? "bg-inverted text-inverted-foreground border-inverted" : "border-border text-muted-foreground"}`}
            >
              {t("app.expImport.signNegative", "Negative numbers, like -45.00")}
            </button>
            <button
              type="button"
              onClick={() => setSignMode("positive_is_expense")}
              className={`flex-1 text-sm py-2 rounded-lg border ${effectiveSignMode === "positive_is_expense" ? "bg-inverted text-inverted-foreground border-inverted" : "border-border text-muted-foreground"}`}
            >
              {t("app.expImport.signPositive", "Positive numbers, like 45.00")}
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-foreground block mb-1">
          {t("app.expImport.defaultCategory", "Default category")}
        </label>
        <input
          className={inputClass}
          value={defaultCategory}
          onChange={(e) => setDefaultCategory(e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {t("app.expImport.defaultCategoryHint", "Used for rows with no category column, or a blank category cell.")}
        </p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <button type="button" onClick={onCancel} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft size={14} /> {t("app.action.back", "Back")}
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={() =>
            onContinue({
              mapping,
              dateFormat: dateFormat.status === "detected" ? dateFormat : { ...dateFormat, dayFirst: dayFirstChoice },
              signMode: effectiveSignMode,
              defaultCategory: defaultCategory.trim() || "Bank Import",
            })
          }
          className="bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
        >
          {t("app.expImport.continueCount", "Continue ({satisfied}/{required})", { satisfied: progress.satisfied, required: progress.required })}
        </button>
      </div>
    </div>
  );
}

function describeDateFormat(descriptor) {
  if (descriptor.kind === "iso") return "YYYY-MM-DD";
  if (descriptor.kind === "ymd") return `YYYY${descriptor.separator}MM${descriptor.separator}DD`;
  if (descriptor.kind === "dmy") return `DD${descriptor.separator}MM${descriptor.separator}YYYY`;
  if (descriptor.kind === "mdy") return `MM${descriptor.separator}DD${descriptor.separator}YYYY`;
  return "";
}

// ─────────────────────────────────────────────────────────────────────────
// Step 3: review + commit
// ─────────────────────────────────────────────────────────────────────────

function ReviewStep({ file, mapping, dateFormat, signMode, defaultCategory, jobs, onBack, onDone }) {
  const money = useCompanyMoney();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null); // server response
  const [rowState, setRowState] = useState([]); // include + projectId per "ok" row (index-aligned with preview.rows)
  const [showErrors, setShowErrors] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState("");
  const [commitResult, setCommitResult] = useState(null);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/expenses/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers: file.headers, rows: file.rows, mapping, dateFormat, signMode, defaultCategory }),
      });
      if (!res.ok) {
        await reportResponseError(res, setError);
        return;
      }
      const data = await res.json();
      setPreview(data);
      setRowState(
        data.rows.map((r) => ({
          include: r.status === "ok" && !r.duplicate,
          projectId: "",
        })),
      );
    } catch {
      setError(t("app.load.network"));
    } finally {
      setLoading(false);
    }
  }, [file, mapping, dateFormat, signMode, defaultCategory, t]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
        {t("app.state.loading", "Loading…")}
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 space-y-3">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={onBack} className="text-sm font-medium text-foreground underline">
          {t("app.action.back", "Back")}
        </button>
      </div>
    );
  }
  if (!preview) return null;

  const { rows, summary } = preview;
  const okRows = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.status === "ok");
  const errorRows = rows.filter((r) => r.status === "error");
  const skippedRows = rows.filter((r) => r.status === "skipped");
  const includedCount = okRows.filter(({ i }) => rowState[i]?.include).length;

  // Four distinct honest states, per AGENTS.md: an unparseable file and a
  // no-rows file are handled one step earlier (UploadStep); these two are the
  // remaining pair — "every row is a duplicate" and "nothing survived at
  // all" read differently to a contractor even though both end at zero rows
  // to import.
  const nothingButDuplicates = summary.totalDataRows > 0 && summary.ok === 0 && summary.duplicates === summary.totalDataRows;
  const nothingToImport = okRows.length === 0;

  async function handleCommit() {
    setCommitting(true);
    setCommitError("");
    try {
      const payload = okRows
        .filter(({ i }) => rowState[i]?.include)
        .map(({ r, i }) => ({
          date: r.date,
          amount: r.amount,
          category: r.category,
          description: r.description,
          projectId: rowState[i]?.projectId || null,
          include: true,
        }));
      const res = await fetch("/api/expenses/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: idempotencyKeyRef.current, filename: file.filename, rows: payload }),
      });
      if (!res.ok) {
        await reportResponseError(res, setCommitError);
        return;
      }
      const data = await res.json();
      setCommitResult(data);
    } catch {
      setCommitError(t("app.load.network"));
    } finally {
      setCommitting(false);
    }
  }

  if (commitResult) {
    const imported = commitResult.imported ?? commitResult.batch?.rowCount ?? 0;
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
        <CheckCircle2 size={32} className="mx-auto text-green-600 dark:text-green-400" />
        <p className="text-base font-semibold text-foreground">
          {t("app.expImport.importSuccess", "Imported {n} expenses.", { n: imported })}
        </p>
        {commitResult.alreadyImported && (
          <p className="text-sm text-muted-foreground">
            {t("app.expImport.alreadyImported", "This file was already imported — nothing new was written.")}
          </p>
        )}
        {!!commitResult.skippedAsRaceDuplicate && (
          <p className="text-sm text-muted-foreground">
            {t("app.expImport.importSuccessExtra", "{n} more matched a transaction recorded since you opened this review and were skipped.", { n: commitResult.skippedAsRaceDuplicate })}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/app/settings/expense-tracking" className="bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold">
            {t("app.expImport.backToExpenses", "Back to Expense Tracking")}
          </Link>
          <button onClick={onDone} className="border border-border px-4 py-2.5 rounded-full text-sm font-semibold text-foreground">
            {t("app.expImport.importAnother", "Import another file")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-foreground">{t("app.expImport.reviewTitle", "Review before importing")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.expImport.reviewSubtitle", "Nothing is saved yet — uncheck any row you don't want, and assign a job where it applies.")}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
          <div className="rounded-lg bg-muted px-3 py-2">
            <div className="font-semibold text-foreground">{summary.ok}</div>
            <div className="text-xs text-muted-foreground">{t("app.expImport.summaryReadyShort", "ready to import")}</div>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2">
            <div className="font-semibold text-foreground">{summary.duplicates}</div>
            <div className="text-xs text-muted-foreground">{t("app.expImport.summaryDuplicatesShort", "excluded as duplicates")}</div>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2">
            <div className="font-semibold text-foreground">{summary.errors}</div>
            <div className="text-xs text-muted-foreground">{t("app.expImport.summaryErrorsShort", "couldn't be read")}</div>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2">
            <div className="font-semibold text-foreground">{summary.skipped}</div>
            <div className="text-xs text-muted-foreground">{t("app.expImport.summarySkippedShort", "deposits, not expenses")}</div>
          </div>
        </div>

        {summary.truncated && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
            {t("app.expImport.truncatedWarning", "This file has more rows than one import can handle. Only the first rows were read — split the rest into a second file.")}
          </p>
        )}
      </div>

      {nothingButDuplicates ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          {t("app.expImport.allDuplicates", "Every row in this file matches an expense already recorded for this company — there's nothing new to import.")}
        </div>
      ) : nothingToImport ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          {t("app.expImport.noneToImport", "Nothing left to import — every row was excluded, a duplicate, or couldn't be read.")}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left w-8"></th>
                  <th className="px-3 py-2 text-left">{t("app.expImport.fieldDate", "Date")}</th>
                  <th className="px-3 py-2 text-left">{t("app.expImport.fieldDescription", "Description")}</th>
                  <th className="px-3 py-2 text-left">{t("app.expImport.fieldCategory", "Category")}</th>
                  <th className="px-3 py-2 text-right">{t("app.expImport.fieldAmount", "Amount")}</th>
                  <th className="px-3 py-2 text-left">{t("app.expImport.assignJob", "Job")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {okRows.map(({ r, i }) => (
                  <tr key={i} className={rowState[i]?.include ? "" : "opacity-50"}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!rowState[i]?.include}
                        onChange={(e) =>
                          setRowState((prev) => {
                            const next = [...prev];
                            next[i] = { ...next[i], include: e.target.checked };
                            return next;
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">
                      {r.date ? new Date(r.date).toISOString().slice(0, 10) : ""}
                    </td>
                    <td className="px-3 py-2 text-foreground max-w-[280px] truncate" title={r.description}>
                      {r.description}
                      {r.duplicate && (
                        <span className="ml-2 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {t("app.expImport.duplicateBadge", "Possible duplicate")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.category}</td>
                    <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">{money(r.amount)}</td>
                    <td className="px-3 py-2">
                      <select
                        className="text-xs border border-border rounded px-2 py-1 bg-card w-full max-w-[160px]"
                        value={rowState[i]?.projectId || ""}
                        onChange={(e) =>
                          setRowState((prev) => {
                            const next = [...prev];
                            next[i] = { ...next[i], projectId: e.target.value };
                            return next;
                          })
                        }
                      >
                        <option value="">{t("app.expImport.noJob", "No job")}</option>
                        {jobs.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.title} — {j.client?.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {errorRows.length > 0 && (
        <div className="text-sm">
          <button onClick={() => setShowErrors((v) => !v)} className="text-muted-foreground hover:text-foreground underline">
            {t("app.expImport.showErrors", "Show the {n} rows that couldn't be read", { n: errorRows.length })}
          </button>
          {showErrors && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground border border-border rounded-lg p-3">
              {errorRows.map((r, idx) => (
                <li key={idx}>{r.errors.join("; ")} — {r.raw?.join(", ")}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {skippedRows.length > 0 && (
        <div className="text-sm">
          <button onClick={() => setShowSkipped((v) => !v)} className="text-muted-foreground hover:text-foreground underline">
            {t("app.expImport.showSkipped", "Show the {n} skipped rows", { n: skippedRows.length })}
          </button>
          {showSkipped && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground border border-border rounded-lg p-3">
              {skippedRows.map((r, idx) => (
                <li key={idx}>{r.description} — {r.raw?.join(", ")}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t("app.expImport.recurringNote", "Imported rows are recorded as one-time historical transactions. To have a recurring bill like rent feed the monthly burn-rate KPI, add it separately under Settings → Overhead.")}</p>

      {commitError && <p className="text-sm text-red-600 dark:text-red-400">{commitError}</p>}

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft size={14} /> {t("app.action.back", "Back")}
        </button>
        <button
          type="button"
          disabled={committing || includedCount === 0}
          onClick={handleCommit}
          className="bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
        >
          {committing
            ? t("app.expImport.importing", "Importing…")
            : t("app.expImport.importButton", "Import {n} expenses", { n: includedCount })}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

export default function ExpenseImportPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState("upload"); // upload | map | review
  const [file, setFile] = useState(null); // { filename, headers, rows }
  const [confirmed, setConfirmed] = useState(null); // { mapping, dateFormat, signMode, defaultCategory }
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setJobs(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <Link
          href="/app/settings/expense-tracking"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft size={14} /> {t("app.setExpenses.title", "Expense Tracking")}
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{t("app.expImport.title", "Import expenses from a CSV")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.expImport.subtitle", "Upload a bank statement export, map its columns, and review every row before anything is saved.")}
        </p>
      </div>

      {step === "upload" && (
        <UploadStep
          onParsed={(f) => {
            setFile(f);
            setStep("map");
          }}
        />
      )}

      {step === "map" && file && (
        <MapStep
          file={file}
          onCancel={() => setStep("upload")}
          onContinue={(cfg) => {
            setConfirmed(cfg);
            setStep("review");
          }}
        />
      )}

      {step === "review" && file && confirmed && (
        <ReviewStep
          file={file}
          {...confirmed}
          jobs={jobs}
          onBack={() => setStep("map")}
          onDone={() => {
            setFile(null);
            setConfirmed(null);
            setStep("upload");
          }}
        />
      )}
    </div>
  );
}
