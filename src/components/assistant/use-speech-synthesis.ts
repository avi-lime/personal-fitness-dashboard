"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "assistant:tts";
const noop = () => () => {};

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Reads the assistant's short reply aloud when the user has switched that on.
 * The preference is per device; it is a convenience, not state that matters.
 */
export function useSpeechSynthesis() {
  const supported = useSyncExternalStore(
    noop,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );
  const [enabled, setEnabledState] = useState(readPreference);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Storage may be unavailable; the toggle still works for this session.
    }
    if (!next && typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !enabled || !text.trim()) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      synth.speak(utterance);
    },
    [supported, enabled],
  );

  return { supported, enabled, setEnabled, speak };
}
