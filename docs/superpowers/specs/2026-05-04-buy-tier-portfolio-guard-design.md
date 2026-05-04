# BUY 分层与组合级防守设计

## 背景

任务 #3 里个股执行反馈已经生效，但仍出现整体亏损。根因不是技术 BUY 全错，而是技术 BUY 只是入场候选，却被当成接近足额开仓信号执行。很多信号属于技术分刚转正、短线反弹、MA20 或中期结构不稳的场景；A 股 T+1 又会放大买入后快速转弱的亏损。

本设计新增统一的 `portfolio_execution_guard`，同时解决 BUY 分层和组合级防守。规则必须同时适用于历史回放和实时模拟，但两者数据隔离：历史回放读回放临时运行库，实时模拟读 live `quant_sim.db`。

## 目标

1. 把 BUY 明确分为 `weak_buy`、`normal_buy`、`strong_buy`，不同层级对应不同仓位倍率或阻断。
2. 在组合连续亏损、连续止损、回撤扩大时，按配置比例对所有新开仓自动降级、缩仓或暂停。
3. 限制同一 checkpoint / 同一交易日的 BUY 数量，避免一批边缘信号同时开仓。
4. 冷启动股票没有盈利历史且趋势确认不足时，只允许轻仓试错。
5. 明确考虑 A 股 T+1 风险，对 30m 级别短线反弹信号提高确认要求。
6. 规则和参数进入策略配置，积极、稳定、保守可以有不同默认值，后续 UI 可编辑。

## 非目标

1. 不重写技术评分和双轨融合模型。
2. 不缓存加工结果。
3. 不把历史回放写入实时模拟状态表。
4. 不一刀切禁止高 RSI 或止损后再买；允许强趋势例外，但必须降仓。

## 执行位置

`SignalCenterService.create_signal()` 中新增门控顺序：

1. `_apply_position_constraints`
2. `_apply_position_add_gate`
3. `_apply_reentry_constraints`
4. `_apply_stock_execution_feedback`
5. `_apply_portfolio_execution_guard`
6. `_apply_transaction_cost_constraints`

`_apply_portfolio_execution_guard` 只记录 gate 和必要的 HOLD 转换，不直接预乘 `position_size_pct`。仓位倍率统一由 `capital_slots.gate_size_multiplier()` 读取，避免重复缩放。

## BUY 分层

### weak_buy

定义：技术刚过线，或者趋势确认不足。

触发条件包括任意一个：

1. fusion/tech 只是刚过 BUY 阈值，edge 小于配置的 `weak_edge_pct`。
2. MA20 不上行。
3. price 没有连续站稳 MA20。
4. MA5 > MA10 > MA20 不成立。
5. RSI/MACD 转强但价格距离短期低点的反弹幅度较大，存在反弹尾段风险。
6. 30m 信号当天新转 BUY，且缺少多 checkpoint 确认。

处理：

1. 默认允许，但倍率最多 `0.25`。
2. 如果组合处于冷却或亏损预算触发，转 HOLD。

### normal_buy

定义：有基本趋势确认，但还不是强趋势。

满足任一：

1. MA20 上行，并且 price > MA20 连续达到 `confirm_checkpoints`。
2. MA5 > MA10 > MA20，但量能或上下文确认不足。
3. 回踩 MA20 不破后重新站上。

处理：

1. 默认倍率 `0.5`。
2. 组合冷却时降一级为 weak_buy。

### strong_buy

定义：趋势结构、量能、失败环境都通过。

要求：

1. MA5 > MA10 > MA20。
2. price > MA20。
3. MA20 上行。
4. 量能确认，例如 volume_ratio 达到配置阈值，或 fusion/context 明显高于 BUY 阈值。
5. 没有近期组合熔断。
6. 该股近期没有连续止损，或个股反馈 gate 已通过强趋势例外。

处理：

1. 默认倍率 `1.0`。
2. 组合冷却时最多 `0.5`。

## 必须回答的问题

### 是否是反弹尾段

通过 `ma20_slope`、price 与 MA20 的连续关系、MA 排列、最近 checkpoint 是否刚从 MA20 下方反抽来判断。若只是刚站上 MA20 或 MA20 仍下行，最多 weak_buy。

### 技术指标滞后

MACD/RSI 单独转强不能产生 normal/strong。必须叠加 MA20 上行、连续站稳、MA 多头排列或回踩确认。否则视为滞后反弹信号。

### BUY 阈值太宽

fusion/tech 只比阈值高一点时，不再等同普通 BUY。edge 小于 `weak_edge_pct` 时强制 weak_buy。edge 达到 `normal_edge_pct` 或趋势确认后才能 normal_buy。

