"""
SQL Query Builder

Generates SQL queries from report configuration.
Handles entity joins, filters, sorting, and aggregations.
"""

from typing import List, Optional, Dict, Any, Tuple, Set
from datetime import datetime, timedelta
from pydantic import BaseModel
from enum import Enum

from api.entities import (
    ENTITIES, 
    get_entity, 
    Entity, 
    EntityField,
    FieldType,
    AggregationType,
)


class FilterOperator(str, Enum):
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    GREATER_THAN = "greater_than"
    GREATER_EQUAL = "greater_equal"
    LESS_THAN = "less_than"
    LESS_EQUAL = "less_equal"
    BETWEEN = "between"
    IN = "in"
    NOT_IN = "not_in"
    IS_NULL = "is_null"
    IS_NOT_NULL = "is_not_null"


class SelectedField(BaseModel):
    entity_id: str
    field_id: str
    alias: Optional[str] = None
    aggregation: Optional[AggregationType] = None


class FilterCondition(BaseModel):
    id: str
    entity_id: str
    field_id: str
    operator: FilterOperator
    value: Optional[Any] = None
    value2: Optional[Any] = None  # For BETWEEN


class SortConfig(BaseModel):
    entity_id: str
    field_id: str
    direction: str = "asc"


class TimeRange(BaseModel):
    type: str  # "relative" or "absolute"
    relative_value: Optional[int] = None
    relative_unit: Optional[str] = None  # hours, days, weeks, months
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class ReportConfig(BaseModel):
    name: str
    description: Optional[str] = None
    primary_entity: str
    selected_fields: List[SelectedField]
    filters: List[FilterCondition] = []
    sorting: List[SortConfig] = []
    time_range: Optional[TimeRange] = None
    time_field: Optional[str] = None
    time_field_entity: Optional[str] = None  # Entity ID for time field
    group_by: Optional[List[SelectedField]] = None
    limit: int = 1000


class QueryResult(BaseModel):
    columns: List[Dict[str, Any]]
    rows: List[Dict[str, Any]]
    total_rows: int
    execution_time: float
    sql: Optional[str] = None


def _sanitize_identifier(name: str) -> str:
    """Sanitize SQL identifier to prevent injection."""
    import re
    # Only allow alphanumeric and underscore
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', name):
        raise ValueError(f"Invalid identifier: {name}")
    return name


def _get_qualified_field_name(entity: Entity, field: EntityField, table_alias: str) -> str:
    """Get fully qualified field name with table alias."""
    alias = _sanitize_identifier(table_alias)
    field_name = _sanitize_identifier(field.name)
    return f"{alias}.{field_name}"


def _get_field_alias(entity_id: str, field_id: str, aggregation: Optional[AggregationType] = None) -> str:
    """Generate field alias for SELECT."""
    if aggregation:
        return f"{aggregation.value}_{entity_id}_{field_id}"
    return f"{entity_id}_{field_id}"


def _build_aggregation(field_name: str, aggregation: AggregationType) -> str:
    """Build aggregation SQL expression."""
    agg_map = {
        AggregationType.COUNT: f"COUNT({field_name})",
        AggregationType.SUM: f"SUM({field_name})",
        AggregationType.AVG: f"AVG({field_name})",
        AggregationType.MIN: f"MIN({field_name})",
        AggregationType.MAX: f"MAX({field_name})",
        AggregationType.COUNT_DISTINCT: f"COUNT(DISTINCT {field_name})",
    }
    return agg_map.get(aggregation, field_name)


