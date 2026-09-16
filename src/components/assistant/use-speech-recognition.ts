"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Minimal typing for the Web Speech API — enough for push-to-talk. Declared
 * here rather than as ambient globals so nothing collides with lib.dom.
 */
interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionErrorLike {
  error: string;
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in the browser and try again.",
  "service-not-allowed": "Speech recognition is not allowed here.",
  "no-speech": "I did not hear anything.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs a network connection.",
  aborted: "",
};

const noop = () => () => {};

export interface SpeechRecognitionState {
  /** False during SSR and on browsers without the API (Firefox). */
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

/**
 * Tap-to-start / tap-to-stop dictation. One utterance per start: iOS Safari
 * has no continuous mode, and a single request is what the assistant wants.
 * `onTranscript` receives interim text as it arrives and the final text once.
 */
export function useSpeechRecognition(
  onTranscript: (text: string, final: boolean) => void,
): SpeechRecognitionState {
  const supported = useSyncExternalStore(
    noop,
    () => getRecognitionCtor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const instance = useRef<RecognitionLike | null>(null);
  const callback = useRef(onTranscript);

  // Keep the latest handler without re-creating the recognition instance.
  useEffect(() => {
    callback.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => () => instance.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || instance.current) return;
    const recognition = new Ctor();
    recognition.lang = typeof navigator !== "undefined" ? navigator.language || "en-IN" : "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let text = "";
      let final = false;
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        text += result[0].transcript;
        if (result.isFinal) final = true;
      }
      callback.current(text.trim(), final);
    };
    recognition.onerror = (event) => {
      const message = ERROR_MESSAGES[event.error] ?? `Speech recognition failed (${event.error}).`;
      if (message) setError(message);
    };
    recognition.onend = () => {
      instance.current = null;
      setListening(false);
    };

    setError(null);
    instance.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      instance.current = null;
      setListening(false);
      setError("Could not start the microphone.");
    }
  }, []);

  const stop = useCallback(() => {
    instance.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (instance.current) stop();
    else start();
  }, [start, stop]);

  return { supported, listening, error, start, stop, toggle };
}
