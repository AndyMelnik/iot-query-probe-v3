"""
API Routes for Report Builder

Provides endpoints for entity metadata, query execution, and report management.
"""

import os
import time
import json
import logging
import re
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, field_validator

from api.entities import (
    Entity,
    EntityCategory,
    get_entity,
    get_all_entities,
    get_entity_categories,
    get_related_entities,
    ENTITIES,
)
from api.query_builder import (
    ReportConfig,
    QueryResult,
    build_query,
    generate_preview_sql,
    SelectedField,
    FilterCondition,
    SortConfig,
    TimeRange,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Report Builder"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class ReportConfigRequest(BaseModel):
    """Report configuration from frontend."""
    name: str = "New Report"
    description: Optional[str] = None
    primaryEntity: str
    selectedFields: List[Dict[str, Any]]
    filters: List[Dict[str, Any]] = []
    sorting: List[Dict[str, Any]] = []
    timeRange: Optional[Dict[str, Any]] = None
    timeField: Optional[str] = None
    groupBy: Optional[List[Dict[str, Any]]] = None
    limit: int = 1000

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if len(v) > 200:
            raise ValueError('Name too long (max 200 chars)')
        return v.strip()
    
    @field_validator('limit')
    @classmethod
    def validate_limit(cls, v: int) -> int:
        if v < 1 or v > 10000:
            raise ValueError('Limit must be between 1 and 10000')
        return v
    
    @field_validator('primaryEntity')
    @classmethod
    def validate_primary_entity(cls, v: str) -> str:
        import re
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', v):
            raise ValueError('Invalid entity name')
        return v


class QueryPreviewResponse(BaseModel):
    """SQL preview response."""
    sql: str
    estimated_rows: Optional[int] = None


class ConnectionTestRequest(BaseModel):
    """Request to test database connection."""
    databaseUrl: str
    
    @field_validator('databaseUrl')
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v or not v.startswith('postgresql://'):
            raise ValueError('Invalid PostgreSQL URL format')
        return v


class QueryExecuteRequest(BaseModel):
    """Query execution request with optional database URL."""
    config: ReportConfigRequest
    databaseUrl: Optional[str] = None  # For dev mode direct connection


class EntityListResponse(BaseModel):
    """List of entities response."""
    entities: List[Dict[str, Any]]
    categories: List[Dict[str, Any]]


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _convert_frontend_config(request: ReportConfigRequest) -> ReportConfig:
    """Convert frontend camelCase config to backend snake_case."""
    
    selected_fields = [
        SelectedField(
            entity_id=f.get("entityId", ""),
            field_id=f.get("fieldId", ""),
            alias=f.get("alias"),
            aggregation=f.get("aggregation"),
        )
        for f in request.selectedFields
    ]
    
    filters = [
        FilterCondition(
            id=f.get("id", ""),
            entity_id=f.get("entityId", ""),
            field_id=f.get("fieldId", ""),
            operator=f.get("operator", "equals"),
            value=f.get("value"),
            value2=f.get("value2"),
        )
        for f in request.filters
    ]
    
    sorting = [
        SortConfig(
            entity_id=s.get("entityId", ""),
            field_id=s.get("fieldId", ""),
            direction=s.get("direction", "asc"),
        )
        for s in request.sorting
    ]
    
    time_range = None
    if request.timeRange:
        time_range = TimeRange(
            type=request.timeRange.get("type", "relative"),
            relative_value=request.timeRange.get("relativeValue"),
            relative_unit=request.timeRange.get("relativeUnit"),
            start_date=request.timeRange.get("startDate"),
            end_date=request.timeRange.get("endDate"),
        )
    
    group_by = None
    if request.groupBy:
        group_by = [
            SelectedField(
                entity_id=g.get("entityId", ""),
                field_id=g.get("fieldId", ""),
            )
            for g in request.groupBy
        ]
    
    # Parse time field - frontend sends "entity_id::field_id" format
    time_field = None
    time_field_entity = None
    if request.timeField:
        if "::" in request.timeField:
            parts = request.timeField.split("::", 1)
            time_field_entity = parts[0]
            time_field = parts[1]
        else:
            time_field = request.timeField
    
    return ReportConfig(
        name=request.name,
        description=request.description,
        primary_entity=request.primaryEntity,
        selected_fields=selected_fields,
        filters=filters,
        sorting=sorting,
        time_range=time_range,
        time_field=time_field,
        time_field_entity=time_field_entity,
        group_by=group_by,
        limit=request.limit,
    )


def _get_db_connection(request: Request):
    """Get database connection from stored credentials."""
    import pg8000.native
    import ssl
    from urllib.parse import urlparse, unquote, parse_qs
    
    # Get credentials from auth_server storage
    from pathlib import Path
    import json
    import base64
    import os
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    
    credentials_dir = Path(os.getenv("CREDENTIALS_DIR", "/tmp/iot-query-probe"))
    
    # Get the most recent valid credentials
    cred_files = list(credentials_dir.glob("creds_*.json"))
    if not cred_files:
        raise HTTPException(status_code=401, detail="Not authenticated. Please login through Navixy.")
    
    # Get encryption key
    key_source = os.getenv("CREDENTIAL_ENCRYPTION_KEY") or os.getenv("JWT_SECRET", "")
    if not key_source:
        raise HTTPException(status_code=500, detail="Server configuration error")
    
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"iot-query-probe-v2-salt",
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(key_source.encode()))
    fernet = Fernet(key)
    
    # Find valid credentials
    db_url = None
    for cred_file in sorted(cred_files, reverse=True):
        try:
            with open(cred_file, "r") as f:
                stored = json.load(f)
            
            if "data" in stored and "version" in stored:
                cred = json.loads(fernet.decrypt(stored["data"].encode()).decode())
                expires_at = datetime.fromisoformat(cred["expires_at"])
                if datetime.utcnow() <= expires_at:
                    db_url = cred.get("iot_db_url")
                    break
        except Exception:
            continue
    
    if not db_url:
        raise HTTPException(status_code=401, detail="Session expired. Please login again.")
    
    # Parse and connect
    parsed = urlparse(db_url)
    params = parse_qs(parsed.query)
    
    username = unquote(parsed.username) if parsed.username else None
    password = unquote(parsed.password) if parsed.password else None
    
    ssl_context = None
    sslmode = params.get('sslmode', ['prefer'])[0]
    if sslmode in ('require', 'verify-ca', 'verify-full', 'prefer'):
        ssl_context = ssl.create_default_context()
        if sslmode in ('require', 'prefer'):
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
    
    return pg8000.native.Connection(
        user=username,
        password=password,
        host=parsed.hostname,
        port=parsed.port or 5432,
        database=parsed.path.lstrip('/'),
        ssl_context=ssl_context,
        timeout=300  # 5 minute timeout
    )


