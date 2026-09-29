"use client";

// app/components/dashboard/WorkPanel.js
//
// The top of the home screen: Requests · Quotes · Jobs · Invoices, each tab
// badged with what is waiting on a person (hidden at zero) and each row
// carrying ONE action. The rules are lib/dashboard/workPanel.js's and the
// rows come from GET /api/dashboard/home already shaped to the member — a
// tab the member may not see arrives `{ allowed: false }` and is simply not
// drawn here, so someone without invoice access has no Invoices tab at all
// rather than an empty one.
//
// The actions go where the work is done — the lead, the review queue, the
// quote with its Follow up button, the job's new-visit form, the invoice.
// The one action taken in place is the invoice chase, the same POST the
// "Money owed" rows use (/api/invoices/[id]/request-payment); under a
// support session it is disabled, and middleware refuses it regardless.
import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { formatMoney } from "@/lib/currency";
import { formatTimeOfDay } from "@/lib/format/localeDate";
import { firstTabWithWork } from "@/lib/dashboard/workPanel";
import { CARD_CLIPPED } from "./surface";
import { Figure, FigureText } from "./Figure";

const TAB_LABEL = {
  requests: ["app.dash.work.tab.requests", "Requests"],
  quotes: ["app.dash.work.tab.quotes", "Quotes"],
  jobs: ["app.dash.work.tab.jobs", "Jobs"],
  invoices: ["app.dash.work.tab.invoices", "Invoices"],
};

const LIST_HREF = { requests: "/app/leads", quotes: "/app/quotes", jobs: "/app/jobs", invoices: "/app/invoices" };

const EMPTY = {
  requests: ["app.dash.work.empty.requests", "No new requests waiting for a reply."],
  quotes: ["app.dash.work.empty.quotes", "No quotes need a follow-up right now."],
  jobs: ["app.dash.work.empty.jobs", "Every approved job is scheduled, and nothing starts today or tomorrow."],
  invoices: ["app.dash.work.empty.invoices", "Nothing to chase or send."],
};

const ACTION = {
  reply: ["app.dash.work.action.reply", "Reply"],
  review: ["app.dash.work.action.review", "Review"],
  follow_up: ["app.dash.work.action.followUp", "Follow up"],
  schedule: ["app.dash.work.action.schedule", "Schedule"],
  open: ["app.dash.work.action.open", "Open"],
  chase: ["app.dash.work.action.chase", "Chase"],
  send: ["app.dash.work.action.send", "Send"],
};

// The grid class per number of visible tabs, spelled out so Tailwind sees it.
const COLS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

const DAY = 86_400_000;

function daysSince(value, now) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / DAY));
}

/** The one line under the name that says why the row is here. */
function reasonLine(item, t, language, now) {
  const ago = daysSince(item.at, now);
  const agoWords =
    ago == null ? "" : ago === 0 ? t("app.dash.work.today", "today") : t("app.dash.work.daysAgo", "{days} d ago", { days: ago });
  switch (item.reason) {
    case "new_lead":
      return t("app.dash.work.reason.newLead", "New request · {when}", { when: agoWords });
    case "callback":
      return t("app.dash.work.reason.callback", "Asked for a call back · {when}", { when: agoWords });
    case "instant_estimate":
      return t("app.dash.work.reason.instantEstimate", "Instant estimate to review · {when}", { when: agoWords });
    case "booking_unassigned": {
      const d = new Date(item.at);
      return t("app.dash.work.reason.bookingUnassigned", "Booked for {date} · nobody assigned", {
        date: Number.isFinite(d.getTime()) ? d.toLocaleDateString(language, { weekday: "short", month: "short", day: "numeric" }) : "",
      });
    }
    case "follow_up":
      return t("app.dash.work.reason.followUp", "No reply · last contact {when}", { when: agoWords });
    case "expiring":
      return item.daysLeft === 0
        ? t("app.dash.work.reason.expiresToday", "Expires today")
        : t("app.dash.work.reason.expiring", "Expires in {days} d", { days: item.daysLeft });
    case "starts_today":
      return t("app.dash.work.reason.startsToday", "Today at {time}", { time: formatTimeOfDay(new Date(item.at), language) });
    case "starts_tomorrow":
      return t("app.dash.work.reason.startsTomorrow", "Tomorrow at {time}", { time: formatTimeOfDay(new Date(item.at), language) });
    case "not_scheduled":
      return t("app.dash.work.reason.notScheduled", "Approved · not scheduled yet");
    case "overdue":
      return t("app.dash.owed.daysPastDue", "{days} days past due", { days: item.daysPastDue ?? "" });
    case "undated":
      return t("app.dash.work.reason.undated", "No due date · issued {when}", { when: agoWords });
    case "draft":
      return t("app.dash.work.reason.draft", "Draft · not sent");
    default:
      return "";
  }
}

