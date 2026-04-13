# 技术文档拆分 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为当前 Streamlit 股票工作台补齐面向迁移的技术文档，明确前端页面能力、后端服务能力和完整工作流/数据流。

**Architecture:** 文档按前端、后端、数据流三条线拆分，统一从当前代码真实实现出发，不引入虚构 HTTP API。先完成代码审计，再分别整理页面入口、服务能力、数据库和调度链路，最后更新文档索引。

**Tech Stack:** Markdown、Streamlit、Python 服务模块、SQLite/JSON 持久化、PowerShell、ripgrep

---

### Task 1: 审计前端页面入口与工作区结构

**Files:**
- Modify: `C:\Projects\githubs\aiagents-stock\docs\前端页面与交互清单.md`
- Modify: `C:\Projects\githubs\aiagents-stock\docs\README.md`
- Test: `manual audit via rg`

- [ ] **Step 1: 列出一级页面入口**

Run:

```powershell
rg -n "show_|display_" C:\Projects\githubs\aiagents-stock\app.py C:\Projects\githubs\aiagents-stock\watchlist_ui.py C:\Projects\githubs\aiagents-stock\discovery_hub_ui.py C:\Projects\githubs\aiagents-stock\research_hub_ui.py C:\Projects\githubs\aiagents-stock\quant_sim\ui.py
```

Expected: 能看到 `工作台 / 发现股票 / 研究情报 / 持仓分析 / 量化模拟 / 历史回放 / AI盯盘 / 实时监控 / 历史记录 / 环境配置` 的入口和渲染函数。

- [ ] **Step 2: 审计每个页面的主要区域和按钮**

Inspect:

```powershell
Get-Content C:\Projects\githubs\aiagents-stock\watchlist_ui.py -TotalCount 520
Get-Content C:\Projects\githubs\aiagents-stock\quant_sim\ui.py -TotalCount 1100
Get-Content C:\Projects\githubs\aiagents-stock\discovery_hub_ui.py
Get-Content C:\Projects\githubs\aiagents-stock\research_hub_ui.py
```

Expected: 能整理出每个页面的主要工作区、表格、弹窗、按钮和跳转。

- [ ] **Step 3: 写入前端技术文档**

Create/update content covering:

```markdown
# 前端页面与交互清单

## 1. 工作台
- 入口标识：`show_watchlist_workbench`（首页默认态）
- 渲染函数：`display_watchlist_workbench()`
- 区域：概览卡、我的关注、股票分析、下一步入口
- 主要按钮：
  - `添加`：按代码加入“我的关注”
  - `↻`：刷新关注池报价
  - `🧪`：把选中股票加入量化候选池
  - `✕`：清空当前选择

## 2. 发现股票
...
```

- [ ] **Step 4: 校对前端文档与代码一致**

Run:

```powershell
rg -n "工作台|发现股票|研究情报|量化模拟|历史回放|AI盯盘|实时监控|环境配置" C:\Projects\githubs\aiagents-stock\docs\前端页面与交互清单.md
```

Expected: 文档覆盖所有一级页面。

### Task 2: 审计后端服务能力与接口边界

**Files:**
- Modify: `C:\Projects\githubs\aiagents-stock\docs\后端能力与服务接口清单.md`
- Test: `manual audit via rg`

- [ ] **Step 1: 列出核心服务与数据模块**

Run:

```powershell
rg -n "class |def " C:\Projects\githubs\aiagents-stock\watchlist_service.py C:\Projects\githubs\aiagents-stock\watchlist_db.py C:\Projects\githubs\aiagents-stock\watchlist_selector_integration.py C:\Projects\githubs\aiagents-stock\quant_sim\*.py C:\Projects\githubs\aiagents-stock\stock_data.py C:\Projects\githubs\aiagents-stock\data_source_manager.py C:\Projects\githubs\aiagents-stock\monitor_manager.py C:\Projects\githubs\aiagents-stock\portfolio_ui.py
```

Expected: 能提取出关注池、量化候选池、调度、回放、报价刷新、分析主流程的核心入口。

- [ ] **Step 2: 审计量化模拟与历史回放链路**

Inspect:

```powershell
Get-Content C:\Projects\githubs\aiagents-stock\quant_sim\ui.py -TotalCount 1100
Get-Content C:\Projects\githubs\aiagents-stock\quant_sim\engine.py
Get-Content C:\Projects\githubs\aiagents-stock\quant_sim\scheduler.py
Get-Content C:\Projects\githubs\aiagents-stock\quant_sim\replay_service.py
Get-Content C:\Projects\githubs\aiagents-stock\quant_sim\portfolio_service.py
Get-Content C:\Projects\githubs\aiagents-stock\quant_sim\db.py -TotalCount 2400
```

