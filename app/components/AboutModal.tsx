"use client";

import type { SVGProps } from "react";
import { useRef } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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
        className="max-sm:top-0 max-sm:left-0 max-sm:h-full max-sm:max-h-full max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:grid-rows-[auto_minmax(0,1fr)_auto] max-sm:rounded-none sm:max-w-2xl"
        initialFocus={titleRef}
      >
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1} className="pr-8 outline-none">
              Which forests does the Master Plan 2025 plan to develop?
            </DialogTitle>
            <DialogDescription>
              In August 2026 the government named Maju Forest and Gillman
              Barracks as sites to be developed for housing over the next
              decade. This project asks a simple question: what else?
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] min-h-0 flex-col gap-4 overflow-y-auto pr-1 text-sm text-foreground max-sm:max-h-none">
            <section>
              <h3 className="font-semibold">What this shows</h3>
              <p className="mt-1 text-muted-foreground">
                It overlays crowd-sourced forest cover (OpenStreetMap{" "}
                <code>natural=forest</code>) against the URA Master Plan 2025
                land-use layer to surface every secondary-forest patch that
                sits on development-zoned land — with names, sizes, intended
                land use, and context. Of roughly 5,007 ha of mapped forest,
                about 2,941 ha (~59%) lies on land the Master Plan 2025 zones
                for development, led by RESERVE SITE, RESIDENTIAL and SPECIAL
                USE.
              </p>
            </section>

            <section>
              <h3 className="font-semibold">How to read it</h3>
              <p className="mt-1 text-muted-foreground">
                The &ldquo;threatened area&rdquo; of a patch is the part that
                falls on development-zoned land — the at-risk portion, not
                the whole forest. RESERVE SITE is land held for future use: a
                strong but not imminent signal. Zoning for development does
                not guarantee clearance.
              </p>
            </section>

            <section>
              <h3 className="font-semibold">Why OpenStreetMap?</h3>
              <p className="mt-1 text-muted-foreground">
                There is no official, authoritative vector dataset of
                Singapore&rsquo;s <em>secondary</em> forests, which makes
                OpenStreetMap the most practical choice.
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
                <li>
                  <span className="font-semibold text-foreground">
                    Official data maps only gazetted spaces.
                  </span>{" "}
                  NParks / data.gov.sg vector datasets cover statutorily
                  protected or managed areas — Central Catchment, Bukit
                  Timah, Sungei Buloh, managed parks — not the non-gazetted
                  secondary growth that patches like Clementi, Dover or
                  Tengah forest represent.
                </li>
                <li>
                  <span className="font-semibold text-foreground">
                    The Master Plan tracks zoning intent, not ground cover.
                  </span>{" "}
                  A &ldquo;RESERVE SITE&rdquo; polygon might currently be a
                  50-year-old secondary forest or a flat patch of grass — URA
                  classifies both identically by future administrative
                  intent. Official data alone is blind to what actually
                  grows inside a development zone.
                </li>
                <li>
                  <span className="font-semibold text-foreground">
                    OSM is a vector of physical reality.
                  </span>{" "}
                  Local contributors trace high-resolution satellite imagery
                  (Sentinel, Maxar) and digitize dense canopy as{" "}
                  <code>natural=forest</code> polygons — a pre-vectorized map
                  of physical ground cover that aligns directly with the URA
                  vector layer.
                </li>
                <li>
                  <span className="font-semibold text-foreground">
                    The only authoritative alternative is raster.
                  </span>{" "}
                  Satellite land-cover products (ESA WorldCover 10 m, Google
                  Dynamic World, Hansen Global Forest Change) are
                  scientifically validated but ship as pixel grids, requiring
                  raster-to-vector conversion and heavy cleanup — 10 m
                  pixels routinely misclassify urban shadows, rooftops and
                  roadside planting as &ldquo;forest&rdquo;.
                </li>
              </ul>
              <p className="mt-2 text-muted-foreground">
                So OSM <code>natural=forest</code> is the most frictionless
                pre-vectorized canopy source for this comparison — presented
                here honestly, with its limits stated below.
              </p>
            </section>

            <section>
              <h3 className="font-semibold">How far does this go?</h3>
              <p className="mt-1 text-muted-foreground">
                The one announced site this method can honestly test is Maju
                Forest — a named secondary forest the analysis recovers by its
                OpenStreetMap name (~21.7 ha on development-zoned land). That is
                a sanity check, not a proof: it shows the overlay finds a known
                forest, nothing more.
              </p>
              <p className="mt-2 text-muted-foreground">
                The other announced site, Gillman Barracks, is deliberately
                left out. Its redevelopment is mostly about the historic
                barracks buildings, not forest clearance, so a
                forest-versus-zoning overlay can&rsquo;t claim to
                &ldquo;recover&rdquo; it without conflating the two. Treat every
                unannounced patch here as a lead to verify, not a confirmed
                plan.
              </p>
            </section>

            <section>
              <h3 className="font-semibold">Caveats</h3>
              <p className="mt-1 text-muted-foreground">
                OSM canopy is crowd-sourced, not an official survey; currency
                varies and some mapped &ldquo;forest&rdquo; may already be
                cleared. Development zoning does not guarantee clearance.
                This is the planned footprint under Master Plan 2025 — not a
                measured increase versus the 2019 plan.
              </p>
            </section>

            <section>
              <h3 className="font-semibold">Data sources</h3>
              <p className="mt-1 text-muted-foreground">
                Announcement:{" "}
                <a
                  href="https://www.straitstimes.com/singapore/politics/gillman-barracks-maju-forest-need-to-be-developed-to-meet-housing-needs-over-next-decade-alvin-tan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  Straits Times
                </a>
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>
                  <a
                    href="https://data.gov.sg/datasets/d_a8c3546b26712e35021f3a681d0353ae/view"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    URA Master Plan 2025 Land Use Layer
                  </a>
                </li>
                <li>
                  <a
                    href="https://download2.bbbike.org/osm/extract/planet_103.531,1.213_104.195,1.644.osm.shp.zip"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    OpenStreetMap Singapore (BBBike extract)
                  </a>
                </li>
              </ul>
            </section>
          </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Close</Button>} />
          <Button
            nativeButton={false}
            render={
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <GithubMark />
            View the analysis on GitHub
            <ExternalLink />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
