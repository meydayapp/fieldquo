// app/app/quotes/new/page.js
//
// Building a quote from scratch.
//
// Everything on this screen lives in QuoteBuilder, which /app/quotes/[id]/edit
// renders too. The two routes were separate implementations of the same screen
// and drifted until the same quote had two different totals depending on which
// one saved it last — see the component's header. Keep this file a wrapper:
// scripts/check-quote-builder.mjs fails the build if either route grows builder
// logic of its own again.
"use client";

import QuoteBuilder from "@/app/components/quotes/builder/QuoteBuilder";

export default function NewQuotePage() {
  return <QuoteBuilder mode="create" />;
}
