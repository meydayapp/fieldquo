// integrations/zapier/searches/leads.js
//
//   Find Lead by Reference         GET /marketing/leads/{ref}  (any key)
//   Find Lead by Email or Phone    GET /marketing/leads/search (keys with
//                                  marketing:write_leads) — matched on the
//                                  full identifier; the answer is the same
//                                  privacy-safe row as everywhere else.

const { call, leadOutputFields } = require("../lib");

const findByRef = {
  key: "find_lead_by_ref",
  noun: "Lead",
  display: { label: "Find Lead by Reference", description: "Finds a lead by its FieldQuo reference (lr_… or L-XXXX)." },
  operation: {
    inputFields: [{ key: "ref", label: "Lead reference", required: true }],
    perform: async (z, bundle) => {
      try {
        const res = await call(z, { path: `/marketing/leads/${encodeURIComponent(bundle.inputData.ref.trim())}` });
        return res.lead ? [res.lead] : [];
      } catch (err) {
        // Not found is an empty search, not a failed step.
        if (err && (err.status === 404 || /not_found/.test(String(err.name || "") + String(err.message || "")))) return [];
        throw err;
      }
    },
    sample: { ref: "lr_0000000000007F3A", displayRef: "L-7F3A", firstName: "Ana", stage: "won" },
    outputFields: leadOutputFields(),
  },
};

const findByContact = {
  key: "find_lead_by_contact",
  noun: "Lead",
  display: { label: "Find Lead by Email or Phone", description: "Finds the company's leads with exactly this email or phone." },
  operation: {
    inputFields: [
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
    ],
    perform: async (z, bundle) => {
      const params = {};
      if (bundle.inputData.email) params.email = bundle.inputData.email;
      if (bundle.inputData.phone) params.phone = bundle.inputData.phone;
      const res = await call(z, { path: "/marketing/leads/search", params });
      return res.leads || [];
    },
    sample: { ref: "lr_0000000000007F3A", displayRef: "L-7F3A", firstName: "Ana", stage: "qualified" },
    outputFields: leadOutputFields(),
  },
};

module.exports = { searches: [findByRef, findByContact] };
