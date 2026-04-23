# Dual-Track Weighted Scoring Refactor Plan

## Scope
- Expand technical scoring to 12 dimensions with grouped scoring (`trend/momentum/volume_confirmation/volatility_risk`).
- Add configurable technical/context weights and dual-track fusion weights.
- Promote context from flat scoring to grouped scoring in production defaults.
- Define profile behavior for candidate and position.
- Make hybrid precedence deterministic and testable.
- Move context overlay into context-track feature ownership.
- Add schema versioning and v1 adapter.
- Add golden fixture regression tests.
- Add strategy profile configuration module (UI + API + persistence).
- Bind strategy profile selection into live simulation and historical replay.
- Preserve existing behavior by default (`rule_only`).

## Steps
1. [x] Config schema and profile merge (success criteria: base/candidate/position config works; defaults keep `rule_only`)
2. [x] Math pipeline implementation (success criteria: formulas in spec section 3 are implemented exactly; dimension normalization is group-local; weighted BUY per-track gates are enforced)
3. [x] Fusion confidence conflict penalty (success criteria: divergence/sign-conflict penalty fields and formula are implemented in section 3.5)
4. [x] Dynamic threshold policy (success criteria: `static` and `volatility_adjusted` threshold modes work and emit effective thresholds)
5. [x] Missing-field deterministic handling (success criteria: spec section 4 reason codes and fallback behavior are returned)
6. [x] Final-decision precedence implementation (success criteria: section 7 mode interaction is enforced for `rule_only/weighted_only/hybrid`, including veto-first, core-rule separation, `weighted_threshold_action -> weighted_action_raw` staging, and `sell_precedence_gate`)
7. [ ] Context overlay ownership migration (success criteria: no post-fusion score mutation path remains; grouped context stays authoritative; execution feedback uses decay/sparse/cap policy)
8. [ ] Schema versioning and adapter (success criteria: `quant_explain/v2.3` emitted; v1 payloads adapt safely)
9. [ ] Candidate reject execution guard (success criteria: candidate raw `SELL` is mapped to non-tradable `candidate_reject` and filtered from execution queues/UI signal lists)
10. [ ] Signal-detail UI alignment (success criteria: render v2 decision path/weights/conflict-penalty/effective-threshold fields, v1 compatible)
11. [ ] Full parameterization schema (success criteria: all 12 technical + 9 context dimensions define configurable `weight + algorithm + params + reason_template`, and section-9 `scorers` schema is wired)
12. [ ] Config validation rules (success criteria: invalid weight/threshold/unknown-dimension/incomplete-param configs are rejected with deterministic errors; volatility-adjusted sell-precedence constraint and reason-template placeholder validation are enforced)
13. [ ] Context grouped scoring model (success criteria: `market_structure/risk_account/tradability_timing/source_execution` group config + explainability + adapter are implemented)
14. [ ] Production default profile templates (success criteria: candidate/position defaults use non-uniform technical/context group weights per spec)
15. [ ] Strategy profile persistence and API (success criteria: CRUD/clone/validate/set-default endpoints implemented and versioned)
16. [ ] Settings strategy-config UI (success criteria: full profile editor exposes all numeric knobs, percentages, weights, algorithm type and per-dimension params, including context groups)
17. [ ] Strategy switch propagation (success criteria: live/replay strategy profile switch takes effect for new computations without restart)
18. [ ] Live simulation binding (success criteria: run-level profile selector exists and applied profile is persisted on generated signals)
19. [ ] Historical replay binding (success criteria: replay binds immutable `strategy_profile_version_id` or `config_snapshot_json`; missing/invalid binding fails fast; no post-creation fallback)
20. [ ] Signal/task profile metadata exposure (success criteria: task detail and signal detail return profile id/name/version)
21. [ ] Golden fixture tests (success criteria: 10 fixtures pass including `track_unavailable_one_side` and `config_invalid_weights`; `rule_only` action parity is 100%)
22. [ ] Final compatibility verification (success criteria: live/replay APIs stable, no UI/runtime regression)

