// app/app/layout.js
import AdminSidebar from "@/app/components/layout/AdminSidebar";

// Everything under /app is per-user and behind the session check in
// middleware.js, so there is nothing meaningful to statically prerender —
// a prerendered dashboard page is an empty shell that fetches its real data
// on the client anyway.
//
// Applied at the layout so it covers every child route. Without it, Next
// tries to prerender these pages at build time and any client-only hook
// fails the whole deploy:
//
//   useSearchParams() should be wrapped in a suspense boundary
//   at page "/app/invoices/new"
//
// Fixing that page alone would just move the error to the next one
// (/app/jobs/new), and the one after that as the dashboard grows.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
