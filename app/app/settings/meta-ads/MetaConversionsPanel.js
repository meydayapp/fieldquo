// app/app/settings/meta-ads/MetaConversionsPanel.js
//
// "Send lead results to Meta" — the switch for lib/meta/capi/. Tells Meta
// which of its leads were real, which were not, and which booked, got a quote
// and bought, so its ad delivery finds more people like the customers and
// fewer like the accidental taps (the owner, 2026-10-05).
//
// Every control here does what it says or is not drawn as live:
//   * the switch cannot turn ON until Meta's Business Tools Terms are
//     accepted (the route refuses it too — terms_required);
//   * "Send a test event" is disabled, with the reason as its title, until a
//     dataset id and a token are saved and the terms accepted;
//   * each half (lead forms, website, Messenger, Instagram) says in one line
//     whether it is sending and, if not, exactly what it waits on — for the
//     messaging half that is a Meta permission FieldQuo's app does not hold
//     yet ("Needs Meta permission page_events"), never a silent nothing.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Send, RefreshCw, ExternalLink } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { articleMeta } from "@/lib/help/tree";
import { helpPath } from "@/lib/help/urls";
import { isHelpChromeLang } from "@/lib/help/chrome";

const GUIDE_SLUG = "send-lead-results-to-meta";
// Meta's own terms page, by Meta's address.
const TERMS_URL = "https://www.facebook.com/legal/businesstech";

// lib/meta/capi/settings.js capiReadiness states → the sentence for each.
const DATASET_STATE_KEYS = {
  ready: "app.setMetaCapi.state.ready",
  off: "app.setMetaCapi.state.off",
  no_terms: "app.setMetaCapi.state.noTerms",
  no_encryption: "app.setMetaCapi.state.noEncryption",
  no_dataset: "app.setMetaCapi.state.noDataset",
  no_token: "app.setMetaCapi.state.noToken",
};
const CHANNEL_STATE_KEYS = {
  ready: "app.setMetaCapi.state.ready",
  off: "app.setMetaCapi.state.off",
  no_terms: "app.setMetaCapi.state.noTerms",
  no_page: "app.setMetaCapi.state.noPage",
  no_instagram: "app.setMetaCapi.state.noInstagram",
  needs_permission: "app.setMetaCapi.state.needsPermission",
};
const ERROR_KEYS = {
  terms_required: "app.setMetaCapi.err.termsRequired",
  no_dataset: "app.setMetaCapi.state.noDataset",
  no_token: "app.setMetaCapi.state.noToken",
  no_encryption: "app.setMetaCapi.state.noEncryption",
  test_code_invalid: "app.setMetaCapi.err.testCode",
  auth_error: "app.setMetaCapi.err.auth",
  rate_limited: "app.setMetaCapi.err.rateLimited",
  bad_request: "app.setMetaCapi.err.badRequest",
};

function StateLine({ ok, label, text }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Circle size={15} className="shrink-0 mt-0.5 text-muted-foreground" />
      )}
      <span>
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground"> — {text}</span>
      </span>
    </li>
  );
}

