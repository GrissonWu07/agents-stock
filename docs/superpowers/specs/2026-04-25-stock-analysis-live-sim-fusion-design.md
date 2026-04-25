# Stock Analysis Live Simulation Fusion Design

**Date:** 2026-04-25  
**Status:** ready for review after unified indicator engine spec  
**Scope:** use stock-analysis conclusions as a controlled realtime simulation context factor.

## 1. Goal

Realtime simulation should be able to use recent stock-analysis conclusions, but the analysis must not directly decide BUY/SELL/HOLD.

The stock-analysis result becomes a small, auditable environment/context contribution. It can nudge the fusion score and confidence, but it cannot override technical gates, vetoes, position limits, or execution rules.

## 2. Dependency

This design depends on `2026-04-25-unified-data-indicator-engine-design.md`.

The dependency matters because stock-analysis technical indicators and realtime simulation indicators must first share the same market-data and indicator formula path. Without that, fusing stock-analysis output would mix inconsistent technical numbers.

## 3. Non-Negotiable Rules

- Realtime simulation may use recent stock-analysis conclusions.
- Historical replay must not use current realtime stock-analysis conclusions.
- Stock-analysis context is optional. If missing, stale, invalid, or low-confidence, it is omitted.
- Stock-analysis context is not a trading action. It is a context factor.
- The factor must be capped by strategy profile.
- The signal detail page must show whether the factor was used or omitted, including source record ID and timestamps.
- Fetching/generating a new stock analysis must be asynchronous and non-blocking for realtime simulation.

## 4. Current State

Stock analysis records are stored in `stock_analysis.db` through `StockAnalysisDatabase.save_analysis(...)`.

Records currently include:

- `symbol`
- `stock_name`
- `analysis_date`
- `period`
- `stock_info`
- `agents_results`
- `discussion_result`
- `final_decision`
- `indicators`
- `historical_data`
- `created_at`

Realtime simulation currently uses:

- Technical score from market snapshot indicators.
- Context score from source prior, trend, structure, momentum, risk, liquidity, session, account posture, and execution feedback.
- Dynamic strategy components from market, sector, news, and AI decision context.

There is no direct read from `stock_analysis.db` in realtime simulation decisions today.

## 5. Data Model Additions

Add point-in-time metadata to `analysis_records`:

- `data_as_of TEXT`
- `valid_until TEXT`
- `analysis_context_json TEXT`
- `formula_profile TEXT`
- `indicator_version TEXT`

`data_as_of` is the newest market/fundamental/news timestamp visible to the analysis. If exact source max time is unavailable in the first implementation, use `analysis_date` and mark `data_as_of_quality = "generated_at_fallback"` inside `analysis_context_json`.

`analysis_context_json` stores normalized trading-facing signals extracted from the AI analysis:

```json
{
  "schema_version": "stock_analysis_context_v1",
  "action_bias": 0.35,
  "confidence": 0.72,
  "risk_bias": -0.2,
  "fundamental_bias": 0.1,
  "fund_flow_bias": 0.25,
  "sentiment_bias": 0.0,
  "summary": "资金面偏强但估值不便宜，适合回踩确认。",
  "source_fields": ["final_decision", "agents_results.fund_flow", "agents_results.risk"],
  "data_as_of_quality": "generated_at_fallback"
}
```

## 6. Normalization

Create a normalizer such as:

```text
app/data/analysis_context/
  __init__.py
  schema.py
  normalizer.py
  repository.py
```

`StockAnalysisContextNormalizer` converts `final_decision` and analyst outputs into bounded numeric fields.

Output ranges:

- `action_bias`: `-1.0..1.0`
- `confidence`: `0.0..1.0`
- `risk_bias`: `-1.0..1.0`
- `fundamental_bias`: `-1.0..1.0`
- `fund_flow_bias`: `-1.0..1.0`
- `sentiment_bias`: `-1.0..1.0`

Mapping rules:

- Explicit bullish/buy/add/positive conclusions map positive.
- Explicit bearish/sell/reduce/risk-off conclusions map negative.
- Hold/watch/wait maps near zero.
- Risk warnings reduce confidence and may contribute negative `risk_bias`.
- Missing fields are omitted, not scored as zero.
- Raw LLM text is not trusted without deterministic parsing rules.

## 7. Realtime Retrieval Policy

Realtime simulation uses `StockAnalysisContextRepository.get_latest_valid(symbol, as_of=now, ttl_hours=...)`.

Rules:

- Record must match symbol.
- `created_at <= now`.
- `data_as_of <= now`.
- `valid_until >= now`.
- `confidence >= min_stock_analysis_confidence`.
- Record age must be within profile TTL, default 48 hours.

If no valid record exists:

- Realtime simulation continues without this factor.
- A background refresh task may be enqueued.
- The current decision must not wait for the refresh.

## 8. Async Refresh Policy

