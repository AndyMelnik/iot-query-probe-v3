"use client";

import { useState } from "react";
import { useReportStore } from "@/store/report-store";
import { EntitySidebar } from "./entity-sidebar";
import { ResultsPanel } from "./results-panel";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { FieldChip } from "./field-chip";
import { SelectedFieldsSection } from "./selected-fields-section";
import { ControlBarSection } from "./control-bar-section";
import { AdvancedModeSection } from "./advanced-mode-section";
import { Play } from "lucide-react";

export function ReportBuilder() {
  const { 
    isSidebarOpen, 
    config, 
    addField, 
    isLoading, 
    setLoading, 
    setQueryResult, 
    setError, 
    isConnected, 
    databaseUrl,
    isAuthenticated,
    devModeEnabled,
  } = useReportStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<{
    entityId: string;
    fieldId: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    if (active.data.current) {
      setActiveData(active.data.current as { entityId: string; fieldId: string });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && over.id === "selected-fields-drop" && active.data.current) {
      const { entityId, fieldId } = active.data.current as {
        entityId: string;
        fieldId: string;
      };
      addField({ entityId, fieldId });
    }

    setActiveId(null);
    setActiveData(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveData(null);
  };

  const handleRunQuery = async () => {
    if (!config.primaryEntity || config.selectedFields.length === 0) {
      setError("Please select at least one field");
      return;
    }

    if (!isConnected && !isAuthenticated) {
      setError("Please connect to a database first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use appropriate endpoint based on auth method
      const useDevMode = devModeEnabled && databaseUrl && !isAuthenticated;
      const endpoint = useDevMode ? "/api/query/execute-dev" : "/api/query/execute";
      
      const headers: HeadersInit = { "Content-Type": "application/json" };
      
      // Add auth token if authenticated via Navixy
      if (isAuthenticated) {
        const token = localStorage.getItem("auth_token");
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }
      
      const body = useDevMode 
        ? { config, databaseUrl }
        : config;

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

  const canRunQuery = config.primaryEntity && config.selectedFields.length > 0 && (isConnected || isAuthenticated);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-1 overflow-hidden">
        {/* Entity Sidebar */}
        <div
          className={cn(
            "flex-shrink-0 border-r border-border bg-card transition-all duration-300 overflow-y-auto",
            isSidebarOpen ? "w-72" : "w-0"
          )}
        >
          {isSidebarOpen && <EntitySidebar />}
        </div>

        {/* Main Content Area - Vertical Flow */}
        <div className="flex flex-1 flex-col overflow-auto">
          {/* Section 1: Selected Fields */}
          <SelectedFieldsSection />

          {/* Section 2: Control Bar - Filters, Sort, Time */}
          {config.primaryEntity && <ControlBarSection />}

          {/* Section 3: Advanced Mode - SQL Preview */}
          {config.primaryEntity && config.selectedFields.length > 0 && (
            <AdvancedModeSection />
          )}

          {/* Section 4: Run Query Button */}
          {config.primaryEntity && (
            <div className="border-t border-border bg-card/50 px-6 py-4">
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
                    Run Query
                  </>
                )}
              </button>
              {!isConnected && (
                <p className="mt-2 text-center text-sm text-amber-500">
                  Connect to a database first
                </p>
              )}
            </div>
          )}

          {/* Section 5: Results Panel */}
          <div className="flex-1 border-t border-border">
            <ResultsPanel />
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeData && (
          <FieldChip
            entityId={activeData.entityId}
            fieldId={activeData.fieldId}
            isDragging
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
