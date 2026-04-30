# Profit Protection Design

## Goal

Add configurable profit-protection exits for position tracking so large unrealized gains are not held through severe drawdowns while aggressive profiles can still capture long trends.

## Behavior

Profit protection only applies to held positions. Candidate SELL signals remain non-tradable and ordinary low-profit technical SELL signals keep the existing dual-track behavior.

Each position tracks its historical unrealized peak:

- `peak_price`
- `peak_unrealized_pnl_pct`
- `peak_unrealized_pnl`
- `peak_at`

The peak is updated when market price refreshes and never decreases during drawdown.

## Vetoes

Two position vetoes are added:

- `profit_tech_sell`: triggered when a position has a sufficiently large peak profit, sufficient absolute price and amount gain, a drawdown from peak, and the technical/core rule is SELL.
- `hard_profit_trailing_stop`: triggered when the position has a larger peak profit and larger drawdown, independent of technical SELL.

Both vetoes force final action `SELL` through the existing `veto_first` path.

## Profile Defaults

Aggressive:

- tech SELL peak pct: 50
- tech SELL drawdown pct: 15
- min price gain: max(2.5, avg_price * 12%)
- min amount gain: max(1500, position_cost * 12%)
- hard trailing peak pct: 80
- hard trailing drawdown pct: 25
- hard min price gain: max(4.0, avg_price * 18%)
- hard min amount gain: max(2500, position_cost * 18%)

Stable:

- tech SELL peak pct: 30
- tech SELL drawdown pct: 10
- min price gain: max(1.5, avg_price * 8%)
- min amount gain: max(800, position_cost * 8%)
- hard trailing peak pct: 50
- hard trailing drawdown pct: 18
- hard min price gain: max(2.0, avg_price * 12%)
- hard min amount gain: max(1200, position_cost * 12%)

Conservative:

- tech SELL peak pct: 20
- tech SELL drawdown pct: 6
- min price gain: max(1.0, avg_price * 6%)
- min amount gain: max(500, position_cost * 6%)
- hard trailing peak pct: 35
- hard trailing drawdown pct: 12
- hard min price gain: max(1.5, avg_price * 9%)
- hard min amount gain: max(800, position_cost * 9%)

## UI

Add a standalone "浮盈保护" section in the strategy configuration page. It exposes the enabled flags and numeric thresholds above. The page saves them with the existing strategy profile config.

## Tests

Add tests for:

- peak fields update upward and do not decrease on pullback
- `profit_tech_sell` forces SELL only after peak, drawdown, absolute price gain, absolute amount gain, and tech SELL are all satisfied
- `hard_profit_trailing_stop` forces SELL without tech SELL
- low absolute price/amount gain does not trigger even when percentage gain is large
- builtin aggressive/stable/conservative profiles include the expected threshold tiers
