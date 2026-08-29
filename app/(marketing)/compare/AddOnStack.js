// app/(marketing)/compare/AddOnStack.js
//
// "Three things they charge extra for, and where each one lives in FieldQuo."
//
// Rendered on two surfaces — /compare/fieldquo-vs-jobber, beside the plan
// prices, and /pricing, where a visitor is deciding what our entry tier buys.
// One component rather than two, for the reason the header of ./addOns.js
// gives: the second copy is the one that rots, and this one has a competitor's
// prices in it.
//
// ══ What this block may say ════════════════════════════════════════════════
//
//   • their add-on's LABEL and PRICE, because both were read off their own
//     pricing page and carry a source, a date and a vantage point;
//   • the total, when ./addOnStack says a total is honest — never otherwise;
//   • our own features, by matrix KEY, printed through
//     lib/marketing/featureLabels.js — the matrix's own name and summary, said
//     in the reader's language where there is one, with `limits` attached to
//     anything partly built. On /compare the default `t` below resolves each
//     key to its English fallback, which is the matrix's own string; on
//     /pricing the real t() is passed and the block speaks the page's
//     language.
//
// ══ What it may never say ══════════════════════════════════════════════════
//
//   • what their add-on CONTAINS. We read a label and a price. Describing the
//     contents would be inventing research, and the block says so out loud
//     rather than leaving a reader to assume we checked.
//   • that our receptionist is "included". The feature is on every plan and the
//     talk time is prepaid credit (lib/voice/credits.js), so "included" would
//     be a false claim about OUR price to somebody who then meets a top-up on
//     their first call. The claim is the narrower and stronger one: no monthly
//     minimum. It is printed from the capability ledger, not typed here.
//   • any converted or approximated figure. Nothing in this file does
//     arithmetic; the total arrives already computed and already justified.
//
// ══ Why `t` is a prop with an English default ══════════════════════════════
//
// /compare is English-only by decision (see compareCopy.js) and /pricing is one
// of six languages. Rather than fork the component, the caller passes its own
// t(); the default resolves each key to the English fallback written at the
// call site, which is exactly what /compare wants and what t() itself would do
// on a language with no entry.

import { Check, ExternalLink, Info } from "lucide-react";

import { FIELDQUO_CAPABILITIES } from "@/lib/marketing/competitors";
import { featureEntry } from "@/lib/marketing/featureLabels";
import { addOnStack, counterpartsFor } from "./addOns";

/**
 * The fallback translator: interpolates the same {placeholder} syntax the real
 * t() does, so a call site reads identically on both surfaces.
 */
const englishOnly = (key, fallback, values) =>
  values
    ? String(fallback).replace(/\{(\w+)\}/g, (m, name) =>
        values[name] !== undefined ? String(values[name]) : m,
      )
    : fallback;

/** One published amount, in the one currency it was published in. */
function money(price) {
  return `$${price.amount.toLocaleString("en-US")} ${price.currency} per ${price.per}`;
}

/**
 * "Jobber Marketing Suite", but not "Jobber Jobber AI Receptionist".
 *
 * Their own product names are recorded exactly as their page prints them, and
 * one of the three already carries the company name. Prefixing unconditionally
 * produced a name they have never used, which is a small lie of the same family
 * as a mis-stated price — so the label is left alone when it already says who
 * it belongs to.
 */
function addOnTitle(competitorName, label) {
  const name = String(competitorName ?? "");
  const text = String(label ?? "");
  if (!name) return text;
  return text.toLowerCase().startsWith(name.toLowerCase()) ? text : `${name} ${text}`;
}

