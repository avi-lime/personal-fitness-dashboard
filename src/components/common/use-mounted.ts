"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * `false` during server rendering and the first client render, `true`
 * afterwards — without a state update inside an effect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
