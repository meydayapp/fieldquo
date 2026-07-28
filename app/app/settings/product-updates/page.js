// app/app/settings/product-updates/page.js
import { PRODUCT_UPDATES } from "@/lib/data/productUpdates";

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProductUpdatesPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Product Updates</h1>
        <p className="text-sm text-muted-foreground mt-1">What's new in FieldQuo.</p>
      </div>

      <div className="space-y-4">
        {PRODUCT_UPDATES.map((update) => (
          <div
            key={update.date + update.title}
            className="bg-card border border-border rounded-xl p-5"
          >
            <div className="text-xs text-muted-foreground mb-1">
              {formatDate(update.date)}
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {update.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">{update.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
