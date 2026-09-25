// app/components/clients/ClientPortalLink.js
//
// "Copy portal link" and "Email portal link" on a client's page — the office's
// way to hand a client the link to their own account (quotes, invoices,
// visits, plans) without waiting for an invoice email to carry it.
//
// Both go through POST /api/clients/[id]/portal-link, which mints the token
// on first use. The link is a credential — whoever holds it sees the client's
// balance — so the hint under the buttons says so, and the page draws these
// only for a member the route will answer (clientsProperties:full_view).
"use client";

import { useState } from "react";
import { Link2, Send, Loader2, Check } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { showToast } from "@/lib/toast";

export default function ClientPortalLink({ clientId, hasEmail }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);

  async function call(send) {
    const res = await fetch(`/api/clients/${clientId}/portal-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ send }),
    });
    if (!res.ok) {
      await reportResponseError(res, t("app.clientDetail.portal.failed", "Couldn't get the portal link. Try again."));
      return null;
    }
    return res.json().catch(() => null);
  }

  async function copy() {
    setBusy("copy");
    try {
      const d = await call(false);
      if (!d?.url) return;
      try {
        await navigator.clipboard.writeText(d.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // Clipboard refused (an insecure origin, a browser setting). Show the
        // link so it can be copied by hand rather than claiming it was copied.
        window.prompt(t("app.clientDetail.portal.copyManually", "Copy this link:"), d.url);
      }
    } catch (err) {
      showError(err?.message || t("app.clientDetail.portal.failed", "Couldn't get the portal link. Try again."));
    } finally {
      setBusy("");
    }
  }

  async function send() {
    setBusy("send");
    try {
      const d = await call(true);
      if (d?.sentTo) {
        showToast({ message: t("app.clientDetail.portal.sent", "Portal link sent to {email}", { email: d.sentTo }), tone: "success" });
      }
    } catch (err) {
      showError(err?.message || t("app.clientDetail.portal.failed", "Couldn't get the portal link. Try again."));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="w-full" data-client-portal-link>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={copy}
          disabled={Boolean(busy)}
          className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold hover:bg-muted disabled:opacity-60"
        >
          {busy === "copy" ? <Loader2 size={14} className="animate-spin" /> : copied ? <Check size={14} /> : <Link2 size={14} />}
          {copied ? t("app.clientDetail.portal.copied", "Link copied") : t("app.clientDetail.portal.copy", "Copy portal link")}
        </button>
        {/* Drawn disabled with the reason, rather than hidden, when there is
            no address to send to — the route would refuse it anyway. */}
        <button
          type="button"
          onClick={send}
          disabled={Boolean(busy) || !hasEmail}
          title={hasEmail ? undefined : t("app.clientDetail.portal.noEmail", "Add an email address to send the link")}
          className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold hover:bg-muted disabled:opacity-60"
        >
          {busy === "send" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {t("app.clientDetail.portal.send", "Email portal link")}
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        {hasEmail
          ? t("app.clientDetail.portal.hint", "Opens this client's quotes, invoices, visits and plans. Anyone with the link can see them — share it only with the client.")
          : t("app.clientDetail.portal.noEmail", "Add an email address to send the link")}
      </p>
    </div>
  );
}
