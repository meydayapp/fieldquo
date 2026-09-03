// app/platform/sales/prospects/page.js
//
// What discovery found, and everything known about one of them.
//
// ══ Why one route and not a list plus a /[id] detail ══════════════════════
//
// The detail view is a panel on this page rather than its own route. Two
// reasons, and the second is the real one: a superadmin checking whether
// discovery is working opens ten of these in a row and wants the filters still
// set when they come back, and a phone should not reload a fifty-row list to
// return from a detail. A separate route would need its own nav exception in
// check-nav-audit anyway, for a page that is never linked from a sidebar.
//
// ══ The three layers, three sections, in this order ═══════════════════════
//
// Facts, then inferences, then recommendations — the order they depend on each
// other in, never merged and never interleaved. Whatever the badges say, a
// reader takes adjacency for equivalence, so the separation is structural
// (three <section>s with their own headings and their own one-line
// explanations) rather than a coloured pill on a flat list.
//
// The sentences themselves come from lib/sales/prospectView.js, which calls
// lib/sales/intel/confidence.js's presenters. Nothing on this page decides
// whether something is verified, and nothing here decides what a `false`
// capability versus a `null` one is allowed to say.
//
// ══ Mobile-first ══════════════════════════════════════════════════════════
//
// Single column, full-width controls, 44px targets, no table and no modal.
// This file is in scripts/check-mobile-surfaces.mjs's STRICT list.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  CircleHelp,
  Filter,
  Loader2,
  Search,
  ShieldAlert,
  Tags,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { LAYER_HEADINGS, SOURCE_CATEGORY_HEADING } from "@/lib/sales/prospectView";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const LABEL = "block text-sm font-medium text-foreground mb-1";
const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";

const BLANK_FILTERS = {
  q: "",
  territoryId: "",
  campaignId: "",
  tradeKey: "",
  sourceCategory: "",
  status: "",
  website: "",
  competitor: "",
  claim: "",
  contact: "",
  minScore: "",
};

/**
 * The three tones a fact can carry, and they are three.
 *
 * `gap` (we looked, it is not there) and `unknown` (we could not look) are
 * deliberately different colours as well as different sentences. A rep and a
 * superadmin both scan this list rather than read it, and two states rendered
 * in one grey is the whole failure this screen exists to avoid.
 */
const TONE_CLASS = {
  has: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800",
  gap: "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800",
  unknown: "bg-muted text-muted-foreground border-border border-dashed",
};

