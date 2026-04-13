# 业务代码迁移到 app 目录设计

> 目标是在不改变当前核心功能和启动方式的前提下，把业务 Python 代码统一收拢到 `app/` 目录，根目录只保留薄入口和非业务目录。

## 目标

当前仓库根目录里散落着大量业务 `.py` 文件和业务包，目录噪音比较大，导入边界也不够清楚。本次重构的目标是：

1. 把现有业务代码统一迁移到新的 `app/` 目录。
2. 根目录只保留少量薄入口和非业务目录。
3. 现有启动方式尽量保持兼容。
4. 不改变业务主流程、不新增 API、也不借机改现有功能设计。

## 设计原则

- 这是一次目录结构重构，不是功能重构。
- 优先保证当前 Streamlit 启动方式和关键测试链路稳定。
- 先迁移代码，再逐步清理导入；不混入额外架构优化。
- 包目录与单文件模块统一纳入 `app/`，避免形成“两套代码区”。
- `tests/`、`docs/`、`config/`、`data/` 等非业务目录保持在根目录不动。

## 目标目录结构

迁移完成后，根目录应主要保留：

- `app.py`
- `run.py`
- `tests/`
- `docs/`
- `config/`
- `data/`
- `requirements.txt`
- 以及 Docker、CI、批处理脚本等工程文件

新的业务代码主目录：

- `app/`

其中包含：

- 现有根目录的大部分业务 `.py`
- 现有业务包：
  - `quant_sim/` -> `app/quant_sim/`
  - `quant_kernel/` -> `app/quant_kernel/`

## 迁移范围

### 1. 迁移进 `app/` 的内容

包括但不限于：

- 页面与 UI：
  - `watchlist_ui.py`
  - `discovery_hub_ui.py`
  - `research_hub_ui.py`
  - `main_force_ui.py`
  - `low_price_bull_ui.py`
  - `small_cap_ui.py`
  - `profit_growth_ui.py`
  - `value_stock_ui.py`
  - `portfolio_ui.py`
  - `smart_monitor_ui.py`
  - `monitor_manager.py`
  - 其他业务 UI 文件

- 服务、数据源与桥接：
  - `watchlist_service.py`
  - `watchlist_db.py`
  - `watchlist_selector_integration.py`
  - `research_watchlist_integration.py`
  - `stock_data.py`
  - `data_source_manager.py`
  - `ai_agents.py`
  - `notification_service.py`
  - 其他业务服务文件

- 现有业务包：
  - `quant_sim/`
  - `quant_kernel/`

### 2. 保持在根目录的内容

- `app.py`
- `run.py`
- `tests/`
- `docs/`
- `config/`
- `data/`
- `requirements.txt`
- `Dockerfile`、`docker-compose.yml`
- `.streamlit/`
- `start_app.bat`
- 其他工程与运维文件

### 3. 不在本次处理的内容

- `.db` 数据库文件
- `logs/`
- `.superpowers/`
- `.codex-runtime/`
- 其他运行时产物

## 兼容策略

### 1. 根入口保留

根目录 [app.py](/C:/Projects/githubs/aiagents-stock/app.py) 和 [run.py](/C:/Projects/githubs/aiagents-stock/run.py) 保留，但变成很薄的兼容入口。

目标形态：

- `app.py`：
  - 只负责导入 `app.app` 中的主入口并执行
- `run.py`：
  - 只负责导入 `app.run` 或对应入口并执行

这样做的好处：

- 现有 `streamlit run app.py` 不需要立刻改变
- 现有脚本和文档不需要一次性全部重写

### 2. 导入路径统一

迁移后，业务代码统一使用 `app.` 前缀导入，例如：

- `from watchlist_service import WatchlistService`
  -> `from app.watchlist_service import WatchlistService`
- `from quant_sim.ui import display_quant_sim`
  -> `from app.quant_sim.ui import display_quant_sim`

### 3. 包初始化

新的 `app/` 目录需要成为明确 Python 包：

- `app/__init__.py`

必要时对原有包初始化文件进行路径修正：

- `app/quant_sim/__init__.py`
- `app/quant_kernel/__init__.py`

## 实施顺序

### Phase 1：建立 app 包骨架

- 创建 `app/`
- 添加 `app/__init__.py`
- 先迁移两个已有包：
  - `quant_sim/`
  - `quant_kernel/`

### Phase 2：迁移核心公共模块

优先迁移被大量引用的基础模块，例如：

- `stock_data.py`
- `data_source_manager.py`
- `ai_agents.py`
- `watchlist_service.py`
- `watchlist_db.py`
- `notification_service.py`

### Phase 3：迁移页面与策略模块

再迁移 UI 和策略实现：

- 工作台与关注池相关 UI
- 发现股票聚合页和子模块
- 研究情报聚合页和子模块
- 持仓分析、实时监控、AI 盯盘

### Phase 4：根入口兼容化

- 把根目录 `app.py` 改成薄入口
- 把根目录 `run.py` 改成薄入口

### Phase 5：测试与文档收口

- 修正测试导入路径
- 修正文档中的代码路径说明
- 确认关键启动命令仍然有效

## 风险点

### 1. Streamlit 启动链

当前很多页面通过根目录导入互相调用，迁移后最容易出问题的是：

- `streamlit run app.py`
- 由 `app.py` 继续导入各页面模块时的路径问题

### 2. 隐式根路径导入

当前大量模块默认依赖“仓库根目录就在 `sys.path` 里”。迁移后这些导入必须显式改成 `app.` 前缀。

### 3. 测试导入路径

现有测试很多直接导入根目录模块，例如：

- `import app`
- `import watchlist_ui`
- `import main_force_ui`

这些测试需要在迁移后统一调整。

### 4. 运行脚本

一些脚本、批处理文件、部署方式可能依赖旧路径：

- `start_app.bat`
- Docker 启动命令
- 可能存在的本地工具脚本

## 非目标

- 不调整当前业务流程
- 不修改页面交互设计
- 不设计新的 API
- 不顺手整理数据库文件位置
- 不顺手重构所有模块边界

## 完成标准

本次重构完成后应满足：

1. 业务代码已经统一收进 `app/`
2. 根目录只保留薄入口和非业务目录
3. `streamlit run app.py` 仍然可用
4. 关键导入链可通过：
   - `import app`
   - `import app.quant_sim.ui`
   - `import app.watchlist_ui`
5. 关键测试通过
6. 文档路径说明更新完成

## 验证标准

- 页面主入口能正常启动
- 工作台、发现股票、研究情报、量化模拟、历史回放都能正常导入
- 关注池到量化候选池的数据流测试仍然通过
- 量化模拟与历史回放关键测试仍然通过
- 发现股票和研究情报模块至少完成基础导入验证
