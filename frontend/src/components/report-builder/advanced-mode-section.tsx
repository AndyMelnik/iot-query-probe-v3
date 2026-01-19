"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { useReportStore } from "@/store/report-store";
import { cn } from "@/lib/utils";

export function AdvancedModeSection() {
  const { config, databaseUrl, isConnected } = useReportStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [sqlQuery, setSqlQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate SQL preview when config changes and section is expanded
  useEffect(() => {
    if (!isExpanded) return;
    if (!config.primaryEntity || config.selectedFields.length === 0) {
      setSqlQuery("");
      return;
    }

    generateSqlPreview();
  }, [isExpanded, config]);

  const generateSqlPreview = async () => {
    if (!config.primaryEntity || config.selectedFields.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      // Transform frontend config to backend expected format
      const requestBody = {
        name: config.name,
        description: config.description,
        primaryEntity: config.primaryEntity,
        selectedFields: config.selectedFields.map((f) => ({
          entityId: f.entityId,
          fieldId: f.fieldId,
          alias: f.alias,
          aggregation: f.aggregation,
        })),
        filters: config.filters.map((f) => ({
          id: f.id,
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
        groupBy: config.groupBy?.map((g) => ({
          entityId: g.entityId,
          fieldId: g.fieldId,
        })),
        limit: config.limit || 1000,
      };

      const response = await fetch("/api/query/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to generate SQL");
      }

      const data = await response.json();
      setSqlQuery(data.sql || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSqlQuery("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!sqlQuery) return;
    await navigator.clipboard.writeText(sqlQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-b border-border bg-card/30 px-6 py-4">
      {/* Section Header - Accordion Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-sm font-bold text-amber-500">
          3
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Advanced Mode</h3>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
              SQL Preview
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            View and copy the generated SQL query
          </p>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Generated SQL Query
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={generateSqlPreview}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                Refresh
              </button>
              <button
                onClick={handleCopy}
                disabled={!sqlQuery}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SQL Display */}
          <div className="rounded-lg border border-border bg-zinc-900 p-4 font-mono text-sm">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating SQL...
              </div>
            ) : error ? (
              <div className="text-red-400">{error}</div>
            ) : sqlQuery ? (
              <pre className="overflow-x-auto whitespace-pre-wrap text-emerald-400">
                <SqlHighlight sql={sqlQuery} />
              </pre>
            ) : (
              <div className="text-muted-foreground">
                Select fields to generate SQL query
              </div>
            )}
          </div>

          {/* Info text */}
          <p className="text-xs text-muted-foreground">
            This SQL is auto-generated based on your selected fields, filters, sorting, and time range settings.
            {!isConnected && (
              <span className="ml-1 text-amber-500">
                Connect to a database to execute this query.
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// Simple SQL syntax highlighting using tokenization approach
function SqlHighlight({ sql }: { sql: string }) {
  const keywords = new Set([
    "SELECT", "FROM", "WHERE", "AND", "OR", "ORDER", "BY", "GROUP", "HAVING",
    "LIMIT", "OFFSET", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON", "AS",
    "DESC", "ASC", "DISTINCT", "NULL", "IS", "NOT", "IN", "BETWEEN", "LIKE",
    "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "CASE", "WHEN", "THEN",
    "ELSE", "END", "TRUE", "FALSE",
  ]);

  // Tokenize and highlight
  const tokens: React.ReactNode[] = [];
  
  // Split by spaces and special characters while preserving them
  const parts = sql.split(/(\s+|[(),;])/);
  
  parts.forEach((part, index) => {
    if (!part) return;
    
    // Check if it's whitespace or punctuation
    if (/^\s+$/.test(part) || /^[(),;]$/.test(part)) {
      tokens.push(<span key={index}>{part}</span>);
      return;
    }
    
    // Check if it's a keyword
    if (keywords.has(part.toUpperCase())) {
      tokens.push(
        <span key={index} className="text-blue-400 font-semibold">
          {part.toUpperCase()}
        </span>
      );
      return;
    }
    
    // Check if it's a string literal
    if (/^'.*'$/.test(part)) {
      tokens.push(
        <span key={index} className="text-amber-400">
          {part}
        </span>
      );
      return;
    }
    
    // Check if it's a number
    if (/^\d+$/.test(part)) {
      tokens.push(
        <span key={index} className="text-purple-400">
          {part}
        </span>
      );
      return;
    }
    
    // Check if it's a table.column reference
    if (/^[a-z_]+\.[a-z_]+$/i.test(part)) {
      const [table, column] = part.split(".");
      tokens.push(
        <span key={index}>
          <span className="text-cyan-400">{table}</span>
          <span className="text-muted-foreground">.</span>
          <span className="text-emerald-300">{column}</span>
        </span>
      );
      return;
    }
    
    // Check if it's a schema.table reference
    if (/^[a-z_]+\.[a-z_]+\.[a-z_]+$/i.test(part)) {
      const [schema, table, column] = part.split(".");
      tokens.push(
        <span key={index}>
          <span className="text-gray-500">{schema}</span>
          <span className="text-muted-foreground">.</span>
          <span className="text-cyan-400">{table}</span>
          <span className="text-muted-foreground">.</span>
          <span className="text-emerald-300">{column}</span>
        </span>
      );
      return;
    }
    
    // Default: plain text
    tokens.push(
      <span key={index} className="text-emerald-400">
        {part}
      </span>
    );
  });

  return <code className="block">{tokens}</code>;
}

