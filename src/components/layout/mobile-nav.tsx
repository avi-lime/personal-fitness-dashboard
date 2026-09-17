"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic } from "lucide-react";
import { MOBILE_TABS, isActivePath } from "./nav-items";
import { useLogDialogs } from "@/components/log/log-provider";
import { useSpeechRecognition } from "@/components/assistant/use-speech-recognition";
import { cn } from "@/lib/utils";

/**
 * Phone tab bar: Today · Food · mic · Tasks · Money · More.
 *
 * The microphone is the raised centre action, so it never covers page controls
 * the way a floating button would, and it is the one control reachable with a
 * thumb from any page. Tapping it starts listening straight away — the dialog
 * deliberately does not focus its text field, so no keyboard appears.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { open } = useLogDialogs();
  const { supported } = useSpeechRecognition(() => {});
  const left = MOBILE_TABS.slice(0, 2);
  const right = MOBILE_TABS.slice(2);

  const tab = (item: (typeof MOBILE_TABS)[number]) => {
    const active = isActivePath(pathname, item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
            active ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <item.icon className={cn("size-5", active && "text-brand")} aria-hidden />
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid grid-cols-6 items-end">
        {left.map(tab)}
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
        {right.map(tab)}
      </ul>
    </nav>
  );
}
