// app/components/quotes/BusinessQuestion.js
//
// "Is <name> a business (a contractor you work for)?" — shown inside the
// quote send dialog, once per client, when the client is saved as an
// individual but its name reads like a company's. lib/clients/
// businessQuestion.js says why the line matters and why the name only
// decides whether to ASK.
//
// The server decides whether to ask (GET /api/clients/[id]/business-answer),
// so the quote page and the builder ask the same question of the same
// clients, and nobody who couldn't edit the client is asked. Answering is
// not required to send: ignoring it sends exactly what would have gone
// before, and the question comes back next time. The answer is saved before
// Send is pressed, so a "business" answer reaches this very email.
"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson, errorText } from "@/lib/fetchJson";

export default function BusinessQuestion({ clientId, onAnswered }) {
  const { t } = useTranslation();
  const [state, setState] = useState(null); // { ask, name }
  const [saving, setSaving] = useState("");
  const [answered, setAnswered] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState(null);
    setAnswered("");
    if (!clientId) return undefined;
    fetchJson(`/api/clients/${encodeURIComponent(clientId)}/business-answer`)
      .then((d) => !cancelled && setState(d))
      // A failed check asks nothing — the send goes exactly as it did before.
      .catch(() => !cancelled && setState({ ask: false }));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (answered) {
    return (
      <p className="text-xs text-muted-foreground text-center mt-3" data-business-question-answered>
        {answered === "business"
          ? t("app.businessQuestion.savedBusiness")
          : t("app.businessQuestion.savedIndividual")}
      </p>
    );
  }
  if (!state?.ask) return null;

  async function answer(value) {
    if (saving) return;
    setSaving(value);
    setError("");
    try {
      await fetchJson(`/api/clients/${encodeURIComponent(clientId)}/business-answer`, {
        method: "POST",
        body: { answer: value },
      });
      setAnswered(value);
      onAnswered?.(value);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-border px-4 py-3" data-business-question>
      <p className="text-sm font-medium text-foreground flex items-start gap-2">
        <Building2 size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
        <span>{t("app.businessQuestion.title", { name: state.name || "" })}</span>
      </p>
      <p className="text-xs text-muted-foreground mt-1">{t("app.businessQuestion.why")}</p>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={() => answer("business")}
          disabled={Boolean(saving)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 border border-border rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-60"
        >
          {saving === "business" && <Loader2 size={12} className="animate-spin" />}
          {t("app.businessQuestion.yes")}
        </button>
        <button
          type="button"
          onClick={() => answer("individual")}
          disabled={Boolean(saving)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 border border-border rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-60"
        >
          {saving === "individual" && <Loader2 size={12} className="animate-spin" />}
          {t("app.businessQuestion.no")}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
