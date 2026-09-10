// app/(marketing)/compare/TheCase.js
//
// The argument the comparison pages exist to make.
//
// ══ What these pages were doing instead ═══════════════════════════════════
//
// Printing the competitor's price list. All ten of QuoteIQ's price points,
// cheapest first, as a neutral catalogue — and then, in as many words: "this
// page makes no matched claim in either direction — read their list, read
// ours, and decide."
//
// That is a competitor's pricing page with our logo on it. The reader's eye
// lands on $29.99 beside our $99 and the page is lost before a word of it is
// read. The owner's correction was exact: "the purpose is not to list the
// plans, the purpose is to say look you get all of this from fieldquo for this
// price and the equivalent from the competitor is this much because all the
// other cheaper option don't compare."
//
// ══ Why this is also the more honest page ═════════════════════════════════
//
// A price means nothing except beside the capability it buys. QuoteIQ's
// $29.99 tier cannot build a website, take a booking, or price a job online —
// it is not a competitor to FieldQuo at all, and putting it in the headline
// was a false comparison we were making against OURSELVES. Anchored on
// capability instead, the same page reads: $99 against $699.
//
// ══ The shape is Jobber's, deliberately ═══════════════════════════════════
//
// The owner pointed at getjobber.com/compare/jobber-vs-housecall-pro and said
// it is cleaner than ours and spins Jobber better. It does, and the mechanism
// is worth copying exactly: one criterion per row, the label above the pair,
// two short cells, and THEIR column filled with the brand while the competitor
// sits in flat grey. Nobody reads a dense feature grid; everybody reads
// fourteen rows of two words. The visual weight does the arguing before the
// text is read at all.
//
// ══ On the translator ═════════════════════════════════════════════════════
//
// `t` and `locale` arrive as props from ComparisonPage rather than from a hook,
// so this stays renderable with neither — which is what
// scripts/check-compare-pages.mjs does, and what keeps its assertions English.
// Every t() call carries the literal that used to sit in the JSX.
import Link from "next/link";
import { Check, X, ArrowRight } from "lucide-react";

import { MATRIX_GROUPS } from "@/lib/marketing/featureMatrix";
import { featureEntry, featureGroup } from "@/lib/marketing/featureLabels";
import {
  neverListed,
  shopMath,
  entriesFor,
  parityFor,
  derivationProps,
} from "@/lib/marketing/parity";
import { SEAT_LADDER } from "@/lib/pricing/ladder";
import { caseRows, YES, NO } from "./caseRows";

/** The shop shapes the page prices out — the solo operator, the van-and-a-half,
 *  and the outfit with a crew. Chosen to bracket a real customer.
 *
 *  The label is a KEY plus its English, not a sentence: these three describe
 *  the reader's own business back to them, and a shop of eleven reading "A shop
 *  of eleven" in English under a Spanish heading is the half-translated page
 *  this whole change exists to remove. */
const SHOPS = [
  { estimators: 1, crew: 2, key: "compare.case.shop1", label: "You and two in a van" },
  {
    estimators: 2,
    crew: 4,
    key: "compare.case.shop2",
    label: "Two estimators, four in the field",
  },
  { estimators: 3, crew: 8, key: "compare.case.shop3", label: "A shop of eleven" },
];

const moneyIn = (locale) => (n) =>
  typeof n === "number"
    ? `$${n % 1 === 0 ? n.toLocaleString(locale) : n.toFixed(2)}`
    : null;

