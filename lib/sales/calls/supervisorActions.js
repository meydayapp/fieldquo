// lib/sales/calls/supervisorActions.js
//
// The three things a supervisor may do to a rep's state from the floor
// board, as data — the route validates against it and the board draws its
// buttons from it, so a fourth button cannot appear without a fourth
// handler. app/api/platform/sales/floor/rep-state/route.js has the model.
export const SUPERVISOR_ACTIONS = Object.freeze(["pause", "available", "sign_out"]);

/** The board's words for each, English (the platform console's language). */
export const SUPERVISOR_ACTION_LABELS = Object.freeze({
  pause: "Pause (supervision)",
  available: "Make available",
  sign_out: "Sign out",
});
