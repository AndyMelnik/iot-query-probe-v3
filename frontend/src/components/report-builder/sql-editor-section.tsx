"use client";

import { useState } from "react";
import { useReportStore } from "@/store/report-store";
import { 
  Code2, 
  Play, 
  Copy, 
  Check, 
  AlertTriangle,
  Lightbulb,
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

// Example SQL queries
const EXAMPLE_QUERIES = [
  {
    name: "Basic tracking data",
    sql: `SELECT 
  t.lat / 10000000.0 AS latitude,
  t.lng / 10000000.0 AS longitude,
  t.speed / 100.0 AS speed_kmh,
  t.heading,
  t.server_time
FROM raw_telematics_data.tracking_data_core t
WHERE t.server_time >= NOW() - INTERVAL '24 hours'
ORDER BY t.server_time DESC
LIMIT 1000`
  },
  {
    name: "Vehicles with latest position",
    sql: `SELECT 
  v.label AS vehicle_name,
  v.model,
  t.lat / 10000000.0 AS latitude,
  t.lng / 10000000.0 AS longitude,
  t.speed / 100.0 AS speed_kmh,
  t.server_time
FROM raw_business_data.vehicles v
JOIN raw_telematics_data.tracking_data_core t 
  ON v.object_id = t.object_id
WHERE t.server_time >= NOW() - INTERVAL '1 hour'
ORDER BY t.server_time DESC
LIMIT 500`
  },
  {
    name: "Objects count by group",
    sql: `SELECT 
  g.label AS group_name,
  COUNT(o.object_id) AS object_count
FROM raw_business_data.groups g
LEFT JOIN raw_business_data.objects o 
  ON o.group_id = g.group_id
GROUP BY g.group_id, g.label
ORDER BY object_count DESC`
  },
  {
    name: "Geofence entries/exits",
    sql: `SELECT 
  gf.label AS geofence_name,
  COUNT(*) AS event_count,
  gf.address
FROM raw_business_data.geofences gf
GROUP BY gf.geofence_id, gf.label, gf.address
ORDER BY gf.label`
  }
];

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
  const [showExamples, setShowExamples] = useState(false);
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

  const loadExample = (sql: string) => {
    setCustomSql(sql);
    setShowExamples(false);
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
          {/* Examples dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent"
            >
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Examples
              {showExamples ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            
            {showExamples && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExamples(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-md border border-border bg-popover p-1 shadow-lg">
                  {EXAMPLE_QUERIES.map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => loadExample(example.sql)}
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <Code2 className="h-4 w-4 text-muted-foreground" />
                      {example.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          
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
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          <div>
            <p className="font-medium text-amber-500">Security Notice</p>
            <p className="text-muted-foreground">
              Only SELECT queries are allowed. Coordinates use 10⁷ precision (divide by 10,000,000), 
              speeds use 10² precision (divide by 100).
            </p>
          </div>
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

        {/* Schema reference hint */}
        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="font-medium">Available schemas:</p>
          <ul className="mt-1 space-y-0.5">
            <li>• <code className="text-primary">raw_business_data</code> — objects, vehicles, employees, groups, departments, geofences, pois, tags</li>
            <li>• <code className="text-primary">raw_telematics_data</code> — tracking_data_core, inputs, states</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

