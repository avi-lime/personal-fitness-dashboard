"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MORE_ITEM, NAV_ITEMS, isActivePath } from "./nav-items";
import { cn } from "@/lib/utils";

/** Phone tab bar. Five destinations, thumb-sized, above the home indicator. */
export function MobileNav() {
  const pathname = usePathname();
  const items = [...NAV_ITEMS.filter((item) => item.mobile), MORE_ITEM].slice(0, 5);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
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
        })}
      </ul>
    </nav>
  );
}
