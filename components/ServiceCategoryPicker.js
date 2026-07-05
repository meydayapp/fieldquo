// components/ServiceCategoryPicker.js
"use client";

import { useEffect, useState } from "react";

export function ServiceCategoryPicker({ onAdd }) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch("/api/settings/service-categories")
      .then((r) => r.json())
      .then((all) => setCategories(all.filter((c) => c.enabled)));
  }, []);

  if (categories.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No services enabled yet. Go to Settings → Services to turn some on.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() =>
            onAdd({
              categoryId: c.id,
              label: c.label,
              lineItems: [
                {
                  description: c.label,
                  quantity: 1,
                  unit: c.unit || "flat",
                  rate: c.defaultRate || 0,
                  amount: c.defaultRate || 0,
                },
              ],
            })
          }
          className="border rounded-full px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          + {c.label}
        </button>
      ))}
    </div>
  );
}
