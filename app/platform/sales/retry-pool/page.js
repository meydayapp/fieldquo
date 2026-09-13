// app/platform/sales/retry-pool/page.js
//
// The retry pool: the rules a rep's queue is ordered by, and the rows those
// rules have finished with.
//
// ══ Two halves ═════════════════════════════════════════════════════════════
//
// The RULE TABLE is a form since 2026-09-13 (the owner's decision — the
// numbers are his to set as the funnel is measured):
// app/components/platform/sales/RetryRulesEditor.js. Every number is still
// paired with the code's own `why`, an edit may carry a note, and "Reset to
// defaults" writes the defaults back rather than deleting anything.
//
// The EXHAUSTED LIST is every prospect the rule has taken out of the pool —
// three no-answers, three voicemails — newest first, with one control:
// Recycle. It resets the attempt count and puts the row back; nothing is
// deleted, the last outcome stays, and the audit log gets a row. A recycled
// prospect that exhausts again comes back here with both dates on it.
//
// ══ English ════════════════════════════════════════════════════════════════
//
// The console is English-only by convention (app/platform/sales/notes/page.js
// says why). The rep-facing sentences these rules produce are translated
// where a rep reads them, on the queue.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import RetryRulesEditor from "@/app/components/platform/sales/RetryRulesEditor";

function when(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function RetryPoolPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    let res;
    try {
      res = await fetch(`/api/platform/sales/retry-pool?page=${page}`);
    } catch {
      setError("Couldn't reach the server.");
      setData(null);
      return;
    }
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      setError(payload?.error || `Couldn't load the retry pool (${res.status}).`);
      setData(null);
      return;
    }
    setData(payload);
    setSelected(new Set());
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  async function recycle(ids) {
    if (!ids.length) return;
    setBusy("recycle");
    setError("");
    setNotice("");
    let res;
    try {
      res = await fetch("/api/platform/sales/retry-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recycle", prospectIds: ids, page }),
      });
    } catch {
      setError("Couldn't reach the server.");
      setBusy("");
      return;
    }
    const payload = await res.json().catch(() => null);
    setBusy("");
    if (!res.ok) {
      setError(payload?.error || `Couldn't recycle (${res.status}).`);
      return;
    }
    // The server's count, never the number of boxes ticked: a row another
    // admin recycled a second ago is reported as skipped, not as done.
    setNotice(
      `${payload.recycled} recycled${payload.skipped ? `, ${payload.skipped} skipped (no longer exhausted)` : ""}. ` +
        "The attempt count starts again; the last outcome and every call stay on the record.",
    );
    setData((prev) => (prev ? { ...prev, exhausted: payload.exhausted } : prev));
    setSelected(new Set());
  }

  const rows = data?.exhausted?.rows || [];
  const total = data?.exhausted?.total ?? 0;
  const pageSize = data?.exhausted?.pageSize || 50;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <RotateCcw size={18} className="text-muted-foreground shrink-0" />
        <h1 className="text-lg font-semibold text-foreground">Retry pool</h1>
      </div>

      {error && (
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-amber-700 dark:text-amber-300">
          {error}
        </p>
      )}

      {/* ── The rules ─────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-3 sm:p-4 space-y-3">
        <h2 className="text-base font-semibold text-foreground">The rules, as they stand</h2>
        {!data ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </p>
        ) : (
          <RetryRulesEditor
            rules={data.rules}
            blocks={data.blocks || []}
            // The fresh table after a save, so the exhausted rows below
            // re-read "N of M" on the new ceiling without a reload.
            onSaved={(rules) => setData((prev) => (prev ? { ...prev, rules } : prev))}
          />
        )}
      </section>

      {/* ── The exhausted list ─────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Exhausted{data ? ` · ${total}` : ""}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Prospects a rule has taken out of the pool. Recycle puts one back with a fresh attempt
              count; the last outcome and every call stay, and nothing is deleted.
              {data?.exhausted ? ` ${data.exhausted.recycledTotal} prospect${data.exhausted.recycledTotal === 1 ? " has" : "s have"} been recycled at least once.` : ""}
            </p>
          </div>
          <button
            type="button"
            disabled={busy === "recycle" || selected.size === 0}
            onClick={() => recycle([...selected])}
            className="min-h-[44px] px-3 inline-flex items-center gap-2 rounded-md border border-border text-sm font-medium text-foreground disabled:opacity-50"
          >
            {busy === "recycle" ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            Recycle selected{selected.size ? ` (${selected.size})` : ""}
          </button>
        </div>

        {notice && (
          <p className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">{notice}</p>
        )}

        {data && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing is exhausted. Every prospect in the pool still has a dial coming.</p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-2 font-medium">
                    <input
                      type="checkbox"
                      aria-label="Select every row on this page"
                      checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                      onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                    />
                  </th>
                  <th className="py-2 pr-3 font-medium">Business</th>
                  <th className="py-2 pr-3 font-medium">Trade</th>
                  <th className="py-2 pr-3 font-medium">Attempts</th>
                  <th className="py-2 pr-3 font-medium">Last outcome</th>
                  <th className="py-2 pr-3 font-medium">Exhausted</th>
                  <th className="py-2 pr-3 font-medium">Recycled before</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.businessName}`}
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <p className="text-foreground break-words">{r.businessName}</p>
                      <p className="text-xs text-muted-foreground break-words">
                        {[r.place, r.phoneE164].filter(Boolean).join(" · ")}
                        {r.doNotContact ? " · do not contact" : ""}
                        {r.heldByRepId ? " · still held by a rep" : ""}
                      </p>
                    </td>
                    <td className="py-2 pr-3 text-foreground whitespace-nowrap">{r.tradeLabel || "—"}</td>
                    <td className="py-2 pr-3 text-foreground whitespace-nowrap">{r.attemptCount} of {r.maxAttempts}</td>
                    <td className="py-2 pr-3 text-foreground">{r.lastOutcomeLabel || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{when(r.exhaustedAt)}</td>
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{r.recycledAt ? when(r.recycledAt) : "Never"}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        disabled={busy === "recycle" || r.doNotContact}
                        title={r.doNotContact ? "This business asked not to be contacted. Recycling would put it in front of a rep; the do-not-contact flag would still refuse the dial." : undefined}
                        onClick={() => recycle([r.id])}
                        className="min-h-[44px] px-3 inline-flex items-center gap-1 rounded-md border border-border text-sm font-medium text-foreground disabled:opacity-50"
                      >
                        <RotateCcw size={14} /> Recycle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              disabled={page <= 1 || busy !== ""}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="min-h-[44px] px-3 rounded-md border border-border text-foreground disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-muted-foreground">
              Page {page} of {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages || busy !== ""}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="min-h-[44px] px-3 rounded-md border border-border text-foreground disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
