// app/estimate-report/[token]/CallbackForm.js
//
// "Request a call back" on the report: a button that unfolds a four-field
// form and posts it to the EXISTING call-back route
// (app/api/instant-quote/[companySlug]/callback), which flags the draft's lead
// and notifies the company the way every inbound form does. Nothing here
// prices or measures; the body is the shape lib/leads/callbackRequest.js
// cleans — name, phone, preferredTime, note, trade, address, quoteId,
// language. The homeowner's name and number are prefilled from the draft so
// they are not typed twice.
//
// The only script on the report page, kept to this one control so the rest
// of the document renders without it.
"use client";

import { useState } from "react";
import { reportResponseError } from "@/lib/clientErrors";

export default function CallbackForm({ callback, theme, button }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(callback.prefill?.name || "");
  const [phone, setPhone] = useState(callback.prefill?.phone || "");
  const [preferredTime, setPreferredTime] = useState("anytime");
  const [note, setNote] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done | failed
  const [message, setMessage] = useState("");
  const c = callback.copy;

  async function submit(e) {
    e.preventDefault();
    if (!/\d{7,}/.test(phone.replace(/\D/g, ""))) {
      setState("failed");
      setMessage(c.phoneRequired);
      return;
    }
    setState("sending");
    setMessage("");
    try {
      const res = await fetch(callback.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          preferredTime,
          note,
          trade: callback.body.trade,
          address: callback.body.address,
          quoteId: callback.body.quoteId,
          language: callback.body.language,
        }),
      });
      if (!res.ok) {
        // The route answers a bad phone in the report's language; that
        // sentence is shown inline, the generic one only when there is none.
        setState("failed");
        await reportResponseError(res, setMessage, c.failed);
        return;
      }
      setState("done");
      setMessage(c.done);
    } catch {
      setState("failed");
      setMessage(c.failed);
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl px-4 py-3 text-sm font-semibold text-center sm:col-span-3" style={{ color: theme.positive, border: `1px solid ${theme.border}` }}>
        {message}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-full px-4 py-3 text-sm font-bold" style={button}>
        {callback.label}
      </button>
    );
  }

  const field = "w-full rounded-lg px-3 py-2.5 text-base";
  const fieldStyle = { border: `1px solid ${theme.border}`, backgroundColor: theme.paper, color: theme.ink };

  return (
    <form onSubmit={submit} className="sm:col-span-3 rounded-xl p-4 space-y-3" style={{ border: `1px solid ${theme.border}` }}>
      <label className="block text-xs font-semibold" style={{ color: theme.inkMuted }}>
        {c.name}
        <input className={`${field} mt-1`} style={fieldStyle} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
      <label className="block text-xs font-semibold" style={{ color: theme.inkMuted }}>
        {c.phone}
        <input
          className={`${field} mt-1`}
          style={fieldStyle}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          required
        />
      </label>
      <label className="block text-xs font-semibold" style={{ color: theme.inkMuted }}>
        {c.time}
        <select className={`${field} mt-1`} style={fieldStyle} value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)}>
          {c.timeOptions.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-semibold" style={{ color: theme.inkMuted }}>
        {c.note}
        <textarea className={`${field} mt-1`} style={fieldStyle} rows={2} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {message && state === "failed" && (
        <p className="text-sm m-0" style={{ color: theme.negative }}>{message}</p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={state === "sending"} className="flex-1 rounded-full px-4 py-3 text-sm font-bold disabled:opacity-60" style={button}>
          {state === "sending" ? c.sending : c.send}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-4 py-3 text-sm font-semibold" style={{ color: theme.inkMuted, border: `1px solid ${theme.border}` }}>
          {c.cancel}
        </button>
      </div>
    </form>
  );
}
