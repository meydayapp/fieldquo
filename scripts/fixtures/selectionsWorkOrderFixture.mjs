// scripts/fixtures/selectionsWorkOrderFixture.mjs
//
// A cabinet job's work order inputs, exactly as the builder saves the group
// (finish in the base line's meta, coats in the intake). Deterministic — no
// clock, no randomness — so scripts/check-job-selections.mjs can hash the
// model and the print sheet against the values recorded on origin/main
// db116dcc5, BEFORE colours and materials existed.
export function cabinetWorkOrderArgs() {
  return {
    job: {
      id: "jc", title: "Côté kitchen", status: "scheduled", workOrderHidden: [],
      startDate: new Date("2026-10-12T00:00:00Z"), endDate: null, siteAddress: "12 rue Main, Gatineau",
      checklistItems: [{ label: "Bag the hardware", required: true, phase: "before", done: false }],
      quote: {
        quoteNumber: "Q-2026-0022", language: "en",
        scopeGroups: [{
          id: "gc", label: "Cabinet Refinishing", categoryId: "catc", takeoff: null,
          category: { key: "cabinet_refinishing", label: "Cabinet Refinishing" },
          intakeValues: { doorCount: 32, drawerCount: 4, primerCoats: 1, topCoats: 2 },
          lineItems: [
            { description: "Cabinet Refinishing", quantity: 36, unit: "unit", rate: 109, amount: 3924, meta: { baseUnitPrice: 100, color: "Hale Navy", sheen: "satin", doorStyle: "Shaker" } },
            { description: "Soft-close hinges", quantity: 64, unit: "hinges", rate: 6, amount: 384 },
          ],
        }],
      },
    },
    client: { name: "Maureen", address: "12 rue Main, Gatineau", phone: null, email: null },
    includedByGroup: new Map([["gc", ["Degrease and scuff-sand every door"]]]),
    addOns: [{ description: "Two-Tone Finish", detail: "Uppers white", areaLabel: "Kitchen" }],
    materials: [{ name: "Cabinet enamel", qty: 3, unit: "gal", group: "Paint", purchasedAt: null }],
    visits: [{ id: "v1", scheduledAt: new Date("2026-10-12T12:00:00Z"), status: "scheduled", notes: "Side door", assignedTo: { name: "Joe" } }],
    crew: ["Joe"],
  };
}
