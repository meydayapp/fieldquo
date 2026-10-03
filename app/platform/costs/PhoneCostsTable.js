"use client";
// app/platform/costs/PhoneCostsTable.js
//
// "Phone costs vs what we charge" — one row per Twilio unit price FieldQuo
// has seen often enough to count, what companies pay for it, and the
// multiple. Anything under the owner's 2× is flagged red. Loads its own data
// (GET /api/platform/costs/phone) so the costs page's period controls never
// refetch it: these are unit prices, not spend in a period.

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";

const CLASS_LABELS = {
  call_forward: "Forwarded call, per minute (all legs)",
  call_bridge: "Call button, per minute (both legs)",
  rent_hosted_number: "Hosted business number, per month",
  rent_ported_number: "Ported business number, per month",
  rent_crew_line: "Crew line, per month",
};

function label(cls) {
  if (CLASS_LABELS[cls]) return CLASS_LABELS[cls];
  const m = /^(sms|mms)_(in|out)_(CA|US|INTL)$/.exec(cls || "");
  if (!m) return cls;
  return `${m[1] === "mms" ? "Photo (MMS)" : "Text (SMS), per segment"} · ${m[2] === "in" ? "inbound" : "outbound"} · ${m[3] === "INTL" ? "other countries" : m[3]}`;
}

const cents = (n) => `${Number(n).toFixed(n < 10 ? 2 : 0)}¢`;

export default function PhoneCostsTable({ cardClass }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchJson("/api/platform/costs/phone").then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <section className={cardClass} data-phone-costs>
      <h2 className="text-base font-semibold text-foreground">Phone costs vs what we charge</h2>
      {error ? <p className="text-sm text-red-700 dark:text-red-400">{error}</p> : null}
      {data ? (
        <>
          <p className="text-xs text-muted-foreground">
            Texts and calls are billed at Twilio&apos;s reported price × {data.rule.markup}, never below {data.rule.floors.textCents}¢ a segment,{" "}
            {data.rule.floors.photoCents}¢ a photo and {data.rule.floors.callCentsPerMinute}¢ a call minute. A unit price counts once it has been seen five times.
            {data.pendingSettlements ? ` ${data.pendingSettlements} charge(s) waiting on Twilio's price.` : ""}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-2 py-1">Class</th>
                  <th className="px-2 py-1 text-right">Our cost</th>
                  <th className="px-2 py-1 text-right">We charge</th>
                  <th className="px-2 py-1 text-right">Multiple</th>
                </tr>
              </thead>
              <tbody>
                {[...data.rows, ...data.fixed].map((r) => (
                  <tr key={`${r.priceClass}:${r.costCents}`} className="border-t border-border">
                    <td className="px-2 py-1">{label(r.priceClass)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{cents(r.costCents)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{cents(r.chargeCents)}</td>
                    <td className={`px-2 py-1 text-right tabular-nums ${r.below2x ? "font-semibold text-red-700 dark:text-red-400" : ""}`}>
                      {r.multiple ? `${r.multiple.toFixed(2)}×` : "—"}
                      {r.below2x ? " — below 2×" : ""}
                    </td>
                  </tr>
                ))}
                {data.rows.length === 0 ? (
                  <tr className="border-t border-border">
                    <td colSpan={4} className="px-2 py-2 text-muted-foreground">
                      No Twilio price has been seen often enough yet — rows appear as texts and calls are settled.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {data.candidates.length ? (
            <p className="text-xs text-muted-foreground">
              Seen, not yet counted: {data.candidates.map((c) => `${label(c.priceClass)} at ${cents(c.costCents)} (${c.observations}×)`).join("; ")}.
            </p>
          ) : null}
          {data.changes.length ? (
            <div>
              <p className="text-xs font-semibold text-foreground">Price changes detected</p>
              <ul className="text-xs text-muted-foreground">
                {data.changes.map((c) => (
                  <li key={c.id}>
                    {new Date(c.effectiveAt).toLocaleDateString()} — {label(c.priceClass)}: companies now pay {cents(c.chargeCents)}
                    {c.previousCents !== null ? ` (was ${cents(c.previousCents)})` : ""}; owners and admins of companies using texting were shown a banner.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
