// app/app/settings/ai-employee/AiTeamRoster.js
//
// The "Your AI team" roster — one tab per AI employee — and the Face every
// employee is drawn with, in their own file so they can be drawn outside the
// settings page: the /signup side panel renders these exact components against
// fixture employees rather than a hand-drawn lookalike.
//
// Presentational: no fetch, no router. The "Hire another" picker is NOT part
// of the roster — it is the page's control (it posts, and knows which roles
// are left) and comes in as `children`, drawn at the end of the tab row where
// it always was. A caller with nothing to hire passes nothing.
"use client";

import { useTranslation } from "@/app/hooks/useTranslation";

function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "AI";
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

export function Face({ url, name, size = 48 }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden="true"
      className="rounded-full bg-muted text-foreground inline-flex items-center justify-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * @param employees   GET /api/ai-employee's `employees`: id, name,
 *                    displayName, avatarUrl, role, enabled
 * @param selectedId  the id of the employee whose card is open
 * @param onSelect    (id) => void; without it the tabs are inert
 * @param children    drawn after the last tab — the page's hire picker
 */
export default function AiTeamRoster({ employees, selectedId, onSelect, children }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("app.aiEmployee.teamTitle", "Your AI team")}>
      {employees.map((e) => (
        <button
          key={e.id || "unsaved"}
          type="button"
          role="tab"
          aria-selected={selectedId === e.id}
          onClick={onSelect ? () => onSelect(e.id) : undefined}
          className={`flex items-center gap-3 rounded-lg border-2 p-2 pr-3 min-h-[44px] text-left ${
            selectedId === e.id ? "border-primary bg-muted" : "border-border"
          }`}
        >
          <Face url={e.avatarUrl} name={e.displayName || e.name} size={36} />
          <span>
            <span className="block text-sm font-medium text-foreground">{e.displayName || e.name}</span>
            <span className="block text-xs text-muted-foreground">
              {t(`app.aiEmployee.role.${e.role}`, e.role)}
              {" · "}
              {e.enabled ? t("app.aiEmployee.on", "on") : t("app.aiEmployee.off", "off")}
            </span>
          </span>
        </button>
      ))}
      {children}
    </div>
  );
}
