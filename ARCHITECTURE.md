# IoT Analytics Platform - Architecture

## Overview

Modern drag-and-drop analytics platform for IoT/telematics data, similar to HubSpot's report builder.
Designed for non-technical users to create reports from business entities without writing SQL.

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Components**: shadcn/ui + Radix UI
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Drag & Drop**: @dnd-kit/core
- **Charts**: Recharts + Tremor
- **Maps**: react-map-gl (Mapbox GL)
- **Tables**: TanStack Table
- **Forms**: React Hook Form + Zod
- **Styling**: Tailwind CSS

### Backend
- **Framework**: FastAPI (Python)
- **Auth**: JWT + Navixy App Connect
- **Database**: PostgreSQL (pg8000)
- **Query Builder**: Custom SQL generator with entity mapping

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Report    │  │   Entity    │  │   Visualization     │  │
│  │   Builder   │  │   Selector  │  │   Components        │  │
│  │   (DnD)     │  │             │  │   (Table/Chart/Map) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│           │              │                    │              │
│           └──────────────┼────────────────────┘              │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Zustand State Management                   ││
│  │   - Report Configuration                                ││
│  │   - Selected Entities & Fields                          ││
│  │   - Filters & Sorting                                   ││
│  │   - Query Results                                       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI Backend                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    Auth     │  │   Query     │  │    Entity           │  │
│  │   Service   │  │   Builder   │  │    Metadata         │  │
│  │   (Navixy)  │  │   Service   │  │    Service          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Entity Relationship Graph                  ││
│  │   - Auto JOIN path calculation                          ││
│  │   - Field type inference                                ││
│  │   - Aggregation suggestions                             ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │  raw_business_data   │  │    raw_telematics_data       │ │
│  │  - vehicles          │  │    - tracking_data_core      │ │
│  │  - employees         │  │    - inputs (sensors)        │ │
│  │  - departments       │  │    - states                  │ │
│  │  - objects           │  │                              │ │
│  │  - devices           │  │                              │ │
│  │  - zones             │  │                              │ │
│  │  - groups            │  │                              │ │
│  │  - sensors           │  │                              │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Business Entities

### Core Entities (User-facing names)

| Entity               | DB Table(s)           | Description                          |
|---------------------|-----------------------|--------------------------------------|
| **Object**          | objects               | Tracked unit (device assignment)     |
| **Vehicle**         | vehicles              | Physical vehicle with specs          |
| **Employee/Driver** | employees             | Personnel with assignments           |
| **Department**      | departments           | Organizational unit                  |
| **Group**           | groups                | Tracker grouping for organization    |
| **Device**          | devices               | GPS/tracking hardware                |
| **Sensor**          | sensor_description    | Sensor configuration                 |
| **Zone/Geofence**   | zones, geofence_points| Geographic boundaries               |
| **Location Data**   | tracking_data_core    | GPS points and motion data          |
| **Sensor Readings** | inputs                | Sensor values over time             |

### Entity Relationships (for auto-JOIN)

```
vehicles ──── object_id ────► objects ◄─── device_id ─── devices
    │                            │                          │
    │                            │                          │
    ▼                            ▼                          ▼
employees ─ object_id ─► objects    sensor_description ◄─ device_id
    │                                       │
    ▼                                       │
departments                                 ▼
                                    inputs (sensor readings)
                                           │
                                           ▼
                                  tracking_data_core (location)
```

## Report Builder Flow

1. **Select Primary Entity** - User picks main entity (e.g., "Vehicles")
2. **Add Fields** - Drag fields from entity sidebar to report canvas
3. **Add Related Entities** - System suggests joinable entities
4. **Apply Filters** - Configure WHERE conditions visually
5. **Set Sorting** - Define ORDER BY columns
6. **Choose Time Range** - Select date/time boundaries
7. **Preview & Execute** - Generate SQL and fetch results
8. **Visualize** - Switch between Table/Chart/Map views
9. **Export** - Download as Excel/HTML report

## API Endpoints

### Entity Metadata
- `GET /api/entities` - List all available entities
- `GET /api/entities/{id}/fields` - Get entity fields
- `GET /api/entities/{id}/relationships` - Get joinable entities

### Query Builder
- `POST /api/query/preview` - Generate SQL preview
- `POST /api/query/execute` - Execute query and return results
- `POST /api/query/validate` - Validate report configuration

### Reports
- `GET /api/reports` - List saved reports
- `POST /api/reports` - Save report configuration
- `GET /api/reports/{id}` - Get report details
- `DELETE /api/reports/{id}` - Delete report

### Export
- `POST /api/export/excel` - Export to Excel
- `POST /api/export/html` - Export to HTML report

