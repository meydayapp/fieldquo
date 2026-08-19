// lib/overhead/salaryInput.js
//
// Validation for an overhead salary row, shared by POST /api/salaries and
// PATCH /api/salaries/[id]. The frequency list is exported so the Overhead
// screen renders exactly the options the server will accept — a select offering
// a fifth choice the API rejects is the same broken control as a dead button.
//
// ── Why `hourly` exists here and what it is NOT ─────────────────────────────
//
// These rows are BUSINESS OVERHEAD with no worker attached: the owner's draw,
// a part-time office wage. An employee's hourly rate lives on Worker.hourlyRate
// and is already a DIRECT cost — app/app/quotes/new/page.js feeds the selected
// worker's rate into estimateQuoteCost() as the labour rate, and buildPayRun
// pays them from it. Copying crew rates in here would charge the same wage
// twice on every quote: once as labour, once as overhead.
//
// What was genuinely missing is that plenty of overhead IS hourly — the admin
// who does the books eight hours a week. That needs a rate AND the hours; the
// rate alone cannot become a monthly cost.

export const SALARY_FREQUENCIES = ["hourly", "weekly", "monthly", "yearly"];

/**
 * @returns {{error: string} | {name, amount, frequency, hoursPerWeek}}
 *   hoursPerWeek is null for every frequency except hourly, so switching a row
 *   away from hourly can't leave a stale hours figure behind it.
 */
export function validateSalary({ name, amount, frequency, hoursPerWeek }) {
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (!cleanName) return { error: "Give this cost a name." };

  const cleanAmount = Number(amount);
  // `> 0`, not truthy. A zero salary changes nothing, and a negative one would
  // silently reduce the company's monthly burn — and with it the minimum price
  // every quote is checked against.
  if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
    return { error: "Enter an amount greater than zero." };
  }

  const cleanFrequency = frequency || "monthly";
  if (!SALARY_FREQUENCIES.includes(cleanFrequency)) {
    return { error: `Frequency must be one of: ${SALARY_FREQUENCIES.join(", ")}.` };
  }

  let cleanHours = null;
  if (cleanFrequency === "hourly") {
    cleanHours = Number(hoursPerWeek);
    // Required, with no default. Assuming a 40-hour week here would put an
    // invented number straight into the price floor — the same mistake as the
    // three-jobs-a-week capacity default that lib/analytics/minimumPrice.js was
    // rewritten to remove.
    if (!Number.isFinite(cleanHours) || cleanHours <= 0) {
      return {
        error:
          "An hourly cost needs hours a week too — a rate on its own can't be turned into a monthly figure.",
      };
    }
    if (cleanHours > 168) {
      return { error: "There are only 168 hours in a week." };
    }
  }

  return {
    name: cleanName,
    amount: cleanAmount,
    frequency: cleanFrequency,
    hoursPerWeek: cleanHours,
  };
}
