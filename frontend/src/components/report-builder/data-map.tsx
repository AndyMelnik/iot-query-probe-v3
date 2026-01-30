"use client";

import { useState, useMemo, useEffect } from "react";
import { Map as MapIcon, Palette, ChevronDown } from "lucide-react";
import { cn, convertCoordinate, formatTelematicsValue } from "@/lib/utils";
import dynamic from "next/dynamic";

interface QueryResult {
  columns: Array<{ name: string; displayName: string; type: string }>;
  rows: Array<Record<string, unknown>>;
  totalRows: number;
  executionTime: number;
}

interface DataMapProps {
  data: QueryResult;
}

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);

const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false }
);

const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

// Carto basemaps
const MAP_TILES = {
  light: {
    name: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  },
  dark: {
    name: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  },
};

// Colors for grouping
const MARKER_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f97316", // orange
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#eab308", // yellow
  "#14b8a6", // teal
  "#a855f7", // violet
  "#84cc16", // lime
  "#f43f5e", // rose
];

export function DataMap({ data }: DataMapProps) {
  const [mapStyle, setMapStyle] = useState<keyof typeof MAP_TILES>("light");
  const [colorBy, setColorBy] = useState<string | null>(null);
  const [colorByDropdownOpen, setColorByDropdownOpen] = useState(false);
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Leaflet CSS is imported in globals.css
  }, []);

  // Columns that can be used for color grouping
  const categoricalColumns = useMemo(() => {
    return data.columns.filter((c) => c.type === "string" || c.type === "number");
  }, [data.columns]);

  // Find latitude/longitude columns
  const { latCol, lonCol, labelCol } = useMemo(() => {
    const lat = data.columns.find(
      (c) =>
        c.name.toLowerCase().includes("lat") ||
        c.name.toLowerCase().includes("latitude")
    );
    const lon = data.columns.find(
      (c) =>
        c.name.toLowerCase().includes("lon") ||
        c.name.toLowerCase().includes("lng") ||
        c.name.toLowerCase().includes("longitude")
    );
    const label = data.columns.find(
      (c) =>
        c.name.toLowerCase().includes("label") ||
        c.name.toLowerCase().includes("name") ||
        c.type === "string"
    );
    return { latCol: lat, lonCol: lon, labelCol: label };
  }, [data.columns]);

  // Get unique values for colorBy field
  const colorByValues = useMemo(() => {
    if (!colorBy) return [];
    const uniqueValues = new Set<string>();
    data.rows.forEach((row) => {
      const val = row[colorBy];
      if (val !== null && val !== undefined) {
        uniqueValues.add(String(val));
      }
    });
    return Array.from(uniqueValues).slice(0, 12); // Limit to 12 groups
  }, [colorBy, data.rows]);

  // Color mapping
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    colorByValues.forEach((val, idx) => {
      map[val] = MARKER_COLORS[idx % MARKER_COLORS.length];
    });
    return map;
  }, [colorByValues]);

  // Process coordinates
  // IoT Query stores lat/lng as integers with 10^7 precision for TimescaleDB performance
  const points = useMemo(() => {
    if (!latCol || !lonCol) return [];

    return data.rows
      .map((row, idx) => {
        const rawLat = Number(row[latCol.name]);
        const rawLon = Number(row[lonCol.name]);

        // Convert from integer format (10^7 precision) to decimal degrees
        const lat = convertCoordinate(rawLat);
        const lon = convertCoordinate(rawLon);

        // Validate coordinates
        if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) {
          return null;
        }
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          return null;
        }

        const groupValue = colorBy ? String(row[colorBy] ?? "Unknown") : null;
        const markerColor = groupValue ? (colorMap[groupValue] || MARKER_COLORS[0]) : MARKER_COLORS[0];

        return {
          id: idx,
          latitude: lat,
          longitude: lon,
          label: labelCol ? String(row[labelCol.name]) : `Point ${idx + 1}`,
          group: groupValue,
          color: markerColor,
          data: row,
        };
      })
      .filter(Boolean) as Array<{
      id: number;
      latitude: number;
      longitude: number;
      label: string;
      group: string | null;
      color: string;
      data: Record<string, unknown>;
    }>;
  }, [data.rows, latCol, lonCol, labelCol, colorBy, colorMap]);

  // Calculate bounds
  const bounds = useMemo(() => {
    if (points.length === 0) return null;

    const lats = points.map((p) => p.latitude);
    const lons = points.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const latPad = (maxLat - minLat) * 0.1 || 0.01;
    const lonPad = (maxLon - minLon) * 0.1 || 0.01;

    return [
      [minLat - latPad, minLon - lonPad],
      [maxLat + latPad, maxLon + lonPad],
    ] as [[number, number], [number, number]];
  }, [points]);

  // Calculate center
  const center = useMemo(() => {
    if (points.length === 0) return [0, 0] as [number, number];
    const avgLat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
    const avgLon = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;
    return [avgLat, avgLon] as [number, number];
  }, [points]);

  const getColumnDisplayName = (colName: string) => {
    return data.columns.find((c) => c.name === colName)?.displayName || colName;
  };

  if (!latCol || !lonCol) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-lg border border-dashed border-border">
        <div className="text-center">
          <MapIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">
            No latitude/longitude columns found in results
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add fields containing coordinates to display on map
          </p>
        </div>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-lg border border-dashed border-border">
        <div className="text-center">
          <MapIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">
            No valid coordinates found in data
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Found columns: {latCol.name}, {lonCol.name}
          </p>
        </div>
      </div>
    );
  }

  if (!isClient) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-lg border border-border bg-muted/30">
        <div className="text-center">
          <MapIcon className="mx-auto h-12 w-12 animate-pulse text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Map Controls */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 p-3">
        {/* Map Style Selector */}
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Map Style
          </label>
          <div className="relative">
            <button
              onClick={() => setStyleDropdownOpen(!styleDropdownOpen)}
              className="flex h-9 min-w-[150px] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
            >
              <span>{MAP_TILES[mapStyle].name}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            {styleDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStyleDropdownOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 w-48 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
                  {(Object.keys(MAP_TILES) as Array<keyof typeof MAP_TILES>).map((style) => (
                    <button
                      key={style}
                      onClick={() => {
                        setMapStyle(style);
                        setStyleDropdownOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center rounded-sm px-3 py-2 text-sm hover:bg-accent",
                        mapStyle === style && "bg-primary/10 text-primary"
                      )}
                    >
                      {MAP_TILES[style].name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Color By Selector */}
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Palette className="h-3 w-3" />
            Color By
          </label>
          <div className="relative">
            <button
              onClick={() => setColorByDropdownOpen(!colorByDropdownOpen)}
              className={cn(
                "flex h-9 min-w-[150px] items-center justify-between gap-2 rounded-md border px-3 text-sm hover:bg-accent",
                colorBy ? "border-primary bg-primary/5" : "border-input bg-background"
              )}
            >
              <span className="truncate">{colorBy ? getColumnDisplayName(colorBy) : "None"}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            {colorByDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setColorByDropdownOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-56 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
                  <button
                    onClick={() => {
                      setColorBy(null);
                      setColorByDropdownOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-sm px-3 py-2 text-sm hover:bg-accent",
                      !colorBy && "bg-primary/10 text-primary"
                    )}
                  >
                    None (single color)
                  </button>
                  <div className="my-1 h-px bg-border" />
                  {categoricalColumns.map((col) => (
                    <button
                      key={col.name}
                      onClick={() => {
                        setColorBy(col.name);
                        setColorByDropdownOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-accent",
                        colorBy === col.name && "bg-primary/10 text-primary"
                      )}
                    >
                      <span>{col.displayName}</span>
                      <span className="text-xs text-muted-foreground">{col.type}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Point count */}
        <div className="ml-auto text-sm text-muted-foreground">
          {points.length.toLocaleString()} points
          {points.length > 1000 && (
            <span className="ml-1 text-amber-500">(showing 1,000)</span>
          )}
        </div>
      </div>

      {/* Color Legend */}
      {colorBy && colorByValues.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <span className="text-xs font-medium text-muted-foreground">Legend:</span>
          {colorByValues.map((val) => (
            <div key={val} className="flex items-center gap-1.5 text-xs">
              <div
                className="h-3 w-3 rounded-full border border-white/20"
                style={{ backgroundColor: colorMap[val] }}
              />
              <span>{val}</span>
            </div>
          ))}
          {colorByValues.length >= 12 && (
            <span className="text-xs text-amber-500">+more</span>
          )}
        </div>
      )}

      {/* Map Container */}
      <div className="relative h-[500px] overflow-hidden rounded-lg border border-border">
        <MapContainer
          center={center}
          zoom={10}
          bounds={bounds || undefined}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            url={MAP_TILES[mapStyle].url}
            attribution={MAP_TILES[mapStyle].attribution}
          />
          {points.slice(0, 1000).map((point) => (
            <CircleMarker
              key={point.id}
              center={[point.latitude, point.longitude]}
              radius={4}
              pathOptions={{
                color: point.color,
                fillColor: point.color,
                fillOpacity: 0.8,
                weight: 1,
              }}
            >
              <Popup>
                <div className="max-h-48 max-w-xs overflow-auto">
                  <h4 className="mb-2 font-semibold">{point.label}</h4>
                  {point.group && (
                    <div className="mb-2 flex items-center gap-2 text-xs">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: point.color }}
                      />
                      <span className="font-medium">{point.group}</span>
                    </div>
                  )}
                  <table className="w-full text-xs">
                    <tbody>
                      {data.columns.slice(0, 8).map((col) => (
                        <tr key={col.name} className="border-b border-gray-200 last:border-0">
                          <td className="py-1 pr-2 font-medium text-gray-500">
                            {col.displayName}
                          </td>
                          <td className="py-1">
                            {formatValue(point.data[col.name], col.type, col.name)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          {bounds && <FitBounds bounds={bounds} />}
        </MapContainer>
      </div>
    </div>
  );
}

// Component to fit map bounds
function FitBounds({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const MapHook = dynamic(
    () => import("react-leaflet").then((mod) => {
      const { useMap } = mod;
      return function FitBoundsInner({ bounds }: { bounds: [[number, number], [number, number]] }) {
        const map = useMap();
        useEffect(() => {
          if (bounds) {
            map.fitBounds(bounds, { padding: [20, 20] });
          }
        }, [map, bounds]);
        return null;
      };
    }),
    { ssr: false }
  );

  return <MapHook bounds={bounds} />;
}

function formatValue(value: unknown, type: string, columnName: string): string {
  if (value === null || value === undefined) return "—";
  if (type === "datetime" || type === "date") {
    try {
      return new Date(value as string).toLocaleString();
    } catch {
      return String(value);
    }
  }
  if (type === "number") {
    // Use telematics-aware formatting for numeric values
    const formatted = formatTelematicsValue(value, columnName);
    return String(formatted);
  }
  return String(value);
}
