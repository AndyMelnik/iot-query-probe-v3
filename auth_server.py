"""
Auth Server for Navixy App Connect Integration

Implements the /api/auth/login endpoint required by Navixy App Connect middleware.
Runs as a FastAPI server that can be started alongside the Streamlit app.

Navixy App Connect Flow:
1. User accesses: https://dashboard.tools.datahub.navixy.com/?session_key=XXX&target=YOUR_APP
2. Navixy validates session_key
3. Navixy calls POST /api/auth/login with { email, iotDbUrl, userDbUrl, role }
4. This server stores credentials and returns JWT
5. Streamlit app reads stored credentials
"""

import os
import json
import uuid
import secrets
import hashlib
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager
import time
import base64

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator
import jwt

# Import API routes
from api.routes import router as api_router

# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

# JWT Configuration - used for signing tokens
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    JWT_SECRET = secrets.token_hex(32)
    logger.warning(
        "JWT_SECRET not set! Using randomly generated secret. "
        "Set JWT_SECRET environment variable in production."
    )

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))

# Credential storage path
CREDENTIALS_DIR = Path(os.getenv("CREDENTIALS_DIR", "/tmp/iot-query-probe"))
CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)

try:
    CREDENTIALS_DIR.chmod(0o700)
except OSError:
    logger.warning(f"Could not set permissions on credentials directory")

# Rate limiting configuration
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))

# =============================================================================
# ENCRYPTION
# =============================================================================
_fernet = None

def _get_fernet():
    """Get Fernet instance for credential encryption."""
    global _fernet
    if _fernet is not None:
        return _fernet
    
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    
    key_source = os.getenv("CREDENTIAL_ENCRYPTION_KEY") or JWT_SECRET
    
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"iot-query-probe-v2-salt",
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(key_source.encode()))
    _fernet = Fernet(key)
    return _fernet

# =============================================================================
# RATE LIMITING
# =============================================================================
_rate_limit_store: dict[str, list[float]] = {}

def check_rate_limit(client_ip: str) -> bool:
    """Check if client has exceeded rate limit. Returns True if allowed."""
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW
    
    if client_ip in _rate_limit_store:
        _rate_limit_store[client_ip] = [
            t for t in _rate_limit_store[client_ip] if t > window_start
        ]
    else:
        _rate_limit_store[client_ip] = []
    
    if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
        return False
    
    _rate_limit_store[client_ip].append(now)
    return True

# =============================================================================
# MODELS
# =============================================================================

class AuthLoginRequest(BaseModel):
    """Request body for /api/auth/login endpoint (Navixy App Connect contract)."""
    email: str
    iotDbUrl: str
    userDbUrl: str
    role: str = "admin"
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not v or '@' not in v or len(v) > 254:
            raise ValueError('Invalid email format')
        return v.lower().strip()
    
    @field_validator('iotDbUrl', 'userDbUrl')
    @classmethod
    def validate_db_url(cls, v: str) -> str:
        if not v or not v.startswith('postgresql://'):
            raise ValueError('Invalid PostgreSQL connection URL')
        return v
    
    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed_roles = {'admin', 'user', 'viewer', 'analyst'}
        v = v.lower().strip()
        if v not in allowed_roles:
            return 'admin'  # Default per Navixy docs
        return v


class AuthLoginResponse(BaseModel):
    """Response body for successful authentication (Navixy App Connect contract)."""
    success: bool
    user: dict
    token: str


# =============================================================================
# CREDENTIAL STORAGE
# =============================================================================

def _get_credential_path(email: str) -> Path:
    """Get the path for storing credentials for a specific user."""
    email_hash = hashlib.sha256(email.lower().strip().encode()).hexdigest()
    return CREDENTIALS_DIR / f"creds_{email_hash}.json"


def _encrypt_credentials(data: dict) -> str:
    """Encrypt credentials for secure storage."""
    fernet = _get_fernet()
    return fernet.encrypt(json.dumps(data).encode()).decode()


def _decrypt_credentials(encoded: str) -> dict:
    """Decrypt credentials from storage."""
    fernet = _get_fernet()
    return json.loads(fernet.decrypt(encoded.encode()).decode())


