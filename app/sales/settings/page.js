"use client";

// app/sales/settings/page.js
//
// The rep's own settings: the portal's language, the languages they sell in,
// browser notifications, and what FieldQuo has on record about them.
//
// ══ Why this is its own screen now ════════════════════════════════════════
//
// /sales/pay used to carry all of this under the earnings — the reasoning
// there was that a rep has two things to set and visits both on the same
// errand. The owner's verdict on the result: "Pay and languages should not
// be in the same page." A salesperson opening a tab labelled Pay is asking
// how much, and scrolling past a language picker to find a payout form is
// not the same errand as changing which language the tour speaks. So Pay is
// money only — earnings, the weeks, the payout destination — and this is
// everything else about the rep.
//
// ══ The profile is read-only, and says so ═════════════════════════════════
//
// Name, sign-in email, work mailbox and signup code are set by FieldQuo when
// the rep is added (app/platform/sales/reps); no rep-side route writes any
// of them, and none is invented here. Showing them with "not here — say so
// and it will be corrected" is honest; an editable box that saved nowhere
// would be the dead control AGENTS.md's first rule exists for.
//
// ══ The controls are the same components /sales/welcome mounts ════════════
//
// RepLanguageChoice and RepSellsInChoice post to their own routes. Two forms
// posting the same body is failure class #4, so neither is written twice.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import RepLanguageChoice from "@/app/components/sales/RepLanguageChoice";
import RepSellsInChoice from "@/app/components/sales/RepSellsInChoice";
import BrowserNotifications from "@/app/components/notifications/BrowserNotifications";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

function Row({ label, value, muted = false }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[180px_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`text-sm break-all ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}

export default function SalesSettingsPage() {
  const { t } = useTranslation();
  const [me, setMe] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchJson("/api/sales/me");
        if (!cancelled) setMe(res);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The intro names the Pay tab by its own label, so the two cannot drift.
  const introParts = t("app.salesSettings.intro").split("{tab}");

  return (
    <div className="space-y-10 max-w-2xl" data-tour="sales-settings">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">{t("app.salesSettings.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {introParts[0]}
          <Link href="/sales/pay" className="underline text-foreground">
            {t("app.salesPortal.navPay")}
          </Link>
          {introParts[1] || ""}
        </p>
      </header>

      <section>
        <RepLanguageChoice />
      </section>

      {/* Directly under the portal language, because it is the question a rep
          confuses it with: that one is which words the tabs are drawn in,
          this one is which prospects the queue may hand them. Quebec rows go
          only to a rep with French here — lib/sales/leadLanguage.js. */}
      <section className="border-t border-border pt-8">
        <RepSellsInChoice />
      </section>

      {/* A ringing call, a text back, an @mention, a topped-up queue — as a
          system notification when the portal is in a background tab, and
          with the tab closed where the deployment has push keys. The same
          block /app and /platform mount; the endpoint is this surface's. */}
      <section className="border-t border-border pt-8">
        <BrowserNotifications endpoint="/api/sales/push-subscription" />
      </section>

      <section className="border-t border-border pt-8 space-y-3" data-rep-profile>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">{t("app.salesSettings.profileHeading")}</h2>
          <p className="text-sm text-muted-foreground">{t("app.salesSettings.profileIntro")}</p>
        </div>
        {failed ? (
          <p className="text-sm text-muted-foreground">{t("app.salesSettings.loadFailed")}</p>
        ) : !me ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
            {t("app.salesPay.loading")}
          </p>
        ) : (
          <dl className="space-y-2">
            <Row label={t("app.salesSettings.nameLabel")} value={me.name} />
            <Row label={t("app.salesSettings.emailLabel")} value={me.email} />
            <Row
              label={t("app.salesSettings.workEmailLabel")}
              value={me.workEmail || t("app.salesSettings.workEmailNone")}
              muted={!me.workEmail}
            />
            <Row label={t("app.salesSettings.codeLabel")} value={<span className="font-mono">{me.code}</span>} />
          </dl>
        )}
      </section>
    </div>
  );
}
