import type { LucideIcon } from "lucide-react";
import {
  Apple,
  BarChart3,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  Dumbbell,
  Home,
  Scale,
  Target,
  Timer,
  Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** One list drives the desktop header nav, the phone tab bar and the More page. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Today", icon: Home },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/time", label: "Time", icon: Timer },
  { href: "/money", label: "Money", icon: Wallet },
  { href: "/career", label: "Career", icon: Briefcase },
  { href: "/food", label: "Food", icon: Apple },
  { href: "/training", label: "Training", icon: Dumbbell },
  { href: "/body", label: "Body", icon: Scale },
  { href: "/history", label: "History", icon: BarChart3 },
  { href: "/review", label: "Review", icon: CalendarCheck },
  { href: "/goals", label: "Goals", icon: Target },
];

/**
 * The phone tab bar: two tabs, the microphone, two tabs.
 *
 * Exactly four, so the raised microphone lands in the middle column of five
 * and sits dead centre — an even number of slots would always leave it half a
 * column off. These are the pages worth a thumb-reach tab; everything else is
 * behind More in the header.
 */
export const MOBILE_TABS: readonly NavItem[] = ["/", "/food", "/tasks", "/money"]
  .map((href) => NAV_ITEMS.find((item) => item.href === href))
  .filter((item): item is NavItem => Boolean(item));

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
