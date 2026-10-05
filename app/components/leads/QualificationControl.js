// app/components/leads/QualificationControl.js
//
// What a conversation IS — only a tap / a conversation / a lead / not
// relevant (lib/leads/qualification.js) — with the reason in the person's
// own words, and the one-tap change. Shared by the inbox thread and the lead
// drawer, so the two read and write the tier the same way:
//
//   QualificationControl  the chip, the reason, and four buttons
//   TierChip              the chip alone, for a board card
//   scopeCountsText       "22 doors + 15 drawers" in the screen's language
//
// Every key is written out in full below — check:translations cannot see a
// key that only exists at runtime, and a stored reasonKey the map does not
// know is shown as nothing rather than as a raw key.
"use client";

import { useState } from "react";
import { Loader2, Hand, MessageSquare, Target, Ban, RotateCcw } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

export const TIER_ORDER = ["lead", "conversation", "tap_only", "not_relevant"];

const TIER = {
  lead: { labelKey: "app.leads.tier.lead", icon: Target, chip: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200" },
  conversation: { labelKey: "app.leads.tier.conversation", icon: MessageSquare, chip: "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200" },
  tap_only: { labelKey: "app.leads.tier.tapOnly", icon: Hand, chip: "bg-muted text-foreground" },
  not_relevant: { labelKey: "app.leads.tier.notRelevant", icon: Ban, chip: "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200" },
};

const REASON_KEYS = {
  "app.leads.tier.reason.tapOnly": "app.leads.tier.reason.tapOnly",
  "app.leads.tier.reason.tapRepeated": "app.leads.tier.reason.tapRepeated",
  "app.leads.tier.reason.greetingOnly": "app.leads.tier.reason.greetingOnly",
  "app.leads.tier.reason.emojiOnly": "app.leads.tier.reason.emojiOnly",
  "app.leads.tier.reason.adClickOnly": "app.leads.tier.reason.adClickOnly",
  "app.leads.tier.reason.nothingSaid": "app.leads.tier.reason.nothingSaid",
  "app.leads.tier.reason.mediaOnly": "app.leads.tier.reason.mediaOnly",
  "app.leads.tier.reason.misTap": "app.leads.tier.reason.misTap",
  "app.leads.tier.reason.spam": "app.leads.tier.reason.spam",
  "app.leads.tier.reason.vendor": "app.leads.tier.reason.vendor",
  "app.leads.tier.reason.declined": "app.leads.tier.reason.declined",
  "app.leads.tier.reason.offService": "app.leads.tier.reason.offService",
  "app.leads.tier.reason.notNow": "app.leads.tier.reason.notNow",
  "app.leads.tier.reason.lead": "app.leads.tier.reason.lead",
  "app.leads.tier.reason.conversation": "app.leads.tier.reason.conversation",
  "app.leads.tier.reason.unsure": "app.leads.tier.reason.unsure",
  "app.leads.tier.reason.ai": "app.leads.tier.reason.ai",
  "app.leads.tier.reason.person": "app.leads.tier.reason.person",
};

const DETAIL_KEYS = {
  photos: "app.leads.tier.detail.photos",
  address: "app.leads.tier.detail.address",
  phone: "app.leads.tier.detail.phone",
  email: "app.leads.tier.detail.email",
  booking: "app.leads.tier.detail.booking",
  jobQuestion: "app.leads.tier.detail.jobQuestion",
};

const UNIT_KEYS = {
  doors: "app.leads.scope.unit.doors",
  drawers: "app.leads.scope.unit.drawers",
  boxes: "app.leads.scope.unit.boxes",
  pieces: "app.leads.scope.unit.pieces",
  rooms: "app.leads.scope.unit.rooms",
  sqft: "app.leads.scope.unit.sqft",
};

/** "22 doors + 15 drawers", translated. Empty string for no counts. */
export function scopeCountsText(counts, t) {
  if (!counts || typeof counts !== "object") return "";
  return Object.keys(UNIT_KEYS)
    .filter((u) => Number(counts[u]) > 0)
    .map((u) => t(UNIT_KEYS[u], { count: counts[u] }))
    .join(" + ");
}

function detailsText(details, t) {
  return (Array.isArray(details) ? details : [])
    .map((d) => (d.key === "counts" ? scopeCountsText(d.params, t) : DETAIL_KEYS[d.key] ? t(DETAIL_KEYS[d.key], d.params || {}) : ""))
    .filter(Boolean)
    .join(", ");
}

/** The chip alone. Null when there is no tier. */
export function TierChip({ qualification, t, size = "sm" }) {
  const cfg = qualification ? TIER[qualification.tier] : null;
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${cfg.chip} ${size === "lg" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"}`}
      title={qualification.reasonKey && REASON_KEYS[qualification.reasonKey] ? t(REASON_KEYS[qualification.reasonKey], qualification.params || {}) : undefined}
    >
      <Icon size={11} aria-hidden="true" />
      {t(cfg.labelKey)}
      {qualification.origin === "ad" ? ` · ${t("app.leads.tier.fromAd")}` : ""}
    </span>
  );
}

/**
 * @param qualification  publicQualification() or null
 * @param endpoint       POST URL taking { tier }
 * @param canEdit        draw the four buttons
 * @param onChanged      (qualification, response) => void
 */
export default function QualificationControl({ qualification, endpoint, canEdit = false, onChanged = null, t }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function set(tier) {
    if (!endpoint) return;
    setBusy(tier === null ? "clear" : tier);
    setErr("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        await reportResponseError(res, setErr, t("app.leads.tier.saveError"));
        return;
      }
      const data = await res.json();
      onChanged?.(data.qualification || null, data);
    } catch {
      setErr(t("app.leads.tier.saveError"));
    } finally {
      setBusy("");
    }
  }

  const q = qualification;
  const reasonKey = q?.reasonKey && REASON_KEYS[q.reasonKey];
  const details = q ? detailsText(q.details, t) : "";
  const method = !q
    ? null
    : q.method === "person"
      ? t("app.leads.tier.byPerson", { name: q.override?.byName || t("app.leads.someone") })
      : q.method === "ai"
        ? t("app.leads.tier.byAi")
        : t("app.leads.tier.byRules");

  return (
    <div className="space-y-1.5" data-qualification>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-foreground">{t("app.leads.tier.title")}</span>
        {q ? <TierChip qualification={q} t={t} /> : <span className="text-xs text-muted-foreground">{t("app.leads.tier.none")}</span>}
        {method && <span className="text-[11px] text-muted-foreground">{method}</span>}
        {q?.unsure && <span className="text-[11px] text-muted-foreground">· {t("app.leads.tier.unsure")}</span>}
      </div>
      {q && reasonKey && (
        <p className="text-xs text-muted-foreground break-words">
          {q.method === "person" && q.ruleTier && q.ruleTier !== q.tier
            ? t("app.leads.tier.rulesSaid", { tier: t(TIER[q.ruleTier]?.labelKey || "app.leads.tier.conversation") })
            : t(reasonKey, q.params || {})}
          {details ? ` — ${details}` : ""}
        </p>
      )}
      {canEdit && endpoint && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("app.leads.tier.change")}>
          {TIER_ORDER.map((tier) => {
            const cfg = TIER[tier];
            const active = q?.tier === tier && q?.method === "person";
            return (
              <button
                key={tier}
                type="button"
                disabled={Boolean(busy)}
                aria-pressed={active}
                onClick={() => set(tier)}
                className={`min-h-[36px] px-2.5 rounded-full border text-[11px] font-semibold inline-flex items-center gap-1 disabled:opacity-50 ${
                  active ? "bg-inverted text-inverted-foreground border-transparent" : "border-border text-foreground"
                }`}
              >
                {busy === tier ? <Loader2 size={11} className="animate-spin" /> : <cfg.icon size={11} aria-hidden="true" />}
                {t(cfg.labelKey)}
              </button>
            );
          })}
          {q?.method === "person" && (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => set(null)}
              className="min-h-[36px] px-2.5 rounded-full border border-border text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1 disabled:opacity-50"
            >
              {busy === "clear" ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} aria-hidden="true" />}
              {t("app.leads.tier.backToRules")}
            </button>
          )}
        </div>
      )}
      {err && <p className="text-xs text-red-700 dark:text-red-300">{err}</p>}
    </div>
  );
}
