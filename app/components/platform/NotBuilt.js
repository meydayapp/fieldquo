// app/components/platform/NotBuilt.js
//
// Honest placeholder for /platform/* screens that don't exist yet.
//
// Every page under app/platform/ was a zero-byte file. Next prerenders that
// segment, so each one failed the production build with "The default export
// is not a React Component" — one per deploy, since the build stops at the
// first. Rather than fix them one at a time, each now renders this.
//
// Deliberately NOT deleted instead: the backing API routes
// (/api/platform/companies, /admins, /billing/plans, /analytics/overview,
// /service-categories) are fully implemented, so these routes are intended —
// just unbuilt. A placeholder keeps the intent visible; a 404 would read as
// a routing bug.

import Link from "next/link";
import { Construction } from "lucide-react";

export default function NotBuilt({ title, description, apiRoute }) {
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-card border border-border rounded-2xl p-8 text-center">
        <span className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mx-auto mb-4">
          <Construction size={22} className="text-amber-600 dark:text-amber-400" />
        </span>

        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>

        {apiRoute && (
          <p className="text-xs text-muted-foreground mt-4">
            The API behind this page already exists at{" "}
            <span className="font-mono text-muted-foreground">{apiRoute}</span> — only
            the UI is missing.
          </p>
        )}

        <Link
          href="/app"
          className="inline-block mt-6 text-sm font-semibold text-foreground underline"
        >
          Back to the app
        </Link>
      </div>
    </div>
  );
}
