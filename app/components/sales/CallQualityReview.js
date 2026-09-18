"use client";

// app/components/sales/CallQualityReview.js
//
// The call-quality review screen: the queue (lowest-scored and unreviewed
// first), one call opened beside it — the recording, the transcript with
// the flagged lines marked, the scorecard — and the human pass.
//
// Drawn twice: /platform/sales/call-quality (superadmin, every rep) and
// /sales/agency/call-quality (an agency, its own team). One component, two
// sets of URLs and two sets of words — `labels` comes from t() on the
// portal and from literals on the console, for the reason
// CallPerformanceSections.js gives. Nothing here decides who may see what:
// the routes behind `listUrl` / `detailUrl` scope every read fresh, and
// this screen draws what they answer.
//
// The audio element's src is the proxy the route named (`audioHref`), never
// a provider URL — lib/sales/calls/recording.js says why.
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const CARD = "rounded-xl border border-border bg-card p-4";
const BTN = "inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_PRIMARY = `${BTN} bg-primary text-primary-foreground`;
const BTN_QUIET = `${BTN} border border-border text-foreground`;
const FIELD = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

function stamp(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function ScoreBadge({ value, labels }) {
  if (value === null || value === undefined) return <span className="text-xs text-muted-foreground">{labels.noScore}</span>;
  const cls = value >= 75 ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : value >= 50 ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums ${cls}`}>{value}</span>;
}

function Yes({ value, labels }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  return value ? <span className="text-emerald-700 dark:text-emerald-300">{labels.yes}</span> : <span className="text-red-700 dark:text-red-300">{labels.no}</span>;
}

function Scorecard({ call, labels }) {
  const qa = call.qa;
  if (!qa) return <p className="text-sm text-muted-foreground">{labels.notScoredYet}</p>;
  const d = qa.deterministic || {};
  const s = qa.scores || null;
  return (
    <div className="space-y-3">
      {qa.skippedReasonText ? <p className="text-sm text-amber-800 dark:text-amber-200">{qa.skippedReasonText}</p> : null}
      {qa.playbookKey && !qa.playbookMatched ? <p className="text-xs text-muted-foreground">{labels.playbookMoved}</p> : null}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{labels.disclosure}</dt>
        <dd>
          <Yes value={d.disclosure?.said} labels={labels} />
          {d.disclosure?.said ? <span className="text-xs text-muted-foreground"> {stamp(d.disclosure.at)}</span> : null}
        </dd>
        <dt className="text-muted-foreground">{labels.identity}</dt>
        <dd>
          <Yes value={Boolean(d.first20?.companyNamed && d.first20?.repNamed)} labels={labels} />
          <span className="text-xs text-muted-foreground">
            {" "}
            {labels.identityParts(d.first20 || {})}
          </span>
        </dd>
        <dt className="text-muted-foreground">{labels.permission}</dt>
        <dd>
          <Yes value={s ? s.permissionAsk?.asked : null} labels={labels} />
          {s?.permissionAsk?.asked ? <span className="text-xs text-muted-foreground"> {s.permissionAsk.phrasedForYes ? labels.forYes : labels.notForYes}</span> : null}
        </dd>
        <dt className="text-muted-foreground">{labels.candour}</dt>
        <dd>
          <Yes value={s ? s.candour?.met : null} labels={labels} />
        </dd>
        <dt className="text-muted-foreground">{labels.bannedMoves}</dt>
        <dd>
          {(d.bannedMoves?.length || 0) + (s?.bannedMoves?.length || 0) === 0 ? (
            <span className="text-emerald-700 dark:text-emerald-300">{labels.none}</span>
          ) : (
            <ul className="text-xs text-red-700 dark:text-red-300">
              {(d.bannedMoves || []).map((b, i) => (
                <li key={`d${i}`}>
                  {b.move} — “{b.text}”
                  {b.source ? <span className="text-muted-foreground"> ({b.source === "script" ? labels.inScript : labels.repsOwnWords})</span> : null}
                </li>
              ))}
              {(s?.bannedMoves || []).map((b, i) => (
                <li key={`s${i}`}>
                  {b.move} — “{b.line}”
                </li>
              ))}
            </ul>
          )}
        </dd>
        <dt className="text-muted-foreground">{labels.pivot}</dt>
        <dd>
          <Yes value={s ? s.pivot?.delivered : null} labels={labels} />
          {s?.pivot?.delivered ? <span className="text-xs text-muted-foreground"> {s.pivot.afterContractorAnswer ? labels.afterAnswer : labels.beforeAnswer}</span> : null}
          {d.reason?.said ? (
            <span className="text-xs text-muted-foreground">
              {" "}
              · {labels.reasonAt} {stamp(d.reason.at)}
              {d.reason.withinDue ? "" : ` (${labels.reasonLate})`}
            </span>
          ) : null}
        </dd>
        <dt className="text-muted-foreground">{labels.gatekeeper}</dt>
        <dd>
          {!s?.gatekeeper ? (
            "—"
          ) : s.gatekeeper.firstSpeakerDecisionMaker ? (
            <span>{labels.decisionMaker}</span>
          ) : (
            <span>
              {labels.notDecisionMaker}
              <span className="text-xs text-muted-foreground">
                {" "}
                · {labels.nameObtained}: <Yes value={s.gatekeeper.nameObtained} labels={labels} /> · {labels.timeObtained}: <Yes value={s.gatekeeper.timeObtained} labels={labels} />
              </span>
            </span>
          )}
        </dd>
        <dt className="text-muted-foreground">{labels.discovery}</dt>
        <dd>
          {s ? labels.questions(s.discovery?.questionCount ?? 0) : "—"}
          {s ? <span className="text-xs text-muted-foreground"> · {labels.turnaround}: <Yes value={Boolean(s.discovery?.turnaroundAsked || d.turnaroundKeyword)} labels={labels} /></span> : null}
        </dd>
        <dt className="text-muted-foreground">{labels.objections}</dt>
        <dd>
          {!s ? (
            "—"
          ) : (s.objections || []).length === 0 ? (
            <span className="text-muted-foreground">{labels.noObjection}</span>
          ) : (
            <ul className="space-y-1 text-xs">
              {s.objections.map((o, i) => (
                <li key={i}>
                  <span className="font-medium">“{o.objection}”</span> → “{o.repSaid}”{" "}
                  <span className="text-muted-foreground">
                    ({o.libraryAnswer ? labels.libraryAnswer : o.handled ? labels.ownAnswer : labels.notHandled})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </dd>
        <dt className="text-muted-foreground">{labels.nextStep}</dt>
        <dd>
          <Yes value={s ? s.nextStep?.offered : null} labels={labels} />
          {s?.nextStep?.offered ? <span className="text-xs text-muted-foreground"> {s.nextStep.dated ? labels.dated : labels.notDated}</span> : null}
        </dd>
        <dt className="text-muted-foreground">{labels.closeAsk}</dt>
        <dd>
          <Yes value={s ? s.closeAsk?.met : null} labels={labels} />
          <span className="text-xs text-muted-foreground">
            {" "}
            · {labels.calendarAsked}: <Yes value={d.calendarAsked ?? null} labels={labels} />
            {d.inviteCreated === null || d.inviteCreated === undefined ? "" : ` · ${d.inviteCreated ? labels.inviteMade : labels.inviteNotMade}`}
          </span>
        </dd>
        <dt className="text-muted-foreground">{labels.talkRatio}</dt>
        <dd className="tabular-nums">
          {typeof d.talk?.ratio === "number" ? `${Math.round(d.talk.ratio * 100)}%` : "—"}
          {d.talk ? <span className="text-xs text-muted-foreground"> {labels.talkSplit(Math.round(d.talk.repSeconds), Math.round(d.talk.contractorSeconds))}</span> : null}
        </dd>
        <dt className="text-muted-foreground">{labels.pitchBurst}</dt>
        <dd className="tabular-nums">
          {typeof d.talk?.longestRepBurstSeconds === "number" ? `${Math.round(d.talk.longestRepBurstSeconds)} s` : "—"}
          {d.talk?.burstTooShort ? <span className="text-xs text-red-700 dark:text-red-300"> {labels.burstShort}</span> : null}
        </dd>
      </dl>
      {Array.isArray(qa.coaching) && qa.coaching.length ? (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.coaching}</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-foreground">
            {qa.coaching.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        </div>
      ) : null}
      {Array.isArray(qa.scores?.rubric) && qa.scores.rubric.length ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">{labels.rubric}</summary>
          <ul className="mt-1 grid grid-cols-2 gap-x-4">
            {qa.scores.rubric.map((l) => (
              <li key={l.key} className={l.met ? "" : "text-red-700 dark:text-red-300"}>
                {l.key}: {l.points}/{l.weight}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ReviewForm({ call, labels, onSubmit, busy }) {
  const [overall, setOverall] = useState(call.qa?.reviewerOverall ?? call.qa?.overall ?? "");
  const [note, setNote] = useState(call.qa?.reviewerNote || "");
  useEffect(() => {
    setOverall(call.qa?.reviewerOverall ?? call.qa?.overall ?? "");
    setNote(call.qa?.reviewerNote || "");
  }, [call.id, call.qa?.reviewerOverall, call.qa?.overall, call.qa?.reviewerNote]);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ overall: Number(overall), note });
      }}
    >
      <p className="text-sm font-semibold text-foreground">{labels.humanPass}</p>
      <p className="text-xs text-muted-foreground">{labels.humanPassIntro}</p>
      {call.qa?.reviewedAt ? (
        <p className="text-xs text-muted-foreground">{labels.reviewedBy(call.qa.reviewerName || "—", new Date(call.qa.reviewedAt).toLocaleString())}</p>
      ) : null}
      <label className="block text-sm">
        <span className="block font-medium text-foreground mb-1">{labels.yourScore}</span>
        <input type="number" min={0} max={100} step={1} value={overall} onChange={(e) => setOverall(e.target.value)} className={FIELD} required />
      </label>
      <label className="block text-sm">
        <span className="block font-medium text-foreground mb-1">{labels.yourNote}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} className={FIELD} />
      </label>
      <button type="submit" className={BTN_PRIMARY} disabled={busy}>
        {busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> : null} {labels.saveReview}
      </button>
    </form>
  );
}

/**
 * @param {{ listUrl: string, detailUrl: (id) => string, labels: object,
 *           initialId?: string|null, repFilter?: string|null }} props
 */
export default function CallQualityReview({ listUrl, detailUrl, labels, initialId = null, repFilter = null }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(initialId);
  const [call, setCall] = useState(null);
  const [audioHref, setAudioHref] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const url = new URL(listUrl, window.location.origin);
      if (repFilter) url.searchParams.set("repId", repFilter);
      const data = await fetchJson(url.pathname + url.search);
      setRows(data.rows || []);
    } catch (err) {
      setError(err?.message || labels.loadFailed);
      setRows([]);
    }
  }, [listUrl, repFilter, labels.loadFailed]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!openId) {
      setCall(null);
      return;
    }
    let cancelled = false;
    setDetailError("");
    setCall(null);
    fetchJson(detailUrl(openId))
      .then((data) => {
        if (cancelled) return;
        setCall(data.call);
        setAudioHref(data.audioHref || null);
      })
      .catch((err) => {
        if (!cancelled) setDetailError(err?.message || labels.loadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [openId, detailUrl, labels.loadFailed]);

  async function submitReview(body) {
    setBusy(true);
    setNotice("");
    try {
      const r = await fetchJson(detailUrl(openId), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setCall((c) => (c ? { ...c, qa: { ...(c.qa || {}), ...r.qa }, effectiveOverall: r.qa.reviewerOverall, reviewedAt: r.qa.reviewedAt } : c));
      setNotice(labels.reviewSaved);
      load();
    } catch (err) {
      setNotice(err?.message || labels.reviewFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    // grid-cols-1 is not decoration: an implicit grid track is auto-sized and
    // lets a long transcript line set the column's width, which is a page
    // that scrolls sideways on a phone. scripts/check-platform-mobile.mjs
    // measured 479 px at a 375 px viewport before it was here.
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" data-call-quality-review>
      <section className="space-y-2 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{labels.queueHeading}</h2>
          <button type="button" onClick={load} className={BTN_QUIET}>
            <RefreshCw size={14} aria-hidden="true" /> {labels.refresh}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{labels.queueIntro}</p>
        {error ? (
          <p className="text-sm text-red-800 dark:text-red-200 flex items-start gap-2" role="alert">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </p>
        ) : null}
        {rows === null ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> {labels.loading}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 ${openId === r.id ? "border-primary bg-muted/60" : "border-border bg-card"}`}
                  data-qa-row={r.id}
                  data-qa-state={r.state}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate min-w-0">
                      {r.business?.name || r.id}
                      <span className="text-xs font-normal text-muted-foreground"> · {r.rep?.name || "—"}</span>
                    </span>
                    <ScoreBadge value={r.effectiveOverall} labels={labels} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.dialledAt).toLocaleString()} · {r.talkSeconds !== null ? stamp(r.talkSeconds) : "—"} · {labels.state(r.state)}
                    {r.reviewedAt ? ` · ${labels.reviewedShort(r.reviewerName || "—")}` : ""}
                    {r.bannedMoves > 0 ? ` · ${labels.bannedCount(r.bannedMoves)}` : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 min-w-0">
        {!openId ? (
          <p className="text-sm text-muted-foreground">{labels.pickOne}</p>
        ) : detailError ? (
          <p className="text-sm text-red-800 dark:text-red-200" role="alert">
            {detailError}
          </p>
        ) : !call ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> {labels.loading}
          </p>
        ) : (
          <>
            <div className={`${CARD} space-y-2`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{call.business?.name || call.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {call.rep?.name || "—"} · {new Date(call.dialledAt).toLocaleString()} · {call.playbookKey || labels.noPlaybook}
                  </p>
                </div>
                <div className="text-right">
                  <ScoreBadge value={call.effectiveOverall} labels={labels} />
                  {call.reviewerOverall !== null && call.overall !== null && call.reviewerOverall !== call.overall ? (
                    <p className="text-xs text-muted-foreground">{labels.modelSaid(call.overall)}</p>
                  ) : null}
                </div>
              </div>
              {audioHref ? (
                // The transcript under the player is the caption.
                <audio controls preload="none" src={audioHref} className="w-full" data-qa-audio />
              ) : null}
            </div>

            <div className={CARD}>
              <p className="text-sm font-semibold text-foreground mb-2">{labels.scorecard}</p>
              <Scorecard call={call} labels={labels} />
            </div>

            <div className={CARD}>
              <ReviewForm call={call} labels={labels} onSubmit={submitReview} busy={busy} />
              {notice ? (
                <p className="mt-2 text-sm text-foreground" role="status">
                  {notice}
                </p>
              ) : null}
            </div>

            <div className={CARD}>
              <p className="text-sm font-semibold text-foreground mb-2">{labels.transcript}</p>
              {call.transcript.length === 0 ? (
                <p className="text-sm text-muted-foreground">{call.transcriptError ? `${labels.transcriptFailed} ${call.transcriptError}` : labels.transcriptPending}</p>
              ) : (
                <ol className="space-y-1 text-sm">
                  {call.transcript.map((seg) => {
                    const flagged = seg.bannedMoves.length > 0;
                    const cls = flagged
                      ? "bg-red-50 dark:bg-red-950/40 border-l-2 border-red-500"
                      : seg.disclosure
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-l-2 border-emerald-500"
                        : seg.cited.length
                          ? "bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-400"
                          : "border-l-2 border-transparent";
                    return (
                      <li key={seg.index} className={`pl-2 py-0.5 ${cls}`} data-qa-line={seg.index} data-qa-flagged={flagged ? "true" : "false"}>
                        <span className="text-xs text-muted-foreground tabular-nums">{stamp(seg.start)}</span>{" "}
                        <span className={`text-xs font-semibold ${seg.speaker === "rep" ? "text-primary" : "text-muted-foreground"}`}>{labels.speaker(seg.speaker)}</span>{" "}
                        <span className="text-foreground">{seg.text}</span>
                        {flagged ? <span className="ml-1 text-xs text-red-700 dark:text-red-300">({seg.bannedMoves.join(", ")})</span> : null}
                        {seg.disclosure ? <span className="ml-1 text-xs text-emerald-700 dark:text-emerald-300">({labels.disclosure})</span> : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