function Pill({ tone = "unknown", children }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-1 text-xs ${TONE_CLASS[tone] || TONE_CLASS.unknown}`}
    >
      {children}
    </span>
  );
}

function LayerHeader({ layer, count }) {
  const heading = LAYER_HEADINGS[layer];
  return (
    <div className="space-y-1">
      <h3 className="text-base font-semibold text-foreground">
        {heading.title}
        {typeof count === "number" ? ` (${count})` : ""}
      </h3>
      <p className="text-xs text-muted-foreground">{heading.note}</p>
    </div>
  );
}

export default function PlatformProspectsPage() {
  const [filters, setFilters] = useState(BLANK_FILTERS);
  const [applied, setApplied] = useState(BLANK_FILTERS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(applied)) {
        if (value) params.set(key, value);
      }
      if (page) params.set("page", String(page));
      setData(await fetchJson(`/api/platform/sales/prospects?${params.toString()}`));
    } catch (err) {
      setError(err?.message || "Could not load the prospects.");
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    fetchJson(`/api/platform/sales/prospects/${selectedId}`)
      .then((body) => {
        if (!cancelled) setDetail(body);
      })
      .catch((err) => {
        if (!cancelled) setDetailError(err?.message || "Could not load that prospect.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function apply() {
    setPage(0);
    setApplied(filters);
    setShowFilters(false);
  }

  // ── One prospect ───────────────────────────────────────────────────────
  if (selectedId) {
    return (
      <div className="p-4 max-w-3xl mx-auto space-y-6">
        <button type="button" className={`${BTN} border border-border text-foreground`} onClick={() => setSelectedId(null)}>
          <ArrowLeft size={16} /> Back to the list
        </button>

        {detailError ? (
          <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200">
            {detailError}
          </div>
        ) : null}

        {detailLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : null}

        {detail ? <ProspectDetail detail={detail} /> : null}
      </div>
    );
  }

  // ── The list ───────────────────────────────────────────────────────────
  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Prospects</h1>
        <p className="text-sm text-muted-foreground">
          Every business discovery has written, with what has been observed, inferred and recommended about
          each. This is where you check whether discovery is working — and nothing here edits a prospect: a
          correction is a record of its own, not an overwrite.
        </p>
        <p className="text-sm text-muted-foreground">
          <Link href="/platform/sales/campaigns" className="underline">
            Discovery campaigns
          </Link>{" "}
          is where the rows come from.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <label className="sr-only" htmlFor="p-q">
            Search
          </label>
          <input
            id="p-q"
            className={FIELD}
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply();
            }}
            placeholder="Name, city, domain or phone"
          />
        </div>
        <button type="button" className={`${BTN} bg-primary text-primary-foreground`} onClick={apply}>
          <Search size={16} /> Search
        </button>
        <button
          type="button"
          className={`${BTN} border border-border text-foreground`}
          onClick={() => setShowFilters((v) => !v)}
        >
          <Filter size={16} /> Filters
        </button>
      </div>

      {showFilters ? (
        <section className={CARD}>
          <h2 className="text-base font-semibold text-foreground">Narrow it down</h2>

          <div>
            <label className={LABEL} htmlFor="f-territory">
              Territory
            </label>
            <select
              id="f-territory"
              className={FIELD}
              value={filters.territoryId}
              onChange={(e) => setFilters({ ...filters, territoryId: e.target.value })}
            >
              <option value="">Any territory</option>
              {(data?.territories || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor="f-campaign">
              Campaign
            </label>
            <select
              id="f-campaign"
              className={FIELD}
              value={filters.campaignId}
              onChange={(e) => setFilters({ ...filters, campaignId: e.target.value })}
            >
              <option value="">Any campaign</option>
              {(data?.campaigns || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor="f-trade">
              Trade
            </label>
            <select
              id="f-trade"
              className={FIELD}
              value={filters.tradeKey}
              onChange={(e) => setFilters({ ...filters, tradeKey: e.target.value })}
            >
              <option value="">Any trade</option>
              {(data?.trades || []).map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* ══ Source category: a filter the trade one cannot stand in for ══
              A prospect with no `tradeKey` is invisible to the control above,
              and that is most of Quebec: an RBQ licence authorises a median of
              sixteen or seventeen subcategories, so nothing identifies a trade
              and the pipeline refuses to guess one. Those rows are reachable
              here and nowhere else.

              ══ Why a search box and not a <select> ══
              Two sources already put ~40 RBQ codes and ~46 Overture strings in
              this column and a third adds its own. A flat select of ninety
              opaque codes is a scroll wheel on a phone with no way to jump to
              `rbq:13.5`, and it grows worse with every provider. The datalist
              types, filters natively, and degrades to a plain text input where
              it is unsupported — where the control still works, because the
              server matches the string either way.

              The options are every category ACTUALLY on a row, so a value
              picked from this list can never come back empty. */}
          <div>
            <label className={LABEL} htmlFor="f-source-category">
              Source category
            </label>
            <input
              id="f-source-category"
              className={FIELD}
              list="f-source-category-options"
              value={filters.sourceCategory}
              onChange={(e) => setFilters({ ...filters, sourceCategory: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
              }}
              placeholder={
                data?.sourceCategoryOptions?.[0]
                  ? `Type to search — e.g. ${data.sourceCategoryOptions[0].category}`
                  : "Type to search"
              }
            />
            <datalist id="f-source-category-options">
              {(data?.sourceCategoryOptions || []).map((o) => (
                <option key={o.category} value={o.category}>
                  {o.count} prospect{o.count === 1 ? "" : "s"}
                </option>
              ))}
            </datalist>
            {/* Three states, and the third is not the second. An empty list
                because the bank holds no categories, and an empty list because
                the aggregate failed, are different facts — and the typing
                still filters in both cases, so neither disables the control. */}
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.sourceCategoryOptionsError
                ? data.sourceCategoryOptionsError
                : data?.sourceCategoryOptions?.length
                  ? `${data.sourceCategoryOptions.length}` +
                    `${data.sourceCategoryOptionsComplete ? "" : "+"}` +
                    " categories are on a record, commonest first. These are the source's own" +
                    " strings — a licence authorising cabinets says the holder MAY fit cabinets," +
                    " not that they do."
                  : "Nothing discovered so far carries a source category, so there is nothing to pick from yet."}
            </p>
          </div>

          <div>
            <label className={LABEL} htmlFor="f-status">
              Status
            </label>
            <select
              id="f-status"
              className={FIELD}
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Any status</option>
              {(data?.statuses || []).map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                  {data?.statusCounts?.[s.key] === undefined ? "" : ` (${data.statusCounts[s.key]})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor="f-website">
              Website
            </label>
            <select
              id="f-website"
              className={FIELD}
              value={filters.website}
              onChange={(e) => setFilters({ ...filters, website: e.target.value })}
            >
              <option value="">Any</option>
              <option value="yes">Has one</option>
              <option value="no" disabled>
                Has none — nothing can prove this yet
              </option>
              <option value="unknown">Not checked</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              &ldquo;Has none&rdquo; and &ldquo;not checked&rdquo; are separate on purpose. The source listing
              no website is a gap in the directory as often as a gap in the market — which is
              why nothing writes &ldquo;has none&rdquo; from a listing alone. Only a search that looked
              and failed could, and none runs today, so that option is switched off rather than
              quietly returning nothing.
            </p>
          </div>

          <div>
            <label className={LABEL} htmlFor="f-competitor">
              Competitor software
            </label>
            <select
              id="f-competitor"
              className={FIELD}
              value={filters.competitor}
              onChange={(e) => setFilters({ ...filters, competitor: e.target.value })}
            >
              <option value="">Any</option>
              <option value="yes">Competitor detected</option>
              <option value="no">None detected, and we crawled them</option>
              <option value="uncrawled">Never crawled — we do not know</option>
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor="f-claim">
              Ownership
            </label>
            <select
              id="f-claim"
              className={FIELD}
              value={filters.claim}
              onChange={(e) => setFilters({ ...filters, claim: e.target.value })}
            >
              <option value="">Any</option>
              <option value="unclaimed">Unclaimed</option>
              <option value="claimed">Claimed by a rep</option>
              <option value="lapsed">Claim lapsed unworked</option>
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor="f-contact">
              Contactable
            </label>
            <select
              id="f-contact"
              className={FIELD}
              value={filters.contact}
              onChange={(e) => setFilters({ ...filters, contact: e.target.value })}
            >
              <option value="">Any</option>
              <option value="callable">Not on do-not-contact</option>
              <option value="dnc">Do not contact</option>
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor="f-score">
              Minimum lead score
            </label>
            <input
              id="f-score"
              className={FIELD}
              type="number"
              min="0"
              max="100"
              value={filters.minScore}
              disabled={data?.scoredCount === 0}
              onChange={(e) => setFilters({ ...filters, minScore: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.scoredCount === 0
                ? "Disabled: nothing in this build writes a ProspectScore, so filtering on one would return nothing. It is off rather than silently empty."
                : `${data?.scoredCount} score${data?.scoredCount === 1 ? "" : "s"} recorded.`}
            </p>
          </div>

          <button type="button" className={`${BTN} bg-primary text-primary-foreground w-full`} onClick={apply}>
            Apply
          </button>
          <button
            type="button"
            className={`${BTN} border border-border text-foreground w-full`}
            onClick={() => {
              setFilters(BLANK_FILTERS);
              setApplied(BLANK_FILTERS);
              setPage(0);
              setShowFilters(false);
            }}
          >
            Clear every filter
          </button>
        </section>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> Loading prospects…
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <p className="text-sm text-muted-foreground">
            {data.total} matching prospect{data.total === 1 ? "" : "s"}
            {data.total > data.pageSize
              ? ` · showing ${data.page * data.pageSize + 1}–${Math.min(
                  (data.page + 1) * data.pageSize,
                  data.total,
                )}`
              : ""}
          </p>

          {data.prospects.length === 0 ? (
            <div className={CARD}>
              <p className="text-sm text-foreground">Nothing matches these filters.</p>
              <p className="text-xs text-muted-foreground">
                That is a real answer, not a failure — an empty result here usually means the campaign that
                would have produced these rows has not run.
              </p>
              {/* The one empty result that is NOT a real answer: a mistyped
                  category matches zero rows and looks exactly like a category
                  nobody has. Only sayable when the option list is the whole
                  vocabulary — see sourceCategoryOptionsComplete. */}
              {data.sourceCategory &&
              data.sourceCategoryOptionsComplete &&
              !(data.sourceCategoryOptions || []).some((o) => o.category === data.sourceCategory) ? (
                <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
                  No record anywhere carries the category &ldquo;{data.sourceCategory}&rdquo; — it is not one
                  of the {(data.sourceCategoryOptions || []).length} in the bank, so this is a spelling to
                  check rather than a gap in the data.
                </p>
              ) : null}
            </div>
          ) : null}

          <ul className="space-y-3">
            {data.prospects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`${CARD} w-full text-left min-h-[44px] hover:border-foreground/30`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground break-words">{p.businessName}</p>
                    <p className="text-xs text-muted-foreground break-words">
                      {[p.where, p.tradeLabel, p.territory?.name].filter(Boolean).join(" · ") ||
                        "No location on this record"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={p.status === "discovered" ? "has" : "unknown"}>{p.statusLabel}</Pill>
                    {/* Three values, three pills. Never two. */}
                    {p.hasWebsite === true ? <Pill tone="has">Website</Pill> : null}
                    {p.hasWebsite === false ? <Pill tone="gap">No website — we looked</Pill> : null}
                    {p.hasWebsite === null ? <Pill tone="unknown">Website not checked</Pill> : null}
                    {p.competitors.length ? (
                      <Pill tone="gap">Competitor: {p.competitors.join(", ")}</Pill>
                    ) : p.crawled ? (
                      <Pill tone="has">No competitor found</Pill>
                    ) : (
                      <Pill tone="unknown">Never crawled</Pill>
                    )}
                    {p.rating === null ? (
                      <Pill tone="unknown">No rating listed</Pill>
                    ) : (
                      <Pill tone="has">
                        {p.rating.toFixed(1)}★ {p.reviewCount === null ? "" : `· ${p.reviewCount}`}
                      </Pill>
                    )}
                    {p.score === null ? <Pill tone="unknown">No lead score</Pill> : <Pill tone="has">Score {p.score}</Pill>}
                    {/* Neutral tone, and a count rather than the strings. It
                        says the set is on the record and where to read it; it
                        does not say what the business does, which is the one
                        thing seventeen authorisations cannot tell you. */}
                    {p.sourceCategoryCount ? (
                      <Pill tone="unknown">
                        {p.sourceCategoryCount} source categor{p.sourceCategoryCount === 1 ? "y" : "ies"}
                      </Pill>
                    ) : null}
                    {p.contact.callable ? null : <Pill tone="gap">{p.contact.title}</Pill>}
                    {p.claim.state === "unclaimed" ? null : <Pill tone="unknown">{p.claim.state.replace(/_/g, " ")}</Pill>}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {data.total > data.pageSize ? (
            <div className="flex gap-2">
              <button
                type="button"
                className={`${BTN} border border-border text-foreground flex-1`}
                disabled={data.page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className={`${BTN} border border-border text-foreground flex-1`}
                disabled={(data.page + 1) * data.pageSize >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Every category the source used, all of them, with the code kept readable.
 *
 * ══ Why the whole list and never the first three ═══════════════════════════
 *
 * A Quebec RBQ licence carries sixteen or seventeen authorisations and the
 * informative one is as likely to be sixteenth as first — a licence authorised
 * for roofing AND interior finishing AND cabinets is a real thing a rep can
 * act on, and truncating it hides exactly the combination that made it worth
 * reading. So: no "+14 more", no primary, no sort by anything that would imply
 * a ranking the source did not give.
 *
 * ══ Why the raw code is on the screen ══════════════════════════════════════
 *
 * A superadmin checking a row against the RBQ's own public lookup types the
 * code. A description alone, however readable, cannot be typed into anything.
 * So the code is the primary text and any description sits under it, never the
 * other way round.
 *
 * ══ Mobile ════════════════════════════════════════════════════════════════
 *
 * Seventeen rows in one column is long, and long is correct here — this is the
 * screen someone opened BECAUSE they wanted the whole set. What it must not be
 * is wide, so each entry wraps (`break-all` on the code: `rbq:13.5` has no
 * space to break at) and nothing sits in a row that pushes the page sideways.
 */
function SourceCategories({ view }) {
  // An older cached payload, or a route that stopped sending it. Rendering an
  // empty box here would read as "the source said nothing", which is a claim.
  if (!view) return null;

  return (
    <section className={CARD}>
      <h3 className="text-base font-semibold text-foreground">
        <Tags size={16} className="inline mr-1" />
        {SOURCE_CATEGORY_HEADING.title}
        {view.count ? ` (${view.count})` : ""}
      </h3>
      <p className="text-xs text-muted-foreground">{SOURCE_CATEGORY_HEADING.note}</p>

      {view.known ? null : (
        <p className="text-sm text-foreground break-words">{view.emptyText}</p>
      )}

      {view.groups.map((g) => (
        <div key={g.namespace || "unnamespaced"} className="space-y-2 pt-2">
          {g.sourceLabel ? (
            <h4 className="text-sm font-medium text-foreground break-words">{g.sourceLabel}</h4>
          ) : null}
          <p className="text-xs text-muted-foreground break-words">{g.note}</p>
          {/* Said only while it is true of every code in the group — see
              sourceCategoryView. The RBQ extract publishes the code without
              its title, and no table in this repo invents one. */}
          {g.untitled ? (
            <p className="text-xs text-muted-foreground break-words">{g.untitled}</p>
          ) : null}
          <ul className="space-y-2">
            {g.rows.map((row) => (
              <li key={row.key} className="flex flex-col gap-0.5">
                <span className="font-mono text-sm text-foreground break-all">{row.raw}</span>
                {row.description ? (
                  <span className="text-xs text-muted-foreground break-words">{row.description}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** One prospect: facts, then inferences, then recommendations. Never merged. */
function ProspectDetail({ detail }) {
  const p = detail.prospect;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground break-words">{p.businessName}</h1>
        <p className="text-sm text-muted-foreground break-words">
          {[p.tradeLabel, p.territory?.name, p.campaign?.name].filter(Boolean).join(" · ") ||
            "No trade, territory or campaign on this record"}
        </p>
      </header>

      {p.contact.callable ? null : (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200">
          <div className="flex items-start gap-2">
            <Ban size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">{p.contact.title}</p>
              <p>{p.contact.text}</p>
            </div>
          </div>
        </div>
      )}

      <section className={CARD}>
        <h2 className="text-base font-semibold text-foreground">Ownership</h2>
        <p className="text-sm text-foreground">{p.claim.text}</p>
        {p.assignedRep ? (
          <p className="text-xs text-muted-foreground break-words">
            Held by {p.assignedRep.name || p.assignedRep.email}
            {p.assignedAt ? ` since ${new Date(p.assignedAt).toISOString().slice(0, 10)}` : ""}.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          An unworked claim lapses after {detail.claimHours} hours. That figure is a constant in
          lib/sales/prospectView.js, not a setting — no column holds it, so no field is rendered that would
          not persist.
        </p>
      </section>

      {/* ── Layer 1 ─────────────────────────────────────────────────────── */}
      <section className={CARD}>
        <LayerHeader layer="fact" />
        <ul className="space-y-2">
          {p.facts.map((f) => (
            <li key={f.key} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{f.label}</span>
              <span className={`text-sm break-words ${f.known ? "text-foreground" : "text-muted-foreground italic"}`}>
                {f.text}
              </span>
              {/* The second line a fact is allowed to carry. Two facts use it and
                  both are obligations rather than observations: the CC-BY credit
                  Quebec's licence register requires, and the CASL reason email is
                  closed on a register-sourced row. Rendered because a notice the
                  presenter returns and the page drops is not a notice. */}
              {f.detail ? (
                <span className="text-xs text-muted-foreground break-words">{f.detail}</span>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="pt-2 space-y-2">
          <h4 className="text-sm font-medium text-foreground">Capabilities detected</h4>
          {p.capabilities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No capability has been recorded. Nothing has crawled this business.
            </p>
          ) : (
            <ul className="space-y-2">
              {p.capabilities.map((c) => (
                <li key={c.code} className="space-y-1">
                  <Pill tone={c.tone}>{c.text}</Pill>
                  {c.detail ? <p className="text-xs text-muted-foreground break-words">{c.detail}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    {c.verified
                      ? "Verified — read off a structural signal."
                      : c.known
                        ? "Not verified — say it as an impression, not a fact."
                        : "Nothing to verify."}
                    {c.confidence?.reasonText ? ` ${c.confidence.reasonText}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-2 space-y-2">
          <h4 className="text-sm font-medium text-foreground">Software</h4>
          <p className="text-sm text-foreground break-words">{p.competitor.text}</p>
          {p.technologies.length ? (
            <ul className="space-y-1">
              {p.technologies.map((t) => (
                <li key={t.code} className="text-xs text-muted-foreground break-words">
                  {t.text}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {/* ── Layer 2 ─────────────────────────────────────────────────────── */}
      <section className={CARD}>
        <LayerHeader layer="inference" />
        {p.inferences.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing has been inferred about this business yet. Nothing in this build writes a
            ProspectInference, so an empty list here is the truth rather than a gap in the screen.
          </p>
        ) : (
          <ul className="space-y-3">
            {p.inferences.map((inf, i) => (
              <li key={`${inf.kind}-${i}`} className="space-y-1">
                {inf.renderable ? (
                  <>
                    <p className="text-sm text-foreground break-words">
                      {inf.kindText}: <strong>{inf.text}</strong>
                    </p>
                    {/* The confidence is never optional beside an inference. */}
                    <p className="text-xs text-muted-foreground">
                      {inf.confidenceText} · never a fact, whatever it scores · {inf.sourceText}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
                    <ShieldAlert size={14} className="inline mr-1" />
                    {inf.refusal}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Layer 3 ─────────────────────────────────────────────────────── */}
      <section className={CARD}>
        <LayerHeader layer="recommendation" />
        {p.opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing is recommended. A recommendation needs an observation to cite, and there is none.
          </p>
        ) : (
          <ol className="space-y-3">
            {p.opportunities.map((o, i) => (
              <li key={`${o.capabilityCode}-${i}`} className="space-y-1">
                {o.renderable ? (
                  <>
                    <p className="text-sm font-medium text-foreground break-words">
                      {i + 1}. {o.name}
                    </p>
                    <p className="text-sm text-foreground break-words">{o.reason}</p>
                    <p className="text-xs text-muted-foreground break-words">
                      {o.confidenceText} · cites {o.evidenceIds.length} observation
                      {o.evidenceIds.length === 1 ? "" : "s"}
                      {o.ruleCode ? ` · rule ${o.ruleCode}${o.ruleVersion ? ` v${o.ruleVersion}` : ""}` : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
                    <ShieldAlert size={14} className="inline mr-1" />
                    {o.refusal}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ── What we do NOT know ─────────────────────────────────────────── */}
      <section className={CARD}>
        <h3 className="text-base font-semibold text-foreground">
          <CircleHelp size={16} className="inline mr-1" />
          What we do not know
        </h3>
        <p className="text-xs text-muted-foreground">
          Stated rather than left blank. A blank reads as a finding.
        </p>
        {p.unknowns.length === 0 ? (
          <p className="text-sm text-foreground">Nothing outstanding on this record.</p>
        ) : (
          <ul className="list-disc pl-5 space-y-1">
            {p.unknowns.map((u, i) => (
              <li key={`${u}-${i}`} className="text-sm text-muted-foreground break-words">
                {u}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Provenance ──────────────────────────────────────────────────── */}
      <section className={CARD}>
        <h3 className="text-base font-semibold text-foreground">Where this came from</h3>
        <ul className="space-y-1 text-sm text-muted-foreground break-words">
          <li>Source: {p.provenance.provider || "hand-typed — no provider"}</li>
          <li>Record id: {p.provenance.recordId || "none"}</li>
          <li>Release: {p.provenance.release || "not stamped"}</li>
          <li>Contributor: {p.provenance.dataset || "not stated"}</li>
          <li>
            Source&rsquo;s own confidence:{" "}
            {p.provenance.confidence === null ? "not stated" : p.provenance.confidence}
            {" — a provenance tag, never filtered on."}
          </li>
          {/* The categories themselves have a section of their own below.
              Seventeen RBQ codes comma-joined into a provenance line is the
              shape of "returned by the API and displayed nowhere" — present
              enough to look answered, too cramped to read or to type. */}
          <li>
            Classified as {p.classification || "nothing"}
            {p.classificationReason ? ` — ${p.classificationReason}` : ""}
          </li>
          {p.possibleDuplicateOfId ? (
            <li>Flagged as a possible duplicate. Kept and workable — merging destroys provenance.</li>
          ) : null}
        </ul>
      </section>

      {/* ── What the source called this ─────────────────────────────────── */}
      <SourceCategories view={p.sourceCategoriesView} />

      {/* ── The raw observations ────────────────────────────────────────── */}
      <section className={CARD}>
        <h3 className="text-base font-semibold text-foreground">
          Observations ({p.evidenceCount})
        </h3>
        <p className="text-xs text-muted-foreground">
          The bottom of the stack. Everything above cites these.
        </p>
        {p.evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has been observed about this business yet.</p>
        ) : (
          <ul className="space-y-2">
            {p.evidence.map((e) => (
              <li key={e.id} className="text-xs text-muted-foreground break-words">
                <span className="text-foreground">{e.type}</span> · {e.source} ·{" "}
                {e.normalizedValue || e.rawValue || "no value recorded"}
                {e.sourceUrl ? ` · ${e.sourceUrl}` : ""}
                {e.detector ? ` · ${e.detector} v${e.detectorVersion || "?"}` : ""}
              </li>
            ))}
          </ul>
        )}
        {p.evidenceCount > p.evidence.length ? (
          <p className="text-xs text-muted-foreground">
            Showing the {p.evidence.length} most recent of {p.evidenceCount}.
          </p>
        ) : null}
      </section>

      {p.corrections?.length ? (
        <section className={CARD}>
          <h3 className="text-base font-semibold text-foreground">Human corrections</h3>
          <ul className="space-y-1">
            {p.corrections.map((c) => (
              <li key={c.id} className="text-xs text-muted-foreground break-words">
                {c.target}: {c.originalValue || "—"} → {c.correctedValue || "—"}
                {c.reason ? ` (${c.reason})` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
