// app/platform/sales/campaigns/page.js
//
// Where a superadmin says "find me every painting contractor in Quebec".
//
// ══ Why the trade is a required choice and not a filter ═══════════════════
//
// The owner's reasoning, which the form states rather than hides: a rep who
// says the same script forty times gets better at it; one who switches trade
// every call never does. So a campaign is territory AND trade, and the queue
// that comes out is single-trade.
//
// ══ …and why there is now an "every trade" box anyway ═════════════════════
//
// UPDATED 2026-09-03. The argument above was right about the QUEUE and was
// being used to decide the BANK, which is a different question. What a rep is
// handed and what FieldQuo may know are not the same thing, and the owner's ask
// — "extract leads of all the contractors, doesn't matter painter, roofer,
// hvac, plumber" — is entirely about the second one.
//
// So the box is a statement about banking, and it changes NOTHING about the
// queue. `claimCandidateWhere()` filters on an exact trade key and has never
// heard of a campaign: a roofer banked by an all-trades campaign is claimable
// from the roofing queue and from no other, and a painting queue cannot contain
// it by construction rather than by anyone remembering to filter. That is
// proved by execution in scripts/check-bank-all-trades.mjs.
//
// ══ Nobody types a snapshot URL, a country code or a coordinate ═══════════
//
// UPDATED 2026-09-09, from the owner, about this exact screen: "I thought you
// had already fetched all the companies and saved it in cloudflare… where the
// fuck do I get the snapshot URL… it should be just automated for me in a way
// that I can just select few things and get the total number of trade. I pick
// trade painting, then it's all the companies that do painting." And: "is
// country code USA or US, I don't know but I can select it because you would
// already know."
//
// He was right on every count. The extract was already run and uploaded — 80
// files, 1,320,105 rows — so this form asked, once per campaign, for something
// that had been done once. It now asks for nothing it can work out:
//
//   the snapshot URL   derived from the base URL set once at
//                      /platform/sales/snapshots plus the object key of the
//                      file that covers the chosen region. Proved by fetching
//                      it before the campaign is saved.
//   the country        a select, filled from the countries the files cover.
//   the region         a select, filled from the regions the CHOSEN SOURCES
//                      cover — so a region with no file for them is absent
//                      rather than offered with a zero.
//   the row count      shown before the button is pressed, measured off the
//                      files by scripts/build-snapshot-library.mjs. Never
//                      estimated, and never a zero standing in for a number
//                      nobody has: the RBQ names no trade for anybody, and its
//                      rows are reported as "not known" rather than as no
//                      painters.
//   the centre         the median coordinate of that region's own rows, so the
//                      optional circle has a centre without anybody looking up
//                      a city.
//
// ══ Why the registration position is on the region ════════════════════════
//
// Thirteen jurisdictions require FieldQuo to register as a telephone solicitor
// before the first call and none of them is done. That is a fact about the
// place the phone rings, so it is stated ON the region, at the moment the
// region is chosen — and the campaign is created as a draft that cannot be
// started, which is what lib/sales/discovery/campaignGate.js enforces on the
// route. The list at the bottom orders them by the rows each would unlock,
// because that is the only question worth asking of such a list.
//
// ══ Mobile-first ══════════════════════════════════════════════════════════
//
// Single column, full-width controls, 44px targets, no table and no modal.
// This file is in scripts/check-mobile-surfaces.mjs's STRICT list.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Database, Loader2, MapPin, Plus, ShieldAlert, Target } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { jurisdictionKey } from "@/lib/sales/callingRules";
import {
  rowsByJurisdiction,
  snapshotCountries,
  snapshotRegions,
  snapshotSelection,
  tradeRowsFor,
} from "@/lib/sales/discovery/snapshotLibrary";
import { outstandingRegistrations, territoryRegistration } from "@/lib/sales/discovery/campaignGate";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const LABEL = "block text-sm font-medium text-foreground mb-1";

const COUNTRY_LABELS = { CA: "Canada", US: "United States" };

/** Region codes are what the data uses; these are what a person reads. Only
 *  the ones the library covers, and a code with no label prints as its code
 *  rather than as a guess. */