export default function WorkPanel({ work, currency = null, readOnly = false, onChanged }) {
  const { t, language } = useTranslation();
  const tabs = useMemo(() => (work?.tabs || []).filter((tab) => tab.allowed), [work]);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(null);
  const [results, setResults] = useState({});
  const now = useMemo(() => new Date(), [work]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tabs.length) return null;
  const current = tabs.find((tab) => tab.key === active) || tabs.find((tab) => tab.key === firstTabWithWork(tabs)) || tabs[0];

  async function chase(item) {
    if (readOnly || !item.action?.post) return;
    setBusy(item.id);
    setResults((prev) => ({ ...prev, [item.id]: null }));
    try {
      const res = await fetch(item.action.post, { method: "POST" });
      if (!res.ok) {
        await reportResponseError(
          res,
          (message) => setResults((prev) => ({ ...prev, [item.id]: { error: message } })),
          t("app.invoiceDetail.requestError"),
        );
        return;
      }
      const data = await res.json().catch(() => ({}));
      setResults((prev) => ({
        ...prev,
        [item.id]: { note: t("app.dash.work.chased", "Payment request emailed to {address}", { address: data?.to || "" }) },
      }));
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={CARD_CLIPPED} aria-labelledby="work-panel-title" data-tour="work-panel">
      <h2 id="work-panel-title" className="sr-only">
        {t("app.dash.work.title", "Work waiting on you")}
      </h2>
      <div role="tablist" aria-label={t("app.dash.work.title", "Work waiting on you")} className={`grid ${COLS[tabs.length] || "grid-cols-4"} border-b border-foreground/15`}>
        {tabs.map((tab) => {
          const selected = tab.key === current.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`work-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`work-panel-${tab.key}`}
              onClick={() => setActive(tab.key)}
              className={`flex min-h-12 items-center justify-center gap-1.5 px-1 sm:px-3 text-xs sm:text-sm font-semibold border-b-2 -mb-px ${
                selected ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="truncate">{t(...TAB_LABEL[tab.key])}</span>
              {tab.count > 0 && (
                <span
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-inverted px-1.5 text-[11px] font-bold leading-5 text-inverted-foreground tabular-nums"
                  aria-label={t("app.dash.work.badge", "{count} waiting", { count: tab.count })}
                >
                  {tab.count > 99 ? "99+" : tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`work-panel-${current.key}`} aria-labelledby={`work-tab-${current.key}`}>
        {current.items.length === 0 ? (
          <p className="px-4 sm:px-5 py-6 text-sm text-muted-foreground">
            {t(...EMPTY[current.key])}{" "}
            <Link href={LIST_HREF[current.key]} className="text-foreground underline">
              {t("app.dash.work.openList", "Open the list")}
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-foreground/10">
            {current.items.map((item) => {
              const result = results[item.id];
              const isChase = item.action?.type === "chase";
              return (
                <li key={`${item.kind}:${item.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {item.name || t("app.invoiceLifecycle.thisClient", "this client")}
                      {item.number ? <span className="font-normal text-muted-foreground"> · {item.number}</span> : null}
                    </div>
                    <FigureText
                      className={`truncate text-xs ${item.reason === "overdue" || item.reason === "expiring" ? "font-semibold text-destructive" : "text-muted-foreground"}`}
                    >
                      {reasonLine(item, t, language, now)}
                      {item.title && item.title !== item.name ? ` · ${item.title}` : ""}
                    </FigureText>
                    {result?.note && (
                      <p role="status" className="mt-1 text-xs text-muted-foreground">
                        {result.note}
                      </p>
                    )}
                    {result?.error && (
                      <p role="alert" className="mt-1 text-xs text-destructive">
                        {result.error}
                      </p>
                    )}
                  </div>
                  {item.amount != null && (
                    <Figure className="hidden sm:block shrink-0 text-sm font-semibold text-foreground">
                      {formatMoney(item.amount, currency)}
                    </Figure>
                  )}
                  {isChase ? (
                    <button
                      type="button"
                      onClick={() => chase(item)}
                      disabled={readOnly || busy === item.id}
                      title={readOnly ? t("app.dash.readOnly", "Read-only support session") : undefined}
                      className="shrink-0 min-h-10 rounded-full border border-foreground/25 px-4 text-xs font-semibold text-foreground disabled:opacity-60"
                    >
                      {t(...ACTION.chase)}
                    </button>
                  ) : (
                    <Link
                      href={item.action?.href || LIST_HREF[current.key]}
                      className="shrink-0 inline-flex min-h-10 items-center rounded-full border border-foreground/25 px-4 text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      {t(...(ACTION[item.action?.type] || ACTION.open))}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {current.count > current.items.length && (
          <Link href={LIST_HREF[current.key]} className="block border-t border-foreground/15 px-4 sm:px-5 py-3 text-xs text-muted-foreground underline">
            <FigureText as="span">{t("app.dash.work.more", "{count} more — see all", { count: current.count - current.items.length })}</FigureText>
          </Link>
        )}
      </div>
    </section>
  );
}
