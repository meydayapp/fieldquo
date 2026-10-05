// integrations/zapier/triggers/events.js
//
// One REST-hook trigger per FieldQuo event (lib/agency/events.js EVENTS in
// the main repo). Subscribe → POST /hooks/subscribe; unsubscribe → DELETE
// /hooks/{id}; the test sample → GET /hooks/samples/{event} (real recent
// payloads, built exactly as a delivery is). FieldQuo stops for good on a
// 410, which is what Zapier answers once a Zap is turned off.
//
// Deliberately absent: any trigger, action or search that sends a message to
// a client. An agency must not be able to speak to the company's customers.

const { call, leadOutputFields } = require("../lib");

// [event, key, noun, label, description]
const EVENTS = [
  ["lead.created", "lead_created", "Lead", "New Lead", "Triggers when a new lead arrives (any channel)."],
  ["lead.qualified", "lead_qualified", "Lead", "Lead Qualified", "Triggers when a lead becomes qualified — warm or hot, or proven by a booked visit, a quote or a close."],
  ["lead.stage_changed", "lead_stage_changed", "Lead", "Lead Stage Changed", "Triggers when a lead moves on the company's pipeline (fromStage → toStage)."],
  ["appointment.booked", "appointment_booked", "Appointment", "Appointment Booked", "Triggers when a lead books an in-person appointment."],
  ["estimate.scheduled", "estimate_scheduled", "Estimate", "Estimate Scheduled", "Triggers when an on-site estimate visit is booked."],
  ["appointment.outcome", "appointment_outcome", "Appointment", "Appointment Outcome", "Triggers when an appointment is marked held or cancelled."],
  ["quote.sent", "quote_sent", "Quote", "Quote Sent", "Triggers when a lead is sent a quote."],
  ["quote.viewed", "quote_viewed", "Quote", "Quote Viewed", "Triggers when a lead opens the quote."],
  ["quote.declined", "quote_declined", "Quote", "Quote Declined", "Triggers when a lead declines the quote (with the reason when recorded)."],
  ["quote.accepted", "quote_accepted", "Client", "New Client (Quote Accepted)", "Triggers when a lead accepts the quote and becomes a client."],
  ["job.completed", "job_completed", "Job", "Job Completed", "Triggers when the job a lead bought is marked complete."],
  ["invoice.paid", "invoice_paid", "Invoice", "Invoice Paid", "Triggers when an invoice for a lead's job is paid in full."],
  ["payment.received", "payment_received", "Payment", "Payment Received", "Triggers when a payment is recorded (amount only when the company shares job values)."],
];

const DATA_FIELDS = [
  { key: "data__fromStage", label: "From stage" },
  { key: "data__toStage", label: "To stage" },
  { key: "data__outcome", label: "Appointment outcome" },
  { key: "data__appointmentAt", label: "Appointment at" },
  { key: "data__appointmentType", label: "Appointment type" },
  { key: "data__mode", label: "Appointment mode" },
  { key: "data__quoteAmount", label: "Quote amount" },
  { key: "data__wonAmount", label: "Won amount" },
  { key: "data__amount", label: "Payment amount" },
  { key: "data__temperature", label: "Temperature" },
];

function makeTrigger([event, key, noun, label, description]) {
  return {
    key,
    noun,
    display: { label, description },
    operation: {
      type: "hook",
      performSubscribe: async (z, bundle) =>
        call(z, { method: "POST", path: "/hooks/subscribe", body: { event, targetUrl: bundle.targetUrl } }),
      performUnsubscribe: async (z, bundle) =>
        call(z, { method: "DELETE", path: `/hooks/${encodeURIComponent(bundle.subscribeData.id)}` }),
      // FieldQuo POSTs one event per request: { id, event, occurredAt, data, lead }.
      perform: async (z, bundle) => [bundle.cleanedRequest],
      performList: async (z) => call(z, { path: `/hooks/samples/${encodeURIComponent(event)}`, params: { limit: 3 } }),
      sample: {
        id: "sample",
        event,
        occurredAt: "2026-10-05T15:00:00.000Z",
        data: {},
        lead: { ref: "lr_0000000000007F3A", displayRef: "L-7F3A", firstName: "Ana", channel: "facebook_ad", stage: "qualified", postalCode: "K1A", postalCountry: "CA", contactsShared: false, fullName: null, phone: null, email: null },
      },
      outputFields: [
        { key: "id", label: "Event ID" },
        { key: "event", label: "Event" },
        { key: "occurredAt", label: "Occurred at" },
        ...DATA_FIELDS,
        ...leadOutputFields("lead__"),
      ],
    },
  };
}

module.exports = { EVENTS, triggers: EVENTS.map(makeTrigger) };
