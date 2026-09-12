// The REAL /sales/messages page, rendered with fixture data.
import React from "react";
import { createRoot } from "react-dom/client";
import Page from "@/app/sales/messages/page";

function Shell({ children }) {
  // Approximates SalesShell's chrome: a top bar and the main padding, so the
  // frame height calc is exercised the way it is in the portal.
  return (
    <div className="min-h-screen bg-muted" style={{ "--fq-tab-bar-height": "0px" }}>
      <header className="bg-card border-b border-border"><div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 h-[60px] flex items-center text-xs font-bold uppercase tracking-[0.18em]">FieldQuo Sales</div></header>
      <nav className="bg-card border-b border-border"><div className="max-w-7xl mx-auto px-4 sm:px-6 h-[46px] flex items-center gap-4 text-sm text-muted-foreground"><span>Today</span><span>Queue</span><span>Leads</span><span className="text-foreground font-semibold border-b-2 border-primary">Texts</span><span>Team</span></div></nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8">{children}</main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Shell><Page /></Shell>);