### 市场/个股失败环境

组合最近 N checkpoint 或 N 天内止损过多，所有 BUY 自动降级。达到熔断阈值时，非 strong_buy 转 HOLD。个股亏损反馈仍独立生效，最终倍率取所有 gate 的最严格值。

### T+1 放大风险

A 股 30m BUY 如果缺少多 checkpoint 确认，不能 normal/strong。冷启动或边缘 BUY 默认轻仓，减少当天买入后次日止损的损失。

### 确认强度不足

仅“指标满足可买”不够。normal/strong 必须具备 MA20 上行、连续站稳、MA 多头排列或回踩确认之一。

## 组合级防守

### 组合亏损熔断

统计最近 `lookback_checkpoints` 和 `lookback_days` 的 SELL 交易：

1. stop_loss_count >= `stop_loss_circuit_threshold`：进入冷却。
2. realized_pnl <= `loss_budget_amount`：暂停新开仓。
3. consecutive_stop_loss_count >= `consecutive_stop_loss_threshold`：暂停新开仓。

冷却期持续 `cooldown_checkpoints` 或 `cooldown_days`。冷却期内只允许 strong_buy，且倍率不超过配置的 `cooldown_size_multiplier`。

组合防守使用比例化配置，而不是只用固定金额：

1. `loss_budget_pct`：最近窗口已实现亏损 / 初始资金或当前权益，低于该比例则暂停新开仓。
2. `drawdown_guard_pct`：当前权益相对近期峰值回撤超过该比例，所有 BUY 降一级。
3. `stop_loss_density_threshold`：最近窗口 SELL 中止损占比超过该比例，所有 BUY 降一级。
4. `cooldown_size_multiplier`：冷却期内允许的 strong_buy 最大倍率。

固定金额 `loss_budget_amount` 只作为可选兜底，默认由 `loss_budget_pct` 换算。

### 单 checkpoint / 单日 BUY 上限

自动执行前对 pending BUY 排序，排序沿用 `calculate_buy_priority()`。超过：

1. `max_new_buys_per_checkpoint`
2. `max_new_buys_per_day`

的 BUY 转 HOLD，reason 写明 “组合防守：超过本 checkpoint/本日 BUY 上限”。

### 冷启动轻仓

没有该股历史盈利 SELL，且不满足 strong_buy：

1. weak_buy 最多 `cold_start_weak_multiplier`。
2. normal_buy 最多 `cold_start_normal_multiplier`。

冷启动轻仓不是永久限制。首次轻仓建仓后，后续信号转强时必须允许逐步恢复：

1. 如果持仓已有浮盈，且后续信号达到 `normal_buy`，允许通过 `position_add_gate` 加仓，但仍受组合冷却和 BUY 上限约束。
2. 如果后续信号达到 `strong_buy`，且组合不在熔断或亏损预算暂停状态，允许恢复正常仓位倍率。
3. 如果后续仍是 `weak_buy`，只允许维持或轻仓试错，不主动加仓。
4. 如果冷启动后马上止损，后续再买交给 `stock_execution_feedback_gate` 降仓或阻断。

冷启动解决“第一笔不要太重”，不阻止“信号确认后逐步加仓”。

### 市场环境门控

使用当前候选池和持仓快照估算市场环境：

1. 候选池中 price < MA20 的比例高于阈值。
2. 组合最近权益回撤超过阈值。
3. 最近止损密度升高。

触发后所有 BUY 降一级，或提高 BUY 确认要求。

市场/个股失败环境的逻辑风险与边界：

1. 这类门控会降低交易频率，可能错过 V 型反转，所以不能只因单次止损就熔断。
2. 组合级防守必须要求“数量 + 比例”同时有意义，例如 stop_loss_count 达标且 stop_loss_density 达标。
3. 个股失败环境只影响该股；组合失败环境影响所有新开仓。
4. strong_buy 可以作为例外，但在冷却期也必须降仓，避免刚亏完马上重仓追。
5. 所有触发原因必须写入 gate，UI 能看到是市场风险、个股失败，还是组合亏损预算导致。

## 配置

新增 `portfolio_execution_guard_policy`，放在策略配置：

`base.context.portfolio_execution_guard_policy`

默认值按策略区分：

### aggressive

1. `enabled = true`
2. `weak_multiplier = 0.25`
3. `normal_multiplier = 0.5`
4. `strong_multiplier = 1.0`
5. `max_new_buys_per_checkpoint = 2`
6. `max_new_buys_per_day = 4`
7. `stop_loss_circuit_threshold = 3`
8. `cooldown_days = 1`
9. `loss_budget_pct = -3.0`
10. `drawdown_guard_pct = 4.0`
11. `stop_loss_density_threshold = 0.50`
12. `cooldown_size_multiplier = 0.5`

