"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReportStore } from "@/store/report-store";
import { FieldChip } from "./field-chip";
import { cn } from "@/lib/utils";
import { getEntity } from "@/lib/entity-schema";
import { Layers, Plus } from "lucide-react";

export function ReportCanvas() {
  const { config, removeField, reorderFields } = useReportStore();
  const { isOver, setNodeRef } = useDroppable({
    id: "report-canvas",
  });

  const primaryEntity = config.primaryEntity
    ? getEntity(config.primaryEntity)
    : null;

  if (!config.primaryEntity) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Layers className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Start Building Your Report
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Select a primary entity from the sidebar to begin. Then drag and drop
            fields to build your custom report.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">Selected Fields</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {config.selectedFields.length}
          </span>
        </div>
        {config.selectedFields.length > 0 && (
          <button
            onClick={() => {
              // Clear all fields
              config.selectedFields.forEach((f) =>
                removeField(f.entityId, f.fieldId)
              );
            }}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Clear all
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[80px] rounded-xl border-2 border-dashed p-3 transition-all",
          isOver
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/30",
          config.selectedFields.length === 0 && "flex items-center justify-center"
        )}
      >
        {config.selectedFields.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Plus className="h-4 w-4" />
            Drag fields here to add them to your report
          </div>
        ) : (
          <SortableContext
            items={config.selectedFields.map(
              (f) => `${f.entityId}-${f.fieldId}`
            )}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex flex-wrap gap-2">
              {config.selectedFields.map((field, index) => (
                <SortableFieldChip
                  key={`${field.entityId}-${field.fieldId}`}
                  id={`${field.entityId}-${field.fieldId}`}
                  entityId={field.entityId}
                  fieldId={field.fieldId}
                  aggregation={field.aggregation}
                  onRemove={() => removeField(field.entityId, field.fieldId)}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

interface SortableFieldChipProps {
  id: string;
  entityId: string;
  fieldId: string;
  aggregation?: string;
  onRemove: () => void;
}

function SortableFieldChip({
  id,
  entityId,
  fieldId,
  aggregation,
  onRemove,
}: SortableFieldChipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(isDragging && "opacity-50")}
    >
      <FieldChip
        entityId={entityId}
        fieldId={fieldId}
        aggregation={aggregation as any}
        showRemove
        showGrip
        onRemove={onRemove}
      />
    </div>
  );
}

