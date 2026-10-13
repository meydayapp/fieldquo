// app/components/clients/RecipientPicker.js
//
// "Who receives this?" on the quote and invoice send screens, for an
// organisation client with more than one contact (owner, 2026-10-13). For
// everyone else — every homeowner, every organisation with one contact — it
// renders nothing and the send screen is exactly what it was.
//
// The selection is { primary, contactIds }, starting on the primary alone
// (lib/clients/recipients.js DEFAULT_SELECTION). A screen adds it to its
// request through recipientsForBody, which leaves the body untouched while the
// selection is the default — so an unchanged screen posts the same bytes it
// always posted. Ids go up, never addresses: the server reads them off this
// client's own rows.
//
// Contacts are contact data, read from GET /api/clients/[id]/contacts at the
// level that route asks (clientsProperties full_view). A member it refuses
// gets no picker, and the send goes to the primary as before.
"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { offersRecipientPicker, DEFAULT_SELECTION } from "@/lib/clients/recipients";

export default function RecipientPicker({ client, value, onChange, className = "" }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState(null);
  const clientId = client?.id || null;
  const isOrg = client?.type === "company";

  useEffect(() => {
    if (!clientId || !isOrg) return;
    let live = true;
    fetch(`/api/clients/${clientId}/contacts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setEntries(Array.isArray(d?.contacts) ? d.contacts : []))
      .catch(() => live && setEntries([]));
    return () => {
      live = false;
    };
  }, [clientId, isOrg]);

  if (!offersRecipientPicker(client, entries || [])) return null;
  const sel = value || DEFAULT_SELECTION;
  const ids = new Set(sel.contactIds || []);

  const toggle = (entry, on) => {
    if (entry.isPrimary) onChange({ ...sel, primary: on, contactIds: [...ids] });
    else {
      const next = new Set(ids);
      if (on) next.add(entry.id);
      else next.delete(entry.id);
      onChange({ primary: sel.primary !== false, contactIds: [...next] });
    }
  };

  const reachable = entries.filter((e) => e.email && (e.isPrimary || e.id));
  const noneChosen = sel.primary === false && ids.size === 0;

  return (
    <fieldset className={`mt-4 text-left ${className}`} data-recipient-picker>
      <legend className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
        <Users size={13} className="text-muted-foreground" /> {t("app.recipients.title")}
      </legend>
      <div className="space-y-1">
        {reachable.map((e) => {
          const checked = e.isPrimary ? sel.primary !== false : ids.has(e.id);
          return (
            <label key={e.id || "primary"} className="flex items-start gap-2.5 text-sm text-foreground min-h-[44px] py-1.5 cursor-pointer">
              <input type="checkbox" checked={checked} onChange={(ev) => toggle(e, ev.target.checked)} className="mt-1" />
              <span className="min-w-0">
                <span className="font-medium">{e.name || e.email}</span>
                {e.role ? <span className="text-muted-foreground"> · {e.role}</span> : null}
                {e.isPrimary ? <span className="text-muted-foreground"> · {t("app.orgCard.primary")}</span> : null}
                <span className="block text-xs text-muted-foreground break-all">{e.email}</span>
              </span>
            </label>
          );
        })}
      </div>
      {noneChosen && <p className="text-xs text-red-700 dark:text-red-300 mt-1">{t("app.recipients.noneChosen")}</p>}
    </fieldset>
  );
}

/** Is this selection sendable (at least one person ticked)? Pure. */
export function selectionChosen(sel) {
  if (!sel) return true;
  return sel.primary !== false || (Array.isArray(sel.contactIds) && sel.contactIds.length > 0);
}
