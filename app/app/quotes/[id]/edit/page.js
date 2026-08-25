// app/app/quotes/[id]/edit/page.js
//
// Revising an existing quote.
//
// This used to be a second, smaller implementation of the quote builder, on the
// argument that revising is a different job from configuring. The argument did
// not survive contact: the two screens drifted into charging tax on different
// bases, and the cost/margin panel, the expiry default, the readiness checks
// and the discount entry modes all landed on one and never reached the other.
//
// So it is the same component, in edit mode. The differences that are real —
// a settled client, a fixed language, stored line items that must not be
// repriced, the AI review that can only read a SAVED quote — are branches on
// `mode` inside it. Keep this file a wrapper; scripts/check-quote-builder.mjs
// fails the build if it grows logic of its own again.
"use client";

import { useParams } from "next/navigation";
import QuoteBuilder from "@/app/components/quotes/builder/QuoteBuilder";

export default function EditQuotePage() {
  const { id } = useParams();
  return <QuoteBuilder mode="edit" quoteId={id} />;
}
