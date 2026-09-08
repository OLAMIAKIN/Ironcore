"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/cn";

/**
 * A real map, drawn with Leaflet over OpenStreetMap tiles — no API key and no
 * account, which is what keeps this free.
 *
 * Leaflet touches `window` on import, so every screen loads this through
 * `next/dynamic` with `ssr: false`. Markers are `divIcon`s rather than Leaflet's
 * default image pins, which sidesteps the well-known broken-marker-image problem
 * with bundlers and lets the pins carry the app's own styling.
 */

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  /** Draws it as the chosen one — larger, and in the hazard colour. */
  active?: boolean;
};

const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Lagos, so an empty map still opens somewhere recognisable. */
const FALLBACK: [number, number] = [6.5244, 3.3792];

function pinIcon(active: boolean, you: boolean): L.DivIcon {
  const size = active ? 34 : 26;
  const colour = you ? "#2563eb" : active ? "#ff5a36" : "#1c1e1f";

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="
      display:block;width:${size}px;height:${size}px;border-radius:9999px;
      background:${colour};border:3px solid #fff;
      box-shadow:0 3px 10px rgba(0,0,0,.35);
    "></span>`,
  });
}

export function GymMap({
  pins,
  you,
  className,
  /** Click anywhere to move the single pin — used by the gym's own setup. */
  onPick,
}: {
  pins: MapPin[];
  you?: { lat: number; lng: number } | null;
  className?: string;
  onPick?: (at: { lat: number; lng: number }) => void;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  // A click handler that changes between renders must not force the map to be
  // rebuilt, so the latest one is read from a ref at the moment of the click.
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  // Built once and torn down on unmount. React must never diff Leaflet's DOM.
  useEffect(() => {
    if (!holder.current || map.current) return;

    const created = L.map(holder.current, {
      center: FALLBACK,
      zoom: 11,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(created);
    created.on("click", (event: L.LeafletMouseEvent) => {
      pick.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    });

    map.current = created;
    layer.current = L.layerGroup().addTo(created);

    return () => {
      created.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  // Redraw the pins whenever they change, and frame everything worth seeing.
  useEffect(() => {
    const current = map.current;
    const group = layer.current;
    if (!current || !group) return;

    group.clearLayers();

    for (const pin of pins) {
      L.marker([pin.lat, pin.lng], {
        icon: pinIcon(pin.active ?? false, false),
        title: pin.label,
        alt: pin.label,
      })
        .bindTooltip(pin.label, { direction: "top", offset: [0, -14] })
        .addTo(group);
    }

    if (you) {
      L.marker([you.lat, you.lng], {
        icon: pinIcon(false, true),
        title: "You are here",
        alt: "You are here",
      })
        .bindTooltip("You are here", { direction: "top", offset: [0, -12] })
        .addTo(group);
    }

    const points: [number, number][] = [
      ...pins.map((pin): [number, number] => [pin.lat, pin.lng]),
      ...(you ? [[you.lat, you.lng] as [number, number]] : []),
    ];

    if (points.length === 1) {
      current.setView(points[0]!, 15);
    } else if (points.length > 1) {
      current.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }

    // Leaflet measures its container on creation, which for a card that was
    // still laying out can be the wrong size until it is nudged.
    current.invalidateSize();
  }, [pins, you]);

  return (
    <div
      ref={holder}
      role="application"
      aria-label="Map of gyms"
      className={cn(
        "z-0 overflow-hidden rounded-card border border-line bg-paper",
        className,
      )}
    />
  );
}

export default GymMap;
