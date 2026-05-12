"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import { TRACK_COLOR, type TrackKey } from "@/lib/tracks";
import { PROVINCE_CENTER, PROVINCE_ZOOM } from "@/lib/sample-sites";

export interface MapSite {
  slug: string;
  name_vi: string;
  name_en: string;
  lat: number;
  lng: number;
  primary_track: TrackKey;
}

interface Props {
  sites: MapSite[];
  activeTrack: TrackKey;
  onSitePick?: (slug: string) => void;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function MapView(props: Props) {
  if (MAPBOX_TOKEN) return <MapboxMapView {...props} />;
  return <FallbackMapView {...props} />;
}

// ── Mapbox path ───────────────────────────────────────────────────
function MapboxMapView({ sites, activeTrack, onSitePick }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      if (!container.current) return;
      const mapbox = await import("mapbox-gl");
      await import("mapbox-gl/dist/mapbox-gl.css");
      if (cancelled || !container.current) return;

      mapbox.default.accessToken = MAPBOX_TOKEN!;
      const map = new mapbox.default.Map({
        container: container.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [PROVINCE_CENTER.lng, PROVINCE_CENTER.lat],
        zoom: PROVINCE_ZOOM,
        pitch: 45,
        bearing: 0,
        attributionControl: false,
      });
      mapRef.current = map;

      map.on("load", () => {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });
        setReady(true);
      });

      cleanup = () => {
        markers.current.forEach((m) => m.remove());
        markers.current = [];
        map.remove();
        mapRef.current = null;
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  // Re-render markers when sites or activeTrack change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    (async () => {
      const mapbox = await import("mapbox-gl");
      sites.forEach((s) => {
        const el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", `Open ${s.name_en}`);
        el.style.width = "14px";
        el.style.height = "14px";
        el.style.borderRadius = "999px";
        el.style.cursor = "pointer";
        el.style.border = "none";
        el.style.background = TRACK_COLOR[s.primary_track];
        el.style.boxShadow = "0 0 0 2px #fff, 0 2px 6px rgba(31,36,40,.3)";
        el.style.transform = s.primary_track === activeTrack ? "scale(1.4)" : "scale(1)";
        el.style.transition = "transform 240ms cubic-bezier(.32,.72,0,1)";
        el.onclick = () => onSitePick?.(s.slug);

        const marker = new mapbox.default.Marker({ element: el })
          .setLngLat([s.lng, s.lat])
          .addTo(map);
        markers.current.push(marker);
      });
    })();
  }, [sites, activeTrack, ready, onSitePick]);

  return <div ref={container} className="absolute inset-0" />;
}

// ── Fallback (no Mapbox token) ───────────────────────────────────
function FallbackMapView({ sites, activeTrack, onSitePick }: Props) {
  // Project lat/lng → percent positions within a Quang Tri bounding box.
  const BBOX = { minLat: 16.55, maxLat: 17.25, minLng: 106.65, maxLng: 107.4 };
  const project = (lat: number, lng: number) => ({
    x: ((lng - BBOX.minLng) / (BBOX.maxLng - BBOX.minLng)) * 100,
    y: ((BBOX.maxLat - lat) / (BBOX.maxLat - BBOX.minLat)) * 100,
  });

  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse at 30% 40%, #5C7F8A 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, #9A7E5B 0%, transparent 55%), linear-gradient(160deg, #4A6B6F 0%, #2F4549 100%)",
      }}
    >
      <svg viewBox="0 0 400 800" className="absolute inset-0 size-full opacity-20" aria-hidden>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <path
            key={i}
            d={`M0,${100 + i * 100} Q120,${80 + i * 100} 240,${110 + i * 100} T400,${90 + i * 100}`}
            stroke="#F7F4EE"
            strokeWidth="0.7"
            fill="none"
          />
        ))}
      </svg>
      <svg viewBox="0 0 400 800" className="absolute inset-0 size-full opacity-55" aria-hidden>
        <path
          d="M-20,420 Q80,400 180,440 T400,460"
          stroke="#0A3641"
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
        />
      </svg>

      {sites.map((s) => {
        const { x, y } = project(s.lat, s.lng);
        const active = s.primary_track === activeTrack;
        return (
          <button
            key={s.slug}
            type="button"
            aria-label={`Open ${s.name_en}`}
            onClick={() => onSitePick?.(s.slug)}
            className="absolute z-10 cursor-pointer rounded-full border-0 p-0 transition"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: 14,
              height: 14,
              background: TRACK_COLOR[s.primary_track],
              boxShadow: "0 0 0 2px #fff, 0 2px 6px rgba(31,36,40,.3)",
              transform: `translate(-50%,-100%) scale(${active ? 1.4 : 1})`,
              transitionDuration: "240ms",
              transitionTimingFunction: "cubic-bezier(.32,.72,0,1)",
            }}
          />
        );
      })}

      <p
        className="absolute bottom-3 left-0 right-0 text-center font-mono text-[11px] text-paper/70"
        aria-live="polite"
      >
        Map fallback · add NEXT_PUBLIC_MAPBOX_TOKEN for 3D terrain
      </p>
    </div>
  );
}
