"use client";

// app/components/platform/DuplicateGroup.js
//
// "Possible duplicates (N)": the rows that might be one business, one column
// each, field by field, with the gaps lit — and the one control that closes
// them: keep this one, merge the rest into it.
//
// ── Why a component and not a panel in each page ───────────────────────────
//
// Two screens show a flagged row: the Review folder (one row at a time, with
// its decisions) and the prospect detail (everything known about one row).
// Both need the same table, the same preview, the same confirm, the same
// Unmerge. The review page is also being edited by another hand right now,
// so this mounts there as one line and owns everything else itself.
//
// ── What the buttons actually do ───────────────────────────────────────────
//
// "Merge into the kept one" does NOT merge. It asks the server for the plan —
// which fields the kept row would take, from which row, from which source;
// which rep's claim would move — and shows it. "Confirm" sends the same
// request with confirm: true, and the server re-plans at the write, so a
// change between the two presses is a refusal here, not a surprise later.
// Nothing is deleted: the other rows are retired, listed below as "Merged
// into this row", and Unmerge puts them back — clearing exactly the fields
// the plan filled.
//
// Superadmin only for the writes; a support session sees the table and the
// gaps, and nothing it could not press (PlatformWriteGate's rule).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Copy, Loader2, Undo2, X } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";

const FIELD_LABEL = {
  websiteUrl: "Website",
  domain: "Domain",
  hasWebsite: "Has a website",
  phoneE164: "Phone",
  email: "Email",
  emailSource: "Email seen on",
  addressLine: "Street",
  city: "City",
  province: "Province / state",
  postalCode: "Postal code",
  country: "Country",
  latitude: "Latitude",
  longitude: "Longitude",
  tradeKey: "Trade",
  businessStatus: "Trading status",
  googleRating: "Rating",
  googleReviewCount: "Review count",
  sourceUpdatedAt: "Source last refreshed",
  doNotContactAt: "Do not contact",
  doNotContactReason: "Do-not-contact reason",
};

function RowLink({ id, onSelect, children }) {
  if (onSelect) {
    return (
      <button type="button" className="underline underline-offset-2 text-left" onClick={() => onSelect(id)}>
        {children}
      </button>
    );
  }
  return (
    <Link href={`/platform/sales/prospects?id=${encodeURIComponent(id)}`} className="underline underline-offset-2">
      {children}
    </Link>
  );
}

function cell(row, field) {
  const v = row[field];
  if (field === "tradingNames") return Array.isArray(v) && v.length ? v.join(" · ") : null;
  if (field === "tradeKey") return row.tradeLabel || v || null;
  if (field === "sourceProvider") return row.sourceLabel || v || null;
  if (field === "createdAt") return v ? new Date(v).toLocaleDateString() : null;
  if (field === "status") return v ? (row.doNotContact ? `${v} · do not contact` : v) : null;
  return v ?? null;
}

function fmt(value) {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString();
  return String(value);
}

/**
 * @param {{ prospectId: string, onChanged?: () => void, onSelect?: (id:string) => void, title?: string }} props
 *   `onChanged` runs after a merge or an unmerge is applied, so the page
 *   that mounted this can reload its own row. `onSelect` opens another row
 *   of the group in place (the prospects page's own detail); without it a
 *   row's name links to that page with `?id=`.
 */
