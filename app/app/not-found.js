// app/app/not-found.js
//
// The 404 for signed-in staff, inside the back office.
//
// ── What it fixes ──────────────────────────────────────────────────────────
//
// There was no not-found boundary under /app, so every unmatched back-office
// URL fell through to the root one — the PUBLIC marketing 404, with the
// marketing header, the marketing footer, an industries list and links to
// Pricing and Contact.
//
// Two things wrong with that, and the cosmetic one is the lesser:
//
//   * It ejects the user from the app. Someone who mistyped an internal URL
//     lands on the sales site, with no route back to the screen they were on
//     and no navigation to anything they use. The theme is wrong too, which is
//     how it gets noticed.
//
//   * It shows a signed-in customer the acquisition funnel. "Pricing" and the
//     industries footer are aimed at somebody deciding whether to buy. Putting
//     them in front of a contractor who already pays reads as the software
//     forgetting who they are.
//
// The route that surfaced it: /app/platform. The platform console lives at
// /platform — it is FieldQuo's own back office, deliberately outside the
// customer's app — so /app/platform has never existed and never will.
//
// ── Why no sidebar ─────────────────────────────────────────────────────────
//
// The layout above this already renders the rail; this is only the page body.
// Rendering navigation here would draw a second one.
"use client";

import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function AppNotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
          <Compass size={22} className="text-muted-foreground" />
        </div>

        <h1 className="mt-4 text-xl font-semibold text-foreground">
          {t("app.notFound.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("app.notFound.body")}
        </p>

        <Link
          href="/app"
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold border border-border rounded-lg px-3.5 py-2 hover:bg-muted"
        >
          <ArrowLeft size={14} />
          {t("app.notFound.back")}
        </Link>
      </div>
    </div>
  );
}