/** One cell. `kind` decides the mark, never the colour of the column. */
function Cell({ cell, ours }) {
  if (!cell) return null;
  return (
    <div
      {...(cell.attrs || {})}
      className={`rounded-xl px-4 py-4 h-full ${
        ours
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground border border-border"
      }`}
    >
      <div className="flex items-start gap-2">
        {cell.kind === YES ? (
          <Check size={16} className="shrink-0 mt-1" aria-hidden="true" />
        ) : cell.kind === NO ? (
          <X size={16} className="shrink-0 mt-1 opacity-70" aria-hidden="true" />
        ) : null}
        <div className="min-w-0">
          <div className="font-semibold leading-snug break-words">{cell.text}</div>
          {cell.sub ? (
            <div
              className={`text-xs mt-1 leading-snug break-words ${
                ours ? "opacity-80" : "text-muted-foreground"
              }`}
            >
              {cell.sub}
            </div>
          ) : null}
          {/* The provenance of a figure nobody published. Rendered as its own
              line rather than folded into `sub`, because it is the sentence
              competitors.js requires beside a reported band and a cell whose
              sub is a two-word label must still be able to carry it. */}
          {cell.foot ? (
            <div
              className={`text-[11px] mt-2 leading-snug break-words ${
                ours ? "opacity-70" : "text-muted-foreground/80"
              }`}
            >
              {cell.foot}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function TheCase({ competitor, t, locale = "en-CA", asOf = null }) {
  const id = competitor?.id;
  if (!id) return null;

  const money = moneyIn(locale);
  const say = (key, fallback, values) =>
    typeof t === "function"
      ? t(key, fallback, values)
      : String(fallback).replace(/\{(\w+)\}/g, (m, name) =>
          values?.[name] !== undefined ? String(values[name]) : m,
        );

  const { rows, missingCount, hasPrices } = caseRows(id, competitor.name, t, locale, asOf);
  if (!rows.length) return null;

  const parity = parityFor(id, { asOf });
  const missing = neverListed(id, asOf);
  const solo = SEAT_LADDER[0];

  return (
    <div className="bg-card border-b border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-20">
        {/* ── The claim ────────────────────────────────────────────────── */}
        <section className="text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary border border-primary/30 rounded-full px-3 py-1">
            {say("compare.case.eyebrow", "Side by side")}
          </span>
          <h2 className="mt-5 text-3xl sm:text-5xl font-bold text-foreground leading-[1.1] max-w-4xl mx-auto">
            {/* Two keys per headline rather than one with a <br /> inside it:
                the line break is a layout decision and a sentence with markup
                in the middle cannot be re-ordered by a language that needs to. */}
            {parity.tier && typeof parity.tier.price === "number" ? (
              <>
                {say("compare.case.headlineOurs", "Everything FieldQuo does costs {price}.", {
                  price: money(solo.price),
                })}
                <br className="hidden sm:block" />{" "}
                {parity.tier.annualOnly
                  ? // Their unit, not a month we worked out for them. The
                    // headline is the one sentence a visitor certainly reads,
                    // and the strongest true thing about an annual-only vendor
                    // is the size of the cheque, not a monthly they do not sell.
                    say(
                      "compare.case.headlineTheirsAnnual",
                      "At {competitor} the same list is {price} a year.",
                      { competitor: competitor.name, price: money(parity.tier.annualTotal) },
                    )
                  : say(
                      "compare.case.headlineTheirs",
                      "At {competitor} the same list is {price}.",
                      { competitor: competitor.name, price: money(parity.tier.price) },
                    )}
              </>
            ) : (
              <>
                {say("compare.case.headlineNoPricesOurs", "FieldQuo publishes every price.")}
                <br className="hidden sm:block" />{" "}
                {say("compare.case.headlineNoPricesTheirs", "{competitor} publishes none.", {
                  competitor: competitor.name,
                })}
              </>
            )}
          </h2>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
            {say(
              "compare.case.sub",
              "We don’t sell features by the tier. Every plan has every feature — the plans differ only by how many people are on them.",
            )}
          </p>
        </section>

        {/* ── The head-to-head ─────────────────────────────────────────── */}
        <section>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sticky top-0 z-10 bg-card py-3">
            <div className="rounded-xl bg-primary text-primary-foreground px-4 py-3 text-center font-bold tracking-tight">
              FieldQuo
            </div>
            <div className="rounded-xl bg-muted border border-border px-4 py-3 text-center font-semibold text-muted-foreground">
              {competitor.name}
            </div>
          </div>

          <div className="space-y-6 mt-2">
            {rows.map((r) => (
              <div key={r.label}>
                <div className="text-sm font-medium text-muted-foreground mb-2 break-words">
                  {r.label}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 items-stretch">
                  <Cell cell={r.mine} ours />
                  <Cell cell={r.theirs} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl bg-primary text-primary-foreground p-8 text-center">
            <p className="text-xl sm:text-2xl font-bold">
              {say(
                missingCount === 1
                  ? "compare.case.missingOne"
                  : "compare.case.missing",
                missingCount === 1
                  ? "{count} more thing {competitor} doesn’t offer at any price."
                  : "{count} more things {competitor} doesn’t offer at any price.",
                { count: missingCount, competitor: competitor.name },
              )}
            </p>
            <p className="mt-2 opacity-85">
              {say("compare.case.missingBody", "All of them are in the {plan} plan at {price}.", {
                plan: solo.label,
                price: money(solo.price),
              })}
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 bg-background text-foreground px-6 py-3 rounded-full text-sm font-semibold transition hover:brightness-110"
            >
              {say("compare.ctaButton", "Start your free month")}{" "}
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        {/* ── What it costs a real shop ────────────────────────────────── */}
        {hasPrices ? (
          <section>
            <h3 className="text-2xl sm:text-3xl font-bold text-foreground text-center">
              {say("compare.case.shopTitle", "What it costs for a shop like yours")}
            </h3>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto text-center">
              {say(
                "compare.case.shopIntro",
                "{competitor} bills every login. We bill the people who price work; everybody in a van is crew, at no charge. That gap grows with every person you hire.",
                { competitor: competitor.name },
              )}
            </p>

            <div className="mt-8 space-y-4">
              {SHOPS.map((shop) => {
                const m = shopMath(shop, id, asOf);
                if (!m.fieldquo || !m.competitor) return null;
                const wins = typeof m.savesPerYear === "number" && m.savesPerYear > 0;
                return (
                  <div
                    key={shop.label}
                    // The working, declared. Both prices this saving was
                    // computed from are printed inside this box, which is what
                    // makes the derived figure checkable by a reader with a
                    // phone and by scripts/check-compare-pages.mjs with the
                    // published set. See lib/marketing/parity.js.
                    {...(wins ? derivationProps(m.saving) : {})}
                    className="rounded-2xl border border-border p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">
                        {say(shop.key, shop.label)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {say(
                          "compare.case.shopSplit",
                          "{estimators} pricing work · {crew} in the field",
                          { estimators: shop.estimators, crew: shop.crew },
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-5 sm:gap-8">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">FieldQuo</div>
                        <div className="text-xl font-bold text-foreground tabular-nums">
                          {money(m.fieldquo.price)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">{competitor.name}</div>
                        <div className="text-xl font-bold text-muted-foreground tabular-nums">
                          {money(m.competitor.price)}
                        </div>
                      </div>
                      <div className="text-right min-w-[7rem]">
                        {wins ? (
                          <>
                            <div className="text-xs text-muted-foreground">
                              {say("compare.case.youKeep", "you keep")}
                            </div>
                            <div className="text-xl font-bold text-primary tabular-nums">
                              {say("compare.rows.perYr", "{amount}/yr", {
                                amount: money(m.savesPerYear),
                              })}
                            </div>
                          </>
                        ) : (
                          // Where we lose, said plainly. See the header.
                          <div className="text-xs text-muted-foreground">
                            {say("compare.case.cheaperThere", "Cheaper there at one person.")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Split at the link rather than interpolated around it: a
                {placeholder} cannot carry an <a>, and a language that needs the
                link in a different position gets both halves to move. */}
            <p className="mt-5 text-sm text-muted-foreground text-center">
              {say("compare.case.calcBefore", "Put your own numbers in on the")}{" "}
              <Link href="/cost" className="text-primary font-medium hover:underline">
                {say("compare.case.calcLink", "cost calculator")}
              </Link>{" "}
              {say("compare.case.calcAfter", "and see all five side by side.")}
            </p>
          </section>
        ) : null}

        {/* ── The whole product ────────────────────────────────────────── */}
        <section>
          <h3 className="text-2xl sm:text-3xl font-bold text-foreground text-center">
            {say("compare.case.wholeTitle", "Everything you get, in every plan")}
          </h3>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto text-center">
            {say(
              "compare.case.wholeIntro",
              "Not a highlight reel — the whole product, and whether it appears anywhere in {competitor}’s plans.",
              { competitor: competitor.name },
            )}
          </p>

          <div className="mt-10 space-y-12">
            {MATRIX_GROUPS.map((group) => {
              const rowsForGroup = entriesFor([...parity.covered, ...parity.missing]).filter(
                (e) => e.group === group.key,
              );
              if (!rowsForGroup.length) return null;
              return (
                <div key={group.key}>
                  <h4 className="text-lg font-bold text-foreground">
                    {featureGroup(group.key, t).label}
                  </h4>
                  <ul className="mt-4 divide-y divide-border border-t border-border">
                    {rowsForGroup.map((e) => {
                      const theirs = parity.covered.includes(e.key);
                      // The matrix's own name and summary, said in the reader's
                      // language. parity.js hands back the English entry; this
                      // is the one place allowed to turn a key into words.
                      const said = featureEntry(e.key, t) ?? e;
                      return (
                        <li
                          key={e.key}
                          className="py-3 flex items-baseline justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <span className="font-medium text-foreground">{said.name}</span>
                            <span className="text-muted-foreground text-sm">
                              {" "}
                              — {said.summary}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs font-medium">
                            {theirs ? (
                              <span className="text-muted-foreground">
                                {say("compare.case.both", "Both")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1">
                                {say("compare.case.only", "FieldQuo only")}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
