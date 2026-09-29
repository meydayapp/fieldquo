// app/welcome/[step]/page.js
//
// One welcome question per URL (2026-09-29) — /welcome/profile, /business,
// /size, /revenue, /priority, /focus, /source, then /setup. The company exists
// already (/signup's one press created it); these screens only fill it in.
//
// The server decides, before anything renders, whether this person may be
// here and which screen they get:
//
//   · no session                 → /login, coming back to this screen after
//   · no company on the login    → /signup (the login was made, the company
//                                  POST never landed — /signup finishes it)
//   · a support session, or not  → /app. Impersonation is read-only and a
//     the owner                    superadmin never answers a customer's
//                                  questions; an invited member has none.
//   · a company from before this → /app (onboardingStep null)
//     flow, or one that finished
//   · a screen past the first    → that first unanswered screen: a question
//     unanswered one               is never skipped by typing a URL
//                                  (lib/signup/welcome.js allowedWelcomeStep)
//
// /app sends the owner here with the same rule the other way round
// (lib/signup/welcomeGate.js), and the two cannot loop: this page sends to
// /app only when that gate would let them through.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCurrentMember } from "@/lib/currentMember";
import { allowedWelcomeStep, industryGroups, isWelcomeStep, welcomePath } from "@/lib/signup/welcome";
import { loadWelcomeState, welcomePrefill } from "@/lib/signup/welcomeState";
import { categoryLabel } from "@/lib/i18n/translateContent";
import { INDUSTRY_MESSAGES } from "@/app/i18n/industries";
import WelcomeFlow from "@/app/welcome/WelcomeFlow";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set up your business — FieldQuo",
  robots: { index: false, follow: false },
};

/** The industry select's groups, in the reader's language where we hold it. */
async function translatedGroups(language) {
  const rows = await db.serviceCategory
    .findMany({ where: { companyId: null }, select: { key: true, label: true, labelTranslations: true } })
    .catch(() => []);
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const dict = INDUSTRY_MESSAGES[language] || INDUSTRY_MESSAGES.en;
  return industryGroups().map((g) => ({
    ...g,
    label: g.slug === "other" ? null : dict?.trades?.[g.slug]?.label || INDUSTRY_MESSAGES.en?.trades?.[g.slug]?.label || g.label,
    options: g.options
      // Only trades the database can switch on: the PATCH resolves the key to
      // a ServiceCategory row, and an option it would refuse is a dead one.
      .filter((o) => byKey.has(o.tradeKey))
      .map((o) => ({ ...o, label: categoryLabel(byKey.get(o.tradeKey), language) || o.label })),
  })).filter((g) => g.options.length > 0);
}

export default async function WelcomeStepPage({ params }) {
  const { step } = await params;
  const h = await headers();
  const session = await auth.api.getSession({ headers: h }).catch(() => null);
  if (!session?.user) {
    redirect(`/login?next=${encodeURIComponent(welcomePath(isWelcomeStep(step) ? step : undefined))}`);
  }

  let member = null;
  try {
    member = await getCurrentMember({ headers: h, method: "GET", url: "" }, { skipBillingGate: true });
  } catch {
    member = null;
  }
  if (!member?.companyId) redirect("/signup");
  if (member.impersonation || member.role !== "owner") redirect("/app");

  const state = await loadWelcomeState(db, { companyId: member.companyId, userId: member.userId });
  if (!state || !state.company.onboardingStep || !state.resume) redirect("/app");

  const allowed = allowedWelcomeStep(step, state);
  if (allowed !== step) redirect(welcomePath(allowed));

  const user = await db.user.findUnique({ where: { id: member.userId }, select: { language: true } }).catch(() => null);
  const language = user?.language || state.company.defaultLanguage || "en";
  const groups = step === "business" ? await translatedGroups(language) : null;

  return <WelcomeFlow step={step} resume={state.resume} prefill={welcomePrefill(state, language)} groups={groups} />;
}
