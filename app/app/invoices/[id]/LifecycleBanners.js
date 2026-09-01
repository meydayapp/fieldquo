// app/app/invoices/[id]/LifecycleBanners.js
//
// The banners at the top of an invoice: what is true, and what to do next.
//
// ── This file renders; it does not decide ──────────────────────────────────
//
// Which banners appear is lib/invoices/lifecycle.js, computed server-side in
// /api/invoices/[id]/lifecycle and driven by scripts/check-invoice-banners.mjs.
// Nothing here adds a condition of its own — the moment a banner's rule lives
// in JSX, it stops being testable, and "overdue" appearing on a paid invoice is
// exactly the failure that costs a customer relationship.
//
// So this maps id → sentence and action → button, and that is all. Every
// sentence is a catalogue key; every button either calls a handler the page
// owns or is a Link to a route that exists. A banner whose action the page did
// not supply renders WITHOUT a button rather than with a dead one.
"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  History,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";

// Tone → colour. Four tones, deliberately: a page that can shout in six
// different ways shouts in none of them.
const TONES = {
  critical: {
    box: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300",
    Icon: AlertTriangle,
  },
  warning: {
    box: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200",
    Icon: AlertTriangle,
  },
  info: {
    box: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300",
    Icon: Info,
  },
  success: {
    box: "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900 text-green-800 dark:text-green-300",
    Icon: CheckCircle2,
  },
};