def _get_db_connection_from_url(db_url: str):
    """Get database connection from a direct URL (for dev mode)."""
    import pg8000.native
    import ssl
    from urllib.parse import urlparse, unquote, parse_qs
    
    parsed = urlparse(db_url)
    params = parse_qs(parsed.query)
    
    username = unquote(parsed.username) if parsed.username else None
    password = unquote(parsed.password) if parsed.password else None
    
    ssl_context = None
    sslmode = params.get('sslmode', ['prefer'])[0]
    if sslmode in ('require', 'verify-ca', 'verify-full', 'prefer'):
        ssl_context = ssl.create_default_context()
        if sslmode in ('require', 'prefer'):
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
    
    return pg8000.native.Connection(
        user=username,
        password=password,
        host=parsed.hostname,
        port=parsed.port or 5432,
        database=parsed.path.lstrip('/'),
        ssl_context=ssl_context,
        timeout=30  # Connection timeout
    )


# =============================================================================
# DEV MODE HELPER
# =============================================================================

def _check_dev_mode():
    """Check if dev mode is enabled. Raises 403 if not."""
    dev_mode = os.getenv("DEV_MODE", "false").lower() == "true"
    if not dev_mode:
        raise HTTPException(
            status_code=403, 
            detail="Dev mode endpoints are disabled in production. Set DEV_MODE=true to enable."
        )


# =============================================================================
# CONNECTION ENDPOINTS (DEV MODE ONLY - Protected)
# =============================================================================

@router.post("/connection/test")
async def test_connection(request: ConnectionTestRequest) -> Dict[str, Any]:
    """
    Test a database connection URL (for local development ONLY).
    
    This endpoint is disabled by default. Set DEV_MODE=true to enable.
    """
    _check_dev_mode()
    
    try:
        conn = _get_db_connection_from_url(request.databaseUrl)
        try:
            # Simple query to verify connection
            result = conn.run("SELECT 1")
            return {"success": True, "message": "Connection successful"}
        finally:
            conn.close()
    except Exception as e:
        logger.warning(f"Connection test failed: {e}")
        # Sanitize error message
        error_msg = str(e)
        if "password" in error_msg.lower():
            error_msg = "Authentication failed"
        elif "host" in error_msg.lower() or "connect" in error_msg.lower():
            error_msg = "Could not connect to database server"
        elif "database" in error_msg.lower():
            error_msg = "Database not found"
        return {"success": False, "error": error_msg}


