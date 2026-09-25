// app/site/[subdomain]/ClientLoginForm.js
//
// The one interactive piece of /client on a company's website: an email box
// that asks POST /api/portal-login to send this client their portal link.
//
// Whatever the server did with the address, the page says the same sentence
// afterwards — "if you're a client, a link is on its way" — because the
// server answers the same way for a match and a miss (see the route's
// header). The only other things it can say are about the request itself:
// not an email, too many tries, or something broke.
//
// Colours arrive measured from lib/documents/theme.js via the server page —
// the button is fillPair, the text is theme ink — so a yellow or white brand
// still produces a readable control.
"use client";

import { useState } from "react";
import { Loader2, Mail, Check } from "lucide-react";

export default function ClientLoginForm({ subdomain, copy, colours }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | busy | sent
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setState("busy");
    try {
      const res = await fetch("/api/portal-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subdomain, email }),
      });
      if (res.ok) {
        setState("sent");
        return;
      }
      setState("idle");
      if (res.status === 400) setError(copy.invalid);
      else if (res.status === 429) setError(copy.busy);
      else setError(copy.failed);
    } catch {
      setState("idle");
      setError(copy.failed);
    }
  }

  if (state === "sent") {
    return (
      <div
        data-client-login-sent
        className="flex items-start gap-3 rounded-2xl border p-5 text-sm leading-relaxed"
        style={{ borderColor: colours.border, color: colours.ink, backgroundColor: colours.wash }}
      >
        <Check size={18} className="shrink-0 mt-0.5" style={{ color: colours.positive }} />
        <p>{copy.sent}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <label className="block text-sm font-semibold" style={{ color: colours.ink }}>
        {copy.email}
        <input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 block w-full rounded-xl border px-4 py-3 text-base font-normal outline-none focus:ring-2"
          style={{ borderColor: colours.border, color: colours.ink, backgroundColor: "#ffffff" }}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm" style={{ color: colours.negative }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "busy" || !email.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-bold disabled:opacity-60"
        style={{ backgroundColor: colours.fillBg, color: colours.fillFg }}
      >
        {state === "busy" ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
        {copy.send}
      </button>
      <p className="text-xs" style={{ color: colours.muted }}>
        {copy.noPassword}
      </p>
    </form>
  );
}
