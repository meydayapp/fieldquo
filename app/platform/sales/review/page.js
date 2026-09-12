// app/platform/sales/review/page.js
//
// The Review folder: every prospect that needs a human, across every
// campaign, with a trade picker on each row.
//
// ══ What the owner asked for ═══════════════════════════════════════════════
//
// "you can put it in a review folder.. where we can manually select the
// trade". The register providers refuse to guess a trade from a licence
// (lib/sales/discovery/rbq/provider.js's header measures why), the queue
// claims by exact trade key, and so 117,000 licensed contractors with a phone
// number sat where no rep could reach one. This is the screen where a person
// gives each of them a trade — one at a time with the keyboard, or by the
// hundred when a filter says the same thing about every row in it.
//
// ══ Honest suggestions ═════════════════════════════════════════════════════
//
// Up to three chips per row, each with WHY beside it — "name: 'toitur'",
// "licence: only 16 électricité", "site". Computed by
// lib/sales/discovery/tradeSuggest.js and never stored. A row whose name
// carries a shop word ("Peinture Dépôt") gets no chip and a sentence saying
// so instead of an empty chip row.
//
// ══ Keyboard ═══════════════════════════════════════════════════════════════
//
//   j / k      next / previous row
//   1 – 9      pick that suggested trade (chips are numbered)
//   Enter      accept with the picked trade
//   x          not a contractor
//   d          duplicate (only offered where the row is flagged)
//   s          still unsure — skip; the row sorts behind the others
//
// Off while an input has focus, so typing "9" into the search box does not
// pick a trade.
//
// ══ English ════════════════════════════════════════════════════════════════
//
// /platform is English-only by convention (app/platform/sales/notes/page.js
// records the same finding).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Copy, HelpCircle, Loader2, Wrench, X } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD = "min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm text-foreground";

const FILTER_KEYS = ["campaignId", "source", "province", "reason", "q", "website", "retail"];

function readFilterFromUrl() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const out = {};
  for (const k of FILTER_KEYS) {
    const v = params.get(k);
    if (v) out[k] = v;
  }
  return out;
}

function filterToParams(filter, page) {
  const params = new URLSearchParams();
  for (const k of FILTER_KEYS) if (filter[k]) params.set(k, filter[k]);
  if (page) params.set("page", String(page));
  return params;
}

