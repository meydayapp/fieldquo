"use client";
// app/components/sales/TextThem.js
//
// "Text them" — one control, beside every Call button.
//
// ══ Why one component ═════════════════════════════════════════════════════
//
// A company told the rep "text me instead", and the rep "found it a bit hard
// to send a new text — maybe it's not linked". It was not linked: the number
// on the card in front of them (the queue's Dialer card, the lead page, the
// call panel during and after a call, the incoming-call dialog) had a Call
// button and nothing that opened a text. The rep had to leave the card, open
// Texts, press New message, find or retype the number, and land on a panel
// whose only message was the fixed signup introduction.
//
// This is the press that was missing, and it is ONE component rather than a
// link written into four screens, because the four would have drifted: one
// would forget the lead, one would forget the ?compose=own that opens the
// blank box, one would send a test line onto a record. What it does:
//
//   1. With a prospect and no lead yet (the queue card): the prospect becomes
//      the rep's lead through POST /api/sales/leads — the same carry-across
//      the Dialer's "Text the signup link" and the Disposition tab's "Work as
//      a lead" make, with its claim check.
//   2. POST /api/sales/messages/start with the number and that leadId. The
//      server (lib/sales/messages/startThread.js) decides everything: the
//      do-not-contact list, Canada/US, another rep's claim, and — when the
//      number is not on the lead yet — records it there through the SAME
//      write a typed dial number goes through (lib/sales/contact/record.js),
//      or leaves it off the record when it is a test line or a test account.
//   3. Opens /sales/messages?thread=<number>&compose=own — the thread on that
//      number, with the blank composer focused and the first-message picker
//      above it (signup link / as discussed / write your own).
//
// Every refusal is the server's sentence, printed under the button. Nothing
// here sends a text: the composer does, through the reply route and every
// gate it has.
//
// `variant`: "button" (a full-width button under a Call button), "chip" (the
// small action the thread header and the live-call strip use), "link" (the
// dialog's link row, beside Open / Notes / Save as a new lead).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

/** The href the control lands on — one shape, so the outcome form and the check can name it. */
export function textThreadHref(e164, compose = "own") {
  const sp = new URLSearchParams();
  sp.set("thread", e164);
  if (compose) sp.set("compose", compose);
  return `/sales/messages?${sp.toString()}`;
}

/**
 * Open (or make) the thread for this number — the three steps in the
 * header, in order — and return the href to land on. Throws the server's
 * own sentence. Exported so a screen with a different button (the outcome
 * form) can take the same path.
 */
export async function openTextThread({ e164, leadId = null, prospectId = null, compose = "own" }) {
  let id = leadId || null;
  if (!id && prospectId) {
    const body = await fetchJson("/api/sales/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId }),
    });
    id = body?.lead?.id || null;
  }
  const started = await fetchJson("/api/sales/messages/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: e164, ...(id ? { leadId: id } : {}) }),
  });
  return { href: textThreadHref(started.with || e164, compose), leadId: started.leadId || id, unsaved: started.unsaved || null };
}

const CLASS = {
  button:
    "inline-flex items-center justify-center gap-2 min-h-[44px] w-full px-4 py-2.5 rounded-lg text-sm font-semibold border-2 border-brand-accent bg-card text-foreground disabled:opacity-60",
  chip:
    "inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-[36px] rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60",
  link:
    "inline-flex items-center gap-1.5 min-h-[44px] px-2 -mx-2 rounded-lg text-sm font-semibold text-brand-accent-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60",
};

export default function TextThemButton({
  e164,
  leadId = null,
  prospectId = null,
  businessName = null,
  variant = "button",
  // "They'd rather text" on a live call reads differently from "Text them"
  // on an idle card; the caller picks the sentence.
  label = null,
  compose = "own",
  className = "",
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!e164) return null;

  async function press() {
    setBusy(true);
    setError("");
    try {
      const { href } = await openTextThread({ e164, leadId, prospectId, compose });
      router.push(href);
    } catch (err) {
      // The server's own sentence — which rule refused, and for a held
      // number, whose it is. Never swallowed: a press that does nothing
      // is the control this file exists to replace.
      setError(err?.message || t("app.salesText.newOpenFailed"));
    } finally {
      setBusy(false);
    }
  }

  const words = label || (businessName ? t("app.salesText.textThemNamed", { name: businessName }) : t("app.salesText.textThem"));
  return (
    <div className={`${variant === "button" ? "space-y-1.5" : "inline-flex flex-col"} ${className}`} data-text-them={variant}>
      <button type="button" onClick={press} disabled={busy} className={CLASS[variant] || CLASS.button} data-text-them-button>
        {busy ? <Loader2 size={variant === "chip" ? 13 : 16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <MessageSquare size={variant === "chip" ? 13 : 16} aria-hidden="true" />}
        <span className="min-w-0 break-words">{words}</span>
      </button>
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-300 break-words" role="alert" data-text-them-error>
          {error}
        </p>
      ) : null}
    </div>
  );
}
