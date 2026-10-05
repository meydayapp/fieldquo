// app/app/marketing/spend/GoogleAdsImportDialog.js
//
// "Import Google Ads report" on Marketing › Spend — upload the report a
// contractor downloads from Google Ads, see exactly what it will do, then
// import. app/api/marketing-spend/google-ads-import/route.js does the work;
// this dialog only ever sends the FILE (twice: preview, then commit) and
// never a row or an amount, so what is written is what the server read.
//
// Three honest stops before anything is written:
//   • the file is refused with the reason (wrong segment, no Cost column…);
//   • a report with no currency column asks which currency the account bills
//     in — no default is chosen for the person;
//   • rows that look like spend already logged are listed, and skipped unless
//     the box is unticked.
"use client";

import { useState } from "react";
import { X, Upload } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { formatDateOnly } from "@/lib/format/companyDate";

const COMMON_CURRENCIES = ["CAD", "USD", "EUR", "GBP", "AUD", "NZD", "CHF", "MXN"];

function post(file, { mode, currency, skipDuplicates }) {
  const form = new FormData();
  form.set("file", file);
  form.set("mode", mode);
  if (currency) form.set("currency", currency);
  form.set("skipDuplicates", skipDuplicates ? "1" : "0");
  return fetchJson("/api/marketing-spend/google-ads-import", { method: "POST", body: form });
}

