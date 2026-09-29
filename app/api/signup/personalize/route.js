// app/api/signup/personalize/route.js
//
// The welcome questions' one endpoint (app/welcome/[step], 2026-09-29).
//
//   GET    where the owner is (the next unanswered screen) and every answer
//          already given, so a screen opened days later is filled in.
//   PATCH  { step, answers } — one screen's answer. Validated through
//          lib/signup/welcome.js readWelcomeAnswer, written, and the company's
//          onboardingStep recomputed from the stored answers. Idempotent:
//          the same body twice writes the same row twice.
//          { step: "finish" } — the setup screen's first stage: every
//          question must be answered; answers { setup: "staged" }.
//          { step: "done" }   — "Go to my dashboard anyway" after a setup
//          stage failed: stamps personalizedAt so the gate lets them in.
//
// Owner only, and never a support session: the company's name, country and
// currency are being decided here, and non-negotiable #2 keeps impersonation
// read-only (middleware.js already refuses the PATCH; this is the second
// refusal, like lib/currentMember.js is for every other write). Only while the
// questions are unfinished — afterwards the same fields are edited in Company
// Settings, which has its own rules.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { billingBasis } from "@/lib/signup/funnel";
import { currencyForCountry } from "@/lib/currency";
import { readWebsiteAnswer } from "@/lib/signup/website";
import { recordError } from "@/lib/platform/errorLog";
import {
  nextWelcomeStep,
  readWelcomeAnswer,
  resumeWelcomeStep,
  welcomePath,
  WELCOME_STEPS,
} from "@/lib/signup/welcome";
import { loadWelcomeState, welcomePrefill } from "@/lib/signup/welcomeState";
import { SIGNUP_SOURCE } from "@/lib/signup/leads";

const PROVISIONAL_SLUG = /^fq-[a-z0-9]+$/;

/** Owner of a company on the welcome flow, or the response to send. */
async function welcomeOwner(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  if (member.impersonation) {
    return { response: NextResponse.json({ error: "A support session is read-only.", code: "read_only" }, { status: 403 }) };
  }
  if (member.role !== "owner") {
    return { response: NextResponse.json({ error: "Only the business owner answers these.", code: "not_owner" }, { status: 403 }) };
  }
  return { member };
}

export async function GET(request) {
  const { member, response } = await welcomeOwner(request);
  if (response) return response;
  const state = await loadWelcomeState(db, { companyId: member.companyId, userId: member.userId });
  if (!state) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const language = new URL(request.url).searchParams.get("lang") || state.company.defaultLanguage || "en";
  return NextResponse.json({
    onFlow: Boolean(state.company.onboardingStep),
    personalized: Boolean(state.company.personalizedAt),
    resume: state.resume,
    resumeUrl: state.resume ? welcomePath(state.resume) : "/app",
    ...welcomePrefill(state, language),
  });
}

/** A new slug from the name, once, while the company still has its provisional one. */
function slugFromName(name) {
  const base = String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return `${base || "business"}-${Math.random().toString(36).slice(2, 6)}`;
}

