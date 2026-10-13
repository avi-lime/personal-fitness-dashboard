"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * A rest countdown that survives a refresh or a locked phone: the end time
 * lives in localStorage, so reopening the page picks up where it left off.
 * When it runs out the phone buzzes and two short tones play.
 */
const EVENT = "life-dashboard:rest-timer";

interface Stored {
  endAt: number;
  total: number;
}

function read(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Stored;
    return typeof value.endAt === "number" && typeof value.total === "number" ? value : null;
  } catch {
    return null;
  }
}

function write(key: string, value: Stored | null) {
  try {
    if (value) window.localStorage.setItem(key, JSON.stringify(value));
    else window.localStorage.removeItem(key);
  } catch {
    // Private mode or blocked storage: the timer still works, it just won't survive a reload.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useRestTimer(key: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const stored = read(raw);
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef<AudioContext | null>(null);
  const alerted = useRef<number | null>(null);

  const chime = useCallback(() => {
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // Vibration is a nicety.
    }
    const context = audio.current;
    if (!context) return;
    for (const offset of [0, 0.22]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.16);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.18);
    }
  }, []);

  const endAt = stored?.endAt ?? null;
  useEffect(() => {
    if (endAt === null) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= endAt && alerted.current !== endAt) {
        alerted.current = endAt;
        chime();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endAt, chime]);

  /** Must be called from a tap, so the browser lets the chime play later. */
  const unlockAudio = useCallback(() => {
    try {
      const AudioContextClass =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!audio.current && AudioContextClass) audio.current = new AudioContextClass();
      void audio.current?.resume();
    } catch {
      // No audio: the vibration and the on-screen countdown still work.
    }
  }, []);

  const start = useCallback(
    (seconds: number) => {
      unlockAudio();
      write(key, { endAt: Date.now() + seconds * 1000, total: seconds });
    },
    [key, unlockAudio],
  );

  const adjust = useCallback(
    (seconds: number) => {
      if (!stored) return;
      const endAt = Math.max(Date.now(), stored.endAt + seconds * 1000);
      write(key, { endAt, total: Math.max(1, stored.total + seconds) });
    },
    [key, stored],
  );

  const stop = useCallback(() => write(key, null), [key]);

  const remainingMs = stored ? Math.max(0, stored.endAt - now) : 0;
  return {
    running: stored !== null && remainingMs > 0,
    finished: stored !== null && remainingMs === 0,
    active: stored !== null,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    total: stored?.total ?? 0,
    start,
    adjust,
    stop,
    unlockAudio,
  };
}

/** Keeps the screen awake while the session is open. */
export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        if (document.visibilityState === "visible" && "wakeLock" in navigator) {
          lock = await navigator.wakeLock.request("screen");
          if (cancelled) void lock.release();
        }
      } catch {
        // Denied or unsupported: the session works, the screen may just dim.
      }
    };
    void request();
    const onVisible = () => void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);
}

export function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
