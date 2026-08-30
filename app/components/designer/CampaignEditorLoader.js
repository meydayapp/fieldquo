"use client";

// app/components/designer/CampaignEditorLoader.js
//
// The ssr:false boundary for CampaignEditor.js — same shape as
// DesignerLoader.js, one layer up. CampaignEditor.js imports "fabric"
// directly (its own module doc explains why "download all" needs to), and
// fabric@5.3.0-browser touches window/document at import time, so anything
// that imports it — even transitively, even through a dynamic import()
// call inside a click handler — has to be kept out of the server render.
// See app/app/marketing/designer/[id]/page.js for the one caller.
import dynamic from "next/dynamic";

const CampaignEditorImpl = dynamic(
  () => import("@/app/components/designer/CampaignEditor").then((mod) => mod.CampaignEditor),
  { ssr: false },
);

export default CampaignEditorImpl;
