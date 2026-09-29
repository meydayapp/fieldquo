"use client";

// app/components/dashboard/FocusSection.js
//
// "Your focus" — the middle of the home screen, shaped by the priority and
// focus the owner chose (at signup, or here). Which cards, in which order,
// and whether each is a number, a yes/no or the step to set it up is decided
// by lib/dashboard/focus.js from facts GET /api/dashboard/home read; this
// file only draws them. A card with no data behind it was already turned into
// its set-up step there, or removed — nothing here prints a figure the server
// did not send.
//
// A company that never answered (every company from before the welcome
// questions) gets the picker once: the same four priorities and the same
// focus chips, saved to the same two columns through PATCH
// /api/dashboard/focus. "Not now" is remembered per person through
// /api/ui-state (like every other dismissed notice), and a small link keeps
// the picker one tap away afterwards. Only an owner or admin sees the picker
// or "Change focus" — the route refuses everyone else, and a support session
// sees it read-only.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useFeatureFlags } from "@/app/providers/FeatureProvider";
import { reportResponseError } from "@/lib/clientErrors";
import { formatMoney } from "@/lib/currency";
import { navRowState } from "@/lib/features/nav";
import { WELCOME_FOCUS, WELCOME_PRIORITIES, focusOptionsFor } from "@/lib/signup/welcome";
import { resolveFocusCards } from "@/lib/dashboard/focus";
import { CARD, INSET } from "./surface";
import { Figure, FigureText } from "./Figure";

/** The dismissed-notice key the picker's "Not now" writes. */
export const FOCUS_PICKER_NOTICE = "dashboard-focus-picker";

const PRIORITY_CARD = {
  professional: "I want my business to look as professional as my work",
  control: "I want to feel in control, not like my business is running me",
  win_more: "I want to win more jobs, without the time-consuming admin",
  exploring: "I'm not sure yet, just exploring",
};

const PRIORITY_TITLE = {
  professional: "Looking as professional as your work",
  control: "Staying in control of your day",
  win_more: "Winning more jobs",
  exploring: "Finding your way around",
};

/** English fallbacks for each card's words; the catalogue carries every language. */
const CARD_EN = {
  quotes_sent_month: { label: "Quotes sent this month", setup: "Send your first quote — it takes a few minutes." },
  new_quote: { label: "Write a quote", desc: "Start a new quote from your services and prices." },
  quotes_awaiting: { label: "Quotes waiting on the client" },
  deposits: { label: "Deposits", on: "A payment schedule is set for approved quotes.", setup: "Ask for a deposit so an approval comes with money." },
  money_owed: { label: "Money owed to you", sub: "{count} unpaid invoices", setup: "Send your first invoice." },
  card_payments: { label: "Card payments", on: "Clients can pay your invoices by card online.", setup: "Connect Stripe so clients can pay by card." },
  overdue: { label: "Overdue", sub: "{count} invoices past due" },
  auto_reminders: { label: "Automatic payment reminders", on: "Overdue invoices get a reminder on their own.", setup: "Turn on an automatic reminder for overdue invoices." },
  quote_follow_ups: { label: "Quote follow-ups", on: "{count} automatic follow-ups are on for sent quotes.", setup: "Turn on automatic follow-ups for quotes with no reply." },
  new_requests_month: { label: "New requests this month" },
  unanswered_leads: { label: "Requests waiting for a reply" },
  website: { label: "Your website", on: "Your website is live.", setup: "Publish a website clients can find you on." },
  booking_link: { label: "Online booking", on: "Clients can book a visit online.", setup: "Open your calendar so clients can book online." },
  instant_quotes: { label: "Instant estimates", on: "Your instant estimate form is on.", setup: "Turn on instant estimates so visitors get a price range." },
  reviews: { label: "Reviews", on: "Reviews are set up.", setup: "Connect Google reviews or add a testimonial." },
  maintenance_plans: { label: "Maintenance plans", desc: "Offer recurring service plans so clients come back." },
  clients: { label: "Clients", setup: "Add your first client." },
  unscheduled_jobs: { label: "Jobs not scheduled yet" },
  visits_today: { label: "Visits today" },
  route_today: { label: "Stops today", cta: "See the map" },
  onsite_today: {
    label: "On site today",
    sub: "{photos} with photos · {done} of {total} checklist items",
    setup: "Create the checklist your crew fills in on site.",
  },
  team: { label: "Active team members", setup: "Invite your team so you can hand out work." },
  timesheets_pending: { label: "Timesheets to approve" },
  mobile: { label: "Run jobs from your phone", desc: "Your day, the clock and each job's checklist in one place." },
  conversion: { label: "Quotes won this month", value: "{won} of {sent}" },
  receptionist: { label: "AI receptionist", desc: "Let the receptionist answer the calls you miss." },
  help: { label: "Help centre", desc: "Guides for every part of FieldQuo, and a way to reach us." },
};

