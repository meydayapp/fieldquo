// app/components/team/JobTitleInput.js
//
// The one job-title field, shared by the Workers editor, the New User form and
// the quick-add popup — so the three cannot drift on the limit, the hint or
// the suggestion list. See lib/team/personLabel.js for what a title is and
// is not.
//
// A text input with a <datalist>, not a <select>: the list is a nudge
// (Receptionist, Foreman, Estimator…), never a fence. Every trade names its
// people differently, and the owner's own examples span office and field, so
// whatever is typed is what is saved.
"use client";

import { useId } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { TITLE_MAX, TITLE_SUGGESTION_KEYS } from "@/lib/team/personLabel";

export default function JobTitleInput({
  value,
  onChange,
  className = "",
  labelClassName = "text-xs font-medium text-muted-foreground",
  hintClassName = "mt-1 block text-[11px] text-muted-foreground",
  showHint = true,
}) {
  const { t } = useTranslation();
  const listId = useId();
  return (
    <label className="block">
      <span className={labelClassName}>{t("app.jobTitle.label", "Job title")}</span>
      <input
        type="text"
        list={listId}
        maxLength={TITLE_MAX}
        autoComplete="organization-title"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("app.jobTitle.placeholder", "Receptionist, Foreman, Estimator…")}
        className={className}
      />
      <datalist id={listId}>
        {TITLE_SUGGESTION_KEYS.map((key) => (
          <option key={key} value={t(key)} />
        ))}
      </datalist>
      {showHint && (
        <span className={hintClassName}>{t("app.jobTitle.hint")}</span>
      )}
    </label>
  );
}
