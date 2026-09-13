// app/platform/layout.js
//
// Shell for FieldQuo's internal console. Visually distinct from the tenant
// app on purpose — dark chrome, "Platform" wordmark — because staff will have
// both open at once and mistaking one for the other is how someone edits real
// customer data thinking it's their own account.
//
// force-dynamic: every screen here reads live data behind a platform-token
// check, so there is nothing to prerender, and prerendering would make the
// build depend on a reachable database again.
export const dynamic = "force-dynamic";

import PlatformSidebar from "@/app/components/platform/PlatformSidebar";
import ToastLayer from "@/app/components/ToastLayer";

export default function PlatformLayout({ children }) {
  return (
    // flex-col below lg, a row from lg up: PlatformSidebar is a sticky top
    // bar on a phone (in flow, above the page) and a rail beside it on a
    // desktop. The phone padding is p-4 — at p-6 a 375px screen kept 327px
    // for content, and every table's first column started under the fold.
    <div className="flex flex-col lg:flex-row min-h-screen bg-muted">
      <PlatformSidebar />
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      {/* Every reportResponseError() in the console went to nobody until
          2026-09-12 — the error toast was mounted in /app only. One layer,
          through a portal, for the same reason /app and /sales have one. */}
      <ToastLayer surface="platform" />
    </div>
  );
}
