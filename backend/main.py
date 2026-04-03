from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import database, models, schemas

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    database.Base.metadata.create_all(bind=database.engine)

@app.get("/nodes", response_model=list[schemas.NodeBase])
def get_nodes(db: Session = Depends(database.get_db)):
    return db.query(models.NodeModel).all()

@app.post("/nodes/toggle_active")
def toggle_node_active(node_id: str, active: bool, db: Session = Depends(database.get_db)):
    node = db.query(models.NodeModel).filter(models.NodeModel.id == node_id).first()
    if node:
        node.status = "active" if active else "inactive"
        db.commit()
    return {"status": "success", "node_id": node_id}