def _build_filter_condition(
    entity: Entity,
    field: EntityField,
    table_alias: str,
    filter_: FilterCondition,
    params: List[Any],
    param_idx: int,
) -> Tuple[str, int]:
    """Build WHERE condition for a filter."""
    field_name = _get_qualified_field_name(entity, field, table_alias)
    
    # Operators that don't need values
    if filter_.operator == FilterOperator.IS_NULL:
        return f"{field_name} IS NULL", param_idx
    if filter_.operator == FilterOperator.IS_NOT_NULL:
        return f"{field_name} IS NOT NULL", param_idx
    
    # Build parameter placeholder
    def param(val: Any) -> str:
        nonlocal param_idx
        params.append(val)
        idx = param_idx
        param_idx += 1
        return f"${idx}"
    
    value = filter_.value
    
    if filter_.operator == FilterOperator.EQUALS:
        return f"{field_name} = {param(value)}", param_idx
    elif filter_.operator == FilterOperator.NOT_EQUALS:
        return f"{field_name} != {param(value)}", param_idx
    elif filter_.operator == FilterOperator.CONTAINS:
        return f"{field_name} ILIKE {param(f'%{value}%')}", param_idx
    elif filter_.operator == FilterOperator.NOT_CONTAINS:
        return f"{field_name} NOT ILIKE {param(f'%{value}%')}", param_idx
    elif filter_.operator == FilterOperator.STARTS_WITH:
        return f"{field_name} ILIKE {param(f'{value}%')}", param_idx
    elif filter_.operator == FilterOperator.ENDS_WITH:
        return f"{field_name} ILIKE {param(f'%{value}')}", param_idx
    elif filter_.operator == FilterOperator.GREATER_THAN:
        return f"{field_name} > {param(value)}", param_idx
    elif filter_.operator == FilterOperator.GREATER_EQUAL:
        return f"{field_name} >= {param(value)}", param_idx
    elif filter_.operator == FilterOperator.LESS_THAN:
        return f"{field_name} < {param(value)}", param_idx
    elif filter_.operator == FilterOperator.LESS_EQUAL:
        return f"{field_name} <= {param(value)}", param_idx
    elif filter_.operator == FilterOperator.BETWEEN:
        return f"{field_name} BETWEEN {param(value)} AND {param(filter_.value2)}", param_idx
    elif filter_.operator == FilterOperator.IN:
        if isinstance(value, list):
            placeholders = ", ".join(param(v) for v in value)
            return f"{field_name} IN ({placeholders})", param_idx
        return f"{field_name} = {param(value)}", param_idx
    elif filter_.operator == FilterOperator.NOT_IN:
        if isinstance(value, list):
            placeholders = ", ".join(param(v) for v in value)
            return f"{field_name} NOT IN ({placeholders})", param_idx
        return f"{field_name} != {param(value)}", param_idx
    
    return f"{field_name} = {param(value)}", param_idx


def _calculate_time_range(time_range: TimeRange) -> Tuple[Optional[datetime], Optional[datetime]]:
    """Calculate start and end datetime from TimeRange."""
    if time_range.type == "absolute":
        start = datetime.fromisoformat(time_range.start_date) if time_range.start_date else None
        end = datetime.fromisoformat(time_range.end_date) if time_range.end_date else None
        return start, end
    
    # Relative time
    now = datetime.utcnow()
    delta_map = {
        "hours": timedelta(hours=time_range.relative_value or 0),
        "days": timedelta(days=time_range.relative_value or 0),
        "weeks": timedelta(weeks=time_range.relative_value or 0),
        "months": timedelta(days=(time_range.relative_value or 0) * 30),  # Approximate
        "years": timedelta(days=(time_range.relative_value or 0) * 365),  # Approximate
    }
    delta = delta_map.get(time_range.relative_unit or "days", timedelta(days=7))
    return now - delta, now


def _find_join_path(
    from_entity_id: str,
    to_entity_id: str,
    visited: Optional[Set[str]] = None
) -> Optional[List[Tuple[str, str, str, str, str]]]:
    """
    Find a path of joins from one entity to another.
    Returns a list of (from_entity, to_entity, from_field, to_field, join_type) tuples.
    Uses BFS to find the shortest path.
    """
    if visited is None:
        visited = set()
    
    if from_entity_id == to_entity_id:
        return []
    
    if from_entity_id in visited:
        return None
    
    visited.add(from_entity_id)
    from_entity = get_entity(from_entity_id)
    if not from_entity:
        return None
    
    # Check direct relationships from this entity
    for rel in from_entity.relationships:
        if rel.target_entity == to_entity_id:
            return [(from_entity_id, to_entity_id, rel.source_field, rel.target_field, rel.join_type)]
    
    # Check reverse relationships (where this entity is the target)
    for entity_id, entity in ENTITIES.items():
        if entity_id in visited:
            continue
        for rel in entity.relationships:
            if rel.target_entity == from_entity_id:
                # This means entity_id -> from_entity_id exists
                # So we can go from_entity_id -> entity_id by reversing
                if entity_id == to_entity_id:
                    # Found the target via reverse relationship
                    return [(from_entity_id, to_entity_id, rel.target_field, rel.source_field, rel.join_type)]
    
    # Try multi-hop through direct relationships
    for rel in from_entity.relationships:
        if rel.target_entity in visited:
            continue
        sub_path = _find_join_path(rel.target_entity, to_entity_id, visited.copy())
        if sub_path is not None:
            return [(from_entity_id, rel.target_entity, rel.source_field, rel.target_field, rel.join_type)] + sub_path
    
    # Try multi-hop through reverse relationships
    for entity_id, entity in ENTITIES.items():
        if entity_id in visited:
            continue
        for rel in entity.relationships:
            if rel.target_entity == from_entity_id:
                sub_path = _find_join_path(entity_id, to_entity_id, visited.copy())
                if sub_path is not None:
                    return [(from_entity_id, entity_id, rel.target_field, rel.source_field, rel.join_type)] + sub_path
    
    return None


