// lib/signup/welcomeState.js
//
// What lib/signup/welcome.js judges "where are they" from, read from the
// database in one place — the welcome API, the welcome pages' server layout
// and the setup stream all read it here, so the three can never disagree
// about which screen is next.

import { resumeWelcomeStep } from "@/lib/signup/welcome";

export const WELCOME_COMPANY_SELECT = Object.freeze({
  id: true,
  name: true,
  slug: true,
  address: true,
  city: true,
  province: true,
  postalCode: true,
  country: true,
  currency: true,
  timezone: true,
  website: true,
  hasWebsite: true,
  industries: true,
  teamSizeBand: true,
  yearsInBusinessBand: true,
  revenueBand: true,
  signupPriority: true,
  signupFocus: true,
  signupSource: true,
  onboardingStep: true,
  personalizedAt: true,
  trialEndsAt: true,
  createdAt: true,
  defaultLanguage: true,
});

/**
 * @param client     Prisma client (or transaction)
 * @param companyId  the owner's company
 * @param userId     the owner
 * @returns { user, company, tradeKeys, trades, resume } or null when the
 *          company is gone
 */
export async function loadWelcomeState(client, { companyId, userId }) {
  const [company, user, enabled] = await Promise.all([
    client.company.findUnique({ where: { id: companyId }, select: WELCOME_COMPANY_SELECT }),
    userId
      ? client.user.findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true } })
      : null,
    client.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      orderBy: { createdAt: "asc" },
      select: { category: { select: { id: true, key: true, label: true, labelTranslations: true } } },
    }),
  ]);
  if (!company) return null;
  const trades = enabled.map((row) => row.category).filter(Boolean);
  const state = { user: user || {}, company, tradeKeys: trades.map((t) => t.key), trades };
  return { ...state, resume: resumeWelcomeStep(state) };
}
