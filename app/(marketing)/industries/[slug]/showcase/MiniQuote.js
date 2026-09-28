// app/(marketing)/industries/[slug]/showcase/MiniQuote.js
//
// Step 4 of the roofing walk-through: the draft quote the request wrote, and
// the working behind its price.
//
// The document is app/components/document/QuoteDocument.js — the masthead,
// parties, scope card and totals the staff quote page composes
// (app/app/quotes/[id]/page.js), with no edit callbacks, which is that
// file's read-only mode. Nothing on it is a link or a button: the owner's
// brief is that the visitor can see the quote and the logic behind it, not
// open it. The status chip is the quote page's own ("Draft") until the
// visitor approves the estimate in step 3; after that it says what the
// approve route actually does to a draft — clears the review flag so it can
// be sent — rather than borrowing "Approved", which on a quote means the
// CLIENT accepted it (lib/quotes/statusLabels.js).
//
// The working is ./roofingRun.js priceWorkings(): measured facts, the rates
// the sample company's price book states, and the estimator's own amounts.
// No figure on this panel is typed here.
"use client";

import { useTranslation } from "@/app/hooks/useTranslation";
import {
  DocumentFrame,
  DocumentMasthead,
  DocumentParties,
  DocumentScopeGroup,
  DocumentTotals,
} from "@/app/components/document/QuoteDocument";
import { documentLabels } from "@/lib/i18n/documentLabels";
import { moneyFormatter } from "@/lib/format/money";
import { quoteStatusClasses, quoteStatusLabel } from "@/lib/quotes/statusLabels";
import { estimateRange } from "@/lib/estimate/estimateMoney";
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { priceWorkings } from "./roofingRun";

function fill(template, values) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, k) => (values[k] == null ? "" : String(values[k])));
}

