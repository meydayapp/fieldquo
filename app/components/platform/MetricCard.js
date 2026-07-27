// app/components/platform/MetricCard.js
"use client";

export function money(value, { compact = false } = {}) {
  const n = Number(value || 0);
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: compact && n >= 10000 ? 0 : 2,
    minimumFractionDigits: compact && n >= 10000 ? 0 : 2,
  });
}

export function count(value) {
  return Number(value || 0).toLocaleString("en-CA");
}

/**
 * `note` exists because several of these numbers are easy to misread —
 * "total billed" is money that flowed through FieldQuo to tenants, not
 * FieldQuo's revenue. A dashboard that lets those blur together produces
 * confident wrong answers in investor conversations.
 */
export default function MetricCard({ label, value, note, tone = "default" }) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : "text-gray-900";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</div>
      {note && <div className="mt-1 text-xs text-gray-500">{note}</div>}
    </div>
  );
}
