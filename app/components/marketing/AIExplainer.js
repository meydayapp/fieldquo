// app/components/marketing/AIExplainer.js
"use client";

import { Sparkles, MessageSquare } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

// The three sample questions are indexed rather than free-form, so a
// translator can see they're a set and keep them parallel in tone.
const SAMPLE_QUESTIONS = ["pricing", "topClients", "materials"];

export default function AIExplainer() {
  const { t } = useTranslation();

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="grid sm:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-gray-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            <Sparkles size={14} /> {t("ai.badge")}
          </div>
          <h2 className="mt-4 text-3xl font-bold text-gray-900">
            {t("ai.title")}
          </h2>
          <p className="mt-4 text-gray-600 leading-relaxed">{t("ai.body")}</p>
          <ul className="mt-6 space-y-2 text-sm text-gray-700">
            {SAMPLE_QUESTIONS.map((q) => (
              <li key={q}>{t(`ai.samples.${q}`)}</li>
            ))}
          </ul>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
              <MessageSquare size={16} className="text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-700">
              {t("ai.chat.question")}
            </div>
          </div>
          <div className="flex items-start gap-3 flex-row-reverse">
            <div className="bg-gray-900 text-white rounded-2xl rounded-tr-none px-4 py-3 text-sm max-w-xs">
              {t("ai.chat.answer")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
