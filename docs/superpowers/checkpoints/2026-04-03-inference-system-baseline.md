# Checkpoint: Inference System Baseline / 推理系統實作里程碑

**Date / 日期:** 2026-04-03
**Status / 狀態:** Phase 1 Implementation Complete (第一階段實作完成)

## Completed Work / 已完成項目
1. **Architecture Migration (架構轉移)**: Transitioned from a purely client-side React PoC to a solid Client-Server separation (FastAPI + React). 
   (成功將純前端的原型系統遷移為具備 FastAPI + React 的前後端分離架構。)
2. **Database Setup (資料庫建置)**: Configured dockerized PostgreSQL with `pgvector` for data persistence and graph logic. 
   (利用 Docker 部署整合了 `pgvector` 的 PostgreSQL，穩定儲存圖譜與未來向量查詢需求。)
3. **Reasoning Engine (後端推理引擎)**: 
   - Built the `/infer` endpoint executing pure SQL Recursive CTEs for structural logic filtering. (實作 `/infer` 介面，使用純 SQL 遞迴 CTE 進行結構與關聯過濾。)
   - Tied `google-genai` into the infer pipeline for AI semantic checking on graph subsets. (在推理流程中掛載 Gemini 模型，以選定的候選節點實現軟驗證。)
   - Built `/api/extract` for structural data extraction from user snippets. (補齊 `/api/extract` 實作，穩健支援自定文本抽取圖譜功能。)
4. **UI/UX Alignment (前端狀態與介面)**:
   - Visualized new types: `Evidence` (Green), `Hypothesis` (Yellow), `DiagnosticAction` (Red). (圖譜節點顏色已反映全新的系統邏輯本體論。)
   - Added the explicit "Set as Active Evidence" action to trigger the backend automated inference loop. (添加「設定為活躍證據」與無縫驅動推理的功能按鈕防呆與串接。)

## Next Steps / 下一步行動 (待辦事項)
- (TBD / 未定)

## Operational Context for AI Agents / AI 助手執行須知
- **Environment**: Python scripts need `.venv` activation. Front-end runs on port `3000`, Backend on `8000`. (注意 Python 虛擬環境需被優先啟用。)
- **Database**: Testing runs primarily on an overridden SQLite in-memory DB (`test_api.py`), while main execution expects Postgres port 5432 via Docker. (單元測試採用 SQLite 以避開 Docker 依賴，但系統正式運作高度依賴 Postgres。)
