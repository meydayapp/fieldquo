// app/(marketing)/cost/CostReport.js
//
// Everything on /cost that is not a form field. All of the arithmetic and
// every coefficient live in lib/marketing/costCompare.js; this file decides
// only what is on the screen.
//
// ══ Why `t` is a prop with an English default ══════════════════════════════
//
// Same device as ../compare/AddOnStack.js, for the same two reasons. The
// calculator itself is a client component (it recomputes as you type) and gets
// the real t() out of React context; this component takes t as a prop so
// scripts/check-cost-compare.mjs can render the real thing with
// renderToStaticMarkup and no provider to stand up. The default resolves each
// key to the English fallback written at the call site, which is exactly what
// t() itself would do on a language with no entry.
//
// ══ The data attributes are load-bearing ═══════════════════════════════════
//
// Every row carries `data-cost-row` and `data-cost-status`, the caveat blocks
// carry `data-crew-caveat` and `data-concessions`, and every figure carries
// `data-annual` or `data-band`. They exist so the check can assert ABOUT A ROW
// rather than about the page as a flat string — the same argument
// ../compare/[slug]/ComparisonPage.js makes, and it holds harder here, because
// two competitors can publish the same number for different things.
//
// ══ What this file may never do ════════════════════════════════════════════
//
//   • print an amount from a row the module did not price. A row with no figure
//     renders its REASON, never a blank and never a number;
//   • render a reported band as a single number. `ScaledBand.valueOf()` throws,
//     so the only way to print one is `String(band)`, which carries its label;
//   • render the comparison rows without the crew caveat and the concessions.
//     That is not a rule this file keeps — `comparison.rows` throws until both
//     have been read, and deleting either block below makes the page fail to
//     render at all;
//   • colour a row green or red on colour alone. Every colour is paired with a
//     word, because a red number and a green number are the same number to
//     somebody who cannot tell them apart.
//
// ══ The colours, measured ══════════════════════════════════════════════════
//
// The owner asked for the cheapest figure in green and the rest in red. Neither
// Tailwind shade clears 4.5:1 in both themes, so each is a pair, and the ratios
// were computed rather than eyeballed (AGENTS.md failure class 6). Against
// --card and --muted in both themes:
//
//   emerald-700  5.48 / 4.92 light        emerald-400  8.78 / 7.59 dark
//   red-700      6.47 / 5.80 light        red-400      6.10 / 5.27 dark
//
// The single-shade versions fail: emerald-600 is 3.77 on a light card and
// emerald-700 is 3.08 on a dark one. scripts/check-cost-compare.mjs recomputes
// all four against the tokens in app/globals.css.

import Link from "next/link";
import { Check, ExternalLink, Info, Minus, X as XIcon } from "lucide-react";

import {
  BASES,
  BASIS_CAPABILITY,
  BASIS_CHEAPEST,
  COST_ASSUMPTIONS,
  COUNTING_RULES,
  ROW_NOT_ESTABLISHED,
  ROW_PRICED,
  ROW_REPORTED,
  cheapestOf,
  formatAmount,
  money,
  savingAgainst,
} from "@/lib/marketing/costCompare";

/** The fallback translator: interpolates the same {placeholder} syntax the real
 *  t() does, so a call site reads identically on both surfaces. */
const englishOnly = (key, fallback, values) =>
  values
    ? String(fallback).replace(/\{(\w+)\}/g, (m, name) =>
        values[name] !== undefined ? String(values[name]) : m,
      )
    : fallback;

// Measured pairs. Named once so the check can find them and so a later edit
// changes both surfaces at the same time.
const CHEAPEST_INK = "text-emerald-700 dark:text-emerald-400";
const DEARER_INK = "text-red-700 dark:text-red-400";

const BASIS_NOTE = {
  arithmetic: "A definition",
  judgement: "Our judgement",
};

