// app/app/quotes/[id]/ImportedByPanel.js
//
// Sub-side of a cross-company import, on the quote's own detail page. If another
// FieldQuo company added this quote to their project, this shows THAT — and an
// honest status: "pending their client's approval" until the importer's own
// quote is accepted, then "confirmed". Never a false "you're hired" the moment
// they were merely selected.
//
// Deliberately narrow: the importer's markup and client price are not in the
// payload (see /api/quotes/[id]/imports), so there is nothing here that could
// reveal the other company's margin.
"use client";

import { useEffect, useState } from "react";
import { Layers, Clock, CheckCircle2, MinusCircle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

const STATUS = {
  pending: { key: "app.quoteImports.pending", Icon: Clock, cls: "text-amber-600 dark:text-amber-400" },
  confirmed: { key: "app.quoteImports.confirmed", Icon: CheckCircle2, cls: "text-green-600 dark:text-green-400" },
  cancelled: { key: "app.quoteImports.cancelled", Icon: MinusCircle, cls: "text-muted-foreground" },
};

export default function ImportedByPanel({ quoteId }) {
  const { t } = useTranslation();
  const [imports, setImports] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/quotes/${quoteId}/imports`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setImports(d?.asSource || []);
      })
      .catch(() => {
        if (!cancelled) setImports([]);
      });
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  // Nothing until we know, and nothing when this quote hasn't been imported —
  // the panel simply doesn't exist for the common case.
  if (!imports || imports.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Layers size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          {t("app.quoteImports.title")}
        </h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t("app.quoteImports.subtitle")}
      </p>
      <ul className="space-y-2">
        {imports.map((imp) => {
          const s = STATUS[imp.status] || STATUS.pending;
          const { Icon } = s;
          return (
            <li
              key={imp.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <span className="text-sm text-foreground truncate">
                {imp.importedByCompanyName || "—"}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium shrink-0 ${s.cls}`}>
                <Icon size={14} />
                {t(s.key)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
