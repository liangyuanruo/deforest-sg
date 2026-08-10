import { renderOgImage } from "@/lib/og";

export const alt = "Deforest SG";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderOgImage();
}
