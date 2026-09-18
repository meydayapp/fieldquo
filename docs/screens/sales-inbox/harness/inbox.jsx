// The REAL /sales/threads page, rendered with fixture data.
import React from "react";
import { createRoot } from "react-dom/client";
import Page from "@/app/sales/threads/page";

function Shell({ children }) {
  // Approximates SalesShell's chrome: the shell class carries the layout
  // variables app/globals.css declares (--fq-top-bar, --fq-main-pad-y), so
  // .fq-sales-fill sizes the frame the way it does in the portal.
  return (
    <div className="min-h-screen bg-muted fq-sales-shell" style={{ "--fq-tab-bar-height": "0px", "--fq-top-bar": "106px" }}>
      <header className="bg-card border-b border-border"><div className="mx-auto px-4 sm:px-6 py-2 h-[60px] flex items-center text-xs font-bold uppercase tracking-[0.18em]">FieldQuo Sales</div></header>
      <nav className="bg-card border-b border-border"><div className="mx-auto px-4 sm:px-6 h-[46px] flex items-center gap-4 text-sm text-muted-foreground"><span>Today</span><span>Queue</span><span>Leads</span><span className="text-foreground font-semibold border-b-2 border-primary">Conversations</span><span>Texts</span><span>Team</span></div></nav>
      <main className="mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8">{children}</main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Shell><Page /></Shell>);
