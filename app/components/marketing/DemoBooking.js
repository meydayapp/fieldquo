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

import { useEffect, useState } from "react";
import { Loader2, ArrowRight, CalendarCheck, Check } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function DemoBooking() {
  const { t } = useTranslation();
  const [days, setDays] = useState(null); // null = loading
  const [dayIdx, setDayIdx] = useState(0);
  const [slot, setSlot] = useState(null); // { iso, label }
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // { whenLabel }

  useEffect(() => {
    fetch("/api/demo/slots")
      .then((r) => r.json())
      .then((d) => setDays(Array.isArray(d?.days) ? d.days : []))
      .catch(() => setDays([]));
  }, []);

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
          <CalendarCheck size={18} /> {t("hero.demo.confirmedTitle", "You're booked!")}
        </div>
        <p className="text-sm text-green-800/90 mt-1.5">
          {t("hero.demo.confirmedBody", "Check {email} for your calendar invite. See you {when}.", {
            email,
            when: done.whenLabel,
          })}
        </p>
      </div>
    );
  }

  if (days === null) {
    return (
      <p className="mt-8 text-sm text-muted-foreground inline-flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> {t("hero.demo.loading", "Loading times…")}
      </p>
    );
  }

  if (days.length === 0) {
    return (
      <p className="mt-8 text-sm text-muted-foreground max-w-md mx-auto">
        {t("hero.demo.noSlots", "No open times right now — email hello@fieldquo.com and we'll sort one out.")}
      </p>
    );
  }

  const activeDay = days[Math.min(dayIdx, days.length - 1)];

  return (
    <form onSubmit={book} className="mt-8 max-w-lg mx-auto text-left">
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="font-semibold text-foreground text-center">
          {t("hero.demo.title", "Book a 30-minute demo")}
        </div>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-4">
          {t("hero.demo.subtitle", "Pick a time and we'll walk you through FieldQuo live.")}
        </p>

        {/* Day picker */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {days.map((d, i) => (
            <button
              key={d.day}
              type="button"
              onClick={() => { setDayIdx(i); setSlot(null); }}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
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
              className={`rounded-lg border px-2 py-2 text-xs font-medium ${
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
      </div>
    </form>
  );
}
