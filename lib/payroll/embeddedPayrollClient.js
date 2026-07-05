// lib/payroll/embeddedPayrollClient.js
//
// IMPORTANT: this is scaffolding, not a working integration. It defines the interface
// your app needs against a generic embedded-payroll provider (Check and Gusto Embedded
// are the two real options — their actual SDKs/field names differ from what's below).
// Do not deploy this as-is; swap the internals for whichever provider's real SDK once
// you've picked one and gotten API credentials. The function signatures are what the
// rest of the app (app/api/payouts, app/(app)/team/payroll) should be able to rely on
// regardless of which provider ends up underneath.

const PAYROLL_API_BASE = process.env.PAYROLL_PROVIDER_API_BASE; // e.g. Check's or Gusto's API base URL
const PAYROLL_API_KEY = process.env.PAYROLL_PROVIDER_API_KEY;

async function payrollRequest(path, options = {}) {
  if (!PAYROLL_API_BASE || !PAYROLL_API_KEY) {
    throw new Error(
      "No embedded payroll provider configured. Set PAYROLL_PROVIDER_API_BASE and PAYROLL_PROVIDER_API_KEY once you've chosen Check, Gusto Embedded, or similar.",
    );
  }

  const res = await fetch(`${PAYROLL_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PAYROLL_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Payroll provider error (${res.status}): ${body}`);
  }

  return res.json();
}

// Onboards a company as an employer with the payroll provider (tax IDs, bank account,
// state registrations — the provider walks the company through this, usually via a
// hosted onboarding link similar to Stripe Connect's).
export async function createEmployerOnboardingLink({ companyId, returnUrl }) {
  return payrollRequest("/employers/onboarding-link", {
    method: "POST",
    body: JSON.stringify({ external_id: companyId, return_url: returnUrl }),
  });
}

// Adds a W-2 employee to the provider so tax withholding/filing is handled on their behalf.
export async function createPayrollEmployee({ companyId, worker }) {
  return payrollRequest("/employees", {
    method: "POST",
    body: JSON.stringify({
      employer_external_id: companyId,
      external_id: worker.id,
      name: worker.name,
      email: worker.email,
    }),
  });
}

// Runs an actual payroll — the provider computes withholding, submits filings, and pays
// the employee. This is fundamentally different from a Stripe transfer: it's a compliance
// event, not just a money movement, so it can take days to process and can fail/be rejected
// by the provider for reasons unrelated to your app.
export async function runEmployeePayroll({
  companyId,
  periodStart,
  periodEnd,
  hoursByEmployee,
}) {
  return payrollRequest("/payroll-runs", {
    method: "POST",
    body: JSON.stringify({
      employer_external_id: companyId,
      period_start: periodStart,
      period_end: periodEnd,
      items: hoursByEmployee.map((h) => ({
        employee_external_id: h.workerId,
        hours: h.hours,
      })),
    }),
  });
}

export async function getPayrollRunStatus({ payrollRunId }) {
  return payrollRequest(`/payroll-runs/${payrollRunId}`);
}
