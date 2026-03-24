export type NodeType = "Person" | "Organization" | "Location" | "Tech" | "Concept" | "Product" | "Event";

export interface Node {
  id: string;
  label: string;
  type: NodeType;
  snippet_ids: string[];
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
  relation: string;
  evidence: string;
  snippet_id: string;
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