# =============================================================================
# ENTITY ENDPOINTS
# =============================================================================

@router.get("/entities")
async def list_entities() -> EntityListResponse:
    """Get all available entities and categories."""
    entities = get_all_entities()
    categories = get_entity_categories()
    
    return EntityListResponse(
        entities=[e.model_dump() for e in entities],
        categories=[c.model_dump() for c in categories],
    )


@router.get("/entities/{entity_id}")
async def get_entity_details(entity_id: str) -> Dict[str, Any]:
    """Get detailed information about a specific entity."""
    entity = get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail=f"Entity not found: {entity_id}")
    
    return entity.model_dump()


@router.get("/entities/{entity_id}/fields")
async def get_entity_fields(entity_id: str) -> List[Dict[str, Any]]:
    """Get fields for a specific entity."""
    entity = get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail=f"Entity not found: {entity_id}")
    
    return [f.model_dump() for f in entity.fields]


@router.get("/entities/{entity_id}/relationships")
async def get_entity_relationships(entity_id: str) -> Dict[str, Any]:
    """Get relationships for a specific entity."""
    entity = get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail=f"Entity not found: {entity_id}")
    
    related_ids = get_related_entities(entity_id)
    related_entities = [get_entity(r) for r in related_ids if get_entity(r)]
    
    return {
        "entity_id": entity_id,
        "relationships": [r.model_dump() for r in entity.relationships],
        "related_entities": [e.model_dump() for e in related_entities if e],
    }


# =============================================================================
# QUERY ENDPOINTS
# =============================================================================

@router.post("/query/preview")
async def preview_query(request: ReportConfigRequest) -> QueryPreviewResponse:
    """Generate SQL preview for a report configuration."""
    try:
        config = _convert_frontend_config(request)
        sql = generate_preview_sql(config)
        
        return QueryPreviewResponse(sql=sql)
    except Exception as e:
        logger.error(f"Error generating query preview: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/query/execute")
