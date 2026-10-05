// lib/ai/planAdviceUnits.js
//
// The unit costs lib/ai/planAdvice.js recommends from — computed HERE, on the
// server, from the same functions that meter and charge each use, so the
// estimate on the plan picker moves when a vendor price or a model changes,
// and never from a number typed into a screen.
//
//   conversationCents  one AI-employee conversation, charged to AI credit:
//                      walletMeter's estimateChargeCents("ai_employee_reply")
//                      — TYPICAL_CONVERSATION_TOKENS (9,000 in / 600 out) on
//                      the best model, × PAY_AS_YOU_GO_MULTIPLIER, rounded up
//   drawingReadCents   one commercial drawing set of TYPICAL_SET_SHEETS
//                      sheets, charged to AI credit: lib/planRead/billing.js
//                      estimateRead's EXPECTED charge (not its held ceiling —
//                      a read is settled to what it used)
//   quoteReview        one AI quote review, spent from the PLAN's allowance:
//                      QUOTE_REVIEW_TOKENS on the standard model (the one
//                      complete() call lib/ai/quoteReview.js makes), as tokens
//                      for a token cap and as vendor micros for a dollar cap
//
// QUOTE_REVIEW_TOKENS is a stated size, like the conversation's: the writing
// pass's system prompt is ~1,100 tokens (4,390 characters, measured), its
// schema and the quote's lines and notes bring the prompt to about 3,500, and
// a reasoning model's answer with its thinking about 2,500. Every real review
// is recorded as an AiUsage row (feature "quote_review"), so /platform/ai-usage
// can measure it and this line be corrected in one place.

import { estimateCostMicros } from "./usage";
import { estimateChargeCents } from "./walletMeter";
import { AI_MODEL } from "./provider";
import { BUNDLES } from "./imageEconomics";
import { estimateRead } from "@/lib/planRead/billing";

export const TYPICAL_SET_SHEETS = 20;
export const QUOTE_REVIEW_TOKENS = Object.freeze({ prompt: 3_500, completion: 2_500 });

export function aiAdviceUnits({ sheets = TYPICAL_SET_SHEETS } = {}) {
  const read = estimateRead({ sheets });
  return {
    conversationCents: estimateChargeCents("ai_employee_reply"),
    drawingReadCents: read.expectedCents,
    drawingReadCeilingCents: read.cents,
    drawingReadSheets: sheets,
    quoteReview: {
      tokens: QUOTE_REVIEW_TOKENS.prompt + QUOTE_REVIEW_TOKENS.completion,
      micros: estimateCostMicros({
        model: AI_MODEL,
        promptTokens: QUOTE_REVIEW_TOKENS.prompt,
        completionTokens: QUOTE_REVIEW_TOKENS.completion,
      }),
    },
  };
}

/** The AI credit plans as the advisor needs them — never a Stripe id. */
export function aiAdviceBundles() {
  return BUNDLES.map((b) => ({ key: b.key, priceCents: b.priceCents, credits: b.credits }));
}
