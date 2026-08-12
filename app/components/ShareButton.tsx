"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Check, Link as LinkIcon, MessageCircle, Send, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  buildShareUrl,
  productionBaseUrl,
  shareText,
  SITE_URL,
  telegramHref,
  whatsappHref,
} from "@/lib/share";
import type { ThreatenedProperties } from "@/lib/schema";
import { cn } from "@/lib/utils";

/** Values that only exist in the browser are read via `useSyncExternalStore`,
 *  which returns the server snapshot during SSR/hydration and the client one
 *  after — no hydration mismatch, and no forbidden setState-in-effect. They're
 *  constant for the session, so `subscribe` never needs to fire. */
const noSubscribe = () => () => {};

function useBrowserValue<T>(getClient: () => T, serverValue: T): T {
  return useSyncExternalStore(noSubscribe, getClient, () => serverValue);
}

export interface ShareButtonProps {
  /** The selected forest to share, or `null` to share the app itself. */
  site: ThreatenedProperties | null;
  /** Button size — `icon` in the header, `icon-sm` in the compact site card. */
  size?: "icon" | "icon-sm";
  className?: string;
}

/**
 * Share control: a dropdown offering WhatsApp, Telegram, and Copy-link. Every
 * link is UTM-tagged per channel and points at `/forest/<id>` when a forest is
 * selected (so the recipient lands on that forest, with its own social preview)
 * or `/` otherwise.
 */
export function ShareButton({ site, size = "icon", className }: ShareButtonProps) {
  const id = site?.id ?? null;
  const label = site?.label ?? null;
  const text = shareText(label);

  // Origin is resolved on the client: the canonical production domain when
  // Vercel exposes it (so shared links are stable), else the live origin (local
  // dev). SSR uses a valid absolute fallback so the first paint's links work.
  const origin = useBrowserValue(
    () => productionBaseUrl() ?? window.location.origin,
    productionBaseUrl() ?? SITE_URL,
  );
  const [copied, setCopied] = useState(false);

  const links = useMemo(() => {
    return {
      whatsapp: whatsappHref(buildShareUrl(origin, id, "whatsapp"), text),
      telegram: telegramHref(buildShareUrl(origin, id, "telegram"), text),
      copy: buildShareUrl(origin, id, "copy"),
    };
  }, [origin, id, text]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(links.copy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked (insecure context / permissions); no-op.
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size={size}
            aria-label={label ? `Share ${label}` : "Share this map"}
            className={className}
          >
            <Share2 />
          </Button>
        }
      />

      {/* A flat list of items only — deliberately no DropdownMenuLabel, which
          (base-ui's Menu.GroupLabel) requires a surrounding Menu.Group and
          throws "MenuGroupContext is missing" otherwise. Mirrors HeaderMenu. */}
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          render={
            <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" />
          }
        >
          <MessageCircle />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            <a href={links.telegram} target="_blank" rel="noopener noreferrer" />
          }
        >
          <Send />
          Telegram
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleCopy}
          closeOnClick={false}
          className={cn(copied && "text-primary focus:text-primary")}
        >
          {copied ? <Check /> : <LinkIcon />}
          {copied ? "Link copied" : "Copy link"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
