# IoT Query Probe — Report Builder

**IoT Query Probe** is a powerful analytical tool designed to work with IoT Query databases. The Report Builder provides a modern, intuitive drag-and-drop interface for creating custom reports from your IoT and telematics data without writing SQL.

Built with Next.js + FastAPI for a seamless full-stack experience.

## What is IoT Query Probe?

IoT Query Probe connects to your IoT Query database and provides:

- **Visual Report Builder** — Create complex queries through an intuitive UI
- **Entity-Based Data Model** — Navigate relationships between objects, vehicles, employees, geofences, and telemetry data
- **Real-Time Analytics** — Query live data with automatic SQL generation
- **Multiple Visualizations** — View results as tables, charts, or maps
- **Export Capabilities** — Download reports in HTML, CSV, or Excel formats

## Features

### 🎯 Drag & Drop Report Builder
- **Field Selection** — Click to add fields from any entity to your report
- **Entity Relationships** — Automatic JOIN generation based on data relationships
- **Visual Filters** — Configure WHERE conditions without writing SQL
- **Time Range Selection** — Relative (last 7 days) or absolute date ranges
- **Advanced SQL Preview** — See the generated SQL in real-time

### 📊 Supported Entities

| Category | Entities |
|----------|----------|
| **Core** | Objects, Vehicles, Employees/Drivers |
| **Grouping** | Groups, Departments, Tags |
| **Geo** | Geofences, Places/POIs |
| **Telemetry** | Location Data, Inputs, States |

### 📈 Visualizations

- **Data Table** — Sortable, searchable, with CSV/XLSX export
- **Line Charts** — Time series analysis with multi-axis support
- **Interactive Maps** — Leaflet-based with Light/Dark themes
- **Color Grouping** — Group data by any attribute on charts and maps

### 💾 Export Options

- **HTML Reports** — Complete reports with table, chart, and map screenshots
- **CSV Export** — Raw data for spreadsheet analysis
- **Excel (.xlsx)** — Formatted spreadsheet export
- **JSON Config** — Save and reload report configurations

## Tech Stack

### Frontend
- **Next.js 14** — React framework with App Router
- **TypeScript** — Full type safety
- **Tailwind CSS** — Modern styling
- **Zustand** — Lightweight state management
- **Recharts** — Interactive charts
- **Leaflet** — Map visualizations

