# 玄武AI智能量化系统

一个围绕 A 股研究、统一股票池、持仓诊断、实时量化与历史回放的股票工作台。

当前主线已经不是旧的“关注池 + 独立量化候选池 + 回放接续实时账户”模式。  
当前真实主线是：

`发现股票 / 研究情报 / 手工录入 -> 统一股票池(stock_universe) -> 按标签筛选 -> 持仓诊断 / 实时量化 / 历史回放`

---

## 当前模块

### 工作台

- 统一股票池视图
- 合并展示 `watched / quant_enabled / registered_position_enabled`
- 支持手工加股、批量加入实时量化、批量登记持仓

### 发现股票

- 聚合多种选股策略
- 输出候选结果
- 可批量写入统一股票池

### 研究情报

- 聚合板块、龙虎榜、新闻流量、宏观分析、宏观周期
- 当模块输出明确股票时，可推进到统一股票池

### 持仓分析

- 面向 `registered_position_enabled=1` 的登记持仓诊断
- 组合诊断、个股详情、分析师观点、建议汇总

### 实时模拟

- 面向 `quant_enabled=1` 的实时量化股票
- 独立 live-sim 账户、成交、持仓、信号
- 默认 10 分钟调度，行情 quote TTL 为 2 分钟

### 历史回放

- 启动时冻结 `quant_enabled=1` 范围
- 结果写入 `quant_sim_replay.db`
- 不再接续到实时模拟账户

### 策略配置

- 量化内核权重、阈值、BUY 分层、个股反馈、组合防守参数配置

### 环境配置

- 模型、数据源、运行参数统一配置

---

## 系统截图

以下截图来自当前部署环境，仅保留页面内容，不包含地址栏信息。

<table>
  <tr>
    <td width="33%">
      <strong>工作台</strong><br/>
      <img src="docs/assets/screenshots/workbench-main.png" alt="工作台截图" width="100%"/>
    </td>
    <td width="33%">
      <strong>发现股票</strong><br/>
      <img src="docs/assets/screenshots/discover.png" alt="发现股票截图" width="100%"/>
    </td>
    <td width="33%">
      <strong>研究情报</strong><br/>
      <img src="docs/assets/screenshots/research.png" alt="研究情报截图" width="100%"/>
    </td>
  </tr>
  <tr>
    <td width="33%">
      <strong>持仓分析</strong><br/>
      <img src="docs/assets/screenshots/portfolio.png" alt="持仓分析截图" width="100%"/>
    </td>
    <td width="33%">
      <strong>实时模拟</strong><br/>
      <img src="docs/assets/screenshots/live-sim.png" alt="实时模拟截图" width="100%"/>
    </td>
    <td width="33%">
      <strong>历史回放</strong><br/>
      <img src="docs/assets/screenshots/his-replay.png" alt="历史回放截图" width="100%"/>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>策略配置</strong><br/>
      <img src="docs/assets/screenshots/strategy-config.png" alt="策略配置截图" width="100%"/>
    </td>
    <td width="50%">
      <strong>环境配置</strong><br/>
      <img src="docs/assets/screenshots/settings.png" alt="环境配置截图" width="100%"/>
    </td>
  </tr>
</table>

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

## 当前要避免的旧认知

以下说法已经不再适用：

- `watchlist.db` 是主关注池数据库
- `candidate_pool` 是独立量化池主表
- `portfolio_stocks.db` 是持仓主表
- 历史回放会接续到实时模拟账户
- 实时量化默认 15 分钟调度

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