def build_query(config: ReportConfig) -> Tuple[str, List[Any]]:
    """
    Build SQL query from report configuration.
    
    Returns tuple of (sql_query, parameters)
    """
    primary_entity = get_entity(config.primary_entity)
    if not primary_entity:
        raise ValueError(f"Unknown entity: {config.primary_entity}")
    
    params: List[Any] = []
    param_idx = 1
    
    # Collect all entities needed for the query
    used_entities: Dict[str, Entity] = {config.primary_entity: primary_entity}
    for field in config.selected_fields:
        if field.entity_id not in used_entities:
            entity = get_entity(field.entity_id)
            if entity:
                used_entities[field.entity_id] = entity
    
    for filter_ in config.filters:
        if filter_.entity_id not in used_entities:
            entity = get_entity(filter_.entity_id)
            if entity:
                used_entities[filter_.entity_id] = entity
    
    for sort in config.sorting:
        if sort.entity_id not in used_entities:
            entity = get_entity(sort.entity_id)
            if entity:
                used_entities[sort.entity_id] = entity
    
    # Build table aliases for each entity (use table name as alias)
    table_aliases: Dict[str, str] = {}
    for entity_id, entity in used_entities.items():
        # Use entity_id as alias to avoid conflicts when same table is used by different entities
        table_aliases[entity_id] = entity.table_name
    
    # Build SELECT clause
    select_parts: List[str] = []
    has_aggregation = any(f.aggregation for f in config.selected_fields)
    group_by_fields: List[str] = []
    
    for sel_field in config.selected_fields:
        entity = used_entities.get(sel_field.entity_id)
        if not entity:
            continue
        
        field = next((f for f in entity.fields if f.id == sel_field.field_id), None)
        if not field:
            continue
        
        table_alias = table_aliases[sel_field.entity_id]
        field_name = _get_qualified_field_name(entity, field, table_alias)
        alias = _get_field_alias(sel_field.entity_id, sel_field.field_id, sel_field.aggregation)
        
        if sel_field.aggregation:
            expr = _build_aggregation(field_name, sel_field.aggregation)
        else:
            expr = field_name
            if has_aggregation and config.group_by:
                # If there's aggregation, non-aggregated fields should be in GROUP BY
                is_in_group_by = any(
                    g.entity_id == sel_field.entity_id and g.field_id == sel_field.field_id
                    for g in config.group_by
                )
                if is_in_group_by:
                    group_by_fields.append(field_name)
        
        select_parts.append(f"{expr} AS {alias}")
    
    if not select_parts:
        raise ValueError("No valid fields selected")
    
    # Build FROM clause with JOINs
    schema_name = _sanitize_identifier(primary_entity.schema_name)
    table_name = _sanitize_identifier(primary_entity.table_name)
    from_clause = f"{schema_name}.{table_name}"
    join_clauses: List[str] = []
    joined_entities: Set[str] = {config.primary_entity}
    
    # Build joins for all non-primary entities
    for entity_id in used_entities:
        if entity_id == config.primary_entity:
            continue
        
        entity = used_entities[entity_id]
        
        # Find join path from primary entity to this entity
        join_path = _find_join_path(config.primary_entity, entity_id)
        
        if join_path is None:
            raise ValueError(
                f"Cannot join entity '{entity_id}' to primary entity '{config.primary_entity}'. "
                f"No relationship path found. Please select fields from related entities only."
            )
        
        # Build JOIN clauses for the path
        for from_ent_id, to_ent_id, from_field, to_field, join_type in join_path:
            if to_ent_id in joined_entities:
                continue
            
            to_entity = get_entity(to_ent_id)
            if not to_entity:
                continue
            
            from_entity = get_entity(from_ent_id)
            if not from_entity:
                continue
            
            join_type_sql = join_type.upper() if join_type.upper() in ("INNER", "LEFT", "RIGHT") else "LEFT"
            target_schema = _sanitize_identifier(to_entity.schema_name)
            target_table = _sanitize_identifier(to_entity.table_name)
            source_table = _sanitize_identifier(from_entity.table_name)
            source_field = _sanitize_identifier(from_field)
            target_field = _sanitize_identifier(to_field)
            
            condition = f"{source_table}.{source_field} = {target_table}.{target_field}"
            join_clauses.append(f"{join_type_sql} JOIN {target_schema}.{target_table} ON {condition}")
            joined_entities.add(to_ent_id)
    
    # Build WHERE clause
    where_conditions: List[str] = []
    
    for filter_ in config.filters:
        entity = used_entities.get(filter_.entity_id)
        if not entity:
            continue
        
        field = next((f for f in entity.fields if f.id == filter_.field_id), None)
        if not field:
            continue
        
        table_alias = table_aliases[filter_.entity_id]
        condition, param_idx = _build_filter_condition(entity, field, table_alias, filter_, params, param_idx)
        where_conditions.append(condition)
    
    # Add time range filter
    if config.time_range and config.time_field:
        # Determine which entity the time field belongs to
        time_entity_id = config.time_field_entity or config.primary_entity
        time_entity = get_entity(time_entity_id)
        
        if time_entity:
            time_field = next((f for f in time_entity.fields if f.id == config.time_field), None)
            
            if time_field:
                # Ensure this entity is in our used_entities and has a table alias
                if time_entity_id not in table_aliases:
                    table_aliases[time_entity_id] = time_entity.table_name
                
                start_time, end_time = _calculate_time_range(config.time_range)
                time_field_name = _get_qualified_field_name(time_entity, time_field, table_aliases[time_entity_id])
                
                if start_time:
                    params.append(start_time.isoformat())
                    where_conditions.append(f"{time_field_name} >= ${param_idx}")
                    param_idx += 1
                
                if end_time:
                    params.append(end_time.isoformat())
                    where_conditions.append(f"{time_field_name} <= ${param_idx}")
                    param_idx += 1
    
    # Build ORDER BY clause
    order_parts: List[str] = []
    for sort in config.sorting:
        entity = used_entities.get(sort.entity_id)
        if not entity:
            continue
        
        field = next((f for f in entity.fields if f.id == sort.field_id), None)
        if not field:
            continue
        
        table_alias = table_aliases[sort.entity_id]
        field_name = _get_qualified_field_name(entity, field, table_alias)
        direction = "DESC" if sort.direction.lower() == "desc" else "ASC"
        order_parts.append(f"{field_name} {direction}")
    
    # Assemble query
    sql_parts = [f"SELECT {', '.join(select_parts)}"]
    sql_parts.append(f"FROM {from_clause}")
    
    if join_clauses:
        sql_parts.extend(join_clauses)
    
    if where_conditions:
        sql_parts.append(f"WHERE {' AND '.join(where_conditions)}")
    
    if group_by_fields:
        sql_parts.append(f"GROUP BY {', '.join(group_by_fields)}")
    
    if order_parts:
        sql_parts.append(f"ORDER BY {', '.join(order_parts)}")
    
    sql_parts.append(f"LIMIT {min(config.limit, 10000)}")
    
    sql = "\n".join(sql_parts)
    
    return sql, params


def generate_preview_sql(config: ReportConfig) -> str:
    """Generate SQL for preview (with placeholders visible)."""
    sql, params = build_query(config)
    
    # Replace parameter placeholders with values for display
    preview_sql = sql
    for i, param in enumerate(params, 1):
        if isinstance(param, str):
            preview_sql = preview_sql.replace(f"${i}", f"'{param}'")
        else:
            preview_sql = preview_sql.replace(f"${i}", str(param))
    
    return preview_sql
