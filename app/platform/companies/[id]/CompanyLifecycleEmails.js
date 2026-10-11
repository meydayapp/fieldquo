// app/platform/companies/[id]/CompanyLifecycleEmails.js
//
// READ-ONLY: which lifecycle emails FieldQuo wrote to this company, when, and
// which it decided not to write and why — from /api/platform/companies/[id]/
// lifecycle-emails, which reads the records each sender keeps (LifecycleEmail
// rows; the next-steps, trial-reminder and signup-recovery stamps on Company).
// No buttons: the console views and never edits a company's data
// (non-negotiable 3), and nothing here is a control.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Mail } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const LABELS = {
  feature_payments: "Nudge: take card payments",
  feature_booking: "Nudge: turn on online booking",
  feature_quote: "Nudge: send your first quote",
  feature_import: "Nudge: import your clients",
  milestone_booking: "Milestone: booking page is live",
  milestone_payments: "Milestone: Stripe connected → pay over time",
  milestone_quote: "Milestone: first quote sent → follow-ups",
  personal_checkin: "Personal day-3 note",
  help_articles: "Day-5 help articles",
  trial_ended: "Trial ended",
};

function when(value, timeZone) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString("en-CA", { timeZone: timeZone || "America/Toronto", dateStyle: "medium", timeStyle: "short" });
  } catch {
    return new Date(value).toISOString();
  }
}

function rowStatus(r, tz) {
  if (r.sentAt) return { tone: "ok", text: `Sent ${when(r.sentAt, tz)}${r.toAddress ? ` to ${r.toAddress}` : ""}${r.language ? ` (${r.language})` : ""}` };
  if (r.skipped) return { tone: "muted", text: `Not sent — ${r.skipped.replace(/_/g, " ")}` };
  if (r.claimedAt) return { tone: "muted", text: `Sending (claimed ${when(r.claimedAt, tz)})` };
  if (r.failedAt) return { tone: "bad", text: `Failed ${when(r.failedAt, tz)}${r.error ? `: ${r.error}` : ""} — retried automatically` };
  if (r.observedAt) return { tone: "muted", text: `Milestone reached ${when(r.observedAt, tz)} — letter due the next day` };
  return { tone: "muted", text: "—" };
}

export default function CompanyLifecycleEmails({ companyId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson(`/api/platform/companies/${companyId}/lifecycle-emails`));
    } catch (err) {
      setError(err.message || "Could not load the lifecycle emails.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const c = data?.company;
  const tz = c?.timezone;
  const stamps = c
    ? [
        ["Signup-recovery note", c.signupNudgeSentAt],
        ["Next-steps letter", c.nextStepsEmailSentAt, c.nextStepsEmailSkipped],
        ["Trial reminder — 7 days", c.trialReminder7At],
        ["Trial reminder — 3 days", c.trialReminder3At],
        ["Trial reminder — 1 day", c.trialReminder1At],
      ]
    : [];
  const byKind = new Map((data?.rows || []).map((r) => [r.kind, r]));

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2">
        <Mail size={16} className="text-muted-foreground" />
        <h2 className="font-semibold text-foreground">Lifecycle emails</h2>
      </div>
      <p className="text-xs text-muted-foreground mt-1">What FieldQuo has emailed this company about its own account, in the company&apos;s time zone. Read-only.</p>

      {loading && <Loader2 size={16} className="animate-spin text-muted-foreground mt-3" />}
      {error && (
        <p className="text-sm text-red-700 dark:text-red-300 mt-3 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}{" "}
          <button type="button" onClick={load} className="underline underline-offset-2">
            Retry
          </button>
        </p>
      )}

      {data && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {stamps.map(([label, at, skipped]) => (
                <tr key={label} className="border-t border-border">
                  <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{label}</td>
                  <td className="py-2 text-foreground">{at ? `Sent ${when(at, tz)}` : skipped ? `Not sent — ${String(skipped).replace(/_/g, " ")}` : "—"}</td>
                </tr>
              ))}
              {(data.kinds || []).map((k) => {
                const r = byKind.get(k);
                const st = r ? rowStatus(r, tz) : { tone: "muted", text: "—" };
                return (
                  <tr key={k} className="border-t border-border">
                    <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{LABELS[k] || k}</td>
                    <td className={`py-2 ${st.tone === "ok" ? "text-foreground" : st.tone === "bad" ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>{st.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-3">
            {data.ownerPreferences
              ? `Owner's email preferences — tips: ${data.ownerPreferences.tips ? "on" : "off"}, product news: ${data.ownerPreferences.updates ? "on" : "off"}, offers: ${data.ownerPreferences.offers ? "on" : "off"}${data.ownerPreferences.changedAt ? ` (changed ${when(data.ownerPreferences.changedAt, tz)} via ${String(data.ownerPreferences.changedVia || "").replace(/_/g, " ")})` : " (never changed — defaults)"}.`
              : "No active owner, so no email preferences to show."}
          </p>
        </div>
      )}
    </div>
  );
}
