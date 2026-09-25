// app/components/auth/samples/ExploreCollage.js
//
// "Just exploring" (and no goal picked): the whole product at a glance, as a
// loose collage of cards like the owner's reference image — but every card is
// a REAL piece of FieldQuo with the app-guide harness's rows in it, not an
// illustration:
//
//   AI team          AiTeamRoster (Settings › AI team) — fixtures/ai-team.js
//   Quotes           QuoteListRow (Quotes) — fixtures/work-data.js QUOTES
//   Jobs             JobListRow (Jobs) — work-data.js JOBS
//   Payroll          PayRunRow (Payroll) — fixtures/routes-money.js PAY_RUNS
//   Calendar         SlotCalendar (the booking calendar) over slotGrid's times
//                    for the fixture's opening hours (BookingSample.js),
//                    across both columns
//   AI receptionist  CallRow (Receptionist) — fixtures/routes-grow.js CALLS
//   Lead funnels     FunnelStepListItem + StepPreview (the funnel builder) —
//                    fixtures/funnel.js
//
// Card titles are the nav's own words (app.nav.*), so they read exactly as
// the sidebar a new owner is about to see. No figure on a card is typed here.
//
// ── Layout ─────────────────────────────────────────────────────────────────
//
// White cards on a soft neutral ground, in two loose columns, each tilted a
// degree and overlapping the next a little — from the frame's `md` width up.
// Below it (a phone, or a narrow panel) the same cards stack as a plain list
// with no tilt and no overlap. The frame's width is chosen from the panel's:
// wide enough for the collage, or a phone's width for the list — and because
// the cards are laid out inside the frame's own viewport, the switch is the
// cards' own `md:` classes, not a second layout. Nothing moves on its own,
// so there is nothing for prefers-reduced-motion to switch off.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Briefcase, CalendarDays, FileText, Filter, PhoneCall, Wallet } from "lucide-react";
import AiTeamRoster from "@/app/app/settings/ai-employee/AiTeamRoster";
import QuoteListRow from "@/app/app/quotes/QuoteListRow";
import JobListRow from "@/app/app/jobs/JobListRow";
import PayRunRow from "@/app/app/payroll/PayRunRow";
import CallRow from "@/app/app/receptionist/CallRow";
import StepPreview from "@/app/app/funnels/[id]/StepPreview";
import FunnelStepListItem from "@/app/app/funnels/[id]/FunnelStepListItem";
import SlotCalendar from "@/app/components/public/SlotCalendar";
import { documentTheme, fillPair, washPair } from "@/lib/documents/theme";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { documentFormatters } from "@/lib/i18n/documentLabels";
import { moneyFormatter } from "@/lib/format/money";
import { formatCompanyDate, formatCompanyDateTime } from "@/lib/format/companyDate";
import { useTranslation } from "@/app/hooks/useTranslation";
import { COMPANY, TODAY } from "@/docs/screens/app-guide/harness/fixtures/company.js";
import { QUOTES, JOBS } from "@/docs/screens/app-guide/harness/fixtures/work-data.js";
import { PAY_RUNS } from "@/docs/screens/app-guide/harness/fixtures/routes-money.js";
import { CALLS } from "@/docs/screens/app-guide/harness/fixtures/routes-grow.js";
import { AI_EMPLOYEE } from "@/docs/screens/app-guide/harness/fixtures/ai-team.js";
import { FUNNEL_STEPS } from "@/docs/screens/app-guide/harness/fixtures/funnel.js";
import SampleFrame from "./SampleFrame";
import { sampleSlots } from "./BookingSample";

/** The rows each card draws — exported so the check reads the same rows. */
export function collageSample() {
  return {
    employees: AI_EMPLOYEE.employees,
    quotes: QUOTES.filter((q) => q.status === "sent" || q.status === "accepted" || q.status === "draft").slice(0, 3),
    jobs: JOBS.slice(0, 2),
    payRuns: PAY_RUNS.slice(0, 2),
    // The booked call: the receptionist's work from start to finish.
    call: CALLS.find((c) => c.disposition === "booked") || CALLS[0],
    funnelSteps: FUNNEL_STEPS.slice(0, 3),
    previewStep: FUNNEL_STEPS.find((s) => s.kind === "question_single") || FUNNEL_STEPS[0],
  };
}

const THEME = documentTheme({ brandColor: null });

function Card({ id, icon: Icon, title, index, wide = false, children }) {
  // Alternate a degree either way and pull each card a little over the one
  // above it — from md up only. The z-order follows the reading order, so
  // the card on top is always the one whose header shows.
  const tilt = index % 2 ? "md:rotate-[1deg] md:translate-x-2" : "md:-rotate-[1deg] md:-translate-x-1";
  return (
    <section
      data-collage-card={id}
      className={`relative mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card shadow-lg md:mb-[-6px] ${wide ? "md:mt-6 md:[column-span:all]" : ""} ${tilt}`}
      style={{ zIndex: index + 1 }}
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon size={14} aria-hidden="true" />
        {title}
      </header>
      <div>{children}</div>
    </section>
  );
}

