// integrations/zapier/lib.js
//
// Shared pieces of the FieldQuo Marketing Zapier app: the API base, the
// lead fields a Zap can map (the API's lead row — lib/agency/leadRow.js in
// the main repo; keep the two in step, test/definition.test.js checks this
// file's list against the OpenAPI file when it is reachable), and a request
// helper that turns FieldQuo's { error, code } refusals into Zapier errors.

const API_BASE = (process.env.FIELDQUO_API_BASE || "https://app.fieldquo.com/api/v1").replace(/\/+$/, "");

// Every field a lead row carries. Contact fields and money fields are always
// present and null unless the company shares them.
const LEAD_FIELDS = [
  ["ref", "Lead reference"],
  ["displayRef", "Lead reference (short)"],
  ["firstName", "First name"],
  ["firstContactAt", "First contact at"],
  ["leadCreatedAt", "Lead created at"],
  ["channel", "Channel"],
  ["campaignId", "Campaign ID"],
  ["campaignName", "Campaign name"],
  ["adsetId", "Ad set ID"],
  ["adsetName", "Ad set name"],
  ["adId", "Ad ID"],
  ["adName", "Ad name"],
  ["fbclid", "fbclid"],
  ["gclid", "gclid"],
  ["utmSource", "UTM source"],
  ["utmMedium", "UTM medium"],
  ["utmCampaign", "UTM campaign"],
  ["utmContent", "UTM content"],
  ["utmTerm", "UTM term"],
  ["adRepliedAt", "Replied to ad at"],
  ["tier", "Tier"],
  ["temperature", "Temperature"],
  ["qualified", "Qualified"],
  ["qualifiedAt", "Qualified at"],
  ["firstResponseAt", "First response at"],
  ["speedToLeadMinutes", "Speed to lead (minutes)"],
  ["stage", "Stage"],
  ["pipelineStatus", "Pipeline status"],
  ["appointmentBookedAt", "Appointment booked at"],
  ["appointmentAt", "Appointment at"],
  ["appointmentOutcome", "Appointment outcome"],
  ["appointmentType", "Appointment type"],
  ["requestedVisitFrom", "Requested visit from"],
  ["requestedVisitTo", "Requested visit to"],
  ["quoteCreatedAt", "Quote created at"],
  ["quoteSentAt", "Quote sent at"],
  ["quoteViewedAt", "Quote viewed at"],
  ["quoteDeclinedAt", "Quote declined at"],
  ["quoteDeclineReason", "Quote decline reason"],
  ["wonAt", "Won at"],
  ["closedWithoutVisit", "Closed without a visit"],
  ["invoicedAt", "Invoiced at"],
  ["paidAt", "Paid at"],
  ["jobCompletedAt", "Job completed at"],
  ["moneyShared", "Job values shared"],
  ["currency", "Currency"],
  ["quoteAmount", "Quote amount"],
  ["wonAmount", "Won amount"],
  ["invoicedAmount", "Invoiced amount"],
  ["collectedAmount", "Collected amount"],
  ["serviceRequested", "Service requested"],
  ["serviceSold", "Service sold"],
  ["postalCode", "Postal code"],
  ["postalCountry", "Postal country"],
  ["lostReason", "Lost reason"],
  ["contactsShared", "Contact details shared"],
  ["fullName", "Full name (only when shared)"],
  ["phone", "Phone (only when shared)"],
  ["email", "Email (only when shared)"],
  ["updatedAt", "Updated at"],
];

const leadOutputFields = (prefix = "") => LEAD_FIELDS.map(([key, label]) => ({ key: `${prefix}${key}`, label }));

/** A JSON request against the API; a refusal becomes a Zapier error with FieldQuo's sentence. */
async function call(z, { method = "GET", path, params, body }) {
  const response = await z.request({
    method,
    url: `${API_BASE}${path}`,
    params,
    body,
    skipThrowForStatus: true,
  });
  if (response.status >= 400) {
    let data = {};
    try {
      data = typeof response.data === "object" && response.data ? response.data : JSON.parse(response.content || "{}");
    } catch {
      data = {};
    }
    const message = data.error || `FieldQuo answered ${response.status}.`;
    if (response.status === 401) throw new z.errors.RefreshAuthError(message);
    if (response.status === 429) throw new z.errors.ThrottledError(message, Number(data.retryAfter) || 60);
    throw new z.errors.Error(message, data.code || `http_${response.status}`, response.status);
  }
  return response.data;
}

module.exports = { API_BASE, LEAD_FIELDS, leadOutputFields, call };
