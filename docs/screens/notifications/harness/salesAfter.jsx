// The shared layer, as SalesShell mounts it, fed the same sentence the
// queue's top-up now sends through notify() (focused tab → toast).
import React, { useEffect } from "react";
import ToastLayer from "@/app/components/ToastLayer";
import { showToast } from "@/lib/toast";
export default function SalesToastAfter({ text }) {
  useEffect(() => {
    const id = setTimeout(() => showToast({ message: `Queue topped up — ${text}`, tone: "success", tag: "sales-queue-topup", href: "/sales/queue" }), 100);
    return () => clearTimeout(id);
  }, [text]);
  return <ToastLayer surface="sales" />;
}
