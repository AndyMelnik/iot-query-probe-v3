"""
IoT Query Probe - Minimalistic SQL Query Interface
Single-file application for PostgreSQL data exploration

Authentication: Navixy App Connect integration
- Access via: https://dashboard.tools.datahub.navixy.com/?session_key=XXX&target=YOUR_APP_URL
- Navixy calls /api/auth/login with database credentials
- App uses stored credentials to connect to IoT database

Deployment: Render, fly.io or any container platform
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from urllib.parse import quote, unquote, urlparse, parse_qs
import io
import html
import re
import copy
import json
import hashlib
import base64
from datetime import datetime, timedelta
from pathlib import Path
import os
from typing import Optional

# =============================================================================
# CONFIGURATION
# =============================================================================
MAX_ROWS = 10000
MAX_EXPORT_ROWS = 50000
QUERY_TIMEOUT_MS = 300000  # 5 minutes

# Navixy App Connect URL (for user guidance)
NAVIXY_MIDDLEWARE_URL = "https://dashboard.tools.datahub.navixy.com"
APP_URL = os.getenv("APP_URL", "")  # Set via environment variable in production

# Credential storage configuration (shared with auth_server.py)
CREDENTIALS_DIR = Path(os.getenv("CREDENTIALS_DIR", "/tmp/iot-query-probe"))

st.set_page_config(
    page_title="IoT Query Probe",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Minimal CSS
st.markdown("""
<style>
    .main .block-container { padding: 1rem 2rem; max-width: 100%; }
    h1, h2, h3 { font-weight: 500; margin-bottom: 0.5rem; }
    .stTextArea textarea { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; }
    hr { margin: 1.5rem 0; opacity: 0.3; }
    
    .user-card {
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
    }
    .user-email {
        font-weight: 500;
        font-size: 14px;
        word-break: break-all;
    }
    .user-role {
        font-size: 12px;
        opacity: 0.7;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .connection-status {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        font-size: 12px;
    }
    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
    }
    .status-dot.connected { background: #28a745; }
    .status-dot.disconnected { background: #dc3545; }
    
    .navixy-link {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white !important;
        padding: 12px 20px;
        border-radius: 8px;
        text-decoration: none;
        display: inline-block;
        font-weight: 500;
        margin: 10px 0;
    }
    .navixy-link:hover {
        opacity: 0.9;
        color: white !important;
    }
    
    @media (prefers-color-scheme: light) {
        .success-msg { background: #d4edda; border-left: 3px solid #28a745; padding: 10px 15px; margin: 10px 0; color: #155724; }
        .error-msg { background: #f8d7da; border-left: 3px solid #dc3545; padding: 10px 15px; margin: 10px 0; color: #721c24; }
        .user-card { background: #f8f9fa; border: 1px solid #dee2e6; }
    }
    
    @media (prefers-color-scheme: dark) {
        .success-msg { background: #1e3a29; border-left: 3px solid #28a745; padding: 10px 15px; margin: 10px 0; color: #a3d9b1; }
        .error-msg { background: #3d1f1f; border-left: 3px solid #dc3545; padding: 10px 15px; margin: 10px 0; color: #f5a5a5; }
        .user-card { background: #1e1e1e; border: 1px solid #333; }
    }
</style>
""", unsafe_allow_html=True)


# =============================================================================
# DEBUG LOGGING
# =============================================================================
def get_debug_logs() -> list:
    """Get debug logs for the current session."""
    if "debug_logs" not in st.session_state:
        st.session_state["debug_logs"] = []
    return st.session_state["debug_logs"]

def add_debug_log(message: str):
    """Add a debug log entry."""
    logs = get_debug_logs()
    timestamp = datetime.utcnow().strftime("%H:%M:%S")
    logs.append(f"[{timestamp}] {message}")
    if len(logs) > 50:
        st.session_state["debug_logs"] = logs[-50:]


# =============================================================================
# CREDENTIAL DECRYPTION (matches auth_server.py)
# =============================================================================
def _get_fernet():
    """Get Fernet instance for credential decryption."""
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    
    key_source = os.getenv("CREDENTIAL_ENCRYPTION_KEY") or os.getenv("JWT_SECRET", "")
    if not key_source:
        return None
    
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"iot-query-probe-v2-salt",
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(key_source.encode()))
    return Fernet(key)


def _decrypt_credentials(encoded: str) -> Optional[dict]:
    """Decrypt credentials from storage."""
    fernet = _get_fernet()
    if not fernet:
        return None
    try:
        return json.loads(fernet.decrypt(encoded.encode()).decode())
    except Exception:
        return None


def get_credentials() -> Optional[dict]:
    """
    Get credentials stored by auth_server when Navixy called /api/auth/login.
    
    Returns the most recent valid credentials, or None if not found.
    """
    add_debug_log("Checking for credentials...")
    
    if not CREDENTIALS_DIR.exists():
        add_debug_log(f"  Directory not found: {CREDENTIALS_DIR}")
        return None
    
    cred_files = list(CREDENTIALS_DIR.glob("creds_*.json"))
    add_debug_log(f"  Credential files: {len(cred_files)}")
    
    valid_credentials = []
    for cred_file in cred_files:
        try:
            with open(cred_file, "r") as f:
                stored = json.load(f)
            
            if "data" in stored and "version" in stored:
                cred = _decrypt_credentials(stored["data"])
                if cred is None:
                    continue
                
                expires_at = datetime.fromisoformat(cred["expires_at"])
                if datetime.utcnow() <= expires_at:
                    valid_credentials.append(cred)
                else:
                    # Remove expired
                    cred_file.unlink(missing_ok=True)
        except Exception:
            continue
    
    if valid_credentials:
        # Return most recent
        add_debug_log(f"  ✓ Found {len(valid_credentials)} valid credential(s)")
        return valid_credentials[-1]
    
    add_debug_log("  No valid credentials found")
    return None


def check_auth_server() -> dict:
    """Check if auth server is running."""
    import urllib.request
    import urllib.error
    
    try:
        req = urllib.request.Request("http://127.0.0.1:8001/api/auth/status")
        with urllib.request.urlopen(req, timeout=3) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        return {"error": str(e)[:50]}


def initialize_auth():
    """
    Initialize authentication by reading credentials stored by auth_server.
    
    Flow:
    1. User accesses app via Navixy: 
       https://dashboard.tools.datahub.navixy.com/?session_key=XXX&target=YOUR_APP
    2. Navixy validates session_key and calls /api/auth/login with credentials
    3. auth_server stores encrypted credentials
    4. This function reads those credentials and connects to database
    
    Note: No session_key needed in app URL - Navixy handles authentication!
    """
    add_debug_log("=" * 40)
    add_debug_log("AUTHENTICATION CHECK")
    add_debug_log("=" * 40)
    
    # Check if already connected
    if st.session_state.get("connected") and st.session_state.get("db_url"):
        add_debug_log("Already connected ✓")
        return
    
    # Check auth server
    add_debug_log("")
    add_debug_log("Step 1: Auth server status")
    auth_status = check_auth_server()
    if "error" not in auth_status:
        add_debug_log(f"  ✓ Running")
        add_debug_log(f"  Active sessions: {auth_status.get('active_sessions', 0)}")
    else:
        add_debug_log(f"  ⚠️ {auth_status.get('error', 'unavailable')}")
    
    # Get credentials
    add_debug_log("")
    add_debug_log("Step 2: Check credentials")
    creds = get_credentials()
    
    if creds:
        add_debug_log("")
        add_debug_log("Step 3: Credentials FOUND!")
        email = creds.get("email", "unknown")
        masked_email = f"{email[:3]}***@***" if '@' in email else f"{email[:3]}***"
        add_debug_log(f"  Email: {masked_email}")
        add_debug_log(f"  Role: {creds.get('role', 'unknown')}")
        
        st.session_state["auth_user"] = {
            "email": creds.get("email"),
            "role": creds.get("role", "user")
        }
        st.session_state["db_url"] = creds.get("iot_db_url")
        st.session_state["user_db_url"] = creds.get("user_db_url")
        
        # Test database connection
        add_debug_log("")
        add_debug_log("Step 4: Connect to database")
        try:
            db_url = st.session_state["db_url"]
            parsed = urlparse(db_url)
            add_debug_log(f"  Host: ***")
            add_debug_log(f"  Port: {parsed.port or 5432}")
            add_debug_log(f"  Connecting...")
            
            conn = get_connection(db_url)
            conn.close()
            st.session_state["connected"] = True
            add_debug_log("  ✓ SUCCESS!")
        except Exception as e:
            st.session_state["connected"] = False
            add_debug_log(f"  ❌ Failed: {type(e).__name__}")
    else:
        add_debug_log("")
        add_debug_log("No credentials yet.")
        add_debug_log("")
        add_debug_log("Access this app through Navixy:")
        add_debug_log(f"  {NAVIXY_MIDDLEWARE_URL}/")
        add_debug_log(f"    ?session_key=YOUR_KEY")
        add_debug_log(f"    &target={APP_URL}")
        st.session_state["connected"] = False


# =============================================================================
# QUERY VALIDATION
# =============================================================================
def validate_query(query: str) -> tuple[bool, str]:
    """Basic query validation."""
    if not query or not query.strip():
        return False, "Query cannot be empty"
    return True, ""


def sanitize_error(error: Exception) -> str:
    """Sanitize error message to avoid leaking sensitive information."""
    error_str = str(error)
    error_str = re.sub(r'postgresql://[^\s]+', 'postgresql://***', error_str)
    error_str = re.sub(r'password[=:][^\s,]+', 'password=***', error_str, flags=re.IGNORECASE)
    error_str = re.sub(r'host[=:][^\s,]+', 'host=***', error_str, flags=re.IGNORECASE)
    error_str = re.sub(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', '***.***.***.***', error_str)
    if len(error_str) > 200:
        error_str = error_str[:200] + "..."
    return error_str


# =============================================================================
# DATABASE CONNECTION
# =============================================================================
def get_connection(db_url: str):
    """Create database connection with pg8000."""
    import pg8000.native
    import ssl
    
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
        timeout=QUERY_TIMEOUT_MS // 1000
    )


def execute_query(db_url: str, query: str) -> pd.DataFrame:
    """Execute SQL query and return DataFrame."""
    is_valid, error_msg = validate_query(query)
    if not is_valid:
        raise ValueError(error_msg)
    
    conn = get_connection(db_url)
    try:
        conn.run(f"SET statement_timeout = '{QUERY_TIMEOUT_MS}'")
        conn.run("SET lock_timeout = '5000'")
        
        result = conn.run(query)
        columns = [col['name'] for col in conn.columns] if conn.columns else []
        
        if result and columns:
            df = pd.DataFrame(result, columns=columns)
            return df.head(MAX_ROWS)
        return pd.DataFrame()
    finally:
        conn.close()


# =============================================================================
# EXPORT FUNCTIONS
# =============================================================================
def generate_excel(df: pd.DataFrame) -> bytes:
    """Generate Excel file from DataFrame."""
    output = io.BytesIO()
    export_df = df.head(MAX_EXPORT_ROWS).copy()
    
    for col in export_df.columns:
        if pd.api.types.is_datetime64_any_dtype(export_df[col]):
            if export_df[col].dt.tz is not None:
                export_df[col] = export_df[col].dt.tz_localize(None)
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        export_df.to_excel(writer, index=False, sheet_name='Data')
    
    return output.getvalue()


def generate_html_report(df: pd.DataFrame, chart_fig=None, map_fig=None, 
                         report_name: str = "Data Report", description: str = "") -> str:
    """Generate minimal print-friendly HTML report."""
    
    def escape(text):
        return html.escape(str(text))
    
    table_rows = []
    table_rows.append('<tr>' + ''.join(f'<th>{escape(c)}</th>' for c in df.columns) + '</tr>')
    for _, row in df.head(500).iterrows():
        table_rows.append('<tr>' + ''.join(f'<td>{escape(v)}</td>' for v in row) + '</tr>')
    
    table_html = f'<table>{"".join(table_rows)}</table>'
    
    chart_html = ""
    if chart_fig:
        fig_dict = copy.deepcopy(chart_fig.to_dict())
        chart_fig_print = go.Figure(fig_dict)
        chart_fig_print.update_layout(
            paper_bgcolor='white', plot_bgcolor='white',
            font=dict(color='black'), title_font=dict(color='black'),
            xaxis=dict(color='black', gridcolor='#ddd', linecolor='#333'),
            yaxis=dict(color='black', gridcolor='#ddd', linecolor='#333'),
            legend=dict(font=dict(color='black'))
        )
        chart_html = f'<div class="section section-chart"><h2>Chart</h2>{chart_fig_print.to_html(full_html=False, include_plotlyjs="cdn")}</div>'
    
    map_html = ""
    if map_fig:
        map_fig.update_layout(mapbox_style="carto-positron", paper_bgcolor='white')
        map_html = f'<div class="section section-map"><h2>Map</h2>{map_fig.to_html(full_html=False, include_plotlyjs="cdn")}</div>'
    
    timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')
    desc_html = f'<div class="description">{escape(description)}</div>' if description else ""
    
    return f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{escape(report_name)}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; padding: 15px; margin: 0; background: #fff; color: #000; }}
        h1 {{ font-size: 16px; margin: 0 0 5px 0; }}
        h2 {{ font-size: 13px; margin: 10px 0 8px 0; padding-bottom: 5px; border-bottom: 1px solid #ddd; }}
        .header {{ page-break-after: avoid; }}
        .meta {{ color: #333; margin-bottom: 5px; }}
        .description {{ margin-bottom: 10px; padding: 8px; background: #f9f9f9; border-left: 3px solid #ddd; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 10px; }}
        th, td {{ padding: 4px 6px; border: 1px solid #ddd; text-align: left; }}
        th {{ background: #f5f5f5; font-weight: 600; }}
        tr:nth-child(even) {{ background: #fafafa; }}
        .section {{ margin: 15px 0; }}
        @media print {{ body {{ font-size: 9px; padding: 0; }} table {{ font-size: 8px; }} }}
        @page {{ margin: 1cm; size: A4 landscape; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{escape(report_name)}</h1>
        <div class="meta">Generated: {timestamp} | Rows: {len(df):,}</div>
        {desc_html}
    </div>
    <div class="section"><h2>Data</h2>{table_html}</div>
    {chart_html}
    {map_html}
</body>
</html>'''


# =============================================================================
# SIDEBAR
# =============================================================================
def render_sidebar():
    """Render sidebar with user info and connection status."""
    with st.sidebar:
        auth_user = st.session_state.get("auth_user")
        connected = st.session_state.get("connected", False)
        
        if auth_user and connected:
            st.markdown("### ✅ Connected")
            
            email = auth_user.get("email", "Unknown")
            role = auth_user.get("role", "user")
            
            # Mask email
            if '@' in email:
                local, domain = email.split('@', 1)
                masked_email = f"{local[:2]}***@{domain}"
            else:
                masked_email = email[:3] + "***" if len(email) > 3 else "***"
            
            st.markdown(f'''
            <div class="user-card">
                <div class="user-email">{html.escape(masked_email)}</div>
                <div class="user-role">Role: {html.escape(role)}</div>
                <div class="connection-status">
                    <span class="status-dot connected"></span>
                    <span>Connected to IoT Database</span>
                </div>
            </div>
            ''', unsafe_allow_html=True)
            
            st.caption("Authenticated via Navixy App Connect")
            
        else:
            st.markdown("### 🔐 Authentication Required")
            
            st.markdown(
                "This app requires authentication through **Navixy App Connect**.\n\n"
                "Database credentials are provided automatically after authentication."
            )
            
            # Show link to access through Navixy
            st.markdown("#### Access through Navixy:")
            st.code(
                f"{NAVIXY_MIDDLEWARE_URL}/\n"
                f"  ?session_key=YOUR_SESSION_KEY\n"
                f"  &target={APP_URL}",
                language=None
            )
            
            st.markdown(
                f'<a href="{NAVIXY_MIDDLEWARE_URL}/?target={APP_URL}" target="_blank" class="navixy-link">'
                f'Open via Navixy →</a>',
                unsafe_allow_html=True
            )
            
            st.markdown("---")
            
            if st.button("🔄 Refresh", type="primary"):
                st.session_state["connected"] = False
                st.session_state["debug_logs"] = []
                st.rerun()
        
        # Debug panel
        st.markdown("---")
        with st.expander("🔍 Debug Logs", expanded=not connected):
            logs = get_debug_logs()
            if logs:
                st.code("\n".join(logs[-20:]), language=None)
            else:
                st.caption("No logs yet")
            
            if st.button("Clear"):
                st.session_state["debug_logs"] = []
                st.rerun()


# =============================================================================
# MAIN CONTENT
# =============================================================================
def render_sql_editor():
    """Render SQL query editor."""
    st.markdown("## SQL Editor")
    
    if not st.session_state.get("connected"):
        st.info(
            "**Waiting for authentication...**\n\n"
            "Please access this application through Navixy App Connect to authenticate and receive database credentials."
        )
        
        st.markdown(
            f"**Access URL:** `{NAVIXY_MIDDLEWARE_URL}/?session_key=YOUR_KEY&target={APP_URL}`"
        )
        return
    
    default_query = st.session_state.get("sql_query", "SELECT * FROM table_name LIMIT 100;")
    
    query = st.text_area(
        "Query",
        value=default_query,
        height=120,
        key="sql_input",
        label_visibility="collapsed"
    )
    
    col1, col2 = st.columns([1, 5])
    with col1:
        execute_btn = st.button("Execute", type="primary")
    with col2:
        if st.button("Clear"):
            st.session_state["query_result"] = None
            st.session_state["sql_query"] = ""
            st.rerun()
    
    if execute_btn and query:
        with st.spinner("Executing..."):
            try:
                db_url = st.session_state.get("db_url")
                start_time = datetime.now()
                df = execute_query(db_url, query)
                duration = (datetime.now() - start_time).total_seconds() * 1000
                
                st.session_state["query_result"] = df
                st.session_state["sql_query"] = query
                
                st.markdown(f"""
                <div class="success-msg">
                    Query executed successfully. 
                    Rows: {len(df):,} | Columns: {len(df.columns)} | Time: {duration:.0f}ms
                </div>
                """, unsafe_allow_html=True)
                
            except Exception as e:
                st.markdown(f"""
                <div class="error-msg">
                    Error: {sanitize_error(e)}
                </div>
                """, unsafe_allow_html=True)


def render_data_table():
    """Render data table with Excel export."""
    df = st.session_state.get("query_result")
    
    if df is None or df.empty:
        return
    
    st.markdown("---")
    st.markdown("## Data Table")
    
    with st.expander("Filters"):
        filter_cols = st.multiselect("Filter columns", options=df.columns.tolist())
        filters = {}
        for col in filter_cols:
            unique_vals = df[col].dropna().unique().tolist()[:50]
            selected = st.multiselect(f"{col}", unique_vals, key=f"filter_{col}")
            if selected:
                filters[col] = selected
    
    filtered_df = df.copy()
    for col, vals in filters.items():
        filtered_df = filtered_df[filtered_df[col].isin(vals)]
    
    st.session_state["filtered_df"] = filtered_df
    
    col1, col2, col3 = st.columns(3)
    col1.metric("Rows", f"{len(filtered_df):,}")
    col2.metric("Columns", len(filtered_df.columns))
    col3.metric("Filtered", "Yes" if filters else "No")
    
    st.dataframe(filtered_df, use_container_width=True, height=600)
    
    excel_data = generate_excel(filtered_df)
    st.download_button(
        label="Download Excel",
        data=excel_data,
        file_name=f"data_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


def render_chart():
    """Render chart section."""
    df = st.session_state.get("filtered_df")
    
    if df is None or df.empty:
        return
    
    st.markdown("---")
    st.markdown("## Chart")
    
    all_cols = df.columns.tolist()
    if not all_cols:
        return
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        x_axis = st.selectbox("X-axis", options=all_cols, key="chart_x")
    with col2:
        y_axis = st.selectbox("Y-axis", options=all_cols, key="chart_y")
    with col3:
        color_by = st.selectbox("Color by", options=["None"] + all_cols, key="chart_color")
    
    if st.button("Generate Chart"):
        try:
            color = None if color_by == "None" else color_by
            fig = px.line(df, x=x_axis, y=y_axis, color=color,
                         title=f"{y_axis} over {x_axis}", template="plotly_white")
            fig.update_layout(margin=dict(l=40, r=40, t=40, b=40))
            st.session_state["current_chart"] = fig
            st.plotly_chart(fig, use_container_width=True)
        except Exception as e:
            st.error(f"Chart error: {sanitize_error(e)}")
    elif "current_chart" in st.session_state:
        st.plotly_chart(st.session_state["current_chart"], use_container_width=True)


def calculate_map_zoom(lat_min, lat_max, lon_min, lon_max):
    """Calculate appropriate zoom level based on coordinate bounds."""
    max_span = max(lat_max - lat_min, lon_max - lon_min)
    zoom_levels = [
        (100, 1), (50, 2), (20, 3), (10, 4), (5, 5), (2, 6),
        (1, 7), (0.5, 8), (0.2, 9), (0.1, 10), (0.05, 11), (0.01, 12)
    ]
    for threshold, zoom in zoom_levels:
        if max_span > threshold:
            return zoom
    return 13


def render_map():
    """Render map section."""
    df = st.session_state.get("filtered_df")
    
    if df is None or df.empty:
        return
    
    st.markdown("---")
    st.markdown("## Map")
    
    all_cols = df.columns.tolist()
    
    lat_patterns = ['lat', 'latitude', 'y']
    lon_patterns = ['lon', 'lng', 'longitude', 'x']
    
    detected_lat = next((c for c in all_cols if any(p in c.lower() for p in lat_patterns)), all_cols[0] if all_cols else None)
    detected_lon = next((c for c in all_cols if any(p in c.lower() for p in lon_patterns)), all_cols[0] if all_cols else None)
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        lat_idx = all_cols.index(detected_lat) if detected_lat in all_cols else 0
        lat_col = st.selectbox("Latitude", options=all_cols, index=lat_idx, key="map_lat")
    with col2:
        lon_idx = all_cols.index(detected_lon) if detected_lon in all_cols else 0
        lon_col = st.selectbox("Longitude", options=all_cols, index=lon_idx, key="map_lon")
    with col3:
        color_col = st.selectbox("Color by", options=["None"] + all_cols, key="map_color")
    
    if st.button("Generate Map"):
        try:
            map_df = df.copy()
            map_df[lat_col] = pd.to_numeric(map_df[lat_col], errors='coerce')
            map_df[lon_col] = pd.to_numeric(map_df[lon_col], errors='coerce')
            map_df = map_df.dropna(subset=[lat_col, lon_col])
            
            if len(map_df) > 5000:
                map_df = map_df.sample(n=5000, random_state=42)
                st.warning("Sampled to 5,000 points for performance.")
            
            if len(map_df) == 0:
                st.warning("No valid coordinates found.")
                return
            
            lat_min, lat_max = map_df[lat_col].min(), map_df[lat_col].max()
            lon_min, lon_max = map_df[lon_col].min(), map_df[lon_col].max()
            center_lat, center_lon = (lat_min + lat_max) / 2, (lon_min + lon_max) / 2
            zoom = calculate_map_zoom(lat_min, lat_max, lon_min, lon_max)
            
            color = None if color_col == "None" else color_col
            fig = px.scatter_mapbox(map_df, lat=lat_col, lon=lon_col, color=color,
                                   zoom=zoom, center={"lat": center_lat, "lon": center_lon},
                                   height=500, mapbox_style="carto-positron")
            
            if color:
                fig.update_layout(
                    margin={"r": 0, "t": 30, "l": 0, "b": 0},
                    legend=dict(title=dict(text=color_col), bgcolor="rgba(255,255,255,0.9)",
                               yanchor="top", y=0.99, xanchor="left", x=0.01)
                )
            else:
                fig.update_layout(margin={"r": 0, "t": 0, "l": 0, "b": 0})
            
            st.session_state["current_map"] = fig
            st.plotly_chart(fig, use_container_width=True)
            
        except Exception as e:
            st.error(f"Map error: {sanitize_error(e)}")
    elif "current_map" in st.session_state:
        st.plotly_chart(st.session_state["current_map"], use_container_width=True)


def render_html_export():
    """Render HTML report export button."""
    df = st.session_state.get("filtered_df")
    
    if df is None or df.empty:
        return
    
    st.markdown("---")
    st.markdown("## Export Report")
    
    col1, col2 = st.columns(2)
    with col1:
        report_name = st.text_input("Report Name", value="Data Report", key="report_name_input")
    with col2:
        report_desc = st.text_input("Description (optional)", key="report_desc_input")
    
    final_report_name = report_name.strip() or "Data Report"
    chart_fig = st.session_state.get("current_chart")
    map_fig = st.session_state.get("current_map")
    
    safe_filename = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in final_report_name)
    safe_filename = safe_filename.strip().replace(' ', '_')[:50] or "report"
    
    html_report = generate_html_report(df, chart_fig, map_fig, 
                                       report_name=final_report_name,
                                       description=report_desc.strip() if report_desc else "")
    
    st.download_button(
        label="Download HTML Report",
        data=html_report,
        file_name=f"{safe_filename}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html",
        mime="text/html"
    )


# =============================================================================
# MAIN
# =============================================================================
def main():
    st.markdown("# 📊 IoT Query Probe")
    
    if "connected" not in st.session_state:
        st.session_state["connected"] = False
    
    initialize_auth()
    
    render_sidebar()
    render_sql_editor()
    render_data_table()
    render_chart()
    render_map()
    render_html_export()


if __name__ == "__main__":
    main()
