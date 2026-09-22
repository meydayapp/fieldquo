// app/components/quotes/builder/TemplatePicker.js
//
// "Start from a template" on a new quote: the QuoteTemplate rows the company
// saved from earlier quotes (the Send… menu's "Save as template"), one click
// to open the builder on that shape. Rendered only while the quote has no
// services yet — see the mount in QuoteBuilder — and absent entirely, not an
// empty card, for a company with no templates: a heading over "none" is a
// control that does nothing.
//
// Fetches its own list on mount rather than through the builder's bootstrap
// so the builder's loader gains no field for a panel most quotes never use.
"use client";

import { useEffect, useState } from "react";
import { LayoutTemplate, ChevronDown } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { LANGUAGES } from "@/app/i18n/languages";

export default function TemplatePicker({ onApply }) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/quote-templates")
      .then((rows) => {
        if (!cancelled) setTemplates(Array.isArray(rows) ? rows : []);
      })
      // A failed load is an absent panel, not an error banner on a screen
      // whose job is a quote: nothing here is required to build one.
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!templates || templates.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl" data-template-picker>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-semibold text-foreground">
          <LayoutTemplate size={16} className="text-muted-foreground" />
          {t("app.quoteTemplates.startFrom", "Start from a template")}
          <span className="text-xs font-normal text-muted-foreground">
            {t("app.quoteTemplates.count", "{count} saved", { count: templates.length })}
          </span>
        </span>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="border-t border-border divide-y divide-border">
          {templates.map((tpl) => {
            const lang = LANGUAGES.find((l) => l.code === tpl.language)?.nativeName || tpl.language;
            return (
              <li key={tpl.id}>
                <button
                  type="button"
                  onClick={() => {
                    onApply(tpl);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-3 px-5 py-2.5 text-left text-sm hover:bg-muted"
                >
                  <span className="min-w-0 truncate">
                    {tpl.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t("app.quoteTemplates.groupsAndLanguage", "{count} services · {language}", {
                        count: tpl.groups.length,
                        language: lang,
                      })}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-foreground">{t("app.quoteTemplates.use", "Use")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
