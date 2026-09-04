// app/app/clients/import/page.js
//
// ── Refused before the CSV, not after it ───────────────────────────────────
//
// POST /api/clients/import requires clientsProperties: full_edit and always
// did. This screen asked nobody. A member at view_only reached it from the
// Import button on the clients list — which was shown to everyone — chose a
// file, watched four hundred rows parse and preview, pressed Import, and got a
// 403. That is the same shape /app/jobs/new was fixed for: "QA reached the full
// form by direct URL, filled it in, and the save came back 403."
//
// Both halves, because hiding a button is not access control: the list no
// longer offers the link, and this is the door a bookmark still opens.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Upload } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";

export default function ImportClientsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  // The exact level the route takes. "accessLevel" rather than a role name:
  // this is refused by THIS member's dial, not by a tier, and telling them to
  // ask an owner when a manager can grant it sends them to the wrong person.
  const canImport = useHasLevel("clientsProperties", "full_edit");
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
      complete: (results) => {
        // Accept common column-name variants without forcing an exact header match
        const normalized = results.data.map((row) => ({
          name: row.name || row.Name || row["Full Name"] || "",
          email: row.email || row.Email || "",
          phone: row.phone || row.Phone || row["Phone Number"] || "",
          address: row.address || row.Address || "",
          city: row.city || row.City || "",
          province: row.province || row.Province || row.State || "",
          country: row.country || row.Country || "",
        }));
        setRows(normalized);
      },
      error: () => setError(t("app.clientImport.readError")),
    });
  }

  async function handleImport() {
    setImporting(true);
    setError("");
    try {
      const data = await fetchJson("/api/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      setResult(data);
    } catch (err) {
      setError(err.message || t("app.clientImport.failed"));
    } finally {
      setImporting(false);
    }
  }

  // Before the file picker, and before anything is parsed — NoAccessPanel
  // renders INSTEAD of the page, which is the whole point of it.
  if (!canImport) return <NoAccessPanel capability="accessLevel" />;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.clientImport.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.clientImport.subtitle")}
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
              {fileName || t("app.clientImport.choose")}
            </span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="hidden"
            />
          </label>

          {rows.length > 0 && (
            <div className="mt-5">
              <p className="text-sm text-foreground mb-3">
                {t("app.clientImport.found", { count: rows.length })}
              </p>
              <div className="border border-border rounded-lg overflow-hidden mb-4">
                {rows.slice(0, 3).map((r, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 text-xs text-muted-foreground border-b border-border last:border-0"
                  >
                    {r.name} — {r.email || r.phone || t("app.clientImport.noContact")}
                  </div>
                ))}
              </div>
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
              >
                {importing ? t("app.clientImport.importing") : t("app.clientImport.importN", { count: rows.length })}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-xl p-6 text-center">
          <p className="text-sm text-green-800 dark:text-green-300">
            {t("app.clientImport.imported", { count: result.imported })}
            {result.skipped > 0 && t("app.clientImport.skipped", { count: result.skipped })}
            .
          </p>
          <button
            onClick={() => router.push("/app/clients")}
            className="mt-4 bg-inverted text-inverted-foreground px-5 py-2 rounded-full text-sm font-semibold"
          >
            {t("app.clientImport.view")}
          </button>
        </div>
      )}
    </div>
  );
}
