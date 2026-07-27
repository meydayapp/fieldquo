// lib/email/resendDomains.js
//
// Thin wrapper around Resend's Domains API, used to let each company send
// from its OWN domain rather than FieldQuo's shared one.
//
// Why this exists: Resend will only send from a domain that has been verified
// on the account. A company can't just type "quotes@theircompany.com" and
// have it work — the domain has to be registered with Resend and proved via
// DNS records. This module registers it and reports verification state; the
// company adds the records at their DNS host.
//
// IMPORTANT — Resend has no concept of tenants. Every domain registered here
// lands in ONE flat list on FieldQuo's Resend account, and webhooks,
// suppression lists and analytics are all account-scoped. That means:
//   * we store the returned domain id on the Company row, because there's no
//     other way to know which domain belongs to which tenant
//   * one tenant's sending behaviour can affect account-level reputation
// Worth revisiting if this grows past a few hundred domains.

const API = "https://api.resend.com";

function apiKey() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY isn't set — email domains can't be managed until it is.",
    );
  }
  return key;
}

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  // Resend returns JSON on both success and error, but be defensive: a 5xx
  // from a proxy can come back as HTML and JSON.parse would throw, masking
  // the real status code.
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      data?.message || data?.error?.message || `Resend returned ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Register a sending domain. Returns the domain id plus the DNS records the
 * company must add (DKIM, SPF, and optionally DMARC).
 *
 * Sending from a SUBDOMAIN (send.example.com) rather than the root is
 * strongly preferred: it isolates the reputation of transactional mail from
 * whatever else the company does with its root domain, and avoids clashing
 * with existing SPF/DKIM records for their normal mailbox provider.
 */
export async function createDomain(name, { region = "us-east-1" } = {}) {
  const data = await call("/domains", {
    method: "POST",
    body: { name, region },
  });
  return {
    id: data.id,
    name: data.name,
    status: data.status,
    records: data.records || [],
  };
}

export async function getDomain(id) {
  const data = await call(`/domains/${id}`);
  return {
    id: data.id,
    name: data.name,
    status: data.status,
    records: data.records || [],
  };
}

// Asks Resend to re-check DNS. Verification isn't instant — DNS propagation
// can take anywhere from a minute to a day — so the UI polls rather than
// treating a single "pending" as failure.
export async function verifyDomain(id) {
  await call(`/domains/${id}/verify`, { method: "POST" });
  return getDomain(id);
}

export async function deleteDomain(id) {
  await call(`/domains/${id}`, { method: "DELETE" });
  return { ok: true };
}

// Resend's own status strings, normalised to the four we store. Anything
// unrecognised is treated as pending rather than failed, so a new status
// string from Resend doesn't strand a company on a red error screen.
export function normalizeStatus(status) {
  if (status === "verified") return "verified";
  if (status === "failed" || status === "failure") return "failed";
  if (!status || status === "not_started") return "not_started";
  return "pending";
}

// Rejects obvious nonsense before spending an API call. Deliberately loose —
// real validation is Resend's job, and DNS naming has more edge cases than
// a regex should try to encode.
export function isPlausibleDomain(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v || v.length > 253) return false;
  if (v.includes(" ") || v.includes("@") || v.includes("/")) return false;
  return /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v);
}
