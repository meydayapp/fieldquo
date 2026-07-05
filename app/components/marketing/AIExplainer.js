// app/components/marketing/AIExplainer.js
import { Sparkles, MessageSquare } from "lucide-react";

export default function AIExplainer() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="grid sm:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-gray-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            <Sparkles size={14} /> AI Copilot
          </div>
          <h2 className="mt-4 text-3xl font-bold text-gray-900">
            Ask your business a question, get a real answer
          </h2>
          <p className="mt-4 text-gray-600 leading-relaxed">
            Copilot reads your own quotes, invoices, and expenses — not generic
            advice. Ask "how's my quote conversion rate this month" or "were
            materials cheaper last month" and get an answer grounded in your
            actual numbers, not a guess.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-gray-700">
            <li>"Am I pricing too low compared to last quarter?"</li>
            <li>"Which of my clients have paid the most this year?"</li>
            <li>"Should I stock up on any materials right now?"</li>
          </ul>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
              <MessageSquare size={16} className="text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-700">
              How's my quote conversion rate this month?
            </div>
          </div>
          <div className="flex items-start gap-3 flex-row-reverse">
            <div className="bg-gray-900 text-white rounded-2xl rounded-tr-none px-4 py-3 text-sm max-w-xs">
              You've sent 14 quotes and 6 were accepted — a 43% conversion rate,
              up from 31% last month. Your painting quotes are converting best.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