export default function GoogleAdsImportDialog({ companyCurrency, onClose, onImported }) {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [currency, setCurrency] = useState("");
  const [needsCurrency, setNeedsCurrency] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const money = (n, cur) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || companyCurrency || "USD" }).format(n);
    } catch {
      return String(n);
    }
  };

  function errorSentence(err) {
    const code = err?.data?.code || err?.code;
    if (code && code !== "needs_currency") return t(`app.googleAds.import.error.${code}`, err.message);
    return err?.message || t("app.googleAds.import.error.generic");
  }

  async function runPreview(nextSkip = skipDuplicates) {
    if (!file) return;
    if (needsCurrency && !currency) {
      setError(t("app.googleAds.import.currencyRequired"));
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await post(file, { mode: "preview", currency, skipDuplicates: nextSkip });
      setPreview(data);
    } catch (err) {
      if (err?.data?.needsCurrency) {
        setNeedsCurrency(true);
        setPreview(null);
      } else {
        setPreview(null);
        setError(errorSentence(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function runCommit() {
    setBusy(true);
    setError("");
    try {
      const data = await post(file, { mode: "commit", currency, skipDuplicates });
      setResult(data);
      onImported?.();
    } catch (err) {
      setError(errorSentence(err));
    } finally {
      setBusy(false);
    }
  }

  const s = preview?.summary;
  const f = preview?.file;
  const writes = s ? s.created + s.updated : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="fq-dialog-card bg-card border border-border rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">{t("app.googleAds.import.title")}</h2>
          <button type="button" onClick={onClose} aria-label={t("app.action.close", "Close")}>
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">{t("app.googleAds.import.intro")}</p>
        <ol className="text-xs text-muted-foreground list-decimal pl-5 space-y-1">
          <li>{t("app.googleAds.import.step1")}</li>
          <li>{t("app.googleAds.import.step2")}</li>
          <li>{t("app.googleAds.import.step3")}</li>
        </ol>

        <label className="block text-xs">
          <span className="text-muted-foreground">{t("app.googleAds.import.fileLabel")}</span>
          <input
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setPreview(null);
              setResult(null);
              setError("");
              setNeedsCurrency(false);
              setCurrency("");
            }}
            className="block w-full mt-1 text-sm"
          />
        </label>

        {needsCurrency && (
          <label className="block text-xs">
            <span className="text-muted-foreground">{t("app.googleAds.import.currencyQuestion")}</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full mt-1 border border-border rounded-lg px-2.5 py-2 text-sm bg-card"
            >
              <option value="">{t("app.googleAds.import.currencyPick")}</option>
              {[...new Set([companyCurrency, ...COMMON_CURRENCIES].filter(Boolean))].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {!preview && !result && (
          <button
            type="button"
            disabled={!file || busy}
            onClick={() => runPreview()}
            className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50"
          >
            <Upload size={14} /> {busy ? t("app.googleAds.import.reading") : t("app.googleAds.import.previewButton")}
          </button>
        )}

        {preview && !result && (
          <div className="space-y-3">
            <div className="text-sm text-foreground">
              {t("app.googleAds.import.summary", { created: s.created, updated: s.updated, duplicates: s.possibleDuplicates })}
            </div>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {f.granularity === "range" && f.range && (
                <li>{t("app.googleAds.import.rangeNote", { start: formatDateOnly(f.range.start), end: formatDateOnly(f.range.end) })}</li>
              )}
              {f.skippedTotals > 0 && <li>{t("app.googleAds.import.totalsSkipped", { count: f.skippedTotals })}</li>}
              {f.mergedRows > 0 && <li>{t("app.googleAds.import.mergedRows", { count: f.mergedRows })}</li>}
              {f.skippedEmpty > 0 && <li>{t("app.googleAds.import.emptySkipped", { count: f.skippedEmpty })}</li>}
              {f.rowErrorCount > 0 && (
                <li className="text-amber-700 dark:text-amber-400">
                  {t("app.googleAds.import.rowErrors", {
                    count: f.rowErrorCount,
                    lines: f.rowErrors.slice(0, 8).map((e) => e.line).join(", "),
                  })}
                </li>
              )}
              {preview.currencyMismatch && (
                <li>{t("app.googleAds.import.currencyNote", { currencies: f.currencies.join(", "), company: companyCurrency || "—" })}</li>
              )}
              <li>{t("app.googleAds.import.conversionsNote")}</li>
            </ul>

            {s.possibleDuplicates > 0 && (
              <label className="flex items-start gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => {
                    setSkipDuplicates(e.target.checked);
                    runPreview(e.target.checked);
                  }}
                  className="mt-0.5"
                />
                <span>{t("app.googleAds.import.skipDuplicates", { count: s.possibleDuplicates })}</span>
              </label>
            )}

            <div className="overflow-x-auto border border-border rounded-lg max-h-72">
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="px-3 py-1.5 font-medium">{t("app.marketingSpend.colDate", "Date")}</th>
                    <th className="px-3 py-1.5 font-medium">{t("app.marketingSpend.colCampaign", "Campaign")}</th>
                    <th className="px-3 py-1.5 font-medium text-right">{t("app.marketingSpend.colSpend", "Spend")}</th>
                    <th className="px-3 py-1.5 font-medium text-right">{t("app.marketingSpend.campaigns.colClicks", "Clicks")}</th>
                    <th className="px-3 py-1.5 font-medium">{t("app.googleAds.import.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5">
                        {formatDateOnly(r.date)}
                        {r.rangeEnd ? ` – ${formatDateOnly(r.rangeEnd)}` : ""}
                      </td>
                      <td className="px-3 py-1.5">{r.campaignName}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{money(r.amount, r.currency)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.clicks ?? "—"}</td>
                      <td className="px-3 py-1.5">
                        {r.status === "duplicate"
                          ? (skipDuplicates ? t("app.googleAds.import.statusSkipped") : t("app.googleAds.import.statusDuplicate"))
                          : t(`app.googleAds.import.status.${r.status}`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rowsTotal > preview.rowsShown && (
              <p className="text-[11px] text-muted-foreground">
                {t("app.googleAds.import.moreRows", { shown: preview.rowsShown, total: preview.rowsTotal })}
              </p>
            )}

            <button
              type="button"
              disabled={busy || writes === 0}
              onClick={runCommit}
              className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-full text-sm font-semibold disabled:opacity-50"
            >
              {busy ? t("app.googleAds.import.importing") : t("app.googleAds.import.importButton", { count: writes })}
            </button>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              {t("app.googleAds.import.done", {
                created: result.summary.created,
                updated: result.summary.updated,
                skipped: result.summary.skipped,
              })}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full border border-border py-2.5 rounded-full text-sm font-semibold"
            >
              {t("app.action.close", "Close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
