"use client";

import Link from "next/link";
import { LogOut, Monitor, MonitorPlay, Moon, MoreHorizontal, Settings, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/server/actions/auth";
import { SECONDARY_PAGES } from "./nav-items";

/**
 * More: the weekly pages, then monitor, theme and sign-out, behind one trigger.
 *
 * The phone's tab bar covers the hubs; Career, Goals and Review live here. On
 * desktop the header already shows them in a row, so the list hides.
 */
export function HeaderMenu() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="More">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="md:hidden">
          {SECONDARY_PAGES.map((page) => (
            <DropdownMenuItem key={page.href} asChild>
              <Link href={page.href}>
                <page.icon className="size-4" /> {page.label}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
        </div>
        <DropdownMenuItem asChild>
          <Link href="/monitor">
            <MonitorPlay className="size-4" /> Monitor mode
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" /> System
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" /> Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logoutAction()}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
