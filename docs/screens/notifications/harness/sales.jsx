// "Before" harness for /sales: the shell's geometry (class lists from
// SalesShell.js) with the real SalesMobileTabBar, the queue's top-up toast
// markup VERBATIM from app/sales/queue/page.js, and the tour launcher pill
// with SalesTour.js's class list. ?scene=topup|topup-max
import React from "react";
import { createRoot } from "react-dom/client";
import SalesMobileTabBar from "@/app/components/sales/SalesMobileTabBar";
import { Plus, Compass, AlertCircle } from "lucide-react";
import SalesToastAfter from "./salesAfter.jsx";

const params = new URLSearchParams(window.location.search);
const scene = params.get("scene") || "topup";
const after = params.get("after") === "1";
const tabs = [
  { href: "/sales", label: "Today" }, { href: "/sales/queue", label: "Queue" }, { href: "/sales/playbook", label: "Playbook" },
  { href: "/sales/leads", label: "Leads" }, { href: "/sales/threads", label: "Threads" }, { href: "/sales/messages", label: "Texts" },
  { href: "/sales/team", label: "Team" }, { href: "/sales/notes", label: "Notes" }, { href: "/sales/calendar", label: "Calendar" },
  { href: "/sales/companies", label: "Companies" }, { href: "/sales/demo", label: "Demo" }, { href: "/sales/support", label: "Support" },
  { href: "/sales/voicemail", label: "Voicemail" }, { href: "/sales/pay", label: "Pay & settings" },
];
const TOAST = "Added 25 leads to your queue — Phoenix, Mesa, Tempe, Chandler.";

function Shell() {
  return (
    <div className="min-h-screen bg-muted fq-sales-shell lg:flex lg:items-stretch" style={{ "--fq-sales-rail": "220px" }}>
      <aside className="hidden lg:flex flex-col shrink-0 sticky top-0 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border w-[220px]">
        <div className="flex items-center gap-2 px-3 min-h-[56px] border-b border-sidebar-border text-xs font-bold uppercase tracking-[0.18em] text-sidebar-primary">FieldQuo Sales</div>
        <nav className="flex flex-col gap-0.5 p-2 flex-1">{tabs.map((tb) => <div key={tb.href} className="px-3 py-2 text-sm text-sidebar-muted-foreground">{tb.label}</div>)}</nav>
      </aside>
      <div className="min-w-0 flex-1 flex flex-col">
        <header className="hidden lg:block bg-card border-b border-border sticky top-0 z-30 h-[61px]" />
        <SalesMobileTabBar tabs={tabs} name="Alex Rep" onSignOut={() => {}} />
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-[calc(var(--fq-tab-bar-height)+1.5rem)]">
          <div className="space-y-4" data-sales-console>
            <h1 className="text-lg font-semibold text-foreground">Queue</h1>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Desert Sun Painting — Phoenix — opens 9:00</div>
            ))}
            {!after && (scene === "topup" || scene === "topup-max") ? (
              <div
                className="fixed bottom-[calc(var(--fq-tab-bar-height)+1rem)] left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card shadow-lg px-4 py-3 text-sm text-foreground flex items-start gap-2"
                role="status" aria-live="polite" data-top-up-toast
              >
                <Plus size={16} className="mt-0.5 shrink-0 text-brand-accent-text" aria-hidden="true" />
                <span className="break-words">{TOAST}</span>
              </div>
            ) : null}
            {scene === "topup-max" ? (
              <div className="rounded-xl border border-border bg-card @container min-w-0 flex-1 fixed inset-0 z-40 rounded-none overflow-y-auto lg:left-[var(--fq-sales-rail,220px)] lg:top-[61px] p-4">
                <p className="text-sm text-foreground">Lead panel, maximised (fixed inset-0 z-40)</p>
              </div>
            ) : null}
          </div>
        </main>
      </div>
      {/* the tour launcher pill: SalesTour.js's class list */}
      <div className="fixed bottom-[calc(var(--fq-tab-bar-height)+1rem)] left-4 z-40 max-w-[calc(100vw-2rem)]">
        <button type="button" className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-full bg-card border border-border shadow-lg text-sm font-semibold text-foreground">
          <Compass size={16} className="text-brand-accent-text shrink-0" /> Take the tour
        </button>
      </div>
      {after ? <SalesToastAfter text={TOAST} /> : null}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Shell />);
setTimeout(() => document.documentElement.setAttribute("data-harness-done", "1"), 600);
