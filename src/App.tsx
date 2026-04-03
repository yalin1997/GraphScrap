/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { GoogleGenAI, Type } from "@google/genai";
import {
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Database,
  ChevronRight,
  ChevronDown,
  Info,
  Edit3,
  Link as LinkIcon,
  Zap,
  Sparkles,
  PenLine,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { cn } from './lib/utils';
import { Node, Edge, Snippet, GraphData, NodeType } from './types';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const NODE_COLORS: Record<NodeType, string> = {
  Evidence: "#34D399",
  Hypothesis: "#FBBF24",
  DiagnosticAction: "#F87171",
};

export default function App() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(null);
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-3-flash-preview");
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>();

  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });

      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const snippetsRef = useRef<Snippet[]>([]);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  useEffect(() => {
    snippetsRef.current = snippets;
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [snippets, nodes, edges]);

  // --- Core Logic: Extraction ---

  const extractGraph = async (snippet: Snippet) => {
    setIsExtracting(true);
    try {
      const res = await fetch("http://localhost:8000/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: snippet.text })
      });
      const result = await res.json();

      // Update Snippet to not be dirty
      setSnippets(prev => prev.map(s => s.id === snippet.id ? { ...s, isDirty: false } : s));

      // Update Graph State safely
      if (result.nodes && result.edges) {
        updateGraphState(snippet.id, result.nodes, result.edges);
      } else {
        console.error("Extraction returned invalid format:", result);
      }
    } catch (error) {
      console.error("Extraction failed:", error);
    } finally {
      setIsExtracting(false);
    }
  };

  const updateGraphState = (snippetId: string, newNodes: any[], newEdges: any[]) => {
    setNodes(prev => {
      const nodeMap = new Map<string, Node>(prev.map(n => [n.id, n]));

      newNodes.forEach(nn => {
        const existing = nodeMap.get(nn.id);
        if (existing) {
          if (!existing.snippet_ids.includes(snippetId)) {
            nodeMap.set(nn.id, {
              ...existing,
              snippet_ids: [...existing.snippet_ids, snippetId]
            });
          }
        } else {
          nodeMap.set(nn.id, {
            id: nn.id,
            label: nn.label,
            type: nn.type as NodeType,
            snippet_ids: [snippetId]
          });
        }
      });

      return Array.from(nodeMap.values());
    });

    setEdges(prev => {
      // Remove old edges for this snippet
      const filtered = prev.filter(e => e.snippet_id !== snippetId);
      const processedNewEdges = newEdges.map((ne, idx) => ({
        ...ne,
        id: `${snippetId}_${idx}`,
        snippet_id: snippetId
      }));
      return [...filtered, ...processedNewEdges];
    });
  };

  // --- Garbage Collection ---
  const performGC = useCallback(() => {
    setNodes(prevNodes => {
      const activeNodeIds = new Set<string>();
      edges.forEach(e => {
        activeNodeIds.add(typeof e.source === 'string' ? e.source : (e.source as any).id);
        activeNodeIds.add(typeof e.target === 'string' ? e.target : (e.target as any).id);
      });

      return prevNodes.filter(n => activeNodeIds.has(n.id) || n.snippet_ids.length > 0);
    });
  }, [edges]);

  useEffect(() => {
    performGC();
  }, [edges, performGC]);

  // --- Snippet Handlers ---

  const addSnippet = () => {
    const newSnippet: Snippet = {
      id: `snip_${Date.now()}`,
      text: "",
      timestamp: Date.now()
    };
    setSnippets([newSnippet, ...snippets]);
    setActiveSnippetId(newSnippet.id);
    setEditingSnippetId(newSnippet.id);
  };

  const renderHighlightedText = (text: string, snippetId: string) => {
    if (!selectedNodeId && !selectedEdgeId) return text;
    
    let evidences: string[] = [];
    if (selectedNodeId) {
      evidences = edges
        .filter(e => e.snippet_id === snippetId && (
          (typeof e.source === 'string' ? e.source : (e.source as any).id) === selectedNodeId || 
          (typeof e.target === 'string' ? e.target : (e.target as any).id) === selectedNodeId
        ))
        .map(e => e.evidence);
    } else if (selectedEdgeId) {
      evidences = edges
        .filter(e => e.id === selectedEdgeId && e.snippet_id === snippetId)
        .map(e => e.evidence);
    }

    evidences = Array.from(new Set(evidences.filter(e => e && e.trim() !== "")));
    if (evidences.length === 0) return text;

    let parts = [{ text, isHighlight: false }];
    
    evidences.forEach(evidence => {
      const newParts: { text: string, isHighlight: boolean }[] = [];
      parts.forEach(part => {
        if (part.isHighlight) {
          newParts.push(part);
        } else {
          const splitTexts = part.text.split(evidence);
          splitTexts.forEach((st, idx) => {
            newParts.push({ text: st, isHighlight: false });
            if (idx < splitTexts.length - 1) {
              newParts.push({ text: evidence, isHighlight: true });
            }
          });
        }
      });
      parts = newParts;
    });

    return (
      <>
        {parts.map((part, i) => 
          part.isHighlight ? 
            <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-1 shadow-sm font-medium transition-colors">{part.text}</mark> : 
            <span key={i}>{part.text}</span>
        )}
      </>
    );
  };

  const updateSnippetText = (id: string, text: string) => {
    setSnippets(prev => prev.map(s => s.id === id ? { ...s, text } : s));
  };

  const deleteSnippet = (id: string) => {
    setSnippets(prev => prev.filter(s => s.id !== id));
    setEdges(prev => prev.filter(e => e.snippet_id !== id));
    setNodes(prev => prev.map(n => ({
      ...n,
      snippet_ids: n.snippet_ids.filter(sid => sid !== id)
    })).filter(n => n.snippet_ids.length > 0));
  };

  // --- Graph to Text Sync ---

  const syncGraphToText = async (snippetId: string, overrideNodes?: Node[], overrideEdges?: Edge[]) => {
    const currentSnippets = snippetsRef.current;
    const currentNodes = overrideNodes || nodesRef.current;
    const currentEdges = overrideEdges || edgesRef.current;

    const snippet = currentSnippets.find(s => s.id === snippetId);
    if (!snippet) return;

    const snippetEdges = currentEdges.filter(e => e.snippet_id === snippetId);

    setIsExtracting(true);
    try {
      const nodeLabels = currentNodes.reduce((acc, n) => {
        acc[n.id] = n.label;
        return acc;
      }, {} as Record<string, string>);

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: `Rewrite the following text to accurately reflect the relationships and entity names defined in the provided data. 
        Maintain the original tone and style.
        
        Original Text: "${snippet.text}"
        
        Current Entity Names (ID -> Label):
        ${Object.entries(nodeLabels).map(([id, label]) => `- ${id}: ${label}`).join('\n')}
        
        Relationships to reflect:
        ${snippetEdges.map(e => {
          const sId = typeof e.source === 'string' ? e.source : (e.source as any).id;
          const tId = typeof e.target === 'string' ? e.target : (e.target as any).id;
          const sLabel = nodeLabels[sId] || sId;
          const tLabel = nodeLabels[tId] || tId;
          return `- ${sLabel} (${sId}) --[${e.relation}]--> ${tLabel} (${tId})`;
        }).join('\n')}
        
        Return ONLY the rewritten text. Do not include any introductory or concluding remarks.`,
      });

      const newText = response.text?.trim();
      if (newText) {
        setSnippets(prev => prev.map(s => s.id === snippetId ? { ...s, text: newText, isDirty: false } : s));
      }
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsExtracting(false);
    }
  };

  // --- Seed Data ---

  const loadSeedData = () => {
    const seedSnippets: Snippet[] = [
      {
        id: "snip_1",
        text: "Steve Jobs co-founded Apple in Cupertino alongside Steve Wozniak. Years later, he introduced the iPhone in 2007, which revolutionized the smartphone industry.",
        timestamp: Date.now() - 25000
      },
      {
        id: "snip_2",
        text: "Tim Cook succeeded Steve Jobs as CEO of Apple. Under his leadership, Apple launched the Apple Watch and significantly expanded its services business.",
        timestamp: Date.now() - 20000
      },
      {
        id: "snip_3",
        text: "Before returning to Apple, Steve Jobs founded NeXT. Apple acquired NeXT in 1997, which brought Jobs back to the company he originally started.",
        timestamp: Date.now() - 15000
      },
      {
        id: "snip_4",
        text: "Jony Ive was the Chief Design Officer at Apple, working closely with Steve Jobs to design iconic products like the iMac and the iPhone.",
        timestamp: Date.now() - 10000
      },
      {
        id: "snip_5",
        text: "During the 1990s, Microsoft, led by Bill Gates, invested in Apple to help save the struggling Cupertino company from bankruptcy.",
        timestamp: Date.now() - 5000
      }
    ];
    setSnippets(seedSnippets);
    // Trigger extraction for each
    seedSnippets.forEach(s => extractGraph(s));
  };

  const handleSaveNode = async () => {
    if (!selectedNodeId || !editData) return;

    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return;

    const affectedSnippetIds = node.snippet_ids;
    const updatedNodes = nodes.map(n => n.id === selectedNodeId ? { ...n, ...editData } : n);

    setNodes(updatedNodes);
    setIsEditing(false);

    // Mark affected snippets as dirty
    setSnippets(prev => prev.map(s =>
      affectedSnippetIds.includes(s.id) ? { ...s, isDirty: true } : s
    ));
  };

  const handleSaveEdge = async () => {
    if (!selectedEdgeId || !editData) return;

    const edge = edges.find(e => e.id === selectedEdgeId);
    if (!edge) return;

    const updatedEdges = edges.map(e => e.id === selectedEdgeId ? { ...e, ...editData } : e);
    setEdges(updatedEdges);
    setIsEditing(false);

    // Mark the specific snippet as dirty
    setSnippets(prev => prev.map(s =>
      s.id === edge.snippet_id ? { ...s, isDirty: true } : s
    ));
  };

  const startEditingNode = (node: Node) => {
    setEditData({ label: node.label, type: node.type });
    setIsEditing(true);
  };

  const startEditingEdge = (edge: Edge) => {
    setEditData({ relation: edge.relation });
    setIsEditing(true);
  };

  // --- Render Helpers ---

  const filteredSnippets = snippets.filter(s =>
    s.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (selectedNodeId && nodes.find(n => n.id === selectedNodeId)?.snippet_ids.includes(s.id))
  );

  const graphData = useMemo(() => ({
    nodes: nodes.map(n => ({ ...n })),
    links: edges.map(e => ({ ...e }))
  }), [nodes, edges]);

  return (
    <div className="flex h-screen w-full bg-[#E4E3E0] text-[#141414] font-sans overflow-hidden">
      {/* Sidebar: Snippets */}
      <div className="w-[450px] flex flex-col border-r border-[#141414] bg-white/50 backdrop-blur-sm">
        <div className="p-6 border-bottom border-[#141414] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-serif italic font-bold tracking-tight">GraphScape</h1>
            <div className="flex gap-2">
              <button
                onClick={loadSeedData}
                className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-mono uppercase bg-white hover:bg-[#141414] hover:text-white transition-colors rounded-md border border-[#141414]"
                title="Load Demo Data"
              >
                <Database size={14} /> Demo
              </button>
              <button
                onClick={addSnippet}
                className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-mono uppercase bg-[#141414] text-white hover:bg-opacity-80 transition-colors rounded-md"
                title="Add New Note"
              >
                <Plus size={14} /> New
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={16} />
            <input
              type="text"
              placeholder="Search snippets or nodes..."
              className="w-full pl-10 pr-4 py-2 bg-transparent border border-[#141414] rounded-md focus:outline-none focus:ring-1 focus:ring-[#141414]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 mt-1">
            <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">AI Model</span>
            <select
              className="flex-1 bg-transparent border border-[#141414] rounded-md px-2 py-1.5 text-xs font-serif italic cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#141414]"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              <option value="gemini-3-flash-preview">Gemini 3 Flash (Original)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {filteredSnippets.length === 0 && (
            <div className="text-center py-20 opacity-40 italic font-serif">
              No snippets found. Start by adding one.
            </div>
          )}
          {filteredSnippets.map((snippet) => (
            <div
              key={snippet.id}
              className={cn(
                "group p-4 border rounded-lg transition-all duration-200 flex flex-col gap-3",
                activeSnippetId === snippet.id ? "bg-white shadow-lg border-[#141414]" : "bg-white/30 hover:bg-white/60 border-[#141414]"
              )}
              onClick={() => setActiveSnippetId(snippet.id)}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">
                    {new Date(snippet.timestamp).toLocaleTimeString()}
                  </span>
                  {snippet.isDirty && (
                    <span className="text-[9px] font-mono uppercase bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded border border-yellow-400">
                      Needs Sync
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSnippet(snippet.id); }}
                  className="p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete Note"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {editingSnippetId === snippet.id ? (
                <textarea
                  autoFocus
                  className="w-full bg-transparent resize-none focus:outline-none text-sm leading-relaxed"
                  rows={Math.max(4, snippet.text.split('\n').length)}
                  value={snippet.text}
                  onChange={(e) => updateSnippetText(snippet.id, e.target.value)}
                  onBlur={() => setEditingSnippetId(null)}
                  placeholder="Write your thoughts here..."
                />
              ) : (
                <div 
                  className="w-full text-sm leading-relaxed min-h-[5rem] cursor-text whitespace-pre-wrap"
                  onClick={(e) => { e.stopPropagation(); setEditingSnippetId(snippet.id); }}
                  title="Click to edit text"
                >
                  {snippet.text === "" ? (
                    <span className="opacity-40 italic">Write your thoughts here...</span>
                  ) : (
                    renderHighlightedText(snippet.text, snippet.id)
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {nodes.filter(n => n.snippet_ids.includes(snippet.id)).map(n => (
                  <span
                    key={n.id}
                    className="px-2 py-0.5 text-[9px] font-mono border border-[#141414] rounded-full bg-white"
                    style={{ borderColor: NODE_COLORS[n.type] }}
                  >
                    {n.label}
                  </span>
                ))}
              </div>
              <div className="flex gap-2 pt-2 border-t border-[#141414]/10 mt-auto">
                <button
                  onClick={(e) => { e.stopPropagation(); extractGraph(snippet); }}
                  disabled={isExtracting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white border border-[#141414] rounded-md text-[10px] font-mono uppercase hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-50"
                  title="Extract Graph"
                >
                  <Sparkles size={12} className={isExtracting && activeSnippetId === snippet.id ? "animate-pulse text-blue-500" : ""} /> 
                  <span className="font-bold">Extract</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); syncGraphToText(snippet.id); }}
                  disabled={isExtracting}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 border rounded-md text-[10px] font-mono uppercase transition-colors disabled:opacity-50",
                    snippet.isDirty 
                      ? "bg-yellow-50 hover:bg-yellow-100 text-yellow-900 border-yellow-400 font-bold" 
                      : "bg-white hover:bg-green-50 hover:text-green-700 border-[#141414] font-bold"
                  )}
                  title="Rewrite Text from Graph"
                >
                  <PenLine size={12} /> Rewrite
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content: Graph */}
      <div ref={containerRef} className="flex-1 relative bg-[#F0EFED] overflow-hidden">
        {nodes.length === 0 && !isExtracting && (
          <div className="absolute inset-0 flex items-center justify-center z-0 opacity-20 pointer-events-none">
            <div className="text-center">
              <Database size={120} className="mx-auto mb-4" />
              <p className="text-2xl font-serif italic">Graph is empty. Add snippets to begin.</p>
            </div>
          </div>
        )}

        <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
          <div className="bg-white/80 backdrop-blur-md border border-[#141414] p-3 rounded-lg shadow-sm max-w-xs">
            <h2 className="text-xs font-mono uppercase tracking-widest mb-2 opacity-50">Legend</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {(Object.keys(NODE_COLORS) as NodeType[]).map(type => (
                <div key={type} className="flex items-center gap-2 text-[10px]">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS[type] }} />
                  <span>{type}</span>
                </div>
              ))}
            </div>
          </div>

          <div 
            className="bg-white/80 backdrop-blur-md border border-[#141414] p-3 rounded-lg shadow-sm max-w-xs flex items-center justify-between cursor-pointer hover:bg-white transition-colors gap-6"
            onClick={() => setShowEdgeLabels(!showEdgeLabels)}
          >
            <span className="text-[10px] font-mono uppercase tracking-widest opacity-80">Show Relations</span>
            {showEdgeLabels ? <Eye size={14} /> : <EyeOff size={14} className="opacity-50" />}
          </div>

          {selectedNodeId && (
            <div className="bg-white border border-[#141414] p-4 rounded-lg shadow-xl animate-in fade-in slide-in-from-left-4 duration-300 w-64">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        className="w-full text-lg font-serif italic border-b border-[#141414] focus:outline-none"
                        value={editData.label}
                        onChange={e => setEditData({ ...editData, label: e.target.value })}
                      />
                      <select
                        className="w-full text-[10px] font-mono uppercase bg-transparent border border-[#141414] rounded p-1"
                        value={editData.type}
                        onChange={e => setEditData({ ...editData, type: e.target.value })}
                      >
                        {(Object.keys(NODE_COLORS) as NodeType[]).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-serif italic text-lg leading-tight">
                        {nodes.find(n => n.id === selectedNodeId)?.label}
                      </h3>
                      <span className="text-[10px] font-mono uppercase opacity-50">
                        {nodes.find(n => n.id === selectedNodeId)?.type}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex gap-1">
                  {isEditing ? (
                    <button onClick={handleSaveNode} className="p-1 text-green-600 hover:bg-green-50 rounded">
                      <Zap size={16} />
                    </button>
                  ) : (
                    <button onClick={() => startEditingNode(nodes.find(n => n.id === selectedNodeId)!)} className="p-1 opacity-30 hover:opacity-100">
                      <Edit3 size={16} />
                    </button>
                  )}
                  <button onClick={() => { setSelectedNodeId(null); setIsEditing(false); }} title="Close" className="p-1 opacity-40 hover:opacity-100 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-black">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="text-[9px] font-mono uppercase tracking-widest opacity-40 mb-1">Connections</h4>
                  <div className="space-y-1">
                    {edges.filter(e => {
                      const sId = typeof e.source === 'string' ? e.source : (e.source as any).id;
                      const tId = typeof e.target === 'string' ? e.target : (e.target as any).id;
                      return sId === selectedNodeId || tId === selectedNodeId;
                    }).map(e => {
                      const sId = typeof e.source === 'string' ? e.source : (e.source as any).id;
                      const tId = typeof e.target === 'string' ? e.target : (e.target as any).id;
                      const otherId = sId === selectedNodeId ? tId : sId;
                      const otherNode = nodes.find(n => n.id === otherId);
                      return (
                        <div key={e.id} className="text-[11px] flex items-center gap-2 group/link cursor-pointer" onClick={() => { setSelectedEdgeId(e.id); setSelectedNodeId(null); setIsEditing(false); }}>
                          <LinkIcon size={10} className="opacity-30" />
                          <span className="italic opacity-60">{e.relation}</span>
                          <span className="font-medium group-hover/link:underline">{otherNode?.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {!isEditing && (
                  <div>
                    <h4 className="text-[9px] font-mono uppercase tracking-widest opacity-40 mb-1">Evidence</h4>
                    <div className="max-h-32 overflow-y-auto pr-2 space-y-2 text-[10px] leading-relaxed italic opacity-80 custom-scrollbar">
                      {edges.filter(e => {
                        const sId = typeof e.source === 'string' ? e.source : (e.source as any).id;
                        const tId = typeof e.target === 'string' ? e.target : (e.target as any).id;
                        return sId === selectedNodeId || tId === selectedNodeId;
                      }).map(e => (
                        <p key={e.id} className="border-l border-[#141414]/20 pl-2">"{e.evidence}"</p>
                      ))}
                    </div>
                  </div>
                )}

                {nodes.find(n => n.id === selectedNodeId)?.type === "Evidence" && (
                  <div className="pt-3 pb-1 border-t border-[#141414]/10 mt-3">
                     <button 
                       onClick={async () => {
                          const API_URL = "http://localhost:8000/nodes/toggle_active";
                          const node = nodes.find(n => n.id === selectedNodeId);
                          const nextState = node?.status === "active" ? false : true;
                          
                          await fetch(`${API_URL}?node_id=${selectedNodeId}&active=${nextState}`, { method: "POST" });
                          setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, status: nextState ? "active" : "inactive" } : n));
                          
                          // Trigger the 2-stage inference
                          const activeNodeIds = nodes.filter(n => n.id !== selectedNodeId && n.status === "active").map(n => n.id);
                          if (nextState) activeNodeIds.push(selectedNodeId);
                          
                          const result = await fetch("http://localhost:8000/infer", {
                             method: "POST",
                             headers: { "Content-Type": "application/json" },
                             body: JSON.stringify({ active_node_ids: activeNodeIds })
                          });
                          const inferenceData = await result.json();
                          console.log("Inference Result:", inferenceData);
                          alert(`Inference complete! Evaluated ${inferenceData.candidates_evaluated} candidates.\n\nAI Conclusion:\n` + inferenceData.result);
                       }}
                       className={`w-full text-xs font-mono py-1.5 px-2 border rounded-md transition-colors ${
                         nodes.find(n => n.id === selectedNodeId)?.status === "active" 
                           ? "bg-emerald-100 text-emerald-800 border-emerald-400" 
                           : "bg-white text-gray-700 border-gray-400 hover:bg-gray-50"
                       }`}
                     >
                       {nodes.find(n => n.id === selectedNodeId)?.status === "active" ? "★ Evidence Active" : "Set as Active Evidence"}
                     </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedEdgeId && (
            <div className="bg-white border border-[#141414] p-4 rounded-lg shadow-xl animate-in fade-in slide-in-from-left-4 duration-300 w-64">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-[10px] font-mono uppercase tracking-widest opacity-40 mb-1">Edge Details</h3>
                  {isEditing ? (
                    <input
                      className="w-full text-lg font-serif italic border-b border-[#141414] focus:outline-none"
                      value={editData.relation}
                      onChange={e => setEditData({ ...editData, relation: e.target.value })}
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold">{nodes.find(n => n.id === (typeof edges.find(e => e.id === selectedEdgeId)?.source === 'string' ? edges.find(e => e.id === selectedEdgeId)?.source : (edges.find(e => e.id === selectedEdgeId)?.source as any).id))?.label}</span>
                      <span className="italic opacity-60">{edges.find(e => e.id === selectedEdgeId)?.relation}</span>
                      <span className="font-bold">{nodes.find(n => n.id === (typeof edges.find(e => e.id === selectedEdgeId)?.target === 'string' ? edges.find(e => e.id === selectedEdgeId)?.target : (edges.find(e => e.id === selectedEdgeId)?.target as any).id))?.label}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  {isEditing ? (
                    <button onClick={handleSaveEdge} className="p-1 text-green-600 hover:bg-green-50 rounded">
                      <Zap size={16} />
                    </button>
                  ) : (
                    <button onClick={() => startEditingEdge(edges.find(e => e.id === selectedEdgeId)!)} className="p-1 opacity-30 hover:opacity-100">
                      <Edit3 size={16} />
                    </button>
                  )}
                  <button onClick={() => { setSelectedEdgeId(null); setIsEditing(false); }} title="Close" className="p-1 opacity-40 hover:opacity-100 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-black">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="text-[9px] font-mono uppercase tracking-widest opacity-40 mb-1">Evidence</h4>
                  <p className="text-[10px] leading-relaxed italic opacity-80 border-l border-[#141414]/20 pl-2">
                    "{edges.find(e => e.id === selectedEdgeId)?.evidence}"
                  </p>
                </div>
                <div className="pt-2 border-t border-[#141414]/10">
                  <button
                    onClick={() => {
                      const edge = edges.find(e => e.id === selectedEdgeId);
                      if (edge) setActiveSnippetId(edge.snippet_id);
                    }}
                    className="text-[10px] font-mono uppercase tracking-widest hover:underline flex items-center gap-1"
                  >
                    <ChevronRight size={10} /> Go to Snippet
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel="label"
          nodeColor={node => NODE_COLORS[(node as Node).type] || "#141414"}
          nodeRelSize={6}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          linkCurvature={0.25}
          linkLabel={link => showEdgeLabels ? (link as Edge).relation : ""}
          linkWidth={1.5}
          linkColor={() => "rgba(20, 20, 20, 0.2)"}
          onNodeClick={(node) => { setSelectedNodeId((node as Node).id); setSelectedEdgeId(null); setIsEditing(false); setEditingSnippetId(null); }}
          onLinkClick={(link) => { setSelectedEdgeId((link as Edge).id); setSelectedNodeId(null); setIsEditing(false); setEditingSnippetId(null); }}
          onBackgroundClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); setIsEditing(false); setEditingSnippetId(null); }}
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = node.label;
            const fontSize = 12 / globalScale;
            ctx.font = `${fontSize}px Inter`;
            const textWidth = ctx.measureText(label).width;
            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2 - 8, bckgDimensions[0], bckgDimensions[1]);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#141414';
            ctx.fillText(label, node.x, node.y - 8);

            // Draw circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI, false);
            ctx.fillStyle = NODE_COLORS[node.type as NodeType] || "#141414";
            ctx.fill();

            if (selectedNodeId === node.id) {
              ctx.strokeStyle = '#141414';
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();
            }
          }}
        />

        {isExtracting && (
          <div className="absolute bottom-6 right-6 flex items-center gap-3 bg-white border border-[#141414] px-4 py-2 rounded-full shadow-lg animate-pulse">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-xs font-mono uppercase tracking-widest">AI Processing...</span>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(20, 20, 20, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(20, 20, 20, 0.3);
        }
      `}} />
    </div>
  );
}