async def execute_query(request: Request, body: ReportConfigRequest) -> Dict[str, Any]:
    """Execute a report query and return results."""
    start_time = time.time()
    
    try:
        config = _convert_frontend_config(body)
        sql, params = build_query(config)
        
        logger.info(f"Executing query: {sql[:200]}...")
        
        # Get database connection
        conn = _get_db_connection(request)
        
        try:
            # Set query timeout
            conn.run("SET statement_timeout = '300000'")  # 5 minutes
            conn.run("SET lock_timeout = '5000'")
            
            # Execute with parameters (pg8000.native uses **kwargs, params must be dict)
            # Convert list params to dict with string keys matching $1, $2, etc.
            if params:
                params_dict = {str(i): v for i, v in enumerate(params)}
                result = conn.run(sql, **params_dict)
            else:
                result = conn.run(sql)
            
            # Get column names from pg8000 (handles both tuple and dict formats)
            columns = []
            if conn.columns:
                logger.debug(f"Raw conn.columns type: {type(conn.columns)}")
                logger.debug(f"Raw conn.columns: {conn.columns[:3] if len(conn.columns) > 3 else conn.columns}")
                for col in conn.columns:
                    if isinstance(col, dict):
                        columns.append(col.get('name', str(col)))
                    elif hasattr(col, 'name'):
                        columns.append(col.name)
                    elif isinstance(col, (list, tuple)) and len(col) > 0:
                        columns.append(str(col[0]))
                    else:
                        columns.append(str(col))
            
            logger.debug(f"Extracted columns: {columns}")
            
            # Build response
            rows = []
            if result:
                logger.debug(f"Result type: {type(result)}, has {len(result) if hasattr(result, '__len__') else 'unknown'} rows")
                if result and len(result) > 0:
                    first_row = result[0]
                    logger.debug(f"First row type: {type(first_row)}, length: {len(first_row) if hasattr(first_row, '__len__') else 'unknown'}")
            
            if result and columns:
                for row in result:
                    row_dict = {}
                    # Use min to prevent index out of range
                    row_len = len(row) if hasattr(row, '__len__') else 0
                    for i, col in enumerate(columns):
                        if i < row_len:
                            value = row[i]
                            # Convert datetime objects to ISO strings
                            if hasattr(value, 'isoformat'):
                                value = value.isoformat()
                            row_dict[col] = value
                        else:
                            logger.warning(f"Column index {i} out of range for row with {row_len} elements")
                            row_dict[col] = None
                    rows.append(row_dict)
            
            execution_time = (time.time() - start_time) * 1000
            
            # Build column metadata
            column_info = []
            for col_name in columns:
                # Try to find field info from entity
                field_info = {"name": col_name, "displayName": col_name, "type": "string"}
                
                # Parse column alias to get entity and field
                # Format is: entity_id_field_id (e.g., vehicles_vehicle_id)
                if "_" in col_name:
                    # Try to match against known entities
                    for entity_id in ENTITIES:
                        # Check if column starts with entity_id_
                        prefix = f"{entity_id}_"
                        if col_name.startswith(prefix):
                            field_id = col_name[len(prefix):]
                            entity = get_entity(entity_id)
                            if entity:
                                field = next((f for f in entity.fields if f.id == field_id), None)
                                if field:
                                    field_info = {
                                        "name": col_name,
                                        "displayName": field.display_name,
                                        "type": field.type.value,
                                        "entityId": entity_id,
                                        "fieldId": field_id,
                                    }
                                    break
                
                column_info.append(field_info)
            
            # Only include SQL in debug mode (not in production)
            include_sql = os.getenv("DEBUG_MODE", "false").lower() == "true"
            
            return {
                "columns": column_info,
                "rows": rows,
                "totalRows": len(rows),
                "executionTime": execution_time,
                **({"sql": sql} if include_sql else {}),
            }
            
        finally:
            conn.close()
            
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"Query execution error: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        # Sanitize error message
        error_msg = str(e)
        if "password" in error_msg.lower() or "host" in error_msg.lower():
            error_msg = "Database connection error"
        raise HTTPException(status_code=400, detail=error_msg)


@router.post("/query/execute-dev")
async def execute_query_dev(body: QueryExecuteRequest) -> Dict[str, Any]:
    """
    Execute a query using a direct database URL (for development ONLY).
    
    This endpoint is disabled by default. Set DEV_MODE=true to enable.
    """
    _check_dev_mode()
    
    if not body.databaseUrl:
        raise HTTPException(status_code=400, detail="Database URL required for dev mode")
    
    start_time = time.time()
    
    try:
        config = _convert_frontend_config(body.config)
        sql, params = build_query(config)
        
        logger.info(f"Executing dev query SQL:\n{sql}")
        logger.info(f"Query params ({len(params)} items): {params}")
        
        # Count $N placeholders in SQL
        import re
        placeholders = re.findall(r'\$(\d+)', sql)
        if placeholders:
            max_placeholder = max(int(p) for p in placeholders)
            logger.info(f"SQL has {len(placeholders)} placeholders, max index: ${max_placeholder}")
            if max_placeholder > len(params):
                logger.error(f"MISMATCH: SQL expects {max_placeholder} params but only {len(params)} provided!")
        
        # Get database connection from URL
        conn = _get_db_connection_from_url(body.databaseUrl)
        
        try:
            # Set query timeout
            conn.run("SET statement_timeout = '300000'")  # 5 minutes
            conn.run("SET lock_timeout = '5000'")
            
            # Execute with parameters (pg8000.native uses **kwargs, params must be dict)
            # Convert list params to dict with string keys matching $1, $2, etc.
            if params:
                params_dict = {str(i): v for i, v in enumerate(params)}
                logger.info(f"Running with params dict: {params_dict}")
                result = conn.run(sql, **params_dict)
            else:
                logger.info("Running without params")
                result = conn.run(sql)
            
            # Get column names from pg8000 (handles both tuple and dict formats)
            columns = []
            if conn.columns:
                for col in conn.columns:
                    if isinstance(col, dict):
                        columns.append(col.get('name', str(col)))
                    elif hasattr(col, 'name'):
                        columns.append(col.name)
                    elif isinstance(col, (list, tuple)) and len(col) > 0:
                        columns.append(str(col[0]))
                    else:
                        columns.append(str(col))
            
            # Build response
            rows = []
            if result and columns:
                for row in result:
                    row_dict = {}
                    # Use min to prevent index out of range
                    row_len = len(row) if hasattr(row, '__len__') else 0
                    for i, col in enumerate(columns):
                        if i < row_len:
                            value = row[i]
                            # Convert datetime objects to ISO strings
                            if hasattr(value, 'isoformat'):
                                value = value.isoformat()
                            row_dict[col] = value
                        else:
                            row_dict[col] = None
                    rows.append(row_dict)
            
            execution_time = (time.time() - start_time) * 1000
            
            # Build column metadata
            column_info = []
            for col_name in columns:
                field_info = {"name": col_name, "displayName": col_name, "type": "string"}
                
                # Parse column alias to get entity and field
                # Format is: entity_id_field_id (e.g., vehicles_vehicle_id)
                if "_" in col_name:
                    # Try to match against known entities
                    for entity_id in ENTITIES:
                        # Check if column starts with entity_id_
                        prefix = f"{entity_id}_"
                        if col_name.startswith(prefix):
                            field_id = col_name[len(prefix):]
                            entity = get_entity(entity_id)
                            if entity:
                                field = next((f for f in entity.fields if f.id == field_id), None)
                                if field:
                                    field_info = {
                                        "name": col_name,
                                        "displayName": field.display_name,
                                        "type": field.type.value,
                                        "entityId": entity_id,
                                        "fieldId": field_id,
                                    }
                                    break
                
                column_info.append(field_info)
            
            return {
                "columns": column_info,
                "rows": rows,
                "totalRows": len(rows),
                "executionTime": execution_time,
                "sql": sql,  # Always include SQL in dev mode
            }
            
        finally:
            conn.close()
            
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"Dev query execution error: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        error_msg = str(e)
        if "password" in error_msg.lower() or "host" in error_msg.lower():
            error_msg = "Database connection error"
        raise HTTPException(status_code=400, detail=error_msg)


