"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import { TRACK_COLOR, type TrackKey } from "@/lib/tracks";
import { PROVINCE_CENTER, PROVINCE_ZOOM, SHORT_NAME } from "@/lib/sample-sites";
import { labelStyle, layoutLabels } from "@/lib/label-layout";

export interface MapSite {
  slug: string;
  name_vi: string;
  name_en: string;
  lat: number;
  lng: number;
  primary_track: TrackKey;
}

/** A planned day drawn on the map: numbered stops joined by travel legs. */
export interface MapRoute {
  stops: { slug: string; lat: number; lng: number }[];
  legs: { geometry: [number, number][]; mode: "drive" | "drive+boat" }[];
}

interface Props {
  sites: MapSite[];
  activeTrack: TrackKey;
  onSitePick?: (slug: string) => void;
  route?: MapRoute | null;
  /** The traveller's position, once they share it. */
  you?: { lat: number; lng: number } | null;
  lang?: "vi" | "en";
  /** Share of the map's height covered by a bottom sheet; pins and fits stay above it. */
  bottomInset?: number;
  /** The place being previewed: its pin is drawn larger and the map centres on it. */
  selected?: string | null;
}

function pinLabel(s: MapSite, lang: "vi" | "en") {
  return SHORT_NAME[s.slug]?.[lang] ?? (lang === "vi" ? s.name_vi : s.name_en);
}

const YOU_COLOR = "#2E7DD1";

const ROUTE_COLOR = "#0F4C5C";

function stopNumbers(route: MapRoute | null | undefined): Map<string, number> {
  return new Map((route?.stops ?? []).map((s, i) => [s.slug, i + 1]));
}