export default function MiniQuote({ fixture, run, approved, copy }) {
  const { t, language } = useTranslation();
  const labels = documentLabels(language);
  const money = moneyFormatter(fixture.company.currency, language);
  const locale = numberLocaleFor(language);
  const num = (n, digits = 1) => Number(n).toLocaleString(locale, { maximumFractionDigits: digits });
  const pct = (p) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(Number(p) || 0);
  const draft = run.draft;
  const w = priceWorkings(fixture, run);
  const headline = fixture.tax.headline?.[language] || fixture.tax.headline?.en || null;
  const taxWords = headline ? t(headline.key, headline.params) : "";
  const created = new Date(draft.createdAt).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });

  // The estimator's rows, named in the reader's language, in the order
  // estimateRoofing() pushes them: the material, the tear-off when there was
  // one, the pitch surcharge when there was one. The check pins the count.
  const rows = [];
  let i = 0;
  if (w.lines[i]) {
    rows.push({
      key: "material",
      label: fill(copy.workMaterial, { material: copy.materials?.[w.material?.key] || w.material?.label || "", squares: num(w.squares), rate: money(w.material?.ratePerSquare) }),
      amount: w.lines[i++].amount,
    });
  }
  if (w.tearOffLayers > 0 && w.tearOffRate > 0 && w.lines[i]) {
    rows.push({ key: "tearOff", label: fill(copy.workTearOff, { layers: w.tearOffLayers, squares: num(w.squares), rate: money(w.tearOffRate) }), amount: w.lines[i++].amount });
  }
  if (w.steepnessPct > 0 && w.lines[i]) {
    rows.push({ key: "pitch", label: fill(copy.workPitch, { rise: w.rise, pct: pct(w.steepnessPct) }), amount: w.lines[i++].amount });
  }
  if (w.rounding !== 0) rows.push({ key: "rounding", label: copy.workRounding, amount: w.rounding });

  const status = approved ? (
    <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-inverted text-inverted-foreground" data-sample-status="approved">
      {copy.statusApproved}
    </span>
  ) : (
    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${quoteStatusClasses(draft.status)}`} data-sample-status="draft">
      {quoteStatusLabel(draft.status, t)}
    </span>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <div>
        <DocumentFrame company={fixture.company} data-sample-quote aria-live="polite">
          <DocumentMasthead company={fixture.company} word={labels.quote} number={draft.quoteNumber} status={status} />
          <DocumentParties
            label={labels.preparedFor}
            client={{ name: run.review.client.name, email: run.review.client.email, phone: run.review.client.phone }}
            clientAddress={run.review.client.address}
            jobAddress={null}
            facts={[[labels.date, created]]}
          />
          <section className="px-5 sm:px-7 py-5 space-y-3">
            <DocumentScopeGroup label={run.lead.category.label} subtotal={draft.subtotal} lines={draft.lineItems} money={money} />
          </section>
          <DocumentTotals
            rows={[
              { key: "subtotal", label: t("app.quoteDetail.subtotal"), value: money(draft.subtotal) },
              { key: "tax", label: t("app.quoteDetail.tax"), value: money(draft.tax), note: taxWords || null },
            ]}
            total={{ label: t("app.quoteDetail.quotedTotal"), value: money(draft.total) }}
          />
        </DocumentFrame>
        <p className="mt-3 text-sm text-muted-foreground">{approved ? copy.editNote : copy.waitingApproval}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5" data-sample-workings>
        <h4 className="text-base font-semibold text-foreground">{copy.workingsTitle}</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          {fill(copy.workMeasured, { area: num(w.areaSqft), squares: num(w.squares) })}
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          {rows.map((r) => (
            <div key={r.key} className="flex items-start justify-between gap-3" data-working={r.key} data-amount={r.amount}>
              <dt className="text-foreground">{r.label}</dt>
              <dd className="tabular-nums text-foreground shrink-0">{money(r.amount)}</dd>
            </div>
          ))}
          <div className="flex items-start justify-between gap-3 border-t border-border pt-2 font-semibold" data-working="subtotal" data-amount={w.subtotal}>
            <dt className="text-foreground">{copy.workSubtotal}</dt>
            <dd className="tabular-nums text-foreground shrink-0">{money(w.subtotal)}</dd>
          </div>
          <div className="flex items-start justify-between gap-3" data-working="tax" data-amount={w.tax}>
            <dt className="text-foreground">{taxWords || t("app.quoteDetail.tax")}</dt>
            <dd className="tabular-nums text-foreground shrink-0">{money(w.tax)}</dd>
          </div>
          <div className="flex items-start justify-between gap-3 border-t border-border pt-2 font-bold" data-working="total" data-amount={w.total}>
            <dt className="text-foreground">{copy.workTotal}</dt>
            <dd className="tabular-nums text-foreground shrink-0">{money(w.total)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          {fill(copy.workRange, {
            pct: pct(w.rangeBandPct),
            range: estimateRange(w.low, w.high, fixture.company.currency, locale) || "",
          })}
        </p>

        <h4 className="mt-6 text-sm font-semibold text-foreground">{copy.tiersTitle}</h4>
        <ul className="mt-2 divide-y divide-border text-sm" data-sample-tiers>
          {run.options.options.map((o) => {
            const m = (fixture.config.materials || []).find((x) => x.key === o.materialKey);
            return (
              <li key={o.materialKey} className="py-2 flex items-start justify-between gap-3" data-tier={o.materialKey} data-low={o.low} data-high={o.high}>
                <span className="text-foreground">
                  {copy.materials?.[o.materialKey] || o.label}
                  <span className="block text-xs text-muted-foreground">{fill(copy.tierRate, { rate: money(m?.ratePerSquare) })}</span>
                </span>
                <span className="tabular-nums text-foreground shrink-0">
                  {estimateRange(o.low, o.high, fixture.company.currency, locale)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs font-semibold text-foreground">{copy.examplePrices}</p>
      </div>
    </div>
  );
}
