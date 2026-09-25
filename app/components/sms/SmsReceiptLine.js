// app/components/sms/SmsReceiptLine.js
//
// One text's fate in one line — "Confirmation text: Delivered", "Reminder
// text: Not delivered — Carriers blocked it: …". Shared by the calendar's
// appointment panel and the client page so the two can never word the same
// receipt differently.
//
// The verdict and the reason come from lib/sms/deliveryStatus.js — the same
// ordering the status callback and the reconcile cron apply — and "sent" is
// drawn as "sent, no delivery receipt yet", never as delivered: some carriers
// never return a receipt, and absence of one is not one.
"use client";

import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { deliveryVerdict, reasonKey } from "@/lib/sms/deliveryStatus";

const PURPOSE_KEYS = {
  booking_confirmation: "app.sms.purpose.bookingConfirmation",
  appointment_reminder: "app.sms.purpose.reminder",
  visit_reminder: "app.sms.purpose.reminder",
  on_my_way: "app.sms.purpose.onMyWay",
  change_order: "app.sms.purpose.changeOrder",
  thread_reply: "app.sms.purpose.reply",
};

/** "Delivered" / "Not delivered — why" / "Sent, no delivery receipt yet" / "Sending". */
export function smsStatusText(t, { status, errorCode }) {
  const verdict = deliveryVerdict({ status });
  if (verdict === "delivered") return t("app.sms.delivered");
  if (verdict === "failed") return t("app.sms.notDeliveredBecause", { reason: t(reasonKey(errorCode)) });
  if (verdict === "sent") return t("app.sms.sentNoReceipt");
  return t("app.sms.pending");
}

export default function SmsReceiptLine({ text, showPurpose = true, suffix = null }) {
  const { t } = useTranslation();
  if (!text) return null;
  const verdict = deliveryVerdict(text);
  const Icon = verdict === "delivered" ? CheckCircle2 : verdict === "failed" ? AlertTriangle : Clock;
  const tone =
    verdict === "failed"
      ? "text-red-700 dark:text-red-300"
      : verdict === "delivered"
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-muted-foreground";
  const status = smsStatusText(t, text);
  const label = showPurpose ? t(PURPOSE_KEYS[text.purpose] || "app.sms.purpose.other") : null;
  return (
    <p className={`flex items-start gap-1.5 text-xs break-words ${tone}`}>
      <Icon size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        {label ? t("app.sms.line", { label, status }) : status}
        {suffix ? <span className="text-muted-foreground"> · {suffix}</span> : null}
      </span>
    </p>
  );
}
