"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HUBS, hubPageFor, type HubKey } from "./nav-items";
import { rememberHubPage } from "./hub-memory";
import { cn } from "@/lib/utils";

/**
 * The pages inside a hub, as one row of tabs at the top of each of them.
 * Rendered by the hub's route-group layout, so no page has to know about it.
 */
export function HubNav({ hub: key }: { hub: HubKey }) {
  const pathname = usePathname();
  const hub = HUBS.find((entry) => entry.key === key)!;
  const current = hubPageFor(hub, pathname);

  useEffect(() => {
    if (current) rememberHubPage(hub, current.href);
  }, [hub, current]);

  // A training session is full-screen; there is nothing to switch to mid-set.
  if (hub.pages.length < 2 || pathname.startsWith("/training/session")) return null;

  return (
    <nav aria-label={`${hub.label} sections`} className="-mx-4 mb-5 overflow-x-auto px-4 [scrollbar-width:none] lg:-mx-6 lg:px-6 [&::-webkit-scrollbar]:hidden">
      <ul className="flex gap-1.5">
        {hub.pages.map((page) => {
          const active = current?.href === page.href;
          return (
            <li key={page.href}>
              <Link
                href={page.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm whitespace-nowrap ring-1 transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "bg-foreground font-medium text-background ring-foreground"
                    : "bg-surface-2 text-muted-foreground ring-border hover:text-foreground",
                )}
              >
                <page.icon className="size-3.5" aria-hidden />
                {page.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
