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
  /** Shown in the phone tab bar (keep to five). */
  mobile?: boolean;
}

/** One list drives the desktop header nav and the phone tab bar. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Today", icon: Home, mobile: true },
  { href: "/plan", label: "Plan", icon: CalendarDays, mobile: true },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, mobile: true },
  { href: "/time", label: "Time", icon: Timer },
  { href: "/money", label: "Money", icon: Wallet, mobile: true },
  { href: "/career", label: "Career", icon: Briefcase },
  { href: "/food", label: "Food", icon: Apple },
  { href: "/training", label: "Training", icon: Dumbbell },
  { href: "/body", label: "Body", icon: Scale },
  { href: "/history", label: "History", icon: BarChart3 },
  { href: "/review", label: "Review", icon: CalendarCheck },
  { href: "/goals", label: "Goals", icon: Target },
];

export const MORE_ITEM: NavItem = { href: "/settings", label: "More", icon: Ellipsis, mobile: true };

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
