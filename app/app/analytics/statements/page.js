// app/(app)/analytics/statements/page.js
//
// Profit and loss, cash flow, sales tax collected and as much of a balance
// sheet as the data honestly supports — the four documents an accountant, a
// lender or a broker asks for.
//
// ── Two rules this screen exists to keep ───────────────────────────────────
//
// 1. The accounting basis is never implicit. It is a control at the top, a
//    sentence under it, and it is repeated on the P&L itself. A reader who
//    cannot say whether they are holding a cash or an accrual statement is
//    holding neither.
//
// 2. Nothing renders as "$0.00" unless zero is a fact. The API distinguishes
//    three states — a figure, "nothing recorded", and "unavailable" — and
//    `Amount` below is the only place that decides how each one looks, so a new
//    line cannot accidentally print an unknown as a zero. That is the whole
//    point of the shape; a second renderer would be the copy that rots.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronRight, Info } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatAppMoney } from "@/lib/format/money";
import { useTranslation } from "@/app/hooks/useTranslation";

// ── Periods ────────────────────────────────────────────────────────────────
//
// Built in UTC to match the server, which decides range membership on UTC
// calendar days (lib/export/accountingExport.js says why). Building "this
// month" from the browser's local clock would put an invoice on the wrong side
// of a boundary for anyone west of Greenwich, and the two screens would then
// disagree about the same month.
const iso = (d) => d.toISOString().slice(0, 10);
const utc = (y, m, day) => new Date(Date.UTC(y, m, day));

function presetRange(key, now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (key) {
    case "thisMonth":
      return { from: iso(utc(y, m, 1)), to: iso(utc(y, m + 1, 0)) };
    case "lastMonth":
      return { from: iso(utc(y, m - 1, 1)), to: iso(utc(y, m, 0)) };
    case "thisQuarter": {
      const q = Math.floor(m / 3) * 3;
      return { from: iso(utc(y, q, 1)), to: iso(utc(y, q + 3, 0)) };
    }
    case "yearToDate":
      return { from: iso(utc(y, 0, 1)), to: iso(utc(y, m, now.getUTCDate())) };
    case "lastYear":
      return { from: iso(utc(y - 1, 0, 1)), to: iso(utc(y - 1, 11, 31)) };
    default:
      return { from: iso(utc(y, m, 1)), to: iso(utc(y, m + 1, 0)) };
  }
}

const PRESETS = [
  ["thisMonth", "This month"],
  ["lastMonth", "Last month"],
  ["thisQuarter", "This quarter"],
  ["yearToDate", "Year to date"],
  ["lastYear", "Last year"],
];

// The API's `reason` codes, turned into a sentence. Anything unmapped falls
// through to the code itself rather than to a generic "unavailable" — an
// unexplained blank is what this whole screen is against, and a raw code at
// least tells whoever is reading the bug report which branch produced it.
const REASONS = {
  payroll_restricted: "Your access doesn't include everyone's pay",
  labour_exceeds_payroll: "Timesheets and pay runs disagree for this period",
  no_interest_rate: "No interest rate recorded on the loan",
  not_recorded: "FieldQuo doesn't record this",
  not_in_this_report: "Not read by this statement",
  no_remittance_record: "Nothing records what has been remitted",
  requires_complete_sides: "Both sides of the balance sheet would have to be complete",
  incomplete_sections: "Some lines in this section are unavailable",
};

