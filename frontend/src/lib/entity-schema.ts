/**
 * Entity Schema Registry
 * 
 * Complete definition of all business entities, their fields,
 * and relationships for automatic JOIN path calculation
 */

import { Entity, EntityCategory, EntityField, EntityRelationship } from '@/types/entities';

// Helper to create common fields
const timestampField = (name: string = 'record_added_at'): EntityField => ({
  id: name,
  name: name,
  displayName: 'Record Added',
  type: 'datetime',
  filterable: true,
  sortable: true,
});

// =============================================================================
// ENTITY DEFINITIONS
// =============================================================================

export const ENTITIES: Record<string, Entity> = {
  // ---------------------------------------------------------------------------
  // OBJECTS (Trackers)
  // ---------------------------------------------------------------------------
  objects: {
    id: 'objects',
    name: 'objects',
    displayName: 'Object',
    displayNamePlural: 'Objects',
    description: 'Tracked units linking devices to organizational structure',
    icon: 'MapPin',
    color: '#2186eb',
    schema: 'raw_business_data',
    tableName: 'objects',
    fields: [
      { id: 'object_id', name: 'object_id', displayName: 'Object ID', type: 'number', isPrimaryKey: true, filterable: true, sortable: true },
      { id: 'object_label', name: 'object_label', displayName: 'Object Name', type: 'string', filterable: true, sortable: true },
      { id: 'device_id', name: 'device_id', displayName: 'Device ID', type: 'number', isForeignKey: true, foreignEntity: 'devices', foreignField: 'device_id' },
      { id: 'client_id', name: 'client_id', displayName: 'Client ID', type: 'number', isForeignKey: true, foreignEntity: 'users', foreignField: 'user_id' },
      { id: 'group_id', name: 'group_id', displayName: 'Group ID', type: 'number', isForeignKey: true, foreignEntity: 'groups', foreignField: 'group_id' },
      { id: 'model', name: 'model', displayName: 'Device Model', type: 'string', filterable: true },
      { id: 'create_datetime', name: 'create_datetime', displayName: 'Created At', type: 'datetime', filterable: true, sortable: true },
      { id: 'is_deleted', name: 'is_deleted', displayName: 'Is Deleted', type: 'boolean', filterable: true },
      { id: 'is_clone', name: 'is_clone', displayName: 'Is Clone', type: 'boolean', filterable: true },
      timestampField(),
    ],
    relationships: [
      { targetEntity: 'devices', type: 'many-to-one', sourceField: 'device_id', targetField: 'device_id', joinType: 'left' },
      { targetEntity: 'groups', type: 'many-to-one', sourceField: 'group_id', targetField: 'group_id', joinType: 'left' },
      { targetEntity: 'users', type: 'many-to-one', sourceField: 'client_id', targetField: 'user_id', joinType: 'left' },
      { targetEntity: 'vehicles', type: 'one-to-one', sourceField: 'object_id', targetField: 'object_id', joinType: 'left' },
      { targetEntity: 'employees', type: 'one-to-many', sourceField: 'object_id', targetField: 'object_id', joinType: 'left' },
    ],
    defaultFields: ['object_id', 'object_label', 'model', 'create_datetime'],
    searchableFields: ['object_label', 'model'],
    timestampField: 'create_datetime',
  },

  // ---------------------------------------------------------------------------
  // VEHICLES
  // ---------------------------------------------------------------------------
  vehicles: {
    id: 'vehicles',
    name: 'vehicles',
    displayName: 'Vehicle',
    displayNamePlural: 'Vehicles',
    description: 'Physical vehicles with specifications and documentation',
    icon: 'Car',
    color: '#8b5cf6',
    schema: 'raw_business_data',
    tableName: 'vehicles',
    fields: [
      { id: 'vehicle_id', name: 'vehicle_id', displayName: 'Vehicle ID', type: 'number', isPrimaryKey: true, filterable: true, sortable: true },
      { id: 'vehicle_label', name: 'vehicle_label', displayName: 'Vehicle Name', type: 'string', filterable: true, sortable: true },
      { id: 'registration_number', name: 'registration_number', displayName: 'License Plate', type: 'string', filterable: true, sortable: true },
      { id: 'vin', name: 'vin', displayName: 'VIN', type: 'string', filterable: true },
      { id: 'model', name: 'model', displayName: 'Model', type: 'string', filterable: true, sortable: true },
      { id: 'manufacture_year', name: 'manufacture_year', displayName: 'Year', type: 'number', filterable: true, sortable: true },
      { id: 'vehicle_type', name: 'vehicle_type', displayName: 'Type', type: 'enum', filterable: true, enumValues: ['car', 'truck', 'bus', 'motorcycle', 'trailer'] },
      { id: 'vehicle_subtype', name: 'vehicle_subtype', displayName: 'Subtype', type: 'string', filterable: true },
      { id: 'color', name: 'color', displayName: 'Color', type: 'string', filterable: true },
      { id: 'fuel_type', name: 'fuel_type', displayName: 'Fuel Type', type: 'enum', filterable: true },
      { id: 'fuel_tank_volume', name: 'fuel_tank_volume', displayName: 'Tank Volume (L)', type: 'number', aggregations: ['avg', 'sum'] },
      { id: 'standard_fuel_consumption', name: 'standard_fuel_consumption', displayName: 'Fuel Consumption (L/100km)', type: 'number', aggregations: ['avg'] },
      { id: 'max_speed', name: 'max_speed', displayName: 'Max Speed (km/h)', type: 'number', aggregations: ['avg', 'max'] },
      { id: 'gross_weight', name: 'gross_weight', displayName: 'Gross Weight (kg)', type: 'number', aggregations: ['avg', 'sum'] },
      { id: 'payload_weight', name: 'payload_weight', displayName: 'Payload Weight (kg)', type: 'number', aggregations: ['avg', 'sum'] },
      { id: 'passenger_capacity', name: 'passenger_capacity', displayName: 'Passenger Capacity', type: 'number', aggregations: ['sum', 'avg'] },
      { id: 'object_id', name: 'object_id', displayName: 'Object ID', type: 'number', isForeignKey: true, foreignEntity: 'objects', foreignField: 'object_id' },
      { id: 'user_id', name: 'user_id', displayName: 'User ID', type: 'number', isForeignKey: true, foreignEntity: 'users', foreignField: 'user_id' },
      { id: 'garage_id', name: 'garage_id', displayName: 'Garage ID', type: 'number', isForeignKey: true, foreignEntity: 'garages', foreignField: 'garage_id' },
      { id: 'liability_insurance_valid_till', name: 'liability_insurance_valid_till', displayName: 'Insurance Valid Till', type: 'datetime', filterable: true, sortable: true },
      timestampField(),
    ],
    relationships: [
      { targetEntity: 'objects', type: 'one-to-one', sourceField: 'object_id', targetField: 'object_id', joinType: 'left' },
      { targetEntity: 'users', type: 'many-to-one', sourceField: 'user_id', targetField: 'user_id', joinType: 'left' },
      { targetEntity: 'garages', type: 'many-to-one', sourceField: 'garage_id', targetField: 'garage_id', joinType: 'left' },
      { targetEntity: 'vehicle_service_tasks', type: 'one-to-many', sourceField: 'vehicle_id', targetField: 'vehicle_id', joinType: 'left' },
    ],
    defaultFields: ['vehicle_id', 'vehicle_label', 'registration_number', 'model', 'vehicle_type'],
    searchableFields: ['vehicle_label', 'registration_number', 'vin', 'model'],
    timestampField: 'record_added_at',
  },

  // ---------------------------------------------------------------------------
  // EMPLOYEES / DRIVERS
  // ---------------------------------------------------------------------------
  employees: {
    id: 'employees',
    name: 'employees',
    displayName: 'Employee',
    displayNamePlural: 'Employees / Drivers',
    description: 'Personnel records including drivers with license information',
    icon: 'User',
    color: '#22c55e',
    schema: 'raw_business_data',
    tableName: 'employees',
    fields: [
      { id: 'employee_id', name: 'employee_id', displayName: 'Employee ID', type: 'number', isPrimaryKey: true, filterable: true, sortable: true },
      { id: 'first_name', name: 'first_name', displayName: 'First Name', type: 'string', filterable: true, sortable: true },
      { id: 'last_name', name: 'last_name', displayName: 'Last Name', type: 'string', filterable: true, sortable: true },
      { id: 'middle_name', name: 'middle_name', displayName: 'Middle Name', type: 'string', filterable: true },
      { id: 'email', name: 'email', displayName: 'Email', type: 'string', filterable: true },
      { id: 'phone_number', name: 'phone_number', displayName: 'Phone', type: 'string', filterable: true },
      { id: 'personnel_number', name: 'personnel_number', displayName: 'Personnel Number', type: 'string', filterable: true },
      { id: 'department_id', name: 'department_id', displayName: 'Department ID', type: 'number', isForeignKey: true, foreignEntity: 'departments', foreignField: 'department_id' },
      { id: 'object_id', name: 'object_id', displayName: 'Assigned Object ID', type: 'number', isForeignKey: true, foreignEntity: 'objects', foreignField: 'object_id' },
      { id: 'user_id', name: 'user_id', displayName: 'User ID', type: 'number', isForeignKey: true, foreignEntity: 'users', foreignField: 'user_id' },
      { id: 'hardware_key', name: 'hardware_key', displayName: 'Hardware Key (iButton/RFID)', type: 'string', filterable: true },
      { id: 'driver_license_number', name: 'driver_license_number', displayName: 'License Number', type: 'string', filterable: true },
      { id: 'driver_license_categories', name: 'driver_license_categories', displayName: 'License Categories', type: 'string', filterable: true },
      { id: 'driver_license_valid_till', name: 'driver_license_valid_till', displayName: 'License Valid Till', type: 'datetime', filterable: true, sortable: true },
      { id: 'address', name: 'address', displayName: 'Address', type: 'string', filterable: true },
      { id: 'latitude', name: 'latitude', displayName: 'Latitude', type: 'number' },
      { id: 'longitude', name: 'longitude', displayName: 'Longitude', type: 'number' },
      { id: 'is_deleted', name: 'is_deleted', displayName: 'Is Deleted', type: 'boolean', filterable: true },
      timestampField(),
    ],
    relationships: [
      { targetEntity: 'departments', type: 'many-to-one', sourceField: 'department_id', targetField: 'department_id', joinType: 'left' },
      { targetEntity: 'objects', type: 'many-to-one', sourceField: 'object_id', targetField: 'object_id', joinType: 'left' },
      { targetEntity: 'users', type: 'many-to-one', sourceField: 'user_id', targetField: 'user_id', joinType: 'left' },
      { targetEntity: 'driver_history', type: 'one-to-many', sourceField: 'employee_id', targetField: 'new_employee_id', joinType: 'left' },
    ],
    defaultFields: ['employee_id', 'first_name', 'last_name', 'phone_number', 'department_id'],
    searchableFields: ['first_name', 'last_name', 'email', 'phone_number', 'personnel_number'],
    timestampField: 'record_added_at',
  },

  // ---------------------------------------------------------------------------
  // DEPARTMENTS
  // ---------------------------------------------------------------------------
  departments: {
    id: 'departments',
    name: 'departments',
    displayName: 'Department',
    displayNamePlural: 'Departments',
    description: 'Organizational units with geographic location',
    icon: 'Building',
    color: '#f97316',
    schema: 'raw_business_data',
    tableName: 'departments',
    fields: [
      { id: 'department_id', name: 'department_id', displayName: 'Department ID', type: 'number', isPrimaryKey: true, filterable: true, sortable: true },
      { id: 'department_label', name: 'department_label', displayName: 'Department Name', type: 'string', filterable: true, sortable: true },
      { id: 'user_id', name: 'user_id', displayName: 'User ID', type: 'number', isForeignKey: true, foreignEntity: 'users', foreignField: 'user_id' },
      { id: 'address', name: 'address', displayName: 'Address', type: 'string', filterable: true },
      { id: 'latitude', name: 'latitude', displayName: 'Latitude', type: 'number' },
      { id: 'longitude', name: 'longitude', displayName: 'Longitude', type: 'number' },
      { id: 'radius', name: 'radius', displayName: 'Radius (m)', type: 'number' },
      timestampField(),
    ],
    relationships: [
      { targetEntity: 'users', type: 'many-to-one', sourceField: 'user_id', targetField: 'user_id', joinType: 'left' },
      { targetEntity: 'employees', type: 'one-to-many', sourceField: 'department_id', targetField: 'department_id', joinType: 'left' },
    ],
    defaultFields: ['department_id', 'department_label', 'address'],
    searchableFields: ['department_label', 'address'],
    timestampField: 'record_added_at',
  },

  // ---------------------------------------------------------------------------
  // GROUPS
  // ---------------------------------------------------------------------------
  groups: {
    id: 'groups',
    name: 'groups',
    displayName: 'Group',
    displayNamePlural: 'Groups',
    description: 'Organizational grouping for trackers',
    icon: 'Folder',
    color: '#ec4899',
    schema: 'raw_business_data',
    tableName: 'groups',
    fields: [
      { id: 'group_id', name: 'group_id', displayName: 'Group ID', type: 'number', isPrimaryKey: true, filterable: true, sortable: true },
      { id: 'group_label', name: 'group_label', displayName: 'Group Name', type: 'string', filterable: true, sortable: true },
      { id: 'group_color', name: 'group_color', displayName: 'Color', type: 'string' },
      { id: 'client_id', name: 'client_id', displayName: 'Client ID', type: 'number', isForeignKey: true, foreignEntity: 'users', foreignField: 'user_id' },
      timestampField(),
    ],
    relationships: [
      { targetEntity: 'users', type: 'many-to-one', sourceField: 'client_id', targetField: 'user_id', joinType: 'left' },
      { targetEntity: 'objects', type: 'one-to-many', sourceField: 'group_id', targetField: 'group_id', joinType: 'left' },
    ],
    defaultFields: ['group_id', 'group_label', 'group_color'],
    searchableFields: ['group_label'],
    timestampField: 'record_added_at',
  },

  // ---------------------------------------------------------------------------
  // DEVICES
  // ---------------------------------------------------------------------------
  devices: {
    id: 'devices',
    name: 'devices',
    displayName: 'Device',
    displayNamePlural: 'Devices',
    description: 'GPS/tracking hardware with connectivity information',
    icon: 'Smartphone',
    color: '#06b6d4',
    schema: 'raw_business_data',
    tableName: 'devices',
    fields: [
      { id: 'device_id', name: 'device_id', displayName: 'Device ID', type: 'number', isPrimaryKey: true, filterable: true, sortable: true },
      { id: 'device_imei', name: 'device_imei', displayName: 'IMEI', type: 'string', filterable: true, sortable: true },
      { id: 'phone', name: 'phone', displayName: 'SIM Phone', type: 'string', filterable: true },
      { id: 'owner_id', name: 'owner_id', displayName: 'Owner ID', type: 'number', isForeignKey: true, foreignEntity: 'users', foreignField: 'user_id' },
      { id: 'status_listing_id', name: 'status_listing_id', displayName: 'Status Listing ID', type: 'number', isForeignKey: true, foreignEntity: 'status_listings', foreignField: 'status_listing_id' },
      { id: 'network_label', name: 'network_label', displayName: 'Network', type: 'string', filterable: true },
      { id: 'signal_level', name: 'signal_level', displayName: 'Signal Level', type: 'number', aggregations: ['avg', 'min', 'max'] },
      { id: 'has_roaming', name: 'has_roaming', displayName: 'Roaming', type: 'boolean', filterable: true },
      { id: 'is_sim_blocked', name: 'is_sim_blocked', displayName: 'SIM Blocked', type: 'boolean', filterable: true },
      { id: 'created_at', name: 'created_at', displayName: 'Created At', type: 'datetime', filterable: true, sortable: true },
      timestampField(),
    ],
    relationships: [
      { targetEntity: 'users', type: 'many-to-one', sourceField: 'owner_id', targetField: 'user_id', joinType: 'left' },
      { targetEntity: 'objects', type: 'one-to-many', sourceField: 'device_id', targetField: 'device_id', joinType: 'left' },
      { targetEntity: 'sensor_description', type: 'one-to-many', sourceField: 'device_id', targetField: 'device_id', joinType: 'left' },
    ],
    defaultFields: ['device_id', 'device_imei', 'phone', 'signal_level', 'network_label'],
    searchableFields: ['device_imei', 'phone', 'network_label'],
    timestampField: 'created_at',
  },

  // ---------------------------------------------------------------------------
  // SENSORS
  // ---------------------------------------------------------------------------
  sensor_description: {
    id: 'sensor_description',
    name: 'sensor_description',
    displayName: 'Sensor',
    displayNamePlural: 'Sensors',
    description: 'Sensor configurations with calibration and units',
    icon: 'Gauge',
    color: '#eab308',
    schema: 'raw_business_data',
    tableName: 'sensor_description',
    fields: [
      { id: 'sensor_id', name: 'sensor_id', displayName: 'Sensor ID', type: 'number', isPrimaryKey: true, filterable: true, sortable: true },
      { id: 'device_id', name: 'device_id', displayName: 'Device ID', type: 'number', isForeignKey: true, foreignEntity: 'devices', foreignField: 'device_id' },
      { id: 'sensor_label', name: 'sensor_label', displayName: 'Sensor Name', type: 'string', filterable: true, sortable: true },
      { id: 'sensor_type', name: 'sensor_type', displayName: 'Sensor Type', type: 'string', filterable: true, sortable: true },
      { id: 'input_label', name: 'input_label', displayName: 'Input Name', type: 'string', filterable: true },
      { id: 'sensor_units', name: 'sensor_units', displayName: 'Units', type: 'string', filterable: true },
      { id: 'units_type', name: 'units_type', displayName: 'Units Type', type: 'number' },
      { id: 'multiplier', name: 'multiplier', displayName: 'Multiplier', type: 'number' },
      { id: 'divider', name: 'divider', displayName: 'Divider', type: 'number' },
      { id: 'accuracy', name: 'accuracy', displayName: 'Accuracy', type: 'number' },
      { id: 'group_id', name: 'group_id', displayName: 'Sensor Group ID', type: 'number' },
      { id: 'group_type', name: 'group_type', displayName: 'Group Type', type: 'number' },
      { id: 'input_id', name: 'input_id', displayName: 'Input ID', type: 'number' },
      { id: 'parameters', name: 'parameters', displayName: 'Parameters', type: 'json' },
      { id: 'calibration_data', name: 'calibration_data', displayName: 'Calibration Data', type: 'json' },
      timestampField(),
    ],
    relationships: [
      { targetEntity: 'devices', type: 'many-to-one', sourceField: 'device_id', targetField: 'device_id', joinType: 'inner' },
    ],
    defaultFields: ['sensor_id', 'sensor_label', 'sensor_type', 'sensor_units'],
    searchableFields: ['sensor_label', 'sensor_type', 'input_label'],
    timestampField: 'record_added_at',
  },

  // ---------------------------------------------------------------------------
  // ZONES / GEOFENCES
  // ---------------------------------------------------------------------------
  zones: {
    id: 'zones',
    name: 'zones',
    displayName: 'Zone',
    displayNamePlural: 'Zones / Geofences',
    description: 'Geographic boundaries for monitoring entry/exit events',
    icon: 'MapPinned',
    color: '#ef4444',
    schema: 'raw_business_data',
    tableName: 'zones',
    fields: [
      { id: 'zone_id', name: 'zone_id', displayName: 'Zone ID', type: 'number', isPrimaryKey: true, filterable: true, sortable: true },
      { id: 'zone_label', name: 'zone_label', displayName: 'Zone Name', type: 'string', filterable: true, sortable: true },
      { id: 'zone_type', name: 'zone_type', displayName: 'Zone Type', type: 'string', filterable: true },
      { id: 'client_id', name: 'client_id', displayName: 'Client ID', type: 'number', isForeignKey: true, foreignEntity: 'users', foreignField: 'user_id' },
      { id: 'address', name: 'address', displayName: 'Address', type: 'string', filterable: true },
      { id: 'latitude', name: 'latitude', displayName: 'Center Latitude', type: 'number' },
      { id: 'longitude', name: 'longitude', displayName: 'Center Longitude', type: 'number' },
      { id: 'circle_center_latitude', name: 'circle_center_latitude', displayName: 'Circle Center Lat', type: 'number' },
      { id: 'circle_center_longitude', name: 'circle_center_longitude', displayName: 'Circle Center Lon', type: 'number' },
      { id: 'radius', name: 'radius', displayName: 'Radius (m)', type: 'number', aggregations: ['avg', 'sum'] },
      { id: 'color', name: 'color', displayName: 'Color', type: 'string' },
      timestampField(),
    ],
    relationships: [
      { targetEntity: 'users', type: 'many-to-one', sourceField: 'client_id', targetField: 'user_id', joinType: 'left' },
      { targetEntity: 'geofence_points', type: 'one-to-many', sourceField: 'zone_id', targetField: 'zone_id', joinType: 'left' },
    ],
    defaultFields: ['zone_id', 'zone_label', 'zone_type', 'address', 'radius'],
    searchableFields: ['zone_label', 'address'],
    timestampField: 'record_added_at',
  },

  // ---------------------------------------------------------------------------
  // TRACKING DATA (Telematics)
  // ---------------------------------------------------------------------------
  tracking_data_core: {
    id: 'tracking_data_core',
    name: 'tracking_data_core',
    displayName: 'Location',
    displayNamePlural: 'Location Data',
    description: 'GPS location and motion data from devices',
    icon: 'Navigation',
    color: '#14b8a6',
    schema: 'raw_telematics_data',
    tableName: 'tracking_data_core',
    fields: [
      { id: 'device_id', name: 'device_id', displayName: 'Device ID', type: 'number', isForeignKey: true, foreignEntity: 'devices', foreignField: 'device_id', filterable: true },
      { id: 'device_time', name: 'device_time', displayName: 'Device Time', type: 'datetime', filterable: true, sortable: true },
      { id: 'platform_time', name: 'platform_time', displayName: 'Platform Time', type: 'datetime', filterable: true, sortable: true },
      { id: 'latitude', name: 'latitude', displayName: 'Latitude', type: 'number', description: 'Divide by 10^7 for degrees' },
      { id: 'longitude', name: 'longitude', displayName: 'Longitude', type: 'number', description: 'Divide by 10^7 for degrees' },
      { id: 'speed', name: 'speed', displayName: 'Speed', type: 'number', description: 'Divide by 100 for km/h', aggregations: ['avg', 'max', 'min'] },
      { id: 'altitude', name: 'altitude', displayName: 'Altitude (m)', type: 'number', aggregations: ['avg', 'max', 'min'] },
      { id: 'satellites', name: 'satellites', displayName: 'Satellites', type: 'number', aggregations: ['avg'] },
      { id: 'hdop', name: 'hdop', displayName: 'HDOP', type: 'number', aggregations: ['avg'] },
      { id: 'event_id', name: 'event_id', displayName: 'Event ID', type: 'number' },
      { id: 'gps_fix_type', name: 'gps_fix_type', displayName: 'GPS Fix Type', type: 'number', filterable: true },
      timestampField(),
    ],
    relationships: [
      { targetEntity: 'devices', type: 'many-to-one', sourceField: 'device_id', targetField: 'device_id', joinType: 'inner' },
    ],
    defaultFields: ['device_id', 'device_time', 'latitude', 'longitude', 'speed'],
    searchableFields: [],
    timestampField: 'device_time',
  },

  // ---------------------------------------------------------------------------
  // INPUTS (Sensor Readings)
  // ---------------------------------------------------------------------------
  inputs: {
    id: 'inputs',
    name: 'inputs',
    displayName: 'Input',
    displayNamePlural: 'Inputs',
    description: 'Time-series sensor input values from devices',
    icon: 'ArrowDownToLine',
    color: '#a855f7',
    schema: 'raw_telematics_data',
    tableName: 'inputs',
    fields: [
      { id: 'device_id', name: 'device_id', displayName: 'Device ID', type: 'number', isForeignKey: true, foreignEntity: 'devices', foreignField: 'device_id', filterable: true },
      { id: 'device_time', name: 'device_time', displayName: 'Device Time', type: 'datetime', filterable: true, sortable: true },
      { id: 'sensor_name', name: 'sensor_name', displayName: 'Sensor Name', type: 'string', filterable: true, sortable: true },
      { id: 'value', name: 'value', displayName: 'Value', type: 'string' },
      { id: 'event_id', name: 'event_id', displayName: 'Event ID', type: 'number' },
      timestampField(),
    ],
    relationships: [
      { targetEntity: 'devices', type: 'many-to-one', sourceField: 'device_id', targetField: 'device_id', joinType: 'inner' },
      { targetEntity: 'tracking_data_core', type: 'many-to-one', sourceField: 'device_id', targetField: 'device_id', joinType: 'left' },
    ],
    defaultFields: ['device_id', 'device_time', 'sensor_name', 'value'],
    searchableFields: ['sensor_name'],
    timestampField: 'device_time',
  },

  // ---------------------------------------------------------------------------
  // STATES (Device states and status)
  // ---------------------------------------------------------------------------
  states: {
    id: 'states',
    name: 'states',
    displayName: 'State',
    displayNamePlural: 'States',
    description: 'Device states and status information',
    icon: 'ArrowUpFromLine',
    color: '#22c55e',
    schema: 'raw_telematics_data',
    tableName: 'states',
    fields: [
      { id: 'device_id', name: 'device_id', displayName: 'Device ID', type: 'number', isForeignKey: true, foreignEntity: 'devices', foreignField: 'device_id', filterable: true },
      { id: 'device_time', name: 'device_time', displayName: 'Device Time', type: 'datetime', filterable: true, sortable: true },
      { id: 'state_name', name: 'state_name', displayName: 'State Name', type: 'string', filterable: true, sortable: true },
      { id: 'value', name: 'value', displayName: 'Value', type: 'string' },
      { id: 'status', name: 'status', displayName: 'Status', type: 'string', filterable: true },
      { id: 'event_id', name: 'event_id', displayName: 'Event ID', type: 'number' },
      timestampField(),
    ],
    relationships: [
      { targetEntity: 'devices', type: 'many-to-one', sourceField: 'device_id', targetField: 'device_id', joinType: 'inner' },
    ],
    defaultFields: ['device_id', 'device_time', 'state_name', 'value', 'status'],
    searchableFields: ['state_name'],
    timestampField: 'device_time',
  },

  // ---------------------------------------------------------------------------
  // TAGS
  // ---------------------------------------------------------------------------
  tags: {
    id: 'tags',
    name: 'tags',
    displayName: 'Tag',
    displayNamePlural: 'Tags',
    description: 'Labels for categorizing and filtering objects',
    icon: 'Tag',
    color: '#06b6d4',
    schema: 'raw_business_data',
    tableName: 'tags',
    fields: [
      { id: 'tag_id', name: 'tag_id', displayName: 'Tag ID', type: 'number', isPrimaryKey: true, filterable: true, sortable: true },
      { id: 'tag_label', name: 'tag_label', displayName: 'Tag Name', type: 'string', filterable: true, sortable: true },
      { id: 'color', name: 'color', displayName: 'Color', type: 'string' },
      { id: 'user_id', name: 'user_id', displayName: 'User ID', type: 'number', isForeignKey: true, foreignEntity: 'users', foreignField: 'user_id', filterable: true },
      timestampField(),
    ],
    relationships: [],
    defaultFields: ['tag_id', 'tag_label', 'color'],
    searchableFields: ['tag_label'],
    timestampField: 'record_added_at',
  },

  // ---------------------------------------------------------------------------
  // GEOFENCES
  // ---------------------------------------------------------------------------
  geofences: {
    id: 'geofences',
    name: 'geofences',
    displayName: 'Geofence',
    displayNamePlural: 'Geofences',
    description: 'Geographic boundaries for monitoring entry/exit events',
    icon: 'MapPinned',
    color: '#ef4444',
    schema: 'raw_business_data',
    tableName: 'zones',
    fields: [
      { id: 'zone_id', name: 'zone_id', displayName: 'Zone ID', type: 'number', isPrimaryKey: true, filterable: true, sortable: true },
      { id: 'zone_label', name: 'zone_label', displayName: 'Zone Name', type: 'string', filterable: true, sortable: true },
      { id: 'zone_type', name: 'zone_type', displayName: 'Zone Type', type: 'string', filterable: true },
      { id: 'address', name: 'address', displayName: 'Address', type: 'string', filterable: true },
      { id: 'latitude', name: 'latitude', displayName: 'Center Latitude', type: 'number' },
      { id: 'longitude', name: 'longitude', displayName: 'Center Longitude', type: 'number' },
      { id: 'radius', name: 'radius', displayName: 'Radius (m)', type: 'number', aggregations: ['avg', 'sum'] },
      { id: 'color', name: 'color', displayName: 'Color', type: 'string' },
      timestampField(),
    ],
    relationships: [],
    defaultFields: ['zone_id', 'zone_label', 'zone_type', 'address', 'radius'],
    searchableFields: ['zone_label', 'address'],
    timestampField: 'record_added_at',
  },

  // ---------------------------------------------------------------------------
  // PLACES / POIS (Points of Interest)
  // ---------------------------------------------------------------------------
  pois: {
    id: 'pois',
    name: 'pois',
    displayName: 'Place',
    displayNamePlural: 'Places / POIs',
    description: 'Named locations and places of interest',
    icon: 'MapPin',
    color: '#f97316',
    schema: 'raw_business_data',
    tableName: 'places',
    fields: [
      { id: 'place_id', name: 'place_id', displayName: 'Place ID', type: 'number', isPrimaryKey: true, filterable: true, sortable: true },
      { id: 'place_label', name: 'place_label', displayName: 'Place Name', type: 'string', filterable: true, sortable: true },
      { id: 'address', name: 'address', displayName: 'Address', type: 'string', filterable: true },
      { id: 'latitude', name: 'latitude', displayName: 'Latitude', type: 'number' },
      { id: 'longitude', name: 'longitude', displayName: 'Longitude', type: 'number' },
      { id: 'radius', name: 'radius', displayName: 'Radius (m)', type: 'number' },
      { id: 'description', name: 'description', displayName: 'Description', type: 'string' },
      { id: 'external_id', name: 'external_id', displayName: 'External ID', type: 'string', filterable: true },
      { id: 'user_id', name: 'user_id', displayName: 'User ID', type: 'number', isForeignKey: true, foreignEntity: 'users', foreignField: 'user_id', filterable: true },
      timestampField(),
    ],
    relationships: [],
    defaultFields: ['place_id', 'place_label', 'address', 'radius'],
    searchableFields: ['place_label', 'address'],
    timestampField: 'record_added_at',
  },

  // ---------------------------------------------------------------------------
  // USERS
  // ---------------------------------------------------------------------------
  users: {
    id: 'users',
    name: 'users',
    displayName: 'User',
    displayNamePlural: 'Users',
    description: 'User accounts and company information',
    icon: 'Users',
    color: '#64748b',
    schema: 'raw_business_data',
    tableName: 'users',
    fields: [
      { id: 'user_id', name: 'user_id', displayName: 'User ID', type: 'number', isPrimaryKey: true, filterable: true, sortable: true },
      { id: 'company_label', name: 'company_label', displayName: 'Company', type: 'string', filterable: true, sortable: true },
      { id: 'first_name', name: 'first_name', displayName: 'First Name', type: 'string', filterable: true, sortable: true },
      { id: 'last_name', name: 'last_name', displayName: 'Last Name', type: 'string', filterable: true, sortable: true },
      { id: 'middle_name', name: 'middle_name', displayName: 'Middle Name', type: 'string' },
      { id: 'locale', name: 'locale', displayName: 'Locale', type: 'string', filterable: true },
      { id: 'timezone_label', name: 'timezone_label', displayName: 'Timezone', type: 'string', filterable: true },
      { id: 'master_id', name: 'master_id', displayName: 'Master User ID', type: 'number', isForeignKey: true, foreignEntity: 'users', foreignField: 'user_id' },
      { id: 'registration_datetime', name: 'registration_datetime', displayName: 'Registration Date', type: 'datetime', filterable: true, sortable: true },
      { id: 'birth_date', name: 'birth_date', displayName: 'Birth Date', type: 'datetime', filterable: true },
      timestampField(),
    ],
    relationships: [
      { targetEntity: 'objects', type: 'one-to-many', sourceField: 'user_id', targetField: 'client_id', joinType: 'left' },
      { targetEntity: 'vehicles', type: 'one-to-many', sourceField: 'user_id', targetField: 'user_id', joinType: 'left' },
      { targetEntity: 'employees', type: 'one-to-many', sourceField: 'user_id', targetField: 'user_id', joinType: 'left' },
    ],
    defaultFields: ['user_id', 'company_label', 'first_name', 'last_name'],
    searchableFields: ['company_label', 'first_name', 'last_name'],
    timestampField: 'registration_datetime',
  },
};

