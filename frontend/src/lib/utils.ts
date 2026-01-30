import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number, decimals = 2): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDate(date: string | Date, format: 'short' | 'long' | 'datetime' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return String(date);
  }

  switch (format) {
    case 'short':
      return d.toLocaleDateString();
    case 'long':
      return d.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'datetime':
      return d.toLocaleString();
    default:
      return d.toLocaleDateString();
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function getColorForEntity(entityId: string): string {
  const colors: Record<string, string> = {
    objects: '#2186eb',
    vehicles: '#8b5cf6',
    employees: '#22c55e',
    departments: '#f97316',
    groups: '#ec4899',
    devices: '#06b6d4',
    sensor_description: '#eab308',
    zones: '#ef4444',
    tracking_data_core: '#14b8a6',
    inputs: '#a855f7',
    users: '#64748b',
  };
  return colors[entityId] || '#64748b';
}

export function getIconForFieldType(type: string): string {
  const icons: Record<string, string> = {
    string: 'Type',
    number: 'Hash',
    boolean: 'ToggleLeft',
    datetime: 'Calendar',
    date: 'CalendarDays',
    time: 'Clock',
    json: 'Braces',
    coordinates: 'MapPin',
    enum: 'List',
  };
  return icons[type] || 'Circle';
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function downloadFile(data: Blob | string, filename: string, mimeType?: string): void {
  const blob = typeof data === 'string' 
    ? new Blob([data], { type: mimeType || 'text/plain' })
    : data;
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =============================================================================
// TELEMATICS DATA FORMATTING
// =============================================================================
// IoT Query database stores certain values in optimized integer format:
// - Latitude/Longitude: Integer with 10^7 precision (divide by 10,000,000)
// - Speed: Integer with 10^2 precision (divide by 100)
// =============================================================================

/**
 * Check if a column name indicates it contains latitude data
 */
export function isLatitudeColumn(name: string): boolean {
  const lowerName = name.toLowerCase();
  return lowerName.includes('lat') || lowerName === 'latitude';
}

/**
 * Check if a column name indicates it contains longitude data
 */
export function isLongitudeColumn(name: string): boolean {
  const lowerName = name.toLowerCase();
  return lowerName.includes('lon') || lowerName.includes('lng') || lowerName === 'longitude';
}

/**
 * Check if a column name indicates it contains speed data
 */
export function isSpeedColumn(name: string): boolean {
  const lowerName = name.toLowerCase();
  return lowerName.includes('speed');
}

/**
 * Convert integer coordinate to decimal degrees
 * IoT Query stores coordinates as integers with 10^7 precision
 * Example: 554273550 → 55.4273550
 */
export function convertCoordinate(value: number): number {
  // If the value is clearly in integer format (> 180 for any coordinate)
  if (Math.abs(value) > 180) {
    return value / 10000000;
  }
  return value;
}

/**
 * Convert integer speed to decimal
 * IoT Query stores speed as integer with 10^2 precision
 * Example: 6523 → 65.23 km/h
 */
export function convertSpeed(value: number): number {
  // Speeds are stored as integer * 100
  // If value seems too large to be a real speed, divide by 100
  if (value > 1000) {
    return value / 100;
  }
  return value;
}

/**
 * Format a telematics value based on column name
 * Automatically detects and converts lat/lng/speed values
 */
export function formatTelematicsValue(value: unknown, columnName: string): string | number {
  if (value === null || value === undefined) return '—';
  
  const numValue = Number(value);
  if (isNaN(numValue)) return String(value);
  
  const lowerName = columnName.toLowerCase();
  
  // Handle coordinates
  if (isLatitudeColumn(columnName) || isLongitudeColumn(columnName)) {
    const converted = convertCoordinate(numValue);
    return converted.toFixed(6);
  }
  
  // Handle speed
  if (isSpeedColumn(columnName)) {
    const converted = convertSpeed(numValue);
    return `${converted.toFixed(1)} km/h`;
  }
  
  // Handle heading/course (degrees, 0-360)
  if (lowerName.includes('heading') || lowerName.includes('course') || lowerName.includes('direction')) {
    return `${numValue.toFixed(0)}°`;
  }
  
  // Handle altitude (meters)
  if (lowerName.includes('altitude') || lowerName.includes('alt')) {
    return `${numValue.toFixed(1)} m`;
  }
  
  // Default number formatting
  if (Number.isInteger(numValue)) {
    return numValue.toLocaleString();
  }
  return numValue.toFixed(2);
}

/**
 * Get the raw numeric value for telematics data (for calculations/charts)
 */
export function getTelematicsNumericValue(value: unknown, columnName: string): number {
  if (value === null || value === undefined) return 0;
  
  const numValue = Number(value);
  if (isNaN(numValue)) return 0;
  
  // Handle coordinates
  if (isLatitudeColumn(columnName) || isLongitudeColumn(columnName)) {
    return convertCoordinate(numValue);
  }
  
  // Handle speed
  if (isSpeedColumn(columnName)) {
    return convertSpeed(numValue);
  }
  
  return numValue;
}

