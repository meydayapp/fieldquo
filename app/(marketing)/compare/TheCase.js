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
import Link from "next/link";
import { Check, X, ArrowRight } from "lucide-react";

import { MATRIX_GROUPS } from "@/lib/marketing/featureMatrix";
import { neverListed, shopMath, entriesFor, parityFor } from "@/lib/marketing/parity";
import { SEAT_LADDER } from "@/lib/pricing/ladder";
import { caseRows, YES, NO } from "./caseRows";

/** The shop shapes the page prices out — the solo operator, the van-and-a-half,
 *  and the outfit with a crew. Chosen to bracket a real customer. */
const SHOPS = [
  { estimators: 1, crew: 2, label: "You and two in a van" },
  { estimators: 2, crew: 4, label: "Two estimators, four in the field" },
  { estimators: 3, crew: 8, label: "A shop of eleven" },
];

const money = (n) =>
  typeof n === "number" ? `$${n % 1 === 0 ? n.toLocaleString("en-CA") : n.toFixed(2)}` : null;

/** One cell. `kind` decides the mark, never the colour of the column. */
function Cell({ cell, ours }) {
  if (!cell) return null;
  return (
    <div
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
        </div>
      </div>
    </div>
  );
}

export default function TheCase({ competitor }) {
  const id = competitor?.id;
  if (!id) return null;

  const { rows, missingCount, hasPrices } = caseRows(id, competitor.name);
  if (!rows.length) return null;

  const parity = parityFor(id);
  const missing = neverListed(id);
  const solo = SEAT_LADDER[0];

  return (
    <div className="bg-card border-b border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-20">
        {/* ── The claim ────────────────────────────────────────────────── */}
        <section className="text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary border border-primary/30 rounded-full px-3 py-1">
            Side by side
          </span>
          <h2 className="mt-5 text-3xl sm:text-5xl font-bold text-foreground leading-[1.1] max-w-4xl mx-auto">
            {parity.tier && typeof parity.tier.price === "number" ? (
              <>
                Everything FieldQuo does costs {money(solo.price)}.
                <br className="hidden sm:block" /> At {competitor.name} the same
                list is {money(parity.tier.price)}.
              </>
            ) : (
              <>
                FieldQuo publishes every price.
                <br className="hidden sm:block" /> {competitor.name} publishes
                none.
              </>
            )}
          </h2>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
            We don&apos;t sell features by the tier. Every plan has every feature —
            the plans differ only by how many people are on them.
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
              {missingCount} more things {competitor.name} doesn&apos;t offer at
              any price.
            </p>
            <p className="mt-2 opacity-85">
              All of them are in the {solo.label} plan at {money(solo.price)}.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 bg-background text-foreground px-6 py-3 rounded-full text-sm font-semibold transition hover:brightness-110"
            >
              Start your free month <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        {/* ── What it costs a real shop ────────────────────────────────── */}
        {hasPrices ? (
          <section>
            <h3 className="text-2xl sm:text-3xl font-bold text-foreground text-center">
              What it costs for a shop like yours
            </h3>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto text-center">
              {competitor.name} bills every login. We bill the people who price
              work; everybody in a van is crew, at no charge. That gap grows with
              every person you hire.
            </p>

            <div className="mt-8 space-y-4">
              {SHOPS.map((shop) => {
                const m = shopMath(shop, id);
                if (!m.fieldquo || !m.competitor) return null;
                const wins = typeof m.savesPerYear === "number" && m.savesPerYear > 0;
                return (
                  <div
                    key={shop.label}
                    className="rounded-2xl border border-border p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">{shop.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {shop.estimators} pricing work · {shop.crew} in the field
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
                            <div className="text-xs text-muted-foreground">you keep</div>
                            <div className="text-xl font-bold text-primary tabular-nums">
                              {money(m.savesPerYear)}/yr
                            </div>
                          </>
                        ) : (
                          // Where we lose, said plainly. See the header.
                          <div className="text-xs text-muted-foreground">
                            Cheaper there at one person.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-5 text-sm text-muted-foreground text-center">
              Put your own numbers in on the{" "}
              <Link href="/cost" className="text-primary font-medium hover:underline">
                cost calculator
              </Link>{" "}
              and see all five side by side.
            </p>
          </section>
        ) : null}

        {/* ── The whole product ────────────────────────────────────────── */}
        <section>
          <h3 className="text-2xl sm:text-3xl font-bold text-foreground text-center">
            Everything you get, in every plan
          </h3>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto text-center">
            Not a highlight reel — the whole product, and whether it appears
            anywhere in {competitor.name}&apos;s plans.
          </p>

          <div className="mt-10 space-y-12">
            {MATRIX_GROUPS.map((group) => {
              const rowsForGroup = entriesFor([...parity.covered, ...parity.missing]).filter(
                (e) => e.group === group.key,
              );
              if (!rowsForGroup.length) return null;
              return (
                <div key={group.key}>
                  <h4 className="text-lg font-bold text-foreground">{group.label}</h4>
                  <ul className="mt-4 divide-y divide-border border-t border-border">
                    {rowsForGroup.map((e) => {
                      const theirs = parity.covered.includes(e.key);
                      return (
                        <li
                          key={e.key}
                          className="py-3 flex items-baseline justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <span className="font-medium text-foreground">{e.name}</span>
                            <span className="text-muted-foreground text-sm">
                              {" "}
                              — {e.summary}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs font-medium">
                            {theirs ? (
                              <span className="text-muted-foreground">Both</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1">
                                FieldQuo only
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