export default function AddOnStack({
  competitorId,
  competitorName,
  asOf,
  t = englishOnly,
  headingLevel = "h2",
}) {
  const stack = addOnStack(competitorId, asOf);
  // Nothing publishable, or nothing that may honestly be totalled: the block
  // does not exist. A partial version of this argument is worse than none —
  // "two of the three" is a claim about their pricing that nobody made.
  if (stack.refusal !== null) return null;

  const Heading = headingLevel;
  const receptionist = FIELDQUO_CAPABILITIES.ai_receptionist_no_monthly_floor;

  return (
    <section
      className="mt-14"
      data-addon-stack={competitorId}
      data-addon-count={stack.items.length}
    >
      <div className="max-w-3xl">
        <Heading className="text-2xl sm:text-3xl font-bold text-foreground">
          {t("addOns.title", "{count} things {competitor} charges extra for", {
            count: stack.items.length,
            competitor: competitorName,
          })}
        </Heading>
        <p className="mt-3 text-muted-foreground">
          {t(
            "addOns.intro",
            "These sit on top of the plan on their own pricing page, each with its own monthly price. Every one of them is work FieldQuo does inside the plan you are already paying for.",
          )}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "addOns.scope",
            "We read the name and the price off their pricing page and nothing else. What is inside their add-on is not something we have checked, so nothing below describes it.",
          )}
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {stack.items.map((addOn) => {
          const counterparts = counterpartsFor(addOn.id).map((c) =>
            featureEntry(c.key, t),
          );
          return (
            <div
              key={addOn.id}
              data-addon-id={addOn.id}
              className="border border-border rounded-xl bg-card p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="font-semibold text-foreground">
                  {addOnTitle(competitorName, addOn.label)}
                </div>
                {/* One amount, one currency, inside its own element. */}
                <div className="text-foreground font-semibold whitespace-nowrap">
                  {money(addOn.price)}
                </div>
              </div>
              {stack.coordinates ? (
                <div className="mt-1 text-sm text-muted-foreground">{stack.coordinates}</div>
              ) : null}
              <div className="mt-2 text-xs text-muted-foreground">
                {t(
                  "addOns.provenance",
                  "Read from a {country} connection on {checked}",
                  { country: addOn.observedFrom, checked: addOn.checked },
                )}{" "}
                ·{" "}
                <a
                  href={addOn.source}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
                >
                  {t("addOns.sourceLink", "their pricing page")}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <div className="text-sm font-semibold text-foreground">
                  {t("addOns.oursTitle", "In FieldQuo, on every plan:")}
                </div>
                <ul className="mt-2 space-y-2">
                  {counterparts.map((entry) => (
                    <li
                      key={entry.key}
                      data-addon-counterpart={entry.key}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check
                        size={15}
                        className="text-emerald-600 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span className="text-muted-foreground">
                        <span className="text-foreground font-medium">{entry.name}</span>{" "}
                        — {entry.summary}
                        {/* A partly-built feature is never a bare tick. The
                            matrix requires `limits` for exactly this reason,
                            and door-hanger routes is the case: we plan and
                            track the walk, we print and deliver nothing. */}
                        {entry.readiness === "partial" && entry.limits ? (
                          <span className="block mt-1 border-l-2 border-border pl-3" data-addon-limits={entry.key}>
                            {t("addOns.limits", "Where it stops:")} {entry.limits}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* The total. Computed in ./addOns.js from their own published figures,
          which is also the only place that decides whether totalling them is
          honest at all — same currency, same period, same point on their own
          selectors. Never typed. */}
      <div
        className="mt-6 rounded-xl border border-border bg-muted p-5"
        data-addon-total={stack.total}
        data-addon-currency={stack.currency}
      >
        <p className="text-lg font-semibold text-foreground">
          {t("addOns.total", "{total} {currency} a month, on top of the plan price.", {
            total: `$${stack.total.toLocaleString("en-US")}`,
            currency: stack.currency,
          })}
        </p>
        <p className="mt-2 text-muted-foreground">
          {t(
            "addOns.totalBody",
            "That is what those three cost together at the point on their own selectors where we read them. In FieldQuo the same three jobs are in every plan, at every size, from the cheapest one on this page.",
          )}
        </p>
      </div>

      {/* The receptionist, stated narrowly on purpose — see the file header.
          The label comes out of the capability ledger so this page cannot make
          a claim about our own product that the ledger does not carry. */}
      <div className="mt-4 rounded-xl border border-border bg-card p-5" data-addon-receptionist="true">
        <div className="flex items-start gap-2">
          <Info size={16} className="text-muted-foreground shrink-0 mt-1" aria-hidden="true" />
          <div>
            <div className="font-semibold text-foreground">{receptionist.label}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "addOns.receptionist",
                "Their receptionist add-on is a monthly floor: it is charged in a month when the phone never rings. Ours has no monthly minimum. The feature is on every plan and the talk time is prepaid credit you buy when you need it, so a quiet February costs nothing for it.",
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
