/**
 * Entity Schema Definitions
 * 
 * Defines all business entities, their fields, and relationships
 * for the drag-and-drop report builder
 */

export type FieldType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'datetime' 
  | 'date'
  | 'time'
  | 'json'
  | 'coordinates'
  | 'enum';

export type AggregationType = 
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count_distinct';

export interface EntityField {
  id: string;
  name: string;
  displayName: string;
  type: FieldType;
  description?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  foreignEntity?: string;
  foreignField?: string;
  enumValues?: string[];
  aggregations?: AggregationType[];
  filterable?: boolean;
  sortable?: boolean;
  format?: string; // For display formatting
}

export interface EntityRelationship {
  targetEntity: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  sourceField: string;
  targetField: string;
  joinType: 'inner' | 'left' | 'right';
  throughTable?: string; // For many-to-many
}

export interface Entity {
  id: string;
  name: string;
  displayName: string;
  displayNamePlural: string;
  description: string;
  icon: string;
  color: string;
  schema: string;
  tableName: string;
  fields: EntityField[];
  relationships: EntityRelationship[];
  defaultFields?: string[];
  searchableFields?: string[];
  timestampField?: string;
}

// Entity Categories for UI organization
export interface EntityCategory {
  id: string;
  name: string;
  description: string;
  entities: string[];
}

// Report Builder Types
export interface SelectedField {
  entityId: string;
  fieldId: string;
  alias?: string;
  aggregation?: AggregationType;
}

export interface FilterCondition {
  id: string;
  entityId: string;
  fieldId: string;
  operator: FilterOperator;
  value: unknown;
  value2?: unknown; // For BETWEEN operator
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_equal'
  | 'less_than'
  | 'less_equal'
  | 'between'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null';

export interface SortConfig {
  entityId: string;
  fieldId: string;
  direction: 'asc' | 'desc';
}

export interface TimeRange {
  type: 'relative' | 'absolute';
  // For relative
  relativeValue?: number;
  relativeUnit?: 'hours' | 'days' | 'weeks' | 'months' | 'years';
  // For absolute
  startDate?: string;
  endDate?: string;
}

export interface ReportConfig {
  id?: string;
  name: string;
  description?: string;
  primaryEntity: string;
  selectedFields: SelectedField[];
  filters: FilterCondition[];
  sorting: SortConfig[];
  timeRange?: TimeRange;
  timeField?: string;
  groupBy?: SelectedField[];
  limit?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Query Result Types
export interface QueryResult {
  columns: QueryColumn[];
  rows: Record<string, unknown>[];
  totalRows: number;
  executionTime: number;
  sql?: string;
}

export interface QueryColumn {
  name: string;
  displayName: string;
  type: FieldType;
  entityId?: string;
  fieldId?: string;
}

// Query Mode Types
export type QueryMode = 'standard' | 'advanced';

// Visualization Types
export type VisualizationType = 'table' | 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'map';

export interface ChartConfig {
  type: VisualizationType;
  xAxis?: string;
  yAxis?: string[];
  colorBy?: string;
  aggregation?: AggregationType;
}

export interface MapConfig {
  latitudeField: string;
  longitudeField: string;
  colorBy?: string;
  sizeBy?: string;
  labelField?: string;
}

