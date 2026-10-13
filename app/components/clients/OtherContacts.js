// app/components/clients/OtherContacts.js
//
// An organisation client's other people (model ClientContact), listed under
// the client's details on the staff screens that show them — the job, the
// invoice, the quote — so "who is the site contact?" is answered where the
// question comes up, not only on the client page.
//
// Same redaction as the Organization card: read from GET
// /api/clients/[id]/contacts, which asks clientsProperties "full_view"; a
// member below that is refused and this renders nothing (the screen's own
// client block already says "hidden by your access level" for them). Nothing
// for an individual, and nothing when there is no one but the primary — the
// primary is the client details already printed above it.
"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function OtherContacts({ client, className = "" }) {
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

  const others = (entries || []).filter((c) => !c.isPrimary);
  if (!isOrg || others.length === 0) return null;

  return (
    <div className={`text-sm ${className}`} data-other-contacts>
      <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">{t("app.orgCard.otherContacts")}</p>
      <ul className="mt-0.5 space-y-0.5">
        {others.map((c) => (
          <li key={c.id} className="text-muted-foreground break-words">
            <span className="text-foreground">{c.name}</span>
            {c.role ? ` · ${c.role}` : ""}
            {c.email ? <span className="break-all"> · {c.email}</span> : null}
            {c.phone ? ` · ${c.phone}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
