"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HUBS, SECONDARY_PAGES, hubFor, isActivePath, type Hub } from "./nav-items";
import { useHubHref } from "./hub-memory";
import { cn } from "@/lib/utils";

const linkClass = (active: boolean) =>
  cn(
    "rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    active
      ? "bg-secondary font-medium text-secondary-foreground"
      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
  );

function HubLink({ hub, active }: { hub: Hub; active: boolean }) {
  const href = useHubHref(hub);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
      {hub.label}
    </Link>
  );
}

/** Desktop header: the four hubs, then the weekly pages. Hub pages switch inside the hub. */
export function NavLinks() {
  const pathname = usePathname();
  const current = hubFor(pathname)?.key ?? null;

  return (
    <nav aria-label="Main" className="flex items-center gap-0.5 overflow-x-auto">
      {HUBS.map((hub) => (
        <HubLink key={hub.key} hub={hub} active={current === hub.key} />
      ))}
      <span className="mx-1.5 h-4 w-px bg-border" aria-hidden />
      {SECONDARY_PAGES.map((page) => {
        const active = isActivePath(pathname, page.href);
        return (
          <Link key={page.href} href={page.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
            {page.label}
          </Link>
        );
      })}
    </nav>
  );
}
