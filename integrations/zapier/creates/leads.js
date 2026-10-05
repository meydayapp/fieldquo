// integrations/zapier/creates/leads.js
//
// The three actions. All three need a key the company created with "Also
// let this agency add and update leads" ticked (marketing:write_leads);
// without it FieldQuo answers 403 and the Zap says why.
//
//   Create Lead               POST /marketing/leads — from the agency's own
//                             funnel; deduplicated by email/phone in FieldQuo
//   Move Lead to Stage        POST /marketing/leads/{ref}/stage — only the
//                             pipeline's own transitions
//   Update Appointment Request POST /marketing/leads/{ref}/requested-visit —
//                             the window asked for; never a booked visit,
//                             its time or its crew
//
// There is no action that texts, emails or messages a client, on purpose.

const { call, leadOutputFields } = require("../lib");

const LOST_REASONS = ["lost_to_competitor", "price_too_high", "timing_not_right", "not_real_inquiry", "no_response", "other"];

const createLead = {
  key: "create_lead",
  noun: "Lead",
  display: {
    label: "Create Lead",
    description: "Adds a lead from your own funnel to the company's FieldQuo leads (deduplicated by email and phone).",
  },
  operation: {
    inputFields: [
      { key: "firstName", label: "First name", required: true },
      { key: "lastName", label: "Last name" },
      { key: "email", label: "Email", helpText: "An email or a phone is required." },
      { key: "phone", label: "Phone" },
      { key: "service", label: "Service requested" },
      { key: "message", label: "Message", type: "text" },
      { key: "postalCode", label: "Postal / ZIP code" },
      { key: "address", label: "Address" },
      { key: "requestedVisitFrom", label: "Requested visit from", type: "datetime" },
      { key: "requestedVisitTo", label: "Requested visit to", type: "datetime" },
      { key: "campaignId", label: "Campaign ID" },
      { key: "campaignName", label: "Campaign name" },
      { key: "adsetId", label: "Ad set ID" },
      { key: "adsetName", label: "Ad set name" },
      { key: "adId", label: "Ad ID" },
      { key: "adName", label: "Ad name" },
      { key: "fbclid", label: "fbclid" },
      { key: "gclid", label: "gclid" },
      { key: "utmSource", label: "UTM source" },
      { key: "utmMedium", label: "UTM medium" },
      { key: "utmCampaign", label: "UTM campaign" },
      { key: "utmContent", label: "UTM content" },
      { key: "utmTerm", label: "UTM term" },
    ],
    perform: async (z, bundle) => {
      const body = { ...bundle.inputData };
      for (const k of Object.keys(body)) if (body[k] === "" || body[k] === undefined) delete body[k];
      const res = await call(z, { method: "POST", path: "/marketing/leads", body });
      return { created: res.created, duplicate: res.duplicate, existingClient: Boolean(res.existingClient), ...(res.lead || {}) };
    },
    sample: { created: true, duplicate: false, existingClient: false, ref: "lr_0000000000007F3A", displayRef: "L-7F3A", firstName: "Ana", channel: "agency_funnel" },
    outputFields: [
      { key: "created", label: "Created", type: "boolean" },
      { key: "duplicate", label: "Duplicate of an existing lead", type: "boolean" },
      { key: "existingClient", label: "Already a client", type: "boolean" },
      ...leadOutputFields(),
    ],
  },
};

const moveLeadStage = {
  key: "move_lead_stage",
  noun: "Lead",
  display: {
    label: "Move Lead to Stage",
    description: "Moves a lead on the company's pipeline, by the same rules as their board (Won needs an accepted quote; Lost needs a reason).",
  },
  operation: {
    inputFields: [
      { key: "ref", label: "Lead reference", required: true, helpText: "The full reference (lr_…), e.g. from a trigger or Find Lead." },
      { key: "stage", label: "Stage", required: true, choices: { new: "New", contacted: "Contacted", won: "Won", lost: "Lost" } },
      { key: "lostReason", label: "Lost reason", choices: Object.fromEntries(LOST_REASONS.map((r) => [r, r.replace(/_/g, " ")])), helpText: "Required when the stage is Lost." },
    ],
    perform: async (z, bundle) => {
      const { ref, stage, lostReason } = bundle.inputData;
      const res = await call(z, { method: "POST", path: `/marketing/leads/${encodeURIComponent(ref)}/stage`, body: { stage, ...(lostReason ? { lostReason } : {}) } });
      return res.lead;
    },
    sample: { ref: "lr_0000000000007F3A", displayRef: "L-7F3A", pipelineStatus: "contacted", stage: "qualified" },
    outputFields: leadOutputFields(),
  },
};

const updateAppointmentRequest = {
  key: "update_appointment_request",
  noun: "Appointment request",
  display: {
    label: "Update Appointment Request",
    description: "Sets the time window a lead asked their visit to fall in. It never changes a booked visit, its time or its crew.",
  },
  operation: {
    inputFields: [
      { key: "ref", label: "Lead reference", required: true },
      { key: "from", label: "Window starts", type: "datetime", required: true },
      { key: "to", label: "Window ends", type: "datetime", required: true },
    ],
    perform: async (z, bundle) => {
      const { ref, from, to } = bundle.inputData;
      const res = await call(z, { method: "POST", path: `/marketing/leads/${encodeURIComponent(ref)}/requested-visit`, body: { from, to } });
      return res.lead;
    },
    sample: { ref: "lr_0000000000007F3A", displayRef: "L-7F3A", requestedVisitFrom: "2026-10-08T13:00:00.000Z", requestedVisitTo: "2026-10-08T16:00:00.000Z" },
    outputFields: leadOutputFields(),
  },
};

module.exports = { creates: [createLead, moveLeadStage, updateAppointmentRequest] };
