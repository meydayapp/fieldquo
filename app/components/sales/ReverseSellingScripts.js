// app/components/sales/ReverseSellingScripts.js
//
// The Reverse Selling playbook's short scripts — one per lead source, the
// follow-ups, the demo, the customer check-ins, the partner call and the
// Backup — drawn beside the stages.
//
// ══ Only for that playbook, and only from props ═══════════════════════════
//
// The rows come from lib/sales/playbook/reverseSellingScripts.js through the
// server (the call route's `salesScripts`, the reading page's props) and are
// never imported here: that module reads the referral policy, which reads the
// database, and none of it may reach a browser bundle. Both callers send them
// only when the playbook in front of the rep IS Reverse Selling, so a starter
// playbook's screen draws nothing new, and while the owner keeps the playbook
// switched off nobody sees any of it.
//
// ══ The words are data; the headings are the rep's language ═══════════════
//
// Script lines are read out and stay English, like every playbook line
// (CallPlaybook.js says why). Group headings and the "for this lead" label
// are catalogue keys. Group order is the order the rows arrive in — the
// server's SCRIPT_GROUPS — so this file does not keep a second copy of it.
"use client";

import { useTranslation } from "@/app/hooks/useTranslation";

const GROUP_KEYS = Object.freeze({
  lead_source: "app.salesScripts.group.lead_source",
  follow_up: "app.salesScripts.group.follow_up",
  demo: "app.salesScripts.group.demo",
  check_in: "app.salesScripts.group.check_in",
  partner: "app.salesScripts.group.partner",
  backup: "app.salesScripts.group.backup",
});

/** One script: numbered lines (or labelled parts), then notes for the rep. */
function Script({ script, open = false }) {
  const { t } = useTranslation();
  const lines = Array.isArray(script.lines) ? script.lines.filter((l) => l && typeof l.text === "string" && l.text.trim()) : [];
  const notes = Array.isArray(script.notes) ? script.notes.filter((n) => typeof n === "string" && n.trim()) : [];
  const labelled = lines.some((l) => l.label);
  return (
    <details className="rounded-lg border border-border bg-card" open={open} data-testid={`rs-script-${script.key}`}>
      <summary className="cursor-pointer list-none px-3 py-3 min-h-[44px] flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground break-words">{script.name}</span>
        {script.when ? <span className="text-xs text-muted-foreground break-words">{script.when}</span> : null}
      </summary>
      <div className="px-3 pb-3 space-y-2">
        {labelled ? (
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={`${script.key}-${i}`}>
                {l.label ? (
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-accent-text break-words">{l.label}</p>
                ) : null}
                <p className="text-sm text-foreground break-words whitespace-pre-line">{l.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <ol className="list-decimal pl-5 space-y-1.5">
            {lines.map((l, i) => (
              <li key={`${script.key}-${i}`} className="text-sm text-foreground break-words">
                {l.text}
              </li>
            ))}
          </ol>
        )}
        {notes.length || script.source ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">{t("app.salesCall.repTips")}</p>
            <ul className="list-disc pl-5 space-y-1">
              {notes.map((n, i) => (
                <li key={`${script.key}-note-${i}`} className="text-xs text-foreground break-words">
                  {n}
                </li>
              ))}
            </ul>
            {script.source ? (
              <p className="text-xs text-muted-foreground break-words">
                {t("app.salesScripts.whereFrom", { source: script.source })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}

/**
 * @param scripts    the rows, in group order (server-built)
 * @param suggested  the lead-source key this lead matches, or null
 * @param showIntro  the reading page explains the panel; the call screen does not
 */
export default function ReverseSellingScripts({ scripts = [], suggested = null, showIntro = false }) {
  const { t } = useTranslation();
  const rows = Array.isArray(scripts) ? scripts.filter((s) => s && s.key && GROUP_KEYS[s.group]) : [];
  if (!rows.length) return null;
  const pick = suggested ? rows.find((s) => s.key === suggested) || null : null;
  const groups = [...new Set(rows.map((s) => s.group))];

  return (
    <section className="space-y-3" data-testid="reverse-selling-scripts">
      {/* The reading page is a page of sections (h2); the call screen is a
          panel inside a card (h4). Same words either way. */}
      {showIntro ? (
        <>
          <h2 className="text-lg font-semibold text-foreground">{t("app.salesScripts.heading")}</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">{t("app.salesScripts.intro")}</p>
        </>
      ) : (
        <h4 className="text-sm font-semibold text-foreground">{t("app.salesScripts.heading")}</h4>
      )}
      {pick ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-brand-accent-text break-words">
            {t("app.salesScripts.forThisLead", { name: pick.name })}
          </p>
          <Script script={pick} open />
        </div>
      ) : null}
      {groups.map((g) => (
        <div key={g} className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t(GROUP_KEYS[g])}</p>
          {rows
            .filter((s) => s.group === g && s.key !== pick?.key)
            .map((s) => (
              <Script key={s.key} script={s} />
            ))}
        </div>
      ))}
    </section>
  );
}
