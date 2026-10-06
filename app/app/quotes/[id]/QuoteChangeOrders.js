// app/app/quotes/[id]/QuoteChangeOrders.js
//
// Change orders, on the APPROVED quote's own page. The owner looked here after
// the client approved and found nothing (2026-10-05) — change orders lived only
// on the job page. This is the same card (app/components/jobs/ChangeOrders.js:
// the same list, the same form, the same send/agree/withdraw controls, the
// same routes), mounted against the quote's job, with two ways in:
//
//   "Add extra work"      the existing change-order form, raised against a
//                         quote line or a plan step.
//   "Add a sub's quote"   paste the link from the subcontractor's quote email;
//                         it opens the add-this-price page with THIS quote
//                         pre-selected, where the price becomes a pending
//                         change order at the contractor's markup.
//
// Nothing here edits the signed quote. A change order is its own record and
// reaches the client as an addendum (/co/<token>) to sign.
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import ChangeOrders from "@/app/components/jobs/ChangeOrders";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import { addToQuotePath, shareTokenFromLink } from "@/lib/quotes/addToQuoteLink";

export default function QuoteChangeOrders({ quoteId, jobId, refreshKey = 0 }) {
  const { t } = useTranslation();
  const router = useRouter();
  const canSeeJobs = useHasLevel("jobs", "view_only");
  const [orders, setOrders] = useState(null);
  const [pasting, setPasting] = useState(false);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");

  const load = useCallback(async () => {
    if (!jobId || !canSeeJobs) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/change-orders`);
      setOrders(res.ok ? await res.json() : []);
    } catch {
      setOrders([]);
    }
  }, [jobId, canSeeJobs]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // An approved quote with no job has nowhere to put a change order: say so
  // rather than render a form whose POST would 404.
  if (!jobId) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm text-muted-foreground">{t("app.quoteChangeOrders.noJob")}</p>
      </div>
    );
  }
  if (!canSeeJobs || orders === null) return null;

  function openLink() {
    const token = shareTokenFromLink(link);
    if (!token) {
      setLinkError(t("app.quoteChangeOrders.pasteLinkInvalid"));
      return;
    }
    router.push(`${addToQuotePath(token)}?target=${encodeURIComponent(quoteId)}`);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">{t("app.quoteChangeOrders.intro")}</p>
      <ChangeOrders
        jobId={jobId}
        changeOrders={orders}
        onChanged={load}
        newLabel={t("app.changeOrder.addExtraWork")}
        extraActions={
          !pasting ? (
            <button
              type="button"
              onClick={() => setPasting(true)}
              className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
            >
              <Link2 size={13} />
              {t("app.quoteChangeOrders.addSubQuote")}
            </button>
          ) : null
        }
      />
      {pasting && (
        <div className="bg-card border border-border rounded-xl p-4">
          <label className="block text-sm font-medium text-foreground mb-1" htmlFor="sub-quote-link">
            {t("app.quoteChangeOrders.pasteLink")}
          </label>
          <div className="flex gap-2 flex-wrap">
            <input
              id="sub-quote-link"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setLinkError("");
              }}
              placeholder="https://…/q/…"
              className="flex-1 min-w-[220px] border border-border rounded-lg px-3 py-2 text-sm bg-card"
            />
            <button
              type="button"
              onClick={openLink}
              disabled={!link.trim()}
              className="bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {t("app.quoteChangeOrders.continue")}
            </button>
            <button
              type="button"
              onClick={() => {
                setPasting(false);
                setLink("");
                setLinkError("");
              }}
              className="text-sm font-semibold px-2 py-2 text-muted-foreground"
            >
              {t("app.action.cancel")}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{t("app.quoteChangeOrders.pasteLinkHint")}</p>
          {linkError && <p className="text-sm text-red-700 dark:text-red-300 mt-1.5">{linkError}</p>}
        </div>
      )}
    </div>
  );
}
