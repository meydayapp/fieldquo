// lib/signup/welcomeState.js
//
// What lib/signup/welcome.js judges "where are they" from, read from the
// database in one place — the welcome API, the welcome pages' server layout
// and the setup stream all read it here, so the three can never disagree
// about which screen is next.

import { industryChoiceValue, resumeWelcomeStep } from "@/lib/signup/welcome";
import { CURRENCY_SYMBOL } from "@/lib/currency";
import { categoryLabel } from "@/lib/i18n/translateContent";

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

/**
 * What the screens open with: every answer already stored, in the shape the
 * forms use — so a screen opened a week later is filled in, not blank.
 */
export function welcomePrefill(state, language = "en") {
  const c = state.company;
  const words = String(state.user?.name || "").trim().split(/\s+/).filter(Boolean);
  const trade = state.trades[0] || null;
  return {
    user: {
      email: state.user?.email || "",
      firstName: words[0] || "",
      lastName: words.slice(1).join(" "),
      phone: state.user?.phone || "",
    },
    company: {
      name: c.name || "",
      address: c.address || "",
      city: c.city || "",
      province: c.province || "",
      postalCode: c.postalCode || "",
      country: c.country || "",
      currency: c.currency || null,
      // The symbol the revenue chips are drawn in — the company's own
      // currency, never a guessed one. Null until the business screen.
      currencySymbol: c.currency ? CURRENCY_SYMBOL[c.currency] || null : null,
      website: c.website || "",
      industry: industryChoiceValue({ industries: c.industries, tradeKey: trade?.key || null }),
      teamSizeBand: c.teamSizeBand || null,
      yearsInBusinessBand: c.yearsInBusinessBand || null,
      revenueBand: c.revenueBand || null,
      signupPriority: c.signupPriority || null,
      signupFocus: Array.isArray(c.signupFocus) ? c.signupFocus : [],
      signupSource: c.signupSource || null,
      trialEndsAt: c.trialEndsAt ? new Date(c.trialEndsAt).toISOString() : null,
    },
    trade: trade ? { key: trade.key, id: trade.id, label: categoryLabel(trade, language) } : null,
  };
}
