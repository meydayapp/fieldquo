// app/components/leads/IdentityReview.js
//
// Two pieces of the owner's 2026-10-03 ask, drawn where a person decides:
//
//   ReviewVerdict   the message reviewer's verdict on a Facebook / Instagram /
//                   WhatsApp conversation — genuine lead, not a lead (and
//                   which kind), existing client, already converted — with
//                   the evidence: the customer's own message, the client it
//                   matched, and the quote / job / invoice on file. Says
//                   plainly when the AI did not read it (no AI credit, an old
//                   conversation) and the verdict is the records' alone.
//                   Shared by the lead drawer and the inbox thread.
//   IdentityLinks   "Same person" on the lead drawer: every record folded or
//                   joined into this lead (a Facebook form submission, a
//                   conversation, a client on file), what matched, and a
//                   "Not the same person" undo that splits it back out.
//
// Both render nothing when there is nothing to say — every non-social lead.
"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, UserCheck, BadgeCheck, HelpCircle, Unlink, Loader2 } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

const VERDICT_STYLE = {
  genuine_lead: { icon: ShieldCheck, cls: "text-emerald-800 dark:text-emerald-300" },
  not_a_lead: { icon: ShieldAlert, cls: "text-red-800 dark:text-red-300" },
  existing_client: { icon: UserCheck, cls: "text-sky-800 dark:text-sky-300" },
  converted: { icon: BadgeCheck, cls: "text-violet-800 dark:text-violet-300" },
  undetermined: { icon: HelpCircle, cls: "text-muted-foreground" },
};
const AI_UNAVAILABLE = new Set(["no_credit", "ai_unconfigured", "history_ai_off"]);
const REASONS = new Set(["psid", "phone", "email", "name", "name_similar", "address", "recorded_link", "profile_name", "lead_form_timing"]);

function reasonList(list, t) {
  return (Array.isArray(list) ? list : []).map((r) => (REASONS.has(r) ? t(`app.leads.identity.reason.${r}`) : r)).join(" + ");
}

function DocLink({ d, t }) {
  if (d.restricted) {
    return <span className="italic">{t(`app.leads.review.doc.${d.type}`, { number: "" })} · {t("app.access.restricted", "Hidden by your access level")}</span>;
  }
  const label = t(`app.leads.review.doc.${d.type}`, { number: d.number || "" });
  const href = d.id ? (d.type === "quote" ? `/app/quotes/${encodeURIComponent(d.id)}` : d.type === "job" ? `/app/jobs/${encodeURIComponent(d.id)}` : `/app/invoices/${encodeURIComponent(d.id)}`) : null;
  return href ? (
    <Link href={href} className="underline underline-offset-2 text-foreground">
      {label}
    </Link>
  ) : (
    <span className="text-foreground">{label}</span>
  );
}

/**
 * @param review     publicReview() shape (lib/leads/messageReview.js) or null
 * @param onNotThisClient  when given AND the reviewer pointed the thread at the
 *                   client itself, draws "Not this client" (the inbox passes
 *                   a PATCH { clientId: null }; lead capture then never
 *                   re-links that client)
 */
