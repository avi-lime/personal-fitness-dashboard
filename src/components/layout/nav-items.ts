import type { LucideIcon } from "lucide-react";
import {
  Apple,
  BarChart3,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  Dumbbell,
  Ellipsis,
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

export const MORE_ITEM: NavItem = { href: "/settings", label: "More", icon: Ellipsis };

/**
 * The phone tab bar, in order: two tabs, the microphone, then two tabs and
 * More. These are the pages worth a thumb-reach tab — the things logged many
 * times a day. Everything else lives behind More.
 */
export const MOBILE_TABS: readonly NavItem[] = ["/", "/food", "/tasks", "/money"]
  .map((href) => NAV_ITEMS.find((item) => item.href === href))
  .filter((item): item is NavItem => Boolean(item))
  .concat(MORE_ITEM);

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
