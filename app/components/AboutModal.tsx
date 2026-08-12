"use client";

import type { SVGProps } from "react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const GITHUB_REPO_URL = "https://github.com/liangyuanruo/deforest";

/**
 * GitHub octocat mark. This lucide-react version ships no brand/logo icons
 * (no `Github` export), so the mark is inlined here instead of adding a
 * dependency. Deliberately has no `size-*` class so it picks up Button's
 * `[&_svg:not([class*='size-'])]:size-4` sizing like any lucide icon.
 */
export function GithubMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/** Icon-button linking to the GitHub repo so anyone can verify the analysis. */
export function GitHubLink({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            nativeButton={false}
            className={cn(className)}
            render={
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View the source and analysis on GitHub"
              />
            }
          />
        }
      >
        <GithubMark />
      </TooltipTrigger>
      <TooltipContent>View the source and analysis on GitHub</TooltipContent>
    </Tooltip>
  );
}

/**
 * About / motivation dialog. Controlled by the header — opened only from the
 * desktop "About" button or the mobile hamburger menu item; it never auto-opens.
 * Renders no trigger of its own. Full-screen on phones, a centered dialog on
 * desktop.
 */
export function AboutModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Focused when the dialog opens so it starts at the top (otherwise base-ui
  // focuses the first link and scrolls the title out of view).
  const titleRef = useRef<HTMLHeadingElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-sm:top-0 max-sm:left-0 max-sm:h-full max-sm:max-h-full max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:grid-rows-[minmax(0,1fr)] max-sm:rounded-none sm:max-w-2xl sm:p-6"
        initialFocus={titleRef}
      >
        <div className="mt-8 flex max-h-[70vh] min-h-0 flex-col gap-7 overflow-y-auto px-2 pr-4 pb-2 text-sm leading-relaxed text-muted-foreground max-sm:max-h-none sm:px-3">
          <header className="space-y-3">
            <DialogTitle
              ref={titleRef}
              tabIndex={-1}
              className="font-semibold text-foreground outline-none"
            >
              Which forests does the URA Master Plan 2025 zone for development?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              In August 2026 the government{" "}
              <a
                href="https://www.straitstimes.com/singapore/politics/gillman-barracks-maju-forest-need-to-be-developed-to-meet-housing-needs-over-next-decade-alvin-tan"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                named two sites
              </a>{" "}
              — Maju Forest and Gillman Barracks — to be developed for housing
              over the next decade. This project asks the obvious follow-up:{" "}
              <span className="text-foreground">what else?</span> It maps the
              secondary forest that the URA Master Plan 2025 already zones for
              development, so the trade-off is visible rather than buried in a
              planning layer.
            </DialogDescription>
          </header>

          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">
              Not a new question
            </h3>
            <p>
              This trade-off predates the 2026 announcement. In 2021, plans to
              clear Dover Forest for housing — a roughly 33 ha secondary forest
              that had grown undisturbed for more than 40 years — drew a public
              petition of over 30,000 signatures within five days and a
              conservation proposal from the Nature Society (Singapore). After
              consultation, the government{" "}
              <a
                href="https://www.straitstimes.com/singapore/environment/keeping-half-of-dover-forest-as-a-nature-park-a-win-nature-groups-residents"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                kept the western half
              </a>{" "}
              for review about a decade later and released the eastern portion
              (~11 ha) for housing, with part of it set aside as a nature park.
            </p>
            <p>
              Dover follows the same pattern as the announced sites: forest
              growing quietly on land the Master Plan had long zoned for
              development, noticed only once clearance loomed. This map tries to
              surface those patches before that point — not after.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">What this shows</h3>
            <p>
              The map overlays crowd-sourced forest cover (OpenStreetMap{" "}
              <code>natural=forest</code>) on the URA Master Plan 2025 land-use
              layer, and surfaces every patch of secondary forest that sits on
              development-zoned land — each with its name, size, intended land
              use, and context. Of roughly{" "}
              <span className="text-foreground">5,000 ha</span> of mapped
              forest, about{" "}
              <span className="text-foreground">2,940 ha (59%)</span> falls on
              land the plan zones for development. The largest shares are
              RESERVE SITE, RESIDENTIAL and SPECIAL USE.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">How to read it</h3>
            <p>
              The <span className="text-foreground">vulnerable area</span> of a
              patch is only the part that falls on development-zoned land — the
              geometric overlap between the mapped forest and the Master Plan
              zone, measured in metres (SVY21), not the whole forest. A forest
              half-covered by a residential zone contributes only that half.
            </p>
            <p>
              RESERVE SITE — the single largest category here — is land held for
              possible future use: a strong signal, but not an imminent one.
              Zoning for development records intent; it is not a clearance
              order. Read every patch as a question to ask, not a verdict.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">Why OpenStreetMap?</h3>
            <p>
              There is no official, authoritative map of Singapore&rsquo;s{" "}
              <em>secondary</em> forests drawn as precise outlines (vectors), so
              mapping them at all means choosing an imperfect source.
              OpenStreetMap is the most practical one, for four reasons.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-semibold text-foreground">
                  Official data maps only gazetted (legally designated) spaces.
                </span>{" "}
                NParks / data.gov.sg datasets cover protected or managed areas —
                Central Catchment, Bukit Timah, Sungei Buloh, managed parks —
                not the informal secondary growth that patches like Clementi,
                Dover or Tengah forest represent.
              </li>
              <li>
                <span className="font-semibold text-foreground">
                  The Master Plan tracks zoning intent, not ground cover.
                </span>{" "}
                A &ldquo;RESERVE SITE&rdquo; zone might today be a 50-year-old
                secondary forest or a bare patch of grass — the plan classifies
                both the same way, by their intended future use. Official data
                alone is blind to what actually grows inside a development zone.
              </li>
              <li>
                <span className="font-semibold text-foreground">
                  OSM maps what is actually on the ground.
                </span>{" "}
                Local contributors trace high-resolution satellite imagery
                (Sentinel, Maxar) and draw dense canopy as{" "}
                <code>natural=forest</code> outlines — a ready-made map of tree
                cover that lines up directly with the URA zoning layer.
              </li>
              <li>
                <span className="font-semibold text-foreground">
                  The only authoritative alternative is pixels.
                </span>{" "}
                Satellite land-cover products (ESA WorldCover 10 m, Google
                Dynamic World, Hansen Global Forest Change) are scientifically
                validated but come as pixel grids (rasters) that need converting
                to outlines and heavy cleanup — at 10 m resolution, pixels
                routinely mistake urban shadows, rooftops and roadside planting
                for &ldquo;forest&rdquo;.
              </li>
            </ul>
            <p>
              So OSM <code>natural=forest</code> is the most direct ready-made
              record of tree cover for this comparison — used here openly, with
              its limits stated below.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">
              How far does this go?
            </h3>
            <p>
              The one announced site this method can honestly test is Maju
              Forest — a named secondary forest the analysis finds by its
              OpenStreetMap name (~21.7 ha on development-zoned land). That is a
              sanity check, not a proof: it shows the overlay finds a known
              forest, nothing more.
            </p>
            <p>
              The other announced site, Gillman Barracks, is deliberately left
              out. Its redevelopment is mostly about the historic barracks
              buildings, not forest clearance, so a forest-versus-zoning overlay
              can&rsquo;t claim to &ldquo;recover&rdquo; it without blurring the
              two. Treat every unannounced patch here as a lead to verify, not a
              confirmed plan.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">Caveats</h3>
            <p>
              OSM&rsquo;s forest data is crowd-sourced, not an official survey —
              how up-to-date it is varies, and some mapped &ldquo;forest&rdquo;
              may already be cleared or was never dense to begin with. This is
              the footprint planned under Master Plan 2025, not a measured
              increase over the 2019 plan.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-foreground">Data sources</h3>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <a
                  href="https://www.straitstimes.com/singapore/politics/gillman-barracks-maju-forest-need-to-be-developed-to-meet-housing-needs-over-next-decade-alvin-tan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  Development announcement
                </a>{" "}
                — Straits Times
              </li>
              <li>
                <a
                  href="https://data.gov.sg/datasets/d_a8c3546b26712e35021f3a681d0353ae/view"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  URA Master Plan 2025 Land Use Layer
                </a>{" "}
                — data.gov.sg
              </li>
              <li>
                <a
                  href="https://download2.bbbike.org/osm/extract/planet_103.531,1.213_104.195,1.644.osm.shp.zip"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  OpenStreetMap Singapore forest cover
                </a>{" "}
                — BBBike extract
              </li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
