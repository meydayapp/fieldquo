// app/app/leads/import/page.js
//
// Import leads a company bought or exported from another tool. Parses the CSV in
// the browser (Papa Parse), previews a few rows, and posts them to be scored and
// filed like any inbound lead.
//
// ── i18n ───────────────────────────────────────────────────────────────────
//
// This screen used to be English in a nine-language back office, and the line
// that defended it said "English-first, like the other newest surfaces" — a
// habit rather than a policy. /app/clients/import does the same job three
// routes away and is translated, so a contractor who set the back office to
// French got a fully French client importer and a fully English lead importer.
//
// The keys mirror app.clientImport.* deliberately, so the two importers read as
// one product rather than as two screens written a month apart.
//
// The two COUNTS are countedNoun() entries rather than "{n} rows". The rule
// they replace was `rows.length === 1 ? "" : "s"` — the English plural rule
// wearing a template literal, which printed a bare Latin "s" on a Mandarin
// screen and "1 дзвінків" on a Ukrainian one. countedNoun asks Intl.PluralRules
// for the CLDR category, so Ukrainian's three forms and Tagalog's non-count
// split both come out right without this file knowing either rule.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Upload, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";

export default function ImportLeadsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  // The level POST /api/leads/import already takes. Asked here so a member
  // without it reads a sentence instead of parsing a CSV, previewing it and
  // then being refused — the same fix /app/clients/import needed beside it.
  const canImport = useHasLevel("requests", "view_create_edit");
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => setRows(results.data || []),
      error: () => setError(t("app.leadImport.readError")),
    });
  }

  async function handleImport() {
    setImporting(true);
    setError("");
    try {
      const data = await fetchJson("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      setResult(data);
    } catch (err) {
      setError(err.message || t("app.leadImport.failed"));
    } finally {
      setImporting(false);
    }
  }

  // Cheap preview of what we'll pull from each row (mirrors the server's lenient
  // header matching closely enough to reassure before importing).
  const preview = rows.slice(0, 3).map((r) => ({
    name: r.name || r.Name || r["Full Name"] || r.contact || "—",
    contact:
      r.email || r.Email || r.phone || r.Phone || t("app.leadImport.noContact"),
  }));

  if (!canImport) return <NoAccessPanel capability="accessLevel" />;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <Link
        href="/app/leads"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> {t("app.leadImport.back")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.leadImport.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-prose">
          {t("app.leadImport.subtitle")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {!result ? (
        <div className="bg-card border border-border rounded-xl p-6">
          <label className="flex flex-col items-center gap-2 border-2 border-dashed border-border rounded-lg py-10 cursor-pointer">
            <Upload size={24} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {fileName || t("app.leadImport.choose")}
            </span>
            <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </label>

          {rows.length > 0 && (
            <div className="mt-5">
              <p className="text-sm text-foreground mb-3">
                {t("app.leadImport.found", {
                  count: t("app.leadImport.rowCount", { value: rows.length }),
                })}
              </p>
              <div className="border border-border rounded-lg overflow-hidden mb-4">
                {preview.map((r, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 text-xs text-muted-foreground border-b border-border last:border-0"
                  >
                    {r.name} — {r.contact}
                  </div>
                ))}
              </div>
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
              >
                {importing
                  ? t("app.leadImport.importing")
                  : t("app.leadImport.importN", {
                      count: t("app.leadImport.leadCount", { value: rows.length }),
                    })}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-xl p-6 text-center">
          <p className="text-sm text-green-800 dark:text-green-300">
            {t("app.leadImport.imported", {
              count: t("app.leadImport.leadCount", { value: result.imported }),
              // An empty string rather than an omitted value: t() leaves an
              // unmatched {skipped} in place, so "Imported 12{skipped}." is what
              // a run with nothing skipped would print.
              skipped:
                result.skipped > 0
                  ? t("app.leadImport.skipped", { count: result.skipped })
                  : "",
            })}
          </p>
          <button
            onClick={() => router.push("/app/leads")}
            className="mt-4 bg-inverted text-inverted-foreground px-5 py-2 rounded-full text-sm font-semibold"
          >
            {t("app.leadImport.view")}
          </button>
        </div>
      )}
    </div>
  );
}
