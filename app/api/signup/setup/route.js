// app/api/signup/setup/route.js
//
// POST — seed a company the signup page has just created, streaming one line
// of JSON per stage as it actually starts and finishes. The signup progress
// screen (app/components/auth/SignupCreating.js) draws its bar from these
// events and from nothing else; see lib/signup/setupStages.js for the stages,
// why they left /api/companies, and why every one is safe to run twice.
//
// The body is empty on purpose. Which company comes from the session's owner
// membership, and which trades from the company's own CompanyServiceCategory
// rows — never from the browser, so a hand-rolled request can at most re-run
// the seeding a fresh company was always going to get.
//
// Events (application/x-ndjson, one object per line):
//   { type: "plan", stages: [{ key, kind, categoryId?, label? }] }
//   { type: "stage", key, status: "active" | "done" | "failed" }
//   { type: "complete", failed: [stageKey] }
//   { type: "busy" }        another run for this company holds the lock
//   { type: "error", error } the run itself could not start or crashed
//
// A refusal before the stream starts (no session, not the owner, a company
// older than SETUP_WINDOW_MS) is an ordinary JSON error with its status.
export const runtime = "nodejs";
// The longest signup measured is a few seconds of seeding; the lock
// transaction below gives up at 55s, inside this.
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { recordError } from "@/lib/platform/errorLog";
import {
  planSetupStages,
  publicStage,
  runSetupStage,
  setupStagesAllowed,
  withSetupLock,
} from "@/lib/signup/setupStages";

export async function POST(request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The owner membership this login just created. One business per login
  // (app/api/companies/route.js), so there is at most one; newest first in
  // case an older data state holds two.
  const member = await db.member.findFirst({
    where: { userId: session.user.id, role: "owner" },
    orderBy: { createdAt: "desc" },
    select: { companyId: true, role: true, company: { select: { id: true, createdAt: true } } },
  });
  const gate = setupStagesAllowed({ member, now: new Date() });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error, code: gate.code }, { status: gate.status });
  }
  const companyId = member.companyId;

  const enabled = await db.companyServiceCategory.findMany({
    where: { companyId, enabled: true },
    orderBy: { createdAt: "asc" },
    select: { category: { select: { id: true, key: true, label: true } } },
  });
  const stages = planSetupStages(enabled.map((row) => row.category));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // A browser that went away mid-run closes the stream; the seeding
      // carries on regardless (the next Retry, or nothing, picks up), so a
      // write to a closed stream is ignored rather than allowed to abort it.
      const send = (event) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // closed
        }
      };
      try {
        const run = await withSetupLock(db, companyId, async () => {
          send({ type: "plan", stages: stages.map(publicStage) });
          const failed = [];
          for (const stage of stages) {
            send({ type: "stage", key: stage.key, status: "active" });
            const result = await runSetupStage(stage, { companyId, client: db });
            if (result.ok) {
              send({ type: "stage", key: stage.key, status: "done" });
            } else {
              failed.push(stage.key);
              // On /platform/errors, not only on the owner's screen: a seed
              // file that fails for everyone is ours to fix.
              await recordError({
                area: "signup",
                code: "setup_stage_failed",
                message: `Signup seeding stage ${stage.key} failed: ${result.error}`,
                companyId,
                detail: { stage: stage.key },
              }).catch(() => {});
              send({ type: "stage", key: stage.key, status: "failed" });
            }
          }
          send({ type: "complete", failed });
        });
        if (!run.acquired) send({ type: "busy" });
      } catch (err) {
        await recordError({
          area: "signup",
          code: "setup_run_failed",
          message: `Signup seeding could not run: ${err?.message || err}`,
          companyId,
        }).catch(() => {});
        send({ type: "error", error: "We couldn't finish setting up your business." });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Proxies that buffer would turn a progress stream back into one late
      // answer — the thing this route exists to replace.
      "X-Accel-Buffering": "no",
    },
  });
}
