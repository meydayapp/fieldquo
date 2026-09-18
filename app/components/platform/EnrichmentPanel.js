"use client";

// app/components/platform/EnrichmentPanel.js
//
// Where every enrichment pass is against the dispatcher, the register
// personnel file, the two bulk vendor runs, and the BBB upload — one card
// on /platform/sales/prospects, read from
// /api/platform/sales/prospects/enrichment.
//
// Every number here is read from a table; nothing is estimated. A pass
// that has not run says so. A vendor with no key prints the variable's
// name instead of a button that would fail.
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, Users } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";
const dollars = (cents) => `US$${((Number(cents) || 0) / 100).toFixed(2)}`;
const day = (iso) => (iso ? String(iso).slice(0, 10) : "never");

function SourceRow({ s, onTick, onCap, busy }) {
  const [cap, setCap] = useState(String(s.cap));
  useEffect(() => setCap(String(s.cap)), [s.cap]);
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground">{s.label}</h3>
        <span className="text-xs text-muted-foreground">{s.actor}</span>
      </div>
      {!s.configured ? (
        <p className="text-sm text-muted-foreground">{s.enable}</p>
      ) : null}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
        <div><dt className="text-xs text-muted-foreground">Pairs today</dt><dd>{s.startedToday} of {s.cap} · {s.running} running</dd></div>
        <div><dt className="text-xs text-muted-foreground">Last 30 days</dt><dd>{s.last30Days.runs} runs · {s.last30Days.rows} rows</dd></div>
        <div><dt className="text-xs text-muted-foreground">Matched / refused</dt><dd>{s.last30Days.matched} / {s.last30Days.refused} · {s.last30Days.peopleAdded} people</dd></div>
        <div><dt className="text-xs text-muted-foreground">Spend (30 d)</dt><dd>{dollars(s.last30Days.cents)} · ≈{dollars(s.projectedPairCents)} a pair</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground">{s.unmatchedListings} listings kept unmatched for a later ingest.</p>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-muted-foreground">
          Pairs per day{" "}
          <input value={cap} onChange={(e) => setCap(e.target.value)} inputMode="numeric" className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm" />
        </label>
        <button type="button" className={`${BTN} border border-border bg-card text-foreground`} disabled={busy || cap === String(s.cap)} onClick={() => onCap(s.source, cap)}>
          Save cap
        </button>
        <button type="button" className={`${BTN} bg-primary text-primary-foreground`} disabled={busy || !s.configured} onClick={() => onTick(s.source)}>
          Run one pair now
        </button>
      </div>
      {s.recent.length ? (
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {s.recent.slice(0, 6).map((r) => (
            <li key={r.id}>
              {day(r.startedAt)} · {r.keyword} in {r.location}, {r.country} · {r.status}
              {r.status === "ingested" ? ` · ${r.rowsFetched} rows, ${r.matched} matched, ${r.peopleAdded} people, ${dollars(r.costCents)}` : ""}
              {r.error ? ` · ${r.error}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function EnrichmentPanel() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setStatus(await fetchJson("/api/platform/sales/prospects/enrichment"));
    } catch (err) {
      setError(err?.message || "Could not read the enrichment counters.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function post(body, say) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const r = await fetchJson("/api/platform/sales/prospects/enrichment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setNote(say(r));
      await load();
    } catch (err) {
      setError(err?.message || "That did not run.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const text = await file.text();
      const rows = text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
      const r = await fetchJson("/api/platform/sales/prospects/bbb-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      setNote(`BBB upload: ${r.matched} matched, ${r.refused} refused, ${r.noMatch} no match, ${r.alreadyKnown} already known, ${r.peopleAdded} people added.`);
      await load();
    } catch (err) {
      setError(err?.message || "The upload did not apply.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className={CARD} aria-labelledby="enrichment-heading">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users size={18} className="shrink-0" />
          <h2 id="enrichment-heading" className="text-base font-semibold text-foreground">Who to ask for, and the bulk runs</h2>
        </div>
        <button type="button" className={`${BTN} border border-border bg-card text-foreground`} onClick={load} disabled={busy}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      {error ? (
        <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}</p>
      ) : null}
      {note ? <p className="text-sm text-foreground">{note}</p> : null}
      {!status && !error ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={16} /> Reading…</p>
      ) : null}
      {status ? (
        <>
          <div className="space-y-1 text-sm">
            <p>
              <strong>Claimed leads:</strong> {status.sweep.claimed.total} · Google checked {status.sweep.claimed.places} · register personnel checked {status.sweep.claimed.people} · BBB checked {status.sweep.claimed.bbb}
            </p>
            <p className="text-xs text-muted-foreground">
              CSLB personnel file: {status.personnel.rows.toLocaleString()} people, release {status.personnel.release || "not loaded"}, loaded {day(status.personnel.loadedAt)} — <code>scripts/cslb-personnel-load.mjs</code>.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Ahead of the dispatcher, per trade being worked</h3>
            {status.sweep.trades.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trade has an open claim or a batch in the last 7 days.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground text-left">
                  <tr><th className="py-1 pr-3">Trade</th><th className="pr-3">Open claims</th><th className="pr-3">Google ahead</th><th className="pr-3">Register ahead</th><th>BBB ahead</th></tr>
                </thead>
                <tbody>
                  {status.sweep.trades.map((t) => (
                    <tr key={t.tradeKey} className="border-t border-border">
                      <td className="py-1 pr-3">{t.label}</td>
                      <td className="pr-3">{t.claims}</td>
                      <td className="pr-3">{t.sources.places?.ahead ?? 0} / {t.total}</td>
                      <td className="pr-3">{t.sources.people?.ahead ?? 0} / {t.total}</td>
                      <td>{t.sources.bbb?.ahead ?? 0} / {t.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="text-xs text-muted-foreground">
              "Ahead" is how many rows at the head of the trade's dispatch order the pass has already done — the next rows a rep pressing Claim would get. Google walks ahead of the dispatcher only at{" "}
              <code>{status.sweep.placesAheadSettingKey}</code> = {status.sweep.placesAheadPerHour} an hour{status.sweep.placesAheadPerHour === 0 ? " (off — a paid lookup the owner has not sized)" : ""}; the register lookup is free and walks it every tick.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" className={`${BTN} border border-border bg-card text-foreground`} disabled={busy} onClick={() => post({ action: "people" }, (r) => `Register lookup over the claimed leads: ${r.found} of ${r.asked} have a name on file, ${r.added} people added, ${r.notRegister} not from a register with personnel.`)}>
                Look up the claimed leads in the registers now
              </button>
              <label className="text-xs text-muted-foreground">
                Google ahead per hour{" "}
                <input defaultValue={status.sweep.placesAheadPerHour} inputMode="numeric" className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm" onBlur={(e) => { const v = Number(e.target.value); if (Number.isInteger(v) && v !== status.sweep.placesAheadPerHour) post({ action: "setting", key: "placesAhead", value: v }, () => `Google ahead-of-dispatcher cap set to ${v} an hour.`); }} />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Bulk runs (Apify) — this month {dollars(Object.values(status.apify.spendThisMonth || {}).reduce((a, b) => a + (b.cents || 0), 0))}</h3>
            <SourceRow s={status.apify.bbb} busy={busy} onTick={(source) => post({ action: "apify", source, limit: 1 }, (r) => r.skipped ? r.message : `${r.started?.filter((x) => x.ok).length || 0} pair started, ${r.collected?.ingested || 0} finished run ingested${r.stopped ? ` — stopped: ${r.stopped.message}` : ""}.`)} onCap={(source, v) => post({ action: "setting", key: source, value: Number(v) }, (r) => `${r.key} = ${r.value}.`)} />
            <SourceRow s={status.apify.google_maps} busy={busy} onTick={(source) => post({ action: "apify", source, limit: 1 }, (r) => r.skipped ? r.message : `${r.started?.filter((x) => x.ok).length || 0} pair started, ${r.collected?.ingested || 0} finished run ingested${r.stopped ? ` — stopped: ${r.stopped.message}` : ""}.`)} onCap={(source, v) => post({ action: "setting", key: source, value: Number(v) }, (r) => `${r.key} = ${r.value}.`)} />
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Upload BBB results</h3>
            <p className="text-xs text-muted-foreground">
              The JSON-lines file <code>scripts/bbb-principal.mjs</code> writes on a machine without the database (docs/sales/BBB-LOCAL-RUN.md). Every row is re-matched here before anything is written.
            </p>
            <input ref={fileRef} type="file" accept=".jsonl,.json,.ndjson,text/plain" onChange={upload} disabled={busy} className="text-sm" />
          </div>
        </>
      ) : null}
    </section>
  );
}