function SourceLink({ href, children }) {
  return (
    <a
      href={href}
      // rel is not decoration: noopener is the security default and nofollow
      // keeps us from handing a competitor ranking for being compared.
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
    >
      {children}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

/**
 * One competitor's figure, or the sentence saying why there is not one.
 *
 * A band is rendered through String(), which is the only way it CAN be
 * rendered: ScaledBand.valueOf() throws, so `{row.band}` in a template would
 * take the page down rather than print an end of it.
 */
function Figure({ row, t, tone }) {
  if (row.status === ROW_PRICED) {
    return (
      <div className={`text-right font-semibold tabular-nums ${tone}`} data-annual={row.annualFirstYear}>
        <div>{money(row.annualFirstYear, row.currency)}</div>
        <div className="text-xs font-normal text-muted-foreground">
          {t("cost.perYear", "a year")} ·{" "}
          {money(row.annualFirstYear / COST_ASSUMPTIONS[0].value, row.currency)}{" "}
          {t("cost.perMonth", "a month")}
        </div>
      </div>
    );
  }
  if (row.status === ROW_REPORTED) {
    return (
      <div className="text-right text-sm text-foreground" data-band={String(row.band)}>
        {/* Never coloured. A band has no single value, so calling it cheapest
            or dearest by one of its ends is the midpoint mistake with an extra
            step — the module refuses to rank it and this refuses to tint it. */}
        <div className="font-semibold">{String(row.band)}</div>
        {row.ongoingBand ? (
          <div className="mt-1 text-xs font-normal text-muted-foreground">
            {t("cost.thenEachYear", "then")} {String(row.ongoingBand)}
          </div>
        ) : null}
      </div>
    );
  }
  return null;
}

function Row({ row, t, cheapestKey }) {
  const priced = row.status === ROW_PRICED;
  const isCheapest = priced && row.key === cheapestKey;
  const tone = priced ? (isCheapest ? CHEAPEST_INK : DEARER_INK) : "";

  return (
    <li
      data-cost-row={row.key}
      data-cost-status={row.status}
      data-cost-cheapest={isCheapest ? "true" : "false"}
      className="p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-[16rem]">
          <div className="font-semibold text-foreground">
            {row.name}
            {row.tier ? (
              <span className="ml-2 font-normal text-muted-foreground">{row.tier.label}</span>
            ) : null}
            {/* Never colour alone. The word is the accessible half of the
                owner's green-and-red, and it is also the half that survives a
                printout. */}
            {priced ? (
              <span className={`ml-2 text-xs font-semibold uppercase tracking-wide ${tone}`}>
                {isCheapest
                  ? t("cost.badgeCheapest", "cheapest")
                  : t("cost.badgeDearer", "dearer")}
              </span>
            ) : null}
          </div>

          {/* What unit they price, and how many of your people it counted.
              This is the whole argument of the page and it sits on every row
              rather than in a footnote. */}
          {row.unit ? (
            <div className="mt-1 text-sm text-muted-foreground" data-cost-unit={row.unit.key}>
              {row.unit.label}
              {row.counting ? (
                <>
                  {" — "}
                  {t("cost.counted", "counted {n} of your people ({who})", {
                    n: row.countedHere,
                    who: row.counting.label,
                  })}
                </>
              ) : null}
            </div>
          ) : null}

          {row.coordinate ? (
            <div className="mt-1 text-sm text-muted-foreground">{row.coordinate}</div>
          ) : null}
          {row.seatsIncluded ? (
            <div className="mt-1 text-sm text-muted-foreground">
              {t("cost.usersIncluded", "{n} users included", { n: row.seatsIncluded })}
            </div>
          ) : null}

          {/* A row with no figure says why, in full. competitors.js is explicit
              that a labelled absence beats a blank cell and beats a number. */}
          {row.reason ? (
            <p
              className="mt-2 text-sm text-muted-foreground"
              data-cost-reason="true"
            >
              {row.reason}
            </p>
          ) : null}
        </div>

        <Figure row={row} t={t} tone={tone} />
      </div>

      {/* The unit's own caveat, from lib/marketing/competitors.js, on every row
          whether or not it carries a number. It is the sentence that keeps a
          headcount comparison honest. */}
      {row.unitCaveat ? (
        <p
          className="mt-3 text-sm text-muted-foreground border-l-2 border-border pl-3"
          data-cost-unit-caveat={row.key}
        >
          {row.unitCaveat}
        </p>
      ) : null}

      {row.geoCaveat ? (
        <p className="mt-2 text-sm text-muted-foreground" data-cost-geo-caveat={row.key}>
          <Info size={14} className="inline align-[-2px] mr-1" aria-hidden="true" />
          {row.geoCaveat}
        </p>
      ) : null}

      {row.caveats.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {row.caveats.map((c) => (
            <li key={c} className="text-sm text-muted-foreground flex gap-2">
              <Minus size={14} className="shrink-0 mt-1" aria-hidden="true" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 text-xs text-muted-foreground">
        {row.provenance}
        {row.source ? (
          <>
            {" · "}
            <SourceLink href={row.source}>
              {t("cost.theirPage", "their pricing page")}
            </SourceLink>
          </>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The sentence the owner asked for: "You'd save $8,600/month, that's
 * $103,200/year back in your pocket."
 *
 * With two differences he will recognise as improvements rather than hedging.
 * A reported band produces a band — "somewhere between" — because ServiceTitan
 * publishes nothing and a single number there would be invented. And where a
 * competitor is CHEAPER the sentence says so in their favour, which is the
 * half that makes the other half believable.
 */
function Verdict({ row, fieldquo, t }) {
  const saving = savingAgainst(row, fieldquo.annualAtMonthly);
  if (!saving) return null;

  if (saving.direction === "fieldquo" && saving.fixed !== null) {
    return (
      <p className="text-foreground" data-verdict={row.key} data-verdict-direction="fieldquo">
        {t(
          "cost.savingSentence",
          "Against {competitor} you would save ${monthly} a month — that is ${annual} a year back in your pocket.",
          {
            competitor: row.name,
            monthly: formatAmount(saving.fixedMonthly),
            annual: formatAmount(saving.fixed),
          },
        )}
      </p>
    );
  }

  if (saving.direction === "fieldquo" && saving.band) {
    return (
      <p className="text-foreground" data-verdict={row.key} data-verdict-direction="fieldquo">
        {t(
          "cost.savingBandSentence",
          "Against what contractors report paying {competitor}, you would save {band} — and none of that is a figure {competitor} publishes, so it is a range and stays one.",
          { competitor: row.name, band: String(saving.band) },
        )}
      </p>
    );
  }

  if (saving.direction === "competitor") {
    return (
      <p className="text-foreground" data-verdict={row.key} data-verdict-direction="competitor">
        {saving.fixed !== null
          ? t(
              "cost.competitorCheaper",
              "{competitor} is cheaper than we are at your size — by ${annual} a year. If what they include is all you need, they are the better buy and we would rather you knew.",
              { competitor: row.name, annual: formatAmount(saving.fixed) },
            )
          : t(
              "cost.competitorCheaperBand",
              "{competitor} comes out cheaper than we do at your size on every figure buyers report.",
              { competitor: row.name },
            )}
      </p>
    );
  }

  if (saving.direction === "unclear") {
    return (
      <p className="text-muted-foreground" data-verdict={row.key} data-verdict-direction="unclear">
        {t(
          "cost.savingUnclear",
          "The band contractors report for {competitor} straddles our price, so there is no honest answer to which is cheaper. Picking the end that suits us would be exactly the thing this page refuses to do.",
          { competitor: row.name },
        )}
      </p>
    );
  }

  return null;
}

/**
 * One basis: the caveats, then the rows.
 *
 * ══ The order of the JSX below is load-bearing ═════════════════════════════
 *
 * `comparison.rows` throws until `comparison.crewCapability` and
 * `comparison.concessions` have both been read, and the only places they are
 * read are inside the two blocks that render them. Delete either block and the
 * page does not render a slightly worse comparison — it does not render.
 *
 * That is deliberate and it is the only mechanism available from inside a pure
 * module: a comment asking a template to keep an inconvenient paragraph is a
 * convention, and conventions are what a template in a hurry drops.
 */
function BasisSection({ basisKey, comparison, fieldquo, t }) {
  const meta = BASES[basisKey];
  if (comparison.count === 0) return null;

  return (
    <section className="mt-12" data-cost-basis={basisKey}>
      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold text-foreground">
          {t(`cost.basis.${basisKey}.title`, meta.title)}
        </h2>
        <p className="mt-3 text-muted-foreground">
          {t(`cost.basis.${basisKey}.intro`, meta.intro)}
        </p>
      </div>

      {/* ── Disclosure one: what crew can and cannot do ──────────────────────
          Reading `comparison.crewCapability` here is what unlocks the rows
          below. Both halves are printed: the advantage and the limit, which
          lib/marketing/competitors.js records as a deliberate pair. */}
      <div
        className="mt-6 rounded-2xl border border-border bg-muted p-5 sm:p-6"
        data-crew-caveat={basisKey}
      >
        <p className="font-semibold text-foreground">
          {t("cost.crewCaveat.headline", comparison.crewCapability.headline)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className={`font-medium ${CHEAPEST_INK}`}>
            {comparison.crewCapability.advantage}
          </span>{" "}
          — {comparison.crewCapability.can}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className={`font-medium ${DEARER_INK}`}>
            {comparison.crewCapability.limit}
          </span>{" "}
          — {comparison.crewCapability.cannot}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{comparison.crewCapability.scope}</p>
      </div>

      {/* ── Disclosure two: what we do not do at all ─────────────────────────
          Driven by FIELDQUO_LACKS, so the day we ship one of these the card
          disappears on its own rather than being remembered. It would be a
          strange kind of honesty to match tiers on what they contain and then
          go quiet about the things ours does not. */}
      <div className="mt-6" data-concessions={basisKey}>
        <h3 className="text-sm font-semibold text-foreground">
          {t(
            "cost.concessionsTitle",
            "Before the numbers: what FieldQuo does not do",
          )}
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {comparison.concessions.map((c) => (
            <div
              key={c.capability}
              data-lacks={c.capability}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="flex items-start gap-2">
                <XIcon size={16} className={`shrink-0 mt-0.5 ${DEARER_INK}`} aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">{c.label}</span>
              </div>
              {c.theirs.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {c.theirs.map((th) => (
                    <li key={th.competitor} className="text-xs text-muted-foreground">
                      {th.competitor}: “{th.claim}”.{" "}
                      <SourceLink href={th.source}>
                        {t("cost.readOnTheirSite", "Read on their site {date}", {
                          date: th.checked,
                        })}
                      </SourceLink>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t(
                    "cost.concessionUnmatched",
                    "Nobody in this comparison was verified as having it either — which is not the same as their not having it.",
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── And only now the rows ──────────────────────────────────────── */}
      <RowList comparison={comparison} fieldquo={fieldquo} t={t} basisKey={basisKey} />
    </section>
  );
}

function RowList({ comparison, fieldquo, t, basisKey }) {
  const rows = comparison.rows;
  const cheapest = cheapestOf(rows, fieldquo);
  const cheapestKey = cheapest ? cheapest.key : null;

  return (
    <>
      <ul className="mt-6 divide-y divide-border border border-border rounded-2xl bg-card overflow-hidden">
        {/* Our own row first, and priced by exactly the same rule as theirs. */}
        <li
          data-cost-row="fieldquo"
          data-cost-status={fieldquo.fits ? ROW_PRICED : ROW_NOT_ESTABLISHED}
          data-cost-cheapest={cheapestKey === "fieldquo" ? "true" : "false"}
          className="p-4 sm:p-5 bg-muted"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-[16rem]">
              <div className="font-semibold text-foreground">
                FieldQuo
                {fieldquo.fits ? (
                  <span className="ml-2 font-normal text-muted-foreground">{fieldquo.label}</span>
                ) : null}
                {fieldquo.fits ? (
                  <span
                    className={`ml-2 text-xs font-semibold uppercase tracking-wide ${
                      cheapestKey === "fieldquo" ? CHEAPEST_INK : DEARER_INK
                    }`}
                  >
                    {cheapestKey === "fieldquo"
                      ? t("cost.badgeCheapest", "cheapest")
                      : t("cost.badgeDearer", "dearer")}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-sm text-muted-foreground" data-cost-unit={fieldquo.unit.key}>
                {fieldquo.unit.label} —{" "}
                {t("cost.counted", "counted {n} of your people ({who})", {
                  n: fieldquo.countedSeats,
                  who: fieldquo.counting.label,
                })}
              </div>
              {fieldquo.fits ? (
                <div className="mt-1 text-sm text-muted-foreground">
                  {t(
                    "cost.fieldquoIncludes",
                    "{seats} seats and {crew} crew included — {people} people in total",
                    {
                      seats: fieldquo.includedSeats,
                      crew: fieldquo.includedCrew,
                      people: fieldquo.includedSeats + fieldquo.includedCrew,
                    },
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground" data-cost-reason="true">
                  {t(
                    "cost.fieldquoNoFit",
                    "Our published plans stop at {seats} people who quote and {crew} crew — {people} people in total — and you are past that. There is no price on the list to compare against and we are not going to invent one.",
                    {
                      seats: fieldquo.ceiling.seats,
                      crew: fieldquo.ceiling.crew,
                      people: fieldquo.ceiling.people,
                    },
                  )}{" "}
                  <Link href="/contact" className="underline text-foreground">
                    {t("cost.talkToUs", "Talk to us")}
                  </Link>
                  .
                </p>
              )}
            </div>
            {fieldquo.fits ? (
              <div
                className={`text-right font-semibold tabular-nums ${
                  cheapestKey === "fieldquo" ? CHEAPEST_INK : DEARER_INK
                }`}
                data-annual={fieldquo.annualAtMonthly}
              >
                <div>${formatAmount(fieldquo.annualAtMonthly)}</div>
                <div className="text-xs font-normal text-muted-foreground">
                  {t("cost.perYear", "a year")} · ${formatAmount(fieldquo.monthly)}{" "}
                  {t("cost.perMonth", "a month")}
                </div>
              </div>
            ) : null}
          </div>
          {fieldquo.fits ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {t(
                "cost.fieldquoCommitted",
                "Twelve uncommitted months, which is what most people pay. Committing to a year is ${annual} — pay for {payFor}, get {months}. The committed price is deliberately NOT the number compared above.",
                {
                  annual: formatAmount(fieldquo.annualCommitted),
                  payFor: fieldquo.payForMonths,
                  months: fieldquo.monthsPerYear,
                },
              )}
            </p>
          ) : null}
        </li>

        {rows.map((row) => (
          <Row key={row.key} row={row} t={t} cheapestKey={cheapestKey} />
        ))}
      </ul>

      {/* ── The verdict, and how thin the field was ──────────────────────
          A basis where every competitor row said "not established" is a
          walkover against an empty table, and announcing a win on one would be
          the most flattering and least honest thing this page could do. */}
      <div className="mt-5 space-y-2" data-cost-verdicts={basisKey}>
        {cheapest && cheapest.competitorsRanked === 0 ? (
          <p className="text-muted-foreground">
            {t(
              "cost.noRivalsPriced",
              "Nobody else could be priced on this basis at your size, so there is no comparison to draw here — only the reasons above. That is a gap in what we have read, not a claim about them.",
            )}
          </p>
        ) : null}
        {fieldquo.fits
          ? rows.map((row) => <Verdict key={row.key} row={row} fieldquo={fieldquo} t={t} />)
          : null}
      </div>
    </>
  );
}

export default function CostReport({ result, t = englishOnly }) {
  if (!result.ready) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
        <p className="font-medium text-foreground">
          {t("cost.noFigureYet", "No figures yet.")}
        </p>
        <p className="mt-2 text-sm">
          {result.outOfRange.length
            ? t(
                "cost.outOfRange",
                "One of the answers above is outside what we can read. Nothing is priced from a number we had to invent.",
              )
            : t(
                "cost.fillIn",
                "Answer the two questions above and every company's price appears here. We will not show you a number built on answers you have not given.",
              )}
        </p>
      </div>
    );
  }

  const { people, fieldquo } = result;

  return (
    <div>
      {/* ── What we made of your answers ──────────────────────────────── */}
      <div className="mt-8 rounded-2xl border border-border p-5 sm:p-6" data-cost-people>
        <p className="text-foreground">
          {t(
            "cost.peopleSummary",
            "{total} people: {seats} who quote, schedule or invoice, and {crew} in the field. Every company below turns that into a different number, and the column beside each one says which.",
            { total: people.total, seats: people.officeSeats, crew: people.fieldCrew },
          )}
        </p>
      </div>

      <BasisSection
        basisKey={BASIS_CAPABILITY}
        comparison={result.bases[BASIS_CAPABILITY]}
        fieldquo={fieldquo}
        t={t}
      />
      <BasisSection
        basisKey={BASIS_CHEAPEST}
        comparison={result.bases[BASIS_CHEAPEST]}
        fieldquo={fieldquo}
        t={t}
      />

      {/* ── How each company counts people ─────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-foreground">
          {t("cost.countingTitle", "How each company counts your people")}
        </h2>
        <p className="mt-3 text-muted-foreground max-w-3xl">
          {t(
            "cost.countingIntro",
            "This is the whole comparison in one table. Nobody on this page charges for the same thing, and a calculator that pretends otherwise looks rigorous while comparing nothing.",
          )}
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-xl overflow-hidden">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3 font-medium text-foreground">
                  {t("cost.countingCol1", "Whose headcount")}
                </th>
                <th className="p-3 font-medium text-foreground">
                  {t("cost.countingCol2", "What this page counts")}
                </th>
                <th className="p-3 font-medium text-foreground">
                  {t("cost.countingCol3", "Why")}
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.values(COUNTING_RULES).map((rule) => (
                <tr key={rule.mapsTo} className="border-t border-border align-top">
                  <td className="p-3 text-foreground font-medium">{rule.mapsTo}</td>
                  <td className="p-3 text-foreground">
                    {rule.label} — {rule.count(people)}
                  </td>
                  <td className="p-3 text-muted-foreground">{rule.reasoning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── The three numbers that are ours ────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-foreground">
          {t("cost.assumptionsTitle", "Every number on this page that is ours")}
        </h2>
        <p className="mt-3 text-muted-foreground max-w-3xl">
          {t(
            "cost.assumptionsIntro",
            "There are three, and they are below with their reasoning. Everything else is a price somebody published or a band buyers report, read out of one module with a source, a date and the country it was read from against every figure.",
          )}
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-xl overflow-hidden">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3 font-medium text-foreground">
                  {t("cost.assumptionCol1", "What it is")}
                </th>
                <th className="p-3 font-medium text-foreground">
                  {t("cost.assumptionCol2", "Value")}
                </th>
                <th className="p-3 font-medium text-foreground">
                  {t("cost.assumptionCol3", "Why that value")}
                </th>
              </tr>
            </thead>
            <tbody>
              {COST_ASSUMPTIONS.map((row) => (
                <tr key={row.key} className="border-t border-border align-top" data-assumption={row.key}>
                  <td className="p-3">
                    <p className="text-foreground font-medium">{row.label}</p>
                    <p className="mt-1 text-muted-foreground">{row.represents}</p>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <p className="text-foreground font-semibold tabular-nums">{row.display}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{BASIS_NOTE[row.basis]}</p>
                  </td>
                  <td className="p-3 text-muted-foreground">{row.reasoning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-8 text-sm text-muted-foreground max-w-3xl" data-currency-note>
        {result.currencyNote}
      </p>
      <p className="mt-2 text-sm text-muted-foreground max-w-3xl" data-as-of={result.asOf}>
        <Info size={14} className="inline align-[-2px] mr-1" aria-hidden="true" />
        {t(
          "cost.asOf",
          "Prepared as of {date}. Every figure carries the day it was read and the country it was read from, and a figure nobody has re-read in ninety days stops appearing on its own.",
          { date: result.asOf },
        )}{" "}
        <Link href="/compare" className="underline text-foreground">
          {t("cost.seeCompare", "The full side-by-side is on /compare")}
        </Link>
        .
      </p>

      <div className="mt-10 rounded-2xl border border-border p-6 sm:p-8 text-center">
        <p className="text-foreground font-medium">
          {t("cost.ctaTitle", "The honest way to check any of this is on your own jobs.")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("cost.ctaBody", "The first month is free, and there is no contract.")}
        </p>
        <Link
          href="/signup"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          <Check size={16} aria-hidden="true" />
          {t("cost.ctaButton", "Start free")}
        </Link>
      </div>
    </div>
  );
}

export { CHEAPEST_INK, DEARER_INK, englishOnly };
