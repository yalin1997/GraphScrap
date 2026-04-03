from sqlalchemy import Column, String, JSON, ForeignKey
from .database import Base

class NodeModel(Base):
    __tablename__ = "nodes"
    id = Column(String, primary_key=True)
    label = Column(String, nullable=False)
    type = Column(String, nullable=False)
    snippet_ids = Column(JSON, default=list)
    status = Column(String, default="inactive")

class EdgeModel(Base):
    __tablename__ = "edges"
    id = Column(String, primary_key=True)
    source = Column(String, ForeignKey("nodes.id"))
    target = Column(String, ForeignKey("nodes.id"))
    relation = Column(String, nullable=False)
    evidence = Column(String)
    snippet_id = Column(String)
    condition_group_id = Column(String, nullable=True)
    logic_desc = Column(String, nullable=True)
