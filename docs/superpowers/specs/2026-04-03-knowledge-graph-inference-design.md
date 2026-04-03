# Knowledge Graph Incremental Reasoning System

## 1. System Positioning & Core Objectives
This system upgrades the current pure-frontend "GraphScrap" prototype into a full-fledged Client-Server architecture.
It serves as an interactive Knowledge Management System with "Bidirectional Synchronization", "Incremental Version Control", and "Hybrid AI Reasoning / Targeted RAG". It specifically targets the elimination of LLM hallucination by tightly binding Text (Original snippets) to Graph nodes (Structures), ensuring 100% traceability for every AI inference.

## 2. Architecture & Tech Stack

### 2.1 Frontend (Vite + React)
- **Visualization**: `react-force-graph-2d` (Retained from PoC for Obsidian-like physics-based interactions).
- **Communication**: Replaces direct `@google/genai` API calls with RESTful HTTP calls to the Python backend.
- **UI/UX**: Maintains the existing sidebar logic. Enhances the node-click side panel with an "Activation" toggle to naturally mark evidence nodes as active for inference.

### 2.2 Backend (Python + FastAPI)
- **Role**: AI Inference Engine and API Router. Acts as the centralized gateway between the Database and the Gemini API.
- **Schema Validation**: Uses `Pydantic` heavily to ensure strict typing for all JSON communications with Gemini and data validation for the Frontend.

### 2.3 Database Layer (PostgreSQL + pgvector via Docker)
- **Deployment**: Local Docker Compose setup (`docker-compose.yml`) for instant environment spin up and teardown, maintaining zero local resource impact when idle.
- **Unified Storage**: Consolidates both topological node relationships and semantic text embeddings (`pgvector`) into a single DB to prevent synchronization inconsistencies.
- **Traversal Engine**: Utilizes SQL `Recursive CTEs` to perform deep graph traversal at the database level, executing hard-filtering logic efficiently without taxing the LLM.

### 2.4 Core Model Layer (Google Gemini 3 API)
- The system connects exclusively to the Gemini 3 API, utilizing the user's existing API Token for final-stage semantic evaluation and unstructured text structuring.

## 3. Ontology & Schema Refactoring
The current NER-based nodes (`Person`, `Organization`, etc. in `types.ts`) will be fully migrated in favor of a specialized reasoning ontology.

### 3.1 Node Types
- **Evidence**: Raw data, factual snippets, observed phenomena directly from uploaded text.
- **Hypothesis**: Plausible conclusions or unverified deductions derived from Evidence.
- **Diagnostic Action**: Concrete steps formulated to verify a hypothesis or acquire critical new missing evidence.

### 3.2 Edge Types
- **Support**: Evidence enhances a Hypothesis's credibility.
- **Check**: A Diagnostic Action is deployed to test a specific Hypothesis.
- **Find**: A Diagnostic Action concludes, leading to the discovery of new Evidence.

### 3.3 The "Reasoning Contract" (Edge Extensions)
Traditionally edges are binary (`Source -> Target`). To support complex logic (AND/OR, sequential timeframes), edges will incorporate:
1. `condition_group_id`: An identifier binding multiple conditions that must be simultaneously satisfied (AND logic).
2. `logic_desc`: A natural language payload of the rule (e.g., "A and B occur concurrently, and A's severity is critical") consumed by the LLM.

## 4. Hybrid AI Inference Workflow (2-Stage Funnel)
This funnel acts as the core operating loop of the updated architecture:

1. **Step 0: Evidence Activation (User Driven)**
   - The user selects an Evidence node on the React Force Graph UI.
   - Using the details side-panel, the user toggles the node state to "Active".
   - The UI pushes this state update to FastAPI.

2. **Step 1: Hard Filtering via Graph Validation (Database Driven)**
   - Triggered by FastAPI, PostgreSQL executes a recursive graph traversal starting from all active Evidence nodes.
   - It assesses graph paths against the `condition_group_id` constraints. If an AND group requires Node A & Node B, but only A is active, the upstream path is blocked.
   - Successful topological paths generate a narrowed list of "Candidate Nodes" (Hypotheses & Diagnostic Actions). *Zero LLM cost incurred.*

3. **Step 2: Soft Verification via Targeted RAG (LLM Driven)**
   - FastAPI gathers the raw underlying text snippets strictly linked to the successful Candidate Nodes and Active Evidence (avoiding traditional vector distance retrieval noise).
   - FastAPI constructs a unified verification prompt, injecting the gathered text contexts alongside the `logic_desc`.
   - The **Gemini 3 API** is tasked to evaluate nuanced, unspoken constraints (e.g., precise timing, intent, magnitude).
   - The response is standardized into JSON via Pydantic and pushed back to the React UI, which renders the outcome natively via node/edge highlights on the graph workspace.
