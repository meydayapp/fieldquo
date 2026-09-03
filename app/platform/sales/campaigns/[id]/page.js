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
  Clock,
  Loader2,
  Pause,
  Play,
  Save,
  X,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";

export default function PlatformSalesCampaignPage({ params }) {
  // Next 16: params is a Promise. `use()` is how a client component reads one;
  // touching params.id directly yields undefined and the page renders empty.
  const { id } = use(params);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);
  // Keyed by source. A campaign can draw from several, and one `config` object
  // shared between them would put the source you edited second on top of the
  // one you edited first — both shipped sources have a field called
  // `snapshotUrl`.
  const [configs, setConfigs] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson(`/api/platform/sales/campaigns/${id}`));
    } catch (err) {
      setError(err?.message || "Could not load this campaign.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action, extra = {}) {
    setBusy(action);
    setError("");
    setProblems([]);
    try {
      await fetchJson(`/api/platform/sales/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
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

          {source.registered && !source.unavailable && (source.configFields || []).length ? (
            <>
              <p className="text-xs text-muted-foreground break-words">
                Currently: {source.config?.summary || "not set"}
              </p>
              {(source.config?.problems || []).map((p) => (
                <p key={p} className="text-xs text-amber-900 dark:text-amber-200 break-words">
                  {p}
                </p>
              ))}
              {source.configFields.map((field) => (
                <div key={field.name}>
                  <label
                    className="block text-sm font-medium text-foreground mb-1"
                    htmlFor={`cfg-${source.key}-${field.name}`}
                  >
                    {field.label}
                  </label>
                  <input
                    id={`cfg-${source.key}-${field.name}`}
                    className={FIELD}
                    value={configs[source.key]?.[field.name] ?? ""}
                    onChange={(e) =>
                      setConfigs({
                        ...configs,
                        [source.key]: { ...(configs[source.key] || {}), [field.name]: e.target.value },
                      })
                    }
                    placeholder="Paste the new value to replace what is stored"
                  />
                  {field.help ? <p className="mt-1 text-xs text-muted-foreground">{field.help}</p> : null}
                </div>
              ))}
              <button
                type="button"
                className={`${BTN} border border-border text-foreground`}
                onClick={() =>
                  act("configure", { sourceKey: source.key, providerConfig: configs[source.key] || {} })
                }
                disabled={Boolean(busy)}
              >
                {busy === "configure" ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save {source.label} settings
              </button>
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

            {p.possibleDuplicateOfId ? (
              <p className="text-xs text-amber-800 dark:text-amber-200">{p.duplicateNote}</p>
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
