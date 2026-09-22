// app/platform/companies/[id]/CompanyBuilderLayout.js
//
// Which quote builder this company's estimators open: the document-shaped
// builder (mockup b7) or the classic form. FieldQuo's own rollout decision,
// flipped here one company at a time — the same argument /platform/features
// makes: this is not the company's data, it is which screen we hand them.
//
// Every company that existed when the flag landed (2026-09-21) was set to
// "classic" by the column's backfill; a company created since opens on
// "document". The switch is company:manage (admin and superadmin), audited
// through the same PATCH that renames a company.
"use client";

import { useState } from "react";
import { Loader2, LayoutTemplate } from "lucide-react";
import PlatformWriteGate, {
  usePlatformAdmin,
} from "@/app/components/platform/PlatformWriteGate";
import { QUOTE_BUILDER_LAYOUTS, resolveBuilderLayout } from "@/lib/quotes/builderLayout";

const COPY = {
  document: {
    label: "Document",
    blurb: "The estimator edits the page the client will read — rooms, lines and totals in place, the cost panel in a drawer.",
  },
  classic: {
    label: "Classic",
    blurb: "The long form: client box, tiles, one card per service, cost panel inline, totals at the foot.",
  },
};

export default function CompanyBuilderLayout({ companyId, value, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { status: roleStatus, error: roleError, can } = usePlatformAdmin();
  const canManage = can("company:manage");
  const current = resolveBuilderLayout(value);

  async function pick(layout) {
    if (layout === current) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/platform/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteBuilderLayout: layout }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status}).`);
      onDone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3" data-builder-layout>
      <div className="flex items-center gap-2">
        <LayoutTemplate size={16} className="text-muted-foreground" />
        <h2 className="font-semibold text-foreground">Quote builder</h2>
        <span className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground">
          {COPY[current].label}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        Which screen their estimators open at /app/quotes/new and on Edit. Both
        save the same quote through the same routes; only the screen differs.
      </p>
      <PlatformWriteGate
        status={roleStatus}
        allowed={canManage}
        error={roleError}
        action="Switching a company's quote builder"
        who="admins and superadmins"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {QUOTE_BUILDER_LAYOUTS.map((layout) => {
            const on = layout === current;
            return (
              <button
                key={layout}
                type="button"
                disabled={busy || on}
                onClick={() => pick(layout)}
                aria-pressed={on}
                className={`text-left rounded-lg border px-3 py-2.5 disabled:cursor-default ${
                  on
                    ? "border-foreground bg-muted"
                    : "border-border hover:bg-muted/60"
                }`}
                data-builder-layout-option={layout}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {busy && !on ? <Loader2 size={12} className="animate-spin" /> : null}
                  {COPY[layout].label}
                  {on ? <span className="text-xs font-normal text-muted-foreground">· current</span> : null}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">{COPY[layout].blurb}</span>
              </button>
            );
          })}
        </div>
      </PlatformWriteGate>
      {error && (
        <p className="text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