export function ReviewVerdict({ review, t, onNotThisClient = null, busy = false, compact = false }) {
  if (!review || !VERDICT_STYLE[review.verdict]) return null;
  const { icon: Icon, cls } = VERDICT_STYLE[review.verdict];
  const docs = Array.isArray(review.documents) ? review.documents : [];
  const unavailable = review.aiUnavailable
    ? AI_UNAVAILABLE.has(review.aiUnavailable)
      ? t(`app.leads.review.aiUnavailable.${review.aiUnavailable}`)
      : t("app.leads.review.aiUnavailable.other")
    : null;
  return (
    <div className={`space-y-1 ${compact ? "" : "rounded-lg border border-border p-2.5"}`} data-review-verdict={review.verdict}>
      {!compact && <div className="text-xs font-semibold text-foreground">{t("app.leads.review.title", "Message review")}</div>}
      <p className={`flex flex-wrap items-center gap-1 text-xs font-semibold ${cls}`}>
        <Icon size={13} aria-hidden="true" />
        {t(`app.leads.review.verdict.${review.verdict}`)}
        {review.verdict === "not_a_lead" && review.notLeadReason && (
          <span className="font-normal">· {t(`app.leads.review.notLead.${review.notLeadReason}`)}</span>
        )}
        {review.verdict === "existing_client" && review.newWork && <span className="font-normal">· {t("app.leads.review.newWork")}</span>}
      </p>
      {review.message?.quote && <p className="text-xs text-muted-foreground italic">{t("app.leads.review.fromMessage", { quote: review.message.quote })}</p>}
      {review.client?.id && (
        <p className="text-xs text-muted-foreground">
          {t("app.leads.review.client", { fields: reasonList(review.client.matchedOn, t) })}{" "}
          <Link href={`/app/clients/${encodeURIComponent(review.client.id)}`} className="underline underline-offset-2 text-foreground">
            {t("app.leads.review.openClient")}
          </Link>
        </p>
      )}
      {docs.length > 0 && (
        <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {docs.map((d, i) => (
            <span key={`${d.type}-${d.id || i}`}>
              <DocLink d={d} t={t} />
              {!d.restricted && d.status ? ` · ${d.status.replace(/_/g, " ")}` : ""}
            </span>
          ))}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">{unavailable || (review.method === "ai" ? t("app.leads.review.methodAi") : t("app.leads.review.methodRecords"))}</p>
      {onNotThisClient && review.wroteClientId && (
        <button
          type="button"
          onClick={onNotThisClient}
          disabled={busy}
          className="inline-flex items-center gap-1.5 min-h-[32px] px-2.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          data-not-this-client
        >
          <Unlink size={12} aria-hidden="true" />
          {t("app.leads.review.notThisClient")}
        </button>
      )}
    </div>
  );
}

/**
 * @param links    GET /api/leads/[id]/documents `identityLinks`
 * @param canEdit  requests:view_create_edit — the undo is a write
 * @param onUndone re-read the drawer after an undo
 */
export function IdentityLinks({ leadId, links, canEdit, onUndone, t }) {
  const [confirming, setConfirming] = useState("");
  const [busy, setBusy] = useState("");
  const rows = Array.isArray(links) ? links : [];
  if (!rows.length) return null;

  async function undo(linkId) {
    setBusy(linkId);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/identity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.leads.identity.undoError", "Couldn't undo that link."));
        return;
      }
      setConfirming("");
      onUndone?.();
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-lg border border-border p-2.5 space-y-2" data-identity-links>
      <div className="text-xs font-semibold text-foreground">{t("app.leads.identity.title", "Same person")}</div>
      <ul className="space-y-2">
        {rows.map((l) => (
          <li key={l.id} className="text-xs space-y-0.5">
            <p className={l.status === "undone" ? "text-muted-foreground line-through" : "text-foreground"}>
              {t(`app.leads.identity.kind.${l.kind}`, l.kind)}
              {l.matchedOn?.length ? <span className="text-muted-foreground"> · {t("app.leads.identity.matchedOn", { fields: reasonList(l.matchedOn, t) })}</span> : null}
              {l.method === "ai" ? <span className="text-muted-foreground"> · {t("app.leads.identity.methodAi")}</span> : null}
            </p>
            {l.form && (
              <p className="text-muted-foreground">
                {t("app.leads.identity.formSaid", { details: [l.form.name, l.form.phone, l.form.email].filter(Boolean).join(" · ") })}
              </p>
            )}
            {l.kind === "thread" && l.threadId && (
              <Link href={`/app/messages?thread=${encodeURIComponent(l.threadId)}`} className="underline underline-offset-2 text-muted-foreground">
                {t("app.leads.identity.openConversation")}
              </Link>
            )}
            {l.kind === "client" && l.clientId && (
              <Link href={`/app/clients/${encodeURIComponent(l.clientId)}`} className="underline underline-offset-2 text-muted-foreground">
                {t("app.leads.review.openClient")}
              </Link>
            )}
            {l.status === "undone" ? (
              <p className="text-muted-foreground">
                {t("app.leads.identity.undone")}
                {l.splitLeadId ? (
                  <>
                    {" · "}
                    <Link href={`/app/leads?lead=${encodeURIComponent(l.splitLeadId)}`} className="underline underline-offset-2">
                      {t("app.leads.identity.openSplit")}
                    </Link>
                  </>
                ) : null}
              </p>
            ) : canEdit ? (
              confirming === l.id ? (
                <div className="rounded-lg bg-muted/50 border border-border p-2 space-y-1.5">
                  <p className="text-foreground">{t("app.leads.identity.notSameConfirm")}</p>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setConfirming("")} className="min-h-[32px] px-2.5 rounded-lg border border-border font-semibold">
                      {t("app.action.cancel", "Cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => undo(l.id)}
                      disabled={busy === l.id}
                      className="inline-flex items-center gap-1.5 min-h-[32px] px-2.5 rounded-lg border border-border font-semibold disabled:opacity-50"
                    >
                      {busy === l.id ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} aria-hidden="true" />}
                      {t("app.leads.identity.notSame")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(l.id)}
                  className="inline-flex items-center gap-1.5 min-h-[32px] px-2.5 rounded-lg border border-border font-semibold text-foreground hover:bg-muted"
                  data-not-same-person
                >
                  <Unlink size={12} aria-hidden="true" />
                  {t("app.leads.identity.notSame")}
                </button>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
