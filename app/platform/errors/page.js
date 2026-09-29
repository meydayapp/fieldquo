// app/platform/errors/page.js
//
// The failure queue. Everything here is something that broke without the
// customer necessarily noticing — a rejected email, a Stripe sync that didn't
// land, a PDF that didn't render.
//
// Marking a row reviewed hides it so the list stays a to-do — an empty list
// is the point: it means nothing is currently broken. Nothing is deleted and
// nothing is reviewed automatically: a fixed error stays in the archive behind
// "Show reviewed", with who decided it was fine and their one-line reason,
// because the row is the evidence and the reason has to outlive the person.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, Check, Undo2, Mail, CreditCard, FileText, Bot, Webhook, Upload, Clock, Users } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { ERROR_KINDS, KIND_LABELS } from "@/lib/platform/errorKinds";

const ENV_LABELS = { production: "Production", preview: "Preview", local: "Local" };

// Icon AND label together, because they were two facts about the same thing
// kept in one place and none. `account_abuse` had an icon and no label, so the
// filter chip read "account_abuse (3)" and the badge read "ACCOUNT_ABUSE" —
// the raw column value, in a console where every other area happens to be a
// single lowercase word and so looked deliberate.
const AREAS = {
  email: { icon: Mail, label: "Email" },
  stripe: { icon: CreditCard, label: "Stripe" },
  pdf: { icon: FileText, label: "PDF" },
  ai: { icon: Bot, label: "AI" },
  webhook: { icon: Webhook, label: "Webhooks" },
  upload: { icon: Upload, label: "Uploads" },
  cron: { icon: Clock, label: "Scheduled jobs" },
  // Not a failure in the same sense as the rest of this list — nothing broke.
  // It lands here anyway because this is the queue staff actually open, and a
  // seat-sharing flag that nobody sees is the same as no flag at all.
  account_abuse: { icon: Users, label: "Seat sharing" },
};

// An area this file has not been taught about still reads as words rather than
// as a column value, and is not silently dropped — an unrecognised area is
// exactly the thing worth seeing.
function areaLabel(area) {
  if (AREAS[area]) return AREAS[area].label;
  if (!area) return "Uncategorised";
  return area.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const areaIcon = (area) => AREAS[area]?.icon || AlertTriangle;

function when(iso) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const BTN =
  "inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-full px-3 py-1.5 hover:bg-muted disabled:opacity-60 min-h-[44px] lg:min-h-0";

// The one-line "why is this fine" prompt. Optional: an empty note still marks
// the row, because insisting on prose produces "ok" typed 40 times, not
// reasons. Shared by the per-row button and the batch bar.
function ReviewForm({ count, busy, onSubmit, onCancel }) {
  const [note, setNote] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(note);
      }}
      className="mt-2 flex flex-wrap gap-2 items-center"
    >
      <input
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why is this fine? (optional, one line)"
        maxLength={300}
        className="flex-1 min-w-[200px] border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground"
      />
      <button type="submit" disabled={busy} className={`${BTN} bg-inverted text-inverted-foreground border-foreground`}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        Mark {count > 1 ? `${count} ` : ""}reviewed
      </button>
      <button type="button" onClick={onCancel} disabled={busy} className={BTN}>
        Cancel
      </button>
    </form>
  );
}

