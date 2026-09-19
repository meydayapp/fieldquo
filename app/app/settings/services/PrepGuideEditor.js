// app/app/settings/services/PrepGuideEditor.js
//
// Per service: the client preparation guide, per language. The built-in is
// shown read-only as "the original"; "Customise" makes a company copy of it
// to edit — checklist items added, removed and reworded, the warning, what
// happens on the day, after-care, and a free note of the company's own.
// "Reset to original" deletes the copy for that language, so the built-in
// comes back — improved, if it was improved since.
//
// Edits are staged into the page's `prepGuideCopies` patch and go with the
// page's Save, the same round trip as the quote wording above it: only the
// languages the person touched are sent, and null for a language means
// reset. The process section is not editable here on purpose — it is read
// from the quote wording, so the guide and the quote say the same thing.
"use client";

import { useState } from "react";
import { ChevronDown, Plus, Trash2, RotateCcw } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { GUIDE_LANGUAGES } from "@/lib/prepGuide/content";

const fieldClass = "min-w-0 border border-border rounded px-2 py-1 text-sm bg-background";
const inputClass = `w-full ${fieldClass}`;
const LANG_LABEL = { en: "English", fr: "Français", es: "Español" };

function ListEditor({ items, onChange, addLabel, placeholder }) {
  const set = (i, v) => onChange(items.map((x, j) => (j === i ? v : x)));
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <textarea
            value={item}
            onChange={(e) => set(i, e.target.value)}
            rows={2}
            className={inputClass}
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="mt-1 rounded p-1 text-muted-foreground hover:text-red-600"
            aria-label="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])} className="inline-flex items-center gap-1 text-xs text-foreground hover:underline">
        <Plus size={12} /> {addLabel}
      </button>
    </div>
  );
}

/**
 * @param category  the row from GET /api/settings/service-categories
 *                  (uses .prepGuide.originals and .prepGuide.copies)
 * @param staged    the page's staged patch for this category, { [lang]: copy|null }
 * @param onChange  (lang, copy|null)
 * @param children  the per-service documents list, rendered inside the panel
 */
export default function PrepGuideEditor({ category, staged = {}, onChange, children }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("en");

  const originals = category.prepGuide?.originals || {};
  const storedCopies = category.prepGuide?.copies || {};
  const original = originals[lang] || { checklist: [], warning: "", dayOf: [], afterCare: "" };

  // Staged wins over stored; an explicit null in staged is a pending reset.
  const copy = Object.prototype.hasOwnProperty.call(staged, lang) ? staged[lang] : storedCopies[lang] || null;
  const customisedAny = GUIDE_LANGUAGES.some((l) =>
    Object.prototype.hasOwnProperty.call(staged, l) ? Boolean(staged[l]) : Boolean(storedCopies[l]),
  );

  const startCopy = () =>
    onChange(lang, {
      checklist: [...original.checklist],
      warning: original.warning,
      dayOf: [...original.dayOf],
      afterCare: original.afterCare,
      notes: "",
    });
  const patch = (p) => onChange(lang, { ...copy, ...p });

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          {t("app.prepGuide.title", "Preparation guide")}
          {customisedAny && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-normal text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              {t("app.quoteWording.customised")}
            </span>
          )}
        </span>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-muted-foreground">
            {t(
              "app.prepGuide.intro",
              "What the client is asked to do before the crew arrives, sent by email with a PDF before the job's start date. The process steps on the guide come from the quote wording above.",
            )}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {GUIDE_LANGUAGES.map((l) => {
              const has = Object.prototype.hasOwnProperty.call(staged, l) ? Boolean(staged[l]) : Boolean(storedCopies[l]);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    lang === l ? "border-foreground bg-inverted text-inverted-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  {LANG_LABEL[l]}
                  {has ? " ·" : ""}
                </button>
              );
            })}
          </div>

          {!copy ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{t("app.prepGuide.originalNote", "The built-in guide, as clients receive it. Read-only until you customise it.")}</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {original.checklist.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
              <p className="rounded border border-border bg-muted/40 px-3 py-2 text-sm">
                <strong>{t("app.prepGuide.importantLabel", "Important:")}</strong> {original.warning}
              </p>
              <div className="space-y-1 text-sm">
                <p className="text-xs font-medium text-muted-foreground">{t("app.prepGuide.dayOf", "On the day")}</p>
                {original.dayOf.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-xs font-medium text-muted-foreground">{t("app.prepGuide.afterCare", "After the work")}</p>
                <p>{original.afterCare}</p>
              </div>
              <button type="button" onClick={startCopy} className="rounded border border-border px-3 py-1 text-sm font-medium hover:bg-muted">
                {t("app.prepGuide.customise", "Customise")}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{t("app.prepGuide.copyNote", "Your copy for this language. Clients in this language get this instead of the built-in guide.")}</p>
                <button
                  type="button"
                  onClick={() => onChange(lang, null)}
                  className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw size={12} /> {t("app.prepGuide.reset", "Reset to original")}
                </button>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("app.prepGuide.checklist", "Checklist")}</p>
                <ListEditor
                  items={copy.checklist}
                  onChange={(checklist) => patch({ checklist })}
                  addLabel={t("app.prepGuide.addItem", "Add an item")}
                  placeholder={t("app.prepGuide.itemPlaceholder", "Heading — what to do, and why")}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("app.prepGuide.warning", "The one warning that matters")}</p>
                <textarea value={copy.warning} onChange={(e) => patch({ warning: e.target.value })} rows={3} className={inputClass} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("app.prepGuide.dayOf", "On the day")}</p>
                <ListEditor
                  items={copy.dayOf}
                  onChange={(dayOf) => patch({ dayOf })}
                  addLabel={t("app.prepGuide.addParagraph", "Add a paragraph")}
                  placeholder=""
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("app.prepGuide.afterCare", "After the work")}</p>
                <textarea value={copy.afterCare} onChange={(e) => patch({ afterCare: e.target.value })} rows={3} className={inputClass} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("app.prepGuide.notes", "A note from you")}</p>
                <textarea
                  value={copy.notes || ""}
                  onChange={(e) => patch({ notes: e.target.value })}
                  rows={2}
                  className={inputClass}
                  placeholder={t("app.prepGuide.notesPlaceholder", "Anything only you would say — where to park, who to call, your cure times.")}
                />
              </div>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{t("app.prepGuide.docs.serviceHeading", "Technical documents for this service")}</p>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
