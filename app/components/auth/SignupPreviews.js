// app/components/auth/SignupPreviews.js
//
// The live illustrations beside the signup form — one per step, each drawn
// from what the visitor has typed so far (app/components/auth/AuthAside.js
// decides which one is on screen).
//
// ══ What the owner asked for ═══════════════════════════════════════════════
//
// "Look at the side screens that those companies have when the user is
// signing up — when they ask how many employees the calendar changes to
// reflect that; the type of trade, it shows a sample of the invoice... can we
// make our screens like that and explain how each feature helps them too?"
//
// So: a calendar that changes shape with the team-size chip, a sample quote
// whose two lines are the trade's own services, an email with their company
// name in the From line the moment they type it, a booking page with the tax
// line their province actually carries.
//
// ══ Rules the pictures follow ══════════════════════════════════════════════
//
//   · OUR look, not a screenshot. The quote is drawn with the same
//     DocumentFrame / DocumentMasthead / DocumentScopeGroup / DocumentTotals
//     the quote page and the builder compose (app/components/document/
//     QuoteDocument.js); the board and the week grid copy the scheduler's
//     tokens (app/app/scheduler/DayBoard.js, WeekGrid.js); the price book
//     copies Settings > Products' rows. A picture of a different product is
//     a claim about a different product.
//   · No number we cannot back. The quote's amounts are labelled sample
//     amounts and are round placeholders — never the seed benchmark, which
//     never reaches the browser (lib/signup/sampleServices.js). The price
//     book's rate column says "Set your rate" rather than a figure. The tax
//     line is the real lookup for the address or nothing (taxPreviewFor).
//   · Their words where they have typed them: company name, first name,
//     province. Otherwise a neutral placeholder that says it is one.
//   · Nothing here says FieldQuo inside the client-facing mock-ups — the
//     email, the booking page and the quote are what a homeowner would see,
//     and the product is white-label (AGENTS.md).
//
// Every component is presentational and takes plain props, so
// scripts/check-signup-aside.mjs renders each one with react-dom/server.
"use client";

import {
  ArrowRight,
  Camera,
  CalendarDays,
  Check,
  Clock,
  Inbox,
  MessageSquare,
  Phone,
  Users,
  Wallet,
} from "lucide-react";
import {
  DocumentFrame,
  DocumentMasthead,
  DocumentParties,
  DocumentScopeGroup,
  DocumentTotals,
} from "@/app/components/document/QuoteDocument";
import { documentLabels } from "@/lib/i18n/documentLabels";
import { emailCopy } from "@/lib/i18n/emailCopy";
import { calendarShapeForBand, taxPreviewFor, teamSizeBand } from "@/lib/signup/signupPreview";
import { useTranslation } from "@/app/hooks/useTranslation";

