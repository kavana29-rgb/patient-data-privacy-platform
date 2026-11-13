import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Ensure backend root is on python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import database
import models

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Escape % for configparser interpolation if setting in config
if database.DATABASE_URL:
    escaped_url = database.DATABASE_URL.replace("%", "%%")
    config.set_main_option("sqlalchemy.url", escaped_url)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here for 'autogenerate' support
target_metadata = database.Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = database.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Use existing database engine from database.py
    connectable = database.engine

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
