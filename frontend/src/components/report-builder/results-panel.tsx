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
  Clock,
  Database,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import { useReportStore } from "@/store/report-store";
import { DataTable } from "./data-table";
import { DataChart } from "./data-chart";
import { DataMap } from "./data-map";
import { cn } from "@/lib/utils";

export function ResultsPanel() {
  const {
    queryResult,
    isLoading,
    error,
    config,
    queryMode,
  } = useReportStore();

  const [showTable, setShowTable] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const [showMap, setShowMap] = useState(true);

  const chartRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // Don't show results panel until a primary entity is selected
  if (!config.primaryEntity) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        {/* Loading Status Banner */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="absolute inset-0 h-8 w-8 animate-ping rounded-full bg-primary/20" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-primary">Query in Progress</p>
              <p className="text-sm text-muted-foreground">
                {queryMode === 'advanced' 
                  ? 'Executing your custom SQL query...'
                  : 'Building and executing your report query...'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Large queries may take several minutes. Please wait...
              </p>
            </div>
          </div>
          
          {/* Progress indicator */}
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" 
              style={{ animation: 'loading-progress 2s ease-in-out infinite' }} />
          </div>
        </div>

        {/* Show loading state with visualization structure */}
        <VisualizationSection
          icon={<TableIcon className="h-5 w-5" />}
          title="Data Table"
          isOpen={showTable}
          onToggle={() => setShowTable(!showTable)}
        >
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <span className="text-muted-foreground">Waiting for query results...</span>
          </div>
        </VisualizationSection>

        <VisualizationSection
          icon={<LineChart className="h-5 w-5" />}
          title="Line Chart"
          isOpen={showChart}
          onToggle={() => setShowChart(!showChart)}
        >
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Chart will render after data loads</span>
            </div>
          </div>
        </VisualizationSection>

        <VisualizationSection
          icon={<MapIcon className="h-5 w-5" />}
          title="Map"
          isOpen={showMap}
          onToggle={() => setShowMap(!showMap)}
        >
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Map will render if coordinates found</span>
            </div>
          </div>
        </VisualizationSection>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        {/* Error Banner with Details */}
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">Query Failed</p>
              <p className="mt-1 text-sm text-muted-foreground break-all">{error}</p>
              
              {/* Contextual help based on error */}
              <div className="mt-3 pt-3 border-t border-destructive/20">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Info className="h-3.5 w-3.5" />
                  What you can try:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {error.toLowerCase().includes('timeout') && (
                    <>
                      <li>• Add a LIMIT clause to reduce the result set</li>
                      <li>• Use more specific WHERE conditions</li>
                      <li>• Query a smaller date range</li>
                    </>
                  )}
                  {error.toLowerCase().includes('syntax') && (
                    <>
                      <li>• Check your SQL syntax for typos</li>
                      <li>• Verify all parentheses and quotes are balanced</li>
                      <li>• Use the syntax preview to check highlighting</li>
                    </>
                  )}
                  {error.toLowerCase().includes('not exist') && (
                    <>
                      <li>• Verify table and column names are correct</li>
                      <li>• Use full schema names (e.g., raw_telematics_data.tracking_data_core)</li>
                    </>
                  )}
                  {!error.toLowerCase().includes('timeout') && 
                   !error.toLowerCase().includes('syntax') && 
                   !error.toLowerCase().includes('not exist') && (
                    <>
                      <li>• Review your query for errors</li>
                      <li>• Try a simpler query first</li>
                      <li>• Check your database connection</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Still show visualization structure */}
        <VisualizationSection
          icon={<TableIcon className="h-5 w-5" />}
          title="Data Table"
          isOpen={showTable}
          onToggle={() => setShowTable(!showTable)}
        >
          <EmptyState 
            icon={<AlertCircle className="h-10 w-10" />}
            message="Fix the error above and run the query again" 
          />
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
      {/* Success Banner with Query Stats */}
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-semibold text-green-600 dark:text-green-400">Query Completed Successfully</p>
              <p className="text-sm text-muted-foreground">
                {queryResult.totalRows === 0 
                  ? 'No rows matched your query criteria'
                  : `Retrieved ${queryResult.totalRows.toLocaleString()} row${queryResult.totalRows !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span>{queryResult.totalRows.toLocaleString()} rows</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Database className="h-4 w-4" />
              <span>{queryResult.columns.length} columns</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{queryResult.executionTime < 1000 
                ? `${queryResult.executionTime.toFixed(0)}ms`
                : `${(queryResult.executionTime / 1000).toFixed(1)}s`}</span>
            </div>
          </div>
        </div>
        
        {/* No results warning */}
        {queryResult.totalRows === 0 && (
          <div className="mt-3 pt-3 border-t border-green-500/20">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Info className="h-4 w-4" />
              Your query executed successfully but returned no data. Try adjusting your filters or date range.
            </p>
          </div>
        )}
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
