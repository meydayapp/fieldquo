// app/components/marketing/home/ProductDemo.js
//
// Section 2: FieldQuo on a desktop and on a phone, drawn in HTML and CSS.
//
// ══ Why drawn, not photographed ════════════════════════════════════════════
//
// The app is behind a login, so a screenshot would be of somebody's account —
// and a real customer's jobs on a marketing page is exactly the data that
// must never leave the building. Drawing it also keeps it translated (every
// label is a catalogue key), sharp at any size, and light: no image to fetch
// above the fold's next scroll.
//
// ══ Sample data, and it says so ═══════════════════════════════════════════
//
// The names and amounts below are invented and labelled as such under the
// figure. They are an illustration of the flow — new lead → quote sent → job
// scheduled → invoice paid — not a claim about anybody's business.
//
// Nothing in the mock is a control. The "buttons" are spans with no hover
// state and no handler, inside a figure that is aria-labelled as an
// illustration — a drawing of a button, not a button that does nothing.
"use client";

import { Inbox, Send, CalendarCheck, BadgeCheck, LayoutGrid, CalendarDays, Users, Receipt, MapPin } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { offerMoney } from "@/app/components/billing/PlanOfferPrice";

// Invented people and figures — see the header.
const STAGES = [
  { key: "lead", icon: Inbox, client: "Alex Moreau", amount: null },
  { key: "quote", icon: Send, client: "Priya Shah", amount: 3180 },
  { key: "job", icon: CalendarCheck, client: "Dan Kowalski", amount: 1940 },
  { key: "paid", icon: BadgeCheck, client: "Lina Santos", amount: 6240 },
];
const SAMPLE_INVOICE = "#1042";
const SAMPLE_ADDRESS = "12 Birch Lane";

const NAV = [
  { key: "pipeline", icon: LayoutGrid },
  { key: "schedule", icon: CalendarDays },
  { key: "clients", icon: Users },
  { key: "invoices", icon: Receipt },
];

export default function ProductDemo() {
  const { t, language } = useTranslation();
  const money = offerMoney("$", numberLocaleFor(language));
  const paid = STAGES[3];
  const job = STAGES[2];

  return (
    <section id="see-how-it-works" className="scroll-mt-20 bg-card border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground text-balance">
            {t("home.demo.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-pretty">{t("home.demo.subtitle")}</p>
        </div>

        <figure className="mt-12" aria-label={t("home.demo.figureLabel")}>
          <div className="lg:flex lg:items-center lg:gap-10">
          {/* ── Desktop window ─────────────────────────────────────────── */}
          <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/10 lg:flex-1">
            <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-3" aria-hidden="true">
              <span className="h-3 w-3 rounded-full bg-border" />
              <span className="h-3 w-3 rounded-full bg-border" />
              <span className="h-3 w-3 rounded-full bg-border" />
              <span className="ml-3 text-xs font-semibold text-foreground">FieldQuo</span>
            </div>
            <div className="flex">
              <nav aria-hidden="true" className="hidden md:block w-44 shrink-0 border-r border-border bg-muted p-3">
                <ul className="space-y-1">
                  {NAV.map((item, i) => (
                    <li
                      key={item.key}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                        i === 0 ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      <item.icon size={15} aria-hidden="true" />
                      {t(`home.demo.nav.${item.key}`)}
                    </li>
                  ))}
                </ul>
              </nav>

              <ol className="grid flex-1 gap-3 p-3 sm:grid-cols-2 sm:p-4">
                {STAGES.map((stage, i) => (
                  <li key={stage.key} className="rounded-xl border border-border bg-muted p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-card text-foreground">
                        <stage.icon size={14} aria-hidden="true" />
                      </span>
                      <span>
                        {i + 1}. {t(`home.demo.stage.${stage.key}`)}
                      </span>
                    </div>
                    <div className="mt-3 rounded-lg border border-border bg-card p-3 shadow-sm">
                      <div className="text-sm font-semibold text-foreground">{t(`home.demo.${stage.key}.title`)}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{stage.client}</div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{t(`home.demo.${stage.key}.meta`)}</span>
                        {stage.amount != null ? (
                          <span className="text-sm font-semibold text-foreground">{money(stage.amount)}</span>
                        ) : null}
                      </div>
                      {stage.key === "paid" ? (
                        <div className="mt-3 h-1.5 rounded-full bg-[#047857]" aria-hidden="true" />
                      ) : (
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(i + 1) * 25}%` }} />
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* ── Phone ──────────────────────────────────────────────────────
              Below the window on a phone, beside it on a wide screen — never
              over it, where it would hide the "Invoice paid" column the whole
              figure builds to. max-w keeps it phone-shaped at 375px without a
              fixed width wider than the screen. */}
          <div className="relative mx-auto mt-8 w-full max-w-[17rem] shrink-0 lg:mx-0 lg:mt-0">
            <div className="rounded-[2.25rem] border-[10px] border-foreground bg-card shadow-2xl shadow-primary/20">
              <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-border" aria-hidden="true" />
              <div className="p-4">
                <div className="text-lg font-bold text-foreground">{t("home.demo.phone.today")}</div>

                <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-border bg-muted p-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#047857] text-[#ffffff]">
                    <BadgeCheck size={15} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {t("home.demo.phone.paidNote", { number: SAMPLE_INVOICE })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {paid.client} · {money(paid.amount)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("home.demo.phone.nextJob")}
                </div>
                <div className="mt-2 rounded-xl border border-border bg-card p-3 shadow-sm">
                  <div className="text-sm font-semibold text-foreground">{t("home.demo.job.title")}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{t("home.demo.job.meta")}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={12} aria-hidden="true" /> {SAMPLE_ADDRESS} · {job.client}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2" aria-hidden="true">
                    <span className="flex items-center justify-center rounded-lg border border-border bg-card px-1.5 py-2 text-center text-xs font-semibold text-foreground">
                      {t("home.demo.phone.onMyWay")}
                    </span>
                    <span className="flex items-center justify-center rounded-lg bg-primary px-1.5 py-2 text-center text-xs font-semibold text-primary-foreground">
                      {t("home.demo.phone.startJob")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          </div>
          <figcaption className="mt-6 text-center text-sm text-muted-foreground">
            {t("home.demo.sample")}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
