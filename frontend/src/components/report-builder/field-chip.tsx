"use client";

import { X, GripVertical, ChevronDown } from "lucide-react";
import { getEntity, getEntityField } from "@/lib/entity-schema";
import { cn } from "@/lib/utils";
import { useReportStore } from "@/store/report-store";
import { AggregationType } from "@/types/entities";
import { useState } from "react";

interface FieldChipProps {
  entityId: string;
  fieldId: string;
  aggregation?: AggregationType;
  isDragging?: boolean;
  showRemove?: boolean;
  showGrip?: boolean;
  onRemove?: () => void;
}

const AGGREGATION_LABELS: Record<AggregationType, string> = {
  count: "COUNT",
  sum: "SUM",
  avg: "AVG",
  min: "MIN",
  max: "MAX",
  count_distinct: "COUNT DISTINCT",
};

export function FieldChip({
  entityId,
  fieldId,
  aggregation,
  isDragging,
  showRemove = false,
  showGrip = false,
  onRemove,
}: FieldChipProps) {
  const entity = getEntity(entityId);
  const field = getEntityField(entityId, fieldId);
  const { updateFieldAggregation, config } = useReportStore();
  const [showAggDropdown, setShowAggDropdown] = useState(false);

  if (!entity || !field) return null;

  const hasGroupBy = (config.groupBy?.length || 0) > 0;
  const canAggregate = field.aggregations && field.aggregations.length > 0;
  const shouldShowAgg = hasGroupBy && canAggregate;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5",
        "text-sm font-medium transition-all",
        isDragging
          ? "border-primary bg-primary/20 shadow-lg scale-105"
          : "border-border bg-card hover:border-primary/50",
        "animate-drop-in"
      )}
      style={{
        borderLeftColor: entity.color,
        borderLeftWidth: 3,
      }}
    >
      {showGrip && (
        <GripVertical className="h-3.5 w-3.5 cursor-grab text-muted-foreground active:cursor-grabbing" />
      )}

      <span className="text-xs text-muted-foreground">{entity.displayName}.</span>
      <span className="text-foreground">{field.displayName}</span>

      {/* Aggregation selector */}
      {shouldShowAgg && (
        <div className="relative ml-1">
          <button
            onClick={() => setShowAggDropdown(!showAggDropdown)}
            className={cn(
              "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase transition-colors",
              aggregation
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {aggregation ? AGGREGATION_LABELS[aggregation] : "AGG"}
            <ChevronDown className="h-3 w-3" />
          </button>

          {showAggDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAggDropdown(false)}
              />
              <div className="absolute left-0 top-full z-50 mt-1 w-32 rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={() => {
                    updateFieldAggregation(entityId, fieldId, undefined);
                    setShowAggDropdown(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent",
                    !aggregation && "bg-accent"
                  )}
                >
                  None
                </button>
                {field.aggregations?.map((agg) => (
                  <button
                    key={agg}
                    onClick={() => {
                      updateFieldAggregation(entityId, fieldId, agg);
                      setShowAggDropdown(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent",
                      aggregation === agg && "bg-accent"
                    )}
                  >
                    {AGGREGATION_LABELS[agg]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {showRemove && onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

