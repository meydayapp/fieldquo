// app/app/settings/meta-ads/MetaLeadFormsPanel.js
//
// "Facebook lead forms", beside the Meta Ads connection it depends on.
//
// A contractor runs an ad that says "Get a free painting estimate". Somebody
// taps it and fills in Meta's built-in form. This panel is where they say
// which of those forms FieldQuo should turn into leads.
//
// ══ The state that matters most is the one where nothing works ═════════════
//
// `leads_retrieval` is not approved for this app yet. So the ordinary state
// of this panel today is: connected, forms listed if any were ever
// discovered, every toggle DISABLED, and a sentence saying exactly why.
//
// Not hidden. Hiding it would leave a contractor who saw the feature
// advertised wondering where it went, and would hide the one fact they need —
// that leads are not arriving and it is not their fault. Not enabled either:
// a toggle that flips and writes a column nothing can act on is precisely the
// dead control AGENTS.md's first rule is about. Shown, disabled, explained.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Inbox, RefreshCw, Search } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";

export default function MetaLeadFormsPanel({ connected }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyFormId, setBusyFormId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson("/api/meta/leads/forms"));
    } catch (err) {
      // An empty panel and a failed read are different facts and must not
      // render the same — the distinction check:settings-empty-vs-error
      // exists for. `data` stays null and the error is shown.
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(formId, active) {
    setBusyFormId(formId);
    setError("");
    try {
      await fetchJson("/api/meta/leads/forms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId, active }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyFormId("");
    }
  }

  async function refresh() {
    setRefreshing(true);
    setError("");
    setRefreshNote("");
    try {
      const res = await fetchJson("/api/meta/leads/forms/refresh", { method: "POST" });
      setRefreshNote(t("app.setMetaLeads.refreshFound", { count: res.found }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <div className="h-40 bg-muted rounded-xl animate-pulse" />;
  }

  const scopeReady = Boolean(data?.leadsScopeEnabled);
  // One sentence, one reason, used for the banner AND as the disabled
  // toggle's title attribute — so what a contractor reads and what a hover
  // tells them cannot drift apart.
  const blockedReason = t(
    "app.setMetaLeads.pendingApproval",
    "Facebook lead forms need Meta's approval of one more permission; nothing is being received yet.",
  );

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-2">
        <Inbox size={18} className="shrink-0 mt-0.5 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">
            {t("app.setMetaLeads.title", "Facebook lead forms")}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t(
              "app.setMetaLeads.subtitle",
              "When someone fills in the form attached to one of your Facebook or Instagram ads, FieldQuo can add them as a lead.",
            )}
          </p>
        </div>
      </div>

      {/* What happens to a lead — asked for in plain words, because the
          question a contractor actually has is "and then what?" */}
      <p className="text-sm text-muted-foreground">
        {t(
          "app.setMetaLeads.whatHappens",
          "A lead from a form you switch on appears in Leads like any other enquiry — it is scored the same way, notifies the same people, and your own follow-up rules apply to it.",
        )}
      </p>

      {/* THE state, today. Never hidden, never dressed up. */}
      {!scopeReady && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{blockedReason}</span>
        </div>
      )}

      {!connected && (
        <p className="text-sm text-muted-foreground">
          {t(
            "app.setMetaLeads.needsConnection",
            "Connect your Meta ad account above first — the same login is what reads your Pages.",
          )}
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <>
          <div className="text-xs text-muted-foreground">
            {data.lastLeadAt
              ? t("app.setMetaLeads.lastReceived", {
                  date: new Date(data.lastLeadAt).toLocaleString(),
                })
              : t("app.setMetaLeads.noneReceived", "No lead has been received from Meta yet.")}
          </div>

          {data.forms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("app.setMetaLeads.noForms", "No lead forms found on your Pages yet.")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.forms.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 border border-border rounded-lg px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-foreground truncate">
                      {f.name || f.formId}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {f.pageName || f.pageId}
                      {" · "}
                      {t("app.setMetaLeads.formLeadCount", { count: f.leadCount })}
                      {f.lastLeadAt
                        ? ` · ${t("app.setMetaLeads.formLastLead", {
                            date: new Date(f.lastLeadAt).toLocaleDateString(),
                          })}`
                        : ""}
                    </div>
                  </div>
                  {/* Disabled with the reason ON it, not merely greyed out.
                      `title` carries the same sentence as the banner. */}
                  <label
                    className={`flex items-center gap-2 text-xs shrink-0 ${
                      scopeReady ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                    }`}
                    title={scopeReady ? undefined : blockedReason}
                  >
                    <input
                      type="checkbox"
                      checked={f.active}
                      disabled={!scopeReady || busyFormId === f.formId}
                      onChange={(e) => toggle(f.formId, e.target.checked)}
                    />
                    <span className="text-muted-foreground">
                      {f.active
                        ? t("app.setMetaLeads.on", "On")
                        : t("app.setMetaLeads.off", "Off")}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {/* Which campaigns the leads came from. Counts only — a cost per
              lead would be a new claim the KPI page currently refuses to
              make; see the GET route's comment. */}
          {data.campaigns.length > 0 && (
            <div className="text-xs bg-muted rounded-lg px-3 py-2 text-muted-foreground space-y-0.5">
              <div className="font-semibold text-foreground">
                {t("app.setMetaLeads.campaignsTitle", "Which campaigns these leads came from")}
              </div>
              {data.campaigns.map((c) => (
                <div key={c.campaignId}>
                  {c.campaignName || c.campaignId}
                  {" · "}
                  {t("app.setMetaLeads.formLeadCount", { count: c.leadCount })}
                </div>
              ))}
            </div>
          )}

          {refreshNote && <div className="text-xs text-muted-foreground">{refreshNote}</div>}

          <button
            onClick={refresh}
            disabled={!scopeReady || !connected || refreshing}
            title={scopeReady ? undefined : blockedReason}
            className="flex items-center gap-1.5 border border-border text-foreground px-3.5 py-2 rounded-full text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {refreshing ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Search size={14} />
            )}
            {t("app.setMetaLeads.findForms", "Find my lead forms")}
          </button>
        </>
      )}
    </div>
  );
}
