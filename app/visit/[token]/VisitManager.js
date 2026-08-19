// app/visit/[token]/VisitManager.js
//
// "Here is your appointment, and here is what you can still do about it."
//
// ══ The two things this screen must not get wrong ═══════════════════════════
//
// 1. It must never offer a control that won't work. Cancel and Reschedule
//    appear only when the server's `policy` verdict says so. When it doesn't,
//    the screen says WHY — and for `too_late` it names the notice the
//    company asked for, because "you can't change this" with no number reads as
//    a bug, while "they need 24 hours' notice" reads as a policy and tells the
//    reader what to do instead (ring them).
//
// 2. It must never imply a refund the policy will not make. Money already
//    taken is the contractor's from the moment it is taken; refunds are OFF by
//    default (see lib/booking/changePolicy.js). So the sentence shown before
//    cancelling is driven entirely by the server's `refund` verdict, the
//    NON-refund wording is the default for anything unrecognised, and the
//    confirmation afterwards reports what the server actually did rather than
//    what this page predicted.
//
// ══ Where the numbers come from ════════════════════════════════════════════
//
// Nowhere in this file. Both verdicts are computed server-side by
// changePolicy.js against the company's settings and the booking row; the
// browser renders them. It sends no amounts and no policy of its own — same
// rule as the quote page's add-ons.
//
// ══ Colours ════════════════════════════════════════════════════════════════
//
// documentTheme / fillPair / washPair, never the raw brandColor. A contractor
// whose brand is pale yellow would otherwise get white text on white here, on
// the page that tells them whether they are getting their money back.
"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import {
  Building2,
  Calendar,
  MapPin,
  Phone,
  Video,
  FileText,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Check,
  X,
} from "lucide-react";
import { documentTheme, fillPair, washPair } from "@/lib/documents/theme";
import { documentFormatters } from "@/lib/i18n/documentLabels";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { describeWindow } from "@/lib/booking/arrivalWindow";
import { fetchJson } from "@/lib/fetchJson";
import {
  changeRefusal,
  refundLine,
  actionErrorText,
  exactWhen,
} from "@/lib/booking/visitCopy";
import SlotCalendar from "@/app/components/public/SlotCalendar";

