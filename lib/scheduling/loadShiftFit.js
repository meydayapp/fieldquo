// lib/scheduling/loadShiftFit.js
//
// The database half of lib/scheduling/shiftFit.js: load what a worker has
// declared, then run the pure check over it.
//
// Split from the engine on purpose — the engine has to stay pure so it can be
// executed against a fixed instant in a check script, and both the create and
// the edit route need this same loader. One copy, because the second copy of a
// query like this is the one that forgets to filter on `approved`.
import { db } from "@/lib/db";
import { shiftFit } from "@/lib/scheduling/shiftFit";

export async function assessShiftFit(worker, start, end, companyId) {
  // Availability and working hours hang off the USER. A worker with no login
  // has neither, and that is "nothing declared" — not "unavailable". Inferring
  // a refusal from an empty table would make every new hire unschedulable on
  // their first day.
  if (!worker?.userId) return shiftFit({ start, end });

  const [availability, workingHours, leave] = await Promise.all([
    db.availabilitySchedule.findMany({
      where: { userId: worker.userId },
      select: {
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        timezone: true,
      },
    }),
    db.workingHours.findMany({
      where: { userId: worker.userId, companyId },
      select: {
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        timezone: true,
      },
    }),
    // APPROVED only. A request nobody has answered yet must not silently block
    // the rota — the manager looking at it may be the person about to approve
    // it, and a refusal they cannot explain is worse than no check.
    db.leaveRequest.findMany({
      where: {
        workerId: worker.id,
        status: "approved",
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { status: true, startDate: true, endDate: true, halfDay: true },
    }),
  ]);

  return shiftFit({ start, end, availability, workingHours, leave });
}
