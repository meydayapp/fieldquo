// app/components/quotes/TeamCrewPicker.js
//
// "Add from your team…" — the one control that puts a real worker, with their
// real pay rate, on a quote's crew.
//
// It lived inline in the builder's CostMarginPanel. The quote page's own cost
// editor (QuoteCostEditor) needed the same thing for instant estimates, which
// are costed with nobody assigned and so at FieldQuo's $35/h default — and a
// second copy of the select is the one that would drift (a different rate
// fallback, a lost worker id, and the job no longer knows who was quoted).
// So both panels render this, and both get the same member shape back.
//
// A worker with no rate on file joins at 0 and is FLAGGED by the panel it
// joins ("No pay rate set for X" / crewUnrated), never quietly given the $35
// default or left off the job: silently omitting someone is how a crew of
// three costs like a crew of two.
"use client";

import { formatAppMoney } from "@/lib/format/money";
import { crewMemberFromWorker } from "@/lib/costing/crew";

export default function TeamCrewPicker({
  workers = [],
  currency,
  language,
  t,
  onAdd,
  className = "rounded border border-border px-2 py-1 text-sm",
}) {
  if (!Array.isArray(workers) || workers.length === 0) return null;
  const money = (n) => formatAppMoney(n, currency, language);
  return (
    <select
      value=""
      onChange={(e) => {
        const w = workers.find((x) => x.id === e.target.value);
        if (!w) return;
        onAdd(crewMemberFromWorker(w, t("app.cost.crewMember")));
      }}
      className={className}
    >
      <option value="">{t("app.cost.addFromTeam")}</option>
      {workers.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
          {w.hourlyRate != null
            ? ` — ${t("app.cost.ratePerHour", { rate: money(w.hourlyRate) })}`
            : ` — ${t("app.cost.noRateSet")}`}
        </option>
      ))}
    </select>
  );
}
