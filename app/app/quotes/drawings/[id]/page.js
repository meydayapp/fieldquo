// app/app/quotes/drawings/[id]/page.js
//
// One drawing read — "Start from drawings". Everything on the screen is
// app/components/planRead/PlanReadWorkspace.js; this file is the route.
"use client";

import { useParams } from "next/navigation";
import PlanReadWorkspace from "@/app/components/planRead/PlanReadWorkspace";

export default function DrawingReadPage() {
  const { id } = useParams();
  return <PlanReadWorkspace id={id} />;
}
