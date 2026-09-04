// app/app/marketing/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Megaphone,
  Plus,
  X,
  MapPin,
  Users,
  ExternalLink,
  Mail,
  Contact,
  DollarSign,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchArray } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { can } from "@/lib/permissions";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";

const TYPE_LABELS = {
  pamphlet: "Pamphlet distribution",
  meta_ads: "Meta / paid ads",
  email: "Email blast",
  other: "Other",
};

const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  completed: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  // An email send that didn't reach every subscriber yet — see
  // app/api/marketing/campaigns/[id]/send/route.js. Amber rather than the
  // "completed" blue: this campaign is not done, and the card should read
  // that way at a glance, not just on the detail page.
  partial: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
};

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

function emptyForm() {
  return {
    name: "",
    type: "pamphlet",
    assignedToId: "",
    budget: "",
    externalUrl: "",
    templateId: "",
  };
}

// Only templates meant for a bulk/marketing-style send belong in this
// picker — not the one-off Quote/Instructions/Receipt automation templates.
const ELIGIBLE_TEMPLATE_TYPES = ["marketing_email", "custom_email"];

export default function MarketingPage() {
  const { t } = useTranslation();
  // Same reason as the worker rate: the campaign budget was printed through a
  // catalogue sentence carrying a literal "$".
  const money = useCompanyMoney();
  // ── The create control could only ever 403 ───────────────────────────────
  //
  // POST /api/marketing/campaigns requires `user:manage`, and so do the send,
  // the stop-add, the PATCH and the DELETE beside it — and the list GET does
  // now too. So "New campaign" opened a modal with a name, a type, a budget
  // and an assignee in it, and threw the lot away on save.
  //
  // The coarse role, because every route under /api/marketing gates on that
  // axis; the grid has no marketing category to ask instead. Falls OPEN when
  // the provider has not resolved — PermissionProvider's rule.
  const caller = usePermissions();
  const canManageMarketing = !caller?.role || can(caller.role, "user:manage");
  // null until the server answers — see lib/loadState.js.
  const [campaigns, setCampaigns] = useState(null);
  // ── null, not [] — the same rule `campaigns` above already follows ───────
  //
  // The doctrine was applied to one list on this page and not the other two.
  // A 401, a 500 or a dropped connection on GET /api/settings/document-templates
  // landed as `[]`, which rendered "you have no templates yet, go and make one"
  // at a contractor with five of them — and hard-disabled the submit button
  // underneath it, so the campaign could not be created either. An empty array
  // is a CLAIM (lib/loadState.js); these two had no way to say "not known".
  const [members, setMembers] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [templatesErrorKey, setTemplatesErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Separate from `error`, which lives inside the create modal. A failed load
  // is not a form problem and must not share its banner.
  const [errorKey, setErrorKey] = useState("");

  const loadMembers = useCallback(async () => {
    const result = await fetchArray("/api/settings/members");
    if (result.aborted) return;
    // A refused member list narrows the assignee dropdown to "Unassigned",
    // which is a real and selectable choice — so this stays null rather than
    // [] and the dropdown says the list could not be read.
    setMembers(result.ok ? result.data : null);
  }, []);

  const loadTemplates = useCallback(async () => {
    const result = await fetchArray("/api/settings/document-templates");
    if (result.aborted) return;
    if (!result.ok) {
      setTemplates(null);
      setTemplatesErrorKey(result.errorKey);
      return;
    }
    setTemplatesErrorKey("");
    setTemplates(
      result.data.filter((tpl) => ELIGIBLE_TEMPLATE_TYPES.includes(tpl.type)),
    );
  }, []);

  async function load() {
    setErrorKey("");
    const result = await fetchArray("/api/marketing/campaigns");
    if (result.aborted) return;
    if (result.ok) setCampaigns(result.data);
    else setErrorKey(result.errorKey);
  }

  useEffect(() => {
    Promise.all([
      load(),
      loadMembers(),
      loadTemplates(),
    ]).finally(() => setLoading(false));
    // Mount only. Both loaders are stable useCallbacks with no dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError(t("app.marketing.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || t("app.marketing.createError"));
      setForm(emptyForm());
      setShowModal(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const isPamphlet = form.type === "pamphlet";
  const isEmail = form.type === "email";

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Megaphone size={22} /> {t("app.nav.marketing")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            {t("app.marketing.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            data-tour="marketing-subscribers"
            href="/app/marketing/subscribers"
            className="flex items-center gap-2 border border-border text-foreground px-4 py-2.5 rounded-full text-sm font-semibold hover:bg-muted"
          >
            <Contact size={14} /> {t("app.marketing.subscribers")}
          </Link>
          {canManageMarketing && (
            <Link
              href="/app/marketing/spend"
              className="flex items-center gap-2 border border-border text-foreground px-4 py-2.5 rounded-full text-sm font-semibold hover:bg-muted"
            >
              <DollarSign size={14} /> {t("app.marketing.spendLink", "Marketing spend")}
            </Link>
          )}
          {canManageMarketing && (
            <button
              data-tour="marketing-new"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
            >
              <Plus size={14} /> {t("app.marketing.newCampaign")}
            </button>
          )}
        </div>
      </div>

      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={load}
        isEmpty={(campaigns ?? []).length === 0}
        skeleton={
          <div className="grid sm:grid-cols-2 gap-4 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="h-36 bg-muted rounded-xl" />
            ))}
          </div>
        }
        empty={
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Megaphone size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("app.marketing.empty")}
            </p>
          </div>
        }
      >
        <div className="grid sm:grid-cols-2 gap-4">
          {(campaigns ?? []).map((c) => {
            const pct =
              c.stopCount > 0
                ? Math.round((c.visitedCount / c.stopCount) * 100)
                : 0;
            const inner = (
              <div className="bg-card border border-border rounded-xl p-5 h-full hover:border-border transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-foreground">{c.name}</h2>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[c.status] || "bg-muted text-muted-foreground"}`}
                  >
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("app.marketing.type." + c.type, TYPE_LABELS[c.type] || c.type)}
                </p>

                {c.type === "pamphlet" ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />{" "}
                        {t("app.marketing.stops", {
                          visited: c.visitedCount,
                          total: c.stopCount,
                        })}
                      </span>
                      <span>
                        {t("app.marketing.spoke", { count: c.spokeCount })}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-inverted"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ) : c.type === "email" ? (
                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail size={12} />{" "}
                      {c.template?.name || t("app.marketing.noTemplate")}
                    </span>
                    {c.sentAt ? (
                      <span className="text-emerald-700 dark:text-emerald-300">
                        {t("app.marketing.sentTo", {
                          count: c.recipientCount ?? 0,
                        })}
                      </span>
                    ) : (
                      <span>{t("app.marketing.notSentYet")}</span>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    {c.budget != null && (
                      <span>
                        {t("app.marketing.budgetAmount", {
                          amount: money(c.budget),
                        })}
                      </span>
                    )}
                    {c.externalUrl && (
                      <span className="flex items-center gap-1">
                        <ExternalLink size={12} /> {t("app.marketing.linked")}
                      </span>
                    )}
                  </div>
                )}

                {c.assignedTo && (
                  <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                    <Users size={12} /> {c.assignedTo.name}
                  </p>
                )}
              </div>
            );
            // Pamphlet and email campaigns have a detail workflow worth
            // opening (route/stops, or template + send); paid-ads/other are
            // just a record card.
            return c.type === "pamphlet" || c.type === "email" ? (
              <Link key={c.id} href={`/app/marketing/${c.id}`}>
                {inner}
              </Link>
            ) : (
              <div key={c.id}>{inner}</div>
            );
          })}
        </div>
      </ListState>

      {/* The modal answers the question itself. It is the half that costs
          somebody the campaign they just typed out, so it does not rely on the
          single button that opens it staying hidden. */}
      {canManageMarketing && showModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {t("app.marketing.newCampaign")}
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-3 py-2 mb-3">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3">
              <input
                autoFocus
                required
                placeholder={t("app.marketing.namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className={inputClass}
              >
                <option value="pamphlet">{t("app.marketing.type.pamphlet")}</option>
                <option value="meta_ads">{t("app.marketing.type.meta_ads")}</option>
                <option value="email">{t("app.marketing.type.email")}</option>
                <option value="other">{t("app.marketing.type.other")}</option>
              </select>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  {t("app.marketing.assignTo")}
                </label>
                <select
                  value={form.assignedToId}
                  onChange={(e) =>
                    setForm({ ...form, assignedToId: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">{t("app.marketing.unassigned")}</option>
                  {(members ?? []).map((m) => (
                    <option key={m.user?.id} value={m.user?.id}>
                      {m.user?.name || m.user?.email}
                    </option>
                  ))}
                  {/* A list that would not load silently collapsed this to
                      "Unassigned" — which is itself a valid choice, so nothing
                      about the dropdown looked wrong. Said out loud instead,
                      and disabled so it cannot be picked as a person. */}
                  {members === null && (
                    <option value="" disabled>
                      {t(
                        "app.marketing.membersUnavailable",
                        "Team list unavailable — reload to assign someone",
                      )}
                    </option>
                  )}
                </select>
              </div>

              {isEmail && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    {t("app.marketing.templateToSend")}
                  </label>
                  <select
                    required
                    value={form.templateId}
                    onChange={(e) =>
                      setForm({ ...form, templateId: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="" disabled>
                      {t("app.marketing.chooseTemplate")}
                    </option>
                    {(templates ?? []).map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                  {/* Three states, and only ONE of them is "go and write one".
                      A list that failed to load must not send somebody off to
                      recreate templates they already have — that is the data
                      re-entry lib/loadState.js exists to prevent. */}
                  {templatesErrorKey ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      {t(templatesErrorKey)}{" "}
                      <button
                        type="button"
                        onClick={loadTemplates}
                        className="underline font-medium"
                      >
                        {t("app.load.retry")}
                      </button>
                    </p>
                  ) : (
                    Array.isArray(templates) &&
                    templates.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        {t("app.marketing.noTemplatesPre")}{" "}
                        <a href="/app/settings/email-templates" className="underline">
                          {t("app.marketing.emailTemplatesLink")}
                        </a>{" "}
                        {t("app.marketing.noTemplatesPost")}
                      </p>
                    )
                  )}
                </div>
              )}

              {!isPamphlet && !isEmail && (
                <>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={t("app.marketing.budgetPlaceholder")}
                    value={form.budget}
                    onChange={(e) =>
                      setForm({ ...form, budget: e.target.value })
                    }
                    className={inputClass}
                  />
                  <input
                    placeholder={t("app.marketing.linkPlaceholder")}
                    value={form.externalUrl}
                    onChange={(e) =>
                      setForm({ ...form, externalUrl: e.target.value })
                    }
                    className={inputClass}
                  />
                </>
              )}

              <button
                type="submit"
                disabled={saving || (isEmail && !form.templateId)}
                className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {saving
                  ? t("app.marketing.creating")
                  : t("app.marketing.createCampaign")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
