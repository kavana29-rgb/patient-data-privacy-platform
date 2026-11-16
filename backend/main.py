import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine
import models

# Import all module routers
from routers import auth, patient, documents, sharing, audit
from app.modules.consent.router import router as consent_router
from app.modules.redaction.router import router as redaction_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Safe database table initialization on startup (skipped when running tests)
    import sys
    is_test = (
        "pytest" in sys.modules
        or os.environ.get("TESTING") == "1"
        or any("test" in arg.lower() for arg in sys.argv)
    )
    if not is_test:
        try:
            models.Base.metadata.create_all(bind=engine)
            logger.info("Database tables verified.")
        except Exception as e:
            logger.warning(f"Database table verification deferred: {e}")
    yield


app = FastAPI(
    title="MyMedData Platform API",
    description="MyMedData — Patient-Centric Medical Data Privacy Platform API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration supporting standard Vite and alternate local development origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Authentication & Patient Profile
app.include_router(auth.router)
app.include_router(patient.router)

# Medical Documents (accessible at /documents and /api/documents)
app.include_router(documents.router)
app.include_router(documents.router, prefix="/api")

# Consent Management
app.include_router(consent_router)

# PII Redaction
app.include_router(redaction_router)

# Secure Document Sharing & Provider Portal
app.include_router(sharing.router)

# Access History & Retention Audit
app.include_router(audit.router)


@app.get("/")
def home():
    return {
        "message": "MyMedData Platform API is running!"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
