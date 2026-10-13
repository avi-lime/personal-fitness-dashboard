"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic } from "lucide-react";
import { HUBS, hubFor, type Hub } from "./nav-items";
import { useHubHref } from "./hub-memory";
import { useLogDialogs } from "@/components/log/log-provider";
import { useSpeechRecognition } from "@/components/assistant/use-speech-recognition";
import { cn } from "@/lib/utils";

function HubTab({ hub, active }: { hub: Hub; active: boolean }) {
  const href = useHubHref(hub);
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <hub.icon className={cn("size-5", active && "text-brand")} aria-hidden />
        {hub.label}
      </Link>
    </li>
  );
}

/**
 * Phone tab bar: Today · Health · mic · Day · Money.
 *
 * Four hubs and the microphone in the middle column of five, so it sits dead
 * centre. Each hub reopens on the page you last used in it. Tapping the mic
 * starts listening straight away — the dialog deliberately does not focus its
 * text field, so no keyboard appears.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { open } = useLogDialogs();
  const { supported } = useSpeechRecognition(() => {});
  const current = hubFor(pathname)?.key ?? null;

  // A session is full-screen: the rest timer owns the bottom of the screen.
  if (pathname.startsWith("/training/session")) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid grid-cols-5 items-end">
        {HUBS.slice(0, 2).map((hub) => (
          <HubTab key={hub.key} hub={hub} active={current === hub.key} />
        ))}
        <li className="flex justify-center">
          <button
            type="button"
            onClick={() => open("quick", { listen: supported })}
            aria-label={supported ? "Dictate a command" : "Quick entry"}
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg outline-none transition-transform active:scale-95 focus-visible:ring-3 focus-visible:ring-brand/40"
          >
            <Mic className="size-6" aria-hidden />
          </button>
        </li>
        {HUBS.slice(2).map((hub) => (
          <HubTab key={hub.key} hub={hub} active={current === hub.key} />
        ))}
      </ul>
    </nav>
  );
}
