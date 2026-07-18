"""
NimbusCloud Suite — Task 1: Data Redundancy Removal System
Configuration module.

By default the app runs on a local SQLite file (nimbuscloud.db) so it works
out of the box with zero setup. To point it at PostgreSQL instead, set the
DATABASE_URL environment variable, e.g.:

    export DATABASE_URL="postgresql://user:password@localhost:5432/nimbuscloud"

No code changes are required to switch — SQLAlchemy handles both engines.
"""

import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "nimbuscloud-dev-secret-change-in-production")

    # Default: local SQLite file. Override with DATABASE_URL for PostgreSQL.
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'nimbuscloud.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # Default matching configuration (can be changed live from the UI).
    DEFAULT_SIMILARITY_THRESHOLD = 85.0  # percent
    MAX_RECORDS_PER_UPLOAD = 20000
    RECORDS_PAGE_SIZE = 25
    ACTIVITY_PAGE_SIZE = 40

    JSON_SORT_KEYS = False
