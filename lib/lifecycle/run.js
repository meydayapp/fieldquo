// lib/lifecycle/run.js
//
// The trial sequence for ONE company, end to end: read, plan, record, claim,
// re-read, gate, build, send, stamp. app/api/cron/lifecycle-emails calls it
// per company; scripts/check-lifecycle-emails.mjs calls it with a stub
// database and a stub sender that RECORDS what would have gone out (no real
// email is ever sent by a check).
//
// ══ The order of the side effects ═════════════════════════════════════════
//
//   1. Read the company, its LifecycleEmail rows and the facts, fresh.
//   2. planLifecycle (pure) → milestones to observe, decisions to record, and
//      at most one letter to send.
//   3. Write the observations and the decisions.
//   4. CLAIM the one letter: the (companyId, kind) unique is the lock; a
//      stale claim (RECLAIM_AFTER_MS) is retaken with a guarded updateMany.
//   5. Re-read after the claim — the company, the facts, the other rows. A
//      feature finished in the last minute, a plan chosen, FieldQuo ending
//      the company, another letter claimed or sent today: each turns the
//      claim into a recorded skip or a released claim, never a send. This is
//      lib/migrations/state.js canWrite()'s rule — the gate runs on rows read
//      in the request that acts.
//   6. The person: the first active owner. A reserved test address, the
//      do-not-contact list (read now; a failed read fails CLOSED) and their
//      own email preferences (tips letters only) each stop the letter here.
//   7. Build. A tips letter without FieldQuo's mailing address refuses to
//      build (lib/email/platformLayout.js); that releases the claim and is
//      logged ONCE per run by the caller, so the letter goes when the address
//      is set, inside its window.
//   8. Send — sendEmail never throws; { error } and { skipped } release the
//      claim with failedAt (FAILED_BACKOFF_MS before the next try) — then
//      stamp sentAt with what went: the address, the language, the subject.

import { planLifecycle, featureDone, trialLockAt, RECLAIM_AFTER_MS, kindCategory, localParts, safeTimeZone } from "./plan";
import { loadLifecycleCompany, loadLifecycleFacts, lifecycleRecipient } from "./facts";
import { buildFeatureNudge, buildMilestoneEmail, buildPersonalEmail, buildHelpEmail, buildTrialEndedEmail } from "./emails";
import { pickHelpArticles } from "./helpArticles";
import { storiesFor, personalSenderReady } from "./settings";
import { ensurePreferenceRow, userAllowsCategory } from "@/lib/email/preferencesStore";
import { preferencesUrls } from "@/lib/email/preferences";
import { lifecycleLanguage } from "@/lib/i18n/lifecycleEmailCopy";
import { isReservedTestAddress } from "@/lib/signup/abandoned";
import { nextStepsTradeKey, NEXT_STEPS_WINDOW_HOURS } from "@/lib/signup/nextSteps";
import { articleMeta } from "@/lib/help/tree";

const HOUR = 60 * 60 * 1000;

/** "Name <address>" on the platform's own verified address — the personal note's From. */
export function fromWithName(platformFrom, name) {
  const addr = (String(platformFrom || "").match(/<([^>]+)>/)?.[1] || String(platformFrom || "")).trim();
  const clean = String(name || "").replace(/[<>"\r\n]/g, "").trim();
  return clean && addr ? `${clean} <${addr}>` : platformFrom;
}

/** Until when the next-steps letter can still go out for this company, or null when it never will. */
export function nextStepsPendingUntil(company, nextStepsSettings) {
  if (!nextStepsSettings?.enabled) return null;
  const created = new Date(company.createdAt).getTime();
  return new Date(created + (Number(nextStepsSettings.delayHours) + NEXT_STEPS_WINDOW_HOURS) * HOUR);
}

function planInputs(company, facts, rows, settings, nextStepsSettings, now, sequenceStartsAt) {
  return {
    now,
    company: { ...company, hasSubscription: Boolean(company.subscription) },
    facts,
    rows,
    personalReady: personalSenderReady(settings.personalSender),
    nextStepsPendingUntil: nextStepsPendingUntil(company, nextStepsSettings),
    ...(sequenceStartsAt ? { sequenceStartsAt } : {}),
  };
}

async function recordSkip(client, companyId, kind, skipped) {
  const upd = await client.lifecycleEmail.updateMany({
    where: { companyId, kind, sentAt: null, skipped: null },
    data: { skipped, claimedAt: null },
  });
  if (upd.count > 0) return;
  try {
    await client.lifecycleEmail.create({ data: { companyId, kind, skipped } });
  } catch (err) {
    if (err?.code !== "P2002") throw err;
  }
}

async function claim(client, companyId, kind, now) {
  try {
    await client.lifecycleEmail.create({ data: { companyId, kind, claimedAt: now } });
    return true;
  } catch (err) {
    if (err?.code !== "P2002") throw err;
  }
  const res = await client.lifecycleEmail.updateMany({
    where: {
      companyId,
      kind,
      sentAt: null,
      skipped: null,
      OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - RECLAIM_AFTER_MS) } }],
    },
    data: { claimedAt: now, failedAt: null, error: null },
  });
  return res.count > 0;
}