const REGION_LABELS = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories", NU: "Nunavut",
  ON: "Ontario", PE: "Prince Edward Island", QC: "Québec", SK: "Saskatchewan", YT: "Yukon",
  AK: "Alaska", AL: "Alabama", AR: "Arkansas", AS: "American Samoa", AZ: "Arizona", CA: "California",
  CO: "Colorado", CT: "Connecticut", DC: "District of Columbia", DE: "Delaware", FL: "Florida",
  FM: "Micronesia", GA: "Georgia", HI: "Hawaii", IA: "Iowa", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", MA: "Massachusetts", MD: "Maryland",
  ME: "Maine", MI: "Michigan", MN: "Minnesota", MO: "Missouri", MS: "Mississippi", MT: "Montana",
  NC: "North Carolina", ND: "North Dakota", NE: "Nebraska", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NV: "Nevada", NY: "New York", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VA: "Virginia", VT: "Vermont", WA: "Washington",
  WI: "Wisconsin", WV: "West Virginia", WY: "Wyoming",
};

const BLANK = {
  name: "",
  tradeKey: "",
  // Not ticked. Banking every trade is the bigger, more expensive thing to do
  // and it is chosen deliberately, the same way a source is.
  allTrades: false,
  targetCount: "500",
  // A SET, empty. Not "" and not one preticked box — choosing a source is
  // choosing a licence, and there is deliberately no default.
  discoverySources: [],
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

function count(n) {
  return Number(n || 0).toLocaleString("en-US");
}

function regionLabel(province) {
  return REGION_LABELS[province] || province;
}

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
  const library = data?.library || {};
  const territories = data?.territories || [];

  // The chosen territory, whichever way it was chosen. An existing territory
  // carries its own country and region, and the file selection has to follow
  // it — otherwise picking "Ottawa area" and then a region would produce a
  // campaign whose snapshot and whose territory disagree.
  const chosenTerritory = useMemo(() => {
    if (draft.territoryId) return territories.find((t) => t.id === draft.territoryId) || null;
    if (!draft.country || !draft.province) return null;
    return { country: draft.country, province: draft.province };
  }, [draft.territoryId, draft.country, draft.province, territories]);

  // ── The three numbers on this form, all from the same function the route
  //    uses to build the URLs. A screen with its own arithmetic is a screen
  //    that can promise a count the campaign then does not read.
  const selection = useMemo(
    () =>
      chosenTerritory
        ? snapshotSelection({
            providers: draft.discoverySources,
            country: chosenTerritory.country,
            province: chosenTerritory.province,
            tradeKey: draft.allTrades ? null : draft.tradeKey,
          })
        : null,
    [chosenTerritory, draft.discoverySources, draft.allTrades, draft.tradeKey],
  );

  const tradeTally = useMemo(
    () =>
      chosenTerritory
        ? tradeRowsFor({
            providers: draft.discoverySources,
            country: chosenTerritory.country,
            province: chosenTerritory.province,
          })
        : null,
    [chosenTerritory, draft.discoverySources],
  );

  const countries = useMemo(() => snapshotCountries(), []);
  const regions = useMemo(
    () => snapshotRegions({ country: draft.country, providers: draft.discoverySources }),
    [draft.country, draft.discoverySources],
  );

  const registration = useMemo(
    () => (chosenTerritory ? territoryRegistration(chosenTerritory) : null),
    [chosenTerritory],
  );

  // The backlog, ordered by what each registration unlocks. Built from the
  // calling rules and the measured library — never a second hand-kept list,
  // which is exactly what had already drifted in the creation script somebody
  // ran from a laptop.
  const backlog = useMemo(
    () => outstandingRegistrations({ rowsByRegion: rowsByJurisdiction(jurisdictionKey) }),
    [],
  );

  /**
   * Tick or untick one source.
   *
   * Unticking may leave the chosen region with no file behind it — the region
   * select is filled from what the ticked sources actually cover — so the
   * region is cleared with it rather than left pointing at nothing.
   */
  function toggleSource(key, ticked) {
    setDraft((current) => {
      const chosen = current.discoverySources.filter((k) => k !== key);
      if (ticked) chosen.push(key);
      const stillCovered =
        !current.province ||
        snapshotRegions({ country: current.country, providers: chosen }).some((r) => r.province === current.province);
      return { ...current, discoverySources: chosen, province: stillCovered ? current.province : "" };
    });
  }

  /** Choosing a region fills everything that follows from it. */
  function chooseRegion(province) {
    setDraft((current) => {
      const region = snapshotRegions({ country: current.country, providers: current.discoverySources }).find(
        (r) => r.province === province,
      );
      return {
        ...current,
        province,
        // The territory name is a suggestion, not a lock — it stays editable.
        territoryName: current.territoryName || (province ? `${regionLabel(province)}` : ""),
        // The MEDIAN of that region's own rows. Only offered as a default for
        // the optional circle; an empty centre stays empty, because a centre
        // with no radius matches nothing and inventing both would draw a
        // territory nobody asked for.
        centerLat: current.centerLat || (region?.centre ? String(region.centre.lat) : ""),
        centerLng: current.centerLng || (region?.centre ? String(region.centre.lon) : ""),
      };
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
        body: JSON.stringify({ ...draft, targetCount: Number(draft.targetCount) }),
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

  const fileCount = selection?.fileCount || 0;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Discovery campaigns</h1>
        <p className="text-sm text-muted-foreground">
          Pick the sources, the region and the trade. The snapshot file, its URL and the row count all come
          from the library — nothing here asks you for a URL or a coordinate. “Every trade” widens what
          FieldQuo banks, not what a rep is handed: a rep’s queue is claimed by exact trade either way.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="break-words">{error}</p>
              {problems.length ? (
                <ul className="mt-2 list-disc pl-4 space-y-1">
                  {problems.map((p) => (
                    <li key={p} className="break-words">
                      {p}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── No base URL, no campaign ────────────────────────────────────────
          Said once, plainly, with the one screen that fixes it — instead of a
          URL box on every source, which is what this replaced. A form that let
          a campaign be created here would create one that reads nothing. */}
      {library.configured ? null : (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-900 dark:text-amber-200 space-y-2">
          <p className="font-medium flex items-center gap-2">
            <Database size={16} /> Snapshots are not configured yet.
          </p>
          <p className="break-words">
            The extract is already uploaded — 80 files, 1,320,105 rows. What is missing is the bucket’s public
            base URL, which is set once and used by every campaign. No campaign can be created until it is
            there, because there would be no file for it to read.
          </p>
          <Link href="/platform/sales/snapshots" className={`${BTN} bg-primary text-primary-foreground`}>
            Set the snapshot base URL
          </Link>
        </div>
      )}

      {adding && library.configured ? (
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
              placeholder="Québec painters, September"
            />
          </div>

          {/* ── Sources first, because they decide which regions exist ───── */}
          <fieldset className="space-y-3">
            <legend className={LABEL}>Where the businesses come from</legend>
            <p className="text-xs text-muted-foreground">
              Tick as many as you want — the same business arriving from two of them is flagged rather than
              merged. There is deliberately no default. Choosing a source is choosing a licence, and the
              obvious default is the one whose terms forbid this exact use. Every box states the terms it
              comes with; ticking three takes on three.
            </p>

            {providers.length === 0 ? (
              <p className="text-sm text-muted-foreground">This build ships no discovery sources.</p>
            ) : null}

            {providers.map((p) => {
              const ticked = draft.discoverySources.includes(p.key);
              const blocked = Boolean(p.unavailable);
              const covers = snapshotRegions({ providers: [p.key] });
              const coveredRows = covers.reduce((sum, r) => sum + r.rows, 0);
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

                  {/* What is actually in the bucket for this source. Measured,
                      so a source with nothing uploaded says so rather than
                      offering a region list it cannot fill. */}
                  <p className="text-xs text-muted-foreground break-words">
                    {covers.length
                      ? `In the bucket: ${count(coveredRows)} rows across ${covers.length} region${
                          covers.length === 1 ? "" : "s"
                        } — ${covers.map((r) => r.code).join(", ")}.`
                      : "Nothing for this source has been uploaded to the bucket yet, so it can cover no region."}
                  </p>

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
                </div>
              );
            })}
          </fieldset>

          {/* ── Territory: chosen, never typed ───────────────────────────── */}
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
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.country ? ` (${[t.country, t.province].filter(Boolean).join("-")})` : ""}
                </option>
              ))}
            </select>
          </div>

          {draft.territoryId ? null : (
            <div className="space-y-4 rounded-lg border border-border p-3">
              <div>
                <label className={LABEL} htmlFor="t-country">
                  Country
                </label>
                <select
                  id="t-country"
                  className={FIELD}
                  value={draft.country}
                  onChange={(e) => setDraft({ ...draft, country: e.target.value, province: "" })}
                >
                  <option value="">Choose a country…</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {COUNTRY_LABELS[c.code] || c.code} ({c.code}) — {c.regions} regions, {count(c.rows)} rows
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  The two the uploaded data covers. The code is shown beside the name because it is what every
                  address in the files is filed under.
                </p>
              </div>

              <div>
                <label className={LABEL} htmlFor="t-province">
                  Region
                </label>
                <select
                  id="t-province"
                  className={FIELD}
                  value={draft.province}
                  disabled={!draft.country || !draft.discoverySources.length}
                  onChange={(e) => chooseRegion(e.target.value)}
                >
                  <option value="">
                    {!draft.discoverySources.length
                      ? "Tick a source first…"
                      : !draft.country
                        ? "Choose a country first…"
                        : "Choose a region…"}
                  </option>
                  {regions.map((r) => {
                    const reg = territoryRegistration({ country: r.country, province: r.province });
                    const flag = reg?.required && !reg.done ? " · registration outstanding" : "";
                    return (
                      <option key={r.code} value={r.province}>
                        {regionLabel(r.province)} — {count(r.rows)} rows{flag}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Only regions the ticked sources actually cover. A region with no file behind it is absent
                  rather than offered with a zero.
                </p>
              </div>

              <div>
                <label className={LABEL} htmlFor="t-name">
                  Territory name
                </label>
                <input
                  id="t-name"
                  className={FIELD}
                  value={draft.territoryName}
                  onChange={(e) => setDraft({ ...draft, territoryName: e.target.value })}
                  placeholder="Québec"
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
                  placeholder="Montréal"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Typed, not chosen: the snapshot files are extracted by region, and the library counts rows
                  per region. It holds no per-city count, so a city menu would be a list somebody invented.
                  Leave it empty for the whole region.
                </p>
              </div>

              {/* The circle is still here for the campaigns that want one. It
                  is no longer the only way to say where, and its centre comes
                  from the region's own rows rather than from a map somebody
                  had to open. */}
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
                  Radius in km (optional)
                </label>
                <input
                  id="t-radius"
                  className={FIELD}
                  inputMode="numeric"
                  value={draft.radiusKm}
                  onChange={(e) => setDraft({ ...draft, radiusKm: e.target.value })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave the radius empty and the whole region is the territory. The centre above was filled
                  from the median coordinate of that region’s own rows in the snapshot — not from a city
                  looked up somewhere — so a circle only needs a radius. A centre with no radius matches
                  nothing and a radius with no centre matches everything, so the form refuses half of either.
                </p>
              </div>
            </div>
          )}

          {/* ── Registration, on the region, at the moment it is chosen ──── */}
          {registration?.required && !registration.done ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-medium flex items-center gap-2">
                <ShieldAlert size={16} /> FieldQuo is not registered to make sales calls into{" "}
                {registration.name}.
              </p>
              <p className="break-words text-xs">{registration.what}</p>
              <p className="break-words text-xs">
                The campaign can still be created. It is saved as a draft and cannot be started until the
                registration is done — banking rows here would spend the pipeline on a queue where every
                prospect shows this same warning and nobody may be dialled.
              </p>
            </div>
          ) : null}
          {registration === null && chosenTerritory ? (
            <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
              Nobody has read {chosenTerritory.country}-{chosenTerritory.province}’s telephone solicitation
              law, so no rep will be given a dial link for these rows — the queue refuses what it cannot
              confirm. Rows can still be banked and researched.
            </p>
          ) : null}

          {/* ── Trade, with the real number beside each one ──────────────── */}
          <div>
            <label className={LABEL} htmlFor="c-trade">
              Trade
            </label>
            <select
              id="c-trade"
              className={FIELD}
              value={draft.tradeKey}
              disabled={draft.allTrades}
              onChange={(e) => setDraft({ ...draft, tradeKey: e.target.value })}
            >
              <option value="">Choose a trade…</option>
              {(data?.trades || []).map((t) => {
                const rows = tradeTally?.tally?.[t.key];
                return (
                  <option key={t.key} value={t.key}>
                    {t.label}
                    {tradeTally ? ` — ${count(rows || 0)} in this region` : ""}
                  </option>
                );
              })}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              {draft.allTrades
                ? "Every trade is banked, so nothing is skipped for being the wrong one."
                : "A business whose category maps to a different trade is counted and skipped, never quietly added."}
            </p>

            {/* Ticking this CLEARS the trade rather than keeping it in state.
                A form that still holds "painting" behind a disabled select is a
                form whose payload disagrees with what is on screen, and the
                route refuses a campaign that claims both. */}
            <label className="mt-3 flex items-start gap-3 min-h-[44px] cursor-pointer" htmlFor="c-all-trades">
              <input
                id="c-all-trades"
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0"
                checked={draft.allTrades}
                onChange={(e) => setDraft({ ...draft, allTrades: e.target.checked, tradeKey: "" })}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">Bank every trade</span>
                <span className="block text-xs text-muted-foreground break-words">
                  Painters, roofers, HVAC, plumbers, electricians, paving, flooring, drywall, insulation —
                  every trade the source returns is written, each under its own trade. This does not put
                  anything in the wrong queue: a rep’s queue is claimed by exact trade, so a roofer banked
                  here can only ever be handed to somebody working the roofing queue.
                </span>
              </span>
            </label>
          </div>

          {/* ── The size, before he commits ──────────────────────────────── */}
          {selection && !selection.problems.length ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1 text-sm">
              <p className="font-medium text-foreground break-words">
                {draft.allTrades
                  ? `Every trade, ${regionLabel(chosenTerritory.province)} — ${count(selection.rows)} businesses`
                  : draft.tradeKey
                    ? `${(data?.trades || []).find((t) => t.key === draft.tradeKey)?.label || draft.tradeKey}, ` +
                      `${regionLabel(chosenTerritory.province)} — ${count(selection.tradeRows)} businesses`
                    : `${regionLabel(chosenTerritory.province)} — ${count(selection.rows)} rows in the snapshot`}
              </p>
              {/* "Not known" is not zero. The RBQ register names no trade for
                  anybody, so its rows cannot be counted for or against a trade
                  and saying "0 painters" would be a lie about 54,275 rows. */}
              {selection.tradeUnknownRows && !draft.allTrades ? (
                <p className="text-xs text-muted-foreground break-words">
                  Plus {count(selection.tradeUnknownRows)} rows whose trade is not known — those sources name
                  no trade at all, so how many of them are in this trade cannot be counted here. They are
                  banked and classified when they are read.
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground break-words">
                {count(selection.rows)} rows in {fileCount} file{fileCount === 1 ? "" : "s"} ·{" "}
                {selection.providers.join(" + ")} · release {selection.releases.join(", ")}
              </p>
              {fileCount > 1 ? (
                <p className="text-xs text-muted-foreground break-words">
                  The extract is split at 50,000 rows a file and a campaign reads one file per source, so this
                  creates <span className="font-medium text-foreground">{fileCount} campaigns</span> — same
                  territory, same trade, one per file. Each carries the research budget below, so the
                  promotion cost is {fileCount} × {draft.targetCount || 0}.
                </p>
              ) : null}
            </div>
          ) : null}
          {selection?.problems.length && draft.discoverySources.length && chosenTerritory ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              {selection.problems.map((p) => (
                <p key={p} className="break-words">
                  {p}
                </p>
              ))}
            </div>
          ) : null}

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
              towards the target. It is also the research budget: at most this many of this campaign’s
              prospects are ever promoted into crawling and analysis, which is roughly seven pipeline tasks
              each against about 3,600 a day for the whole platform. Banking is not bounded by it — rows keep
              being written and cost a row each.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              className={`${BTN} bg-primary text-primary-foreground`}
              onClick={create}
              disabled={saving}
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              {saving
                ? "Checking the snapshots…"
                : fileCount > 1
                  ? `Create ${fileCount} campaigns`
                  : "Create campaign"}
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
      ) : library.configured ? (
        <button
          type="button"
          className={`${BTN} bg-primary text-primary-foreground w-full sm:w-auto`}
          onClick={() => setAdding(true)}
        >
          <Plus size={16} /> New campaign
        </button>
      ) : null}

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
                  {/* "All trades" and "Painting" are different campaigns with
                      different costs. A list showing neither makes them look
                      like the same thing. */}
                  <span className="break-words">{c.tradeLabel}</span>
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

      {/* ── What registering next would unlock ──────────────────────────────
          Read from lib/sales/callingRules.js and the measured library, never
          from a second list: a hand-kept copy of "which states are gated" had
          already drifted from the rules it was copied from. */}
      {backlog.length ? (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <ShieldAlert size={16} /> Telemarketer registration outstanding
          </h2>
          <p className="text-xs text-muted-foreground break-words">
            {backlog.length} jurisdiction{backlog.length === 1 ? "" : "s"} require FieldQuo to register before
            the first sales call, and none of them is done. Campaigns in these places can be created but not
            started. Ordered by the rows each one unlocks — the row counts are what is in the bucket today,
            not what the state contains.
          </p>
          <ol className="space-y-2">
            {backlog.map((row) => (
              <li key={row.code} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-foreground break-words">
                  {row.name} — {row.rows ? `${count(row.rows)} rows` : "nothing in the bucket yet"}
                </p>
                {row.what ? <p className="mt-1 text-xs text-muted-foreground break-words">{row.what}</p> : null}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground break-words">
            Flip <span className="font-mono">registration.done</span> in{" "}
            <span className="font-mono">lib/sales/callingRules.js</span> when a certificate is in hand, citing
            the number in the commit. Nothing in this software can know that on its own.
          </p>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Territories are created with a campaign and reused by later ones. Renaming or re-drawing one
        afterwards is not built yet — there is no screen for it, rather than a button that would not work.{" "}
        <Link href="/platform/sales/snapshots" className="underline">
          The snapshot library
        </Link>{" "}
        is where the bucket’s base URL lives.
      </p>
    </div>
  );
}
