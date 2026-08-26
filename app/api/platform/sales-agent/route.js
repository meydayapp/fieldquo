// app/api/platform/sales-agent/route.js
//
// What FieldQuo's own phone agent knows, and what it would say.
//
// ── Read-only, and there is nothing to write ───────────────────────────────
//
// Everything on this route is DERIVED — from the feature registry, from the
// PlatformFeature globals and from the Plan rows. There is no draft to save and
// no setting to store, which is the point: the way you change what the agent
// says is to change a plan, or hide a feature, or ship one. A text box here
// would be a fourth place the truth could live.
//
// ── Superadmin only ────────────────────────────────────────────────────────
//
// The whole surface is behind the platform-token check in middleware.js, and
// checked again here — hiding a screen is not access control. Deliberately
// tighter than a plain admin read: this returns the exact plan prices FieldQuo
// would quote and the full internal feature list including anything in preview.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { getAppOrigin } from "@/lib/appUrl";
import {
  buildSalesAgentConfig,
  salesAgentReadiness,
  SALES_TRANSFER_ENV,
  SALES_CONTACT_URL,
} from "@/lib/platform/salesAgent";

export async function GET(request) {
  const me = await getCurrentPlatformAdmin(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const origin = getAppOrigin(request);
  const config = await buildSalesAgentConfig({ origin });
  const readiness = salesAgentReadiness({
    transferTo: config.transferTo,
    knowledge: config.knowledge,
  });

  return NextResponse.json({
    readiness,
    knowledge: config.knowledge,
    // The literal strings, not a summary of them. The question this screen
    // answers is "what does it know?", and a paraphrase would be a fifth copy.
    prompt: config.prompt,
    greeting: config.greeting,
    tools: config.llmPayload.general_tools.map((t) => ({
      name: t.name,
      type: t.type,
    })),
    agentPayload: config.agentPayload,
    env: { transferVar: SALES_TRANSFER_ENV, contactUrl: SALES_CONTACT_URL },
  });
}