/** Boat crossings are drawn dashed: split a drive+boat leg at its pier. */
function legSegments(route: MapRoute) {
  const drive: [number, number][][] = [];
  const boat: [number, number][][] = [];
  for (const leg of route.legs) {
    if (leg.mode === "drive+boat" && leg.geometry.length >= 3) {
      drive.push(leg.geometry.slice(0, -1));
      boat.push(leg.geometry.slice(-2));
    } else {
      drive.push(leg.geometry);
    }
  }
  return { drive, boat };
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function MapView(props: Props) {
  if (MAPBOX_TOKEN) return <MapboxMapView {...props} />;
  return <FallbackMapView {...props} />;
}

// ── Mapbox path ───────────────────────────────────────────────────
function MapboxMapView({
  sites,
  activeTrack,
  onSitePick,
  route,
  you,
  lang = "en",
  bottomInset = 0,
  selected = null,
}: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  // Read once when the map loads; the map itself is created a single time.
  const initial = useRef({ sites, bottomInset });
  initial.current = { sites, bottomInset };

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
        // Keep every site in the part of the map the bottom sheet doesn't cover.
        const { sites: all, bottomInset: inset } = initial.current;
        const pad = {
          top: 80,
          bottom: Math.round(window.innerHeight * inset) + 24,
          left: 32,
          right: 32,
        };
        map.setPadding(pad);
        if (all.length > 1) {
          map.fitBounds(
            [
              [Math.min(...all.map((x) => x.lng)), Math.min(...all.map((x) => x.lat))],
              [Math.max(...all.map((x) => x.lng)), Math.max(...all.map((x) => x.lat))],
            ],
            { padding: pad, duration: 0 },
          );
        }
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

    const numbers = stopNumbers(route);
    const labels = new Map<string, HTMLSpanElement>();
    (async () => {
      const mapbox = await import("mapbox-gl");
      sites.forEach((s) => {
        const n = numbers.get(s.slug);
        // Zero-size anchor at the site: dot centred on it, label placed around it.
        const wrap = document.createElement("div");
        wrap.style.cssText = "position:relative;width:0;height:0";
        const el = document.createElement("button");
        el.type = "button";
        el.setAttribute("aria-label", lang === "vi" ? s.name_vi : s.name_en);
        el.style.width = "14px";
        el.style.height = "14px";
        el.style.borderRadius = "999px";
        el.style.cursor = "pointer";
        el.style.border = "none";
        el.style.background = TRACK_COLOR[s.primary_track];
        el.style.boxShadow = "0 0 0 2px #fff, 0 2px 6px rgba(31,36,40,.3)";
        el.style.position = "absolute";
        el.style.left = el.style.top = "0";
        const isSelected = s.slug === selected;
        el.style.transform = `translate(-50%,-50%) scale(${isSelected ? 1.8 : s.primary_track === activeTrack ? 1.4 : 1})`;
        if (isSelected) {
          el.style.boxShadow =
            "0 0 0 2px #fff, 0 0 0 5px rgba(15,76,92,.45), 0 2px 6px rgba(31,36,40,.3)";
          wrap.style.zIndex = "3";
        }
        el.style.transition = "transform 240ms cubic-bezier(.32,.72,0,1)";
        el.onclick = () => onSitePick?.(s.slug);
        if (n) {
          // Planned stop: numbered badge in the route colour.
          el.textContent = String(n);
          el.style.width = el.style.height = "24px";
          el.style.background = ROUTE_COLOR;
          el.style.color = "#F7F4EE";
          el.style.font = "600 12px/24px var(--font-body), sans-serif";
          el.style.transform = "translate(-50%,-50%)";
          el.style.zIndex = "2";
        }

        const label = document.createElement("span");
        label.textContent = pinLabel(s, lang);
        label.style.cssText =
          "font:500 11px/1.2 var(--font-body),sans-serif;color:#1F2428;background:rgba(247,244,238,.92);" +
          "padding:2px 6px;border-radius:999px;white-space:nowrap;box-shadow:0 1px 3px rgba(31,36,40,.2);pointer-events:none;position:absolute";
        labels.set(s.slug, label);
        wrap.append(el, label);
        const marker = new mapbox.default.Marker({ element: wrap, anchor: "center" })
          .setLngLat([s.lng, s.lat])
          .addTo(map);
        markers.current.push(marker);
      });
      relayout();
    })();

    // Re-place labels whenever the view settles, so clustered pins stay readable at any zoom.
    function relayout() {
      const m = mapRef.current;
      if (!m) return;
      const canvas = m.getCanvas();
      const where = layoutLabels(
        sites.map((s) => {
          const pt = m.project([s.lng, s.lat]);
          return { id: s.slug, x: pt.x, y: pt.y, text: pinLabel(s, lang) };
        }),
        { width: canvas.clientWidth, height: canvas.clientHeight },
      );
      for (const [slug, label] of labels) {
        const st = labelStyle(where[slug] ?? "below");
        label.style.top = st.top ?? "";
        label.style.bottom = st.bottom ?? "";
        label.style.left = st.left ?? "";
        label.style.right = st.right ?? "";
        label.style.transform = st.transform ?? "";
      }
    }
    map.on("moveend", relayout);
    return () => {
      map.off("moveend", relayout);
    };
  }, [sites, activeTrack, ready, onSitePick, route, lang, selected]);

  // Follow the bottom sheet, and bring the previewed place into view above it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const padding = {
      top: 80,
      bottom: Math.round(window.innerHeight * bottomInset) + 24,
      left: 32,
      right: 32,
    };
    const site = selected ? sites.find((x) => x.slug === selected) : null;
    map.easeTo({
      padding,
      ...(site ? { center: [site.lng, site.lat] as [number, number] } : {}),
      duration: 450,
    });
  }, [bottomInset, selected, ready, sites]);

  // "You" marker.
  const youMarker = useRef<Marker | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!you) {
      youMarker.current?.remove();
      youMarker.current = null;
      return;
    }
    (async () => {
      const mapbox = await import("mapbox-gl");
      if (!youMarker.current) {
        const el = document.createElement("div");
        el.setAttribute("aria-label", "Your position");
        el.style.cssText = `width:14px;height:14px;border-radius:999px;background:${YOU_COLOR};box-shadow:0 0 0 3px #fff,0 0 0 9px rgba(46,125,209,.25)`;
        youMarker.current = new mapbox.default.Marker({ element: el })
          .setLngLat([you.lng, you.lat])
          .addTo(map);
      } else {
        youMarker.current.setLngLat([you.lng, you.lat]);
      }
    })();
  }, [you, ready]);

  // Route line + fit to the planned stops.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const segs = route ? legSegments(route) : { drive: [], boat: [] };
    const data = (lines: [number, number][][]) => ({
      type: "Feature" as const,
      properties: {},
      geometry: { type: "MultiLineString" as const, coordinates: lines },
    });
    for (const [id, lines, dash] of [
      ["plan-drive", segs.drive, undefined],
      ["plan-boat", segs.boat, [1.5, 1.5]],
    ] as const) {
      const src = map.getSource(id) as { setData?: (d: unknown) => void } | undefined;
      if (src?.setData) {
        src.setData(data(lines as [number, number][][]));
      } else {
        map.addSource(id, { type: "geojson", data: data(lines as [number, number][][]) });
        map.addLayer({
          id,
          type: "line",
          source: id,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ROUTE_COLOR,
            "line-width": 4,
            "line-opacity": 0.85,
            ...(dash ? { "line-dasharray": [...dash] } : {}),
          },
        });
      }
    }
    if (route && route.stops.length > 1) {
      const lngs = route.legs.flatMap((l) => l.geometry.map((c) => c[0]));
      const lats = route.legs.flatMap((l) => l.geometry.map((c) => c[1]));
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        {
          padding: { top: 90, bottom: window.innerHeight * 0.55 + 20, left: 40, right: 40 },
          duration: 800,
        },
      );
    }
  }, [route, ready]);

  return <div ref={container} className="absolute inset-0" />;
}

