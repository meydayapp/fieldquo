// app/app/settings/materials/page.js
"use client";

import { useState, useEffect } from "react";
import { Plus, TrendingDown, TrendingUp } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    unit: "",
    category: "",
    currentAvgCost: "",
    reorderThreshold: "",
  });

  useEffect(() => {
    fetch("/api/materials")
      .then((r) => r.json())
      .then((data) => setMaterials(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const res = await fetch("/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        currentAvgCost: form.currentAvgCost
          ? Number(form.currentAvgCost)
          : null,
        reorderThreshold: form.reorderThreshold
          ? Number(form.reorderThreshold)
          : null,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setMaterials((prev) => [...prev, created]);
      setForm({
        name: "",
        unit: "",
        category: "",
        currentAvgCost: "",
        reorderThreshold: "",
      });
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto animate-pulse h-64 bg-accent rounded-xl" />
    );

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Materials</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track material costs to see price trends and get low-stock flags in
          your AI digest.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 gap-3"
      >
        <input
          placeholder="Material name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="border rounded px-3 py-2 text-sm col-span-2"
        />
        <input
          placeholder="Unit (gallon, sheet...)"
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
          className="border rounded px-3 py-2 text-sm"
        />
        <input
          placeholder="Category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="border rounded px-3 py-2 text-sm"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Current cost"
          value={form.currentAvgCost}
          onChange={(e) => setForm({ ...form, currentAvgCost: e.target.value })}
          className="border rounded px-3 py-2 text-sm"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Reorder threshold"
          value={form.reorderThreshold}
          onChange={(e) =>
            setForm({ ...form, reorderThreshold: e.target.value })
          }
          className="border rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="col-span-2 bg-inverted text-inverted-foreground py-2 rounded-full text-sm font-semibold"
        >
          Add Material
        </button>
      </form>

      <div className="space-y-2">
        {materials.map((m) => (
          <div
            key={m.id}
            className="bg-card border border-border rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <div className="font-medium text-foreground">{m.name}</div>
              <div className="text-xs text-muted-foreground">
                {m.category} · {m.unit}
              </div>
            </div>
            <div className="text-sm font-semibold text-foreground">
              {m.currentAvgCost
                ? `$${Number(m.currentAvgCost).toFixed(2)}`
                : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
