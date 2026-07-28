// app/components/quotes/builder/TierSelector.js
//
// Good / better / best for trades that sell packages rather than measurements.
//
// Junk removal, auto detailing, chimney sweep, elevator servicing — the price
// isn't derived from a count, it's one of three named packages. Selecting one
// is what creates the group's single line item, which is why a tiered group
// starts with an empty lineItems array and looks broken until a tier is picked.
"use client";

import { getTieredPackage } from "@/app/data/tieredPackages";

export default function TierSelector({ group, onSelect }) {
  const pkg = getTieredPackage(group.categoryKey);
  if (!pkg) return null;

  return (
    <div className="pb-4 border-b border-border">
      <div className="text-xs text-muted-foreground mb-2">{pkg.label}</div>
      <div className="space-y-2">
        {pkg.tiers.map((tier) => {
          const selected = group.selectedTier === tier.key;
          return (
            <button
              key={tier.key}
              type="button"
              onClick={() => onSelect(tier.key, tier.label)}
              className={`w-full text-left border rounded-lg px-3 py-2.5 text-sm transition-colors ${
                selected
                  ? "border-inverted bg-muted font-medium"
                  : "border-border hover:bg-muted"
              }`}
            >
              {tier.label}
              {tier.priceHint && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({tier.priceHint})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
