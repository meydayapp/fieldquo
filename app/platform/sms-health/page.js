// app/platform/sms-health/page.js
//
// Did the texts arrive? Read-only.
//
// Twilio accepting a text is not a phone receiving it — US carriers drop texts
// from numbers not registered for A2P 10DLC (30034) after Twilio has said yes.
// This page is the answer to "did you fix the text issue?": the carrier's
// verdict on everything sent in the last 7 or 30 days, the error codes in plain
// words, and which sending number and which company they happened to. Nothing
// on it changes anything.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const PURPOSE_LABELS = {
  booking_confirmation: "Booking confirmation",
  booking_moved: "Appointment moved",
  booking_cancelled: "Appointment cancelled",
  appointment_reminder: "Appointment reminder",
  visit_reminder: "Visit reminder",
  on_my_way: "On my way",
  thread_reply: "Conversation reply (person or AI)",
  change_order: "Change order",
  referral_invite: "Referral invite",
  opt_out_confirmation: "STOP/START confirmation",
  crew_reply: "Crew line reply",
  crew_test: "Crew line test",
  photo_mention: "Photo mention",
  sales_signup_link: "Sales: signup link",
  sales_reply: "Sales: rep reply",
  other: "Other",
};

function pct(n, d) {
  return d ? `${Math.round((n / d) * 100)}%` : "—";
}

function Counts({ row }) {
  return (
    <>
      <td className="px-3 py-2 text-right tabular-nums">{row.total}</td>
      <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
        {row.delivered} <span className="text-muted-foreground">({pct(row.delivered, row.total)})</span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-red-700 dark:text-red-400">
        {row.failed} <span className="text-muted-foreground">({pct(row.failed, row.total)})</span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row.sent + row.pending}</td>
    </>
  );
}

