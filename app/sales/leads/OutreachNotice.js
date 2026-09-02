// app/sales/leads/OutreachNotice.js
//
// What outreach can and cannot do right now, said out loud.
//
// ══ Why this component exists at all ═══════════════════════════════════════
//
// AGENTS.md's most emphasised rule is "never ship a control that appears to
// work and doesn't", and its examples are all buttons that looked fine. A
// compose box is the same hazard in its most convincing form: it can send mail
// Resend will refuse, or send mail whose replies nothing files, and in both
// cases the rep sees a form, types into it, and is told "sent".
//
// So every screen that can send renders this, from the readiness object the API
// computes. Blockers mean the compose box does not exist and this panel stands
// in its place; warnings mean it does exist with the caveat attached. The
// "waiting on mail forwarding setup" state the brief asked for is the second
// kind, and it is deliberately not silent.
//
// It lives under /sales/leads rather than in a shared folder because the lead
// screen is where composing happens; the two thread screens import it from here
// rather than growing a second copy, which is the copy that rots.
"use client";

import { AlertTriangle, Info } from "lucide-react";

export default function OutreachNotice({ outreach, className = "" }) {
  if (!outreach) return null;
  const blockers = outreach.blockers || [];
  const warnings = outreach.warnings || [];
  if (!blockers.length && !warnings.length) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {blockers.length > 0 && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 text-amber-700 dark:text-amber-300 shrink-0" />
            <div className="space-y-3 text-sm">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Email outreach isn&apos;t set up yet, so there&apos;s no compose box.
              </p>
              {blockers.map((b) => (
                <div key={b.code}>
                  <p className="font-medium text-amber-900 dark:text-amber-200">{b.title}</p>
                  <p className="text-amber-800 dark:text-amber-300/90">{b.fix}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {warnings.map((w) => (
        <div
          key={w.code}
          className="rounded-lg border border-border bg-muted/40 p-4 flex items-start gap-2 text-sm"
        >
          <Info size={16} className="mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <p className="font-medium text-foreground">{w.title}</p>
            <p className="text-muted-foreground">{w.fix}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
