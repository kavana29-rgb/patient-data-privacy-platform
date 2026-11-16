import os
from urllib.parse import quote_plus
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing from .env")

# Safely encode special characters (#, ,) in the password if pasted raw
if "://" in DATABASE_URL and "@" in DATABASE_URL:
    prefix, rest = DATABASE_URL.split("://", 1)
    creds, host_part = rest.rsplit("@", 1)
    if ":" in creds:
        user, pwd = creds.split(":", 1)
        if "#" in pwd or "," in pwd:
            DATABASE_URL = f"{prefix}://{user}:{quote_plus(pwd)}@{host_part}"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
