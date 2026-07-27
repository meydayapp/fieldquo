// app/app/clients/import/page.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Upload } from "lucide-react";

export default function ImportClientsPage() {
  const router = useRouter();
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
        }));
        setRows(normalized);
      },
      error: () =>
        setError("Could not read that file — make sure it's a valid CSV"),
    });
  }

  async function handleImport() {
    setImporting(true);
    const res = await fetch("/api/clients/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setImporting(false);
    if (res.ok) {
      setResult(data);
    } else {
      setError(data.error || "Import failed");
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Clients</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a CSV exported from another system. Expected columns: name,
          email, phone, address, city, province.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {!result ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <label className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-10 cursor-pointer">
            <Upload size={24} className="text-gray-400" />
            <span className="text-sm text-gray-600">
              {fileName || "Click to choose a CSV file"}
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
              <p className="text-sm text-gray-700 mb-3">
                Found <strong>{rows.length}</strong> rows. Preview of the first
                3:
              </p>
              <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                {rows.slice(0, 3).map((r, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 text-xs text-gray-600 border-b border-gray-100 last:border-0"
                  >
                    {r.name} — {r.email || r.phone || "no contact info"}
                  </div>
                ))}
              </div>
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full bg-gray-900 text-white py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
              >
                {importing ? "Importing..." : `Import ${rows.length} Clients`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <p className="text-sm text-green-800">
            Imported <strong>{result.imported}</strong> clients
            {result.skipped > 0 &&
              ` (${result.skipped} skipped — missing a name)`}
            .
          </p>
          <button
            onClick={() => router.push("/app/clients")}
            className="mt-4 bg-gray-900 text-white px-5 py-2 rounded-full text-sm font-semibold"
          >
            View Clients
          </button>
        </div>
      )}
    </div>
  );
}
