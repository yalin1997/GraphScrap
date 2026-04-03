from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_db, Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend import database
import os

TEST_DB_PATH = "sqlite:///./test_api.db"
if os.path.exists("./test_api.db"):
    os.remove("./test_api.db")

engine = create_engine(TEST_DB_PATH, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
database.engine = engine

from backend.models import NodeModel, EdgeModel

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
Base.metadata.create_all(bind=engine)

client = TestClient(app)

def test_read_nodes():
    response = client.get("/nodes")
    assert response.status_code == 200
    assert type(response.json()) == list
