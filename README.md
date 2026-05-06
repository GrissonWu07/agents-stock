# 玄武量化系统

一个面向 A 股研究、股票池管理、持仓诊断、实时模拟和历史回放的工作台。

当前主流程：

`发现股票 / 研究情报 / 手工录入 -> 统一股票池(stock_universe) -> 按标签筛选 -> 持仓诊断 / 实时模拟 / 历史回放`

---

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置 `.env`

```bash
copy .env.example .env
```

最低建议配置：

```env
DEEPSEEK_API_KEY=your_api_key
TDX_ENABLED=true
```

### 3. 启动后端

```bash
python app.py
```

默认后端地址：

- `http://127.0.0.1:8501/api/health`

### 4. 启动前端开发环境

```bash
cd ui
npm install
npm run dev
```

前端开发地址：

- `http://127.0.0.1:4173`

---

## 当前数据边界

### 统一股票池

- 主库：`data/quant_sim.db`
- 主表：`stock_universe`

关键标签：

- `watched`
- `quant_enabled`
- `registered_position_enabled`

### 实时量化

- 写入 `quant_sim.db` 的 live 状态表
- 典型表：`strategy_signals / sim_positions / sim_trades / sim_account`

### 历史回放

- 写入 `data/quant_sim_replay.db`
- 典型表：`sim_runs / sim_run_signals / sim_run_trades / sim_run_positions`

### 发现与研究缓存

- `data/selector_results/*.json`

---

## 推荐阅读

- [docs/README.md](docs/README.md)
- [docs/QUICK_START.md](docs/QUICK_START.md)
- [docs/工作台工作流指南.md](docs/工作台工作流指南.md)
- [docs/股票数据流说明.md](docs/股票数据流说明.md)
- [docs/量化交易快速指南.md](docs/量化交易快速指南.md)
- [docs/前端页面与交互清单.md](docs/前端页面与交互清单.md)
- [docs/后端能力与服务接口清单.md](docs/后端能力与服务接口清单.md)
- [docs/superpowers/specs/2026-05-05-stock-universe-refresh-architecture-design.md](docs/superpowers/specs/2026-05-05-stock-universe-refresh-architecture-design.md)