export default function MetaConversionsPanel() {
  const { t, language } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState(null); // { tone, text }
  const [saving, setSaving] = useState(false);
  const [datasetId, setDatasetId] = useState("");
  const [token, setToken] = useState("");
  const [termsTicked, setTermsTicked] = useState(false);
  const [testCode, setTestCode] = useState("");
  const [testing, setTesting] = useState(false);
  const [pixels, setPixels] = useState(null); // null = not asked
  const [pixelsReason, setPixelsReason] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const d = await fetchJson("/api/settings/meta-conversions");
      setData(d);
      setDatasetId(d?.settings?.datasetId || d?.suggestedDatasetId || "");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const errText = (code, fallback) => (ERROR_KEYS[code] ? t(ERROR_KEYS[code]) : fallback || t("app.setMetaCapi.err.generic"));

  async function patch(body, okText) {
    setSaving(true);
    setNote(null);
    try {
      await fetchJson("/api/settings/meta-conversions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (okText) setNote({ tone: "success", text: okText });
      setToken("");
      await load();
    } catch (err) {
      const code = err?.data?.error;
      const fields = err?.data?.fields || [];
      const text = fields.includes("datasetId")
        ? t("app.setMetaCapi.err.datasetId")
        : fields.includes("datasetToken")
          ? t("app.setMetaCapi.err.token")
          : errText(code, err.message);
      setNote({ tone: "error", text });
    } finally {
      setSaving(false);
    }
  }

  async function loadPixels() {
    try {
      const d = await fetchJson("/api/settings/meta-conversions/pixels");
      setPixels(d?.pixels || []);
      setPixelsReason(d?.reason || null);
    } catch (err) {
      setPixels([]);
      setPixelsReason("unknown_error");
      setNote({ tone: "error", text: err.message });
    }
  }

  async function sendTest() {
    setTesting(true);
    setNote(null);
    try {
      const d = await fetchJson("/api/settings/meta-conversions/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEventCode: testCode }),
      });
      setNote({ tone: "success", text: t("app.setMetaCapi.test.sent", { count: d?.eventsReceived ?? 1 }) });
      await load();
    } catch (err) {
      const kind = err?.data?.kind || err?.data?.error;
      const meta = err?.data?.message ? ` (${err.data.message})` : "";
      setNote({ tone: "error", text: `${errText(kind, err.message)}${meta}` });
    } finally {
      setTesting(false);
    }
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    );
  }
  if (!data) return <div className="bg-card border border-border rounded-xl p-5 animate-pulse h-40" />;

  const s = data.settings || {};
  const setup = data.setup || {};
  const termsAccepted = Boolean(s.termsAcceptedAt);
  const datasetReady = setup.crm === "ready";
  const testDisabledReason = !termsAccepted
    ? t("app.setMetaCapi.state.noTerms")
    : setup.crm !== "ready"
      ? t(DATASET_STATE_KEYS[setup.crm] || DATASET_STATE_KEYS.no_dataset)
      : !testCode.trim()
        ? t("app.setMetaCapi.test.needCode")
        : null;
  const counts = data.counts || {};
  const sum = (status) => Object.values(counts).reduce((n, byStatus) => n + (byStatus?.[status] || 0), 0);
  const guide = articleMeta(GUIDE_SLUG);
  const guideHref = guide ? helpPath(isHelpChromeLang(language) ? language : "en", guide.category, guide.slug) : null;
  const channelText = (c) =>
    c?.state === "needs_permission"
      ? t("app.setMetaCapi.state.needsPermission", { permission: c.permission })
      : t(CHANNEL_STATE_KEYS[c?.state] || CHANNEL_STATE_KEYS.off);
  const live = data.live || {};

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4" id="send-lead-results">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Send size={16} /> {t("app.setMetaCapi.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t("app.setMetaCapi.subtitle")}</p>
          {guideHref && (
            <a href={guideHref} className="text-xs underline text-foreground mt-1 inline-block">
              {t("app.setMetaCapi.guideLink")}
            </a>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(s.enabled)}
          aria-label={t("app.setMetaCapi.switchLabel")}
          disabled={saving || (!s.enabled && !termsAccepted)}
          title={!s.enabled && !termsAccepted ? t("app.setMetaCapi.state.noTerms") : undefined}
          onClick={() => patch({ enabled: !s.enabled }, s.enabled ? t("app.setMetaCapi.switchedOff") : t("app.setMetaCapi.switchedOn"))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 disabled:opacity-50 ${s.enabled ? "bg-inverted" : "bg-accent"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${s.enabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {note && (
        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm border ${
            note.tone === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
          }`}
        >
          {note.tone === "success" ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <AlertTriangle size={15} className="shrink-0 mt-0.5" />}
          <span>{note.text}</span>
        </div>
      )}

      {/* 1 — Meta's terms, once, by a named person */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{t("app.setMetaCapi.terms.heading")}</h3>
        {termsAccepted ? (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
            {t("app.setMetaCapi.terms.accepted", {
              name: s.termsAcceptedByName || "—",
              date: new Date(s.termsAcceptedAt).toLocaleDateString(language),
            })}
          </p>
        ) : (
          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input type="checkbox" className="mt-1" checked={termsTicked} onChange={(e) => setTermsTicked(e.target.checked)} />
              <span>
                {t("app.setMetaCapi.terms.body")}{" "}
                <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
                  {t("app.setMetaCapi.terms.link")} <ExternalLink size={11} />
                </a>
              </span>
            </label>
            <button
              type="button"
              disabled={!termsTicked || saving}
              onClick={() => patch({ acceptTerms: true }, t("app.setMetaCapi.terms.done"))}
              className="border border-border text-foreground px-3.5 py-1.5 rounded-full text-sm font-semibold disabled:opacity-50"
            >
              {t("app.setMetaCapi.terms.accept")}
            </button>
          </div>
        )}
      </div>

      {/* 2 — where lead-form and website events go */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{t("app.setMetaCapi.dataset.heading")}</h3>
        <p className="text-xs text-muted-foreground">{t("app.setMetaCapi.dataset.body")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            inputMode="numeric"
            placeholder={t("app.setMetaCapi.dataset.placeholder")}
            aria-label={t("app.setMetaCapi.dataset.label")}
            className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm bg-background"
          />
          {data.adAccountConnected && (
            <button type="button" onClick={loadPixels} className="text-sm underline text-foreground">
              {t("app.setMetaCapi.dataset.pick")}
            </button>
          )}
        </div>
        {pixels && pixels.length > 0 && (
          <div className="space-y-1">
            {pixels.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-1.5 cursor-pointer">
                <input type="radio" name="metaDataset" checked={datasetId === p.id} onChange={() => setDatasetId(p.id)} />
                <span className="flex-1">{p.name || p.id}</span>
                <span className="text-xs text-muted-foreground">{p.id}</span>
              </label>
            ))}
          </div>
        )}
        {pixels && pixels.length === 0 && (
          <p className="text-xs text-muted-foreground">{t(pixelsReason === "none" ? "app.setMetaCapi.dataset.noneFound" : "app.setMetaCapi.dataset.listFailed")}</p>
        )}
        {data.suggestedDatasetId && !s.datasetId && (
          <p className="text-xs text-muted-foreground">{t("app.setMetaCapi.dataset.suggested", { id: data.suggestedDatasetId })}</p>
        )}
        <input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={s.hasToken ? t("app.setMetaCapi.token.savedPlaceholder", { hint: s.tokenHint || "" }) : t("app.setMetaCapi.token.placeholder")}
          aria-label={t("app.setMetaCapi.token.label")}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
        />
        <p className="text-xs text-muted-foreground">{t("app.setMetaCapi.token.help")}</p>
        <button
          type="button"
          disabled={saving || (!datasetId.trim() && !token.trim())}
          onClick={() => {
            const body = { datasetId: datasetId.trim() };
            const picked = (pixels || []).find((p) => p.id === datasetId.trim());
            if (picked?.name) body.datasetName = picked.name;
            if (token.trim()) body.datasetToken = token.trim();
            patch(body, t("app.setMetaCapi.dataset.saved"));
          }}
          className="bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
        >
          {saving ? t("app.action.saving", "Saving…") : t("app.setMetaCapi.dataset.save")}
        </button>
      </div>

      {/* 3 — the test event */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{t("app.setMetaCapi.test.heading")}</h3>
        <p className="text-xs text-muted-foreground">{t("app.setMetaCapi.test.body")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={testCode}
            onChange={(e) => setTestCode(e.target.value)}
            placeholder="TEST12345"
            aria-label={t("app.setMetaCapi.test.codeLabel")}
            className="w-40 border border-border rounded-lg px-3 py-2 text-sm bg-background"
          />
          <button
            type="button"
            onClick={sendTest}
            disabled={Boolean(testDisabledReason) || testing}
            title={testDisabledReason || undefined}
            className="flex items-center gap-1.5 border border-border text-foreground px-3.5 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
          >
            {testing ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            {t("app.setMetaCapi.test.button")}
          </button>
        </div>
      </div>

      {/* 4 — what each half does right now */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{t("app.setMetaCapi.halves.heading")}</h3>
        <ul className="space-y-1.5">
          <StateLine ok={live.crm === "ready"} label={t("app.setMetaCapi.halves.leadForms")} text={t(DATASET_STATE_KEYS[live.crm] || DATASET_STATE_KEYS.off)} />
          <StateLine
            ok={live.website === "ready" && !data.consentRequired}
            label={t("app.setMetaCapi.halves.website")}
            text={data.consentRequired ? t("app.setMetaCapi.state.consent") : t(DATASET_STATE_KEYS[live.website] || DATASET_STATE_KEYS.off)}
          />
          <StateLine ok={live.messenger?.state === "ready"} label={t("app.setMetaCapi.halves.messenger")} text={channelText(live.messenger)} />
          <StateLine ok={live.instagram?.state === "ready"} label={t("app.setMetaCapi.halves.instagram")} text={channelText(live.instagram)} />
        </ul>
        {!datasetReady && s.enabled && <p className="text-xs text-muted-foreground">{t("app.setMetaCapi.halves.datasetHint")}</p>}
      </div>

      {/* 5 — what happened */}
      <div className="text-xs bg-muted rounded-lg px-3 py-2 text-muted-foreground space-y-0.5">
        <div>
          {s.lastSyncAt
            ? t("app.setMetaCapi.sync.last", { date: new Date(s.lastSyncAt).toLocaleString(language) })
            : t("app.setMetaCapi.sync.never")}
          {s.lastSyncError ? ` · ${errText(s.lastSyncError, s.lastSyncError)}` : ""}
        </div>
        <div>
          {t("app.setMetaCapi.sync.counts", {
            days: data.windowDays || 30,
            sent: sum("sent"),
            failed: sum("failed"),
            pending: sum("pending"),
            expired: sum("expired"),
          })}
        </div>
        {(data.recentFailures || []).map((f, i) => (
          <div key={i} className="text-red-700 dark:text-red-300">
            {f.eventName}: {String(f.lastError || "").slice(0, 160)}
          </div>
        ))}
      </div>

      {/* 6 — the campaign side, in Meta */}
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-foreground">{t("app.setMetaCapi.howto.heading")}</summary>
        <ol className="list-decimal pl-5 mt-2 space-y-1 text-muted-foreground">
          <li>{t("app.setMetaCapi.howto.step1")}</li>
          <li>{t("app.setMetaCapi.howto.step2")}</li>
          <li>{t("app.setMetaCapi.howto.step3")}</li>
          <li>{t("app.setMetaCapi.howto.step4")}</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-2">{t("app.setMetaCapi.howto.rules")}</p>
        <p className="text-xs text-muted-foreground mt-2">{t("app.setMetaCapi.privacy")}</p>
      </details>
    </div>
  );
}
