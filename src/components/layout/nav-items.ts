import type { LucideIcon } from "lucide-react";
import {
  Apple,
  BarChart3,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  Dumbbell,
  HeartPulse,
  Home,
  Salad,
  Scale,
  Sun,
  Target,
  Timer,
  Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Pages are grouped into hubs by what you came to do — look after your body,
 * run your day, check your money — so the phone needs four tabs instead of
 * thirteen, and every page in a hub is one tap from the others.
 */
export type HubKey = "today" | "health" | "day" | "money";

export interface Hub {
  key: HubKey;
  label: string;
  icon: LucideIcon;
  /** First page is where the hub opens until you have visited another. */
  pages: NavItem[];
}

export const HUBS: readonly Hub[] = [
  { key: "today", label: "Today", icon: Home, pages: [{ href: "/", label: "Today", icon: Home }] },
  {
    key: "health",
    label: "Health",
    icon: HeartPulse,
    pages: [
      { href: "/training", label: "Train", icon: Dumbbell },
      { href: "/food", label: "Food", icon: Apple },
      { href: "/diet", label: "Diet", icon: Salad },
      { href: "/body", label: "Body", icon: Scale },
      { href: "/history", label: "History", icon: BarChart3 },
    ],
  },
  {
    key: "day",
    label: "Day",
    icon: Sun,
    pages: [
      { href: "/plan", label: "Plan", icon: CalendarDays },
      { href: "/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/time", label: "Time", icon: Timer },
    ],
  },
  { key: "money", label: "Money", icon: Wallet, pages: [{ href: "/money", label: "Money", icon: Wallet }] },
];

/** Used weekly rather than daily: the desktop header shows them, the phone keeps them in More. */
export const SECONDARY_PAGES: readonly NavItem[] = [
  { href: "/career", label: "Career", icon: Briefcase },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/review", label: "Review", icon: CalendarCheck },
];

/** Every page, for indexes like the settings page. */
export const NAV_ITEMS: readonly NavItem[] = [...HUBS.flatMap((hub) => hub.pages), ...SECONDARY_PAGES];

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function hubFor(pathname: string): Hub | null {
  return HUBS.find((hub) => hub.pages.some((page) => isActivePath(pathname, page.href))) ?? null;
}

/** The hub page a path belongs to — "/training/session/x" is "/training". */
export function hubPageFor(hub: Hub, pathname: string): NavItem | null {
  return hub.pages.find((page) => isActivePath(pathname, page.href)) ?? null;
}
