from backend.schemas import NodeBase, EdgeBase

def test_node_schema_validation():
    node = NodeBase(id="e1", label="Ev1", type="Evidence", snippet_ids=["s1"])
    assert node.status == "inactive"
    assert node.type == "Evidence"

def test_edge_schema_validation():
    edge = EdgeBase(id="edge1", source="e1", target="h1", relation="Support", evidence="Text", snippet_id="s1")
    assert edge.relation == "Support"
    assert edge.condition_group_id is None
