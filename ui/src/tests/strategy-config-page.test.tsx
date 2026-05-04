import { describe, expect, it } from "vitest";
import { buildUnifiedEditableConfig } from "../features/settings/strategy-config-page";

const getPolicy = (config: Record<string, unknown>, path: string[]) => {
  let value: unknown = config;
  for (const key of path) {
    value = (value as Record<string, unknown>)[key];
  }
  return value as Record<string, unknown>;
};

describe("StrategyConfigPage config normalization", () => {
  it("keeps built-in profile stock feedback policy ahead of candidate defaults", () => {
    const config = buildUnifiedEditableConfig({
      base: {
        context: {
          stock_execution_feedback_policy: {
            loss_reentry_size_multiplier: 0.5,
            repeated_stop_size_multiplier: 0.35,
          },
        },
      },
      profiles: {
        candidate: {
          context: {},
        },
        position: {
          context: {},
        },
      },
    });

    expect(getPolicy(config, ["base", "context", "stock_execution_feedback_policy"])).toMatchObject({
      loss_reentry_size_multiplier: 0.5,
      repeated_stop_size_multiplier: 0.35,
    });
    expect(getPolicy(config, ["profiles", "candidate", "context", "stock_execution_feedback_policy"])).toMatchObject({
      loss_reentry_size_multiplier: 0.5,
      repeated_stop_size_multiplier: 0.35,
    });
    expect(getPolicy(config, ["profiles", "position", "context", "stock_execution_feedback_policy"])).toMatchObject({
      loss_reentry_size_multiplier: 0.5,
      repeated_stop_size_multiplier: 0.35,
    });
  });

  it("keeps built-in profile portfolio guard policy ahead of candidate defaults", () => {
    const config = buildUnifiedEditableConfig({
      base: {
        context: {
          portfolio_execution_guard_policy: {
            weak_edge_abs: 0.03,
            cooldown_size_multiplier: 0.5,
            max_new_buys_per_checkpoint: 2,
          },
        },
      },
      profiles: {
        candidate: {
          context: {},
        },
        position: {
          context: {},
        },
      },
    });

    expect(getPolicy(config, ["base", "context", "portfolio_execution_guard_policy"])).toMatchObject({
      weak_edge_abs: 0.03,
      cooldown_size_multiplier: 0.5,
      max_new_buys_per_checkpoint: 2,
    });
    expect(getPolicy(config, ["profiles", "candidate", "context", "portfolio_execution_guard_policy"])).toMatchObject({
      weak_edge_abs: 0.03,
      cooldown_size_multiplier: 0.5,
      max_new_buys_per_checkpoint: 2,
    });
    expect(getPolicy(config, ["profiles", "position", "context", "portfolio_execution_guard_policy"])).toMatchObject({
      weak_edge_abs: 0.03,
      cooldown_size_multiplier: 0.5,
      max_new_buys_per_checkpoint: 2,
    });
  });
});
