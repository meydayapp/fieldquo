// app/components/ErrorToast.js
//
// Catches messages from lib/clientErrors.js and shows them.
//
// Mounted once in the app layout, so any handler anywhere can report a failure
// without that page needing its own error state and banner.
//
// Deliberately does NOT auto-dismiss on a timer alone for the first few
// seconds of reading time — an error someone blinks and misses is barely
// better than no error. It stays for 8 seconds and can be dismissed early.
"use client";

import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { ERROR_EVENT } from "@/lib/clientErrors";

export default function ErrorToast() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    function onError(e) {
      const message = e.detail?.message;
      if (!message) return;
      const id = Date.now() + Math.random();

      setMessages((prev) => {
        // Don't stack the same message twice — a double-clicked button
        // shouldn't produce two identical toasts.
        if (prev.some((m) => m.message === message)) return prev;
        return [...prev, { id, message }];
      });

      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }, 8000);
    }

    window.addEventListener(ERROR_EVENT, onError);
    return () => window.removeEventListener(ERROR_EVENT, onError);
  }, []);

  if (messages.length === 0) return null;

  return (
    // Bottom-centre on phones, bottom-right on desktop: out of the way of the
    // thing that just failed, but not somewhere a thumb has to travel.
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-[100] space-y-2">
      {messages.map((m) => (
        <div
          key={m.id}
          role="alert"
          className="bg-white border border-red-200 shadow-lg rounded-xl px-4 py-3 flex items-start gap-2.5"
        >
          <AlertCircle size={17} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-gray-800 flex-1">{m.message}</p>
          <button
            onClick={() =>
              setMessages((prev) => prev.filter((x) => x.id !== m.id))
            }
            className="text-gray-300 hover:text-gray-600 shrink-0"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
