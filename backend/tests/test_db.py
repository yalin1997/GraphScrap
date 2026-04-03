from sqlalchemy import create_engine
import os

def test_db_configuration():
    from backend.database import DATABASE_URL
    assert "postgresql://" in DATABASE_URL