/** An IANA zone the runtime recognises, or null. The browser's own, stated. */
function readTimezone(value) {
  if (typeof value !== "string" || !value || value.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

export async function PATCH(request) {
  const { member, response } = await welcomeOwner(request);
  if (response) return response;
  const body = await request.json().catch(() => null);
  const step = body?.step;
  const answers = body?.answers && typeof body.answers === "object" ? body.answers : {};

  const state = await loadWelcomeState(db, { companyId: member.companyId, userId: member.userId });
  if (!state) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!state.company.onboardingStep) {
    return NextResponse.json({ error: "This business was set up before these questions existed.", code: "not_on_flow" }, { status: 409 });
  }
  if (state.company.personalizedAt) {
    return NextResponse.json(
      { error: "These are answered — change them in Settings.", code: "already_personalized", nextUrl: "/app" },
      { status: 409 },
    );
  }

  // ── The setup screen's own two presses ──────────────────────────────────
  if (step === "finish" || step === "done") {
    if (state.resume !== "setup") {
      return NextResponse.json(
        { error: "A question is still unanswered.", code: "unanswered", step: state.resume, nextUrl: welcomePath(state.resume) },
        { status: 409 },
      );
    }
    if (step === "done") {
      await db.company.update({
        where: { id: member.companyId },
        data: { personalizedAt: new Date(), onboardingStep: "setup" },
      });
      return NextResponse.json({ ok: true, nextUrl: "/app" });
    }
    await db.company.update({ where: { id: member.companyId }, data: { onboardingStep: "setup" } });
    return NextResponse.json({ ok: true, setup: "staged", appUrl: "/app" });
  }

  if (!WELCOME_STEPS.includes(step) || step === "setup") {
    return NextResponse.json({ error: "Unknown step.", code: "step" }, { status: 400 });
  }
  // A question after the one they are on cannot be answered by URL.
  if (WELCOME_STEPS.indexOf(step) > WELCOME_STEPS.indexOf(state.resume)) {
    return NextResponse.json(
      { error: "Answer the earlier question first.", code: "out_of_order", step: state.resume, nextUrl: welcomePath(state.resume) },
      { status: 409 },
    );
  }

  // ── What needs the server before the pure reader can judge it ───────────
  const ctx = { now: new Date(), currentFocus: state.company.signupFocus, priority: state.company.signupPriority };
  if (step === "business") {
    const basis = billingBasis({ country: answers.country, address: answers.address, province: answers.province });
    ctx.country = basis.country;
    ctx.currency = basis.country ? currencyForCountry(basis.country) : null;
    ctx.timezone = readTimezone(answers.timezone);
    const site = String(answers.website || "").trim();
    // Optional: blank is unanswered (null), never a "no".
    ctx.website = site ? readWebsiteAnswer({ hasWebsite: true, website: site }) : { website: null, hasWebsite: null };
  }

  const read = readWelcomeAnswer(step, answers, ctx);
  if (!read.ok) {
    return NextResponse.json({ error: "That answer isn't complete.", code: read.code, field: read.field }, { status: 400 });
  }

  try {
    await db.$transaction(async (tx) => {
      if (read.user) {
        await tx.user.update({ where: { id: member.userId }, data: read.user });
      }
      if (read.company) {
        const data = { ...read.company };
        if (step === "business" && PROVISIONAL_SLUG.test(state.company.slug || "")) {
          data.slug = slugFromName(read.company.name);
        }
        await tx.company.update({ where: { id: member.companyId }, data });
      }
      if (step === "business") {
        // The trade picked is the one switched on. Others this screen switched
        // on earlier (a changed answer) are switched OFF, never deleted — the
        // setup stream seeds only the enabled rows.
        const category = await tx.serviceCategory.findFirst({
          where: { key: read.tradeKey, companyId: null },
          select: { id: true },
        });
        if (!category) throw Object.assign(new Error("trade_missing"), { status: 400 });
        await tx.companyServiceCategory.updateMany({
          where: { companyId: member.companyId, categoryId: { not: category.id }, enabled: true },
          data: { enabled: false },
        });
        await tx.companyServiceCategory.upsert({
          where: { companyId_categoryId: { companyId: member.companyId, categoryId: category.id } },
          create: { companyId: member.companyId, categoryId: category.id, enabled: true },
          update: { enabled: true },
        });
      }
    });
  } catch (err) {
    if (err?.status === 400) {
      return NextResponse.json({ error: "That trade isn't available.", code: "industry", field: "industry" }, { status: 400 });
    }
    // A slug collision on the random suffix is the one expected race; the
    // screen's retry makes a new one.
    await recordError({
      area: "signup",
      code: "welcome_write_failed",
      message: `Welcome answer "${step}" was not saved: ${err?.message || err}`,
      companyId: member.companyId,
    }).catch(() => {});
    return NextResponse.json({ error: "We couldn't save that — try again." }, { status: 500 });
  }

  // The sales floor's welcome-call row was written when the company was
  // created, before it had a name (lib/signup/salesFloor.js). Give it the
  // name now, so a rep does not ring a blank row. Best-effort: FieldQuo's
  // bookkeeping never fails the owner's answer.
  if (step === "business" && read.company?.name) {
    await db.prospect
      .updateMany({ where: { companyId: member.companyId, sourceProvider: SIGNUP_SOURCE }, data: { businessName: read.company.name } })
      .catch(() => {});
  }

  // Where they are now, from the stored answers — never a counter.
  const fresh = await loadWelcomeState(db, { companyId: member.companyId, userId: member.userId });
  const resume = fresh?.resume || resumeWelcomeStep(fresh || {});
  if (resume && resume !== state.company.onboardingStep) {
    await db.company.update({ where: { id: member.companyId }, data: { onboardingStep: resume } });
  }
  const next = nextWelcomeStep(step);
  return NextResponse.json({ ok: true, resume, next, nextUrl: welcomePath(next) });
}