## Verification
- command: `pytest -q tests/quant_kernel/test_scoring_v2.py`
- expected: math/precedence/missing handling unit tests all pass
- actual: pending
- command: `pytest -q tests/quant_kernel/test_sell_precedence_gate.py`
- expected: weak weighted SELL cannot override HOLD/BUY unless `FusionScore <= sell_precedence_gate`
- actual: pending
- command: `pytest -q tests/quant_kernel/test_mode_veto_interaction.py`
- expected: hard veto is applied first for all modes; `core_rule_action` stays veto-independent
- actual: pending
- command: `pytest -q tests/quant_kernel/test_weighted_action_staging.py`
- expected: `weighted_threshold_action` and `weighted_action_raw` differ correctly when gates fail
- actual: pending
- command: `pytest -q tests/quant_kernel/test_weighted_buy_track_gates.py`
- expected: weighted BUY requires enabled-track score/confidence gates and skips gates for zero-alpha disabled tracks
- actual: pending
- command: `pytest -q tests/quant_kernel/test_track_gate_alpha_disable.py`
- expected: per-track BUY gates are skipped when corresponding track alpha is zero
- actual: pending
- command: `pytest -q tests/quant_kernel/test_fusion_confidence_penalty.py`
- expected: conflicting track directions reduce FusionConfidence deterministically
- actual: pending
- command: `pytest -q tests/quant_kernel/test_dynamic_threshold_policy.py`
- expected: static and volatility-adjusted threshold modes produce expected effective thresholds
- actual: pending
- command: `pytest -q tests/quant_kernel/test_dynamic_threshold_sell_precedence_validation.py`
- expected: volatility-adjusted mode enforces `sell_precedence_gate <= fusion_sell_threshold - sell_vol_k`
- actual: pending
- command: `pytest -q tests/quant_kernel/test_golden_regression.py`
- expected: all 10 fixtures pass, `rule_only` action parity 100%
- actual: pending
- command: `pytest -q tests/quant_kernel/test_config_validation.py`
- expected: invalid config cases fail fast with expected error messages
- actual: pending
- command: `pytest -q tests/quant_kernel/test_dimension_parametrization_matrix.py`
- expected: all 21 dimensions expose required scorer schema (`algorithm+params+reason_template`) and no hardcoded scorer constants are used
- actual: pending
- command: `pytest -q tests/quant_kernel/test_context_grouped_scoring.py`
- expected: context four-group scoring and explainability output are correct; flat-compat adapter passes
- actual: pending
- command: `pytest -q tests/quant_kernel/test_context_group_validation.py`
- expected: context dimension groups are total/disjoint and per-group positive-weight constraints are enforced
- actual: pending
- command: `pytest -q tests/quant_kernel/test_reason_template_validation.py`
- expected: unknown placeholders in reason templates are rejected by config validation
- actual: pending
- command: `pytest -q tests/e2e/test_strategy_switch_live_replay.py`
- expected: switching strategy profile changes scoring output and metadata in live/replay without service restart
- actual: pending
- command: `pytest -q tests/e2e/test_replay_profile_binding_failfast.py`
- expected: replay binds immutable profile version/snapshot and fails fast on missing/invalid binding; no fallback
- actual: pending
- command: `pytest -q tests/api/test_strategy_profiles.py`
- expected: strategy profile CRUD/validate/default/binding API contract passes
- actual: pending
- command: `pytest -q tests/api/test_signal_detail_payload.py`
- expected: v2.3 payload exposes `weighted_threshold_action`, `weighted_action_raw`, threshold/penalty fields; v1 adapter contract passes
- actual: pending
- command: `pytest -q tests/api/test_candidate_reject_visibility.py`
- expected: candidate reject is non-tradable and absent from execution signal feeds
- actual: pending

## Handoff Notes
- No behavior switch allowed unless config mode is changed from `rule_only`.
- Any drift from spec sections 3/4/7/9/11/12 is blocking.
- Any drift from strategy-profile spec sections 16/17 is also blocking.
- Any hardcoded decision/scoring numeric constants outside validated profile config are blocking.
- Weighted/hybrid production defaults with uniform group weights are blocking.
- Hybrid rollout to production is blocked until weighted-only replay/backtest phase passes.