/**
 * @param deps { client, sendEmail, checkSuppression, mailingAddress, platformFrom,
 *               origin, now, settings, nextStepsSettings, sequenceStartsAt?,
 *               helpArticleText?(lang, slug, category) → { title, summary, english } }
 * @returns { outcome, kind?, reason?, observed: n, recorded: n }
 */
export async function runLifecycleForCompany(companyId, deps) {
  const { client, now, origin, settings, nextStepsSettings } = deps;
  const company = await loadLifecycleCompany(companyId, { client });
  if (!company) return { outcome: "gone" };
  const [rows, facts] = await Promise.all([
    client.lifecycleEmail.findMany({ where: { companyId } }),
    loadLifecycleFacts(company, { origin, client }),
  ]);
  const plan = planLifecycle(planInputs(company, facts, rows, settings, nextStepsSettings, now, deps.sequenceStartsAt));

  for (const o of plan.observe) {
    try {
      await client.lifecycleEmail.create({ data: { companyId, kind: o.kind, observedAt: o.at } });
    } catch (err) {
      if (err?.code !== "P2002") throw err;
    }
  }
  for (const r of plan.record) await recordSkip(client, companyId, r.kind, r.skipped);
  const base = { observed: plan.observe.length, recorded: plan.record.length, dayIndex: plan.dayIndex };
  if (!plan.send) return { ...base, outcome: "nothing", reason: plan.reason };

  const kind = plan.send.kind;
  if (!(await claim(client, companyId, kind, now))) return { ...base, outcome: "claimed_by_another_run", kind };
  const release = (error, failed = true) =>
    client.lifecycleEmail.updateMany({
      where: { companyId, kind, claimedAt: now, sentAt: null },
      data: { claimedAt: null, ...(failed ? { failedAt: now, error: String(error || "").slice(0, 500) } : {}) },
    });
  const skip = async (reason) => {
    await client.lifecycleEmail.updateMany({ where: { companyId, kind, claimedAt: now, sentAt: null }, data: { skipped: reason, claimedAt: null } });
    return { ...base, outcome: "skipped", kind, reason };
  };

  // ── 5. Fresh reads after the claim ────────────────────────────────────────
  const fresh = await loadLifecycleCompany(companyId, { client });
  if (!fresh || fresh.isDemo) return skip("demo_or_gone");
  if (fresh.platformEndsAt) return skip("ended_by_fieldquo");
  const freshFacts = await loadLifecycleFacts(fresh, { origin, client });
  const freshRows = await client.lifecycleEmail.findMany({ where: { companyId } });
  const tz = safeTimeZone(fresh.timezone);
  const today = localParts(now, tz).date;
  const stampedToday = [fresh.nextStepsEmailSentAt, fresh.trialReminder7At, fresh.trialReminder3At, fresh.trialReminder1At]
    .filter(Boolean)
    .some((d) => localParts(d, tz).date === today);
  const otherToday =
    stampedToday ||
    freshRows.some(
      (r) => r.kind !== kind && ((r.sentAt && localParts(r.sentAt, tz).date === today) || (r.claimedAt && !r.sentAt && now - new Date(r.claimedAt) < RECLAIM_AFTER_MS)),
    );
  if (otherToday) {
    await release(null, false);
    return { ...base, outcome: "lost_race", kind };
  }
  if (kind.startsWith("feature_") && featureDone(kind.slice("feature_".length), freshFacts)) return skip("already_done");
  if (kind === "milestone_payments" && fresh.offerFinancing === true) return skip("next_step_done");
  if (kind === "trial_ended" && fresh.subscription) return skip("plan_chosen");
  if (kind === "trial_ended" && (!fresh.trialEndsAt || new Date(fresh.trialEndsAt) > now)) return skip("trial_not_over");
  if (kind === "milestone_booking" && !freshFacts.bookingUrl) return skip("no_booking_link");

  // ── 6. The person ─────────────────────────────────────────────────────────
  const user = await lifecycleRecipient(companyId, { client });
  const to = String(user?.email || "").trim();
  if (!user || !to) return skip("no_recipient");
  if (isReservedTestAddress(to)) return skip("test_address");
  let suppressed;
  try {
    suppressed = Boolean((await deps.checkSuppression(client, { channel: "email", email: to }))?.suppressed);
  } catch (err) {
    await release(`do-not-contact read failed: ${err?.message}`);
    return { ...base, outcome: "suppression_read_failed", kind };
  }
  if (suppressed) return skip("do_not_contact");
  const category = kindCategory(kind);
  if (category !== "transactional" && !(await userAllowsCategory(user.id, category, { client }))) return skip("opted_out");

  // ── 7. Build ──────────────────────────────────────────────────────────────
  const language = lifecycleLanguage(user.language || fresh.defaultLanguage);
  let footer = { mailingAddress: deps.mailingAddress };
  if (category !== "transactional") {
    const pref = await ensurePreferenceRow(user.id, { client });
    const urls = preferencesUrls(origin, pref.token, category);
    footer = { mailingAddress: deps.mailingAddress, unsubscribeUrl: urls.unsubscribe, preferencesUrl: preferencesUrls(origin, pref.token).page, oneClickUrl: urls.oneClick };
  }
  const tradeKey = nextStepsTradeKey(fresh.industries) || nextStepsTradeKey(fresh.signupLead?.trades);
  const firstName = fresh.signupLead?.firstName || String(user.name || "").split(" ")[0] || null;
  let email;
  try {
    if (kind.startsWith("feature_")) {
      email = buildFeatureNudge({ feature: kind.slice(8), language, origin, bookingUrl: freshFacts.bookingUrl, footer });
    } else if (kind.startsWith("milestone_")) {
      const meta = articleMeta("pay-over-time-financing");
      const guideUrl = meta ? `${origin}/help/${language}/${meta.category}/pay-over-time-financing` : null;
      email = buildMilestoneEmail({ milestone: kind.slice(10), language, origin, bookingUrl: freshFacts.bookingUrl, guideUrl, footer });
    } else if (kind === "personal_checkin") {
      if (!personalSenderReady(settings.personalSender)) return skip("sender_not_configured");
      email = buildPersonalEmail({ language, firstName, companyName: fresh.name, sender: settings.personalSender, footer });
    } else if (kind === "help_articles") {
      const open = ["payments", "booking", "quote", "import"].filter((f) => !featureDone(f, freshFacts));
      const picked = pickHelpArticles({ tradeKey, open });
      const articles = [];
      for (const a of picked) {
        const words = deps.helpArticleText ? await deps.helpArticleText(language, a.slug, a.category) : null;
        if (!words?.title) continue;
        articles.push({ ...words, url: `${origin}/help/${language}/${a.category}/${a.slug}` });
      }
      if (articles.length < 2) return skip("no_articles");
      email = buildHelpEmail({ language, origin, articles, stories: storiesFor(settings.stories, tradeKey, 2), footer });
    } else if (kind === "trial_ended") {
      email = buildTrialEndedEmail({
        language,
        companyName: fresh.name,
        trialEndsAt: fresh.trialEndsAt,
        lockAt: trialLockAt(fresh.trialEndsAt, deps.graceDays),
        timeZone: tz,
        origin,
        mailingAddress: deps.mailingAddress,
      });
    } else {
      return skip("unknown_kind");
    }
  } catch (err) {
    await release(`build failed: ${err?.message}`);
    return { ...base, outcome: "build_failed", kind, reason: err?.message };
  }

  // ── 8. Send ───────────────────────────────────────────────────────────────
  const personal = kind === "personal_checkin";
  const result = await deps.sendEmail({
    companyId,
    from: personal ? fromWithName(deps.platformFrom, settings.personalSender.name) : deps.platformFrom,
    to,
    subject: email.subject,
    ...(email.html ? { html: email.html } : {}),
    text: email.text,
    headers: email.headers,
    ...(personal ? { replyTo: settings.personalSender.replyTo } : {}),
  });
  if (result?.error || result?.skipped) {
    await release(result.error || "no_api_key");
    return { ...base, outcome: result.error ? "resend_rejected" : "no_api_key", kind };
  }
  await client.lifecycleEmail.updateMany({
    where: { companyId, kind, claimedAt: now },
    data: { sentAt: now, providerId: result?.id || null, toAddress: to, userId: user.id, language, subject: email.subject, failedAt: null, error: null },
  });
  return { ...base, outcome: "sent", kind };
}