Realtime simulation can enqueue stock-analysis refresh for:

- Candidate symbols with no valid analysis.
- Candidate symbols with expired analysis.
- Position symbols with expired analysis.

The refresh must:

- Run in a bounded background queue.
- De-duplicate by symbol.
- Respect provider/LLM rate limits.
- Persist result to `stock_analysis.db`.
- Not send stock notification messages by itself.
- Not block the current simulation cycle.

Default refresh limits:

- Max 3 concurrent analysis jobs.
- Max 10 queued symbols per realtime cycle.
- TTL default 48 hours.
- Emergency force-refresh is UI/manual only.

## 9. Fusion Location

Add stock-analysis context to the environment/context track, not the technical track.

Reason:

- Technical indicators already have deterministic scoring.
- Stock-analysis contains mixed basic/fund-flow/risk/news conclusions.
- Reusing its technical text would double-count MA/MACD/RSI.

Recommended new context dimension:

```text
context.stock_analysis
```

Raw dimension fields:

- `score`: normalized `action_bias`, adjusted by risk and confidence.
- `confidence`
- `record_id`
- `generated_at`
- `data_as_of`
- `valid_until`
- `summary`

Suggested score:

```text
score = clamp(action_bias + 0.25 * risk_bias, -1, 1)
effective_score = score * confidence
```

## 10. Strategy Profile Defaults

Initial weights should be small.

Candidate profile:

- aggressive: `0.08`
- stable: `0.05`
- conservative: `0.03`

Position profile:

- aggressive: `0.06`
- stable: `0.04`
- conservative: `0.02`

Caps:

- Max positive contribution: `+0.08`
- Max negative contribution: `-0.08`
- Default `min_stock_analysis_confidence`: `0.45`

Missing stock-analysis context must be omitted from normalization, not scored as zero.

## 11. Signal Detail Audit

Signal detail must display:

- Whether stock-analysis context was used.
- Omitted reason if not used:
  - no_record
  - expired
  - future_record
  - low_confidence
  - disabled_by_profile
- `record_id`
- `generated_at`
- `data_as_of`
- `valid_until`
- `context_score`
- `context_contribution`
- `confidence`
- `summary`

The contribution should appear in the existing contribution breakdown, not only in raw parameter details.

## 12. Historical Replay Policy

Historical replay does not use realtime stock-analysis refresh.

Replay may use stock-analysis context only if all conditions hold:

- `created_at <= checkpoint_at`
- `data_as_of <= checkpoint_at`
- `valid_until >= checkpoint_at`
- The record exists before the replay run starts or was generated by an explicit historical analysis precompute task.

If no valid as-of record exists, replay omits `context.stock_analysis`.

No replay checkpoint may call live LLM/AKShare/TDX/Tushare to generate current stock analysis.

## 13. UI Behavior

Realtime simulation UI should show:

- `股票分析上下文：启用/关闭`
- TTL setting
- Background queue status
- Last valid analysis timestamp per candidate/position when available

Signal detail should show stock-analysis context inside decision explanation, not as a separate unrelated analysis panel.

## 14. Testing Requirements

Unit tests:

- Normalizer maps deterministic final decisions to bounded context scores.
- Missing/ambiguous fields produce omitted components.
- Expired records are not used.
- Low-confidence records are not used.
- Valid records become `context.stock_analysis` raw dimension.
- Missing records do not reduce the normalized context score.

Realtime simulation tests:

- Valid stock-analysis context changes fusion score by capped amount.
- Stock-analysis context cannot directly override a veto.
- Missing analysis enqueues async refresh but does not block current decision.
- Refresh queue deduplicates symbols.

Replay tests:

- A current stock-analysis record after checkpoint is not used.
- Replay does not enqueue stock-analysis refresh.
- A valid as-of analysis record may be used and is audited.

Signal detail tests:

- Used context displays record ID, timestamps, score, confidence, contribution.
- Omitted context displays reason.

## 15. Rollout Plan

Phase 1:

- Add schema columns and repository.
- Add normalizer and tests.
- Add read-only context factor disabled by default.

Phase 2:

- Enable context factor for realtime simulation profiles with small weights.
- Add signal detail audit rows.
- Add UI status.

Phase 3:

- Add async refresh queue.
- Keep refresh non-blocking.

Phase 4:

- Add historical as-of support only after explicit historical analysis precompute exists.

## 16. Out Of Scope

- Unified indicator engine implementation. That is covered by the separate data/indicator spec.
- Using stock-analysis context in historical replay without as-of records.
- Letting AI analysis directly decide trades.
- Sending notifications from stock-analysis refresh tasks.

## 17. Self-Review

- The design explicitly depends on unified indicator formulas first.
- Realtime and replay behavior are separated.
- Missing analysis does not penalize a stock.
- The factor is capped and auditable.
- Async refresh is non-blocking and rate-limited.
