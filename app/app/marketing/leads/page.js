// app/app/marketing/leads/page.js
//
// Marketing › Leads — the leads marketing brought in, as the marketing agency
// may see them (owner, 2026-10-09).
//
// Built for the marketing-agency TEAM role (lib/permissions/marketingAgency.js),
// whose rail this page is on. Every row is lib/agency/leadRow.js's — the row
// the agency's API key gets — so this screen cannot show the agency more than
// its API does: a first name, where they came from, how far they got, a
// partial postal code. Contact details only while the company's "Share
// contact details" switch is on; job values only while "Share job values" is.
// The server decides both (GET /api/marketing/leads); this page draws what
// comes back and says which switches are on, so an empty phone column reads as
// "not shared", not as "nobody gave one".
//
// The company's own marketing people may open it too — it is exactly what
// their agency sees. Nothing links them here; the Marketing hub and the Leads
// board are their screens.
//
// No lib/agency/* import, on purpose (the results page's reason): those
// modules pull node:crypto, which has no place in a browser bundle.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Phone, Mail, MapPin } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { canManageMarketing, isMarketingAgency } from "@/lib/permissions/marketingAgency";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import { fetchJson, errorText } from "@/lib/fetchJson";

const STAGES = ["lead", "qualified", "appointment", "quote_sent", "won", "lost"];
const CHANNELS = ["facebook_ad", "instagram_ad", "whatsapp_ad", "google_ads", "agency_funnel", "website", "referral", "organic"];

export default function MarketingLeadsPage() {
  const caller = usePermissions();
  // Falls open while the provider resolves, like every page gate here; the
  // route refuses regardless (requireMarketingAccess).
  const allowed = !caller?.role || canManageMarketing(caller);
  if (!allowed) return <NoAccessPanel capability="user:manage" />;
  return <Leads agency={isMarketingAgency(caller)} />;
}

function Leads({ agency }) {
  const { t } = useTranslation();
  const { formatDate, money } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchJson("/api/marketing/leads"));
      setError("");
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = Array.isArray(data?.leads) ? data.leads : [];
  const sharing = data?.sharing || {};

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users size={22} aria-hidden="true" /> {t("app.marketingLeads.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {t(agency ? "app.marketingLeads.subtitleAgency" : "app.marketingLeads.subtitleCompany")}
        </p>
      </div>

      {data && (
        <p className="text-xs text-muted-foreground" data-marketing-leads-sharing>
          {t(sharing.contactDetails ? "app.marketingLeads.contactsShared" : "app.marketingLeads.contactsNotShared")}{" "}
          {t(sharing.jobValues ? "app.marketingLeads.moneyShared" : "app.marketingLeads.moneyNotShared")}
        </p>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 dark:border-red-900 bg-card px-4 py-3 text-sm text-foreground">
          {error}{" "}
          <button type="button" onClick={load} className="underline font-medium">
            {t("app.action.retry", "Try again")}
          </button>
        </div>
      )}
      {loading && !data && <div className="h-48 rounded-xl bg-muted animate-pulse" aria-busy="true" />}

      {data && !error && rows.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("app.marketingLeads.empty")}
        </div>
      )}

      {rows.length > 0 && (
        <ul className={`space-y-2 ${loading ? "opacity-60" : ""}`}>
          {rows.map((r) => (
            <li key={r.ref || `${r.leadCreatedAt}-${r.firstName}`} className="rounded-xl border border-border bg-card p-4 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-medium text-foreground break-words">
                  {(r.contactsShared && r.fullName) || r.firstName || t("app.marketingLeads.noName")}
                  {r.displayRef && <span className="ml-2 text-xs font-mono text-muted-foreground">{r.displayRef}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{r.firstContactAt ? formatDate(r.firstContactAt) : ""}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {CHANNELS.includes(r.channel) ? t(`app.agencyMetrics.channel.${r.channel}`) : t("app.agencyMetrics.channel.organic")}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold">
                  {t(`app.marketingLeads.stage.${STAGES.includes(r.stage) ? r.stage : "lead"}`)}
                </span>
                {r.campaignName && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground break-all">{r.campaignName}</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {r.serviceRequested && <span>{r.serviceRequested}</span>}
                {r.postalCode && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} aria-hidden="true" /> {r.postalCode}
                  </span>
                )}
                {r.contactsShared && r.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone size={11} aria-hidden="true" /> {r.phone}
                  </span>
                )}
                {r.contactsShared && r.email && (
                  <span className="inline-flex items-center gap-1 break-all">
                    <Mail size={11} aria-hidden="true" /> {r.email}
                  </span>
                )}
                {r.moneyShared && r.wonAmount !== null && r.wonAmount !== undefined && (
                  <span>{t("app.marketingLeads.won", { amount: money(r.wonAmount) })}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {data?.truncated && <p className="text-xs text-muted-foreground">{t("app.marketingLeads.truncated")}</p>}
    </div>
  );
}
