// app/platform/data-deletion/page.js
//
// The register of data-deletion requests, and the one button on it.
//
// What the button does NOT do: delete anything. The owner deletes by hand,
// against the database, then comes here and presses "Mark completed", which
// stamps the row and emails the person "your data was deleted on {date}".
// The page says this above the list, because a button labelled with the word
// "completed" on a screen about deletion invites exactly the wrong reading —
// AGENTS.md failure class #7 in reverse: a cosmetic control that looks
// destructive is nearly as bad as the other way round.
//
// Superadmin only. Lower roles see the refusal block, not a list of
// strangers' emails with the button missing.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, ShieldCheck, Trash2, Mail, CheckCircle2 } from "lucide-react";
import PlatformWriteGate, { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";
import { DELETION_BUSINESS_DAYS, META_CALLBACK_PLACEHOLDER_EMAIL } from "@/lib/dataDeletion/constants";
import { fetchJson } from "@/lib/fetchJson";

const STATUSES = [
  { value: "received", label: "Received" },
  { value: "completed", label: "Completed" },
  { value: "", label: "All" },
];

const SOURCE_LABEL = {
  form: "Form",
  meta_callback: "Meta callback",
  email: "Email",
};

function fmt(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Business days elapsed since a date — the unit the promise is made in. Counts
// weekdays only; holidays are not modelled, which errs toward showing a request
// as OLDER than the promise allows, never younger.
function businessDaysSince(value) {
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  let days = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cursor < now) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) days++;
  }
  return days;
}

export default function PlatformDataDeletionPage() {
  const { status: roleStatus, error: roleError, isSuperadmin } = usePlatformAdmin();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState("received");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    setFailed(false);
    setData(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      setData(await fetchJson(`/api/platform/data-deletion?${params}`));
    } catch (err) {
      setFailed(true);
      setError(err.message || "Couldn't load the register.");
    }
  }, [status]);

  useEffect(() => {
    if (isSuperadmin) load();
  }, [isSuperadmin, load]);

  async function complete(row) {
    const sure = window.confirm(
      `Mark ${row.confirmationCode} completed?\n\nThis records that YOU have already deleted the data by hand, and emails ${row.email === META_CALLBACK_PLACEHOLDER_EMAIL ? "nobody (Meta callback — no address)" : row.email} to say so. It does not delete anything itself.`,
    );
    if (!sure) return;
    setBusyId(row.id);
    setError("");
    setNotice("");
    try {
      const result = await fetchJson(`/api/platform/data-deletion/${row.id}/complete`, { method: "POST" });
      if (result.warning) setError(result.warning);
      else if (result.noAddress) setNotice(`${row.confirmationCode} marked completed. No address on a Meta-callback request, so no email was sent; the status link Meta showed them now reads completed.`);
      else setNotice(`${row.confirmationCode} marked completed and ${row.email} has been told.`);
      await load();
    } catch (err) {
      setError(err.message || "Couldn't mark it completed.");
    } finally {
      setBusyId(null);
    }
  }

  const openCount = data?.counts?.received || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Data deletion requests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Requests from /data-deletion and from Meta&apos;s deletion callback.
          {openCount > 0 && (
            <>
              {" "}
              <span className="font-medium text-foreground">{openCount} waiting.</span>
            </>
          )}
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-2.5 text-sm text-muted-foreground">
        <ShieldCheck size={16} className="shrink-0 mt-0.5 text-foreground" />
        <p>
          <span className="font-semibold text-foreground">Nothing on this page deletes data.</span>{" "}
          The deletion is done by hand, by the owner account, against the database. Once it is
          done, <em>Mark completed</em> stamps the request and emails the person that their data
          was deleted. Each request was promised within {DELETION_BUSINESS_DAYS} business days of
          being received.
        </p>
      </div>

      <PlatformWriteGate
        status={roleStatus}
        allowed={isSuperadmin}
        error={roleError}
        action="Reading and completing data deletion requests"
        who="superadmin"
      >
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium border ${
                status === s.value
                  ? "bg-inverted text-inverted-foreground border-inverted"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {s.label}
              {s.value && data?.counts?.[s.value] > 0 && (
                <span className="text-muted-foreground"> {data.counts[s.value]}</span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}
        {notice && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> {notice}
          </div>
        )}

        {failed ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <AlertCircle size={28} className="text-muted-foreground mx-auto" />
            <p className="mt-3 text-sm text-muted-foreground">
              The register could not be read. This is a failed request, not an empty list.
            </p>
            <button
              onClick={load}
              className="mt-3 min-h-[44px] px-4 text-sm font-semibold text-foreground underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : !data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : !data.rows?.length ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <Trash2 size={28} className="text-muted-foreground mx-auto" />
            <p className="mt-3 text-sm text-muted-foreground">
              No {status ? STATUSES.find((s) => s.value === status)?.label.toLowerCase() : ""} requests.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.rows.map((row) => {
              const waiting = row.status === "received";
              const age = waiting ? businessDaysSince(row.receivedAt) : 0;
              const overdue = waiting && age > DELETION_BUSINESS_DAYS;
              const noAddress = row.email === META_CALLBACK_PLACEHOLDER_EMAIL;
              return (
                <div
                  key={row.id}
                  className={`bg-card border rounded-xl p-5 ${overdue ? "border-red-300 dark:border-red-800" : "border-border"}`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-foreground">{row.confirmationCode}</span>
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {SOURCE_LABEL[row.source] || row.source}
                        </span>
                        {waiting ? (
                          <span
                            className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${
                              overdue
                                ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {age} of {DELETION_BUSINESS_DAYS} business days{overdue ? " — overdue" : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            Completed {fmt(row.completedAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground">
                        {noAddress ? (
                          <span className="text-muted-foreground">No address — Meta user id {row.metaUserId}</span>
                        ) : (
                          <>
                            {row.name ? `${row.name} · ` : ""}
                            <a className="underline underline-offset-2 break-all" href={`mailto:${row.email}`}>{row.email}</a>
                          </>
                        )}
                        {row.companyName ? <span className="text-muted-foreground"> · records at {row.companyName}</span> : null}
                      </p>
                      {row.message ? (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{row.message}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        <span>Received {fmt(row.receivedAt)}</span>
                        {!noAddress && (
                          <span className="inline-flex items-center gap-1">
                            <Mail size={11} />
                            {row.acknowledgedAt ? `receipt sent ${fmt(row.acknowledgedAt)}` : "receipt NOT sent — tell them by hand"}
                          </span>
                        )}
                      </p>
                    </div>
                    {waiting && (
                      <button
                        onClick={() => complete(row)}
                        disabled={busyId === row.id}
                        className="min-h-[44px] px-4 rounded-lg text-sm font-semibold bg-inverted text-inverted-foreground disabled:opacity-60 inline-flex items-center gap-2"
                      >
                        {busyId === row.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Mark completed
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PlatformWriteGate>
    </div>
  );
}
