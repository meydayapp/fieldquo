// app/app/layout.js
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminSidebar from "@/app/components/layout/AdminSidebar";
import ImpersonationBanner from "@/app/components/ImpersonationBanner";
import BillingBanner from "@/app/components/layout/BillingBanner";
import SeatSharingBanner from "@/app/components/layout/SeatSharingBanner";
import AccountLocked from "@/app/components/layout/AccountLocked";
import ErrorToast from "@/app/components/ErrorToast";
import AppTours from "@/app/components/AppTours";
import JenniferPanel from "@/app/components/jennifer/JenniferPanel";
import CompanyPreferencesProvider from "@/app/providers/CompanyPreferencesProvider";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import { FeatureProvider } from "@/app/providers/FeatureProvider";
import { PermissionProvider } from "@/app/providers/PermissionProvider";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCurrentMember } from "@/lib/currentMember";
import { featureMapForCompany, navFlagsFrom } from "@/lib/features/gate";

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

/**
 * Which features this company may see, for the nav only.
 *
 * Resolved here so the sidebars can render the right menu in their FIRST paint —
 * a menu that draws every row and then removes three is worse than one that
 * never hid them. It is NOT what stops anyone reaching a withheld feature: that
 * is lib/currentMember.js for the APIs and the FeatureGate layouts for the
 * pages, both of which run whether or not this ever succeeds.
 *
 * Never throws, for the same reason as the two lookups above, and fails toward
 * showing everything: a menu row leading to a gated page costs one click, while
 * a blanked-out nav on a database blip looks like the account broke.
 */
async function getFeatureFlags() {
  try {
    const member = await getCurrentMember(
      { headers: await headers(), method: "GET", url: "" },
      { skipBillingGate: true },
    );
    if (!member?.companyId) return null;
    return navFlagsFrom(await featureMapForCompany(member.companyId));
  } catch (err) {
    console.error("[AppLayout] couldn't resolve feature availability:", err);
    return null;
  }
}

/**
 * The caller's role and permission grid, for the sidebars.
 *
 * Resolved here rather than fetched from the browser for the same reason the
 * feature flags are: a menu that draws in full and then removes rows a moment
 * later is worse than one that never hid them.
 *
 * Returns null on any failure, which every consumer reads as "show
 * everything". Hiding the whole nav because one query hiccupped would be a far
 * more visible fault than a row leading to a page that refuses — and the page
 * still refuses, which is where the actual enforcement lives.
 */
async function resolveCallerPermissions() {
  try {
    const member = await getCurrentMember(
      { headers: await headers(), method: "GET", url: "" },
      { skipBillingGate: true },
    );
    if (!member?.id) return null;
    const full = await db.member.findUnique({
      where: { id: member.id },
      select: { role: true, permissions: true },
    });
    return full ? { role: full.role, permissions: full.permissions } : null;
  } catch (err) {
    console.error("[AppLayout] couldn't resolve caller permissions:", err);
    return null;
  }
}

/**
 * Signed in, with no company — the abandoned-signup state.
 *
 * Signup creates the account (Better Auth) at one step and the company at
 * another: POST /api/companies, wired to "Continue to Payment" on the LAST
 * step (app/signup/page.js handleFinish). Stop in between and the User row
 * exists with no Company and no Member, which is a real and reachable state,
 * not a corruption.
 *
 * Those people used to get the whole back office — full nav, every panel — on
 * top of nothing. Every company-scoped API answers 401 because there genuinely
 * is no company, so the dashboard rendered a developer's sentence ("No active
 * company membership could be resolved") above twenty empty cards. Send them
 * back to finish setup instead: /signup detects this same state and resumes.
 *
 * Not in middleware.js, for the reason its header already gives for the feature
 * gate: middleware only knows whether a session cookie exists, and getting from
 * the cookie to a company means re-implementing getCurrentMember — the
 * second-copy-that-rots problem. Here it runs after the member is resolved.
 *
 * No loop risk: /signup is not under /app, so this layout never renders for it.
 *
 * Never throws. Failing to resolve this must not take the app down, and the
 * safe direction is "don't redirect" — briefly showing a broken dashboard costs
 * a reload, while bouncing a real member out of their own account does not.
 */
async function getSetupRedirect() {
  try {
    const h = await headers();
    // Resolves a read-only support session too, so an impersonating admin is
    // never mistaken for someone who hasn't finished signing up.
    const member = await getCurrentMember(
      { headers: h, method: "GET", url: "" },
      { skipBillingGate: true },
    );
    if (member?.companyId) return null;

    const session = await auth.api.getSession({ headers: h });
    // No session at all — middleware.js already sends this to /login. Nothing
    // to add, and redirecting to /signup would be the wrong door.
    if (!session?.user?.id) return null;

    // Only when there is genuinely no membership. A Member row that exists but
    // won't resolve (a company missing its authOrgId, say) is a different
    // fault, and sending that person to /signup would invite them to create a
    // SECOND company alongside the one they already belong to.
    const membership = await db.member.findFirst({
      where: { userId: session.user.id, active: true },
      select: { id: true },
    });
    if (membership) return null;

    return "/signup";
  } catch (err) {
    console.error("[AppLayout] couldn't resolve the setup state:", err);
    return null;
  }
}

export default async function AppLayout({ children }) {
  const [company, language, locked, featureFlags, callerPermissions, setupPath] =
    await Promise.all([
      getCompanyName(),
      getAppLanguage(),
      getLockState(),
      getFeatureFlags(),
      // Alongside the others rather than after them: it is one indexed lookup
      // by member id, and serialising it would add a round trip to every
      // screen in the app for no benefit.
      resolveCallerPermissions(),
      getSetupRedirect(),
    ]);

  // Before the lock check: a company that doesn't exist can't be behind on its
  // bill. redirect() throws NEXT_REDIRECT, so it stays outside the try/catch
  // that getSetupRedirect keeps around its own lookups.
  if (setupPath) redirect(setupPath);

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
      {/* Wraps `children` as well as the rail, because the SETTINGS sidebar is
          rendered by a nested layout further down the tree and needs the same
          map. Resolving it twice would be two more queries for the same answer. */}
      <FeatureProvider flags={featureFlags}>
      <PermissionProvider
        role={callerPermissions?.role}
        permissions={callerPermissions?.permissions}
      >
        {/* lg:flex, not flex — below lg the sidebar renders as a full-width
            sticky top bar plus a drawer, which has to sit ABOVE the page in
            normal flow rather than beside it as a flex column. */}
        <div className="lg:flex">
          <AdminSidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </PermissionProvider>
      </FeatureProvider>
      </CompanyPreferencesProvider>
      </LanguageProvider>
      {/* Renders nothing until something calls showError(). Mounted here so
          no individual page needs its own error state and banner — see
          lib/clientErrors.js. */}
      <ErrorToast />
      {/* First-visit walkthroughs. Mounted once here so a page never has to
          wire its own — it just needs a data-tour anchor. See tours.js. */}
      <AppTours />
      {/* Tier-1 support for THIS company only — a different assistant from the
          FieldQuo AI copilot at /app/copilot, which helps run the business
          rather than fix it. See lib/ai/jennifer/ for the whole boundary.
          Mounted at the shell level, not per-page, for the same reason
          ErrorToast is: one instance, reachable from anywhere in /app. */}
      <JenniferPanel variant="app" />
    </div>
  );
}
