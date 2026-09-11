"use client";
// app/components/chat/ContextBar.js
//
// The right pane: a title, a close, a row of tabs, and whatever the screen
// puts under them.
//
// Rocket.Chat's ContactInfo.tsx for an omnichannel room: a header naming the
// contact, the tab strip (Details · Channels · History), and a body that
// swaps with the tab. What goes IN the tabs is the screen's business; this
// component draws the frame. No markup or file was copied from that
// project, which is separately licensed.
import { X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * @param title     node or string for the header
 * @param subtitle  optional line under it
 * @param onClose   the close button; absent → no button
 * @param tabs      `[{ key, label }]`, or empty for no strip
 * @param activeTab / onTab(key)
 * @param actions   optional node beside the close (Edit, Call, …)
 */
export default function ContextBar({
  title,
  subtitle = null,
  onClose = null,
  tabs = [],
  activeTab = null,
  onTab = null,
  actions = null,
  children,
  className = "",
}) {
  const { t } = useTranslation();
  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`} data-chat-context>
      <header className="flex items-start gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("app.chat.close")}
            className="-mr-2 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      {tabs.length ? (
        <div role="tablist" className="flex border-b border-border px-2" data-context-tabs>
          {tabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTab?.(tab.key)}
                className={`-mb-px min-h-[40px] border-b-2 px-3 text-sm ${
                  active
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" role={tabs.length ? "tabpanel" : undefined}>
        {children}
      </div>
    </div>
  );
}
