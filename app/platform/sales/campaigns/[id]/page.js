// app/platform/sales/campaigns/[id]/page.js
//
// One campaign: the funnel, the controls, and the rows a human has to decide.
//
// ══ Why the funnel shows every stage and not just the total ═══════════════
//
// "Accepted: 412 of 1,000" answers nothing. The question a superadmin actually
// has is "where did the other 588 go" — a small snapshot, a tight territory, a
// classifier rejecting half a city, or a source that ran out. Each of those
// needs a different fix, and only a per-stage funnel tells them apart.
//
// The numbers are asserted to reconcile (funnelProblems), and when they do not
// the screen SAYS SO rather than rendering a funnel that quietly does not add
// up. A dashboard that looks authoritative and is wrong is worse than none.
//
// ══ Two lines that are careful about what they claim ══════════════════════
//
//   "No website listed by the source" — not "has no website". Overture's
//   website fill is 92.7%, so an empty column is a gap in the directory as
//   often as a gap in the market. Only a crawl can make the stronger claim.
//
//   "Last refreshed" — shows "the source did not say" as its own state, never
//   as a date. 11.6% of the measured sample is pre-2020 and a rep needs to see
//   which rows those are before dialling.
//
// ══ Mobile-first ══════════════════════════════════════════════════════════
//
// Single column, full-width controls, 44px targets, no table and no modal.
// This file is in scripts/check-mobile-surfaces.mjs's STRICT list.
"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Clock,
  Loader2,
  Pause,
  Play,
  RotateCw,
  Save,
  X,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import StageBoard from "@/app/components/sales/StageBoard";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";

