"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Building,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  Gauge,
  GripVertical,
  LineChart,
  MapPin,
  MapPinned,
  Navigation,
  Plus,
  Search,
  Smartphone,
  Tag,
  User,
  Users,
} from "lucide-react";
import { useReportStore } from "@/store/report-store";
import {
  ENTITIES,
  ENTITY_CATEGORIES,
} from "@/lib/entity-schema";
import { cn } from "@/lib/utils";
import { useDraggable } from "@dnd-kit/core";

// Icon mapping
const ENTITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MapPin,
  Car,
  User,
  Building,
  Folder,
  Smartphone,
  Gauge,
  MapPinned,
  Navigation,
  LineChart,
  Users,
  Tag,
  ArrowDownToLine,
  ArrowUpFromLine,
};

export function EntitySidebar() {
  const [search, setSearch] = useState("");
  // All categories expanded by default
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["core", "grouping", "geo", "telemetry"]);
  // Track which entity is expanded to show fields (only one at a time)
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);
  
  const { config, setPrimaryEntity } = useReportStore();

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleEntity = (entityId: string) => {
    // If clicking the same entity, collapse it
    if (expandedEntity === entityId) {
      setExpandedEntity(null);
    } else {
      // Expand new entity and set as primary
      setExpandedEntity(entityId);
      setPrimaryEntity(entityId);
    }
  };

  const filteredCategories = ENTITY_CATEGORIES.map((cat) => ({
    ...cat,
    entities: cat.entities.filter((entityId) => {
      const entity = ENTITIES[entityId];
      if (!entity) return false;
      const searchLower = search.toLowerCase();
      return (
        entity.displayName.toLowerCase().includes(searchLower) ||
        entity.displayNamePlural.toLowerCase().includes(searchLower) ||
        entity.description.toLowerCase().includes(searchLower)
      );
    }),
  })).filter((cat) => cat.entities.length > 0);

  return (
    <div className="flex h-full flex-col max-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold text-foreground">Entities</h2>
        {config.primaryEntity && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {ENTITIES[config.primaryEntity]?.displayName}
          </span>
        )}
      </div>

      {/* Search */}
      <div className="flex-shrink-0 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search entities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Entity List with expandable fields - Scrollable */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="space-y-1">
          <p className="px-2 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Select entity & fields
          </p>
          {filteredCategories.map((category) => (
            <div key={category.id}>
              <button
                onClick={() => toggleCategory(category.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {expandedCategories.includes(category.id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {category.name}
              </button>

              {expandedCategories.includes(category.id) && (
                <div className="ml-2 space-y-1">
                  {category.entities.map((entityId) => {
                    const entity = ENTITIES[entityId];
                    if (!entity) return null;
                    const Icon = ENTITY_ICONS[entity.icon] || MapPin;
                    const isExpanded = expandedEntity === entityId;
                    const isPrimary = config.primaryEntity === entityId;

                    return (
                      <div key={entityId} className="space-y-0.5">
                        {/* Entity Header - Click to expand/collapse fields */}
                        <button
                          onClick={() => toggleEntity(entityId)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-accent",
                            isExpanded && "bg-accent",
                            isPrimary && !isExpanded && "bg-primary/5"
                          )}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div
                            className="flex h-6 w-6 items-center justify-center rounded"
                            style={{ backgroundColor: `${entity.color}20`, color: entity.color }}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="text-left flex-1">
                            <div className="font-medium text-foreground">
                              {entity.displayNamePlural}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {entity.fields.length} fields
                          </span>
                        </button>

                        {/* Fields List - shown when entity is expanded */}
                        {isExpanded && (
                          <div className="ml-6 space-y-0.5 py-1 border-l-2 border-border pl-2">
                            {entity.fields.map((field) => (
                              <FieldItem
                                key={field.id}
                                entityId={entityId}
                                fieldId={field.id}
                                fieldName={field.displayName}
                                fieldType={field.type}
                                entityColor={entity.color}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface FieldItemProps {
  entityId: string;
  fieldId: string;
  fieldName: string;
  fieldType: string;
  entityColor: string;
}

function FieldItem({
  entityId,
  fieldId,
  fieldName,
  fieldType,
  entityColor,
}: FieldItemProps) {
  const { config, addField, removeField } = useReportStore();
  const isSelected = config.selectedFields.some(
    (f) => f.entityId === entityId && f.fieldId === fieldId
  );

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${entityId}-${fieldId}`,
    data: { entityId, fieldId },
  });

  const handleToggleField = () => {
    if (isSelected) {
      removeField(entityId, fieldId);
    } else {
      addField({
        entityId,
        fieldId,
        alias: fieldName,
      });
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-1 py-1 text-sm transition-colors group",
        isDragging && "opacity-50",
        isSelected && "bg-primary/10"
      )}
    >
      {/* Drag handle - separate from click area */}
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5 opacity-50 group-hover:opacity-100"
      >
        <GripVertical className="h-3 w-3" />
      </div>
      
      {/* Clickable area for selection */}
      <button
        type="button"
        onClick={handleToggleField}
        className={cn(
          "flex items-center gap-2 flex-1 rounded px-1.5 py-0.5 text-left hover:bg-accent/50 transition-colors",
          isSelected && "text-primary"
        )}
      >
        {/* Color indicator */}
        <div
          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: entityColor }}
        />
        
        {/* Field name */}
        <span className="flex-1 truncate">{fieldName}</span>
        
        {/* Field type */}
        <span className="text-[10px] uppercase text-muted-foreground flex-shrink-0">
          {fieldType}
        </span>
      </button>
      
      {/* Add/Check button */}
      <button
        type="button"
        onClick={handleToggleField}
        className={cn(
          "flex-shrink-0 p-0.5 rounded transition-colors",
          isSelected 
            ? "text-primary" 
            : "text-muted-foreground hover:text-foreground opacity-50 group-hover:opacity-100"
        )}
        title={isSelected ? "Remove from selection" : "Add to selection"}
      >
        {isSelected ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
