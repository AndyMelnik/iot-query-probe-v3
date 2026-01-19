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

