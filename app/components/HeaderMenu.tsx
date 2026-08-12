"use client";

import { ExternalLink, Info, Menu, Moon, Sun } from "lucide-react";

import { GITHUB_REPO_URL, GithubMark } from "@/components/AboutModal";
import { ThemeToggle, useTheme } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Mobile-only "hamburger" that collapses the secondary header actions —
 * light/dark, About, GitHub — behind one button, since a phone row can't hold
 * them all alongside the search field and filter. On desktop these render inline
 * instead (see the header in Explorer); this whole control is `sm:hidden`.
 */
export function HeaderMenu({
  onOpenAbout,
  className,
}: {
  onOpenAbout: () => void;
  className?: string;
}) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="More options"
            className={className}
          >
            <Menu />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={toggle}>
          {dark ? <Sun /> : <Moon />}
          {dark ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenAbout}>
          <Info />
          About
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View the source and analysis on GitHub"
            />
          }
        >
          <GithubMark />
          GitHub
          <ExternalLink className="ml-auto" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Re-export so callers can import the desktop inline toggle from one module.
export { ThemeToggle };
