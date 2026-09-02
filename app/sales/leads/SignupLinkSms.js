// app/sales/leads/SignupLinkSms.js
//
// The panel that texts a prospect the rep's own signup link.
//
// ══ Three states, and only one of them has a button ════════════════════════
//
// The same discipline OutreachNotice applies to the email compose box, and the
// reason AGENTS.md gives it the most emphasis of any rule in the file: a Send
// button that posts into a 409 is a control that appears to work and doesn't.
//
//   1. Something is missing that the rep cannot fix — FieldQuo holds no sales
//      number, the mailing address isn't set, the prospect is on the
//      do-not-contact list, their number is outside +1, it's the middle of the
//      night where they are. No form. Every blocker is named, with the fix
//      written for whoever has to perform it.
//   2. The only thing missing is where the prospect IS. The form renders with
//      the time-zone selector required and nothing else — because that is the
//      one blocker the rep can clear, and they clear it by saying something
//      they already know.
//   3. Ready. The form renders with the exact message that will be sent,
//      shown in full. A rep should never press send on a message they have not
//      read, and the message is fixed rather than composed, so there is no
//      excuse for hiding it.
//
// The server re-checks all of it after this screen has rendered — see
// lib/sales/salesSms.js. This agreeing with it is courtesy, not security.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, MessageSquare } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";

function when(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SignupLinkSms({ leadId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [zone, setZone] = useState("");
  const [sent, setSent] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const next = await fetchJson(`/api/sales/sms?leadId=${encodeURIComponent(leadId)}`);
      setData(next);
      setZone(next.lead?.timeZone || "");
    } catch (err) {
      setError(err.message);
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await fetchJson("/api/sales/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ leadId, ...(zone ? { timeZone: zone } : {}) }, "sms"),
      });
      setSent(result);
      await load();
    } catch (err) {
      setError(err.message);
      // The refusal may have changed since the panel rendered — an opt-out that
      // arrived while the rep was reading it is the case this whole path is
      // built around — so re-ask rather than leaving a stale "ready" on screen.
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground flex items-center gap-2">
        {error ? (
          <span className="text-red-700 dark:text-red-300">{error}</span>
        ) : (
          <>
            <Loader2 size={15} className="animate-spin" /> Checking whether this can be texted…
          </>
        )}
      </div>
    );
  }

  const sms = data.sms || {};
  const blockers = sms.blockers || [];
  // The one blocker the rep clears themselves, by saying where the person is.
  const zoneOnly = blockers.length > 0 && blockers.every((b) => b.code === "time_zone_unknown");
  const showForm = sms.canSend || zoneOnly;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageSquare size={15} className="text-muted-foreground" />
        Text them your signup link
      </div>

      {data.messages?.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
          {data.messages.map((m) => (
            <p key={m.id}>
              Sent to {m.toE164} on {when(m.sentAt)}.
            </p>
          ))}
        </div>
      )}

      {sent && (
        <div className="rounded-md border border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
          <Check size={15} className="mt-0.5 shrink-0" />
          <span>Sent to {sent.to}.</span>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Every blocker, always — including when the form renders. A rep who has
          to fix a time zone should still be able to see that FieldQuo's mailing
          address is set, rather than discovering the next problem one send at a
          time. */}
      {blockers.map((b) => (
        <div
          key={b.code}
          className="rounded-md border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm flex items-start gap-2"
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-200">{b.title}</p>
            <p className="text-amber-800 dark:text-amber-300/90">{b.fix}</p>
          </div>
        </div>
      ))}

      {showForm && (
        <form onSubmit={send} className="space-y-3">
          <label className="block text-xs text-muted-foreground">
            Where are they? Texting is limited to 08:00–21:00 in their own time
            zone, and nothing here guesses it from their area code.
            <select
              required
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Pick their time zone…</option>
              {(data.timeZones || []).map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </select>
          </label>

          {sms.body && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
              {sms.body}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {sms.to ? `Goes to ${sms.to}` : "Goes to the number on this lead"}
            {sms.from ? `, from FieldQuo's own number ${sms.from}` : ""}. The
            wording is fixed: CASL requires a commercial text to name who sent
            it, carry FieldQuo&apos;s mailing address and offer a working
            unsubscribe, and STOP is handled for real.
          </p>

          <button
            type="submit"
            disabled={busy || !zone}
            className="text-sm font-semibold px-3 py-2 rounded-lg bg-inverted text-inverted-foreground flex items-center gap-1.5 disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <MessageSquare size={15} />}
            Send the text
          </button>
        </form>
      )}
    </div>
  );
}