export default function VisitManager({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // "overview" | "confirmCancel" | "reschedule"
  const [view, setView] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  // What actually happened, as reported by the server. Never derived from what
  // this page expected to happen.
  const [settled, setSettled] = useState(null);

  const [picked, setPicked] = useState(null);
  // Bumped to remount the calendar after a 409, so the visitor gets fresh times
  // rather than staring at a grid containing a slot that no longer exists.
  const [slotEpoch, setSlotEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const got = await fetchJson(`/api/visit/${token}`);
        if (!cancelled) setData(got);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // The client's language, resolved server-side the same way the covering email
  // was (lib/i18n/clientLanguage.js via manageVisit.visitView), so this page
  // reads like the email that linked to it. Never guessed from the browser,
  // which reports the phone's setting and would put a French page in front of
  // an English client holding a French quote.
  const language = data?.language || "en";
  const copy = clientDocCopy(language).visit;
  // The currency they were CHARGED in, not today's company setting — a company
  // that switched from CAD to USD must not relabel a deposit somebody already
  // paid. Falls back to the company's only when no fee was taken.
  const fmt = documentFormatters(
    language,
    data?.fee?.currency || data?.company?.currency,
  );
  const money = (cents) => fmt.money((Number(cents) || 0) / 100);

  const company = data?.company || {};
  const theme = documentTheme(company);
  const solid = fillPair(theme);
  const wash = washPair(theme);

  // Slots for the reschedule grid, on the same route that accepts the move —
  // so the times offered are computed from exactly the rows and exclusions the
  // POST validates against, rather than from a second endpoint that could
  // disagree with it. See the reschedule route's dayWindow/exclude handling.
  const loadSlots = useCallback(
    async (from, to) => {
      const got = await fetchJson(
        `/api/visit/${token}/reschedule?from=${from}&to=${to}`,
      );
      return got?.slots || {};
    },
    [token],
  );

  const when = useMemo(() => {
    if (!data?.startTime) return "";
    // arrivalWindowMinutes arrives already zeroed for a call or a video
    // meeting — one place decides that, and it is the server (visitView). Zero
    // makes describeWindow return null and the exact time wins.
    const windowed = describeWindow(data.startTime, data.arrivalWindowMinutes, {
      timezone: data.timezone,
      language,
    });
    return windowed || exactWhen(data.startTime, data.timezone, fmt.locale);
  }, [data, language, fmt.locale]);

  async function act(url, body, onDone) {
    setBusy(true);
    setActionError("");
    try {
      const got = await fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onDone(got);
    } catch (err) {
      // A 409 on a move means somebody took the slot, or the notice window
      // closed, between loading the grid and tapping the button. Send them back
      // to fresh times rather than leaving them looking at a time that no
      // longer exists.
      if (err.status === 409 && body.startTime) {
        setPicked(null);
        setSlotEpoch((n) => n + 1);
      }
      setActionError(actionErrorText(err, copy, company.name));
    } finally {
      setBusy(false);
    }
  }

  const cancelVisit = () =>
    act(`/api/visit/${token}`, { action: "cancel" }, (got) =>
      setSettled({
        kind: "cancelled",
        // The server's answer, not this page's prediction. `refunded` is false
        // when the policy said yes but there was no card payment to reverse
        // (a fee taken in cash), and the client is told the truth here rather
        // than discovering it on their statement three days later.
        refunded: got?.refunded === true,
        refundedCents: Number(got?.fee?.refundedCents) || 0,
      }),
    );

  const moveVisit = () =>
    act(`/api/visit/${token}/reschedule`, { startTime: picked }, (got) =>
      setSettled({ kind: "moved", startTime: got?.startTime || picked }),
    );

  if (loading) {
    return (
      <Shell theme={theme}>
        <div className="animate-pulse space-y-3">
          <div className="h-6 rounded w-1/2" style={{ backgroundColor: theme.border }} />
          <div className="h-32 rounded-xl" style={{ backgroundColor: theme.border }} />
        </div>
      </Shell>
    );
  }

  if (loadError || !data) {
    return (
      <Shell theme={theme}>
        <div className="text-center py-10">
          <p className="font-semibold" style={{ color: theme.ink }}>
            {copy.loadFailed}
          </p>
          <p className="text-sm mt-1" style={{ color: theme.inkMuted }}>
            {copy.loadFailedHint}
          </p>
        </div>
      </Shell>
    );
  }

  // ── After the fact ───────────────────────────────────────────────────────
  if (settled?.kind === "cancelled") {
    const paid = Number(data.fee?.paidCents) || 0;
    return (
      <Shell theme={theme}>
        <Header company={company} theme={theme} solid={solid} copy={copy} />
        <Outcome theme={theme} wash={wash} icon={X} title={copy.cancelledTitle}>
          <p className="text-sm mt-3" style={{ color: theme.inkMuted }}>
            {copy.cancelledBody(company.name)}
          </p>
          {paid > 0 && (
            <p className="text-sm mt-3 font-medium" style={{ color: theme.ink }}>
              {settled.refunded
                ? copy.cancelledRefunded(money(settled.refundedCents || paid))
                : // No refund happened. Say so plainly rather than staying
                  // silent — silence after a screen that mentioned a deposit
                  // reads as "it's on its way".
                  copy.refundNo(money(paid))}
            </p>
          )}
        </Outcome>
        <Footer copy={copy} company={company} theme={theme} />
      </Shell>
    );
  }

  if (settled?.kind === "moved") {
    return (
      <Shell theme={theme}>
        <Header company={company} theme={theme} solid={solid} copy={copy} />
        <Outcome theme={theme} wash={wash} icon={Check} title={copy.movedTitle}>
          <p className="text-sm mt-2 font-semibold" style={{ color: theme.ink }}>
            {exactWhen(settled.startTime, data.timezone, fmt.locale)}
          </p>
          <p className="text-sm mt-3" style={{ color: theme.inkMuted }}>
            {copy.movedBody(company.name)}
          </p>
        </Outcome>
        <Footer copy={copy} company={company} theme={theme} />
      </Shell>
    );
  }

  // ── Pick a new time ──────────────────────────────────────────────────────
  if (view === "reschedule") {
    return (
      <Shell theme={theme} wide>
        <Header company={company} theme={theme} solid={solid} copy={copy} />
        <button
          type="button"
          onClick={() => {
            setView("overview");
            setPicked(null);
            setActionError("");
          }}
          className="inline-flex items-center gap-1 text-xs mb-2"
          style={{ color: theme.inkMuted }}
        >
          <ArrowLeft size={11} /> {copy.rescheduleKeep}
        </button>
        <h2 className="font-semibold mb-3" style={{ color: theme.ink }}>
          {copy.rescheduleTitle}
        </h2>

        {actionError && <ErrorNote theme={theme}>{actionError}</ErrorNote>}

        <SlotCalendar
          key={slotEpoch}
          theme={theme}
          solid={solid}
          wash={wash}
          copy={copy}
          locale={fmt.locale}
          timeZone={data.timezone}
          loadSlots={loadSlots}
          onPick={setPicked}
          selected={picked}
        />

        {/* Always here, not only when the grid fails. The times shown are the
            ones the crew can reach; someone who needs a time that isn't on the
            list has one option and it is the phone. */}
        <p className="text-xs mt-3" style={{ color: theme.inkMuted }}>
          {copy.callInstead(company.name, company.phone)}
        </p>

        {picked && (
          <div
            className="mt-4 rounded-xl p-3.5"
            style={{ backgroundColor: wash.bg, color: wash.ink }}
          >
            <div className="text-sm font-semibold">
              {exactWhen(picked, data.timezone, fmt.locale)}
            </div>
            <button
              type="button"
              onClick={moveVisit}
              disabled={busy}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 min-h-12 rounded-full text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: solid.bg, color: solid.fg }}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {copy.confirmNewTime}
            </button>
          </div>
        )}
      </Shell>
    );
  }

  // ── Are you sure? ────────────────────────────────────────────────────────
  //
  // A two-step confirm rather than a bare button, for the same reason the quote
  // page has one: this is irreversible, on a phone, possibly in bright sun.
  if (view === "confirmCancel") {
    const moneyLine = refundLine(data.refund, copy, money);
    return (
      <Shell theme={theme}>
        <Header company={company} theme={theme} solid={solid} copy={copy} />
        <div className="py-2">
          <h2 className="text-lg font-bold" style={{ color: theme.ink }}>
            {copy.cancelConfirmTitle}
          </h2>
          <p className="text-sm mt-2" style={{ color: theme.inkMuted }}>
            {copy.cancelConfirmBody(company.name)}
          </p>

          {/* The money, before the button that spends it. */}
          {moneyLine && (
            <p
              className="text-sm mt-3 rounded-xl px-3.5 py-3 font-medium"
              style={{ backgroundColor: wash.bg, color: wash.ink }}
            >
              {moneyLine}
            </p>
          )}

          {actionError && (
            <div className="mt-3">
              <ErrorNote theme={theme}>{actionError}</ErrorNote>
            </div>
          )}

          <div className="mt-5 space-y-2">
            {/* The safe option gets the brand fill. Giving the destructive one
                the loud treatment is how an accidental tap becomes a lost
                appointment. */}
            <button
              type="button"
              onClick={() => {
                setView("overview");
                setActionError("");
              }}
              disabled={busy}
              className="w-full min-h-12 rounded-full text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: solid.bg, color: solid.fg }}
            >
              {copy.keepIt}
            </button>
            <button
              type="button"
              onClick={cancelVisit}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 min-h-12 rounded-full border text-sm font-semibold disabled:opacity-50"
              style={{
                borderColor: theme.border,
                // Fixed, not brand-derived: negative means negative whatever
                // colour the van is painted. 5.9:1 on paper.
                color: theme.negative,
                backgroundColor: theme.paper,
              }}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {copy.yesCancel}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── The visit ────────────────────────────────────────────────────────────
  const policy = data.policy || {};
  const refusal = changeRefusal(policy, copy, company.name);
  const paid = Number(data.fee?.paidCents) || 0;

  return (
    <Shell theme={theme}>
      <Header company={company} theme={theme} solid={solid} copy={copy} />

      <h1 className="text-lg font-bold" style={{ color: theme.ink }}>
        {data.eventTypeName}
      </h1>
      {data.quoteNumber && (
        <p className="text-xs mt-1 inline-flex items-center gap-1.5" style={{ color: theme.accentText }}>
          <FileText size={12} /> {copy.aboutEstimate(data.quoteNumber)}
        </p>
      )}

      <div
        className="mt-4 rounded-xl border divide-y"
        style={{ borderColor: theme.border, backgroundColor: theme.paper }}
      >
        <Row
          theme={theme}
          icon={Calendar}
          label={copy.whenLabel}
          value={when}
        />
        <Row
          theme={theme}
          icon={data.mode === "visit" ? MapPin : data.mode === "video" ? Video : Phone}
          label={copy.whereLabel}
          value={
            data.mode === "visit"
              ? data.address || copy.addressUnknown
              : data.mode === "video"
                ? copy.modeVideo
                : copy.modeCall
          }
          hint={data.mode === "visit" ? copy.modeVisit : null}
        />
        {paid > 0 && (
          <div className="px-3.5 py-3">
            <span className="text-sm font-semibold" style={{ color: wash.accent }}>
              {copy.depositPaid(money(paid))}
            </span>
          </div>
        )}
      </div>

      <div className="mt-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: theme.inkMuted }}>
          {copy.changeHeading}
        </h2>

        {policy.canChange ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setView("reschedule")}
              className="w-full min-h-12 rounded-full text-sm font-bold"
              style={{ backgroundColor: solid.bg, color: solid.fg }}
            >
              {copy.rescheduleCta}
            </button>
            <button
              type="button"
              onClick={() => setView("confirmCancel")}
              className="w-full min-h-12 rounded-full border text-sm font-semibold"
              style={{
                borderColor: theme.border,
                color: theme.negative,
                backgroundColor: theme.paper,
              }}
            >
              {copy.cancelCta}
            </button>
          </div>
        ) : (
          // No disabled buttons. A greyed-out control with no explanation is
          // the dead-control failure this codebase keeps getting swept for —
          // the reader can't tell whether the page is broken or the answer is
          // no. So: the reason, then the thing they can actually do.
          <div
            className="rounded-xl px-3.5 py-3"
            style={{ backgroundColor: wash.bg, color: wash.ink }}
          >
            {refusal.text && <p className="text-sm font-medium">{refusal.text}</p>}
            <p className={`text-sm ${refusal.text ? "mt-1.5" : ""}`} style={{ color: wash.muted }}>
              {refusal.callable
                ? copy.callInstead(company.name, company.phone)
                : copy.questions(company.name, company.phone)}
            </p>
          </div>
        )}
      </div>

      {policy.canChange && <Footer copy={copy} company={company} theme={theme} />}
    </Shell>
  );
}

