"use client";

import { useState, useRef } from "react";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Table as TableIcon,
  LineChart,
  Map as MapIcon,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";
import { useReportStore } from "@/store/report-store";
import { DataTable } from "./data-table";
import { DataChart } from "./data-chart";
import { DataMap } from "./data-map";

export function ResultsPanel() {
  const {
    queryResult,
    isLoading,
    error,
    config,
  } = useReportStore();

  const [showTable, setShowTable] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const [showMap, setShowMap] = useState(true);

  const chartRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // Always show the visualization panel structure
  if (!config.primaryEntity) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="text-center">
          <Layers className="mx-auto h-16 w-16 text-primary/30" />
          <h3 className="mt-4 text-lg font-semibold">Start Building Your Report</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Select an entity from the sidebar to begin. Click on fields to add them to your report.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        {/* Show loading state with visualization structure */}
        <VisualizationSection
          icon={<TableIcon className="h-5 w-5" />}
          title="Data Table"
          isOpen={showTable}
          onToggle={() => setShowTable(!showTable)}
        >
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Executing query...</span>
          </div>
        </VisualizationSection>

        <VisualizationSection
          icon={<LineChart className="h-5 w-5" />}
          title="Line Chart"
          isOpen={showChart}
          onToggle={() => setShowChart(!showChart)}
        >
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </VisualizationSection>

        <VisualizationSection
          icon={<MapIcon className="h-5 w-5" />}
          title="Map"
          isOpen={showMap}
          onToggle={() => setShowMap(!showMap)}
        >
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </VisualizationSection>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
          <p className="font-medium text-destructive">Query Error</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>

        {/* Still show visualization structure */}
        <VisualizationSection
          icon={<TableIcon className="h-5 w-5" />}
          title="Data Table"
          isOpen={showTable}
          onToggle={() => setShowTable(!showTable)}
        >
          <EmptyState message="Fix the error above and run the query again" />
        </VisualizationSection>

        <VisualizationSection
          icon={<LineChart className="h-5 w-5" />}
          title="Line Chart"
          isOpen={showChart}
          onToggle={() => setShowChart(!showChart)}
        >
          <EmptyState message="Chart will appear after successful query" />
        </VisualizationSection>

        <VisualizationSection
          icon={<MapIcon className="h-5 w-5" />}
          title="Map"
          isOpen={showMap}
          onToggle={() => setShowMap(!showMap)}
        >
          <EmptyState message="Map will appear if data contains coordinates" />
        </VisualizationSection>
      </div>
    );
  }

  // No query result yet - show placeholder sections
  if (!queryResult) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <VisualizationSection
          icon={<TableIcon className="h-5 w-5" />}
          title="Data Table"
          isOpen={showTable}
          onToggle={() => setShowTable(!showTable)}
        >
          <EmptyState 
            icon={<TableIcon className="h-10 w-10" />}
            message="Select fields and click 'Run Query' to see data" 
          />
        </VisualizationSection>

        <VisualizationSection
          icon={<LineChart className="h-5 w-5" />}
          title="Line Chart"
          isOpen={showChart}
          onToggle={() => setShowChart(!showChart)}
        >
          <EmptyState 
            icon={<LineChart className="h-10 w-10" />}
            message="Line chart will visualize numeric data from your query" 
          />
        </VisualizationSection>

        <VisualizationSection
          icon={<MapIcon className="h-5 w-5" />}
          title="Map"
          isOpen={showMap}
          onToggle={() => setShowMap(!showMap)}
        >
          <EmptyState 
            icon={<MapIcon className="h-10 w-10" />}
            message="Map will display locations if your data contains coordinates (lat/lon)" 
          />
        </VisualizationSection>
      </div>
    );
  }

  // Export to CSV
  const exportCSV = () => {
    const headers = queryResult.columns.map(c => c.displayName).join(',');
    const rows = queryResult.rows.map(row => 
      queryResult.columns.map(col => {
        const value = row[col.name];
        // Escape quotes and wrap in quotes if contains comma
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    ).join('\n');
    
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.name || 'report'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export to XLSX (using a simple XML-based format)
  const exportXLSX = () => {
    // Create a simple HTML table that Excel can open
    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8"></head>
      <body>
        <table border="1">
          <thead>
            <tr>${queryResult.columns.map(c => `<th style="background:#1565C0;color:white;font-weight:bold;">${c.displayName}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${queryResult.rows.map(row => 
              `<tr>${queryResult.columns.map(col => `<td>${row[col.name] ?? ''}</td>`).join('')}</tr>`
            ).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.name || 'report'}_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Check if data has coordinates for map
  const hasCoordinates = queryResult.columns.some(c => 
    c.name.toLowerCase().includes('lat') || 
    c.name.toLowerCase().includes('latitude')
  ) && queryResult.columns.some(c => 
    c.name.toLowerCase().includes('lon') || 
    c.name.toLowerCase().includes('lng') || 
    c.name.toLowerCase().includes('longitude')
  );

  // Check if data has numeric columns for chart
  const hasNumericData = queryResult.columns.some(c => c.type === 'number');

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Results</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{queryResult.totalRows.toLocaleString()} rows</span>
            <span>·</span>
            <span>{queryResult.executionTime.toFixed(0)}ms</span>
          </div>
        </div>
      </div>

      {/* Section 1: Data Table */}
      <VisualizationSection
        icon={<TableIcon className="h-5 w-5" />}
        title="Data Table"
        isOpen={showTable}
        onToggle={() => setShowTable(!showTable)}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
              title="Download as CSV"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              onClick={exportXLSX}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
              title="Download as Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              XLSX
            </button>
          </div>
        }
      >
        <DataTable data={queryResult} />
      </VisualizationSection>

      {/* Section 2: Line Chart */}
      <VisualizationSection
        icon={<LineChart className="h-5 w-5" />}
        title="Line Chart"
        isOpen={showChart}
        onToggle={() => setShowChart(!showChart)}
      >
        <div ref={chartRef}>
          {hasNumericData ? (
            <DataChart data={queryResult} />
          ) : (
            <EmptyState 
              icon={<LineChart className="h-10 w-10" />}
              message="No numeric columns found. Add numeric fields to visualize data in a chart." 
            />
          )}
        </div>
      </VisualizationSection>

      {/* Section 3: Map */}
      <VisualizationSection
        icon={<MapIcon className="h-5 w-5" />}
        title="Map"
        isOpen={showMap}
        onToggle={() => setShowMap(!showMap)}
      >
        <div ref={mapRef}>
          {hasCoordinates ? (
            <DataMap data={queryResult} />
          ) : (
            <EmptyState 
              icon={<MapIcon className="h-10 w-10" />}
              message="No coordinate columns found. Add latitude and longitude fields to display data on a map." 
            />
          )}
        </div>
      </VisualizationSection>
    </div>
  );
}

// Reusable visualization section component
function VisualizationSection({
  icon,
  title,
  isOpen,
  onToggle,
  actions,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div 
        className="flex items-center justify-between border-b border-border px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <div className="flex items-center gap-3">
          {actions && <div onClick={(e) => e.stopPropagation()}>{actions}</div>}
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>
      {isOpen && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
}

// Empty state placeholder
function EmptyState({ 
  icon, 
  message 
}: { 
  icon?: React.ReactNode; 
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && (
        <div className="text-muted-foreground/30 mb-3">
          {icon}
        </div>
      )}
      <p className="text-sm text-muted-foreground max-w-md">{message}</p>
    </div>
  );
}
