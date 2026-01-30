"use client";

import { useState, useRef } from "react";
import {
  BarChart3,
  Download,
  FolderOpen,
  Loader2,
  Menu,
  Plus,
  Save,
  Settings,
} from "lucide-react";
import { useReportStore } from "@/store/report-store";
import { cn } from "@/lib/utils";
import { AggregationType, FilterOperator } from "@/types/entities";
import html2canvas from "html2canvas";

// HTML escape function to prevent XSS in exports
function escapeHtml(text: unknown): string {
  if (text === null || text === undefined) return "—";
  const str = String(text);
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

// JSON format for report configuration
export interface ReportConfigFile {
  version: "1.0";
  exportedAt: string;
  report: {
    name: string;
    description: string;
    createdAt?: string;
    updatedAt?: string;
  };
  dataSource: {
    primaryEntity: string;
    selectedFields: Array<{
      entityId: string;
      fieldId: string;
      alias?: string;
      aggregation?: string;
    }>;
  };
  query: {
    filters: Array<{
      entityId: string;
      fieldId: string;
      operator: string;
      value: unknown;
    }>;
    sorting: Array<{
      entityId: string;
      fieldId: string;
      direction: "asc" | "desc";
    }>;
    timeRange?: {
      type: "relative" | "absolute";
      relativeValue?: number;
      relativeUnit?: "hours" | "days" | "weeks" | "months" | "years";
      startDate?: string;
      endDate?: string;
    };
    timeField?: string;
    groupBy?: Array<{
      entityId: string;
      fieldId: string;
      alias?: string;
      aggregation?: string;
    }>;
    limit?: number;
  };
  sqlPreview?: string;
  visualization: {
    showTable: boolean;
    showChart: boolean;
    showMap: boolean;
    chart?: {
      xAxis?: string;
      yAxis?: string[];
      colorBy?: string;
    };
    map?: {
      latitudeField?: string;
      longitudeField?: string;
      labelField?: string;
      colorBy?: string;
    };
  };
}

export function Header() {
  const {
    config,
    isLoading,
    queryResult,
    chartConfig,
    mapConfig,
    resetReport,
    setReportName,
    toggleSidebar,
    isSidebarOpen,
    loadReport,
  } = useReportStore();

  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create new report
  const handleNew = () => {
    if (config.selectedFields.length > 0) {
      const confirmed = window.confirm(
        "Create a new report? Any unsaved changes will be lost."
      );
      if (!confirmed) return;
    }
    resetReport();
  };

  // Open report configuration from JSON file
  const handleOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const configFile: ReportConfigFile = JSON.parse(content);

        if (configFile.version !== "1.0") {
          alert("Unsupported report file version");
          return;
        }

        // Convert JSON config to store format with proper type casting
        loadReport({
          name: configFile.report.name,
          description: configFile.report.description,
          primaryEntity: configFile.dataSource.primaryEntity,
          selectedFields: configFile.dataSource.selectedFields.map(f => ({
            entityId: f.entityId,
            fieldId: f.fieldId,
            alias: f.alias,
            aggregation: f.aggregation as AggregationType | undefined,
          })),
          filters: configFile.query.filters.map((f, i) => ({ 
            ...f, 
            id: `filter-${i}`,
            operator: f.operator as FilterOperator,
          })),
          sorting: configFile.query.sorting,
          timeRange: configFile.query.timeRange,
          timeField: configFile.query.timeField,
          groupBy: configFile.query.groupBy?.map(g => ({
            entityId: g.entityId,
            fieldId: g.fieldId,
            alias: g.alias,
            aggregation: g.aggregation as AggregationType | undefined,
          })),
          limit: configFile.query.limit,
          createdAt: configFile.report.createdAt,
          updatedAt: configFile.report.updatedAt,
        });

        alert(`Report "${configFile.report.name}" loaded successfully!`);
      } catch (err) {
        alert("Failed to load report file. Please check the file format.");
        console.error("Error loading report:", err);
      }
    };
    reader.readAsText(file);

    // Reset input
    event.target.value = "";
  };

  // Save report configuration to JSON file
  const handleSave = () => {
    const configFile: ReportConfigFile = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      report: {
        name: config.name || "Untitled Report",
        description: config.description || "",
        createdAt: config.createdAt,
        updatedAt: new Date().toISOString(),
      },
      dataSource: {
        primaryEntity: config.primaryEntity,
        selectedFields: config.selectedFields.map((f) => ({
          entityId: f.entityId,
          fieldId: f.fieldId,
          alias: f.alias,
          aggregation: f.aggregation,
        })),
      },
      query: {
        filters: config.filters.map((f) => ({
          entityId: f.entityId,
          fieldId: f.fieldId,
          operator: f.operator,
          value: f.value,
        })),
        sorting: config.sorting.map((s) => ({
          entityId: s.entityId,
          fieldId: s.fieldId,
          direction: s.direction,
        })),
        timeRange: config.timeRange,
        timeField: config.timeField,
        groupBy: (config.groupBy || []).map((g) => ({
          entityId: g.entityId,
          fieldId: g.fieldId,
          alias: g.alias,
          aggregation: g.aggregation,
        })),
        limit: config.limit,
      },
      visualization: {
        showTable: true,
        showChart: !!chartConfig || config.selectedFields.some((f) => 
          f.fieldId.includes("latitude") || f.fieldId.includes("speed")
        ),
        showMap: config.selectedFields.some((f) => 
          f.fieldId.includes("latitude") || f.fieldId.includes("longitude")
        ),
        chart: chartConfig ? {
          xAxis: chartConfig.xAxis,
          yAxis: chartConfig.yAxis,
        } : undefined,
        map: mapConfig ? {
          latitudeField: mapConfig.latitudeField,
          longitudeField: mapConfig.longitudeField,
          labelField: mapConfig.labelField,
        } : undefined,
      },
    };

    const json = JSON.stringify(configFile, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(config.name || "report").replace(/\s+/g, "_")}_config.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export full report as HTML
  const handleDownload = async () => {
    if (!queryResult) {
      alert("Run a query first to generate the report");
      return;
    }

    setIsExporting(true);

    try {
      const reportTitle = escapeHtml(config.name) || "IoT Query Report";
      const reportDate = new Date().toLocaleString();

      // Build description from config (with HTML escaping for security)
      const descParts: string[] = [];
      if (config.filters && config.filters.length > 0) {
        descParts.push(
          `<strong>Filters:</strong> ${config.filters
            .map((f) => `${escapeHtml(f.fieldId)} ${escapeHtml(f.operator)} "${escapeHtml(String(f.value ?? ''))}"`)
            .join(", ")}`
        );
      }
      if (config.sorting && config.sorting.length > 0) {
        descParts.push(
          `<strong>Sorting:</strong> ${config.sorting
            .map((s) => `${escapeHtml(s.fieldId)} (${escapeHtml(s.direction)})`)
            .join(", ")}`
        );
      }
      if (config.timeRange) {
        const timeDesc = config.timeRange.type === "relative"
          ? `Last ${config.timeRange.relativeValue || 7} ${config.timeRange.relativeUnit || "days"}`
          : `${escapeHtml(config.timeRange.startDate)} to ${escapeHtml(config.timeRange.endDate)}`;
        const timeField = config.timeField ? ` (${escapeHtml(config.timeField)})` : "";
        descParts.push(`<strong>Time Range:</strong> ${timeDesc}${timeField}`);
      }
      descParts.push(
        `<strong>Fields:</strong> ${config.selectedFields.map((f) => escapeHtml(f.fieldId)).join(", ")}`
      );
      const description = descParts.join(" | ");

      // Try to get chart SVG
      let chartSvg = "";
      const chartElement = document.querySelector(".recharts-wrapper svg");
      if (chartElement) {
        chartSvg = new XMLSerializer().serializeToString(chartElement);
      }

      // Try to capture map as image
      let mapImageBase64 = "";
      const mapContainer = document.querySelector(".leaflet-container");
      if (mapContainer) {
        try {
          const canvas = await html2canvas(mapContainer as HTMLElement, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#f8fafc",
            scale: 2,
          });
          mapImageBase64 = canvas.toDataURL("image/png");
        } catch (err) {
          console.warn("Failed to capture map:", err);
        }
      }

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      line-height: 1.6;
      padding: 40px;
    }
    .report-container { max-width: 1200px; margin: 0 auto; }
    .header { 
      background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
      color: white;
      padding: 30px 40px;
      border-radius: 12px 12px 0 0;
    }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header .date { opacity: 0.8; font-size: 14px; }
    .description {
      background: #e2e8f0;
      padding: 20px 40px;
      font-size: 13px;
      border-bottom: 1px solid #cbd5e1;
    }
    .section {
      background: white;
      padding: 30px 40px;
      border: 1px solid #e2e8f0;
      border-top: none;
    }
    .section:last-child { border-radius: 0 0 12px 12px; }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #2186eb; color: white; padding: 12px 16px; text-align: left; }
    td { padding: 10px 16px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #e0f2fe; }
    .chart-container { background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; }
    .chart-container svg { max-width: 100%; height: auto; }
    .map-container { background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; }
    .map-container img { max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .stats { display: flex; gap: 30px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; }
    .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; }
    @media print { body { padding: 0; background: white; } }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <h1>📊 ${reportTitle}</h1>
      <div class="date">Generated on ${reportDate}</div>
    </div>
    <div class="description">${description || "No filters applied"}</div>
    <div class="section">
      <div class="section-title">📋 Data Table</div>
      <table>
        <thead>
          <tr>${queryResult.columns.map((c) => `<th>${escapeHtml(c.displayName)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${queryResult.rows
            .slice(0, 100)
            .map(
              (row) =>
                `<tr>${queryResult.columns
                  .map((col) => {
                    let val = row[col.name];
                    if (val === null || val === undefined) return "<td>—</td>";
                    if (col.type === "datetime") {
                      try {
                        val = new Date(val as string).toLocaleString();
                      } catch { /* ignore */ }
                    }
                    return `<td>${escapeHtml(val)}</td>`;
                  })
                  .join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>
      <div class="stats">
        <span><strong>${queryResult.totalRows.toLocaleString()}</strong> total rows</span>
        <span>Query executed in <strong>${queryResult.executionTime.toFixed(0)}ms</strong></span>
        ${queryResult.rows.length > 100 ? '<span style="color:#f59e0b;">Showing first 100 rows</span>' : ""}
      </div>
    </div>
    ${
      chartSvg
        ? `
    <div class="section">
      <div class="section-title">📈 Chart</div>
      <div class="chart-container">${chartSvg}</div>
    </div>`
        : ""
    }
    ${
      mapImageBase64
        ? `
    <div class="section">
      <div class="section-title">🗺️ Map</div>
      <div class="map-container">
        <img src="${mapImageBase64}" alt="Map visualization" />
      </div>
    </div>`
        : ""
    }
    <div class="footer">Generated by IoT Query Probe — Report Builder</div>
  </div>
</body>
</html>`.trim();

      const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      // Sanitize filename (remove special chars that could cause issues)
      const safeFileName = (config.name || "report").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
      link.download = `${safeFileName}_${new Date().toISOString().split("T")[0]}.html`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Hidden file input for Open */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Left section - Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
            "hover:bg-accent text-muted-foreground hover:text-foreground"
          )}
          title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            IoT Query Probe
            <span className="text-muted-foreground font-normal"> — Report Builder</span>
          </span>
        </div>
      </div>

      {/* Center - Report name */}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <input
            type="text"
            value={config.name}
            onChange={(e) => setReportName(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setIsEditing(false);
            }}
            className="h-8 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            {config.name || "Untitled Report"}
          </button>
        )}
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Right section - Action buttons */}
      <div className="flex items-center gap-1">
        {/* New */}
        <button
          onClick={handleNew}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
            "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          title="Create new report"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New</span>
        </button>

        {/* Open */}
        <button
          onClick={handleOpen}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
            "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          title="Open report configuration"
        >
          <FolderOpen className="h-4 w-4" />
          <span className="hidden sm:inline">Open</span>
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!config.primaryEntity}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
            "text-muted-foreground hover:bg-accent hover:text-foreground",
            "disabled:opacity-50 disabled:pointer-events-none"
          )}
          title="Save report configuration (JSON)"
        >
          <Save className="h-4 w-4" />
          <span className="hidden sm:inline">Save</span>
        </button>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Download HTML Report */}
        <button
          onClick={handleDownload}
          disabled={!queryResult || isExporting}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors",
            "hover:bg-primary/90",
            "disabled:opacity-50 disabled:pointer-events-none"
          )}
          title="Download full report as HTML"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Download</span>
        </button>

        {/* Settings */}
        <button
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors ml-1",
            "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