// A frame every picture sits in: the app's card, a small "Sample" tag so
// nobody mistakes the picture for their data. The tag sits ON the frame's
// top border, not inside it, so it never covers a picture's own header.
function Frame({ t, children, tag = true, className = "" }) {
  return (
    <div className={`relative rounded-xl border border-border bg-background p-3 sm:p-4 ${className}`} data-signup-preview>
      {tag ? (
        <span className="absolute right-3 -top-2.5 z-10 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("app.signup.aside.sample", "Sample")}
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** The company's name as typed, or the placeholder that says it is one. */
function companyNameOf(form, t) {
  const name = String(form?.companyName || "").trim();
  return name || t("app.signup.aside.email.yourCompany", "Your company name");
}

const SAMPLE_CLIENT = "Jane Doe";
const SAMPLE_NUMBER = "Q-1001";

// ══ Account step: the email the client gets ═══════════════════════════════

/**
 * The covering email as the homeowner's inbox shows it: From is the
 * company's name (lib/email/resend.js puts `${company.name} <…>` on every
 * document email), the subject is the real quote-email wording for the
 * form's language (lib/i18n/emailCopy.js), the body is the real intro line
 * and the real button label. The link goes nowhere: this is a picture.
 */
export function EmailPreview({ form, language = "en" }) {
  const { t } = useTranslation();
  const company = companyNameOf(form, t);
  const copy = emailCopy(language);
  const first = String(form?.firstName || "").trim();
  return (
    <Frame t={t}>
      <div className="rounded-lg border border-border bg-card overflow-hidden text-[13px]">
        <div className="border-b border-border px-3 py-2 space-y-1">
          <p className="truncate">
            <span className="text-muted-foreground">{t("app.signup.aside.email.from", "From")}: </span>
            <span className="font-semibold text-foreground" data-email-from>{company}</span>
          </p>
          <p className="truncate text-muted-foreground">
            {t("app.signup.aside.email.to", "To")}: {SAMPLE_CLIENT}
          </p>
          <p className="truncate">
            <span className="text-muted-foreground">{t("app.signup.aside.email.subject", "Subject")}: </span>
            <span className="text-foreground">{copy.quoteSubject(company, SAMPLE_NUMBER)}</span>
          </p>
        </div>
        <div className="px-3 py-3 space-y-2">
          <p className="text-foreground">{copy.greeting(SAMPLE_CLIENT.split(" ")[0])}</p>
          <p className="text-muted-foreground leading-relaxed">{copy.quoteIntro()}</p>
          <span className="inline-flex items-center rounded-full bg-inverted px-4 py-2 text-xs font-semibold text-inverted-foreground">
            {copy.quoteCta}
          </span>
          <p className="pt-1 text-muted-foreground">
            {first ? `${first} · ` : ""}
            {company}
          </p>
        </div>
      </div>
    </Frame>
  );
}

// ══ Business step: the booking page, with the tax line for the address ════

/**
 * The public booking page in miniature — the company's name over a month
 * grid and three time chips (app/components/public/SlotCalendar.js's shape),
 * and under it the tax line the quote builder will print for this address.
 * `taxLine` is taxPreviewFor's answer or null; null prints no line at all.
 */
export function BookingPreview({ form, language = "en" }) {
  const { t } = useTranslation();
  const company = companyNameOf(form, t);
  const tax = taxPreviewFor({ country: form?.country, province: form?.province }, language);
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <Frame t={t}>
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-sm font-semibold text-foreground truncate" data-booking-title>
          {t("app.signup.aside.booking.title", "Book a visit with {company}", { company })}
        </p>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
          <div>
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((d, i) => (
                <span key={i} className="text-center text-[9px] font-bold uppercase text-muted-foreground">{d}</span>
              ))}
              {Array.from({ length: 28 }, (_, i) => (
                <span
                  key={i}
                  className={`h-4 rounded text-center text-[9px] leading-4 tabular-nums ${
                    i === 9 ? "bg-inverted text-inverted-foreground font-semibold" : i % 7 >= 5 ? "text-muted-foreground/50" : "text-foreground"
                  }`}
                >
                  {i + 1}
                </span>
              ))}
            </div>
          </div>
          <div className="w-[5.5rem] space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              {t("app.signup.aside.booking.pickTime", "Pick a time")}
            </p>
            {["8:00", "10:30", "13:00"].map((h, i) => (
              <span
                key={h}
                className={`block rounded-md border px-2 py-1 text-center text-[11px] tabular-nums ${
                  i === 1 ? "border-inverted bg-inverted text-inverted-foreground" : "border-border text-foreground"
                }`}
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      </div>
      {tax ? (
        <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2" data-tax-line>
          <p className="text-[13px] text-foreground">
            {t("app.signup.aside.booking.taxLine", "Tax on your quotes: {line}", { line: t(tax.key, tax.params) })}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {tax.cautionKey
              ? t(tax.cautionKey)
              : t("app.signup.aside.booking.taxSource", "Worked out from your address — change it any time in Settings.")}
          </p>
        </div>
      ) : null}
    </Frame>
  );
}

// ══ Team step: the calendar that changes shape, and the payroll line ══════

const CREW_NAMES = ["Priya", "Marco", "Dee", "Sam", "Lena", "Tomas", "Ana", "Kofi"];
// The scheduler's own per-job tones (lib/shifts/jobTone.js TONES), by index
// rather than by a hashed id — a fixture has no ids.
const TONES = [
  "bg-blue-100 text-blue-950 dark:bg-blue-900/60 dark:text-blue-100",
  "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-100",
  "bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-100",
  "bg-purple-100 text-purple-950 dark:bg-purple-900/60 dark:text-purple-100",
  "bg-rose-100 text-rose-950 dark:bg-rose-900/60 dark:text-rose-100",
  "bg-cyan-100 text-cyan-950 dark:bg-cyan-900/60 dark:text-cyan-100",
];

function jobLabels(t) {
  return [
    t("app.signup.aside.calendar.job1", "Estimate visit"),
    t("app.signup.aside.calendar.job2", "Job — day 1"),
    t("app.signup.aside.calendar.job3", "Job — day 2"),
    t("app.signup.aside.calendar.job4", "Follow-up"),
    t("app.signup.aside.calendar.job5", "Materials pickup"),
    t("app.signup.aside.calendar.job6", "Warranty visit"),
  ];
}

function initialsOf(name) {
  return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

/** The people on the preview: the visitor first, by name when typed. */
function peopleFor(form, rows, t) {
  const you = String(form?.firstName || "").trim() || t("app.signup.aside.calendar.you", "You");
  return [you, ...CREW_NAMES].slice(0, rows);
}

function NameCell({ name, title }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
        {initialsOf(name)}
      </span>
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-foreground">{name}</div>
        {title ? <div className="truncate text-[10px] text-muted-foreground">{title}</div> : null}
      </div>
    </div>
  );
}

/** One person's week: seven columns, blocks on four of them (WeekGrid's shape). */
function WeekView({ form, t }) {
  const [you] = peopleFor(form, 1, t);
  const jobs = jobLabels(t);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const blocks = { 0: [jobs[0]], 1: [jobs[1]], 2: [jobs[2]], 4: [jobs[3]] };
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <NameCell name={you} />
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
          {t("app.signup.aside.calendar.week", "Week")}
        </span>
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => (
          <div key={d} className={`min-h-[5.5rem] border-r border-border p-1 last:border-r-0 ${i === 2 ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""}`}>
            <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{d}</div>
            {(blocks[i] || []).map((label, j) => (
              <div key={j} className={`mt-1 rounded-md px-1 py-1 ${TONES[(i + j) % TONES.length]}`}>
                <div className="text-[9px] font-semibold tabular-nums leading-tight">8AM – 3PM</div>
                <div className="truncate text-[8px] font-bold uppercase tracking-wide opacity-80">{label}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A day with a named column per person: the two-to-five shape. */
function DayView({ form, rows, t }) {
  const people = peopleFor(form, rows, t);
  const jobs = jobLabels(t);
  const hours = ["8", "10", "12", "2"];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-foreground">Wed · 12</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
          {t("app.signup.aside.calendar.day", "Day")}
        </span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `2rem repeat(${people.length}, minmax(0, 1fr))` }}>
        <div className="border-r border-border" />
        {people.map((p) => (
          <div key={p} className="border-b border-r border-border px-2 py-1.5 last:border-r-0">
            <NameCell name={p} />
          </div>
        ))}
        {hours.map((h, r) => (
          <div key={h} className="contents">
            <div className="border-r border-border px-1 pt-1 text-[9px] text-muted-foreground tabular-nums">{h}</div>
            {people.map((p, c) => {
              const on = (r + c) % 3 !== 1;
              return (
                <div key={p} className="h-9 border-b border-r border-border/60 p-0.5 last:border-r-0">
                  {on ? (
                    <div className={`h-full rounded px-1 py-0.5 ${TONES[(r + c) % TONES.length]}`}>
                      <div className="truncate text-[8px] font-bold uppercase tracking-wide opacity-80">{jobs[(r + c) % jobs.length]}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The dispatch board: a row per person, an hour per column, shift blocks in
 * the scheduler's sky blue with a hatched lunch, OUT for approved leave.
 * `grouped` puts the rows under crew headings for the sixteen-plus band.
 */
function BoardView({ form, rows, grouped, t }) {
  const people = peopleFor(form, rows, t);
  const hours = ["7", "8", "9", "10", "11", "12", "1", "2", "3", "4"];
  const groups = grouped
    ? [people.slice(0, Math.ceil(people.length / 2)), people.slice(Math.ceil(people.length / 2))]
    : [people];
  let row = 0;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-foreground">Wed · 12</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
          {t("app.signup.aside.calendar.board", "Dispatch board")}
        </span>
      </div>
      <div className="flex border-b border-border">
        <div className="w-24 shrink-0 border-r border-border px-2 py-1 text-[9px] text-muted-foreground">&nbsp;</div>
        <div className="flex flex-1">
          {hours.map((h) => (
            <div key={h} className="flex-1 border-l border-border/60 pl-0.5 text-[9px] leading-5 text-muted-foreground tabular-nums">{h}</div>
          ))}
        </div>
      </div>
      {groups.map((members, g) => (
        <div key={g}>
          {grouped ? (
            <div className="border-b border-border bg-muted/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {t("app.signup.aside.calendar.crew", "Crew {n}", { n: g + 1 })}
            </div>
          ) : null}
          {members.map((p) => {
            const i = row++;
            const out = i === 4;
            const start = i % 3;
            return (
              <div key={p} className="flex border-b border-border last:border-b-0" data-board-row>
                <div className="w-24 shrink-0 border-r border-border px-2 py-1.5">
                  <NameCell name={p} />
                </div>
                <div className="relative flex-1" style={{ height: 34 }}>
                  {hours.map((h, c) => (
                    <div key={h} className="absolute inset-y-0 border-l border-border/40" style={{ left: `${(c / hours.length) * 100}%`, width: `${100 / hours.length}%` }} />
                  ))}
                  {out ? (
                    <div className="absolute inset-x-1 top-1 flex h-[26px] items-center justify-center rounded-md border border-border bg-muted text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("app.signup.aside.calendar.out", "Out")}
                    </div>
                  ) : (
                    <div
                      className="absolute top-1 flex h-[26px] items-center overflow-hidden rounded-md border border-sky-400 bg-sky-100 px-1.5 text-[9px] font-semibold text-sky-950 dark:bg-sky-900/50 dark:text-sky-100"
                      style={{ left: `${(start / hours.length) * 100}%`, width: `${(7 / hours.length) * 100}%` }}
                    >
                      <span className="truncate">{jobLabels(t)[i % 6]}</span>
                      <span
                        className="absolute inset-y-0 border-x border-amber-600/60"
                        style={{
                          left: "55%",
                          width: "10%",
                          backgroundImage: "repeating-linear-gradient(135deg, rgba(217,119,6,.35) 0 3px, transparent 3px 6px)",
                        }}
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** "Clock in → hours → pay run": the timesheet becomes the pay run. */
function PayrollLine({ t }) {
  const steps = [
    [Clock, t("app.signup.aside.payroll.clockIn", "Clock in"), "7:32"],
    [CalendarDays, t("app.signup.aside.payroll.hours", "Hours"), "38.5 h"],
    [Wallet, t("app.signup.aside.payroll.payRun", "Pay run"), "Fri"],
  ];
  return (
    <div className="mt-3" data-payroll-line>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1">
        {steps.map(([Icon, label, value], i) => (
          <div key={label} className="contents">
            {i > 0 ? <ArrowRight size={14} className="text-muted-foreground" aria-hidden="true" /> : null}
            <div className="rounded-lg border border-border bg-card px-2 py-1.5 text-center">
              <Icon size={14} className="mx-auto text-muted-foreground" aria-hidden="true" />
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="text-xs font-bold tabular-nums text-foreground">{value}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {t("app.signup.aside.payroll.caption", "Hours clock in from the field and land on the pay run — nothing re-typed.")}
      </p>
    </div>
  );
}

/**
 * The calendar for a team-size band: week for one, day columns for a few,
 * the dispatch board from six, grouped by crew from sixteen — plus the
 * payroll line under every one of them.
 */
export function CalendarPreview({ form, band }) {
  const { t } = useTranslation();
  const shape = calendarShapeForBand(band);
  const rows = teamSizeBand(band)?.rows || 1;
  return (
    <Frame t={t}>
      <div data-calendar-shape={shape}>
        {shape === "week" ? <WeekView form={form} t={t} /> : null}
        {shape === "day" ? <DayView form={form} rows={rows} t={t} /> : null}
        {shape === "board" ? <BoardView form={form} rows={rows} grouped={false} t={t} /> : null}
        {shape === "grouped" ? <BoardView form={form} rows={rows} grouped t={t} /> : null}
      </div>
      <PayrollLine t={t} />
    </Frame>
  );
}

// ══ Trades step: the sample quote in the document look ════════════════════

// Placeholders, said to be placeholders — and deliberately figures that no
// seed carries as a low, median or high, so a reader who knows the benchmark
// library cannot mistake them for it (check:signup-aside asserts the
// disjointness against every seed). The seeds themselves stay on the server
// (lib/signup/sampleServices.js).
export const SAMPLE_AMOUNTS = [1180, 740];

/**
 * @param services   [{ name, description }] from /api/signup/sample-services,
 *                   or [] — then `fallbackLines` (the page's quote-type
 *                   labels for the trade) stand in, and nothing is invented.
 * @param groupLabel the trade's name, as the scope-group heading
 */
export function QuoteSamplePreview({ form, language = "en", services = [], fallbackLines = [], groupLabel = "", currency = "" }) {
  const { t } = useTranslation();
  const company = { name: companyNameOf(form, t), phone: form?.phone || "", address: form?.city ? [form.city, form.province].filter(Boolean).join(", ") : "" };
  const L = documentLabels(language);
  const lines = (services.length ? services : fallbackLines.map((name) => ({ name, description: "" })))
    .slice(0, 2)
    .map((s, i) => ({ description: s.name, detail: s.description || "", amount: SAMPLE_AMOUNTS[i] ?? 0, quantity: 1 }));
  const symbol = currency === "USD" || currency === "CAD" || !currency ? "$" : `${currency} `;
  const money = (n) => `${symbol}${Number(n).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const next = [
    t("app.signup.aside.doc.next1", "Approve online — one tap, nothing to print."),
    t("app.signup.aside.doc.next2", "The visit is booked and you both get a reminder."),
    t("app.signup.aside.doc.next3", "Pay the invoice online when the work is done."),
  ];
  return (
    <Frame t={t} className="p-2 sm:p-3">
      <div className="text-[13px]">
        <DocumentFrame company={{ brandColor: null }}>
          <DocumentMasthead
            company={company}
            word={L.quote.toUpperCase()}
            number={SAMPLE_NUMBER}
            meta={[
              { label: L.date, value: "—" },
              { label: L.validUntil, value: "—" },
            ]}
          />
          <DocumentParties
            label={L.preparedFor}
            client={{ name: SAMPLE_CLIENT }}
            jobAddress={{ label: L.jobAddress, value: "123 Maple St" }}
          />
          <div className="px-5 sm:px-7 py-4 space-y-3">
            {lines.length ? (
              <DocumentScopeGroup label={groupLabel || L.scopeOfWork} subtotal={subtotal} lines={lines} money={money} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("app.signup.aside.doc.pickTrade", "Pick a trade to see its services here.")}</p>
            )}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{L.beforeAfter}</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {[
                  t("app.signup.aside.doc.photo.before", "Before"),
                  t("app.signup.aside.doc.photo.after", "After"),
                  t("app.signup.aside.doc.photo.materials", "Materials"),
                ].map((label) => (
                  <div key={label} className="flex aspect-[4/3] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/50 text-muted-foreground">
                    <Camera size={16} aria-hidden="true" />
                    <span className="mt-1 text-[10px]">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("app.signup.aside.doc.next", "What happens next")}
              </p>
              <ol className="mt-1.5 space-y-1">
                {next.map((line, i) => (
                  <li key={i} className="flex gap-2 text-xs text-foreground">
                    <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-inverted text-[9px] font-bold text-inverted-foreground tabular-nums">{i + 1}</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          {lines.length ? (
            <DocumentTotals
              rows={[
                { key: "subtotal", label: L.subtotal, value: money(subtotal) },
                { key: "tax", label: L.tax, value: "—" },
              ]}
              total={{ label: L.total, value: money(subtotal) }}
            />
          ) : null}
        </DocumentFrame>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {t("app.signup.aside.sampleAmounts", "Sample amounts — your prices are yours to set.")}
      </p>
    </Frame>
  );
}

// ══ Services step: the price book ═════════════════════════════════════════

/**
 * Settings > Products' catalogue rows, one per chosen quote type: the
 * service, a unit chip, and a rate column that says "Set your rate" — no
 * figure, because there is none yet and a placeholder number would be the
 * padded default this codebase is swept for.
 */
export function PriceBookPreview({ labels = [] }) {
  const { t } = useTranslation();
  const rows = labels.slice(0, 5);
  return (
    <Frame t={t}>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>{t("app.signup.aside.pricebook.service", "Service")}</span>
          <span>{t("app.signup.aside.pricebook.rate", "Your rate")}</span>
          <span className="hidden sm:inline">{t("app.signup.aside.pricebook.margin", "Cost · margin")}</span>
        </div>
        <div className="divide-y divide-border">
          {rows.length ? (
            rows.map((label) => (
              <div key={label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2" data-pricebook-row>
                <span className="min-w-0 truncate text-sm font-medium text-foreground">{label}</span>
                <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {t("app.signup.aside.pricebook.setRate", "Set your rate")}
                </span>
                <span className="hidden select-none text-xs text-muted-foreground blur-[3px] sm:inline" aria-hidden="true">
                  $ ··· · ·· %
                </span>
              </div>
            ))
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {t("app.signup.aside.pricebook.empty", "Tick a quote type and it appears here.")}
            </p>
          )}
        </div>
      </div>
    </Frame>
  );
}

// ══ Goals step: the part of the product that answers the goal ═════════════

function Pipeline({ t }) {
  const stages = [
    t("app.signup.aside.pipeline.lead", "Lead"),
    t("app.signup.aside.pipeline.quote", "Quote"),
    t("app.signup.aside.pipeline.job", "Job"),
    t("app.signup.aside.pipeline.invoice", "Invoice"),
    t("app.signup.aside.pipeline.paid", "Paid"),
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-pipeline>
      {stages.map((s, i) => (
        <div key={s} className="contents">
          {i > 0 ? <ArrowRight size={14} className="text-muted-foreground" aria-hidden="true" /> : null}
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${i === 4 ? "border-inverted bg-inverted text-inverted-foreground" : "border-border bg-card text-foreground"}`}>
            {s}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The dashboard's figure cards — the shape of app/components/dashboard, with sample figures. */
function InsightsMock({ t }) {
  const cards = [
    [t("app.signup.aside.insights.revenue", "Revenue this month"), "$ 12,400"],
    [t("app.signup.aside.insights.awaiting", "Quotes awaiting approval"), "4"],
    [t("app.signup.aside.insights.booked", "Jobs booked this week"), "6"],
    [t("app.signup.aside.insights.overdue", "Invoices overdue"), "1"],
  ];
  return (
    <div className="grid grid-cols-2 gap-2" data-insights>
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-border bg-card px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-lg font-bold tabular-nums text-foreground">{value}</div>
        </div>
      ))}
    </div>
  );
}

/** The AI team's routing picture (app/components/aiEmployee/TeamFlow.js's shape). */
function InboxMock({ t }) {
  const channels = [
    [Phone, t("app.signup.aside.ai.calls", "Calls")],
    [MessageSquare, t("app.signup.aside.ai.texts", "Texts")],
    [Inbox, t("app.signup.aside.ai.web", "Web form")],
  ];
  const intents = [
    t("app.signup.aside.ai.newLead", "New lead"),
    t("app.signup.aside.ai.booking", "Booking request"),
    t("app.signup.aside.ai.question", "Question"),
  ];
  return (
    <div className="space-y-2" data-inbox>
      <div className="grid grid-cols-3 gap-2">
        {channels.map(([Icon, label]) => (
          <div key={label} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground">
            <Icon size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-center text-muted-foreground"><ArrowRight size={14} className="rotate-90" aria-hidden="true" /></div>
      <div className="rounded-lg border border-border bg-card px-3 py-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t("app.signup.aside.ai.frontDesk", "Front desk")}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {intents.map((i) => (
            <span key={i} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground">{i}</span>
          ))}
        </div>
      </div>
      <div className="flex justify-center text-muted-foreground"><ArrowRight size={14} className="rotate-90" aria-hidden="true" /></div>
      <div className="flex items-center gap-2 rounded-lg border border-inverted bg-card px-3 py-2 text-xs font-semibold text-foreground">
        <Users size={14} aria-hidden="true" />
        {t("app.signup.aside.ai.you", "You — one inbox, every conversation answered")}
      </div>
    </div>
  );
}

/**
 * The picture for a goal. `look_professional` reuses the sample quote in
 * miniature (the caller passes its props through), `feel_in_control` the
 * dashboard, `win_more_jobs` the inbox; no goal and "exploring" get the
 * pipeline the whole product serves.
 */
export function GoalPreview({ goal, quoteProps = null }) {
  const { t } = useTranslation();
  if (goal === "look_professional" && quoteProps) return <QuoteSamplePreview {...quoteProps} />;
  return (
    <Frame t={t}>
      {goal === "feel_in_control" ? <InsightsMock t={t} /> : goal === "win_more_jobs" ? <InboxMock t={t} /> : <Pipeline t={t} />}
    </Frame>
  );
}

// ══ Small shared pieces ════════════════════════════════════════════════════

/** A chip row: the Team and Goals steps' answers. One pick, or none. */
export function ChoiceChips({ options, value, onChange, name }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={name}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button
            type="button"
            key={o.key}
            onClick={() => onChange(on ? null : o.key)}
            aria-pressed={on}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              on ? "border-inverted bg-inverted text-inverted-foreground font-medium" : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {on ? <Check size={14} className="mr-1 inline -mt-0.5" aria-hidden="true" /> : null}
            {t(o.labelKey, o.label)}
          </button>
        );
      })}
    </div>
  );
}
