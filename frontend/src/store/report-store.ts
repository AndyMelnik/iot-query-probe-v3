/**
 * Report Builder State Management
 * 
 * Zustand store for managing report configuration,
 * query results, and UI state
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  ReportConfig,
  SelectedField,
  FilterCondition,
  SortConfig,
  TimeRange,
  QueryResult,
  ChartConfig,
  MapConfig,
  VisualizationType,
  AggregationType,
  QueryMode,
} from '@/types/entities';
import {
  isAuthenticated,
  getCurrentUser,
  getAuthToken,
  clearAuthToken,
  authFetch,
  type AuthUser,
} from '@/lib/auth';

interface ReportState {
  // Authentication (Navixy App Connect)
  isAuthenticated: boolean;
  authUser: AuthUser | null;
  authError: string | null;
  
  // Dev mode database connection (fallback when not using Navixy)
  devModeEnabled: boolean;
  databaseUrl: string;
  isConnected: boolean;
  connectionError: string | null;
  
  // Query Mode: 'standard' (visual builder) or 'advanced' (SQL editor)
  queryMode: QueryMode;
  customSql: string;
  
  // Current report configuration
  config: ReportConfig;
  
  // Query results
  queryResult: QueryResult | null;
  isLoading: boolean;
  error: string | null;
  
  // Visualization settings
  visualizationType: VisualizationType;
  chartConfig: ChartConfig | null;
  mapConfig: MapConfig | null;
  
  // UI State
  isSidebarOpen: boolean;
  selectedEntityForFields: string | null;
  
  // Saved reports
  savedReports: ReportConfig[];
  
  // Actions
  setPrimaryEntity: (entityId: string) => void;
  addField: (field: SelectedField) => void;
  removeField: (entityId: string, fieldId: string) => void;
  updateFieldAggregation: (entityId: string, fieldId: string, aggregation?: AggregationType) => void;
  reorderFields: (fromIndex: number, toIndex: number) => void;
  
  addFilter: (filter: Omit<FilterCondition, 'id'>) => void;
  updateFilter: (id: string, updates: Partial<FilterCondition>) => void;
  removeFilter: (id: string) => void;
  clearFilters: () => void;
  
  addSort: (sort: SortConfig) => void;
  removeSort: (entityId: string, fieldId: string) => void;
  clearSorting: () => void;
  
  setTimeRange: (timeRange: TimeRange | undefined) => void;
  setTimeField: (field: string | undefined) => void;
  
  addGroupBy: (field: SelectedField) => void;
  removeGroupBy: (entityId: string, fieldId: string) => void;
  clearGroupBy: () => void;
  
  setLimit: (limit: number | undefined) => void;
  setReportName: (name: string) => void;
  setReportDescription: (description: string) => void;
  
  setQueryResult: (result: QueryResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  setVisualizationType: (type: VisualizationType) => void;
  setChartConfig: (config: ChartConfig | null) => void;
  setMapConfig: (config: MapConfig | null) => void;
  
  toggleSidebar: () => void;
  setSelectedEntityForFields: (entityId: string | null) => void;
  
  saveReport: () => void;
  loadReport: (report: ReportConfig) => void;
  deleteReport: (id: string) => void;
  
  resetReport: () => void;
  
  // Authentication (Navixy App Connect)
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  
  // Dev mode database connection (fallback)
  setDevMode: (enabled: boolean) => void;
  setDatabaseUrl: (url: string) => void;
  testConnection: () => Promise<boolean>;
  disconnect: () => void;
  
  // Query mode
  setQueryMode: (mode: QueryMode) => void;
  setCustomSql: (sql: string) => void;
}

const initialConfig: ReportConfig = {
  name: 'New Report',
  description: '',
  primaryEntity: '',
  selectedFields: [],
  filters: [],
  sorting: [],
  groupBy: [],
  limit: 1000,
};

// Helper function to generate UUID
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const useReportStore = create<ReportState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state - Authentication
        isAuthenticated: false,
        authUser: null,
        authError: null,
        
        // Initial state - Dev mode
        devModeEnabled: false,
        databaseUrl: '',
        isConnected: false,
        connectionError: null,
        
        // Initial state - Query mode
        queryMode: 'standard',
        customSql: '',
        
        config: { ...initialConfig },
        queryResult: null,
        isLoading: false,
        error: null,
        visualizationType: 'table',
        chartConfig: null,
        mapConfig: null,
        isSidebarOpen: true,
        selectedEntityForFields: null,
        savedReports: [],

        // Entity selection - preserves existing fields and config
        setPrimaryEntity: (entityId) =>
          set((state) => ({
            config: {
              ...state.config,
              primaryEntity: entityId,
            },
            selectedEntityForFields: entityId,
            queryResult: null,
          })),

        // Field management
        addField: (field) =>
          set((state) => {
            const exists = state.config.selectedFields.some(
              (f) => f.entityId === field.entityId && f.fieldId === field.fieldId
            );
            if (exists) return state;
            return {
              config: {
                ...state.config,
                selectedFields: [...state.config.selectedFields, field],
              },
            };
          }),

        removeField: (entityId, fieldId) =>
          set((state) => ({
            config: {
              ...state.config,
              selectedFields: state.config.selectedFields.filter(
                (f) => !(f.entityId === entityId && f.fieldId === fieldId)
              ),
            },
          })),

        updateFieldAggregation: (entityId, fieldId, aggregation) =>
          set((state) => ({
            config: {
              ...state.config,
              selectedFields: state.config.selectedFields.map((f) =>
                f.entityId === entityId && f.fieldId === fieldId
                  ? { ...f, aggregation }
                  : f
              ),
            },
          })),

        reorderFields: (fromIndex, toIndex) =>
          set((state) => {
            const fields = [...state.config.selectedFields];
            const [removed] = fields.splice(fromIndex, 1);
            fields.splice(toIndex, 0, removed);
            return {
              config: { ...state.config, selectedFields: fields },
            };
          }),

        // Filter management
        addFilter: (filter) =>
          set((state) => ({
            config: {
              ...state.config,
              filters: [...state.config.filters, { ...filter, id: uuid() }],
            },
          })),

        updateFilter: (id, updates) =>
          set((state) => ({
            config: {
              ...state.config,
              filters: state.config.filters.map((f) =>
                f.id === id ? { ...f, ...updates } : f
              ),
            },
          })),

        removeFilter: (id) =>
          set((state) => ({
            config: {
              ...state.config,
              filters: state.config.filters.filter((f) => f.id !== id),
            },
          })),

        clearFilters: () =>
          set((state) => ({
            config: { ...state.config, filters: [] },
          })),

        // Sorting management
        addSort: (sort) =>
          set((state) => {
            const exists = state.config.sorting.some(
              (s) => s.entityId === sort.entityId && s.fieldId === sort.fieldId
            );
            if (exists) return state;
            return {
              config: {
                ...state.config,
                sorting: [...state.config.sorting, sort],
              },
            };
          }),

        removeSort: (entityId, fieldId) =>
          set((state) => ({
            config: {
              ...state.config,
              sorting: state.config.sorting.filter(
                (s) => !(s.entityId === entityId && s.fieldId === fieldId)
              ),
            },
          })),

        clearSorting: () =>
          set((state) => ({
            config: { ...state.config, sorting: [] },
          })),

        // Time range
        setTimeRange: (timeRange) =>
          set((state) => ({
            config: { ...state.config, timeRange },
          })),

        setTimeField: (field) =>
          set((state) => ({
            config: { ...state.config, timeField: field },
          })),

        // Group by
        addGroupBy: (field) =>
          set((state) => {
            const groupBy = state.config.groupBy || [];
            const exists = groupBy.some(
              (f) => f.entityId === field.entityId && f.fieldId === field.fieldId
            );
            if (exists) return state;
            return {
              config: {
                ...state.config,
                groupBy: [...groupBy, field],
              },
            };
          }),

        removeGroupBy: (entityId, fieldId) =>
          set((state) => ({
            config: {
              ...state.config,
              groupBy: (state.config.groupBy || []).filter(
                (f) => !(f.entityId === entityId && f.fieldId === fieldId)
              ),
            },
          })),

        clearGroupBy: () =>
          set((state) => ({
            config: { ...state.config, groupBy: [] },
          })),

        // Report metadata
        setLimit: (limit) =>
          set((state) => ({
            config: { ...state.config, limit },
          })),

        setReportName: (name) =>
          set((state) => ({
            config: { ...state.config, name },
          })),

        setReportDescription: (description) =>
          set((state) => ({
            config: { ...state.config, description },
          })),

        // Query results
        setQueryResult: (result) => set({ queryResult: result }),
        setLoading: (loading) => set({ isLoading: loading }),
        setError: (error) => set({ error }),

        // Visualization
        setVisualizationType: (type) => set({ visualizationType: type }),
        setChartConfig: (config) => set({ chartConfig: config }),
        setMapConfig: (config) => set({ mapConfig: config }),

        // UI State
        toggleSidebar: () =>
          set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

        setSelectedEntityForFields: (entityId) =>
          set({ selectedEntityForFields: entityId }),

        // Report management
        saveReport: () =>
          set((state) => {
            const now = new Date().toISOString();
            const report = {
              ...state.config,
              id: state.config.id || uuid(),
              updatedAt: now,
              createdAt: state.config.createdAt || now,
            };

            const existingIndex = state.savedReports.findIndex(
              (r) => r.id === report.id
            );

            const savedReports =
              existingIndex >= 0
                ? state.savedReports.map((r, i) =>
                    i === existingIndex ? report : r
                  )
                : [...state.savedReports, report];

            return { config: report, savedReports };
          }),

        loadReport: (report) =>
          set({
            config: { ...report },
            queryResult: null,
            error: null,
            selectedEntityForFields: report.primaryEntity,
          }),

        deleteReport: (id) =>
          set((state) => {
            const savedReports = state.savedReports.filter((r) => r.id !== id);
            const config =
              state.config.id === id ? { ...initialConfig } : state.config;
            return {
              savedReports,
              config,
              queryResult: state.config.id === id ? null : state.queryResult,
            };
          }),

        resetReport: () =>
          set({
            config: { ...initialConfig },
            queryResult: null,
            error: null,
            selectedEntityForFields: null,
            chartConfig: null,
            mapConfig: null,
            visualizationType: 'table',
          }),

        // Authentication actions (Navixy App Connect)
        checkAuth: async () => {
          // First check if we have a valid token in localStorage
          if (isAuthenticated()) {
            const user = getCurrentUser();
            if (user) {
              set({ isAuthenticated: true, authUser: user, authError: null, isConnected: true });
              return;
            }
          }
          
          // Verify with backend
          try {
            const response = await authFetch('/api/auth/status');
            const data = await response.json();
            
            if (data.authenticated && data.user) {
              set({ 
                isAuthenticated: true, 
                authUser: data.user, 
                authError: null,
                isConnected: true 
              });
            } else {
              set({ 
                isAuthenticated: false, 
                authUser: null, 
                authError: data.token_error || null,
                isConnected: false 
              });
            }
          } catch (err) {
            set({ 
              isAuthenticated: false, 
              authUser: null, 
              authError: err instanceof Error ? err.message : 'Auth check failed',
              isConnected: false 
            });
          }
        },
        
        logout: async () => {
          try {
            await authFetch('/api/auth/logout', { method: 'POST' });
          } catch {
            // Ignore errors during logout
          } finally {
            clearAuthToken();
            set({ 
              isAuthenticated: false, 
              authUser: null, 
              authError: null,
              isConnected: false,
              queryResult: null 
            });
          }
        },
        
        // Dev mode database connection actions (fallback when not using Navixy)
        setDevMode: (enabled) => set({ devModeEnabled: enabled }),
        setDatabaseUrl: (url) => set({ databaseUrl: url, connectionError: null }),
        
        testConnection: async () => {
          const { databaseUrl, devModeEnabled } = get();
          
          // If not in dev mode and already authenticated via Navixy, we're good
          if (!devModeEnabled && isAuthenticated()) {
            set({ isConnected: true });
            return true;
          }
          
          if (!databaseUrl) {
            set({ connectionError: 'Please enter a database URL' });
            return false;
          }
          
          try {
            set({ isLoading: true, connectionError: null });
            const response = await fetch('/api/connection/test', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ databaseUrl }),
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
              set({ isConnected: true, connectionError: null, isLoading: false });
              return true;
            } else {
              set({ isConnected: false, connectionError: data.error || 'Connection failed', isLoading: false });
              return false;
            }
          } catch (err) {
            set({ 
              isConnected: false, 
              connectionError: err instanceof Error ? err.message : 'Connection failed',
              isLoading: false 
            });
            return false;
          }
        },
        
        disconnect: () => set({ 
          isConnected: false, 
          databaseUrl: '', 
          connectionError: null,
          queryResult: null 
        }),
        
        // Query mode actions
        setQueryMode: (mode) => set({ queryMode: mode, queryResult: null, error: null }),
        setCustomSql: (sql) => set({ customSql: sql }),
      }),
      {
        name: 'iot-query-probe-reports',
        partialize: (state) => ({
          savedReports: state.savedReports,
          // NOTE: databaseUrl intentionally NOT persisted for security
          // Users must re-enter connection details on each session
        }),
      }
    ),
    { name: 'ReportStore' }
  )
);