export default function LifecycleBanners({
  banners = [],
  money,
  handlers = {},
  busy = "",
}) {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();

  if (!Array.isArray(banners) || banners.length === 0) return null;

  return (
    <div className="space-y-2">
      {banners.map((b) => {
        const tone = TONES[b.tone] || TONES.info;
        const Icon = b.id === "superseded" ? History : tone.Icon;
        return (
          <div
            key={b.id}
            className={`border rounded-lg px-4 py-3 flex items-start gap-2.5 text-sm ${tone.box}`}
          >
            <Icon size={16} className="shrink-0 mt-0.5" />
            <p className="min-w-0 flex-1">
              {sentence({ banner: b, t, money, formatDate })}
            </p>
            <Action banner={b} t={t} handlers={handlers} busy={busy} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * One banner's sentence.
 *
 * `money` is the page's currency-bound formatter, passed in rather than
 * rebuilt: the totals block two inches below prints the same figures, and two
 * formatters on one screen is how $2100.00 ends up next to $2,100.00.
 */
function sentence({ banner, t, money, formatDate }) {
  const d = banner.data || {};
  // ── The amount-free variants ────────────────────────────────────────────
  //
  // The server strips the figure out of a banner's data for a member without
  // showPricing (stripBannerMoney, lib/invoices/lifecycle.js) and marks the
  // banner `pricingHidden`. Without a second sentence per banner, money(undefined)
  // renders "$0.00" and this component would announce "Paid in full — $0.00
  // received" over an invoice that was settled for $7,645 — a false statement
  // where a withheld one belongs.
  //
  // Read off the flag rather than off `d.paid === undefined`, so a genuinely
  // absent figure and a withheld one cannot be confused for one another.
  const hidden = banner.pricingHidden === true;
  switch (banner.id) {
    case "superseded":
      return t("app.invoiceLifecycle.superseded", {
        version: d.version,
        latest: d.latestVersion,
      });
    case "paid":
      // The date is only added when there is one. An invoice marked paid by an
      // older code path may have no paidDate, and "Paid in full on Invalid
      // Date" is worse than "Paid in full".
      if (hidden)
        return d.paidDate
          ? t("app.invoiceLifecycle.paidOnNoAmount", {
              date: formatDate(d.paidDate),
            })
          : t("app.invoiceLifecycle.paidNoAmount");
      return d.paidDate
        ? t("app.invoiceLifecycle.paidOn", {
            amount: money(d.paid),
            date: formatDate(d.paidDate),
          })
        : t("app.invoiceLifecycle.paid", { amount: money(d.paid) });
    case "overdue":
      // Declined by the catalogue's own plural rules — see countedNoun in
      // lib/i18n/plurals.js. "Overdue by 1 days" is the kind of detail that
      // makes software look unfinished on the one screen about money.
      if (hidden)
        return t("app.invoiceLifecycle.overdueNoAmount", {
          days: t("app.duration.days", { value: d.days }),
        });
      return t("app.invoiceLifecycle.overdue", {
        days: t("app.duration.days", { value: d.days }),
        amount: money(d.due),
      });
    case "partiallyPaid":
      if (hidden) return t("app.invoiceLifecycle.partiallyPaidNoAmount");
      return t("app.invoiceLifecycle.partiallyPaid", {
        paid: money(d.paid),
        total: money(d.total),
        due: money(d.due),
      });
    case "disputed":
      // Carries no figure at all — the disputed AMOUNT is Stripe's own
      // dispute.amount, which this codebase doesn't fetch or store (see
      // lib/invoices/computeInvoiceState.js's header), so there is nothing
      // to hide from a restricted-pricing member here in the first place.
      return t("app.invoiceLifecycle.disputed");
    case "refunded":
      if (hidden) return t("app.invoiceLifecycle.refundedNoAmount");
      return t("app.invoiceLifecycle.refunded", { amount: money(d.refunded) });
    case "partiallyRefunded":
      if (hidden) return t("app.invoiceLifecycle.partiallyRefundedNoAmount");
      return t("app.invoiceLifecycle.partiallyRefunded", { amount: money(d.refunded) });
    case "unsent":
      return t("app.invoiceLifecycle.unsent");
    case "noClientEmail":
      return t("app.invoiceLifecycle.noClientEmail", {
        name: d.clientName || t("app.invoiceLifecycle.thisClient"),
      });
    case "chaseDue":
      if (hidden)
        return t("app.invoiceLifecycle.chaseDueNoAmount", {
          date: formatDate(d.dueDate),
        });
      return t("app.invoiceLifecycle.chaseDue", {
        date: formatDate(d.dueDate),
        amount: money(d.due),
      });
    case "noJob":
      return t("app.invoiceLifecycle.noJob");
    case "jobUnscheduled":
      return t("app.invoiceLifecycle.jobUnscheduled", {
        title: d.jobTitle || "",
      });
    case "visitUnassigned":
      return t("app.invoiceLifecycle.visitUnassigned", {
        date: formatDate(d.scheduledAt),
      });
    default:
      // A banner id the renderer doesn't know is a bug in one of the two
      // files, not something to paper over with a generic sentence — but it
      // must not blank the page either.
      return banner.id;
  }
}

const ACTION_LABELS = {
  send: "app.invoiceLifecycle.actionSend",
  chase: "app.invoiceLifecycle.actionChase",
  createJob: "app.invoiceLifecycle.actionCreateJob",
  scheduleVisit: "app.invoiceLifecycle.actionScheduleVisit",
  assignVisit: "app.invoiceLifecycle.actionAssignVisit",
  addClientEmail: "app.invoiceLifecycle.actionAddClientEmail",
  openLatest: "app.invoiceLifecycle.actionOpenLatest",
};

/**
 * The one control a banner offers, or nothing.
 *
 * Two banners resolve to a Link because the thing to do lives on another
 * screen that already does it properly — assigning a visit is the job's visit
 * editor, and adding an email is the client record. Sending the user there is
 * honest; a second copy of either form on this page is the copy that rots.
 */
function Action({ banner, t, handlers, busy }) {
  const d = banner.data || {};
  const label = ACTION_LABELS[banner.action]
    ? t(ACTION_LABELS[banner.action])
    : null;
  if (!banner.action || !label) return null;

  const linkClass =
    "shrink-0 text-xs font-semibold underline underline-offset-2 whitespace-nowrap";

  if (banner.action === "openLatest" && d.latestId)
    return (
      <Link href={`/app/invoices/${d.latestId}`} className={linkClass}>
        {label}
      </Link>
    );
  if (banner.action === "assignVisit" && d.jobId)
    return (
      <Link href={`/app/jobs/${d.jobId}`} className={linkClass}>
        {label}
      </Link>
    );
  if (banner.action === "addClientEmail" && d.clientId)
    return (
      <Link href={`/app/clients/${d.clientId}`} className={linkClass}>
        {label}
      </Link>
    );

  const handler = handlers[banner.action];
  // No handler means the page cannot do this. Rendering the button anyway is
  // the one thing this codebase is swept for, so it renders nothing.
  if (!handler) return null;

  return (
    <button
      onClick={handler}
      disabled={Boolean(busy)}
      className={`${linkClass} disabled:opacity-60 inline-flex items-center gap-1.5`}
    >
      {busy === banner.action && <Loader2 size={12} className="animate-spin" />}
      {label}
    </button>
  );
}