// "Mark all like this reviewed": same area + code, optionally only this
// attempt's. The count is fetched before anything can be confirmed, and the
// newest matching row's time goes back with the confirm as `before` — so
// what is marked is what the number said, never rows that arrived while the
// panel was open. Built for the day one stuck sales-dial attempt filled the
// queue with 7,360 copies of one entry.
function LikeForm({ area, code, attemptId, onDone, onCancel }) {
  const [onlyAttempt, setOnlyAttempt] = useState(false);
  const [counts, setCounts] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    setCounts(null);
    setErr("");
    const qs = new URLSearchParams({ area, code });
    if (onlyAttempt && attemptId) qs.set("attemptId", attemptId);
    fetchJson(`/api/platform/errors/like?${qs}`)
      .then((j) => live && setCounts(j))
      .catch((e) => live && setErr(e.message));
    return () => {
      live = false;
    };
  }, [area, code, attemptId, onlyAttempt]);

  async function confirm(e) {
    e.preventDefault();
    if (!counts?.count) return;
    setBusy(true);
    setErr("");
    try {
      await fetchJson("/api/platform/errors/like", {
        method: "PATCH",
        body: { area, code, attemptId: onlyAttempt ? attemptId : null, before: counts.newestAt, note },
      });
      await onDone();
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  const n = counts?.count ?? null;
  return (
    <form onSubmit={confirm} className="mt-2 rounded-lg border border-border bg-muted/40 p-3 space-y-2">
      <p className="text-sm text-foreground">
        {n === null && !err && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> Counting…
          </span>
        )}
        {n !== null && (
          <>
            Mark <strong>{n.toLocaleString()}</strong> unreviewed{" "}
            <span className="font-mono text-xs">{area} · {code}</span> {n === 1 ? "error" : "errors"}
            {onlyAttempt && attemptId ? <> for attempt <span className="font-mono text-xs">{attemptId}</span></> : null} reviewed?
            {n > 0 && counts.oldestAt && (
              <span className="block text-xs text-muted-foreground mt-0.5">
                From {when(counts.oldestAt)} to {when(counts.newestAt)}. Nothing is deleted; they move to the reviewed archive.
              </span>
            )}
          </>
        )}
      </p>
      {attemptId && (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground min-h-[44px] lg:min-h-0">
          <input type="checkbox" checked={onlyAttempt} onChange={(e) => setOnlyAttempt(e.target.checked)} disabled={busy} />
          Only this attempt ({attemptId})
        </label>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why is this fine? (optional, one line)"
          maxLength={300}
          className="flex-1 min-w-[200px] border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground"
        />
        <button type="submit" disabled={busy || !n} className={`${BTN} bg-inverted text-inverted-foreground border-foreground`}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Mark {n ? n.toLocaleString() : ""} reviewed
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className={BTN}>
          Cancel
        </button>
      </div>
      {err && <p className="text-xs text-red-700 dark:text-red-300">{err}</p>}
    </form>
  );
}

export default function PlatformErrorsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  // `?area=voice_webhook` from the dashboard's refused-deliveries line lands
  // on the filtered list, not on everything.
  const [area, setArea] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("area") || "";
  });
  const [showReviewed, setShowReviewed] = useState(false);
  // Errors · Notices · Security (lib/platform/errorKinds.js), Errors first;
  // and where the row was written, production first — the owner's Mac
  // writes to the production database too.
  const [kind, setKind] = useState("error");
  const [env, setEnv] = useState("production");
  const [busy, setBusy] = useState(false);
  // Checkbox selection, by id. Cleared on every reload so a row that moved to
  // the other list can't stay "selected" invisibly.
  const [selected, setSelected] = useState(() => new Set());
  // Which note form is open: an error id, "batch", or null.
  const [noteFor, setNoteFor] = useState(null);
  // Which "like this" panel is open: an error id, or `repeat:<area>|<code>`.
  const [likeFor, setLikeFor] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const qs = new URLSearchParams();
      if (area) qs.set("area", area);
      if (showReviewed) qs.set("resolved", "1");
      qs.set("kind", kind);
      qs.set("env", env);
      const json = await fetchJson(`/api/platform/errors?${qs}`);
      setData(json);
      setSelected(new Set());
      setNoteFor(null);
      setLikeFor(null);
    } catch (e) {
      setError(e.message);
    }
  }, [area, showReviewed, kind, env]);

  useEffect(() => {
    load();
  }, [load]);

  // One row goes through the [id] route; a batch through the collection. Both
  // land in the same helper server-side, so the difference is only the URL.
  async function review(ids, reviewed, note = "") {
    setBusy(true);
    setError("");
    try {
      if (ids.length === 1) {
        await fetchJson(`/api/platform/errors/${ids[0]}`, { method: "PATCH", body: { reviewed, note } });
      } else {
        await fetchJson("/api/platform/errors", { method: "PATCH", body: { ids, reviewed, note } });
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const errors = data?.errors || [];
  // Unreviewed copies per (area, code), from the server — not a count of
  // this page, which holds at most 100 rows.
  const repeats = showReviewed ? [] : data?.repeats || [];
  const repeatCount = new Map(repeats.map((g) => [`${g.area}|${g.code}`, g.count]));
  const allSelected = errors.length > 0 && errors.every((e) => selected.has(e.id));
  const selectedIds = errors.filter((e) => selected.has(e.id)).map((e) => e.id);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(errors.map((e) => e.id)));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle size={20} /> Errors
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Failures that don&apos;t surface to the customer — rejected emails, Stripe
            syncs that didn&apos;t land, PDFs that didn&apos;t render. Mark one reviewed to
            clear it from the queue; it stays in the archive with your reason.
          </p>
        </div>
        {data && (
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              data.unresolvedCount > 0
                ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {data.unresolvedCount} unreviewed
          </span>
        )}
      </div>

      {/* Kind tabs and environment. Counts are unreviewed, under the chosen
          environment — so "Errors (0)" in Production means fieldquo.com is
          clean even while a local script's failures sit under Local. */}
      <div className="flex items-center gap-2 flex-wrap border-b border-border pb-2">
        {ERROR_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => {
              setKind(k);
              setArea("");
            }}
            aria-pressed={kind === k}
            className={`min-h-[44px] lg:min-h-0 text-sm font-semibold px-3 py-1.5 rounded-lg ${
              kind === k ? "bg-inverted text-inverted-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {KIND_LABELS[k]}
            {data?.kindCounts ? ` (${(data.kindCounts[k] ?? 0).toLocaleString()})` : ""}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground min-h-[44px] lg:min-h-0">
          Where
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            className="border border-border rounded-lg px-2 py-1 text-xs bg-card text-foreground"
          >
            <option value="production">Production (fieldquo.com)</option>
            <option value="preview">Preview deployments</option>
            <option value="local">Local (scripts, dev)</option>
            <option value="all">Everywhere</option>
          </select>
        </label>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setArea("")}
          className={`min-h-[44px] min-w-[44px] lg:min-h-0 text-xs font-semibold px-3 py-1.5 rounded-full border ${
            area === "" ? "border-foreground bg-inverted text-inverted-foreground" : "border-border text-muted-foreground"
          }`}
        >
          All
        </button>
        {(data?.areas || []).map((a) => (
          <button
            key={a.area}
            onClick={() => setArea(a.area)}
            className={`min-h-[44px] min-w-[44px] lg:min-h-0 text-xs font-semibold px-3 py-1.5 rounded-full border ${
              area === a.area ? "border-foreground bg-inverted text-inverted-foreground" : "border-border text-muted-foreground"
            }`}
          >
            {areaLabel(a.area)} ({a.count})
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground min-h-[44px] lg:min-h-0">
          <input type="checkbox" checked={showReviewed} onChange={(e) => setShowReviewed(e.target.checked)} />
          Show reviewed{data ? ` (${data.reviewedCount})` : ""}
        </label>
      </div>

      {/* The same failure, repeating. Up to five, loudest first; ten copies
          or more, because two of a kind is ordinary and this strip is for
          the one that is drowning the list. */}
      {repeats.filter((g) => g.count >= 10).length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Repeating</p>
          {repeats
            .filter((g) => g.count >= 10)
            .slice(0, 5)
            .map((g) => {
              const key = `repeat:${g.area}|${g.code}`;
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {areaLabel(g.area)}
                    </span>
                    <span className="font-mono text-muted-foreground">{g.code}</span>
                    <span className="font-semibold text-foreground">×{g.count.toLocaleString()}</span>
                    <span className="text-muted-foreground">— last {when(g.lastAt)}</span>
                    {likeFor !== key && (
                      <button onClick={() => setLikeFor(key)} disabled={busy} className={`ml-auto ${BTN}`}>
                        <Check size={12} /> Mark all like this reviewed
                      </button>
                    )}
                  </div>
                  {likeFor === key && (
                    <LikeForm area={g.area} code={g.code} attemptId={null} onDone={load} onCancel={() => setLikeFor(null)} />
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Batch bar. The "Mark all shown" shortcut of old is "select all" here,
          so what gets marked is what is ticked and visible — never a row that
          scrolled off or arrived since the page loaded. */}
      {errors.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-2 flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground min-h-[44px] lg:min-h-0">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all shown" />
            {selectedIds.length ? `${selectedIds.length} selected` : "Select all shown"}
          </label>
          {selectedIds.length > 0 && !showReviewed && noteFor !== "batch" && (
            <button onClick={() => setNoteFor("batch")} disabled={busy} className={BTN}>
              <Check size={12} /> Mark {selectedIds.length} reviewed
            </button>
          )}
          {selectedIds.length > 0 && showReviewed && (
            <button onClick={() => review(selectedIds, false)} disabled={busy} className={BTN}>
              <Undo2 size={12} /> Unmark {selectedIds.length}
            </button>
          )}
          {noteFor === "batch" && (
            <div className="basis-full">
              <ReviewForm
                count={selectedIds.length}
                busy={busy}
                onSubmit={(note) => review(selectedIds, true, note)}
                onCancel={() => setNoteFor(null)}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 px-3 py-2">
          {error}
        </p>
      )}

      {!data && !error && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      )}

      {data && errors.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Check size={26} className="mx-auto mb-2 text-emerald-600" />
          <p className="text-sm font-semibold text-foreground">
            {showReviewed ? "Nothing reviewed yet." : "Nothing is broken."}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {showReviewed ? "" : "Failures will appear here the moment they happen."}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {errors.map((e) => {
          const Icon = areaIcon(e.area);
          return (
            <div key={e.id} className={`rounded-xl border border-border bg-card p-4 ${e.resolvedAt ? "opacity-80" : ""}`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggle(e.id)}
                  aria-label={`Select ${e.code || e.area} error`}
                  className="mt-2.5 shrink-0"
                />
                <span className="grid w-9 h-9 rounded-lg place-items-center bg-muted text-muted-foreground shrink-0">
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {areaLabel(e.area)}
                    </span>
                    {e.code && <span className="text-[11px] font-mono text-muted-foreground">{e.code}</span>}
                    {!e.resolvedAt && e.code && (repeatCount.get(`${e.area}|${e.code}`) || 0) > 1 && (
                      <span className="text-[11px] font-semibold text-foreground">
                        ×{repeatCount.get(`${e.area}|${e.code}`).toLocaleString()} unreviewed
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">· {when(e.createdAt)}</span>
                    {/* Where it was written. Every row says so; a row from
                        before the stamp says that, not a guess. */}
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                      {ENV_LABELS[e.environment] || "env not recorded"}
                    </span>                    {e.companyId && (
                      <>
                        <Link
                          href={`/platform/companies/${e.companyId}`}
                          className="text-[11px] font-semibold text-foreground underline"
                        >
                          {e.companyName || "company"}
                        </Link>
                        {/* Quietly, and only when there is one. Two companies
                            called "Precision Painting" are told apart by the
                            person who signed up, not by the name. Absent when
                            no member holds the owner role — nothing is invented
                            to fill the space. */}
                        {e.companyOwnerEmail && (
                          <span className="text-[11px] text-muted-foreground break-all">
                            {e.companyOwnerEmail}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-1 break-words">{e.message}</p>
                  {e.detail && (
                    <details className="mt-1.5">
                      <summary className="text-[11px] text-muted-foreground cursor-pointer">Detail</summary>
                      <pre className="mt-1 text-[10px] bg-muted rounded p-2 overflow-x-auto">
                        {JSON.stringify(e.detail, null, 2)}
                      </pre>
                    </details>
                  )}
                  {e.resolvedAt && (
                    <p className="text-[11px] text-muted-foreground mt-1.5 break-words">
                      Reviewed by {e.resolvedByEmail || "platform"} {when(e.resolvedAt)}
                      {e.resolvedNote ? ` — ${e.resolvedNote}` : ""}
                    </p>
                  )}
                  {noteFor === e.id && (
                    <ReviewForm
                      count={1}
                      busy={busy}
                      onSubmit={(note) => review([e.id], true, note)}
                      onCancel={() => setNoteFor(null)}
                    />
                  )}
                  {likeFor === e.id && (
                    <LikeForm
                      area={e.area}
                      code={e.code}
                      attemptId={typeof e.detail?.attemptId === "string" ? e.detail.attemptId : null}
                      onDone={load}
                      onCancel={() => setLikeFor(null)}
                    />
                  )}
                </div>
                {!e.resolvedAt && noteFor !== e.id && likeFor !== e.id && (
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <button onClick={() => setNoteFor(e.id)} disabled={busy} className={BTN}>
                      <Check size={12} /> Mark reviewed
                    </button>
                    {/* Only where there is a "like": a code, and another
                        unreviewed row carrying it. */}
                    {e.code && (repeatCount.get(`${e.area}|${e.code}`) || 0) > 1 && (
                      <button onClick={() => setLikeFor(e.id)} disabled={busy} className={BTN}>
                        <Check size={12} /> Mark all like this reviewed
                      </button>
                    )}
                  </div>
                )}
                {e.resolvedAt && (
                  <button onClick={() => review([e.id], false)} disabled={busy} className={`shrink-0 ${BTN}`}>
                    <Undo2 size={12} /> Unmark
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