// =============================================================================
// ENTITY CATEGORIES
// =============================================================================

export const ENTITY_CATEGORIES: EntityCategory[] = [
  {
    id: 'core',
    name: 'Core',
    description: 'Primary tracked units and personnel',
    entities: ['objects', 'vehicles', 'employees'],
  },
  {
    id: 'grouping',
    name: 'Grouping',
    description: 'Organization and categorization',
    entities: ['groups', 'departments', 'tags'],
  },
  {
    id: 'geo',
    name: 'Geo',
    description: 'Geographic boundaries and locations',
    entities: ['geofences', 'pois'],
  },
  {
    id: 'telemetry',
    name: 'Telemetry',
    description: 'Tracking and sensor data',
    entities: ['tracking_data_core', 'inputs', 'states'],
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getEntity(entityId: string): Entity | undefined {
  return ENTITIES[entityId];
}

export function getEntityField(entityId: string, fieldId: string): EntityField | undefined {
  const entity = ENTITIES[entityId];
  return entity?.fields.find(f => f.id === fieldId);
}

export function getRelatedEntities(entityId: string): string[] {
  const entity = ENTITIES[entityId];
  if (!entity) return [];
  return entity.relationships.map(r => r.targetEntity);
}

export function findJoinPath(fromEntity: string, toEntity: string): EntityRelationship[] | null {
  // BFS to find shortest join path between entities
  const visited = new Set<string>();
  const queue: { entity: string; path: EntityRelationship[] }[] = [
    { entity: fromEntity, path: [] },
  ];

  while (queue.length > 0) {
    const { entity, path } = queue.shift()!;
    
    if (entity === toEntity) {
      return path;
    }

    if (visited.has(entity)) continue;
    visited.add(entity);

    const entityDef = ENTITIES[entity];
    if (!entityDef) continue;

    for (const rel of entityDef.relationships) {
      if (!visited.has(rel.targetEntity)) {
        queue.push({
          entity: rel.targetEntity,
          path: [...path, rel],
        });
      }
    }
  }

  return null;
}

export function getAllEntities(): Entity[] {
  return Object.values(ENTITIES);
}

export function getEntitiesByCategory(categoryId: string): Entity[] {
  const category = ENTITY_CATEGORIES.find(c => c.id === categoryId);
  if (!category) return [];
  return category.entities.map(id => ENTITIES[id]).filter(Boolean);
}

