import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  forestPath,
  shareText,
  SITE_URL,
  telegramHref,
  whatsappHref,
} from "@/lib/share";

describe("forestPath", () => {
  it("encodes a selected forest as /forest/<id>", () => {
    expect(forestPath(42)).toBe("/forest/42");
  });

  it("is the app root when nothing is selected", () => {
    expect(forestPath(null)).toBe("/");
  });

  it("encodes an already-cleared forest by its UUID under the same route", () => {
    expect(forestPath("8cbcd280-96e8-11f1-9962-e3c92fbd79cc")).toBe(
      "/forest/8cbcd280-96e8-11f1-9962-e3c92fbd79cc",
    );
  });
});

describe("buildShareUrl", () => {
  it("tags a forest link with per-channel UTM params", () => {
    const url = new URL(buildShareUrl(SITE_URL, 42, "whatsapp"));
    expect(url.pathname).toBe("/forest/42");
    expect(url.searchParams.get("utm_source")).toBe("whatsapp");
    expect(url.searchParams.get("utm_medium")).toBe("share");
    expect(url.searchParams.get("utm_campaign")).toBe("forest_share");
  });

  it("uses the app_share campaign when no forest is selected", () => {
    const url = new URL(buildShareUrl(SITE_URL, null, "telegram"));
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("utm_source")).toBe("telegram");
    expect(url.searchParams.get("utm_campaign")).toBe("app_share");
  });

  it("maps copy and native to their own utm_source values", () => {
    expect(
      new URL(buildShareUrl(SITE_URL, 1, "copy")).searchParams.get("utm_source"),
    ).toBe("copy_link");
    expect(
      new URL(buildShareUrl(SITE_URL, 1, "native")).searchParams.get("utm_source"),
    ).toBe("web_share");
  });

  it("respects a runtime origin (e.g. a preview deploy)", () => {
    const url = buildShareUrl("https://preview.example.com", 7, "copy");
    expect(url.startsWith("https://preview.example.com/forest/7")).toBe(true);
  });
});

describe("shareText", () => {
  it("names the forest when one is selected", () => {
    expect(shareText("Maju Forest")).toContain("Maju Forest");
  });

  it("falls back to the app-level question with no forest", () => {
    expect(shareText(null)).toBe(
      "Which forests will Singapore lose to development?",
    );
  });

  it("uses past-tense phrasing for an already-cleared forest", () => {
    const text = shareText("Tengah Forest", true);
    expect(text).toContain("Tengah Forest");
    expect(text).toContain("already cleared");
  });
});

describe("channel deep-links", () => {
  const shareUrl = "https://deforest-sg.vercel.app/forest/42?utm_source=whatsapp";
  const text = "Maju Forest is threatened.";

  it("builds a wa.me link with the text and url combined and encoded", () => {
    const href = whatsappHref(shareUrl, text);
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(href)).toContain(text);
    expect(decodeURIComponent(href)).toContain(shareUrl);
  });

  it("builds a t.me/share link with url and text as separate params", () => {
    const href = telegramHref(shareUrl, text);
    expect(href.startsWith("https://t.me/share/url?")).toBe(true);
    const q = new URL(href).searchParams;
    expect(q.get("url")).toBe(shareUrl);
    expect(q.get("text")).toBe(text);
  });
});
