"use client";

import { useState, useEffect, useRef } from "react";
import { useReportStore } from "@/store/report-store";
import { 
  Code2, 
  Play, 
  Copy, 
  Check, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  Zap,
  Timer,
  BarChart3,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

// Execution stages for progress tracking
type ExecutionStage = 
  | 'idle' 
  | 'validating' 
  | 'connecting' 
  | 'executing' 
  | 'processing' 
  | 'complete' 
  | 'error';

interface ExecutionStatus {
  stage: ExecutionStage;
  message: string;
  startTime?: number;
  elapsedTime?: number;
}

// HTML escape function to prevent XSS
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

// SQL syntax highlighting (simple version) - with XSS protection
function highlightSql(sql: string): string {
  // SECURITY: Escape HTML first to prevent XSS
  let highlighted = escapeHtml(sql);
  
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN',
    'LIKE', 'ILIKE', 'IS', 'NULL', 'TRUE', 'FALSE', 'AS', 'ON',
    'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS',
    'ORDER', 'BY', 'ASC', 'DESC', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
    'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'EXTRACT',
    'UNION', 'INTERSECT', 'EXCEPT', 'ALL', 'EXISTS', 'ANY', 'WITH'
  ];
  
  keywords.forEach(kw => {
    const regex = new RegExp(`\\b(${kw})\\b`, 'gi');
    highlighted = highlighted.replace(regex, `<span class="text-primary font-semibold">$1</span>`);
  });
  
  // Highlight strings (already escaped, so use &#39; for quotes)
  highlighted = highlighted.replace(/&#39;([^&#39;]*)&#39;/g, '<span class="text-green-400">&#39;$1&#39;</span>');
  
  // Highlight numbers
  highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-amber-400">$1</span>');
  
  // Highlight comments
  highlighted = highlighted.replace(/--(.*?)$/gm, '<span class="text-muted-foreground italic">--$1</span>');
  
  return highlighted;
}

// Parse error message and provide helpful suggestions
function parseErrorMessage(error: string): { message: string; suggestions: string[]; category: string } {
  const lowerError = error.toLowerCase();
  
  // Connection errors
  if (lowerError.includes('connection') || lowerError.includes('connect') || lowerError.includes('timeout')) {
    return {
      message: error,
      category: 'Connection Error',
      suggestions: [
        'Check your internet connection',
        'The database server might be temporarily unavailable',
        'Try again in a few moments',
        'If the issue persists, contact support'
      ]
    };
  }
  
  // Authentication errors
  if (lowerError.includes('auth') || lowerError.includes('permission') || lowerError.includes('denied') || lowerError.includes('401')) {
    return {
      message: error,
      category: 'Authentication Error',
      suggestions: [
        'Your session may have expired - try refreshing the page',
        'Make sure you are logged in',
        'Check if you have access to the requested data'
      ]
    };
  }
  
  // Syntax errors
  if (lowerError.includes('syntax') || lowerError.includes('parse')) {
    return {
      message: error,
      category: 'SQL Syntax Error',
      suggestions: [
        'Check your SQL syntax for typos',
        'Ensure all parentheses and quotes are properly closed',
        'Verify table and column names are correct',
        'Use the syntax preview to check highlighting'
      ]
    };
  }
  
  // Table/column not found
  if (lowerError.includes('does not exist') || lowerError.includes('not found') || lowerError.includes('unknown column') || lowerError.includes('unknown table')) {
    return {
      message: error,
      category: 'Invalid Reference',
      suggestions: [
        'Check if the table/column name is spelled correctly',
        'Make sure to use the full schema name (e.g., raw_telematics_data.tracking_data_core)',
        'Verify the table exists in your database',
        'Available schemas: raw_business_data, raw_telematics_data'
      ]
    };
  }
  
  // Timeout errors
  if (lowerError.includes('timeout') || lowerError.includes('too long') || lowerError.includes('cancelled')) {
    return {
      message: error,
      category: 'Query Timeout',
      suggestions: [
        'Your query may be too complex or returning too much data',
        'Try adding a LIMIT clause to reduce results',
        'Add more specific WHERE conditions to filter data',
        'Consider querying a smaller date range'
      ]
    };
  }
  
  // Security/forbidden
  if (lowerError.includes('not allowed') || lowerError.includes('forbidden') || lowerError.includes('security')) {
    return {
      message: error,
      category: 'Security Restriction',
      suggestions: [
        'Only SELECT queries are allowed',
        'Avoid using INSERT, UPDATE, DELETE, DROP, or other modification commands',
        'This is a read-only interface for data analysis'
      ]
    };
  }
  
  // Default
  return {
    message: error,
    category: 'Query Error',
    suggestions: [
      'Review your SQL query for errors',
      'Check the syntax and table/column names',
      'Try a simpler query first to test the connection'
    ]
  };
}

// Format elapsed time for display
function formatElapsedTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

export function SqlEditorSection() {
  const { 
    customSql, 
    setCustomSql, 
    isLoading, 
    setLoading, 
    setQueryResult, 
    setError,
    error,
    queryResult,
    isConnected,
    isAuthenticated,
    databaseUrl,
    devModeEnabled,
  } = useReportStore();
  
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>({ stage: 'idle', message: '' });
  const [lastQueryStats, setLastQueryStats] = useState<{
    executionTime: number;
    totalRows: number;
    columns: number;
    timestamp: Date;
  } | null>(null);
  
  // Timer for elapsed time display
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [displayElapsed, setDisplayElapsed] = useState(0);
  
  // Update elapsed time during execution
  useEffect(() => {
    if (executionStatus.stage !== 'idle' && executionStatus.stage !== 'complete' && executionStatus.stage !== 'error' && executionStatus.startTime) {
      timerRef.current = setInterval(() => {
        setDisplayElapsed(Date.now() - executionStatus.startTime!);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [executionStatus.stage, executionStatus.startTime]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(customSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateStatus = (stage: ExecutionStage, message: string) => {
    setExecutionStatus(prev => ({
      stage,
      message,
      startTime: stage === 'validating' ? Date.now() : prev.startTime,
      elapsedTime: prev.startTime ? Date.now() - prev.startTime : undefined
    }));
  };

  const handleRunQuery = async () => {
    if (!customSql.trim()) {
      setError("Please enter a SQL query");
      updateStatus('error', 'No query provided');
      return;
    }

    if (!isConnected && !isAuthenticated) {
      setError("Please connect to a database first");
      updateStatus('error', 'Not connected to database');
      return;
    }

    // Reset previous results and errors
    setQueryResult(null);
    setError(null);
    setLastQueryStats(null);
    
    // Stage 1: Validating
    updateStatus('validating', 'Validating SQL query...');
    await new Promise(r => setTimeout(r, 200)); // Small delay for UI feedback

    // Basic SQL validation
    const upperSql = customSql.trim().toUpperCase();
    if (!upperSql.startsWith('SELECT')) {
      setError("Only SELECT queries are allowed for security reasons");
      updateStatus('error', 'Invalid query: must start with SELECT');
      return;
    }

    // Check for dangerous operations
    const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE'];
    for (const keyword of forbidden) {
      if (upperSql.includes(keyword)) {
        setError(`${keyword} operations are not allowed. Only SELECT queries are permitted.`);
        updateStatus('error', `Blocked operation: ${keyword}`);
        return;
      }
    }

    // Check for LIMIT clause warning
    if (!upperSql.includes('LIMIT')) {
      console.warn('Query has no LIMIT clause - may return large result set');
    }

    setLoading(true);

    try {
      // Stage 2: Connecting
      updateStatus('connecting', 'Connecting to database...');
      await new Promise(r => setTimeout(r, 100));
      
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

      // Stage 3: Executing
      updateStatus('executing', 'Executing query on database server...');

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      // Stage 4: Processing
      updateStatus('processing', 'Processing results...');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Query execution failed");
      }

      const result = await response.json();
      
      // Store query stats
      setLastQueryStats({
        executionTime: result.executionTime || 0,
        totalRows: result.totalRows || 0,
        columns: result.columns?.length || 0,
        timestamp: new Date()
      });
      
      setQueryResult(result);
      
      // Stage 5: Complete
      const completionMessage = result.totalRows === 0 
        ? 'Query completed - no rows returned'
        : `Query completed - ${result.totalRows.toLocaleString()} row${result.totalRows !== 1 ? 's' : ''} returned`;
      updateStatus('complete', completionMessage);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      updateStatus('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const canRunQuery = customSql.trim().length > 0 && (isConnected || isAuthenticated);
  
  // Parse error for display
  const parsedError = error ? parseErrorMessage(error) : null;

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
              "focus:outline-none focus:ring-2 focus:ring-primary",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
            spellCheck={false}
            disabled={isLoading}
          />
          
          {/* Query length indicator */}
          {customSql.length > 0 && (
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {customSql.length.toLocaleString()} chars
              {!customSql.toUpperCase().includes('LIMIT') && customSql.trim().length > 0 && (
                <span className="ml-2 text-amber-500" title="Consider adding LIMIT to prevent large result sets">
                  ⚠️ No LIMIT
                </span>
              )}
            </div>
          )}
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
                className="mt-2 max-h-[300px] overflow-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-sm whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: highlightSql(customSql) }}
              />
            )}
          </div>
        )}

        {/* Execution Status Panel */}
        {(isLoading || executionStatus.stage === 'complete' || executionStatus.stage === 'error') && (
          <div className={cn(
            "mt-4 rounded-lg border p-4",
            executionStatus.stage === 'error' && "border-red-500/30 bg-red-500/5",
            executionStatus.stage === 'complete' && "border-green-500/30 bg-green-500/5",
            isLoading && "border-primary/30 bg-primary/5"
          )}>
            {/* Status Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Status Icon */}
                {executionStatus.stage === 'validating' && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                {executionStatus.stage === 'connecting' && (
                  <Database className="h-5 w-5 animate-pulse text-primary" />
                )}
                {executionStatus.stage === 'executing' && (
                  <Zap className="h-5 w-5 animate-pulse text-amber-500" />
                )}
                {executionStatus.stage === 'processing' && (
                  <BarChart3 className="h-5 w-5 animate-pulse text-primary" />
                )}
                {executionStatus.stage === 'complete' && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                {executionStatus.stage === 'error' && (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                
                {/* Status Text */}
                <div>
                  <p className={cn(
                    "font-medium",
                    executionStatus.stage === 'error' && "text-red-500",
                    executionStatus.stage === 'complete' && "text-green-500",
                    isLoading && "text-primary"
                  )}>
                    {executionStatus.stage === 'validating' && 'Validating Query'}
                    {executionStatus.stage === 'connecting' && 'Connecting to Database'}
                    {executionStatus.stage === 'executing' && 'Executing Query'}
                    {executionStatus.stage === 'processing' && 'Processing Results'}
                    {executionStatus.stage === 'complete' && 'Query Complete'}
                    {executionStatus.stage === 'error' && (parsedError?.category || 'Error')}
                  </p>
                  <p className="text-sm text-muted-foreground">{executionStatus.message}</p>
                </div>
              </div>
              
              {/* Elapsed Time */}
              {(isLoading || executionStatus.stage === 'complete') && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Timer className="h-4 w-4" />
                  {isLoading ? formatElapsedTime(displayElapsed) : lastQueryStats && formatElapsedTime(lastQueryStats.executionTime)}
                </div>
              )}
            </div>
            
            {/* Progress Steps */}
            {isLoading && (
              <div className="mt-4 flex items-center gap-2">
                {['validating', 'connecting', 'executing', 'processing'].map((step, idx) => {
                  const stepOrder = ['validating', 'connecting', 'executing', 'processing'];
                  const currentIdx = stepOrder.indexOf(executionStatus.stage);
                  const isComplete = idx < currentIdx;
                  const isCurrent = idx === currentIdx;
                  
                  return (
                    <div key={step} className="flex items-center">
                      <div className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-all",
                        isComplete && "bg-primary text-primary-foreground",
                        isCurrent && "bg-primary/20 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background",
                        !isComplete && !isCurrent && "bg-muted text-muted-foreground"
                      )}>
                        {isComplete ? <Check className="h-3 w-3" /> : idx + 1}
                      </div>
                      {idx < 3 && (
                        <div className={cn(
                          "h-0.5 w-8 transition-all",
                          isComplete ? "bg-primary" : "bg-muted"
                        )} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Error Details with Suggestions */}
            {executionStatus.stage === 'error' && parsedError && (
              <div className="mt-4 space-y-3">
                <div className="rounded-md bg-red-500/10 p-3">
                  <p className="text-sm text-red-400 font-mono break-all">{parsedError.message}</p>
                </div>
                
                {parsedError.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Info className="h-4 w-4 text-muted-foreground" />
                      Suggestions:
                    </p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {parsedError.suggestions.map((suggestion, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Query Statistics (shown after successful query) */}
        {lastQueryStats && executionStatus.stage === 'complete' && !error && (
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
                <BarChart3 className="h-3.5 w-3.5" />
                Rows
              </div>
              <p className="text-lg font-semibold text-foreground">{lastQueryStats.totalRows.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Database className="h-3.5 w-3.5" />
                Columns
              </div>
              <p className="text-lg font-semibold text-foreground">{lastQueryStats.columns}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Timer className="h-3.5 w-3.5" />
                Time
              </div>
              <p className="text-lg font-semibold text-foreground">{formatElapsedTime(lastQueryStats.executionTime)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Clock className="h-3.5 w-3.5" />
                Executed
              </div>
              <p className="text-sm font-medium text-foreground">{lastQueryStats.timestamp.toLocaleTimeString()}</p>
            </div>
          </div>
        )}

        {/* Run Button */}
        <div className="mt-4">
          <button
            onClick={handleRunQuery}
            disabled={isLoading || !canRunQuery}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold transition-all",
              canRunQuery && !isLoading
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Executing Query...
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Run SQL Query
              </>
            )}
          </button>
          {!isConnected && !isAuthenticated && (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-amber-500">
              <AlertCircle className="h-4 w-4" />
              Connect to a database first
            </div>
          )}
        </div>
        
        {/* Tips for large queries */}
        {customSql.length > 5000 && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm">
            <Info className="h-4 w-4 flex-shrink-0 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-blue-500">Large Query Detected</p>
              <p className="text-muted-foreground">
                Your query is quite long. For best performance, consider:
              </p>
              <ul className="mt-1 text-muted-foreground list-disc list-inside">
                <li>Adding a LIMIT clause to restrict results</li>
                <li>Using specific date/time filters</li>
                <li>Selecting only the columns you need</li>
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

