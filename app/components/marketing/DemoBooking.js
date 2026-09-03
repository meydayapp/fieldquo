"use client";

// app/components/marketing/DemoBooking.js
//
// The marketing hero's demo control. Replaces "type your email and we'll get
// back to you" with a real 30-minute slot the prospect books themselves —
// pick a day, pick a time, confirm. On success both the prospect and the
// FieldQuo superadmin get a calendar invite (see /api/demo/book).
//
// Times come from /api/demo/slots already grouped by day and labelled in
// Eastern time, so this component does no date math — it just renders what the
// server offers and posts back the chosen slot's ISO string.
//
// ── Why it starts collapsed ─────────────────────────────────────────────────
//
// It used to render the whole picker inline: fourteen day chips, eight time
// chips and three inputs, directly under the headline. That is a lot of hero
// spent on the minority of visitors ready to book on first sight, and it
// pushed the product itself below the fold. Now it is one button, and the
// picker is what that button reveals.
//
// ── Why "or a call back" is a real second path, not a nicer label ───────────
//
// A button offering a call back has to be able to deliver one. Slots require a
// DemoBooking row with a unique scheduledAt, which a "ring me whenever" request
// doesn't have, so the callback mode posts to /api/marketing/contact — the same
// endpoint the contact page uses, which emails sales. Different destination,
// same promise kept.

