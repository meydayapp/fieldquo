// app/platform/sales/campaigns/page.js
//
// Where a superadmin says "find me a thousand painting contractors in Ottawa".
//
// ══ Why the trade is a required choice and not a filter ═══════════════════
//
// The owner's reasoning, which the form states rather than hides: a rep who
// says the same script forty times gets better at it; one who switches trade
// every call never does. So a campaign is territory AND trade, the queue that
// comes out is single-trade, and there is no "all trades" option to pick by
// accident.
//
// ══ Why the sources have no default ═══════════════════════════════════════
//
// `ProspectCampaign.discoverySources` has no default in the schema and the
// form has nothing preticked, for the reason its schema comment gives at
// length: the obvious default was Google, whose terms forbid storing business
// names and addresses and forbid building a directory — and whose key also
// powers address autocomplete and the Solar roof measurement in the live
// product. Choosing a source is choosing a licence.
//
// ══ Which is why the boxes are checkboxes and each one states its terms ════
//
// The owner's rule: "where the business comes from should be a checkbox to
// allow multiple sources, not one or the other." A single campaign draws from
// Overture AND a licence register in one run, and the same painter arriving
// from both is flagged rather than merged.
//
// The single `<select>` this replaces carried the licence argument by being
// singular: one choice, one licence, taken deliberately. Ticking three boxes
// takes on three different sets of terms in one gesture — CC-BY makes
// attribution a CONDITION of the grant, CDLA-Permissive puts its obligation on
// the data rather than on what is built from it — so each box states its own
// licence next to itself. Not in a tooltip and not on a second screen: the
// obligation has to be legible at the moment it is taken on, or the property
// the single-select was protecting is gone.
//
// A source that CANNOT run is rendered disabled with the reason beside it,
// never as a tickable box. RBQ is one today — the register carries no website
// column, so nothing can ever establish a trade for its rows. A disabled
// checkbox with a sentence is honest; a tickable one that produces a Start
// button which fails on click is the dead control AGENTS.md opens by
// forbidding.
//
// ══ What is deliberately NOT here ═════════════════════════════════════════
//
// A territory console. Territories can be created with a campaign and reused
// by later ones; renaming or re-drawing one afterwards is not built, and the
// screen says so in a sentence instead of rendering a control that would fail.
//
// ══ Mobile-first ══════════════════════════════════════════════════════════
//
// Single column, full-width controls, 44px targets, no table and no modal.
// This file is in scripts/check-mobile-surfaces.mjs's STRICT list.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Loader2, MapPin, Plus, Target } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const LABEL = "block text-sm font-medium text-foreground mb-1";

const BLANK = {
  name: "",
  tradeKey: "",
  targetCount: "500",
  // A SET, empty. Not "" and not one preticked box — see the header.
  discoverySources: [],
  // Keyed by source, because both shipped sources have a field called
  // `snapshotUrl` and one flat object would put Overture's file behind the
  // register's name.
  sourceConfigs: {},
  territoryId: "",
  territoryName: "",
  country: "",
  province: "",
  city: "",
  centerLat: "",
  centerLng: "",
  radiusKm: "",
};

const STATUS_TONE = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  paused: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  completed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  cancelled: "bg-muted text-muted-foreground",
};

