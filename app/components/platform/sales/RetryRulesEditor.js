// app/components/platform/sales/RetryRulesEditor.js
//
// The retry rule table on /platform/sales/retry-pool, as a form.
//
// ══ What it edits ═════════════════════════════════════════════════════════
//
// The four numbers of each RETRY-kind rule — wait, same day, ceiling,
// rotate — for no answer, busy, voicemail and gatekeeper. A callback and
// every final outcome are printed as rows but have nothing to edit, and the
// row says so rather than drawing a disabled input. The code's own `why`
// (lib/sales/retryRules.js) is printed beside every number whatever the
// number is; an edit may add a note of its own, and the row shows who set
// it and when when it is an override. "Reset to defaults" writes the
// defaults back through the same route (never a delete) and is confirmed
// with a second press, since it changes every rep's queue at once.
//
// ══ Why a separate component ══════════════════════════════════════════════
//
// The page holds the Exhausted list and its Recycle; this holds the rules.
// The two share one route and one `rules` payload — the page loads it and
// hands it down; a save hands the fresh table back up through `onSaved` so
// the exhausted rows' "N of M" re-render on the new ceiling.
"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { DISPOSITIONS } from "@/lib/sales/calls/dispositions";
import {
  RETRY_ATTEMPTS_MAX,
  RETRY_ATTEMPTS_MIN,
  RETRY_DELAY_MAX_MINUTES,
  RETRY_DELAY_MIN_MINUTES,
  RETRY_KIND_CALLBACK,
  RETRY_KIND_FINAL,
  RETRY_KIND_RETRY,
} from "@/lib/sales/retryRules";

/** "2 h", "2 days", "15 min" — derived, never retyped. */
export function minutesText(m) {
  if (!Number.isFinite(m)) return "—";
  if (m % (24 * 60) === 0) return `${m / (24 * 60)} day${m === 24 * 60 ? "" : "s"}`;
  if (m % 60 === 0) return `${m / 60} h`;
  return `${m} min`;
}

function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

const INPUT = "w-24 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground";

/** The editable fields of one row, from the server's table row. */
function draftOf(r) {
  return { delayMinutes: String(r.delayMinutes ?? ""), sameDay: Boolean(r.sameDay), maxAttempts: String(r.maxAttempts ?? ""), rotateBlock: Boolean(r.rotateBlock), note: r.note || "" };
}

