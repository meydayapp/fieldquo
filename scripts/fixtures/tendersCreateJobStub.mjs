// scripts/fixtures/tendersCreateJobStub.mjs
//
// lib/jobs/createJob, recorded: the tender route's job is to call it once,
// with the tender's own client and quote, inside the tender lock. The real
// function's own checks cover what it does after that. It still refuses a
// client that is not the caller's — the one rule a recorder must not drop,
// or a route passing a foreign client would look fine here.
export const calls = [];

export async function createJob(db, args) {
  calls.push(args);
  const client = await db.client.findFirst({ where: { id: args.clientId, companyId: args.companyId } });
  if (!client) return { job: null, error: "A linked record wasn't found for your company.", status: 400 };
  const job = await db.job.create({
    data: { companyId: args.companyId, clientId: args.clientId, quoteId: args.quoteId || null, title: args.title, status: "unscheduled" },
  });
  return { job, error: null, status: 201 };
}
