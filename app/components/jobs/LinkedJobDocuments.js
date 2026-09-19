"use client";

// app/components/jobs/LinkedJobDocuments.js
//
// The strip on a quote page and an invoice page: what the job this document
// became has on file — the quote as sent, the signed contract, each invoice
// as it went out — with a link to the job's full Documents.
//
// ══ Read-only, and the same gate as the job page ═══════════════════════════
//
// This reads GET /api/jobs/[id]/documents, the one route the job page's own
// panel reads, so the two can never disagree about what a member may see.
// The route filters MONEY_KINDS on the server for a member without
// showPricing; nothing here re-derives that. Because every kind this strip
// shows IS a money kind (quote, contract, invoice), a member the route
// withholds them from gets no strip at all rather than an empty one that
// points at a list they cannot read — the quote page they are on has already
// had its totals removed, and a "Documents" heading with nothing under it
// would send them looking.
//
// ══ Only the three filed kinds ═════════════════════════════════════════════
//
// A plan or a permit belongs to the job page. The quote page is where an
// estimator asks "what did they sign", and the invoice page is where the
// office asks "which invoice did they get" — so the strip is those three,
// and everything else is one click away.

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { AUTOFILED_KINDS, revisionCount } from "@/lib/jobs/documents";

export default function LinkedJobDocuments({ jobId }) {
  const { t, language } = useTranslation();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    fetch(`/api/jobs/${jobId}/documents`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (alive) setData(body || { failed: true });
      })
      .catch(() => {
        if (alive) setData({ failed: true });
      });
    return () => {
      alive = false;
    };
  }, [jobId]);

  if (!jobId || !data) return null;
  // Withheld on the server; nothing to draw. See the header.
  if (!data.canSeeMoney) return null;

  const chains = (data.chains || []).filter((c) => AUTOFILED_KINDS.has(c.current?.kind));

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="font-semibold text-foreground flex items-center gap-1.5">
          <FileText size={16} />
          {t("app.linkedDocuments.title", "Documents on the job")}
        </h2>
        <Link
          href={`/app/jobs/${jobId}#documents`}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-foreground underline"
        >
          {t("app.linkedDocuments.open", "All documents")}
        </Link>
      </div>

      {data.failed ? (
        <p className="text-sm text-muted-foreground">
          {t("app.jobDocuments.unknown", "Couldn't load the documents on this job.")}
        </p>
      ) : chains.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t(
            "app.linkedDocuments.empty",
            "Nothing filed on the job yet. The quote, the signed contract and each invoice are filed as they happen.",
          )}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {chains.map((chain) => {
            const doc = chain.current;
            const revs = revisionCount(chain);
            return (
              <li key={chain.id} className="py-2 first:pt-0 flex items-baseline justify-between gap-3 flex-wrap">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-foreground underline break-words"
                >
                  {doc.name}
                </a>
                <span className="text-xs text-muted-foreground">
                  {t(`app.jobDocuments.kind.${doc.kind}`, doc.kind)}
                  {" · "}
                  {new Date(doc.uploadedAt).toLocaleDateString(language)}
                  {revs > 1 && ` · ${t("app.jobDocuments.revision", "Rev {n}", { n: revs })}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