function Shell({ children, theme, wide = false }) {
  return (
    <div className="min-h-screen p-3 sm:p-6" style={{ backgroundColor: theme.page }}>
      <div
        className={`${wide ? "max-w-2xl" : "max-w-md"} mx-auto rounded-2xl p-4 sm:p-5 border`}
        style={{
          backgroundColor: theme.paper,
          borderColor: theme.borderSoft,
          "--bd": theme.border,
          "--bd-hover": theme.accentRule,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Header({ company, theme, solid, copy }) {
  return (
    <div
      className="flex items-center gap-3 mb-5 pb-4 border-b"
      style={{ borderColor: theme.borderSoft }}
    >
      {company.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={company.logoUrl} alt={company.name} className="h-9 w-auto object-contain" />
      ) : (
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: solid.bg }}
        >
          <Building2 size={16} style={{ color: solid.fg }} />
        </div>
      )}
      <div className="min-w-0">
        <div className="font-bold truncate" style={{ color: theme.ink }}>
          {company.name}
        </div>
        <div className="text-xs" style={{ color: theme.inkMuted }}>
          {copy.eyebrow}
        </div>
      </div>
    </div>
  );
}

function Row({ theme, icon: Icon, label, value, hint }) {
  return (
    <div className="px-3.5 py-3 flex items-start gap-3">
      <Icon size={15} className="shrink-0 mt-0.5" style={{ color: theme.inkMuted }} />
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: theme.inkMuted }}>
          {label}
        </div>
        <div className="text-sm font-semibold mt-0.5" style={{ color: theme.ink }}>
          {value}
        </div>
        {hint && (
          <div className="text-xs mt-0.5" style={{ color: theme.inkMuted }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

function Outcome({ theme, wash, icon: Icon, title, children }) {
  return (
    <div className="text-center py-6">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ backgroundColor: wash.bg }}
      >
        <Icon size={26} style={{ color: wash.accent }} />
      </div>
      <h2 className="text-lg font-bold" style={{ color: theme.ink }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function ErrorNote({ theme, children }) {
  return (
    <div
      className="rounded-lg px-3 py-2 mb-3 flex items-start gap-2 text-sm border"
      style={{
        color: theme.negative,
        borderColor: theme.negative,
        backgroundColor: theme.paper,
      }}
    >
      <AlertCircle size={15} className="shrink-0 mt-0.5" />
      {children}
    </div>
  );
}

function Footer({ copy, company, theme }) {
  return (
    <p className="text-xs mt-5 pt-4 border-t" style={{ borderColor: theme.borderSoft, color: theme.inkMuted }}>
      {copy.questions(company.name, company.phone)}
    </p>
  );
}
