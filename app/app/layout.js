// app/app/layout.js
import { headers } from "next/headers";
import AdminSidebar from "@/app/components/layout/AdminSidebar";
import ImpersonationBanner from "@/app/components/ImpersonationBanner";
import ErrorToast from "@/app/components/ErrorToast";
import BrandTheme from "@/app/components/BrandTheme";
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

// Reads the company's brand colour for the white-label.
//
// Deliberately its own tiny query rather than reusing a page's data: the
// layout renders before any page, and a colour arriving one render late means
// the whole shell repaints in front of the user on every navigation.
//
// Failure here must never take the app down — a company that can't load its
// colour gets FieldQuo's, which is exactly what an unbranded company gets
// anyway.
async function getCompanyBrand() {
  try {
    const member = await getCurrentMember({ headers: await headers() });
    if (!member?.companyId) return null;

    return await db.company.findUnique({
      where: { id: member.companyId },
      select: { brandColor: true, brandColors: true },
    });
  } catch (err) {
    console.error("[AppLayout] couldn't load company branding:", err);
    return null;
  }
}

export default async function AppLayout({ children }) {
  const brand = await getCompanyBrand();

  return (
    // data-brand is the hook BrandTheme's CSS targets. Present even when the
    // company has no colour set, so the selector doesn't have to care.
    <div data-brand className="min-h-screen bg-background">
      <BrandTheme
        brandColor={brand?.brandColor}
        brandColors={brand?.brandColors}
      />
      {/* Renders nothing unless a read-only support session is active. */}
      <ImpersonationBanner />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      {/* Renders nothing until something calls showError(). Mounted here so
          no individual page needs its own error state and banner — see
          lib/clientErrors.js. */}
      <ErrorToast />
    </div>
  );
}
