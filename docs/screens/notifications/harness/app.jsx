// "Before" harness for /app: a replica of the shell's geometry (the real
// class lists from app/app/layout.js and AdminSidebar.js) with the REAL
// NotificationBell, ErrorToast and MobileTabBar mounted where the shell
// mounts them. ?scene=bell|bell-collapsed|toast, ?after=1 swaps in the
// shared toast layer once it exists.
import React from "react";
import { createRoot } from "react-dom/client";
import NotificationBell from "@/app/components/layout/NotificationBell";
import ToastLayer from "@/app/components/ToastLayer";
import MobileTabBar from "@/app/components/layout/MobileTabBar";
import { FeatureProvider } from "@/app/providers/FeatureProvider";
import { PermissionProvider } from "@/app/providers/PermissionProvider";
import { showError } from "@/lib/clientErrors";
import { Bell, Menu } from "lucide-react";

const params = new URLSearchParams(window.location.search);
const scene = params.get("scene") || "toast";
const collapsed = scene === "bell-collapsed";

function Shell() {
  return (
    <FeatureProvider flags={{}}>
    <PermissionProvider role="owner" permissions={{}}>
    <div className="min-h-screen bg-background fq-app-shell">
      <div className="lg:flex">
        {/* mobile top bar, as AdminSidebar draws it */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 bg-sidebar text-sidebar-foreground">
          <button className="p-2.5 -m-0.5 rounded-lg"><Menu size={20} /></button>
          <span className="font-bold tracking-wide">FieldQuo</span>
          <div className="ml-auto"><NotificationBell /></div>
        </div>
        <aside className={`hidden lg:flex shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen sticky top-0 flex-col ${collapsed ? "w-[76px]" : "w-64"}`}>
          <div className={`py-5 border-b border-sidebar-border flex ${collapsed ? "px-2 flex-col items-center gap-2" : "px-5 flex-row items-center justify-between"}`}>
            <span className="font-bold tracking-wide">{collapsed ? "F" : "FieldQuo"}</span>
            <div className="hidden lg:block"><NotificationBell /></div>
          </div>
          <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto">
            {["Dashboard", "Leads", "Quotes", "Jobs", "Invoices", "Clients", "Scheduler", "Messages"].map((l) => (
              <div key={l} className="px-3 py-2 rounded-lg text-sm text-sidebar-muted-foreground">{collapsed ? l[0] : l}</div>
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0 pb-[calc(var(--fq-tab-bar-height)+var(--fq-dock-height))]">
          <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold text-foreground">Quotes</h1>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Quote Q-10{40 + i} — Maria Lopez — $4,820</div>
            ))}
          </div>
          {/* a page Save bar, the way useBottomDock pages draw one */}
          <div className="fixed inset-x-0 bottom-[var(--fq-tab-bar-height)] z-20 border-t border-border bg-card px-4 py-3 flex justify-end gap-2 lg:left-64">
            <button className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
            <button className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Save & send</button>
          </div>
        </main>
        <MobileTabBar />
      </div>
      <ToastLayer surface="app" />
      {/* Jennifer's launcher, the real class list from JenniferPanel.js */}
      <button className="fixed bottom-[calc(var(--fq-tab-bar-height)+var(--fq-dock-height)+1.25rem)] right-5 z-30 h-14 w-14 flex items-center justify-center rounded-full bg-inverted text-inverted-foreground shadow-lg" aria-label="Chat with Jennifer">
        <Bell size={22} />
      </button>
    </div>
    </PermissionProvider>
    </FeatureProvider>
  );
}

createRoot(document.getElementById("root")).render(<Shell />);
document.documentElement.style.setProperty("--fq-dock-height", "62px");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await wait(300);
  if (scene.startsWith("bell")) {
    const scope = window.innerWidth >= 1024 ? document.querySelector("aside") : document;
    const btn = scope.querySelector('button[aria-expanded]');
    if (!btn) throw new Error("no bell");
    btn.click();
    await wait(600);
    if (!document.querySelector('[role="dialog"]')) throw new Error("bell panel did not open");
  }
  if (scene === "toast") {
    showError("Couldn't send the quote. The client's email address bounced — check it on the client record and try again.");
    await wait(100);
    showError("The connection dropped. Your draft is saved.");
    await wait(300);
  }
  document.documentElement.setAttribute("data-harness-done", "1");
})().catch((err) => document.documentElement.setAttribute("data-scene-error", String(err?.message || err)));
