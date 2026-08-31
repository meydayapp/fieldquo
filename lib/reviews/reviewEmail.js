// lib/reviews/reviewEmail.js
//
// The "how did we do?" email.
//
// ══ It is from the contractor, not from us ═════════════════════════════════
//
// Same rule as every other client-facing surface: the homeowner sees their
// painter's logo, their painter's colour, their painter's name in the From
// line. Nothing here says FieldQuo. The review it earns belongs to the
// contractor and so does the email that asked for it.
//
// ══ Short on purpose ═══════════════════════════════════════════════════════
//
// One sentence of thanks, one button. Every extra paragraph is a chance to
// close the tab. This is the one email in the product where brevity IS the
// feature — a long, well-designed review request performs worse than a short
// plain one, because the ask stops looking like a favour and starts looking
// like marketing.
import { resolveTheme, escapeHtml, safeUrl } from "@/lib/email/emailTheme";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { unsubscribeFooterHtml } from "@/lib/marketing/unsubscribe";

/**
 * Copy, per language.
 *
 * Written out rather than machine-translated at send time, for the same reason
 * documents are: a contractor should be able to read exactly what their
 * customers receive. `{name}` and `{company}` are the only substitutions.
 */
const COPY = {
  en: {
    subject: (company) => `How did we do? — ${company}`,
    greeting: (name) => (name ? `Hi ${name},` : "Hi,"),
    body: (company) =>
      `Thanks for having ${company} out. If we did a good job, a quick review would mean a lot — it's the main way people find us.`,
    button: "Leave a review",
    takes: "Takes about a minute.",
    problem: (company) =>
      `And if something wasn't right, reply to this email instead and ${company} will put it straight.`,
  },
  fr: {
    subject: (company) => `Comment avons-nous fait? — ${company}`,
    greeting: (name) => (name ? `Bonjour ${name},` : "Bonjour,"),
    body: (company) =>
      `Merci d'avoir fait appel à ${company}. Si vous êtes satisfait du travail, un court avis nous aiderait beaucoup — c'est surtout comme ça qu'on nous trouve.`,
    button: "Laisser un avis",
    takes: "Ça prend environ une minute.",
    problem: (company) =>
      `Et si quelque chose n'allait pas, répondez plutôt à ce courriel et ${company} y verra.`,
  },
};

export function reviewCopy(language) {
  return COPY[language] || COPY.en;
}

/**
 * Build the email.
 *
 * @param unsubscribeToken  MarketingSubscriber.unsubscribeToken for this
 *        (company, client email) pair — the caller (cron/review-requests)
 *        calls ensureSubscriber() first so one always exists. This is a
 *        COMMERCIAL message under CASL (see lib/marketing/unsubscribe.js's
 *        classification note): asking a past customer to publicly promote
 *        the business is outreach on the business's behalf, not a message
 *        needed to complete something already in motion. Required in
 *        practice — every real caller passes it — but not enforced here with
 *        a throw, so a template-preview caller can still render one without
 *        wiring a token.
 * @param request  forwarded to unsubscribeUrl() so the link uses this
 *        deployment's own origin rather than a build-time constant.
 * @returns {{ subject: string, html: string }}
 */
export function buildReviewEmail({ company = {}, client = {}, language = "en", unsubscribeToken, request }) {
  const t = reviewCopy(language);
  const theme = resolveTheme(company);
  const companyName = company.name || "us";

  // safeUrl before it reaches an href, even though shouldRequestReview already
  // validated the protocol. Two gates because this one is the last thing before
  // a link goes out under someone else's brand, and the cost of being wrong is
  // the contractor's reputation rather than ours.
  const url = safeUrl(company.reviewUrl);
  if (!url) return null;

  // ── The button's colours come from fillPair, not from emailTheme ─────────
  //
  // emailTheme's `contrastText` is a luminance THRESHOLD: over 0.55 use dark
  // ink, under it use white. That's the naive rule AGENTS.md warns about, and
  // measuring it proves the warning — mid grey lands at 3.95:1, hot pink at
  // 3.64, safety orange at 2.94. All three fail 4.5:1, and no choice of
  // foreground fixes them, because a mid-tone is roughly equidistant from
  // black and white.
  //
  // fillPair handles exactly that case by moving the FILL in small steps until
  // the pair measures 4.5:1, so the button stays recognisably their colour
  // instead of being replaced. A washed-out button is not a cosmetic problem
  // here: this email is one sentence and one button, and if the button is
  // invisible the email does nothing at all.
  const { bg: fill, fg: ink } = fillPair(documentTheme(company));

  // Already run through safeUrl by resolveTheme.
  const logo = theme.logoUrl;

  const html = `
<div style="margin:0;padding:24px;background:#f6f7f9;font-family:${theme.font};">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 28px;">
    ${logo ? `<img src="${logo}" alt="${escapeHtml(companyName)}" style="max-height:44px;max-width:180px;display:block;margin:0 0 20px;">`
           : `<div style="font-size:17px;font-weight:700;color:#111827;margin:0 0 20px;">${escapeHtml(companyName)}</div>`}

    <p style="margin:0 0 12px;font-size:15px;color:#111827;">${escapeHtml(t.greeting(client.name))}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#374151;">${escapeHtml(t.body(companyName))}</p>

    <a href="${url}" style="display:inline-block;background:${fill};color:${ink};text-decoration:none;font-size:15px;font-weight:600;padding:13px 26px;border-radius:8px;">${escapeHtml(t.button)}</a>
    <p style="margin:12px 0 0;font-size:13px;color:#6b7280;">${escapeHtml(t.takes)}</p>

    <!-- The escape hatch. An unhappy customer handed only a "leave a review"
         button leaves the review anyway, in public. Giving them a reply-to
         first is better for the contractor AND more honest than funnelling
         everyone at the star rating. -->
    <p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e5e7eb;font-size:13px;line-height:1.5;color:#6b7280;">${escapeHtml(t.problem(companyName))}</p>
    ${unsubscribeToken ? unsubscribeFooterHtml({ token: unsubscribeToken, request, companyName }) : ""}
  </div>
</div>`.trim();

  return { subject: t.subject(companyName), html };
}
