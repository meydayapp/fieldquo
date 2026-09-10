// app/sales/playbook/page.js
//
// The playbook a rep reads BEFORE the call, and the battlecards they reach for
// during it.
//
// ══ Why this exists beside CallPlaybook ═══════════════════════════════════
//
// app/components/sales/CallPlaybook.js puts one stage at a time in front of a
// rep with a prospect on the line, and it is right to: nine stages at once is
// a wall nobody reads at speed. But it only exists inside a claimed prospect's
// card, which means the objection library, the four scripts and everything we
// know about the five competitors were reachable ONLY while dialling somebody.
// A new rep on their first morning, or the same rep the night before a
// meeting, had nowhere to read any of it.
//
// So this is the reading surface and that one is the working surface. Nothing
// is duplicated: both render the same rows out of lib/sales/playbook.
//
// ══ A server component, and deliberately no API route ═════════════════════
//
// Everything here is a read of rows this process can already reach, and
// middleware.js has already refused anybody without a `sales-token` before
// this file runs. An /api/sales/playbook/library route would be a second door
// onto the same data with a second gate to keep in step, and — the failure
// docs/sales/OPEN-WORK.md keeps recording — one more route whose only caller
// is one screen. The client-side islands below (PlaybookView, and the "what
// did they just say" filter inside it) take the rows as props rather than
// fetching them.
//
// ══ Why the drawing moved to PlaybookView ════════════════════════════════
//
// The rep's language is resolved by useTranslation(), which is a client hook —
// a server component cannot call it, so while this file rendered the screen the
// screen could only be English. Rather than give up the reads above (that would
// mean the API route this header just argued against), the PRESENTATION moved
// to ./PlaybookView.js, which is a client component. The loads stay here, in
// the same order, and the rows are handed over as props.
//
// ══ Database first, seeds second, and it says which ═══════════════════════
//
// loadPlaybooks/loadObjections read the SalesPlaybook and SalesObjection
// tables and fall back to the built-in library when the models are not
// deployed. A rep must not read one script here and hear a different one come
// out of the call console, so this screen renders exactly what that one does —
// including an empty table, which stays empty. store.js's own comment argues
// it: somebody who deleted every playbook meant to.
export const dynamic = "force-dynamic";

import { battlecards } from "@/lib/sales/playbook/battlecards";
import { playbookMoments } from "@/lib/sales/playbook/moments";
import { loadObjections, loadPlaybooks } from "@/lib/sales/playbook/store";

import PlaybookView from "./PlaybookView";

export default async function SalesPlaybookPage() {
  const [playbooks, objections] = await Promise.all([loadPlaybooks(), loadObjections()]);
  // Pinned to the render, not read twice: a figure goes stale at ninety days
  // and two clocks inside one page could disagree about whether it publishes.
  const asOf = new Date();
  const cards = battlecards({ asOf });
  const MOMENTS = playbookMoments();

  return (
    <PlaybookView
      playbooks={playbooks}
      objections={objections}
      cards={cards}
      moments={MOMENTS}
    />
  );
}
