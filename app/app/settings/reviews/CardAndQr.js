"use client";

// app/app/settings/reviews/CardAndQr.js
//
// The digital business card and everything that points at it: the QR, the
// print sheet, the two wallet passes, the NFC tag — and the tap counts that
// say whether any of it is being used.
//
// ── Every "not set up yet" here is a sentence the server said ──────────────
//
// The wallet buttons render from `wallet.apple.configured` and
// `wallet.google.configured` in the settings GET, which the server derived
// from env. A button drawn on a deployment that cannot sign is the dead
// control AGENTS.md forbids, so an unconfigured pass is a plain sentence
// naming the missing variables — the owner's next step, not a promise.
//
// ── NFC, said plainly ───────────────────────────────────────────────────────
//
// An Apple Wallet pass cannot be tapped by a customer's phone: Wallet's NFC
// is Apple VAS, enterprise-only, readable by certified terminals and by
// nothing a homeowner carries. The screen says so next to the button, so
// nobody buys a pass expecting a tap. What works with every phone is a
// physical NFC tag written with the card URL — or with the contact itself,
// so the tap prompts "Add to Contacts" with no browser at all. Both are
// offered, with the bytes each one needs and the tag that holds it.

import { useState } from "react";
import { QrCode, Download, Printer, ExternalLink, Copy, Check, Wallet, Nfc, Smartphone, Loader2 } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

// Where a tap came from, in the order the screen lists them. Literal keys so
// the translation checks can see each one.
const SOURCE_KEYS = [
  ["sticker", "app.setReviews.source.sticker"],
  ["qr", "app.setReviews.source.qr"],
  ["nfc", "app.setReviews.source.nfc"],
  ["wallet", "app.setReviews.source.wallet"],
  ["invoice", "app.setReviews.source.invoice"],
  ["email", "app.setReviews.source.email"],
  ["link", "app.setReviews.source.link"],
  ["other", "app.setReviews.source.other"],
];

function CopyButton({ text, label, copiedLabel }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard refused (insecure context, permissions). The text is
          // on screen; nothing to report.
        }
      }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? copiedLabel : label}
    </button>
  );
}