export default function ExploreCollage({ language = "en" }) {
  const { t } = useTranslation();
  const outer = useRef(null);
  const [narrow, setNarrow] = useState(false);
  // Which frame width: the collage needs the frame's md (768px) viewport to
  // lay out in columns, and a panel under ~440px shows that at under half
  // size — so it gets the phone-width list instead.
  // Read on mount and on window resize — the panel's width only changes
  // with the window's (SampleFrame explains why not a ResizeObserver).
  useEffect(() => {
    const el = outer.current;
    if (!el) return undefined;
    const measure = () => setNarrow(el.clientWidth < 440);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const s = useMemo(() => collageSample(), []);
  const money = useMemo(() => moneyFormatter(COMPANY.currency, "en"), []);
  const formatDate = useCallback((v) => formatCompanyDate(v, COMPANY.dateFormat), []);
  const formatDateTime = useCallback((v) => formatCompanyDateTime(v, COMPANY.dateFormat), []);
  const solid = useMemo(() => fillPair(THEME), []);
  const wash = useMemo(() => washPair(THEME), []);
  const copy = useMemo(() => clientDocCopy(language).visit, [language]);
  const loadSlots = useCallback(async (from, to) => sampleSlots(from, to), []);
  const locale = documentFormatters(language).locale;
  // Open on the first day with times, as the business step's sample does.
  const initialDay = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return Object.keys(sampleSlots(ymd(now), ymd(end), { now })).sort()[0] || null;
  }, []);

  const cards = [
    {
      id: "ai-team",
      icon: Bot,
      title: t("app.nav.aiTeam", "AI team"),
      body: (
        <div className="p-3">
          <AiTeamRoster employees={s.employees} selectedId={s.employees[0]?.id} />
        </div>
      ),
    },
    {
      id: "quotes",
      icon: FileText,
      title: t("app.nav.quotes", "Quotes"),
      body: (
        <div className="divide-y divide-border">
          {s.quotes.map((q) => (
            <QuoteListRow key={q.id} quote={q} now={TODAY} money={money} formatDate={formatDate} />
          ))}
        </div>
      ),
    },
    {
      id: "receptionist",
      icon: PhoneCall,
      title: t("app.nav.receptionist", "Receptionist"),
      body: (
        <div className="p-3">
          <CallRow call={s.call} urgent={false} busy={false} formatDateTime={formatDateTime} aiAvailable />
        </div>
      ),
    },
    {
      id: "jobs",
      icon: Briefcase,
      title: t("app.nav.jobs", "Jobs"),
      body: (
        <div className="divide-y divide-border">
          {s.jobs.map((j) => (
            <JobListRow key={j.id} job={j} />
          ))}
        </div>
      ),
    },
    {
      id: "payroll",
      icon: Wallet,
      title: t("app.nav.payroll", "Payroll"),
      body: (
        <div className="divide-y divide-border">
          {s.payRuns.map((r) => (
            <PayRunRow key={r.id} run={r} money={money} />
          ))}
        </div>
      ),
    },
    {
      id: "funnel",
      icon: Filter,
      title: t("app.nav.funnels", "Funnels"),
      body: (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 p-3">
          <div className="space-y-2">
            {s.funnelSteps.map((step, i) => (
              <FunnelStepListItem
                key={step.id}
                step={step}
                selected={step.id === s.previewStep.id}
                isFirst={i === 0}
                isLast={i === s.funnelSteps.length - 1}
                canRemove={false}
                onSelect={() => {}}
                onMoveUp={() => {}}
                onMoveDown={() => {}}
                onRemove={() => {}}
              />
            ))}
          </div>
          <StepPreview step={s.previewStep} accent={THEME.accent} company={null} />
        </div>
      ),
    },
    {
      id: "calendar",
      icon: CalendarDays,
      title: t("app.nav.calendar", "Calendar"),
      // Across both columns: the booking calendar lays out as a month and
      // its times side by side at this frame's width (its own md layout),
      // which a half-width card would crush.
      wide: true,
      body: (
        <div className="p-4" style={{ backgroundColor: THEME.paper }}>
          <SlotCalendar theme={THEME} solid={solid} wash={wash} copy={copy} locale={locale} loadSlots={loadSlots} onPick={() => {}} initialDay={initialDay} />
        </div>
      ),
    },
  ];

  return (
    <div ref={outer} data-collage-layout={narrow ? "list" : "collage"}>
      <SampleFrame
        width={narrow ? 390 : 800}
        maxHeight={narrow ? 2600 : 1400}
        label={t("app.signup.aside.collage.label", "the product at a glance — AI team, quotes, jobs, payroll, calendar, receptionist and lead funnels")}
      >
        <div className="bg-muted p-4 md:p-8">
          <div className="md:columns-2 md:gap-8">
            {cards.map((c, i) => (
              <Card key={c.id} id={c.id} icon={c.icon} title={c.title} index={i} wide={Boolean(c.wide)}>
                {c.body}
              </Card>
            ))}
          </div>
        </div>
      </SampleFrame>
    </div>
  );
}
