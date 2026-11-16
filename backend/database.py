
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Locate .env in backend directory or root directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
backend_env = os.path.join(backend_dir, ".env")
root_env = os.path.join(os.path.dirname(backend_dir), ".env")

if os.path.exists(backend_env):
    load_dotenv(backend_env)
elif os.path.exists(root_env):
    load_dotenv(root_env)
else:
    load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing from .env")

connect_args = {"connect_timeout": 5} if "sqlite" not in DATABASE_URL else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
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