import { useEffect, useState } from "react";
import {
  Loader2,
  ArrowRight,
  CalendarCheck,
  Check,
  CalendarDays,
  PhoneCall,
  X,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

// `variant` styles the collapsed trigger only — the panel it opens is the same
// either way. "secondary" exists because the hero gained a brand-accent trial
// CTA above this one, and two accent buttons stacked leave a hero with no
// primary action. Anywhere this is the only ask, "primary" is still right.
export default function DemoBooking({ variant = "primary" }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("slot"); // slot | callback
  const [days, setDays] = useState(null); // null = loading
  const [dayIdx, setDayIdx] = useState(0);
  const [slot, setSlot] = useState(null); // { iso, label }
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [whenBest, setWhenBest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // { whenLabel } | { callback: true }

  // Slots are only fetched once the panel opens. Loading fourteen days of
  // availability for every visitor who scrolls past is a request nobody asked
  // for, and it used to fire on every homepage view.
  useEffect(() => {
    if (!open || days !== null) return;
    fetch("/api/demo/slots")
      .then((r) => r.json())
      .then((d) => setDays(Array.isArray(d?.days) ? d.days : []))
      .catch(() => setDays([]));
  }, [open, days]);

  async function requestCallback(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/marketing/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          source: "hero_callback",
          message: [
            `Phone: ${phone}`,
            whenBest ? `Best time: ${whenBest}` : null,
            company ? `Company: ${company}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(
          d?.error ||
            t("hero.demo.genericError", "Something went wrong — please try again."),
        );
      }
      setDone({ callback: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function book(e) {
    e.preventDefault();
    if (!slot || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/demo/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, companyName: company, slot: slot.iso, source: "hero" }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || t("hero.demo.genericError", "Something went wrong — please try again."));
      setDone({ whenLabel: `${days[dayIdx].day}, ${slot.label}` });
    } catch (err) {
      setError(err.message);
      // A taken slot (409) is worth a refresh so they see it disappear.
      fetch("/api/demo/slots").then((r) => r.json()).then((x) => setDays(x?.days || [])).catch(() => {});
      setSlot(null);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-8 max-w-md mx-auto bg-green-50 border border-green-200 rounded-2xl px-6 py-5 text-left">
        <div className="flex items-center gap-2 text-green-800 font-semibold">
          <CalendarCheck size={18} />{" "}
          {done.callback
            ? t("hero.demo.callbackSent", "Got it — we'll call you shortly.")
            : t("hero.demo.confirmedTitle", "You're booked!")}
        </div>
        <p className="text-sm text-green-800/90 mt-1.5">
          {done.callback
            ? t("hero.demo.callbackBody", "We'll ring {phone}. If we miss you, we'll email {email}.", {
                phone,
                email,
              })
            : t("hero.demo.confirmedBody", "Check {email} for your calendar invite. See you {when}.", {
                email,
                when: done.whenLabel,
              })}
        </p>
      </div>
    );
  }

  // Collapsed — the default, and what most visitors see.
  if (!open) {
    return (
      <div className={variant === "quiet" ? "mt-5" : "flex flex-col items-center"}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            variant === "quiet"
              ? // A line of text, not a control. The hero already has two
                // buttons and a third would restart the problem this variant
                // exists to fix — the demo was the ONLY styled control here,
                // which is what made a self-serve product ask for a meeting.
                // Underlined rather than coloured, so it reads as a link at a
                // glance without competing with the brand accent above; the
                // 44px minimum is kept because a thumb does not know it is
                // looking at text.
                "inline-flex items-center justify-center gap-2 min-h-[44px] text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition"
              : variant === "secondary"
              ? // Outline on the card the hero fades into. text-foreground on
                // --card is 15.6:1 light and 14.4:1 dark; the border carries
                // the shape, so nothing here depends on a fill.
                "inline-flex items-center justify-center gap-2 min-h-[44px] border border-border bg-card text-foreground px-7 py-3.5 rounded-full text-base font-semibold hover:border-foreground/40 transition"
              : "inline-flex items-center justify-center gap-2 min-h-[44px] bg-brand-accent text-brand-accent-foreground px-7 py-3.5 rounded-full text-base font-semibold hover:brightness-95 transition"
          }
        >
          <CalendarDays size={18} />
          {t("hero.demo.openCta", "Book a demo or a call back")}
        </button>
        <p
          className={
            variant === "quiet"
              ? "mt-1 text-xs text-muted-foreground"
              : "mt-3 text-sm text-muted-foreground"
          }
        >
          {t(
            "hero.demo.openHint",
            "30 minutes, live, no slides. Or leave your number and we'll ring you.",
          )}
        </p>
      </div>
    );
  }

  const activeDay =
    days && days.length ? days[Math.min(dayIdx, days.length - 1)] : null;

  return (
    <div className="mt-8 max-w-lg mx-auto text-left">
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-foreground">
              {mode === "callback"
                ? t("hero.demo.modeCallback", "Call me back")
                : t("hero.demo.title", "Book a 30-minute demo")}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {/* The subtitle follows the mode. Leaving the demo line up while
                  someone fills in a callback form describes the wrong thing. */}
              {mode === "callback"
                ? t(
                    "hero.demo.openHint",
                    "30 minutes, live, no slides. Or leave your number and we'll ring you.",
                  )
                : t("hero.demo.subtitle", "Pick a time and we'll walk you through FieldQuo live.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("hero.demo.close", "Close")}
            className="shrink-0 -m-1 flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Two ways in. Both are real: one writes a calendar invite, the other
            emails sales. Neither is a placeholder. */}
        <div className="mt-4 grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted">
          {[
            { key: "slot", icon: CalendarDays, label: t("hero.demo.modeSlot", "Pick a time") },
            { key: "callback", icon: PhoneCall, label: t("hero.demo.modeCallback", "Call me back") },
          ].map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => { setMode(m.key); setError(""); }}
              className={`flex items-center justify-center gap-1.5 min-h-[44px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                mode === m.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <m.icon size={13} />
              {m.label}
            </button>
          ))}
        </div>

        {mode === "callback" ? (
          <form onSubmit={requestCallback} className="mt-4 space-y-2">
            <input
              required value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t("hero.demo.name", "Your name")}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder={t("hero.demo.phone", "Phone number")}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t("hero.demo.email", "Work email")}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={whenBest} onChange={(e) => setWhenBest(e.target.value)}
              placeholder={t("hero.demo.whenBest", "Best time to reach you (optional)")}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy || !name || !email || !phone}
              className="w-full flex items-center justify-center gap-2 bg-brand-accent text-brand-accent-foreground px-6 py-3 rounded-full text-sm font-semibold hover:brightness-95 transition disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <PhoneCall size={15} />}
              {t("hero.demo.requestCallback", "Request a call back")}
            </button>
          </form>
        ) : days === null ? (
          <p className="mt-4 text-sm text-muted-foreground inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />{" "}
            {t("hero.demo.loading", "Loading times…")}
          </p>
        ) : !activeDay ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("hero.demo.noSlots", "No open times right now — email hello@fieldquo.com and we'll sort one out.")}
          </p>
        ) : (
          <form onSubmit={book} className="mt-4">

        {/* Day picker */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {days.map((d, i) => (
            <button
              key={d.day}
              type="button"
              onClick={() => { setDayIdx(i); setSlot(null); }}
              className={`shrink-0 inline-flex items-center min-h-[44px] rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                i === dayIdx
                  ? "border-foreground bg-inverted text-inverted-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.day}
            </button>
          ))}
        </div>

        {/* Time picker */}
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          {activeDay.slots.map((s) => (
            <button
              key={s.iso}
              type="button"
              onClick={() => setSlot(s)}
              className={`inline-flex items-center justify-center min-h-[44px] rounded-lg border px-2 py-2 text-xs font-medium ${
                slot?.iso === s.iso
                  ? "border-foreground bg-inverted text-inverted-foreground"
                  : "border-border text-foreground hover:border-foreground/40"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Details */}
        <div className="mt-4 space-y-2">
          <input
            required value={name} onChange={(e) => setName(e.target.value)}
            placeholder={t("hero.demo.name", "Your name")}
            className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder={t("hero.demo.email", "Work email")}
            className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={company} onChange={(e) => setCompany(e.target.value)}
            placeholder={t("hero.demo.company", "Company (optional)")}
            className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || !slot || !name || !email}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-brand-accent text-brand-accent-foreground px-6 py-3 rounded-full text-sm font-semibold hover:brightness-95 transition disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {slot
            ? t("hero.demo.confirmWithTime", "Confirm {time}", { time: `${activeDay.day}, ${slot.label}` })
            : t("hero.demo.pickSlot", "Pick a time above")}
          {!busy && slot && <ArrowRight size={15} />}
        </button>
          </form>
        )}
      </div>
    </div>
  );
}
