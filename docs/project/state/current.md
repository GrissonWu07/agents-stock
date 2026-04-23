# Current State

## Objective
- Define and approve a refactor spec for dual-track scoring:
- Expand technical scoring to 12 dimensions.
- Make per-dimension weights configurable for both technical and context tracks.
- Add configurable dual-track fusion weights and explicit fusion mode.
- Add UI-managed strategy profiles for params/weights/algorithms and bind them to live/replay runs.
- Keep current behavior safe by default and avoid accidental strategy drift.

## Completed
- Reviewed current implementation paths and decision flow:
- `app/quant_kernel/runtime.py` (technical/context scoring and explainability payload assembly)
- `app/quant_kernel/decision_engine.py` (final dual-track action logic)
- `app/quant_kernel/config.py` (thresholds and fixed scoring constants)
- `app/quant_sim/signal_center_service.py` (AI overlay deltas that modify context score)
- `app/gateway_api.py` + `ui/src/features/quant/signal-detail-page.tsx` (explanation rendering)
- Identified that current final decision is rule-based, not linear fusion.
- Identified technical dimensions are limited (candidate=5, position=4) and weights are implicit constants.

## In Progress
- Upgraded spec to implementation-ready `v2.3` with:
- exact math formulas
- deterministic missing-field handling
- candidate/position profile design
- explicit hybrid precedence
- context grouped scoring and overlay ownership migration
- backward-compat acceptance definition
- schema versioning (`quant_explain/v2.3`)
- golden fixture regression scope
- fixed 12 review issues (normalization scope, context flat-group, fusion unavailable policy, confidence coverage, confirmation formula, veto priority, action mapping, scoring appendix, mode compatibility wording, config validation, contribution semantics, extra fixtures)
- extended spec with strategy profile configuration scope (UI/API/persistence/runtime binding to live and replay)
- completed requirement alignment pass: task now explicitly covers full 21-dimension parameterization, no-hardcoded-constant rule, and strategy-switch propagation tests.
- upgraded to spec `v2.3`: context grouped scoring as production default, candidate/position recommended default group weights, weighted/hybrid non-uniform default-weight policy, sell-precedence gate, divergence-penalized confidence, dynamic thresholds, and candidate-reject execution guard.
- aligned final-decision semantics across modes: veto-first for all modes, core-rule action separation, weighted BUY per-track gates, alpha=0 gate skipping, and stricter context-group validation/schema rules.
- incorporated final-review blockers: weighted action staging (`weighted_threshold_action` vs `weighted_action_raw`), rule-only legacy-path authority, replay fail-fast reproducibility policy, extended scorer algorithm types/schema, dynamic-threshold volatility source definition, and reason-template validation.
- applied final consistency fixes: section-9 abbreviated-schema clarification, scorer validation model (`dimension_id + algorithm`), explicit veto config source block, volatility-adjusted sell-precedence validation, execution-feedback score-cap math position, and per-profile dual-track override semantics.
- upgraded technical grouping to 4 groups: `trend`, `momentum`, `volume_confirmation`, `volatility_risk`.
- Waiting for final user approval before code implementation.

## Design/State Review Gate
- PASS (2026-04-22): `state`, `task`, `spec` are now aligned at implementation level:
- scope, formulas, precedence, compatibility, schema versioning, full parameterization, context grouped defaults, validation, sell-safety/conflict-penalty logic, and fixture regression criteria are consistent.
- No spec/task drift found for implementation entry.

## Risks / Decisions
- Risk: introducing explicit fusion weights could change live/replay signal behavior.
- Decision: default mode must remain behavior-compatible (`rule_only`) until explicitly switched.
- Risk: adding many dimensions without normalization will make scores unstable.
- Decision: adopt hierarchical scoring (`dimension -> group -> track -> fusion`) with clamping at each stage.
- Risk: UI may still be interpreted as “票数即权重”.
- Decision: expose explicit weight sources and formula fields from backend.

## Next Step
- User approves implementation-ready spec.
- Start execution by task step order: config -> scoring pipeline -> precedence -> adapter -> strategy profile module -> UI binding -> fixtures.
