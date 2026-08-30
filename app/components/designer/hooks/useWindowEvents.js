"use client";

// app/components/designer/hooks/useWindowEvents.js
// Ported from `hooks/use-window-events.ts`. Same react-use → useEffect swap
// as useHotkeys.js: warns before an accidental tab close loses unsaved work.
import { useEffect } from "react";

export function useWindowEvents() {
  useEffect(() => {
    function handleBeforeUnload(event) {
      event.preventDefault();
      // Chrome ignores any custom string and shows its own message, but the
      // legacy `returnValue` assignment is still what triggers the prompt.
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);
}
