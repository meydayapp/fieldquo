// app/app/payroll/PayRunRow.js
//
// One pay run in the payroll page's "Pay runs" list, in its own file so the
// row can be drawn outside the page — the /signup side panel renders this
// exact component against fixture runs rather than a hand-drawn lookalike.
//
// Presentational: no fetch, no router, no permission hook. `money` is a prop
// rather than useCompanyMoney() here for the reason QuoteListRow gives: a
// caller wanting the company's currency would otherwise have to mount the
// provider that fetches business-info on mount.
"use client";

import Link from "next/link";
import { formatCalendarDay } from "@/lib/format/localeDate";
import { useTranslation } from "@/app/hooks/useTranslation";

const STATUS_STYLE = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  paid: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

// PayRun.status is a free string column (prisma/schema.prisma: draft |
// approved | paid | cancelled). Three of the four used to reach the badge
// raw and lowercase — "draft", "approved", "cancelled" — in every language.
// app.payRunStatus.* is the catalogue's existing wording for exactly these
// four, already used on the job page's pay-period panel; reused rather than
// written a second time. "paid" keeps its own longer phrasing, because
// FieldQuo records that a company paid, it does not pay.
const STATUS_FALLBACK = {
  draft: "Draft",
  approved: "Approved",
  paid: "Paid",
  cancelled: "Cancelled",
};

function statusLabel(t, status) {
  if (status === "paid") return t("app.payrollRun.paidRecorded", "paid (recorded)");
  // An unmapped value prints itself rather than nothing: a status nobody
  // anticipated is a bug report, and a blank badge is what hides it.
  return STATUS_FALLBACK[status]
    ? t(`app.payRunStatus.${status}`, STATUS_FALLBACK[status])
    : status;
}

// Period boundaries are calendar days stored at midnight UTC — the same
// formatter, and the same reason, as `date` in page.js.
const date = (d, language) => formatCalendarDay(d, language) || "—";

/**
 * @param run    a GET /api/payroll/runs row: id, periodStart, periodEnd,
 *               region, netTotal, status, _count { lines }
 * @param money  the company's money formatter — useCompanyMoney()
 */
export default function PayRunRow({ run: r, money }) {
  const { t, language } = useTranslation();
  return (
    <Link
      href={`/app/payroll/${r.id}`}
      className="block rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/40"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium text-foreground">
            {date(r.periodStart, language)} –{" "}
            {date(r.periodEnd, language)}
          </p>
          <p className="text-xs text-muted-foreground">
            {r._count.lines}{" "}
            {r._count.lines === 1
              ? t("app.payrollRun.person", "person")
              : t("app.payrollRun.people", "people")}{" "}
            · {r.region}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-foreground tabular-nums">
            {money(r.netTotal)}
          </span>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] || ""}`}
          >
            {statusLabel(t, r.status)}
          </span>
        </div>
      </div>
    </Link>
  );
}
