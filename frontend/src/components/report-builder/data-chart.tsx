"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { QueryResult } from "@/types/entities";
import { cn, getTelematicsNumericValue, isSpeedColumn, isLatitudeColumn, isLongitudeColumn } from "@/lib/utils";
import { ChevronDown, X, Palette } from "lucide-react";

interface DataChartProps {
  data: QueryResult;
}

const CHART_COLORS = [
  "#2186eb",
  "#8b5cf6",
  "#22c55e",
  "#f97316",
  "#ec4899",
  "#06b6d4",
  "#eab308",
  "#ef4444",
  "#14b8a6",
  "#a855f7",
  "#84cc16",
  "#06b6d4",
];

export function DataChart({ data }: DataChartProps) {
  // Initialize X-axis with first datetime column, or first column
  const defaultXAxis = useMemo(() => {
    const datetimeCol = data.columns.find((c) => c.type === "datetime" || c.type === "date");
    return datetimeCol?.name || data.columns[0]?.name || "";
  }, [data.columns]);

  // Initialize Y-axis with first numeric column
  const defaultYAxis = useMemo(() => {
    const numericCols = data.columns.filter((c) => c.type === "number");
    return numericCols.length > 0 ? [numericCols[0].name] : [];
  }, [data.columns]);

  const [xAxis, setXAxis] = useState<string>(defaultXAxis);
  const [yAxis, setYAxis] = useState<string[]>(defaultYAxis);
  const [colorBy, setColorBy] = useState<string | null>(null);
  const [xAxisDropdownOpen, setXAxisDropdownOpen] = useState(false);
  const [yAxisDropdownOpen, setYAxisDropdownOpen] = useState(false);
  const [colorByDropdownOpen, setColorByDropdownOpen] = useState(false);

  const numericColumns = useMemo(
    () => data.columns.filter((c) => c.type === "number"),
    [data.columns]
  );

  // Columns that can be used for grouping (strings, limited cardinality)
  const categoricalColumns = useMemo(() => {
    return data.columns.filter((c) => c.type === "string" || c.type === "number");
  }, [data.columns]);

  const allColumns = useMemo(() => data.columns, [data.columns]);

  // Get unique values for the colorBy field
  const colorByValues = useMemo(() => {
    if (!colorBy) return [];
    const uniqueValues = new Set<string>();
    data.rows.forEach((row) => {
      const val = row[colorBy];
      if (val !== null && val !== undefined) {
        uniqueValues.add(String(val));
      }
    });
    return Array.from(uniqueValues).slice(0, 10); // Limit to 10 groups
  }, [colorBy, data.rows]);

  // Transform data for charts - group by colorBy if set
  // Handles telematics data conversion (lat/lng with 10^7 precision, speed with 10^2 precision)
  const chartData = useMemo(() => {
    const rows = data.rows.slice(0, 500);
    
    if (!colorBy) {
      // No grouping - standard transformation
      return rows.map((row) => {
        const transformed: Record<string, unknown> = {};
        allColumns.forEach((col) => {
          let value = row[col.name];
          if (col.type === "number") {
            // Convert telematics values (lat/lng, speed) from integer format
            value = getTelematicsNumericValue(value, col.name);
          }
          if ((col.type === "datetime" || col.type === "date") && value) {
            try {
              const date = new Date(value as string);
              value = date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch {
              // Keep original
            }
          }
          transformed[col.name] = value;
        });
        return transformed;
      });
    }

    // With grouping - create separate series for each group value
    return rows.map((row) => {
      const transformed: Record<string, unknown> = {};
      const groupValue = String(row[colorBy] ?? "Unknown");
      
      allColumns.forEach((col) => {
        let value = row[col.name];
        if (col.type === "number") {
          // Convert telematics values (lat/lng, speed) from integer format
          value = getTelematicsNumericValue(value, col.name);
        }
        if ((col.type === "datetime" || col.type === "date") && value) {
          try {
            const date = new Date(value as string);
            value = date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch {
            // Keep original
          }
        }
        transformed[col.name] = value;
        
        // Create grouped columns for Y-axis values
        if (yAxis.includes(col.name)) {
          transformed[`${col.name}_${groupValue}`] = value;
        }
      });
      
      transformed["_group"] = groupValue;
      return transformed;
    });
  }, [data.rows, allColumns, colorBy, yAxis]);

  // Generate line keys based on colorBy
  const lineKeys = useMemo(() => {
    if (!colorBy || colorByValues.length === 0) {
      return yAxis.map((y, idx) => ({
        key: y,
        name: getColumnDisplayName(y),
        color: CHART_COLORS[idx % CHART_COLORS.length],
      }));
    }

    // Create a line for each Y-axis × group combination
    const keys: { key: string; name: string; color: string }[] = [];
    yAxis.forEach((y, yIdx) => {
      colorByValues.forEach((groupVal, gIdx) => {
        keys.push({
          key: `${y}_${groupVal}`,
          name: `${getColumnDisplayName(y)} (${groupVal})`,
          color: CHART_COLORS[(yIdx * colorByValues.length + gIdx) % CHART_COLORS.length],
        });
      });
    });
    return keys;
  }, [yAxis, colorBy, colorByValues]);

  const addYAxis = (colName: string) => {
    if (!yAxis.includes(colName)) {
      setYAxis([...yAxis, colName]);
    }
    setYAxisDropdownOpen(false);
  };

  const removeYAxis = (colName: string) => {
    setYAxis(yAxis.filter((y) => y !== colName));
  };

  function getColumnDisplayName(colName: string) {
    return data.columns.find((c) => c.name === colName)?.displayName || colName;
  }

  const availableYColumns = numericColumns.filter((c) => !yAxis.includes(c.name));

  return (
    <div className="space-y-4">
      {/* Chart configuration */}
      <div className="flex flex-wrap items-start gap-4 rounded-lg border border-border bg-muted/30 p-4">
        {/* X-Axis Selector */}
        <div className="space-y-2 min-w-[180px]">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            X-Axis
          </label>
          <div className="relative">
            <button
              onClick={() => setXAxisDropdownOpen(!xAxisDropdownOpen)}
              className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
            >
              <span className="truncate">{getColumnDisplayName(xAxis)}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
            
            {xAxisDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setXAxisDropdownOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-full min-w-[220px] overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
                  {allColumns.map((col) => (
                    <button
                      key={col.name}
                      onClick={() => {
                        setXAxis(col.name);
                        setXAxisDropdownOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-accent",
                        xAxis === col.name && "bg-primary/10 text-primary"
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

        {/* Y-Axis Selector */}
        <div className="flex-1 space-y-2 min-w-[200px]">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Y-Axis (Values)
          </label>
          
          <div className="flex flex-wrap gap-2">
            {yAxis.map((y, idx) => (
              <div
                key={y}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white"
                style={{ backgroundColor: colorBy ? "#64748b" : CHART_COLORS[idx % CHART_COLORS.length] }}
              >
                <span>{getColumnDisplayName(y)}</span>
                <button onClick={() => removeYAxis(y)} className="rounded-full p-0.5 hover:bg-white/20">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            
            {availableYColumns.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setYAxisDropdownOpen(!yAxisDropdownOpen)}
                  className="flex h-7 items-center gap-1 rounded-full border border-dashed border-primary/50 px-3 text-xs font-medium text-primary hover:border-primary hover:bg-primary/5"
                >
                  + Add
                </button>
                
                {yAxisDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setYAxisDropdownOpen(false)} />
                    <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-48 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
                      {availableYColumns.map((col) => (
                        <button
                          key={col.name}
                          onClick={() => addYAxis(col.name)}
                          className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                        >
                          <span>{col.displayName}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Color By Selector */}
        <div className="space-y-2 min-w-[180px]">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Palette className="h-3 w-3" />
            Color By (Group)
          </label>
          <div className="relative">
            <button
              onClick={() => setColorByDropdownOpen(!colorByDropdownOpen)}
              className={cn(
                "flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm hover:bg-accent",
                colorBy ? "border-primary bg-primary/5" : "border-input bg-background"
              )}
            >
              <span className="truncate">{colorBy ? getColumnDisplayName(colorBy) : "None"}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
            
            {colorByDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setColorByDropdownOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-full min-w-[200px] overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg">
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
                    None
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
          {colorBy && colorByValues.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {colorByValues.length} group{colorByValues.length !== 1 ? 's' : ''} found
            </p>
          )}
        </div>
      </div>

      {/* Color Legend when grouping */}
      {colorBy && colorByValues.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-muted/20 p-3">
          <span className="text-xs font-medium text-muted-foreground mr-2">Groups:</span>
          {colorByValues.map((val, idx) => (
            <div key={val} className="flex items-center gap-1.5 text-xs">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
              />
              <span>{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="h-[400px] w-full rounded-lg border border-border bg-card p-4">
        {yAxis.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Select Y-axis fields to display the chart</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey={xAxis}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={{ stroke: "hsl(var(--border))" }}
                angle={-45}
                textAnchor="end"
                height={70}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={{ stroke: "hsl(var(--border))" }}
                tickFormatter={(value) => {
                  if (typeof value === 'number') {
                    // Check if any Y-axis column is speed-related for unit display
                    const hasSpeedColumn = yAxis.some(y => isSpeedColumn(y));
                    if (hasSpeedColumn && yAxis.length === 1) {
                      return value.toFixed(0) + ' km/h';
                    }
                    if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                    if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'K';
                    return value.toFixed(0);
                  }
                  return value;
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--popover-foreground))",
                }}
                labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 4 }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: 20 }}
                formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
              />
              {lineKeys.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={chartData.length <= 50}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                  name={line.name}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Showing {Math.min(chartData.length, 500)} data points</span>
        {chartData.length >= 500 && (
          <span className="text-amber-500">Limited to first 500 rows for performance</span>
        )}
      </div>
    </div>
  );
}
