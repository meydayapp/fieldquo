// app/components/sales/consoleSlots.js
//
// Where the queue console lets other components draw.
//
// ══ Why a slot and not a prop ═════════════════════════════════════════════
//
// Two things are owned above the console and must be seen inside it:
//
//   * an ANSWERED inbound call. IncomingCallDock is mounted in the shell so a
//     contractor ringing back reaches the rep on every screen; the owner
//     wants the picked-up call to appear in the Dialer card's live-call
//     state, where the outbound call would be. The call's state machine —
//     the Twilio Call object, the answered attempt id, the transfer — stays
//     in the dock. Only its CONTROLS are drawn in the card, through a portal
//     into a node the card registers here. Moving the state would mean two
//     owners for one call, or a dock that unmounts on navigation and drops
//     it.
//
// The card registers a DOM node while it is mounted; the dock draws into it
// when there is one and into its own drawer when there is not (the rep is on
// another screen). Nothing is duplicated: one renderer, two targets.
"use client";

import { createContext, useContext, useMemo, useState } from "react";

const Ctx = createContext(null);

export function ConsoleSlotsProvider({ children }) {
  const [liveCallNode, setLiveCallNode] = useState(null);
  const value = useMemo(() => ({ liveCallNode, setLiveCallNode }), [liveCallNode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Null outside the provider — every reader treats that as "no slot". */
export function useConsoleSlots() {
  return useContext(Ctx);
}
