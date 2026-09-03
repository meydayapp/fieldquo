"use client";

// app/components/layout/SetupIncomplete.js
//
// What somebody sees when their company never finished checkout and they are
// not the person who can fix it.
//
// ── Why a screen and not a redirect ────────────────────────────────────────
//
// The owner of an unpaid company is sent back to /signup to finish paying (see
// lib/signup/setupGate.js). An invited estimator must NOT be: /signup sets up
// a NEW business, so bouncing them there would offer them a second company
// beside the one they were invited to — the failure getSetupRedirect's own
// comment has warned about since it was written, and the reason the "no
// membership" branch there is a membership check rather than a session check.
//
// ── Why a wall and not a banner ────────────────────────────────────────────
//
// Same argument as AccountLocked, which this deliberately resembles: the
// normal shell would render twenty panels above a sentence explaining why
// none of them matter. One screen, one message.
//
// ── Every control on it works ──────────────────────────────────────────────
//
// Sign out (better-auth's own client, so the session store is cleared and not
// just the cookie) and /contact, which is a marketing page outside /app. There
// is deliberately no "Tell us" link to /app/help the way AccountLocked has
// one: /app/help is inside this very shell and would render this same screen
// again. A link that returns you to where you already are is a dead control.

import { useRouter } from "next/navigation";
import Link from "next/link";
import { CreditCard, Clock } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function SetupIncomplete({ companyName }) {
  const router = useRouter();
  const { t } = useTranslation();

  async function handleSignOut() {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace("/login");
          router.refresh();
        },
      },
    });
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-muted grid place-items-center">
          <Clock size={24} className="text-muted-foreground" />
        </div>

        <h1 className="text-xl font-bold text-foreground mt-5">
          {t("app.setup.incomplete.title", "This account isn't set up yet")}
        </h1>

        <p className="text-sm text-muted-foreground mt-2">
          {companyName
            ? t(
                "app.setup.incomplete.bodyNamed",
                "{name} started setting up FieldQuo but never finished adding a payment method, so there's nothing here to work in yet.",
                { name: companyName },
              )
            : t(
                "app.setup.incomplete.body",
                "This business started setting up FieldQuo but never finished adding a payment method, so there's nothing here to work in yet.",
              )}
        </p>

        {/* Names the one person who can move this, so nobody spends an
            afternoon trying to fix it from an account that can't. */}
        <div className="mt-6 flex items-start gap-2.5 text-left bg-card border border-border rounded-xl px-4 py-3">
          <CreditCard
            size={17}
            className="text-muted-foreground shrink-0 mt-0.5"
          />
          <p className="text-sm text-foreground">
            {t(
              "app.setup.incomplete.whoCanFix",
              "Whoever owns the account needs to sign in and finish choosing a plan. Once they do, everything here opens up for you straight away — you won't need a new invitation.",
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-inverted text-inverted-foreground text-sm font-bold"
        >
          {t("app.setup.incomplete.signOut", "Sign out")}
        </button>

        <p className="text-xs text-muted-foreground mt-5">
          {t("app.setup.incomplete.stuck", "Think this is wrong?")}{" "}
          <Link href="/contact" className="underline">
            {t("app.setup.incomplete.contact", "Get in touch")}
          </Link>
        </p>
      </div>
    </main>
  );
}
