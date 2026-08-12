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

  // Sync React state to the `.dark` class on <html> — the source of truth. The
  // initial read is deferred to the next frame so it isn't a synchronous
  // set-state-in-effect (which also keeps the first client render identical to
  // the server's, avoiding a mismatch). A MutationObserver then keeps *every*
  // hook instance in sync with any later change to the class, whichever instance
  // (or the pre-paint script) made it — so a toggle from the header button also
  // updates the map's theme, not just the button's own state.
  useEffect(() => {
    const el = document.documentElement;
    const sync = () =>
      setTheme(el.classList.contains("dark") ? "dark" : "light");
    const id = requestAnimationFrame(sync);
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => {
      cancelAnimationFrame(id);
      observer.disconnect();
    };
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
