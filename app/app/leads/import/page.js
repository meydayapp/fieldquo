// app/app/leads/import/page.js
//
// Import leads a company bought or exported from another tool. Parses the CSV in
// the browser (Papa Parse), previews a few rows, and posts them to be scored and
// filed like any inbound lead.
//
// ── i18n PENDING — this whole screen is English ────────────────────────────
//
// The line that used to sit here said "English-first, like the other newest
// surfaces", which is a habit rather than a policy: /app/clients/import does
// the same job three routes away and is translated into all nine languages
// (app.clientImport.*). A contractor who set the back office to French gets a
// fully French client importer and a fully English lead importer.
//
// Not wired here, because a t() call on a key that does not exist yet turns
// check:translations red for every other agent in the tree (commit 080999e).
// Every string below is reported with English and French; the shapes mirror
// app.clientImport.* deliberately, so the two importers read as one product.
//
//   app.leadImport.back            en "Leads"                      fr "Prospects"
//   app.leadImport.title           en "Import leads"               fr "Importer des prospects"
//   app.leadImport.subtitle        en "Upload a CSV of leads you bought or exported elsewhere. We'll match common columns (name, email, phone, notes, budget, timeline), score each one hot/warm/cold, and drop them into your pipeline. Budget and timeline are mapped where we can recognise them — otherwise the lead still scores on how reachable it is."
//                                  fr "Téléversez un CSV de prospects achetés ou exportés d'ailleurs. Nous reconnaîtrons les colonnes courantes (nom, courriel, téléphone, notes, budget, échéance), classerons chacun chaud/tiède/froid, et les déposerons dans votre entonnoir. Le budget et l'échéance sont associés quand nous les reconnaissons — sinon le prospect est tout de même classé selon sa joignabilité."
//   app.leadImport.readError       en "Couldn't read that CSV file."
//                                  fr "Impossible de lire ce fichier CSV."
//   app.leadImport.failed          en "Import failed."             fr "Échec de l'importation."
//   app.leadImport.choose          en "Choose a CSV file"          fr "Choisir un fichier CSV"
//   app.leadImport.noContact       en "no contact"                 fr "aucune coordonnée"
//   app.leadImport.importing       en "Importing…"                 fr "Importation…"
//   app.leadImport.view            en "View leads"                 fr "Voir les prospects"
//
// Four of them are COUNTS and must be countedNoun() entries, not "{n} rows" —
// the `rows.length === 1 ? "" : "s"` below is the English plural rule wearing a
// template literal, which is what printed a bare Latin "s" on a Mandarin screen
// and "1 дзвінків" on a Ukrainian one:
//
//   app.leadImport.rowCount    countedNoun en {one:"row",  other:"rows"}
//                              countedNoun fr {one:"ligne", many:"lignes", other:"lignes"}
//   app.leadImport.leadCount   countedNoun en {one:"lead",  other:"leads"}
//                              countedNoun fr {one:"prospect", many:"prospects", other:"prospects"}
//
// and the two sentences that consume them, each taking the counted noun as
// {count} the way app.receptionist.upcomingCount is consumed today:
//
//   app.leadImport.found       en "Found {count}. Preview:"
//                              fr "{count} trouvées. Aperçu :"
//   app.leadImport.imported    en "Imported {count}{skipped}."
//                              fr "{count} importés{skipped}."
//   app.leadImport.skipped     en ", skipped {count} with no name or contact"
//                              fr ", {count} ignorés sans nom ni coordonnées"
//   app.leadImport.importN     en "Import {count}"    fr "Importer {count}"
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Upload, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetchJson";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";

export default function ImportLeadsPage() {
  const router = useRouter();
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
      error: () => setError("Couldn't read that CSV file."),
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
      setError(err.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  // Cheap preview of what we'll pull from each row (mirrors the server's lenient
  // header matching closely enough to reassure before importing).
  const preview = rows.slice(0, 3).map((r) => ({
    name: r.name || r.Name || r["Full Name"] || r.contact || "—",
    contact: r.email || r.Email || r.phone || r.Phone || "no contact",
  }));

  if (!canImport) return <NoAccessPanel capability="accessLevel" />;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <Link
        href="/app/leads"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Leads
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Import leads</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-prose">
          Upload a CSV of leads you bought or exported elsewhere. We&apos;ll match
          common columns (name, email, phone, notes, budget, timeline), score each
          one hot/warm/cold, and drop them into your pipeline. Budget and timeline
          are mapped where we can recognise them — otherwise the lead still scores
          on how reachable it is.
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
              {fileName || "Choose a CSV file"}
            </span>
            <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </label>

          {rows.length > 0 && (
            <div className="mt-5">
              <p className="text-sm text-foreground mb-3">
                Found {rows.length} row{rows.length === 1 ? "" : "s"}. Preview:
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
                {importing ? "Importing…" : `Import ${rows.length} lead${rows.length === 1 ? "" : "s"}`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-xl p-6 text-center">
          <p className="text-sm text-green-800 dark:text-green-300">
            Imported {result.imported} lead{result.imported === 1 ? "" : "s"}
            {result.skipped > 0 ? `, skipped ${result.skipped} with no name or contact` : ""}.
          </p>
          <button
            onClick={() => router.push("/app/leads")}
            className="mt-4 bg-inverted text-inverted-foreground px-5 py-2 rounded-full text-sm font-semibold"
          >
            View leads
          </button>
        </div>
      )}
    </div>
  );
}