export default function RetryRulesEditor({ rules, blocks = [], onSaved }) {
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  // The form follows the server's table: a fresh load (or another admin's
  // save answered by a reload) replaces what is typed, which is the honest
  // choice — a stale draft over a changed rule is how two admins overwrite
  // each other without knowing.
  useEffect(() => {
    const next = {};
    for (const r of rules || []) if (r.editable) next[r.code] = draftOf(r);
    setDraft(next);
  }, [rules]);

  const editable = (rules || []).filter((r) => r.editable);
  const dirty = editable.some((r) => {
    const d = draft[r.code];
    if (!d) return false;
    return Number(d.delayMinutes) !== r.delayMinutes || Number(d.maxAttempts) !== r.maxAttempts || d.sameDay !== Boolean(r.sameDay) || d.rotateBlock !== Boolean(r.rotateBlock) || (d.note || "") !== (r.note || "");
  });

  function set(code, field, value) {
    setDraft((prev) => ({ ...prev, [code]: { ...prev[code], [field]: value } }));
  }

  async function post(body) {
    setBusy(body.action);
    setError("");
    setNotice("");
    let res;
    try {
      res = await fetch("/api/platform/sales/retry-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      setError("Couldn't reach the server.");
      setBusy("");
      return null;
    }
    const payload = await res.json().catch(() => null);
    setBusy("");
    if (!res.ok) {
      setError(payload?.error || `Couldn't save (${res.status}).`);
      return null;
    }
    return payload;
  }

  async function save() {
    const body = { action: "rules", rules: {} };
    for (const r of editable) {
      const d = draft[r.code];
      if (!d) continue;
      body.rules[r.code] = {
        delayMinutes: Number(d.delayMinutes),
        sameDay: Boolean(d.sameDay),
        maxAttempts: Number(d.maxAttempts),
        rotateBlock: Boolean(d.rotateBlock),
        note: d.note || "",
      };
    }
    const payload = await post(body);
    if (!payload) return;
    setNotice("Saved. Every rep's queue runs on these numbers from their next request; the change is in the audit log.");
    onSaved?.(payload.rules);
  }

  async function reset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    const payload = await post({ action: "reset" });
    if (!payload) return;
    setNotice("Reset. The code defaults were written back (nothing was deleted) and the reset is in the audit log.");
    onSaved?.(payload.rules);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        What happens to a prospect after each outcome a rep can log. The four numbers of a retry are
        yours to set; the reason beside each is the code&apos;s own and stays whatever the number is. The
        attempt ceiling is compared against all dispositioned dials on the row; the rule that fires is the
        one for the latest outcome. &ldquo;Same day&rdquo; keeps a delayed retry today when today is still open
        where the prospect is, even if the rotation would rather wait for tomorrow. Rotation moves the next
        dial to the next part of the prospect&apos;s day — {blocks.join(" → ") || "morning → midday → afternoon → evening"} — in
        the prospect&apos;s own zone, and never inside a shut calling window.
      </p>

      {error && <p className="rounded-lg border border-border bg-card p-3 text-sm text-amber-700 dark:text-amber-300">{error}</p>}
      {notice && <p className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">{notice}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-2 pr-3 font-medium">Outcome</th>
              <th className="py-2 pr-3 font-medium">Then</th>
              <th className="py-2 pr-3 font-medium">Wait (min)</th>
              <th className="py-2 pr-3 font-medium">Same day</th>
              <th className="py-2 pr-3 font-medium">Ceiling</th>
              <th className="py-2 pr-3 font-medium">Rotate block</th>
              <th className="py-2 font-medium">Why</th>
            </tr>
          </thead>
          <tbody>
            {(rules || []).map((r) => {
              const d = draft[r.code];
              const isRetry = r.kind === RETRY_KIND_RETRY;
              return (
                <tr key={r.code} className="border-b border-border last:border-0 align-top" data-outcome={r.code}>
                  <td className="py-2 pr-3 text-foreground whitespace-nowrap">
                    {DISPOSITIONS[r.code]?.label || r.code}
                    {r.source === "override" ? (
                      <p className="text-xs text-muted-foreground whitespace-normal">
                        Set {r.updatedAt ? when(r.updatedAt) : ""}{r.updatedById ? ` by ${r.updatedById}` : ""}. Default: {minutesText(r.defaults?.delayMinutes)}, {r.defaults?.sameDay ? "same day" : "any day"}, {r.defaults?.maxAttempts} attempts, {r.defaults?.rotateBlock ? "rotates" : "same block"}.
                      </p>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-foreground whitespace-nowrap">
                    {isRetry ? "Retry" : r.kind === RETRY_KIND_CALLBACK ? "Callback at the agreed time" : r.kind === RETRY_KIND_FINAL ? "Final — no retry" : r.kind}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {isRetry && d ? (
                      <>
                        <input
                          type="number"
                          min={RETRY_DELAY_MIN_MINUTES}
                          max={RETRY_DELAY_MAX_MINUTES}
                          step={1}
                          className={INPUT}
                          value={d.delayMinutes}
                          aria-label={`Wait in minutes after ${DISPOSITIONS[r.code]?.label || r.code}`}
                          onChange={(e) => set(r.code, "delayMinutes", e.target.value)}
                        />
                        <span className="ml-2 text-xs text-muted-foreground">{minutesText(Number(d.delayMinutes))}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {isRetry && d ? (
                      <input type="checkbox" checked={d.sameDay} aria-label={`Same day after ${DISPOSITIONS[r.code]?.label || r.code}`} onChange={(e) => set(r.code, "sameDay", e.target.checked)} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {isRetry && d ? (
                      <>
                        <input
                          type="number"
                          min={RETRY_ATTEMPTS_MIN}
                          max={RETRY_ATTEMPTS_MAX}
                          step={1}
                          className={INPUT}
                          value={d.maxAttempts}
                          aria-label={`Attempt ceiling after ${DISPOSITIONS[r.code]?.label || r.code}`}
                          onChange={(e) => set(r.code, "maxAttempts", e.target.value)}
                        />
                        <span className="ml-2 text-xs text-muted-foreground">attempts</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {isRetry && d ? (
                      <input type="checkbox" checked={d.rotateBlock} aria-label={`Rotate block after ${DISPOSITIONS[r.code]?.label || r.code}`} onChange={(e) => set(r.code, "rotateBlock", e.target.checked)} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 text-muted-foreground">
                    <p>{r.why}</p>
                    {isRetry && d ? (
                      <input
                        type="text"
                        maxLength={500}
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                        placeholder="Your note (optional) — why this number"
                        value={d.note}
                        aria-label={`Note for ${DISPOSITIONS[r.code]?.label || r.code}`}
                        onChange={(e) => set(r.code, "note", e.target.value)}
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy !== "" || !dirty}
          onClick={save}
          className="min-h-[44px] px-3 inline-flex items-center gap-2 rounded-md bg-inverted text-inverted-foreground text-sm font-medium disabled:opacity-50"
        >
          {busy === "rules" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save rules
        </button>
        <button
          type="button"
          disabled={busy !== ""}
          onClick={reset}
          onBlur={() => setConfirmReset(false)}
          className="min-h-[44px] px-3 inline-flex items-center gap-2 rounded-md border border-border text-sm font-medium text-foreground disabled:opacity-50"
        >
          {busy === "reset" ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          {confirmReset ? "Press again to write the defaults back" : "Reset to defaults"}
        </button>
        <span className="text-xs text-muted-foreground">
          Wait {RETRY_DELAY_MIN_MINUTES}–{RETRY_DELAY_MAX_MINUTES} min, ceiling {RETRY_ATTEMPTS_MIN}–{RETRY_ATTEMPTS_MAX}. A save with one bad cell writes nothing.
        </span>
      </div>
    </div>
  );
}