export default function PlatformSalesReviewPage() {
  const [filter, setFilter] = useState(() => readFilterFromUrl());
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [focus, setFocus] = useState(0);
  // Per-row picked trade, keyed by prospect id. A chip press or the select.
  const [picked, setPicked] = useState({});
  const [bulk, setBulk] = useState(null); // { decision, tradeKey } | null
  const [confirm, setConfirm] = useState(null); // { decision, tradeKey, count, sample }
  const [maintenance, setMaintenance] = useState(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [reloadAfter, setReloadAfter] = useState(false);
  const qRef = useRef(null);
  const rowRefs = useRef([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = filterToParams(filter, page);
      const res = await fetchJson(`/api/platform/sales/review?${params}`);
      setData(res);
      setFocus(0);
      setPicked({});
      if (typeof window !== "undefined") {
        const url = params.toString() ? `?${params}` : window.location.pathname;
        window.history.replaceState(null, "", url);
      }
    } catch (err) {
      setError(err?.message || "Could not load the review folder.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.rows || [];
  const current = rows[focus] || null;

  const setF = (key, value) => {
    setPage(0);
    setFilter((f) => {
      const next = { ...f };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const narrow = Boolean(filter.campaignId || filter.source || filter.province || filter.q || filter.retail || filter.reason);

  const tradeLabel = useMemo(() => {
    const m = new Map((data?.trades || []).map((t) => [t.key, t.label]));
    return (key) => m.get(key) || key;
  }, [data?.trades]);

  // ── One decision ─────────────────────────────────────────────────────────
  const decide = useCallback(
    async (row, decision, tradeKey = null) => {
      if (!row || busy) return;
      setBusy(row.id);
      setError("");
      setNote("");
      try {
        const res = await fetchJson("/api/platform/sales/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prospectId: row.id, decision, tradeKey }),
        });
        // Take the row off the screen rather than reloading fifty rows for
        // every keypress; the counter on the folder moves with it. A skip
        // keeps the row (it only sorts later next load).
        setData((d) => {
          if (!d) return d;
          if (decision === "skip") {
            return { ...d, rows: d.rows.map((r) => (r.id === row.id ? { ...r, deferred: true } : r)) };
          }
          const left = d.rows.filter((r) => r.id !== row.id);
          // The page has been worked through: fetch the next fifty. Set here,
          // from the decision, rather than inferred from "no rows" — a filter
          // that genuinely matches nothing must not reload for ever.
          if (!left.length && d.total - 1 > 0) setReloadAfter(true);
          return { ...d, total: Math.max(0, d.total - 1), rows: left };
        });
        if (decision === "skip") setFocus((i) => Math.min(i + 1, rows.length - 1));
        else setFocus((i) => Math.min(i, Math.max(0, rows.length - 2)));
        if (decision === "accept") {
          setNote(
            `${row.businessName} → ${tradeLabel(tradeKey)}. ${
              res?.research?.queued ? `Research queued (${res.research.queued}).` : "Research: nothing new to queue."
            }`,
          );
        }
      } catch (err) {
        setError(err?.message || "Could not record that decision.");
      } finally {
        setBusy("");
      }
    },
    [busy, rows.length, tradeLabel],
  );

  // Reload when a page has been emptied by decisions.
  useEffect(() => {
    if (!reloadAfter || loading) return;
    setReloadAfter(false);
    // Page 0 again: the rows just decided have left the folder, so the next
    // fifty are now the first fifty of this filter.
    if (page !== 0) setPage(0);
    else load();
  }, [reloadAfter, loading, page, load]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (confirm) return;
      if (e.key === "j") {
        e.preventDefault();
        setFocus((i) => Math.min(i + 1, rows.length - 1));
      } else if (e.key === "k") {
        e.preventDefault();
        setFocus((i) => Math.max(i - 1, 0));
      } else if (/^[1-9]$/.test(e.key) && current) {
        const s = current.suggestions[Number(e.key) - 1];
        if (s) setPicked((p) => ({ ...p, [current.id]: s.tradeKey }));
      } else if (e.key === "Enter" && current) {
        const tradeKey = picked[current.id] || current.suggestions[0]?.tradeKey || null;
        if (tradeKey) decide(current, "accept", tradeKey);
      } else if (e.key === "x" && current) {
        decide(current, "reject");
      } else if (e.key === "d" && current && current.duplicateOf) {
        decide(current, "duplicate");
      } else if (e.key === "s" && current) {
        decide(current, "skip");
      } else if (e.key === "/") {
        e.preventDefault();
        qRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows.length, current, picked, decide, confirm]);

  useEffect(() => {
    rowRefs.current[focus]?.scrollIntoView?.({ block: "nearest" });
  }, [focus]);

  // ── Bulk ─────────────────────────────────────────────────────────────────
  async function runBulk() {
    if (!confirm) return;
    setBusy("bulk");
    setError("");
    try {
      const res = await fetchJson("/api/platform/sales/review/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filter,
          decision: confirm.decision,
          tradeKey: confirm.tradeKey,
          expectedCount: confirm.count,
        }),
      });
      setConfirm(null);
      setBulk(null);
      setNote(
        confirm.decision === "accept"
          ? `Assigned ${res.tradeLabel} to ${res.count} rows across ${res.campaigns} campaign${res.campaigns === 1 ? "" : "s"}. ${res.research}`
          : `Rejected ${res.count} rows across ${res.campaigns} campaign${res.campaigns === 1 ? "" : "s"}.`,
      );
      await load();
    } catch (err) {
      setError(err?.message || "The bulk decision did not apply.");
      setConfirm(null);
    } finally {
      setBusy("");
    }
  }

  async function runMaintenance(apply) {
    setMaintenanceBusy(true);
    setError("");
    try {
      const res = await fetchJson("/api/platform/sales/review/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply }),
      });
      setMaintenance(res);
      if (apply) await load();
    } catch (err) {
      setError(err?.message || "The reclassification did not run.");
    } finally {
      setMaintenanceBusy(false);
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5 max-w-5xl">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Review folder</h1>
        <p className="text-sm text-muted-foreground">
          Prospects that need a human before any rep can dial them: contractors with no trade, rows the classifier
          could not place, and possible duplicates — every campaign, one list. Pick a trade and the row goes to that
          trade&apos;s queue. Suggestions say why they are suggested; nothing is assigned until you say so.
        </p>
        <p className="text-xs text-muted-foreground">
          Keys: <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>1</kbd>–<kbd>9</kbd> pick a suggested trade · <kbd>Enter</kbd> accept ·{" "}
          <kbd>x</kbd> not a contractor · <kbd>d</kbd> duplicate · <kbd>s</kbd> still unsure · <kbd>/</kbd> search
        </p>
      </header>

      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300 inline-flex items-center gap-2" data-review-error>
          <AlertCircle size={16} /> {error}
        </p>
      ) : null}
      {note ? (
        <p className="text-sm text-emerald-800 dark:text-emerald-200" data-review-note>
          {note}
        </p>
      ) : null}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3" data-review-filters>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <select className={FIELD} value={filter.reason || ""} onChange={(e) => setF("reason", e.target.value)} aria-label="Reason">
            <option value="">Every reason</option>
            {(data?.reasons || []).map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <select className={FIELD} value={filter.source || ""} onChange={(e) => setF("source", e.target.value)} aria-label="Source">
            <option value="">Every source</option>
            {(data?.sources || []).map((s) => (
              <option key={s.key} value={s.key}>
                {s.key} · {s.count.toLocaleString()}
              </option>
            ))}
          </select>
          <select className={FIELD} value={filter.province || ""} onChange={(e) => setF("province", e.target.value)} aria-label="Province">
            <option value="">Every province</option>
            {(data?.provinces || []).map((p) => (
              <option key={p.key} value={p.key}>
                {p.key} · {p.count.toLocaleString()}
              </option>
            ))}
          </select>
          <select className={FIELD} value={filter.campaignId || ""} onChange={(e) => setF("campaignId", e.target.value)} aria-label="Campaign">
            <option value="">Every campaign</option>
            {(data?.campaigns || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.count.toLocaleString()}
              </option>
            ))}
          </select>
          <input
            ref={qRef}
            className={`${FIELD} lg:col-span-2`}
            placeholder="Name, trading name, phone or licence number"
            defaultValue={filter.q || ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") setF("q", e.currentTarget.value.trim());
              if (e.key === "Escape") e.currentTarget.blur();
            }}
            aria-label="Search"
          />
          <select className={FIELD} value={filter.website || ""} onChange={(e) => setF("website", e.target.value)} aria-label="Website">
            <option value="">Website: any</option>
            <option value="yes">Has a website</option>
            <option value="no">No website listed</option>
          </select>
          <label className="inline-flex items-center gap-2 min-h-[44px] px-1 text-sm text-foreground">
            <input
              type="checkbox"
              checked={filter.retail === "yes"}
              onChange={(e) => setF("retail", e.target.checked ? "yes" : "")}
            />
            Name carries a shop word
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-foreground font-medium" data-review-total>
            {data ? `${data.total.toLocaleString()} waiting` : "…"}
            {narrow && data ? " · matching this filter" : ""}
          </span>
          {narrow ? (
            <button type="button" className="text-muted-foreground underline" onClick={() => { setPage(0); setFilter({}); if (qRef.current) qRef.current.value = ""; }}>
              Clear filters
            </button>
          ) : null}
          <span className="flex-1" />
          {narrow && data && data.total > 0 ? (
            <button type="button" className={`${BTN} border border-border text-foreground`} onClick={() => setBulk({ decision: "accept", tradeKey: "" })} data-bulk-open>
              Select all {data.total.toLocaleString()} matching this filter
            </button>
          ) : null}
        </div>

        {bulk ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-3 space-y-2" data-bulk-panel>
            <p className="text-sm text-amber-900 dark:text-amber-200">
              One decision for all <strong>{data.total.toLocaleString()}</strong> rows matching this filter. The server re-runs
              the filter; a row a rep holds or a do-not-contact row is never touched.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <select className={`${FIELD} flex-1`} value={bulk.tradeKey} onChange={(e) => setBulk({ ...bulk, tradeKey: e.target.value })} aria-label="Trade to assign" data-bulk-trade>
                <option value="">Choose a trade…</option>
                {(data.trades || []).map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={`${BTN} bg-primary text-primary-foreground`}
                disabled={!bulk.tradeKey}
                onClick={() => setConfirm({ decision: "accept", tradeKey: bulk.tradeKey, count: data.total, sample: rows.slice(0, 3).map((r) => r.businessName) })}
                data-bulk-assign
              >
                <Check size={16} /> Assign {bulk.tradeKey ? tradeLabel(bulk.tradeKey) : "trade"} to {data.total.toLocaleString()} rows
              </button>
              {filter.retail === "yes" ? (
                <button
                  type="button"
                  className={`${BTN} border border-border text-foreground`}
                  onClick={() => setConfirm({ decision: "reject", tradeKey: null, count: data.total, sample: rows.slice(0, 3).map((r) => r.businessName) })}
                  data-bulk-reject
                >
                  <X size={16} /> Reject all {data.total.toLocaleString()} as shops
                </button>
              ) : null}
              <button type="button" className={`${BTN} text-muted-foreground`} onClick={() => setBulk(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Confirmation ───────────────────────────────────────────────── */}
      {confirm ? (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" data-bulk-confirm>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-base font-semibold text-foreground">
              {confirm.decision === "accept"
                ? `Assign ${tradeLabel(confirm.tradeKey)} to ${confirm.count.toLocaleString()} rows?`
                : `Reject ${confirm.count.toLocaleString()} rows as shops?`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {confirm.decision === "accept"
                ? "Every matching row becomes an accepted contractor in this trade's queue. Written as one audited act, with a correction on each row."
                : "Every matching row is rejected and marked do-not-contact, so a re-import cannot put it back in front of a rep."}
            </p>
            <div className="text-sm text-foreground">
              <p className="font-medium">For example:</p>
              <ul className="list-disc pl-5">
                {confirm.sample.map((n, i) => (
                  <li key={i} className="break-words">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" className={`${BTN} bg-primary text-primary-foreground`} onClick={runBulk} disabled={busy === "bulk"} data-bulk-go>
                {busy === "bulk" ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                {confirm.decision === "accept" ? `Assign to ${confirm.count.toLocaleString()} rows` : `Reject ${confirm.count.toLocaleString()} rows`}
              </button>
              <button type="button" className={`${BTN} border border-border text-foreground`} onClick={() => setConfirm(null)} disabled={busy === "bulk"}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Rows ─────────────────────────────────────────────────────────── */}
      {loading && !data ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> Loading…
        </div>
      ) : null}

      {data && rows.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">Nothing waiting{narrow ? " for this filter" : ""}.</p>
      ) : null}

      <div className="space-y-3" data-review-rows>
        {rows.map((p, i) => {
          const chosen = picked[p.id] || "";
          const active = i === focus;
          return (
            <article
              key={p.id}
              ref={(el) => (rowRefs.current[i] = el)}
              onClick={() => setFocus(i)}
              className={`rounded-xl border bg-card p-4 space-y-3 ${active ? "border-primary ring-2 ring-primary/30" : "border-border"} ${p.deferred ? "opacity-70" : ""}`}
              data-review-row={p.id}
              data-active={active ? "1" : undefined}
            >
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground break-words">{p.businessName || "(no name)"}</p>
                  {p.tradingNames?.length ? (
                    <p className="text-xs text-muted-foreground break-words">Also trades as {p.tradingNames.join(" · ")}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground break-words">
                    {[p.city, p.province].filter(Boolean).join(" · ") || "no address"} · {p.phoneE164 || "no phone"} ·{" "}
                    {p.websiteUrl ? (
                      <a className="underline" href={p.websiteUrl} target="_blank" rel="noreferrer">
                        {p.websiteUrl.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      "website: none"
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground break-words">
                    {p.sourceLabel}
                    {p.licenceNumber ? ` · licence ${p.licenceNumber}` : ""}
                    {p.campaign ? ` · ${p.campaign.name}` : ""}
                    {p.tradeLabel ? ` · currently ${p.tradeLabel}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.reasons.map((r) => (
                    <span key={r} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {(data.reasons.find((x) => x.key === r) || {}).label || r}
                    </span>
                  ))}
                  {p.deferred ? <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">skipped before</span> : null}
                </div>
              </div>

              <p className="text-sm text-foreground">{p.classificationReason}</p>

              {p.categories.length ? (
                <Categories lines={p.categories} register={p.register} />
              ) : (
                <p className="text-xs text-muted-foreground">The source listed no categories.</p>
              )}

              {p.duplicateOf ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200">
                  Flagged as possibly the same business as{" "}
                  <span className="font-semibold">{p.duplicateOf.businessName || p.duplicateOf.id}</span>
                  {p.duplicateOf.city ? `, ${p.duplicateOf.city}` : ""}
                  {p.duplicateOf.status ? ` — which is ${p.duplicateOf.status === "needs_review" ? "waiting in this folder too" : p.duplicateOf.status === "rejected" ? "rejected" : "accepted"}` : ""}
                  {p.duplicateOf.tradeKey ? ` as ${tradeLabel(p.duplicateOf.tradeKey)}` : ""}.
                </div>
              ) : null}

              {/* ── Suggestions, numbered, with their basis ────────────── */}
              <div className="flex flex-wrap items-center gap-2" data-suggestions>
                {p.suggestions.length ? (
                  p.suggestions.map((s, n) => (
                    <button
                      key={s.tradeKey}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocus(i);
                        setPicked((x) => ({ ...x, [p.id]: s.tradeKey }));
                      }}
                      className={`inline-flex items-center gap-2 min-h-[36px] rounded-full border px-3 text-sm ${
                        chosen === s.tradeKey ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground"
                      }`}
                      data-suggestion={s.tradeKey}
                    >
                      <span className="font-mono text-xs opacity-80">{n + 1}</span>
                      <span className="font-medium">{s.label}</span>
                      <span className={`text-[11px] ${chosen === s.tradeKey ? "opacity-90" : "text-muted-foreground"}`}>{s.basis}</span>
                    </button>
                  ))
                ) : p.retailWord ? (
                  <span className="text-xs text-muted-foreground">
                    No trade suggested — the name carries a shop word (&ldquo;{p.retailWord}&rdquo;).
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">No trade suggested — nothing in the name, the licence or a crawl names one.</span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  className={`${FIELD} sm:w-56`}
                  value={chosen}
                  onChange={(e) => setPicked((x) => ({ ...x, [p.id]: e.target.value }))}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Trade"
                  data-trade-picker
                >
                  <option value="">Choose a trade…</option>
                  {data.trades.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`${BTN} bg-primary text-primary-foreground`}
                  disabled={Boolean(busy) || !chosen}
                  onClick={(e) => {
                    e.stopPropagation();
                    decide(p, "accept", chosen);
                  }}
                  data-accept
                >
                  {busy === p.id ? <Loader2 className="animate-spin" size={16} /> : <Wrench size={16} />}
                  {chosen ? `Accept as ${tradeLabel(chosen)}` : "Accept with trade"}
                </button>
                {p.duplicateOf ? (
                  <button type="button" className={`${BTN} border border-amber-400 text-amber-900 dark:text-amber-100`} disabled={Boolean(busy)} onClick={(e) => { e.stopPropagation(); decide(p, "duplicate"); }} data-duplicate>
                    <Copy size={16} /> Duplicate
                  </button>
                ) : null}
                <button type="button" className={`${BTN} border border-border text-foreground`} disabled={Boolean(busy)} onClick={(e) => { e.stopPropagation(); decide(p, "reject"); }} data-reject>
                  <X size={16} /> Not a contractor
                </button>
                <button type="button" className={`${BTN} text-muted-foreground`} disabled={Boolean(busy)} onClick={(e) => { e.stopPropagation(); decide(p, "skip"); }} data-skip>
                  <HelpCircle size={16} /> Still unsure
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {data && data.total > data.pageSize ? (
        <nav className="flex items-center gap-3 text-sm text-foreground">
          <button type="button" className={`${BTN} border border-border`} disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </button>
          <span>
            Page {page + 1} of {pages.toLocaleString()}
          </span>
          <button type="button" className={`${BTN} border border-border`} disabled={page + 1 >= pages || loading} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </nav>
      ) : null}

      {/* ── Maintenance ──────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-2" data-maintenance>
        <button type="button" className="text-sm font-semibold text-foreground underline" onClick={() => setShowMaintenance((v) => !v)}>
          Maintenance: reclassify licence-register rows
        </button>
        {showMaintenance ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Rows from a contractor-licence register (RBQ, CSLB, L&amp;I, CCB) that the classifier left in
              &ldquo;needs review&rdquo; are contractors by the regulator&apos;s word. This marks them contractor — they keep
              their (missing) trade and appear here under &ldquo;No trade&rdquo; — and moves each campaign&apos;s counters
              so the funnel still adds up. Idempotent: run it twice and the second run finds nothing. Dry run first.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" className={`${BTN} border border-border text-foreground`} disabled={maintenanceBusy} onClick={() => runMaintenance(false)} data-reclassify-dry>
                {maintenanceBusy ? <Loader2 className="animate-spin" size={16} /> : null} Dry run
              </button>
              <button type="button" className={`${BTN} bg-primary text-primary-foreground`} disabled={maintenanceBusy || !maintenance || maintenance.dryRun !== true || !maintenance.planned} onClick={() => runMaintenance(true)} data-reclassify-apply>
                Apply
              </button>
            </div>
            {maintenance ? (
              <pre className="text-xs whitespace-pre-wrap rounded-lg bg-muted p-3 text-foreground">{JSON.stringify(maintenance, null, 2)}</pre>
            ) : null}
          </div>
        ) : null}
      </section>

      <p className="text-xs text-muted-foreground">
        Rows a rep currently holds and do-not-contact rows are not in this folder. Per-campaign review lives on each{" "}
        <Link className="underline" href="/platform/sales/campaigns">
          campaign
        </Link>
        .
      </p>
    </div>
  );
}

/** The licence's authorisations, folded after four. */
function Categories({ lines, register }) {
  const [open, setOpen] = useState(false);
  const shown = open ? lines : lines.slice(0, 4);
  return (
    <div className="text-xs text-muted-foreground" data-categories>
      <span className="font-medium text-foreground">{register ? "Licence authorises: " : "Source categories: "}</span>
      {shown.join(" · ")}
      {lines.length > 4 ? (
        <button type="button" className="ml-2 underline" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
          {open ? "fewer" : `+${lines.length - 4} more`}
        </button>
      ) : null}
    </div>
  );
}