export default function StatementsPage() {
  const { t, language } = useTranslation();
  const [preset, setPreset] = useState("thisMonth");
  const [range, setRange] = useState(() => presetRange("thisMonth"));
  const [basis, setBasis] = useState("cash");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchJson(
        `/api/analytics/statements?from=${range.from}&to=${range.to}&basis=${basis}`,
      );
      setData(res);
    } catch (err) {
      // fetchJson always carries a readable message; there is deliberately no
      // silent `if (res.ok)` branch here (AGENTS.md failure class 2).
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, basis]);

  useEffect(() => {
    load();
  }, [load]);

  const currency = data?.currency || null;
  const money = useMemo(
    () => (amount) => formatAppMoney(amount, currency, language),
    [currency, language],
  );

  const choosePreset = (key) => {
    setPreset(key);
    setRange(presetRange(key));
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg md:text-xl font-semibold">
          {t("app.statements.title", "Financial statements")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.statements.subtitle",
            "Your profit and loss, cash flow, sales tax and balance sheet, built from what FieldQuo already records. Every figure says what is inside it.",
          )}
        </p>
        <Link
          href="/app/analytics/benchmark"
          className="inline-flex items-center gap-1.5 text-sm text-foreground underline mt-2"
        >
          {t("app.statements.backToInsights", "How you compare")}
        </Link>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="glass-effect rounded-lg p-4 mb-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => choosePreset(key)}
              className={`text-sm px-3 py-1.5 rounded-lg border ${
                preset === key
                  ? "bg-inverted text-inverted-foreground border-transparent font-semibold"
                  : "border-border text-muted-foreground"
              }`}
            >
              {t(`app.statements.preset.${key}`, label)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">
              {t("app.statements.from", "From")}
            </span>
            <input
              type="date"
              value={range.from}
              onChange={(e) => {
                setPreset("custom");
                setRange((r) => ({ ...r, from: e.target.value }));
              }}
              className="border border-border rounded-lg px-2 py-1.5 bg-transparent"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">
              {t("app.statements.to", "To")}
            </span>
            <input
              type="date"
              value={range.to}
              onChange={(e) => {
                setPreset("custom");
                setRange((r) => ({ ...r, to: e.target.value }));
              }}
              className="border border-border rounded-lg px-2 py-1.5 bg-transparent"
            />
          </label>

          {/* The basis control is never a hidden default. See the file header. */}
          <div className="text-sm">
            <span className="block text-xs text-muted-foreground mb-1">
              {t("app.statements.basisLabel", "Accounting basis")}
            </span>
            <div className="flex">
              {[
                ["cash", t("app.statements.basis.cash", "Cash")],
                ["accrual", t("app.statements.basis.accrual", "Accrual")],
              ].map(([key, label], i) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBasis(key)}
                  className={`px-3 py-1.5 border border-border ${i === 0 ? "rounded-l-lg" : "rounded-r-lg border-l-0"} ${
                    basis === key ? "bg-inverted text-inverted-foreground font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 mb-6 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 bg-accent rounded" />
          <div className="h-40 bg-accent rounded-lg" />
          <div className="h-40 bg-accent rounded-lg" />
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* The basis, said in a full sentence, above everything it governs. */}
          <div className="glass-effect rounded-lg p-4 mb-4 text-sm flex gap-2">
            <Info size={16} className="shrink-0 mt-0.5 text-muted-foreground" />
            <div>
              <p>{data.basisStatement}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t(
                  "app.statements.periodLine",
                  "{from} to {to}, in {currency}.",
                  { from: data.range.from, to: data.range.to, currency: data.currency },
                )}
              </p>
            </div>
          </div>

          {data.mixedBasisWarning && (
            <Banner tone="amber" text={data.mixedBasisWarning} />
          )}

          {data.empty ? (
            <div className="glass-effect rounded-lg p-6 text-sm">
              {data.emptyStatement}
            </div>
          ) : (
            <div className="space-y-4">
              <ProfitAndLoss data={data} money={money} t={t} />
              <CashFlow data={data} money={money} t={t} />
              <SalesTax data={data} money={money} t={t} />
              <BalanceSheet data={data} money={money} t={t} />
            </div>
          )}

          {data.warnings?.length > 0 && (
            <section className="glass-effect rounded-lg p-4 mt-4">
              <h2 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                {t("app.statements.warnings", "Things that affect these figures")}
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {data.warnings.map((w, i) => (
                  <li key={`${w.code}-${i}`}>{w.message}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────────────

function Banner({ tone, text }) {
  const cls =
    tone === "amber"
      ? "border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
      : "border-border";
  return <div className={`rounded-lg border px-4 py-3 mb-4 text-sm ${cls}`}>{text}</div>;
}

/**
 * The one place a money value becomes text.
 *
 * Three outcomes, and they must never collapse into each other:
 *   available:false → the reason, never a number
 *   stated:false    → "none recorded", never "$0.00"
 *   otherwise       → the formatted amount
 */
function Amount({ figure, money, t }) {
  if (!figure) return null;
  if (!figure.available) {
    return (
      <span className="text-muted-foreground italic text-sm">
        {t("app.statements.unavailable", "Unavailable")}
        {figure.reason ? ` — ${REASONS[figure.reason] || figure.reason}` : ""}
      </span>
    );
  }
  if (figure.stated === false) {
    return (
      <span className="text-muted-foreground italic text-sm">
        {t("app.statements.noneRecorded", "None recorded")}
      </span>
    );
  }
  return <span className="tabular-nums">{money(figure.amount)}</span>;
}

/** One line, openable to show what composes it and what it leaves out. */
function Line({ figure, money, t, strong = false, indent = false }) {
  const [open, setOpen] = useState(false);
  if (!figure) return null;
  const detail =
    (figure.components?.length || 0) +
    (figure.includes?.length || 0) +
    (figure.excludes?.length || 0) +
    (figure.missing?.length || 0);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className={`border-b border-border/60 last:border-0 ${indent ? "pl-4" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={detail === 0}
        className="w-full flex items-center gap-2 py-2 text-left disabled:cursor-default"
      >
        {detail > 0 ? (
          <Chevron size={14} className="shrink-0 text-muted-foreground" />
        ) : (
          <span className="w-[14px] shrink-0" />
        )}
        <span className={`flex-1 text-sm ${strong ? "font-semibold" : ""}`}>
          {figure.label}
          {figure.count ? (
            <span className="text-xs text-muted-foreground ml-2">
              {t("app.statements.rowCount", "{count} rows", { count: figure.count })}
            </span>
          ) : null}
          {figure.complete === false || figure.partial ? (
            <span className="text-xs ml-2 text-amber-700 dark:text-amber-400">
              {t("app.statements.incomplete", "incomplete")}
            </span>
          ) : null}
        </span>
        <span className={strong ? "font-semibold" : ""}>
          <Amount figure={figure} money={money} t={t} />
        </span>
      </button>

      {open && (
        <div className="pl-6 pb-3 space-y-2 text-xs text-muted-foreground">
          {figure.components?.length > 0 && (
            <div>
              <div className="font-medium text-foreground mb-1">
                {t("app.statements.madeUpOf", "Made up of")}
              </div>
              <ul className="space-y-0.5">
                {figure.components.map((c, i) => (
                  <li key={`${c.label}-${i}`} className="flex justify-between gap-4">
                    <span>{c.label}</span>
                    <span className="tabular-nums">{money(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {figure.from?.length > 0 && (
            <div>
              <div className="font-medium text-foreground mb-1">
                {t("app.statements.addedUpFrom", "Added up from")}
              </div>
              <ul className="space-y-0.5">
                {figure.from.map((f, i) => (
                  <li key={`${f.line}-${i}`} className="flex justify-between gap-4">
                    <span>
                      {f.sign < 0 ? "− " : "+ "}
                      {f.line}
                    </span>
                    <span className="tabular-nums">{money(f.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {figure.missing?.length > 0 && (
            <div>
              <div className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                {t("app.statements.notIncluded", "Could not be included")}
              </div>
              <ul className="space-y-0.5">
                {figure.missing.map((m, i) => (
                  <li key={`${m.line}-${i}`}>
                    {m.line} — {REASONS[m.reason] || m.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {figure.includes?.length > 0 && (
            <div>
              <div className="font-medium text-foreground mb-1">
                {t("app.statements.includes", "Includes")}
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                {figure.includes.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {figure.excludes?.length > 0 && (
            <div>
              <div className="font-medium text-foreground mb-1">
                {t("app.statements.excludes", "Does not include")}
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                {figure.excludes.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <section className="glass-effect rounded-lg p-4">
      <h2 className="font-semibold mb-1">{title}</h2>
      {note && <p className="text-xs text-muted-foreground mb-3">{note}</p>}
      <div>{children}</div>
    </section>
  );
}

function ProfitAndLoss({ data, money, t }) {
  const p = data.profitAndLoss;
  return (
    <Section
      title={t("app.statements.pl.title", "Profit and loss")}
      note={t("app.statements.pl.note", "{basis} basis.", {
        basis:
          data.basis === "cash"
            ? t("app.statements.basis.cash", "Cash")
            : t("app.statements.basis.accrual", "Accrual"),
      })}
    >
      <Line figure={p.revenue} money={money} t={t} strong />
      <Line figure={p.costOfWorkDone.materials} money={money} t={t} indent />
      <Line figure={p.costOfWorkDone.labour} money={money} t={t} indent />
      <Line figure={p.costOfWorkDone.total} money={money} t={t} strong />
      <Line figure={p.grossProfit} money={money} t={t} strong />
      <Line figure={p.overhead.overheadExpenses} money={money} t={t} indent />
      <Line figure={p.overhead.generalExpenses} money={money} t={t} indent />
      <Line figure={p.overhead.otherLabour} money={money} t={t} indent />
      <Line figure={p.overhead.loanInterest} money={money} t={t} indent />
      <Line figure={p.overhead.total} money={money} t={t} strong />
      <Line figure={p.netProfit} money={money} t={t} strong />
    </Section>
  );
}

function CashFlow({ data, money, t }) {
  const c = data.cashFlow;
  return (
    <Section
      title={t("app.statements.cash.title", "Cash flow")}
      note={t(
        "app.statements.cash.note",
        "Money that actually moved, kept apart from money a loan schedule says is due.",
      )}
    >
      <Line figure={c.cashIn} money={money} t={t} strong />
      <Line figure={c.cashOut} money={money} t={t} strong />
      <Line figure={c.netCashMovement} money={money} t={t} strong />

      <div className="mt-4 pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">{c.financing.statement}</p>
        <Line figure={c.financing.debtService} money={money} t={t} />
        <Line figure={c.financing.principalPortion} money={money} t={t} indent />
        <Line figure={c.financing.interestPortion} money={money} t={t} indent />
        <Line figure={c.netAfterScheduledDebtService} money={money} t={t} strong />
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">{c.balanceStatement}</p>
        <Line figure={c.openingBalance} money={money} t={t} />
        <Line figure={c.closingBalance} money={money} t={t} />
      </div>
    </Section>
  );
}

function SalesTax({ data, money, t }) {
  const s = data.salesTax;
  const kinds = s.documentTaxStatements || {};
  return (
    <Section
      title={t("app.statements.tax.title", "Sales tax charged")}
      note={t(
        "app.statements.tax.note",
        "What you charged clients in this period. This is NOT a filed return.",
      )}
    >
      <Line figure={s.charged} money={money} t={t} strong />
      <Line figure={s.collected} money={money} t={t} strong />

      {(kinds.unresolved > 0 || kinds.off > 0 || kinds.none > 0) && (
        <p className="text-xs text-muted-foreground mt-3">
          {t(
            "app.statements.tax.kinds",
            "Of the invoices issued: {charged} charged tax, {off} had tax switched off, {none} are in a position where none is owed, and {unresolved} say tax applies but charge none.",
            {
              charged: kinds.charged || 0,
              off: kinds.off || 0,
              none: kinds.none || 0,
              unresolved: kinds.unresolved || 0,
            },
          )}
        </p>
      )}

      <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">
          {t("app.statements.tax.notAReturn", "This is not a tax return")}
        </p>
        <ul className="list-disc pl-4 space-y-0.5 text-xs text-amber-800 dark:text-amber-200">
          {s.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function BalanceSheet({ data, money, t }) {
  const b = data.balanceSheet;
  const group = (title, block) => (
    <div className="mt-3 first:mt-0">
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      {block.available.map((f, i) => (
        <Line key={`a-${i}`} figure={f} money={money} t={t} />
      ))}
      {block.unavailable.map((f, i) => (
        <Line key={`u-${i}`} figure={f} money={money} t={t} />
      ))}
      <Line figure={block.total} money={money} t={t} strong />
    </div>
  );

  return (
    <Section
      title={t("app.statements.bs.title", "Balance sheet (partial)")}
      note={t("app.statements.bs.asAt", "As at {date}.", { date: b.asAt })}
    >
      {/* The headline admission, first — before any figure, not in a footnote. */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 mb-2 text-xs text-amber-800 dark:text-amber-200">
        {b.balanceStatement}
      </div>
      {group(t("app.statements.bs.assets", "Assets"), b.assets)}
      {group(t("app.statements.bs.liabilities", "Liabilities"), b.liabilities)}
      {group(t("app.statements.bs.equity", "Equity"), b.equity)}
    </Section>
  );
}
