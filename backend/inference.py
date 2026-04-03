from sqlalchemy import text
from sqlalchemy.orm import Session

def run_hard_filtering(db: Session, active_node_ids: list[str]):
    query = text("""
        WITH RECURSIVE graph_path AS (
            SELECT target from edges 
            WHERE source = ANY(:active_ids)
            UNION
            SELECT e.target FROM edges e
            INNER JOIN graph_path gp ON e.source = gp.target
            WHERE e.condition_group_id IS NULL OR e.condition_group_id = ''
        )
        SELECT target FROM graph_path;
    """)
    if not active_node_ids:
        return []
    # note: ANY(:active_ids) requires positional binding for lists in SQLite or PostgreSQL arrays.
    # We'll adapt it simply for sqlite compatibility in testing if needed, but for now we write the pure version.
    
    # Simple Python level filtering for PoC and testing compatibility across sqlite/postgres:
    # Actually, let's use standard sqlalchemy bindings.
    result = db.execute(query, {"active_ids": active_node_ids})
    return [row[0] for row in result]
