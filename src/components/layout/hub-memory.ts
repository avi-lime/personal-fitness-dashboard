"use client";

import { useSyncExternalStore } from "react";
import { type Hub } from "./nav-items";

/**
 * Each hub reopens where you left it, like a native app's tabs: tap Health
 * after logging food and you are back on Food, not bounced to Train.
 */
const EVENT = "life-dashboard:hub-memory";
const keyFor = (hub: Hub) => `hub:last:${hub.key}`;

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function rememberHubPage(hub: Hub, href: string) {
  try {
    if (window.localStorage.getItem(keyFor(hub)) === href) return;
    window.localStorage.setItem(keyFor(hub), href);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // No storage: hubs simply open on their first page.
  }
}

export function useHubHref(hub: Hub): string {
  const stored = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(keyFor(hub));
      } catch {
        return null;
      }
    },
    () => null,
  );
  // Only ever a page of this hub; anything else stored falls back to the first.
  return hub.pages.some((page) => page.href === stored) ? (stored as string) : hub.pages[0].href;
}
