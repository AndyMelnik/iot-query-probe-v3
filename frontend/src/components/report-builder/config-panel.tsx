"use client";

import { useState } from "react";
import {
  Calendar,
  ChevronDown,
  Filter,
  Group,
  Layers,
  Play,
  Plus,
  SortAsc,
  Trash2,
  X,
} from "lucide-react";
import { useReportStore } from "@/store/report-store";
import { getEntity, getEntityField, ENTITIES } from "@/lib/entity-schema";
import { cn } from "@/lib/utils";
import { FilterOperator, TimeRange } from "@/types/entities";

const FILTER_OPERATORS: { value: FilterOperator; label: string; types: string[] }[] = [
  { value: "equals", label: "Equals", types: ["string", "number", "boolean", "enum"] },
  { value: "not_equals", label: "Not equals", types: ["string", "number", "boolean", "enum"] },
  { value: "contains", label: "Contains", types: ["string"] },
  { value: "not_contains", label: "Does not contain", types: ["string"] },
  { value: "starts_with", label: "Starts with", types: ["string"] },
  { value: "ends_with", label: "Ends with", types: ["string"] },
  { value: "greater_than", label: "Greater than", types: ["number", "datetime"] },
  { value: "greater_equal", label: "Greater or equal", types: ["number", "datetime"] },
  { value: "less_than", label: "Less than", types: ["number", "datetime"] },
  { value: "less_equal", label: "Less or equal", types: ["number", "datetime"] },
  { value: "between", label: "Between", types: ["number", "datetime"] },
  { value: "is_null", label: "Is empty", types: ["string", "number", "datetime", "boolean"] },
  { value: "is_not_null", label: "Is not empty", types: ["string", "number", "datetime", "boolean"] },
];

export function ConfigPanel() {
  const [activeTab, setActiveTab] = useState<"filters" | "sort" | "group" | "time">("filters");
  const { config, isLoading, setLoading, setQueryResult, setError, isConnected, databaseUrl } = useReportStore();

  const handleRunQuery = async () => {
    if (!config.primaryEntity || config.selectedFields.length === 0) {
      setError("Please select at least one field");
      return;
    }

    // Check if we have a database connection in dev mode
    if (!isConnected) {
      setError("Please connect to a database first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use dev endpoint with direct database URL
      const response = await fetch("/api/query/execute-dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: config,
          databaseUrl: databaseUrl,
        }),
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

  return (
    <div className="border-t border-border bg-card/50">
      {/* Tab buttons */}
      <div className="flex items-center justify-between border-b border-border px-4">
        <div className="flex">
          <TabButton
            active={activeTab === "filters"}
            onClick={() => setActiveTab("filters")}
            icon={Filter}
            label="Filters"
            count={config.filters.length}
          />
          <TabButton
            active={activeTab === "sort"}
            onClick={() => setActiveTab("sort")}
            icon={SortAsc}
            label="Sort"
            count={config.sorting.length}
          />
          <TabButton
            active={activeTab === "group"}
            onClick={() => setActiveTab("group")}
            icon={Group}
            label="Group By"
            count={config.groupBy?.length || 0}
          />
          <TabButton
            active={activeTab === "time"}
            onClick={() => setActiveTab("time")}
            icon={Calendar}
            label="Time Range"
            count={config.timeRange ? 1 : 0}
          />
        </div>

        <button
          onClick={handleRunQuery}
          disabled={isLoading || config.selectedFields.length === 0 || !isConnected}
          title={!isConnected ? "Connect to a database first" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:opacity-50 disabled:pointer-events-none"
          )}
        >
          <Play className="h-4 w-4" />
          Run Query
        </button>
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === "filters" && <FiltersTab />}
        {activeTab === "sort" && <SortTab />}
        {activeTab === "group" && <GroupByTab />}
        {activeTab === "time" && <TimeRangeTab />}
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
}

function TabButton({ active, onClick, icon: Icon, label, count }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs">
          {count}
        </span>
      )}
    </button>
  );
}

