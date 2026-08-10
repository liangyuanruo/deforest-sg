"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark";

/**
 * Read/write the app's light-dark preference. The `.dark` class on <html> is the
 * source of truth (set pre-paint by the inline script in layout.tsx, then toggled
 * here and persisted to localStorage). Client-only — the map/app is fully client
 * rendered, so reading the DOM in an effect is safe.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  // Sync React state to whatever the pre-paint script decided. Deferred to the
  // next frame so it is not a synchronous set-state-in-effect (which also keeps
  // the first client render identical to the server's, avoiding a mismatch).
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      ),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // localStorage unavailable — still toggled for this session.
    }
    setTheme(next);
  }, []);

  return { theme, toggle };
}

/**
 * Icon button that flips light/dark. Both glyphs are always in the DOM (only
 * their visibility differs) so server and first client render are identical —
 * the icon just swaps after mount once the real theme is known.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            className={className}
          >
            <Sun className={cn(dark ? "hidden" : "block")} />
            <Moon className={cn(dark ? "block" : "hidden")} />
          </Button>
        }
      />
      <TooltipContent>{dark ? "Light mode" : "Dark mode"}</TooltipContent>
    </Tooltip>
  );
}
