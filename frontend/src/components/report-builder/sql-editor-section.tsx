"use client";

import { useState } from "react";
import { useReportStore } from "@/store/report-store";
import { 
  Code2, 
  Play, 
  Copy, 
  Check, 
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";

// SQL syntax highlighting (simple version)
function highlightSql(sql: string): string {
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN',
    'LIKE', 'ILIKE', 'IS', 'NULL', 'TRUE', 'FALSE', 'AS', 'ON',
    'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS',
    'ORDER', 'BY', 'ASC', 'DESC', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
    'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'EXTRACT',
    'UNION', 'INTERSECT', 'EXCEPT', 'ALL', 'EXISTS', 'ANY', 'WITH'
  ];
  
  let highlighted = sql;
  keywords.forEach(kw => {
    const regex = new RegExp(`\\b(${kw})\\b`, 'gi');
    highlighted = highlighted.replace(regex, `<span class="text-primary font-semibold">$1</span>`);
  });
  
  // Highlight strings
  highlighted = highlighted.replace(/'([^']*)'/g, '<span class="text-green-400">\'$1\'</span>');
  
  // Highlight numbers
  highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-amber-400">$1</span>');
  
  // Highlight comments
  highlighted = highlighted.replace(/--(.*?)$/gm, '<span class="text-muted-foreground italic">--$1</span>');
  
  return highlighted;
}

export function SqlEditorSection() {
  const { 
    customSql, 
    setCustomSql, 
    isLoading, 
    setLoading, 
    setQueryResult, 
    setError,
    isConnected,
    isAuthenticated,
    databaseUrl,
    devModeEnabled,
  } = useReportStore();
  
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(customSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunQuery = async () => {
    if (!customSql.trim()) {
      setError("Please enter a SQL query");
      return;
    }

    if (!isConnected && !isAuthenticated) {
      setError("Please connect to a database first");
      return;
    }

    // Basic SQL validation
    const upperSql = customSql.trim().toUpperCase();
    if (!upperSql.startsWith('SELECT')) {
      setError("Only SELECT queries are allowed for security reasons");
      return;
    }

    // Check for dangerous operations
    const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE'];
    for (const keyword of forbidden) {
      if (upperSql.includes(keyword)) {
        setError(`${keyword} operations are not allowed. Only SELECT queries are permitted.`);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const useDevMode = devModeEnabled && databaseUrl && !isAuthenticated;
      const endpoint = useDevMode ? "/api/query/execute-raw-dev" : "/api/query/execute-raw";
      
      const headers: HeadersInit = { "Content-Type": "application/json" };
      
      if (isAuthenticated) {
        const token = localStorage.getItem("auth_token");
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }
      
      const body = useDevMode 
        ? { sql: customSql, databaseUrl }
        : { sql: customSql };

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Query execution failed");
      }

      const result = await response.json();
      setQueryResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const canRunQuery = customSql.trim().length > 0 && (isConnected || isAuthenticated);

  return (
    <div className="border-t border-border bg-card/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">SQL Query Editor</h3>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-500">
            Advanced Mode
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!customSql}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="p-4">
        {/* Warning */}
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
          <p className="font-medium text-amber-500">Security Notice</p>
          <span className="text-muted-foreground">— Only SELECT queries are allowed.</span>
        </div>

        {/* SQL Input */}
        <div className="relative">
          <textarea
            value={customSql}
            onChange={(e) => setCustomSql(e.target.value)}
            placeholder={`-- Enter your SQL query here
SELECT 
  column1,
  column2 / 10000000.0 AS lat,
  column3 / 100.0 AS speed
FROM raw_telematics_data.tracking_data_core
WHERE ...
LIMIT 1000`}
            className={cn(
              "min-h-[200px] w-full resize-y rounded-lg border border-input bg-background p-4 font-mono text-sm",
              "placeholder:text-muted-foreground/50",
              "focus:outline-none focus:ring-2 focus:ring-primary"
            )}
            spellCheck={false}
          />
        </div>

        {/* Preview toggle */}
        {customSql && (
          <div className="mt-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {showPreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showPreview ? "Hide" : "Show"} syntax highlighted preview
            </button>
            
            {showPreview && (
              <div 
                className="mt-2 max-h-[300px] overflow-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-sm"
                dangerouslySetInnerHTML={{ __html: highlightSql(customSql) }}
              />
            )}
          </div>
        )}

        {/* Run Button */}
        <div className="mt-4">
          <button
            onClick={handleRunQuery}
            disabled={isLoading || !canRunQuery}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold transition-all",
              canRunQuery
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Executing...
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Run SQL Query
              </>
            )}
          </button>
          {!isConnected && !isAuthenticated && (
            <p className="mt-2 text-center text-sm text-amber-500">
              Connect to a database first
            </p>
          )}
        </div>

      </div>
    </div>
  );
}

