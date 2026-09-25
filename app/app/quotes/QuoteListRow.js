// app/app/quotes/QuoteListRow.js
//
// One row of the quotes list, in its own file so the row can be drawn
// somewhere other than the list — the /signup side panel renders this exact
// component against fixture quotes instead of a hand-drawn lookalike, and a
// lookalike is the copy that rots.
//
// Presentational: no fetch, no router, no permission hook. The two company
// formatters (`money`, `formatDate`) come in as props rather than from
// useCompanyPreferences() here. That hook would tolerate a missing provider,
// but a caller that wants the company's own currency would then have to mount
// CompanyPreferencesProvider, which fetches /api/settings/business-info on
// mount — a request a page with no session must not make. The list passes the
// formatters it already holds, so the row prints what it always printed.
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { quoteStatusClasses, quoteStatusLabel } from "@/lib/quotes/statusLabels";
import { quoteAgeDays, quoteExpiry, quoteNeedsChasing } from "@/lib/quotes/listRanking";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * @param quote       a GET /api/quotes row: id, quoteNumber, status, total,
 *                    pricingHidden, autoEstimated, needsReview, sentAt,
 *                    createdAt, validUntil, client { name }
 * @param now         the list's one clock (see the note on `now` in page.js);
 *                    defaults to the moment of render for a caller with no list
 * @param money       the company's money formatter — useCompanyMoney()
 * @param formatDate  the company's date formatter — useCompanyPreferences()
 */
export default function QuoteListRow({ quote: q, now = new Date(), money, formatDate }) {
  const { t } = useTranslation();
  const age = quoteAgeDays(q, now);
  const expiry = quoteExpiry(q, now);
  const urgent = quoteNeedsChasing(q, now);

  return (
    <Link
      href={`/app/quotes/${q.id}`}
      className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted"
    >
      <div className="flex items-stretch gap-3 min-w-0">
        {/* Always rendered, so the text below starts at the same
            x on every row — a bar that only exists on urgent rows
            would shift every other row three pixels left and make
            the column look ragged rather than flagged. */}
        <span
          aria-hidden
          className={`w-[3px] shrink-0 rounded-full ${
            urgent ? "bg-red-600 dark:bg-red-400" : "bg-transparent"
          }`}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground truncate">
              {q.quoteNumber}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${quoteStatusClasses(
                q.status,
              )}`}
            >
              {quoteStatusLabel(q.status, t)}
            </span>
            {/* An instant estimate's review state, which `status` alone
                cannot express. Approving one in Estimate Reviews clears
                needsReview but deliberately leaves the quote in `draft`
                — approval is the company confirming the PRICE, not the
                client accepting the quote. Without this the list showed
                a bare "draft" either side of the approval, so the
                approval looked like it hadn't registered and the next
                step (send it) was invisible. */}
            {q.autoEstimated && q.needsReview && (
              <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                {t("app.quotes.needsReview")}
              </span>
            )}
            {q.autoEstimated && !q.needsReview && q.status === "draft" && (
              <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                {t("app.quotes.approvedReadyToSend")}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {q.client?.name || "Unknown client"}
          </div>
          {/* ── The dates, which this page had none of ───────────
              Both come off the payload as it already ships: the
              route is a findMany with no `select`, so sentAt,
              createdAt and validUntil have always been on the wire
              and nothing read them.

              Under the client name rather than in a right-hand
              column beside the money. The column is what the
              approved design drew and it is what this started as —
              at 375px it took enough width that the quote NUMBER
              truncated to "Q…", which is worse than having no date
              at all: the row stops identifying the document it
              links to. Measured in a browser at 375, not guessed.
              One line here reads the same at every width and needs
              no second copy of the markup for phones.

              The age is DELIBERATELY absent on a quote marked sent
              by hand — sentAt is written only once Resend accepts
              the message, so a phone acceptance or an imported
              document has status "sent" and no send date.
              quoteAgeDays refuses to age those rather than quietly
              substituting createdAt, because "12 days ago" beside a
              Sent badge is a claim about when it was sent. */}
          {(age.days !== null || (q.status === "sent" && expiry)) && (
            <div className="mt-0.5 flex items-center gap-x-3 gap-y-0.5 text-xs flex-wrap">
              {age.days !== null && (
                <span className="text-muted-foreground tabular-nums">
                  {age.days === 0
                    ? t("app.quoteDetail.today")
                    : age.days === 1
                      ? t("app.quoteDetail.yesterday")
                      : t("app.quoteDetail.daysAgo", { days: age.days })}
                </span>
              )}
              {/* Only on quotes still waiting for an answer. An
                  expiry on an accepted quote is history, and a red
                  date beside signed work is noise that teaches
                  people to stop reading the line. A quote with no
                  validUntil renders nothing at all — it never
                  expires, which is a real state the builder offers,
                  not a missing value to fill in. */}
              {q.status === "sent" && expiry && (
                <span
                  className={`tabular-nums ${
                    expiry.expired
                      ? "text-red-700 dark:text-red-300 font-semibold"
                      : expiry.soon
                        ? "text-amber-800 dark:text-amber-300 font-semibold"
                        : "text-muted-foreground"
                  }`}
                >
                  {expiry.expired
                    ? `${t("app.status.expired")} ${formatDate(expiry.date)}`
                    : `${t("app.quoteEdit.validUntil")} ${formatDate(expiry.date)}`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <span className="font-semibold text-foreground tabular-nums">
          {/* `pricingHidden` means the API removed the totals for a
              member without showPricing. Number(undefined) is NaN, so
              the alternative here is literally "$NaN" on every row. */}
          {q.pricingHidden ? (
            <span className="text-muted-foreground font-normal">—</span>
          ) : (
            money(q.total)
          )}
        </span>
        <ArrowRight size={16} className="text-muted-foreground" />
      </div>
    </Link>
  );
}
