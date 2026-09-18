// app/instant-quote/[companySlug]/MeasurementDoubt.js
//
// "This doesn't look right?" — the control under every figure an instant
// estimate reads off imagery: the roof from Solar, the eaves from the same
// model, the lawn from a parcel or a trace. Two ways out, both of them a
// human:
//
//   Call us              a tel: link to the company's own number. Hidden
//                        when the company has none on file — a button that
//                        dials nothing is the dead control AGENTS.md is
//                        about.
//   Request a call back  name, phone, a preferred time, a note. Posts to
//                        /api/instant-quote/[slug]/callback, which creates
//                        (or flags) the lead with callbackRequestedAt and
//                        notifies the company the way every inbound form
//                        does. The instant estimate itself is untouched.
//
// Shown on the preview, on the confirmation, and on a REFUSAL — a
// measurement the server would not stand behind is exactly when a homeowner
// wants a person. Copy in the company's language (lib/i18n/
// lawnEstimateCopy.js), the same table the server uses for the
// confirmation, so the two cannot drift.
"use client";

import { useState } from "react";
import { Loader2, Phone, PhoneCall } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatPhoneInput } from "@/lib/validation";
import { lawnEstimateCopy } from "@/lib/i18n/lawnEstimateCopy";

export default function MeasurementDoubt({
  companySlug,
  companyPhone,
  language = "en",
  trade,
  address,
  quoteId = null,
  contact = null,
  measurementSummary = "",
  theme,
  solid,
}) {
  const t = lawnEstimateCopy(language);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: contact?.name || "",
    phone: contact?.phone || "",
    preferredTime: "anytime",
    note: "",
  });
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [err, setErr] = useState("");

  const phoneHref = companyPhone ? `tel:${String(companyPhone).replace(/[^\d+]/g, "")}` : null;

  async function send() {
    if (!form.phone.trim()) {
      setErr(t.cbPhoneRequired);
      return;
    }
    setState("sending");
    setErr("");
    try {
      await fetchJson(`/api/instant-quote/${companySlug}/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          preferredTime: form.preferredTime,
          note: form.note,
          trade,
          address,
          quoteId,
          measurementSummary,
          language,
        }),
      });
      setState("done");
    } catch (e) {
      setErr(e?.message || t.cbFailed);
      setState("error");
    }
  }

  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="mt-3 rounded-xl border border-dashed border-border p-3">
      <div className="text-sm font-semibold text-foreground">{t.doubtTitle}</div>
      <p className="text-xs text-muted-foreground mt-0.5">{t.doubtBody}</p>

      {state === "done" ? (
        <p className="mt-2 text-sm text-foreground">{t.cbDone}</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {phoneHref && (
              <a
                href={phoneHref}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 min-h-11 text-sm font-semibold"
                style={{ background: solid.bg, color: solid.fg, borderColor: theme.accentText }}
              >
                <Phone size={14} /> {t.callUs}
                {companyPhone ? <span className="font-normal opacity-90"> · {companyPhone}</span> : null}
              </a>
            )}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 min-h-11 text-sm font-semibold text-foreground"
            >
              <PhoneCall size={14} /> {t.requestCallback}
            </button>
          </div>

          {open && (
            <div className="mt-3 space-y-2">
              <input
                placeholder={t.cbName}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder={`${t.cbPhone} *`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: formatPhoneInput(e.target.value) })}
                className={inputCls}
              />
              <label className="block">
                <span className="text-xs text-muted-foreground">{t.cbTime}</span>
                <select
                  value={form.preferredTime}
                  onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
                  className={inputCls}
                >
                  {t.cbTimeOptions.map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </label>
              <textarea
                placeholder={t.cbNote}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value.slice(0, 600) })}
                rows={2}
                className={inputCls}
              />
              {err && <p className="text-xs text-red-600">{err}</p>}
              <button
                type="button"
                onClick={send}
                disabled={state === "sending"}
                className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 min-h-11 text-sm font-semibold disabled:opacity-50"
                style={{ background: solid.bg, color: solid.fg, borderColor: theme.accentText }}
              >
                {state === "sending" && <Loader2 size={14} className="animate-spin" />}
                {state === "sending" ? t.cbSending : t.cbSend}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