export default function PlatformSalesCampaignPage({ params }) {
  // Next 16: params is a Promise. `use()` is how a client component reads one;
  // touching params.id directly yields undefined and the page renders empty.
  const { id } = use(params);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);
  // What the last action said it did NOT do — "that discovery task was
  // already queued", "a task is live". Not an error: the request succeeded.
  // Shown because a button that reports success and changes nothing is the
  // dead control AGENTS.md forbids, and the route says why in a sentence.
  const [note, setNote] = useState("");

  /**
   * @param quiet  a background refresh, not the first paint. It must NOT set
   *               `loading`, or the whole screen would flash a spinner every
   *               few seconds, and it must not clear a real error into
   *               nothing on a transient failure.
   */
  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setLoading(true);
        setError("");
      }
      try {
        setData(await fetchJson(`/api/platform/sales/campaigns/${id}`));
        // Only a SUCCESSFUL quiet poll clears the error, so a run that
        // recovers stops complaining without a poll that failed erasing the
        // reason the previous one gave.
        if (quiet) setError("");
      } catch (err) {
        // A background poll that fails says nothing. The numbers on screen are
        // a few seconds old rather than wrong, and a banner that appeared
        // because one fetch lost a race would be a screen crying wolf at a
        // superadmin watching a six-hour job.
        if (!quiet) setError(err?.message || "Could not load this campaign.");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  // ── A progress screen that does not progress ─────────────────────────────
  //
  // This screen's entire subject is a job that takes hours: the pipeline drains
  // twenty-five tasks a minute, so a campaign's counters move roughly every
  // sixty seconds, for days. It never re-fetched. The owner watched "0 of
  // 37,638" sit still while the database went 83, then 166, and reasonably
  // concluded nothing was running — the only way to see a new number was to
  // pause the campaign and resume it, which is a destructive way to press
  // refresh.
  //
  // Ten seconds while it is RUNNING, and nothing at all when it is not: a
  // paused or finished campaign has no next number, and polling one forever
  // from an open tab is a request every ten seconds for as long as somebody
  // leaves the window open. The interval is torn down on the status change as
  // well as on unmount, so resuming restarts it and pausing stops it.
  const isRunning = data?.campaign?.status === "running";
  // ── The campaign finishing is not the pipeline finishing ────────────────
  //
  // `status === "running"` means DISCOVERY is still paging the file. Crawling,
  // technology detection and the brief all continue for hours after that stops
  // — 103 crawls were queued on a campaign whose discovery had long finished.
  // Polling only on the campaign's own status froze the stage board at exactly
  // the point it becomes the most interesting thing on the screen, which is
  // the same "progress screen that does not progress" fixed above, one layer
  // down. So: poll while discovery runs, and keep polling while any stage
  // still has work queued or in flight.
  const outstanding = data?.pipeline?.outstanding || 0;
  const shouldPoll = isRunning || outstanding > 0;
  useEffect(() => {
    if (!shouldPoll) return undefined;
    const timer = setInterval(() => load(true), 10_000);
    return () => clearInterval(timer);
  }, [shouldPoll, load]);

  async function act(action, extra = {}) {
    setBusy(action);
    setError("");
    setProblems([]);
    setNote("");
    try {
      const res = await fetchJson(`/api/platform/sales/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (res?.note) setNote(String(res.note));
      else if (res?.discoveryQueued) setNote(`Discovery queued again (${res.discoveryQueued}). The next cron tick picks it up.`);
      await load();
    } catch (err) {
      setError(err?.message || `Could not ${action} this campaign.`);
      setProblems(Array.isArray(err?.body?.problems) ? err.body.problems : []);
    } finally {
      setBusy("");
    }
  }

  async function review(prospectId, decision) {
    setBusy(prospectId);
    setError("");
    try {
      await fetchJson(`/api/platform/sales/campaigns/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId, decision }),
      });
      await load();
    } catch (err) {
      setError(err?.message || "Could not record that decision.");
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading…
      </div>
    );
  }

  const campaign = data?.campaign;
  if (!campaign) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-sm text-red-700 dark:text-red-300">{error || "No such campaign."}</p>
        <Link href="/platform/sales/campaigns" className={`${BTN} border border-border text-foreground`}>
          <ArrowLeft size={16} /> Back
        </Link>
      </div>
    );
  }

  const runnable = campaign.status === "draft" || campaign.status === "paused";
  const sources = data.sources || [];
  // ── A running campaign with nothing behind it ─────────────────────────
  //
  // `data.tasks` is the DISCOVER_BUSINESSES count by status. A running
  // campaign with no task queued or claimed is the state two California
  // campaigns sat in all night: the thread died — abandoned, failed, or the
  // source was blocked and unblocked before this existed — and nothing
  // queues another. The route refuses the retry on the same terms (a live
  // task, a campaign not running), so this is the same decision made once.
  const discoveryLive = (data.tasks?.queued || 0) + (data.tasks?.claimed || 0) > 0;
  const discoveryDead = campaign.status === "running" && !discoveryLive;
  // Every source blocked and none ended: the handler records `paused` for
  // that rather than `completed` (discoverBusinesses.js stoppedShort), and
  // this is where the screen says so — "paused" alone reads as a person's
  // choice.
  const everySourceBlocked = sources.length > 0 && sources.every((s) => s.state?.blocked) && !sources.some((s) => s.state?.ended);
  // Every reason Start is not offered, in sentences the server produced — so
  // the screen and the route cannot disagree about whether this campaign can
  // run. A hidden button and a 400 that says why are the same decision made
  // twice; this makes it once.
  const startProblems = data.startProblems || [];

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/platform/sales/campaigns"
          className="inline-flex items-center gap-2 min-h-[44px] text-sm text-muted-foreground"
        >
          <ArrowLeft size={16} /> All campaigns
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground break-words">{campaign.name}</h1>
        <p className="text-sm text-muted-foreground">
          {campaign.tradeLabel} · {campaign.territory?.name || "no territory"} ·{" "}
          {(campaign.sourceKeys || []).join(" + ") || "no source"}
        </p>
        <p className="text-sm text-foreground">
          {campaign.progress.accepted} of {campaign.progress.target} accepted
          {campaign.progress.percent === null ? "" : ` (${campaign.progress.percent}%)`} · {campaign.status}
        </p>
        {/* ── Said because 0% on a job measured in DAYS reads as broken ────
            The pipeline drains twenty-five tasks a minute, so a big campaign
            moves about a hundred rows a minute and takes hours to page and
            days to research. Without that sentence the honest state of a
            healthy run — a number that has barely moved and a percentage
            rounded to zero — is indistinguishable from a stall, and the owner
            read it exactly that way. No estimate of a finish time is offered:
            the rate depends on how many rows survive classification and on
            the per-provider budgets, and a wrong ETA is worse than none. */}
        {campaign.status === "paused" && everySourceBlocked ? (
          <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
            Paused by the pipeline, not by a person: every source on this campaign stopped for a reason
            (see each source below) and none ran out of rows, so nothing was found that was going to be
            found. Fix the source, then press Resume — a fixed source is read from where it stopped.
          </p>
        ) : null}
        {discoveryDead ? (
          <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
            Running, but no discovery task is queued or in flight. The chain of pages ended — a page was
            abandoned after five failures, or a source was blocked — and nothing queues the next one by
            itself. Fixing a blocked source below queues it; for anything else, press Retry discovery.
          </p>
        ) : null}
        {isRunning && !discoveryDead ? (
          <p className="text-xs text-muted-foreground break-words">
            Working. The pipeline takes twenty-five tasks a minute, so this counts up by roughly a
            hundred rows a minute while it pages the file, then slows as each accepted business is
            crawled and researched. Hours to bank, days to finish researching. This screen refreshes
            itself every ten seconds — leave it open.
          </p>
        ) : null}
        {/* Banking and researching are different budgets and only one of them
            costs the platform anything. Shown because a campaign that has
            banked its way past its target goes on banking and stops promoting,
            and that has to read as a bound rather than as a stall. */}
        {campaign.research ? (
          <p className="text-xs text-muted-foreground">
            {campaign.research.queued} of {campaign.research.target} queued for research
            {campaign.research.remaining
              ? ""
              : " — the research budget is spent. Rows are still banked; nothing more is promoted into crawling."}
          </p>
        ) : null}
      </header>

      {note ? (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground break-words">{note}</p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p>{error}</p>
              {problems.length ? (
                <ul className="mt-2 list-disc pl-4 space-y-1">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Where this campaign would be calling, stated whether or not it blocks.
          "Registered" is worth seeing too: it is the difference between a draft
          somebody has not started and a draft that cannot be. An unread
          jurisdiction is its own third state — rows can be banked there, but
          the queue will refuse to hand a rep a dial link. */}
      {data.registration ? (
        <p className="text-xs text-muted-foreground break-words">
          Calling into {data.registration.name}:{" "}
          {!data.registration.required
            ? "no telemarketer registration is required."
            : data.registration.done
              ? "FieldQuo's telemarketer registration is filed."
              : "FieldQuo's telemarketer registration is outstanding, so this campaign cannot be started."}
        </p>
      ) : campaign.territory ? (
        <p className="text-xs text-muted-foreground break-words">
          Nobody has read {[campaign.territory.country, campaign.territory.province].filter(Boolean).join("-")}’s
          telephone solicitation law, so no rep will be given a dial link for these rows. Banking and research
          still work.
        </p>
      ) : null}

      {startProblems.length ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-medium">This campaign cannot start:</p>
          {startProblems.map((p) => (
            <p key={p} className="break-words">
              {p}
            </p>
          ))}
        </div>
      ) : null}

      {campaign.funnelProblems?.length ? (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200 space-y-1">
          <p className="font-medium">These numbers do not reconcile:</p>
          {campaign.funnelProblems.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      ) : null}

      {/* ── Controls ───────────────────────────────────────────────────── */}
      {startProblems.length ? null : (
        <div className="flex flex-col sm:flex-row gap-2">
          {runnable ? (
            <button
              type="button"
              className={`${BTN} bg-primary text-primary-foreground`}
              onClick={() => act(campaign.status === "paused" ? "resume" : "start")}
              disabled={Boolean(busy)}
            >
              {busy === "start" || busy === "resume" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Play size={16} />
              )}
              {campaign.status === "paused" ? "Resume" : "Start discovery"}
            </button>
          ) : null}
          {campaign.status === "running" ? (
            <button
              type="button"
              className={`${BTN} border border-border text-foreground`}
              onClick={() => act("pause")}
              disabled={Boolean(busy)}
            >
              <Pause size={16} /> Pause
            </button>
          ) : null}
          {/* Only when the thread is dead. A retry beside a live task would
              be refused by the route, and a button that is always there and
              usually refused teaches people to ignore it. */}
          {discoveryDead ? (
            <button
              type="button"
              className={`${BTN} border border-border text-foreground`}
              onClick={() => act("retry_discovery")}
              disabled={Boolean(busy)}
            >
              {busy === "retry_discovery" ? <Loader2 className="animate-spin" size={16} /> : <RotateCw size={16} />}
              Retry discovery
            </button>
          ) : null}
        </div>
      )}

      {/* ── The sources, one card each ─────────────────────────────────── */}
      {/*
          One card per source rather than one "Source settings" panel. Three
          things have to be per-source or they are wrong: the LICENCE (ticking
          two sources takes on two sets of terms), the SETTINGS (both shipped
          sources have a field called `snapshotUrl`, so one shared panel writes
          one source's file behind the other's name), and the POSITION — a
          source that ran out and a source that died are different outcomes,
          and a campaign that showed only "completed" would hide the second.
      */}
      {sources.map((source) => (
        <section key={source.key} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-base font-semibold text-foreground break-words">{source.label}</h2>

          {source.licence ? (
            <p className="text-xs text-muted-foreground break-words">
              <span className="font-medium text-foreground">Licence: {source.licence.name}</span>
              {source.licence.url ? ` (${source.licence.url})` : ""} — {source.licence.obligation}
              {source.licence.attribution ? ` The notice: “${source.licence.attribution}”` : ""}
            </p>
          ) : null}

          {source.registered ? null : (
            <p className="text-sm text-amber-900 dark:text-amber-200 break-words">
              This build does not ship a source called “{source.key}”. Nothing can run for it, and it is
              listed here rather than dropped because the campaign did name it.
            </p>
          )}

          {source.unavailable ? (
            <p className="text-sm text-amber-900 dark:text-amber-200 break-words">{source.unavailable}</p>
          ) : null}

          <p className="text-xs text-muted-foreground break-words">
            {source.state.blocked
              ? `Stopped: ${source.state.blocked}`
              : source.state.ended
                ? "Finished — the source had no more rows."
                : source.state.lastError
                  ? `Still going. Last attempt failed (${source.state.failures} in a row): ${source.state.lastError}`
                  : source.state.cursor
                    ? `Reading, at ${source.state.cursor}.`
                    : "Not started."}
          </p>

          {/* ── The file, and a rebuild — no text box ────────────────────
              There is nothing to type here any more. The snapshot URL is the
              base URL configured once at /platform/sales/snapshots plus this
              file's own object key, and the button rebuilds it and FETCHES it
              before saving. The box that used to be here was the last place in
              the product a snapshot URL could be typed, which made it the last
              place one could be typed wrong — and a wrong one does not fail,
              it discovers nobody. */}
          {source.registered && !source.unavailable ? (
            <>
              <p className="text-xs text-muted-foreground break-words">
                Reading: {source.config?.summary || "not set"}
              </p>
              {(source.config?.problems || []).map((p) => (
                <p key={p} className="text-xs text-amber-900 dark:text-amber-200 break-words">
                  {p}
                </p>
              ))}
              <button
                type="button"
                className={`${BTN} border border-border text-foreground`}
                onClick={() => act("configure", { sourceKey: source.key })}
                disabled={Boolean(busy)}
              >
                {busy === "configure" ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Rebuild this URL from the snapshot library
              </button>
              <p className="text-xs text-muted-foreground break-words">
                Use this after the base URL changes at{" "}
                <Link href="/platform/sales/snapshots" className="underline">
                  the snapshot library
                </Link>
                . It re-derives the URL, downloads the file’s first line to prove it is there, and clears a
                source the pipeline had stopped for a settings problem.
              </p>
            </>
          ) : null}
        </section>
      ))}

      {/* ── The funnel ─────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-base font-semibold text-foreground">What this run did</h2>
        <ul className="space-y-3">
          {campaign.funnel.map((row) => (
            <li key={row.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={`text-sm ${row.kind === "total" ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  {row.kind === "subset" ? "↳ " : ""}
                  {row.label}
                </span>
                <span className="text-sm font-mono text-foreground">{row.value}</span>
              </div>
              <p className="text-xs text-muted-foreground">{row.note}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── What the pipeline is doing ─────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h2 className="text-base font-semibold text-foreground">Pipeline tasks</h2>
        {Object.keys(data.tasks || {}).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No discovery tasks have been queued for this campaign yet.
          </p>
        ) : (
          <ul className="text-sm text-muted-foreground space-y-1">
            {Object.entries(data.tasks).map(([status, count]) => (
              <li key={status} className="flex items-baseline justify-between gap-3">
                <span>{status}</span>
                <span className="font-mono text-foreground">{count}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Discovery only — the paging of the snapshot file. Everything after it is below.
        </p>

        {/* The whole pipeline, always. The panel below is absent when nothing
            is wrong; this one is present whatever the state, because "what is
            happening" has an answer even when the answer is "nothing yet". */}
        <StageBoard stages={data.stages || []} pipeline={data.pipeline || null} />

        {/* ── Work that has stopped, and why ─────────────────────────────
            The counts above are DISCOVERY tasks. That was the whole picture
            this screen gave, and it was healthy-looking while 168 crawls had
            failed on a database defect and 291 technology detections had been
            abandoned for want of a seeded table. Nothing said so, and the
            consequence was three screens away: a prospect whose crawl failed
            gets no capabilities, so no trade, so no rep can claim it.

            Absent when nothing is wrong. This is not a status table to scan —
            it is the answer to "why has nothing happened for an hour". */}
        {(data.stalled || []).length > 0 ? (
          <div className="space-y-2 pt-1">
            <h3 className="text-sm font-semibold text-foreground">Stages that have stopped</h3>
            {data.stalled.map((s) => (
              <div
                key={`${s.kind}-${s.status}`}
                className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-3 text-sm text-amber-900 dark:text-amber-200"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold break-words">
                    {s.kind} — {s.status}
                  </span>
                  <span className="font-mono">{s.count}</span>
                </div>
                {/* The handler's own sentence, verbatim. It names the screen
                    that fixes a configuration problem, and the person reading
                    a stopped stage is the person who can fix it. */}
                {s.reason ? <p className="mt-1 break-words">{s.reason}</p> : null}
              </div>
            ))}
            <p className="text-xs text-muted-foreground break-words">
              <span className="font-semibold">Failed</span> means it was tried and the attempts ran
              out — usually that website, sometimes a defect worth reporting.{" "}
              <span className="font-semibold">Abandoned</span> means the stage refused to start. Read
              the reason before treating it as a fault: the largest group is a stage declining
              because the one before it had nothing to hand over — a site that could not be read
              leaves nothing to fingerprint — and that is the pipeline behaving correctly. The
              business is NOT stranded by it; it carries on down the remaining stages and a rep can
              still call it, just without the website intelligence. The reasons that ARE worth
              acting on name a screen that fixes them.
            </p>
          </div>
        ) : null}
        {data.lastError ? (
          <p className="text-xs text-amber-800 dark:text-amber-200 break-words">
            Last reported problem ({data.lastError.status}, attempt {data.lastError.attempts}):{" "}
            {data.lastError.lastError}
          </p>
        ) : null}
        {data.flaggedDuplicates ? (
          <p className="text-xs text-muted-foreground">
            {data.flaggedDuplicates} prospect{data.flaggedDuplicates === 1 ? " is" : "s are"} flagged as
            possibly the same business as another row — which is the common case when a campaign draws from
            more than one source, because a source record id cannot match across two sources and the match
            falls to phone, domain or name-and-town. They are kept and workable: merging destroys provenance,
            a wrong merge cannot be undone, and that fuzzy match is wrong about half the time it fires.
          </p>
        ) : null}
      </section>

      {/* ── The review queue ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Needs review ({data.reviewTotal})
        </h2>
        {data.review.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting on a decision.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            The classifier could not tell whether these are contractors or shops. No rep sees them until you
            decide.
          </p>
        )}

        {data.review.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div>
              <p className="font-medium text-foreground break-words">{p.businessName}</p>
              <p className="text-xs text-muted-foreground break-words">
                {[p.addressLine, p.city, p.province].filter(Boolean).join(", ") || "no address"}
              </p>
              <p className="text-xs text-muted-foreground break-words">
                {p.phoneE164 || "no phone"}
                {p.websiteUrl ? ` · ${p.websiteUrl}` : " · no website listed"}
              </p>
            </div>

            <p className="text-sm text-foreground">{p.classificationReason}</p>

            <p className="text-xs text-muted-foreground break-words">
              Categories: {(p.sourceCategories || []).join(", ") || "none"}
            </p>

            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Clock size={12} />
              {p.staleness.level === "unknown"
                ? "The source did not say when it last checked this."
                : `Source last refreshed ${p.staleness.days} days ago${p.staleness.level === "stale" ? " — treat as unverified" : ""}.`}
              {p.sourceDataset ? ` (${p.sourceDataset}, release ${p.sourceRelease})` : ""}
            </p>

            {/* ── WHICH business, not just "a duplicate" ────────────────────
                "Flagged as a possible duplicate" is not something anybody can
                act on: it does not say which row, so the reviewer remembers or
                guesses. Naming the other row — and what has already happened to
                it — is the whole difference between a label and a decision. */}
            {p.possibleDuplicateOfId ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-semibold">{p.duplicateNote}</p>
                {p.duplicateOf ? (
                  <p className="break-words">
                    Same as <span className="font-semibold">{p.duplicateOf.businessName}</span>
                    {p.duplicateOf.addressLine ? `, ${p.duplicateOf.addressLine}` : ""}
                    {p.duplicateOf.city ? `, ${p.duplicateOf.city}` : ""} — which is already{" "}
                    {p.duplicateOf.status === "needs_review"
                      ? "waiting in this same review list"
                      : p.duplicateOf.status === "rejected"
                        ? "rejected"
                        : "accepted and being researched"}
                    .
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* The reason these duplicate at all, where the number says so. A
                signal and never a verdict: a multi-branch contractor with a
                switchboard is a real business, and auto-rejecting on a service
                access code would drop legitimate ones. */}
            {p.tollFreeNote ? (
              <p className="text-xs text-muted-foreground break-words">{p.tollFreeNote}</p>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                className={`${BTN} bg-primary text-primary-foreground`}
                onClick={() => review(p.id, "accept")}
                disabled={Boolean(busy)}
              >
                {busy === p.id ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                It is a contractor
              </button>
              {/* Offered only where it is TRUE. A third button on every card
                  would be a third thing to read four hundred times; this one
                  appears when the row was flagged, or when the number is shared
                  with rows already in the bank, which are the two ways "I
                  already have this" becomes the honest answer. */}
              {p.possibleDuplicateOfId || p.sharedPhoneCount > 0 ? (
                <button
                  type="button"
                  className={`${BTN} border border-amber-400 text-amber-900 dark:text-amber-100`}
                  onClick={() => review(p.id, "duplicate")}
                  disabled={Boolean(busy)}
                >
                  <Copy size={16} /> Contractor, already have it
                </button>
              ) : null}
              <button
                type="button"
                className={`${BTN} border border-border text-foreground`}
                onClick={() => review(p.id, "reject")}
                disabled={Boolean(busy)}
              >
                <X size={16} /> It is not
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