@router.post("/query/validate")
async def validate_query(request: ReportConfigRequest) -> Dict[str, Any]:
    """Validate a report configuration without executing."""
    try:
        config = _convert_frontend_config(request)
        
        # Validate primary entity exists
        if not get_entity(config.primary_entity):
            return {"valid": False, "error": f"Unknown entity: {config.primary_entity}"}
        
        # Validate all selected fields exist
        for field in config.selected_fields:
            entity = get_entity(field.entity_id)
            if not entity:
                return {"valid": False, "error": f"Unknown entity: {field.entity_id}"}
            if not any(f.id == field.field_id for f in entity.fields):
                return {"valid": False, "error": f"Unknown field: {field.field_id} in {field.entity_id}"}
        
        # Generate SQL to validate syntax
        sql = generate_preview_sql(config)
        
        return {"valid": True, "sql": sql}
        
    except Exception as e:
        return {"valid": False, "error": str(e)}


# =============================================================================
# REPORT MANAGEMENT ENDPOINTS
# =============================================================================

# These would typically use a database, but for simplicity we use file storage
REPORTS_FILE = Path("/tmp/iot-query-probe/saved_reports.json")


def _load_reports() -> List[Dict[str, Any]]:
    """Load saved reports from file."""
    if not REPORTS_FILE.exists():
        return []
    try:
        with open(REPORTS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []


def _save_reports(reports: List[Dict[str, Any]]):
    """Save reports to file."""
    REPORTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORTS_FILE, "w") as f:
        json.dump(reports, f)


@router.get("/reports")
async def list_reports() -> List[Dict[str, Any]]:
    """List all saved reports."""
    return _load_reports()


@router.post("/reports")
async def save_report(request: ReportConfigRequest) -> Dict[str, Any]:
    """Save a report configuration."""
    import uuid
    
    reports = _load_reports()
    
    report = {
        "id": str(uuid.uuid4()),
        "name": request.name,
        "description": request.description,
        "config": request.model_dump(),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    reports.append(report)
    _save_reports(reports)
    
    return report


@router.get("/reports/{report_id}")
async def get_report(report_id: str) -> Dict[str, Any]:
    """Get a specific saved report."""
    reports = _load_reports()
    report = next((r for r in reports if r["id"] == report_id), None)
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return report


@router.delete("/reports/{report_id}")
async def delete_report(report_id: str) -> Dict[str, str]:
    """Delete a saved report."""
    reports = _load_reports()
    reports = [r for r in reports if r["id"] != report_id]
    _save_reports(reports)
    
    return {"status": "deleted"}