export default function DuplicateGroup({ prospectId, onChanged = null, onSelect = null, title = null }) {
  const { status: roleStatus, isSuperadmin } = usePlatformAdmin();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [keep, setKeep] = useState(null);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState("");
  const [outcome, setOutcome] = useState(null);

  const load = useCallback(async () => {
    if (!prospectId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetchJson(`/api/platform/sales/prospects/duplicates?id=${encodeURIComponent(prospectId)}`);
      setData(res);
      setKeep((k) => (k && res.rows.some((r) => r.id === k) ? k : res.focusId));
      setPlan(null);
    } catch (err) {
      setError(err?.message || "Could not load the duplicates.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [prospectId]);

  useEffect(() => {
    load();
  }, [load]);

  const others = data ? data.rows.filter((r) => r.id !== keep).map((r) => r.id) : [];

  const preview = async () => {
    setBusy("preview");
    setOutcome(null);
    setError("");
    try {
      const res = await fetchJson("/api/platform/sales/prospects/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ survivorId: keep, otherIds: others }),
      });
      setPlan(res.plan);
    } catch (err) {
      setError(err?.message || "Could not plan the merge.");
    } finally {
      setBusy("");
    }
  };

  const confirm = async () => {
    setBusy("merge");
    setError("");
    try {
      const res = await fetchJson("/api/platform/sales/prospects/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ survivorId: keep, otherIds: others, confirm: true }),
      });
      const filled = (res.plan?.moved?.fills || []).map((f) => FIELD_LABEL[f.field] || f.field);
      setOutcome({
        tone: "ok",
        text: `Merged ${others.length} row${others.length === 1 ? "" : "s"} into the kept one. ${filled.length ? `Filled: ${filled.join(", ")}.` : "Nothing was missing on the kept row; the others are retired and their evidence now reads with it."}`,
      });
      setPlan(null);
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err?.message || "The merge was refused.");
    } finally {
      setBusy("");
    }
  };

  const undo = async (survivorId) => {
    setBusy("unmerge");
    setError("");
    setOutcome(null);
    try {
      const res = await fetchJson("/api/platform/sales/prospects/unmerge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ survivorId }),
      });
      const kept = (res.kept || []).map((f) => FIELD_LABEL[f] || f);
      setOutcome({
        tone: "ok",
        text: `Unmerged: ${res.reactivated.length} row${res.reactivated.length === 1 ? "" : "s"} back, ${res.cleared.length} filled field${res.cleared.length === 1 ? "" : "s"} cleared.${kept.length ? ` Kept because somebody changed them since: ${kept.join(", ")}.` : ""}`,
      });
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err?.message || "The unmerge was refused.");
    } finally {
      setBusy("");
    }
  };

  if (!prospectId) return null;
  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-duplicate-group>
        <Loader2 className="animate-spin" size={16} /> Looking for other rows for this business…
      </div>
    );
  }
  if (error && !data) {
    return (
      <p className="text-sm text-destructive" data-duplicate-group>
        <AlertCircle className="inline mr-1" size={14} /> {error}
      </p>
    );
  }
  if (!data) return null;

  const { rows, merged, gaps, columns } = data;
  const nothingToShow = rows.length < 2 && merged.length === 0;
  if (nothingToShow) return null;

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-4 space-y-3" data-duplicate-group>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Copy size={16} /> {title || `Possible duplicates (${rows.length})`}
        </h3>
        <p className="text-xs text-muted-foreground">
          One column per row. A lit cell is a gap another row can fill. Nothing is deleted by a merge.
        </p>
      </div>

      {rows.length >= 2 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0" data-duplicate-table>
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground p-2 align-bottom">Keep</th>
                {rows.map((r) => (
                  <th key={r.id} className="text-left p-2 align-bottom min-w-[12rem]">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`keep-${prospectId}`}
                        className="mt-1 h-4 w-4"
                        checked={keep === r.id}
                        onChange={() => {
                          setKeep(r.id);
                          setPlan(null);
                        }}
                        disabled={!isSuperadmin || Boolean(busy)}
                        aria-label={`Keep ${r.businessName}`}
                      />
                      <span className="space-y-0.5">
                        <span className="block font-semibold text-foreground">
                          <RowLink id={r.id} onSelect={onSelect}>{r.businessName}</RowLink>
                        </span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {r.isFocus ? "this row" : r.via === "phone" ? "same phone" : r.via === "domain" ? "same website" : r.via === "name" ? "same name, same town" : "flagged"}
                          {r.mergedCount ? ` · carries ${r.mergedCount} merged` : ""}
                        </span>
                      </span>
                    </label>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map((col) => (
                <tr key={col.field}>
                  <th scope="row" className="text-left text-xs font-medium text-muted-foreground p-2 border-t border-amber-200 dark:border-amber-900 whitespace-nowrap">
                    {col.label}
                  </th>
                  {rows.map((r) => {
                    const v = cell(r, col.field);
                    const gap = gaps[col.field] && (v === null || v === "");
                    return (
                      <td
                        key={r.id}
                        className={`p-2 border-t border-amber-200 dark:border-amber-900 break-words ${gap ? "bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100" : "text-foreground"}`}
                        data-gap={gap ? "1" : undefined}
                      >
                        {gap ? <span className="text-xs italic">missing</span> : v === null || v === "" ? <span className="text-muted-foreground">—</span> : fmt(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {rows.length >= 2 && isSuperadmin ? (
        <div className="space-y-3">
          {!plan ? (
            <button type="button" className={`${BTN} bg-primary text-primary-foreground`} disabled={!keep || Boolean(busy)} onClick={preview} data-merge-preview>
              {busy === "preview" ? <Loader2 className="animate-spin" size={16} /> : <Copy size={16} />}
              Merge {others.length} into the kept one
            </button>
          ) : (
            <div className="rounded-lg border border-border bg-card p-3 space-y-2" data-merge-plan>
              <p className="text-sm font-semibold text-foreground">What the kept row would take</p>
              {plan.fills.length ? (
                <ul className="text-sm text-foreground space-y-1">
                  {plan.fills.map((f) => {
                    const from = rows.find((r) => r.id === f.from);
                    return (
                      <li key={f.field}>
                        <span className="font-medium">{FIELD_LABEL[f.field] || f.field}</span>: {fmt(f.value)}{" "}
                        <span className="text-muted-foreground">
                          — from {from?.businessName || f.from}
                          {f.source ? ` (${from?.sourceLabel || f.source})` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing — the kept row already has every field the others carry.</p>
              )}
              {plan.tradingNames ? (
                <p className="text-sm text-foreground">
                  <span className="font-medium">Also known as</span> gains: {plan.tradingNames.filter((n) => !(plan.previousTradingNames || []).includes(n)).join(" · ")}
                </p>
              ) : null}
              {plan.claimMove ? (
                <p className="text-sm text-foreground">The live claim on {rows.find((r) => r.id === plan.claimMove.from)?.businessName || "the other row"} moves to the kept row.</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                The other {plan.retired.length === 1 ? "row is" : `${plan.retired.length} rows are`} retired — kept whole, out of every queue and count, their
                observations read together with the kept row. Contact numbers, leads, claims and call attempts move to it. Unmerge puts all of it back.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${BTN} bg-primary text-primary-foreground`} disabled={Boolean(busy)} onClick={confirm} data-merge-confirm>
                  {busy === "merge" ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Confirm merge
                </button>
                <button type="button" className={`${BTN} border border-border text-foreground`} disabled={Boolean(busy)} onClick={() => setPlan(null)}>
                  <X size={16} /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : rows.length >= 2 && roleStatus === "ready" ? (
        <p className="text-xs text-muted-foreground">Merging is a superadmin action.</p>
      ) : null}

      {merged.length ? (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2" data-merged-list>
          <p className="text-sm font-semibold text-foreground">Merged into this row ({merged.length})</p>
          <ul className="text-sm text-foreground space-y-1">
            {merged.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <RowLink id={r.id} onSelect={onSelect}>{r.businessName}</RowLink>
                <span className="text-xs text-muted-foreground">
                  {r.sourceLabel || r.sourceProvider || "hand-typed"}
                  {r.mergedAt ? ` · merged ${new Date(r.mergedAt).toLocaleDateString()}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {isSuperadmin ? (
            <button type="button" className={`${BTN} border border-border text-foreground`} disabled={Boolean(busy)} onClick={() => undo(data.focusId)} data-unmerge>
              {busy === "unmerge" ? <Loader2 className="animate-spin" size={16} /> : <Undo2 size={16} />} Unmerge
            </button>
          ) : null}
        </div>
      ) : null}

      {outcome ? (
        <p className="text-sm text-emerald-800 dark:text-emerald-200" role="status" data-merge-outcome>
          {outcome.text}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          <AlertCircle className="inline mr-1" size={14} /> {error}
        </p>
      ) : null}
    </section>
  );
}
