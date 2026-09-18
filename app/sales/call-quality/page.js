"use client";

// app/sales/call-quality/page.js
//
// "Your call quality": the rep's own scorecards — the number, which lines
// of the rubric were met, and the three coaching sentences the model wrote
// in their language — and never another rep's. No transcript and no audio:
// lib/sales/calls/recordingsList.js's decision that a rep is told the call
// is recorded and does not listen back stands. Where the owner or the
// agency has written a review, its note is here too, because it was
// written for the rep to read.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

const CARD = "rounded-xl border border-border bg-card p-4";

const RUBRIC_KEY = {
  disclosure: "app.salesMyCallQa.rubric.disclosure",
  identity: "app.salesMyCallQa.rubric.identity",
  permissionAsked: "app.salesMyCallQa.rubric.permissionAsked",
  permissionForYes: "app.salesMyCallQa.rubric.permissionForYes",
  candour: "app.salesMyCallQa.rubric.candour",
  noBannedMove: "app.salesMyCallQa.rubric.noBannedMove",
  pivot: "app.salesMyCallQa.rubric.pivot",
  discoveryQuestions: "app.salesMyCallQa.rubric.discoveryQuestions",
  turnaround: "app.salesMyCallQa.rubric.turnaround",
  objections: "app.salesMyCallQa.rubric.objections",
  nextStepOffered: "app.salesMyCallQa.rubric.nextStepOffered",
  nextStepDated: "app.salesMyCallQa.rubric.nextStepDated",
  closeAsk: "app.salesMyCallQa.rubric.closeAsk",
  talkRatio: "app.salesMyCallQa.rubric.talkRatio",
};

function Score({ value, t }) {
  if (value === null || value === undefined) return <span className="text-sm text-muted-foreground">{t("app.salesMyCallQa.noScore")}</span>;
  const cls = value >= 75 ? "text-emerald-700 dark:text-emerald-300" : value >= 50 ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300";
  return <span className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</span>;
}

export default function MyCallQualityPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/sales/call-quality")
      .then((d) => {
        if (!cancelled) setRows(d.rows || []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4 max-w-3xl" data-my-call-quality>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <ClipboardCheck size={20} aria-hidden="true" /> {t("app.salesMyCallQa.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("app.salesMyCallQa.intro")}</p>
        <p className="text-sm">
          <Link href="/sales" className="underline text-foreground">
            {t("app.salesPortal.navToday")}
          </Link>
        </p>
      </header>

      {failed ? (
        <p className="text-sm text-amber-800 dark:text-amber-200" role="alert">
          {t("app.salesMyCallQa.loadFailed")}
        </p>
      ) : null}
      {rows === null && !failed ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> {t("app.salesMyCallQa.loading")}
        </p>
      ) : null}
      {rows && rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("app.salesMyCallQa.empty")}</p> : null}

      {rows && rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={`${CARD} space-y-2`} data-my-call={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground break-words">{r.business?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.dialledAt).toLocaleString()}
                    {r.talkSeconds !== null ? ` · ${Math.round(r.talkSeconds / 60)} min` : ""}
                    {r.reviewed ? ` · ${t("app.salesMyCallQa.reviewed")}` : ""}
                  </p>
                </div>
                <Score value={r.overall} t={t} />
              </div>
              {r.skippedReason && r.overall === null ? <p className="text-sm text-muted-foreground">{t("app.salesMyCallQa.unscorable")}</p> : null}
              {r.coaching.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.salesMyCallQa.coaching")}</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-foreground">
                    {r.coaching.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ol>
                </div>
              ) : null}
              {r.reviewerNote ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.salesMyCallQa.reviewerNote")}</p>
                  <p className="text-sm text-foreground">{r.reviewerNote}</p>
                </div>
              ) : null}
              {r.rubric.length ? (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">{t("app.salesMyCallQa.rubricHeading")}</summary>
                  <ul className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    {r.rubric.map((l) => (
                      <li key={l.key} className={l.met ? "" : "text-red-700 dark:text-red-300"}>
                        {RUBRIC_KEY[l.key] ? t(RUBRIC_KEY[l.key]) : l.key}: {l.points}/{l.weight}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