function FiltersTab() {
  const { config, addFilter, updateFilter, removeFilter, clearFilters } = useReportStore();
  const primaryEntity = config.primaryEntity ? getEntity(config.primaryEntity) : null;
  
  const allFields = primaryEntity
    ? [
        ...primaryEntity.fields.filter((f) => f.filterable).map((f) => ({
          entityId: config.primaryEntity,
          field: f,
        })),
        ...primaryEntity.relationships.flatMap((rel) => {
          const relEntity = getEntity(rel.targetEntity);
          if (!relEntity) return [];
          return relEntity.fields
            .filter((f) => f.filterable)
            .map((f) => ({
              entityId: rel.targetEntity,
              field: f,
            }));
        }),
      ]
    : [];

  const handleAddFilter = () => {
    if (allFields.length > 0) {
      const firstField = allFields[0];
      addFilter({
        entityId: firstField.entityId,
        fieldId: firstField.field.id,
        operator: "equals",
        value: "",
      });
    }
  };

  return (
    <div className="space-y-3">
      {config.filters.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-8">
          <div className="text-center">
            <Filter className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No filters added</p>
            <button
              onClick={handleAddFilter}
              className="mt-2 text-sm font-medium text-primary hover:underline"
            >
              Add your first filter
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {config.filters.map((filter, index) => (
              <FilterRow
                key={filter.id}
                filter={filter}
                allFields={allFields}
                index={index}
                onUpdate={(updates) => updateFilter(filter.id, updates)}
                onRemove={() => removeFilter(filter.id)}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddFilter}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
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
        </>
      )}
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
  allFields: { entityId: string; field: { id: string; displayName: string; type: string } }[];
  index: number;
  onUpdate: (updates: Partial<FilterRowFilter>) => void;
  onRemove: () => void;
}

function FilterRow({ filter, allFields, index, onUpdate, onRemove }: FilterRowProps) {
  const selectedFieldInfo = allFields.find(
    (f) => f.entityId === filter.entityId && f.field.id === filter.fieldId
  );
  const fieldType = selectedFieldInfo?.field.type || "string";
  const applicableOperators = FILTER_OPERATORS.filter((op) =>
    op.types.includes(fieldType)
  );

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
      {index > 0 && (
        <span className="px-2 text-xs font-medium uppercase text-muted-foreground">AND</span>
      )}

      {/* Field selector */}
      <select
        value={`${filter.entityId}::${filter.fieldId}`}
        onChange={(e) => {
          const [entityId, fieldId] = e.target.value.split("::");
          onUpdate({ entityId, fieldId });
        }}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
      >
        {allFields.map((f) => (
          <option key={`${f.entityId}-${f.field.id}`} value={`${f.entityId}::${f.field.id}`}>
            {getEntity(f.entityId)?.displayName}.{f.field.displayName}
          </option>
        ))}
      </select>

      {/* Operator selector */}
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

      {/* Value input */}
      {!["is_null", "is_not_null"].includes(filter.operator) && (
        <input
          type={fieldType === "number" ? "number" : "text"}
          value={filter.value as string}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder="Value"
          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm"
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

function SortTab() {
  const { config, addSort, removeSort, clearSorting } = useReportStore();

  const handleAddSort = () => {
    if (config.selectedFields.length > 0) {
      const firstField = config.selectedFields[0];
      addSort({
        entityId: firstField.entityId,
        fieldId: firstField.fieldId,
        direction: "asc",
      });
    }
  };

  return (
    <div className="space-y-3">
      {config.sorting.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-8">
          <div className="text-center">
            <SortAsc className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No sorting applied</p>
            <button
              onClick={handleAddSort}
              disabled={config.selectedFields.length === 0}
              className="mt-2 text-sm font-medium text-primary hover:underline disabled:opacity-50"
            >
              Add sorting
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {config.sorting.map((sort, index) => {
              const entity = getEntity(sort.entityId);
              const field = getEntityField(sort.entityId, sort.fieldId);

              return (
                <div
                  key={`${sort.entityId}-${sort.fieldId}`}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background p-2"
                >
                  <span className="flex-1 text-sm">
                    {entity?.displayName}.{field?.displayName}
                  </span>
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
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
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
          </div>
          <button
            onClick={handleAddSort}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            Add sorting
          </button>
        </>
      )}
    </div>
  );
}

function GroupByTab() {
  const { config, addGroupBy, removeGroupBy, clearGroupBy } = useReportStore();

  return (
    <div className="space-y-3">
      {(config.groupBy?.length || 0) === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-8">
          <div className="text-center">
            <Layers className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No grouping applied
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Group your data to see aggregated values. Add a field and then apply
              aggregations (SUM, AVG, etc.) to numeric fields.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {config.groupBy?.map((field) => {
              const entity = getEntity(field.entityId);
              const fieldDef = getEntityField(field.entityId, field.fieldId);

              return (
                <div
                  key={`${field.entityId}-${field.fieldId}`}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5"
                >
                  <span className="text-sm">
                    {entity?.displayName}.{fieldDef?.displayName}
                  </span>
                  <button
                    onClick={() => removeGroupBy(field.entityId, field.fieldId)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={clearGroupBy}
            className="text-sm text-muted-foreground hover:text-destructive"
          >
            Clear grouping
          </button>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Tip: Select fields in the canvas and they will appear here as grouping options.
      </p>
    </div>
  );
}

function TimeRangeTab() {
  const { config, setTimeRange, setTimeField } = useReportStore();
  const primaryEntity = config.primaryEntity ? getEntity(config.primaryEntity) : null;

  const datetimeFields = primaryEntity
    ? primaryEntity.fields.filter((f) => f.type === "datetime" || f.type === "date")
    : [];

  return (
    <div className="space-y-4">
      {/* Time field selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Time Field</label>
        <select
          value={config.timeField || ""}
          onChange={(e) => setTimeField(e.target.value || undefined)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">No time filter</option>
          {datetimeFields.map((field) => (
            <option key={field.id} value={field.id}>
              {field.displayName}
            </option>
          ))}
        </select>
      </div>

      {config.timeField && (
        <div className="space-y-4">
          {/* Time range type */}
          <div className="flex gap-2">
            <button
              onClick={() =>
                setTimeRange({ type: "relative", relativeValue: 7, relativeUnit: "days" })
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

          {/* Relative time options */}
          {config.timeRange?.type === "relative" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Last</span>
              <input
                type="number"
                value={config.timeRange.relativeValue || 7}
                onChange={(e) =>
                  setTimeRange({
                    ...config.timeRange!,
                    relativeValue: parseInt(e.target.value),
                  })
                }
                className="h-9 w-20 rounded-md border border-input bg-background px-3 text-sm"
              />
              <select
                value={config.timeRange.relativeUnit || "days"}
                onChange={(e) =>
                  setTimeRange({
                    ...config.timeRange!,
                    relativeUnit: e.target.value as any,
                  })
                }
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
          )}

          {/* Absolute time options */}
          {config.timeRange?.type === "absolute" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
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
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
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
          )}

          <button
            onClick={() => {
              setTimeRange(undefined);
              setTimeField(undefined);
            }}
            className="text-sm text-muted-foreground hover:text-destructive"
          >
            Clear time filter
          </button>
        </div>
      )}
    </div>
  );
}