export default function PlatformSalesCampaignsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(BLANK);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson("/api/platform/sales/campaigns"));
    } catch (err) {
      setError(err?.message || "Could not load the campaigns.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const providers = data?.providers || [];

  /**
   * Tick or untick one source.
   *
   * Unticking DROPS that source's settings. Keeping them would leave a
   * snapshot URL in the payload for a source the campaign does not draw from,
   * which the server would discard anyway — and a form whose state disagrees
   * with what it sends is how a "saved" setting turns out never to have been
   * saved.
   */
  function toggleSource(key, ticked) {
    setDraft((current) => {
      const chosen = current.discoverySources.filter((k) => k !== key);
      const configs = { ...current.sourceConfigs };
      if (ticked) {
        chosen.push(key);
        configs[key] = configs[key] || {};
      } else {
        delete configs[key];
      }
      return { ...current, discoverySources: chosen, sourceConfigs: configs };
    });
  }

  async function create() {
    setSaving(true);
    setError("");
    setProblems([]);
    try {
      await fetchJson("/api/platform/sales/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          targetCount: Number(draft.targetCount),
        }),
      });
      setDraft(BLANK);
      setAdding(false);
      await load();
    } catch (err) {
      setError(err?.message || "Could not create the campaign.");
      setProblems(Array.isArray(err?.body?.problems) ? err.body.problems : []);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} /> Loading campaigns…
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Discovery campaigns</h1>
        <p className="text-sm text-muted-foreground">
          One territory, one trade, one target. The queue a campaign produces is single-trade on purpose — a
          rep who says the same script forty times gets better at it.
        </p>
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

      {adding ? (
        <section className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h2 className="text-base font-semibold text-foreground">New campaign</h2>

          <div>
            <label className={LABEL} htmlFor="c-name">
              Name
            </label>
            <input
              id="c-name"
              className={FIELD}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ottawa painters, September"
            />
          </div>

          <div>
            <label className={LABEL} htmlFor="c-trade">
              Trade
            </label>
            <select
              id="c-trade"
              className={FIELD}
              value={draft.tradeKey}
              onChange={(e) => setDraft({ ...draft, tradeKey: e.target.value })}
            >
              <option value="">Choose a trade…</option>
              {(data?.trades || []).map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              A business whose category maps to a different trade is counted and skipped, never quietly added.
            </p>
          </div>

          <div>
            <label className={LABEL} htmlFor="c-target">
              How many prospects
            </label>
            <input
              id="c-target"
              className={FIELD}
              inputMode="numeric"
              value={draft.targetCount}
              onChange={(e) => setDraft({ ...draft, targetCount: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Counted against accepted contractors, not against rows found — so paint stores never count
              towards the target.
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className={LABEL}>Where the businesses come from</legend>
            <p className="text-xs text-muted-foreground">
              Tick as many as you want — a campaign can draw from several at once, and the same business
              arriving from two of them is flagged rather than merged. There is deliberately no default.
              Choosing a source is choosing a licence, and the obvious default is the one whose terms forbid
              this exact use. Every box below states the terms it comes with; ticking three takes on three.
            </p>

            {providers.length === 0 ? (
              <p className="text-sm text-muted-foreground">This build ships no discovery sources.</p>
            ) : null}

            {providers.map((p) => {
              const ticked = draft.discoverySources.includes(p.key);
              const blocked = Boolean(p.unavailable);
              return (
                <div key={p.key} className="rounded-lg border border-border p-3 space-y-2">
                  <label
                    className={`flex items-start gap-3 min-h-[44px] ${blocked ? "opacity-60" : "cursor-pointer"}`}
                    htmlFor={`src-${p.key}`}
                  >
                    <input
                      id={`src-${p.key}`}
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0"
                      checked={ticked}
                      disabled={blocked}
                      onChange={(e) => toggleSource(p.key, e.target.checked)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground break-words">{p.label}</span>
                      <span className="block text-xs text-muted-foreground break-words">{p.description}</span>
                    </span>
                  </label>

                  {/* The licence, against the box, always — not behind the tick.
                      A superadmin comparing sources is comparing obligations. */}
                  {p.licence ? (
                    <p className="text-xs text-muted-foreground break-words">
                      <span className="font-medium text-foreground">Licence: {p.licence.name}</span>
                      {p.licence.url ? ` (${p.licence.url})` : ""} — {p.licence.obligation}
                      {p.licence.attribution ? ` The notice: “${p.licence.attribution}”` : ""}
                    </p>
                  ) : null}

                  {/* Disabled, with the reason beside it. A tickable box here
                      would save a campaign whose Start button could only fail. */}
                  {blocked ? (
                    <p className="rounded-lg px-2 py-1 text-xs bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 break-words">
                      Cannot be used yet: {p.unavailable}
                    </p>
                  ) : null}

                  {ticked && !blocked && (p.configFields || []).length ? (
                    <div className="space-y-4 border-t border-border pt-3">
                      {(p.configFields || []).map((field) => (
                        <div key={field.name}>
                          <label className={LABEL} htmlFor={`cfg-${p.key}-${field.name}`}>
                            {field.label}
                            {field.required ? " (required)" : ""}
                          </label>
                          <input
                            id={`cfg-${p.key}-${field.name}`}
                            className={FIELD}
                            value={draft.sourceConfigs?.[p.key]?.[field.name] || ""}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                sourceConfigs: {
                                  ...draft.sourceConfigs,
                                  [p.key]: { ...(draft.sourceConfigs?.[p.key] || {}), [field.name]: e.target.value },
                                },
                              })
                            }
                          />
                          {field.help ? <p className="mt-1 text-xs text-muted-foreground">{field.help}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </fieldset>

          <div>
            <label className={LABEL} htmlFor="c-territory">
              Territory
            </label>
            <select
              id="c-territory"
              className={FIELD}
              value={draft.territoryId}
              onChange={(e) => setDraft({ ...draft, territoryId: e.target.value })}
            >
              <option value="">Describe a new one below…</option>
              {(data?.territories || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {draft.territoryId ? null : (
            <div className="space-y-4 rounded-lg border border-border p-3">
              <div>
                <label className={LABEL} htmlFor="t-name">
                  Territory name
                </label>
                <input
                  id="t-name"
                  className={FIELD}
                  value={draft.territoryName}
                  onChange={(e) => setDraft({ ...draft, territoryName: e.target.value })}
                  placeholder="Ottawa area"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="t-country">
                  Country code
                </label>
                <input
                  id="t-country"
                  className={FIELD}
                  value={draft.country}
                  onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                  placeholder="CA"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="t-province">
                  Region or province (optional)
                </label>
                <input
                  id="t-province"
                  className={FIELD}
                  value={draft.province}
                  onChange={(e) => setDraft({ ...draft, province: e.target.value })}
                  placeholder="ON"
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="t-city">
                  City (optional)
                </label>
                <input
                  id="t-city"
                  className={FIELD}
                  value={draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  placeholder="Ottawa"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL} htmlFor="t-lat">
                    Centre latitude
                  </label>
                  <input
                    id="t-lat"
                    className={FIELD}
                    inputMode="decimal"
                    value={draft.centerLat}
                    onChange={(e) => setDraft({ ...draft, centerLat: e.target.value })}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="t-lng">
                    Centre longitude
                  </label>
                  <input
                    id="t-lng"
                    className={FIELD}
                    inputMode="decimal"
                    value={draft.centerLng}
                    onChange={(e) => setDraft({ ...draft, centerLng: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL} htmlFor="t-radius">
                  Radius in km
                </label>
                <input
                  id="t-radius"
                  className={FIELD}
                  inputMode="numeric"
                  value={draft.radiusKm}
                  onChange={(e) => setDraft({ ...draft, radiusKm: e.target.value })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional, and all-or-nothing: a centre with no radius matches nothing and a radius with no
                  centre matches everything, so the form refuses half of either. City and region alone work
                  fine without it.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              className={`${BTN} bg-primary text-primary-foreground`}
              onClick={create}
              disabled={saving}
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Create campaign
            </button>
            <button
              type="button"
              className={`${BTN} border border-border text-foreground`}
              onClick={() => {
                setAdding(false);
                setDraft(BLANK);
                setProblems([]);
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          className={`${BTN} bg-primary text-primary-foreground w-full sm:w-auto`}
          onClick={() => setAdding(true)}
        >
          <Plus size={16} /> New campaign
        </button>
      )}

      <section className="space-y-3">
        {(data?.campaigns || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        ) : null}

        {(data?.campaigns || []).map((c) => (
          <Link
            key={c.id}
            href={`/platform/sales/campaigns/${c.id}`}
            className="block rounded-xl border border-border bg-card p-4 min-h-[44px]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground break-words">{c.name}</p>
                <p className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={12} /> {c.territory?.name || "no territory"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Target size={12} /> {c.progress.accepted} of {c.progress.target}
                  </span>
                  <span className="break-words">
                    {(c.sources || []).length
                      ? (c.sources || []).map((s) => s.label).join(" + ")
                      : "no source"}
                  </span>
                </p>
              </div>
              <ArrowRight size={16} className="mt-1 shrink-0 text-muted-foreground" />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-xs ${STATUS_TONE[c.status] || STATUS_TONE.draft}`}>
                {c.status}
              </span>
              {c.sourcesReady ? null : (
                <span className="rounded-full px-2 py-1 text-xs bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  {(c.sources || []).length
                    ? `needs settings for ${(c.sources || [])
                        .filter((s) => !s.ready)
                        .map((s) => s.label)
                        .join(", ")}`
                    : "no source chosen"}
                </span>
              )}
              {/* A source that stopped for a reason is named on the LIST, not
                  only inside the campaign. A campaign reading "completed"
                  while one of its two sources died is the silent drop this
                  whole change exists to prevent. */}
              {(c.sources || [])
                .filter((s) => s.blocked)
                .map((s) => (
                  <span
                    key={s.key}
                    className="rounded-full px-2 py-1 text-xs bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  >
                    {s.label} stopped
                  </span>
                ))}
            </div>

            {c.progress.percent === null ? null : (
              <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${c.progress.percent}%` }} />
              </div>
            )}
          </Link>
        ))}
      </section>

      <p className="text-xs text-muted-foreground">
        Territories are created with a campaign and reused by later ones. Renaming or re-drawing one
        afterwards is not built yet — there is no screen for it, rather than a button that would not work.
      </p>
    </div>
  );
}