def store_credentials(user_id: str, email: str, iot_db_url: str, user_db_url: str, role: str) -> None:
    """Store database credentials for a user session."""
    cred_path = _get_credential_path(email)
    
    credentials = {
        "user_id": user_id,
        "email": email.lower().strip(),
        "iot_db_url": iot_db_url,
        "user_db_url": user_db_url,
        "role": role,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": (datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)).isoformat()
    }
    
    encoded_data = {
        "email_hash": hashlib.sha256(email.lower().strip().encode()).hexdigest(),
        "data": _encrypt_credentials(credentials),
        "version": 2
    }
    
    temp_path = cred_path.with_suffix(".tmp")
    with open(temp_path, "w") as f:
        json.dump(encoded_data, f)
    
    try:
        temp_path.chmod(0o600)
    except OSError:
        pass
    
    temp_path.rename(cred_path)
    logger.info(f"Credentials stored for user")


def get_credentials(email: str) -> Optional[dict]:
    """Retrieve stored credentials for a user."""
    cred_path = _get_credential_path(email)
    
    if not cred_path.exists():
        return None
    
    try:
        with open(cred_path, "r") as f:
            stored = json.load(f)
        
        expected_hash = hashlib.sha256(email.lower().strip().encode()).hexdigest()
        if stored.get("email_hash") != expected_hash:
            logger.warning("Email hash mismatch for credential file")
            return None
        
        credentials = _decrypt_credentials(stored["data"])
        
        expires_at = datetime.fromisoformat(credentials["expires_at"])
        if datetime.utcnow() > expires_at:
            cred_path.unlink(missing_ok=True)
            return None
        
        return credentials
    except Exception as e:
        logger.warning(f"Failed to read credentials: {type(e).__name__}")
        return None


def clear_credentials(email: str) -> None:
    """Clear stored credentials for a user."""
    cred_path = _get_credential_path(email)
    cred_path.unlink(missing_ok=True)


# =============================================================================
# JWT TOKEN MANAGEMENT
# =============================================================================

def generate_jwt_token(user_id: str, email: str, role: str) -> str:
    """
    Generate a JWT token for the authenticated user.
    
    Per Navixy App Connect contract:
    - userId, email, role, iat, exp are required
    - Use HS256 algorithm
    - 24 hour expiration recommended
    """
    now = datetime.utcnow()
    
    payload = {
        "userId": user_id,
        "email": email.lower().strip(),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=JWT_EXPIRATION_HOURS)).timestamp())
    }
    
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def validate_jwt_token(token: str) -> Optional[dict]:
    """Validate a JWT token and return the payload."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


# =============================================================================
# FASTAPI APPLICATION
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for FastAPI app."""
    logger.info("=" * 50)
    logger.info("Auth Server Starting")
    logger.info("=" * 50)
    logger.info(f"Credentials directory: {CREDENTIALS_DIR}")
    logger.info(f"JWT expiration: {JWT_EXPIRATION_HOURS} hours")
    if not os.getenv("JWT_SECRET"):
        logger.warning("Using temporary JWT secret - set JWT_SECRET env var in production")
    logger.info("Ready to receive auth requests from Navixy App Connect")
    logger.info("=" * 50)
    yield
    logger.info("Auth server shutting down")


app = FastAPI(
    title="IoT Query Probe Auth Server",
    description="Authentication endpoint for Navixy App Connect integration",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if os.getenv("ENABLE_DOCS", "false").lower() == "true" else None,
    redoc_url=None,
    openapi_url="/openapi.json" if os.getenv("ENABLE_DOCS", "false").lower() == "true" else None
)

# CORS configuration
# In production, restrict to specific origins
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Include API routes for report builder
app.include_router(api_router)


@app.middleware("http")
async def request_middleware(request: Request, call_next):
    """Log requests and add security headers."""
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
    client_ip = client_ip.split(",")[0].strip()
    
    # Log all requests (except health checks)
    if request.url.path != "/health":
        logger.info(f"[REQUEST] {request.method} {request.url.path} from {client_ip}")
        
        if request.url.path == "/api/auth/login":
            logger.info(f"  Content-Type: {request.headers.get('Content-Type', 'not set')}")
            logger.info(f"  User-Agent: {request.headers.get('User-Agent', 'not set')[:50]}")
    
    # Rate limiting for all API endpoints
    if request.url.path.startswith("/api"):
        if not check_rate_limit(client_ip):
            logger.warning(f"Rate limit exceeded for {client_ip}")
            return JSONResponse(
                status_code=429,
                content={"success": False, "error": "Rate limit exceeded. Try again later."}
            )
    
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    # Frame ancestors - allow embedding from Navixy dashboard
    # Configurable via FRAME_ANCESTORS env var
    frame_ancestors = os.getenv("FRAME_ANCESTORS", "'self' https://dashboard.tools.datahub.navixy.com https://*.navixy.com")
    response.headers["Content-Security-Policy"] = f"frame-ancestors {frame_ancestors}"
    
    return response


