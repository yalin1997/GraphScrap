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

from .inference import run_hard_filtering
import os
from google import genai

@app.post("/infer")
def run_inference(req: schemas.InferenceRequest, db: Session = Depends(database.get_db)):
    try:
        candidate_node_ids = run_hard_filtering(db, req.active_node_ids)
    except Exception as e:
        return {"result": f"Graph query error: {str(e)}", "candidates_evaluated": 0}
        
    if not candidate_node_ids:
        return {"result": "No valid hypotheses found via graph structure.", "candidates_evaluated": 0}

    # Gemini Soft Verification
    try:
        client = genai.Client() # Uses GEMINI_API_KEY from environment
        prompt = f"Perform soft verification on these active nodes: {req.active_node_ids} leading to candidates: {candidate_node_ids}. Evaluate truthfulness."
        
        response = client.models.generate_content(
            model="gemini-3.0-pro",
            contents=prompt
        )
        return {"result": response.text, "candidates_evaluated": len(candidate_node_ids)}
    except Exception as e:
        return {"result": f"Inference engine failure: {str(e)}"}
