"use client";

import { useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Plus,
  SortAsc,
  X,
} from "lucide-react";
import { useReportStore } from "@/store/report-store";
import { getEntity, getEntityField } from "@/lib/entity-schema";
import { cn } from "@/lib/utils";
import { FilterOperator } from "@/types/entities";

const FILTER_OPERATORS: { value: FilterOperator; label: string; types: string[] }[] = [
  { value: "equals", label: "Equals", types: ["string", "number", "boolean", "enum"] },
  { value: "not_equals", label: "Not equals", types: ["string", "number", "boolean", "enum"] },
  { value: "contains", label: "Contains", types: ["string"] },
  { value: "not_contains", label: "Does not contain", types: ["string"] },
  { value: "starts_with", label: "Starts with", types: ["string"] },
  { value: "ends_with", label: "Ends with", types: ["string"] },
  { value: "greater_than", label: "Greater than", types: ["number", "datetime", "date"] },
  { value: "greater_equal", label: "Greater or equal", types: ["number", "datetime", "date"] },
  { value: "less_than", label: "Less than", types: ["number", "datetime", "date"] },
  { value: "less_equal", label: "Less or equal", types: ["number", "datetime", "date"] },
  { value: "between", label: "Between", types: ["number", "datetime", "date"] },
  { value: "is_null", label: "Is empty", types: ["string", "number", "datetime", "date", "boolean"] },
  { value: "is_not_null", label: "Is not empty", types: ["string", "number", "datetime", "date", "boolean"] },
];

export function ControlBarSection() {
  const [expandedSections, setExpandedSections] = useState<string[]>(["filters"]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  return (
    <div className="border-b border-border bg-card/30 p-6">
      {/* Section Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
          2
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Control Bar</h3>
          <p className="text-xs text-muted-foreground">
            Add filters, sorting, and time range for selected fields
          </p>
        </div>
      </div>

      {/* Collapsible Sections */}
      <div className="space-y-2">
        {/* Filters Section */}
        <CollapsibleSection
          title="Filters"
          icon={Filter}
          isExpanded={expandedSections.includes("filters")}
          onToggle={() => toggleSection("filters")}
          badge={<FilterBadge />}
        >
          <FiltersContent />
        </CollapsibleSection>

        {/* Sorting Section */}
        <CollapsibleSection
          title="Sorting"
          icon={SortAsc}
          isExpanded={expandedSections.includes("sorting")}
          onToggle={() => toggleSection("sorting")}
          badge={<SortBadge />}
        >
          <SortingContent />
        </CollapsibleSection>

        {/* Time Range Section */}
        <CollapsibleSection
          title="Time Range"
          icon={Calendar}
          isExpanded={expandedSections.includes("time")}
          onToggle={() => toggleSection("time")}
          badge={<TimeBadge />}
        >
          <TimeRangeContent />
        </CollapsibleSection>
      </div>
    </div>
  );
}

// Badges
function FilterBadge() {
  const { config } = useReportStore();
  if (config.filters.length === 0) return null;
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {config.filters.length}
    </span>
  );
}

function SortBadge() {
  const { config } = useReportStore();
  if (config.sorting.length === 0) return null;
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {config.sorting.length}
    </span>
  );
}

function TimeBadge() {
  const { config } = useReportStore();
  if (!config.timeRange && !config.timeField) return null;
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      Active
    </span>
  );
}