@app.post("/api/auth/login", response_model=AuthLoginResponse)
async def auth_login(request: Request, body: AuthLoginRequest):
    """
    Handle authentication requests from Navixy App Connect middleware.
    
    This endpoint receives:
    - email: User's email from Navixy session
    - iotDbUrl: PostgreSQL connection string for IoT database
    - userDbUrl: PostgreSQL connection string for user database
    - role: User role (default: admin)
    
    Returns:
    - success: true
    - user: { id, email, role }
    - token: JWT token
    """
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
    client_ip = client_ip.split(",")[0].strip()
    
    logger.info("=" * 50)
    logger.info("AUTH LOGIN REQUEST FROM NAVIXY")
    logger.info("=" * 50)
    logger.info(f"Client IP: {client_ip}")
    logger.info(f"Email: {body.email[:3]}***@{body.email.split('@')[1] if '@' in body.email else '***'}")
    logger.info(f"Role: {body.role}")
    logger.info(f"Has iotDbUrl: {bool(body.iotDbUrl)}")
    logger.info(f"Has userDbUrl: {bool(body.userDbUrl)}")
    
    # Generate or reuse user ID
    user_id = str(uuid.uuid4())
    existing_creds = get_credentials(body.email)
    if existing_creds:
        user_id = existing_creds["user_id"]
        logger.info("Using existing user ID")
    else:
        logger.info("Created new user ID")
    
    # Store credentials for Streamlit app to use
    store_credentials(
        user_id=user_id,
        email=body.email,
        iot_db_url=body.iotDbUrl,
        user_db_url=body.userDbUrl,
        role=body.role
    )
    
    # Generate JWT token
    token = generate_jwt_token(user_id, body.email, body.role)
    
    logger.info("=" * 50)
    logger.info("AUTH LOGIN SUCCESS")
    logger.info("=" * 50)
    
    return AuthLoginResponse(
        success=True,
        user={
            "id": user_id,
            "email": body.email,
            "role": body.role
        },
        token=token
    )


@app.get("/api/auth/status")
async def auth_status(authorization: Optional[str] = Header(None)):
    """Check authentication status and server info."""
    # Count active credential files
    active_sessions = 0
    try:
        for cred_file in CREDENTIALS_DIR.glob("creds_*.json"):
            try:
                with open(cred_file, "r") as f:
                    stored = json.load(f)
                if "data" in stored and "version" in stored:
                    creds = _decrypt_credentials(stored["data"])
                    if creds:
                        expires_at = datetime.fromisoformat(creds["expires_at"])
                        if datetime.utcnow() <= expires_at:
                            active_sessions += 1
            except:
                pass
    except:
        pass
    
    result = {
        "status": "running",
        "credentials_dir": str(CREDENTIALS_DIR),
        "credentials_dir_exists": CREDENTIALS_DIR.exists(),
        "active_sessions": active_sessions,
        "jwt_secret_configured": bool(os.getenv("JWT_SECRET"))
    }
    
    # Validate token if provided
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        payload = validate_jwt_token(token)
        
        if payload:
            result["authenticated"] = True
            result["user"] = {
                "id": payload.get("userId"),
                "email": payload.get("email"),
                "role": payload.get("role")
            }
        else:
            result["authenticated"] = False
            result["token_error"] = "Invalid or expired token"
    else:
        result["authenticated"] = False
    
    return result


@app.post("/api/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    """Clear stored credentials for the authenticated user."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        payload = validate_jwt_token(token)
        if payload and payload.get("email"):
            clear_credentials(payload["email"])
            logger.info(f"Logout for user: {payload['email'][:3]}***")
    
    return {"success": True, "message": "Logged out successfully"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "iot-query-probe-auth"}


@app.get("/redirect")
async def redirect_to_app():
    """
    Redirect endpoint - use this to redirect from Navixy to direct app URL.
    
    After Navixy authenticates, it can redirect to /redirect
    which will then redirect to the main app root.
    """
    from fastapi.responses import RedirectResponse
    # Redirect to root of current host
    return RedirectResponse(url="/", status_code=302)


# =============================================================================
# SERVER RUNNER
# =============================================================================

def run_auth_server(host: str = "0.0.0.0", port: int = 8000):
    """Run the auth server."""
    import uvicorn
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    run_auth_server()
