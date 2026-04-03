from pydantic import BaseModel
from typing import List, Optional

class NodeBase(BaseModel):
    id: str
    label: str
    type: str # Evidence | Hypothesis | DiagnosticAction
    snippet_ids: List[str]
    status: str = "inactive"

class EdgeBase(BaseModel):
    id: str
    source: str
    target: str
    relation: str # Support | Check | Find
    evidence: str
    snippet_id: str
    condition_group_id: Optional[str] = None
    logic_desc: Optional[str] = None

class InferenceRequest(BaseModel):
    active_node_ids: List[str]
