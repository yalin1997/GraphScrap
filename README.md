# GraphScrap - Knowledge Graph Inference System / 知識圖譜增量推理系統

GraphScrap is an interactive knowledge graph workspace with a bidirectional text-graph synchronization and a 2-stage hybrid AI reasoning engine.
GraphScrap 是一個具備「文字與圖譜雙向同步」與「兩階段混合式 AI 推理」能力的互動式知識管理系統。

## 🌟 Features / 系統特色

- **Hybrid Reasoning (混合式推理)**: Uses PostgreSQL Recursive CTEs for hard graph filtering and Gemini 3 for soft semantic verification. 
  (結合 PostgreSQL 的遞迴查詢作為圖譜硬過濾，並串接 Gemini 3 進行語義與邏輯的軟驗證。)
- **Dynamic Ontology (動態本體論)**: Strict node typing (`Evidence`, `Hypothesis`, `DiagnosticAction`). 
  (嚴格的節點型態定義，真實反映推理過程的「證據、假設、與診斷行動」。)
- **Interactive UI (互動式介面)**: Real-time graph visualization with capabilities to trigger inference directly from "Active Evidence" nodes. 
  (即時圖譜視覺化，支援直接從「Active Evidence」節點無縫觸發自動化 AI 推理的視覺動態介面。)

## 🚀 Tech Stack / 技術棧

- **Frontend (前端)**: Vite + React + TypeScript + Force Graph 2D
- **Backend (後端)**: FastAPI + Pydantic + SQLAlchemy
- **Database (資料庫)**: PostgreSQL (Dockerized) with `pgvector`
- **LLM (大語言模型)**: Google Gemini GenAI SDK

## 🛠️ Quick Start / 快速啟動指南

### 1. Start Database / 啟動資料庫
Make sure Docker Desktop is running, then spin up the DB:
(請確保您的電腦已開啟 Docker Desktop，接著在背景啟動資料庫：)
```bash
docker-compose up -d
```

### 2. Start Backend / 啟動後端
Install dependencies and run the FastAPI server:
(切換至獨立的虛擬環境並安裝所需套件，最後啟動 FastAPI 伺服器：)
```bash
python -m venv .venv
# On Windows
.venv\Scripts\Activate.ps1   
pip install -r backend/requirements.txt
set PYTHONPATH=%CD%
uvicorn backend.main:app --reload
```

### 3. Start Frontend / 啟動前端
Install packages and start Vite:
(安裝 Node 套件並啟動 Vite 開發伺服器：)
```bash
npm install
npm run dev
```