// Collapsible Section Component
interface CollapsibleSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  isExpanded: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  badge,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="rounded-lg border border-border bg-background/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-left text-sm font-medium">{title}</span>
        {badge}
      </button>
      {isExpanded && (
        <div className="border-t border-border px-4 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

// Filters Content - Only uses SELECTED fields
function FiltersContent() {
  const { config, addFilter, updateFilter, removeFilter, clearFilters } = useReportStore();

  // Get selected fields with their field info
  const selectedFieldsWithInfo = config.selectedFields
    .map((sf) => {
      const field = getEntityField(sf.entityId, sf.fieldId);
      const entity = getEntity(sf.entityId);
      return field && entity ? { entityId: sf.entityId, field, entity } : null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  const handleAddFilter = () => {
    if (selectedFieldsWithInfo.length > 0) {
      const firstField = selectedFieldsWithInfo[0];
      addFilter({
        entityId: firstField.entityId,
        fieldId: firstField.field.id,
        operator: "equals",
        value: "",
      });
    }
  };

  if (selectedFieldsWithInfo.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        Select fields above to enable filtering
      </div>
    );
  }

  if (config.filters.length === 0) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">No filters applied</span>
        <button
          onClick={handleAddFilter}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add filter
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {config.filters.map((filter, index) => (
        <FilterRow
          key={filter.id}
          filter={filter}
          availableFields={selectedFieldsWithInfo}
          index={index}
          onUpdate={(updates) => updateFilter(filter.id, updates)}
          onRemove={() => removeFilter(filter.id)}
        />
      ))}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleAddFilter}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Plus className="h-4 w-4" />
          Add filter
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          onClick={clearFilters}
          className="text-sm text-muted-foreground hover:text-destructive"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}

interface FilterRowFilter {
  id: string;
  entityId: string;
  fieldId: string;
  operator: FilterOperator;
  value: unknown;
}

interface FilterRowProps {
  filter: FilterRowFilter;
  availableFields: { entityId: string; field: { id: string; displayName: string; type: string }; entity: { displayName: string } }[];
  index: number;
  onUpdate: (updates: Partial<FilterRowFilter>) => void;
  onRemove: () => void;
}

function FilterRow({ filter, availableFields, index, onUpdate, onRemove }: FilterRowProps) {
  const selectedFieldInfo = availableFields.find(
    (f) => f.entityId === filter.entityId && f.field.id === filter.fieldId
  );
  const fieldType = selectedFieldInfo?.field.type || "string";
  const applicableOperators = FILTER_OPERATORS.filter((op) =>
    op.types.includes(fieldType)
  );

  // Determine input type based on field type
  const getInputType = () => {
    if (fieldType === "number") return "number";
    if (fieldType === "datetime" || fieldType === "date") return "datetime-local";
    return "text";
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
      {index > 0 && (
        <span className="px-2 text-xs font-medium uppercase text-muted-foreground">AND</span>
      )}
      <select
        value={`${filter.entityId}::${filter.fieldId}`}
        onChange={(e) => {
          const [entityId, fieldId] = e.target.value.split("::");
          onUpdate({ entityId, fieldId });
        }}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
      >
        {availableFields.map((f) => (
          <option key={`${f.entityId}-${f.field.id}`} value={`${f.entityId}::${f.field.id}`}>
            {f.entity.displayName}.{f.field.displayName}
          </option>
        ))}
      </select>
      <select
        value={filter.operator}
        onChange={(e) => onUpdate({ operator: e.target.value as FilterOperator })}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
      >
        {applicableOperators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      {!["is_null", "is_not_null"].includes(filter.operator) && (
        <input
          type={getInputType()}
          value={filter.value as string}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder="Value"
          className="h-8 flex-1 min-w-[120px] rounded-md border border-input bg-background px-2 text-sm"
        />
      )}
      <button
        onClick={onRemove}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Sorting Content - Only uses SELECTED fields
function SortingContent() {
  const { config, addSort, removeSort, clearSorting } = useReportStore();

  // Get selected fields with their field info (only sortable ones)
  const selectedFieldsWithInfo = config.selectedFields
    .map((sf) => {
      const field = getEntityField(sf.entityId, sf.fieldId);
      const entity = getEntity(sf.entityId);
      return field && entity ? { entityId: sf.entityId, field, entity } : null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  // Fields not yet used in sorting
  const availableForSort = selectedFieldsWithInfo.filter(
    (sf) => !config.sorting.some((s) => s.entityId === sf.entityId && s.fieldId === sf.field.id)
  );

  const handleAddSort = () => {
    if (availableForSort.length > 0) {
      const firstField = availableForSort[0];
      addSort({
        entityId: firstField.entityId,
        fieldId: firstField.field.id,
        direction: "asc",
      });
    }
  };

  if (selectedFieldsWithInfo.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <SortAsc className="h-4 w-4" />
        Select fields above to enable sorting
      </div>
    );
  }

  if (config.sorting.length === 0) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">No sorting applied</span>
        <button
          onClick={handleAddSort}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add sorting
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {config.sorting.map((sort, index) => {
        const fieldInfo = selectedFieldsWithInfo.find(
          (f) => f.entityId === sort.entityId && f.field.id === sort.fieldId
        );

        return (
          <div
            key={`${sort.entityId}-${sort.fieldId}`}
            className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2"
          >
            {index > 0 && (
              <span className="px-2 text-xs font-medium uppercase text-muted-foreground">THEN</span>
            )}
            <select
              value={`${sort.entityId}::${sort.fieldId}`}
              onChange={(e) => {
                const [entityId, fieldId] = e.target.value.split("::");
                // Remove old sort and add new one
                removeSort(sort.entityId, sort.fieldId);
                addSort({ entityId, fieldId, direction: sort.direction });
              }}
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm"
            >
              {/* Current field */}
              {fieldInfo && (
                <option value={`${sort.entityId}::${sort.fieldId}`}>
                  {fieldInfo.entity.displayName}.{fieldInfo.field.displayName}
                </option>
              )}
              {/* Available fields not yet used */}
              {availableForSort.map((f) => (
                <option key={`${f.entityId}-${f.field.id}`} value={`${f.entityId}::${f.field.id}`}>
                  {f.entity.displayName}.{f.field.displayName}
                </option>
              ))}
            </select>
            <select
              value={sort.direction}
              onChange={(e) => {
                removeSort(sort.entityId, sort.fieldId);
                addSort({
                  entityId: sort.entityId,
                  fieldId: sort.fieldId,
                  direction: e.target.value as "asc" | "desc",
                });
              }}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="asc">A → Z (Ascending)</option>
              <option value="desc">Z → A (Descending)</option>
            </select>
            <button
              onClick={() => removeSort(sort.entityId, sort.fieldId)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      {availableForSort.length > 0 && (
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleAddSort}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            Add another sort
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            onClick={clearSorting}
            className="text-sm text-muted-foreground hover:text-destructive"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

// Time Range Content - Uses datetime fields from selected fields
function TimeRangeContent() {
  const { config, setTimeRange, setTimeField } = useReportStore();

  // Get datetime fields from selected fields
  const datetimeFields = config.selectedFields
    .map((sf) => {
      const field = getEntityField(sf.entityId, sf.fieldId);
      const entity = getEntity(sf.entityId);
      return field && entity && (field.type === "datetime" || field.type === "date")
        ? { entityId: sf.entityId, field, entity }
        : null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  // Quick presets for relative time
  const quickPresets = [
    { label: "Last Hour", value: 1, unit: "hours" as const },
    { label: "Last 24 Hours", value: 24, unit: "hours" as const },
    { label: "Last 7 Days", value: 7, unit: "days" as const },
    { label: "Last 30 Days", value: 30, unit: "days" as const },
    { label: "Last 3 Months", value: 3, unit: "months" as const },
  ];

  if (datetimeFields.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        Select datetime fields above to enable time filtering
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Time field selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Time Field
        </label>
        <select
          value={config.timeField || ""}
          onChange={(e) => {
            setTimeField(e.target.value || undefined);
            if (!e.target.value) {
              setTimeRange(undefined);
            }
          }}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Select a time field...</option>
          {datetimeFields.map((f) => (
            <option key={`${f.entityId}-${f.field.id}`} value={`${f.entityId}::${f.field.id}`}>
              {f.entity.displayName}.{f.field.displayName}
            </option>
          ))}
        </select>
      </div>

      {config.timeField && (
        <>
          {/* Quick Presets */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {quickPresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() =>
                    setTimeRange({
                      type: "relative",
                      relativeValue: preset.value,
                      relativeUnit: preset.unit,
                    })
                  }
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    config.timeRange?.type === "relative" &&
                      config.timeRange.relativeValue === preset.value &&
                      config.timeRange.relativeUnit === preset.unit
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 text-muted-foreground"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Range Section */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Custom Range
            </label>
            
            {/* Range Type Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setTimeRange({
                    type: "relative",
                    relativeValue: config.timeRange?.relativeValue || 7,
                    relativeUnit: config.timeRange?.relativeUnit || "days",
                  })
                }
                className={cn(
                  "flex-1 rounded-lg border px-4 py-2 text-sm transition-colors",
                  config.timeRange?.type === "relative"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                Relative
              </button>
              <button
                onClick={() => setTimeRange({ type: "absolute" })}
                className={cn(
                  "flex-1 rounded-lg border px-4 py-2 text-sm transition-colors",
                  config.timeRange?.type === "absolute"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                Absolute
              </button>
            </div>

            {/* Relative time custom input */}
            {config.timeRange?.type === "relative" && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
                <span className="text-sm text-muted-foreground">Last</span>
                <input
                  type="number"
                  min="1"
                  value={config.timeRange.relativeValue || 7}
                  onChange={(e) =>
                    setTimeRange({
                      ...config.timeRange!,
                      relativeValue: parseInt(e.target.value) || 1,
                    })
                  }
                  className="h-8 w-20 rounded-md border border-input bg-background px-3 text-sm text-center"
                />
                <select
                  value={config.timeRange.relativeUnit || "days"}
                  onChange={(e) =>
                    setTimeRange({
                      ...config.timeRange!,
                      relativeUnit: e.target.value as "hours" | "days" | "weeks" | "months",
                    })
                  }
                  className="h-8 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>
              </div>
            )}

            {/* Absolute time inputs */}
            {config.timeRange?.type === "absolute" && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Start Date/Time</label>
                    <input
                      type="datetime-local"
                      value={config.timeRange.startDate || ""}
                      onChange={(e) =>
                        setTimeRange({
                          ...config.timeRange!,
                          startDate: e.target.value,
                        })
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">End Date/Time</label>
                    <input
                      type="datetime-local"
                      value={config.timeRange.endDate || ""}
                      onChange={(e) =>
                        setTimeRange({
                          ...config.timeRange!,
                          endDate: e.target.value,
                        })
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Clear button */}
          <button
            onClick={() => {
              setTimeRange(undefined);
              setTimeField(undefined);
            }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear time filter
          </button>
        </>
      )}
    </div>
  );
}
