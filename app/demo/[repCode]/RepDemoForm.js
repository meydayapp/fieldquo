// app/demo/[repCode]/RepDemoForm.js
//
// GET on mount (read-only, safe for a mail scanner to prefetch), a day
// column and a time column, the prospect's details prefilled from the token
// when there is one, then ONE button that POSTs — the shape of
// app/i/[token]/IntroLinkForm.js.
//
// Slots are instants from the server; the day grouping and the labels are
// done HERE in the browser's zone, because the person choosing is the one
// whose clock matters, and the page names the zone so a prospect on a trip
// is not surprised. The words come from lib/sales/demoBooking/copy.js in
// the language the EMAIL was sent in, which the GET returns; until it
// answers the page shows a spinner and nothing in any language.
//
// FieldQuo is named here because FieldQuo is the host: this is a contractor
// who was rung by FieldQuo's own sales team, not a homeowner reading a
// contractor's document.
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { fillDemoCopy, repDemoCopy } from "@/lib/sales/demoBooking/copy";

const LOCALE = { en: "en-CA", fr: "fr-CA", es: "es" };

function viewerZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export default function RepDemoForm({ repCode, token, lang }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", business: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(null);
  const zone = useMemo(viewerZone, []);

  const query = new URLSearchParams();
  if (token) query.set("t", token);
  if (lang) query.set("lang", lang);
  const url = `/api/demo/rep/${encodeURIComponent(repCode)}${query.toString() ? `?${query}` : ""}`;

  useEffect(() => {
    let cancelled = false;
    fetchJson(url)
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, error: "", data });
        setForm({ name: data.prefill?.name || "", email: data.prefill?.email || "", phone: data.prefill?.phone || "", business: data.prefill?.business || "" });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: err?.status === 410 || /expired/i.test(err?.message || "") ? "expired" : "invalid", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const data = state.data;
  const language = data?.language || "en";
  const copy = repDemoCopy(language);
  const locale = LOCALE[language] || LOCALE.en;

  const dayFmt = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: zone, weekday: "short", month: "short", day: "numeric" }), [locale, zone]);
  const timeFmt = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: zone, hour: "numeric", minute: "2-digit" }), [locale, zone]);
  const whenFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { timeZone: zone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }),
    [locale, zone],
  );
  const dayKeyFmt = useMemo(() => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }), [zone]);

  const days = useMemo(() => {
    const map = new Map();
    for (const iso of data?.slots || []) {
      const d = new Date(iso);
      const key = dayKeyFmt.format(d);
      if (!map.has(key)) map.set(key, { key, label: dayFmt.format(d), slots: [] });
      map.get(key).slots.push({ iso, label: timeFmt.format(d) });
    }
    return [...map.values()];
  }, [data, dayKeyFmt, dayFmt, timeFmt]);

  useEffect(() => {
    if (!day && days.length) setDay(days[0].key);
  }, [days, day]);

  const values = { rep: data?.repName || "", zone, email: form.email, when: slot ? whenFmt.format(new Date(slot)) : "" };

  async function act(e) {
    e.preventDefault();
    setSubmitError("");
    if (!slot) return setSubmitError(copy.needSlot);
    if (!form.name.trim()) return setSubmitError(copy.needName);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return setSubmitError(copy.needEmail);
    setSubmitting(true);
    try {
      const result = await fetchJson(`/api/demo/rep/${encodeURIComponent(repCode)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token || undefined, slot, name: form.name, email: form.email, phone: form.phone, business: form.business, lang: lang || undefined }),
      });
      setDone(result);
    } catch (err) {
      const reason = err?.body?.reason || err?.data?.reason || "";
      if (reason === "already" && (err?.body?.at || err?.data?.at)) {
        setDone({ already: true, at: err.body?.at || err.data?.at });
      } else if (reason === "taken") {
        setSubmitError(copy.taken);
        // The list is stale by one slot; reload it.
        fetchJson(url).then((fresh) => setState({ loading: false, error: "", data: fresh })).catch(() => {});
        setSlot("");
      } else if (reason === "past") {
        setSubmitError(copy.past);
      } else if (reason === "need_name") {
        setSubmitError(copy.needName);
      } else if (reason === "need_email") {
        setSubmitError(copy.needEmail);
      } else {
        setSubmitError(copy.failed);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const field = "w-full min-h-[44px] rounded-lg border border-[#d9d6cf] bg-white px-3 text-base text-[#20242b]";
  const booked = done || (data?.booked ? { already: true, at: data.booked.at } : null);

  return (
    <main className="min-h-screen bg-[#f6f4f0] text-[#20242b] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[#e4e2dd] bg-white p-6 space-y-5">
        {state.loading ? (
          <p className="flex items-center gap-2 text-sm text-[#5b6472]">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          </p>
        ) : state.error ? (
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#b91c1c]" aria-hidden="true" />
            <p>{state.error === "expired" ? copy.expired : copy.invalid}</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#06356b] text-base font-semibold text-white"
              >
                {data.initials}
              </span>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold leading-tight">{fillDemoCopy(copy.title, values)}</h1>
                <p className="text-xs text-[#5b6472]">FieldQuo</p>
              </div>
            </header>

            {booked ? (
              <div className="flex items-start gap-2" data-rep-demo-booked>
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#15803d]" aria-hidden="true" />
                <p className="text-base font-medium">
                  {fillDemoCopy(booked.already ? copy.alreadyBooked : copy.done, { ...values, when: whenFmt.format(new Date(booked.at)), email: booked.email || form.email })}
                </p>
              </div>
            ) : days.length === 0 ? (
              <p className="text-sm" data-rep-demo-empty>{fillDemoCopy(copy.noSlots, values)}</p>
            ) : (
              <form onSubmit={act} className="space-y-5" data-rep-demo-form>
                <p className="text-sm">{fillDemoCopy(copy.intro, values)}</p>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#5b6472]">{copy.pickDay}</p>
                  <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
                    {days.map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        role="tab"
                        aria-selected={day === d.key}
                        onClick={() => {
                          setDay(d.key);
                          setSlot("");
                        }}
                        className={`shrink-0 min-h-[44px] rounded-lg border px-3 text-sm ${day === d.key ? "border-[#06356b] bg-[#06356b] text-white" : "border-[#d9d6cf] bg-white text-[#20242b]"}`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#5b6472]">{copy.pickTime}</p>
                  <div className="grid grid-cols-3 gap-2" data-rep-demo-slots>
                    {(days.find((d) => d.key === day)?.slots || []).map((s) => (
                      <button
                        key={s.iso}
                        type="button"
                        aria-pressed={slot === s.iso}
                        onClick={() => setSlot(s.iso)}
                        className={`min-h-[44px] rounded-lg border px-2 text-sm ${slot === s.iso ? "border-[#06356b] bg-[#06356b] text-white" : "border-[#d9d6cf] bg-white text-[#20242b]"}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[#5b6472]">{fillDemoCopy(copy.zoneNote, values)}</p>
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-xs font-medium uppercase tracking-wide text-[#5b6472] mb-2">{copy.yourDetails}</legend>
                  <label className="block text-sm">
                    <span className="sr-only">{copy.name}</span>
                    <input className={field} placeholder={copy.name} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </label>
                  <label className="block text-sm">
                    <span className="sr-only">{copy.email}</span>
                    <input className={field} type="email" placeholder={copy.email} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </label>
                  <label className="block text-sm">
                    <span className="sr-only">{copy.phone}</span>
                    <input className={field} type="tel" placeholder={copy.phone} autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </label>
                  <label className="block text-sm">
                    <span className="sr-only">{copy.business}</span>
                    <input className={field} placeholder={copy.business} autoComplete="organization" value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} />
                  </label>
                </fieldset>

                <button
                  type="submit"
                  disabled={submitting || !slot}
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] w-full rounded-lg bg-[#06356b] px-4 text-base font-semibold text-white disabled:opacity-60"
                  data-rep-demo-confirm
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                  {submitting ? copy.working : slot ? fillDemoCopy(copy.confirm, values) : copy.needSlot}
                </button>

                {submitError ? (
                  <p className="flex items-start gap-2 text-sm text-[#b91c1c]" role="alert">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    {submitError}
                  </p>
                ) : null}
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
