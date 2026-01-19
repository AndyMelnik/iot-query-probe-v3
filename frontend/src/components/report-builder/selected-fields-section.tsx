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
import { Layers, Plus, Trash2 } from "lucide-react";

export function SelectedFieldsSection() {
  const { config, removeField } = useReportStore();
  const { isOver, setNodeRef } = useDroppable({
    id: "selected-fields-drop",
  });

  const primaryEntity = config.primaryEntity
    ? getEntity(config.primaryEntity)
    : null;

  // Show empty state when no primary entity selected
  if (!config.primaryEntity) {
    return (
      <div className="border-b border-border bg-card/30 p-8">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Layers className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Start Building Your Report
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Select an entity from the sidebar to begin. Click on fields to add them to your report.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-card/30 p-6">
      {/* Section Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
            1
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Selected Fields</h3>
            <p className="text-xs text-muted-foreground">
              {config.selectedFields.length === 0
                ? "Click fields from the sidebar to add them"
                : `${config.selectedFields.length} field${config.selectedFields.length !== 1 ? "s" : ""} selected`}
            </p>
          </div>
        </div>
        {config.selectedFields.length > 0 && (
          <button
            onClick={() => {
              config.selectedFields.forEach((f) =>
                removeField(f.entityId, f.fieldId)
              );
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[100px] rounded-xl border-2 border-dashed p-4 transition-all",
          isOver
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/20",
          config.selectedFields.length === 0 && "flex items-center justify-center"
        )}
      >
        {config.selectedFields.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Plus className="h-6 w-6" />
            <span className="text-sm">Drag fields here or click them in the sidebar</span>
          </div>
        ) : (
          <SortableContext
            items={config.selectedFields.map(
              (f) => `${f.entityId}-${f.fieldId}`
            )}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex flex-wrap gap-2">
              {config.selectedFields.map((field) => (
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

