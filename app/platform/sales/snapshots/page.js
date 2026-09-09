// app/platform/sales/snapshots/page.js
//
// One field, once: where the snapshot bucket is served from.
//
// ══ What this screen replaced ══════════════════════════════════════════════
//
// A "Snapshot URL (required)" box on every campaign, with help text telling the
// owner to run a DuckDB extractor and host the output — for an extract that had
// already been run and uploaded. His words: "I thought you had already fetched
// all the companies and saved it in cloudflare… where the fuck do I get the
// snapshot URL." He was right. There is exactly one thing a human can know
// here, and this is the screen for it.
//
// ══ Why the catalogue is shown beside the field ════════════════════════════
//
// So the number he sees before pasting is the number he can hold the bucket to
// afterwards. Every figure below was measured off the files themselves by
// scripts/build-snapshot-library.mjs — not estimated, not read from an object
// listing, which carries byte counts and no trades.
//
// ══ Mobile-first ══════════════════════════════════════════════════════════
//
// Single column, full-width controls, 44px targets. In
// scripts/check-mobile-surfaces.mjs's list, like every other platform sales
// screen.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Database, Loader2, Save } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const LABEL = "block text-sm font-medium text-foreground mb-1";

const PROVIDER_LABELS = {
  overture: "Overture Places",
  rbq: "RBQ — Québec licence register",
  us_ca_cslb: "California CSLB licence register",
  us_wa_lni: "Washington L&I licence register",
  us_or_ccb: "Oregon CCB licence register",
};

const COUNTRY_LABELS = { CA: "Canada", US: "United States" };

function count(n) {
  return Number(n || 0).toLocaleString("en-US");
}

export default function PlatformSnapshotLibraryPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await fetchJson("/api/platform/sales/snapshots");
      setData(next);
      setBaseUrl(next?.library?.baseUrl || "");
    } catch (err) {
      setError(err?.message || "Could not load the snapshot settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError("");
    setProblems([]);
    setSaved(false);
    try {
      const next = await fetchJson("/api/platform/sales/snapshots", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl }),
      });
      setData(next);
      setBaseUrl(next?.library?.baseUrl || "");
      setSaved(true);
    } catch (err) {
      setError(err?.message || "Could not save the base URL.");
      setProblems(Array.isArray(err?.body?.problems) ? err.body.problems : []);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading the snapshot library…
      </div>
    );
  }

  const library = data?.library || {};
  const catalogue = data?.catalogue || {};

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Snapshot library</h1>
        <p className="text-sm text-muted-foreground">
          The extract is already done and uploaded. Paste the bucket’s public base URL once, here, and every
          discovery campaign builds its own file’s URL from it — nothing else on any campaign form ever asks
          for one again.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="break-words">{error}</p>
              {problems.length ? (
                <ul className="mt-2 list-disc pl-4 space-y-1">
                  {problems.map((p) => (
                    <li key={p} className="break-words">
                      {p}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <label className={LABEL} htmlFor="base-url">
            Public base URL of the bucket
          </label>
          <input
            id="base-url"
            className={FIELD}
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setSaved(false);
            }}
            placeholder="https://pub-xxxxxxxx.r2.dev"
            inputMode="url"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Cloudflare R2 → the <span className="font-medium text-foreground">fieldquo-lead-storage</span>{" "}
            bucket → Settings → Public access → the r2.dev URL, or your own domain if you put one in front of
            it. No trailing slash needed and no query string: a signed link expires, and a base URL that
            expires turns every campaign behind it into one that finds nothing.
          </p>
        </div>

        {/* Saving FETCHES. A base URL stored while known to be wrong reads as
            configured on every screen that asks, and eighty campaigns would be
            built on it before anybody noticed. */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" className={`${BTN} bg-primary text-primary-foreground`} onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            {saving ? "Checking the bucket…" : "Check and save"}
          </button>
          <Link href="/platform/sales/campaigns" className={`${BTN} border border-border text-foreground`}>
            Back to campaigns
          </Link>
        </div>

        {library.configured ? (
          <p className="rounded-lg px-3 py-2 text-xs bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 break-words">
            <Check size={12} className="inline mr-1" />
            Proved on {library.verifiedAt ? new Date(library.verifiedAt).toLocaleString() : "an unknown date"} by
            downloading the first line of <span className="font-mono">{library.verifiedObjectKey}</span> and
            reading its header. {saved ? "Saved." : null}
          </p>
        ) : (
          <p className="rounded-lg px-3 py-2 text-xs bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Not configured yet. Until it is, campaigns cannot be created — there would be no way to build a
            snapshot URL, and a campaign pointed at nothing runs, reads nothing, and reports itself complete.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Database size={16} /> What is in the bucket
        </h2>
        <p className="text-xs text-muted-foreground">
          {count(catalogue.files)} files, {count(catalogue.rows)} rows. Counted off the files themselves on{" "}
          {catalogue.measuredAt || "an unrecorded date"} — including how many rows of each trade each one holds,
          which is why a campaign can show you “3,188 painters” before you create it. Re-measure with{" "}
          <span className="font-mono break-words">node --import ./scripts/alias-loader.mjs scripts/build-snapshot-library.mjs</span>{" "}
          after any new upload.
        </p>

        <ul className="space-y-2">
          {(catalogue.providers || []).map((p) => (
            <li key={p.provider} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground break-words">
                {PROVIDER_LABELS[p.provider] || p.provider}
              </p>
              <p className="text-xs text-muted-foreground">
                {count(p.rows)} rows · {p.files} file{p.files === 1 ? "" : "s"} · {p.regions} region
                {p.regions === 1 ? "" : "s"}
              </p>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          Coverage:{" "}
          {(catalogue.countries || [])
            .map((c) => `${COUNTRY_LABELS[c.code] || c.code} — ${c.regions} regions, ${count(c.rows)} rows`)
            .join(" · ")}
        </p>
      </section>
    </div>
  );
}
