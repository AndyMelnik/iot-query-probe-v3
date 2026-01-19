"use client";

import { useEffect, useState } from "react";
import {
  Database,
  Loader2,
  Plug,
  Unplug,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  Shield,
} from "lucide-react";
import { useReportStore } from "@/store/report-store";
import { cn } from "@/lib/utils";

/**
 * Connection/Auth Status Bar
 * 
 * Shows authentication status from Navixy App Connect.
 * In dev mode (when available), also allows direct database URL connection.
 */
export function ConnectionBar() {
  const {
    // Auth state (Navixy App Connect)
    isAuthenticated,
    authUser,
    authError,
    checkAuth,
    logout,
    
    // Dev mode state
    devModeEnabled,
    databaseUrl,
    isConnected,
    isLoading,
    connectionError,
    setDevMode,
    setDatabaseUrl,
    testConnection,
    disconnect,
  } = useReportStore();

  const [showUrl, setShowUrl] = useState(false);
  const [localUrl, setLocalUrl] = useState(databaseUrl);
  const [showDevMode, setShowDevMode] = useState(false);
  const [devModeAvailable, setDevModeAvailable] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  
  // Check if dev mode is available by attempting to hit the endpoint
  useEffect(() => {
    async function checkDevMode() {
      try {
        const res = await fetch('/api/connection/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ databaseUrl: 'postgresql://test:test@localhost/test' }),
        });
        // If we get 403, dev mode is disabled
        // If we get 400 or connection error, dev mode is available
        setDevModeAvailable(res.status !== 403);
      } catch {
        // Network error - assume dev mode might be available
        setDevModeAvailable(true);
      }
    }
    checkDevMode();
  }, []);

  const handleConnect = async () => {
    setDatabaseUrl(localUrl);
    await testConnection();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConnect();
    }
  };

  const handleLogout = async () => {
    await logout();
    setShowDevMode(false);
  };

  // Determine overall connection status
  const isFullyConnected = isAuthenticated || (devModeEnabled && isConnected);

  return (
    <div
      className={cn(
        "flex flex-col border-b text-sm transition-colors",
        isFullyConnected
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-amber-500/30 bg-amber-500/5"
      )}
    >
      {/* Main status row */}
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <Shield
            className={cn(
              "h-4 w-4",
              isFullyConnected ? "text-emerald-500" : "text-amber-500"
            )}
          />
          <span
            className={cn(
              "font-medium",
              isFullyConnected ? "text-emerald-600" : "text-amber-600"
            )}
          >
            {isAuthenticated
              ? "Authenticated via Navixy"
              : devModeEnabled && isConnected
              ? "Dev Mode Connected"
              : "Not Authenticated"}
          </span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-border" />

        {/* User info or status */}
        {isAuthenticated && authUser ? (
          <>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{authUser.email}</span>
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {authUser.role}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handleLogout}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                  "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                )}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">
              {authError || "Please login through Navixy to access the database."}
            </span>
            
            {/* Dev mode toggle (if available) */}
            {devModeAvailable && (
              <button
                onClick={() => {
                  setShowDevMode(!showDevMode);
                  if (!showDevMode) {
                    setDevMode(true);
                  }
                }}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {showDevMode ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Dev Mode
              </button>
            )}
          </>
        )}

        {/* Dev mode indicator if connected via dev */}
        {devModeEnabled && isConnected && !isAuthenticated && (
          <div className="ml-auto flex items-center gap-2">
            <div className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-600">
              DEV MODE
            </div>
            <button
              onClick={() => {
                disconnect();
                setDevMode(false);
                setShowDevMode(false);
              }}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                "bg-red-500/10 text-red-600 hover:bg-red-500/20"
              )}
            >
              <Unplug className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Dev mode connection panel (expandable) */}
      {showDevMode && !isAuthenticated && devModeAvailable && (
        <div className="flex items-center gap-3 border-t border-amber-500/20 bg-amber-500/5 px-4 py-2">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-amber-500" />
            <label className="whitespace-nowrap text-muted-foreground">
              Database URL:
            </label>
          </div>
          <div className="relative flex-1 max-w-xl">
            <input
              type={showUrl ? "text" : "password"}
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="postgresql://user:password@host:5432/database"
              disabled={isConnected}
              className={cn(
                "h-8 w-full rounded-md border bg-background px-3 pr-10 text-sm",
                "placeholder:text-muted-foreground/50",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                connectionError && !isConnected && "border-red-500"
              )}
            />
            <button
              type="button"
              onClick={() => setShowUrl(!showUrl)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showUrl ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Error message */}
          {connectionError && (
            <div className="flex items-center gap-1 text-red-500">
              <XCircle className="h-4 w-4" />
              <span className="max-w-[200px] truncate text-xs">
                {connectionError}
              </span>
            </div>
          )}

          {/* Connect/Disconnect button */}
          {isConnected ? (
            <button
              onClick={() => {
                disconnect();
                setDevMode(false);
              }}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors",
                "bg-red-500/10 text-red-600 hover:bg-red-500/20"
              )}
            >
              <Unplug className="h-4 w-4" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isLoading || !localUrl}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plug className="h-4 w-4" />
              )}
              Connect
            </button>
          )}

          <div className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-600">
            ⚠️ DEV ONLY
          </div>
        </div>
      )}
    </div>
  );
}