### Backend
- **FastAPI** — High-performance Python API
- **pg8000** — Pure Python PostgreSQL driver
- **Pydantic** — Request/response validation
- **JWT** — Secure authentication

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- Access to an IoT Query database (PostgreSQL)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/AndyMelnik/iot-query-probe-v3.git
cd iot-query-probe-v3
```

2. **Install backend dependencies:**
```bash
pip install -r requirements.txt
```

3. **Install frontend dependencies:**
```bash
cd frontend
npm install
```

4. **Set environment variables:**
```bash
export JWT_SECRET=$(openssl rand -hex 32)
```

### Development

**Start the backend server:**
```bash
python run_dev.py
```

**Start the frontend (new terminal):**
```bash
cd frontend
npm run dev
```

**Open:** http://localhost:3000

### Connecting to Your Database

In development mode, use the connection bar at the top of the UI to enter your PostgreSQL connection URL:

```
postgresql://username:password@host:5432/database?sslmode=require
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              IoT Query Probe — Frontend                 │
├─────────────────────────────────────────────────────────┤
│  Report Builder │ Entity Sidebar │ Visualizations      │
│  (Field Select) │  (Categories)  │ (Table/Chart/Map)   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              IoT Query Probe — Backend                  │
├─────────────────────────────────────────────────────────┤
│  Entity Metadata │ Query Builder │ Authentication      │
│  /api/entities   │ /api/query/*  │ /api/auth/*         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  IoT Query Database                     │
├─────────────────────────────────────────────────────────┤
│  raw_business_data     │     raw_telematics_data       │
│  ├─ objects            │     ├─ tracking_data_core     │
│  ├─ vehicles           │     ├─ inputs (sensors)       │
│  ├─ employees          │     └─ states                 │
│  ├─ groups             │                               │
│  ├─ departments        │                               │
│  ├─ geofences          │                               │
│  └─ pois               │                               │
└─────────────────────────────────────────────────────────┘
```

## API Endpoints

### Entity Metadata
| Endpoint | Description |
|----------|-------------|
| `GET /api/entities` | List all available entities |
| `GET /api/entities/{id}` | Get entity details |
| `GET /api/entities/{id}/fields` | Get entity fields |
| `GET /api/entities/{id}/relationships` | Get related entities |

### Query Operations
| Endpoint | Description |
|----------|-------------|
| `POST /api/query/preview` | Generate SQL preview |
| `POST /api/query/execute` | Execute query and return results |
| `POST /api/query/validate` | Validate configuration |

### Report Management
| Endpoint | Description |
|----------|-------------|
| `GET /api/reports` | List saved reports |
| `POST /api/reports` | Save a report |
| `DELETE /api/reports/{id}` | Delete a report |

## Usage Guide

1. **Select Entity** — Choose a primary entity from the sidebar (e.g., Vehicles)
2. **Add Fields** — Click fields to add them to your report
3. **Add Related Data** — Expand related entities to include their fields
4. **Configure Filters** — Set conditions to filter your data
5. **Set Time Range** — Choose a time period for time-series data
6. **Run Query** — Click "Run Query" to execute
7. **Visualize** — View results as Table, Chart, or Map
8. **Export** — Download as HTML, CSV, or Excel

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | (required) | Secret key for JWT tokens |
| `JWT_EXPIRATION_HOURS` | 24 | Token expiration time |
| `CORS_ORIGINS` | * | Allowed CORS origins |
| `FRAME_ANCESTORS` | 'self' https://dashboard.tools.datahub.navixy.com https://*.navixy.com | Allowed iframe embedding origins |
| `DEBUG_MODE` | false | Enable SQL in responses |
| `RATE_LIMIT_REQUESTS` | 100 | Requests per window |
| `RATE_LIMIT_WINDOW` | 60 | Rate limit window (seconds) |

### Iframe Embedding

This application is designed to be embedded in an iframe within the Navixy dashboard. The `FRAME_ANCESTORS` environment variable controls which domains can embed the app:

```bash
# Default: Allow Navixy dashboard
export FRAME_ANCESTORS="'self' https://dashboard.tools.datahub.navixy.com https://*.navixy.com"

# Custom: Add your own domains
export FRAME_ANCESTORS="'self' https://your-dashboard.com https://*.navixy.com"
```

## Security

- ✅ JWT authentication with HS256
- ✅ Encrypted credential storage (Fernet/AES)
- ✅ Rate limiting (100 req/60s per IP)
- ✅ SQL injection prevention via parameterized queries
- ✅ XSS protection in exports
- ✅ CSP frame-ancestors for iframe security
- ✅ Security headers (CSP, X-Content-Type-Options, etc.)

See [SECURITY.md](SECURITY.md) for detailed security information.

## Deployment

### Render.com (Recommended)

1. **Fork/clone this repository** to your GitHub account

2. **Go to Render Dashboard:**
   - Visit https://dashboard.render.com/blueprints
   - Click "New Blueprint Instance"
   - Connect to your GitHub repo

3. **Configure environment variables:**
   - `JWT_SECRET` — Auto-generated by Render
   - `CORS_ORIGINS` — Set to your domain (e.g., `https://your-app.onrender.com,https://dashboard.tools.datahub.navixy.com`)

4. **Deploy!** Your app will be available at `https://your-app.onrender.com`

**Recommended Plan:** Starter ($7/mo) or higher for production use.

### Navixy App Connect Integration

After deployment, configure your app with Navixy:

1. Register your app URL with Navixy App Connect
2. Users access via: `https://dashboard.tools.datahub.navixy.com/?session_key=XXX&target=https://your-app.onrender.com`
3. Navixy handles authentication and provides database credentials automatically

### Docker (Manual)

```bash
# Build the image
docker build -t iot-query-probe .

# Run with required environment
docker run -p 10000:10000 \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -e CORS_ORIGINS="https://your-domain.com" \
  iot-query-probe
```

### Fly.io

Deploy using the included `fly.toml` configuration:

```bash
fly launch
fly secrets set JWT_SECRET=$(openssl rand -hex 32)
fly deploy
```

## License

MIT License — See [LICENSE](LICENSE) file.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and feature requests, please use [GitHub Issues](https://github.com/AndyMelnik/iot-query-probe-v3/issues).
