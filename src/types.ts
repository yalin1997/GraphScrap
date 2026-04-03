export type NodeType = "Evidence" | "Hypothesis" | "DiagnosticAction";

export interface Node {
  id: string;
  label: string;
  type: NodeType;
  snippet_ids: string[];
  status?: "active" | "inactive";
  // For force graph
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  relation: "Support" | "Check" | "Find";
  evidence: string;
  snippet_id: string;
  condition_group_id?: string;
  logic_desc?: string;
}

export interface Snippet {
  id: string;
  text: string;
  timestamp: number;
  isDirty?: boolean;
}

export interface GraphData {
  nodes: Node[];
  links: Edge[];
}
