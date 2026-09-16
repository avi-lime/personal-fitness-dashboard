import type { LucideIcon } from "lucide-react";
import {
  Apple,
  BarChart3,
  Dumbbell,
  Ellipsis,
  Home,
  Scale,
  Target,
  CalendarCheck,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone tab bar (keep to five). */
  mobile?: boolean;
}

/** One list drives the desktop header nav and the phone tab bar. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Today", icon: Home, mobile: true },
  { href: "/food", label: "Food", icon: Apple, mobile: true },
  { href: "/training", label: "Training", icon: Dumbbell, mobile: true },
  { href: "/body", label: "Body", icon: Scale, mobile: true },
  { href: "/history", label: "History", icon: BarChart3 },
  { href: "/review", label: "Review", icon: CalendarCheck },
  { href: "/goals", label: "Goals", icon: Target },
];

export const MORE_ITEM: NavItem = { href: "/settings", label: "More", icon: Ellipsis, mobile: true };

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
