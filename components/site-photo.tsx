"use client";

import { useEffect, useRef, useState } from "react";
import { commonsFilePage, commonsImageUrl } from "@/lib/photos";

type Photo = { file: string; alt_en: string; alt_vi: string };

interface Props {
  photo?: Photo | null;
  /** Fallback background when there is no photo or it fails to load. */
  gradient: string;
  lang: "vi" | "en";
  /** Rendered width hint for the Commons thumbnail. */
  width?: number;
  className?: string;
  /** Show the "Photo: Wikimedia Commons" credit link (hero images). */
  credit?: boolean;
  /** Decorative thumbnails get an empty alt so screen readers skip them. */
  decorative?: boolean;
  priority?: boolean;
  /** Where the credit sits, so it never collides with buttons or cards over the photo. */
  creditAt?: "top-right" | "bottom-right";
}

/**
 * A site's photo, or an illustrated stand-in. The stand-in is also what shows
 * if Commons is unreachable, so a card never shows a broken image.
 */
export function SitePhoto({
  photo,
  gradient,
  lang,
  width = 800,
  className = "",
  credit = false,
  decorative = false,
  priority = false,
  creditAt = "bottom-right",
}: Props) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement | null>(null);
  const show = photo && !failed;

  // An image that failed before hydration never fires onError for React; catch it on mount.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: gradient }}>
      {show ? (
        // Plain <img>: the Worker deploy has no image optimizer, and Commons already resizes.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img}
          src={commonsImageUrl(photo.file, width)}
          alt={decorative ? "" : lang === "vi" ? photo.alt_vi : photo.alt_en}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          // Transparent text: alt text never paints over the frame while loading or broken.
          className="absolute inset-0 size-full object-cover text-transparent"
        />
      ) : (
        <Illustration />
      )}
      {show && credit && (
        <a
          href={commonsFilePage(photo.file)}
          target="_blank"
          rel="noreferrer"
          className={
            "bg-ink/45 text-paper/90 hover:bg-ink/60 absolute right-2 z-10 rounded-full px-2 py-0.5 text-[10px] backdrop-blur-sm " +
            (creditAt === "top-right" ? "top-[calc(0.5rem+var(--safe-top))]" : "bottom-1.5")
          }
        >
          {lang === "vi" ? "Ảnh: Wikimedia Commons" : "Photo: Wikimedia Commons"}
        </a>
      )}
    </div>
  );
}

/** Layered hills and water: a quiet, on-brand stand-in for a missing photo. */
function Illustration() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
    >
      <circle cx="300" cy="70" r="28" fill="#F7F4EE" opacity="0.18" />
      <path
        d="M0 150 C60 110 120 120 170 135 S280 100 400 125 V240 H0Z"
        fill="#F7F4EE"
        opacity="0.14"
      />
      <path
        d="M0 175 C80 150 150 165 220 160 S330 140 400 155 V240 H0Z"
        fill="#1F2428"
        opacity="0.18"
      />
      <path
        d="M0 200 C90 190 170 205 260 196 S360 188 400 194 V240 H0Z"
        fill="#1F2428"
        opacity="0.22"
      />
      {[212, 224].map((y) => (
        <path
          key={y}
          d={`M30 ${y} Q120 ${y - 5} 210 ${y} T390 ${y}`}
          stroke="#F7F4EE"
          strokeOpacity="0.25"
          fill="none"
        />
      ))}
    </svg>
  );
}