Expected: 能写清自动执行、定时恢复、跳过原因、持仓与权益回写、回放任务和结果落库。

- [ ] **Step 3: 写入后端技术文档**

Create/update content covering:

```markdown
# 后端能力与服务接口清单

## 1. 股票分析主流程
- 入口：`app.py` 中单股/批量分析主流程
- 输入：股票代码、分析模式、数据周期、分析师组合
- 输出：股票信息、技术指标、图表、分析师观点、团队讨论、最终决策

## 2. 我的关注与关注池管理
- `watchlist_service.py`
- `watchlist_db.py`
- 输入参数、返回结构、写库位置、调用页面

## 3. 量化模拟
...
```

- [ ] **Step 4: 明确“当前服务接口”与“未来 API 候选”**

Add explicit sections:

```markdown
### 当前是页面直调的服务能力
### 适合迁移成 HTTP API 的能力
```

- [ ] **Step 5: 校对后端文档与代码一致**

Run:

```powershell
rg -n "watchlist_service|quant_sim|replay_service|portfolio_service|scheduler|data_source_manager" C:\Projects\githubs\aiagents-stock\docs\后端能力与服务接口清单.md
```

Expected: 核心服务模块都已覆盖。

### Task 3: 编写工作流与数据流说明

**Files:**
- Modify: `C:\Projects\githubs\aiagents-stock\docs\工作流与数据流说明.md`
- Test: `manual audit`

- [ ] **Step 1: 审计主线数据流**

Inspect:

```powershell
Get-Content C:\Projects\githubs\aiagents-stock\watchlist_selector_integration.py
Get-Content C:\Projects\githubs\aiagents-stock\watchlist_research_integration.py
Get-Content C:\Projects\githubs\aiagents-stock\watchlist_ui.py -TotalCount 520
Get-Content C:\Projects\githubs\aiagents-stock\quant_sim\ui.py -TotalCount 1100
```

Expected: 能确定从发现/研究到关注池，再到量化候选池和回放/模拟的完整链路。

- [ ] **Step 2: 写入工作流与数据流文档**

Create/update content covering:

```markdown
# 工作流与数据流说明

## 主流程
发现股票 / 研究情报 -> 我的关注 -> 量化候选池 -> 量化模拟 / 历史回放

## 数据流 1：发现股票 -> 我的关注
...

## 数据流 2：研究情报 -> 我的关注
...

## 数据流 3：我的关注 -> 量化候选池
...
```

- [ ] **Step 3: 为迁移补充 API 边界建议**

Add:

```markdown
## 前后端分离建议边界
- Watchlist API
- Discovery API
- Research output API
- Quant candidate pool API
- Quant simulation/replay task API
```

- [ ] **Step 4: 校对主线是否完整**

Run:

```powershell
rg -n "发现股票|研究情报|我的关注|量化候选池|量化模拟|历史回放" C:\Projects\githubs\aiagents-stock\docs\工作流与数据流说明.md
```

Expected: 主线节点都在文档中出现并有说明。

### Task 4: 更新文档索引并完成回归复核

**Files:**
- Modify: `C:\Projects\githubs\aiagents-stock\docs\README.md`
- Test: `manual review`

- [ ] **Step 1: 把三份技术文档放到索引最前面**

Add/update:

```markdown
## 技术文档（优先阅读）
- 前端页面与交互清单
- 后端能力与服务接口清单
- 工作流与数据流说明
```

- [ ] **Step 2: 检查链接和标题**

Run:

```powershell
Get-Content C:\Projects\githubs\aiagents-stock\docs\README.md
```

Expected: 技术文档索引位置靠前，链接正确。

- [ ] **Step 3: 做第一轮 review（代码对照）**

Run:

```powershell
rg -n "display_watchlist_workbench|display_discovery_hub|display_research_hub|display_quant_sim|display_quant_replay|display_monitor_manager|display_portfolio_manager" C:\Projects\githubs\aiagents-stock\app.py
```

Expected: 文档中列出的一级页面都能在代码入口中找到。

- [ ] **Step 4: 做第二轮 review（文档一致性）**

Run:

```powershell
rg -n "我的关注|量化候选池|量化模拟|历史回放|发现股票|研究情报" C:\Projects\githubs\aiagents-stock\docs\前端页面与交互清单.md C:\Projects\githubs\aiagents-stock\docs\后端能力与服务接口清单.md C:\Projects\githubs\aiagents-stock\docs\工作流与数据流说明.md C:\Projects\githubs\aiagents-stock\docs\README.md
```

Expected: 核心名词在三份主文档和索引中保持一致。

- [ ] **Step 5: Commit**

```bash
git add "docs/前端页面与交互清单.md" "docs/后端能力与服务接口清单.md" "docs/工作流与数据流说明.md" "docs/README.md"
git commit -m "docs: add technical frontend and backend references"
```
