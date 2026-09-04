// app/components/FeatureGate.js
//
// The PAGE half of the one feature guard. Mounted as a server `layout.js` on
// every route prefix a feature claims, so a bookmarked URL is stopped before
// anything renders.
//
// ── Why a layout, not a check inside each page ─────────────────────────────
//
// Most gated screens are "use client" components. A client page cannot read the
// database, and converting eight of them to server shells to add one check each
// would be eight chances to get it slightly different. A server layout wraps the
// page and every route beneath it, costs one file per prefix, and is
// mechanically checkable: scripts/check-feature-flags.mjs fails if a
// routePrefix in the registry has no gate mounted at it.
//
// ── Why the API gate is not enough on its own ──────────────────────────────
//
// AGENTS.md, twice over: hiding buttons is not access control, and never ship a
// control that appears to work and doesn't. With only the API gate, a bookmarked
// /app/receptionist would render its full shell — heading, filters, empty
// states — and then quietly 404 its fetches. That is a page that looks alive and
// is not. Enforcing in both places is the same doubling as the impersonation
// gate in middleware.js and lib/currentMember.js.
//
// ── Nothing here deletes anything ──────────────────────────────────────────
//
// This component makes a screen unreachable. It does not touch a single tenant
// row. The funnels, campaigns and call records behind a hidden feature are
// exactly where they were and come back untouched.
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { getCurrentMember } from "@/lib/currentMember";
import { featureStateFor } from "@/lib/features/gate";
import { featureEntry } from "@/lib/features/registry";
import FeaturePreviewBanner from "@/app/components/layout/FeaturePreviewBanner";

/** Resolve once. Never throws — returns null when it cannot answer. */
async function resolveForCurrentCompany(feature) {
  try {
    // skipBillingGate: an overdue company is walled off by AppLayout already,
    // and letting the billing gate throw here would replace the honest "this
    // isn't available" with a payment error on a page that isn't about payment.
    //
    // url: "" so the API half of the gate (assertFeatureAccess) sits this one
    // out. It has no route to judge here, and this function is about to ask it
    // the same question directly.
    const member = await getCurrentMember(
      { headers: await headers(), method: "GET", url: "" },
      { skipBillingGate: true },
    );
    if (!member?.companyId) return null;
    return await featureStateFor(member.companyId, feature);
  } catch (err) {
    console.error(`[FeatureGate] ${feature} couldn't be resolved:`, err?.message);
    return null;
  }
}

export default async function FeatureGate({ feature, children }) {
  // An unknown key is a programming error, and the safe reading of "I don't know
  // what this gate is protecting" is to protect it. featureStateFor resolves an
  // unregistered key to hidden, so no branch is needed here — but the entry
  // lookup can be undefined, which is why the locked copy has a fallback.
  const entry = featureEntry(feature);
  const resolved = await resolveForCurrentCompany(feature);

  // Null means "couldn't answer": no member, a session in a state we can't
  // resolve, or a database fault deeper than featureMapForCompany's own catch.
  // Fail closed on the PAGE. A screen that half-loads is worse than one that
  // isn't there, and inventing "available" here would open every gate for
  // exactly the request we understand least.
  const state = resolved?.state ?? "hidden";

  // ── hidden: no trace ─────────────────────────────────────────────────────
  //
  // The ordinary 404, identical to any unknown path. Not a redirect to a page
  // that would explain, not a 403 naming the feature — either of those tells the
  // visitor the thing exists, which is the one promise `hidden` makes.
  if (state === "hidden") notFound();

  if (state === "locked") {
    return <FeatureLocked label={entry?.label} note={resolved?.note} />;
  }

  if (state === "preview") {
    return (
      <>
        <FeaturePreviewBanner />
        {children}
      </>
    );
  }

  return children;
}

/**
 * What a locked feature shows instead of itself.
 *
 * Server-rendered English, like AccountLocked next door: both are whole-screen
 * states with no interactivity, and pulling the client translation context into
 * every gated route to render two sentences would make each of them a client
 * boundary. The strings that appear in the NAV — where the rest of the interface
 * is translated — do go through appMessages.js.
 */
function FeatureLocked({ label, note }) {
  return (
    <main className="min-h-[60vh] grid place-items-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-muted grid place-items-center">
          <Lock size={22} className="text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold text-foreground mt-5">
          {label || "This feature"}{" "}
          isn&apos;t switched on yet
        </h1>
        {/* Says out loud that nothing was destroyed. A contractor who set up
            eight funnels and finds the screen gone will assume the worst unless
            told otherwise, and the promise is real — see registry.js. */}
        <p className="text-sm text-muted-foreground mt-2">
          {note ||
            "It isn't available on your account right now. Nothing has been deleted — anything you had set up here is still saved, and comes back the moment it's switched on."}
        </p>
      </div>
    </main>
  );
}
