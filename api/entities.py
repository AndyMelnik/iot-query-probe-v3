"""
Entity Schema API

Provides entity definitions, fields, and relationships
for the frontend report builder.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from enum import Enum


class FieldType(str, Enum):
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    DATETIME = "datetime"
    DATE = "date"
    TIME = "time"
    JSON = "json"
    COORDINATES = "coordinates"
    ENUM = "enum"


class AggregationType(str, Enum):
    COUNT = "count"
    SUM = "sum"
    AVG = "avg"
    MIN = "min"
    MAX = "max"
    COUNT_DISTINCT = "count_distinct"


class EntityField(BaseModel):
    id: str
    name: str
    display_name: str
    type: FieldType
    description: Optional[str] = None
    is_primary_key: bool = False
    is_foreign_key: bool = False
    foreign_entity: Optional[str] = None
    foreign_field: Optional[str] = None
    enum_values: Optional[List[str]] = None
    aggregations: Optional[List[AggregationType]] = None
    filterable: bool = False
    sortable: bool = False
    format: Optional[str] = None


class EntityRelationship(BaseModel):
    target_entity: str
    type: str  # one-to-one, one-to-many, many-to-one, many-to-many
    source_field: str
    target_field: str
    join_type: str = "left"  # inner, left, right
    through_table: Optional[str] = None


class Entity(BaseModel):
    id: str
    name: str
    display_name: str
    display_name_plural: str
    description: str
    icon: str
    color: str
    schema_name: str
    table_name: str
    fields: List[EntityField]
    relationships: List[EntityRelationship]
    default_fields: Optional[List[str]] = None
    searchable_fields: Optional[List[str]] = None
    timestamp_field: Optional[str] = None


class EntityCategory(BaseModel):
    id: str
    name: str
    description: str
    entities: List[str]


# =============================================================================
# ENTITY DEFINITIONS
# =============================================================================

def _timestamp_field(name: str = "record_added_at") -> EntityField:
    return EntityField(
        id=name,
        name=name,
        display_name="Record Added",
        type=FieldType.DATETIME,
        filterable=True,
        sortable=True,
    )


ENTITIES: Dict[str, Entity] = {
    "objects": Entity(
        id="objects",
        name="objects",
        display_name="Object",
        display_name_plural="Objects",
        description="Tracked units linking devices to organizational structure",
        icon="MapPin",
        color="#2186eb",
        schema_name="raw_business_data",
        table_name="objects",
        fields=[
            EntityField(id="object_id", name="object_id", display_name="Object ID", type=FieldType.NUMBER, is_primary_key=True, filterable=True, sortable=True),
            EntityField(id="object_label", name="object_label", display_name="Object Name", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="device_id", name="device_id", display_name="Device ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="devices", foreign_field="device_id", filterable=True),
            EntityField(id="client_id", name="client_id", display_name="Client ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="users", foreign_field="user_id", filterable=True),
            EntityField(id="group_id", name="group_id", display_name="Group ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="groups", foreign_field="group_id", filterable=True),
            EntityField(id="model", name="model", display_name="Device Model", type=FieldType.STRING, filterable=True),
            EntityField(id="create_datetime", name="create_datetime", display_name="Created At", type=FieldType.DATETIME, filterable=True, sortable=True),
            EntityField(id="is_deleted", name="is_deleted", display_name="Is Deleted", type=FieldType.BOOLEAN, filterable=True),
            EntityField(id="is_clone", name="is_clone", display_name="Is Clone", type=FieldType.BOOLEAN, filterable=True),
            _timestamp_field(),
        ],
        relationships=[
            EntityRelationship(target_entity="devices", type="many-to-one", source_field="device_id", target_field="device_id", join_type="left"),
            EntityRelationship(target_entity="groups", type="many-to-one", source_field="group_id", target_field="group_id", join_type="left"),
            EntityRelationship(target_entity="vehicles", type="one-to-one", source_field="object_id", target_field="object_id", join_type="left"),
            EntityRelationship(target_entity="employees", type="one-to-many", source_field="object_id", target_field="object_id", join_type="left"),
        ],
        default_fields=["object_id", "object_label", "model", "create_datetime"],
        searchable_fields=["object_label", "model"],
        timestamp_field="create_datetime",
    ),
    
    "vehicles": Entity(
        id="vehicles",
        name="vehicles",
        display_name="Vehicle",
        display_name_plural="Vehicles",
        description="Physical vehicles with specifications and documentation",
        icon="Car",
        color="#8b5cf6",
        schema_name="raw_business_data",
        table_name="vehicles",
        fields=[
            EntityField(id="vehicle_id", name="vehicle_id", display_name="Vehicle ID", type=FieldType.NUMBER, is_primary_key=True, filterable=True, sortable=True),
            EntityField(id="vehicle_label", name="vehicle_label", display_name="Vehicle Name", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="registration_number", name="registration_number", display_name="License Plate", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="vin", name="vin", display_name="VIN", type=FieldType.STRING, filterable=True),
            EntityField(id="model", name="model", display_name="Model", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="manufacture_year", name="manufacture_year", display_name="Year", type=FieldType.NUMBER, filterable=True, sortable=True),
            EntityField(id="vehicle_type", name="vehicle_type", display_name="Type", type=FieldType.NUMBER, filterable=True),
            EntityField(id="fuel_type", name="fuel_type", display_name="Fuel Type", type=FieldType.NUMBER, filterable=True),
            EntityField(id="fuel_tank_volume", name="fuel_tank_volume", display_name="Tank Volume (L)", type=FieldType.NUMBER, aggregations=[AggregationType.AVG, AggregationType.SUM]),
            EntityField(id="standard_fuel_consumption", name="standard_fuel_consumption", display_name="Fuel Consumption (L/100km)", type=FieldType.NUMBER, aggregations=[AggregationType.AVG]),
            EntityField(id="max_speed", name="max_speed", display_name="Max Speed (km/h)", type=FieldType.NUMBER, aggregations=[AggregationType.AVG, AggregationType.MAX]),
            EntityField(id="object_id", name="object_id", display_name="Object ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="objects", foreign_field="object_id"),
            EntityField(id="user_id", name="user_id", display_name="User ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="users", foreign_field="user_id"),
            EntityField(id="garage_id", name="garage_id", display_name="Garage ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="garages", foreign_field="garage_id"),
            _timestamp_field(),
        ],
        relationships=[
            EntityRelationship(target_entity="objects", type="one-to-one", source_field="object_id", target_field="object_id", join_type="left"),
            EntityRelationship(target_entity="users", type="many-to-one", source_field="user_id", target_field="user_id", join_type="left"),
        ],
        default_fields=["vehicle_id", "vehicle_label", "registration_number", "model", "vehicle_type"],
        searchable_fields=["vehicle_label", "registration_number", "vin", "model"],
        timestamp_field="record_added_at",
    ),

    "employees": Entity(
        id="employees",
        name="employees",
        display_name="Employee",
        display_name_plural="Employees / Drivers",
        description="Personnel records including drivers with license information",
        icon="User",
        color="#22c55e",
        schema_name="raw_business_data",
        table_name="employees",
        fields=[
            EntityField(id="employee_id", name="employee_id", display_name="Employee ID", type=FieldType.NUMBER, is_primary_key=True, filterable=True, sortable=True),
            EntityField(id="first_name", name="first_name", display_name="First Name", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="last_name", name="last_name", display_name="Last Name", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="middle_name", name="middle_name", display_name="Middle Name", type=FieldType.STRING, filterable=True),
            EntityField(id="email", name="email", display_name="Email", type=FieldType.STRING, filterable=True),
            EntityField(id="phone_number", name="phone_number", display_name="Phone", type=FieldType.STRING, filterable=True),
            EntityField(id="personnel_number", name="personnel_number", display_name="Personnel Number", type=FieldType.STRING, filterable=True),
            EntityField(id="department_id", name="department_id", display_name="Department ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="departments", foreign_field="department_id"),
            EntityField(id="object_id", name="object_id", display_name="Assigned Object ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="objects", foreign_field="object_id"),
            EntityField(id="hardware_key", name="hardware_key", display_name="Hardware Key", type=FieldType.STRING, filterable=True),
            EntityField(id="driver_license_number", name="driver_license_number", display_name="License Number", type=FieldType.STRING, filterable=True),
            EntityField(id="is_deleted", name="is_deleted", display_name="Is Deleted", type=FieldType.BOOLEAN, filterable=True),
            _timestamp_field(),
        ],
        relationships=[
            EntityRelationship(target_entity="departments", type="many-to-one", source_field="department_id", target_field="department_id", join_type="left"),
            EntityRelationship(target_entity="objects", type="many-to-one", source_field="object_id", target_field="object_id", join_type="left"),
        ],
        default_fields=["employee_id", "first_name", "last_name", "phone_number", "department_id"],
        searchable_fields=["first_name", "last_name", "email", "phone_number"],
        timestamp_field="record_added_at",
    ),

    "departments": Entity(
        id="departments",
        name="departments",
        display_name="Department",
        display_name_plural="Departments",
        description="Organizational units with geographic location",
        icon="Building",
        color="#f97316",
        schema_name="raw_business_data",
        table_name="departments",
        fields=[
            EntityField(id="department_id", name="department_id", display_name="Department ID", type=FieldType.NUMBER, is_primary_key=True, filterable=True, sortable=True),
            EntityField(id="department_label", name="department_label", display_name="Department Name", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="user_id", name="user_id", display_name="User ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="users", foreign_field="user_id"),
            EntityField(id="address", name="address", display_name="Address", type=FieldType.STRING, filterable=True),
            EntityField(id="latitude", name="latitude", display_name="Latitude", type=FieldType.NUMBER),
            EntityField(id="longitude", name="longitude", display_name="Longitude", type=FieldType.NUMBER),
            _timestamp_field(),
        ],
        relationships=[
            EntityRelationship(target_entity="employees", type="one-to-many", source_field="department_id", target_field="department_id", join_type="left"),
        ],
        default_fields=["department_id", "department_label", "address"],
        searchable_fields=["department_label", "address"],
        timestamp_field="record_added_at",
    ),

    "groups": Entity(
        id="groups",
        name="groups",
        display_name="Group",
        display_name_plural="Groups",
        description="Organizational grouping for trackers",
        icon="Folder",
        color="#ec4899",
        schema_name="raw_business_data",
        table_name="groups",
        fields=[
            EntityField(id="group_id", name="group_id", display_name="Group ID", type=FieldType.NUMBER, is_primary_key=True, filterable=True, sortable=True),
            EntityField(id="group_label", name="group_label", display_name="Group Name", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="group_color", name="group_color", display_name="Color", type=FieldType.STRING),
            EntityField(id="client_id", name="client_id", display_name="Client ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="users", foreign_field="user_id"),
            _timestamp_field(),
        ],
        relationships=[
            EntityRelationship(target_entity="objects", type="one-to-many", source_field="group_id", target_field="group_id", join_type="left"),
        ],
        default_fields=["group_id", "group_label", "group_color"],
        searchable_fields=["group_label"],
        timestamp_field="record_added_at",
    ),

    "devices": Entity(
        id="devices",
        name="devices",
        display_name="Device",
        display_name_plural="Devices",
        description="GPS/tracking hardware with connectivity information",
        icon="Smartphone",
        color="#06b6d4",
        schema_name="raw_business_data",
        table_name="devices",
        fields=[
            EntityField(id="device_id", name="device_id", display_name="Device ID", type=FieldType.NUMBER, is_primary_key=True, filterable=True, sortable=True),
            EntityField(id="device_imei", name="device_imei", display_name="IMEI", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="phone", name="phone", display_name="SIM Phone", type=FieldType.STRING, filterable=True),
            EntityField(id="network_label", name="network_label", display_name="Network", type=FieldType.STRING, filterable=True),
            EntityField(id="signal_level", name="signal_level", display_name="Signal Level", type=FieldType.NUMBER, aggregations=[AggregationType.AVG, AggregationType.MIN, AggregationType.MAX]),
            EntityField(id="has_roaming", name="has_roaming", display_name="Roaming", type=FieldType.BOOLEAN, filterable=True),
            EntityField(id="is_sim_blocked", name="is_sim_blocked", display_name="SIM Blocked", type=FieldType.BOOLEAN, filterable=True),
            EntityField(id="created_at", name="created_at", display_name="Created At", type=FieldType.DATETIME, filterable=True, sortable=True),
            _timestamp_field(),
        ],
        relationships=[
            EntityRelationship(target_entity="objects", type="one-to-many", source_field="device_id", target_field="device_id", join_type="left"),
            EntityRelationship(target_entity="sensor_description", type="one-to-many", source_field="device_id", target_field="device_id", join_type="left"),
        ],
        default_fields=["device_id", "device_imei", "phone", "signal_level", "network_label"],
        searchable_fields=["device_imei", "phone", "network_label"],
        timestamp_field="created_at",
    ),

    "sensor_description": Entity(
        id="sensor_description",
        name="sensor_description",
        display_name="Sensor",
        display_name_plural="Sensors",
        description="Sensor configurations with calibration and units",
        icon="Gauge",
        color="#eab308",
        schema_name="raw_business_data",
        table_name="sensor_description",
        fields=[
            EntityField(id="sensor_id", name="sensor_id", display_name="Sensor ID", type=FieldType.NUMBER, is_primary_key=True, filterable=True, sortable=True),
            EntityField(id="device_id", name="device_id", display_name="Device ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="devices", foreign_field="device_id"),
            EntityField(id="sensor_label", name="sensor_label", display_name="Sensor Name", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="sensor_type", name="sensor_type", display_name="Sensor Type", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="input_label", name="input_label", display_name="Input Name", type=FieldType.STRING, filterable=True),
            EntityField(id="sensor_units", name="sensor_units", display_name="Units", type=FieldType.STRING, filterable=True),
            EntityField(id="multiplier", name="multiplier", display_name="Multiplier", type=FieldType.NUMBER),
            EntityField(id="divider", name="divider", display_name="Divider", type=FieldType.NUMBER),
            _timestamp_field(),
        ],
        relationships=[
            EntityRelationship(target_entity="devices", type="many-to-one", source_field="device_id", target_field="device_id", join_type="inner"),
        ],
        default_fields=["sensor_id", "sensor_label", "sensor_type", "sensor_units"],
        searchable_fields=["sensor_label", "sensor_type", "input_label"],
        timestamp_field="record_added_at",
    ),

    "tags": Entity(
        id="tags",
        name="tags",
        display_name="Tag",
        display_name_plural="Tags",
        description="Labels for categorizing and filtering objects",
        icon="Tag",
        color="#06b6d4",
        schema_name="raw_business_data",
        table_name="tags",
        fields=[
            EntityField(id="tag_id", name="tag_id", display_name="Tag ID", type=FieldType.NUMBER, is_primary_key=True, filterable=True, sortable=True),
            EntityField(id="tag_label", name="tag_label", display_name="Tag Name", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="color", name="color", display_name="Color", type=FieldType.STRING),
            EntityField(id="user_id", name="user_id", display_name="User ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="users", foreign_field="user_id", filterable=True),
            _timestamp_field(),
        ],
        relationships=[],
        default_fields=["tag_id", "tag_label", "color"],
        searchable_fields=["tag_label"],
        timestamp_field="record_added_at",
    ),

    "geofences": Entity(
        id="geofences",
        name="geofences",
        display_name="Geofence",
        display_name_plural="Geofences",
        description="Geographic boundaries for monitoring entry/exit events",
        icon="MapPinned",
        color="#ef4444",
        schema_name="raw_business_data",
        table_name="zones",
        fields=[
            EntityField(id="zone_id", name="zone_id", display_name="Zone ID", type=FieldType.NUMBER, is_primary_key=True, filterable=True, sortable=True),
            EntityField(id="zone_label", name="zone_label", display_name="Zone Name", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="zone_type", name="zone_type", display_name="Zone Type", type=FieldType.STRING, filterable=True),
            EntityField(id="address", name="address", display_name="Address", type=FieldType.STRING, filterable=True),
            EntityField(id="latitude", name="latitude", display_name="Center Latitude", type=FieldType.NUMBER),
            EntityField(id="longitude", name="longitude", display_name="Center Longitude", type=FieldType.NUMBER),
            EntityField(id="radius", name="radius", display_name="Radius (m)", type=FieldType.NUMBER, aggregations=[AggregationType.AVG, AggregationType.SUM]),
            EntityField(id="color", name="color", display_name="Color", type=FieldType.STRING),
            _timestamp_field(),
        ],
        relationships=[],
        default_fields=["zone_id", "zone_label", "zone_type", "address", "radius"],
        searchable_fields=["zone_label", "address"],
        timestamp_field="record_added_at",
    ),

    "pois": Entity(
        id="pois",
        name="pois",
        display_name="Place",
        display_name_plural="Places / POIs",
        description="Named locations and places of interest",
        icon="MapPin",
        color="#f97316",
        schema_name="raw_business_data",
        table_name="places",
        fields=[
            EntityField(id="place_id", name="place_id", display_name="Place ID", type=FieldType.NUMBER, is_primary_key=True, filterable=True, sortable=True),
            EntityField(id="place_label", name="place_label", display_name="Place Name", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="address", name="address", display_name="Address", type=FieldType.STRING, filterable=True),
            EntityField(id="latitude", name="latitude", display_name="Latitude", type=FieldType.NUMBER),
            EntityField(id="longitude", name="longitude", display_name="Longitude", type=FieldType.NUMBER),
            EntityField(id="radius", name="radius", display_name="Radius (m)", type=FieldType.NUMBER),
            EntityField(id="description", name="description", display_name="Description", type=FieldType.STRING),
            EntityField(id="external_id", name="external_id", display_name="External ID", type=FieldType.STRING, filterable=True),
            EntityField(id="user_id", name="user_id", display_name="User ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="users", foreign_field="user_id", filterable=True),
            _timestamp_field(),
        ],
        relationships=[],
        default_fields=["place_id", "place_label", "address", "radius"],
        searchable_fields=["place_label", "address"],
        timestamp_field="record_added_at",
    ),

    "tracking_data_core": Entity(
        id="tracking_data_core",
        name="tracking_data_core",
        display_name="Location",
        display_name_plural="Location Data",
        description="GPS location and motion data from devices",
        icon="Navigation",
        color="#14b8a6",
        schema_name="raw_telematics_data",
        table_name="tracking_data_core",
        fields=[
            EntityField(id="device_id", name="device_id", display_name="Device ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="devices", foreign_field="device_id", filterable=True),
            EntityField(id="device_time", name="device_time", display_name="Device Time", type=FieldType.DATETIME, filterable=True, sortable=True),
            EntityField(id="platform_time", name="platform_time", display_name="Platform Time", type=FieldType.DATETIME, filterable=True, sortable=True),
            EntityField(id="latitude", name="latitude", display_name="Latitude", type=FieldType.NUMBER, description="Divide by 10^7 for degrees"),
            EntityField(id="longitude", name="longitude", display_name="Longitude", type=FieldType.NUMBER, description="Divide by 10^7 for degrees"),
            EntityField(id="speed", name="speed", display_name="Speed", type=FieldType.NUMBER, description="Divide by 100 for km/h", aggregations=[AggregationType.AVG, AggregationType.MAX, AggregationType.MIN]),
            EntityField(id="altitude", name="altitude", display_name="Altitude (m)", type=FieldType.NUMBER, aggregations=[AggregationType.AVG, AggregationType.MAX, AggregationType.MIN]),
            EntityField(id="satellites", name="satellites", display_name="Satellites", type=FieldType.NUMBER, aggregations=[AggregationType.AVG]),
            EntityField(id="event_id", name="event_id", display_name="Event ID", type=FieldType.NUMBER),
            _timestamp_field(),
        ],
        relationships=[
            EntityRelationship(target_entity="devices", type="many-to-one", source_field="device_id", target_field="device_id", join_type="inner"),
        ],
        default_fields=["device_id", "device_time", "latitude", "longitude", "speed"],
        timestamp_field="device_time",
    ),

    "inputs": Entity(
        id="inputs",
        name="inputs",
        display_name="Input",
        display_name_plural="Inputs",
        description="Time-series sensor input values from devices",
        icon="ArrowDownToLine",
        color="#a855f7",
        schema_name="raw_telematics_data",
        table_name="inputs",
        fields=[
            EntityField(id="device_id", name="device_id", display_name="Device ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="devices", foreign_field="device_id", filterable=True),
            EntityField(id="device_time", name="device_time", display_name="Device Time", type=FieldType.DATETIME, filterable=True, sortable=True),
            EntityField(id="sensor_name", name="sensor_name", display_name="Sensor Name", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="value", name="value", display_name="Value", type=FieldType.STRING),
            EntityField(id="event_id", name="event_id", display_name="Event ID", type=FieldType.NUMBER),
            _timestamp_field(),
        ],
        relationships=[
            EntityRelationship(target_entity="devices", type="many-to-one", source_field="device_id", target_field="device_id", join_type="inner"),
        ],
        default_fields=["device_id", "device_time", "sensor_name", "value"],
        searchable_fields=["sensor_name"],
        timestamp_field="device_time",
    ),

    "states": Entity(
        id="states",
        name="states",
        display_name="State",
        display_name_plural="States",
        description="Device states and status information",
        icon="ArrowUpFromLine",
        color="#22c55e",
        schema_name="raw_telematics_data",
        table_name="states",
        fields=[
            EntityField(id="device_id", name="device_id", display_name="Device ID", type=FieldType.NUMBER, is_foreign_key=True, foreign_entity="devices", foreign_field="device_id", filterable=True),
            EntityField(id="device_time", name="device_time", display_name="Device Time", type=FieldType.DATETIME, filterable=True, sortable=True),
            EntityField(id="state_name", name="state_name", display_name="State Name", type=FieldType.STRING, filterable=True, sortable=True),
            EntityField(id="value", name="value", display_name="Value", type=FieldType.STRING),
            EntityField(id="status", name="status", display_name="Status", type=FieldType.STRING, filterable=True),
            EntityField(id="event_id", name="event_id", display_name="Event ID", type=FieldType.NUMBER),
            _timestamp_field(),
        ],
        relationships=[
            EntityRelationship(target_entity="devices", type="many-to-one", source_field="device_id", target_field="device_id", join_type="inner"),
        ],
        default_fields=["device_id", "device_time", "state_name", "value", "status"],
        searchable_fields=["state_name"],
        timestamp_field="device_time",
    ),
}


ENTITY_CATEGORIES: List[EntityCategory] = [
    EntityCategory(
        id="core",
        name="Core",
        description="Primary tracked units and personnel",
        entities=["objects", "vehicles", "employees"],
    ),
    EntityCategory(
        id="grouping",
        name="Grouping",
        description="Organization and categorization",
        entities=["groups", "departments", "tags"],
    ),
    EntityCategory(
        id="geo",
        name="Geo",
        description="Geographic boundaries and locations",
        entities=["geofences", "pois"],
    ),
    EntityCategory(
        id="telemetry",
        name="Telemetry",
        description="Tracking and sensor data",
        entities=["tracking_data_core", "inputs", "states"],
    ),
]


def get_entity(entity_id: str) -> Optional[Entity]:
    """Get entity by ID."""
    return ENTITIES.get(entity_id)


def get_all_entities() -> List[Entity]:
    """Get all entities."""
    return list(ENTITIES.values())


def get_entity_categories() -> List[EntityCategory]:
    """Get all entity categories."""
    return ENTITY_CATEGORIES


def get_related_entities(entity_id: str) -> List[str]:
    """Get IDs of entities related to the given entity."""
    entity = ENTITIES.get(entity_id)
    if not entity:
        return []
    return [r.target_entity for r in entity.relationships]

