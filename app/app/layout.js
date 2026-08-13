// app/app/layout.js
import { headers } from "next/headers";
import AdminSidebar from "@/app/components/layout/AdminSidebar";
import ImpersonationBanner from "@/app/components/ImpersonationBanner";
import BillingBanner from "@/app/components/layout/BillingBanner";
import SeatSharingBanner from "@/app/components/layout/SeatSharingBanner";
import AccountLocked from "@/app/components/layout/AccountLocked";
import ErrorToast from "@/app/components/ErrorToast";
import AppTours from "@/app/components/AppTours";
import CompanyPreferencesProvider from "@/app/providers/CompanyPreferencesProvider";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

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

/**
 * The signed-in user's interface language: their own choice, else the company
 * default, else null for "no stated preference".
 *
 * `User.language` was written by the settings page and read by NOTHING — picking
 * French there survived a round-trip to the database and changed no screen.
 *
 * Resolved HERE rather than in the root layout, even though the provider it
 * feeds lives there. The root layout wraps the marketing site too, and reading
 * headers() that high up opts every static marketing page into dynamic
 * rendering. /app is already force-dynamic, so a nested provider costs nothing
 * and keeps the boundary honest: signed-in screens follow the account, public
 * pages follow the browser.
 *
 * Never throws. A language lookup failing must not take down the whole app, and
 * the fallback is what everyone gets today anyway.
 */
async function getAppLanguage() {
  try {
    const member = await getCurrentMember({ headers: await headers() });
    if (!member?.userId) return null;

    const [user, company] = await Promise.all([
      db.user.findUnique({ where: { id: member.userId }, select: { language: true } }),
      member.companyId
        ? db.company.findUnique({
            where: { id: member.companyId },
            select: { defaultLanguage: true },
          })
        : null,
    ]);

    // Personal choice first, company default second — the order the settings
    // page describes. A null personal language means "inherit", not "unset".
    return user?.language || company?.defaultLanguage || null;
  } catch (err) {
    console.error("[AppLayout] couldn't resolve the interface language:", err);
    return null;
  }
}

/**
 * The company's own name, for the locked-out screen.
 *
 * This used to fetch brandColor/brandColors too, because the layout wrapped the
 * whole back office in BrandTheme. It no longer does: the brand colour is for
 * what the CLIENT sees — quote, invoice, email, PDF, booking page, portal,
 * public site — not for the screens staff work in all day. A contractor who
 * picks lime green should not get a lime-green back office, and the white-label
 * promise is about the homeowner's view, not the crew's. The colour is applied
 * per-surface now; see app/components/BrandTheme.js.
 *
 * Still its own tiny query rather than reusing a page's data: the layout
 * renders before any page. Never throws — a name lookup failing must not take
 * the app down, and the locked screen reads fine without it.
 */
async function getCompanyName() {
  try {
    const member = await getCurrentMember({ headers: await headers() });
    if (!member?.companyId) return null;

    return await db.company.findUnique({
      where: { id: member.companyId },
      select: { name: true },
    });
  } catch (err) {
    console.error("[AppLayout] couldn't load the company name:", err);
    return null;
  }
}

/**
 * Is this company locked out for non-payment?
 *
 * Resolved with skipBillingGate, because the gate would throw here — and
 * throwing in the layout would break the one page that fixes the problem.
 *
 * Never throws for any other reason either. A billing lookup failing must not
 * take the whole app down, and the safe direction is "not locked": briefly
 * letting an overdue company work costs a few requests, while wrongly walling
 * off a paying one is a support emergency.
 */
async function getLockState() {
  try {
    const member = await getCurrentMember(
      { headers: await headers(), method: "GET", url: "http://x/app" },
      { skipBillingGate: true },
    );
    if (member?.billingAccess?.level !== "locked") return null;
    return member.billingAccess;
  } catch (err) {
    console.error("[AppLayout] couldn't resolve billing access:", err);
    return null;
  }
}

export default async function AppLayout({ children }) {
  const [company, language, locked] = await Promise.all([
    getCompanyName(),
    getAppLanguage(),
    getLockState(),
  ]);

  // ── Locked ──────────────────────────────────────────────────────────────
  //
  // The whole app is replaced, not decorated with a banner. Every data request
  // is refused in this state, so rendering the normal shell would give them
  // twenty empty panels with the fix hidden somewhere in the middle.
  //
  // In FieldQuo's palette, like the rest of /app. The company's own name is
  // still on it, which is what makes it recognisably theirs; their brand colour
  // is reserved for what their clients see.
  if (locked) {
    return (
      <div className="min-h-screen bg-background">
        <AccountLocked reason={locked.reason} companyName={company?.name} />
      </div>
    );
  }

  return (
    // No data-brand here on purpose. The company's colour themes what a CLIENT
    // reads, not the back office — see getCompanyName above. Individual /app
    // screens that PREVIEW a client-facing document wrap that region in their
    // own data-brand + BrandTheme, which is why the hook is a per-surface
    // decision rather than a shell-wide one.
    <div className="min-h-screen bg-background">
      {/* Renders nothing unless a read-only support session is active. */}
      <ImpersonationBanner />
      {/* Renders nothing when the account is in good standing, which is the
          common case. Mounted here rather than on the billing page because
          someone whose card expired is looking at tomorrow's jobs, not at
          billing — a warning you have to go and find is one nobody sees until
          they're locked out. */}
      <BillingBanner />
      {/* Renders nothing unless the seat-sharing guard has actually recorded
          something, which is the case for almost every company. Below the
          billing banner deliberately: a card that failed is urgent and costs
          them access, this is a note. Never blocks the app — see the file. */}
      <SeatSharingBanner />
      {/* Mounted HERE, not at the root layout. Date format and week start are
          the COMPANY's preference and apply to their own screens; everything
          client-facing (/q, /portal, /book, /quote) formats by the client's
          locale instead. Scoping the provider to /app makes that boundary
          structural rather than a rule someone has to remember. */}
      {/* Nested inside the root provider on purpose — see getAppLanguage. The
          inner one wins for this subtree, so /app follows the saved account
          preference while the marketing site keeps following the browser.

          fromAccount tells it the value is a stated CHOICE, not a guess, so
          localStorage can't overwrite it. Without that, a user who picked French
          in Settings got English back on any browser that had previously visited
          the marketing site. */}
      <LanguageProvider initialLanguage={language} fromAccount={Boolean(language)}>
      <CompanyPreferencesProvider>
        {/* lg:flex, not flex — below lg the sidebar renders as a full-width
            sticky top bar plus a drawer, which has to sit ABOVE the page in
            normal flow rather than beside it as a flex column. */}
        <div className="lg:flex">
          <AdminSidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </CompanyPreferencesProvider>
      </LanguageProvider>
      {/* Renders nothing until something calls showError(). Mounted here so
          no individual page needs its own error state and banner — see
          lib/clientErrors.js. */}
      <ErrorToast />
      {/* First-visit walkthroughs. Mounted once here so a page never has to
          wire its own — it just needs a data-tour anchor. See tours.js. */}
      <AppTours />
    </div>
  );
}