### stable / neutral

1. `max_new_buys_per_checkpoint = 1`
2. `max_new_buys_per_day = 3`
3. `stop_loss_circuit_threshold = 2`
4. `cooldown_days = 2`
5. `loss_budget_pct = -2.0`
6. `drawdown_guard_pct = 3.0`
7. `stop_loss_density_threshold = 0.40`
8. `cooldown_size_multiplier = 0.35`

### conservative

1. `max_new_buys_per_checkpoint = 1`
2. `max_new_buys_per_day = 2`
3. `stop_loss_circuit_threshold = 2`
4. `cooldown_days = 3`
5. `loss_budget_pct = -1.5`
6. `drawdown_guard_pct = 2.0`
7. `stop_loss_density_threshold = 0.35`
8. `cooldown_size_multiplier = 0.25`

## Data Contract

新增 gate 存入 `strategy_profile.portfolio_execution_guard`：

```json
{
  "intent": "portfolio_execution_guard",
  "status": "passed|downgraded|blocked",
  "buy_tier": "weak_buy|normal_buy|strong_buy",
  "buy_tier_label": "弱买|普通买|强买",
  "size_multiplier": 0.25,
  "is_late_rebound": true,
  "late_rebound_reasons": ["MA20 still falling", "only one checkpoint above MA20"],
  "trend_confirmation": {
    "ma_stack": false,
    "ma20_rising": true,
    "above_ma20_checkpoints": 2,
    "retest_confirmed": false
  },
  "portfolio_guard": {
    "cooldown_active": false,
    "recent_stop_loss_count": 1,
    "consecutive_stop_loss_count": 1,
    "recent_realized_pnl": -1200.0,
    "loss_budget_triggered": false
  },
  "ui_badges": ["弱买", "疑似反弹尾段", "组合冷却"],
  "reasons": []
}
```

`capital_slots.gate_size_multiplier()` 需要同时读取：

1. `reentry_gate`
2. `stock_execution_feedback_gate`
3. `portfolio_execution_guard`

最终倍率取最小值，保留 `0.0`。

## 实时模拟与历史回放

实时模拟：

1. 从 live `sim_trades`、`strategy_signals`、`sim_account_snapshots` 统计组合状态。
2. 不读 replay DB。

历史回放：

1. 从回放临时库统计组合状态。
2. 持久化结果写入 replay DB。
3. checkpoint 时间必须来自 market snapshot / checkpoint，不使用任务运行时。

## UI

信号列表与信号详情必须展示 BUY 分层结果：

1. 信号列表新增或复用字段展示 `buy_tier_label`，例如弱买、普通买、强买。
2. 信号详情展示 `is_late_rebound`，并列出 `late_rebound_reasons`。
3. 如果被组合防守降级或阻断，展示 `portfolio_guard.reasons`。
4. 交易明细中的资金槽解释继续展示最终倍率。

设置页展示到策略配置中，与个股执行反馈配置同级：

1. BUY 分层
2. 组合熔断
3. BUY 上限
4. 冷启动轻仓
5. 市场环境门控
6. 亏损预算

## 测试

1. `weak_buy`：技术刚过线且 MA20 不上行，倍率 `0.25`。
2. `normal_buy`：MA20 上行且连续站稳，倍率 `0.5`。
3. `strong_buy`：MA 多头排列、量能确认、无冷却，倍率 `1.0`。
4. 组合冷却：连续止损后普通 BUY blocked，strong BUY downgraded。
5. checkpoint BUY 上限：只保留最高优先级 BUY，其他转 HOLD。
6. 冷启动：无盈利历史且非 strong BUY 降仓。
7. 冷启动后信号转为 strong_buy 时，允许通过加仓门控恢复正常加仓。
8. A 股 30m T+1 风险：单 checkpoint 刚转强只能 weak_buy。
9. 组合防守比例：loss_budget_pct、drawdown_guard_pct、stop_loss_density_threshold 能触发降级或暂停。
10. 信号 UI payload 包含 `buy_tier_label`、`is_late_rebound`、`late_rebound_reasons`。
11. 历史回放与实时模拟使用相同规则但数据隔离。

## 验收

用任务 #3 相同配置重跑：

1. 3/25 不应一次执行 4 笔接近正常仓位 BUY。
2. `300857`、`300684` 这类止损后再买继续保留个股反馈降仓。
3. 初始第一波边缘 BUY 数量下降。
4. 交易数下降，最大回撤下降。
5. 每个被降仓或阻断的 BUY 都能在信号详情中说明原因。
