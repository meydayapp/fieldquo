// app/components/subRequests/SubCredentials.js
//
// A sub's insurance and WSIB/WCB clearance beside a price they sent, from
// the GC's OWN roster row (lib/quotes/importOptions.js credentialSummary).
// "Not recorded" is said as such — never as expired, never as fine.
//
// Shared by the quote page's compare (ImportedCostsPanel) and "Quotes from
// my subs" (/app/subcontractors/quotes), so the two screens cannot word the
// same certificate two ways. Also the change-order status words both print.
"use client";

import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

/** ChangeOrder status → the words for it beside "On change order CO-n". */
export const CHANGE_ORDER_STATUS_KEY = Object.freeze({
  pending: "app.importedCosts.coNotSent",
  waiting_client: "app.importedCosts.coWaiting",
  approved: "app.importedCosts.coApproved",
});

/** @param c credentialSummary() output, or null to render nothing */
export default function SubCredentials({ c, t, formatDate }) {
  if (!c) return null;
  if (!c.onRoster) {
    return (
      <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
        <ShieldQuestion size={12} />
        {t("app.importedCosts.notOnRoster")}
      </p>
    );
  }
  const line = (what, cred) => {
    const date = cred?.endsAt ? formatDate(cred.endsAt) : "";
    switch (cred?.state) {
      case "ok":
        return { cls: "text-muted-foreground", Icon: ShieldCheck, text: t("app.importedCosts.credOk", { what, date }) };
      case "due_soon":
        return { cls: "text-amber-700 dark:text-amber-400", Icon: ShieldAlert, text: t("app.importedCosts.credSoon", { what, date }) };
      case "expired":
        return { cls: "text-red-700 dark:text-red-400", Icon: ShieldAlert, text: t("app.importedCosts.credExpired", { what, date }) };
      default:
        return { cls: "text-muted-foreground", Icon: ShieldQuestion, text: t("app.importedCosts.credUnknown", { what }) };
    }
  };
  const items = [line(t("app.subcontractors.insurance"), c.insurance), line(t("app.importedCosts.clearance"), c.clearance)];
  return (
    <div className="mt-1 space-y-0.5">
      {items.map((it, i) => (
        <p key={i} className={`text-[11px] inline-flex items-center gap-1 mr-3 ${it.cls}`}>
          <it.Icon size={12} />
          {it.text}
        </p>
      ))}
    </div>
  );
}
