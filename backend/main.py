from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, patient, documents, sharing
from database import engine
import models

from app.modules.redaction.router import router as redaction_router

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Patient Data Privacy Platform",
    description="Healthcare data privacy and protection API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Module A routers
app.include_router(auth.router)
app.include_router(patient.router)
app.include_router(documents.router)
app.include_router(redaction_router)


# Register Module E - Secure Provider Sharing
app.include_router(sharing.router)

@app.get("/")
def home():
    return {
        "message": "Patient Data Privacy Platform API is running!"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