export default function CardAndQr({ card, nfc, wallet, hasReviewUrl }) {
  const { t } = useTranslation();
  const [googleBusy, setGoogleBusy] = useState(false);

  if (!card) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <QrCode size={16} /> {t("app.setReviews.cardTitle")}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{t("app.setReviews.cardNeedsName")}</p>
      </section>
    );
  }

  const taps = card.taps || { total: 0, bySource: {} };

  async function addToGoogleWallet() {
    setGoogleBusy(true);
    try {
      const res = await fetch("/api/reviews/wallet/google");
      if (!res.ok) {
        await reportResponseError(res, t("app.setReviews.walletError"));
        return;
      }
      const { url } = await res.json();
      if (url) window.open(url, "_blank", "noopener");
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-5" data-card-section>
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <QrCode size={16} /> {t("app.setReviews.cardTitle")}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{t("app.setReviews.cardSubtitle")}</p>
        {!hasReviewUrl && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{t("app.setReviews.cardNoReview")}</p>
        )}
      </div>

      {/* ── The address and the QR ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-5 items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/reviews/qr.svg?of=card&ref=qr&size=176"
          width={176}
          height={176}
          alt={t("app.setReviews.qrAlt")}
          className="rounded-lg border border-border bg-white shrink-0"
        />
        <div className="flex-1 min-w-[14rem] space-y-3">
          <div>
            <p className="text-xs font-semibold text-foreground">{t("app.setReviews.cardUrl")}</p>
            <p className="text-sm text-foreground break-all font-mono mt-1" data-card-url>{card.url}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={card.url} label={t("app.setReviews.copy")} copiedLabel={t("app.action.copied")} />
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted"
            >
              <ExternalLink size={13} /> {t("app.setReviews.openCard")}
            </a>
            <a
              href="/api/reviews/qr.png?of=card&ref=qr&size=1024&download=1"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted"
            >
              <Download size={13} /> PNG
            </a>
            <a
              href="/api/reviews/qr.svg?of=card&ref=qr&size=1024&download=1"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted"
            >
              <Download size={13} /> SVG
            </a>
            <a
              href="/api/reviews/print-sheet"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-inverted text-inverted-foreground text-xs font-semibold"
            >
              <Printer size={13} /> {t("app.setReviews.printSheet")}
            </a>
          </div>
          <p className="text-xs text-muted-foreground">{t("app.setReviews.printSheetHelp")}</p>
        </div>
      </div>

      {/* ── Taps ───────────────────────────────────────────────────────── */}
      <div className="rounded-lg bg-muted/40 p-4" data-card-taps>
        <p className="text-xs font-semibold text-foreground">
          {t("app.setReviews.tapsTitle", { count: taps.total })}
        </p>
        {taps.total === 0 ? (
          <p className="text-xs text-muted-foreground mt-1">{t("app.setReviews.tapsNone")}</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground">
            {SOURCE_KEYS.filter(([s]) => (taps.bySource?.[s] || 0) > 0).map(([s, key]) => (
              <li key={s} className="tabular-nums">
                <strong>{taps.bySource[s]}</strong> {t(key)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Wallet ─────────────────────────────────────────────────────── */}
      <div className="pt-4 border-t border-border space-y-3" data-wallet-section>
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Wallet size={15} /> {t("app.setReviews.walletTitle")}
        </p>
        <p className="text-xs text-muted-foreground">{t("app.setReviews.walletHelp")}</p>
        <div className="flex flex-wrap gap-2 items-center">
          {wallet?.apple?.configured ? (
            <a
              href="/api/reviews/wallet/apple"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-semibold"
            >
              <Smartphone size={13} /> {t("app.setReviews.addToAppleWallet")}
            </a>
          ) : (
            <span data-apple-wallet-unavailable className="text-xs text-muted-foreground">
              {t("app.setReviews.appleWalletNotSetUp")}{" "}
              <span className="font-mono">{(wallet?.apple?.missing || []).join(", ")}</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {wallet?.google?.configured ? (
            <button
              type="button"
              onClick={addToGoogleWallet}
              disabled={googleBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-semibold disabled:opacity-50"
            >
              {googleBusy ? <Loader2 size={13} className="animate-spin" /> : <Smartphone size={13} />}{" "}
              {t("app.setReviews.addToGoogleWallet")}
            </button>
          ) : (
            <span data-google-wallet-unavailable className="text-xs text-muted-foreground">
              {t("app.setReviews.googleWalletNotSetUp")}{" "}
              <span className="font-mono">{(wallet?.google?.missing || []).join(", ")}</span>
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground" data-wallet-nfc-note>{t("app.setReviews.walletNfcNote")}</p>
      </div>

      {/* ── NFC tag ────────────────────────────────────────────────────── */}
      <div className="pt-4 border-t border-border space-y-3" data-nfc-section>
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Nfc size={15} /> {t("app.setReviews.nfcTitle")}
        </p>
        <p className="text-xs text-muted-foreground">{t("app.setReviews.nfcHelp")}</p>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">{t("app.setReviews.nfcOptionUrl")}</p>
          <p className="text-xs text-muted-foreground">{t("app.setReviews.nfcOptionUrlHelp")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs break-all text-foreground" data-nfc-url>{card.nfcUrl}</code>
            <CopyButton text={card.nfcUrl} label={t("app.setReviews.copy")} copiedLabel={t("app.action.copied")} />
          </div>
        </div>

        {nfc?.vcard && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">{t("app.setReviews.nfcOptionContact")}</p>
            <p className="text-xs text-muted-foreground">{t("app.setReviews.nfcOptionContactHelp")}</p>
            <textarea
              readOnly
              value={nfc.vcard}
              rows={6}
              aria-label={t("app.setReviews.nfcOptionContact")}
              data-nfc-vcard
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground font-mono"
            />
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton text={nfc.vcard} label={t("app.setReviews.copy")} copiedLabel={t("app.action.copied")} />
              <span className="text-xs text-muted-foreground" data-nfc-size>
                {nfc.tag
                  ? t("app.setReviews.nfcFits", { bytes: nfc.bytes, tag: nfc.tag })
                  : t("app.setReviews.nfcTooBig", { bytes: nfc.bytes })}
              </span>
            </div>
          </div>
        )}

        <ol className="list-decimal pl-5 space-y-1 text-xs text-foreground">
          <li>{t("app.setReviews.nfcStep1")}</li>
          <li>{t("app.setReviews.nfcStep2")}</li>
          <li>{t("app.setReviews.nfcStep3")}</li>
          <li>{t("app.setReviews.nfcStep4")}</li>
        </ol>
        <p className="text-xs text-muted-foreground">{t("app.setReviews.nfcIphoneNote")}</p>
      </div>
    </section>
  );
}
