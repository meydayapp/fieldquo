"use client";

// app/components/dashboard/MigrationNotice.js
//
// "The company sees it on their dashboard, in a similar way as an invoice
// they would need to pay" — the brief's own words. AwaitingPayment, right
// beside this on the dashboard, is exactly that pattern already: an unpaid
// money item, its own fetch, renders itself away when there's nothing to
// show. This is its sibling for the ONE money item FieldQuo itself raises
// against a company, rather than a client's booking fee.
//
// Deliberately a summary + link, not Accept/Decline/Pay buttons inline —
// same reasoning NeedsYou gives for itself: the full screen (with the
// consultation booker, the document uploader, the history) already lives at
// /app/settings/migration, and duplicating its actions here would give one
// decision two places to be made from.
//
// Scoped to the two states that need a decision: `quoted` (respond) and
// `accepted` (pay). `paid`/`in_progress`/`completed` are progress, not a
// pending ask, so they render nothing here — the settings page is where a
// company checks in on those, same as AwaitingPayment does not nag about a
// booking once it's paid.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ArrowRight } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatMoney } from "@/lib/currency";
import { useTranslation } from "@/app/hooks/useTranslation";

const NEEDS_ACTION = new Set(["quoted", "accepted"]);

export default function MigrationNotice() {
  const { t } = useTranslation();
  const [request, setRequest] = useState(null); // null = not known yet or nothing to show

  useEffect(() => {
    let live = true;
    fetchJson("/api/migrations")
      .then((data) => {
        if (!live) return;
        const rows = Array.isArray(data?.requests) ? data.requests : [];
        const pending = rows.find((r) => NEEDS_ACTION.has(r.status));
        setRequest(pending || null);
      })
      // A refusal (not billing admin) or a failed load both render as
      // absence — same rule NeedsYou states for itself: nothing to
      // apologise for, nothing to retry.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!request) return null;

  const amount = formatMoney((request.priceCents || 0) / 100, request.currency || "CAD");
  const label =
    request.status === "quoted"
      ? t("app.dash.migration.quoted", { amount })
      : t("app.dash.migration.accepted", { amount });

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
        <ArrowUpDown size={14} className="text-muted-foreground" />
        {t("app.dash.migration.title")}
      </h2>
      <Link
        href="/app/settings/migration"
        className="mt-2 flex items-start gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <span>{label}</span>
        <ArrowRight size={14} className="mt-0.5 shrink-0" />
      </Link>
    </div>
  );
}
