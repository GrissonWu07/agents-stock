"""Kernel configuration dataclasses replacing stockpolicy YAML runtime config."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class DualTrackPositionRule:
    tech_score_min: float
    context_score_min: float | None = None
    context_score_max: float | None = None
    position_ratio: float = 0.0


@dataclass(frozen=True)
class DualTrackConfig:
    veto_threshold: float
    extreme_bullish_threshold: float
    resonance_full: DualTrackPositionRule
    resonance_heavy: DualTrackPositionRule
    resonance_moderate: DualTrackPositionRule
    resonance_standard: DualTrackPositionRule
    divergence_light: DualTrackPositionRule
    divergence_none: DualTrackPositionRule


@dataclass(frozen=True)
class SourceContextConfig:
    default_weight: float
    source_weights: Mapping[str, float]


@dataclass(frozen=True)
class TechnicalScoreConfig:
    trend_up_bonus: float
    trend_down_penalty: float
    alignment_bonus: float
    misalignment_penalty: float
    macd_positive_bonus: float
    macd_negative_penalty: float
    balanced_rsi_min: float
    balanced_rsi_max: float
    balanced_rsi_bonus: float
    overbought_rsi_threshold: float
    overbought_rsi_penalty: float
    oversold_rsi_threshold: float
    oversold_rsi_bonus: float
    high_volume_ratio_threshold: float
    high_volume_ratio_bonus: float
    low_volume_ratio_threshold: float
    low_volume_ratio_penalty: float
    buy_threshold: float
    sell_threshold: float
    min_confidence: float
    max_confidence: float
    base_confidence: float
    tech_confidence_weight: float
    context_confidence_weight: float


@dataclass(frozen=True)
class PositionScoreConfig:
    below_ma20_penalty: float
    negative_macd_penalty: float
    deep_loss_threshold: float
    deep_loss_penalty: float
    strong_profit_threshold: float
    strong_profit_penalty: float
    guarded_profit_threshold: float
    guarded_profit_bonus: float
    overbought_rsi_threshold: float
    overbought_rsi_penalty: float


@dataclass(frozen=True)
class MarketRegimeConfig:
    bullish_threshold: float
    weak_threshold: float
    trend_up_weight: float
    trend_down_weight: float
    above_ma20_weight: float
    below_ma20_weight: float
    above_ma60_weight: float
    below_ma60_weight: float
    positive_macd_weight: float
    negative_macd_weight: float
    strong_volume_weight: float
    weak_volume_weight: float


@dataclass(frozen=True)
class FundamentalQualityConfig:
    strong_threshold: float
    weak_threshold: float
    profit_growth_strong: float
    profit_growth_weak: float
    roe_strong: float
    roe_weak: float
    pe_reasonable_max: float
    pe_expensive_min: float
    pb_reasonable_max: float
    pb_expensive_min: float
    strong_bonus: float
    weak_penalty: float


@dataclass(frozen=True)
class RiskStylePreset:
    label: str
    buy_threshold_offset: float
    sell_threshold_offset: float
    max_position_ratio: float
    confidence_bonus: float
    allow_pyramiding: bool


@dataclass(frozen=True)
class TimeframeProfile:
    key: str
    buy_threshold: float
    sell_threshold: float
    max_position_ratio: float
    allow_pyramiding: bool
    confirmation: str


@dataclass(frozen=True)
class QuantKernelConfig:
    dual_track: DualTrackConfig
    source_context: SourceContextConfig
    technical: TechnicalScoreConfig
    position_scoring: PositionScoreConfig
    market_regime: MarketRegimeConfig
    fundamental_quality: FundamentalQualityConfig
    risk_style_presets: Mapping[str, RiskStylePreset]
    timeframe_profiles: Mapping[str, TimeframeProfile]

    @classmethod
    def default(cls) -> "QuantKernelConfig":
        return cls(
            dual_track=DualTrackConfig(
                veto_threshold=-0.5,
                extreme_bullish_threshold=0.8,
                resonance_full=DualTrackPositionRule(tech_score_min=0.75, context_score_min=0.6, position_ratio=1.0),
                resonance_heavy=DualTrackPositionRule(tech_score_min=0.6, context_score_min=0.6, position_ratio=0.8),
                resonance_moderate=DualTrackPositionRule(tech_score_min=0.75, context_score_min=0.3, position_ratio=0.6),
                resonance_standard=DualTrackPositionRule(tech_score_min=0.6, context_score_min=0.3, position_ratio=0.5),
                divergence_light=DualTrackPositionRule(
                    tech_score_min=0.75,
                    context_score_min=0.0,
                    context_score_max=0.3,
                    position_ratio=0.3,
                ),
                divergence_none=DualTrackPositionRule(tech_score_min=-1.0, context_score_max=0.0, position_ratio=0.0),
            ),
            source_context=SourceContextConfig(
                default_weight=0.1,
                source_weights={
                    "main_force": 0.28,
                    "profit_growth": 0.22,
                    "low_price_bull": 0.18,
                    "value_stock": 0.2,
                    "small_cap": 0.16,
                    "manual": 0.12,
                },
            ),
            technical=TechnicalScoreConfig(
                trend_up_bonus=0.35,
                trend_down_penalty=0.35,
                alignment_bonus=0.25,
                misalignment_penalty=0.25,
                macd_positive_bonus=0.15,
                macd_negative_penalty=0.15,
                balanced_rsi_min=45,
                balanced_rsi_max=68,
                balanced_rsi_bonus=0.1,
                overbought_rsi_threshold=75,
                overbought_rsi_penalty=0.12,
                oversold_rsi_threshold=25,
                oversold_rsi_bonus=0.08,
                high_volume_ratio_threshold=1.2,
                high_volume_ratio_bonus=0.08,
                low_volume_ratio_threshold=0.8,
                low_volume_ratio_penalty=0.05,
                buy_threshold=0.6,
                sell_threshold=-0.3,
                min_confidence=0.35,
                max_confidence=0.95,
                base_confidence=0.58,
                tech_confidence_weight=0.22,
                context_confidence_weight=0.08,
            ),
            position_scoring=PositionScoreConfig(
                below_ma20_penalty=0.25,
                negative_macd_penalty=0.2,
                deep_loss_threshold=-5.0,
                deep_loss_penalty=0.35,
                strong_profit_threshold=10.0,
                strong_profit_penalty=0.15,
                guarded_profit_threshold=2.0,
                guarded_profit_bonus=0.08,
                overbought_rsi_threshold=75.0,
                overbought_rsi_penalty=0.12,
            ),
            market_regime=MarketRegimeConfig(
                bullish_threshold=0.45,
                weak_threshold=-0.2,
                trend_up_weight=0.24,
                trend_down_weight=0.24,
                above_ma20_weight=0.16,
                below_ma20_weight=0.16,
                above_ma60_weight=0.16,
                below_ma60_weight=0.16,
                positive_macd_weight=0.16,
                negative_macd_weight=0.16,
                strong_volume_weight=0.1,
                weak_volume_weight=0.1,
            ),
            fundamental_quality=FundamentalQualityConfig(
                strong_threshold=0.45,
                weak_threshold=-0.15,
                profit_growth_strong=25.0,
                profit_growth_weak=-10.0,
                roe_strong=15.0,
                roe_weak=5.0,
                pe_reasonable_max=30.0,
                pe_expensive_min=60.0,
                pb_reasonable_max=3.5,
                pb_expensive_min=8.0,
                strong_bonus=0.22,
                weak_penalty=0.22,
            ),
            risk_style_presets={
                "激进": RiskStylePreset(
                    label="激进",
                    buy_threshold_offset=-0.04,
                    sell_threshold_offset=-0.03,
                    max_position_ratio=0.8,
                    confidence_bonus=0.04,
                    allow_pyramiding=True,
                ),
                "稳重": RiskStylePreset(
                    label="稳重",
                    buy_threshold_offset=0.0,
                    sell_threshold_offset=0.0,
                    max_position_ratio=0.6,
                    confidence_bonus=0.0,
                    allow_pyramiding=False,
                ),
                "保守": RiskStylePreset(
                    label="保守",
                    buy_threshold_offset=0.08,
                    sell_threshold_offset=0.05,
                    max_position_ratio=0.35,
                    confidence_bonus=-0.03,
                    allow_pyramiding=False,
                ),
            },
            timeframe_profiles={
                "1d": TimeframeProfile(
                    key="1d",
                    buy_threshold=0.6,
                    sell_threshold=-0.3,
                    max_position_ratio=0.6,
                    allow_pyramiding=False,
                    confirmation="日线方向确认",
                ),
                "30m": TimeframeProfile(
                    key="30m",
                    buy_threshold=0.68,
                    sell_threshold=-0.22,
                    max_position_ratio=0.5,
                    allow_pyramiding=False,
                    confirmation="30分钟信号确认",
                ),
                "1d+30m": TimeframeProfile(
                    key="1d+30m",
                    buy_threshold=0.72,
                    sell_threshold=-0.2,
                    max_position_ratio=0.45,
                    allow_pyramiding=False,
                    confirmation="日线方向 + 30分钟共振确认",
                ),
            },
        )