function Picker({ initial, readOnly, onSaved, onCancel, onDismiss, t }) {
  const [priority, setPriority] = useState(initial?.priority || null);
  const [focus, setFocus] = useState(initial?.focus || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const offered = priority ? focusOptionsFor(priority) : [];

  async function save() {
    if (!priority || readOnly) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/focus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signupPriority: priority, signupFocus: focus.filter((f) => offered.includes(f)) }),
      });
      if (!res.ok) {
        await reportResponseError(res, setError, t("app.dash.focus.saveError", "Could not save your focus."));
        return;
      }
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${CARD} p-4 sm:p-5`}>
      <h2 className="text-base font-semibold text-foreground">{t("app.dash.focus.pickerTitle", "What should your dashboard focus on?")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("app.dash.focus.pickerSubtitle", "Pick what matters most right now. The numbers and next steps for it will sit here.")}
      </p>
      <div role="radiogroup" aria-label={t("app.dash.focus.pickerTitle", "What should your dashboard focus on?")} className="mt-4 grid gap-2 sm:grid-cols-2">
        {WELCOME_PRIORITIES.map((p) => {
          const on = priority === p.key;
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setPriority(p.key);
                // Keep only what the new priority offers — the save does too.
                setFocus((prev) => prev.filter((f) => focusOptionsFor(p.key).includes(f)));
              }}
              className={`min-h-12 border px-3 py-2 text-left text-sm ${on ? "border-foreground bg-muted font-semibold text-foreground" : "border-foreground/20 text-foreground hover:bg-muted"}`}
            >
              {t(`app.welcome.priority.${p.key}.card`, PRIORITY_CARD[p.key])}
            </button>
          );
        })}
      </div>
      {offered.length > 0 && (
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-foreground">{t("app.welcome.focus.question", "Tell us what you'd like to focus on")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {offered.map((f) => {
              const on = focus.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFocus((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]))}
                  className={`min-h-10 rounded-full border px-3 text-xs font-semibold ${on ? "border-transparent bg-inverted text-inverted-foreground" : "border-foreground/25 text-foreground hover:bg-muted"}`}
                >
                  {t(`app.welcome.focus.option.${f}`, WELCOME_FOCUS[f])}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!priority || saving || readOnly}
          title={readOnly ? t("app.dash.readOnly", "Read-only support session") : undefined}
          className="min-h-10 rounded-full bg-inverted px-5 text-sm font-semibold text-inverted-foreground disabled:opacity-60"
        >
          {t("app.dash.focus.save", "Save focus")}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="min-h-10 rounded-full border border-foreground/25 px-4 text-sm font-semibold text-foreground">
            {t("app.action.cancel", "Cancel")}
          </button>
        )}
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="min-h-10 px-3 text-sm font-semibold text-muted-foreground underline">
            {t("app.dash.focus.notNow", "Not now")}
          </button>
        )}
      </div>
    </div>
  );
}

function FocusCard({ card, t }) {
  const en = CARD_EN[card.id] || { label: card.id };
  const k = (part) => `app.dash.focus.card.${card.id}.${part}`;
  const label = t(k("label"), en.label);

  let body = null;
  let cta = t("app.dash.focus.view", "View");
  if (card.state === "metric") {
    body = (
      <>
        <Figure className="block text-2xl font-bold text-foreground leading-tight">
          {card.amount != null
            ? formatMoney(card.amount, card.currency)
            : card.of != null
              ? t(k("value"), en.value || "{won} of {sent}", { won: card.value, sent: card.of })
              : String(card.value)}
        </Figure>
        {card.amount != null && en.sub && (
          <FigureText className="text-xs text-muted-foreground">{t(k("sub"), en.sub, { count: card.value })}</FigureText>
        )}
        {card.id === "onsite_today" && card.value > 0 && (
          <FigureText className="text-xs text-muted-foreground">
            {t(k("sub"), en.sub, { photos: card.photos, done: card.checklistDone, total: card.checklistTotal })}
          </FigureText>
        )}
      </>
    );
    if (en.cta) cta = t(k("cta"), en.cta);
  } else if (card.state === "status") {
    body = <p className="text-sm text-foreground">{t(k("on"), en.on || "", { count: card.value ?? "" })}</p>;
    cta = t("app.dash.focus.manage", "Settings");
  } else if (card.state === "setup") {
    body = <p className="text-sm text-foreground">{t(k("setup"), en.setup || "")}</p>;
    cta = t("app.dash.focus.setUp", "Set it up");
  } else if (card.state === "shortcut") {
    body = <p className="text-sm text-muted-foreground">{t(k("desc"), en.desc || "")}</p>;
    cta = t("app.dash.focus.go", "Open");
  }

  return (
    <li className={`${INSET} flex flex-col gap-2 p-3 sm:p-4`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
        {card.state === "setup" && (
          <span className="shrink-0 rounded-full border border-foreground/25 px-2 text-[11px] font-semibold text-foreground">
            {t("app.dash.focus.toDo", "To do")}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">{body}</div>
      <Link
        href={card.href}
        className={`self-start inline-flex min-h-10 items-center rounded-full px-4 text-xs font-semibold ${
          card.state === "setup" ? "bg-inverted text-inverted-foreground" : "border border-foreground/25 text-foreground hover:bg-muted"
        }`}
      >
        {cta}
      </Link>
    </li>
  );
}

export default function FocusSection({ focus, facts, perms, readOnly = false, onSaved }) {
  const { t } = useTranslation();
  const flags = useFeatureFlags();
  const [editing, setEditing] = useState(false);
  // null until /api/ui-state answers, so the picker never flashes and vanishes.
  const [dismissed, setDismissed] = useState(null);
  const answered = Boolean(focus?.priority);
  const mayEdit = Boolean(perms?.editFocus) || readOnly;

  useEffect(() => {
    if (answered || !mayEdit) return;
    let live = true;
    fetch("/api/ui-state")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setDismissed(Array.isArray(d?.dismissedNotices) ? d.dismissedNotices.includes(FOCUS_PICKER_NOTICE) : false))
      .catch(() => live && setDismissed(false));
    return () => {
      live = false;
    };
  }, [answered, mayEdit]);

  const cards = useMemo(
    () =>
      resolveFocusCards({
        priority: focus?.priority,
        focus: focus?.focus,
        facts: facts || {},
        perms: perms || {},
        isShown: (navKey) => navRowState(navKey, flags).show,
      }),
    [focus, facts, perms, flags],
  );

  function dismiss() {
    setDismissed(true);
    // Remembered for this person on every device; a support session only
    // hides it on screen (middleware refuses the write).
    if (!readOnly) {
      fetch("/api/ui-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismiss: FOCUS_PICKER_NOTICE }),
      }).catch(() => {});
    }
  }

  const saved = () => {
    setEditing(false);
    onSaved?.();
  };

  if (!answered) {
    if (!mayEdit || dismissed === null) return null;
    if (dismissed && !editing) {
      return (
        <p className="text-sm text-muted-foreground">
          <button type="button" onClick={() => setEditing(true)} className="min-h-9 font-semibold text-foreground underline">
            {t("app.dash.focus.pickLink", "Choose what your dashboard focuses on")}
          </button>
        </p>
      );
    }
    return (
      <Picker
        initial={null}
        readOnly={readOnly}
        onSaved={saved}
        onCancel={editing ? () => setEditing(false) : null}
        onDismiss={editing ? null : dismiss}
        t={t}
      />
    );
  }

  if (editing) {
    return <Picker initial={focus} readOnly={readOnly} onSaved={saved} onCancel={() => setEditing(false)} t={t} />;
  }

  const p = focus.priority;
  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="focus-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.dash.focus.title", "Your focus")}</p>
          <h2 id="focus-title" className="mt-0.5 text-lg font-semibold text-foreground">
            {t(`app.dash.focus.priority.${p}`, PRIORITY_TITLE[p] || "")}
          </h2>
          {focus.focus?.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {focus.focus.map((f) => t(`app.welcome.focus.option.${f}`, WELCOME_FOCUS[f])).join(" · ")}
            </p>
          )}
        </div>
        {mayEdit && (
          <button type="button" onClick={() => setEditing(true)} className="min-h-9 text-xs font-semibold text-muted-foreground underline hover:text-foreground">
            {t("app.dash.focus.change", "Change focus")}
          </button>
        )}
      </div>
      {cards.length > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <FocusCard key={card.id} card={card} t={t} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {t("app.dash.focus.nothing", "Nothing to show for this focus with your access. Ask the owner if you need more.")}
        </p>
      )}
    </section>
  );
}
