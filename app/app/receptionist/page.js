// app/app/receptionist/page.js
"use client";

import { Headset } from "lucide-react";

// Placeholder — the nav links here but the feature isn't specced yet. Rendered
// as a real page (not a 404) so the sidebar reads correctly; replace this body
// once the receptionist workflow is defined. Intentionally makes no backend
// calls.
export default function ReceptionistPage() {
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Headset size={22} /> Receptionist
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Handle inbound calls and messages, capture leads, and route them to
          the right person.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <Headset size={40} className="mx-auto text-muted-foreground mb-3" />
        <h2 className="text-base font-semibold text-foreground">Coming soon</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          This is where inbound call handling and lead capture will live. It
          isn't built yet — tell us how you want your receptionist workflow to
          work and we'll shape it here.
        </p>
      </div>
    </div>
  );
}