// ── Fallback (no Mapbox token) ───────────────────────────────────
function FallbackMapView({
  sites,
  activeTrack,
  onSitePick,
  route,
  you,
  lang = "en",
  bottomInset = 0,
  selected = null,
}: Props) {
  // Project lat/lng into the visible band: below the top chrome, above the bottom sheet.
  const BBOX = { minLat: 16.6, maxLat: 17.2, minLng: 106.68, maxLng: 107.38 };
  const top = 13;
  const bottom = Math.max(top + 20, (1 - bottomInset) * 100 - 6);
  const project = (lat: number, lng: number) => ({
    x: 8 + ((lng - BBOX.minLng) / (BBOX.maxLng - BBOX.minLng)) * 76,
    y: top + ((BBOX.maxLat - lat) / (BBOX.maxLat - BBOX.minLat)) * (bottom - top),
  });

  // Measure the map so labels can be laid out in pixels without colliding.
  const box = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 390, height: 844 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const placement = layoutLabels(
    sites.map((s) => {
      const { x, y } = project(s.lat, s.lng);
      return {
        id: s.slug,
        x: (x / 100) * size.width,
        y: (y / 100) * size.height,
        text: pinLabel(s, lang),
      };
    }),
    { width: size.width, height: size.height * (1 - bottomInset) },
  );

  return (
    <div
      ref={box}
      // isolate: keep the pins' z-index inside the map so they never cover the bottom sheet.
      className="absolute inset-0 isolate"
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

      {route && route.legs.length > 0 && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden
        >
          {(["drive", "boat"] as const).map((kind) =>
            legSegments(route)[kind].map((line, i) => (
              <polyline
                key={`${kind}-${i}`}
                points={line
                  .map(([lng, lat]) => {
                    const p = project(lat, lng);
                    return `${p.x},${p.y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke={ROUTE_COLOR}
                strokeWidth={3.5}
                strokeOpacity={0.9}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={kind === "boat" ? "5 5" : undefined}
                vectorEffect="non-scaling-stroke"
              />
            )),
          )}
        </svg>
      )}

      {sites.map((s) => {
        const { x, y } = project(s.lat, s.lng);
        const active = s.primary_track === activeTrack;
        const n = stopNumbers(route).get(s.slug);
        const name = lang === "vi" ? s.name_vi : s.name_en;
        return (
          // Dot centred on the site, short name underneath; the whole thing is the tap target.
          <button
            key={s.slug}
            type="button"
            aria-label={n ? `${n}. ${name}` : name}
            onClick={() => onSitePick?.(s.slug)}
            // A zero-size anchor exactly at the site; dot and label are positioned from it.
            className="absolute z-10 size-0 cursor-pointer border-0 bg-transparent p-0"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {n ? (
              <span
                className="text-paper absolute top-0 left-0 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-sans text-[12px] font-semibold"
                style={{
                  background: ROUTE_COLOR,
                  boxShadow: "0 0 0 2px #fff, 0 2px 6px rgba(31,36,40,.3)",
                }}
              >
                {n}
              </span>
            ) : (
              <span
                className="absolute top-0 left-0 block rounded-full transition-transform"
                style={{
                  width: 14,
                  height: 14,
                  background: TRACK_COLOR[s.primary_track],
                  boxShadow: "0 0 0 2px #fff, 0 2px 6px rgba(31,36,40,.3)",
                  transform: `translate(-50%,-50%) scale(${s.slug === selected ? 1.7 : active ? 1.25 : 1})`,
                  ...(s.slug === selected
                    ? {
                        boxShadow:
                          "0 0 0 2px #fff, 0 0 0 5px rgba(15,76,92,.45), 0 2px 6px rgba(31,36,40,.3)",
                      }
                    : {}),
                }}
              />
            )}
            <span
              className="text-ink absolute rounded-full bg-[rgba(247,244,238,0.92)] px-1.5 py-px font-sans text-[11px] font-medium whitespace-nowrap shadow-[0_1px_3px_rgba(31,36,40,.2)]"
              style={labelStyle(placement[s.slug] ?? "below")}
            >
              {pinLabel(s, lang)}
            </span>
          </button>
        );
      })}

      {you && (
        <span
          aria-label="Your position"
          role="img"
          className="absolute z-30 size-3.5 rounded-full"
          style={{
            left: `${project(you.lat, you.lng).x}%`,
            top: `${project(you.lat, you.lng).y}%`,
            transform: "translate(-50%,-50%)",
            background: YOU_COLOR,
            boxShadow: "0 0 0 3px #fff, 0 0 0 9px rgba(46,125,209,.25)",
          }}
        />
      )}

      {process.env.NODE_ENV === "development" && (
        <p className="text-paper/70 absolute right-0 bottom-3 left-0 text-center font-mono text-[11px]">
          Map fallback · add NEXT_PUBLIC_MAPBOX_TOKEN for 3D terrain
        </p>
      )}
    </div>
  );
}