function Table({ title, rows, label, extra }) {
  if (!rows?.length) return null;
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">{label}</th>
              <th className="px-3 py-2 text-right font-medium">Sent</th>
              <th className="px-3 py-2 text-right font-medium">Delivered</th>
              <th className="px-3 py-2 text-right font-medium">Not delivered</th>
              <th className="px-3 py-2 text-right font-medium" title="Handed to the carrier with no receipt back yet, or still at Twilio">
                No receipt
              </th>
              {extra ? <th className="px-3 py-2 text-left font-medium">Top error</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={String(r.key)}>
                <td className="px-3 py-2 text-foreground break-words">{r.display}</td>
                <Counts row={r} />
                {extra ? (
                  <td className="px-3 py-2 text-xs text-muted-foreground min-w-[16rem]">
                    {r.topError ? `${r.topError.code ?? "—"} × ${r.topError.count} — ${r.topError.reason}` : "—"}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function SmsHealthPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [errorText, setErrorText] = useState(null);

  const load = useCallback(async (d) => {
    setState("loading");
    setErrorText(null);
    try {
      setData(await fetchJson(`/api/platform/sms-health?days=${d}`));
      setState("ready");
    } catch (err) {
      setErrorText(err.message);
      setState("error");
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  const t = data?.totals;

  return (
    <div className="p-6 max-w-5xl">
      <Link href="/platform" className="text-sm text-muted-foreground underline underline-offset-2">
        ← Platform
      </Link>
      <h1 className="text-2xl font-bold text-foreground mt-3">SMS delivery</h1>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
        Whether texts actually reached a phone — Twilio&apos;s carrier receipts, not just
        &ldquo;accepted&rdquo;. Every text FieldQuo sends is tracked from the moment it goes out.
        Read-only.
      </p>

      <div className="mt-4 inline-flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Period">
        {[7, 30].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            aria-pressed={days === d}
            className={`min-h-[36px] px-3 text-sm rounded-md ${
              days === d ? "bg-foreground text-background font-semibold" : "text-muted-foreground"
            }`}
          >
            Last {d} days
          </button>
        ))}
      </div>

      {state === "loading" && (
        <p className="text-sm text-muted-foreground mt-6 flex items-center gap-2">
          <Loader2 size={15} className="animate-spin" /> Reading deliveries…
        </p>
      )}
      {state === "error" && <p className="text-sm text-red-700 dark:text-red-400 mt-6">{errorText}</p>}

      {state === "ready" && data && (
        <>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Sent", t.total, "text-foreground"],
              ["Delivered", `${t.delivered} (${pct(t.delivered, t.total)})`, "text-emerald-700 dark:text-emerald-400"],
              ["Not delivered", `${t.failed} (${pct(t.failed, t.total)})`, "text-red-700 dark:text-red-400"],
              ["No receipt yet", t.sent + t.pending, "text-muted-foreground"],
            ].map(([label, value, tone]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-xl font-semibold tabular-nums mt-1 ${tone}`}>{value}</p>
              </div>
            ))}
          </div>

          {t.total === 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              No texts sent in this period since delivery tracking began.
            </p>
          )}

          {data.topError && (
            <div className="mt-4 rounded-xl border border-red-300 dark:border-red-900 bg-card p-4">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle size={15} className="text-red-700 dark:text-red-400" />
                Top reason texts didn&apos;t arrive: error {data.topError.code ?? "(none given)"} —{" "}
                {Math.round(data.topError.share * 100)}% of failures
              </p>
              <p className="text-sm text-foreground mt-1.5">{data.topError.reason}</p>
              {data.topError.code === 30034 && (
                <p className="text-sm text-muted-foreground mt-1.5">
                  Fix: the sending number needs a registered A2P 10DLC brand and campaign, with the
                  number in the campaign&apos;s Messaging Service. Each number&apos;s registration state
                  and the steps are on{" "}
                  <Link href="/platform/crew-lines" className="underline underline-offset-2">
                    Crew lines
                  </Link>
                  . Until then US carriers keep dropping these, and Twilio keeps saying
                  &ldquo;accepted&rdquo;.
                </p>
              )}
            </div>
          )}

          {/* Which mechanism is doing the work. The status callback should
              settle nearly everything; the hourly reconcile catching most of
              it means the callback is not arriving. */}
          <div
            className={`mt-4 rounded-xl border bg-card p-4 ${
              data.mechanism.callbackMissing ? "border-amber-400 dark:border-amber-700" : "border-border"
            }`}
          >
            <p className="text-sm text-foreground">
              {data.mechanism.callbackSettled} text{data.mechanism.callbackSettled === 1 ? "" : "s"} had a
              status callback from Twilio · {data.mechanism.reconcileOnly} had none and were settled by
              the hourly reconcile · {data.mechanism.callbacksReceived} callback
              {data.mechanism.callbacksReceived === 1 ? "" : "s"} received in all
            </p>
            {data.mechanism.callbackMissing && (
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1.5">
                Twilio&apos;s status callbacks aren&apos;t arriving. Check that NEXT_PUBLIC_APP_URL is the
                production domain (a *.vercel.app URL behind Deployment Protection answers Twilio with
                401), and that TWILIO_AUTH_TOKEN is set — /api/sms/status cannot verify a callback without
                it. Receipts are still correct; they just arrive up to an hour late.
              </p>
            )}
          </div>

          {data.codes.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-foreground">Why texts didn&apos;t arrive</h2>
              <ul className="mt-2 rounded-xl border border-border bg-card divide-y divide-border">
                {data.codes.map((c) => (
                  <li key={String(c.code)} className="px-4 py-2.5 text-sm flex gap-3">
                    <span className="font-mono tabular-nums text-foreground w-14 shrink-0">{c.code ?? "—"}</span>
                    <span className="tabular-nums text-foreground w-10 shrink-0 text-right">{c.count}</span>
                    <span className="text-muted-foreground">{c.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Table
            title="By sending number"
            label="From"
            extra
            rows={data.byNumber.map((r) => ({ ...r, display: <span className="font-mono">{r.number || "(unknown)"}</span> }))}
          />
          <Table
            title="By company"
            label="Company"
            extra
            rows={data.byCompany.map((r) => ({
              ...r,
              display: r.companyId ? (
                <Link href={`/platform/companies/${r.companyId}`} className="underline underline-offset-2">
                  {r.name}
                </Link>
              ) : (
                r.name
              ),
            }))}
          />
          <Table
            title="By kind of text"
            label="Kind"
            rows={data.byPurpose.map((r) => ({ ...r, display: PURPOSE_LABELS[r.key] || r.key }))}
          />

          {data.recentFailures.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-foreground">Latest texts that didn&apos;t arrive</h2>
              <ul className="mt-2 rounded-xl border border-border bg-card divide-y divide-border">
                {data.recentFailures.map((f) => (
                  <li key={f.id} className="px-4 py-2.5 text-sm">
                    <p className="text-foreground">
                      {f.company} · {PURPOSE_LABELS[f.purpose] || f.purpose} · to {f.to}
                      <span className="text-muted-foreground">
                        {" "}· from {f.from || "?"} · sent {new Date(f.sentAt).toLocaleString()}
                        {f.failedAt ? ` · failed ${new Date(f.failedAt).toLocaleString()}` : ""}
                      </span>
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                      {f.errorCode ? `${f.errorCode} — ` : ""}
                      {f.reason}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
