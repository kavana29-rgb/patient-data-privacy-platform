# Compatibility bridge for app modules importing database utilities
from database import Base, engine, get_db, SessionLocal

__all__ = ["Base", "engine", "get_db", "SessionLocal"]
