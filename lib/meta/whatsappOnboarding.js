// lib/meta/whatsappOnboarding.js
//
// "May THIS viewer be offered a way to connect a WhatsApp number?" — the one
// answer the WhatsApp panel, its status route and both connect doors share.
//
// ══ Why a second switch beside metaWhatsAppEnabled() ═══════════════════════
//
// metaWhatsAppEnabled() (lib/meta/client.js) is FieldQuo's own switch: the
// webhook, the send path and the connect routes are live on this deployment.
// It has to be ON for the owner to record the screencast Meta's App Review
// asks for — and with it on, every company saw a Connect button that opened
// Meta's Embedded Signup and dead-ended on Meta's own page, "FieldQuo can't
// onboard customers right now". That page is Meta telling the truth: a third
// party's business can only be onboarded by a WhatsApp Tech Provider whose app
// holds App Review ADVANCED access for whatsapp_business_management +
// whatsapp_business_messaging
// (developers.facebook.com/docs/whatsapp/solution-providers/get-started-for-tech-providers).
// The Tech Provider half is done — Meta confirmed FieldQuo as a verified Tech
// Provider on 2026-09-14 (app 4442828659308969, business 1534735784993645).
// What is still pending is the advanced access: both permissions read "Ready
// for testing", i.e. Standard access, which works only for businesses with a
// role on FieldQuo's own app.
//
// Nothing in the app can observe that grant — Meta sends no event for it —
// so it is a fact the owner states, once, the day it lands:
//
//   META_WHATSAPP_ONBOARDING_APPROVED=1
//
// Rejected: reusing META_WHATSAPP_ENABLED for this. Turning it off to hide the
// button also turns off the flow the reviewer has to watch working, which is
// the thing standing between FieldQuo and advanced access.
//
// ══ Who is "staff" ══════════════════════════════════════════════════════════
//
// A browser carrying a valid `platform-token` (the /platform console session,
// same host, path "/") whose PlatformAdmin row is still ACTIVE — the row
// re-read on every request, the way lib/staff/viewer.js and
// lib/platform/auditGate.js do, so an admin switched off loses the staff doors
// on the next request rather than when the 12-hour token expires. Any role:
// this grants no reach into anyone else's data, only the sight of two doors on
// the staff member's own company screen.
//
// Rejected: matching the signed-in /app user's email against PlatformAdmin.
// That would make an email string an identity bridge into staff-only
// behaviour; the console session is the one credential FieldQuo already
// trusts to say "this person is staff".
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

/**
 * Has Meta's App Review granted FieldQuo ADVANCED access to the two WhatsApp
 * permissions, so it can onboard OTHER businesses' WhatsApp numbers? (Tech
 * Provider verification itself landed on 2026-09-14; this is the step after.)
 */
export function metaWhatsAppOnboardingApproved() {
  const raw = String(process.env.META_WHATSAPP_ONBOARDING_APPROVED || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/**
 * Is this request from active FieldQuo staff? Never throws: a missing
 * PLATFORM_JWT_SECRET, a malformed cookie or a request with no cookie jar all
 * answer false. Failing closed here costs staff a test door; failing open
 * would hand every company a door Meta slams.
 */
export async function isWhatsAppStaff(request) {
  try {
    const admin = await getCurrentPlatformAdmin(request);
    if (!admin?.id) return false;
    const row = await db.platformAdmin.findUnique({
      where: { id: admin.id },
      select: { active: true },
    });
    return row?.active === true;
  } catch {
    return false;
  }
}

/**
 * The doors, as a pure function of the two facts — so the panel's state and
 * both routes' refusals are one table, executed by scripts/check-whatsapp.mjs.
 *
 *   comingSoon       the one sentence a company sees instead of any control
 *   signup           the Embedded Signup "Connect WhatsApp" button
 *   signupStaffOnly  …shown only because the viewer is staff, so it carries
 *                    the "Visible to FieldQuo staff only" label
 *   manual           the pasted Cloud API credentials form — staff only even
 *                    AFTER approval: it needs a token from FieldQuo's own
 *                    Meta app, and once Embedded Signup works no company
 *                    ever needs it
 */
export function whatsAppDoors({ approved, staff }) {
  const isApproved = approved === true;
  const isStaff = staff === true;
  return {
    comingSoon: !isApproved && !isStaff,
    signup: isApproved || isStaff,
    signupStaffOnly: !isApproved && isStaff,
    manual: isStaff,
  };
}

/** Both facts, read for one request, and the doors they open. */
export async function whatsAppAccess(request) {
  const approved = metaWhatsAppOnboardingApproved();
  const staff = await isWhatsAppStaff(request);
  return { approved, staff, ...whatsAppDoors({ approved, staff }) };
}
